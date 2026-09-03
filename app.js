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
     The cylinder

     A drum of a fixed radius lying across the middle of the screen. The
     cards are on its surface and they do two things at once: they travel
     along the axis, left to right, and they turn around it. So the shape
     never changes — it is always the same tube — while the contents flow
     through it.

         u   = the card's place along the tube, 0…1, wrapping
         x   = (u − ½)·LEN                 left to right along the axis
         ang = (u·TURNS + i/N)·2π          and round the tube as it goes
         y   = cos(ang)·R                  over the top, under the bottom
         z   = sin(ang)·R                  behind the text, then in front

     The text sits at depth zero on that axis, so it is inside the tube: the
     near half of the cylinder passes in front of the words and the far half
     behind them.

     TURNS is a whole number, which is what makes the wrap invisible: at u=0
     and u=1 the angle differs by an exact multiple of 2π, so only x jumps —
     and the fade at both ends means the card is already gone by then.

     R is the same vertically and in depth, so the cross section is a circle
     and the tube reads as genuinely round.

     TURNS must stay a whole number: at u = 0 and u = 1 the spin angle then
     differs by an exact multiple of 2π, so the only thing that jumps at the
     seam is s — and the card is already invisible out there.

     Legibility is Approach 2, the constant slow fade: opacity is tied
     straight to the screen x coordinate. Dead centre the cards run at
     CENTRE (about a tenth), and they glow up to full only as they drift out
     past the edges — so whatever is passing behind the name is always the
     dimmest thing on screen. Flip CENTRE toward 1 and steepen EDGE to get
     the snappier high-energy version instead.

     Three things move it, and they simply add:

       auto    a constant drift, so it turns on its own
       scroll  a scrubbed offset while the hero is pinned
       drag    the pointer, with a fling that decays after release
     ========================================================================== */

  /* ---------------------------------------------------------- The boot

     The open, in four beats:

       1. a loading screen — a sheet of page colour over the cylinder, with
          nothing on it but the name, which resolves out of a blur
       2. the name dips, then breaks into three glowing points, each of which
          rides its own hand-drawn line to one of the three things in the
          header: the face on the left, the nav in the middle, the icons on
          the right
       3. each landing has its own follow-through — the face catches its
          point and the lockup slides out from behind it; the middle nav
          button lights and the other two open out of it left and right; the
          middle icon shimmers and the other two run in from the right
       4. the word in the middle of the cylinder fades up and starts its
          cycle

     Every target is measured at flight time, so nothing is hard-coded and it
     lands correctly at any size.

     With the script off or reduced motion on, none of this runs — the name
     and the first word are in the markup, already in their resting place. */

  (function () {
    var center = document.querySelector('[data-intro]');
    if (!center) return;

    var title  = center.querySelector('.hero-title');
    var line   = document.querySelector('.hero-skills');
    var skills = document.querySelector('.skills-type');
    var out    = document.querySelector('.type-out');
    var face   = document.querySelector('.mark-face');
    var dot    = document.querySelector('.boot-dot');
    var nav    = document.querySelector('.nav');
    var social = document.querySelector('.head-social');
    var list;
    try { list = JSON.parse(skills && skills.getAttribute('data-skills') || '[]'); }
    catch (e) { list = []; }

    if (reduced || !list.length || !title || !face || !line) return;

    /* The first word stays where the markup put it — the morph swaps it out
       later. (Clearing it here was the typewriter's job, and the typewriter
       is gone.) */
    line.classList.add('is-held');
    center.classList.add('intro-armed');
    doc.classList.add('booting');
    doc.classList.add('head-wait');   /* outlives booting: see fly() */

    /* Only now are these allowed to hide, because only now is something
       guaranteed to come along and open them again. */
    var mark = face.closest ? face.closest('.mark') : null;
    if (mark)   mark.classList.add('is-tucked');
    if (nav)    nav.classList.add('is-held');
    if (social) social.classList.add('is-held');

    var HOLD_NAME = 1250;    /* how long the name has the screen to itself */
    var DIP       = 420;     /* it sinks a little before it goes           */
    var MORPH     = 280;     /* then packs itself into the dot             */
    var FLIGHT    = 1450;    /* and the dot rides the line to the face     */

    requestAnimationFrame(function () {
      setTimeout(function () { center.classList.add('boot-in'); }, 420);
      setTimeout(dip, HOLD_NAME);
    });

    /* A beat of settling before the launch — the name drops slightly, as if
       gathering itself, and that dip is where the line starts. */
    function dip() {
      if (!hasGsap) { fly(); return; }
      title.style.transition = 'none';
      gsap.to(title, {
        y: 42, scale: 0.96,
        duration: DIP / 1000,
        ease: 'power2.inOut',
        onComplete: morph
      });
    }

    /* The name does not collapse into a point — it fades out while the three
       points come up in its place, all of them at the centre, and they set
       off from there. */
    function morph() {
      if (!hasGsap) { fly(); return; }
      gsap.to(title, { scale: 0.94, opacity: 0, duration: MORPH / 1000, ease: 'power1.out' });
      setTimeout(fly, MORPH * 0.55);
    }

    var flown = false;

    /* Each line: an ideal shape with a loop in it, resampled into a wobbling
       polyline so it reads as drawn rather than plotted, and a glowing point
       placed on it with getPointAtLength. The loop makes the path
       self-crossing, so there is no closed form left to evaluate — asking
       the path itself where it is at a given length works for any shape and
       keeps the point exactly on the ink. */
    function fly() {
      if (flown) return;
      flown = true;

      var stage = document.querySelector('.hero-stage');
      var t = title.getBoundingClientRect();
      var box = stage && stage.getBoundingClientRect();
      if (!t.width || !box) { arrive(); openNav(); openSocial(); land(); return; }

      title.style.transition = 'none';
      title.style.opacity = '0';

      var x0 = t.left + t.width / 2 - box.left;
      var y0 = t.top + t.height / 2 - box.top;

      /* Where the three points are headed, what each one sets off, and which
         way it wanders on the way. bias is how far the route bows out before
         it turns for the target: the left one swings out to the left and
         then climbs, the right one mirrors it, the middle one barely bends. */
      var legs = [
        { el: face,        after: arrive,     spin: -1, bias: -0.55, hold: 0   },
        { el: navTarget(), after: openNav,    spin:  1, bias:  0.10, hold: 150 },
        { el: socialTarget(), after: openSocial, spin: 1, bias: 0.55, hold: 300 }
      ].filter(function (leg) { return leg.el; });

      if (!legs.length) { arrive(); openNav(); openSocial(); land(); return; }

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'boot-trail');
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      svg.setAttribute('aria-hidden', 'true');
      stage.insertBefore(svg, center);

      /* The sheet goes now — the cylinder is revealed while the points are
         still travelling over it, which is the whole effect. */
      doc.classList.remove('booting');
      doc.classList.add('booted');

      /* Every point is made and lit at the centre first, so they are visibly
         one thing coming apart rather than three that were always separate. */
      var pips = legs.map(function (leg, i) {
        var pip = i === 0 ? dot : (dot ? dot.cloneNode(true) : null);
        if (pip && i > 0) stage.insertBefore(pip, center);
        if (pip) {
          pip.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px)';
          pip.style.opacity = '1';
        }
        return pip;
      });

      var done = 0;
      legs.forEach(function (leg, i) { run(leg, i, pips[i]); });

      function run(leg, i, pip) {
        var m = leg.el.getBoundingClientRect();
        var x1 = m.left + m.width / 2 - box.left;
        var y1 = m.top + m.height / 2 - box.top;

        var len = Math.hypot(x1 - x0, y1 - y0) || 1;

        /* The route is one curve with a spiral wound onto it. The curve is a
           quadratic from the start to the target whose control point is
           thrown out sideways by bias, so the left leg wanders left before
           it climbs and the right leg mirrors that. The spiral is a rotation
           around whatever point the curve is at, with a radius that decays
           to nothing — so it corkscrews as it sets off and has unwound by
           the time it arrives, instead of drawing one tidy loop and then
           going quiet.

           This is what stops it reading as machine-made: a single arc is
           obviously computed, but something that spirals down to a point
           looks like a hand that kept moving. */
        var cx2 = (x0 + x1) / 2 + (y1 - y0) * leg.bias;
        var cy2 = (y0 + y1) / 2 - (x1 - x0) * leg.bias + len * 0.16;

        var TURNSP = 2.4;
        var R0 = Math.max(26, Math.min(len * 0.20, 96));
        var ph0 = Math.random() * 6.28;
        var ph1 = Math.random() * 6.28, ph2 = Math.random() * 6.28;
        var amp = Math.min(len * 0.014, 8);

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.appendChild(path);

        var d = '', STEPS = 220;
        for (var k = 0; k <= STEPS; k++) {
          var tt = k / STEPS, qq = 1 - tt;

          /* the carrying curve */
          var bx = qq * qq * x0 + 2 * qq * tt * cx2 + tt * tt * x1;
          var by = qq * qq * y0 + 2 * qq * tt * cy2 + tt * tt * y1;

          /* the spiral wound onto it, tightening to zero at the target */
          var a = ph0 + tt * TURNSP * Math.PI * 2 * leg.spin;
          var rad = R0 * Math.pow(1 - tt, 1.5);
          bx += Math.cos(a) * rad;
          by += Math.sin(a) * rad * 0.72;

          /* and the hand on top of that */
          var env = Math.sin(Math.PI * tt);
          var off = (Math.sin(tt * 11.3 + ph1) * 0.6 + Math.sin(tt * 5.1 + ph2) * 0.4) * amp * env;
          bx += off; by += off * 0.4;

          d += (k ? ' L ' : 'M ') + bx.toFixed(2) + ' ' + by.toFixed(2);
        }
        path.setAttribute('d', d);

        var L = path.getTotalLength();
        path.style.strokeDasharray  = L;
        path.style.strokeDashoffset = L;

        if (!hasGsap) { finish(); return; }

        var at = { p: 0 };
        gsap.to(at, {
          p: 1,
          duration: FLIGHT / 1000,
          delay: leg.hold / 1000,
          ease: 'power2.inOut',
          onUpdate: function () {
            var p = at.p;
            var q = path.getPointAtLength(L * p);
            if (pip) {
              pip.style.transform = 'translate(' + q.x + 'px,' + q.y + 'px)';
              if (p > 0.86) pip.style.opacity = String(1 - (p - 0.86) / 0.14);
            }
            path.style.strokeDashoffset = L * (1 - p);
          },
          onComplete: function () {
            if (pip) pip.style.opacity = '0';
            gsap.to(path, {
              strokeDashoffset: -L,
              duration: 0.5,
              ease: 'power2.in',
              onComplete: function () { if (pip && i > 0) pip.remove(); }
            });
            finish();
          }
        });

        function finish() {
          leg.after();
          if (++done === legs.length) {
            setTimeout(function () { if (svg.parentNode) svg.remove(); }, 620);
            land();
          }
        }
      }
    }

    function navTarget() {
      if (!nav) return null;
      var kids = nav.children;
      return kids[Math.floor(kids.length / 2)] || kids[0] || null;
    }

    /* The furthest one. The other two come out from behind it and travel
       left, so the row builds inward from the edge. */
    function socialTarget() {
      if (!social) return null;
      var kids = social.children;
      return kids[kids.length - 1] || null;
    }

    /* The handover on the left: the header appears only now, so the face
       springing up reads as the name turning into it rather than as a second
       thing that was already there. */
    function arrive() {
      doc.classList.remove('head-wait');
      if (!mark) return;
      mark.classList.add('is-arriving');
      setTimeout(function () { mark.classList.add('is-open'); }, 420);
    }

    /* The middle: the button the line hit lights first, then the other two
       open out of it, left and right. */
    function openNav() {
      if (!nav) return;
      nav.classList.add('is-lit');
      setTimeout(function () { nav.classList.add('is-open'); }, 260);
    }

    /* The right: the icon it hit shimmers, then the other two run in. */
    function openSocial() {
      if (!social) return;
      social.classList.add('is-lit');
      setTimeout(function () { social.classList.add('is-open'); }, 300);
    }

    var landed = false;
    function land() {
      if (landed) return;
      landed = true;
      center.classList.add('name-gone');
      line.classList.remove('is-held');
      line.classList.add('is-lit');
      setTimeout(cycle, 420);
    }

    /* ---- the liquid word ------------------------------------------------

       No typing. Each word melts into the next: the one leaving blurs out,
       swells and lifts away while the one arriving resolves from a blur
       underneath it, and the box eases between the two widths so the line
       never snaps. Overlapping the two through a blur is what gives it the
       fluid read rather than a cut or a slide. */

    var HOLD = 2100, MELT = 780;
    var DEPTH = 16, STEP_Z = 2.6;   /* how many copies, and how far apart */
    var wi = 0;

    /* One word, built in depth: a run of copies of the same text stacked
       back along z, the front one in ink and the rest walking toward the
       extrude tone so the side of the letter reads as a lit face rather
       than a smear. */
    function build(text) {
      var wrap = document.createElement('span');
      wrap.className = 'type-out';
      var solid = document.createElement('span');
      solid.className = 'type-3d';

      for (var i = DEPTH - 1; i >= 0; i--) {
        var face = document.createElement('span');
        face.className = 'face';
        face.textContent = text;
        face.style.transform = 'translateZ(' + (-i * STEP_Z) + 'px)';
        /* i = 0 is the face you read; everything behind it is the wall */
        face.style.color = i === 0
          ? 'var(--void)'
          : 'color-mix(in srgb, var(--extrude) ' + Math.round(55 + (i / DEPTH) * 45) + '%, var(--void))';
        solid.appendChild(face);
      }
      /* the first child in flow is the one that sizes the box */
      solid.insertBefore(solid.lastChild, solid.firstChild);
      wrap.appendChild(solid);
      return wrap;
    }

    function measureWidth(el) {
      return Math.ceil(el.getBoundingClientRect().width);
    }

    function cycle() {
      /* swap the flat markup word for the built one */
      var solid = build(out.textContent);
      out.replaceWith(solid);
      out = solid;
      skills.style.width = measureWidth(out) + 'px';
      setTimeout(step, HOLD);
    }

    function step() {
      wi = (wi + 1) % list.length;

      var next = build(list[wi]);
      next.style.opacity = '0';
      next.style.filter = 'blur(18px)';
      next.style.transform = 'scale(.86) translateY(14px)';

      var prev = out;
      prev.classList.add('is-out');
      skills.appendChild(next);
      out = next;

      /* the box follows the incoming word */
      skills.style.width = measureWidth(next) + 'px';

      if (!hasGsap) {
        prev.remove();
        next.style.cssText = '';
        setTimeout(step, HOLD);
        return;
      }

      gsap.to(prev, {
        opacity: 0,
        filter: 'blur(20px)',
        scale: 1.14,
        y: -18,
        duration: MELT / 1000,
        ease: 'power2.in',
        onComplete: function () { prev.remove(); }
      });
      gsap.to(next, {
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        y: 0,
        duration: MELT / 1000,
        ease: 'power3.out',
        onComplete: function () {
          /* Drop the filter entirely rather than leaving it at zero: any
             filter at all keeps the element flattened, and the extrusion
             inside would stay collapsed. */
          gsap.set(next, { clearProps: 'filter' });
          setTimeout(step, HOLD);
        }
      });
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

    var TURNS  = 3;     /* whole turns a card makes crossing the tube        */
    var FACE   = 22;    /* deg a card turns as it comes round the cylinder    */
    var ROLL   = 6;     /* deg of in-plane roll, for life                     */
    var CENTRE = 0.12;  /* how lit a card is at dead centre, behind the text  */
    var BACK   = 0.34;  /* how lit a card is round the back of the drum       */
    var EDGEF  = 0.10;  /* fraction of each end spent fading in and out       */
    var TURN   = 40;    /* seconds for one unattended pass end to end         */
    var SCROLL = 0.30;  /* revolutions added by scrolling the hero away       */
    var GAIN   = 1.0;   /* how much of a drag carries into the spin           */
    var DECAY  = 0.04;  /* of the fling speed left after one second           */

    var LEN = 0, R = 0, EDGE = 1;

    var auto = 0, scrolled = 0, thrown = 0, vel = 0;
    var dragging = false, moved = 0, lastX = 0, lastT = 0;
    var ticking = false, active = false, pin = null;
    var lastBase = -1, lastFocus = -1;

    /* LEN is the length of the drum, a little wider than the frame so it
       reads as a cylinder carrying on past both edges rather than a row that
       stops. R is its radius, the same number vertically and in depth. */
    function measure() {
      var w = window.innerWidth;
      var h = stage.offsetHeight || window.innerHeight;
      var cw = cards[0].offsetWidth || 220;

      /* Long enough that the ends sit well outside the frame, so the wrap
         happens off screen; the fade at each end covers what is left. */
      LEN  = Math.max(w * 1.9, (w + cw) * 1.3);
      R    = Math.max(Math.min(w * 0.26, h * 0.34), cw * 0.6);
      EDGE = w * 0.34;                /* x at which a card is fully lit */
    }

    function wrap01(v) { v %= 1; return v < 0 ? v + 1 : v; }

    function render() {
      var base = wrap01(auto + scrolled + thrown);
      if (base === lastBase) return;              /* nothing moved this frame */
      lastBase = base;

      var focus = 0, best = -Infinity;

      for (var i = 0; i < N; i++) {
        /* Where it is along the tube, and — from the same number — where it
           is around it. Travel and spin off one parameter is what makes it a
           helix rather than a ring that happens to slide. */
        var u = wrap01(base + i / N);
        var x = (u - 0.5) * LEN;

        var ang = (u * TURNS + i / N) * Math.PI * 2;
        var ca  = Math.cos(ang);
        var sa  = Math.sin(ang);

        var y = ca * R;
        var z = sa * R;

        /* Three dimmers multiplied: depth as it swings round, distance from
           centre so nothing bright ever sits behind the text, and the ends
           of the tube so the wrap is never seen. */
        var edge = Math.min(u, 1 - u) / EDGEF;
        var ends = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
        var depth = BACK + (1 - BACK) * ((sa + 1) / 2);
        var n     = Math.min(Math.abs(x) / EDGE, 1);
        var lit   = CENTRE + (1 - CENTRE) * (n * n * (3 - 2 * n));

        var card = cards[i];
        var st = card.style;
        st.setProperty('--x',  x.toFixed(2) + 'px');
        st.setProperty('--y',  y.toFixed(2) + 'px');
        st.setProperty('--z',  z.toFixed(2) + 'px');
        st.setProperty('--ry', (ca * FACE).toFixed(2) + 'deg');
        st.setProperty('--rz', (sa * ROLL).toFixed(2) + 'deg');
        st.opacity = (lit * depth * ends).toFixed(3);

        /* Round the back of the tube there is no room for the caption. */
        card.classList.toggle('is-far', sa < -0.4);

        var score = lit * depth * ends;
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
    /* [data-rise] is the progression's own way of arriving, and the contact
       panel borrows it so the end of the page lands the same way the eras
       do: the block comes up and settles rather than simply appearing. It is
       scrubbed, so it tracks the scroll rather than firing once. */
    if (!reduced && hasGsap) {
      document.querySelectorAll('[data-rise]').forEach(function (el) {
        /* The contact panel gets the same move with more of everything, and
           a tilt that flattens out — it is the last thing on the page, so it
           is allowed the bigger entrance. */
        var big = el.closest('.contact') !== null;
        gsap.fromTo(el,
          { y: big ? 130 : 74, scale: big ? 0.92 : 0.965, rotateX: big ? 9 : 0 },
          {
            y: 0, scale: 1, rotateX: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top 92%',
              end: big ? 'top 30%' : 'top 42%',
              scrub: 0.7,
              invalidateOnRefresh: true
            }
          });
      });

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

  /* ==========================================================================
     The watch

     The progression is a watch face. A spiral is wound inside the dial and
     drawn from the rim inward as you scroll, so travelling it is travelling
     the years: the oldest work is out at the edge, now is at the centre, and
     the hand sweeps round with it. The line that feeds it is drawn down out
     of the Timeline button in the header, because that is the control this
     section belongs to.

     The eras ride the sides of the dial rather than stacking below it. Each
     one slides in, holds while the hand crosses its stretch of the spiral,
     and clears for the next — so the whole progression is one scene instead
     of a column of sections.

     The dial viewBox is square on purpose. One unit is then the same length
     on both axes, so a point taken off the path with getPointAtLength maps
     into element coordinates with a single scale factor, and the marker,
     the hand and the year labels all land exactly on the geometry rather
     than near it.

     It only runs where there is room and a ticker to drive it. Everywhere
     else the eras stay in the flow as ordinary sections, which is the whole
     content — nothing here is load-bearing.
     ========================================================================== */

  (function () {
    var orbit = document.querySelector('.path-orbit');
    if (!orbit || reduced || !hasGsap) return;
    if (window.innerWidth < 1000) return;

    var inner = orbit.querySelector('.path-orbit-in');
    var svg   = orbit.querySelector('.path-svg');
    var line  = orbit.querySelector('.path-line');
    var ticks = orbit.querySelector('.path-ticks');
    var hand  = orbit.querySelector('.path-hand');
    var mark  = orbit.querySelector('.path-mark');
    var feed  = orbit.querySelector('.path-feed');
    var feedPath = feed && feed.querySelector('path');
    var years = [].slice.call(orbit.querySelectorAll('.path-dial li'));
    var burst = [].slice.call(orbit.querySelectorAll('.path-burst li'));
    var eras  = [].slice.call(document.querySelectorAll('.era-scenes .era'));
    if (!svg || !line || !eras.length) return;

    orbit.classList.add('is-live');

    /* ---- the dial ------------------------------------------------------- */
    var TICKS = 60, R_BEZEL = 470;
    var tickMarkup = '';
    for (var t = 0; t < TICKS; t++) {
      var a = (t / TICKS) * Math.PI * 2 - Math.PI / 2;
      var major = t % 5 === 0;
      var r1 = R_BEZEL - (major ? 26 : 14);
      tickMarkup += '<line class="path-tick' + (major ? ' is-major' : '') + '" ' +
        'x1="' + (500 + Math.cos(a) * r1).toFixed(1) + '" y1="' + (500 + Math.sin(a) * r1).toFixed(1) + '" ' +
        'x2="' + (500 + Math.cos(a) * R_BEZEL).toFixed(1) + '" y2="' + (500 + Math.sin(a) * R_BEZEL).toFixed(1) + '"/>';
    }
    ticks.innerHTML = tickMarkup;

    /* ---- the spiral, rim to centre -------------------------------------- */
    var TURNS = 3.1, R_OUT = 415, R_IN = 24, STEPS = 720;
    var d = '';
    for (var i = 0; i <= STEPS; i++) {
      var q = i / STEPS;
      var ang = q * TURNS * Math.PI * 2 - Math.PI / 2;
      var r = R_OUT + (R_IN - R_OUT) * q;
      d += (i ? ' L ' : 'M ') +
           (500 + Math.cos(ang) * r).toFixed(2) + ' ' +
           (500 + Math.sin(ang) * r).toFixed(2);
    }
    line.setAttribute('d', d);

    var L = line.getTotalLength();
    line.style.strokeDasharray = L;
    line.style.strokeDashoffset = L;

    /* ---- the eras take the sides ---------------------------------------- */
    eras.forEach(function (era, i) {
      era.classList.add('is-live-era');
      era.classList.add(i % 2 === 0 ? 'side-left' : 'side-right');
      inner.appendChild(era);
    });

    /* Each era owns a stretch of the sweep. */
    var LEAD = 0.10, TAIL = 0.16;
    var span = (1 - LEAD - TAIL) / eras.length;

    var unit = 1, ox = 0, oy = 0;

    function measure() {
      var sb = svg.getBoundingClientRect();
      var ob = orbit.getBoundingClientRect();
      if (!sb.width) return;
      unit = sb.width / 1000;
      ox = sb.left - ob.left;
      oy = sb.top - ob.top;

      /* year labels sit just outside the bezel */
      years.forEach(function (el, i) {
        var a = (i / years.length) * Math.PI * 2 - Math.PI / 2;
        var r = (R_BEZEL + 52) * unit;
        el.style.left = (ox + 500 * unit + Math.cos(a) * r) + 'px';
        el.style.top  = (oy + 500 * unit + Math.sin(a) * r) + 'px';
      });

      burst.forEach(function (el, i) {
        var a = (i / burst.length) * Math.PI * 2 - Math.PI / 2;
        var rad = Math.min(sb.width * 0.30, 250);
        el.dataset.bx = (Math.cos(a) * rad).toFixed(1);
        el.dataset.by = (Math.sin(a) * rad * 0.85).toFixed(1);
      });

      drawFeed();
    }

    /* The line down out of the Timeline button. Both ends are measured from
       the viewport while the scene is pinned, which is the only moment it is
       ever drawn. */
    function drawFeed() {
      if (!feedPath) return;
      var btn = document.querySelector('.nav a[href="#path"]');
      var ob = orbit.getBoundingClientRect();
      if (!btn) { feedPath.removeAttribute('d'); return; }
      var b = btn.getBoundingClientRect();
      var sx = b.left + b.width / 2 - ob.left;
      var sy = b.bottom - ob.top;
      var ex = ox + 500 * unit;
      var ey = oy + (500 - R_BEZEL) * unit;
      feedPath.setAttribute('d',
        'M ' + sx + ' ' + sy +
        ' C ' + sx + ' ' + (sy + (ey - sy) * 0.55) +
        ', ' + ex + ' ' + (sy + (ey - sy) * 0.45) +
        ', ' + ex + ' ' + ey);
      var fl = feedPath.getTotalLength();
      feedPath.style.strokeDasharray = fl;
      feedPath.style.strokeDashoffset = fl;
    }

    function pointAt(p) {
      var q = line.getPointAtLength(L * Math.max(0, Math.min(1, p)));
      return { x: ox + q.x * unit, y: oy + q.y * unit };
    }

    measure();

    ScrollTrigger.create({
      trigger: orbit,
      start: 'top top',
      end: '+=420%',
      pin: true,
      pinSpacing: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      onRefresh: measure,
      onUpdate: function (self) {
        var p = self.progress;

        /* the feed draws first, out of the button */
        if (feedPath) {
          var fl = feedPath.getTotalLength();
          var fp = Math.min(1, p / LEAD);
          feedPath.style.strokeDashoffset = fl * (1 - fp);
          feedPath.style.opacity = String(0.8 * (1 - Math.max(0, (p - 0.34) / 0.16)));
        }

        /* then the spiral is drawn from the rim inward */
        var sp = Math.min(1, Math.max(0, (p - LEAD) / (1 - LEAD)));
        line.style.strokeDashoffset = L * (1 - sp);

        /* the hand sweeps with it, and the marker rides the leading end */
        var q = pointAt(sp);
        var hx = (q.x - ox) / unit, hy = (q.y - oy) / unit;
        hand.setAttribute('x2', hx);
        hand.setAttribute('y2', hy);
        mark.style.transform = 'translate(' + q.x + 'px,' + q.y + 'px)';
        mark.style.opacity = sp > 0.01 && sp < 0.995 ? '1' : '0';

        /* the burst at the centre */
        var b = Math.min(1, Math.max(0, (p - (1 - TAIL * 0.72)) / (TAIL * 0.72)));

        /* the years light as the hand passes them */
        years.forEach(function (el, i) {
          el.classList.toggle('is-now', sp >= i / years.length - 0.04);
        });

        /* and each era holds the side while the hand crosses its stretch */
        eras.forEach(function (era, i) {
          var a0 = LEAD + i * span;
          var local = (p - a0) / span;
          var vis;
          if (local < 0 || local > 1) vis = 0;
          else if (local < 0.16) vis = local / 0.16;
          else if (local > 0.84) vis = (1 - local) / 0.16;
          else vis = 1;
          vis = Math.max(0, Math.min(1, vis)) * (1 - b);
          var dir = i % 2 === 0 ? -1 : 1;
          era.style.opacity = vis.toFixed(3);
          era.style.transform =
            'translateY(-50%) translateX(' + (dir * (1 - vis) * 70).toFixed(1) + 'px)';
        });

        burst.forEach(function (el, i) {
          var k = Math.min(1, Math.max(0, (b - (i / burst.length) * 0.18) / 0.82));
          var e = 1 - Math.pow(1 - k, 3);
          el.style.opacity = e.toFixed(3);
          el.style.transform =
            'translate(calc(-50% + ' + (el.dataset.bx * e) + 'px),' +
                     'calc(-50% + ' + (el.dataset.by * e) + 'px)) ' +
            'scale(' + (0.4 + e * 0.6) + ')';
        });
      }
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(measure, 180);
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
