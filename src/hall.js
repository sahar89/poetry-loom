// A sunlit Isfahan vaulted hall built in code: pointed-arch arcades, a tall pointed
// barrel vault with transverse ribs, high lattice (shabak) windows that cast sun
// patterns, and travertine and limestone surfaces.
import * as THREE from 'three';

export const HALL = {
  halfW: 6,
  halfL: 10,
  spring: 8,
  wall: 0.7,
  windowZs: [-7.8, -5.2, -2.6, 0, 2.6, 5.2, 7.8],
  windowW: 1.8,
  windowY0: 4.9,
  windowY1: 6.3,
};

// Pointed arch from (-hw, 0) to (hw, 0) rising h (h > hw); returns points left→right.
export function archPoints(hw, h, steps = 24) {
  const d = (h * h - hw * hw) / (2 * hw);
  const R = hw + d;
  const pts = [];
  const aEnd = Math.atan2(h, -d);
  for (let k = 0; k <= steps; k++) {
    const a = Math.PI + (aEnd - Math.PI) * (k / steps);
    pts.push(new THREE.Vector2(d + Math.cos(a) * R, Math.sin(a) * R));
  }
  for (let k = steps - 1; k >= 0; k--) pts.push(new THREE.Vector2(-pts[k].x, pts[k].y));
  return pts;
}

// Closed outline of an arched opening: straight jambs from y0 to y1, arch on top.
function archOpening(cx, y0, y1, w, rise = 1.15) {
  const hw = w / 2;
  const path = new THREE.Path();
  path.moveTo(cx - hw, y0);
  path.lineTo(cx - hw, y1);
  for (const p of archPoints(hw, hw * rise)) path.lineTo(cx + p.x, y1 + p.y);
  path.lineTo(cx + hw, y0);
  path.closePath();
  return path;
}

function stoneTexture({ base, var: variance, courseH, blockW, seed = 1, grout = 'rgba(70,52,36,0.35)', size = 1024 }) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rows = Math.round(size / courseH);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * blockW * 0.5;
    for (let x = -blockW; x < size + blockW; x += blockW) {
      const l = (rnd() - 0.5) * variance;
      ctx.fillStyle = `rgba(${l > 0 ? 255 : 60},${l > 0 ? 240 : 45},${l > 0 ? 215 : 30},${Math.abs(l)})`;
      ctx.fillRect(x + off, r * courseH, blockW, courseH);
    }
  }
  // travertine pores and veining
  for (let i = 0; i < size * 3; i++) {
    ctx.fillStyle = `rgba(90,70,48,${rnd() * 0.18})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 5, 1 + rnd() * 1.5);
  }
  ctx.strokeStyle = grout;
  ctx.lineWidth = 2;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * courseH);
    ctx.lineTo(size, r * courseH);
    ctx.stroke();
    const off = (r % 2) * blockW * 0.5;
    for (let x = off; x < size; x += blockW) {
      ctx.beginPath();
      ctx.moveTo(x, r * courseH);
      ctx.lineTo(x, (r + 1) * courseH);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Persian geometric lattice for the windows: an eight-point star grid.
function latticeTexture() {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  // White is solid stone; the black stars and crosses are the openings.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  const n = 4;
  const c = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = (x + 0.5) * c;
      const cy = (y + 0.5) * c;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + Math.PI / 16;
        const r = k % 2 ? c * 0.3 : c * 0.47;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      // small cross-shaped openings between stars
      ctx.fillRect(x * c - c * 0.07, y * c - c * 0.16, c * 0.14, c * 0.32);
      ctx.fillRect(x * c - c * 0.16, y * c - c * 0.07, c * 0.32, c * 0.14);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wallMesh(shape, depth, material) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createHall() {
  const group = new THREE.Group();
  const { halfW, halfL, spring, wall } = HALL;
  const vaultRise = halfW * 1.2;

  const wallTex = stoneTexture({ base: '#d9c7a6', var: 0.16, courseH: 64, blockW: 180, seed: 7 });
  wallTex.repeat.set(0.5, 0.5);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.82, color: 0xf2e6d2 });
  const vaultTex = stoneTexture({ base: '#e4d6bc', var: 0.1, courseH: 48, blockW: 110, seed: 3, grout: 'rgba(110,86,60,0.25)' });
  vaultTex.repeat.set(0.6, 0.6);
  const vaultMat = new THREE.MeshStandardMaterial({ map: vaultTex, roughness: 0.88, side: THREE.DoubleSide });
  const ribMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xc8b08a, roughness: 0.8 });
  const nicheMat = new THREE.MeshStandardMaterial({ map: vaultTex, color: 0xd8c5a8, roughness: 0.9, shadowSide: THREE.DoubleSide });

  // Floor: honed limestone slabs with soft reflections
  const floorTex = stoneTexture({ base: '#d8c5a8', var: 0.12, courseH: 256, blockW: 256, seed: 11, grout: 'rgba(80,60,40,0.45)' });
  floorTex.repeat.set(halfW / 2, halfL / 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 2, halfL * 2),
    new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.38, clearcoat: 0.25, clearcoatRoughness: 0.4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Side walls: lower arcade of niches, upper row of lattice windows
  const sideShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-halfL - wall, 0);
    s.lineTo(halfL + wall, 0);
    s.lineTo(halfL + wall, spring + 0.6);
    s.lineTo(-halfL - wall, spring + 0.6);
    s.closePath();
    for (const z of HALL.windowZs) {
      s.holes.push(archOpening(z, HALL.windowY0, HALL.windowY1, HALL.windowW));
      s.holes.push(archOpening(z, 0.35, 2.9, 2.0));
    }
    return s;
  };
  const left = wallMesh(sideShape(), wall, wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.x = -halfW - wall;
  group.add(left);
  const right = wallMesh(sideShape(), wall, wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.x = halfW + wall;
  group.add(right);

  // Niche backs and half-domes behind each lower arch
  const nicheBack = new THREE.Shape();
  nicheBack.moveTo(-1.1, 0);
  nicheBack.lineTo(-1.1, 2.9);
  for (const p of archPoints(1.1, 1.3)) nicheBack.lineTo(p.x, 2.9 + p.y);
  nicheBack.lineTo(1.1, 0);
  for (const side of [-1, 1]) {
    for (const z of HALL.windowZs) {
      const back = new THREE.Mesh(new THREE.ShapeGeometry(nicheBack), nicheMat);
      back.position.set(side * (halfW + wall), 0, z);
      back.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      back.receiveShadow = back.castShadow = true;
      group.add(back);
    }
  }

  // End walls with a tall central iwan and a lunette window under the vault
  const endShape = () => {
    const s = new THREE.Shape();
    s.moveTo(-halfW - wall, 0);
    s.lineTo(halfW + wall, 0);
    s.lineTo(halfW + wall, spring);
    const arch = archPoints(halfW + wall, vaultRise + wall, 32).reverse();
    for (const p of arch) s.lineTo(p.x, spring + p.y);
    s.closePath();
    s.holes.push(archOpening(0, 0.01, 5.2, 4.4, 1.2));
    s.holes.push(archOpening(0, spring + 1.6, spring + 3.6, 2.2));
    for (const x of [-4.2, 4.2]) s.holes.push(archOpening(x, 0.35, 2.9, 1.8));
    return s;
  };
  for (const side of [-1, 1]) {
    const end = wallMesh(endShape(), wall, wallMat);
    end.position.z = side < 0 ? -halfL - wall : halfL;
    group.add(end);
    // Iwan recess
    const recessDepth = 1.6;
    const iwanShape = new THREE.Shape();
    const hw = 2.2;
    iwanShape.moveTo(-hw, 0);
    iwanShape.lineTo(-hw, 5.2);
    for (const p of archPoints(hw, hw * 1.2)) iwanShape.lineTo(p.x, 5.2 + p.y);
    iwanShape.lineTo(hw, 0);
    const iwanBack = new THREE.Mesh(new THREE.ShapeGeometry(iwanShape), nicheMat);
    iwanBack.position.z = side * (halfL + wall + recessDepth);
    if (side > 0) iwanBack.rotation.y = Math.PI;
    iwanBack.receiveShadow = true;
    group.add(iwanBack);
    // Recess sides and soffit, as an extruded arch ring
    const ring = new THREE.Shape();
    ring.moveTo(-hw - 0.02, 0);
    ring.lineTo(-hw - 0.02, 5.2);
    for (const p of archPoints(hw + 0.02, (hw + 0.02) * 1.2)) ring.lineTo(p.x, 5.2 + p.y);
    ring.lineTo(hw + 0.02, 0);
    ring.lineTo(hw + 0.3, 0);
    ring.lineTo(hw + 0.3, 8.0);
    ring.lineTo(-hw - 0.3, 8.0);
    ring.lineTo(-hw - 0.3, 0);
    ring.closePath();
    const recess = wallMesh(ring, recessDepth + 0.01, nicheMat);
    recess.position.z = side < 0 ? -halfL - wall - recessDepth : halfL + wall;
    group.add(recess);
    for (const x of [-4.2, 4.2]) {
      const back = new THREE.Mesh(new THREE.ShapeGeometry(nicheBack), nicheMat);
      back.scale.x = 0.82;
      back.position.set(x, 0, side * (halfL + wall));
      if (side > 0) back.rotation.y = Math.PI;
      group.add(back);
    }
  }

  // Pointed barrel vault and transverse ribs
  const vaultProfile = new THREE.Shape();
  const outer = archPoints(halfW + wall, vaultRise + wall, 40);
  const inner = archPoints(halfW, vaultRise, 40);
  vaultProfile.moveTo(outer[0].x, outer[0].y);
  for (const p of outer) vaultProfile.lineTo(p.x, p.y);
  for (let k = inner.length - 1; k >= 0; k--) vaultProfile.lineTo(inner[k].x, inner[k].y);
  vaultProfile.closePath();
  const vault = wallMesh(vaultProfile, halfL * 2, vaultMat);
  vault.position.set(0, spring, -halfL);
  group.add(vault);

  const ribProfile = new THREE.Shape();
  const ribIn = archPoints(halfW - 0.25, vaultRise - 0.25, 40);
  ribProfile.moveTo(inner[0].x, inner[0].y);
  for (const p of inner) ribProfile.lineTo(p.x, p.y);
  for (let k = ribIn.length - 1; k >= 0; k--) ribProfile.lineTo(ribIn[k].x, ribIn[k].y);
  ribProfile.closePath();
  for (const z of [-9.1, -3.9, 1.3, 6.5]) {
    const rib = wallMesh(ribProfile, 0.5, ribMat);
    rib.position.set(0, spring, z);
    group.add(rib);
    // Pilasters carrying each rib down the walls
    for (const s of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.3, spring, 0.5), ribMat);
      pil.position.set(s * (halfW - 0.15), spring / 2, z + 0.25);
      pil.castShadow = pil.receiveShadow = true;
      group.add(pil);
    }
  }

  // Cornice at the springing line
  for (const s of [-1, 1]) {
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, halfL * 2), ribMat);
    cornice.position.set(s * (halfW - 0.08), spring, 0);
    cornice.castShadow = cornice.receiveShadow = true;
    group.add(cornice);
  }

  // Lattice screens and bright sky panes behind every window
  const lattice = latticeTexture();
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.93, 0.8).multiplyScalar(2.2) });
  const windowShape = new THREE.Shape();
  windowShape.moveTo(-HALL.windowW / 2, 0);
  windowShape.lineTo(-HALL.windowW / 2, HALL.windowY1 - HALL.windowY0);
  for (const p of archPoints(HALL.windowW / 2, (HALL.windowW / 2) * 1.15)) windowShape.lineTo(p.x, HALL.windowY1 - HALL.windowY0 + p.y);
  windowShape.lineTo(HALL.windowW / 2, 0);
  const windowGeo = new THREE.ShapeGeometry(windowShape);
  windowGeo.computeBoundingBox();
  // Shape UVs are in metres; scale the lattice to ~0.45 m cells.
  const latticeTex = lattice.clone();
  latticeTex.repeat.set(1 / 0.9, 1 / 0.9);
  latticeTex.needsUpdate = true;
  const latticeMat = new THREE.MeshStandardMaterial({
    color: 0xcdb48e,
    roughness: 0.85,
    alphaMap: latticeTex,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  const latticeDepth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    alphaMap: latticeTex,
    alphaTest: 0.5,
  });
  const windows = [];
  for (const side of [-1, 1]) {
    for (const z of HALL.windowZs) {
      const screen = new THREE.Mesh(windowGeo, latticeMat);
      screen.customDepthMaterial = latticeDepth;
      screen.castShadow = true;
      screen.position.set(side * (halfW + wall * 0.5), HALL.windowY0, z);
      screen.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(screen);
      const glow = new THREE.Mesh(windowGeo, glowMat);
      glow.position.set(side * (halfW + wall + 0.3), HALL.windowY0, z);
      glow.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(glow);
      if (side < 0) windows.push({ z });
    }
  }
  // Lunette and iwan glows on the end walls
  for (const side of [-1, 1]) {
    const lun = new THREE.Shape();
    lun.moveTo(-1.1, 0);
    lun.lineTo(-1.1, 2);
    for (const p of archPoints(1.1, 1.265)) lun.lineTo(p.x, 2 + p.y);
    lun.lineTo(1.1, 0);
    const g = new THREE.Mesh(new THREE.ShapeGeometry(lun), glowMat);
    g.position.set(0, spring + 1.6, side * (halfL + wall + 0.3));
    if (side > 0) g.rotation.y = Math.PI;
    group.add(g);
    const scr = new THREE.Mesh(new THREE.ShapeGeometry(lun), latticeMat);
    scr.customDepthMaterial = latticeDepth;
    scr.castShadow = true;
    scr.position.set(0, spring + 1.6, side * (halfL + wall * 0.5));
    if (side > 0) scr.rotation.y = Math.PI;
    group.add(scr);
  }

  return { group, windows };
}

// Soft additive light shafts streaming from the left-hand windows along the sun.
export function createSunShafts(sunDir) {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(1, 0.9, 0.72) }, uStrength: { value: 0.05 } },
    vertexShader: /* glsl */ `
      attribute float along;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vAlong = along;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float fade = pow(1.0 - vAlong, 1.6) * smoothstep(0.0, 0.08, vAlong);
        float edge = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        gl_FragColor = vec4(uColor * uStrength * fade * (0.35 + 0.65 * edge), 1.0);
      }`,
  });
  group.userData.material = material;

  const outline = [];
  const hw = HALL.windowW / 2;
  const jamb = HALL.windowY1 - HALL.windowY0;
  outline.push(new THREE.Vector2(-hw, 0), new THREE.Vector2(-hw, jamb));
  for (const p of archPoints(hw, hw * 1.15, 10)) outline.push(new THREE.Vector2(p.x, jamb + p.y));
  outline.push(new THREE.Vector2(hw, 0));

  group.userData.rebuild = (dir) => {
    for (const c of [...group.children]) {
      group.remove(c);
      c.geometry.dispose();
    }
    const travel = dir.clone().negate(); // light travels away from the sun
    const len = 16;
    for (const z of HALL.windowZs) {
      const ring = outline.map((p) => new THREE.Vector3(-HALL.halfW, HALL.windowY0 + p.y, z - p.x));
      const positions = [];
      const along = [];
      for (let k = 0; k < ring.length; k++) {
        const a = ring[k];
        const b = ring[(k + 1) % ring.length];
        const a2 = a.clone().addScaledVector(travel, len);
        const b2 = b.clone().addScaledVector(travel, len);
        positions.push(...a.toArray(), ...a2.toArray(), ...b.toArray(), ...b.toArray(), ...a2.toArray(), ...b2.toArray());
        along.push(0, 1, 0, 0, 1, 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material);
      mesh.renderOrder = 10;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
  };
  group.userData.rebuild(sunDir);
  return group;
}
