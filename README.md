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

## Deploying

Hosted on Vercel. Every push to `main` deploys automatically.
No framework preset, no build command, no output directory. Vercel serves
`index.html` from the root.
