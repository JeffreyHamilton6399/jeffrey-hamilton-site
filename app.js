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
  /* First, before anything is measured or decided: the head marked the
     document while the opening was still unarranged. Everything below runs
     in this one task, so nothing is painted between here and the boot
     putting the line back where it belongs. */
  document.documentElement.classList.remove('pre');

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
    var portrait = center.querySelector('.boot-face');
    var line   = document.querySelector('.hero-skills');
    var skills = document.querySelector('.skills-type');
    var out    = document.querySelector('.type-out');
    var face   = document.querySelector('.mark-face');
    var dot    = document.querySelector('.boot-dot');
    var nav    = document.querySelector('.nav');
    var social = document.querySelector('.head-social');
    /* One list per side of the page. The markup carries the work side's
       first word; a visit that opens on the fun side starts on its own. */
    var lists = { pro: [], fun: [] };
    try {
      lists.pro = JSON.parse(skills && skills.getAttribute('data-skills') || '[]');
      lists.fun = JSON.parse(skills && skills.getAttribute('data-skills-fun') || '[]');
    } catch (e) {}
    function sideList() {
      return doc.getAttribute('data-side') === 'fun' && lists.fun.length ? lists.fun : lists.pro;
    }
    var list = sideList();
    if (out && list.length) out.textContent = list[0];

    /* The toggle (fun.js) announces a switch. Before the cycle has started —
       during the boot, or for good with reduced motion — the word is simply
       swapped. Once it is running, whatever is coming in or being held is
       cut short: the word is taken down straight away and the new list's
       first word built in its place. gen retires the old chain so it does
       not carry on alongside the new one. */
    var started = false, gen = 0, timer = 0;
    document.addEventListener('sidechange', function () {
      list = sideList();
      if (!list.length || !out) return;
      if (!started) { out.textContent = list[0]; wi = 0; return; }
      gen++;
      clearTimeout(timer);
      wi = -1;
      leave(gen);
    });

    if (reduced || !list.length || !portrait || !face || !line) return;

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

    var HOLD_FACE = 1250;    /* how long the face has the screen to itself */
    var DIP       = 420;     /* it tenses, gathering light, before it goes */
    var MORPH     = 560;     /* then spirals in on itself and becomes the dot */
    var FLIGHT    = 1450;    /* and the dots ride the lines out (about)    */
    var DOT       = 14;      /* .boot-dot's size: what the face shrinks to */

    requestAnimationFrame(function () {
      /* On a phone the hero is a plain column and the face would sit up in
         its top quarter over an empty sheet. It is carried down to the
         middle of the screen, where the spiral puts it on a wide one — and
         since everything after measures where it is actually drawn, the dot
         still pops out of the spot it vanished into. */
      if (hasGsap) {
        var r = portrait.getBoundingClientRect();
        var dy = innerHeight / 2 - (r.top + r.height / 2);
        if (r.height && dy > 24 && r.top >= 0) gsap.set(portrait, { y: dy });
      }
      setTimeout(function () { center.classList.add('boot-in'); }, 420);
      setTimeout(dip, HOLD_FACE);
    });

    /* A beat of gathering before the launch: the face draws in slightly while
       a ring of the dot's gold charges up around it, so the light it is about
       to become is already there. */
    function dip() {
      if (!hasGsap) { fly(); return; }
      gsap.to(portrait, {
        scale: 0.93,
        '--charge': 1,
        duration: DIP / 1000,
        ease: 'power2.inOut',
        onComplete: morph
      });
    }

    /* The face becomes the dot. It spirals in on its own centre, speeding up
       as it goes, shrinking to exactly the dot's size and turning to the
       dot's gold on the way — so at the last frame it already is the dot, and
       the dot that takes its place pops out of the very spot it vanished
       into. That one point holds for a beat before the other two split out
       of it and all three leave; without the beat there is nothing to split
       from, and it reads as three separate things that happened to start
       together. */
    var SPLIT = 300;

    function morph() {
      if (!hasGsap) { fly(); return; }

      var stage = document.querySelector('.hero-stage');
      var t = portrait.getBoundingClientRect();
      var box = stage && stage.getBoundingClientRect();
      /* the unscaled width: the dip has already drawn it in */
      var full = portrait.offsetWidth || t.width || 1;

      gsap.to(portrait, {
        scale: DOT / full,
        rotation: 200,
        '--gold': 1,
        duration: MORPH / 1000,
        ease: 'power3.in',
        onComplete: function () {
          portrait.style.opacity = '0';
          if (dot && box) {
            dot.style.transform = 'translate(' + (t.left + t.width / 2 - box.left) + 'px,' +
                                                 (t.top + t.height / 2 - box.top) + 'px)';
            dot.style.opacity = '1';
            /* the pop: the separate scale property, so it never fights the
               translate the flight writes into transform */
            if (typeof dot.animate === 'function') {
              dot.animate([{ scale: '2.4' }, { scale: '1' }],
                { duration: 280, easing: 'cubic-bezier(.34, 1.8, .6, 1)' });
            }
          }
          setTimeout(fly, SPLIT);
        }
      });
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
      var t = portrait.getBoundingClientRect();
      var box = stage && stage.getBoundingClientRect();
      if (!t.width || !box) { arrive(); openNav(); openSocial(); land(); return; }

      portrait.style.transition = 'none';
      portrait.style.opacity = '0';

      var x0 = t.left + t.width / 2 - box.left;
      var y0 = t.top + t.height / 2 - box.top;

      /* Where the three points are headed and what each one sets off. Which
         of them leaves first is shuffled every visit, like the routes. */
      var holds = [0, 150, 300].sort(function () { return Math.random() - 0.5; });
      var legs = [
        { el: face,           after: arrive,     hold: holds[0] },
        { el: navTarget(),    after: openNav,    hold: holds[1] },
        { el: socialTarget(), after: openSocial, hold: holds[2] }
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

        /* The route is drawn fresh every visit. It is a cubic from the dot to
           the target whose two handles are thrown out to either side of the
           straight line by a random amount (and kept on the screen), with a
           spiral wound onto it whose direction, turns, size and squash are
           all drawn fresh too, and a hand's wobble on top — so no two openings
           take the same lines. The spiral opens from nothing at the dot and
           closes back to nothing at the target, so however the line wanders,
           every leg still comes out of the one dot and lands on its mark. */
        var rnd = function (lo, hi) { return lo + Math.random() * (hi - lo); };
        var EDGE = 24;
        var clampX = function (v) { return Math.max(EDGE, Math.min(box.width - EDGE, v)); };
        var clampY = function (v) { return Math.max(EDGE, Math.min(box.height - EDGE, v)); };

        var nx = -(y1 - y0) / len, ny = (x1 - x0) / len;   /* across the line */
        var s1 = rnd(-0.7, 0.7), s2 = rnd(-0.7, 0.7);
        var u1 = rnd(0.15, 0.45), u2 = rnd(0.55, 0.85);
        var c1x = clampX(x0 + (x1 - x0) * u1 + nx * len * s1);
        var c1y = clampY(y0 + (y1 - y0) * u1 + ny * len * s1);
        var c2x = clampX(x0 + (x1 - x0) * u2 + nx * len * s2);
        var c2y = clampY(y0 + (y1 - y0) * u2 + ny * len * s2);

        var spin = Math.random() < 0.5 ? -1 : 1;
        var TURNSP = rnd(1.1, 3.4);
        var R0 = Math.max(18, Math.min(len * rnd(0.08, 0.24), 110));
        var squash = rnd(0.55, 0.95);
        var ph0 = Math.random() * 6.28;
        var ph1 = Math.random() * 6.28, ph2 = Math.random() * 6.28;
        var amp = Math.min(len * rnd(0.006, 0.02), 10);
        var flight = FLIGHT * rnd(0.9, 1.12);

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.appendChild(path);

        var d = '', STEPS = 220;
        for (var k = 0; k <= STEPS; k++) {
          var tt = k / STEPS, qq = 1 - tt;

          /* the carrying curve */
          var bx = qq * qq * qq * x0 + 3 * qq * qq * tt * c1x + 3 * qq * tt * tt * c2x + tt * tt * tt * x1;
          var by = qq * qq * qq * y0 + 3 * qq * qq * tt * c1y + 3 * qq * tt * tt * c2y + tt * tt * tt * y1;

          /* the spiral wound onto it, pinned to nothing at both ends */
          var a = ph0 + tt * TURNSP * Math.PI * 2 * spin;
          var open = Math.min(tt / 0.14, 1);
          var rad = R0 * Math.pow(1 - tt, 1.5) * (open * open * (3 - 2 * open));
          bx += Math.cos(a) * rad;
          by += Math.sin(a) * rad * squash;

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
          duration: flight / 1000,
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

    /* ---- the word -------------------------------------------------------

       Each word is built up and taken down a letter at a time. Coming in,
       the letters rise into place as outlines, left to right, and then fill
       the same way, so partway through the word is solid at its start and
       still hollow at its end. Going out is the same move run backwards: the
       fill drains from the last letter back to the first, then the hollow
       letters drop away in that order, while the box eases to the next
       word's width. One word is never on top of another. */

    var HOLD = 2200;       /* a word stays up this long, filled                */
    var RISE_MS = 34;      /* between letters rising in as outlines            */
    var FILL_MS = 46;      /* between letters filling                          */
    var DRAIN_MS = 28;     /* between letters emptying, last letter first      */
    var DROP_MS = 24;      /* between hollow letters dropping away             */
    var LETTER_MS = 380;   /* one letter's own change (styles.css, .ch)        */
    var WIDTH_MS = 460;    /* the box easing to the next word (.skills-type)   */
    var wi = 0;

    function measureWidth(el) {
      return Math.ceil(el.getBoundingClientRect().width);
    }

    /* every step is scheduled through here, so a switch retiring gen stops a
       chain wherever it has got to */
    function later(fn, ms, g) {
      timer = setTimeout(function () { if (g === gen) fn(); }, ms);
    }

    /* The word keeps the face it was built in until the next one starts: a
       switch takes the old word down in its own face, and the new side's
       face arrives with the new word (styles.css). */
    function wear() {
      skills.setAttribute('data-face', doc.getAttribute('data-side') === 'fun' ? 'fun' : 'pro');
    }

    function letters() {
      return [].slice.call(out.querySelectorAll('.ch'));
    }

    /* Spaces are letters too, so the rhythm of a run follows the word. */
    function build(word) {
      out.textContent = '';
      for (var i = 0; i < word.length; i++) {
        var ch = document.createElement('span');
        ch.className = word[i] === ' ' ? 'ch is-space' : 'ch';
        ch.textContent = word[i] === ' ' ? ' ' : word[i];
        out.appendChild(ch);
      }
    }

    /* Toggle a class across the letters one after another, from the first or
       from the last. Returns how long until the last letter has finished. */
    function run(ls, cls, on, gap, fromEnd, g) {
      var n = ls.length;
      for (var i = 0; i < n; i++) {
        (function (el, k) {
          setTimeout(function () { if (g === gen) el.classList.toggle(cls, on); }, k * gap);
        })(ls[fromEnd ? n - 1 - i : i], i);
      }
      return Math.max(n - 1, 0) * gap + LETTER_MS;
    }

    function enter(word, g) {
      wear();
      build(word);
      skills.style.width = measureWidth(out) + 'px';
      var ls = letters();
      /* the letters start up as the box is part way to its new width */
      later(function () {
        var rise = run(ls, 'is-in', true, RISE_MS, false, g);
        later(function () {
          var fill = run(ls, 'is-fill', true, FILL_MS, false, g);
          later(function () { leave(g); }, fill + HOLD, g);
        }, rise * 0.6, g);
      }, WIDTH_MS * 0.4, g);
    }

    function leave(g) {
      var ls = letters();
      var drain = run(ls, 'is-fill', false, DRAIN_MS, true, g);
      later(function () {
        var drop = run(ls, 'is-in', false, DROP_MS, true, g);
        later(function () {
          wi = (wi + 1) % list.length;
          enter(list[wi], g);
        }, drop, g);
      }, drain * 0.55, g);
    }

    function cycle() {
      started = true;
      /* the markup's flat word becomes letters that are already in and
         filled — the classes go on before anything is painted, so nothing
         animates on the way */
      wear();
      build(out.textContent);
      letters().forEach(function (el) { el.classList.add('is-in', 'is-fill'); });
      skills.style.width = measureWidth(out) + 'px';
      later(function () { leave(gen); }, HOLD, gen);
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

    var auto = 0, scrolled = 0, thrown = 0, vel = 0, boost = 0;
    var dragging = false, moved = 0, lastX = 0, lastT = 0;
    var ticking = false, active = false, pin = null;
    var lastBase = -1, lastFocus = -1;

    /* The fun side (fun.js) has fewer cards than the work side. A card marked
       .fun-skip has no second face, so on that side it fades out and the
       others close up round the tube to take its room. slot is where each
       card sits along the tube, 0…1, and shown is how much of it is there.
       A switch tweens both rather than setting them, so the tube re-spaces
       itself instead of jumping. */
    var RESPACE_S = 1.1;      /* how long a switch takes to re-space the tube   */
    var BOOST_MIN = 0.06;     /* the least a switch pushes the tube forward      */
    var BOOST_MARGIN = 0.04;  /* forward travel left to the card that goes back
                                 furthest, so even it is visibly moving on     */
    var slots = cards.map(function (c, i) { return i / N; });
    var shown = cards.map(function () { return 1; });
    var respace = null;

    function spacing() {
      var fun = doc.getAttribute('data-side') === 'fun';
      var live = cards.filter(function (c) { return !(fun && c.classList.contains('fun-skip')); });
      return cards.map(function (c) {
        var r = live.indexOf(c);
        /* a card that is going keeps its place; nobody sees it there */
        return r < 0 ? { slot: null, shown: 0 } : { slot: r / live.length, shown: 1 };
      });
    }

    function place(animate) {
      var to = spacing();
      respace = null;
      if (!animate) {
        to.forEach(function (t, i) { if (t.slot !== null) slots[i] = t.slot; shown[i] = t.shown; });
        lastBase = -1;
        return;
      }

      /* The tube only ever turns one way, and a switch must not be the one
         time it doesn't. Closing up means some cards' slots move back along
         the tube, so the whole tube is pushed forward at the same time, by
         more than the furthest any card has to go back: every card then
         travels forward the whole way, the ones going furthest back the
         least. Both share the one ease, so no card is ever going backwards
         at any moment along the way, not just by the end of it. */
      var s0 = slots.slice();
      var back = 0;
      to.forEach(function (t, i) { if (t.slot !== null) back = Math.max(back, s0[i] - t.slot); });

      /* Driven by the tube's own ticker (tick), not a tween. A tween runs on
         GSAP's clock, which this page tells not to smooth over lag, so a
         switch that landed on a slow frame — the first one fetches and draws
         a good deal — jumped straight to the end of the re-spacing and the
         cards leapt. The ticker already caps how far a single frame can move
         anything, so a slow frame now only makes for a slower shove. */
      respace = {
        s0: s0,
        v0: shown.slice(),
        b0: boost,
        push: Math.max(BOOST_MIN, back + BOOST_MARGIN),
        to: to,
        t: 0
      };
      /* with the hero off screen nobody sees it happen: arrive at once */
      if (!ticking) stepRespace(RESPACE_S);
    }

    function stepRespace(dt) {
      var r = respace;
      if (!r) return;
      r.t = Math.min(1, r.t + dt / RESPACE_S);
      var e = 1 - Math.pow(1 - r.t, 3);   /* quick off the mark, easing out: a shove */
      var f = Math.min(1, e * 1.8);       /* the leaving cards go well before the rest close up */
      r.to.forEach(function (t, i) {
        if (t.slot !== null) slots[i] = r.s0[i] + (t.slot - r.s0[i]) * e;
        shown[i] = r.v0[i] + (t.shown - r.v0[i]) * f;
      });
      boost = r.b0 + r.push * e;
      lastBase = -1;
      if (r.t >= 1) respace = null;
    }
    place(false);
    document.addEventListener('sidechange', function () { place(!reduced && hasGsap); });

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
      var base = wrap01(auto + scrolled + thrown + boost);
      if (base === lastBase) return;              /* nothing moved this frame */
      lastBase = base;

      var focus = 0, best = -Infinity;

      for (var i = 0; i < N; i++) {
        /* Where it is along the tube, and — from the same number — where it
           is around it. Travel and spin off one parameter is what makes it a
           helix rather than a ring that happens to slide. */
        var u = wrap01(base + slots[i]);
        var x = (u - 0.5) * LEN;

        var ang = (u * TURNS + slots[i]) * Math.PI * 2;
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
        st.opacity = (depth * ends * shown[i]).toFixed(3);

        /* Round the back of the tube there is no room for the caption. */
        card.classList.toggle('is-far', sa < -0.4);

        var score = depth * ends * shown[i];
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
      stepRespace(dt);
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
      /* On the fun side a card is a chapter of the story rather than a
         project, so it takes you down to the story instead of out — unless
         its fun face has a place of its own, which fun.js has put in href. */
      if (doc.getAttribute('data-side') === 'fun' && !a.hasAttribute('data-fun-href')) {
        var story = document.getElementById('path');
        if (story && lenis) lenis.scrollTo(story, { offset: -60, duration: 1.2 });
        else if (story) story.scrollIntoView();
        return;
      }
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
          onUpdate: function (self) {
            scrolled = self.progress * SCROLL;
            rideTheBevel();
          }
        }
      });
      tl.to(inner, { scale: 0.9, ease: 'none' }, 0);
      /* The strap begins here, as a tab above the fold.

         It rides the top edge of the panel that climbs over the hero rather
         than staying where it was drawn. The hero is pinned, so a tab left at
         a fixed height simply got covered as that edge went past it, and from
         then on the leather at the top of the timeline had nothing visibly
         feeding it: it looked like a piece that started there. Tracking the
         edge, the tip is always just above the bevel, entering it, and the
         leather below the bevel is obviously the same strap. */
      var strap = hero.querySelector('.hero-strap');
      var next = hero.nextElementSibling;
      if (strap) {
        /* the tab is the strap, so it is the strap's width — worked out the
           same way rather than guessed at in a clamp */
        var sh = Math.min(window.innerHeight * 0.99, 48 * 16);
        strap.style.setProperty('--tab-w', (123 * (sh * 1000 / 1400) / 1000).toFixed(1) + 'px');
      }

      function rideTheBevel() {
        if (!strap || !next) return;
        var stageTop = stage.getBoundingClientRect().top;
        var edge = next.getBoundingClientRect().top - stageTop;
        strap.style.top = (edge - 48) + 'px';
      }
      rideTheBevel();
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

     It is built on the way in, not on the way through: the tab of leather
     showing at the foot of the hero gets longer as that screen is scrolled
     away, and the watch draws itself onto the end of it as this section
     rises — strap and stitching and crown, then the case closing, the dial
     filling in and the numbers coming up. By the time the section takes the
     screen the whole watch is sitting there, leather and numbers and all,
     waiting to be read.

     Then it is pinned and the hand makes exactly one revolution, twelve back
     round to twelve, with the arc it has covered drawn in behind it. Nothing
     spirals into anything — the hand is where it says it is, which is the
     only reason a watch is worth using as the diagram.

     The years sit on the quarters, and each era owns the quarter that starts
     at its own marker: 2018 at twelve, 2023 at three, 2024 at six, 2025 at
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

  /* Below the width the scene needs, the watch is still drawn: complete,
     still, and sitting at the head of the section as the thing the section
     is about. Losing the whole motif on a phone would leave the timeline as
     four articles in a column with nothing tying them to the rest of the
     page, and the drawing is the tie.

     Only the parts that do not depend on being pinned: strap, case, ticks,
     hands at twelve. No sweep, no eras on the sides, no coil. */
  function drawStillWatch(orbit) {
    var svg = orbit.querySelector('.path-svg');
    var ticks = orbit.querySelector('.path-ticks');
    if (!svg || !ticks) return;

    orbit.classList.add('is-still');

    var CX = 500, CY = 700, R = 292, N = 60, out = '';
    for (var t = 0; t < N; t++) {
      var a = (t / N) * Math.PI * 2 - Math.PI / 2;
      var major = t % 5 === 0;
      var r1 = R - (major ? 26 : 14);
      out += '<line class="path-tick' + (major ? ' is-major' : '') + '" ' +
        'x1="' + (CX + Math.cos(a) * r1).toFixed(1) + '" y1="' + (CY + Math.sin(a) * r1).toFixed(1) + '" ' +
        'x2="' + (CX + Math.cos(a) * R).toFixed(1) + '" y2="' + (CY + Math.sin(a) * R).toFixed(1) + '"/>';
    }
    ticks.innerHTML = out;

    var knurl = orbit.querySelector('.watch-knurl');
    if (knurl) {
      var k = '';
      for (var i = 0; i < 16; i++) {
        var y = 678 + (i / 16) * 44;
        k += '<line x1="792" y1="' + y.toFixed(1) + '" x2="828" y2="' + y.toFixed(1) + '"/>';
      }
      knurl.innerHTML = k;
    }
  }

  (function () {
    var orbit = document.querySelector('.path-orbit');
    if (!orbit || reduced || !hasGsap) return;
    if (window.innerWidth < 1000) { drawStillWatch(orbit); return; }

    var inner = orbit.querySelector('.path-orbit-in');
    var svg   = orbit.querySelector('.path-svg');
    var knurl = orbit.querySelector('.watch-knurl');
    var ticks = orbit.querySelector('.path-ticks');
    var face  = orbit.querySelector('.watch-face');
    var hand  = orbit.querySelector('.path-hand');
    var hub   = orbit.querySelector('.path-hub');
    var mark  = orbit.querySelector('.path-mark');
    var year  = orbit.querySelector('.path-year');
    var yearOut = year && year.querySelector('.py-now');
    var hand2 = orbit.querySelector('.path-hand-sm');
    var core  = orbit.querySelector('.watch-core');
    var lead = orbit.querySelector('.path-lead');
    var straps = [].slice.call(orbit.querySelectorAll('.watch-strap'));
    var stitchRuns = [].slice.call(orbit.querySelectorAll('.watch-stitch'));
    var dialBits = [].slice.call(orbit.querySelectorAll(
      '.watch-core, .watch-crown, .watch-knurl, .watch-crown-ink'));
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

    /* how far the coil has turned, and how lit it is — declared here
       because a trigger can fire its first update while it is still being
       created */
    var certDrift = 0, certLit = 0, certPull = 0, spinning = false;
    /* the certificates are the work side's; on the fun side the coil fades
       out, and back in on the way home (see the sidechange listener) */
    var certShow = { v: doc.getAttribute('data-side') === 'fun' ? 0 : 1 };
    var parts = [].slice.call(orbit.querySelectorAll('.watch-crown, .watch-case'));
    var stitching = orbit.querySelector('.watch-stitching');
    if (!svg || !eras.length) return;

    orbit.classList.add('is-live');
    var section = orbit.closest('section');
    if (section) section.classList.add('is-watch');

    /* The case, in viewBox units. Everything else is measured off these. */
    var CX = 500, CY = 700, R_CASE = 292, R_TRACK = 222;
    var STRAP_TOP = 930;   /* where the lower strap meets the case */
    /* The strap path is 120 units across and its edge is stroked at 3, and an
       SVG stroke straddles the line it is on. So the leather is 123 units
       wide, not 120, and anything continuing it in HTML has to be told that
       or it arrives a pixel and a half narrow on each side. */
    var STRAP_W = 123;

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

    /* ---- the crown --------------------------------------------------------
       A ladder of notches inside the crown box, twice as long as the box is
       tall and clipped to it, so sliding it by one notch and wrapping reads
       as a knob being turned. */
    var KNURL = 16, KN_TOP = 678, KN_H = 44;
    var knurlMarkup = '';
    for (var k = 0; k < KNURL * 2; k++) {
      var ky = KN_TOP - KN_H + (k / KNURL) * KN_H;
      knurlMarkup += '<line x1="792" y1="' + ky.toFixed(1) + '" x2="828" y2="' + ky.toFixed(1) + '"/>';
    }
    if (knurl) knurl.innerHTML = knurlMarkup;

    /* ---- the parts that get drawn on -------------------------------------
       Strap, crown and case are all strokes, so each one can be walked on
       with a dashoffset. The stitching is left out of that: its dashes are
       its dasharray, and walking a path on needs the dasharray for the walk.
       It fades up once the strap it belongs to is closed instead. */
    /* The straps are not walked on like the rest: they grow. The leather
       comes down out of the tab left at the foot of the hero, so the top one
       has to extend from its own top edge rather than sketch itself in — and
       the lower one then grows down out of the case the same way, which is
       the move the outro picks up again at the other end. */
    var STRAP_HEAD = 0;   /* the strap starts at the very top of the frame */
    straps.forEach(function (el) { el.setAttribute('transform', 'translate(0 ' + STRAP_HEAD + ') scale(1 0)'); });

    /* The lead is not built. It is the strap that came down out of the hero,
       so it is at the top edge of this section from the moment the section
       has a top edge; what makes that read is the tab tracking the same edge
       from above. See the hero pin. */
    if (lead) lead.style.setProperty('--lead-k', '1');

    function growStrap(el, top, k) {
      el.setAttribute('transform',
        'translate(0 ' + (top * (1 - k)).toFixed(2) + ') scale(1 ' + Math.max(k, 0.0001).toFixed(4) + ')');
    }

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

    if (year) year.style.opacity = '0';
    if (face) face.style.opacity = '0';
    if (dial) dial.style.opacity = '0';
    var yearIn = 0, dialIn = 0, held = false;

    /* ---- the eras take the sides ----------------------------------------
       The side is the half of the dial the hand is in over that era's
       quarter: twelve to six is the right of the case, six back to twelve is
       the left. So the panel is always on the side the hand is pointing to. */
    eras.forEach(function (era, i) {
      era.classList.add('is-live-era');
      era.classList.add(i < eras.length / 2 ? 'side-right' : 'side-left');
      /* An era carrying its own footage gets both sides of the case rather
         than one narrow column: words against one edge, cards against the
         other. The ones that are only words stay on a single side, where a
         full-width panel would just be a short line in a lot of space. */
      if (era.querySelector('.era-media') && !era.querySelector('.pile')) {
        era.classList.add('is-split');
      }
      inner.appendChild(era);
    });
    if (now) inner.appendChild(now);
    if (picks) inner.appendChild(picks);
    if (certs) inner.appendChild(certs);
    /* Anything lifted onto the dial has to stop being parallaxed.

       The drift is set up earlier, against the position these blocks have in
       the flow, and it writes the same style property this module does — so
       the two took turns winning and a media column would sit a hundred
       pixels off its own container. Killing the tween is the fix; the block
       is not scrolling past anything any more, so there is nothing left for
       it to drift against. */
    function stopDrift(root) {
      if (!root) return;
      var els = [].slice.call(root.querySelectorAll('[data-parallax]'));
      if (root.hasAttribute && root.hasAttribute('data-parallax')) els.push(root);
      els.forEach(function (el) {
        ScrollTrigger.getAll().forEach(function (t) { if (t.trigger === el) t.kill(); });
        gsap.set(el, { clearProps: 'transform' });
        el.removeAttribute('data-parallax');
      });
    }
    eras.forEach(stopDrift);

    /* The projects and the photographs are the same year's right-hand side,
       so they go into one column and arrive as one thing. */
    var right = null;
    if (pile) {
      right = document.createElement('div');
      right.className = 'path-right';
      /* the label and its line belong to the pile, so they travel with it —
         left behind they end up captioning the copy on the other side of the
         case. The projects stay put: they belong under the words that
         introduce them. */
      var pileNote = document.querySelector('.pile-note');
      if (pileNote) right.appendChild(pileNote);
      right.appendChild(pile);
      inner.appendChild(right);
      stackPile();
    }

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
    /* What the face says at each quarter, and at the end. The hand standing
       on a marker is the only thing that changes it. */
    var YEARS = years.map(function (el) {
      var then = el.querySelector('.then');
      return (then || el).textContent.trim();
    });
    var shown = -1;

    function sayYear(i) {
      if (!yearOut || i === shown) return;
      shown = i;
      year.classList.add('is-turning');
      setTimeout(function () {
        yearOut.textContent = i >= YEARS.length ? 'Now' : YEARS[i];
        year.classList.remove('is-turning');
      }, 190);
    }

    /* The revolution is over by HOME. What is left of the pin after that is
       the outro, where the watch comes apart and the line carries on down the
       strap — so everything below reads the progress as revolution time, and
       only the outro reads the raw scroll. */
    var HOME = 0.80;
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

      /* The gap above the drawing, which is what the lead has to fill: from
         the top of the section down to where the strap in the drawing starts.
         Both edges are measured, so it closes exactly at any height. */
      if (lead) {
        var ob = orbit.getBoundingClientRect();
        lead.style.setProperty('--lead-w', (STRAP_W * unit).toFixed(1) + 'px');
        lead.style.setProperty('--lead-h', Math.max(sb.top - ob.top + 1, 0).toFixed(1) + 'px');
      }

      years.forEach(function (el, i) {
        var a = (i / years.length) * Math.PI * 2 - Math.PI / 2;
        var r = (R_CASE - 54) * unit;
        el.style.left = (ox + CX * unit + Math.cos(a) * r) + 'px';
        el.style.top  = (oy + CY * unit + Math.sin(a) * r) + 'px';
      });

      if (year) {
        year.style.left = (ox + CX * unit) + 'px';
        year.style.top  = (oy + CY * unit) + 'px';
      }

      layoutNow();

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

        /* certPull draws the whole coil back into the middle of the face
           and pushes it out behind the dial as the watch comes apart */
        var pull = 1 - certPull;
        var el = certItems[i];
        el.style.setProperty('--x', (ca * certR * pull).toFixed(1) + 'px');
        el.style.setProperty('--y', (y * pull).toFixed(1) + 'px');
        el.style.setProperty('--z', (sa * certR * pull - certPull * 280).toFixed(1) + 'px');
        /* turned to face the axis, so it lies on the surface of the coil */
        el.style.setProperty('--rx', (-Math.cos(a) * 8).toFixed(1) + 'deg');

        /* Dimmer round the back, both ends of the travel faded so the wrap
           is never seen, and — on the far side only — hidden by the case it
           is passing behind. That last one is done here rather than left to
           the 3D sort because the case is inside an <svg>, and the browser
           will not sort HTML against the shapes in one at any depth.

           It is a fade rather than a cut, taken from how far the chip is
           from the middle of the face: right behind the dial it is gone, and
           it comes back as it swings out past the rim. */
        /* The ends of the travel get a long fade too — it is the other place
           a chip arrives from nowhere, and a short one there reads the same
           way a short one at the case did. */
        var edge = Math.min(u, 1 - u) / 0.26;
        var ends = edge >= 1 ? 1 : edge * edge * edge * (edge * (edge * 6 - 15) + 10);
        var depth = 0.34 + 0.66 * ((sa + 1) / 2);

        /* Being behind the watch is an angle, not a distance.

           Two goes at this by distance both failed, in opposite directions: a
           short band and the chips popped out from behind the case, a long
           one and they spent the whole far side dim, which read as the coil
           being somewhere off in the distance rather than going round.

           How hidden a chip is has two parts, and both are already known. How
           far round the back it has turned, which is -sin of its angle and
           moves smoothly across the whole quarter turn; and whether it is
           level with the case at all, since one passing above or below the
           dial is behind nothing. Multiply them and the fade takes as long as
           the turn does, with nothing dimmed that is not actually covered. */
        var rc = R_CASE * unit;
        var deep = clamp01(-sa);
        deep = deep * deep * (3 - 2 * deep);
        var level = 1 - clamp01((Math.abs(y) - rc * 0.35) / (rc * 0.95));
        var hid = 1 - deep * level;

        var lit2 = lit * depth * ends * hid * (1 - certPull) * certShow.v;
        el.style.opacity = lit2.toFixed(3);
        el.style.pointerEvents = lit2 > 0.5 ? 'auto' : 'none';
      }
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

        /* the leather comes down first, out of the tab, and the watch is
           made on the end of it */
        growStrap(straps[0], STRAP_HEAD, ramp(p, 0.10, 0.46));
        growStrap(straps[1], STRAP_TOP, ramp(p, 0.56, 0.82));

        /* then the rest, part after part */
        var bp = ramp(p, 0.44, 0.86);
        built.forEach(function (part, i) {
          var slice = 1 / built.length;
          var k = clamp01((bp - i * slice * 0.72) / slice);
          part.el.style.strokeDashoffset = part.len * (1 - k);
          /* the fun side's pen version of this part, if fun.js has drawn it,
             walked on in step with this one */
          if (part.el.jotInk) part.el.jotInk(k);
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

        if (stitching) stitching.style.opacity = String(ramp(p, 0.46, 0.68));
        ticks.style.opacity = String(ramp(p, 0.72, 0.88));
        /* the face comes up with the ticks, once the case is closed */
        if (face) face.style.opacity = ticks.style.opacity;
        if (hand) hand.style.opacity = String(ramp(p, 0.84, 0.98) * 0.9);
        if (hub) hub.style.opacity = String(ramp(p, 0.84, 0.98));
        if (year) year.style.opacity = String(ramp(p, 0.86, 1));
        if (dial) dial.style.opacity = String(ramp(p, 0.76, 0.94));
      }
    });

    /* ---- 2. the revolution, while pinned --------------------------------- */
    ScrollTrigger.create({
      trigger: orbit,
      start: 'top top',
      end: '+=640%',
      pin: true,
      pinSpacing: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      refreshPriority: 2,
      onRefresh: measure,
      /* The scene keeps its own screen after the pin lets go, and the section
         below is pulled up over it — so anything still carrying opacity from
         the last frame shows through the contact panel. The scrub can stop
         anywhere; this makes sure the end state is the end state. */
      onLeave: function () { clearScene(); },
      onEnterBack: function () { cleared = false; },
      onUpdate: function (self) {
        var raw = self.progress;
        /* Everything from here to the outro is in revolution time: the whole
           schedule was written against a progress that ended when the hand
           came home, and it still is. */
        var p = clamp01(raw / HOME);
        detent(p, self.direction);

        /* One revolution, twelve back round to twelve. The short hand runs
           two turns in the same span, so both of them come home together on
           the last marker rather than one arriving alone. */
        var deg = p * 360;
        if (hand) hand.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' ' + CX + ' ' + CY + ')');
        if (hand2) hand2.setAttribute('transform', 'rotate(' + (deg * 2).toFixed(2) + ' ' + CX + ' ' + CY + ')');

        /* and the crown turns with them */
        if (knurl) {
          var step = KN_H / KNURL;
          knurl.setAttribute('transform',
            'translate(0 ' + ((p * 360 / (360 / KNURL / 2)) % 1 * step).toFixed(2) + ')');
        }

        var a = deg * Math.PI / 180 - Math.PI / 2;
        mark.style.transform = 'translate(' +
          (ox + (CX + Math.cos(a) * R_TRACK) * unit) + 'px,' +
          (oy + (CY + Math.sin(a) * R_TRACK) * unit) + 'px)';
        mark.style.opacity = p > 0.005 && p < 0.995 ? '1' : '0';

        /* a year lights as the hand reaches its marker, and the face says
           which one it is standing on */
        var on = 0;
        years.forEach(function (el, i) {
          var passed = p >= i / years.length - 0.01;
          el.classList.toggle('is-now', passed);
          if (passed) on = i;
        });
        sayYear(p >= NOW - 0.02 ? YEARS.length : on);

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
          era.style.opacity = vis.toFixed(3);

          if (era.classList.contains('is-split')) {
            /* The panel spans the screen, so sliding it as one block would
               carry both halves the same way. Each half comes in off its own
               edge instead, and the panel itself only holds the vertical
               centring. */
            var off = (1 - vis) * 70;
            era.style.transform = 'translateY(-50%)';
            var copy = era.querySelector('.era-copy');
            var media = era.querySelector('.era-media');
            if (copy) copy.style.transform = 'translateY(-50%) translateX(' + (-off).toFixed(1) + 'px)';
            if (media) media.style.transform = 'translateY(-50%) translateX(' + off.toFixed(1) + 'px)';
          } else {
            var dir = era.classList.contains('side-left') ? -1 : 1;
            era.style.transform =
              'translateY(-50%) translateX(' + (dir * (1 - vis) * 70).toFixed(1) + 'px)';
          }
          /* The panel is pointer-events:none in the stylesheet so a faded one
             never swallows a click meant for the dial. Nothing was ever
             turning it back on, which is why the videos in here could not be
             played at all. */
          era.style.pointerEvents = vis > 0.9 ? 'auto' : 'none';

          /* the right-hand column belongs to one year, so it comes and goes
             with it, opposite the panel */
          if (right && era === eras[eras.length - 1]) {
            right.style.opacity = vis.toFixed(3);
            right.style.transform =
              'translateY(-50%) translateX(' + ((1 - vis) * 70).toFixed(1) + 'px)';
            right.style.pointerEvents = vis > 0.9 ? 'auto' : 'none';
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
        /* Only how lit it is comes from the scroll. Adding a scrolled offset
           to the turn as well made the coil stall and jump: scrolling down
           pushed it forward faster than the drift and scrolling up cancelled
           the drift outright, so it read as stopping. The turn is the
           ticker's alone. */
        certLit = ramp(p, NOW + 0.02, NOW + 0.10);

        /* ---- the outro ---------------------------------------------------
           Past HOME the watch stops being a watch. The certificates are
           drawn back into the middle of the face and pushed out behind it,
           the case and both hands shrink into that same point, and the line
           that was the hand runs on down the strap and off the bottom of the
           frame — where the contact panel takes it up. The strap is the one
           thing that does not go, because it is what carries on. */
        var o = ramp(raw, HOME, 1);
        certPull = o;
        windCerts(certDrift, certLit);

        /* The case goes, and the two halves of the strap go opposite ways:
           the top one draws back up out of the frame, and the bottom one
           stretches on down past it. Stretching the lower strap from its own
           top edge rather than scaling the whole path is what keeps it
           attached to where the case was — it grows away from the watch, not
           away from the middle of the drawing. */
        var shrink = ramp(raw, HOME + 0.03, HOME + 0.15);
        dialBits.forEach(function (el) { el.style.opacity = String(1 - shrink); });
        if (core) {
          var k = 1 - shrink * 0.92;
          core.setAttribute('transform',
            'translate(' + (CX * (1 - k)).toFixed(2) + ' ' + (CY * (1 - k)).toFixed(2) +
            ') scale(' + k.toFixed(4) + ')');
        }

        var part = ramp(raw, HOME + 0.02, HOME + 0.20);
        /* the top strap draws back up out of the frame; the bottom one keeps
           growing the way it grew in, on down past where the case was */
        if (lead) lead.style.setProperty('--lead-k', (1 - part).toFixed(3));
        growStrap(straps[0], STRAP_HEAD, 1 - part);
        growStrap(straps[1], STRAP_TOP, 1 + part * 1.9);
        stitchRuns.forEach(function (el, i) {
          if (i < 2) el.setAttribute('transform', 'translate(0 ' + (-part * 420).toFixed(1) + ')');
          else el.style.opacity = String(1 - part);
        });
        /* The reading and the markers are part of the watch, so they go with
           it. They were left behind by the collapse — the year sat in the
           middle of nothing and the four years still ringed a case that was
           no longer there.

           Both are written by the build trigger too, so the outro takes what
           it finds at the moment it starts rather than a value cached from
           whenever that trigger last ran. Caching it meant the dial went dark
           whenever the build had not updated since load. */
        if (raw > HOME) {
          if (!held) { held = true; yearIn = +year.style.opacity || 1; dialIn = +dial.style.opacity || 1; }
          var gone = ramp(raw, HOME, HOME + 0.12);
          if (year) year.style.opacity = String(yearIn * (1 - gone));
          if (dial) dial.style.opacity = String(dialIn * (1 - gone));
        } else {
          held = false;
        }
        if (o > 0 && mark) mark.style.opacity = '0';

        if (now && o > 0) now.style.opacity = String((1 - o) * (+now.style.opacity || 0));
        if (picks && o > 0) picks.style.opacity = String((1 - o) * (+picks.style.opacity || 0));
        if (right && o > 0) right.style.opacity = String((1 - o) * (+right.style.opacity || 0));
      }
    });

    /* The coil keeps turning after the scroll stops. Only while it is worth
       looking at — there is no reason to run a ticker for something faded
       out — and only ever adding to what the scroll already set. */
    /* And the scene is taken off the screen outright once the last section is
       properly up.

       Relying on the outro's own last frame is not enough: it is scrubbed, it
       can stop anywhere, and the section below is pulled up over the screen
       the pin leaves behind — so a card still carrying a tenth of its opacity
       reads as text sitting behind the contact panel. This is the backstop,
       and it is keyed to the panel being up rather than to the pin ending, so
       the strap still has the whole handover to itself. */
    var after = document.querySelector('#contact');
    if (after) {
      ScrollTrigger.create({
        trigger: after,
        /* Late on purpose. At 65% this fired while the pin was still running —
           the contact panel's top crosses that line before the scroll reaches
           the end of the pin — so the watch was being hidden in the middle of
           coming apart. It only has to catch what the outro leaves behind. */
        start: 'top 20%',
        onEnter: function () { clearScene(); orbit.style.visibility = 'hidden'; },
        onLeaveBack: function () { cleared = false; orbit.style.visibility = ''; }
      });
    }

    /* Everything the scene put on the screen, taken back off it. */
    var cleared = false;

    function clearScene() {
      if (cleared) return;
      cleared = true;
      [now, picks, right, year, dial, mark].forEach(function (el) {
        if (el) el.style.opacity = '0';
      });
      dialBits.forEach(function (el) { el.style.opacity = '0'; });
      certItems.forEach(function (el) { el.style.opacity = '0'; });
      eras.forEach(function (era) { era.style.opacity = '0'; era.style.pointerEvents = 'none'; });
    }

    /* A notch at Now. The hand coming home is the one moment on this page
       worth stopping at, so the scroll is held for a beat as it crosses —
       once, forwards only, and never long enough to read as a hang. Skipped
       entirely without Lenis: taking the native scroll away from someone
       mid-gesture is a worse thing than not having the detent at all. */
    var notched = false;

    function detent(q, dir) {
      if (!lenis || notched || dir < 0) return;
      if (q < NOW || q > NOW + 0.06) return;
      notched = true;
      lenis.stop();
      setTimeout(function () { lenis.start(); }, 420);
    }

    /* The ticker runs for as long as the scene is on screen and simply does
       nothing while the coil is faded out. Stopping it when the coil was dark
       was the bug: the trigger only starts it once, on the way in, when the
       coil is always dark — so it stopped immediately and never came back,
       and from then on the chips only moved while the scroll was moving. */
    function spin(time, deltaMs) {
      if (certLit < 0.01) return;
      certDrift += Math.min(deltaMs, 50) / 1000 / 26;
      windCerts(certDrift, certLit);
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

    /* The coil fades per chip rather than as a list, for the same reason its
       scroll fade does: an opacity on the list would flatten it. The update
       redraws it even when nothing is scrolling. */
    document.addEventListener('sidechange', function () {
      gsap.to(certShow, {
        v: doc.getAttribute('data-side') === 'fun' ? 0 : 1,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: function () { windCerts(certDrift, certLit); }
      });
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(measure, 180);
    });
  })();

  /* ---------------------------------------------------------- The strap ends

     The leather runs off the bottom of the watch and squares off into the
     sheet the last section is written on: a band the width of the strap that
     opens out to the width of the panel as the section arrives, with the
     line that used to be the watch hand coming down the middle of it to the
     address at the end.

     Both are written as custom properties rather than transforms, because a
     scaled band would take its stitching and its corner radius with it and
     arrive as a stretched picture of a strap rather than as a wider one. */

  (function () {
    var panel = document.querySelector('.contact-leather');
    var mail  = document.querySelector('.contact-mail');
    var contact = document.querySelector('#contact');
    if (!panel || !contact || reduced || !hasGsap) return;

    /* The width the strap has on screen, worked out the same way the watch
       works it out — the drawing is 1000 units wide across a box whose height
       is min(99vh, 48rem) at a 1000:1400 ratio, and the strap is 120 of those
       units. Hard-coding a number here had the leather changing width at the
       join on every viewport but the one it was measured on. */
    function strapWidth() {
      var h = Math.min(window.innerHeight * 0.99, 48 * 16);
      return 123 * (h * 1000 / 1400) / 1000;
    }

    function paint(p) {
      /* It stays a strap while the section is still coming up, and only
         widens once it is in place. Widening on the way in reads as a box
         being pushed onto the screen; widening after it has arrived reads as
         the leather it is. The section is a full screen tall now, so this
         ramp has somewhere to happen: before, the whole of it was over by
         the time the panel had finished rising. */
      var wide = clamp((p - 0.50) / 0.45);
      wide = wide * wide * (3 - 2 * wide);
      var narrow = strapWidth();
      var w = narrow + (Math.min(window.innerWidth * 0.92, 1100) - narrow) * wide;
      panel.style.setProperty('--lw', w.toFixed(0) + 'px');
      if (mail) {
        /* The address opens outward from the middle, in step with the
           leather widening under it — the same move at a smaller scale. */
        var m = clamp((p - 0.62) / 0.3);
        var e = 1 - Math.pow(1 - m, 3);
        mail.style.opacity = m > 0 ? '1' : '0';
        mail.style.setProperty('--cut', ((1 - e) * 50).toFixed(2) + '%');
      }
    }
    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    paint(0);

    ScrollTrigger.create({
      trigger: contact,
      start: 'top bottom',
      /* Its own bottom edge, not a line partway up the screen: this is the
         last section on the page, and on a short one there is not enough
         scroll left below it to ever reach 'top 18%' — the address stayed
         half-drawn at the very end of the document. The bottom reaching the
         bottom is always reachable, because it is where the page stops. */
      end: 'bottom bottom',
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: function (self) { paint(self.progress); }
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
     section comes back, frames that are not decoded yet skipped rather than
     shown, and a per-frame hold.

     The video branches below are not dead by accident. Every card is stills
     now, but this is the facade the whole spiral runs on and it takes either;
     the animations card was moved to frames because a browser draws its own
     hover controls over a playing video and no attribute turns them off.
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
