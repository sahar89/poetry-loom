// Wool-and-silk pile (kork-o-abrisham). The base layer is the knotted foundation; a
// stack of instanced "shell" layers raises the pile. Words are silk: glossy, finer and
// straighter, with anisotropic luster along the pile. The ground between words is
// wool: matte, fuzzy and frizzier. Both are driven by the per-knot texture.
import * as THREE from 'three';
import { PALETTE, KILIM } from './design.js';
import { CARPET_W, CARPET_H, SELVEDGE, SHELF_H, CROP_TOP, CROP } from './weave.js';

export function createCarpetUniforms() {
  return {
    uAtlas: { value: null },
    uAtlasSize: { value: new THREE.Vector2(1, 1) },
    uWordInfo: { value: null },
    uLayout: { value: null },
    uRows: { value: 1 },
    uSlots: { value: 1 },
    uPxPerMetre: { value: 1 },
    uPalette: { value: PALETTE.map((h) => new THREE.Color(h)) },
    uSize: { value: new THREE.Vector2(CARPET_W, CARPET_H) },
    uPile: { value: 0.0032 },
    uLayers: { value: 16 },
    uPileRelief: { value: 0.0045 },
  };
}

const VERT_PARS = /* glsl */ `
varying vec2 vCarpetUv;
#ifdef SHELL
  uniform float uLayers;
  uniform float uPile;
  varying float vLayer;
#endif
`;

const VERT_MAIN = /* glsl */ `
#include <begin_vertex>
vCarpetUv = uv;
#ifdef SHELL
  float layer = (float(gl_InstanceID) + 1.0) / uLayers;
  vLayer = layer;
  transformed += normalize(objectNormal) * uPile * layer;
#endif
`;

const FRAG_PARS = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uAtlasSize;
uniform highp sampler2D uWordInfo;
uniform highp sampler2D uLayout;
uniform float uRows;
uniform int uSlots;
uniform float uPxPerMetre;
uniform vec3 uPalette[9];
uniform vec2 uSize;
uniform float uPileRelief;
varying vec2 vCarpetUv;
#ifdef SHELL
  uniform float uLayers;
  varying float vLayer;
#endif
#define PL_KILIM ${KILIM.toFixed(5)}
#define PL_SELVEDGE ${SELVEDGE.toFixed(5)}
#define PL_SHELF ${SHELF_H.toFixed(1)}
#define PL_TOP ${CROP_TOP.toFixed(4)}
#define PL_CROP ${CROP.toFixed(4)}

// One word sampled from one row: coverage, yarn height, the word's dye and where in
// the atlas the point falls.
struct PlHit { float ink; float h; vec3 dye; vec2 apx; };

PlHit pl_sample(float row, float shelfY, float x, vec2 gx, vec2 gy) {
  PlHit o = PlHit(0.0, 0.0, vec3(0.0), vec2(0.0));
  if (row < 0.0 || row > uRows - 1.0 || shelfY < 0.0 || shelfY > 1.0) return o;
  // Rows read right to left: find the last word whose start lies right of x.
  int k = 0;
  for (int s = 512; s >= 1; s /= 2) {
    if (s >= uSlots) continue;
    if (texelFetch(uLayout, ivec2(k + s, int(row)), 0).r <= x) k += s;
  }
  vec4 w = texelFetch(uLayout, ivec2(k, int(row)), 0);
  float inside = step(w.r, x) * step(x, w.g);
  vec4 info = texelFetch(uWordInfo, ivec2(int(mod(w.b, 64.0)), int(w.b / 64.0)), 0);
  float t = (x - w.r) / max(w.g - w.r, 1e-6); // 0 at the word's right edge
  o.apx = vec2(info.x + info.z * (1.0 - t), info.y + shelfY * PL_SHELF);
  vec2 s = textureGrad(uAtlas, o.apx / uAtlasSize, gx, gy).rg * inside;
  o.ink = s.r;
  o.h = s.g;
  // Each word is one length of yarn, dyed for its place in the pattern.
  o.dye = uPalette[int(w.a + 0.5)];
  return o;
}

float pl_hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
vec2 pl_uv = vCarpetUv;
// Weave zones: flat kilim at both ends, overcast selvedge at the sides, pile between.
float pl_flag = 0.0;
if (pl_uv.y < PL_KILIM || pl_uv.y > 1.0 - PL_KILIM) pl_flag = 1.0;
else if (pl_uv.x < PL_SELVEDGE || pl_uv.x > 1.0 - PL_SELVEDGE) pl_flag = 2.0;

// Which row of words, and how far down inside it (0 = top of the row).
float pl_rowF = (1.0 - PL_KILIM - pl_uv.y) / (1.0 - 2.0 * PL_KILIM) * uRows;
float pl_row = clamp(floor(pl_rowF), 0.0, uRows - 1.0);
float pl_ly = clamp(pl_rowF - pl_row, 0.0, 1.0);
float pl_x = 1.0 - pl_uv.x;

// Gradients from the continuous carpet coordinate, so mip choice has no seams.
float pl_sx = uPxPerMetre * uSize.x;
float pl_sy = uPxPerMetre * uSize.y;
vec2 pl_gx = vec2(dFdx(pl_uv.x) * pl_sx, -dFdx(pl_uv.y) * pl_sy) / uAtlasSize;
vec2 pl_gy = vec2(dFdy(pl_uv.x) * pl_sx, -dFdy(pl_uv.y) * pl_sy) / uAtlasSize;

// This row's word, and the neighbouring row's word whose ascenders or descenders
// reach into this one. Whichever stands taller is on top.
float pl_shelf = PL_TOP + pl_ly * PL_CROP;
bool pl_up = pl_ly < 0.5;
PlHit pl_a = pl_sample(pl_row, pl_shelf, pl_x, pl_gx, pl_gy);
PlHit pl_b = pl_sample(pl_up ? pl_row - 1.0 : pl_row + 1.0, pl_up ? pl_shelf + PL_CROP : pl_shelf - PL_CROP, pl_x, pl_gx, pl_gy);
PlHit pl_hit = pl_a;
if (pl_b.h > pl_a.h) pl_hit = pl_b;
float pl_onPile = step(pl_flag, 0.5);
float pl_ink = pl_hit.ink * pl_onPile;
float pl_yarnH = pl_hit.h * pl_onPile;

// Ply twist: diagonal lines across each stroke, like twisted yarn. Fades out once
// an atlas pixel is smaller than a screen pixel.
float pl_e = 1.5;
float pl_hx = textureGrad(uAtlas, (pl_hit.apx + vec2(pl_e, 0.0)) / uAtlasSize, pl_gx, pl_gy).g;
float pl_hy = textureGrad(uAtlas, (pl_hit.apx + vec2(0.0, pl_e)) / uAtlasSize, pl_gx, pl_gy).g;
vec2 pl_grad = vec2(pl_hx - pl_hit.h, pl_hy - pl_hit.h);
vec2 pl_dir = normalize(pl_grad + vec2(1e-5));
vec2 pl_twistAxis = mat2(0.77, 0.64, -0.64, 0.77) * vec2(-pl_dir.y, pl_dir.x);
float pl_detail = 1.0 - smoothstep(0.6, 1.8, length(pl_gx * uAtlasSize));
float pl_twist = sin(dot(pl_hit.apx, pl_twistAxis) * 1.1) * pl_detail * smoothstep(0.05, 0.4, pl_yarnH);

vec3 pl_dye = pl_hit.dye;
if (pl_flag > 1.5) pl_dye = uPalette[7];
if (pl_flag > 0.5 && pl_flag < 1.5) {
  float kt = pl_uv.y < 0.5 ? pl_uv.y / PL_KILIM : (1.0 - pl_uv.y) / PL_KILIM;
  pl_dye = ((kt > 0.28 && kt < 0.4) || (kt > 0.62 && kt < 0.72)) ? uPalette[0] : uPalette[2];
}
// Abrash: natural dye lots drift slightly from row to row.
float pl_abrash = 1.0 + 0.05 * sin(pl_row * 0.071 + 1.3) + 0.03 * sin(pl_row * 0.23);
// Silk takes dye brighter than wool; deep indigo still glows as silk.
vec3 pl_silkCol = pow(pl_dye, vec3(0.78)) * 1.12 * pl_abrash;
// There is no ground to see: the words cover the surface, and between them are only
// the shadowed crevices where one yarn meets the next.
vec3 pl_woolCol = vec3(0.028, 0.021, 0.017);
if (pl_flag > 0.5) pl_woolCol = pl_dye * 0.82;
float pl_silk = smoothstep(0.3, 0.7, pl_ink);
// Rounded yarn: shaded down its flanks, ply grooves between twists, and the ground
// sitting in shadow between the raised words.
pl_silkCol *= mix(0.55, 1.0, smoothstep(0.0, 0.8, pl_yarnH)) * (1.0 + 0.16 * pl_twist);
vec3 pl_col = mix(pl_woolCol, pl_silkCol, pl_ink);
// Relief height in metres, for the bump and the pile shells.
float pl_H = (0.1 + 0.9 * pl_yarnH + 0.05 * pl_twist * pl_yarnH) * pl_onPile;

// Pile depth: how many pixels one fiber covers decides shell visibility.
vec2 pl_fp = vCarpetUv * uSize / mix(0.0005, 0.00032, pl_silk);
float pl_foot = max(length(dFdx(pl_fp)), length(dFdy(pl_fp)));
float pl_near = 1.0 - smoothstep(0.6, 1.6, pl_foot);

#ifdef SHELL
  if (pl_flag > 0.5) discard;
  vec2 pl_fcell = floor(pl_fp);
  vec2 pl_fl = fract(pl_fp) - 0.5;
  float pl_h = pl_hash(pl_fcell);
  vec2 pl_jit = (vec2(pl_hash(pl_fcell + 7.13), pl_hash(pl_fcell + 3.71)) - 0.5) * 0.3;
  // Wool fibers crimp and wander as they rise; silk stays straight.
  pl_jit += (1.0 - pl_silk) * vec2(sin(pl_h * 41.0 + vLayer * 7.0), cos(pl_h * 29.0 + vLayer * 5.0)) * 0.2 * vLayer;
  float pl_len = mix(0.6, 1.0, pl_h) * max(pl_H, 0.1);
  // Yarn on the words is packed solid with a soft, fuzzy edge; the wool ground is open.
  float pl_rad = mix(mix(0.55, 0.82, pl_silk), mix(0.25, 0.5, pl_silk), vLayer / pl_len);
  if (vLayer > pl_len || length(pl_fl - pl_jit) > pl_rad) discard;
  if (pl_hash(gl_FragCoord.xy + vLayer * 17.0) > pl_near) discard;
  // Light reaches tips more than roots.
  pl_col *= mix(mix(0.68, 0.86, pl_silk), 1.03, vLayer);
  pl_col += (1.0 - pl_silk) * vLayer * vLayer * 0.025;
#else
  float pl_back = gl_FrontFacing ? 0.0 : 1.0;
  // Seen from the front, the foundation sits in the shadow of the pile when the
  // shells are drawn; from afar the base layer stands in for the whole pile.
  pl_col *= mix(0.92, 0.62, pl_near * (1.0 - pl_back) * step(pl_flag, 0.5));
  // The reverse shows the knot rows and weft, a little duller.
  pl_col *= mix(1.0, 0.82, pl_back);
#endif

diffuseColor.rgb = pl_col;
`;

const FRAG_ROUGH = /* glsl */ `
float roughnessFactor = mix(0.92, 0.36, pl_silk);
if (pl_flag > 0.5) roughnessFactor = 0.85;
#ifndef SHELL
  roughnessFactor = mix(roughnessFactor, 0.8, pl_back);
#endif
`;

const FRAG_LIGHTS = /* glsl */ `
#include <lights_physical_fragment>
// Wool: broad, soft fuzz in its own hue. Silk: tighter, brighter luster.
material.sheenColor = mix(pl_woolCol * 1.4 + 0.05, mix(pl_silkCol, vec3(1.0), 0.45), pl_silk);
material.sheenRoughness = mix(0.8, 0.35, pl_silk);
material.specularColor *= mix(0.5, 1.2, pl_silk);
#ifndef SHELL
  material.sheenColor *= mix(1.0, 0.45, pl_back);
#endif
#ifdef USE_ANISOTROPY
  material.anisotropy *= pl_silk;
  material.alphaT = mix(pow2(material.roughness), 1.0, pow2(material.anisotropy));
#endif
`;

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
// Raised yarn: bend the normal by the relief so each word stands proud of the ground.
{
  vec3 pl_px = dFdx(-vViewPosition);
  vec3 pl_py = dFdy(-vViewPosition);
  float pl_hm = pl_H * uPileRelief;
  vec2 pl_dH = vec2(dFdx(pl_hm), dFdy(pl_hm));
  vec3 pl_r1 = cross(pl_py, normal);
  vec3 pl_r2 = cross(normal, pl_px);
  float pl_det = dot(pl_px, pl_r1) * faceDirection;
  vec3 pl_vg = sign(pl_det) * (pl_dH.x * pl_r1 + pl_dH.y * pl_r2);
  normal = normalize(abs(pl_det) * normal - pl_vg);
}
`;

function makeWeaveNormalMap() {
  // A tile of knot heads: rounded bumps in rows, with a faint weft rib between rows.
  const N = 256;
  const h = new Float32Array(N * N);
  const knots = 8;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const kx = (x / N) * knots;
      const ky = (y / N) * knots;
      const fx = kx - Math.floor(kx) - 0.5;
      const fy = ky - Math.floor(ky) - 0.5;
      const bump = Math.max(0, 1 - (fx * fx * 3.2 + fy * fy * 2.2) * 2.2);
      const rib = 0.15 * Math.cos(ky * Math.PI * 2);
      h[y * N + x] = Math.sqrt(bump) + rib;
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const l = h[y * N + ((x - 1 + N) % N)];
      const r = h[y * N + ((x + 1) % N)];
      const d = h[((y - 1 + N) % N) * N + x];
      const u = h[((y + 1) % N) * N + x];
      const nx = (l - r) * 1.6;
      const ny = (d - u) * 1.6;
      const len = Math.hypot(nx, ny, 1);
      const o = (y * N + x) * 4;
      data[o] = ((nx / len) * 0.5 + 0.5) * 255;
      data[o + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // One tile spans 8 knot heads of roughly 1.1 mm each.
  tex.repeat.set(CARPET_W / 0.009, CARPET_H / 0.009);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeMaterial(uniforms, normalMap, shell) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    sheen: 1,
    sheenColor: 0xffffff,
    sheenRoughness: 0.5,
    anisotropy: 0.7,
    anisotropyRotation: Math.PI / 2,
    normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    side: shell ? THREE.FrontSide : THREE.DoubleSide,
  });
  if (shell) mat.defines = { SHELL: '' };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
      .replace('#include <lights_physical_fragment>', FRAG_LIGHTS)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL);
  };
  mat.customProgramCacheKey = () => (shell ? 'pile-shell' : 'pile-base');
  return mat;
}

export function createCarpetMaterials(uniforms) {
  const normalMap = makeWeaveNormalMap();
  return {
    base: makeMaterial(uniforms, normalMap, false),
    shell: makeMaterial(uniforms, normalMap, true),
  };
}
