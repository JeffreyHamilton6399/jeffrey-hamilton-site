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
| `intro.js` | The first-visit build: cursors that build the page, watch and all |
| `assets/vendor/` | GSAP, ScrollTrigger and Lenis, vendored |
| `assets/portrait.jpg` | Headshot |
| `assets/shots/` | A screenshot of each project, and of each game |

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

## The intro

A first visit is built in front of you, then opens.

1. **The build** (`intro.js`). There is no loading screen: the page opens on
   a blank canvas and a few coloured cursors build it, all at once. Nothing
   is typed out letter by letter and nothing appears on its own: every
   element is made by a cursor, which draws its box from corner to corner
   and lets go, and the element is there, whole. A hand that is moving is
   making something; free hands take the nearest piece still to be made.
   * One hand handles every image: it drags the photo into the header, then
     drags the project cards in and pastes the rest.
   * The others draw the header frame and make the name, make the nav and
     drag it onto the centre line, make the word under the spiral and pull
     it out to size, click the icons in, bring up the switch and tighten
     the spacing.
   * Then the view goes down the page. One hand draws the dark section in
     as a panel across the foot of the screen while another makes the
     strap's tab on the white above it, takes the tab and pulls: the page
     comes up with it. The scroll draws nothing from here — app.js hands
     the intro the controls — and the watch is made by hand: the strap
     pulled down, the crown and the case traced as their lines go on, the
     lower strap pulled out, the face drawn in, the hands put on and the
     long one held steady the rest of the way round, the years made round
     the dial. As each era opens two hands a side are already waiting and
     make its pieces; at Now the hand lets go of the watch and joins them,
     and each certificate on the coil is made. One hand then drags the
     lower strap down into the contact panel, where two hands take the
     leather's edges and pull it open like a book, and the copy is made
     inside. On a narrower screen the watch is still and the story is in
     the flow; the walk goes down it a screenful at a time.
   * Last of all the image hand makes the intro face — the circle drawn with
     the ellipse tool, the photo option-dragged down out of the header into
     it — and every cursor goes in to the middle and slips behind it.
   * The build is the loading: while it runs, the images further down the
     page are fetched a few at a time.
2. **The opening** (`app.js`). The face the cursors made spins into a gold
   dot, and three lines carry it to the face, the nav and the icons, which
   open as they land.

The cursors work on the page's own elements: text is typed by uncovering the
real characters, and anything dragged or resized moves through the CSS
`translate` and `scale` properties, which never touch layout. The build's
clean-up takes those off, so the page it leaves is the page.

* **Skip intro** (or Esc) skips everything and leaves the finished page.
* The build plays once per browser session (`sessionStorage`); later visits
  in the same session get the opening alone. Never with reduced motion, and
  never when the visit is aimed at a section further down.
* **Replay the intro** in the footer, or `?intro` on the URL, plays it again.
* The head script decides before the first paint, so the finished page is
  never glimpsed first. If `intro.js` never arrives, the page is handed back
  after a few seconds.

## Behind the watch

The watch sits on a dense field of monospace letters and numbers drifting
in cloudlike bands. It uses the MIT-licensed renderer from
[Henry Fan's Claude Code Background Lab](https://github.com/Henry-fan88/claude-code-background),
vendored with its license in `assets/vendor/glyph-wind/`. `field.js` connects
it to the page. Pointer movement leaves a wake; clicks make blue ripples,
with a heart on every third click. Each intro cursor has its own wake.

During the intro, one cursor draws the field's bounds before the watch is
assembled. Skipping leaves the complete background. The WebGL2 renderer
pauses off screen and in hidden tabs, respects reduced motion with a still
frame, and caps its backing buffer at four million pixels. Without WebGL2,
the watch keeps its plain background and the intro still completes.

The hands are drawn as hands: a faceted dauphine for the long one, lit on
one face and shaded on the other, with a counterweight; a broader leaf for
the short one with a channel down its middle; a cap they turn on; a bezel
round the dial. Each keeps its old line as an axis, unpainted, because the
fun side inks over it.

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
side's type is Caveat Brush and Shantell Sans from Google Fonts.

The fun side of the spiral is the games. Every card's second face
(`.card-fun`) is one of the games I have made — its screenshot out of
`assets/shots/`, the name set over its foot the way the work side sets its
own titles — and the anchor carries `data-fun-href` so the card opens the
game on that side and the project on the work side. A card whose project is
already a game on the work side (Line Glide, SpellFall, PixelParty) is
marked `fun-skip` there instead of shown twice, as is a card with no game of
its own to carry. The photo slots in the
story further down are pages of sketchbook paper marked `data-photo="…"`;
swap a drawing for an `<img>` and nothing around it has to change.

A visit that stays on the work side pays for none of it up front. jot, its
stylesheet and the fonts are fetched once the page has settled, and the
drawings are only built when someone reaches for the switch.

## Deploying

Hosted on Vercel. Every push to `main` deploys automatically.
No framework preset, no build command, no output directory. Vercel serves
`index.html` from the root.
