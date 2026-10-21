// Cotton warp fringe along the bottom edge. Each strip hangs as a short chain that
// follows the rug's bottom edge with its own small swing.
import * as THREE from 'three';

const SEGMENTS = 6;
const LENGTH = 0.11;

function fringeTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);
  // Warp threads gathered in knotted bundles of four.
  const threads = 24;
  for (let t = 0; t < threads; t++) {
    const bundle = Math.floor(t / 4);
    const x = (bundle + 0.5) * (512 / 6) + ((t % 4) - 1.5) * 7;
    const sway = (Math.random() - 0.5) * 10;
    const len = 256 * (0.86 + Math.random() * 0.14);
    ctx.strokeStyle = `rgba(255,255,255,1)`;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x, 80, x + sway, 150, x + sway * 1.4, len);
    ctx.stroke();
  }
  // knot at the top of each bundle
  for (let b = 0; b < 6; b++) {
    const x = (b + 0.5) * (512 / 6);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x, 22, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(0, 0, 512, 10);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export class Fringe {
  constructor(count) {
    this.count = count;
    const n = count * (SEGMENTS + 1);
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.edge = new Float32Array(count * 3);

    const geo = new THREE.BufferGeometry();
    const uv = new Float32Array(n * 2);
    for (let s = 0; s <= SEGMENTS; s++) {
      for (let i = 0; i < count; i++) {
        const v = s * count + i;
        uv[v * 2] = (i / (count - 1)) * 34;
        uv[v * 2 + 1] = 1 - s / SEGMENTS;
      }
    }
    const idx = [];
    for (let s = 0; s < SEGMENTS; s++) {
      for (let i = 0; i < count - 1; i++) {
        const a = s * count + i;
        const b = a + 1;
        const c = a + count;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry = geo;

    const alpha = fringeTexture();
    this.material = new THREE.MeshStandardMaterial({
      color: 0xe9dfc8,
      roughness: 0.88,
      alphaMap: alpha,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaMap: alpha,
      alphaTest: 0.45,
    });
    this.initialized = false;
    this.restSteps = 0;
  }

  // Returns true while the strands are still moving.
  update(clothGeometry) {
    clothGeometry.bottomEdge(this.edge);
    const { pos, prev, edge, count } = this;
    const seg = LENGTH / SEGMENTS;
    if (!this.initialized) {
      for (let s = 0; s <= SEGMENTS; s++) {
        for (let i = 0; i < count; i++) {
          const o = (s * count + i) * 3;
          pos[o] = edge[i * 3];
          pos[o + 1] = edge[i * 3 + 1] - s * seg;
          pos[o + 2] = edge[i * 3 + 2];
        }
      }
      prev.set(pos);
      this.initialized = true;
    }
    let maxMove = 0;
    const g = -9.81 / 3600;
    for (let s = 0; s <= SEGMENTS; s++) {
      for (let i = 0; i < count; i++) {
        const o = (s * count + i) * 3;
        if (s === 0) {
          pos[o] = edge[i * 3];
          pos[o + 1] = edge[i * 3 + 1];
          pos[o + 2] = edge[i * 3 + 2];
          continue;
        }
        for (let c = 0; c < 3; c++) {
          const v = (pos[o + c] - prev[o + c]) * 0.94;
          prev[o + c] = pos[o + c];
          pos[o + c] += v + (c === 1 ? g : 0);
          maxMove = Math.max(maxMove, Math.abs(v));
        }
      }
    }
    for (let it = 0; it < 4; it++) {
      for (let s = 1; s <= SEGMENTS; s++) {
        for (let i = 0; i < count; i++) {
          const a = ((s - 1) * count + i) * 3;
          const b = (s * count + i) * 3;
          const dx = pos[b] - pos[a];
          const dy = pos[b + 1] - pos[a + 1];
          const dz = pos[b + 2] - pos[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          const f = (d - seg) / d;
          const wa = s === 1 ? 0 : 0.5;
          const wb = s === 1 ? 1 : 0.5;
          pos[a] += dx * f * wa;
          pos[a + 1] += dy * f * wa;
          pos[a + 2] += dz * f * wa;
          pos[b] -= dx * f * wb;
          pos[b + 1] -= dy * f * wb;
          pos[b + 2] -= dz * f * wb;
        }
      }
    }
    for (let k = 1; k < pos.length; k += 3) if (pos[k] < 0.004) pos[k] = 0.004;
    this.geometry.attributes.position.array.set(pos);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.restSteps = maxMove < 2e-5 ? this.restSteps + 1 : 0;
    return this.restSteps < 60;
  }
}
