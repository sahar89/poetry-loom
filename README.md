# Poetry Loom

A life-sized Persian carpet, woven entirely from the words of Omar Khayyam's *Rubaiyat*, hanging in a sunlit Isfahan hall. Built with Three.js in the browser.

Every knot is one Persian word. The rows read right to left, and each word is dyed so that together they form a Shah Abbas carpet: a central medallion, corner pieces, scrolling vines and a cartouche border. From across the hall you see the pattern. Up close, it is only words, raised and twisted like real yarn.

## Features

- **Words as yarn.** Each row is split into runs of one motif color, and every run is filled with whole, justified words. The pattern exists only in how the words are dyed.
- **Wool and silk pile.** The words are glossy silk, shell-rendered with a raised pile, ply twist and fuzzy edges.
- **A cloth you can touch.** A heavy wool-and-silk rug on a Verlet cloth simulation. It hangs perfectly still until you drag it, then swings and settles.
- **Live poetry.** Quatrains are fetched from [Ganjoor](https://ganjoor.net/khayyam/robaee) when the page loads, with a bundled set as an offline fallback.
- **An Isfahan hall.** Pointed arches, a ribbed vault, lattice windows, sun shafts, ambient occlusion on desktop, and dust that glows only inside the sunbeams.
- **Raj slider.** Sets how many rows of words run down the carpet, from 40 (larger words) to 100 (finer weave).

## Controls

| Action | Mouse | Touch |
| --- | --- | --- |
| Look around | Drag off the carpet | Drag off the carpet |
| Pull the rug | Drag on the carpet | Drag on the carpet |
| Zoom | Scroll | Pinch |
| Zen mode | `Z` | Zen button |

The bottom dock has the Raj slider, daylight and sunset lighting, and camera views (overview, medallion, corner, border, fringes, reverse).

## Run it locally

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints, usually http://localhost:5173.

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build locally
npm run snapshot   # refresh the bundled quatrains from Ganjoor
```

## Deploy

The site is static, so any static host works. It is set up for [Netlify](https://www.netlify.com):

- **Git deploy:** connect the repo. Settings come from `netlify.toml` (build command `npm run build`, publish folder `dist`).
- **Manual deploy:** run `npm run build`, then drag the `dist` folder onto Netlify.

Requests to `/api/ganjoor/*` are proxied to `api.ganjoor.net` by `public/_redirects` on Netlify, and by Vite's dev server locally. If Ganjoor can't be reached, the site falls back to the bundled quatrains, and the small dot beside "verses from Ganjoor" turns gold instead of green.

## Project layout

```
src/
  main.js            scene, camera, interaction, render loop
  weave.js           word atlas and the layout that fills each color run with words
  design.js          the carpet design, drawn as vectors
  carpetMaterial.js  wool and silk shader, pile shells, yarn relief
  cloth.js           Verlet cloth simulation and smooth rendering mesh
  fringe.js          cotton fringe
  stand.js           walnut and brass hanging stand
  hall.js            procedural Isfahan hall and sun shafts
  particles.js       sunbeam dust
  poetry.js          Ganjoor loading and word splitting
  ui.js              dock, loader, Zen mode
public/
  data/quatrains.json    bundled quatrains (offline fallback)
  hdri/                  environment lighting
scripts/fetch-quatrains.mjs
```

## Credits

- Poetry: Omar Khayyam, *Rubaiyat*, text from [Ganjoor](https://ganjoor.net).
- Environment lighting: "Historic Cloister Passage" by Elvis Posa, from [Poly Haven](https://polyhaven.com), CC0.
- Fonts: [Amiri](https://fonts.google.com/specimen/Amiri), [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans), via Google Fonts.
- Built with [Three.js](https://threejs.org) and [Vite](https://vitejs.dev).
