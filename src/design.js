// The carpet "cartoon": a Shah Abbas composition (toranj medallion, lachak corners,
// arabesque field, cartouche border) drawn as vectors, then sampled once per knot.

export const PALETTE = [
  '#7a1822', // 0 madder red (laki) — field
  '#152238', // 1 Persian indigo (sormei)
  '#f7f2e7', // 2 natural silk ivory
  '#c99738', // 3 burnished gold
  '#2c6e78', // 4 Persian turquoise
  '#2e4b3e', // 5 cypress green
  '#b4545a', // 6 rose
  '#2b1610', // 7 walnut brown (outline / edging)
  '#6e8fb0', // 8 lapis sky
];

export const DESIGN_W = 1024;
export const DESIGN_H = 1536;
// Fraction of the height taken by the flat-woven kilim band at each end.
export const KILIM = 0.02;

const C = (i) => PALETTE[i];

function lobedPath(ctx, cx, cy, rx, ry, lobes, depth, steps = 360) {
  ctx.beginPath();
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    const s = 1 - depth * (1 - Math.abs(Math.sin((lobes * t) / 2)));
    const x = cx + Math.cos(t) * rx * s;
    const y = cy + Math.sin(t) * ry * s;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function starPath(ctx, cx, cy, rOut, rIn, points) {
  ctx.beginPath();
  for (let k = 0; k <= points * 2; k++) {
    const t = (k / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 ? rIn : rOut;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function leaf(ctx, x, y, len, wid, angle, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

// Shah Abbasi palmette: a fan of lobes with a contrasting heart.
function palmette(ctx, x, y, size, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  for (let k = 0; k <= 5; k++) {
    const a = Math.PI + (k / 5) * Math.PI;
    ctx.quadraticCurveTo(
      Math.cos(a - 0.3) * size * 1.15, Math.sin(a - 0.3) * size * 1.15,
      Math.cos(a) * size, Math.sin(a) * size
    );
  }
  ctx.closePath();
  ctx.fillStyle = C(2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.1, size * 0.48, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C(6);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.1, size * 0.2, size * 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = C(1);
  ctx.fill();
  ctx.restore();
}

function rosette(ctx, x, y, r, petal, heart) {
  lobedPath(ctx, x, y, r, r, 8, 0.35, 96);
  ctx.fillStyle = petal;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = heart;
  ctx.fill();
}

// A logarithmic scroll from (x, y), turning `turns` times inward.
function spiral(ctx, x, y, r0, turns, dir, phase, width, color) {
  const pts = [];
  const n = 120;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = phase + dir * t * turns * Math.PI * 2;
    const r = r0 * Math.exp(-2.2 * t);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, a]);
  }
  ctx.beginPath();
  pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  return pts;
}

function drawFieldQuadrant(ctx, fw, fh) {
  // Coordinates relative to the carpet centre, quadrant x>0, y>0 (mirrored 4 ways).
  const scrolls = [
    { x: fw * 0.27, y: fh * 0.13, r: 120, turns: 1.15, dir: 1, phase: 3.6 },
    { x: fw * 0.3, y: fh * 0.36, r: 110, turns: 1.1, dir: -1, phase: 0.8 },
    { x: fw * 0.08, y: fh * 0.39, r: 95, turns: 1.05, dir: 1, phase: 5.2 },
  ];
  for (const s of scrolls) {
    const pts = spiral(ctx, s.x, s.y, s.r, s.turns, s.dir, s.phase, 14, C(3));
    // leaves and buds along each scroll
    for (let k = 14; k < pts.length - 10; k += 17) {
      const [px, py, a] = pts[k];
      leaf(ctx, px, py, 46, 15, a + s.dir * 1.9, k % 2 ? C(5) : C(4));
    }
    const [ex, ey, ea] = pts[pts.length - 1];
    rosette(ctx, ex, ey, 22, C(2), C(0));
    const [sx, sy, sa] = pts[0];
    palmette(ctx, sx, sy, 34, sa + Math.PI / 2);
  }
  // Scattered rosettes and blossoms between the scrolls.
  const blossoms = [
    [fw * 0.43, fh * 0.06], [fw * 0.12, fh * 0.21], [fw * 0.44, fh * 0.25],
    [fw * 0.2, fh * 0.29], [fw * 0.4, fh * 0.46], [fw * 0.22, fh * 0.47],
  ];
  blossoms.forEach(([bx, by], k) => rosette(ctx, bx, by, 15, k % 2 ? C(8) : C(2), k % 2 ? C(1) : C(6)));
}

function drawMedallion(ctx, cx, cy) {
  const rx = 196;
  const ry = 300;
  // Pendants (sar-toranj) and finials above and below
  for (const s of [-1, 1]) {
    const py = cy + s * (ry + 52);
    lobedPath(ctx, cx, py, 62, 70, 10, 0.22);
    ctx.fillStyle = C(2);
    ctx.fill();
    lobedPath(ctx, cx, py, 46, 54, 10, 0.22);
    ctx.fillStyle = C(1);
    ctx.fill();
    rosette(ctx, cx, py, 22, C(3), C(6));
    ctx.beginPath();
    ctx.moveTo(cx - 22, py + s * 60);
    ctx.lineTo(cx, py + s * 132);
    ctx.lineTo(cx + 22, py + s * 60);
    ctx.closePath();
    ctx.fillStyle = C(3);
    ctx.fill();
  }
  // Outer ivory frame, indigo body
  lobedPath(ctx, cx, cy, rx + 16, ry + 16, 24, 0.07);
  ctx.fillStyle = C(2);
  ctx.fill();
  lobedPath(ctx, cx, cy, rx, ry, 24, 0.07);
  ctx.fillStyle = C(1);
  ctx.fill();
  // Gold arabesque inside the indigo
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
  ctx.clip();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      const pts = spiral(ctx, rx * 0.5, ry * 0.42, 70, 1.0, 1, 2.6, 12, C(3));
      for (let k = 20; k < pts.length; k += 26) leaf(ctx, pts[k][0], pts[k][1], 36, 12, pts[k][2] + 1.9, C(4));
      palmette(ctx, rx * 0.12, ry * 0.7, 28, Math.PI);
      ctx.restore();
    }
  }
  ctx.restore();
  // Inner red medallion with ivory edge
  lobedPath(ctx, cx, cy, 108, 160, 16, 0.12);
  ctx.fillStyle = C(2);
  ctx.fill();
  lobedPath(ctx, cx, cy, 94, 144, 16, 0.12);
  ctx.fillStyle = C(0);
  ctx.fill();
  starPath(ctx, cx, cy, 88, 46, 8);
  ctx.fillStyle = C(3);
  ctx.fill();
  starPath(ctx, cx, cy, 62, 34, 8);
  ctx.fillStyle = C(6);
  ctx.fill();
  rosette(ctx, cx, cy, 34, C(2), C(4));
}

function drawLachak(ctx, x, y, sx, sy) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  // Quarter of a lobed ellipse anchored in the field corner
  lobedPath(ctx, 0, 0, 236, 300, 20, 0.08);
  ctx.fillStyle = C(2);
  ctx.fill();
  lobedPath(ctx, 0, 0, 220, 284, 20, 0.08);
  ctx.fillStyle = C(1);
  ctx.fill();
  const pts = spiral(ctx, 96, 120, 80, 1.05, -1, 0.4, 12, C(3));
  for (let k = 16; k < pts.length; k += 24) leaf(ctx, pts[k][0], pts[k][1], 34, 12, pts[k][2] - 1.9, C(4));
  palmette(ctx, 150, 52, 28, -Math.PI / 2);
  palmette(ctx, 40, 200, 28, Math.PI);
  rosette(ctx, 0, 0, 52, C(6), C(3));
  ctx.restore();
}

// Walks a rectangle's perimeter clockwise; returns position + inward normal at distance s.
function rectWalker(x0, y0, x1, y1) {
  const w = x1 - x0;
  const h = y1 - y0;
  const total = 2 * (w + h);
  return {
    total,
    at(s) {
      s = ((s % total) + total) % total;
      if (s < w) return { x: x0 + s, y: y0, nx: 0, ny: 1, a: 0 };
      s -= w;
      if (s < h) return { x: x1, y: y0 + s, nx: -1, ny: 0, a: Math.PI / 2 };
      s -= h;
      if (s < w) return { x: x1 - s, y: y1, nx: 0, ny: -1, a: Math.PI };
      s -= w;
      return { x: x0, y: y1 - s, nx: 1, ny: 0, a: -Math.PI / 2 };
    },
  };
}

function guardStripe(ctx, x0, y0, x1, y1, ground, dot, spacing, r) {
  const m = (r * 2 + 6) / 2;
  ctx.fillStyle = ground;
  ctx.fillRect(x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m);
  const walk = rectWalker(x0, y0, x1, y1);
  for (let s = 0; s < walk.total; s += spacing) {
    const p = walk.at(s);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();
  }
}

export function drawDesign(scale = 2) {
  const cv = document.createElement('canvas');
  cv.width = DESIGN_W * scale;
  cv.height = DESIGN_H * scale;
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  const kil = DESIGN_H * KILIM;
  const top = kil;
  const bot = DESIGN_H - kil;
  const W = DESIGN_W;

  // Walnut edging
  ctx.fillStyle = C(7);
  ctx.fillRect(0, 0, W, DESIGN_H);

  // Outer guard: rose with ivory reciprocal dots
  guardStripe(ctx, 26, top + 26, W - 26, bot - 26, C(6), C(2), 34, 9);
  // Gold rule
  ctx.fillStyle = C(3);
  ctx.fillRect(42, top + 42, W - 84, bot - top - 84);

  // Main border: indigo ground with vine and cartouches
  const b0 = 54;
  const b1 = 158;
  ctx.fillStyle = C(1);
  ctx.fillRect(b0, top + b0, W - 2 * b0, bot - top - 2 * b0);
  const mid = (b0 + b1) / 2;
  const walk = rectWalker(mid, top + mid, W - mid, bot - mid);
  ctx.beginPath();
  for (let s = 0; s <= walk.total; s += 3) {
    const p = walk.at(s);
    const off = Math.sin((s / 150) * Math.PI * 2) * 30;
    const x = p.x + p.nx * off;
    const y = p.y + p.ny * off;
    s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.strokeStyle = C(3);
  ctx.lineWidth = 11;
  ctx.stroke();
  for (let s = 75; s < walk.total; s += 150) {
    const p = walk.at(s);
    for (const side of [-1, 1]) {
      leaf(ctx, p.x + p.nx * side * 30, p.y + p.ny * side * 30, 30, 10, p.a + side * 0.9 + (side > 0 ? Math.PI : 0), C(5));
    }
  }
  let k = 0;
  for (let s = 0; s < walk.total; s += 150, k++) {
    const p = walk.at(s);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    if (k % 2 === 0) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 52, 36, 0, 0, Math.PI * 2);
      ctx.fillStyle = C(2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 27, 0, 0, Math.PI * 2);
      ctx.fillStyle = C(0);
      ctx.fill();
      rosette(ctx, 0, 0, 15, C(3), C(1));
    } else {
      lobedPath(ctx, 0, 0, 40, 34, 8, 0.2);
      ctx.fillStyle = C(2);
      ctx.fill();
      lobedPath(ctx, 0, 0, 31, 26, 8, 0.2);
      ctx.fillStyle = C(4);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = C(3);
      ctx.fill();
    }
    ctx.restore();
  }
  // Corner rosettes of the main border
  for (const [x, y] of [[mid, top + mid], [W - mid, top + mid], [W - mid, bot - mid], [mid, bot - mid]]) {
    rosette(ctx, x, y, 40, C(2), C(0));
  }

  // Inner guards: gold rule, turquoise band with ivory dots, ivory rule
  ctx.fillStyle = C(3);
  ctx.fillRect(b1, top + b1, W - 2 * b1, bot - top - 2 * b1);
  guardStripe(ctx, b1 + 24, top + b1 + 24, W - b1 - 24, bot - b1 - 24, C(4), C(2), 30, 7);
  const f0 = b1 + 42;
  ctx.fillStyle = C(2);
  ctx.fillRect(f0 - 6, top + f0 - 6, W - 2 * f0 + 12, bot - top - 2 * f0 + 12);

  // Field
  const fx0 = f0;
  const fy0 = top + f0;
  const fx1 = W - f0;
  const fy1 = bot - f0;
  const cx = W / 2;
  const cy = DESIGN_H / 2;
  ctx.fillStyle = C(0);
  ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  ctx.clip();
  const fw = (fx1 - fx0) / 2;
  const fh = (fy1 - fy0) / 2;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      drawFieldQuadrant(ctx, fw, fh);
      ctx.restore();
    }
  }
  drawLachak(ctx, fx0, fy0, 1, 1);
  drawLachak(ctx, fx1, fy0, -1, 1);
  drawLachak(ctx, fx0, fy1, 1, -1);
  drawLachak(ctx, fx1, fy1, -1, -1);
  drawMedallion(ctx, cx, cy);
  ctx.restore();

  return cv;
}

const RGB = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

// Returns a sampler mapping carpet (u, v), v = 1 at the top, to a palette index.
// The layout reads it to decide which colour each word is dyed.
export function createDesignSampler() {
  const scale = 1;
  const cv = drawDesign(scale);
  const W = cv.width;
  const H = cv.height;
  const data = cv.getContext('2d').getImageData(0, 0, W, H).data;
  return (u, v) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor((1 - v) * H)));
    const o = (y * W + x) * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < RGB.length; i++) {
      const dr = r - RGB[i][0], dg = g - RGB[i][1], db = b - RGB[i][2];
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };
}
