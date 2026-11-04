/* ==========================================================================
   Jeffrey Hamilton — the intro

   A first visit opens on a loading bar, then a blank canvas, and then a few
   cursors build the first screen in front of you: one draws the header and
   drops the face into it, one types the nav, one types the word under the
   spiral and sizes it up, one drags the cards in, and one places the icons
   and the switch and tidies the spacing. They work at the same time.

   Nothing here is a copy. Every element the cursors touch is the page's own:
   text is typed by uncovering the real characters one at a time (each is
   wrapped in a span for the length of the intro, then put back as the very
   text node it was), and anything dragged or resized is moved with the CSS
   `translate` and `scale` properties, which sit on top of whatever transform
   the page already uses and never touch layout. Taking those off is all the
   ending has to do, so the finished page is exactly the page — skip it at
   any moment and the same clean-up runs.

   It plays once per browser session (the head script decides, before the
   first paint, and sets html.bi-on). Reduced motion never sees it. ?intro
   plays it again, which is what the footer's replay button does.

   Every cursor runs its own script, as an async function, against one shared
   clock (a single rAF loop that drives every tween). They overlap freely and
   only wait on each other where the work really depends on it — the nav is
   typed into the header once the header exists — through named signals.
   ========================================================================== */

(function () {
  'use strict';

  var doc = document.documentElement;
  if (!doc.classList.contains('bi-on')) return;

  var KEY = 'jh-intro-seen';
  var JH = window.JH || {};

  function seen() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    doc.classList.remove('bi-on');
    seen();
    document.dispatchEvent(new Event('introdone'));
    return;
  }

  /* ------------------------------------------------------------ the page */

  var head      = document.querySelector('.site-head');
  var headInner = document.querySelector('.head-inner');
  var mark      = document.querySelector('.mark');
  var face      = document.querySelector('.mark-face');
  var markText  = document.querySelector('.mark-text');
  var markName  = document.querySelector('.mark-name');
  var markWhere = document.querySelector('.mark-where');
  var nav       = document.querySelector('.nav');
  var social    = document.querySelector('.head-social');
  var hero      = document.querySelector('.hero');
  var skills    = document.querySelector('.skills-type');
  var wordOut   = document.querySelector('.type-out');
  var strap     = document.querySelector('.hero-strap');
  var switcher  = document.querySelector('.side-switch');
  var below     = [].slice.call(document.querySelectorAll('main > section:not(.hero), .site-foot'));
  var cards     = [].slice.call(document.querySelectorAll('.spiral-card'));
  var bootFace  = document.querySelector('[data-intro] .boot-face');
  var bootImg   = bootFace && bootFace.querySelector('img');
  var crew      = [];   /* the cursors, once they exist */

  if (!head || !headInner || !hero) { bail(); return; }

  function side() { return doc.getAttribute('data-side') === 'fun' ? 'fun' : 'pro'; }

  /* ------------------------------------------------------------ helpers */

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rect(el) { return el.getBoundingClientRect(); }
  function W() { return window.innerWidth; }
  function H() { return window.innerHeight; }
  function shown(el) { var r = el && rect(el); return !!(r && r.width > 0 && r.height > 0); }
  function make(tag, cls, parent) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (parent) parent.appendChild(el);
    return el;
  }

  var ease = {
    linear: function (t) { return t; },
    /* minimum jerk: how a hand actually gets from one place to another */
    hand: function (t) { return t * t * t * (10 + t * (-15 + 6 * t)); },
    /* a flick: speed builds almost at once and most of the way is covered
       early, then a long soft landing — snappy, with no jolt at either end
       (its speed is zero at both, peaking a quarter of the way in) */
    flick: function (t) { var u = 1 - t; return 1 - u * u * u * u * (1 + 4 * t); },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: function (t) { var c = 1.7, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  };

  /* Everything the intro writes on the page, so it can all be taken off. */
  var touched = [];
  function setS(el, prop, val) {
    if (touched.indexOf(el) < 0) { touched.push(el); el._biProps = []; }
    if (el._biProps.indexOf(prop) < 0) el._biProps.push(prop);
    el.style.setProperty(prop, val);
  }
  function hide(el) { if (el) el.setAttribute('data-bi', 'off'); }
  function hidePiece(p) { if (p.nodeType) hide(p); else { hide(p.el); (p.also || []).forEach(hide); } }
  function show(el) { if (el) el.removeAttribute('data-bi'); }

  /* ------------------------------------------------------------ the clock

     One loop for everything. A tween is a promise; skipping rejects every
     one still running, which unwinds every script at once. */

  var ABORT = { abort: true };
  var dead = false;
  var tweens = [];
  var followers = [];
  var raf = 0;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    var list = tweens.slice();
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.t0 === null) t.t0 = now;
      var p = t.dur > 0 ? Math.min(1, (now - t.t0) / t.dur) : 1;
      if (t.fn) t.fn(t.ease(p), p);
      if (p >= 1) {
        tweens.splice(tweens.indexOf(t), 1);
        t.res();
      }
    }
    for (var k = 0; k < followers.length; k++) followers[k]();
  }

  /* The whole session runs a little faster than life, the way a screen
     recording of one is played back. */
  var TIME = 0.5;
  /* The pace changes as it goes: the first screen, where everything starts
     at once, is built unhurried; the walk down the page picks up; the end
     is quick. Every tween takes its length from TIME as it starts. */
  var PACE = { chat: 0.5, start: 0.78, watch: 0.6, story: 0.5, end: 0.42 };
  function pace(k) { TIME = PACE[k]; }

  function tween(dur, fn, e) {
    return new Promise(function (res, rej) {
      if (dead) { rej(ABORT); return; }
      tweens.push({ t0: null, dur: dur * TIME, fn: fn, ease: e || ease.linear, res: res, rej: rej });
    });
  }
  function wait(ms) { return tween(ms, null); }

  var signals = {};
  function signal(n) {
    if (!signals[n]) {
      var s = {};
      s.p = new Promise(function (r) { s.r = r; });
      signals[n] = s;
    }
    return signals[n];
  }
  function when(n) { return signal(n).p; }
  function emit(n) { signal(n).r(); }

  /* ------------------------------------------------------------ the overlay */

  var root   = make('div', 'bi');
  root.setAttribute('aria-hidden', 'true');
  var layer  = make('div', 'bi-layer', root);
  var curs   = make('div', 'bi-cursors', root);

  var skip = make('button', 'bi-skip');
  skip.type = 'button';
  skip.textContent = 'Skip intro';

  var canvas = make('div', 'bi-canvas');
  canvas.setAttribute('aria-hidden', 'true');

  /* ---- boxes: selections, frames, text boxes ---- */

  function Box(color, opts) {
    opts = opts || {};
    var el = make('div', 'bi-box' + (opts.fill ? ' fill' : ''), layer);
    el.style.setProperty('--c', color);
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) { make('span', 'bi-h ' + k, el); });
    var badge = make('span', 'bi-badge', el);
    var self = {
      el: el,
      follow: null,
      set: function (x, y, w, h) {
        if (w < 0) { x += w; w = -w; }
        if (h < 0) { y += h; h = -h; }
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        el.style.width = w.toFixed(1) + 'px';
        el.style.height = h.toFixed(1) + 'px';
      },
      fit: function (r, pad) {
        pad = pad == null ? 4 : pad;
        self.set(r.left - pad, r.top - pad, r.width + pad * 2, r.height + pad * 2);
      },
      track: function (fn, pad) {
        self.untrack();
        self.follow = function () { var r = fn(); if (r) self.fit(r, pad); };
        followers.push(self.follow);
        self.follow();
      },
      untrack: function () {
        var at = self.follow ? followers.indexOf(self.follow) : -1;
        if (at >= 0) followers.splice(at, 1);
        self.follow = null;
      },
      on: function () { el.classList.add('on'); return self; },
      off: function () { el.classList.remove('on', 'handles'); return self; },
      handles: function (v) { el.classList.toggle('handles', !!v); return self; },
      faint: function () { el.classList.add('faint'); return self; },
      badge: function (txt) {
        if (txt == null) badge.classList.remove('on');
        else { badge.textContent = txt; badge.classList.add('on'); }
        return self;
      },
      remove: function () {
        self.untrack();
        el.classList.remove('on');
        setTimeout(function () { el.remove(); }, 260);
      }
    };
    return self;
  }

  function guide(color, x1, y1, x2, y2) {
    var el = make('div', 'bi-guide', layer);
    el.style.setProperty('--c', color);
    var v = Math.abs(x2 - x1) < Math.abs(y2 - y1);
    el.style.left = Math.min(x1, x2) + 'px';
    el.style.top = Math.min(y1, y2) + 'px';
    if (v) { el.style.width = '1px'; el.style.height = Math.abs(y2 - y1) + 'px'; }
    else   { el.style.height = '1px'; el.style.width = Math.abs(x2 - x1) + 'px'; }
    requestAnimationFrame(function () { el.classList.add('on'); });
    return {
      el: el,
      remove: function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 200); }
    };
  }

  /* A distance between two edges, the way a design tool shows one. */
  function Measure(color) {
    var el = make('div', 'bi-measure', layer);
    el.style.setProperty('--c', color);
    var lab = make('span', 'bi-measure-lab', el);
    return {
      set: function (x1, y1, x2, y2) {
        var v = Math.abs(x2 - x1) < Math.abs(y2 - y1);
        el.classList.toggle('v', v);
        el.style.left = Math.min(x1, x2) + 'px';
        el.style.top = Math.min(y1, y2) + 'px';
        el.style.width = v ? '1px' : Math.abs(x2 - x1) + 'px';
        el.style.height = v ? Math.abs(y2 - y1) + 'px' : '1px';
        lab.textContent = Math.round(v ? Math.abs(y2 - y1) : Math.abs(x2 - x1));
        el.classList.add('on');
      },
      remove: function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 220); }
    };
  }

  var restorers = [];

  /* ------------------------------------------------------------ cursors */

  var ARROW = '<svg viewBox="0 0 24 26" width="24" height="26" aria-hidden="true">' +
    '<path d="M3 2.2 L3 20.6 L7.7 16.3 L10.9 23.4 L14.2 22 L11.1 15 L17.6 15 Z" ' +
    'fill="var(--c)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function Cursor(color, x, y, speed, hand) {
    var el = make('div', 'bi-cur', curs);
    el.style.setProperty('--c', color);
    el.innerHTML = ARROW;
    var c = {
      el: el, color: color, x: x, y: y, speed: speed, hand: hand, mid: 0, halt: false, done: false,
      place: function () {
        el.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0)';
        /* the field behind the watch feels the hands go by too */
        if (JH.field) JH.field.poke(color, c.x, c.y);
      },
      /* A human reach: a slight arc, quick in the middle and slow at both
         ends, the time growing with the log of the distance (Fitts), a
         little tremor, and on a long reach sometimes a small overshoot that
         is pulled back. */
      move: function (x, y, o) {
        o = o || {};
        /* a newer move takes the hand; an older one still running lets go */
        if (c.halt && !o.exit) return wait(30);
        var id = ++c.mid;
        var x0 = c.x, y0 = c.y, dx = x - x0, dy = y - y0, d = Math.hypot(dx, dy);
        if (d < 0.5) return wait(30);
        var dur = o.dur || clamp(150 + 120 * Math.log2(1 + d / 28), 180, 1000) * c.speed * rnd(0.94, 1.08);
        var bend = (o.bend != null ? o.bend : rnd(-0.14, 0.14) + c.hand * 0.07) * d;
        var nx = -dy / d, ny = dx / d;
        var os = (o.overshoot !== false && d > 260 && Math.random() < 0.35) ? rnd(4, 8) : 0;
        var tx = x + (dx / d) * os, ty = y + (dy / d) * os;
        var c1x = x0 + dx * 0.3 + nx * bend, c1y = y0 + dy * 0.3 + ny * bend;
        var c2x = x0 + dx * 0.75 + nx * bend * 0.45, c2y = y0 + dy * 0.75 + ny * bend * 0.45;
        var p = tween(dur, function (e, raw) {
          if (id !== c.mid) return;
          var q = 1 - e;
          var px = q * q * q * x0 + 3 * q * q * e * c1x + 3 * q * e * e * c2x + e * e * e * tx;
          var py = q * q * q * y0 + 3 * q * q * e * c1y + 3 * q * e * e * c2y + e * e * e * ty;
          c.x = px;
          c.y = py;
          c.place();
          if (o.onMove) o.onMove(c.x, c.y);
        }, o.ease || ease.flick);
        if (!os) return p;
        return p.then(function () {
          return tween(rnd(110, 160), function (e) {
            if (id !== c.mid) return;
            c.x = tx + (x - tx) * e; c.y = ty + (y - ty) * e;
            c.place();
            if (o.onMove) o.onMove(c.x, c.y);
          }, ease.out);
        });
      },
      press: function () {
        el.classList.add('down');
        ring(c);
        return wait(rnd(60, 100));
      },
      release: function () {
        el.classList.remove('down');
        return wait(rnd(40, 80));
      },
      /* a beat to aim, then the click */
      click: function () {
        return wait(rnd(30, 70)).then(c.press).then(c.release);
      },
      /* At rest: a hand with nothing to make holds still. Lets go the
         moment the hand is given anything else to do. Resolves when `until`
         says so (a test, or a number of milliseconds). */
      rest: function (until_) {
        var id = ++c.mid;
        var t0 = performance.now();
        return new Promise(function (resolve) {
          var f = function () {
            if (id !== c.mid || dead) { off(); resolve(); return; }
            var over = typeof until_ === 'number' ? performance.now() - t0 >= until_ : until_();
            if (over) { off(); resolve(); }
          };
          function off() { var k = followers.indexOf(f); if (k >= 0) followers.splice(k, 1); }
          followers.push(f);
        });
      },
      /* a short pause, at rest */
      idle: function (ms) { return c.rest(ms * TIME); },
      /* waiting on someone else: at rest until they are done */
      idleUntil: function (promise) {
        var done = false;
        promise.then(function () { done = true; });
        return c.rest(function () { return done || c.halt; });
      },
      /* nothing to make right now: at rest until there is */
      roam: function (cut) {
        return c.rest(function () { return !cut || cut(); });
      },
      /* stay on a moving point — a line being drawn, a hand going round —
         with a hand's lag and a little life in it; down while the point
         says it is drawing */
      follow: function (fn, lag, steady) {
        c.mid++;
        var t0 = performance.now();
        var f = function () {
          var p = fn();
          if (!p) return;
          if (steady) {
            /* holding it: exactly on it, pressed, no drift of its own */
            c.x = p.x; c.y = p.y;
            c.place();
            el.classList.add('down');
            return;
          }
          var k = lag || 0.3;
          c.x += (p.x - c.x) * k;
          c.y += (p.y - c.y) * k;
          c.place();
          el.classList.toggle('down', !!p.down);
        };
        followers.push(f);
        return function () {
          var i = followers.indexOf(f);
          if (i >= 0) followers.splice(i, 1);
          el.classList.remove('down');
        };
      },
      chip: function (txt) {
        var k = make('span', 'bi-chip', layer);
        k.style.setProperty('--c', color);
        k.textContent = txt;
        k.style.transform = 'translate(' + (c.x + 16) + 'px,' + (c.y + 22) + 'px)';
        setTimeout(function () { k.remove(); }, 900);
      }
    };
    c.place();
    return c;
  }

  function ring(c) {
    var r = make('span', 'bi-ring', layer);
    r.style.setProperty('--c', c.color);
    r.style.left = c.x + 'px';
    r.style.top = c.y + 'px';
    setTimeout(function () { r.remove(); }, 520);
  }

  /* Make an element: the box drawn where it goes, from corner to corner,
     and the element there, whole, the moment the hand lets go. Text is not
     typed out; it arrives in its box, the way it does when you draw a text
     box and paste into it. */
  function unionRect(els) {
    var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    els.forEach(function (e) {
      var q = rect(e);
      if (q.width < 1 && q.height < 1) return;
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    });
    return l === Infinity ? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
      : { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }
  function jobMake(c, el, also) {
    if (!el) return Promise.resolve();
    var group = [el].concat(also || []);
    var area = function () { return unionRect(group); };
    var appear = function () { group.forEach(show); };
    var r = area();
    if (r.width < 2 || r.height < 2) { appear(); return Promise.resolve(); }
    var pad = 4, b = Box(c.color, { fill: true });
    var x0 = r.left - pad, y0 = r.top - pad;
    return c.move(x0, y0, { overshoot: false }).then(c.press).then(function () {
      var q = area();                        /* where it is now, panels settle */
      x0 = q.left - pad; y0 = q.top - pad;
      var x1 = q.right + pad, y1 = q.bottom + pad;
      b.set(x0, y0, 1, 1);
      b.on();
      var d = Math.hypot(x1 - x0, y1 - y0);
      return c.move(x1, y1, {
        overshoot: false, bend: 0.02, dur: clamp(200 + d * 0.32, 240, 560),
        onMove: function (x, y) {
          b.set(x0, y0, x - x0, y - y0);
          b.badge(Math.round(Math.abs(x - x0)) + ' × ' + Math.round(Math.abs(y - y0)));
        }
      });
    }).then(function () {
      appear();
      touch(fileFor(el), c.color);
      if (Math.random() < 0.45) touch('styles.css', c.color, Math.round(rnd(1, 6)));
      b.badge(null);
      b.el.classList.remove('fill');
      return c.release();
    }).then(function () { b.remove(); });
  }

  /* A list of things to make, shared by a crew: whoever is free takes the
     nearest one still waiting, so they are made side by side. An item can
     carry its own way of being made. */
  function makeAll(workers, items) {
    var queue = items.filter(Boolean).map(function (it) { return it.nodeType ? { el: it } : it; });
    if (!queue.length || !workers.length) {
      queue.forEach(function (it) { show(it.el); (it.also || []).forEach(show); });
      return Promise.resolve();
    }
    return Promise.all(workers.map(function (c) {
      function next() {
        if (!queue.length || dead) return Promise.resolve();
        var best = 0, bd = Infinity;
        queue.forEach(function (it, i) {
          var r = rect(it.el);
          var dd = Math.hypot(r.left - c.x, r.top - c.y);
          if (dd < bd) { bd = dd; best = i; }
        });
        var it = queue.splice(best, 1)[0];
        return task(c, function () { return it.make ? it.make(c, it.el) : jobMake(c, it.el, it.also); }).then(next);
      }
      return next();
    }));
  }

  /* The pieces a panel is made of: its paragraphs, headings, tiles and
     links, one level at a time — a wrapper that only holds other blocks is
     gone into, anything with words or a picture of its own is one piece.
     Only the side of the page that is showing. */
  function ownText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  function pieces(root, out) {
    out = out || [];
    if (!root) return out;
    [].slice.call(root.children).forEach(function (el) {
      if (el.classList.contains('side') && !el.classList.contains('side-' + side())) return;
      if (el.classList.contains('duo') || el.classList.contains('side')) { pieces(el, out); return; }
      var t = el.tagName;
      var holder = (t === 'DIV' || t === 'UL' || t === 'OL') && el.children.length > 1 && !ownText(el) &&
        !el.matches('.pile, .fun-doodles, .path-certs, .era-row, .era-stack, .pn-list, ul, ol');
      if (holder) pieces(el, out);
      else if (out.length && out[out.length - 1].kicker) {
        /* a little label goes in with the heading under it, as one box */
        out[out.length - 1] = { el: out[out.length - 1].el, also: [el] };
      } else if (/kicker/.test(el.className)) out.push({ el: el, kicker: true });
      else out.push(el);
    });
    return out;
  }

  /* How far a card moves on screen for a pixel of `translate`. The spiral's
     cards are in perspective, so a near card moves further than a far one;
     measured rather than worked out, since it is one read. */
  function gain(el) {
    var a = rect(el).left;
    el.style.setProperty('translate', '100px 0px');
    var b = rect(el).left;
    el.style.removeProperty('translate');
    var m = (b - a) / 100;
    return m > 0.2 && m < 3 ? m : 1;
  }

  /* Drag an element by a point on it, from where the cursor is now to (x,y).
     The element rides with the cursor (via translate), guides show as it
     nears its place, and it snaps the last few pixels in. */
  function dragTo(c, el, home, x, y, o) {
    o = o || {};
    var m = o.gain || 1;
    var bx = o.base ? o.base.x : 0, by = o.base ? o.base.y : 0;
    var gx = home.x, gy = home.y;               /* where the held point rests */
    var guides = [];
    var near = false;
    function put(px, py) {
      setS(el, 'translate', ((px - gx) / m + bx).toFixed(2) + 'px ' + ((py - gy) / m + by).toFixed(2) + 'px');
      var close = Math.abs(px - gx) < 26 && Math.abs(py - gy) < 26;
      if (close && !near && o.guides) { near = true; guides = o.guides(); }
    }
    put(c.x, c.y);
    return c.move(x + rnd(-5, 5), y + rnd(-4, 4), {
      overshoot: false, bend: o.bend, onMove: put
    }).then(function () {
      if (!near && o.guides) { near = true; guides = o.guides(); }
      /* the snap: a quick pull onto the guide */
      var sx = c.x, sy = c.y;
      c.mid++;
      return tween(110, function (e) {
        c.x = sx + (gx - sx) * e; c.y = sy + (gy - sy) * e;
        c.place(); put(c.x, c.y);
      }, ease.out);
    }).then(function () {
      setS(el, 'translate', bx + 'px ' + by + 'px');
      touch(fileFor(el), c.color);
      return wait(160);
    }).then(function () {
      guides.forEach(function (g) { g.remove(); });
    });
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* What a design tool shows while an image is dragged: a small copy under
     the hand. The real element is filled when it is dropped. */
  function Ghost(src, color) {
    var g = make('div', 'bi-ghost', layer);
    g.style.setProperty('--c', color);
    var im = make('img', '', g);
    im.alt = '';
    im.src = src;
    return {
      at: function (x, y) { g.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; },
      remove: function () { g.classList.add('gone'); setTimeout(function () { g.remove(); }, 220); }
    };
  }

  /* The view moves because the intro moves it: frame by frame, so every
     scroll-driven part of the page (the watch above all) runs exactly as it
     would under a hand on the wheel. */
  function scrollTo(y, ms, e) {
    var y0 = window.scrollY;
    return tween(ms, function (k) { window.scrollTo(0, Math.round(y0 + (y - y0) * k)); }, e || ease.inOut);
  }

  /* Resolve once a condition holds (checked a few times a second). */
  function until(cond) {
    return new Promise(function (r) {
      (function chk() { if (dead) return; if (cond()) r(); else setTimeout(chk, 80); })();
    });
  }

  /* ------------------------------------------------------------ the jobs */

  var frames = [];   /* boxes that stay up until the reveal */

  /* The header: draw its frame across the top. */
  function jobFrame(c) {
    var hi = rect(headInner);
    var x0 = hi.left - 8, y0 = hi.top - 7, x1 = hi.right + 8, y1 = hi.bottom + 7;
    var b = Box(c.color, { fill: true });
    return c.move(x0, y0).then(function () {
      return wait(rnd(80, 160));
    }).then(c.press).then(function () {
      b.set(x0, y0, 1, 1); b.on();
      return c.move(x1, y1, {
        dur: clamp((x1 - x0) * 0.75, 520, 1000), bend: 0.03, overshoot: false,
        onMove: function (x, y) {
          b.set(x0, y0, x - x0, y - y0);
          b.badge(Math.round(Math.abs(x - x0)) + ' × ' + Math.round(Math.abs(y - y0)));
        }
      });
    }).then(function () {
      b.set(x0, y0, x1 - x0, y1 - y0);
      return c.release();
    }).then(function () {
      b.handles(true);
      head.classList.remove('bi-noscrim');
      emit('frame');
      return wait(380);
    }).then(function () {
      b.handles(false).badge(null);
      b.el.classList.remove('fill');
      b.faint();
      frames.push(b);
    });
  }

  /* The intro face, first thing: the circle drawn with the ellipse tool,
     then the photo dragged in from the edge of the screen and dropped on
     it. This is the face the opening later spins into the gold dot. */
  function jobFaceCircle(c) {
    if (!bootFace || !bootImg || !shown(bootFace)) { show(bootFace); show(bootImg); return Promise.resolve(); }
    var r = rect(bootFace);
    var sel = Box(c.color);
    return c.move(r.left - rnd(30, 50), r.top - rnd(20, 40)).then(function () {
      c.chip('O');                         /* the ellipse tool */
      return wait(rnd(90, 140));
    }).then(function () {
      return c.move(r.left + 2, r.top + 2, { overshoot: false });
    }).then(c.press).then(function () {
      show(bootFace);
      setS(bootFace, 'transform-origin', '0 0');
      setS(bootFace, 'scale', '0.02');
      sel.on();
      var grow = function (x, y) {
        var k = clamp(Math.max((x - r.left) / r.width, (y - r.top) / r.height), 0.02, 1.08);
        setS(bootFace, 'scale', k.toFixed(4));
        sel.set(r.left, r.top, r.width * k, r.height * k);
        sel.badge(Math.round(r.width * k) + ' × ' + Math.round(r.height * k));
      };
      return c.move(r.right + rnd(8, 14), r.bottom + rnd(8, 14), { overshoot: false, bend: 0.03, dur: 560, onMove: grow })
        .then(function () { return c.move(r.right, r.bottom, { overshoot: false, dur: 140, onMove: grow }); });
    }).then(function () {
      setS(bootFace, 'scale', '1');
      sel.set(r.left, r.top, r.width, r.height);
      sel.badge(null).handles(true);
      return c.release();
    }).then(function () {
      return wait(rnd(120, 180));
    }).then(function () {
      sel.remove();
    });
  }

  /* the photo: an option-drag of the one already in the header, down into
     the circle; onGrab runs the moment it is picked up */
  function jobFacePhoto(c, onGrab) {
    if (!bootFace || !bootImg) { show(bootImg); return Promise.resolve(); }
    var r = rect(bootFace), cc = center(r);
    var src = face && shown(face) ? center(rect(face)) : { x: cc.x < W() / 2 ? 6 : W() - 6, y: cc.y };
    return c.move(src.x, src.y).then(c.press).then(function () {
      if (onGrab) onGrab();
      c.chip('⌥');
      var g = Ghost(bootImg.currentSrc || bootImg.src, c.color);
      g.at(c.x, c.y);
      var drop = Box(c.color), over = false;
      return c.move(cc.x + rnd(-24, 24), cc.y + rnd(-24, 24), {
        onMove: function (x, y) {
          g.at(x, y);
          var inside = Math.hypot(x - cc.x, y - cc.y) < r.width / 2;
          if (inside !== over) { over = inside; if (inside) { drop.fit(r, 3); drop.on(); } else drop.off(); }
        }
      }).then(function () {
        g.remove();
        drop.remove();
        return c.release();
      });
    }).then(function () {
      show(bootImg);
      return tween(260, function (e) {
        setS(bootImg, 'scale', (1.18 - 0.18 * e).toFixed(4));
        setS(bootImg, 'opacity', e.toFixed(3));
      }, ease.out);
    }).then(function () {
      var s2 = Box(c.color).handles(true);
      s2.track(function () { return rect(bootFace); }, 2);
      s2.on();
      return wait(rnd(200, 260)).then(function () { s2.remove(); });
    }).then(function () { emit('face'); });
  }

  /* The photo, dragged in from the edge of the screen and dropped on the
     left end of the header frame. The hand that does this does every image. */
  function jobMarkPhoto(c) {
    if (!face || !shown(face)) { show(face); emit('markPhoto'); return Promise.resolve(); }
    var fr = rect(face), fc = center(fr);
    var src = (face.querySelector('img') || bootImg);
    src = src ? (src.currentSrc || src.src) : '';
    var gs = [];
    return c.move(6, clamp(fc.y + rnd(110, 170), 60, H() - 60)).then(function () {
      return c.idleUntil(when('frame'));
    }).then(c.press).then(function () {
      var hi = rect(headInner);
      var g = Ghost(src, c.color);
      g.at(c.x, c.y);
      return c.move(fc.x, fc.y, {
        onMove: function (x, y) {
          g.at(x, y);
          if (!gs.length && Math.hypot(x - fc.x, y - fc.y) < 46) {
            gs = [guide(c.color, hi.left - 8, fc.y, hi.right + 8, fc.y),
                  guide(c.color, fr.left, hi.top - 7, fr.left, hi.bottom + 7)];
          }
        }
      }).then(function () { g.remove(); return c.release(); });
    }).then(function () {
      show(face);
      tween(260, function (e) { setS(face, 'scale', (0.5 + 0.5 * e).toFixed(3)); }, ease.back).catch(function () {});
      var sel = Box(c.color).handles(true);
      sel.track(function () { return rect(face); }, 2);
      sel.on();
      return wait(rnd(220, 280)).then(function () {
        sel.remove();
        gs.forEach(function (g) { g.remove(); });
      });
    }).then(function () { emit('markPhoto'); });
  }

  /* The name and where I am, each made in the header frame. */
  function jobMarkText(c) {
    return c.idleUntil(when('frame')).then(function () {
      return jobMake(c, markName);
    }).then(function () {
      return jobMake(c, markWhere);
    }).then(function () { emit('markText'); });
  }

  /* The nav: each label made in its place, the current page styled, then
     the group dragged onto the centre line and nudged up a pixel or two. */
  function jobNav(c) {
    if (!nav || !shown(nav)) { emit('nav'); return Promise.resolve(); }
    var links = [].slice.call(nav.querySelectorAll('a'));
    var DX = NAV_DX, DY = NAV_DY;
    var simple = !DX && !DY;

    var i = 0;
    function makeNext() {
      if (i >= links.length) return Promise.resolve();
      return jobMake(c, links[i++]).then(makeNext);
    }

    return c.idleUntil(when('frame')).then(makeNext).then(function () {
      /* the current page gets its inverted pill */
      var here = nav.querySelector('a.is-here') || links[0];
      var hr = rect(here);
      return c.move(hr.left + hr.width * 0.5, hr.top + hr.height * 0.55).then(c.click).then(function () {
        var sel = Box(c.color);
        sel.track(function () { return rect(here); }, 1);
        sel.on();
        nav.classList.remove('bi-plain');
        return wait(380).then(function () { sel.remove(); });
      });
    }).then(function () {
      if (simple) return;
      /* select the group and drag it onto its line */
      var nr = rect(nav);
      var gx = nr.left + nr.width * rnd(0.55, 0.7), gy = nr.top + nr.height * 0.5;
      var sel = Box(c.color).handles(true);
      sel.track(function () { return rect(nav); }, 3);
      return c.move(gx, gy).then(c.press).then(function () {
        sel.on();
        var finalCx = nr.left + nr.width / 2 + DX;
        var centred = Math.abs(finalCx - W() / 2) < 6;
        var hi = rect(headInner);
        return dragTo(c, nav, { x: gx + DX, y: gy }, gx + DX, gy, {
          base: { x: 0, y: DY },
          guides: function () {
            return centred
              ? [guide(c.color, W() / 2, hi.top - 7, W() / 2, hi.bottom + 7)]
              : [guide(c.color, nr.right + DX, hi.top - 7, nr.right + DX, hi.bottom + 7)];
          }
        });
      }).then(c.release).then(function () {
        return wait(rnd(160, 240));
      }).then(function () {
        /* ↑ ↑ ↑ */
        var n = DY;
        function nudge() {
          if (n <= 0) return Promise.resolve();
          n--;
          c.chip('↑');
          setS(nav, 'translate', '0px ' + n + 'px');
          return wait(rnd(120, 170)).then(nudge);
        }
        return nudge();
      }).then(function () {
        return wait(200);
      }).then(function () {
        return c.move(c.x + rnd(-40, 40), c.y + rnd(70, 110)).then(c.click).then(function () { sel.remove(); });
      });
    }).then(function () { emit('nav'); });
  }

  /* The word under the spiral: made small, the box pulled out to display
     size, then nudged up onto its line. */
  function jobWord(c) {
    if (!skills || !wordOut || !shown(skills)) { show(wordOut); emit('word'); return Promise.resolve(); }
    var S0 = WORD_S0, DY = WORD_DY;
    return jobMake(c, wordOut).then(function () {
    }).then(function () {
      /* select it, and pull a corner out until it is display size */
      var sel = Box(c.color).handles(true);
      sel.track(function () { return rect(skills); }, 4);
      sel.on();
      var r = rect(skills), cc = center(r);
      var fs = parseFloat(getComputedStyle(skills).fontSize) || 80;
      var hx = r.right + 4, hy = r.bottom + 4;
      var full = { w: r.width / S0, h: r.height / S0 };
      var tx = cc.x + full.w / 2 + 4, ty = cc.y + full.h / 2 + 4;
      return c.move(hx, hy).then(c.press).then(function () {
        var scale = function (x) {
          var s = clamp(S0 + (1 - S0) * (x - hx) / (tx - hx), S0, 1.08);
          setS(skills, 'scale', s.toFixed(4));
          sel.badge(Math.round(fs * s) + ' px');
        };
        /* past it, and back */
        return c.move(tx + (tx - hx) * 0.05, ty + (ty - hy) * 0.05, { overshoot: false, bend: 0.02, onMove: scale })
          .then(function () { return wait(rnd(80, 140)); })
          .then(function () { return c.move(tx, ty, { overshoot: false, dur: 220, onMove: scale }); })
          .then(function () { setS(skills, 'scale', '1'); sel.badge(null); });
      }).then(c.release).then(function () {
        return wait(rnd(140, 220));
      }).then(function () {
        /* and up onto its line, centred */
        var rr = rect(skills), gp = { x: rr.left + rr.width * rnd(0.3, 0.45), y: rr.top + rr.height * 0.5 };
        return c.move(gp.x, gp.y).then(c.press).then(function () {
          var home = { x: gp.x, y: gp.y - DY };
          return dragTo(c, skills, home, home.x, home.y, {
            guides: function () {
              var q = rect(skills);
              return [guide(c.color, W() / 2, q.top - 40, W() / 2, q.bottom + 40)];
            },
            bend: 0
          });
        }).then(c.release);
      }).then(function () {
        return wait(rnd(160, 240));
      }).then(function () {
        return c.move(c.x + rnd(80, 140), c.y + rnd(-60, -30)).then(c.click).then(function () { sel.remove(); });
      });
    }).then(function () { emit('word'); });
  }

  /* The cards: two dragged in by hand (one of them sized up), the rest
     pasted in, and then — on the spiral — a hand on the tube to set it
     turning. */
  function jobCards(c) {
    var fun = side() === 'fun';
    var live = cards.filter(function (cd) { return fun ? !cd.classList.contains('fun-skip') : !cd.classList.contains('pro-skip'); });
    var spiral = hero.classList.contains('is-spiral');
    function score(cd) {
      var r = rect(cd);
      var ix = Math.max(0, Math.min(r.right, W()) - Math.max(r.left, 0));
      var iy = Math.max(0, Math.min(r.bottom, H()) - Math.max(r.top, 0));
      var o = spiral ? parseFloat(cd.style.opacity || '1') : 1;
      var full = r.right < W() - 10 && r.left > 10 && r.bottom < H() - 10 && r.top > 60 ? 1.6 : 1;
      return ix * iy * o * full;
    }
    var ranked = live.map(function (cd) { return { cd: cd, s: score(cd) }; })
      .filter(function (o) { return o.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
    if (!ranked.length) {
      cards.forEach(show);
      emit('cards');
      return Promise.resolve();
    }
    var A = ranked[0].cd, B = ranked[1] ? ranked[1].cd : null;

    function dragIn(cd, from) {
      var r = rect(cd), cc = center(r);
      var m = gain(cd);
      /* the point on the card being held: nearer the edge it comes in from */
      var hold = from === 'right' ? { x: r.left + r.width * 0.28, y: cc.y + rnd(-10, 10) }
               : from === 'left'  ? { x: r.right - r.width * 0.28, y: cc.y + rnd(-10, 10) }
               :                    { x: cc.x + rnd(-20, 20), y: r.top + r.height * 0.3 };
      var start = from === 'right' ? { x: W() - 5, y: clamp(hold.y + rnd(-30, 30), 80, H() - 40) }
                : from === 'left'  ? { x: 5, y: clamp(hold.y + rnd(-30, 30), 80, H() - 40) }
                :                    { x: clamp(hold.x + rnd(-40, 40), 20, W() - 20), y: H() - 5 };
      return c.move(start.x, start.y).then(c.press).then(function () {
        show(cd);
        return dragTo(c, cd, hold, hold.x, hold.y, {
          gain: m,
          guides: function () {
            var q = r;   /* where it is going, not where it is */
            return [
              guide(c.color, 0, q.top, W(), q.top),
              guide(c.color, q.left, 0, q.left, H())
            ];
          }
        });
      }).then(c.release);
    }

    var sideOf = function (cd) { return center(rect(cd)).x > W() / 2 ? 'right' : 'left'; };

    return dragIn(A, sideOf(A)).then(function () {
      if (!B) return;
      setS(B, 'scale', '0.8');
      return wait(rnd(120, 220)).then(function () {
        return dragIn(B, 'bottom');
      }).then(function () {
        /* select B and pull a corner out to full size */
        var sel = Box(c.color).handles(true);
        sel.track(function () { return rect(B); }, 2);
        sel.on();
        var r = rect(B), cc = center(r);
        var useBottom = r.bottom < H() - 24;
        var hx = r.right, hy = useBottom ? r.bottom : r.top;
        var tx = cc.x + (hx - cc.x) / 0.8, ty = cc.y + (hy - cc.y) / 0.8;
        var span = tx - hx || 1;
        return c.move(hx, hy).then(c.press).then(function () {
          return c.move(tx, ty, {
            overshoot: false, bend: 0.03,
            onMove: function (x) { setS(B, 'scale', clamp(0.8 + 0.2 * (x - hx) / span, 0.8, 1.02).toFixed(4)); }
          });
        }).then(function () {
          setS(B, 'scale', '1');
          return c.release();
        }).then(function () { return wait(240); }).then(function () { sel.remove(); });
      });
    }).then(function () {
      /* ⌘V: the rest land in a ripple out from where the hand is */
      return wait(rnd(160, 260)).then(function () {
        c.chip('⌘V');
        var here = { x: c.x, y: c.y };
        var rest = cards.filter(function (cd) { return cd !== A && cd !== B; });
        rest.sort(function (a, b) {
          var pa = center(rect(a)), pb = center(rect(b));
          return Math.hypot(pa.x - here.x, pa.y - here.y) - Math.hypot(pb.x - here.x, pb.y - here.y);
        });
        rest.forEach(function (cd, i) {
          setTimeout(function () {
            if (dead) return;
            setS(cd, 'scale', '0.86');
            show(cd);
            tween(260, function (e) { setS(cd, 'scale', (0.86 + 0.14 * e).toFixed(4)); }, ease.back).catch(function () {});
          }, 120 + i * 38);
        });
        return wait(140 + rest.length * 38 + 260);
      });
    }).then(function () {
      /* a hand on the tube: grab the space between the cards and throw it */
      if (!spiral || !JH.spiral || !JH.spiral.isActive()) return;
      var gx = W() * rnd(0.2, 0.3), gy = H() * rnd(0.42, 0.5);
      return c.move(gx, gy).then(c.press).then(function () {
        c.el.classList.add('grab');
        var last = c.x;
        return c.move(gx + W() * rnd(0.2, 0.26), gy + rnd(-16, 16), {
          overshoot: false, bend: 0.05,
          onMove: function (x) { JH.spiral.spin((x - last) / W()); last = x; }
        });
      }).then(function () {
        c.el.classList.remove('grab');
        JH.spiral.release();
        return c.release();
      });
    }).then(function () { emit('cards'); });
  }

  /* The icons, each clicked into place along the right of the frame. */
  function jobSocial(c) {
    var icons = social ? [].slice.call(social.querySelectorAll('.soc')).filter(shown) : [];
    if (!icons.length) return Promise.resolve();
    return c.idleUntil(when('frame')).then(function () {
      var i = 0;
      function next() {
        if (i >= icons.length) return Promise.resolve();
        var el = icons[i++];
        var q = center(rect(el));
        return c.move(q.x + rnd(-2, 2), q.y + rnd(-2, 2)).then(c.click).then(function () {
          setS(el, 'scale', '0.3');
          show(el);
          tween(300, function (e) { setS(el, 'scale', (0.3 + 0.7 * e).toFixed(3)); }, ease.back).catch(function () {});
          return wait(rnd(60, 140));
        }).then(next);
      }
      return next();
    });
  }

  /* The switch, dragged up from the bottom edge, with its margins shown. */
  function jobSwitch(c) {
    if (!switcher || !shown(switcher)) { show(switcher); return Promise.resolve(); }
    var r = rect(switcher), cc = center(r);
    var hold = { x: cc.x + rnd(-10, 10), y: cc.y };
    return c.move(clamp(hold.x + rnd(-20, 20), 20, W() - 20), H() - 4).then(c.press).then(function () {
      show(switcher);
      return dragTo(c, switcher, hold, hold.x, hold.y, {
        guides: function () {
          var q = r;
          var a = Measure(c.color), b = Measure(c.color);
          a.set(q.right, q.top + q.height / 2, W(), q.top + q.height / 2);
          b.set(q.left + q.width / 2, q.bottom, q.left + q.width / 2, H());
          return [a, b];
        }
      });
    }).then(c.release).then(function () {
      return c.move(c.x - rnd(70, 120), c.y - rnd(40, 80));
    });
  }

  /* The last pass: the gap between the face and the name, measured and
     tightened a few pixels at a time. */
  function jobReview(c) {
    /* wait near the name for it to be typed */
    var m0 = markText ? rect(markText) : null;
    var start = m0 ? c.move(m0.left + m0.width * 0.7, m0.bottom + rnd(50, 70)) : Promise.resolve();
    return start.then(function () {
      return c.idleUntil(Promise.all([when('markText'), when('markPhoto')]));
    }).then(function () {
      if (!markText || !face || !shown(markText)) return;
      var tr = rect(markText);
      return c.move(tr.left + tr.width * 0.5, tr.top + tr.height * 0.5).then(c.click).then(function () {
        var sel = Box(c.color).handles(true);
        sel.track(function () { return rect(markText); }, 2);
        sel.on();
        var mm = Measure(c.color);
        var upd = function () {
          var a = rect(face), b = rect(markText);
          mm.set(a.right, a.top + a.height / 2, b.left, a.top + a.height / 2);
        };
        upd();
        var steps = [3, 3, 2], k = 0, off = 8;
        function nudge() {
          if (k >= steps.length) return Promise.resolve();
          off -= steps[k++];
          c.chip('←');
          setS(markText, 'translate', off + 'px 0px');
          upd();
          return wait(rnd(140, 180)).then(nudge);
        }
        return wait(200).then(nudge).then(function () { return wait(260); }).then(function () {
          mm.remove();
          return c.move(c.x + rnd(30, 50), c.y + rnd(36, 50)).then(c.click).then(function () { sel.remove(); });
        });
      });
    });
  }

  /* The contact panel, once the page has scrolled down to it and the
     leather is open: each line of the heading, the note and the address,
     made by whoever is free. */
  function contactPieces() {
    if (!contact) return [];
    return [].slice.call(contact.querySelectorAll('h2 .line')).concat([note, contact.querySelector('.contact-mail')]).filter(Boolean);
  }

  /* Where to stop so the contact copy sits in the middle of the screen. */
  function contactY() {
    var wrap = contact.querySelector('.wrap') || contact;
    var r = rect(wrap);
    return Math.max(0, Math.round(r.top + window.scrollY - Math.max(70, (H() - r.height) / 2)));
  }

  /* ---- lanes: each hand's own queue of work for the walk down the page.
     Between jobs a hand roams; a new job waits for the roam step it is in
     the middle of, then takes the hand. */
  function roamFree(c) {
    var cut = function () { return c.queued > 0 || c.halt || dead; };
    function step() { return cut() ? Promise.resolve() : c.roam(cut).then(step); }
    return step();
  }
  function task(c, fn) {
    c.queued = (c.queued || 0) + 1;
    var p = (c.lane || Promise.resolve()).then(function () { c.queued--; return fn(); });
    c.lane = p.then(function () { return roamFree(c); });
    c.lane.catch(fail);
    p.catch(function () {});   /* a skip cancels it; whoever waits on it hears */
    return p;
  }

  /* The leather at the end, pulled open like a book: two hands take an
     edge each and draw them apart, and the band is only as wide as they
     have pulled it. */
  function openLeather(cs) {
    var L = JH.leather;
    if (!L || !L.panel) return Promise.resolve();
    var a = cs[0], b = cs[1 % cs.length];
    var r = rect(L.panel);
    var y = clamp(H() * 0.52, 80, H() - 80);
    var go = {}, ready = 0;
    go.p = new Promise(function (res) { go.r = res; });
    /* each edge is its own hand's job, so nothing else can take the hand
       while it is pulling; they set off together */
    function pull(c, left) {
      return task(c, function () {
        var yy = y + (left ? 0 : rnd(-26, 26));
        return c.move(left ? r.left + 3 : r.right - 3, yy).then(c.press).then(function () {
          if (++ready === 2) go.r();
          return go.p;
        }).then(function () {
          c.mid++;
          return tween(1700, function (k) {
            if (left) L.open(k);
            var q = rect(L.panel);
            c.x = left ? q.left + 3 : q.right - 3; c.y = yy;
            c.place();
          }, ease.inOut);
        }).then(function () {
          if (left) L.open(1);
          return c.release();
        });
      });
    }
    if (a === b) return pull(a, true);
    return Promise.all([pull(a, true), pull(b, false)]);
  }

  /* Wait for a panel the scroll is bringing in to be up. */
  function opened(panel) {
    return until(function () { return !panel || panel.style.opacity === '' || +panel.style.opacity > 0.3; });
  }

  /* Where a stroke is being drawn on: the end of the visible part of an
     SVG line whose dashoffset is walking it on. */
  function tipOf(el) {
    var len = el.getTotalLength ? el.getTotalLength() : 0;
    return function () {
      if (!len) return null;
      var off = parseFloat(el.style.strokeDashoffset);
      if (isNaN(off)) off = len;
      var d = clamp(len - off, 0, len);
      var m = el.getScreenCTM();
      if (!m) return null;
      var q = el.getPointAtLength(Math.max(d, 0.01)).matrixTransform(m);
      return { x: q.x, y: q.y, down: d > 0.5 && d < len - 0.5 };
    };
  }

  /* One hand draws the background's bounds. The real glyph field is revealed
     under the selection as it grows, then stays behind the finished watch. */
  function makeField(c) {
    var F = JH.field;
    if (!F) return Promise.resolve();
    return F.ready.then(function () {
      if (dead) throw ABORT;
      var r = rect(F.element);
      if (r.width < 1 || r.height < 1) { F.reveal(1); return; }
      var b = Box(c.color);
      var x0 = Math.max(8, r.left + 8), y0 = Math.max(8, r.top + 8);
      var x1 = Math.min(W() - 8, r.right - 8), y1 = Math.min(H() - 8, r.bottom - 8);
      return c.move(x0, y0).then(c.press).then(function () {
        b.set(x0, y0, 1, 1);
        b.on();
        return c.move(x1, y1, {
          overshoot: false, bend: 0, dur: 1800, ease: ease.inOut,
          onMove: function (x, y) {
            b.set(x0, y0, Math.max(1, x - x0), Math.max(1, y - y0));
            F.reveal((x - x0) / Math.max(1, x1 - x0), (y - y0) / Math.max(1, y1 - y0));
          }
        });
      }).then(function () {
        F.reveal(1);
        return c.release();
      }).then(function () { touch('field.js', c.color, 24); b.remove(); });
    });
  }

  /* The watch, made in front of you. The intro scrolls the page itself, so
     the watch's own scroll-driven build runs exactly as it does for anyone
     scrolling: one hand pulls the strap down out of the hero, one traces the
     case as its line is drawn on, one the crown, one sets the hands going
     and rides the hand round the dial. The others are already waiting where
     each era's title will appear, and type it as the panel opens; then the
     same for Now. Every hand is making something the whole way down. */
  function walkWatch(cs, pulling) {
    var Wt = JH.watch;
    var n = cs.length;
    var hand = cs[3 % n];
    var span = Wt.rev.end - Wt.rev.start;
    var at = function (f) { return Wt.rev.start + span * f; };
    var crown = null, kase = null;
    Wt.parts.forEach(function (el) {
      if (el.classList.contains('watch-crown')) crown = el;
      if (el.classList.contains('watch-case')) kase = el;
    });
    var B = {};
    B.p = new Promise(function (r) { B.r = r; });
    function followUntil(c, fn, p, steady) {
      return task(c, function () { var stop = c.follow(fn, 0.22, steady); return p.then(stop); });
    }

    /* A strap pulled down: grabbed at its root and drawn down to its full
       length, the leather coming with the hand. */
    function dragStrap(c, i, ms) {
      var el = Wt.straps[i];
      Wt.strap(i, 1);
      var full = rect(el);
      Wt.strap(i, 0);
      var x = full.left + full.width / 2;
      return c.move(x, full.top + 2).then(c.press).then(function () {
        c.mid++;
        return tween(ms, function (k) {
          Wt.strap(i, k);
          if (Math.random() < 0.06) touch('app.js', c.color, 2);
          c.x = x; c.y = Math.max(full.top + 2, rect(el).bottom - 2);
          c.place();
        }, ease.inOut);
      }).then(c.release);
    }

    /* A line drawn on: the hand goes round it and the line is there only as
       far as the hand has gone. */
    function trace(c, el, ms) {
      var len = el.getTotalLength();
      var at0 = function (k) {
        var m = el.getScreenCTM();
        return el.getPointAtLength(len * k).matrixTransform(m);
      };
      var p0 = at0(0);
      return c.move(p0.x, p0.y).then(c.press).then(function () {
        c.mid++;
        return tween(ms, function (k) {
          Wt.part(el, k);
          if (Math.random() < 0.06) touch('app.js', c.color, 2);
          var q = at0(k);
          c.x = q.x; c.y = q.y;
          c.place();
        }, ease.inOut);
      }).then(c.release);
    }

    /* The face of the dial, drawn in as a box over the case. */
    function makeFace(c) {
      var r = kase ? rect(kase) : null;
      if (!r) { Wt.face(1); return Promise.resolve(); }
      var b = Box(c.color, { fill: true });
      return c.move(r.left, r.top).then(c.press).then(function () {
        b.set(r.left, r.top, 1, 1);
        b.on();
        return c.move(r.right, r.bottom, {
          overshoot: false, bend: 0.02, dur: 420,
          onMove: function (x, y) {
            b.set(r.left, r.top, x - r.left, y - r.top);
            Wt.face(Math.min((x - r.left) / r.width, (y - r.top) / r.height));
          }
        });
      }).then(function () {
        Wt.face(1);
        return c.release();
      }).then(function () { b.remove(); });
    }

    /* The hands, put on at the hub; the same hand then holds the long one
       for the rest of the way round. */
    function setHands(c) {
      var q = center(rect(Wt.hub || kase));
      return c.move(q.x, q.y).then(c.click).then(function () {
        return tween(220, function (k) { Wt.hands(k); });
      });
    }

    var crew = cs.filter(function (c) { return c !== hand; });
    /* two hands a side: the panels open left and right of the dial */
    var lefts = crew.filter(function (c, i) { return i % 2 === 0; });
    var rights = crew.filter(function (c, i) { return i % 2 === 1; });
    function bySides(items) {
      var L = [], R = [];
      items.forEach(function (it) { (center(rect(it.nodeType ? it : it.el)).x < W() / 2 ? L : R).push(it); });
      if (!L.length || !R.length) return makeAll(crew, items);
      return Promise.all([makeAll(lefts, L), makeAll(rights, R)]);
    }
    /* before a panel opens, its hands are already over their side */
    function standBy() {
      lefts.forEach(function (c, i) { task(c, function () { return c.move(W() * (0.14 + 0.12 * i), H() * (0.32 + 0.22 * i)); }); });
      rights.forEach(function (c, i) { task(c, function () { return c.move(W() * (0.74 + 0.12 * i), H() * (0.32 + 0.22 * i)); }); });
    }

    /* The section comes up with nothing on it but the leather from the
       hero; then the watch is made on it, in order, by hand. */
    return scrollTo(Wt.build.end, 1600).then(function () {
      if (pulling) pulling.r();
      return wait(120);
    }).then(function () {
      return task(cs[4 % n], function () { return makeField(cs[4 % n]); });
    }).then(function () {
      var jobs = [task(cs[0], function () { return dragStrap(cs[0], 0, 650); })];
      if (crown && n > 2) jobs.push(task(cs[2], function () { return trace(cs[2], crown, 500); }));
      if (kase) jobs.push(task(cs[1 % n], function () { return trace(cs[1 % n], kase, 950); }));
      return Promise.all(jobs);
    }).then(function () {
      var face = cs[4 % n] === hand ? cs[0] : cs[4 % n];
      return Promise.all([
        task(cs[0], function () { return dragStrap(cs[0], 1, 600); }),
        task(face, function () { return makeFace(face); }),
        task(hand, function () { return setHands(hand); })
      ]);
    }).then(function () {
      progress(46, 'The story');
      pace('story');
      /* the hand that put the hands on holds the long one from here */
      if (Wt.mark) followUntil(hand, function () { return center(rect(Wt.mark)); }, B.p, true);
      Wt.dial(1);
      /* the years go on while the first era opens */
      makeAll(crew.slice(-2), text.dial).catch(function () {});   /* a skip cancels it */
    }).then(function () {
      var i = 0;
      function nextEra() {
        if (i >= text.eras.length) return Promise.resolve();
        var e = text.eras[i], peak = Wt.eras[i];
        i++;
        standBy();
        var n_ = i;
        return scrollTo(peak ? at(peak.at) : window.scrollY, 700)
          .then(function () { return opened(e.era); })
          .then(function () { return bySides(e.pieces); })
          .then(function () { progress(46 + 6 * n_, 'The story'); })
          .then(nextEra);
      }
      return nextEra();
    }).then(function () {
      standBy();
      return scrollTo(at(Wt.now.at), 700).then(function () {
        /* the hand is home at twelve: the hand holding it lets go and
           joins in */
        B.r();
        (lefts.length <= rights.length ? lefts : rights).push(hand);
        crew.push(hand);
        return Promise.all(Wt.now.els.map(opened));
      }).then(function () { return bySides(text.now); }).then(function () { progress(76, 'Contact'); });
    }).then(function () {
      /* one hand takes the bottom of the lower strap and drags it down,
         through the fold, into the contact panel */
      var lower = Wt.straps[1], holder = crew[0];
      var C = {};
      C.p = new Promise(function (r) { C.r = r; });
      letGoStrap = C.r;
      task(holder, function () {
        var tip = function () {
          var lr = rect(lower);
          var band = JH.leather && JH.leather.panel ? rect(JH.leather.panel) : null;
          if ((lr.height < 2 || lr.bottom > H() - 40) && band && band.top < H()) {
            return { x: band.left + band.width / 2, y: clamp(band.top + H() * 0.5, 60, H() - 60) };
          }
          return { x: lr.left + lr.width / 2, y: clamp(lr.bottom - 4, 60, H() - 60) };
        };
        var q = tip();
        return holder.move(q.x, q.y).then(holder.press).then(function () {
          var stop = holder.follow(tip, 0.3, true);
          return C.p.then(stop);
        }).then(holder.release);
      });
      return scrollTo(Wt.rev.end, 1000);
    });
  }

  /* Narrower screens draw the watch still and keep the story in the flow:
     the walk stops at the watch while a hand traces its case, then goes
     down the story a screenful at a time, the crew making what is on the
     screen before it moves on. */
  function walkFlow(cs) {
    var n = cs.length;
    var orbit = document.querySelector('.path-orbit');
    var kase = orbit && orbit.querySelector('.watch-case');
    var go = Promise.resolve();
    if (kase) {
      go = go.then(function () {
        var r = rect(kase);
        return scrollTo(Math.max(0, r.top + window.scrollY - (H() - r.height) / 2), 1500);
      }).then(function () {
        return task(cs[0], function () { return makeField(cs[0]); });
      }).then(function () {
        var who = cs[1 % n];
        var dials = makeAll(cs.filter(function (c) { return c !== who; }), text.dial);
        var trace = task(who, function () {
          var r = rect(kase), cc = center(r), R = r.width / 2;
          return who.move(cc.x, cc.y - R).then(who.press).then(function () {
            who.mid++;
            return tween(1000, function (e) {
              var a = -Math.PI / 2 + e * Math.PI * 2;
              who.x = cc.x + Math.cos(a) * R; who.y = cc.y + Math.sin(a) * R;
              who.place();
            }, ease.inOut);
          }).then(who.release);
        });
        return Promise.all([dials, trace]);
      });
    }
    var todo = [];
    text.eras.forEach(function (e) { todo = todo.concat(e.pieces); });
    todo = todo.concat(text.now);
    function made(it) { var el = it.el || it; return !el.hasAttribute('data-bi'); }
    function step() {
      var left = todo.filter(function (it) { return !made(it); });
      if (!left.length || dead) return Promise.resolve();
      var first = left[0].el || left[0];
      return scrollTo(Math.max(0, rect(first).top + window.scrollY - H() * 0.14), 900).then(function () {
        var batch = left.filter(function (it) {
          var r = rect(it.el || it);
          return r.top >= 40 && r.bottom <= H() - 30;
        });
        if (!batch.length) batch = [left[0]];
        return makeAll(cs, batch);
      }).then(step);
    }
    return go.then(step);
  }

  /* The rest of the page: it rises in under the hero, the view walks down
     through the watch and the story to the contact panel, builds that, and
     comes back up to the top for the opening. */
  function tour(cs) {
    var path = below[0];
    below.forEach(function (el) { if (el !== path) show(el); });
    cs.forEach(function (c) {
      c.lane = (c.lane || Promise.resolve()).then(function () { return roamFree(c); });
      c.lane.catch(fail);
    });
    var live = JH.watch && JH.watch.rev && document.querySelector('.path-orbit.is-live');
    /* From here the watch and the leather are made by hand, not by the
       scroll: both start unmade, and only the cursors move them on. */
    if (live && JH.watch.byHand) { JH.watch.byHand(true); JH.watch.paint(0); }
    progress(32, 'The watch');
    if (JH.leather) { JH.leather.byHand(true); JH.leather.open(0); }
    railMode(true);
    /* The dark section is drawn in as a panel across the foot of the
       screen, the strap's tab is made on the white above it, and a hand
       takes the tab and pulls: the page comes up with it, the black panel
       riding up over the hero. */
    var handover = real(500);    /* the panel slimmed out of the way first */
    var pr = path ? rect(path) : null;
    if (path && pr.top < H() - 2) {
      var painter = cs[0];
      handover = handover.then(function () { return task(painter, function () {
        var top = pr.top, b = Box(painter.color, { fill: true });
        return painter.move(8, top + 2).then(painter.press).then(function () {
          b.set(8, top, 1, 1);
          b.on();
          return painter.move(W() - 8, H() - 6, {
            overshoot: false, bend: 0.02, dur: 520,
            onMove: function (x, y) { b.set(8, top, x - 8, y - top); }
          });
        }).then(function () {
          show(path);
          return painter.release();
        }).then(function () { b.remove(); });
      }); });
    } else if (path) show(path);
    var tabbed = strap && live && shown(strap) && rect(strap).top < H();
    var puller = cs[1 % cs.length];
    var pulling = null;
    /* the tab is made on the white while the black panel is drawn in */
    var tabMade = tabbed ? task(puller, function () { return jobMake(puller, strap); }) : Promise.resolve(show(strap));
    return Promise.all([handover, tabMade]).then(function () {
      if (!tabbed) return;
      var P = {};
      P.p = new Promise(function (r) { P.r = r; });
      pulling = P;
      var grip = function () { var q = rect(strap); return { x: q.left + q.width / 2, y: q.top + 10 }; };
      task(puller, function () {
        var q = grip();
        return puller.move(q.x, q.y).then(puller.press).then(function () {
          var stop = puller.follow(grip, 0.35, true);
          return P.p.then(stop);
        }).then(puller.release);
      });
      return until(function () { return puller.el.classList.contains('down'); });
    }).then(function () {
      pace('watch');
      return live ? walkWatch(cs, pulling) : walkFlow(cs);
    }).then(function () {
      if (!contact) return;
      return scrollTo(contactY(), 1300).then(function () { return wait(250); }).then(function () {
        /* the panels below move as they arrive; settle on the copy */
        var wrap = contact.querySelector('.wrap') || contact;
        var r = rect(wrap);
        var want = Math.max(70, (H() - r.height) / 2);
        if (Math.abs(r.top - want) > 30) return scrollTo(window.scrollY + (r.top - want), 450);
      }).then(function () {
        if (letGoStrap) { letGoStrap(); letGoStrap = null; }
        return openLeather(cs).then(function () { return makeAll(cs, contactPieces()); })
          .then(function () { progress(92, 'Finishing'); pace('end'); });
      });
    }).then(function () {
      return wait(200);
    }).then(function () {
      return scrollTo(0, 2000);
    }).then(function () { return wait(150); });
  }

  /* The build is the loading. While the cursors work, everything further
     down the page that waits to be scrolled to (screenshots, photos, video
     posters) is fetched a few at a time, so by the time the view travels
     down — and when anyone scrolls for themselves — it is already there. */
  function warm() {
    var imgs = [];
    below.forEach(function (sec) {
      [].slice.call(sec.querySelectorAll('img[loading="lazy"]')).forEach(function (im) { imgs.push(im); });
    });
    cards.forEach(function (cd) {
      [].slice.call(cd.querySelectorAll('img[loading="lazy"]')).forEach(function (im) { imgs.push(im); });
    });
    var i = 0;
    (function batch() {
      if (dead || i >= imgs.length) return;
      imgs.slice(i, i + 4).forEach(function (im) { im.loading = 'eager'; });
      i += 4;
      setTimeout(batch, 260);
    })();
  }

  /* ------------------------------------------------------------ set up */

  var text = { eras: [], now: [], dial: [] };
  var contact = document.getElementById('contact');
  var note = null;
  var NAV_DX = W() > 680 ? 26 : 0, NAV_DY = W() > 680 ? 3 : 0;
  var WORD_S0 = 0.44, WORD_DY = 18;

  function arm() {
    doc.classList.add('bi-live');
    fetchAudio();
    /* on <html>, beside <body>, above everything the page has */
    doc.appendChild(root);
    doc.insertBefore(skip, document.body);
    hero.insertBefore(canvas, hero.firstChild);
    window.scrollTo(0, 0);

    head.classList.add('bi-noscrim');
    if (nav) nav.classList.add('bi-plain');
    hide(face);
    hide(bootFace);
    hide(bootImg);
    /* on a phone the face is lifted out of the flow and centred, where the
       opening will use it; app.js lets it back down when the opening ends */
    doc.classList.add('bi-face');
    if (social) [].slice.call(social.querySelectorAll('.soc')).forEach(hide);
    cards.forEach(hide);
    hide(switcher);
    hide(strap);
    below.forEach(hide);

    /* Everything the cursors will make is hidden now, in the flow, so the
       canvas starts blank and nothing moves when it is made. */
    [markName, markWhere, wordOut].forEach(hide);
    if (nav) [].slice.call(nav.querySelectorAll('a')).forEach(hide);
    if (contact) {
      var n = contact.querySelector('.contact-note');
      note = n && (n.querySelector('.side-' + side()) || n);
      contactPieces().forEach(hide);
    }
    /* the story: each era's pieces, the year column beside the last one,
       then Now and what I'm aiming at, and the certificates */
    var right = document.querySelector('.path-right');
    var eraEls = [].slice.call(document.querySelectorAll('.era'));
    eraEls.forEach(function (era, i) {
      var ps = pieces(era.querySelector('.era-copy'));
      [].slice.call(era.querySelectorAll('.era-media')).forEach(function (m) { pieces(m, ps); });
      if (right && i === eraEls.length - 1) pieces(right, ps);
      ps.forEach(hidePiece);
      text.eras.push({ era: era, pieces: ps });
    });
    ['.path-now', '.path-picks'].forEach(function (sel) {
      var ps = pieces(document.querySelector(sel));
      ps.forEach(hidePiece);
      text.now = text.now.concat(ps);
    });
    /* the certificates round the watch, each one made by a hand */
    var certs = document.querySelector('.path-certs');
    if (certs && side() === 'pro') {
      [].slice.call(certs.children).forEach(function (li) { hide(li); text.now.push(li); });
    }
    text.dial = [].slice.call(document.querySelectorAll('.path-dial li, .path-year'));
    text.dial.forEach(hide);

    /* and the things that start out of place, for the cursors to fix */
    if (nav && (NAV_DX || NAV_DY)) setS(nav, 'translate', (-NAV_DX) + 'px ' + NAV_DY + 'px');
    if (skills) {
      setS(skills, 'scale', String(WORD_S0));
      setS(skills, 'translate', '0px ' + WORD_DY + 'px');
    }

    skip.addEventListener('click', function () { finish(true); });
    document.addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);
    raf = requestAnimationFrame(loop);
  }

  function onKey(e) { if (e.key === 'Escape') finish(true); }
  var w0 = window.innerWidth;
  function onResize() { if (Math.abs(window.innerWidth - w0) > 2) finish(true); }

  /* ------------------------------------------------------------ act one

     Before anything is built, the visitor sees it asked for. A chat box on
     the white page; one click (sound needs one) and a cursor comes in,
     types "Create Jeffrey's portfolio", and holds the mic: my own voice adds
     "and play Loser by Tame Impala" while the waveform jumps. Sent; a beat
     of thinking; the answer comes back in writing and out loud; "Spawning
     agents…" — and five dots fly out of the reply and become the cursors on
     the beat the band comes in, while the text box folds down into the
     progress bar. Everything in here runs on the music's own clock. */

  var MUSIC = 'assets/audio/loser-intro.mp3';
  var VOICE = 'assets/audio/voice-play-loser.mp3';
  /* The clip opens on the beat the band comes in; the agents spawn on the
     next downbeat but one. (Measured off the song: it is 83 bpm, and the
     band arrives at 0:10.69; the clip starts at 0:10.63.) */
  var CLIP_AT = 10.63, SONG_LEN = 223.1;
  var SPAWN = 1.18;
  var VOICE_LEN = 3.0;
  var SPOKEN = ['and', 'play', 'Loser', 'by', 'Tame', 'Impala'];

  var snd = { ctx: null, gain: null, music: null, voice: null, an: null, t0: 0, bufs: null, src: [] };
  var T0 = 0;

  function clk() {
    if (snd.ctx && snd.t0) return snd.ctx.currentTime - snd.t0;
    return (performance.now() - T0) / 1000;
  }
  /* resolves on the frame the clock reaches s */
  function at(s) {
    return new Promise(function (res, rej) {
      var f = function () {
        if (dead) { off(); rej(ABORT); return; }
        if (clk() >= s) { off(); res(); }
      };
      function off() { var k = followers.indexOf(f); if (k >= 0) followers.splice(k, 1); }
      followers.push(f);
    });
  }
  /* a pause in real milliseconds, whatever speed the session plays at */
  function real(ms) { return wait(ms / TIME); }

  function fetchAudio() {
    if (!window.fetch) return;
    snd.bufs = Promise.all([MUSIC, VOICE].map(function (u) {
      return fetch(u).then(function (r) { if (!r.ok) throw r; return r.arrayBuffer(); });
    })).catch(function () { return null; });
  }

  /* inside the click: the audio has to be woken by the visitor's gesture */
  function wakeAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    try { if (AC) { snd.ctx = new AC(); snd.ctx.resume(); } } catch (e) { snd.ctx = null; }
    try {
      if (window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
    } catch (e) {}
  }
  var decoded = null;
  function decodeAudio() {
    if (decoded) return decoded;
    return (decoded = decodeOnce());
  }
  function decodeOnce() {
    if (!snd.ctx || !snd.bufs) return Promise.resolve(false);
    var ctx = snd.ctx;
    var timeout = new Promise(function (r) { setTimeout(function () { r(null); }, 4000); });
    return Promise.race([snd.bufs, timeout]).then(function (bufs) {
      if (!bufs) return false;
      return Promise.all(bufs.map(function (b) {
        return new Promise(function (res, rej) { ctx.decodeAudioData(b.slice(0), res, rej); });
      })).then(function (d) { snd.music = d[0]; snd.voice = d[1]; return true; }, function () { return false; });
    });
  }
  function startMusic() {
    T0 = performance.now();
    if (!snd.ctx || !snd.music) return;
    var ctx = snd.ctx;
    snd.gain = ctx.createGain();
    snd.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    snd.gain.gain.linearRampToValueAtTime(0.78, ctx.currentTime + 0.04);
    snd.gain.connect(ctx.destination);
    var src = ctx.createBufferSource();
    src.buffer = snd.music;
    snd.man = ctx.createAnalyser();
    snd.man.fftSize = 64;
    src.connect(snd.man);
    snd.man.connect(snd.gain);
    snd.t0 = ctx.currentTime + 0.05;
    src.start(snd.t0);
    snd.src.push(src);
  }
  /* the music dipped under something said, and back */
  function duck(v, over) {
    if (!snd.gain) return;
    var g = snd.gain.gain, t = snd.ctx.currentTime;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + over); } catch (e) {}
  }
  function playVoice() {
    if (!snd.ctx || !snd.voice) return;
    var ctx = snd.ctx;
    var src = ctx.createBufferSource();
    src.buffer = snd.voice;
    snd.an = ctx.createAnalyser();
    snd.an.fftSize = 256;
    var vg = ctx.createGain();
    vg.gain.value = 1.0;
    src.connect(snd.an);
    snd.an.connect(vg);
    vg.connect(ctx.destination);
    src.start(snd.ctx.currentTime + 0.03);
    snd.src.push(src);
  }
  /* the answer, out loud; resolves when it has been said */
  function say(text) {
    return new Promise(function (done) {
      var finished_ = false;
      function end() { if (!finished_) { finished_ = true; done(); } }
      setTimeout(end, 4200);                       /* never wait on it for long */
      if (!window.speechSynthesis) { setTimeout(end, 1600); return; }
      speak(text, end);
    });
  }
  function speak(text, end) {
    try {
      if (!window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(text);
      var vs = speechSynthesis.getVoices();
      var en = vs.filter(function (v) { return /^en[-_](US|GB|AU)/i.test(v.lang); });
      var pick_ = null;
      ['Samantha', 'Siri', 'Ava', 'Allison', 'Google US English', 'Jenny', 'Aria', 'Zira'].some(function (n) {
        pick_ = en.filter(function (v) { return v.name.indexOf(n) >= 0; })[0];
        return !!pick_;
      });
      if (pick_ || en[0]) u.voice = pick_ || en[0];
      u.rate = 1.03;
      u.onend = function () { setTimeout(end, 120); };
      u.onerror = function () { end(); };
      speechSynthesis.speak(u);
    } catch (e) { setTimeout(end, 1600); }
  }
  function hush(fast) {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    if (!snd.ctx) return;
    var ctx = snd.ctx;
    var over = fast ? 0.35 : 2.6;
    try {
      if (snd.gain) {
        snd.gain.gain.cancelScheduledValues(ctx.currentTime);
        snd.gain.gain.setValueAtTime(snd.gain.gain.value, ctx.currentTime);
        snd.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + over);
      }
    } catch (e) {}
    setTimeout(function () {
      snd.src.forEach(function (s_) { try { s_.stop(); } catch (e) {} });
      try { ctx.close(); } catch (e) {}
    }, over * 1000 + 100);
  }

  var MIC = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var SEND = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var chat = null, ui = {};
  function buildChat() {
    chat = make('div', 'bi-chat');
    root.insertBefore(chat, layer);   /* under the cursors */
    var bars = '';
    for (var i = 0; i < 26; i++) bars += '<i></i>';
    chat.innerHTML =
      '<div class="bi-thread"></div>' +
      '<div class="bi-composer">' +
        '<div class="bi-input"><span class="bi-ph">Ask anything…</span><span class="bi-typed"></span><span class="bi-tcaret"></span></div>' +
        '<span class="bi-wave">' + bars + '</span>' +
        '<span class="bi-btn bi-mic">' + MIC + '</span>' +
        '<span class="bi-btn bi-send">' + SEND + '</span>' +
      '</div>';
    ui.press = make('button', 'bi-press');
    ui.press.type = 'button';
    ui.press.textContent = 'Press to start';
    root.insertBefore(ui.press, layer);
    ui.thread = chat.querySelector('.bi-thread');
    ui.composer = chat.querySelector('.bi-composer');
    ui.input = chat.querySelector('.bi-input');
    ui.typed = chat.querySelector('.bi-typed');
    ui.wave = chat.querySelector('.bi-wave');
    ui.bars = [].slice.call(ui.wave.children);
    ui.mic = chat.querySelector('.bi-mic');
    ui.send = chat.querySelector('.bi-send');

  }

  function typeInto(el, text, base) {
    var i = 0;
    function next() {
      if (i >= text.length) return Promise.resolve();
      el.textContent += text[i++];
      chat.classList.add('has-text');
      var d = base * rnd(0.6, 1.5) + (text[i - 1] === ' ' ? 40 : 0);
      return real(d).then(next);
    }
    return next();
  }

  /* an answer arrives the way they do: a word or two at a time */
  function streamInto(el, text) {
    var words = text.split(/(\s+)/), i = 0;
    function next() {
      if (i >= words.length) return Promise.resolve();
      el.textContent += words[i++] + (words[i] && /^\s+$/.test(words[i]) ? words[i++] : '');
      return real(rnd(55, 95)).then(next);
    }
    return next();
  }

  /* the waveform: the voice's own levels while it plays */
  var waving = null;
  function waveOn() {
    ui.composer.classList.add('is-recording');
    var data = snd.an ? new Uint8Array(snd.an.frequencyBinCount) : null;
    waving = function () {
      var lvl;
      if (data) { snd.an.getByteFrequencyData(data); }
      ui.bars.forEach(function (b, k) {
        if (data) {
          var v = 0, from = 2 + k * 2;
          for (var z = from; z < from + 3; z++) v += data[z] || 0;
          lvl = v / (3 * 255);
        } else lvl = 0.25 + 0.5 * Math.abs(Math.sin(performance.now() / 140 + k));
        b.style.transform = 'scaleY(' + Math.max(0.12, Math.min(1, lvl * 1.6)).toFixed(3) + ')';
      });
    };
    followers.push(waving);
  }
  function waveOff() {
    ui.composer.classList.remove('is-recording');
    var k = followers.indexOf(waving);
    if (k >= 0) followers.splice(k, 1);
    ui.bars.forEach(function (b) { b.style.transform = ''; });
  }

  function bubble(who, html) {
    var row = make('div', 'bi-msg bi-' + who, ui.thread);
    if (who === 'me') {
      var src = (bootImg && (bootImg.currentSrc || bootImg.src)) || '';
      row.innerHTML = '<span class="bi-text"></span><img class="bi-av" alt="" src="' + src + '">';
    } else {
      row.innerHTML = '<span class="bi-av bi-av-ai"></span><span class="bi-text"></span>';
    }
    var t = row.querySelector('.bi-text');
    if (html) t.innerHTML = html;
    requestAnimationFrame(function () { row.classList.add('on'); });
    return t;
  }

  function act1(cs0) {
    var c = cs0;
    /* A white screen and two words. Anywhere will do — the screen is the
       button — and Enter or Space works too. Nothing plays yet. */
    var started = new Promise(function (res) {
      var go = function (e) {
        if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e && e.type === 'keydown') e.preventDefault();
        root.removeEventListener('click', go);
        document.removeEventListener('keydown', go);
        wakeAudio();
        res();
      };
      root.addEventListener('click', go);
      document.addEventListener('keydown', go);
    });
    requestAnimationFrame(function () { ui.press.classList.add('on'); });

    return started.then(function () {
      T0 = performance.now();
      ui.press.classList.add('gone');
      chat.classList.add('on');
      decodeAudio();                      /* ready by the time it is wanted */
      return real(700);
    }).then(function () {
      /* the cursor comes in and clicks into the box */
      var ir = rect(ui.input);
      return c.move(ir.left + 18, ir.top + ir.height / 2);
    }).then(c.click).then(function () {
      chat.classList.add('is-focused');
      return real(220);
    }).then(function () {
      c.move(c.x + 30, c.y + 26, { overshoot: false }).catch(function () {});
      return typeInto(ui.typed, "Create Jeffrey's portfolio", 78);
    }).then(function () {
      var mr = center(rect(ui.mic));
      return real(260).then(function () { return c.move(mr.x, mr.y); });
    }).then(c.click).then(function () {
      /* my voice, and the words as they are said */
      return decodeAudio().then(function () {
        playVoice();
        waveOn();
        var step = (VOICE_LEN - 0.6) / SPOKEN.length;
        SPOKEN.forEach(function (w_, k) {
          real((0.2 + k * step) * 1000).then(function () { ui.typed.textContent += ' ' + w_; }, function () {});
        });
        return real(VOICE_LEN * 1000 + 100);
      });
    }).then(function () {
      return c.click();
    }).then(function () {
      waveOff();
      var sr = center(rect(ui.send));
      return c.move(sr.x, sr.y);
    }).then(c.click).then(function () {
      /* sent: it goes up into the thread, and the box empties */
      var said = ui.typed.textContent;
      ui.typed.textContent = '';
      chat.classList.remove('has-text');
      bubble('me').textContent = said;
      chat.classList.add('has-thread');
      return real(260);
    }).then(function () {
      var t = bubble('ai', '<span class="bi-thinking">Thinking</span>');
      return real(950).then(function () { return t; });
    }).then(function (t) {
      /* the answer, written and said — and when it has been said, the song
         cuts in, on the beat the band arrives */
      t.textContent = '';
      var spoken = say('Okay. Playing Loser, by Tame Impala.');
      return streamInto(t, 'Okay. Playing Loser by Tame Impala, and creating Jeffrey’s portfolio.').then(function () {
        return spoken;
      }).then(function () {
        startMusic();
        var sp = make('span', 'bi-spawn', t);
        sp.innerHTML = 'Spawning agents<span class="bi-dots">' +
          PALETTE.slice(1).map(function (col) { return '<b style="--c:' + col + '"></b>'; }).join('') + '</span>';
        return at(0.45);
      });
    }).then(function () {
      return spawn();
    });
  }

  /* The handover. The dots fly out of the reply to where each agent
     starts, and the text box turns into the editor panel: it slides over to
     the left edge, then stretches up and down from the middle to the full
     height of the screen, and fills in — the conversation, the files, the
     song, the progress bar. It lies over the page being built: one screen,
     not a second one. Resolves on the beat with where the dots landed. */
  function spawn() {
    var dots = [].slice.call(chat.querySelectorAll('.bi-dots b'));
    makePanel();
    var pageX = wideScreen() ? PANEL_X + PANEL_W + 14 : 0;
    var pageW = W() - pageX;
    var spots = [[0.56, 0.16], [0.34, 0.74], [0.84, 0.56], [0.8, 0.22]];
    var landed = dots.map(function (d, i) {
      var r = rect(d), cc = center(r);
      var to = { x: pageX + pageW * spots[i % spots.length][0], y: H() * spots[i % spots.length][1] };
      var fly = make('span', 'bi-fly', layer);
      fly.style.setProperty('--c', PALETTE[i + 1]);
      fly.style.transform = 'translate(' + cc.x + 'px,' + cc.y + 'px)';
      d.style.visibility = 'hidden';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          fly.classList.add('go');
          fly.style.transform = 'translate(' + to.x + 'px,' + to.y + 'px) scale(1.4)';
        });
      });
      return { el: fly, x: to.x, y: to.y };
    });

    morphPanel();
    chat.classList.add('folding');
    canvas.classList.add('on');
    return at(SPAWN).then(function () {
      setTimeout(function () { if (chat) chat.remove(); chat = null; }, 700);
      landed.forEach(function (l) { setTimeout(function () { l.el.remove(); }, 200); });
      return landed;
    });
  }

  /* ---- the editor panel ------------------------------------------------- */

  var PANEL_W = 300;
  var panel = null, bar = null, files = {};
  function wideScreen() { return W() > 680; }

  /* The chat becomes the panel, all of it. First the conversation sinks
     down into the text box, as if the box took it in; then the box goes
     dark, slides across to the left edge at its own height, and opens up
     and down from the middle to the top and bottom of the panel's room;
     then its content comes in, the conversation among it. */
  var PANEL_X = 14, PANEL_TOP = 76;     /* under the header, so it stays seen */
  function morphPanel() {
    var thread = ui.thread;
    var chatBox = panel.querySelector('.bi-pn-chat');
    if (!wideScreen()) {
      chatBox.appendChild(thread);
      panel.classList.add('on');
      return;
    }
    var cr = rect(ui.composer), tr = rect(thread);
    /* 1. the conversation fades down into the box */
    thread.style.transition = 'transform .5s cubic-bezier(.5,0,.75,.3), opacity .45s ease-in';
    thread.style.transform = 'translateY(' + Math.round((cr.top - tr.bottom) + tr.height * 0.6) + 'px)';
    thread.style.opacity = '0';
    /* 2. the box fills with the panel's own colour, from its middle out */
    var ink = make('span', 'bi-ink', ui.composer);
    setTimeout(function () { if (!dead) ink.classList.add('on'); }, 300);
    var ps = panel.style;
    setTimeout(function () {
      if (dead) return;
      /* 3. it is the panel now, in the box's place: across to the left */
      ps.transition = 'none';
      ps.left = cr.left + 'px'; ps.top = cr.top + 'px';
      ps.width = cr.width + 'px'; ps.height = cr.height + 'px';
      ps.right = 'auto'; ps.bottom = 'auto';
      ps.borderRadius = (cr.height / 2) + 'px';
      panel.classList.add('on', 'morph');
      ui.composer.style.visibility = 'hidden';
      panel.getBoundingClientRect();
      var ease_ = 'cubic-bezier(.65,0,.25,1)';
      ps.transition = 'left .55s ' + ease_ + ', width .55s ' + ease_ + ', top .6s ' + ease_ + ', height .6s ' + ease_ + ', border-radius .55s ' + ease_;
      ps.left = PANEL_X + 'px';
      ps.width = PANEL_W + 'px';
      ps.borderRadius = '18px';
    }, 720);
    setTimeout(function () {
      if (dead) return;
      /* 4. open up and down from where it is */
      ps.top = PANEL_TOP + 'px';
      ps.height = (H() - PANEL_TOP - 14) + 'px';
    }, 1260);
    setTimeout(function () {
      if (dead) return;
      /* handed to the stylesheet's own placing, which is where it is now */
      ps.transition = 'none';
      ps.left = ps.top = ps.width = ps.height = ps.right = ps.bottom = ps.borderRadius = '';
      panel.getBoundingClientRect();
      ps.transition = '';
      panel.classList.remove('morph');
      /* 5. the conversation, back, in its place in the panel */
      chatBox.appendChild(thread);
      thread.style.transition = 'none';
      thread.style.transformOrigin = '0 0';
      thread.style.transform = 'translateY(10px)';
      thread.style.opacity = '0';
      thread.getBoundingClientRect();
      thread.style.transition = 'transform .5s var(--ease-out), opacity .45s ease-out';
      thread.style.transform = '';
      thread.style.opacity = '1';
    }, 1900);
  }
  var FILES = [
    ['jeffreyhamilton.com', 0, 1], ['index.html', 1], ['styles.css', 1], ['app.js', 1], ['intro.js', 1],
    ['field.js', 1], ['fun.js', 1], ['assets', 1, 1], ['portrait.jpg', 2], ['shots', 2, 1], ['audio', 2, 1]
  ];

  function bar_x_placeholder(p) { return p.querySelector('.bi-pn-x'); }
  function makePanel() {
    if (panel) return panel;
    panel = make('aside', 'bi-panel');
    root.insertBefore(panel, layer);
    var eq = '';
    for (var i = 0; i < 12; i++) eq += '<i></i>';
    panel.innerHTML =
      '<div class="bi-pn-head"><span class="bi-pn-dots"><i></i><i></i><i></i></span>' +
        '<span class="bi-pn-title">jeffreyhamilton.com</span><span class="bi-pn-x">×</span></div>' +
      '<div class="bi-pn-chat"></div>' +
      '<div class="bi-pn-sec">Files</div>' +
      '<ul class="bi-pn-files">' + FILES.map(function (f) {
        return '<li class="bi-f' + (f[2] ? ' dir' : '') + '" style="--d:' + f[1] + '" data-f="' + f[0] + '">' +
          '<span class="bi-f-ic"></span><span class="bi-f-n">' + f[0] + (f[2] ? '/' : '') + '</span><span class="bi-f-c"></span></li>';
      }).join('') + '</ul>' +
      '<div class="bi-music"><span class="bi-art"><i></i></span>' +
        '<span class="bi-mu-t"><b>Loser</b><em>Tame Impala</em></span><span class="bi-eq">' + eq + '</span>' +
        '<span class="bi-mu-line"><span class="bi-mu-now">0:10</span><span class="bi-mu-bar"><i></i></span><span class="bi-mu-end">3:43</span></span></div>' +
      '<div class="bi-progress"><span class="bi-pg-row"><span class="bi-pg-label">Building</span>' +
        '<span class="bi-pg-stage"></span><span class="bi-pg-pct">0%</span></span>' +
        '<span class="bi-pg-track"><span class="bi-pg-fill"></span></span></div>';
    /* on a phone the sheet is at the foot and the header is being built at
       the top: skip moves into the sheet, out of the way */
    if (!wideScreen()) panel.querySelector('.bi-pn-head').insertBefore(skip, bar_x_placeholder(panel));
    [].slice.call(panel.querySelectorAll('.bi-f')).forEach(function (li) {
      files[li.getAttribute('data-f')] = { li: li, n: 0, c: li.querySelector('.bi-f-c'), t: 0 };
    });
    var pg = panel.querySelector('.bi-progress');
    bar = { el: pg, p: 0, fill: pg.querySelector('.bi-pg-fill'), pct: pg.querySelector('.bi-pg-pct'),
            stage: pg.querySelector('.bi-pg-stage'), x: panel.querySelector('.bi-pn-x') };

    /* the song: its own levels on the equaliser, its place in the song */
    var bars = [].slice.call(panel.querySelectorAll('.bi-eq i'));
    var now = panel.querySelector('.bi-mu-now'), line = panel.querySelector('.bi-mu-bar i');
    var data = null;
    followers.push(function () {
      if (snd.man && !data) data = new Uint8Array(snd.man.frequencyBinCount);
      if (data) snd.man.getByteFrequencyData(data);
      bars.forEach(function (b, n) {
        var v = data ? (data[1 + n] || 0) / 255 : 0.3 + 0.3 * Math.sin(performance.now() / 180 + n);
        b.style.transform = 'scaleY(' + Math.max(0.12, Math.min(1, v * 1.15)).toFixed(3) + ')';
      });
      var at_ = CLIP_AT + Math.max(0, clk());
      now.textContent = Math.floor(at_ / 60) + ':' + ('0' + Math.floor(at_ % 60)).slice(-2);
      line.style.transform = 'scaleX(' + Math.min(1, at_ / SONG_LEN).toFixed(4) + ')';
    });
    return panel;
  }

  /* a file being written to: lit in the colour of the hand writing it, its
     count of new lines going up */
  function touch(name, color, lines) {
    var f = files[name];
    if (!f) return;
    f.n += lines || Math.round(rnd(3, 16));
    f.c.textContent = '+' + f.n;
    f.li.style.setProperty('--c', color || '#5B3CE8');
    f.li.classList.add('busy', 'touched');
    clearTimeout(f.t);
    f.t = setTimeout(function () { f.li.classList.remove('busy'); }, 900);
  }
  function fileFor(el) {
    if (!el || !el.closest) return 'index.html';
    if (el.closest('.spiral-card')) return 'shots';
    if (el.closest('.side-switch')) return 'fun.js';
    if (el.closest('.mark-face, .boot-face')) return 'portrait.jpg';
    if (el.closest('.path-dial, .path-year')) return 'app.js';
    return 'index.html';
  }

  /* for the walk down the page the panel slims to a rail, out of the way of
     the panels coming in on the right of the watch */
  function railMode(on) {
    if (!panel || !wideScreen()) return;     /* a phone keeps its sheet */
    panel.classList.toggle('rail', on);
  }

  function progress(p, stage) {
    if (!bar) return;
    bar.p = Math.max(bar.p, Math.min(100, p));
    bar.fill.style.transform = 'scaleX(' + (bar.p / 100).toFixed(3) + ')';
    panel.style.setProperty('--p', (bar.p / 100).toFixed(3));
    bar.pct.textContent = Math.round(bar.p) + '%';
    if (stage) bar.stage.textContent = stage;
  }

  /* Done. Back at the top the panel opens out again with the page beside
     it; the bar says Complete and the voice says so; a hand clicks the bar,
     then the panel's ×, and the panel slides away as the page grows back. */
  function closePanel(c) {
    if (!panel) return Promise.resolve();
    progress(100, '');
    bar.el.classList.add('done');
    bar.pct.textContent = 'Complete ✓';
    Object.keys(files).forEach(function (k) { files[k].li.classList.add('done'); });
    duck(0.32, 0.3);
    var said = say('Complete. Have a good day, Jeffrey.');
    var r = rect(bar.el);
    return c.move(r.left + r.width * 0.4, r.top + r.height / 2).then(c.click).then(function () {
      panel.classList.add('picked');
      return said;
    }).then(function () {
      duck(0.6, 0.6);
      var xr = center(rect(bar.x));
      return c.move(xr.x, xr.y);
    }).then(c.click).then(function () {
      panel.classList.add('gone');
      return real(700);
    });
  }

  /* ------------------------------------------------------------ the run */

  var IMG = 1;
  var PALETTE = ['#5B3CE8', '#0B93D6', '#0E9F6E', '#E08A00', '#E23D8A'];

  function run(first, spots) {
    pace('start');
    var wide = W() > 680;
    var w = W(), h = H();
    var cs;
    var sp = function (i, fx, fy) { var p = spots && spots[i - 1]; return p ? [p.x, p.y] : [fx, fy]; };
    var mk = function (i, col, fx, fy, speed, hand) {
      var q = sp(i, fx, fy);
      var c = Cursor(col, q[0], q[1], speed, hand);
      c.el.classList.add('pop');
      return c;
    };
    if (wide) {
      cs = [
        first || Cursor(PALETTE[0], -30, h * 0.18, 1.0, 1),
        mk(1, PALETTE[1], w * 0.62, -30, 0.92, -1),
        mk(2, PALETTE[2], w * 0.32, h + 30, 1.06, 1),
        mk(3, PALETTE[3], w + 30, h * 0.55, 0.96, -1),
        mk(4, PALETTE[4], w + 30, h * 0.12, 1.04, 1)
      ];
    } else {
      cs = [
        first || Cursor(PALETTE[0], -30, h * 0.14, 1.0, 1),
        mk(1, PALETTE[1], w + 30, h * 0.08, 0.95, -1),
        mk(2, PALETTE[3], w * 0.4, h + 30, 1.05, 1),
        mk(3, PALETTE[2], w + 30, h * 0.6, 0.98, -1)
      ];
    }
    progress(2, 'Header');

    crew = cs;
    function after(ms, fn) { return function () { return wait(ms).then(fn); }; }
    function seq() {
      var fns = [].slice.call(arguments);
      return function () { return fns.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); };
    }
    IMG = wide ? 3 : 1;   /* the one hand that handles every image */
    var img = cs[IMG];

    /* Nobody waits at the start: the jobs that need the header frame go to
       hands that have something else to make first, and the frame is the
       first thing drawn. */
    var scripts = wide ? [
      after(0, seq(function () { return jobFrame(cs[0]); }, function () { return jobMarkText(cs[0]); })),
      after(560, function () { return jobWord(cs[1]); }),
      after(1500, seq(function () { return jobSwitch(cs[2]); }, function () { return jobSocial(cs[2]); })),
      after(240, seq(function () { return jobCards(img); }, function () { return jobMarkPhoto(img); })),
      after(1000, function () { return cs[4].move(w * 0.5 + rnd(-40, 40), 90).then(function () { return jobNav(cs[4]); }); })
    ] : [
      after(0, seq(function () { return jobFrame(cs[0]); }, function () { return jobMarkText(cs[0]); }, function () { return jobNav(cs[0]); })),
      after(240, seq(function () { return jobCards(img); }, function () { return jobMarkPhoto(img); })),
      after(620, function () { return jobWord(cs[2]); }),
      after(1100, function () { return jobSwitch(cs[3]); })
    ];

    /* Each collaborator works through their own list. One who finishes
       early goes on looking the page over until everyone is done. */
    var left = scripts.length, settle;
    var allDone = new Promise(function (r) { settle = r; });
    scripts.forEach(function (script, i) {
      var c = cs[i];
      c.lane = script().then(function () {
        progress(4 + 26 * (scripts.length - left + 1) / scripts.length, left > 1 ? 'Header & projects' : 'The watch');
        if (--left === 0) settle();
        else return c.idleUntil(allDone);
      });
      c.lane.catch(fail);
    });
    warm();
    return allDone.then(function () { return tour(cs); }).then(function () { return reveal(cs); });
  }

  function fail(e) {
    if (e === ABORT) return;
    if (window.console) console.error(e);
    finish(true);
  }

  /* The end. Back at the top, the image hand makes the face last of all —
     the circle drawn, the photo option-dragged down out of the header into
     it — while the others gather round. Then every hand goes in to the
     middle and slips behind the face, which is what the opening (app.js)
     spins into the gold dot. */
  var under = null;
  var letGoStrap = null;
  /* the hands' layer, moved in just under the face so they can go in
     behind it */
  function tuckUnder(list) {
    var center_ = bootFace && bootFace.closest('[data-intro]');
    if (!center_ || !center_.parentNode) return;
    if (!under) {
      under = make('div', 'bi-under');
      var z = parseInt(getComputedStyle(center_).zIndex, 10);
      under.style.zIndex = String((isNaN(z) ? 10 : z) - 1);
      var sr = rect(center_.parentNode);
      under.style.left = (-sr.left) + 'px';
      under.style.top = (-sr.top) + 'px';
      center_.parentNode.insertBefore(under, center_);
    }
    list.forEach(function (c) { under.appendChild(c.el); });
  }

  /* The end. Back at the top: the bar says Complete and a hand clicks it
     and closes it, while the image hand draws the intro face's circle and
     the rest gather round. Then the photo is picked up out of the header —
     and the moment it is, every other hand heads in to the middle, slipping
     behind the face as the photo lands in it. */
  function reveal(cs) {
    pace('end');
    frames.forEach(function (b) { b.remove(); });
    canvas.classList.remove('on');
    var img = cs[IMG % cs.length];
    var others = cs.filter(function (c) { return c !== img; });
    var closer = others[1] || others[0];
    railMode(false);
    return real(700).then(function () {
      return task(closer, function () { return closePanel(closer); });
    }).then(function () { return endScene(cs, img, others); });
  }
  function endScene(cs, img, others) {
    var target = bootFace && shown(bootFace) ? center(rect(bootFace)) : { x: W() / 2, y: H() / 2 };
    var R = bootFace ? rect(bootFace).width / 2 : 80;
    var gather = cs.map(function (c, i) {
      if (c === img) return task(c, function () { return jobFaceCircle(c); });
      var a = (i / cs.length) * Math.PI * 2 + rnd(-0.3, 0.3);
      return task(c, function () {
        return c.move(target.x + Math.cos(a) * (R + rnd(40, 80)), target.y + Math.sin(a) * (R + rnd(30, 60)));
      });
    });
    return Promise.all(gather).then(function () {
      return task(img, function () {
        return jobFacePhoto(img, function () {
          tuckUnder(others);
          others.forEach(function (c) {
            c.halt = true;
            c.move(target.x + rnd(-6, 6), target.y + rnd(-6, 6),
              { dur: rnd(1000, 1300), overshoot: false, exit: true, bend: rnd(-0.25, 0.25) }).catch(function () {});
          });
        });
      });
    }).then(function () {
      tuckUnder([img]);
      img.halt = true;
      return img.move(target.x, target.y, { dur: 520, overshoot: false, exit: true });
    }).then(function () {
      return wait(120);
    }).then(function () { finish(false); });
  }

  /* ------------------------------------------------------------ the end

     The same clean-up for a natural ending and a skip: every wrapped text
     node put back, every property written taken off, every class removed.
     What is left is the page as it is with no intro at all. */

  var finished = false;
  function finish(instant) {
    if (finished) return;
    finished = true;
    dead = true;
    hush(instant);

    tweens.splice(0).forEach(function (t) { t.rej(ABORT); });
    followers.length = 0;

    restorers.splice(0).forEach(function (fn) { fn(); });
    touched.forEach(function (el) {
      (el._biProps || []).forEach(function (p) { el.style.removeProperty(p); });
      delete el._biProps;
    });
    touched.length = 0;
    [].slice.call(document.querySelectorAll('[data-bi]')).forEach(function (el) { el.removeAttribute('data-bi'); });
    head.classList.remove('bi-noscrim');
    if (nav) nav.classList.remove('bi-plain');

    document.removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);

    var hadFocus = document.activeElement === skip;
    skip.remove();
    doc.classList.remove('bi-on', 'bi-live');
    if (JH.spiral) JH.spiral.release();
    seen();
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    if (hadFocus) {
      var first = document.querySelector('.mark');
      if (first) first.focus({ preventScroll: true });
    }

    if (under) { under.remove(); under = null; }
    if (JH.watch && JH.watch.byHand) JH.watch.byHand(false);
    if (JH.leather) JH.leather.byHand(false);
    if (instant) {
      if (window.scrollY > 0) {
        if (JH.lenis) JH.lenis.scrollTo(0, { immediate: true, force: true });
        window.scrollTo(0, 0);
      }
      cancelAnimationFrame(raf);
      root.remove();
      canvas.remove();
    } else {
      root.classList.add('out');
      canvas.classList.remove('on');
      setTimeout(function () { cancelAnimationFrame(raf); root.remove(); canvas.remove(); }, 520);
    }
    /* built: the cursors finished, so the face and its lines (app.js) take
       over from here. A skip goes straight to the finished page. */
    document.dispatchEvent(new CustomEvent('introdone', { detail: { built: !instant } }));
  }

  function bail() {
    doc.classList.remove('bi-on', 'bi-live');
    seen();
    document.dispatchEvent(new Event('introdone'));
  }

  /* ------------------------------------------------------------ go */

  /* No loading screen: a white page with the chat on it. The page loads
     under it (warm, above) while the visitor reads and clicks. */
  arm();
  buildChat();
  warm();
  var opener = Cursor(PALETTE[0], W() + 30, H() * 0.82, 1.0, 1);
  act1(opener).then(function (spots) { return run(opener, spots); }).catch(fail);
})();

/* Replay, wired whether or not the intro played this time. */
(function () {
  var btn = document.querySelector('.replay-intro');
  if (!btn) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  btn.hidden = false;
  btn.addEventListener('click', function () {
    try { sessionStorage.removeItem('jh-intro-seen'); } catch (e) {}
    window.scrollTo(0, 0);
    location.href = location.pathname + '?intro';
  });
})();
