/* ==========================================================================
   Jeffrey Hamilton — portfolio motion

   Everything in here is an enhancement. The page is readable and complete
   with this file blocked: reveals only hide themselves once `motion` is on
   the document, the spiral only replaces the plain card grid once it has
   measured a screen wide enough to hold it, and each block below bails on
   its own if the thing it needs is missing.

   Load order matters — gsap, ScrollTrigger and lenis are all vendored in
   assets/vendor and loaded ahead of this file.
   ========================================================================== */

(function () {
  'use strict';

  var doc     = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* Only now do the reveal rules start hiding anything. Setting this before
     we know the libraries arrived would leave the page blank if a script
     404'd. */
  if (!reduced) doc.classList.add('motion');

  /* ---------------------------------------------------------- Smooth scroll

     Lenis owns the scroll position; ScrollTrigger has to be told about each
     of its frames, and GSAP's ticker has to be the thing that drives it, or
     the two run on separate rAF loops and pinned sections judder by a frame. */

  var lenis = null;

  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });

    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(t) { lenis.raf(t); requestAnimationFrame(raf); });
    }
  }

  /* In-page links have to go through Lenis too, otherwise the browser jumps
     the scroll position out from under it and the next wheel event snaps
     back to wherever Lenis still thinks it is. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) return;
    var id = link.getAttribute('href');
    if (id.length < 2) return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -60, duration: 1.2 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });

  /* ---------------------------------------------------------- Reveals

     One observer for every [data-reveal] and every masked .line. Elements
     inside a [data-stagger] get an increasing delay so a group arrives as a
     sequence rather than all at once. */

  (function () {
    if (reduced || !('IntersectionObserver' in window)) return;

    document.querySelectorAll('[data-stagger]').forEach(function (group) {
      var step = parseFloat(group.dataset.stagger) || 0.08;
      var kids = group.querySelectorAll('[data-reveal], .line');
      kids.forEach(function (el, i) { el.style.setProperty('--d', (i * step) + 's'); });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);          /* reveals are one-way */
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    document.querySelectorAll('[data-reveal], .line').forEach(function (el) {
      io.observe(el);
    });
  })();

  /* ---------------------------------------------------------- Panel handoff

     Each section after the hero is an opaque slab with a rounded top edge
     that rides up over the one before it. This is the other half: as a
     panel's bottom comes up the screen its contents settle back and dim, so
     the next panel reads as arriving over something rather than following
     it. The transform is on .slab-inner and never on the section, so the
     panel's own background — and the seam between the two — stays exactly
     where it is while the content behind recedes. */

  (function () {
    if (reduced || !hasGsap) return;

    document.querySelectorAll('.slab-inner').forEach(function (inner) {
      gsap.fromTo(inner,
        { scale: 1, opacity: 1 },
        {
          scale: 0.955,
          opacity: 0.5,
          ease: 'none',
          scrollTrigger: {
            trigger: inner.parentElement,
            /* Held off until the panel's bottom is well up the screen. Start
               it any earlier and the last few lines of a section dim while
               they are still the thing being read. */
            start: 'bottom 78%',
            end: 'bottom 16%',
            scrub: 0.5,
            invalidateOnRefresh: true
          }
        });
    });
  })();

  /* ---------------------------------------------------------- Header

     Two jobs: flip to the light-on-dark form while a dark band sits under
     the header, and mark which section you are actually in. */

  (function () {
    if (!('IntersectionObserver' in window)) return;

    /* Track which sections are on the line rather than counting entries.
       The observer's first callback reports every section it watches, most
       of them not intersecting, and a running tally starts that far in the
       hole and never climbs back to one. The bottom margin collapses the
       box down to a line 4rem from the top of the viewport, so a section
       counts as "under the header" exactly when it crosses that line. */
    var live = [];
    var tint = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var at = live.indexOf(entry.target);
        if (entry.isIntersecting) { if (at < 0) live.push(entry.target); }
        else if (at >= 0) live.splice(at, 1);
      });
      document.body.classList.toggle('head-dark', live.length > 0);
    }, { rootMargin: '-64px 0px -100% 0px' });

    document.querySelectorAll('.on-dark').forEach(function (el) { tint.observe(el); });

    /* Current section. Same collapsed box, one section deep at a time. */
    var links = {};
    document.querySelectorAll('.nav a[href^="#"]').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });

    var here = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        for (var key in links) links[key].classList.toggle('is-here', key === id);
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) here.observe(el);
    });
  })();

  /* ---------------------------------------------------------- Parallax

     The shot inside each featured project is 118% of its frame, so there is
     18% of slack to move through as the project crosses the viewport. */

  (function () {
    if (reduced || !hasGsap) return;

    document.querySelectorAll('.project-shot').forEach(function (frame) {
      var img = frame.querySelector('img');
      if (!img) return;

      gsap.fromTo(img,
        { '--par': '0px' },
        {
          '--par': function () { return -(frame.offsetHeight * 0.15) + 'px'; },
          ease: 'none',
          scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true }
        });
    });
  })();

  /* ==========================================================================
     The hoop

     The spiral from the reference, turned onto its side and opened out into a
     frame. Every card rides one ellipse — a hoop — and the hoop is tilted
     back around its own horizontal axis, so its top edge leans away from you
     and its bottom edge swings toward you. Because each card sits out on the
     rim, the middle of the hoop is always clear: that hole is where the name
     sits, dead straight and level, framed by the cards turning around it.

         ang = (base + i/N)·2π          even spacing, the whole hoop spins
         x   = cos(ang)·RX              left … right
         y   = sin(ang)·RY·cos(tilt)    the lean foreshortens the vertical
         z   = sin(ang)·RY·sin(tilt)    and turns the rest into depth

     Nothing crosses the centre, so unlike the earlier through-the-name
     version the name never has to fight a card for the middle. The cards
     still sort by depth in the one 3D context, which is why nothing in the
     subtree sets z-index (it would flatten the context); the frame reads as
     near cards at the bottom passing in front, far cards at the top behind.

     Three things spin it, and they simply add:

       auto    a constant drift, so it turns on its own
       scroll  a scrubbed offset while the hero is pinned
       drag    the pointer, with a fling that decays after release
     ========================================================================== */

  /* ---------------------------------------------------------- Hero intro

     A staged open, then a running typewriter:

       1. the name fades up on its own, like a title card
       2. a beat later the "I build ___" line rises into place
       3. the word types itself out, holds, deletes, and types the next —
          around the list forever, with a blinking caret

     The markup already reads correctly (name + first word visible) so with
     the script off or reduced motion on, step 1's end-state is just the
     resting page and nothing below animates. */

  (function () {
    var center = document.querySelector('[data-intro]');
    if (!center) return;

    var skills = center.querySelector('.skills-type');
    var out    = center.querySelector('.type-out');
    var list;
    try { list = JSON.parse(skills && skills.getAttribute('data-skills') || '[]'); }
    catch (e) { list = []; }

    if (reduced || !list.length) { center.classList.add('intro-done'); return; }

    /* Hold everything back, then release in order. The classes drive the
       fade/slide in the CSS; the typewriter waits for the line to arrive. */
    out.textContent = '';
    center.classList.add('intro-armed');

    var startDelay = 620;    /* let the name land first          */
    var lineDelay  = 1180;   /* then the "I build" line rises     */

    requestAnimationFrame(function () {
      setTimeout(function () { center.classList.add('intro-name'); }, startDelay);
      setTimeout(function () {
        center.classList.add('intro-line');
        setTimeout(type, 560);           /* start once the line has risen */
      }, lineDelay);
    });

    var TYPE = 55, ERASE = 32, HOLD = 1500, GAP = 420;
    var wi = 0;

    function type() {
      var word = list[wi], n = 0;
      (function tick() {
        out.textContent = word.slice(0, ++n);
        if (n < word.length) setTimeout(tick, TYPE + Math.random() * 45);
        else setTimeout(erase, HOLD);
      })();
    }

    function erase() {
      var word = out.textContent, n = word.length;
      (function tick() {
        out.textContent = word.slice(0, --n);
        if (n > 0) setTimeout(tick, ERASE);
        else { wi = (wi + 1) % list.length; setTimeout(type, GAP); }
      })();
    }
  })();

  var heroSpiral = (function () {
    var hero = document.querySelector('.hero');
    if (!hero) return null;

    var stage = hero.querySelector('.hero-stage');
    var inner = hero.querySelector('.hero-inner');
    var veil  = hero.querySelector('.hero-veil');
    var list  = hero.querySelector('.spiral-fallback');
    if (!stage || !inner || !list) return null;

    var cards = [].slice.call(list.children);
    var N = cards.length;
    if (N < 4) return null;

    /* Below this there is no room for the sideways travel, and the cards at
       the back would be too small to make sense of. */
    var MIN_WIDTH = 900;

    var TILT   = 40;    /* deg the whole hoop leans back toward the viewer     */
    var FACE   = 14;    /* deg each card turns to face the middle              */
    var BACK   = 0.32;  /* how visible a card is at the far top of the hoop    */
    var TURN   = 46;    /* seconds for one unattended revolution               */
    var SCROLL = 0.30;  /* revolutions added by scrolling the hero away        */
    var GAIN   = 1.1;   /* how much of a drag carries into the spin            */
    var DECAY  = 0.04;  /* of the fling speed left after one second            */

    var RX = 0, RY = 0, RZ = 0;
    var SIN = Math.sin(TILT * Math.PI / 180);
    var COS = Math.cos(TILT * Math.PI / 180);

    var auto = 0, scrolled = 0, thrown = 0, vel = 0;
    var dragging = false, moved = 0, lastX = 0, lastT = 0;
    var ticking = false, active = false, pin = null;
    var lastBase = -1, lastFocus = -1;

    /* The cards ride a single ellipse — a hoop — tilted back around its own
       horizontal axis so the top edge leans away and the bottom swings
       toward you. Because every card sits out at the rim, the middle of the
       hoop is always empty: that hole is the frame the name lives in. The
       radii are set wide and tall enough that the rim clears the title on
       every side, with a card-based floor so it never collapses on a small
       window. */
    function measure() {
      var w = window.innerWidth;
      var h = stage.offsetHeight || window.innerHeight;
      var cw = cards[0].offsetWidth || 220;
      var ch = cw * 0.62;

      /* The hoop has to be bigger than the title it frames, on both axes. On
         screen the vertical rim sits at RY*cos(tilt); that plus a card's half
         height has to clear the name's half height, and RX plus a card's half
         width has to clear the name's half width — hence the generous
         fractions and the card-based floors. */
      RX = Math.max(w * 0.36, cw * 1.5);
      RY = Math.max(h * 0.40, ch * 2.2) / COS;
      RZ = RY * SIN;                  /* depth comes out of the lean, not a knob */
    }

    function wrap01(v) { v %= 1; return v < 0 ? v + 1 : v; }

    function render() {
      var base = wrap01(auto + scrolled + thrown);
      if (base === lastBase) return;              /* nothing moved this frame */
      lastBase = base;

      var focus = 0, best = -Infinity;

      for (var i = 0; i < N; i++) {
        /* Even spacing around the hoop; the whole thing rotates with base. */
        var ang = (base + i / N) * Math.PI * 2;
        var ex  = Math.cos(ang);      /* -1 left … +1 right */
        var ey  = Math.sin(ang);      /* -1 top  … +1 bottom (before the lean) */

        var x = ex * RX;
        var y = ey * RY * COS;        /* the lean foreshortens the vertical */
        var z = ey * RZ;              /* and turns it into depth: bottom near */

        var depth = (ey + 1) / 2;     /* 0 at the far top, 1 at the near bottom */

        var card = cards[i];
        var s = card.style;
        s.setProperty('--x',  x.toFixed(2) + 'px');
        s.setProperty('--y',  y.toFixed(2) + 'px');
        s.setProperty('--z',  z.toFixed(2) + 'px');
        s.setProperty('--ry', (-ex * FACE).toFixed(2) + 'deg');
        s.setProperty('--rz', (ex * 4).toFixed(2) + 'deg');
        s.opacity = (BACK + (1 - BACK) * depth).toFixed(3);

        card.classList.toggle('is-far', ey < -0.35);

        if (depth > best) { best = depth; focus = i; }
      }

      if (focus !== lastFocus) {
        if (lastFocus >= 0) cards[lastFocus].classList.remove('is-focus');
        cards[focus].classList.add('is-focus');
        lastFocus = focus;
      }
    }

    /* One ticker for the whole thing: advance the drift, bleed off whatever
       is left of the last fling, then place the cards. */
    function tick(time, deltaMs) {
      var dt = Math.min(deltaMs, 50) / 1000;

      if (!dragging) {
        auto += dt / TURN;
        if (Math.abs(vel) > 1e-6) {
          thrown += vel * dt;
          vel *= Math.pow(DECAY, dt);
        } else vel = 0;
      }
      render();
    }

    function run()  { if (!ticking) { ticking = true;  gsap.ticker.add(tick); } }
    function halt() { if (ticking)  { ticking = false; gsap.ticker.remove(tick); } }

    /* ---- drag ------------------------------------------------------------

       A drag across the width of the stage turns the hoop about one full
       revolution; GAIN trims that to taste. The fling carries the last
       velocity and decays. */

    function onDown(e) {
      if (e.button > 0) return;
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastT = e.timeStamp;
      vel = 0;
      stage.classList.add('is-dragging');
      if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
    }

    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dt = Math.max(e.timeStamp - lastT, 1) / 1000;
      lastX = e.clientX;
      lastT = e.timeStamp;
      moved += Math.abs(dx);

      var du = (dx * GAIN) / Math.max(window.innerWidth, 1);
      thrown += du;
      vel = du / dt;              /* carried into the fling on release */
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      if (stage.releasePointerCapture) stage.releasePointerCapture(e.pointerId);
      /* A stale velocity from a drag that stopped before the finger lifted
         would launch the spiral off a still pointer. */
      if (e.timeStamp - lastT > 120) vel = 0;
    }

    /* A drag that ends on a card must not also open it. */
    function onClick(e) { if (moved > 8) { e.preventDefault(); e.stopPropagation(); } }
    function prevent(e) { e.preventDefault(); }

    function bindDrag() {
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onUp);
      stage.addEventListener('click', onClick, true);
      stage.addEventListener('dragstart', prevent);
    }
    function unbindDrag() {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick, true);
      stage.removeEventListener('dragstart', prevent);
    }

    /* ---- wiring ---------------------------------------------------------- */

    function activate() {
      if (active) return;
      active = true;

      list.classList.remove('spiral-fallback');
      list.classList.add('spiral-track');
      inner.appendChild(list);
      hero.classList.add('is-spiral');

      measure();
      bindDrag();

      /* The hero holds still while the timeline climbs over it. pinSpacing
         is off on purpose: with no reserved space the next panel scrolls
         straight up over the fixed stage, which is the handoff. It lasts one
         screen, which is exactly how long the timeline takes to cover it. */
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: '+=100%',
          pin: stage,
          pinSpacing: false,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: function (self) { scrolled = self.progress * SCROLL; }
        }
      });
      tl.to(inner, { scale: 0.9, ease: 'none' }, 0);
      if (veil) tl.to(veil, { opacity: 0.92, ease: 'none' }, 0);
      pin = tl;

      /* No ticker and no decoding while the spiral is off screen. */
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
          (entries[0] && entries[0].isIntersecting) ? run() : halt();
        }, { threshold: 0 }).observe(stage);
      } else run();

      lastBase = -1;
      render();
    }

    function deactivate() {
      if (!active) return;
      active = false;

      halt();
      unbindDrag();
      if (pin) {
        if (pin.scrollTrigger) pin.scrollTrigger.kill(true);
        pin.kill();
        pin = null;
      }
      gsap.set([inner, veil].filter(Boolean), { clearProps: 'all' });

      hero.classList.remove('is-spiral');
      list.classList.remove('spiral-track');
      list.classList.add('spiral-fallback');
      hero.appendChild(list);

      cards.forEach(function (card) {
        ['--x', '--y', '--z', '--ry', '--rz'].forEach(function (p) { card.style.removeProperty(p); });
        card.style.opacity = '';
        card.classList.remove('is-focus', 'is-far');
      });
      scrolled = 0;
      lastBase = -1;
      lastFocus = -1;
    }

    function decide() {
      if (!reduced && hasGsap && window.innerWidth >= MIN_WIDTH) {
        active ? measure() : activate();
      } else deactivate();
    }

    decide();
    return { decide: decide, refresh: function () { if (active) { lastBase = -1; render(); } } };
  })();

  /* ---------------------------------------------------------- Era media

     Each era's media column drifts against the copy as the era crosses the
     viewport — the parallax that carries one scene into the next. And each
     video is a facade: the thumbnail stands in until it is clicked, then the
     real player is swapped in, so the page never loads six embeds up front.
     The <a> is the no-JS path; if the swap cannot run the click just opens
     YouTube. */

  (function () {
    if (!reduced && hasGsap) {
      document.querySelectorAll('[data-parallax]').forEach(function (el) {
        var d = parseFloat(el.getAttribute('data-parallax')) || 0;
        gsap.fromTo(el, { y: -d }, {
          y: d,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }

    document.querySelectorAll('.vid[data-yt]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('data-yt');
        if (!id || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();

        var frame = link.querySelector('.vid-frame');
        if (!frame || link.dataset.playing) return;
        link.dataset.playing = '1';

        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + id +
                     '?autoplay=1&rel=0&modestbranding=1';
        iframe.title = 'YouTube video player';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.loading = 'eager';
        frame.replaceChildren(iframe);
      });
    });
  })();

  /* ---------------------------------------------------------- Resize

     One debounced handler for everything that measures, so a drag on a
     window edge does not run independent rebuilds per frame. */

  (function () {
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (heroSpiral) { heroSpiral.decide(); heroSpiral.refresh(); }
        if (hasGsap) ScrollTrigger.refresh();
      }, 180);
    });
  })();

  /* ==========================================================================
     Cycling cards

     Three of the cards hold a set of frames rather than one screenshot. They
     cross-fade in a shuffled order, each frame held for its own length, and
     the whole thing stops while the section is off screen.

     Three things used to make the animations card look like it held two or
     three frames. A fixed 0–5 order lined up with the loop so every pass came
     back to the same pair; a slow uniform hold spent the card's whole time on
     screen on two of them; and frames that had not finished loading were
     faded to anyway, showing nothing. So: a fresh shuffle each time the
     section comes back, per-frame holds taken from the video's own duration,
     frames that are not decoded yet skipped rather than shown, and every
     ident restarted from zero so it never opens halfway through.
     ========================================================================== */

  /* Warm every card image once the page itself is done. They are lazy
     (images) or metadata-only (video) in the markup so first paint is not
     held up — but a lazy loader never judges anything inside the spiral as
     near enough to fetch. The stage is an overflow:hidden box full of
     3D-transformed children, and the whole hero would sit there as a set of
     blank rectangles waiting for a viewport intersection that never comes.

     One at a time, in document order, so seventeen screenshots do not fight
     each other for the connection. The featured shots further down are left
     alone; those are in normal flow and lazy loading works on them. */
  window.addEventListener('load', function () {
    var pending = [].slice.call(document.querySelectorAll('.card-shot img, .card-shot video'));

    (function next() {
      var el = pending.shift();
      if (!el) return;

      if (el.tagName === 'VIDEO') {
        if (el.readyState >= 3) return next();
        el.addEventListener('canplaythrough', next, { once: true });
        el.addEventListener('error', next, { once: true });
        el.preload = 'auto';
        if (el.readyState === 0) el.load();     /* only kick one that has not started */
      } else {
        if (el.complete) return next();
        el.addEventListener('load', next, { once: true });
        el.addEventListener('error', next, { once: true });
        el.loading = 'eager';                   /* releases the fetch lazy held back */
      }
    })();
  });

  (function () {
    if (reduced) return;

    var HOLD  = matchMedia('(hover: none)').matches ? 4200 : 2800;  /* stills   */
    var FADE  = 600;                    /* matches the transition in styles.css */
    var TAIL  = 250;                    /* let an ident land before it is swapped */
    var RETRY = 400;                    /* nothing ready yet — look again soon    */

    var runners = [];

    document.querySelectorAll('.cycle').forEach(function (cycle) {
      var frames = [].slice.call(cycle.querySelectorAll('img, video'));
      if (frames.length < 2) return;

      var queue = [], showing = null, stack = 0, timer = null;

      function isVideo(el) { return el.tagName === 'VIDEO'; }

      function ready(el) {              /* decoded and actually paintable */
        return isVideo(el) ? el.readyState >= 2
                           : el.complete && el.naturalWidth > 0;
      }

      /* Readiness has to be sampled before the seek in play(). Seeking drops
         readyState below HAVE_CURRENT_DATA and the event that follows is
         'seeked', not 'loadeddata' — waiting on the latter here left the old
         frame stuck on top of the card while the rest played underneath. */
      function whenReady(el, fn) {
        if (ready(el)) return fn();
        var done = false;
        var once = function () { if (!done) { done = true; fn(); } };
        el.addEventListener(isVideo(el) ? 'loadeddata' : 'load', once, { once: true });
        if (isVideo(el)) el.addEventListener('canplay', once, { once: true });
        setTimeout(once, 1200);         /* never leave a frame stranded */
      }

      /* An ident is held for one full play. The file is the authority; the
         data-hold in the markup covers the gap before metadata lands. */
      function holdFor(el) {
        if (!el) return HOLD;
        if (isVideo(el) && el.duration) return el.duration * 1000 + TAIL;
        return +el.dataset.hold || HOLD;
      }

      function play(el) {
        if (!isVideo(el)) return;
        el.currentTime = 0;             /* never open halfway through an ident */
        var p = el.play();
        if (p && p.catch) p.catch(function () {});   /* autoplay refused; sits on frame 0 */
      }

      function refill() {
        queue = frames.slice();
        for (var i = queue.length - 1; i > 0; i--) {          /* Fisher-Yates */
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = queue[i]; queue[i] = queue[j]; queue[j] = tmp;
        }
        /* do not open a pass on the frame already up, or it reads as a stall */
        if (queue[0] === showing) queue.push(queue.shift());
      }

      function step() {
        if (!queue.length) refill();

        var next = null;
        while (queue.length) {
          var candidate = queue.shift();
          if (ready(candidate)) { next = candidate; break; }
        }
        if (!next || next === showing) return false;    /* hold, try again soon */

        var prev = showing;
        var settled = ready(next);        /* sample before play() seeks it */
        showing = next;

        play(showing);
        showing.style.zIndex = ++stack;
        showing.classList.add('is-on');

        /* keep the old frame underneath until the new one has faded over it */
        if (prev) {
          var drop = function () {
            setTimeout(function () {
              prev.classList.remove('is-on');
              if (isVideo(prev)) prev.pause();
            }, FADE);
          };
          if (settled) drop(); else whenReady(showing, drop);
        }
        return true;
      }

      function schedule(delay) {
        timer = setTimeout(function () {
          schedule(step() ? holdFor(showing) : RETRY);
        }, delay);
      }

      cycle.dataset.cycling = 'true';

      /* Put something up before it is ever looked at. Nothing has decoded at
         this point, so step() has nothing to choose and would leave an empty
         box; show frame one regardless and let the normal handoff replace it. */
      if (!step()) {
        showing = frames[0];
        showing.classList.add('is-on');
      }

      runners.push({
        run: function () {
          if (timer) return;
          refill();                 /* a different frame every time it comes back */
          schedule(step() ? holdFor(showing) : RETRY);
        },
        halt: function () {
          clearTimeout(timer);
          timer = null;
          if (showing && isVideo(showing)) showing.pause();
        }
      });
    });

    if (!runners.length) return;

    /* Gate on the section rather than the cards. Inside the spiral the cards
       are on a 3D-transformed stage, where per-element intersection is not
       something to rely on. */
    var host = document.querySelector('.hero') || document.body;

    if (!window.IntersectionObserver) {
      runners.forEach(function (r) { r.run(); });
      return;
    }

    new IntersectionObserver(function (entries) {
      var on = entries[0] && entries[0].isIntersecting;
      runners.forEach(function (r) { on ? r.run() : r.halt(); });
    }, { threshold: 0 }).observe(host);
  })();

  /* Everything measures at load; late fonts and the portrait shift things
     under it. Rebuild once each has landed. */
  function settle() {
    if (heroSpiral) heroSpiral.refresh();
    if (hasGsap) ScrollTrigger.refresh();
  }
  window.addEventListener('load', settle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
})();
