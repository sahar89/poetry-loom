import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadQuatrains, toWords } from './poetry.js';
import { createDesignSampler } from './design.js';
import { buildWordAtlas, buildLayout, CARPET_W, CARPET_H } from './weave.js';
import { createCarpetUniforms, createCarpetMaterials } from './carpetMaterial.js';
import { Cloth, ClothGeometry } from './cloth.js';
import { Fringe } from './fringe.js';
import { createStand } from './stand.js';
import { createHall, createSunShafts, HALL } from './hall.js';
import { initUI } from './ui.js';
import { SunDust, pointScale } from './particles.js';

const CARPET_TOP = 3.45;
const CENTER = new THREE.Vector3(0, CARPET_TOP - CARPET_H / 2, 0);

const coarse = matchMedia('(pointer: coarse)').matches;
const tier = coarse || Math.min(screen.width, screen.height) < 700 ? 'mobile' : 'desktop';

// Renderer
const stage = document.getElementById('stage');
function showNotice(text) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.remove('done');
    document.getElementById('loaderText').textContent = text;
    return;
  }
  const el = document.createElement('div');
  el.className = 'loader';
  el.innerHTML = `<div class="loader-text"></div>`;
  el.firstChild.textContent = text;
  document.body.appendChild(el);
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  showNotice('This browser could not start WebGL. Try reloading, or open the page in a recent Chrome, Safari or Firefox.');
  throw err;
}
const MAX_DPR = Math.min(devicePixelRatio, tier === 'mobile' ? 1.5 : 2);
let dpr = MAX_DPR;
renderer.setPixelRatio(dpr);
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  showNotice('The graphics card was reset. Please reload the page.');
});
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a332c);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.02, 80);
camera.position.set(0, 2.6, 9.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CENTER);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.16;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.53;
controls.zoomSpeed = 0.9;
controls.rotateSpeed = 0.6;
controls.enablePan = true;
controls.screenSpacePanning = true;

// Light
const LIGHTS = {
  day: {
    // Aimed through the centre of the z = 2.6 clerestory window onto the medallion.
    dir: new THREE.Vector3(-6, 4.05, 2.6).normalize(),
    color: new THREE.Color('#fff0d8'),
    intensity: 7.5,
    hemi: 0.55,
    hemiSky: new THREE.Color('#f4e6cc'),
    env: 0.55,
    exposure: 1.0,
    shaft: new THREE.Color(1, 0.9, 0.72),
    shaftStrength: 0.045,
    glow: new THREE.Color(1.0, 0.93, 0.8).multiplyScalar(2.2),
  },
  sunset: {
    // Lower and more raking, through the z = 5.2 window.
    dir: new THREE.Vector3(-6, 3.3, 5.2).normalize(),
    color: new THREE.Color('#ff9a52'),
    intensity: 6.0,
    hemi: 0.3,
    hemiSky: new THREE.Color('#f2b48a'),
    env: 0.32,
    exposure: 1.08,
    shaft: new THREE.Color(1, 0.6, 0.32),
    shaftStrength: 0.07,
    glow: new THREE.Color(1.0, 0.62, 0.36).multiplyScalar(2.0),
  },
};

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(tier === 'mobile' ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 70 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
sun.target.position.copy(CENTER);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xf4e6cc, 0x6b5038, 0.5);
scene.add(hemi);

const lightState = {
  dir: LIGHTS.day.dir.clone(),
  color: LIGHTS.day.color.clone(),
  intensity: LIGHTS.day.intensity,
  hemi: LIGHTS.day.hemi,
  hemiSky: LIGHTS.day.hemiSky.clone(),
  env: LIGHTS.day.env,
  exposure: LIGHTS.day.exposure,
  shaft: LIGHTS.day.shaft.clone(),
  shaftStrength: LIGHTS.day.shaftStrength,
  glow: LIGHTS.day.glow.clone(),
};
let lightTarget = LIGHTS.day;
let lightBlend = 1;

// Hall
const hall = createHall();
scene.add(hall.group);
const shafts = createSunShafts(lightState.dir);
shafts.userData.noAO = true;
scene.add(shafts);
const glowMaterials = [];
hall.group.traverse((o) => {
  if (o.isMesh && o.material.isMeshBasicMaterial && !glowMaterials.includes(o.material)) glowMaterials.push(o.material);
});

function applyLight() {
  sun.position.copy(CENTER).addScaledVector(lightState.dir, 30);
  sun.color.copy(lightState.color);
  sun.intensity = lightState.intensity;
  hemi.intensity = lightState.hemi;
  hemi.color.copy(lightState.hemiSky);
  scene.environmentIntensity = lightState.env;
  renderer.toneMappingExposure = lightState.exposure;
  shafts.userData.material.uniforms.uColor.value.copy(lightState.shaft);
  shafts.userData.material.uniforms.uStrength.value = lightState.shaftStrength;
  for (const m of glowMaterials) m.color.copy(lightState.glow);
}
applyLight();

// Dust in the sunbeams.
const dust = new SunDust(tier === 'mobile' ? 1400 : 3200, lightState.dir);
scene.add(dust.points);

// Ambient occlusion: contact shadows where the rug, stand, walls and vault meet.
class HallAOPass extends GTAOPass {
  overrideVisibility() {
    super.overrideVisibility();
    // Additive light shafts have no surface to occlude.
    this.scene.traverse((o) => {
      if (o.userData.noAO) o.visible = false;
    });
  }
}
let composer = null;
if (tier !== 'mobile') {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new HallAOPass(scene, camera, innerWidth, innerHeight);
  ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 16, distanceFallOff: 1 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  ao.blendIntensity = 0.9;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
}

function setLight(name) {
  lightTarget = LIGHTS[name];
  lightBlend = 0;
}

function stepLight(dt) {
  if (lightBlend >= 1) return;
  const prevBlend = lightBlend;
  lightBlend = Math.min(1, lightBlend + dt / 1.4);
  // Exponential approach per frame, finishing exactly on the target.
  const k = lightBlend >= 1 ? 1 : 1 - (1 - lightBlend) / (1 - prevBlend);
  const t = lightTarget;
  lightState.dir.lerp(t.dir, k).normalize();
  lightState.color.lerp(t.color, k);
  lightState.intensity += (t.intensity - lightState.intensity) * k;
  lightState.hemi += (t.hemi - lightState.hemi) * k;
  lightState.hemiSky.lerp(t.hemiSky, k);
  lightState.env += (t.env - lightState.env) * k;
  lightState.exposure += (t.exposure - lightState.exposure) * k;
  lightState.shaft.lerp(t.shaft, k);
  lightState.shaftStrength += (t.shaftStrength - lightState.shaftStrength) * k;
  lightState.glow.lerp(t.glow, k);
  shafts.userData.rebuild(lightState.dir);
  applyLight();
}

// Carpet
const cloth = new Cloth({ width: CARPET_W, height: CARPET_H, top: CARPET_TOP });
const clothGeo = new ClothGeometry(cloth);
const uniforms = createCarpetUniforms();
uniforms.uLayers.value = tier === 'mobile' ? 6 : 10;
const materials = createCarpetMaterials(uniforms);
const carpet = new THREE.Mesh(clothGeo, materials.base);
carpet.castShadow = true;
carpet.receiveShadow = true;
carpet.frustumCulled = false;
const pile = new THREE.InstancedMesh(clothGeo, materials.shell, uniforms.uLayers.value);
pile.receiveShadow = true;
pile.frustumCulled = false;
const fringe = new Fringe(clothGeo.rc);
const ringXs = cloth.rings.map((i) => -CARPET_W / 2 + (i / (cloth.cols - 1)) * CARPET_W);
const stand = createStand({ width: CARPET_W, top: CARPET_TOP, ringXs });

// Camera presets (targets on the carpet, cameras in front of / behind it)
const u2x = (u) => (u - 0.5) * CARPET_W;
const v2y = (v) => CARPET_TOP - (1 - v) * CARPET_H;
const VIEWS = {
  medallion: { pos: [0.12, CENTER.y + 0.05, 1.05], target: [0, CENTER.y, 0] },
  corner: { pos: [u2x(0.76) + 0.1, v2y(0.8) + 0.05, 0.75], target: [u2x(0.76), v2y(0.8), 0] },
  border: { pos: [u2x(0.1) + 0.06, v2y(0.42), 0.42], target: [u2x(0.1), v2y(0.42), 0] },
  fringes: { pos: [0.35, 0.62, 0.95], target: [0.05, CARPET_TOP - CARPET_H - 0.02, 0] },
};

let flight = null;
// Back off far enough to frame the whole stand, whatever the viewport shape.
function overviewView(side = 1) {
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const fitH = (CARPET_H + 0.9) / (2 * Math.tan(halfFov));
  const fitW = (CARPET_W + 1.0) / (2 * Math.tan(halfFov) * camera.aspect);
  const d = Math.min(Math.max(fitH, fitW) + 0.4, HALL.halfL - 1);
  // Nudge the rug up a little so the dock doesn't cover the fringe.
  const lift = 0.06 * d;
  return { pos: [side < 0 ? 0.15 * d : 0, CENTER.y - 0.1 - lift, side * d], target: [0, CENTER.y - lift, 0] };
}

function flyTo(name, duration = 1.8) {
  const v = name === 'overview' ? overviewView() : name === 'reverse' ? overviewView(-1) : VIEWS[name];
  flight = {
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: new THREE.Vector3(...v.pos),
    toTarget: new THREE.Vector3(...v.target),
    t: 0,
    duration,
  };
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Grab the rug
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();
let dragging = null;
let ready = false;

function castAt(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(carpet, false)[0];
}

stage.addEventListener(
  'pointerdown',
  (e) => {
    if (!ready || e.button > 0) return;
    if (dragging) {
      // A second finger: hand the gesture back to the camera.
      endDrag();
      return;
    }
    const hit = castAt(e);
    if (!hit) return;
    controls.enabled = false;
    flight = null;
    const index = cloth.indexAtUv(hit.uv.x, hit.uv.y);
    dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
    cloth.startGrab(index, hit.point);
    dragging = { id: e.pointerId };
    stage.setPointerCapture(e.pointerId);
    document.body.classList.add('grabbing');
  },
  { capture: true }
);

stage.addEventListener('pointermove', (e) => {
  if (dragging && e.pointerId === dragging.id) {
    raycaster.setFromCamera(
      pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1),
      camera
    );
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) cloth.moveGrab(dragPoint);
    return;
  }
  if (!ready || e.buttons || e.pointerType !== 'mouse') return;
  const now = performance.now();
  if (now - (stage._lastHover || 0) < 90) return;
  stage._lastHover = now;
  document.body.classList.toggle('can-grab', !!castAt(e));
});

function endDrag() {
  if (!dragging) return;
  cloth.endGrab();
  try {
    stage.releasePointerCapture(dragging.id);
  } catch {}
  dragging = null;
  controls.enabled = true;
  document.body.classList.remove('grabbing');
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// Weave
let atlas = null;
let sampleDesign = null;
let raj = 70;
let source = 'archive';

function reweave(newRaj) {
  raj = newRaj;
  const prev = uniforms.uLayout.value;
  const layout = buildLayout(raj, atlas, sampleDesign);
  uniforms.uLayout.value = layout.texture;
  uniforms.uRows.value = layout.rows;
  uniforms.uSlots.value = layout.slots;
  uniforms.uPxPerMetre.value = layout.pxPerMetre;
  if (prev) prev.dispose();
  ui.setStats({ rows: layout.rows, words: layout.words, unique: atlas.uniqueCount });
}

const ui = initUI({
  onRaj: (value) => reweave(value),
  onLight: setLight,
  onView: (name) => flyTo(name),
});

async function loadEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const hdr = await new RGBELoader().loadAsync('/hdri/historic_cloister_passage_1k.hdr');
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
  } catch (err) {
    console.warn('HDRI failed to load', err);
  }
  pmrem.dispose();
}

async function start() {
  const t0 = performance.now();
  const mark = (m) => import.meta.env.DEV && console.info(`[loom] ${m} ${(performance.now() - t0).toFixed(0)}ms`);
  const [{ quatrains, source: src }] = await Promise.all([loadQuatrains(), loadEnvironment()]);
  source = src;
  mark('quatrains + hdri');
  ui.setSource(src, quatrains.length);
  ui.setLoading('Knotting the words');
  await new Promise((r) => setTimeout(r, 30));

  sampleDesign = createDesignSampler();
  atlas = await buildWordAtlas(toWords(quatrains));
  uniforms.uAtlas.value = atlas.texture;
  uniforms.uAtlasSize.value.copy(atlas.size);
  uniforms.uWordInfo.value = atlas.info;
  reweave(raj);
  mark('atlas + knots');

  cloth.settle(360);
  clothGeo.sync();
  for (let i = 0; i < 200; i++) fringe.update(clothGeo);
  scene.add(carpet, pile, fringe.mesh, stand);
  mark('cloth settled');

  // Compile shaders before revealing the hall.
  await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 2500))]);
  mark('shaders');
  ui.hideLoader();
  ready = true;
  flyTo('overview', 3.4);
}

const clock = new THREE.Clock();
// Adaptive resolution: trade pixel density for a steady frame rate on slower GPUs.
let frameMs = 16;
let lastScale = 0;
function adaptResolution(dt) {
  frameMs += (dt * 1000 - frameMs) * 0.05;
  const now = performance.now();
  if (!ready || now - lastScale < 1500) return;
  let next = dpr;
  if (frameMs > 24 && dpr > 1) next = Math.max(1, dpr - 0.25);
  else if (frameMs < 13 && dpr < MAX_DPR) next = Math.min(MAX_DPR, dpr + 0.25);
  if (next !== dpr) {
    dpr = next;
    renderer.setPixelRatio(dpr);
    composer?.setPixelRatio(dpr);
    lastScale = now;
  }
}
let fringeActive = true;
const box = { x: HALL.halfW - 0.4, z: HALL.halfL - 0.4 };

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (ready) {
    if (cloth.update(dt)) {
      clothGeo.sync();
      fringeActive = true;
    }
    if (fringeActive) fringeActive = fringe.update(clothGeo) || cloth.awake;
  }
  stepLight(dt);

  if (flight) {
    flight.t = Math.min(1, flight.t + dt / flight.duration);
    const k = ease(flight.t);
    camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
    if (flight.t >= 1) flight = null;
  }
  controls.update();
  // Stay inside the hall.
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -box.x, box.x);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -box.z, box.z);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.08, HALL.spring + 4);

  // The pile shells only matter within a few metres of the rug.
  pile.visible = camera.position.distanceTo(controls.target) < 3.2 || camera.position.distanceTo(CENTER) < 3.4;

  const time = clock.elapsedTime;
  const scale = pointScale(renderer, camera);
  dust.update(time, lightState.dir, lightState.shaft, lightState.shaftStrength * 40, scale);

  if (composer) composer.render(dt);
  else renderer.render(scene, camera);
  adaptResolution(dt);
}
renderer.setAnimationLoop(animate);

if (import.meta.env.DEV) {
  window.__loom = {
    THREE, scene, camera, controls, uniforms, cloth, flyTo, renderer, sun, lightState, dust,
    look(p, t) {
      flight = null;
      camera.position.set(...p);
      controls.target.set(...t);
      controls.update();
    },
  };
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
});

addEventListener('wheel', () => (flight = null), { passive: true });
stage.addEventListener('pointerdown', () => {
  if (!dragging) flight = null;
});

start().catch((err) => {
  console.error(err);
  ui.setLoading('Something went wrong while weaving. Please reload.');
});
