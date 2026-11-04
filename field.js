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
    var inView = false, kept = false, ready = false, renderer;
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
      renderer.setRunning((inView || kept) && !document.hidden && !motion.matches);
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

    return {
      element: field, ready: readyPromise, reveal: reveal, poke: poke, ripple: ripple,
      /* kept running while something else shows it (the contact's copy) */
      keep: function (on) { if (kept !== !!on) { kept = !!on; sync(); } },
      /* a touch from wherever the field is being shown */
      pokeAt: function (id, x, y) { if (ready && !motion.matches) renderer.poke(id, x, y); },
      rippleAt: function (x, y) { if (ready && !motion.matches) renderer.ripple(x, y); }
    };
  }

  var fields = [];
  var orbit = document.querySelector('.path-orbit');
  var of = orbit ? (JH.field = makeField(orbit, 'path-field')) : null;
  if (of) fields.push(of);
  var contact = document.querySelector('#contact');
  var ground = null, cf = null;
  if (contact) {
    ground = document.createElement('div');
    ground.className = 'contact-ground';
    ground.setAttribute('aria-hidden', 'true');
    contact.insertBefore(ground, contact.firstChild);
    /* Where the watch is a full screen of its own, the contact section has
       no field of its own: it shows the watch's, live (mirrorField). One
       field, so where the leather rises out of the watch the letters on
       either side of the join are the same letters. A phone's watch is a
       small still picture, so there the section keeps its own. */
    cf = JH.contactField = (of && orbit.classList.contains('is-live')) ? mirrorField(ground, of) : makeField(ground, 'path-field contact-field');
    fields.push(cf);
  }
  if (!fields.length) return;

  /* The contact's view of the watch's field: a plain canvas that takes the
     watch's picture every frame while the section is on screen, keeping the
     watch's field running even once the watch itself has gone by. Touches
     on it go to the watch's field, which is the one that answers them. */
  function mirrorField(host, source) {
    var field = document.createElement('div');
    field.className = 'path-field contact-field';
    field.setAttribute('aria-hidden', 'true');
    host.insertBefore(field, host.firstChild);
    var canvas = document.createElement('canvas');
    canvas.className = 'absolute block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    field.appendChild(canvas);
    var cx = canvas.getContext('2d');
    var built = !doc.classList.contains('bi-on');
    function reveal(x, y) {
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y == null ? x : y));
      built = x === 1 && y === 1;
      field.style.clipPath = built ? 'none' : 'inset(0 ' + ((1 - x) * 100) + '% ' + ((1 - y) * 100) + '% 0)';
    }
    reveal(built ? 1 : 0);
    document.addEventListener('introdone', function () { reveal(1); });
    var on = false, raf = 0;
    function copy() {
      raf = 0;
      if (!on) return;
      var from = source.element.querySelector('canvas');
      if (from && from.width && from.height) {
        if (canvas.width !== from.width || canvas.height !== from.height) {
          canvas.width = from.width; canvas.height = from.height;
        }
        cx.clearRect(0, 0, canvas.width, canvas.height);
        cx.drawImage(from, 0, 0);
        canvas.style.opacity = from.style.opacity;
      }
      raf = requestAnimationFrame(copy);
    }
    function inside(x, y) {
      var r = host.getBoundingClientRect();
      return on && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }
    /* switched on and off by the scroll (holdFields), as the section
       comes on and goes off the screen */
    function show(v) {
      if (on === v) return;
      on = v;
      source.keep(on);
      if (on && !raf) raf = requestAnimationFrame(copy);
    }
    return {
      show: show,
      element: field, ready: source.ready, reveal: reveal,
      poke: function (id, x, y) { if (inside(x, y)) source.pokeAt(id, x, y); },
      ripple: function (x, y) { if (inside(x, y)) source.rippleAt(x, y); }
    };
  }

  /* Through the handover both are held still on the screen, the same size
     in the same place: the watch's once its scene has scrolled above the
     top of the screen (the contact panel covers the rest of it), and the
     contact's within the section's own box (the ground), which crops it.
     Held, the contact's copy lies exactly over the field it copies, so the
     join is not there to see. */
  function holdFields() {
    var vh = window.innerHeight;
    if (of && orbit.classList.contains('is-live')) {
      var orr = orbit.getBoundingClientRect(), ot = orr.top;
      of.element.style.transform = ot < 0 && orr.bottom > 0 ? 'translate3d(0,' + (-ot).toFixed(1) + 'px,0)' : '';
    }
    if (cf) {
      var r = contact.getBoundingClientRect();
      var seen = r.top < vh && r.bottom > 0;
      if (cf.show) cf.show(seen);
      if (seen) {
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
