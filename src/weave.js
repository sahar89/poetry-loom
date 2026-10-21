// Turns the Rubaiyat into the carpet's knots. Each unique word is set once in Amiri
// into a tightly packed glyph atlas. Each row of the carpet is then set like a line of
// text: whole words at full row height, right to left, justified edge to edge, so the
// words themselves are the surface. The motif colours them in the shader.
import * as THREE from 'three';
import { KILIM } from './design.js';

export const CARPET_W = 2.0;
export const CARPET_H = 3.0;
// Width of the overcast selvedge at each side, as a fraction of the carpet width.
export const SELVEDGE = 0.006;

const ATLAS_W = 4096;
const MAX_ATLAS_H = 4096;
export const SHELF_H = 64;
const FONT_PX = 46;
const BASELINE = 44;
const PAD = 7;
// A row shows the middle band of each word's shelf; ascenders and descenders reach
// into the rows above and below, so lines interlock like packed yarn.
export const CROP_TOP = 0.25;
export const CROP = 0.5;
const INFO_W = 64;

// Raj counts knots along a fixed span. Here one knot is one word, so Raj sets how many
// rows of words run down the carpet (and with them, how small the words are).
export function rowsForRaj(raj) {
  return Math.round(raj * 4);
}

// Separable running-sum box blur.
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

export async function buildWordAtlas(words) {
  await document.fonts.load(`700 ${FONT_PX}px Amiri`, 'خیام');
  const cv = document.createElement('canvas');
  cv.width = ATLAS_W;
  const measure = cv.getContext('2d');
  measure.font = `700 ${FONT_PX}px Amiri`;
  measure.direction = 'rtl';
  measure.textAlign = 'right';

  // Shelf-pack each unique word by its inked width.
  const index = new Map();
  const boxes = [];
  let x = 0;
  let y = 0;
  for (const w of words) {
    if (index.has(w)) continue;
    const m = measure.measureText(w);
    const left = Math.ceil(m.actualBoundingBoxLeft);
    const right = Math.ceil(m.actualBoundingBoxRight);
    const width = Math.max(4, left + right + 4);
    if (x + width + PAD * 2 > ATLAS_W) {
      x = 0;
      y += SHELF_H;
    }
    if (y + SHELF_H > MAX_ATLAS_H) break;
    index.set(w, boxes.length);
    boxes.push({ word: w, x: x + PAD, y, w: width, anchor: x + PAD + left + 2 });
    x += width + PAD * 2;
  }
  // Words past the atlas capacity are dropped from the stream rather than mis-drawn.
  const stream = words.filter((w) => index.has(w)).map((w) => index.get(w));

  const height = y + SHELF_H;
  cv.height = height;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${FONT_PX}px Amiri`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  // A stroke around each glyph plumps it up like thick tufted yarn.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  for (const b of boxes) {
    ctx.fillText(b.word, b.anchor, b.y + BASELINE);
    ctx.strokeText(b.word, b.anchor, b.y + BASELINE);
  }

  // Two channels: coverage, and a rounded height so each stroke reads as a plump
  // rope of yarn (highest along the middle of the stroke, falling off to its edges).
  const rgba = ctx.getImageData(0, 0, ATLAS_W, height).data;
  const n = ATLAS_W * height;
  const cover = new Float32Array(n);
  for (let i = 0; i < n; i++) cover[i] = rgba[i * 4 + 3] / 255;
  const blurred = boxBlur(boxBlur(cover, ATLAS_W, height, 3), ATLAS_W, height, 3);
  const rg = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    const c = cover[i];
    const h = c > 0 ? Math.sqrt(Math.min(1, blurred[i] * 1.5)) * c : 0;
    rg[i * 2] = c * 255;
    rg[i * 2 + 1] = h * 255;
  }
  const atlas = new THREE.DataTexture(rg, ATLAS_W, height, THREE.RGFormat, THREE.UnsignedByteType);
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.anisotropy = 8;
  atlas.needsUpdate = true;

  // Where each word sits in the atlas: x, y, inked width (pixels).
  const infoRows = Math.ceil(boxes.length / INFO_W);
  const info = new Float32Array(INFO_W * infoRows * 4);
  boxes.forEach((b, i) => info.set([b.x, b.y, b.w, 0], i * 4));
  const infoTex = new THREE.DataTexture(info, INFO_W, infoRows, THREE.RGBAFormat, THREE.FloatType);
  infoTex.minFilter = infoTex.magFilter = THREE.NearestFilter;
  infoTex.needsUpdate = true;

  return {
    texture: atlas,
    info: infoTex,
    size: new THREE.Vector2(ATLAS_W, height),
    widths: boxes.map((b) => b.w),
    stream,
    uniqueCount: boxes.length,
  };
}

// Sets the poem into the carpet. Each row is split into runs of one motif colour;
// each run is filled with whole words, justified to fit exactly, so the motif's
// edges fall between words and the pattern exists only in how the words are dyed.
// Returns a float texture with one row per carpet row; each texel is a word: start
// and end (measured leftward from the right edge, in carpet widths), atlas index and
// palette colour.
export function buildLayout(raj, atlas, sampleDesign) {
  const rows = rowsForRaj(raj);
  const rowH = (CARPET_H * (1 - 2 * KILIM)) / rows;
  // A word keeps its proportions: shelf height maps to row height.
  const metresPerPx = rowH / (SHELF_H * CROP);
  const x0 = SELVEDGE * CARPET_W;
  const usable = CARPET_W * (1 - 2 * SELVEDGE);
  const gap = rowH * 0.05;
  const step = 0.002;
  const minRun = rowH * 0.7;
  const { stream, widths } = atlas;
  const width = (idx) => widths[idx] * metresPerPx;

  // The shortest words (و، که، از، ...) fill the narrow runs: outlines, stems, dots.
  const byWidth = [...new Set(stream)].sort((a, b) => widths[a] - widths[b]);
  const shortPool = byWidth.slice(0, Math.min(48, byWidth.length));
  let poolTurn = 0;
  const pickShort = (room) => {
    // Rotate through the short words that fit, so narrow runs don't repeat one word.
    const fits = shortPool.filter((i) => width(i) <= room);
    const list = fits.length ? fits : shortPool.slice(0, 3);
    return list[poolTurn++ % list.length];
  };

  let w = 0;
  let placed = 0;
  let maxWords = 0;
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const v = 1 - KILIM - ((r + 0.5) / rows) * (1 - 2 * KILIM);
    // Colour runs along the row, right to left.
    let runs = [];
    for (let x = 0; x < usable; x += step) {
      const pal = sampleDesign(1 - (x0 + x + step / 2) / CARPET_W, v);
      const last = runs[runs.length - 1];
      if (last && last.pal === pal) last.len += step;
      else runs.push({ pal, len: Math.min(step, usable - x) });
    }
    // Fold runs too narrow for any word into their longer neighbour.
    for (let guard = 0; guard < 200; guard++) {
      let small = -1;
      for (let i = 0; i < runs.length; i++) if (runs[i].len < minRun && (small < 0 || runs[i].len < runs[small].len)) small = i;
      if (small < 0 || runs.length < 2) break;
      const left = runs[small - 1];
      const right = runs[small + 1];
      const into = !left ? right : !right ? left : left.len >= right.len ? left : right;
      into.len += runs[small].len;
      runs.splice(small, 1);
      // Re-merge neighbours that now share a colour.
      runs = runs.reduce((acc, run) => {
        const prev = acc[acc.length - 1];
        if (prev && prev.pal === run.pal) prev.len += run.len;
        else acc.push({ ...run });
        return acc;
      }, []);
    }

    const line = [];
    let x = x0;
    for (const run of runs) {
      const L = run.len;
      const words = [];
      let natural = 0;
      for (;;) {
        const gaps = words.length * gap;
        const idx = stream[w % stream.length];
        const ww = width(idx);
        if (!words.length) {
          if (ww <= L * 1.45) {
            words.push(idx);
            natural += ww;
            w++;
          } else {
            const s = pickShort(L * 1.45);
            words.push(s);
            natural += width(s);
          }
          continue;
        }
        if (natural + gaps + ww <= L * 1.12) {
          words.push(idx);
          natural += ww;
          w++;
          continue;
        }
        // Top off a run left too loose with a short word.
        const room = L - natural - gaps;
        if (room > L * 0.22 && room > minRun * 0.6) {
          const s = pickShort(room * 1.2);
          words.push(s);
          natural += width(s);
        }
        break;
      }
      // Justify: stretch or compress the words a little (like kashida), then spread
      // whatever is left into the gaps.
      const gapsTotal = (words.length - 1) * gap;
      const scale = Math.min(1.5, Math.max(0.6, (L - gapsTotal) / natural));
      const spare = L - gapsTotal - natural * scale;
      const extra = words.length > 1 ? spare / (words.length - 1) : 0;
      let wx = x + (words.length > 1 ? 0 : spare / 2);
      for (const idx of words) {
        const ww = width(idx) * scale;
        line.push({ start: wx, end: wx + ww, idx, pal: run.pal });
        wx += ww + gap + extra;
      }
      placed += words.length;
      x += L;
    }
    lines.push(line);
    maxWords = Math.max(maxWords, line.length);
  }

  // Power-of-two width so the shader can binary-search each row.
  let n = 1;
  while (n < maxWords + 1) n *= 2;
  const data = new Float32Array(n * rows * 4);
  for (let r = 0; r < rows; r++) {
    const line = lines[r];
    for (let k = 0; k < n; k++) {
      const o = (r * n + k) * 4;
      if (k < line.length) {
        const word = line[k];
        data[o] = word.start / CARPET_W;
        data[o + 1] = word.end / CARPET_W;
        data[o + 2] = word.idx;
        data[o + 3] = word.pal;
      } else {
        data[o] = 2; // sentinel past the left edge
        data[o + 1] = 2;
      }
    }
  }
  const tex = new THREE.DataTexture(data, n, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return { texture: tex, rows, slots: n, words: placed, pxPerMetre: 1 / metresPerPx };
}
