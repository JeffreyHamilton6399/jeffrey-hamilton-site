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
     The spiral

     Cards wind around a horizontal axis running left to right across the
     screen. Each card has a position u in [0,1) along that axis; u advances
     and wraps, so the row is endless.

         x   = (u − ½)·2·SPAN            far left to far right
         ang = u·2π·TURNS + π
         y   = sin(ang)·RY               over the top, then under the bottom
         z   = cos(ang)·RZ               behind the axis, then in front of it

     TURNS is what makes it a spiral rather than a queue. At three turns over
     the path two neighbours are most of a revolution apart, so the card next
     to the one at the front is round the far side and small — they wind past
     each other instead of lining up. TURNS has to stay a whole number: the
     wrap from u=1 back to u=0 only disappears because the angle differs by
     an exact multiple of 2π there, leaving nothing but the jump in x, which
     happens well off screen.

     The axis runs through the name, which sits at depth zero in the same 3D
     rendering context — so the cards orbit it, and the ones coming round the
     near side cover it while the ones on the far side are covered by it. The
     name is set wide enough that a card at the front can only ever take a
     bite out of it, never the whole thing. That sorting is the picture, and it is why nothing in the
     subtree sets z-index or opacity — either one flattens the context.

     Three things move the position, and they simply add:

       auto    a constant drift, so it turns on its own
       scroll  a scrubbed offset while the hero is pinned
       drag    the pointer, with a fling that decays after release
     ========================================================================== */

  /* ---------------------------------------------------------- Skills rotator

     The one big word under the name cycles through the list in its data
     attribute, s0animation style: the word in view slides up out of the
     mask while the next slides up into it, and the mask's width eases to the
     new word so the layout never jumps. With the script off, or with reduced
     motion, the first word just stands there. */

  (function () {
    var box = document.querySelector('.skills-rotator');
    if (!box) return;

    var words;
    try { words = JSON.parse(box.getAttribute('data-skills') || '[]'); }
    catch (e) { words = []; }
    if (words.length < 2) return;

    var DWELL = 2200;   /* how long a word holds before the next swap */
    var SLIDE = 620;    /* the slide, matched to the transition below */

    /* Replace the plain text with a measured span so the mask can size to it. */
    box.textContent = '';
    var current = wordEl(words[0]);
    box.appendChild(current);
    setWidth(current);

    var i = 0, timer = setTimeout(swap, DWELL);

    /* Keep the box sized to the live word across a font load or a resize. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setWidth(current); });
    }
    window.addEventListener('resize', function () { setWidth(current); });

    function wordEl(text) {
      var el = document.createElement('span');
      el.className = 'word';
      el.textContent = text;
      return el;
    }

    /* Width only — the height comes from the word's own line box plus the
       mask's padding, so it never needs pinning and never clips. */
    function setWidth(el) {
      box.style.width = Math.ceil(el.getBoundingClientRect().width) + 'px';
    }

    function swap() {
      i = (i + 1) % words.length;
      var next = wordEl(words[i]);

      if (reduced) {
        box.replaceChildren(next);
        setWidth(next);
        current = next;
        timer = setTimeout(swap, DWELL);
        return;
      }

      /* incoming starts a line below, outgoing is lifted out of flow so the
         box can resize to the incoming word while the two animate together */
      next.style.transform = 'translateY(105%)';
      box.appendChild(next);
      current.classList.add('is-out');
      setWidth(next);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          current.style.transition = 'transform ' + SLIDE + 'ms ' + 'cubic-bezier(.16,1,.3,1)';
          next.style.transition    = 'transform ' + SLIDE + 'ms ' + 'cubic-bezier(.16,1,.3,1)';
          current.style.transform = 'translateY(-105%)';
          next.style.transform = 'translateY(0)';
        });
      });

      var out = current;
      setTimeout(function () { out.remove(); }, SLIDE + 40);
      current = next;
      timer = setTimeout(swap, DWELL);
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

    var TURNS  = 3;     /* whole revolutions across the path — must be integer */
    var TILT   = 30;    /* deg a card turns to face the middle                 */
    var ROLL   = 7;     /* deg of in-plane roll, tied to height on the path    */
    var SEAM   = 0.08;  /* fraction of the path spent fading through the wrap  */
    var BACK   = 0.28;  /* how visible a card is at the very back              */
    var TURN   = 74;    /* seconds for one unattended pass of the whole path   */
    var SCROLL = 0.30;  /* passes added by scrolling the hero away             */
    var GAIN   = 1.8;   /* how much of a drag carries into the spiral          */
    var DECAY  = 0.04;  /* of the fling speed left after one second            */

    var SPAN = 0, RY = 0, RZ = 0;

    var auto = 0, scrolled = 0, thrown = 0, vel = 0;
    var dragging = false, moved = 0, lastX = 0, lastT = 0;
    var ticking = false, active = false, pin = null;
    var lastBase = -1, lastFocus = -1;

    function measure() {
      var w = window.innerWidth;
      var h = stage.offsetHeight || window.innerHeight;
      /* Spacing is 2·SPAN/N, so this is what decides how many cards are on
         screen and how much air is between them. 1.5 viewports of travel
         puts six or so in view at once. The card-width floor is what holds
         at the narrow end, where the card stops shrinking with the viewport
         and a pure viewport fraction would start stacking them. */
      var cw = cards[0].offsetWidth || 200;
      SPAN = Math.max(w * 1.35, cw * 9);
      RY   = Math.min(h * 0.34, 300);
      RZ   = 440;                     /* paired with the 1700px perspective:
                                         1.35x at the front, 0.79x at the back */
    }

    function wrap01(v) { v %= 1; return v < 0 ? v + 1 : v; }

    function render() {
      var base = wrap01(auto + scrolled + thrown);
      if (base === lastBase) return;              /* nothing moved this frame */
      lastBase = base;

      var focus = 0, best = -Infinity;

      for (var i = 0; i < N; i++) {
        var u = wrap01(0.5 + base - i / N);

        var ang = u * Math.PI * 2 * TURNS + Math.PI;
        var x   = (u - 0.5) * 2 * SPAN;
        var c   = Math.cos(ang);
        var y   = Math.sin(ang) * RY;
        var z   = c * RZ;

        /* Two fades multiplied. The first hides the jump in x at the wrap;
           the second just settles the far side back so the near side reads
           first. Kept gentle — the whole point is that you can see a lot of
           them at once. */
        var edge  = Math.min(u, 1 - u);
        var seam  = edge >= SEAM ? 1 : edge / SEAM;
        var depth = (c + 1) / 2;                            /* 0 back, 1 front */

        var card = cards[i];
        var s = card.style;
        s.setProperty('--x',  x.toFixed(2) + 'px');
        s.setProperty('--y',  y.toFixed(2) + 'px');
        s.setProperty('--z',  z.toFixed(2) + 'px');
        s.setProperty('--ry', (x / SPAN * TILT).toFixed(2) + 'deg');
        s.setProperty('--rz', (-y / RY * ROLL).toFixed(2) + 'deg');
        s.opacity = (seam * (BACK + (1 - BACK) * depth)).toFixed(3);

        card.classList.toggle('is-far', c < -0.55);

        /* Whichever card is nearest the front, and not off in the wings. */
        var score = c - Math.abs(x) / SPAN;
        if (score > best) { best = score; focus = i; }
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

       x maps linearly to u, so a drag is just dx / (2·SPAN) — the card under
       the pointer keeps up with it. GAIN lifts that a little, because at this
       spacing a one-to-one drag asks for a very long swipe. */

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

      var du = (dx * GAIN) / (2 * SPAN);
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

  /* ==========================================================================
     The drawn timeline

     The stops are laid out first, as an ordinary alternating grid, and the
     line is built afterwards from wherever the nodes actually landed — so
     the curve follows the layout rather than the layout being bent to fit a
     curve, and it survives any reflow by being rebuilt.

     Between two stops the path is a cubic with its control points pulled
     vertically, which gives the S-bend as the nodes alternate sides. At two
     of the joins it also turns a full loop: an arc with the large-arc and
     sweep flags both set and an end point a hair from the start draws a
     circle that closes on itself, which is the loop, and the path carries on
     from where it was.
     ========================================================================== */

  var timelineLine = (function () {
    var rail = document.querySelector('.tl-rail');
    if (!rail) return null;

    var svg  = rail.querySelector('.tl-line');
    var path = svg && svg.querySelector('path');
    var nodes = [].slice.call(rail.querySelectorAll('.tl-node'));
    if (!svg || !path || nodes.length < 2) return null;

    var length = 0;

    function build() {
      var box = rail.getBoundingClientRect();
      if (!box.width || !box.height) return;

      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);

      var pts = nodes.map(function (n) {
        var r = n.getBoundingClientRect();
        return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
      });

      /* One smooth line that weaves between the nodes — no loops, no tricks.
         The earlier version turned full 360 circles at two of the joins,
         which read as a gimmick stuck onto the layout. This is a plain cubic
         from each node to the next with the control handles pulled straight
         down and up, so the curve leaves and meets every node vertically and
         the whole thing flows as one hand-drawn stroke. Start a little above
         the first node and finish below the last, so it reads as passing
         through them rather than starting and stopping. */
      var d = 'M ' + pts[0][0] + ' ' + (pts[0][1] - 56) +
              ' L ' + pts[0][0] + ' ' + pts[0][1];

      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var bend = (b[1] - a[1]) * 0.5;
        d += ' C ' + a[0] + ' ' + (a[1] + bend) +
             ', ' + b[0] + ' ' + (b[1] - bend) +
             ', ' + b[0] + ' ' + b[1];
      }

      var last = pts[pts.length - 1];
      d += ' L ' + last[0] + ' ' + (last[1] + 56);

      path.setAttribute('d', d);
      length = path.getTotalLength();

      if (reduced) {
        path.style.strokeDasharray = 'none';
        path.style.strokeDashoffset = '0';
      } else {
        path.style.strokeDasharray = length;
        /* Keep whatever fraction is already drawn across a rebuild, rather
           than snapping the line back to empty on a resize. */
        var drawn = parseFloat(path.dataset.drawn || '0');
        path.style.strokeDashoffset = length * (1 - drawn);
      }
    }

    build();

    if (!reduced && hasGsap) {
      ScrollTrigger.create({
        trigger: rail,
        start: 'top 78%',
        end: 'bottom 65%',
        scrub: 0.7,
        invalidateOnRefresh: true,
        onRefreshInit: build,
        onUpdate: function (self) {
          path.dataset.drawn = self.progress;
          path.style.strokeDashoffset = length * (1 - self.progress);
        }
      });
    }

    return { build: build };
  })();

  /* ---------------------------------------------------------- Resize

     One debounced handler for everything that measures, so a drag on a
     window edge does not run three independent rebuilds per frame. */

  (function () {
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (heroSpiral) { heroSpiral.decide(); heroSpiral.refresh(); }
        if (timelineLine) timelineLine.build();
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
    if (timelineLine) timelineLine.build();
    if (heroSpiral) heroSpiral.refresh();
    if (hasGsap) ScrollTrigger.refresh();
  }
  window.addEventListener('load', settle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
})();
