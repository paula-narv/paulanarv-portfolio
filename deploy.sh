#!/usr/bin/env bash
#
# deploy.sh — Reconcile a fresh Claude Design export and (optionally) deploy it.
#
# Every fresh Claude Design export reverts two hand-applied fixes:
#   1) the Résumé link (export ships Google Drive links; we want the bundled local PDF)
#   2) the 3DM "Options" image (export ships the stale "+ AI Layer" version)
# This script re-applies both automatically, syncs into the repo, and verifies —
# so those fixes can never be forgotten.
#
# USAGE:
#   ./deploy.sh                         # use the newest ~/Downloads/dist* folder, prepare only
#   ./deploy.sh "/path/to/dist 3"       # use a specific export folder
#   ./deploy.sh --push                  # newest folder AND commit + push (goes LIVE)
#   ./deploy.sh "/path/to/dist 3" --push
#
set -euo pipefail

# ---- config (edit here if paths ever change) ----
REPO="/Users/paulanarvaez/Desktop/paulanarv-portfolio"
DRIVE_URL="https://drive.google.com/file/d/1y3C0lbZy9JevKY5ZELNaqGJTuvCPjsly/view?usp=drive_link"
# Canonical résumé = the copy already bundled in the repo. To UPDATE the résumé,
# replace this file with your new PDF (keep the same name), then deploy.
RESUME_SRC="$REPO/dist/assets/Paula-Narvaez-Resume.pdf"
IMG_SRC="/Users/paulanarvaez/Desktop/Files/Website/3DM/Pitch diagram options.jpg"
LOCAL_RESUME="assets/Paula-Narvaez-Resume.pdf"
LOCAL_IMG="assets/3dot-pitch-options.jpg"

# ---- parse args (a folder path and/or --push, in any order) ----
NEW=""; PUSH=0
for a in "$@"; do
  if [ "$a" = "--push" ]; then PUSH=1; else NEW="$a"; fi
done
if [ -z "$NEW" ]; then
  NEW=$(ls -dt /Users/paulanarvaez/Downloads/dist* 2>/dev/null | head -1 || true)
fi

echo "==> Build folder: $NEW"
[ -n "$NEW" ] && [ -d "$NEW" ] || { echo "ERROR: build folder not found. Pass the path explicitly."; exit 1; }
[ -f "$RESUME_SRC" ] || { echo "ERROR: résumé PDF not found at $RESUME_SRC"; exit 1; }
[ -f "$IMG_SRC" ]    || { echo "ERROR: correct 3DM image not found at $IMG_SRC"; exit 1; }

# ---- Fix 1+2: bundle the résumé (copy PDF in + repoint every Drive link) ----
echo "==> Bundling résumé (local PDF, removing Google Drive links)"
cp "$RESUME_SRC" "$NEW/$LOCAL_RESUME"
python3 - "$NEW" "$DRIVE_URL" "$LOCAL_RESUME" <<'PY'
import sys, glob, os
d, drive, local = sys.argv[1:4]
total = 0
for f in sorted(glob.glob(os.path.join(d,"*.html")) + glob.glob(os.path.join(d,"*.js"))):
    s = open(f, encoding="utf-8").read(); n = s.count(drive)
    if n:
        open(f, "w", encoding="utf-8").write(s.replace(drive, local)); total += n
print(f"    repointed {total} résumé link(s)")
PY

# ---- Fix 3: swap in the correct (pre-AI-layer) 3DM options image ----
# Report whether the export was already correct (so you know if your
# Claude Design source-fix is holding) before we enforce the correct file.
if cmp -s "$IMG_SRC" "$NEW/$LOCAL_IMG" 2>/dev/null; then
  echo "==> 3DM image already correct in export — Claude Design source-fix is HOLDING ✅"
else
  echo "==> 3DM image was STALE in export — swapping in the correct version (source-fix not holding yet)"
fi
cp "$IMG_SRC" "$NEW/$LOCAL_IMG"

# ---- Sync into the repo's dist (preserve .vercel + .gitignore, skip .DS_Store) ----
echo "==> Syncing into repo dist/"
rsync -a --exclude='.DS_Store' "$NEW/" "$REPO/dist/"

# ---- Verify ----
echo "==> Verifying"
fail=0
drive_left=$( { grep -ro "drive.google.com/file/d/1y3C0lbZy9J" "$REPO/dist" || true; } | wc -l | tr -d ' ')
[ "$drive_left" = "0" ] && echo "    ✅ 0 Google Drive links" || { echo "    ❌ $drive_left Drive links remain"; fail=1; }
ls "$REPO/dist/$LOCAL_RESUME" >/dev/null 2>&1 && echo "    ✅ résumé PDF present" || { echo "    ❌ résumé PDF missing"; fail=1; }
cmp -s "$IMG_SRC" "$REPO/dist/$LOCAL_IMG" && echo "    ✅ 3DM image correct" || { echo "    ❌ 3DM image wrong"; fail=1; }
ls "$REPO/dist/.vercel" >/dev/null 2>&1 && echo "    ✅ Vercel linkage preserved" || echo "    ⚠️  .vercel not found (check deploy linkage)"
pages=$(ls -1 "$REPO/dist"/*.html | wc -l | tr -d ' '); echo "    ℹ️  $pages HTML pages"
[ "$fail" = "0" ] || { echo "==> VERIFY FAILED — not deploying."; exit 1; }

# ---- Commit + push (only with --push) ----
cd "$REPO"
if [ "$PUSH" = "1" ]; then
  echo "==> Committing + pushing (LIVE deploy)"
  git add dist
  git commit -q -m "Deploy latest Claude Design export

Re-applied post-export fixes: résumé bundled to local PDF (Drive links removed), corrected 3DM options image (pre-AI-layer version).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  git push origin main
  echo "==> Deployed. Live in ~1–2 min at paulanarv.com"
else
  echo "==> Prepared and verified (NOT pushed)."
  echo "    Review, then run:  cd \"$REPO\" && git add dist && git commit -m \"...\" && git push origin main"
  echo "    Or re-run with --push to deploy automatically."
fi
