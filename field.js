/* The watch's background uses Henry Fan's Glyph Wind renderer (MIT).
   The intro draws its bounds; ordinary visits start with the finished field.
   Keep this layer independent of the watch's SVG and the scroll geometry.

   The same field carries on behind the contact section, so the leather
   rising out of the watch rises through one continuous ground: the second
   field is the same renderer with the same settings, laid behind the band. */
(function () {
  'use strict';
  if (typeof GlyphWind === 'undefined') return;
  var doc = document.documentElement;
  var JH = window.JH = window.JH || {};
  var mq = matchMedia('(prefers-reduced-motion: reduce)');
  var forced = doc.classList.contains('force-motion');
  /* reduced motion, unless the intro was asked for by name (?intro) */
  var motion = {
    get matches() { return mq.matches && !forced; },
    addEventListener: function (t, f) { mq.addEventListener(t, f); }
  };

  function config() {
    var c = GlyphWind.defaults();
    c.seed = 6399;
    c.look = 'mixed';
    c.glow.color.light = [233 / 255, 179 / 255, 63 / 255];
    c.touch.ripple = 0.18;
    c.grid.maxDevicePixels = 4000000;
    c.power.rippleFrameMs = 25;
    return c;
  }

  function makeField(host, cls) {
    var field = document.createElement('div');
    field.className = cls;
    field.setAttribute('aria-hidden', 'true');
    host.insertBefore(field, host.firstChild);

    var settings = config();
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

    renderer = GlyphWind.create({
      element: field,
      settings: function () { return settings; },
      timing: function () { return { fadeIn: motion.matches ? 0 : 350, fadeOut: 200 }; },
      pointerEvents: false,
      onReady: function () { ready = true; sync(); resolveReady(); },
      // The background is decorative: keep the watch and intro usable without WebGL2.
      onError: function () { field.dataset.unavailable = 'true'; resolveReady(); }
    });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }).observe(host);
    } else { inView = true; }
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('introdone', function () { reveal(1); sync(); });

    return { element: field, ready: readyPromise, reveal: reveal, poke: poke, ripple: ripple };
  }

  var fields = [];
  var orbit = document.querySelector('.path-orbit');
  if (orbit) fields.push(JH.field = makeField(orbit, 'path-field'));
  var contact = document.querySelector('#contact');
  var cf = null;
  if (contact) {
    var ground = document.createElement('div');
    ground.className = 'contact-ground';
    ground.setAttribute('aria-hidden', 'true');
    contact.insertBefore(ground, contact.firstChild);
    fields.push(cf = JH.contactField = makeField(ground, 'path-field contact-field'));
  }
  if (!fields.length) return;

  /* The seam. Where the contact section rises over the watch, both fields
     are held still on the screen, the same size in the same place, so the
     rows and columns of one carry straight on into the other. Left to the
     page, the watch's field (pinned) and the contact's (scrolling) slid
     past each other, and once the pin let go the watch's moved off too.
     The watch's is held only once its scene has scrolled above the top of
     the screen (the contact panel covers the rest of it); the contact's is
     cropped by the section's own box (the ground). */
  var of = JH.field;
  function holdFields() {
    var vh = window.innerHeight;
    if (of && orbit.classList.contains('is-live')) {
      var orr = orbit.getBoundingClientRect(), ot = orr.top;
      of.element.style.transform = ot < 0 && orr.bottom > 0 ? 'translate3d(0,' + (-ot).toFixed(1) + 'px,0)' : '';
    }
    if (cf) {
      var r = contact.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        cf.element.style.height = vh + 'px';
        cf.element.style.transform = 'translate3d(0,' + Math.min(-r.top, r.height - vh).toFixed(1) + 'px,0)';
      }
    }
  }
  /* in step with the scroll, not a frame behind it: the smooth scroll's own
     event where there is one, and the page's as well */
  if (JH.lenis && JH.lenis.on) JH.lenis.on('scroll', holdFields);
  window.addEventListener('scroll', holdFields, { passive: true });
  window.addEventListener('resize', holdFields);
  if (window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', holdFields);
  holdFields();

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || doc.classList.contains('bi-on')) return;
    fields.forEach(function (f) { f.poke('pointer', e.clientX, e.clientY); });
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || doc.classList.contains('bi-on') || e.target.closest('a,button,input,select,textarea,summary,[contenteditable]')) return;
    fields.forEach(function (f) { f.ripple(e.clientX, e.clientY); });
  }, { passive: true });
})();
