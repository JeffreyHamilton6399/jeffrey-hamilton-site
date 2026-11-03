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
   * Then the view walks down the page. The intro scrolls it itself, frame
     by frame, so the watch builds exactly as it does under a hand on the
     wheel — except that here the scroll draws nothing: the section comes up
     bare and the cursors make the watch by hand (app.js hands them the
     controls). One pulls the strap down, one traces the crown and one the
     case as their lines go on, one pulls the lower strap out, one draws the
     face in, one puts the hands on and holds the long one steady the rest of
     the way round, and two make the years round the dial. As each era
     opens the crew makes it — title, paragraphs, video rows, links — then
     Now and what I'm aiming at, and the certificates are pasted in. At the
     contact panel two cursors take an edge of the leather each and pull it
     open like a book, the crew makes the copy inside, and the view comes
     back up. On a narrower screen the watch is still and the story is in
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
