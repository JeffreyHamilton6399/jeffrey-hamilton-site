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
  var TIME = 0.7;

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
  var loader = make('div', 'bi-loader', root);
  loader.innerHTML =
    '<div class="bi-load">' +
      '<p class="bi-load-label"><span class="bi-load-dot"></span>Preparing your experience</p>' +
      '<div class="bi-bar"><span class="bi-fill"></span></div>' +
      '<p class="bi-pct"><span class="bi-num">0</span>%</p>' +
    '</div>';
  var fill = loader.querySelector('.bi-fill');
  var num  = loader.querySelector('.bi-num');

  var skip = make('button', 'bi-skip');
  skip.type = 'button';
  skip.innerHTML = 'Skip intro <span aria-hidden="true">&rarr;</span>';

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

  /* ---- the text caret and the text box that grows with what is typed ---- */

  function TextBox(color, groups) {
    var box = Box(color, {});
    var caret = make('span', 'bi-caret blink', layer);
    caret.style.setProperty('--c', color);
    var all = [];
    groups.forEach(function (g) { all = all.concat(g); });
    var follow = function () {
      var last = null, l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (var i = 0; i < all.length; i++) {
        if (!all[i].classList.contains('on')) continue;
        var cr = all[i].getBoundingClientRect();
        last = cr;
        l = Math.min(l, cr.left); t = Math.min(t, cr.top);
        r = Math.max(r, cr.right); b = Math.max(b, cr.bottom);
      }
      /* the caret: at the start of a fresh line, or after the last letter */
      var cx, cy, ch;
      if (self.at || !last) {
        var lr = (self.at || all[0]).getBoundingClientRect();
        cx = lr.left - 1; cy = lr.top; ch = lr.height;
        if (!last) { l = lr.left; t = lr.top; r = lr.left; b = lr.bottom; }
        else { l = Math.min(l, lr.left); r = Math.max(r, lr.left); b = Math.max(b, lr.bottom); }
      } else {
        cx = last.right + 0.5; cy = last.top; ch = last.height;
      }
      caret.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)';
      caret.style.height = ch.toFixed(1) + 'px';
      box.set(l - 5, t - 3, (r - l) + 10, (b - t) + 6);
    };
    followers.push(follow);
    var self = {
      at: null,
      box: box,
      show: function () { follow(); box.on(); caret.classList.add('on'); },
      typing: function (v) { caret.classList.toggle('blink', !v); },
      done: function () {
        var at = followers.indexOf(follow);
        if (at >= 0) followers.splice(at, 1);
        caret.remove();
        box.remove();
      }
    };
    return self;
  }

  /* Wrap a text node's characters in spans so they can be uncovered one at
     a time. The original node is kept and put back as it was. */
  var restorers = [];
  function charify(el) {
    var out = [];
    if (!el) return out;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var txt = node.nodeValue;
      var m = txt.match(/^(\s*)([\s\S]*?)(\s*)$/);
      var wrap = document.createElement('span');
      wrap.className = 'bi-w';
      if (m[1]) wrap.appendChild(document.createTextNode(m[1]));
      for (var i = 0; i < m[2].length; i++) {
        var c = document.createElement('span');
        c.className = 'bi-c';
        c.textContent = m[2][i];
        wrap.appendChild(c);
        out.push(c);
      }
      if (m[3]) wrap.appendChild(document.createTextNode(m[3]));
      node.parentNode.replaceChild(wrap, node);
      restorers.push(function () { if (wrap.parentNode) wrap.parentNode.replaceChild(node, wrap); });
    });
    return out;
  }

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
        var dur = o.dur || clamp(170 + 135 * Math.log2(1 + d / 26), 200, 1150) * c.speed * rnd(0.9, 1.12);
        var bend = (o.bend != null ? o.bend : rnd(-0.14, 0.14) + c.hand * 0.07) * d;
        var nx = -dy / d, ny = dx / d;
        var os = (o.overshoot !== false && d > 240 && Math.random() < 0.5) ? rnd(5, 11) : 0;
        var tx = x + (dx / d) * os, ty = y + (dy / d) * os;
        var c1x = x0 + dx * 0.3 + nx * bend, c1y = y0 + dy * 0.3 + ny * bend;
        var c2x = x0 + dx * 0.75 + nx * bend * 0.45, c2y = y0 + dy * 0.75 + ny * bend * 0.45;
        var ph = Math.random() * 6;
        var p = tween(dur, function (e, raw) {
          if (id !== c.mid) return;
          var q = 1 - e;
          var px = q * q * q * x0 + 3 * q * q * e * c1x + 3 * q * e * e * c2x + e * e * e * tx;
          var py = q * q * q * y0 + 3 * q * q * e * c1y + 3 * q * e * e * c2y + e * e * e * ty;
          var tr = Math.sin(Math.PI * raw) * 0.7;
          c.x = px + Math.sin(raw * 23 + ph) * tr;
          c.y = py + Math.cos(raw * 19 + ph) * tr;
          c.place();
          if (o.onMove) o.onMove(c.x, c.y);
        }, ease.hand);
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
        return wait(rnd(60, 150)).then(c.press).then(c.release);
      },
      /* the hand resting on the mouse: tiny drifts while thinking */
      idle: function (ms) {
        var end = performance.now() + ms;
        var ax = c.x, ay = c.y;
        function step() {
          var left = end - performance.now();
          if (left < 60) return wait(Math.max(left, 0));
          var dur = Math.min(left, rnd(260, 520));
          return c.move(ax + rnd(-7, 7), ay + rnd(-5, 5), { dur: dur, bend: 0, overshoot: false }).then(step);
        }
        return step();
      },
      /* wait on another collaborator without freezing */
      idleUntil: function (promise) {
        var done = false;
        promise.then(function () { done = true; });
        function step() {
          if (done) return Promise.resolve();
          return c.idle(rnd(140, 240)).then(step);
        }
        return step();
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

  /* Type characters that are already in the page, uncovering them one by
     one at a person's pace: uneven, a touch slower after a space, now and
     then a pause to think. A typo is typed, noticed, and taken back. */
  function type(chars, tb, o) {
    o = o || {};
    var base = o.base || 70;
    var i = 0;
    tb.typing(true);
    function next() {
      if (i >= chars.length) { tb.typing(false); return Promise.resolve(); }
      var ch = chars[i];
      var prev = chars[i - 1];
      var d = base * rnd(0.55, 1.45) + (prev && prev.textContent === ' ' ? 45 : 0) +
              (Math.random() < 0.07 ? rnd(110, 240) : 0);
      if (o.typoAt === i && o.typo) {
        var real = ch.textContent;
        return wait(d).then(function () {
          ch.textContent = o.typo; ch.classList.add('on');
          return wait(base * 1.2);
        }).then(function () {
          tb.typing(false);
          return wait(rnd(240, 340));          /* …that's not right */
        }).then(function () {
          tb.typing(true);
          ch.classList.remove('on'); ch.textContent = real;   /* backspace */
          return wait(rnd(110, 160));
        }).then(function () {
          ch.classList.add('on'); i++;
          return next();
        });
      }
      return wait(d).then(function () { ch.classList.add('on'); i++; return next(); });
    }
    return next();
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
      return wait(160);
    }).then(function () {
      guides.forEach(function (g) { g.remove(); });
    });
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

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

  /* The face dropped in and dragged into the frame, then the name typed. */
  function jobMark(c) {
    if (!face || !shown(face)) return Promise.resolve(emit('mark'));
    var fr = rect(face), fc = center(fr);
    var hi = rect(headInner);
    var sx = clamp(fc.x + rnd(80, 120), 30, W() - 30);
    var sy = clamp(fc.y + rnd(120, 170), 60, H() - 60);
    var nameChars = text.name;
    var whereChars = text.where;
    var dot = markWhere && markWhere.querySelector('.dot');

    return c.move(sx, sy).then(c.press).then(function () {
      /* dropped in: it lands under the cursor and swells to size */
      show(face);
      setS(face, 'translate', (sx - fc.x) + 'px ' + (sy - fc.y) + 'px');
      tween(220, function (e) { setS(face, 'scale', (0.6 + 0.4 * e).toFixed(3)); }, ease.back);
      return wait(rnd(120, 200));
    }).then(function () {
      return dragTo(c, face, fc, fc.x, fc.y, {
        guides: function () {
          return [
            guide(c.color, hi.left - 8, fc.y, hi.right + 8, fc.y),
            guide(c.color, fr.left, hi.top - 7, fr.left, hi.bottom + 7)
          ];
        }
      });
    }).then(c.release).then(function () {
      var sel = Box(c.color).handles(true);
      sel.track(function () { return rect(face); }, 2);
      sel.on();
      return wait(320).then(function () { sel.remove(); });
    }).then(function () {
      if (!nameChars.length) return;
      var r0 = rect(nameChars[0]);
      return c.move(r0.left + 2, r0.top + r0.height / 2).then(c.click).then(function () {
        var tb = TextBox(c.color, [nameChars, whereChars]);
        tb.show();
        /* the hand comes off the mouse while typing */
        c.move(c.x + rnd(26, 44), c.y + rnd(22, 34), { overshoot: false }).catch(function () {});
        return type(nameChars, tb, { base: 52 }).then(function () {
          return wait(rnd(120, 180));          /* Enter */
        }).then(function () {
          tb.at = whereChars[0] || null;
          show(dot);
          return wait(rnd(120, 180));
        }).then(function () {
          tb.at = null;
          return type(whereChars, tb, { base: 50 });
        }).then(function () {
          return wait(rnd(200, 300));
        }).then(function () {
          /* click away to commit */
          return c.move(c.x + rnd(60, 110), c.y + rnd(40, 70)).then(c.click).then(function () { tb.done(); });
        });
      });
    }).then(function () { emit('mark'); });
  }

  /* The nav: each label typed into its link, the current page styled, then
     the group dragged onto the centre line and nudged up a pixel or two. */
  function jobNav(c) {
    if (!nav || !shown(nav)) { emit('nav'); return Promise.resolve(); }
    var links = [].slice.call(nav.querySelectorAll('a'));
    var groups = text.nav;
    var DX = NAV_DX, DY = NAV_DY;
    var simple = !DX && !DY;

    var i = 0;
    function typeNext() {
      if (i >= groups.length) return Promise.resolve();
      var cs = groups[i++];
      if (!cs.length) return typeNext();
      var r = rect(cs[0]);
      return c.move(r.left + 1, r.top + r.height / 2).then(c.click).then(function () {
        var tb = TextBox(c.color, [cs]);
        tb.show();
        c.move(c.x + rnd(8, 18), c.y + rnd(16, 26), { overshoot: false }).catch(function () {});
        return type(cs, tb, { base: 68 }).then(function () {
          return wait(rnd(90, 170));
        }).then(function () { tb.done(); return typeNext(); });
      });
    }

    return c.idleUntil(when('frame')).then(typeNext).then(function () {
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

  /* The word under the spiral: a text box, the word typed (with one slip),
     the box pulled out to display size, then nudged up onto its line. */
  function jobWord(c) {
    if (!skills || !wordOut || !shown(skills)) { emit('word'); return Promise.resolve(); }
    var chars = text.word;
    if (!chars.length) { emit('word'); return Promise.resolve(); }
    var S0 = WORD_S0, DY = WORD_DY;

    /* one typo, on a letter in the middle of a longer word */
    var typoAt = -1, typo = null;
    var KEYS = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    for (var k = Math.floor(chars.length * 0.45); k < chars.length - 2; k++) {
      var ch = chars[k].textContent.toUpperCase();
      var at = KEYS.indexOf(ch);
      if (at >= 0) { typoAt = k; typo = KEYS[(at + 1) % KEYS.length]; break; }
    }

    var r0 = rect(chars[0]);
    return c.move(r0.left + 1, r0.top + r0.height * 0.5).then(c.click).then(function () {
      var tb = TextBox(c.color, [chars]);
      tb.show();
      c.move(c.x + rnd(20, 40), c.y + rnd(30, 50), { overshoot: false }).catch(function () {});
      return type(chars, tb, { base: 78, typoAt: typoAt, typo: typo }).then(function () {
        return wait(rnd(180, 260));
      }).then(function () { tb.done(); });
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
    var live = cards.filter(function (cd) { return !(fun && cd.classList.contains('fun-skip')); });
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
      return c.idleUntil(when('mark'));
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

  /* ------------------------------------------------------------ set up */

  var text = { name: [], where: [], word: [], nav: [] };
  var NAV_DX = W() > 680 ? 26 : 0, NAV_DY = W() > 680 ? 3 : 0;
  var WORD_S0 = 0.44, WORD_DY = 18;

  function arm() {
    doc.classList.add('bi-live');
    document.body.appendChild(root);
    document.body.insertBefore(skip, document.body.firstChild);
    hero.insertBefore(canvas, hero.firstChild);
    window.scrollTo(0, 0);

    head.classList.add('bi-noscrim');
    if (nav) nav.classList.add('bi-plain');
    hide(face);
    if (social) [].slice.call(social.querySelectorAll('.soc')).forEach(hide);
    cards.forEach(hide);
    hide(switcher);
    hide(strap);
    below.forEach(hide);

    /* Every letter the cursors will type, wrapped and hidden now, in the
       flow, so the canvas starts blank and nothing reflows as they come. */
    text.name = charify(markName);
    text.where = charify(markWhere);
    text.word = charify(wordOut);
    text.nav = nav ? [].slice.call(nav.querySelectorAll('a')).map(function (a) {
      return charify(a.querySelector('.side-' + side()) || a);
    }) : [];
    hide(markWhere && markWhere.querySelector('.dot'));

    /* and the things that start out of place, for the cursors to fix */
    if (nav && (NAV_DX || NAV_DY)) setS(nav, 'translate', (-NAV_DX) + 'px ' + NAV_DY + 'px');
    if (skills) {
      setS(skills, 'scale', String(WORD_S0));
      setS(skills, 'translate', '0px ' + WORD_DY + 'px');
    }
    if (markText && W() > 680) setS(markText, 'translate', '8px 0px');

    skip.addEventListener('click', function () { finish(true); });
    document.addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);
    raf = requestAnimationFrame(loop);
  }

  function onKey(e) { if (e.key === 'Escape') finish(true); }
  var w0 = window.innerWidth;
  function onResize() { if (Math.abs(window.innerWidth - w0) > 2) finish(true); }

  /* ------------------------------------------------------------ loading

     The bar measures what the first screen needs before anything is built
     on it: the three faces of type, the portrait, and the screenshots the
     first screen shows. It never runs faster than the minimum, so a warm
     cache still gets the beat, and never waits more than a few seconds on a
     slow line — the build is all real elements, so anything still on its
     way simply arrives into place. */

  function load() {
    var jobs = [];
    if (document.fonts && document.fonts.load) {
      ['400 1em Anton', '500 1em "JetBrains Mono"', '400 1em Inter'].forEach(function (f) {
        jobs.push(document.fonts.load(f));
      });
    }
    var srcs = [];
    var faceImg = face && face.querySelector('img');
    if (faceImg) srcs.push(faceImg.currentSrc || faceImg.src);
    var shot = side() === 'fun' ? '.card-fun img' : '.card-shot img';
    cards.slice(0, 9).forEach(function (cd) {
      var im = cd.querySelector(shot) || cd.querySelector('img');
      if (im) srcs.push(im.currentSrc || im.src);
    });
    srcs.forEach(function (src) {
      jobs.push(new Promise(function (res) {
        var im = new Image();
        im.onload = im.onerror = res;
        im.src = src;
        if (im.decode) im.decode().then(res, res);
      }));
    });

    var total = jobs.length || 1, done = 0;
    jobs.forEach(function (p) { Promise.resolve(p).then(tick, tick); });
    function tick() { done++; }

    var MIN = 2000, MAX = 6500;
    var t0 = performance.now(), shownP = 0;
    return new Promise(function (resolve, reject) {
      (function frame() {
        if (dead) { reject(ABORT); return; }
        var t = performance.now() - t0;
        var real = t > MAX ? 1 : done / total;
        var pace = ease.inOut(Math.min(1, t / MIN));
        var target = Math.min(real, pace);
        shownP += (target - shownP) * 0.14;
        if (target >= 1 && shownP > 0.995) shownP = 1;
        fill.style.transform = 'scaleX(' + shownP.toFixed(4) + ')';
        num.textContent = Math.round(shownP * 100);
        if (shownP >= 1) { resolve(); return; }
        requestAnimationFrame(frame);
      })();
    });
  }

  /* ------------------------------------------------------------ the run */

  var PALETTE = ['#5B3CE8', '#0B93D6', '#0E9F6E', '#E08A00', '#E23D8A'];

  function run() {
    var wide = W() > 680;
    var w = W(), h = H();
    var cs;
    if (wide) {
      cs = [
        Cursor(PALETTE[0], -30, h * 0.18, 1.0, 1),
        Cursor(PALETTE[1], w * 0.62, -30, 0.92, -1),
        Cursor(PALETTE[2], w * 0.32, h + 30, 1.06, 1),
        Cursor(PALETTE[3], w + 30, h * 0.55, 0.96, -1),
        Cursor(PALETTE[4], w + 30, h * 0.12, 1.04, 1)
      ];
    } else {
      cs = [
        Cursor(PALETTE[0], -30, h * 0.14, 1.0, 1),
        Cursor(PALETTE[1], w + 30, h * 0.08, 0.95, -1),
        Cursor(PALETTE[3], w * 0.4, h + 30, 1.05, 1)
      ];
    }

    function after(ms, fn) { return function () { return wait(ms).then(fn); }; }

    var scripts = wide ? [
      after(0,   function () { return jobFrame(cs[0]).then(function () { return jobMark(cs[0]); }); }),
      after(260, function () { return cs[1].move(w * 0.5 + rnd(-40, 40), 90).then(function () { return jobNav(cs[1]); }); }),
      after(140, function () { return jobWord(cs[2]); }),
      after(520, function () { return jobCards(cs[3]); }),
      after(420, function () {
        return cs[4].move(w * 0.86, 110).then(function () { return jobSocial(cs[4]); })
          .then(function () { return jobSwitch(cs[4]); })
          .then(function () { return jobReview(cs[4]); });
      })
    ] : [
      after(0,   function () { return jobFrame(cs[0]).then(function () { return jobMark(cs[0]); }); }),
      after(300, function () { return jobCards(cs[1]).then(function () { return jobNav(cs[1]); }); }),
      after(120, function () { return jobWord(cs[2]).then(function () { return jobSwitch(cs[2]); }); })
    ];

    /* Each collaborator works through their own list. One who finishes
       early rests a hand on the page until everyone is done. */
    var left = scripts.length, settle;
    var allDone = new Promise(function (r) { settle = r; });
    scripts.forEach(function (script, i) {
      script().then(function () {
        cs[i].done = true;
        if (--left === 0) settle();
        else return cs[i].idleUntil(allDone);
      }).catch(fail);
    });
    return allDone.then(function () { return reveal(cs); });
  }

  function fail(e) {
    if (e === ABORT) return;
    if (window.console) console.error(e);
    finish(true);
  }

  /* All hands off. A beat to look it over, then the scaffolding goes — the
     grid, the frames, the cursors — and the page below rises into place. */
  function reveal(cs) {
    return wait(420).then(function () {
      frames.forEach(function (b) { b.remove(); });
      canvas.classList.remove('on');
      cs.forEach(function (c) {
        var q = { x: c.x, y: c.y };
        var tx = q.x < W() / 2 ? -40 : W() + 40;
        var ty = q.y + rnd(-40, 40);
        c.halt = true;
        c.el.classList.add('leaving');
        c.move(tx, ty, { dur: rnd(520, 700), overshoot: false, exit: true }).catch(function () {});
      });
      /* the panel below comes up over the bottom of the hero */
      var path = below[0];
      if (path) {
        var pr = rect(path);
        if (pr.top < H()) {
          setS(path, 'translate', '0px 120px');
          show(path);
          if (strap) { setS(strap, 'translate', '0px 120px'); show(strap); }
          tween(700, function (e) {
            setS(path, 'translate', '0px ' + (120 * (1 - e)).toFixed(2) + 'px');
            if (strap) setS(strap, 'translate', '0px ' + (120 * (1 - e)).toFixed(2) + 'px');
          }, ease.out).catch(function () {});
        }
      }
      return wait(720);
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

    if (instant) {
      cancelAnimationFrame(raf);
      root.remove();
      canvas.remove();
    } else {
      root.classList.add('out');
      canvas.classList.remove('on');
      setTimeout(function () { cancelAnimationFrame(raf); root.remove(); canvas.remove(); }, 520);
    }
    document.dispatchEvent(new Event('introdone'));
  }

  function bail() {
    doc.classList.remove('bi-on', 'bi-live');
    seen();
    document.dispatchEvent(new Event('introdone'));
  }

  /* ------------------------------------------------------------ go */

  arm();
  load().then(function () {
    return wait(240);
  }).then(function () {
    loader.classList.add('done');
    canvas.classList.add('on');
    return wait(340);
  }).then(function () {
    loader.classList.add('gone');
    return wait(560);
  }).then(function () {
    loader.remove();
    return run();
  }).catch(fail);

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
