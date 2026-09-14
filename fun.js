/* ==========================================================================
   Two sides — the work, and the rest of it

   The same page, told twice. The toggle only swaps what is said: every
   section, the spiral and the watch stay exactly where they are. Each .duo
   holds both versions stacked in one grid cell (see styles.css), so a switch
   is a cross-fade with nothing re-laid-out underneath it, and the spiral's
   cards carry a second face that fades over the first.

   The fun side is written by hand and drawn with jot, the ink library that
   is also on the spiral (vendored in assets/vendor/jot): the doodles, the
   handwritten titles, and a second, brush-pen skin for the watch.

   None of that is paid for by a visit that stays on the work side. Until it
   is wanted this file is the switch and nothing else: jot, its stylesheet
   and the two typefaces are fetched once the page has gone quiet, and the
   drawings are only attached when someone reaches for the switch (or arrives
   on the fun side). Once attached, a drawing waits on a manual trigger and is
   inked from here when its side is showing and it is really on screen — the
   watch fades its panels in by opacity while they sit in the viewport the
   whole time, so jot's own in-view trigger would draw them all at once,
   unseen.

   Loaded as a module after app.js, so by the time this runs the watch has
   already lifted the eras onto the dial and built its ticks.
   ========================================================================== */

const JOT = './assets/vendor/jot/jot.js';
const JOT_CSS = 'assets/vendor/jot/jot.css?v=0.2.0';
/* The same two addresses are in the head of index.html, which links them
   before first paint for a visit that opens on the fun side. */
const FONTS = 'https://fonts.googleapis.com/css2?family=Caveat+Brush&family=Shantell+Sans:wght@400;500;600;700&display=swap';
const FACES = ['400 1em "Shantell Sans"', '600 1em "Shantell Sans"', '400 1em "Caveat Brush"'];

const doc = document.documentElement;
const KEY = 'side';
const TITLES = { pro: document.title, fun: 'Jeffrey Hamilton, off the clock' };

/* Shared with styles.css: the side leaving takes OUT, the side arriving
   starts IN after the switch, and blocks on screen are staggered by STEP up
   to a ceiling, so a full screen of them still lands inside half a second. */
const OUT = 340;
const IN = 260;
const STEP = 45;
const STAGGER_MAX = 360;
/* The type that belongs to neither side — the header, the changing word,
   the watch's numbers — cannot cross-fade, so it dips out (html.side-swap)
   and its face is changed while nothing is showing. */
const FLIP = 280;
/* between drawings that start in the same pass, so a screen of them inks
   one after another rather than all at once */
const PEN_GAP = 90;
/* The watch keeps moving for a moment after the scroll stops — its scrub
   catches up on a ticker — so there is one more look once it has settled. */
const SETTLE_MS = 700;
/* A visit on the work side waits this long after load before fetching
   anything for the other one, so the opening has the connection to itself. */
const PREFETCH_AFTER = 2500;

const PAPER_INK = '#24211d';   /* jot's charcoal, on the sketchbook cards */
const DARK_INK = '#F4F1EA';    /* --on-dark                               */
const ACCENT = '#E4623C';      /* --ember                                 */
const GLOW = '#FFC93C';        /* --glow                                  */

let side = doc.getAttribute('data-side') === 'fun' ? 'fun' : 'pro';

/* ---- the drawings --------------------------------------------------------
   Each one is a handful of pen strokes on a 100 x 100 square, scaled into
   whatever box it is attached to. jot turns every run of points into a brush
   stroke and inks them in the order they are listed, so the order here is
   the order the pen moves. */

const rad = (deg) => (deg * Math.PI) / 180;

function arc(cx, cy, r, from, to) {
  const n = Math.max(6, Math.round(Math.abs(to - from) / 12));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(from + ((to - from) * i) / n);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

const path = (...points) => ({ points });
const ring = (cx, cy, r) => ({ points: arc(cx, cy, r, -90, 270) });
const shape = (...points) => ({ points, closed: true });
const box = (x0, y0, x1, y1) => shape([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

function wave(x0, x1, y, amp, period) {
  const pts = [];
  for (let x = x0; x <= x1; x += 3) pts.push([x, y + Math.sin(((x - x0) / period) * Math.PI * 2) * amp]);
  return { points: pts };
}

/* n points evenly round a circle, starting straight up */
const around = (cx, cy, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = rad(-90 + (360 * i) / n);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

const DOODLES = {
  house: [
    path([14, 50], [50, 18], [86, 50]),
    path([24, 42], [24, 86], [76, 86], [76, 42]),
    path([44, 86], [44, 64], [56, 64], [56, 86]),
    box(62, 52, 72, 62),
    path([66, 34], [66, 22], [74, 22], [74, 41]),
  ],
  soccer: [
    ring(50, 50, 34),
    shape(...around(50, 50, 11, 5)),
    ...around(50, 50, 11, 5).map((p, i) => path(p, around(50, 50, 34, 5)[i])),
  ],
  truck: [
    box(8, 32, 60, 70),
    path([60, 44], [78, 44], [90, 57], [90, 70], [60, 70]),
    shape([66, 49], [76, 49], [83, 57], [66, 57]),
    ring(24, 74, 8),
    ring(76, 74, 8),
    path([4, 88], [96, 88]),
  ],
  tv: [
    box(12, 30, 88, 80),
    box(20, 38, 70, 72),
    ring(79, 46, 3.5),
    ring(79, 60, 3.5),
    path([40, 30], [28, 12]),
    path([60, 30], [72, 12]),
    path([24, 80], [20, 90]),
    path([76, 80], [80, 90]),
  ],
  play: [
    box(12, 24, 88, 76),
    shape([42, 37], [42, 63], [64, 50]),
  ],
  camera: [
    ring(27, 22, 9),
    ring(49, 22, 9),
    box(12, 34, 64, 74),
    shape([64, 46], [88, 34], [88, 74], [64, 62]),
    ring(22, 44, 3),
  ],
  friends: [
    ring(33, 38, 12),
    { points: arc(33, 38, 6, 20, 160) },
    path([14, 86], [18, 68], [33, 60], [48, 68], [52, 86]),
    ring(67, 38, 12),
    { points: arc(67, 38, 6, 20, 160) },
    path([48, 86], [52, 68], [67, 60], [82, 68], [86, 86]),
  ],
  swim: [
    ring(36, 34, 8),
    path([16, 52], [30, 40], [50, 36], [68, 42], [78, 50]),
    wave(6, 94, 60, 3.5, 22),
    wave(6, 94, 72, 3.5, 22),
    wave(6, 94, 84, 3.5, 22),
  ],
  cube: [
    shape([50, 14], [84, 31], [50, 48], [16, 31]),
    path([16, 31], [16, 69], [50, 86], [50, 48]),
    path([84, 31], [84, 69], [50, 86]),
  ],
  controller: [
    shape([24, 38], [76, 38], [90, 64], [84, 76], [70, 70], [30, 70], [16, 76], [10, 64]),
    path([24, 54], [38, 54]),
    path([31, 47], [31, 61]),
    ring(66, 50, 3.5),
    ring(75, 58, 3.5),
  ],
  school: [
    path([10, 44], [50, 24], [90, 44]),
    box(16, 44, 84, 86),
    path([44, 86], [44, 68], [56, 68], [56, 86]),
    box(24, 52, 34, 62),
    box(66, 52, 76, 62),
    path([50, 24], [50, 6], [64, 10], [50, 14]),
  ],
  mountains: [
    path([4, 84], [32, 40], [48, 62], [64, 42], [96, 84]),
    path([25, 51], [32, 56], [39, 51]),
    ring(78, 22, 9),
    path([4, 84], [96, 84]),
  ],
  belt: [
    box(42, 40, 58, 58),
    path([6, 45], [42, 45]),
    path([6, 53], [42, 53]),
    path([58, 45], [94, 45]),
    path([58, 53], [94, 53]),
    path([46, 58], [36, 86], [46, 88], [52, 60]),
    path([54, 58], [64, 86], [72, 82], [58, 58]),
  ],
  notes: [
    ring(32, 72, 8),
    path([40, 72], [40, 26], [72, 18], [72, 62]),
    path([40, 36], [72, 28]),
    ring(64, 62, 8),
  ],
  bulb: [
    { points: arc(50, 38, 24, 130, 410) },
    path([35, 56], [39, 70], [61, 70], [65, 56]),
    path([40, 77], [60, 77]),
    path([43, 84], [57, 84]),
    path([44, 58], [47, 46], [50, 54], [53, 46], [56, 58]),
    path([16, 16], [23, 22]),
    path([84, 16], [77, 22]),
    path([8, 40], [16, 40]),
    path([92, 40], [84, 40]),
  ],
  pullup: [
    path([8, 14], [92, 14]),
    path([14, 14], [14, 92]),
    path([86, 14], [86, 92]),
    path([40, 14], [42, 28], [44, 40]),
    path([60, 14], [58, 28], [56, 40]),
    ring(50, 29, 7),
    path([44, 40], [56, 40]),
    path([50, 36], [50, 66]),
    path([50, 66], [44, 84]),
    path([50, 66], [56, 84]),
  ],
};

/* the ones jot already knows how to draw */
const BUILTIN = new Set(['star', 'sparkle']);
const SOLID = new Set(['star']);

/* jot's pen smooths through the points it is given, which is right for its
   own marks because they arrive densely sampled. A box written as four
   corners came out as a lozenge, so every straight run is filled in with a
   point every few pixels before it is handed over, and a closed shape
   returns to its first corner rather than leaving the pen to guess. */
const DENSE_PX = 5;

function densify(points, step = DENSE_PX) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

function geometry(strokes) {
  return (w, h) => {
    const s = Math.min(w, h) / 100;
    const ox = (w - 100 * s) / 2;
    const oy = (h - 100 * s) / 2;
    return strokes.map((st) => {
      const pts = st.points.map(([x, y]) => [ox + x * s, oy + y * s]);
      return { ...st, points: densify(st.closed ? [...pts, pts[0]] : pts) };
    });
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* Charcoal on the paper cards, bone on the dark bands. */
function inkFor(el) {
  if (el.closest('.fun-paper, .card-fun')) return PAPER_INK;
  return el.closest('.on-dark') ? DARK_INK : PAPER_INK;
}

/* ---- the register --------------------------------------------------------
   Everything drawn on the fun side, with the panel it lives on. A panel the
   watch has faded out takes its drawings with it, so they ink in again the
   next time it comes round rather than sitting there already finished. */

const GATES = '.era, .path-now, .path-picks, .path-right';
const inks = [];
/* a fixed seed per drawing, so the page is drawn in the same hand every visit */
let seed = 17;
const nextSeed = () => (seed += 101);

/* The spiral turns on its own, with no scroll to say a card has come round,
   so its cards count as in view whenever the hero is: they are all drawn at
   once, one after another, and are finished by the time each one faces you. */
function keep(drawing, el) {
  const gate = el.closest(GATES);
  inks.push({
    d: drawing,
    el,
    gate,
    /* on the live watch a panel that has no opacity written on it yet has
       not been brought in, whatever the flow version of it would say */
    live: !!gate && !!gate.closest('.path-orbit.is-live'),
    zone: el.closest('.spiral-card') && el.closest('.hero'),
    done: false,
  });
}

const switcher = document.querySelector('.side-switch');

/* Every drawing on the page as a list of jobs, so they can be attached a few
   at a time while the page is idle. Document order is the order of the page,
   so the first screen is ready first. */
function plan(j) {
  const jobs = [];

  document.querySelectorAll('.fun-art[data-doodle]').forEach((el) => jobs.push(() => {
    const name = el.dataset.doodle;
    const size = Math.min(el.clientWidth, el.clientHeight) || 60;
    const opts = { trigger: 'manual', color: inkFor(el), width: clamp(size / 34, 1.8, 3.4), seed: nextSeed() };
    if (BUILTIN.has(name)) keep(j.jotDoodle(el, { shape: name, solid: SOLID.has(name), fill: ACCENT, ...opts }), el);
    else if (DOODLES[name]) keep(j.jotMark(el, geometry(DOODLES[name]), opts), el);
  }));

  document.querySelectorAll('.fun-write').forEach((el) => jobs.push(() => {
    keep(j.jotWrite(el, { trigger: 'manual', color: inkFor(el), seed: nextSeed() }), el);
  }));

  document.querySelectorAll('.fun-mark').forEach((el) => jobs.push(() => {
    keep(j.jotUnderline(el, { variant: 'wavy', trigger: 'manual', color: ACCENT, seed: nextSeed() }), el);
  }));

  const spark = switcher && switcher.querySelector('.ss-spark');
  if (spark) jobs.push(() => keep(j.jotDoodle(spark, { shape: 'sparkle', trigger: 'manual', color: GLOW, width: 1.6, seed: 3 }), spark));

  jobs.push(() => inkWatch(j));
  jobs.push(() => inkLeather(j));
  return jobs;
}

/* ---- the watch, in pen ---------------------------------------------------
   A second skin for the watch, made with jot's own brush: every line the
   watch has, traced again as a tapered, swelling pen stroke. Each stroke goes
   inside the part it belongs to — a strap, a hand, the ticks, the knurl — so
   every transform app.js puts on that part carries the ink with it, and the
   stylesheet trades the two skins over with the side.

   These are drawn once, not animated: the watch already has its own build,
   and the case and crown follow it (see onto). All in viewBox units. */

const WOBBLE_U = 2.2;      /* about jot's own hand, at the size the watch is drawn */
const STITCH_ON = 11;      /* the pen's version of the strap's 9 11 dashes */
const STITCH_OFF = 10;

const ends = (l) => [[+l.getAttribute('x1'), +l.getAttribute('y1')], [+l.getAttribute('x2'), +l.getAttribute('y2')]];
const pointsOf = (d) => {
  const n = d.match(/-?\d*\.?\d+/g).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  return pts;
};
const polyline = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');

function inkWatch(j) {
  const svg = document.querySelector('.path-svg');
  if (!svg || svg.querySelector('.fun-ink')) return;
  const rand = j.mulberry32(1400);

  const stroke = (pts, width, cls, amp = WOBBLE_U) =>
    `<path class="fun-ink ${cls}" d="${j.brush(j.wobble(densify(pts, 8), rand, amp), width, rand)}"/>`;
  const put = (el, html) => { if (el && html) el.insertAdjacentHTML('beforeend', html); };

  /* the strap's two edges; its ends are under the case */
  const straps = svg.querySelectorAll('.watch-strap');
  put(straps[0], stroke([[440, 0], [440, 250], [424, 470]], 5.5, 'ink-strap') +
                 stroke([[560, 0], [560, 250], [576, 470]], 5.5, 'ink-strap'));
  put(straps[1], stroke([[440, 1400], [440, 1150], [424, 930]], 5.5, 'ink-strap') +
                 stroke([[560, 1400], [560, 1150], [576, 930]], 5.5, 'ink-strap'));

  /* the stitching, one short stroke per stitch */
  svg.querySelectorAll('.watch-stitch').forEach((g) => {
    const line = g.querySelector('path');
    if (!line) return;
    const fine = densify(pointsOf(line.getAttribute('d')), 2);
    let html = '', run = [fine[0]], on = true, gone = 0;
    for (let i = 1; i < fine.length; i++) {
      gone += Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]);
      if (on) run.push(fine[i]);
      if (on && gone >= STITCH_ON) {
        html += `<path class="fun-ink ink-stitch" d="${j.brush(run, 3, rand)}"/>`;
        on = false; gone = 0;
      } else if (!on && gone >= STITCH_OFF) {
        on = true; gone = 0; run = [fine[i]];
      }
    }
    put(g, html);
  });

  /* whatever ticks and knurl app.js made — sixty and thirty-two on the live
     watch, sixteen notches on the still one — traced one for one */
  let ticks = '';
  svg.querySelectorAll('.path-ticks .path-tick').forEach((l) => {
    const major = l.classList.contains('is-major');
    ticks += stroke(ends(l), major ? 5.5 : 3.2, major ? 'ink-tick is-major' : 'ink-tick', 0.8);
  });
  put(svg.querySelector('.path-ticks'), ticks);

  let knurl = '';
  svg.querySelectorAll('.watch-knurl line').forEach((l) => { knurl += stroke(ends(l), 2.6, 'ink-knurl', 0.4); });
  put(svg.querySelector('.watch-knurl'), knurl);

  [['.path-hand', 9, 'ink-hand'], ['.path-hand-sm', 6, 'ink-hand-sm']].forEach(([sel, width, cls]) => {
    const g = svg.querySelector(sel);
    const l = g && g.querySelector('line');
    if (l) put(g, stroke(ends(l), width, cls, 1));
  });

  /* past the top of the circle by twelve degrees, the way a pen closes one */
  onto(j, rand, svg.querySelector('.watch-case'), svg.querySelector('.watch-case-ink'),
       arc(500, 700, 292, -90, 282), 7, 'ink-case', 'case');
  onto(j, rand, svg.querySelector('.watch-crown'), svg.querySelector('.watch-crown-ink'),
       [[790, 678], [830, 678], [830, 722], [790, 722], [790, 678]], 5, 'ink-crown', 'crown');
}

/* The case and the crown are walked on as the watch is built (app.js), so
   their ink is revealed the way jot reveals any stroke: a wide line along
   its middle, drawn on through a mask. app.js calls `jotInk(k)` on the part
   it already drives, with how far built it is, and it starts at however far
   the build has already got.

   Built, the mask goes. The case sits under the hand, so it is repainted on
   every frame of the revolution, and a mask the size of the watch being
   composited every one of those frames was a cost with nothing to show. */
function onto(j, rand, part, slot, pts, width, cls, id) {
  if (!part || !slot) return;
  const mid = j.wobble(densify(pts, 8), rand, WOBBLE_U);
  const len = parseFloat(part.style.strokeDasharray);
  const k = len ? 1 - (parseFloat(part.style.strokeDashoffset) || 0) / len : 1;
  slot.innerHTML =
    `<mask id="ink-${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1200" height="1600">` +
      `<path class="ink-reveal" d="${polyline(mid)}" pathLength="1" fill="none" stroke="#fff"` +
      ` stroke-width="${width * 4}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1"` +
      ` style="stroke-dashoffset:${(1 - k).toFixed(3)}"/>` +
    `</mask>` +
    `<path class="fun-ink ${cls}" d="${j.brush(mid, width, rand)}" mask="url(#ink-${id})"/>`;
  const reveal = slot.querySelector('.ink-reveal');
  const ink = slot.querySelector('.fun-ink');
  let masked = true;
  part.jotInk = (built) => {
    reveal.style.strokeDashoffset = String(1 - built);
    const want = built < 0.999;
    if (want === masked) return;
    masked = want;
    if (want) ink.setAttribute('mask', `url(#ink-${id})`);
    else ink.removeAttribute('mask');
  };
  part.jotInk(k);
}

/* The leather that carries on past the drawing — the tab under the spiral,
   the run above the watch, the sheet the contact section sits on — is HTML,
   and it changes size on every frame of its entrance. So its pen edges are
   short tiles of brush stroke that repeat down (or along) it: a strap edge
   and a stitch. Tiles never stretch, so a band a thousand pixels tall is
   still drawn in the same weight of line as one fifty tall. The strokes run
   past both ends of the tile, so the taper is cut off and the seams read as
   a hand picking the pen back up. */
function inkLeather(j) {
  const rand = j.mulberry32(77);
  const tile = (w, h, from, to, width, amp, color) => {
    const pts = j.wobble(densify([from, to], 4), rand, amp);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<path fill="${color}" d="${j.brush(pts, width, rand)}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  };
  const edge = 'rgba(244,241,234,.5)';      /* the strap's own edge, in pen */
  const seam = 'rgba(244,241,234,.22)';
  const seamPaper = 'rgba(29,26,40,.22)';   /* the tab lies on the light page */
  doc.style.setProperty('--ink-edge-v', tile(8, 160, [4, -60], [4, 220], 3, 1, edge));
  doc.style.setProperty('--ink-edge-h', tile(160, 8, [-60, 4], [220, 4], 3, 1, edge));
  doc.style.setProperty('--ink-seam-v', tile(6, 22, [3, 5], [3, 16], 2.2, 0.3, seam));
  doc.style.setProperty('--ink-seam-h', tile(22, 6, [5, 3], [16, 3], 2.2, 0.3, seam));
  doc.style.setProperty('--ink-seam-v-paper', tile(6, 22, [3, 5], [3, 16], 2.2, 0.3, seamPaper));
}

/* ---- fetching and attaching ---------------------------------------------- */

const idle = window.requestIdleCallback
  ? (fn) => requestIdleCallback(fn, { timeout: 2000 })
  : (fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 50);

function linkCss(id, href) {
  let link = document.getElementById(id);
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  if (link.sheet) return Promise.resolve();
  return new Promise((done) => {
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
  });
}

/* The faces are asked for by name, so they download now rather than the
   first time a line of fun text is laid out. The fun side is set in them
   even while it is hidden, and it shares a cell with the side that is
   showing, so if landing them changed the page's height the scroll scenes
   are measured again. */
function warmFaces() {
  if (!document.fonts || !document.fonts.load) return;
  const before = doc.scrollHeight;
  Promise.all(FACES.map((f) => document.fonts.load(f))).then(() => {
    if (window.ScrollTrigger && doc.scrollHeight !== before) window.ScrollTrigger.refresh();
  }, () => {});
}

let loading = null;   /* jot, its stylesheet and the faces, on their way */
let jobs = null;      /* drawings still to attach, once jot is here */
let rushing = false;

/* The fun side's photographs wait with the rest of it. They are in the
   markup without a src, so a visit that stays on the work side never
   downloads them; once they have one, the browser's own lazy loading takes
   it from there. */
function showPhotos() {
  document.querySelectorAll('img[data-fun-src]').forEach((img) => {
    img.src = img.dataset.funSrc;
    img.removeAttribute('data-fun-src');
  });
}

function prefetch() {
  if (!loading) {
    showPhotos();
    linkCss('fun-fonts', FONTS).then(warmFaces);
    loading = Promise.all([import(JOT), linkCss('jot-css', JOT_CSS)])
      .then(([j]) => { jobs = plan(j); });
  }
  return loading;
}

/* Attach every drawing, a slice at a time: in idle time while nobody is
   waiting, or a frame's worth at a time once the switch has been pressed.
   All at once on the press was a hitch of a tenth of a second right as the
   fade began. Anything attached is inked by the next look, so the first
   screen — first in the list — is drawing while the rest are still being
   built. */
const SLICE_MS = 8;

function attach(now) {
  if (now) rushing = true;
  return prefetch().then(() => {
    const slice = (budget) => {
      const end = performance.now() + budget;
      while (jobs.length && performance.now() < end) jobs.shift()();
      schedulePump();
      if (!jobs.length) return;
      if (rushing) requestAnimationFrame(() => slice(SLICE_MS));
      else idle((d) => slice(Math.max(2, d.timeRemaining() - 2)));
    };
    if (rushing) slice(SLICE_MS);
    else idle((d) => slice(Math.max(2, d.timeRemaining() - 2)));
  }).catch(() => {
    /* jot never arrived. The fun side is still all there in words. */
  });
}

/* ---- inking what is in view ---------------------------------------------- */

function booting() {
  return doc.classList.contains('pre') || doc.classList.contains('booting') || doc.classList.contains('sheet-held');
}

/* Nothing is inked under the loading sheet. A look that lands while it is
   up comes back once, the moment it lifts. */
let waiting = null;
function afterBoot() {
  if (waiting) return;
  waiting = new MutationObserver(() => {
    if (booting()) return;
    waiting.disconnect();
    waiting = null;
    schedulePump();
  });
  waiting.observe(doc, { attributes: true, attributeFilter: ['class'] });
}

/* jot draws a brush stroke on by sweeping a line through a mask over it.
   Once the stroke is down the mask has nothing left to do, but the browser
   still composites every one of them, stroke by stroke, whenever anything
   near it repaints — and on a spinning spiral or a turning watch that is
   every frame. So a finished drawing gives its masks back, and takes them up
   again only to be drawn once more. */
function bake(host) {
  host.querySelectorAll('path[mask]').forEach((p) => {
    p.dataset.mask = p.getAttribute('mask');
    p.removeAttribute('mask');
  });
}
function unbake(host) {
  host.querySelectorAll('path[data-mask]').forEach((p) => {
    p.setAttribute('mask', p.dataset.mask);
    p.removeAttribute('data-mask');
  });
}

function ink(it) {
  unbake(it.el);
  it.d.draw().then(() => { if (it.done && side === 'fun') bake(it.el); });
}
function lift(it) {
  it.done = false;
  unbake(it.el);
  it.d.reset();
}

/* jot rebuilds a drawing, masks and all, when its box changes size. Once a
   resize has settled the finished ones give them back again. */
let resized = 0;
addEventListener('resize', () => {
  clearTimeout(resized);
  resized = setTimeout(() => inks.forEach((it) => { if (it.done) bake(it.el); }), 400);
}, { passive: true });

/* An opacity written on a panel is the watch's own word on it. Reading the
   attribute rather than the computed style keeps this from forcing a style
   pass in the middle of the watch's frame. */
function panelShown(it) {
  const o = it.gate.style.opacity;
  if (o !== '') return +o;
  return it.live ? 0 : 1;
}

/* After a switch the arriving blocks are still waiting on their turn in the
   stagger, and jot skips strokes it cannot see (they would turn up later
   already drawn), so nothing is looked at until they are all in. */
let quietUntil = 0;

function pump() {
  if (side !== 'fun') return;
  if (booting()) { afterBoot(); return; }
  if (performance.now() < quietUntil) return;
  let n = 0;
  for (const it of inks) {
    if (!it.done) {
      if (it.gate && panelShown(it) <= 0.55) continue;
      const r = (it.zone || it.el).getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      it.done = true;
      setTimeout(() => { if (side === 'fun' && it.done) ink(it); }, n++ * PEN_GAP);
    } else if (it.gate && panelShown(it) < 0.05) {
      lift(it);
    }
  }
}

/* Only ever in answer to something: a scroll, a resize, a switch, the end of
   the opening. Nothing runs while the page is still. */
let framed = false;
let trailing = 0;
function schedulePump() {
  if (side !== 'fun') return;
  if (!framed) {
    framed = true;
    requestAnimationFrame(() => { framed = false; pump(); });
  }
  clearTimeout(trailing);
  trailing = setTimeout(pump, SETTLE_MS);
}
addEventListener('scroll', schedulePump, { passive: true });
addEventListener('resize', schedulePump, { passive: true });

/* The watch fades its panels on a scrub that runs on after the scroll has
   stopped, for however long a slow machine needs, so guessing when it has
   settled is not good enough. Its own writes are the signal instead: while
   the fun side is up, any change to a panel's style is a reason to look.
   On the work side nothing is watched at all. */
let panels = null;
function watchPanels(on) {
  if (on && !panels) {
    panels = new MutationObserver(schedulePump);
    document.querySelectorAll(GATES).forEach((g) => panels.observe(g, { attributes: true, attributeFilter: ['style'] }));
  } else if (!on && panels) {
    panels.disconnect();
    panels = null;
  }
}

/* ---- the switch ----------------------------------------------------------- */

/* Blocks on screen go in reading order, top to bottom and a little left to
   right; everything off screen switches at once, since nobody sees it. */
function stagger() {
  const on = [];
  document.querySelectorAll('.duo, .spiral-card').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && r.bottom > 0 && r.top < innerHeight) on.push({ el, at: r.top + r.left * 0.3 });
    else el.style.setProperty('--sd', '0ms');
  });
  on.sort((a, b) => a.at - b.at)
    .forEach(({ el }, i) => el.style.setProperty('--sd', Math.min(i * STEP, STAGGER_MAX) + 'ms'));
}

const buttons = switcher ? [].slice.call(switcher.querySelectorAll('[data-side-set]')) : [];

/* The knob only ever moves to the right. To Fun is the stylesheet's own
   slide across; back to Pro, rather than sliding back, it keeps going — out
   of the right-hand end of the track and round in from the left into its
   place. The two halves take the same time over the same distance, and the
   curve out ends as fast as the curve in begins, so the wrap reads as one
   unbroken move with no pause at the edge. */
const knob = switcher && switcher.querySelector('.ss-knob');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WRAP_MS = 600;
let knobRun = null;

function slideKnob(next) {
  if (knobRun) { knobRun.cancel(); knobRun = null; }
  if (!knob || reduced || next !== 'pro' || typeof knob.animate !== 'function') return;
  knobRun = knob.animate([
    { transform: 'translateX(100%)', easing: 'cubic-bezier(.5, 0, .9, .6)' },
    { transform: 'translateX(200%)', offset: 0.5 },
    { transform: 'translateX(-100%)', offset: 0.5, easing: 'cubic-bezier(.1, .4, .5, 1)' },
    { transform: 'translateX(0)' },
  ], { duration: WRAP_MS });
  knobRun.onfinish = () => { knobRun = null; };
}
const skillsLine = document.querySelector('.hero-skills');
/* The certificates are the work side's alone. On the fun side the coil fades
   out of the watch (app.js), and the spiral cards with no fun face fade out
   of the tube; both are taken out of reach for the keyboard and screen
   readers with them. */
const certList = document.querySelector('.path-certs');
const pileList = document.querySelector('.pile');
const skipped = [].slice.call(document.querySelectorAll('.spiral-card.fun-skip'));
/* A card whose fun face has somewhere of its own to go — the YouTube one,
   to the channel — carries that address and wears it on the fun side. */
const funLinks = [].slice.call(document.querySelectorAll('a[data-fun-href]'));
funLinks.forEach((a) => { a.dataset.proHref = a.getAttribute('href'); });

function labelled(el) {
  if (!el) return;
  const label = el.getAttribute(side === 'fun' ? 'data-label-fun' : 'data-label-pro');
  if (label) el.setAttribute('aria-label', label);
}

function sync() {
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sideSet === side)));
  labelled(skillsLine);
  labelled(pileList);
  skipped.forEach((card) => { card.inert = side === 'fun'; });
  if (certList) certList.inert = side === 'fun';
  funLinks.forEach((a) => a.setAttribute('href', side === 'fun' ? a.dataset.funHref : a.dataset.proHref));
}

let flip = 0;
let settle = 0;
let left = 0;

function setSide(next) {
  if (next === side) return;
  if (next === 'fun') attach(true);
  stagger();
  /* Both ways round, the same move: whatever is leaving lifts out, and
     whatever is arriving comes up and forward into its place. */
  doc.setAttribute('data-leaving', side);
  clearTimeout(left);
  left = setTimeout(() => doc.removeAttribute('data-leaving'), OUT + STAGGER_MAX + 80);
  side = next;
  doc.setAttribute('data-side', next);
  slideKnob(next);
  try { localStorage.setItem(KEY, next); } catch (e) {}
  sync();

  doc.classList.add('side-swap');
  clearTimeout(flip);
  flip = setTimeout(() => {
    doc.setAttribute('data-font', side);
    document.title = TITLES[side];
    /* app.js swaps the changing word under the spiral on this, now that the
       new face is in, so the next word is built in it */
    document.dispatchEvent(new CustomEvent('sidechange', { detail: { side } }));
    doc.classList.remove('side-swap');
  }, FLIP);

  watchPanels(next === 'fun');
  clearTimeout(settle);
  if (next === 'fun') {
    /* the ink starts once the blocks have arrived, not before */
    quietUntil = performance.now() + IN + STAGGER_MAX + 60;
    settle = setTimeout(schedulePump, IN + STAGGER_MAX + 80);
  } else {
    /* once the fun side has gone, put its pens back so it draws itself
       again next time */
    settle = setTimeout(() => inks.forEach((it) => { if (it.done) lift(it); }), OUT + STAGGER_MAX);
  }
}

buttons.forEach((b) => b.addEventListener('click', () => setSide(b.dataset.sideSet)));

/* On the fun side a card in the grid is a chapter of the story rather than
   a project, so it takes you down to the story instead of out — unless its
   fun face has a place of its own to go. (The spiral opens its cards itself,
   in app.js, and does the same.) The nav link is the one app.js already
   scrolls smoothly. */
document.addEventListener('click', (e) => {
  if (side !== 'fun') return;
  const a = e.target.closest && e.target.closest('.spiral-card a');
  if (!a || a.hasAttribute('data-fun-href')) return;
  e.preventDefault();
  const story = document.querySelector('.nav a[href="#path"]');
  if (story) story.click();
}, true);

/* ---- starting up ---------------------------------------------------------- */

doc.classList.add('sides-ready');
sync();

if (side === 'fun') {
  document.title = TITLES.fun;
  attach(true);
  watchPanels(true);
  /* nothing is inked under the loading sheet; the first look is when it lifts */
  if (booting()) {
    const lifted = new MutationObserver(() => {
      if (!booting()) { lifted.disconnect(); schedulePump(); }
    });
    lifted.observe(doc, { attributes: true, attributeFilter: ['class'] });
  }
} else {
  /* Fetch, don't build: a visit that never touches the switch pays for one
     quiet download after the page has settled, and nothing else. A hand on
     the switch starts the drawings early, so a press finds them ready. */
  const later = () => setTimeout(() => idle(prefetch), PREFETCH_AFTER);
  if (document.readyState === 'complete') later();
  else addEventListener('load', later, { once: true });
  if (switcher) {
    const reach = () => attach(false);
    ['pointerenter', 'focusin', 'touchstart'].forEach((t) =>
      switcher.addEventListener(t, reach, { once: true, passive: true }));
  }
}
