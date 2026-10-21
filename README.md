# Poetry Loom

A life-sized Persian carpet, woven from the words of Omar Khayyam's *Rubaiyat*, hanging in a sunlit Isfahan hall. Built with Three.js in the browser.

- **A cloth you can touch.** A heavy wool-and-silk rug on a Verlet cloth simulation. It hangs perfectly still until you drag it, then swings and settles.
- **Live poetry.** Quatrains are fetched from [Ganjoor](https://ganjoor.net/khayyam/robaee) when the page loads, with a bundled set as an offline fallback.


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


## Credits

- Poetry: Omar Khayyam, *Rubaiyat*, text from [Ganjoor](https://ganjoor.net).
- Environment lighting: "Historic Cloister Passage" by Elvis Posa, from [Poly Haven](https://polyhaven.com), CC0.
- Fonts: [Amiri](https://fonts.google.com/specimen/Amiri), [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans), via Google Fonts.
- Built with [Three.js](https://threejs.org) and [Vite](https://vitejs.dev).
