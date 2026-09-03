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
         y   = cos(ang)·R − LIFT           over the top, under the bottom
         z   = sin(ang)·R                  behind, then in front

     TURNS is a whole number, which is what makes the wrap invisible: at u=0
     and u=1 the angle differs by an exact multiple of 2π, so only x jumps —
     and the fade at both ends means the card is already gone by then.

     R is the same vertically and in depth, so the cross section is a circle
     and the tube reads as genuinely round.

     LIFT carries the whole tube up clear of the line below it, and the
     vanishing point goes with it: perspective-origin is moved onto the
     tube's own axis. Lifting the cards while leaving the vanishing point at
     the middle of the stage is the trap here — the projection would then
     multiply the lift by however near a card had come, and the near side of
     the tube would climb out of the top of the frame while the far side
     barely moved. With the origin on the axis, the lift is exact and the
     tube is seen end-on.

     Legibility used to be the hard part, because the words sat inside the
     tube and everything passing behind them had to be held down. The line
     is below it now, so opacity is only what it should be: depth as a card
     swings round, and the ends of the tube so the wrap is never seen.

     Three things move it, and they simply add:

       auto    a constant drift, so it turns on its own
       scroll  a scrubbed offset while the hero is pinned
       drag    the pointer, with a fling that decays after release
     ========================================================================== */

  /* ---------------------------------------------------------- The boot

     The open, in four beats:

       1. a loading screen — a sheet of page colour over the spiral, with
          nothing on it but the name, which resolves out of a blur
       2. the name dips, then breaks into three glowing points, each of which
          rides its own hand-drawn line to one of the three things in the
          header: the face on the left, the nav in the middle, the icons on
          the right
       3. each landing has its own follow-through — the face catches its
          point and the lockup slides out from behind it; the middle nav
          button lights and the other two open out of it left and right; the
          middle icon shimmers and the other two run in from the right
       4. the word below the spiral fades up and starts its
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

    /* The name gathers into a single point at the centre — it shrinks away
       while the point comes up in its place — and that one point holds for a
       beat before the other two split out of it and all three leave. Without
       the beat there is nothing to split from and it reads as three separate
       things that happened to start together. */
    var SPLIT = 300;

    function morph() {
      if (!hasGsap) { fly(); return; }

      var stage = document.querySelector('.hero-stage');
      var t = title.getBoundingClientRect();
      var box = stage && stage.getBoundingClientRect();

      gsap.to(title, { scale: 0.06, opacity: 0, duration: MORPH / 1000, ease: 'power2.in' });

      if (dot && box) {
        dot.style.transform = 'translate(' + (t.left + t.width / 2 - box.left) + 'px,' +
                                             (t.top + t.height / 2 - box.top) + 'px)';
        gsap.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: MORPH / 1000, ease: 'power2.out' });
      }
      setTimeout(fly, MORPH + SPLIT);
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

      /* booting comes off so the header can be there to be arrived at — the
         legs land on it, and the class was holding it at zero. The sheet is
         held separately and stays until they have all landed: the spiral and
         the line underneath are the reward for the trip, and showing them
         while it is still happening gives the ending away. */
      doc.classList.remove('booting');
      doc.classList.add('sheet-held');

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

          /* The spiral wound onto it, opening from nothing at the centre and
             tightening back to nothing at the target. Both ends have to be
             pinned to zero: with the radius at full width from the first
             step, each leg began R0 away from the centre in whatever
             direction its random phase pointed — so the three lines looked
             like they started in three scattered places rather than all
             coming out of the one dot. */
          var a = ph0 + tt * TURNSP * Math.PI * 2 * leg.spin;
          var open = Math.min(tt / 0.14, 1);
          var rad = R0 * Math.pow(1 - tt, 1.5) * (open * open * (3 - 2 * open));
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
    /* Everything has arrived. The sheet goes, and the line comes up out of
       the spiral it uncovers rather than over the top of it. */
    var SHEET = 380;

    function land() {
      if (landed) return;
      landed = true;
      center.classList.add('name-gone');
      doc.classList.remove('sheet-held');
      doc.classList.add('booted');
      setTimeout(function () {
        line.classList.remove('is-held');
        line.classList.add('is-lit');
        setTimeout(cycle, 420);
      }, SHEET);
    }

    /* ---- the liquid word ------------------------------------------------

       No typing. Each word melts into the next: the one leaving blurs out,
       swells and lifts away while the one arriving resolves from a blur
       underneath it, and the box eases between the two widths so the line
       never snaps. Overlapping the two through a blur is what gives it the
       fluid read rather than a cut or a slide. */

    var HOLD = 2200, MELT = 620, FILL = 46;   /* FILL: gap between letters */
    var wi = 0;

    /* One word, letter by letter. Each letter arrives as an outline and then
       fills in, running left to right — the look the reference has mid
       change, where part of the word is still hollow and the rest has already
       gone solid. Spaces are kept as their own spans so the rhythm of the
       stagger matches the rhythm of the word. */
    function build(text) {
      var wrap = document.createElement('span');
      wrap.className = 'type-out';

      for (var i = 0; i < text.length; i++) {
        var ch = document.createElement('span');
        ch.className = 'ch';
        if (text[i] === ' ') {
          ch.className = 'ch is-space';
          ch.innerHTML = '&nbsp;';
        } else {
          ch.textContent = text[i];
        }
        wrap.appendChild(ch);
      }
      return wrap;
    }

    /* Run the fill across the letters. Direction is the order they resolve
       in; on the way out they hollow again the same way. */
    function sweep(wrap, on) {
      var chars = wrap.querySelectorAll('.ch');
      for (var i = 0; i < chars.length; i++) {
        (function (el, k) {
          setTimeout(function () { el.classList.toggle('is-fill', on); }, k * FILL);
        })(chars[i], i);
      }
      return chars.length * FILL;
    }

    function measureWidth(el) {
      return Math.ceil(el.getBoundingClientRect().width);
    }

    function cycle() {
      /* swap the flat markup word for the built one, then fill it in */
      var built = build(out.textContent);
      out.replaceWith(built);
      out = built;
      skills.style.width = measureWidth(out) + 'px';
      var span = sweep(out, true);
      setTimeout(step, HOLD + span);
    }

    function step() {
      wi = (wi + 1) % list.length;

      var prev = out;
      /* hollow the old one out again on its way off */
      sweep(prev, false);

      var next = build(list[wi]);
      next.style.opacity = '0';
      prev.classList.add('is-out');
      skills.appendChild(next);
      out = next;

      /* the box eases to the incoming word's width */
      skills.style.width = measureWidth(next) + 'px';

      if (!hasGsap) {
        prev.remove();
        next.style.opacity = '1';
        sweep(next, true);
        setTimeout(step, HOLD);
        return;
      }

      gsap.to(prev, {
        opacity: 0,
        y: -14,
        duration: MELT / 1000,
        ease: 'power2.in',
        onComplete: function () { prev.remove(); }
      });
      gsap.fromTo(next,
        { opacity: 0, y: 16 },
        {
          opacity: 1, y: 0,
          duration: MELT / 1000,
          ease: 'power3.out',
          onComplete: function () {
            var span = sweep(next, true);
            setTimeout(step, HOLD + span);
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
    var skills = hero.querySelector('.hero-skills');
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
    var BACK   = 0.34;  /* how lit a card is round the back of the drum       */
    var EDGEF  = 0.10;  /* fraction of each end spent fading in and out       */
    var TURN   = 40;    /* seconds for one unattended pass end to end         */
    var SCROLL = 0.30;  /* revolutions added by scrolling the hero away       */
    var GAIN   = 1.0;   /* how much of a drag carries into the spin           */
    var DECAY  = 0.04;  /* of the fling speed left after one second           */

    var LEN = 0, R = 0, LIFT = 0;

    var auto = 0, scrolled = 0, thrown = 0, vel = 0;
    var dragging = false, moved = 0, lastX = 0, lastT = 0;
    var ticking = false, active = false, pin = null;
    var lastBase = -1, lastFocus = -1;

    /* LEN is the length of the drum, a little wider than the frame so it
       reads as a cylinder carrying on past both edges rather than a row that
       stops. R is its radius, the same number vertically and in depth.

       The band is what R has to fit inside: under the header, over the line.
       Both edges are measured rather than assumed, so the tube follows them
       at any size instead of drifting under one or the other. Everything is
       worked in screen pixels, because that is where the constraint is — a
       card on the near side of the tube is magnified by the perspective, so
       the room it needs is its height once projected, not the height it has
       in the flow, which is what `near` is. */
    function measure() {
      var w = window.innerWidth;
      var h = stage.offsetHeight || window.innerHeight;
      var cw = cards[0].offsetWidth || 220;

      var sTop = stage.getBoundingClientRect().top;
      var head = document.querySelector('.site-head');
      var top  = (head ? head.offsetHeight : 0) + h * 0.02;
      var foot = skills
        ? (skills.getBoundingClientRect().top - sTop) - h * 0.035
        : h * 0.86;

      var band = Math.max(foot - top, h * 0.4);
      var cy = top + band / 2;        /* the axis, measured from the stage top */
      LIFT = h / 2 - cy;              /* and how far up the whole thing slides */

      /* Long enough that the ends sit well outside the frame, so the wrap
         happens off screen; the fade at each end covers what is left. */
      LEN = Math.max(w * 1.9, (w + cw) * 1.3);

      var PERSP = 1700;
      var near = PERSP / Math.max(PERSP - cw * 0.9, 1);
      var halfCard = cw * 0.66 * near * 0.5;

      R = Math.max(Math.min(w * 0.26, (band / 2 - halfCard) / near), cw * 0.45);

      /* look straight down the axis of the tube, not the middle of the
         stage — see the note at the top */
      stage.style.perspectiveOrigin = '50% ' + cy.toFixed(1) + 'px';
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

        var y = ca * R - LIFT;
        var z = sa * R;

        /* Two dimmers multiplied: depth as it swings round, and the ends of
           the tube so the wrap is never seen. Nothing has to be held down
           for the words any more — they are below the tube, not inside it. */
        var edge = Math.min(u, 1 - u) / EDGEF;
        var ends = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
        var depth = BACK + (1 - BACK) * ((sa + 1) / 2);

        var card = cards[i];
        var st = card.style;
        st.setProperty('--x',  x.toFixed(2) + 'px');
        st.setProperty('--y',  y.toFixed(2) + 'px');
        st.setProperty('--z',  z.toFixed(2) + 'px');
        st.setProperty('--ry', (ca * FACE).toFixed(2) + 'deg');
        st.setProperty('--rz', (sa * ROLL).toFixed(2) + 'deg');
        st.opacity = (depth * ends).toFixed(3);

        /* Round the back of the tube there is no room for the caption. */
        card.classList.toggle('is-far', sa < -0.4);

        var score = depth * ends;
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
      /* A pointer that has already been released — a synthetic event, or one
         the browser retired between the press and here — throws rather than
         being ignored, and it would take the rest of the handler with it. */
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
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
      if (stage.releasePointerCapture) {
        try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      /* A stale velocity from a drag that stopped before the finger lifted
         would launch the spiral off a still pointer. */
      if (e.timeStamp - lastT > 120) vel = 0;

      if (moved <= 8) open(e);
    }

    /* Opening a card has to be done by hand, for two reasons that each break
       the ordinary click on their own. The stage captures the pointer so it
       can keep following a drag that leaves it, and a captured pointer sends
       its click to the capture element — the stage — rather than to whatever
       is underneath. And the cards never stop moving, so even without the
       capture the press and the release land on different elements often
       enough that no click is generated at all. Both go away if a release
       inside the drag threshold follows the link under it itself. */
    function open(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var a = el && el.closest && el.closest('.spiral-card a[href]');
      if (!a) return;
      if (a.target === '_blank') window.open(a.href, '_blank', 'noopener');
      else window.location.href = a.href;
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
          /* Pins change the height of the document, so anything measured
             before one is applied is measured against a page that is about
             to move. Higher priority refreshes first, and the pins are
             numbered down the page so each one settles before whatever is
             below it is measured. Without this the veil over the timeline
             was keyed to where contact sat before two pins pushed it down,
             and washed the panel out while it was still being read. */
          refreshPriority: 3,
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
      stage.style.removeProperty('perspective-origin');
      if (skills) skills.style.cssText = '';

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

     The progression is a wristwatch, and it behaves like one.

     It is built on the way in, not on the way through: a line comes down out
     of the Timeline button — the control this section belongs to — and the
     watch draws itself from it as the section rises, strap and stitching and
     crown, then the case closing, the dial filling in and the numbers coming
     up. By the time the section takes the screen the whole watch is sitting
     there, leather and numbers and all, waiting to be read.

     Then it is pinned and the hand makes exactly one revolution, twelve back
     round to twelve, with the arc it has covered drawn in behind it. Nothing
     spirals into anything — the hand is where it says it is, which is the
     only reason a watch is worth using as the diagram.

     The years sit on the quarters, and each era owns the quarter that starts
     at its own marker: 2018 at twelve, 2022 at three, 2024 at six, 2025 at
     nine. The panel takes whichever side of the case the hand is on, so the
     eye follows the hand to the words rather than hunting for them.

     Twelve o'clock is the year it started and the moment it arrives at, both
     — so that marker carries two labels and cross-fades from 2018 to Now as
     the hand closes the circle. That is when the last turn opens: what I am
     doing now on one side, the three projects I keep coming back to on the
     other, and the school certificates winding around the watch itself.
     Then the pin lets go and the page carries on.

     The certificates run the hero's helix stood on its end — travelling down
     the axis of the strap while turning about it, so a chip passes in front
     of the case and then behind it. That only reads if they share one 3D
     context with the dial, which is why the perspective sits on the wrapper
     and why the fade is applied to each chip rather than to the list: any
     opacity between the two would flatten the subtree and every certificate
     would composite in front of the watch, or behind it, as one sheet.

     The viewBox is 1000 x 1400 and the element holds that ratio, so one unit
     is the same length on both axes and anything measured off the geometry
     maps into element coordinates with a single scale factor. The year
     labels and the certificates land exactly on the dial rather than near
     it.

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
    var sweep = orbit.querySelector('.path-sweep');
    var ticks = orbit.querySelector('.path-ticks');
    var hand  = orbit.querySelector('.path-hand');
    var hub   = orbit.querySelector('.path-hub');
    var mark  = orbit.querySelector('.path-mark');
    var feed  = orbit.querySelector('.path-feed');
    var feedPath = feed && feed.querySelector('path');
    var intro = orbit.querySelector('.path-intro');
    var dial  = orbit.querySelector('.path-dial');
    var years = [].slice.call(orbit.querySelectorAll('.path-dial li'));
    var eras  = [].slice.call(document.querySelectorAll('.era-scenes .era'));
    var picks = document.querySelector('.path-picks');
    var pile  = document.querySelector('.pile');
    var pileCards = pile ? [].slice.call(pile.querySelectorAll('.pcard')) : [];
    var origin = orbit.querySelector('.path-dial .is-origin');
    var now   = document.querySelector('.path-now');
    var certs = document.querySelector('.path-certs');
    var certItems = certs ? [].slice.call(certs.children) : [];

    /* the coil's turn: what the scroll set, what the ticker has added
       since, and how lit it is — declared here because a trigger can fire
       its first update while it is still being created */
    var certBase = 0, certDrift = 0, certLit = 0, spinning = false;
    var parts = [].slice.call(orbit.querySelectorAll('.watch-strap, .watch-crown, .watch-case'));
    var stitching = orbit.querySelector('.watch-stitching');
    if (!svg || !sweep || !eras.length) return;

    orbit.classList.add('is-live');

    /* The case, in viewBox units. Everything else is measured off these. */
    var CX = 500, CY = 700, R_CASE = 292, R_TRACK = 222;

    /* ---- the dial ------------------------------------------------------- */
    var TICKS = 60;
    var tickMarkup = '';
    for (var t = 0; t < TICKS; t++) {
      var a = (t / TICKS) * Math.PI * 2 - Math.PI / 2;
      var major = t % 5 === 0;
      var r1 = R_CASE - (major ? 26 : 14);
      tickMarkup += '<line class="path-tick' + (major ? ' is-major' : '') + '" ' +
        'x1="' + (CX + Math.cos(a) * r1).toFixed(1) + '" y1="' + (CY + Math.sin(a) * r1).toFixed(1) + '" ' +
        'x2="' + (CX + Math.cos(a) * R_CASE).toFixed(1) + '" y2="' + (CY + Math.sin(a) * R_CASE).toFixed(1) + '"/>';
    }
    ticks.innerHTML = tickMarkup;

    /* ---- the arc the hand covers ---------------------------------------- */
    var STEPS = 360, d = '';
    for (var i = 0; i <= STEPS; i++) {
      var ang = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
      d += (i ? ' L ' : 'M ') +
           (CX + Math.cos(ang) * R_TRACK).toFixed(2) + ' ' +
           (CY + Math.sin(ang) * R_TRACK).toFixed(2);
    }
    sweep.setAttribute('d', d);
    var L = sweep.getTotalLength();
    sweep.style.strokeDasharray = L;
    sweep.style.strokeDashoffset = L;

    /* ---- the parts that get drawn on -------------------------------------
       Strap, crown and case are all strokes, so each one can be walked on
       with a dashoffset. The stitching is left out of that: its dashes are
       its dasharray, and walking a path on needs the dasharray for the walk.
       It fades up once the strap it belongs to is closed instead. */
    var built = parts.map(function (el) {
      var len = el.getTotalLength ? el.getTotalLength() : 0;
      if (!len) return null;
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      if (el.classList.contains('watch-case')) el.style.fillOpacity = '0';
      return { el: el, len: len, hot: false };
    }).filter(Boolean);

    if (hand) hand.style.opacity = '0';
    if (hub) hub.style.opacity = '0';

    /* The note in the middle of the face is written by both triggers — it
       fades up as the watch is built and out again as the hand sets off —
       and they run in the same update. Whichever wrote last would win, and
       the build trigger sits at progress 1 for the whole of the sweep, so it
       kept putting the note back on top of the hand. Each one owns its own
       end of the fade instead, and the note is painted from both. */
    var introIn = 0, introOut = 0;

    function paintIntro() {
      if (!intro) return;
      var v = introIn * (1 - introOut);
      intro.style.opacity = v.toFixed(3);
      intro.style.transform = 'translate(-50%,-50%) scale(' + (1 - introOut * 0.12) + ')';
    }
    paintIntro();

    /* ---- the eras take the sides ----------------------------------------
       The side is the half of the dial the hand is in over that era's
       quarter: twelve to six is the right of the case, six back to twelve is
       the left. So the panel is always on the side the hand is pointing to. */
    eras.forEach(function (era, i) {
      era.classList.add('is-live-era');
      era.classList.add(i < eras.length / 2 ? 'side-right' : 'side-left');
      inner.appendChild(era);
    });
    if (now) inner.appendChild(now);
    if (picks) inner.appendChild(picks);
    if (certs) inner.appendChild(certs);
    if (pile) { inner.appendChild(pile); stackPile(); }

    /* ---- the pile -------------------------------------------------------
       One heap of photographs, top card live. Pull it off and let go and it
       drops to the bottom, so the pile cycles rather than emptying — which
       is the only behaviour that makes sense for something with no order to
       preserve and no end to reach.

       The order is the array, and the array is the z-index. Nothing reads
       the DOM back to work out what is on top. */
    function stackPile() {
      pileCards.forEach(function (el, i) {
        el.style.zIndex = String(pileCards.length - i);
        el.classList.toggle('is-top', i === 0);
        el.style.setProperty('--spin', (i === 0 ? 0 : (i % 2 ? 1 : -1) * (2 + i * 0.9)).toFixed(1) + 'deg');
        if (i !== 0) {
          el.style.setProperty('--dx', ((i % 2 ? 1 : -1) * i * 2).toFixed(1) + 'px');
          el.style.setProperty('--dy', (i * 2.5).toFixed(1) + 'px');
        } else {
          el.style.setProperty('--dx', '0px');
          el.style.setProperty('--dy', '0px');
        }
      });
    }

    function toBottom() {
      pileCards.push(pileCards.shift());
      stackPile();
    }

    if (pile) {
      var grab = null, gx = 0, gy = 0, went = 0;

      pile.addEventListener('pointerdown', function (e) {
        var top = pileCards[0];
        if (!top || e.button > 0) return;
        grab = top;
        gx = e.clientX; gy = e.clientY; went = 0;
        top.classList.remove('is-settling');
        pile.classList.add('is-dragging');
        if (pile.setPointerCapture) {
          try { pile.setPointerCapture(e.pointerId); } catch (err) {}
        }
      });

      pile.addEventListener('pointermove', function (e) {
        if (!grab) return;
        var dx = e.clientX - gx, dy = e.clientY - gy;
        went = Math.max(went, Math.abs(dx) + Math.abs(dy));
        if (went < 4) return;
        e.preventDefault();
        grab.style.setProperty('--dx', dx.toFixed(1) + 'px');
        grab.style.setProperty('--dy', dy.toFixed(1) + 'px');
        grab.style.setProperty('--spin', (dx * 0.03).toFixed(2) + 'deg');
      });

      function release(e) {
        if (!grab) return;
        var card = grab;
        grab = null;
        pile.classList.remove('is-dragging');
        if (pile.releasePointerCapture) {
          try { pile.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        /* A real pull sends it to the back; a nudge just settles again. The
           transition is added for the trip home and taken off afterwards, so
           the next grab is not fighting an easing. */
        card.classList.add('is-settling');
        if (went > 40) toBottom(); else stackPile();
        setTimeout(function () { card.classList.remove('is-settling'); }, 460);
      }
      pile.addEventListener('pointerup', release);
      pile.addEventListener('pointercancel', release);
      pile.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }

    /* The drawing is decorative and says so element by element. The eras,
       the Now card and the certificates are the real content and have just
       been moved in here, so the container itself must not be hidden. */
    orbit.removeAttribute('aria-hidden');

    /* Where things sit in the one revolution. Each era opens as the hand
       reaches its own marker on the quarter and holds most of the way to the
       next; the last one is cut short so the arrival back at twelve has room
       to itself. */
    var NOW = 0.88;                     /* the hand closes on twelve         */
    var OPEN = 0.06;                    /* the note in the middle clears     */
    var HOLD = 0.20;                    /* how long a panel stays up         */
    var quarter = 1 / Math.max(eras.length, 1);

    var unit = 1, ox = 0, oy = 0;

    function measure() {
      var sb = svg.getBoundingClientRect();
      var ob = orbit.getBoundingClientRect();
      if (!sb.width) return;
      unit = sb.width / 1000;
      ox = sb.left - ob.left;
      oy = sb.top - ob.top;

      years.forEach(function (el, i) {
        var a = (i / years.length) * Math.PI * 2 - Math.PI / 2;
        var r = (R_CASE - 54) * unit;
        el.style.left = (ox + CX * unit + Math.cos(a) * r) + 'px';
        el.style.top  = (oy + CY * unit + Math.sin(a) * r) + 'px';
      });

      if (intro) {
        intro.style.left = (ox + CX * unit) + 'px';
        intro.style.top  = (oy + CY * unit) + 'px';
      }

      layoutNow();

      drawFeed();
    }

    /* What Now looks like once the hand is home: the card on one side, the
       certificates coiling down the other, the current work thrown out
       around the case in the middle.

       All three are laid out from one budget, because at the narrower end
       of the range there is not enough width for three columns and a ring —
       and guessing that there is puts chips through the card on one side
       and through the certificates on the other. So the card and the column
       are placed first, their real edges are measured, and the ring is only
       ever as wide as the gap they leave. If the gap is not worth having,
       the certificates stay in the flow below and the ring gets the room. */
    /* The helix the certificates ride: down the axis of the strap while
       turning about it. Radius is held near the case so the column stays
       between the two side panels, and the travel is a little longer than
       the case is tall so the ends are off the face when they wrap. */
    var CERT_TURNS = 2;     /* whole turns, so the wrap is invisible      */
    var certLen = 0, certR = 0;

    function layoutNow() {
      var sb = svg.getBoundingClientRect();
      certR = Math.max(R_CASE * unit * 0.92, 90);
      certLen = Math.max(sb.height * 0.72, R_CASE * unit * 3);
    }

    function wrap01(v) { v %= 1; return v < 0 ? v + 1 : v; }

    /* Where each certificate is, for a given turn of the coil. Travel and
       spin come off the one parameter, which is what makes it a helix rather
       than a ring that happens to slide. */
    function windCerts(base, lit) {
      var N = certItems.length;
      if (!N) return;
      for (var i = 0; i < N; i++) {
        var u = wrap01(base + i / N);
        var y = (u - 0.5) * certLen;
        var a = (u * CERT_TURNS + i / N) * Math.PI * 2;
        var ca = Math.cos(a), sa = Math.sin(a);

        var el = certItems[i];
        el.style.setProperty('--x', (ca * certR).toFixed(1) + 'px');
        el.style.setProperty('--y', y.toFixed(1) + 'px');
        el.style.setProperty('--z', (sa * certR).toFixed(1) + 'px');
        /* turned to face the axis, so it lies on the surface of the coil */
        el.style.setProperty('--rx', (-Math.cos(a) * 8).toFixed(1) + 'deg');

        /* dimmer round the back, and both ends of the travel faded so the
           wrap is never seen */
        var edge = Math.min(u, 1 - u) / 0.16;
        var ends = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
        var depth = 0.34 + 0.66 * ((sa + 1) / 2);
        el.style.opacity = (lit * depth * ends).toFixed(3);
        el.style.pointerEvents = lit * depth * ends > 0.5 ? 'auto' : 'none';
      }
    }

    /* The line down out of the Timeline button, into the top of the strap. */
    function drawFeed() {
      if (!feedPath) return;
      var btn = document.querySelector('.nav a[href="#path"]');
      var ob = orbit.getBoundingClientRect();
      if (!btn) { feedPath.removeAttribute('d'); return; }
      var b = btn.getBoundingClientRect();
      var sx = b.left + b.width / 2 - ob.left;
      var sy = b.bottom - ob.top;
      var ex = ox + CX * unit;
      var ey = oy + 6 * unit;
      feedPath.setAttribute('d',
        'M ' + sx + ' ' + sy +
        ' C ' + sx + ' ' + (sy + (ey - sy) * 0.6) +
        ', ' + ex + ' ' + (sy + (ey - sy) * 0.4) +
        ', ' + ex + ' ' + ey);
      var fl = feedPath.getTotalLength();
      feedPath.style.strokeDasharray = fl;
      feedPath.style.strokeDashoffset = fl;
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function ramp(v, a, b) { return clamp01((v - a) / (b - a)); }

    measure();

    /* ---- 1. the build, on the way in -------------------------------------
       This one is not pinned. It runs over the approach — from the moment
       the section's top enters the bottom of the screen to the moment it
       reaches the top — so the watch is finished and readable before the
       part where scrolling drives the hand. */
    ScrollTrigger.create({
      trigger: orbit,
      start: 'top bottom',
      end: 'top top',
      scrub: 0.5,
      invalidateOnRefresh: true,
      onRefresh: measure,
      onUpdate: function (self) {
        var p = self.progress;

        /* the feed comes down out of the button, and goes once it has fed */
        if (feedPath) {
          var fl = feedPath.getTotalLength();
          feedPath.style.strokeDashoffset = fl * (1 - ramp(p, 0, 0.30));
          feedPath.style.opacity = String(0.85 * (1 - ramp(p, 0.62, 0.86)));
        }

        /* then the watch draws itself, part after part */
        var bp = ramp(p, 0.18, 0.80);
        built.forEach(function (part, i) {
          var slice = 1 / built.length;
          var k = clamp01((bp - i * slice * 0.72) / slice);
          part.el.style.strokeDashoffset = part.len * (1 - k);
          if (part.el.classList.contains('watch-case')) part.el.style.fillOpacity = String(k);
          /* lit while it is being drawn, and cooling to its own colour once
             it lands — the shimmer is the line arriving, not a loop */
          var hot = k > 0.001 && k < 0.999;
          if (hot !== part.hot) {
            part.hot = hot;
            if (hot) part.el.style.stroke = 'var(--glow)';
            else part.el.style.removeProperty('stroke');
          }
        });

        if (stitching) stitching.style.opacity = String(ramp(p, 0.34, 0.56));
        ticks.style.opacity = String(ramp(p, 0.68, 0.86));
        if (dial) dial.style.opacity = String(ramp(p, 0.76, 0.94));
        if (hand) hand.style.opacity = String(ramp(p, 0.84, 0.98) * 0.9);
        if (hub) hub.style.opacity = String(ramp(p, 0.84, 0.98));
        introIn = ramp(p, 0.88, 1);
        paintIntro();
      }
    });

    /* ---- 2. the revolution, while pinned --------------------------------- */
    ScrollTrigger.create({
      trigger: orbit,
      start: 'top top',
      end: '+=520%',
      pin: true,
      pinSpacing: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      refreshPriority: 2,
      onRefresh: measure,
      onUpdate: function (self) {
        var p = self.progress;

        /* the note in the middle of the face clears as the hand sets off */
        introOut = ramp(p, 0, OPEN);
        paintIntro();

        /* one revolution, twelve back round to twelve */
        var deg = p * 360;
        if (hand) hand.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' ' + CX + ' ' + CY + ')');
        sweep.style.strokeDashoffset = L * (1 - p);

        var a = deg * Math.PI / 180 - Math.PI / 2;
        mark.style.transform = 'translate(' +
          (ox + (CX + Math.cos(a) * R_TRACK) * unit) + 'px,' +
          (oy + (CY + Math.sin(a) * R_TRACK) * unit) + 'px)';
        mark.style.opacity = p > 0.005 && p < 0.995 ? '1' : '0';

        /* a year lights as the hand reaches its marker */
        years.forEach(function (el, i) {
          el.classList.toggle('is-now', p >= i / years.length - 0.01);
        });

        /* each era opens on its own marker and holds the side the hand is
           on, and all of them are out of the way by the time Now arrives */
        var b = ramp(p, NOW, 1);
        eras.forEach(function (era, i) {
          var a0 = i === 0 ? OPEN : i * quarter;
          /* the last one is clipped so it is gone before Now opens */
          var hold = i === eras.length - 1 ? Math.max(NOW - a0, 0.08) : HOLD;
          var local = (p - a0) / hold;
          var vis;
          if (local < 0 || local > 1) vis = 0;
          else if (local < 0.16) vis = local / 0.16;
          else if (local > 0.84) vis = (1 - local) / 0.16;
          else vis = 1;
          vis = clamp01(vis) * (1 - b);
          var dir = era.classList.contains('side-left') ? -1 : 1;
          era.style.opacity = vis.toFixed(3);
          era.style.transform =
            'translateY(-50%) translateX(' + (dir * (1 - vis) * 70).toFixed(1) + 'px)';

          /* the photographs belong to one year, so they come and go with it,
             on the opposite side of the case to the panel */
          if (pile && era === eras[eras.length - 1]) {
            pile.style.opacity = vis.toFixed(3);
            pile.style.transform =
              'translateY(-50%) translateX(' + ((1 - vis) * 70).toFixed(1) + 'px)';
            pile.style.pointerEvents = vis > 0.9 ? 'auto' : 'none';
          }
        });

        /* twelve is both ends of the line, so the marker changes what it
           says as the hand closes on it */
        if (origin) origin.classList.toggle('is-arrived', p > NOW - 0.04);
        if (dial) dial.classList.toggle('is-arrived', p > NOW - 0.02);

        /* and the last turn opens: what I am doing now on one side, the
           three I keep coming back to on the other, and the certificates
           winding round the watch between them */
        if (now) {
          var nv = ramp(p, NOW + 0.01, NOW + 0.07);
          now.style.opacity = nv.toFixed(3);
          now.style.transform = 'translateY(-50%) translateX(' + (-(1 - nv) * 60).toFixed(1) + 'px)';
          now.style.pointerEvents = nv > 0.9 ? 'auto' : 'none';
        }

        if (picks) {
          var pv = ramp(p, NOW + 0.03, NOW + 0.09);
          picks.style.opacity = pv.toFixed(3);
          picks.style.transform = 'translateY(-50%) translateX(' + ((1 - pv) * 60).toFixed(1) + 'px)';
          picks.style.pointerEvents = pv > 0.9 ? 'auto' : 'none';
        }

        /* The coil turns with the scroll and keeps turning on its own, so
           it is alive while you read it. drift is added by the ticker. */
        certLit = ramp(p, NOW + 0.02, NOW + 0.10);
        certBase = (p - NOW) * 0.9;
        windCerts(certBase + certDrift, certLit);
      }
    });

    /* The coil keeps turning after the scroll stops. Only while it is worth
       looking at — there is no reason to run a ticker for something faded
       out — and only ever adding to what the scroll already set. */
    function spin(time, deltaMs) {
      if (certLit < 0.01) { stopSpin(); return; }
      certDrift += Math.min(deltaMs, 50) / 1000 / 26;
      windCerts(certBase + certDrift, certLit);
    }
    function startSpin() { if (!spinning) { spinning = true; gsap.ticker.add(spin); } }
    function stopSpin()  { if (spinning) { spinning = false; gsap.ticker.remove(spin); } }

    ScrollTrigger.create({
      trigger: orbit,
      start: 'top top',
      end: '+=520%',
      onToggle: function (self) { self.isActive ? startSpin() : stopSpin(); }
    });

    /* A certificate opens on release rather than on click, for the same
       reason a project card does: the chip is moving, so the press and the
       release often land on different elements and no click is generated at
       all. Following the link under the release is the whole fix. */
    if (certs) {
      certs.addEventListener('pointerup', function (e) {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var a = el && el.closest && el.closest('.path-certs a[href]');
        if (a) window.open(a.href, '_blank', 'noopener');
      });
    }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(measure, 180);
    });
  })();

  /* ---------------------------------------------------------- Panel veils

     A slab carrying a veil gets washed in flat colour as the next section
     climbs over it — the same handoff the hero makes, and flat colour for
     the same reason: opacity on an ancestor would flatten the 3D or the
     pinned scene underneath it. The colour is per panel so no two of these
     read as the same move played twice.

     It is keyed to the panel's own bottom edge travelling up the screen,
     not to the next section arriving. Those are the same thing for a tall
     pinned panel and nothing like it for a short one: the next section's top
     crosses the bottom of the viewport while a short panel is still coming
     into view, so a wash keyed that way was full before the panel had been
     read. Its own bottom edge is exactly the moment something is climbing
     over it, at any height, pinned or not. */

  (function () {
    if (reduced || !hasGsap) return;

    document.querySelectorAll('.panel-veil').forEach(function (veil) {
      var panel = veil.closest('section');
      if (!panel) return;

      gsap.fromTo(veil, { opacity: 0 }, {
        opacity: 0.88,
        ease: 'none',
        scrollTrigger: {
          trigger: panel,
          start: 'bottom bottom',
          end: 'bottom 35%',
          scrub: 0.5,
          invalidateOnRefresh: true
        }
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
