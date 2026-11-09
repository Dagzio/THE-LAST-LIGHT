// Main-menu backdrop in 3D (user decision D46): a lighthouse on a rocky headland at night — moving sea with a moon
// path, sweeping beam, stars, soft clouds and mist. Built once and reused by splash / menu / map select; it never
// touches the game. Kept light for weak phones: ~10 draw calls, ≤ 16k triangles (LOW: coarser sea, no clouds).
// Everything animates on real (presentation) time — menus are not part of the simulation.
import * as THREE from '../../lib/three.module.js';
import { cpuCanvas } from './render-guard.js';
import { SeededRandom } from '../core/SeededRandom.js';
import { beaconGeometry, beaconLanternGeometry, mergeParts } from './models.js';

const HORIZON = new THREE.Color('#1a2638');
const MOON_DIR = new THREE.Vector3(-0.35, 0.32, -1).normalize();

/** Sky: vertical gradient + stars + a faint milky band, painted once (screen background). */
function skyTexture() {
  const { canvas, g } = cpuCanvas(1024, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#03050c');
  grad.addColorStop(0.45, '#0a1222');
  grad.addColorStop(0.8, '#16223a');
  grad.addColorStop(1, '#1d2b42');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  const rng = new SeededRandom(97);
  g.save();
  g.translate(520, 210); g.rotate(-0.35);
  const band = g.createLinearGradient(0, -70, 0, 70);
  band.addColorStop(0, 'rgba(120,140,190,0)'); band.addColorStop(0.5, 'rgba(120,140,190,0.07)'); band.addColorStop(1, 'rgba(120,140,190,0)');
  g.fillStyle = band; g.fillRect(-700, -70, 1400, 140);
  g.restore();
  for (let i = 0; i < 520; i++) {
    const y = Math.pow(rng.next(), 1.6) * 380;
    const a = 0.25 + rng.next() * 0.7 * (1 - y / 420);
    const s = rng.next() < 0.08 ? 1.6 : 0.9;
    g.fillStyle = `rgba(220,228,255,${a.toFixed(2)})`;
    g.fillRect(rng.next() * 1024, y, s, s);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft round sprite (moon glow, lantern glow, cloud puffs). */
function softTexture(inner, outer, size = 128) {
  const { canvas, g } = cpuCanvas(size, size);
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function moonTexture() {
  const S = 256, { canvas, g } = cpuCanvas(S, S);
  const halo = g.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S / 2);
  halo.addColorStop(0, 'rgba(190,205,255,0.35)'); halo.addColorStop(1, 'rgba(190,205,255,0)');
  g.fillStyle = halo; g.fillRect(0, 0, S, S);
  const disc = g.createRadialGradient(S * 0.46, S * 0.44, 2, S / 2, S / 2, S * 0.13);
  disc.addColorStop(0, '#fbfcff'); disc.addColorStop(1, '#d9e1f4');
  g.fillStyle = disc;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.13, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,165,200,0.35)'; // maria
  for (const [x, y, r] of [[-0.04, -0.03, 0.035], [0.035, 0.02, 0.028], [-0.01, 0.05, 0.02]]) {
    g.beginPath(); g.arc(S * (0.5 + x), S * (0.5 + y), S * r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cloud: a few overlapping soft puffs on one canvas. */
function cloudTexture(seed) {
  const { canvas, g } = cpuCanvas(256, 128);
  const rng = new SeededRandom(seed);
  for (let i = 0; i < 9; i++) {
    const x = 40 + rng.next() * 176, y = 50 + rng.next() * 40, r = 26 + rng.next() * 34;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(140,155,190,0.22)'); gr.addColorStop(1, 'rgba(140,155,190,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Low-poly rock blob: an icosahedron with seeded vertex noise, coloured darker at the bottom, moss on top. */
function rockParts(rng, x, y, z, sx, sy, sz, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const noise = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let n = noise.get(key);
    if (n === undefined) { n = 0.78 + rng.next() * 0.4; noise.set(key, n); } // same noise for shared corners
    pos.setXYZ(i, pos.getX(i) * sx * n + x, pos.getY(i) * sy * n + y, pos.getZ(i) * sz * n + z);
  }
  g.computeVertexNormals();
  for (let i = 0; i < pos.count; i++) {
    const h = (pos.getY(i) - (y - sy)) / (2 * sy);
    const up = g.attributes.normal.getY(i);
    c.set('#232a33').lerp(new THREE.Color('#3b4552'), Math.min(1, Math.max(0, h)));
    if (up > 0.6 && h > 0.55) c.lerp(new THREE.Color('#2f4033'), 0.55); // moss / grass on the top
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

const SEA_VERT = /* glsl */`
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vH;
  float wave(vec2 p, vec2 d, float f, float s, float a) { return a * sin(dot(p, d) * f + uTime * s); }
  void main() {
    vec3 p = position;
    vec2 q = p.xz;
    float h = wave(q, normalize(vec2(1.0, 0.35)), 0.012, 0.9, 3.2)
            + wave(q, normalize(vec2(-0.4, 1.0)), 0.021, 1.3, 1.6)
            + wave(q, normalize(vec2(0.8, -0.6)), 0.05, 2.1, 0.55);
    // analytic normal from the derivatives of the same three waves
    float e = 2.0;
    float hx = wave(q + vec2(e, 0.0), normalize(vec2(1.0, 0.35)), 0.012, 0.9, 3.2)
             + wave(q + vec2(e, 0.0), normalize(vec2(-0.4, 1.0)), 0.021, 1.3, 1.6)
             + wave(q + vec2(e, 0.0), normalize(vec2(0.8, -0.6)), 0.05, 2.1, 0.55);
    float hz = wave(q + vec2(0.0, e), normalize(vec2(1.0, 0.35)), 0.012, 0.9, 3.2)
             + wave(q + vec2(0.0, e), normalize(vec2(-0.4, 1.0)), 0.021, 1.3, 1.6)
             + wave(q + vec2(0.0, e), normalize(vec2(0.8, -0.6)), 0.05, 2.1, 0.55);
    vNormal = normalize(vec3(h - hx, e, h - hz));
    p.y += h;
    vH = h;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const SEA_FRAG = /* glsl */`
  uniform vec3 uMoonDir;
  uniform vec3 uHorizon;
  uniform vec3 uLantern;
  uniform float uFog;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vH;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 deep = vec3(0.012, 0.035, 0.06);
    vec3 crest = vec3(0.05, 0.11, 0.16);
    vec3 col = mix(deep, crest, clamp(vH * 0.12 + 0.45, 0.0, 1.0));
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col = mix(col, uHorizon * 0.9, fres * 0.65);
    vec3 r = reflect(-v, n);
    col += vec3(0.75, 0.82, 1.0) * pow(max(dot(r, uMoonDir), 0.0), 160.0) * 1.6;   // moon path
    col += vec3(1.0, 0.72, 0.4) * pow(max(dot(r, normalize(uLantern - vWorld)), 0.0), 260.0) * 0.12; // faint lantern glints
    float d = length(cameraPosition - vWorld);
    col = mix(col, uHorizon, 1.0 - exp(-d * uFog));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class MenuScene {
  /** @param {string} quality resolved preset @param {object} mats shared materials (models use vertex colours) */
  constructor(quality, mats) {
    const low = quality === 'low';
    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.FogExp2(HORIZON.getHex(), 0.00045);
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 1, 6000);
    this.disposables = [this.scene.background];

    // Lights: cold moon + sky, warm lantern near the tower
    this.scene.add(new THREE.HemisphereLight(0x8fa4cc, 0x101418, 1.25));
    const moon = new THREE.DirectionalLight(0xc8d6ff, 1.6);
    moon.position.copy(MOON_DIR).multiplyScalar(1000);
    this.scene.add(moon);
    this.lanternPos = new THREE.Vector3(300, 255, -420);
    const lantern = new THREE.PointLight(0xffb36a, 9000, 520, 1.6);
    lantern.position.copy(this.lanternPos);
    this.scene.add(lantern);

    // Sea
    const seg = low ? 48 : 96;
    const seaGeo = new THREE.PlaneGeometry(7000, 4200, seg, Math.round(seg * 0.6)).rotateX(-Math.PI / 2);
    this.seaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uMoonDir: { value: MOON_DIR.clone() }, uHorizon: { value: HORIZON.clone() },
        uLantern: { value: this.lanternPos.clone() }, uFog: { value: 0.00045 },
      },
      vertexShader: SEA_VERT, fragmentShader: SEA_FRAG,
    });
    const sea = new THREE.Mesh(seaGeo, this.seaMat);
    sea.position.set(0, 0, -1600);
    this.scene.add(sea);
    this.disposables.push(seaGeo, this.seaMat);

    // Headland (right) + rocks at its foot + far capes on the horizon (one merged mesh, flat shaded)
    const rng = new SeededRandom(31);
    const parts = [
      rockParts(rng, 330, 40, -440, 230, 150, 170),
      rockParts(rng, 470, 10, -380, 170, 110, 150),
      rockParts(rng, 190, -20, -470, 150, 90, 120),
      rockParts(rng, 360, 90, -470, 130, 80, 110),
      rockParts(rng, 120, -6, -300, 40, 22, 34, 0),
      rockParts(rng, 205, -8, -250, 28, 16, 24, 0),
      rockParts(rng, 560, -10, -230, 46, 24, 40, 0),
      rockParts(rng, -900, -30, -2600, 520, 120, 260, 0), // far capes (fog fades them)
      rockParts(rng, -1500, -40, -2900, 420, 90, 220, 0),
      rockParts(rng, 1500, -40, -3100, 600, 110, 260, 0),
    ];
    const landGeo = mergeParts(parts);
    const land = new THREE.Mesh(landGeo, mats.prop);
    this.scene.add(land);
    this.disposables.push(landGeo);

    // The lighthouse (the game's model) on top of the headland
    const tower = new THREE.Group();
    const towerGeo = beaconGeometry(), lanternGeo = beaconLanternGeometry();
    tower.add(new THREE.Mesh(towerGeo, mats.prop), new THREE.Mesh(lanternGeo, mats.lanternGlass));
    tower.position.set(this.lanternPos.x, this.lanternPos.y - 131, this.lanternPos.z);
    tower.scale.setScalar(1.0);
    this.scene.add(tower);
    this.disposables.push(towerGeo, lanternGeo);

    // Lantern glow + two opposite beams sweeping (14 s per turn, like the game)
    const glowTex = softTexture('rgba(255,210,140,0.95)', 'rgba(255,160,80,0)');
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(150);
    glow.position.copy(this.lanternPos);
    this.scene.add(glow);
    this.beam = new THREE.Group();
    this.beam.position.copy(this.lanternPos);
    // soft volumetric look: dim, fades along its length (never a solid wedge), short enough to stay off the camera
    const BEAM_LEN = 1300;
    const beamGeo = new THREE.CylinderGeometry(3, 85, BEAM_LEN, 24, 6, true).rotateZ(Math.PI / 2).translate(BEAM_LEN / 2, 0, 0).toNonIndexed();
    const bc = new Float32Array(beamGeo.attributes.position.count * 3);
    for (let i = 0; i < bc.length / 3; i++) {
      const k = Math.pow(1 - beamGeo.attributes.position.getX(i) / BEAM_LEN, 2.2) * 0.11;
      bc[i * 3] = k; bc[i * 3 + 1] = k * 0.82; bc[i * 3 + 2] = k * 0.55;
    }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    const beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const r of [0, Math.PI]) { const b = new THREE.Mesh(beamGeo, beamMat); b.rotation.y = r; this.beam.add(b); }
    this.scene.add(this.beam);
    this.disposables.push(glowTex, glow.material, beamGeo, beamMat);

    // Moon: a crisp disc with faint maria inside a soft halo
    const moonTex = moonTexture();
    const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, depthWrite: false, transparent: true, fog: false }));
    moonSprite.scale.setScalar(380);
    moonSprite.position.copy(MOON_DIR).multiplyScalar(4200);
    this.scene.add(moonSprite);
    this.disposables.push(moonTex, moonSprite.material);

    // Clouds (not on LOW)
    this.clouds = [];
    if (!low) {
      for (let i = 0; i < 4; i++) {
        const tex = cloudTexture(11 + i);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
        const s = new THREE.Sprite(mat);
        s.scale.set(1600 + i * 300, 700 + i * 120, 1);
        s.position.set(-1600 + i * 1200, 900 + i * 160, -3600);
        this.scene.add(s);
        this.clouds.push(s);
        this.disposables.push(tex, mat);
      }
    }
    this.lookAt = new THREE.Vector3(120, 120, -600);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** @param {number} t presentation seconds */
  update(t) {
    this.seaMat.uniforms.uTime.value = t;
    this.beam.rotation.y = -t * (Math.PI * 2 / 14);
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x = ((-1600 + i * 1200 + t * (6 + i * 2)) % 5200) - 2000;
    }
    // slow, gentle camera drift; the tower stays right of centre (the menu list is on the left)
    const wide = Math.max(0, this.camera.aspect - 16 / 9);
    this.camera.position.set(-40 + Math.sin(t * 0.05) * 18 - wide * 60, 70 + Math.sin(t * 0.07) * 5, 420);
    this.camera.lookAt(this.lookAt);
  }

  dispose() { for (const d of this.disposables) d.dispose(); }
}
