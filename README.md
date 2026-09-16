# jeffreyhamilton.com

My portfolio. One HTML file, one stylesheet, one script, and a folder of
screenshots.

There is still no build step and nothing to install. Open `index.html` in a
browser and that is the site.

## What is in here

| Path | What it is |
| :--- | :--- |
| `index.html` | The whole page |
| `styles.css` | All of the styling |
| `app.js` | Scroll motion, the panel handoff, and the loop |
| `assets/vendor/` | GSAP, ScrollTrigger and Lenis, vendored |
| `assets/portrait.jpg` | Headshot |
| `assets/shots/` | A screenshot of each project |

The only outside request the page makes is to Google Fonts for Inter,
Source Serif 4 and JetBrains Mono. The three libraries are checked in under
`assets/vendor/` rather than pulled from a CDN, so the page has nothing else
to wait on and nothing else that can go down.

## The moving parts

`app.js` is all enhancement. With it blocked the page is still complete: the
reveal rules only start hiding things once the script has confirmed its
libraries arrived, and the loop only replaces its plain card grid once it has
measured a screen wide enough to hold it.

* **Lenis** owns the scroll position. GSAP's ticker drives it, so Lenis and
  ScrollTrigger share one frame loop rather than fighting over two.
* **Panels.** Every section is an opaque slab with a rounded top edge and a
  negative top margin, so it rides up over the one before it. The outgoing
  panel's `.slab-inner` scales back and dims on a scrubbed trigger — the
  transform stays off the section itself so the seam between the two never
  moves.
* **The loop** is a horizontal corkscrew. Cards enter far left and small,
  rise over the top, come forward through the middle at full size, drop
  under, and recede off to the right — one revolution across the whole path,
  so the wrap has no seam. It turns on its own, scrolling adds to it, and you
  can throw it left or right with the pointer. The maths, and why the spacing
  and depth curve are what they are, is written up above the module.

## Two sides

The pill in the bottom corner switches the page between the work and the
rest of it. Nothing moves when it does: every block that changes is a `.duo`
holding both versions in one grid cell, and the spiral's cards each carry a
second face (`.card-fun`). A switch swaps each block out past the nearer
edge of the screen and back in from the same edge, while the spiral keeps
turning and only its cards change faces. The choice is remembered in `localStorage`.

`fun.js` owns the switch and draws the fun side with
[jot](https://animation-library-ruby.vercel.app), vendored in
`assets/vendor/jot/`: the doodles, the handwritten titles, and a brush-pen
skin for the watch that rides inside the same parts app.js moves. The fun
side's type is Caveat Brush and Shantell Sans from Google Fonts. Anything
waiting on a real photo is a jot drawing on a page of sketchbook paper marked
`data-photo="…"`; swap the drawing for an `<img>` and nothing around it has
to change.

A visit that stays on the work side pays for none of it up front. jot, its
stylesheet and the fonts are fetched once the page has settled, and the
drawings are only built when someone reaches for the switch.

## Deploying

Hosted on Vercel. Every push to `main` deploys automatically.
No framework preset, no build command, no output directory. Vercel serves
`index.html` from the root.
