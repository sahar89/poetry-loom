// Brass-trimmed walnut hanging stand: two posts, a carved rod with brass finials,
// and brass rings at each hanging point.
import * as THREE from 'three';

function walnutTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 1024;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a2c1b';
  ctx.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 256;
    ctx.strokeStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 15},6,${0.15 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 1024; y += 32) ctx.lineTo(x + Math.sin(y * 0.01 + i) * 5, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function createStand({ width, top, ringXs }) {
  const group = new THREE.Group();
  const walnut = new THREE.MeshPhysicalMaterial({
    map: walnutTexture(),
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.35,
  });
  const brass = new THREE.MeshStandardMaterial({ color: 0xdfb15b, metalness: 1, roughness: 0.28 });
  const darkBrass = new THREE.MeshStandardMaterial({ color: 0xb08a43, metalness: 1, roughness: 0.4 });

  const rodY = top + 0.055;
  const postX = width / 2 + 0.24;
  const postH = rodY + 0.16;

  // Rod
  const rodLen = postX * 2 + 0.1;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, rodLen, 32), walnut);
  rod.rotation.z = Math.PI / 2;
  rod.position.y = rodY;
  group.add(rod);
  // Brass trim bands and finials
  for (const s of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 32), brass);
    band.rotation.z = Math.PI / 2;
    band.position.set(s * (width / 2 + 0.06), rodY, 0);
    group.add(band);
    const finial = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 16), brass);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 24), brass);
    tip.rotation.z = -s * Math.PI / 2;
    tip.position.x = s * 0.08;
    finial.add(ball, tip);
    finial.position.set(s * (rodLen / 2 + 0.04), rodY, 0);
    group.add(finial);
  }

  // Posts with brass caps, collars and weighted bases
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.085, postH, 0.085), walnut);
    post.position.set(s * postX, postH / 2, 0);
    group.add(post);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.11), brass);
    cap.position.set(s * postX, postH + 0.0175, 0);
    group.add(cap);
    const bracket = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 12, 32), brass);
    bracket.rotation.y = Math.PI / 2;
    bracket.position.set(s * postX, rodY, 0);
    group.add(bracket);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.62), walnut);
    base.position.set(s * postX, 0.025, 0);
    group.add(base);
    for (const z of [-0.29, 0.29]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.02, 20), darkBrass);
      foot.position.set(s * postX, 0.01, z);
      group.add(foot);
    }
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), brass);
    collar.position.set(s * postX, 0.065, 0);
    group.add(collar);
  }

  // Rings at each hanging point
  const ringGeo = new THREE.TorusGeometry(0.044, 0.0055, 10, 28);
  for (const x of ringXs) {
    const ring = new THREE.Mesh(ringGeo, brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, rodY - 0.012, 0);
    group.add(ring);
  }

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
