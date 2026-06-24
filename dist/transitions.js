/* Paula Narvaez — page transition engine
   - Home first-visit: full brand intro (flower opens, winks, name reveals, wipe up)
   - All other loads / revisits: quick flower veil
   - Link clicks: cover-wipe then navigate (seamless)
   - Honors prefers-reduced-motion
*/
(function () {
  if (window.__pnTransitionRan) return;
  window.__pnTransitionRan = true;

  var D = document;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  // mobile: stack the flower above the name in the intro (side-by-side overflows narrow screens)
  var isNarrow = false;
  try { isNarrow = window.matchMedia('(max-width: 600px)').matches; } catch (e) {}
  var isHome = !!window.__PN_HOME;
  // big intro on direct landing / reload of home; quick wipe when arriving via an internal link
  var internalNav = false;
  try { internalNav = sessionStorage.getItem('pn-internal') === '1'; sessionStorage.removeItem('pn-internal'); } catch (e) {}
  var bigIntro = isHome && !internalNav && !reduce;
  var VEIL = '#17120d';
  var HOME_BG = '#e2ddd2';
  // each page's backdrop color, so dissolves bridge through the right tone
  function bgFor(path) {
    var p = '';
    try { p = decodeURIComponent(path || ''); } catch (e) { p = path || ''; }
    if (/Home\s*\(Index\)/i.test(p)) return '#17120d';
    if (/Three-Dot|Blueprint|Dolby|Nest/i.test(p)) return '#161310';
    return '#e2ddd2';
  }

  // ---- veil-only CSS (content reveal is driven by inline styles, never CSS hide) ----
  var style = D.createElement('style');
  style.textContent =
    '#pn-veil{position:fixed;inset:0;z-index:2147483600;background:' + VEIL + ';display:flex;align-items:center;justify-content:center;will-change:transform}' +
    '#pn-veil .pn-wrap{display:flex;align-items:center;overflow:visible}' +
    '#pn-veil .pn-flower{flex:none;position:relative;transform-origin:50% 50%;will-change:transform,opacity}' +
    '#pn-veil .pn-flower svg{width:100%;height:100%;display:block}' +
    '#pn-veil .pnEyeWink{opacity:0;transition:opacity .12s ease}' +
    '#pn-veil .pnEyeOpen{opacity:1;transition:opacity .12s ease}' +
    '#pn-veil .pn-name{font-family:"Hanken Grotesk",sans-serif;font-weight:700;color:#f3ece0;white-space:nowrap;overflow:hidden;max-width:0;opacity:0;letter-spacing:-.01em}';
  (D.head || D.documentElement).appendChild(style);

  // Reveal content with inline styles (reliably beats the DC stylesheet). Nothing is
  // ever left hidden: the veil covers content during load, and we only animate it IN.
  function animateIn(el, delay) {
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    void el.offsetWidth; // force reflow so the 'from' state is committed
    requestAnimationFrame(function () {
      el.style.transition = 'opacity .6s ease ' + (delay || 0) + 'ms, transform .6s cubic-bezier(.2,.75,.2,1) ' + (delay || 0) + 'ms';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    // clear inline overrides afterwards so hover/layout/template control resumes
    setTimeout(function () {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }, 720 + (delay || 0));
  }
  var revealed = false;
  // wait until the DC has actually rendered page content before revealing (prevents flash)
  function whenReady(cb) {
    var t0 = Date.now();
    (function check() {
      if (D.querySelector('.theme-root') || Date.now() - t0 > 1800) cb();
      else requestAnimationFrame(check);
    })();
  }
  function revealContent() {
    if (revealed) return;
    revealed = true;
    // Home: cascade the work-index rows. Sub-pages: the veil wipe reveals the
    // already-rendered (opaque) page cleanly — no content fade, no flash.
    if (isHome) {
      var rows = D.querySelectorAll('.idx-grid .brow');
      for (var i = 0; i < rows.length; i++) animateIn(rows[i], i * 70);
    }
  }

  // Graceful image fade-in: each image eases in as it decodes instead of popping.
  function polishImage(img) {
    if (img.getAttribute('data-pn-img')) return;
    img.setAttribute('data-pn-img', '1');
    img.decoding = 'async';
    if (img.complete && img.naturalWidth > 0) return; // already loaded
    img.style.opacity = '0';
    img.style.transition = 'opacity .5s ease';
    var done = function () { img.style.opacity = '1'; };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    if (img.complete && img.naturalWidth > 0) done(); // race guard
  }
  function polishImages() {
    var imgs = D.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) polishImage(imgs[i]);
    try {
      new MutationObserver(function (muts) {
        for (var m = 0; m < muts.length; m++) {
          var nodes = muts[m].addedNodes;
          for (var n = 0; n < nodes.length; n++) {
            var el = nodes[n];
            if (el.tagName === 'IMG') polishImage(el);
            else if (el.querySelectorAll) {
              var inner = el.querySelectorAll('img');
              for (var k = 0; k < inner.length; k++) polishImage(inner[k]);
            }
          }
        }
      }).observe(D.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  // ---- flower mark: single inline SVG, right eye toggles open <-> wink ----
  function flowerSVG() {
    var petals = [
      'M300.432 189.031C347.126 189.031 384.98 150.236 384.98 102.379C384.98 54.5228 347.126 15.7274 300.432 15.7274C253.737 15.7274 215.883 54.5228 215.883 102.379C215.883 150.236 253.737 189.031 300.432 189.031Z',
      'M300.432 584.273C347.126 584.273 384.98 545.477 384.98 497.621C384.98 449.764 347.126 410.969 300.432 410.969C253.737 410.969 215.883 449.764 215.883 497.621C215.883 545.477 253.737 584.273 300.432 584.273Z',
      'M499.724 386.21C546.419 386.21 584.273 347.415 584.273 299.558C584.273 251.701 546.419 212.906 499.724 212.906C453.03 212.906 415.176 251.701 415.176 299.558C415.176 347.415 453.03 386.21 499.724 386.21Z',
      'M100.276 386.21C146.97 386.21 184.824 347.415 184.824 299.558C184.824 251.701 146.97 212.906 100.276 212.906C53.5809 212.906 15.7274 251.701 15.7274 299.558C15.7274 347.415 53.5809 386.21 100.276 386.21Z',
      'M162.393 243.852C209.087 243.852 246.941 205.057 246.941 157.2C246.941 109.344 209.087 70.5484 162.393 70.5484C115.698 70.5484 77.8446 109.344 77.8446 157.2C77.8446 205.057 115.698 243.852 162.393 243.852Z',
      'M438.47 243.852C485.164 243.852 523.018 205.057 523.018 157.2C523.018 109.344 485.164 70.5484 438.47 70.5484C391.775 70.5484 353.922 109.344 353.922 157.2C353.922 205.057 391.775 243.852 438.47 243.852Z',
      'M445.372 525.031C492.067 525.031 529.92 486.235 529.92 438.379C529.92 390.522 492.067 351.727 445.372 351.727C398.677 351.727 360.824 390.522 360.824 438.379C360.824 486.235 398.677 525.031 445.372 525.031Z',
      'M161.53 525.031C208.225 525.031 246.078 486.235 246.078 438.379C246.078 390.522 208.225 351.727 161.53 351.727C114.836 351.727 76.9821 390.522 76.9821 438.379C76.9821 486.235 114.836 525.031 161.53 525.031Z'
    ];
    var p = '';
    for (var i = 0; i < petals.length; i++) p += '<path opacity="0.82" d="' + petals[i] + '" fill="#CA9E91"/>';
    return '<svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><radialGradient id="pnCream" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(300 300) rotate(-90) scale(156.063 152.274)">' +
      '<stop stop-color="white"/><stop offset="1" stop-color="#F2E8DC"/></radialGradient></defs>' +
      p +
      '<path d="M300 152.779C220.667 152.779 156.354 218.692 156.354 300C156.354 381.308 220.667 447.221 300 447.221C379.334 447.221 443.647 381.308 443.647 300C443.647 218.692 379.334 152.779 300 152.779Z" fill="url(#pnCream)" stroke="#BC7732" stroke-width="17.2548"/>' +
      // mouth
      '<path d="M338.392 303.979C338.392 309.204 337.388 314.378 335.436 319.206C333.486 324.033 330.626 328.42 327.021 332.114C323.416 335.809 319.136 338.74 314.426 340.74C309.715 342.739 304.667 343.768 299.569 343.768C294.471 343.768 289.422 342.739 284.712 340.74C280.001 338.74 275.722 335.809 272.116 332.114C268.512 328.42 265.652 324.033 263.701 319.206C261.75 314.378 260.745 309.204 260.745 303.979H269.67C269.67 308.003 270.443 311.988 271.946 315.705C273.448 319.423 275.651 322.801 278.427 325.647C281.203 328.492 284.499 330.75 288.127 332.289C291.755 333.829 295.642 334.622 299.569 334.622C303.495 334.622 307.383 333.829 311.011 332.289C314.638 330.75 317.934 328.492 320.71 325.647C323.487 322.802 325.689 319.423 327.192 315.705C328.694 311.988 329.467 308.003 329.467 303.979H338.392Z" fill="#773739"/>' +
      // left eye
      '<path d="M236.588 304.864C245.165 304.864 252.118 297.738 252.118 288.948C252.118 280.158 245.165 273.032 236.588 273.032C228.012 273.032 221.059 280.158 221.059 288.948C221.059 297.738 228.012 304.864 236.588 304.864Z" fill="#773739"/>' +
      // right eye - open (dot)
      '<path class="pnEyeOpen" d="M362.588 304.864C371.165 304.864 378.118 297.738 378.118 288.948C378.118 280.158 371.165 273.032 362.588 273.032C354.012 273.032 347.059 280.158 347.059 288.948C347.059 297.738 354.012 304.864 362.588 304.864Z" fill="#773739"/>' +
      // right eye - wink
      '<path class="pnEyeWink" d="M374.196 273.032L347.019 288.948L374.196 300" stroke="#773739" stroke-width="8.62741" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }
  function wink(root) {
    var o = root.querySelector('.pnEyeOpen'), w = root.querySelector('.pnEyeWink');
    if (o) o.style.opacity = '0';
    if (w) w.style.opacity = '1';
  }

  function makeVeil(size, withName, fromBelow) {
    var v = D.createElement('div');
    v.id = 'pn-veil';
    if (fromBelow) v.style.transform = 'translateY(100%)';
    var wrap = D.createElement('div');
    wrap.className = 'pn-wrap';
    if (isNarrow) wrap.style.flexDirection = 'column';
    var f = D.createElement('div');
    f.className = 'pn-flower';
    f.style.width = size + 'px';
    f.style.height = size + 'px';
    f.style.opacity = '0';
    f.style.transform = 'scale(0.62)';
    f.innerHTML = flowerSVG();
    wrap.appendChild(f);
    var nm = null;
    if (withName) {
      nm = D.createElement('div');
      nm.className = 'pn-name';
      nm.style.fontSize = Math.round(size * 0.52) + 'px';
      nm.textContent = 'Paula Narvaez';
      wrap.appendChild(nm);
    }
    v.appendChild(wrap);
    return { v: v, f: f, nm: nm, wrap: wrap };
  }

  // plain solid-color veil (no flower) for simple page wipes
  function makePlainVeil(fromBelow) {
    var v = D.createElement('div');
    v.id = 'pn-veil';
    if (fromBelow) v.style.transform = 'translateY(100%)';
    return v;
  }

  function lift(v, cb) {
    v.style.transition = 'transform .72s cubic-bezier(.76,0,.24,1)';
    requestAnimationFrame(function () { v.style.transform = 'translateY(-100%)'; });
    setTimeout(function () { if (v && v.parentNode) v.parentNode.removeChild(v); if (cb) cb(); }, 740);
  }

  // ---------- ENTRANCE ----------
  function runEntrance() {
    var root = D.documentElement;
    if (reduce) { root.classList.add('pn-none'); return; }
    // failsafe — never leave the cover stuck
    setTimeout(function () { revealContent(); root.classList.add('pn-go', 'pn-none'); }, bigIntro ? 5200 : 2600);
    if (bigIntro) playBig(); else playQuick();
  }

  function playBig() {
    var size = 196;
    var o = makeVeil(size, true, false);
    D.body.appendChild(o.v);
    D.documentElement.classList.add('pn-none'); // JS veil now covers; drop the CSS cover
    var v = o.v, f = o.f, nm = o.nm;
    nm.style.fontSize = Math.round(isNarrow ? Math.min(size * 0.32, window.innerWidth * 0.078) : Math.min(size * 0.46, window.innerWidth * 0.12)) + 'px';
    requestAnimationFrame(function () { // flower opens in
      f.style.transition = 'transform .7s cubic-bezier(.34,1.56,.64,1),opacity .55s ease';
      f.style.opacity = '1';
      f.style.transform = 'scale(1)';
    });
    setTimeout(function () { // wink + pop
      f.style.transition = 'transform .18s ease';
      f.style.transform = 'scale(1.08)';
      wink(v);
    }, 1000);
    setTimeout(function () { f.style.transform = 'scale(1)'; }, 1200);
    setTimeout(function () { // name clips in beside the flower (or below it, on mobile)
      nm.style.transition = 'max-width .7s cubic-bezier(.5,0,.2,1),opacity .5s ease,margin-left .7s cubic-bezier(.5,0,.2,1),margin-top .7s cubic-bezier(.5,0,.2,1)';
      nm.style.opacity = '1';
      if (isNarrow) { nm.style.marginTop = '22px'; } else { nm.style.marginLeft = '30px'; }
      nm.style.maxWidth = nm.scrollWidth + 'px';
    }, 1300);
    setTimeout(function () { // fade the mark away
      o.wrap.style.transition = 'opacity .5s ease,transform .6s ease';
      o.wrap.style.opacity = '0';
      o.wrap.style.transform = 'scale(0.96)';
    }, 2950);
    setTimeout(function () { // dark background morphs into the homepage color
      v.style.transition = 'background-color .7s ease';
      v.style.backgroundColor = HOME_BG;
    }, 3100);
    setTimeout(function () { // reveal page; veil (now page color) fades out seamlessly
      revealContent();
      v.style.transition = 'opacity .5s ease';
      v.style.opacity = '0';
      setTimeout(function () { if (v && v.parentNode) v.parentNode.removeChild(v); }, 520);
    }, 3800);
  }

  function playQuick() {
    // The CSS cover (html::before) is already covering from first paint — no flash.
    // Once content is rendered, slide the cover up to reveal it.
    whenReady(function () {
      revealContent();
      // sub-pages: gently rise the content into place as the veil lifts
      if (!isHome) {
        var card = D.querySelector('.theme-root > div');
        if (card) {
          card.style.transition = 'none';
          card.style.transform = 'translateY(18px)';
          void card.offsetWidth;
          requestAnimationFrame(function () {
            card.style.transition = 'transform .72s cubic-bezier(.22,1,.36,1)';
            card.style.transform = 'none';
          });
          setTimeout(function () { card.style.transition = ''; card.style.transform = ''; }, 780);
        }
      }
      D.documentElement.classList.add('pn-go');
      setTimeout(function () { D.documentElement.classList.add('pn-none'); }, 880);
    });
  }

  // ---------- EXIT (link clicks) ----------
  function coverThenGo(href) {
    try { sessionStorage.setItem('pn-internal', '1'); } catch (e) {}
    var dest = '#17120d';
    try { dest = bgFor(new URL(href, window.location.href).pathname); } catch (e) {}
    var v = D.createElement('div');
    v.id = 'pn-veil';
    v.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:' + dest + ';opacity:0;transition:opacity .44s cubic-bezier(.4,0,.2,1)';
    D.body.appendChild(v);
    requestAnimationFrame(function () { v.style.opacity = '1'; });
    setTimeout(function () { window.location.href = href; }, 460);
  }

  D.addEventListener('click', function (e) {
    if (reduce) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (/^(https?:|mailto:|tel:)/i.test(href)) return; // external
    var url;
    try { url = new URL(href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname) return; // same page
    e.preventDefault();
    coverThenGo(href);
  }, true);

  polishImages();
  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', runEntrance);
  } else {
    runEntrance();
  }
})();
