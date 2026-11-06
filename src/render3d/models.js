// Procedural 3D models built from primitives (decision D9 + 3D conversion). Every model is ONE merged geometry with
// vertex colours (one draw call per model type; enemies/bullets are instanced). Models face +X; the renderer
// rotates them (rotation.y = -angle). 1 unit = 1 world unit of the simulation (player radius 18).
// Each object is tagged userData.model for the dev asset viewer (src/dev/debug-models.js).
// Final art can replace a model by a .glb with the same tag (art-prompts/02_PLAYER_COMBAT.md).
import * as THREE from '../../lib/three.module.js';

const tmpColor = new THREE.Color();

/** Bakes a primitive's transform + colour into a non-indexed geometry with a `color` attribute. */
function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  tmpColor.set(color); // r166 colour management: set(hex) already converts sRGB → linear working space
  for (let i = 0; i < n; i++) { colors[i * 3] = tmpColor.r; colors[i * 3 + 1] = tmpColor.g; colors[i * 3 + 2] = tmpColor.b; }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Concatenates non-indexed geometries with position/normal/color into one BufferGeometry. */
export function mergeParts(parts) {
  let count = 0;
  for (const p of parts) count += p.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const C = {
  coat: '#334055', coatDark: '#1f2633', torso: '#3c4a62', skin: '#c49a7a', hatBrim: '#2b1f17', hatCrown: '#3d2d21',
  hatBand: '#8a5a2b', boots: '#1a1612', gunMetal: '#8d96a0', gunDark: '#3b4148', glove: '#2a2421',
  gruntBody: '#5a1c26', gruntHump: '#6e2531', gruntHead: '#4a1620', gruntBone: '#2a0e14', gruntBelly: '#3e121a',
};

/** The keeper: long oilskin coat, wide-brim hat, pistol arm forward. Height ≈ 52, footprint radius ≈ 18. */
export function playerGeometry() {
  const P = [];
  // boots / legs
  for (const s of [-1, 1]) P.push(part(new THREE.CylinderGeometry(3.6, 4.2, 12, 8), C.boots, { y: 6, z: s * 5 }));
  // long coat (flared), back tails a bit longer
  P.push(part(new THREE.CylinderGeometry(10.5, 16, 24, 12), C.coat, { y: 22 }));
  P.push(part(new THREE.CylinderGeometry(11, 11, 1.5, 12), C.coatDark, { y: 10.6, sx: 1.42, sz: 1.42 }));
  P.push(part(new THREE.BoxGeometry(6, 20, 20), C.coatDark, { x: -10, y: 19, rz: -0.18 }));
  // torso + shoulders
  P.push(part(new THREE.SphereGeometry(12.5, 14, 10), C.torso, { y: 33, sx: 0.9, sy: 0.72, sz: 1.08 }));
  // head
  P.push(part(new THREE.SphereGeometry(6.8, 12, 10), C.skin, { x: 1.5, y: 42 }));
  // hat: brim, crown, band
  P.push(part(new THREE.CylinderGeometry(13.5, 13.5, 1.6, 18), C.hatBrim, { x: 1, y: 46.5 }));
  P.push(part(new THREE.CylinderGeometry(6.6, 7.4, 7, 14), C.hatCrown, { x: 1, y: 50.5 }));
  P.push(part(new THREE.CylinderGeometry(7.5, 7.5, 1.6, 14), C.hatBand, { x: 1, y: 48 }));
  // pistol arm (right side = +Z) reaching forward (+X)
  P.push(part(new THREE.BoxGeometry(17, 5, 5), C.coat, { x: 9, y: 32, z: 7 }));
  P.push(part(new THREE.BoxGeometry(5, 5, 5), C.glove, { x: 18.5, y: 32, z: 7 }));
  P.push(part(new THREE.BoxGeometry(13, 3.6, 3.2), C.gunMetal, { x: 25, y: 34, z: 7 }));
  P.push(part(new THREE.BoxGeometry(3.4, 6, 3), C.gunDark, { x: 20.5, y: 30.5, z: 7, rz: 0.25 }));
  // off-hand near the chest
  P.push(part(new THREE.BoxGeometry(11, 5, 5), C.coat, { x: 5, y: 31, z: -8, ry: 0.5 }));
  return mergeParts(P);
}

/** Hunched fog creature: wide humped back with bone spines, clawed forearms forward. Height ≈ 32. */
export function gruntGeometry() {
  const P = [];
  for (const [x, z] of [[-8, -8], [-8, 8], [6, -9], [6, 9]]) P.push(part(new THREE.CylinderGeometry(2.6, 3.2, 9, 6), C.gruntBone, { x, y: 4.5, z }));
  P.push(part(new THREE.SphereGeometry(15, 14, 10), C.gruntBody, { y: 15, sx: 1.15, sy: 0.78, sz: 0.95 }));
  P.push(part(new THREE.SphereGeometry(10, 12, 8), C.gruntBelly, { x: 3, y: 10, sx: 1.2, sy: 0.6 }));
  P.push(part(new THREE.SphereGeometry(11, 12, 9), C.gruntHump, { x: -4, y: 22, sx: 1.2, sy: 0.85 }));
  P.push(part(new THREE.SphereGeometry(7, 12, 9), C.gruntHead, { x: 14, y: 14, sy: 0.85 }));
  // jaw spikes
  for (const s of [-1, 1]) P.push(part(new THREE.ConeGeometry(1.4, 6, 5), C.gruntBone, { x: 20, y: 11, z: s * 3, rz: -Math.PI / 2 }));
  // spine ridge
  for (let i = 0; i < 5; i++) {
    P.push(part(new THREE.ConeGeometry(2.6, 9 - i * 0.6, 6), C.gruntBone, { x: -15 + i * 5.5, y: 28 - Math.abs(i - 2) * 1.6, rz: 0.45 }));
  }
  // forearms + claws
  for (const s of [-1, 1]) {
    P.push(part(new THREE.BoxGeometry(14, 4.5, 4.5), C.gruntBone, { x: 13, y: 9, z: s * 12, ry: s * 0.25 }));
    for (const k of [-1.6, 1.6]) P.push(part(new THREE.ConeGeometry(1.4, 8, 5), C.gruntBone, { x: 23, y: 8, z: s * 13 + k, rz: -Math.PI / 2 }));
  }
  return mergeParts(P);
}

/** Two ember eyes (separate geometry → unlit glowing material). */
export function gruntEyesGeometry() {
  return mergeParts([-1, 1].map((s) => part(new THREE.SphereGeometry(1.9, 8, 6), '#ffffff', { x: 20, y: 16, z: s * 3 })));
}

/** Bullet tracer: thin capsule along +X. */
export function bulletGeometry() {
  return mergeParts([part(new THREE.CapsuleGeometry(1.5, 12, 2, 6), '#ffffff', { rz: Math.PI / 2 })]);
}

/** Muzzle flash: two crossed star planes (additive). */
export function muzzleGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-2, 0); shape.lineTo(6, -6); shape.lineTo(9, -2); shape.lineTo(17, 0); shape.lineTo(9, 2); shape.lineTo(6, 6); shape.closePath();
  const a = part(new THREE.ShapeGeometry(shape), '#ffffff', { rx: -Math.PI / 2 });
  const b = part(new THREE.ShapeGeometry(shape), '#ffffff', {});
  return mergeParts([a, b]);
}

// ---------------- beacon & tower-defense devices ----------------
const B = {
  stone: '#4a4f58', stoneDark: '#33373e', tower: '#d9d4c8', band: '#8c2f2b', iron: '#2a2e35', roof: '#3a1f1c',
  pad: '#3d424a', padRim: '#5a606a', metal: '#6b737d', metalDark: '#3a4048', brass: '#a87a3e',
  coil: '#5d8fa8', coilDark: '#2c4656',
};

/** Lighthouse: octagonal plinth, tapered tower with two red bands, gallery, roof. Footprint radius ≈ 46, height ≈ 150. */
export function beaconGeometry() {
  const P = [];
  P.push(part(new THREE.CylinderGeometry(58, 64, 10, 8), B.stoneDark, { y: 5 }));
  P.push(part(new THREE.CylinderGeometry(48, 54, 10, 8), B.stone, { y: 15 }));
  P.push(part(new THREE.CylinderGeometry(26, 40, 96, 16), B.tower, { y: 68 }));
  P.push(part(new THREE.CylinderGeometry(35.6, 37.6, 14, 16), B.band, { y: 42 }));
  P.push(part(new THREE.CylinderGeometry(30.2, 32.2, 14, 16), B.band, { y: 82 }));
  P.push(part(new THREE.CylinderGeometry(34, 34, 4, 16), B.iron, { y: 118 }));       // gallery floor
  for (let i = 0; i < 12; i++) {                                                      // gallery rail posts
    const a = (i / 12) * Math.PI * 2;
    P.push(part(new THREE.BoxGeometry(2, 9, 2), B.iron, { x: Math.cos(a) * 32, y: 124, z: Math.sin(a) * 32 }));
  }
  P.push(part(new THREE.CylinderGeometry(33, 33, 1.6, 16, 1, true), B.iron, { y: 128 }));
  P.push(part(new THREE.CylinderGeometry(21, 21, 3, 12), B.iron, { y: 121 }));
  P.push(part(new THREE.ConeGeometry(25, 20, 12), B.roof, { y: 150 }));
  P.push(part(new THREE.SphereGeometry(3, 8, 6), B.brass, { y: 161 }));
  return mergeParts(P);
}

/** Glass lantern room (separate, emissive-looking material). */
export function beaconLanternGeometry() {
  return mergeParts([part(new THREE.CylinderGeometry(19, 19, 18, 12), '#ffffff', { y: 131 })]);
}

/** Beam sector lying on the ground along +X: vertex colours fade from the beacon to the end of the range. */
export function beamGeometry(range, halfAngle) {
  const g = new THREE.CircleGeometry(range, 40, -halfAngle, halfAngle * 2);
  g.rotateX(-Math.PI / 2); // XY → XZ (angles flip sign, the sector is symmetric so it does not matter)
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i), pos.getZ(i)) / range;
    const k = Math.pow(Math.max(0, 1 - d), 1.4) * 0.55;
    col[i * 3] = k; col[i * 3 + 1] = k * 0.78; col[i * 3 + 2] = k * 0.45;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Build pad: low stone disc with a rim. */
export function padGeometry() {
  return mergeParts([
    part(new THREE.CylinderGeometry(34, 37, 6, 16), B.pad, { y: 3 }),
    part(new THREE.TorusGeometry(31, 2, 6, 24), B.padRim, { y: 6.2, rx: Math.PI / 2 }),
  ]);
}

/** Guard Turret base (static). */
export function turretBaseGeometry() {
  return mergeParts([
    part(new THREE.CylinderGeometry(20, 24, 10, 10), B.metalDark, { y: 11 }),
    part(new THREE.CylinderGeometry(9, 12, 16, 10), B.metal, { y: 22 }),
  ]);
}

/** Guard Turret head (rotates to its target, faces +X). */
export function turretHeadGeometry() {
  return mergeParts([
    part(new THREE.BoxGeometry(22, 12, 18), B.metal, { y: 34 }),
    part(new THREE.BoxGeometry(6, 9, 20), B.metalDark, { x: -10, y: 34 }),
    part(new THREE.CylinderGeometry(2.6, 3, 22, 8), B.metalDark, { x: 20, y: 35, z: -4, rz: -Math.PI / 2 }),
    part(new THREE.CylinderGeometry(2.6, 3, 22, 8), B.metalDark, { x: 20, y: 35, z: 4, rz: -Math.PI / 2 }),
    part(new THREE.BoxGeometry(5, 3, 12), B.brass, { x: 2, y: 41 }),
  ]);
}

/** Frost Coil: base + copper coil rings + a glowing crystal (crystal separate). */
export function coilGeometry() {
  const P = [part(new THREE.CylinderGeometry(18, 22, 10, 10), B.metalDark, { y: 11 })];
  P.push(part(new THREE.CylinderGeometry(5, 6, 34, 8), B.coilDark, { y: 32 }));
  for (let i = 0; i < 4; i++) P.push(part(new THREE.TorusGeometry(10 - i * 1.2, 2, 6, 16), B.coil, { y: 20 + i * 7, rx: Math.PI / 2 }));
  return mergeParts(P);
}

export function coilCrystalGeometry() {
  return mergeParts([part(new THREE.OctahedronGeometry(8, 0), '#ffffff', { y: 56, sy: 1.6 })]);
}

/** Aim reticle on the ground: ring + 4 ticks (like the reference screenshot). */
export function reticleGeometry() {
  const P = [part(new THREE.RingGeometry(9, 11.5, 28), '#ffffff', { rx: -Math.PI / 2 })];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    P.push(part(new THREE.PlaneGeometry(7, 2.2), '#ffffff', { x: Math.cos(a) * 17, z: Math.sin(a) * 17, rx: -Math.PI / 2, rz: -a }));
  }
  P.push(part(new THREE.CircleGeometry(2.4, 12), '#ffffff', { rx: -Math.PI / 2 }));
  return mergeParts(P);
}

// ---------------- environment props (decorative, never block movement in MVP) ----------------
export const PROP_KINDS = ['rock', 'ruin', 'stump', 'post'];

export function propParts(kind, rng, x, z) {
  const P = [];
  const r = () => rng.next();
  if (kind === 'rock') {
    const s = 10 + r() * 22;
    P.push(part(new THREE.DodecahedronGeometry(s, 0), r() < 0.5 ? '#2e333b' : '#3a4049', { x, y: s * 0.35, z, rx: r() * 3, ry: r() * 3, sy: 0.55 + r() * 0.3 }));
    if (r() < 0.5) P.push(part(new THREE.DodecahedronGeometry(s * 0.45, 0), '#262a31', { x: x + s * 0.8, y: s * 0.2, z: z + s * 0.3, ry: r() * 3, sy: 0.6 }));
  } else if (kind === 'ruin') {
    const w = 18 + r() * 26, h = 14 + r() * 26, d = 10 + r() * 8, ry = r() * Math.PI;
    P.push(part(new THREE.BoxGeometry(w, h, d), '#3b4048', { x, y: h / 2, z, ry }));
    P.push(part(new THREE.BoxGeometry(w * 0.5, h * 0.3, d * 1.1), '#2f343b', { x: x + 6, y: h + 2, z, ry, rz: 0.2 }));
    P.push(part(new THREE.BoxGeometry(8, 6, 8), '#33383f', { x: x - w * 0.7, y: 3, z: z + 9, ry: r() }));
  } else if (kind === 'stump') {
    const h = 10 + r() * 18;
    P.push(part(new THREE.CylinderGeometry(5, 8, h, 7), '#2b241e', { x, y: h / 2, z }));
    P.push(part(new THREE.CylinderGeometry(1.6, 2.4, 18, 5), '#2b241e', { x: x + 6, y: h + 4, z, rz: -0.9 }));
  } else {
    const h = 16 + r() * 12;
    P.push(part(new THREE.BoxGeometry(4, h, 4), '#3a2f25', { x, y: h / 2, z, rz: (r() - 0.5) * 0.4 }));
    P.push(part(new THREE.BoxGeometry(26, 2.5, 2), '#3a2f25', { x: x + 12, y: h * 0.7, z, rz: -0.25 }));
  }
  return P;
}

/** Tags an object for the asset viewer. */
export function tag(obj, name) {
  obj.userData.model = name;
  return obj;
}

/**
 * Standalone model instances for the asset viewer (exactly the game's geometries and materials).
 * @returns {Map<string, THREE.Object3D>}
 */
export function buildShowcase(materials, rng) {
  const out = new Map();
  out.set('keeper', tag(new THREE.Mesh(playerGeometry(), materials.character), 'keeper'));
  const grunt = new THREE.Group();
  grunt.add(new THREE.Mesh(gruntGeometry(), materials.character));
  grunt.add(new THREE.Mesh(gruntEyesGeometry(), materials.eyes));
  out.set('grunt', tag(grunt, 'grunt'));
  out.set('bullet', tag(new THREE.Mesh(bulletGeometry(), materials.bullet), 'bullet'));
  out.set('muzzle', tag(new THREE.Mesh(muzzleGeometry(), materials.muzzle), 'muzzle'));
  const beacon = new THREE.Group();
  beacon.add(new THREE.Mesh(beaconGeometry(), materials.prop), new THREE.Mesh(beaconLanternGeometry(), materials.lanternGlass));
  out.set('beacon', tag(beacon, 'beacon'));
  out.set('build-pad', tag(new THREE.Mesh(padGeometry(), materials.prop), 'build-pad'));
  const turret = new THREE.Group();
  turret.add(new THREE.Mesh(turretBaseGeometry(), materials.character), new THREE.Mesh(turretHeadGeometry(), materials.character));
  out.set('guard-turret', tag(turret, 'guard-turret'));
  const coil = new THREE.Group();
  coil.add(new THREE.Mesh(coilGeometry(), materials.character), new THREE.Mesh(coilCrystalGeometry(), materials.crystal));
  out.set('frost-coil', tag(coil, 'frost-coil'));
  for (const kind of PROP_KINDS) out.set(`prop-${kind}`, tag(new THREE.Mesh(mergeParts(propParts(kind, rng, 0, 0)), materials.prop), `prop-${kind}`));
  return out;
}
