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

     Each section is an opaque slab with a rounded top edge that rides up
     over the one before it. This is the other half: as a panel's bottom
     comes up the screen, its contents settle back and dim, so the next
     panel reads as arriving over something rather than following it. The
     transform is on .slab-inner and never on the section, so the panel's
     own background — and the seam between the two — stays exactly where it
     is while the content behind recedes. */

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

  /* ---------------------------------------------------------- Header tint

     Flip the header to its light-on-dark form while a dark band sits under
     it. The bottom margin collapses the observer's box down to a line 4rem
     from the top of the viewport, so a section counts as "under the header"
     exactly when it crosses that line. */

  (function () {
    if (!('IntersectionObserver' in window)) return;

    /* Track which sections are on the line rather than counting entries.
       The observer's first callback reports every section it watches, most
       of them not intersecting, and a running tally starts that far in the
       hole and never climbs back to one. */
    var live = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var at = live.indexOf(entry.target);
        if (entry.isIntersecting) { if (at < 0) live.push(entry.target); }
        else if (at >= 0) live.splice(at, 1);
      });
      document.body.classList.toggle('head-dark', live.length > 0);
    }, { rootMargin: '-64px 0px -100% 0px' });

    document.querySelectorAll('.on-dark').forEach(function (el) { io.observe(el); });
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
     The loop

     A horizontal corkscrew. Each card gets a position u in [0,1) along the
     path; u advances and wraps, so the row is endless.

         ang = u·2π + π
         x   = (u − ½)·2·SPAN        far left to far right
         y   = sin(ang)·RY           over the top, then under the bottom
         g   = ((cos(ang) + 1)/2)^BIAS
         z   = (2g − 1)·RZ           away at both ends, nearest in the middle

     At u = 0 and u = 1 the angle differs by exactly 2π, so y and z match and
     only x has jumped — and by then the card is a long way off screen, which
     is what makes the wrap invisible.

     A plain cos for the depth put the two cards flanking the front one at
     z = 0, which is full size: three cards of equal weight fighting over the
     middle of the screen. BIAS bends that curve so a card only comes forward
     near the very front of its pass, and SPAN is set wide enough that
     neighbours clear the front card entirely rather than stacking on it.
     About four of the fourteen are on screen at once.

     Card i sits at u = ½ + base − i/N, so card i is dead centre when
     base = i/N. Three things move base, and they simply add:

       auto    a constant drift, so the loop turns on its own
       scroll  a scrubbed offset while the section is on screen
       drag    the pointer, with a fling that decays after release

     Rendering is a gsap.ticker callback. Nothing measures the DOM per frame;
     each card gets five custom properties and an opacity, all of which the
     compositor can handle on its own.
     ========================================================================== */

  (function () {
    var section = document.querySelector('.loop');
    if (!section) return;

    var stage = section.querySelector('.loop-stage');
    var list  = section.querySelector('.loop-fallback');
    var bar   = section.querySelector('.loop-bar');
    var count = section.querySelector('.loop-count');
    if (!stage || !list) return;

    var cards = [].slice.call(list.children);
    var N = cards.length;
    if (N < 3) return;

    /* Below this there is no room for the sideways travel, and the cards at
       the back would be too small to make sense of. */
    var MIN_WIDTH = 900;

    var TILT   = 22;    /* deg the card turns to face the middle             */
    var ROLL   = 3;     /* deg of in-plane roll, tied to height on the path  */
    var BIAS   = 2.2;   /* how near the front a card has to be to come close */
    var BACK   = 0.05;  /* how visible a card is at the back of the loop     */
    var TURN   = 68;    /* seconds for one unattended revolution             */
    var SCROLL = 0.55;  /* revolutions added by scrolling past the section   */
    var GAIN   = 2.0;   /* how much of a drag carries into the loop          */
    var DECAY  = 0.04;  /* of the fling speed left after one second          */

    var SPAN = 0, RY = 0, RZ = 0;

    var auto = 0, scrolled = 0, thrown = 0, vel = 0;
    var dragging = false, moved = 0, lastX = 0, lastT = 0;
    var running = false, ticking = false;
    var active = false, tween = null;
    var lastBase = -1, lastFocus = -1;
    var scrollProxy = { p: 0 };

    /* Spacing is set from the card, not the viewport. Consecutive cards sit
       2·SPAN/N apart, so pinning SPAN to a multiple of the card width is
       what guarantees the gap between neighbours rather than hoping a
       viewport fraction happens to clear them at this count. */
    function measure() {
      var w  = window.innerWidth;
      var h  = stage.offsetHeight || window.innerHeight;
      var cw = cards[0].offsetWidth || 260;

      SPAN = Math.max(cw * 13, w * 1.5);
      RY   = Math.min(h * 0.26, 230);
      RZ   = 600;                    /* paired with the 1800px perspective:
                                        1.5x at the front, 0.75x at the back */
    }

    function wrap01(v) { v %= 1; return v < 0 ? v + 1 : v; }

    function render() {
      var base = wrap01(auto + scrolled + thrown);
      if (base === lastBase) return;              /* nothing moved this frame */
      lastBase = base;

      var focus = 0, best = 2;

      for (var i = 0; i < N; i++) {
        var u = wrap01(0.5 + base - i / N);

        var ang = u * Math.PI * 2 + Math.PI;
        var x   = (u - 0.5) * 2 * SPAN;
        var y   = Math.sin(ang) * RY;
        var g   = Math.pow((Math.cos(ang) + 1) / 2, BIAS);   /* 0 back, 1 front */
        var z   = (g * 2 - 1) * RZ;

        var s = cards[i].style;
        s.setProperty('--x',  x.toFixed(2) + 'px');
        s.setProperty('--y',  y.toFixed(2) + 'px');
        s.setProperty('--z',  z.toFixed(2) + 'px');
        s.setProperty('--ry', (x / SPAN * TILT).toFixed(2) + 'deg');
        s.setProperty('--rz', (-y / RY * ROLL).toFixed(2) + 'deg');
        s.opacity = (BACK + (1 - BACK) * Math.pow(g, 1.7)).toFixed(3);
        s.zIndex  = Math.round(1000 + z);

        var d = Math.abs(u - 0.5);
        if (d < best) { best = d; focus = i; }
      }

      if (focus !== lastFocus) {
        if (lastFocus >= 0) cards[lastFocus].classList.remove('is-focus');
        cards[focus].classList.add('is-focus');
        lastFocus = focus;
        if (count) count.textContent = pad(focus + 1) + ' / ' + pad(N);
      }

      if (bar) bar.style.setProperty('--p', (base * 100).toFixed(1) + '%');
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

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

       x maps linearly to u, so a drag is just dx / (2·SPAN) — the card under
       the pointer keeps up with it. GAIN lifts that a little, because at this
       spacing a one-to-one drag asks for a very long swipe to reach the next
       card. */

    function onDown(e) {
      if (e.button > 0) return;
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastT = e.timeStamp;
      vel = 0;
      stage.classList.add('is-dragging');
      stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
    }

    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dt = Math.max(e.timeStamp - lastT, 1) / 1000;
      lastX = e.clientX;
      lastT = e.timeStamp;
      moved += Math.abs(dx);

      var du = (dx * GAIN) / (2 * SPAN);
      thrown += du;
      vel = du / dt;              /* carried into the fling on release */
    }

    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      stage.releasePointerCapture && stage.releasePointerCapture(e.pointerId);
      /* A stale velocity from a drag that stopped before the finger lifted
         would launch the loop off a still pointer. */
      if (e.timeStamp - lastT > 120) vel = 0;
    }

    /* A drag that ends on a card must not also open it. */
    function onClick(e) {
      if (moved > 8) { e.preventDefault(); e.stopPropagation(); }
    }

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
    function prevent(e) { e.preventDefault(); }

    /* ---- wiring ---------------------------------------------------------- */

    function activate() {
      if (active) return;
      active = true;

      list.classList.remove('loop-fallback');
      list.classList.add('loop-track');
      stage.appendChild(list);
      section.classList.add('is-spiral');

      measure();
      bindDrag();

      /* One screen of hold, and the scroll through it turns the loop about
         half a revolution on top of the drift so the two read as one
         motion. Deliberately short: the loop keeps turning on its own, so
         there is nothing to wait for and no reason to trap anyone here
         until all fourteen have filed past. */
      tween = gsap.to(scrollProxy, {
        p: SCROLL,
        ease: 'none',
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: '+=100%',
          pin: true,
          pinSpacing: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: function () { scrolled = scrollProxy.p; }
        }
      });

      /* No timers and no decoding while the loop is off screen. */
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
          running = entries[0] && entries[0].isIntersecting;
          running ? run() : halt();
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
      if (tween) {
        if (tween.scrollTrigger) tween.scrollTrigger.kill(true);   /* unwrap the pin spacer */
        tween.kill();
        tween = null;
      }
      scrolled = 0;
      scrollProxy.p = 0;

      section.classList.remove('is-spiral');
      list.classList.remove('loop-track');
      list.classList.add('loop-fallback');
      section.appendChild(list);

      cards.forEach(function (card) {
        ['--x', '--y', '--z', '--ry', '--rz'].forEach(function (p) { card.style.removeProperty(p); });
        card.style.opacity = '';
        card.style.zIndex = '';
        card.classList.remove('is-focus');
      });
      lastBase = -1;
      lastFocus = -1;
    }

    function decide() {
      if (!reduced && hasGsap && window.innerWidth >= MIN_WIDTH) {
        active ? measure() : activate();
      } else deactivate();
    }

    decide();

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        decide();
        if (active) { lastBase = -1; render(); ScrollTrigger.refresh(); }
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

  /* Warm the frames once the page itself is done. They are lazy (images) or
     metadata-only (video) in the markup so first paint is not held up, but a
     lazy loader inside an overflow:hidden stage often never judges them near
     enough to fetch. One at a time, in document order, so they do not fight
     each other for bandwidth. */
  window.addEventListener('load', function () {
    var pending = [].slice.call(document.querySelectorAll('.cycle img, .cycle video'));

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

    /* Gate on the section rather than the cards. Inside the loop the cards
       are on a 3D-transformed stage, where per-element intersection is not
       something to rely on. */
    var host = document.querySelector('.loop') || document.body;

    if (!window.IntersectionObserver) {
      runners.forEach(function (r) { r.run(); });
      return;
    }

    new IntersectionObserver(function (entries) {
      var on = entries[0] && entries[0].isIntersecting;
      runners.forEach(function (r) { on ? r.run() : r.halt(); });
    }, { threshold: 0 }).observe(host);
  })();

  /* ScrollTrigger measures at load; late fonts and the portrait shift things
     under it. One refresh once everything has landed. */
  if (hasGsap) {
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }
})();
