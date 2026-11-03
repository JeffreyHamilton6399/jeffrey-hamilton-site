/* The watch's background uses Henry Fan's Glyph Wind renderer (MIT).
   The intro draws its bounds; ordinary visits start with the finished field.
   Keep this layer independent of the watch's SVG and the scroll geometry. */
(function () {
  'use strict';
  var orbit = document.querySelector('.path-orbit');
  if (!orbit || typeof GlyphWind === 'undefined') return;
  var doc = document.documentElement;
  var JH = window.JH = window.JH || {};
  var motion = matchMedia('(prefers-reduced-motion: reduce)');
  var field = document.createElement('div');
  field.className = 'path-field';
  field.setAttribute('aria-hidden', 'true');
  orbit.insertBefore(field, orbit.firstChild);

  var config = GlyphWind.defaults();
  config.seed = 6399;
  config.look = 'mixed';
  config.glow.color.light = [233 / 255, 179 / 255, 63 / 255];
  config.touch.ripple = 0.18;
  config.grid.maxDevicePixels = 4000000;
  config.power.rippleFrameMs = 25;
  var inView = false, ready = false, renderer;
  var built = !doc.classList.contains('bi-on');
  var resolveReady;
  var readyPromise = new Promise(function (resolve) { resolveReady = resolve; });

  function reveal(x, y) {
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y == null ? x : y));
    built = x === 1 && y === 1;
    field.style.clipPath = built ? 'none' : 'inset(0 ' + ((1 - x) * 100) + '% ' + ((1 - y) * 100) + '% 0)';
  }
  reveal(built ? 1 : 0);

  function sync() {
    if (!ready) return;
    renderer.setRunning(inView && !document.hidden && !motion.matches);
  }
  function contains(x, y) {
    if (!ready || !inView || motion.matches || document.hidden) return false;
    var r = field.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function poke(id, x, y) { if (contains(x, y)) renderer.poke(id, x, y); }
  function ripple(x, y) { if (contains(x, y)) renderer.ripple(x, y); }

  JH.field = { element: field, ready: readyPromise, reveal: reveal, poke: poke };
  renderer = GlyphWind.create({
    element: field,
    settings: function () { return config; },
    timing: function () { return { fadeIn: motion.matches ? 0 : 350, fadeOut: 200 }; },
    pointerEvents: false,
    onReady: function () { ready = true; sync(); resolveReady(); },
    // The background is decorative: keep the watch and intro usable without WebGL2.
    onError: function () { field.dataset.unavailable = 'true'; resolveReady(); }
  });

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse' && !doc.classList.contains('bi-on')) poke('pointer', e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || doc.classList.contains('bi-on') || e.target.closest('a,button,input,select,textarea,summary,[contenteditable]')) return;
    ripple(e.clientX, e.clientY);
  }, { passive: true });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      sync();
    }).observe(orbit);
  } else { inView = true; }
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('introdone', function () { reveal(1); sync(); });
})();
