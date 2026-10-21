// Verlet mass-spring cloth for a heavy wool-and-silk rug hung from rings on a rod.
// The rug only moves when grabbed; afterwards it swings, damps out and goes to sleep.
import * as THREE from 'three';

const GRAVITY = -9.81;
const DT = 1 / 120;
const ITERATIONS = 18;

export class Cloth {
  constructor({ width, height, cols = 42, rows = 60, top, ringEvery = 4 }) {
    this.cols = cols;
    this.rows = rows;
    this.width = width;
    this.height = height;
    const n = cols * rows;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.invMass = new Float32Array(n).fill(1);
    this.rings = [];

    const dx = width / (cols - 1);
    const dy = height / (rows - 1);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 3;
        // A faint ripple breaks symmetry so the rug finds a natural, uneven drape.
        const z = 0.006 * Math.sin(i * 0.55 + j * 0.13) * (j / rows);
        this.pos[k] = -width / 2 + i * dx;
        this.pos[k + 1] = top - j * dy;
        this.pos[k + 2] = z;
      }
    }
    this.prev.set(this.pos);

    for (let i = 0; i < cols; i++) {
      if (i % ringEvery === 1 || i === 0 || i === cols - 1) {
        this.invMass[i] = 0;
        this.rings.push(i);
      }
    }

    const a = [];
    const b = [];
    const rest = [];
    const stiff = [];
    const add = (i0, j0, i1, j1, k, slack = 1) => {
      if (i0 >= cols || i1 < 0 || i1 >= cols || j1 >= rows) return;
      const p = j0 * cols + i0;
      const q = j1 * cols + i1;
      a.push(p);
      b.push(q);
      rest.push(Math.hypot((i1 - i0) * dx, (j1 - j0) * dy) * slack);
      stiff.push(k);
    };
    for (let j = 0; j < rows; j++) {
      // Hand-knotted rugs are never perfectly square: a little extra weft in some
      // rows makes the rug ripple faintly as it hangs.
      const slack = 1 + 0.0035 * (0.5 + 0.5 * Math.sin(j * 0.41 + 0.7)) * (j / rows);
      for (let i = 0; i < cols; i++) {
        add(i, j, i + 1, j, 1, slack);
        add(i, j, i, j + 1, 1);
        add(i, j, i + 1, j + 1, 0.8);
        add(i + 1, j, i, j + 1, 0.8);
        // Bending resistance: wool pile on a cotton foundation is stiff.
        add(i, j, i + 2, j, 0.6, slack);
        add(i, j, i, j + 2, 0.6);
      }
    }
    this.ca = Int32Array.from(a);
    this.cb = Int32Array.from(b);
    this.crest = Float32Array.from(rest);
    this.cstiff = Float32Array.from(stiff);

    this.grab = null;
    this.awake = true;
    this.calm = 0;
    this.floorY = 0.01;
  }

  settle(steps) {
    for (let s = 0; s < steps; s++) this.step();
    this.prev.set(this.pos);
    this.awake = false;
  }

  wake() {
    this.awake = true;
    this.calm = 0;
  }

  // index of the particle nearest a (u, v) on the carpet, v = 1 at the top
  indexAtUv(u, v) {
    const i = Math.round(u * (this.cols - 1));
    const j = Math.round((1 - v) * (this.rows - 1));
    return j * this.cols + i;
  }

  startGrab(index, target) {
    const ci = index % this.cols;
    const cj = Math.floor(index / this.cols);
    const neighbors = [];
    const R = 3;
    const sigma = 1.7;
    for (let j = cj - R; j <= cj + R; j++) {
      for (let i = ci - R; i <= ci + R; i++) {
        if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) continue;
        const d2 = (i - ci) ** 2 + (j - cj) ** 2;
        if (d2 > R * R) continue;
        neighbors.push([j * this.cols + i, Math.exp(-d2 / (2 * sigma * sigma))]);
      }
    }
    this.grab = { index, target: target.clone(), neighbors };
    this.wake();
  }

  moveGrab(target) {
    if (this.grab) this.grab.target.copy(target);
  }

  endGrab() {
    this.grab = null;
  }

  step() {
    const { pos, prev, invMass } = this;
    const n = invMass.length;
    // Heavy pile: noticeable air drag, more once released so it settles calmly.
    const damp = this.grab ? 0.985 : 0.982;
    const g = GRAVITY * DT * DT;
    let maxMove = 0;
    for (let p = 0; p < n; p++) {
      if (invMass[p] === 0) continue;
      const k = p * 3;
      for (let c = 0; c < 3; c++) {
        const x = pos[k + c];
        const v = (x - prev[k + c]) * damp;
        prev[k + c] = x;
        pos[k + c] = x + v + (c === 1 ? g : 0);
        const m = Math.abs(v);
        if (m > maxMove) maxMove = m;
      }
    }

    if (this.grab) {
      const { index, target, neighbors } = this.grab;
      const k = index * 3;
      let dx = target.x - pos[k];
      let dy = target.y - pos[k + 1];
      let dz = target.z - pos[k + 2];
      const len = Math.hypot(dx, dy, dz);
      const maxStep = 0.03;
      if (len > maxStep) {
        dx *= maxStep / len;
        dy *= maxStep / len;
        dz *= maxStep / len;
      }
      for (const [p, w] of neighbors) {
        if (invMass[p] === 0) continue;
        const q = p * 3;
        pos[q] += dx * w * 0.6;
        pos[q + 1] += dy * w * 0.6;
        pos[q + 2] += dz * w * 0.6;
      }
    }

    const { ca, cb, crest, cstiff } = this;
    const m = ca.length;
    for (let it = 0; it < ITERATIONS; it++) {
      for (let c = 0; c < m; c++) {
        const pa = ca[c];
        const pb = cb[c];
        const wa = invMass[pa];
        const wb = invMass[pb];
        const w = wa + wb;
        if (w === 0) continue;
        const ia = pa * 3;
        const ib = pb * 3;
        const dx = pos[ib] - pos[ia];
        const dy = pos[ib + 1] - pos[ia + 1];
        const dz = pos[ib + 2] - pos[ia + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const f = ((d - crest[c]) / (d * w)) * cstiff[c];
        pos[ia] += dx * f * wa;
        pos[ia + 1] += dy * f * wa;
        pos[ia + 2] += dz * f * wa;
        pos[ib] -= dx * f * wb;
        pos[ib + 1] -= dy * f * wb;
        pos[ib + 2] -= dz * f * wb;
      }
    }

    for (let p = 0; p < n; p++) {
      const k = p * 3 + 1;
      if (pos[k] < this.floorY) {
        pos[k] = this.floorY;
        prev[k] = this.floorY;
      }
    }

    if (!this.grab) {
      this.calm = maxMove < 1.5e-5 ? this.calm + 1 : 0;
      if (this.calm > 150) {
        this.prev.set(this.pos);
        this.awake = false;
      }
    }
  }

  // Advances the simulation by real elapsed time; returns true if anything moved.
  update(elapsed) {
    if (!this.awake) return false;
    this.accum = Math.min((this.accum || 0) + elapsed, DT * 4);
    while (this.accum >= DT) {
      this.step();
      this.accum -= DT;
      if (!this.awake) break;
    }
    return true;
  }
}

// Renders the cloth at twice the simulation resolution with Catmull-Rom smoothing,
// so folds stay round without simulating more particles.
export class ClothGeometry extends THREE.BufferGeometry {
  constructor(cloth) {
    super();
    this.cloth = cloth;
    this.rc = (cloth.cols - 1) * 2 + 1;
    this.rr = (cloth.rows - 1) * 2 + 1;
    const nv = this.rc * this.rr;
    const pos = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    for (let j = 0; j < this.rr; j++) {
      for (let i = 0; i < this.rc; i++) {
        const v = j * this.rc + i;
        uv[v * 2] = i / (this.rc - 1);
        uv[v * 2 + 1] = 1 - j / (this.rr - 1);
      }
    }
    const idx = [];
    for (let j = 0; j < this.rr - 1; j++) {
      for (let i = 0; i < this.rc - 1; i++) {
        const a = j * this.rc + i;
        const b = a + 1;
        const c = a + this.rc;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    this.setIndex(idx);
    this.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.tmp = new Float32Array(this.rc * cloth.rows * 3);
    this.sync();
  }

  sync() {
    const { cloth, rc, rr, tmp } = this;
    const src = cloth.pos;
    const cols = cloth.cols;
    const rows = cloth.rows;
    // Pass 1: refine along each simulated row.
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < rc; i++) {
        const o = (j * rc + i) * 3;
        const si = i >> 1;
        if ((i & 1) === 0) {
          const s = (j * cols + si) * 3;
          tmp[o] = src[s];
          tmp[o + 1] = src[s + 1];
          tmp[o + 2] = src[s + 2];
        } else {
          for (let c = 0; c < 3; c++) {
            const p1 = src[(j * cols + si) * 3 + c];
            const p2 = src[(j * cols + si + 1) * 3 + c];
            const p0 = si > 0 ? src[(j * cols + si - 1) * 3 + c] : 2 * p1 - p2;
            const p3 = si + 2 < cols ? src[(j * cols + si + 2) * 3 + c] : 2 * p2 - p1;
            tmp[o + c] = (-p0 + 9 * p1 + 9 * p2 - p3) / 16;
          }
        }
      }
    }
    // Pass 2: refine along each column.
    const out = this.attributes.position.array;
    for (let j = 0; j < rr; j++) {
      const sj = j >> 1;
      for (let i = 0; i < rc; i++) {
        const o = (j * rc + i) * 3;
        if ((j & 1) === 0) {
          const s = (sj * rc + i) * 3;
          out[o] = tmp[s];
          out[o + 1] = tmp[s + 1];
          out[o + 2] = tmp[s + 2];
        } else {
          for (let c = 0; c < 3; c++) {
            const p1 = tmp[(sj * rc + i) * 3 + c];
            const p2 = tmp[((sj + 1) * rc + i) * 3 + c];
            const p0 = sj > 0 ? tmp[((sj - 1) * rc + i) * 3 + c] : 2 * p1 - p2;
            const p3 = sj + 2 < rows ? tmp[((sj + 2) * rc + i) * 3 + c] : 2 * p2 - p1;
            out[o + c] = (-p0 + 9 * p1 + 9 * p2 - p3) / 16;
          }
        }
      }
    }
    this.attributes.position.needsUpdate = true;
    this.computeVertexNormals();
    this.computeBoundingSphere();
  }

  // World positions of the bottom edge, left to right, for the fringe.
  bottomEdge(target) {
    const out = this.attributes.position.array;
    const base = (this.rr - 1) * this.rc;
    for (let i = 0; i < this.rc; i++) {
      const o = (base + i) * 3;
      target[i * 3] = out[o];
      target[i * 3 + 1] = out[o + 1];
      target[i * 3 + 2] = out[o + 2];
    }
  }
}
