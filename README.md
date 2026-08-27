# jeffreyhamilton.com

My portfolio. One HTML file, one stylesheet, and a folder of screenshots.

There is no build step and nothing to install. Open `index.html` in a browser
and that is the site.

## What is in here

| Path | What it is |
| :--- | :--- |
| `index.html` | The whole page |
| `styles.css` | All of the styling |
| `assets/portrait.jpg` | Headshot |
| `assets/shots/` | A screenshot of each project |

The only outside request the page makes is to Google Fonts for Inter and
Source Serif 4. Everything else is local.

## Deploying

Hosted on Vercel. Every push to `main` deploys automatically.
No framework preset, no build command, no output directory. Vercel serves
`index.html` from the root.
