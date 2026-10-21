// SunDust: motes that drift through the hall and only glow where a sunbeam from the
// clerestory windows passes through them.
import * as THREE from 'three';
import { HALL } from './hall.js';

// Projection factor that turns a world size into a point size in pixels.
export function pointScale(renderer, camera) {
  const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  return h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

export class SunDust {
  constructor(count, sunDir) {
    const half = HALL.halfW - 0.3;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.randFloat(-half, half);
      pos[i * 3 + 1] = THREE.MathUtils.randFloat(0.2, HALL.spring + 0.5);
      pos[i * 3 + 2] = THREE.MathUtils.randFloat(-HALL.halfL + 0.5, HALL.halfL - 0.5);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSun: { value: sunDir.clone() },
        uColor: { value: new THREE.Color(1, 0.88, 0.66) },
        uStrength: { value: 1 },
        uScale: { value: 800 },
        uWindowZ: { value: HALL.windowZs },
      },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime;
        uniform vec3 uSun;
        uniform float uScale;
        uniform float uWindowZ[${HALL.windowZs.length}];
        varying float vLit;
        varying float vTwinkle;
        void main() {
          vec3 p = position;
          float t = uTime * (0.25 + seed * 0.35) + seed * 100.0;
          // Slow wandering on the still air of the hall.
          p += vec3(sin(t * 0.7) * 0.35, sin(t * 0.43 + seed * 9.0) * 0.25, cos(t * 0.51) * 0.35);
          p.y += mod(uTime * 0.02 * (seed - 0.4), 1.0) * 0.6;
          // Trace back toward the sun to the window wall: is this point in a beam?
          float lit = 0.0;
          float tw = (-${HALL.halfW.toFixed(1)} - p.x) / uSun.x;
          if (tw > 0.0) {
            vec3 q = p + uSun * tw;
            float hw = ${(HALL.windowW / 2).toFixed(3)};
            for (int i = 0; i < ${HALL.windowZs.length}; i++) {
              float dz = abs(q.z - uWindowZ[i]) / hw;
              if (dz > 1.0) continue;
              float top = ${HALL.windowY1.toFixed(2)} + hw * 1.15 * sqrt(1.0 - dz * dz);
              float inside = smoothstep(1.0, 0.8, dz) * smoothstep(${HALL.windowY0.toFixed(2)}, ${(HALL.windowY0 + 0.2).toFixed(2)}, q.y) * smoothstep(top, top - 0.2, q.y);
              lit = max(lit, inside);
            }
          }
          vLit = lit;
          vTwinkle = 0.55 + 0.45 * sin(uTime * (1.5 + seed * 3.0) + seed * 40.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((0.012 + seed * 0.016) * uScale / -mv.z, 1.5, 28.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uStrength;
        varying float vLit;
        varying float vTwinkle;
        void main() {
          if (vLit < 0.01) discard;
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          a = a * a + smoothstep(0.18, 0.0, d);
          gl_FragColor = vec4(uColor * a * vLit * vTwinkle * uStrength, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  update(time, sunDir, color, strength, scale) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uSun.value.copy(sunDir);
    u.uColor.value.copy(color);
    u.uStrength.value = strength;
    u.uScale.value = scale;
  }
}
