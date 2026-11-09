// Procedural 3D models built from primitives (decision D9 + 3D conversion). Every model is ONE merged geometry with
// vertex colours (one draw call per model type; enemies/bullets are instanced). Models face +X; the renderer
// rotates them (rotation.y = -angle). 1 unit = 1 world unit of the simulation (player radius 18).
// Each object is tagged userData.model for the dev asset viewer (src/dev/debug-models.js).
// Final art can replace a model by a .glb with the same tag (art-prompts/02_PLAYER_COMBAT.md).
import * as THREE from '../../lib/three.module.js';
import { PROP_KINDS, rollProp } from '../systems/Props.js';

const tmpColor = new THREE.Color();

/** Bakes a primitive's transform + colour into a non-indexed geometry with a `color` attribute. */
function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, q = null } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    q || new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
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

/** A box from point a to point b (an arm, a stock bar): length along the segment, square section t. */
function limb(a, b, t, color) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
  return part(new THREE.BoxGeometry(len, t, t), color, { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2, q });
}

// ---------------- weapons in the keeper's hands (2026-11-09): arms + gun per weapon, child of the body ----------------
// Keeper frame: faces +X, right = +Z. Shoulders at x 3, y 33, z ±8.5. One-handed pistol; SMG / shotgun / rifle are
// held with both hands (off hand on the fore-grip). WEAPON_TIPS — the muzzle point (the flash sits there exactly).
const W = { dark: '#2f343a', metal: '#8d96a0', steel: '#5d646c', wood: '#6b4a2f', woodDark: '#4a3220', brass: '#b08a43' };
const SH_R = [3, 33, 8.5], SH_L = [3, 33, -8.5];
const glove = (x, y, z) => part(new THREE.BoxGeometry(5, 5, 5), C.glove, { x, y, z });
const gbox = (w, h, d, color, o) => part(new THREE.BoxGeometry(w, h, d), color, o);
const gcyl = (len, r, color, x, y, z) => part(new THREE.CylinderGeometry(r, r, len, 10), color, { x, y, z, rz: -Math.PI / 2 });

export const WEAPON_TIPS = {
  pistol: { x: 32.4, y: 34.2, z: 7, flash: 1 },
  smg: { x: 40.6, y: 33.8, z: 4, flash: 0.95 },
  shotgun: { x: 52.6, y: 34.4, z: 4, flash: 1.5 },
  assault_rifle: { x: 52.4, y: 34, z: 4, flash: 1.15 },
};
export const WEAPON_MODEL_IDS = Object.keys(WEAPON_TIPS);

function weaponParts(id) {
  const P = [];
  if (id === 'smg') {
    P.push(limb(SH_R, [19, 31.6, 5.6], 5, C.coat), glove(19.5, 31.4, 5.6));
    P.push(limb(SH_L, [30.5, 32.2, 2.6], 5, C.coat), glove(31, 32, 2.8));
    P.push(gbox(15, 4.6, 3.4, W.dark, { x: 24, y: 33.6, z: 4 }));
    P.push(gbox(13, 1.2, 2.6, W.metal, { x: 24, y: 36.5, z: 4 }));
    P.push(gcyl(7, 1.6, W.steel, 35, 33.8, 4), gcyl(2.2, 0.9, W.dark, 39.5, 33.8, 4));
    P.push(gbox(2.8, 9, 2.4, W.dark, { x: 26.5, y: 28, z: 4, rz: 0.12 }));
    P.push(gbox(3, 5.8, 2.6, W.dark, { x: 19.5, y: 30, z: 4, rz: 0.3 }));
    P.push(limb([16.5, 34.2, 4], [8, 33, 4], 1.3, W.metal), gbox(1.6, 4.6, 2.6, W.dark, { x: 7.6, y: 32.6, z: 4 }));
  } else if (id === 'shotgun') {
    P.push(limb(SH_R, [17, 31.8, 5.6], 5, C.coat), glove(17.5, 31.4, 5.6));
    P.push(limb(SH_L, [35, 31.4, 2.6], 5, C.coat), glove(35, 31.2, 2.8));
    P.push(gbox(13, 4.8, 3.6, W.dark, { x: 22, y: 33.6, z: 4 }));
    P.push(gcyl(24, 1.5, W.metal, 40.5, 34.4, 4), gcyl(18, 1.2, W.dark, 37, 32, 4));
    P.push(gbox(8, 3.4, 4.2, W.wood, { x: 35, y: 32, z: 4 }));
    for (const x of [32.5, 37.5]) P.push(gbox(0.8, 3.6, 4.4, W.woodDark, { x, y: 32, z: 4 })); // pump grooves
    P.push(gbox(15, 4.4, 3.2, W.wood, { x: 8.5, y: 32.6, z: 4, rz: -0.1 }), gbox(3.4, 5, 3, W.wood, { x: 16.5, y: 30.6, z: 4, rz: 0.35 }));
    P.push(part(new THREE.SphereGeometry(0.7, 6, 4), W.brass, { x: 51.5, y: 36.1, z: 4 }));
  } else if (id === 'assault_rifle' || id === 'machine_gun') {
    P.push(limb(SH_R, [20, 31.6, 5.6], 5, C.coat), glove(20.5, 31.4, 5.6));
    P.push(limb(SH_L, [36, 32, 2.6], 5, C.coat), glove(36, 31.8, 2.8));
    P.push(gbox(17, 5, 3.6, W.dark, { x: 24, y: 33.8, z: 4 }));
    P.push(gbox(11, 4.2, 3.8, W.steel, { x: 37, y: 33.8, z: 4 }));
    P.push(gcyl(8, 1, W.dark, 46.5, 34, 4), gcyl(2.6, 1.5, W.dark, 51, 34, 4));
    P.push(gbox(3.2, 6, 2.6, W.dark, { x: 27, y: 29, z: 4, rz: 0.1 }), gbox(3.2, 5, 2.6, W.dark, { x: 28, y: 24.8, z: 4, rz: 0.32 }));
    P.push(gbox(3, 5.6, 2.6, W.dark, { x: 20, y: 30.2, z: 4, rz: 0.3 }));
    P.push(gbox(11, 4.6, 3, W.dark, { x: 11, y: 33.2, z: 4 }), gbox(2, 6, 3.2, W.steel, { x: 5.4, y: 32.8, z: 4 }));
    P.push(gcyl(8, 1.6, W.steel, 25, 38.4, 4), gbox(3, 2, 2.2, W.dark, { x: 25, y: 36.8, z: 4 }));
    P.push(part(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 10), '#7fc7ff', { x: 29.1, y: 38.4, z: 4, rz: -Math.PI / 2 })); // lens
  } else { // pistol (one hand forward, the off hand near the chest)
    P.push(limb(SH_R, [18, 32.5, 7], 5, C.coat), glove(18.5, 32, 7));
    P.push(limb(SH_L, [9, 30, -4], 5, C.coat), glove(10, 30, -3.6));
    P.push(gbox(13, 3.4, 3.2, W.metal, { x: 25, y: 34.2, z: 7 }));
    P.push(gbox(10, 2.2, 2.8, W.dark, { x: 24.5, y: 32.4, z: 7 }));
    P.push(gbox(3.2, 6.4, 2.8, W.dark, { x: 20.5, y: 29.8, z: 7, rz: 0.25 }));
    P.push(gcyl(1.6, 1, W.dark, 31.6, 34.2, 7));
    P.push(gbox(1, 1, 2, W.dark, { x: 19.2, y: 36.3, z: 7 }), gbox(0.8, 1, 0.8, W.dark, { x: 30.6, y: 36.2, z: 7 }));
  }
  return P;
}

/** Arms + gun of a weapon (one merged geometry, the keeper's material). */
export function weaponGeometry(id) { return mergeParts(weaponParts(id)); }

/** Muzzle point of a weapon model (unknown ids: the rifle pose for the machine gun, else the pistol). */
export const weaponTip = (id) => WEAPON_TIPS[id] || (id === 'machine_gun' ? WEAPON_TIPS.assault_rifle : WEAPON_TIPS.pistol);

/**
 * The keeper: long oilskin coat, wide-brim hat. Height ≈ 52, footprint radius ≈ 18.
 * withBoots = false: the game animates the legs separately (bootGeometry, D45 walk cycle).
 * withArms = false: the game shows the arms + gun of the equipped weapon separately (weaponGeometry).
 */
export function playerGeometry(withBoots = true, withArms = true) {
  const P = [];
  // boots / legs
  if (withBoots) for (const s of [-1, 1]) P.push(part(new THREE.CylinderGeometry(3.6, 4.2, 12, 8), C.boots, { y: 6, z: s * 5 }));
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
  // arms + the pistol (the asset viewer / dodge ghosts); in the game they come from weaponGeometry()
  if (withArms) P.push(...weaponParts('pistol'));
  return mergeParts(P);
}

/** One boot of the keeper, hanging from its hip pivot (origin = hip, 12 units above the ground). */
export function bootGeometry() {
  return mergeParts([
    part(new THREE.CylinderGeometry(3.6, 4.2, 12, 8), C.boots, { y: -6 }),
    part(new THREE.BoxGeometry(7, 3, 5), C.boots, { x: 1.5, y: -10.5 }), // toe, so the step reads from above
  ]);
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

const R = { // runner / brute / warden palette
  runSkin: '#4a3552', runBelly: '#36263d', runBone: '#22161f',
  bruSkin: '#3d2b25', bruPlate: '#5b5249', bruPlateDark: '#3f3832', bruBone: '#1f1511',
  cloak: '#1e1828', cloakDark: '#120e18', robe: '#2b2238', bone: '#8f8574', boneDark: '#5e5649',
};

/** Runner: thin, low, long-legged, head stretched forward. Height ≈ 28, radius 13. */
export function runnerGeometry() {
  const P = [];
  for (const [x, z, rz] of [[-7, -6, 0.25], [-7, 6, 0.25], [6, -6, -0.3], [6, 6, -0.3]]) {
    P.push(part(new THREE.CylinderGeometry(1.3, 1.8, 15, 5), R.runBone, { x, y: 7, z, rz }));
  }
  P.push(part(new THREE.SphereGeometry(8, 12, 8), R.runSkin, { y: 16, sx: 1.7, sy: 0.62, sz: 0.85 }));
  P.push(part(new THREE.SphereGeometry(5, 10, 7), R.runBelly, { x: 2, y: 13, sx: 1.6, sy: 0.5, sz: 0.8 }));
  P.push(part(new THREE.CylinderGeometry(2.2, 3, 9, 6), R.runSkin, { x: 13, y: 19, rz: -1.1 }));       // neck
  P.push(part(new THREE.SphereGeometry(4.4, 10, 8), R.runSkin, { x: 18, y: 21, sx: 1.4, sy: 0.8 }));   // head
  P.push(part(new THREE.ConeGeometry(1.6, 7, 5), R.runBone, { x: 24, y: 19.5, rz: -Math.PI / 2 }));   // snout spike
  P.push(part(new THREE.ConeGeometry(2.2, 16, 6), R.runSkin, { x: -19, y: 15, rz: Math.PI / 2 + 0.15 })); // tail
  for (let i = 0; i < 3; i++) P.push(part(new THREE.ConeGeometry(1.4, 6, 5), R.runBone, { x: -6 + i * 5, y: 21.5, rz: 0.5 }));
  for (const s of [-1, 1]) P.push(part(new THREE.BoxGeometry(10, 2, 2), R.runBone, { x: 13, y: 10, z: s * 6, rz: 0.4 }));
  return mergeParts(P);
}

export function runnerEyesGeometry() {
  return mergeParts([-1, 1].map((s) => part(new THREE.SphereGeometry(1.4, 8, 6), '#ffffff', { x: 21.5, y: 22.5, z: s * 2.2 })));
}

/** Brute: massive knuckle-walker with stone-like plates on the shoulders. Height ≈ 58, radius 27. */
export function bruteGeometry() {
  const P = [];
  for (const z of [-11, 11]) P.push(part(new THREE.CylinderGeometry(6, 7, 18, 7), R.bruSkin, { x: -12, y: 9, z }));      // hind legs
  P.push(part(new THREE.SphereGeometry(24, 14, 10), R.bruSkin, { y: 32, sx: 1.05, sy: 0.85, sz: 1.0 }));               // torso
  P.push(part(new THREE.SphereGeometry(16, 12, 9), R.bruSkin, { x: -6, y: 46, sx: 1.2, sy: 0.75 }));                  // hump
  for (const s of [-1, 1]) {
    P.push(part(new THREE.BoxGeometry(22, 14, 18), R.bruPlate, { x: 4, y: 50, z: s * 15, rx: s * 0.35, rz: 0.15 }));   // shoulder plates
    P.push(part(new THREE.BoxGeometry(14, 4, 14), R.bruPlateDark, { x: 6, y: 58, z: s * 16, rx: s * 0.4 }));
    P.push(part(new THREE.BoxGeometry(10, 26, 10), R.bruSkin, { x: 16, y: 20, z: s * 22, rz: -0.25 }));              // forearms
    P.push(part(new THREE.BoxGeometry(14, 8, 13), R.bruPlateDark, { x: 20, y: 5, z: s * 23 }));                      // fists
  }
  P.push(part(new THREE.SphereGeometry(9, 10, 8), R.bruPlate, { x: 22, y: 32, sx: 1.1, sy: 0.85 }));                 // head
  for (let i = 0; i < 4; i++) P.push(part(new THREE.ConeGeometry(3.6, 13 - i, 6), R.bruBone, { x: -20 + i * 8, y: 56 - Math.abs(i - 1.5) * 2, rz: 0.5 }));
  for (const s of [-1, 1]) P.push(part(new THREE.ConeGeometry(2.4, 10, 5), R.bruBone, { x: 28, y: 28, z: s * 5, rz: -Math.PI / 2 + 0.3 })); // tusks
  return mergeParts(P);
}

export function bruteEyesGeometry() {
  return mergeParts([-1, 1].map((s) => part(new THREE.SphereGeometry(2.2, 8, 6), '#ffffff', { x: 29.5, y: 34, z: s * 4 })));
}

/** Gloam Warden (boss): tall hooded shade in a flared cloak, bone crown, long clawed arms. Height ≈ 112, radius 46. */
export function wardenGeometry() {
  const P = [];
  P.push(part(new THREE.CylinderGeometry(20, 44, 64, 14), R.cloak, { y: 32 }));                                // cloak
  P.push(part(new THREE.TorusGeometry(42, 3, 6, 20), R.cloakDark, { y: 3, rx: Math.PI / 2 }));                 // ragged hem
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    P.push(part(new THREE.ConeGeometry(6, 14, 4), R.cloakDark, { x: Math.cos(a) * 42, y: 5, z: Math.sin(a) * 42, rx: Math.PI }));
  }
  P.push(part(new THREE.SphereGeometry(22, 14, 10), R.robe, { y: 72, sx: 0.95, sy: 0.75, sz: 1.15 }));          // chest
  for (const s of [-1, 1]) {
    P.push(part(new THREE.SphereGeometry(12, 10, 8), R.cloak, { y: 80, z: s * 24 }));                          // shoulders
    P.push(part(new THREE.BoxGeometry(46, 8, 8), R.robe, { x: 20, y: 64, z: s * 30, rz: -0.55 }));             // arms
    for (const k of [-3, 0, 3]) P.push(part(new THREE.ConeGeometry(1.8, 14, 5), R.bone, { x: 42, y: 46, z: s * 30 + k, rz: -Math.PI / 2 - 0.5 }));
  }
  P.push(part(new THREE.ConeGeometry(15, 30, 10), R.cloakDark, { x: -2, y: 100, rz: 0.25 }));                   // hood
  P.push(part(new THREE.SphereGeometry(8.5, 12, 9), R.boneDark, { x: 7, y: 90, sx: 0.9 }));                     // skull face
  for (let i = 0; i < 5; i++) {                                                                                 // bone crown
    const a = -Math.PI / 2 + (i / 4) * Math.PI;
    P.push(part(new THREE.ConeGeometry(2.4, 15, 5), R.bone, { x: -2 + Math.cos(a) * 3, y: 110, z: Math.sin(a) * 12, rx: Math.sin(a) * 0.5 }));
  }
  return mergeParts(P);
}

/** Boss eyes + the gloam orb in its claw (unlit violet glow). */
export function wardenEyesGeometry() {
  const P = [-1, 1].map((s) => part(new THREE.SphereGeometry(2.4, 8, 6), '#ffffff', { x: 14.5, y: 92, z: s * 4 }));
  P.push(part(new THREE.IcosahedronGeometry(7, 1), '#ffffff', { x: 46, y: 50, z: 30 }));
  return mergeParts(P);
}

const N = { // D45 enemy palette
  spitSkin: '#3e4a2c', spitSac: '#5c7a33', spitDark: '#26301b', spitBone: '#1d2214',
  huskShell: '#5a5148', huskPlate: '#6f665b', huskSkin: '#2c2420', huskBone: '#1c1612',
  motherVeil: '#1b1d2a', motherVeilDark: '#10111a', motherBody: '#2b2d40', motherBone: '#9a93a8', motherTendril: '#24263a',
};

/** Spitter: squat body with a swollen glowing sac on its back and a long neck that aims at the beacon. Height ≈ 34. */
export function spitterGeometry() {
  const P = [];
  for (const [x, z] of [[-7, -7], [-7, 7], [5, -8], [5, 8]]) P.push(part(new THREE.CylinderGeometry(1.8, 2.4, 10, 5), N.spitBone, { x, y: 5, z, rz: x < 0 ? 0.2 : -0.2 }));
  P.push(part(new THREE.SphereGeometry(10, 12, 8), N.spitSkin, { y: 13, sx: 1.25, sy: 0.75 }));
  P.push(part(new THREE.SphereGeometry(9, 12, 9), N.spitSac, { x: -6, y: 22, sx: 1.1, sy: 0.95 }));          // venom sac
  for (let i = 0; i < 4; i++) P.push(part(new THREE.SphereGeometry(2.2, 6, 5), N.spitDark, { x: -10 + i * 3, y: 28 - Math.abs(i - 1.5), z: (i % 2 ? 4 : -4) }));
  P.push(part(new THREE.CylinderGeometry(2.6, 3.6, 14, 7), N.spitSkin, { x: 10, y: 21, rz: -0.9 }));       // neck
  P.push(part(new THREE.SphereGeometry(5, 10, 8), N.spitSkin, { x: 16, y: 27, sx: 1.3, sy: 0.9 }));         // head
  P.push(part(new THREE.CylinderGeometry(3.2, 2.2, 6, 8), N.spitDark, { x: 21.5, y: 27, rz: -Math.PI / 2 })); // mouth tube
  return mergeParts(P);
}

/** Spitter eyes + the glowing mouth and sac spots (unlit green glow). */
export function spitterEyesGeometry() {
  const P = [-1, 1].map((s) => part(new THREE.SphereGeometry(1.4, 8, 6), '#ffffff', { x: 19, y: 30, z: s * 2.6 }));
  P.push(part(new THREE.CircleGeometry(2.2, 10), '#ffffff', { x: 24.7, y: 27, ry: Math.PI / 2 }));
  return mergeParts(P);
}

/** Husk: hunched beast under a heavy segmented shell (the armour), short thick legs. Height ≈ 40, radius 22. */
export function huskGeometry() {
  const P = [];
  for (const [x, z] of [[-10, -12], [-10, 12], [8, -13], [8, 13]]) P.push(part(new THREE.CylinderGeometry(3.6, 4.4, 12, 6), N.huskSkin, { x, y: 6, z }));
  P.push(part(new THREE.SphereGeometry(17, 12, 9), N.huskSkin, { y: 17, sx: 1.15, sy: 0.7 }));
  for (let i = 0; i < 4; i++) {                                                                         // shell plates
    P.push(part(new THREE.SphereGeometry(16 - i * 1.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? N.huskPlate : N.huskShell,
      { x: -12 + i * 7, y: 22 - Math.abs(i - 1.5) * 1.2, sx: 0.5, sy: 0.9, sz: 1.05 }));
  }
  P.push(part(new THREE.SphereGeometry(7, 10, 8), N.huskPlate, { x: 18, y: 15, sx: 1.1, sy: 0.85 }));    // armoured head
  for (const s of [-1, 1]) P.push(part(new THREE.ConeGeometry(2, 9, 5), N.huskBone, { x: 25, y: 13, z: s * 4, rz: -Math.PI / 2 + 0.2 })); // mandibles
  for (let i = 0; i < 3; i++) P.push(part(new THREE.ConeGeometry(2.4, 7, 5), N.huskBone, { x: -9 + i * 7, y: 33 - Math.abs(i - 1), rz: 0.3 }));
  return mergeParts(P);
}

export function huskEyesGeometry() {
  return mergeParts([-1, 1].map((s) => part(new THREE.SphereGeometry(1.6, 8, 6), '#ffffff', { x: 24.5, y: 18, z: s * 3.4 })));
}

/** Fog Mother (final boss): tall veiled figure with a long train of tendrils and a cracked bone halo. Height ≈ 130. */
export function motherGeometry() {
  const P = [];
  P.push(part(new THREE.CylinderGeometry(18, 50, 76, 16), N.motherVeil, { y: 38 }));                      // veil
  for (let i = 0; i < 10; i++) {                                                                          // tendrils
    const a = (i / 10) * Math.PI * 2;
    P.push(part(new THREE.ConeGeometry(5, 34, 5), N.motherTendril, { x: Math.cos(a) * 48, y: 6, z: Math.sin(a) * 48, rx: Math.sin(a) * 1.35, rz: -Math.cos(a) * 1.35 }));
  }
  P.push(part(new THREE.TorusGeometry(48, 3.4, 6, 22), N.motherVeilDark, { y: 3, rx: Math.PI / 2 }));
  P.push(part(new THREE.SphereGeometry(20, 14, 10), N.motherBody, { y: 86, sx: 0.85, sy: 0.9, sz: 1.1 }));   // body
  for (const s of [-1, 1]) {
    P.push(part(new THREE.BoxGeometry(40, 7, 7), N.motherBody, { x: 14, y: 82, z: s * 26, rz: -0.75, ry: s * 0.4 })); // long arms
    for (const k of [-2.5, 0, 2.5]) P.push(part(new THREE.ConeGeometry(1.6, 13, 5), N.motherBone, { x: 30, y: 62, z: s * 34 + k, rz: -Math.PI / 2 - 0.75 }));
  }
  P.push(part(new THREE.ConeGeometry(14, 34, 10), N.motherVeilDark, { x: -3, y: 112, rz: 0.18 }));         // hood
  P.push(part(new THREE.SphereGeometry(8, 12, 9), N.motherBone, { x: 7, y: 104, sx: 0.85 }));              // face
  for (let i = 0; i < 9; i++) {                                                                           // halo of bone shards
    const a = (i / 9) * Math.PI * 2;
    P.push(part(new THREE.ConeGeometry(1.8, 11, 4), N.motherBone, { x: -8 + Math.cos(a) * 2, y: 112 + Math.sin(a) * 20, z: Math.cos(a) * 20, rx: a + Math.PI / 2 }));
  }
  return mergeParts(P);
}

/** Fog Mother eyes + the cold core in her chest (unlit glow). */
export function motherEyesGeometry() {
  const P = [-1, 1].map((s) => part(new THREE.SphereGeometry(2.2, 8, 6), '#ffffff', { x: 13.5, y: 106, z: s * 3.6 }));
  P.push(part(new THREE.IcosahedronGeometry(6, 1), '#ffffff', { x: 14, y: 86 }));
  return mergeParts(P);
}

/** Spitter glob in flight (unlit glow, instanced). */
export function globGeometry() {
  return mergeParts([part(new THREE.IcosahedronGeometry(5, 1), '#ffffff', {}), part(new THREE.IcosahedronGeometry(3, 0), '#ffffff', { x: -5, sy: 0.8 })]);
}

/** Flat telegraph shapes for boss attacks (unit size, scaled by the renderer). */
export function telegraphDiscGeometry() { return new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2); }
export function telegraphRingGeometry(inner = 0.95) { return new THREE.RingGeometry(inner, 1, 72).rotateX(-Math.PI / 2); }

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

/**
 * Beam sector lying on the ground along +X (additive). Built from radial rings so the falloff curve is real
 * (a plain fan interpolates linearly from the centre to the rim and reads as a flat white wedge): bright near the
 * beacon, fading to nothing at the range, with softened side edges. Same angle/range as the LightSystem test.
 */
export function beamGeometry(range, halfAngle) {
  const RINGS = 14, SEGS = 24, PEAK = 0.22;
  const pos = [], col = [], idx = [];
  for (let r = 0; r <= RINGS; r++) {
    const d = r / RINGS;
    const radial = Math.pow(1 - d, 2.2) * PEAK;
    for (let s = 0; s <= SEGS; s++) {
      const u = s / SEGS * 2 - 1;                 // -1 … 1 across the sector
      const a = u * halfAngle;
      pos.push(Math.cos(a) * range * d, 0, -Math.sin(a) * range * d);
      const k = radial * (1 - 0.65 * Math.pow(Math.abs(u), 3)); // softer side edges
      col.push(k, k * 0.8, k * 0.5);
    }
  }
  const row = SEGS + 1;
  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SEGS; s++) {
      const a = r * row + s, b = a + 1, c = a + row, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Build pad: low stone disc with a rim. */
export function padGeometry() {
  return mergeParts([
    part(new THREE.CylinderGeometry(34, 37, 6, 16), B.pad, { y: 3 }),
    part(new THREE.TorusGeometry(31, 2, 6, 24), B.padRim, { y: 6.2, rx: Math.PI / 2 }),
  ]);
}

// ---------------- defense devices: 3 levels each (D50) — every level is its own model ----------------
// Base = static, head = rotates to the target (faces +X), crystal = Frost Coil glow (emissive material, spins).
// Barrel tips: L1 single centred barrel; L2+ twin barrels ±4 (the sim fires two rounds from them).
const T3 = { gold: '#e2b04a', red: '#c0392b', glass: '#9fd8ff', ice: '#cfe9f7', iceDark: '#6aa6c4' };
const barrel = (len, r, x, y, z, color) => part(new THREE.CylinderGeometry(r, r * 1.12, len, 10), color, { x, y, z, rz: -Math.PI / 2 });

/** Guard Turret base (static) for a level: L2 armour skirt, L3 reinforced plinth with struts and a gold band. */
export function turretBaseGeometry(level = 1) {
  const P = [
    part(new THREE.CylinderGeometry(20, 24, 10, level >= 3 ? 8 : 10), B.metalDark, { y: 11 }),
    part(new THREE.CylinderGeometry(9, 12, 16, 10), B.metal, { y: 22 }),
  ];
  if (level >= 2) P.push(part(new THREE.CylinderGeometry(15, 17, 4, 10), B.metalDark, { y: 17 }));
  if (level >= 3) {
    P.push(part(new THREE.TorusGeometry(21.6, 1.3, 5, 16), T3.gold, { y: 15.8, rx: Math.PI / 2 })); // thin gold band
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      P.push(part(new THREE.BoxGeometry(4, 14, 4), B.metal, { x: Math.cos(a) * 13, y: 21, z: Math.sin(a) * 13, rx: Math.sin(a) * 0.35, rz: -Math.cos(a) * 0.35 }));
    }
  }
  return mergeParts(P);
}

/** Guard Turret head for a level (rotates; faces +X): L1 one gun · L2 twin guns + ammo drum · L3 long twin guns, shield, sight. */
export function turretHeadGeometry(level = 1) {
  const P = [];
  const w = level >= 2 ? 22 : 18;
  P.push(part(new THREE.BoxGeometry(22, 12, w), B.metal, { y: 34 }));
  P.push(part(new THREE.BoxGeometry(6, 9, w + 2), B.metalDark, { x: -10, y: 34 }));
  P.push(part(new THREE.BoxGeometry(5, 3, 12), B.brass, { x: 2, y: 41 }));
  if (level === 1) {
    P.push(barrel(22, 2.8, 20, 35, 0, B.metalDark));
    P.push(barrel(4, 3.6, 30, 35, 0, B.iron));                        // muzzle brake
  } else {
    const len = level >= 3 ? 28 : 22;
    for (const z of [-4, 4]) {
      P.push(barrel(len, 2.6, 11 + len / 2, 35, z, B.metalDark));
      P.push(barrel(4, 3.4, 9 + len, 35, z, B.iron));
      if (level >= 3) for (const x of [14, 20]) P.push(part(new THREE.TorusGeometry(3.4, 0.9, 5, 10), B.iron, { x, y: 35, z, ry: Math.PI / 2 })); // cooling rings
    }
    P.push(part(new THREE.CylinderGeometry(5.5, 5.5, 6, 12), B.brass, { x: -2, y: 34, z: w / 2 + 3, rx: Math.PI / 2 })); // ammo drum
  }
  if (level >= 3) {
    P.push(part(new THREE.BoxGeometry(3, 15, w + 8), B.metalDark, { x: 8, y: 34 }));       // front shield
    P.push(part(new THREE.CylinderGeometry(1.8, 1.8, 9, 8), B.iron, { x: 2, y: 43.5, rz: -Math.PI / 2 })); // sight
    P.push(part(new THREE.SphereGeometry(1.4, 8, 6), T3.red, { x: 6.8, y: 43.5 }));
    for (const s of [-1, 1]) P.push(part(new THREE.BoxGeometry(22.4, 1.4, 1.6), T3.gold, { y: 40.4, z: s * (w / 2 - 0.4) })); // gold edge trim
  }
  return mergeParts(P);
}

/** Frost Coil base (static): copper coils round the post — one more coil and frost vents per level. */
export function coilGeometry(level = 1) {
  const P = [part(new THREE.CylinderGeometry(18, 22, 10, 10), B.metalDark, { y: 11 })];
  P.push(part(new THREE.CylinderGeometry(5, 6, 22, 8), B.coilDark, { y: 26 }));
  for (let i = 0; i < 1 + level; i++) P.push(part(new THREE.TorusGeometry(10 - i * 1.4, 2, 6, 16), B.coil, { y: 18 + i * 5.5, rx: Math.PI / 2 }));
  if (level >= 3) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      P.push(part(new THREE.ConeGeometry(3.2, 12, 6), T3.ice, { x: Math.cos(a) * 17, y: 20, z: Math.sin(a) * 17, rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 }));
    }
    P.push(part(new THREE.TorusGeometry(20.5, 1.4, 5, 16), T3.iceDark, { y: 15.8, rx: Math.PI / 2 })); // frosted band
  }
  return mergeParts(P);
}

/** Frost Coil head (rotates; faces +X): a frost emitter — one barrel at L1, twin at L2, long finned twin at L3. */
export function coilHeadGeometry(level = 1) {
  const P = [];
  P.push(part(new THREE.CylinderGeometry(9, 10, 9, 12), B.coilDark, { y: 42 }));
  P.push(part(new THREE.BoxGeometry(14, 7, level >= 2 ? 20 : 14), B.metal, { x: 2, y: 42 }));
  const zs = level >= 2 ? [-5, 5] : [0];
  const len = level >= 3 ? 24 : 18;
  for (const z of zs) {
    P.push(barrel(len, 2.4, 6 + len / 2, 43, z, B.coilDark));
    for (let k = 0; k < (level >= 3 ? 3 : 2); k++) P.push(part(new THREE.TorusGeometry(3.6, 1, 5, 10), B.coil, { x: 10 + k * 5, y: 43, z, ry: Math.PI / 2 }));
    P.push(part(new THREE.OctahedronGeometry(2.6, 0), T3.glass, { x: 7 + len, y: 43, z, sx: 1.5 })); // ice tip
    if (level >= 3) for (const s of [-1, 1]) P.push(part(new THREE.BoxGeometry(10, 0.8, 4), T3.ice, { x: 12, y: 43 + s * 3, z, rx: s * 0.5 })); // fins
  }
  return mergeParts(P);
}

// Poison Turret (D51): a dark-green sprayer on a plinth with glowing toxic tanks (more tanks per level).
const PZ = { body: '#3f5240', dark: '#26302a', metal: '#5b616b', hazard: '#d8b032', hose: '#1c221e' };
const tankSpots = (level) => [[-10, 11], [-10, -11], [10, 12], [10, -12]].slice(0, level + 1);

/** Poison Turret base (static): plinth + caps/hoses of the tanks; L3 a hazard band. */
export function poisonBaseGeometry(level = 1) {
  const P = [part(new THREE.CylinderGeometry(19, 23, 10, 10), PZ.dark, { y: 11 })];
  P.push(part(new THREE.CylinderGeometry(6, 7, 20, 10), PZ.body, { y: 25 }));
  for (const [x, z] of tankSpots(level)) {
    P.push(part(new THREE.CylinderGeometry(4.6, 4.6, 1.6, 10), PZ.metal, { x, y: 17, z }));  // tank foot
    P.push(part(new THREE.CylinderGeometry(4.6, 4.6, 1.6, 10), PZ.metal, { x, y: 30, z }));  // tank cap
    P.push(limb([x * 0.6, 30, z * 0.6], [x * 0.25, 33, z * 0.25], 1.4, PZ.hose));          // hose to the post
  }
  if (level >= 3) P.push(part(new THREE.TorusGeometry(21.4, 1.3, 5, 16), PZ.hazard, { y: 15.8, rx: Math.PI / 2 }));
  return mergeParts(P);
}

/** Toxic tanks on the base (glowing material, static). */
export function poisonTanksGeometry(level = 1) {
  return mergeParts(tankSpots(level).map(([x, z]) => part(new THREE.CylinderGeometry(4, 4, 11.4, 10), '#ffffff', { x, y: 23.5, z })));
}

/** Poison Turret head (rotates; faces +X): a sprayer — one nozzle at L1, twin at L2, long twin with a drum at L3. */
export function poisonHeadGeometry(level = 1) {
  const P = [part(new THREE.SphereGeometry(9, 12, 8), PZ.body, { y: 39, sy: 0.75 })];
  P.push(part(new THREE.BoxGeometry(12, 6, level >= 2 ? 18 : 12), PZ.dark, { x: 3, y: 39 }));
  const zs = level >= 2 ? [-4.5, 4.5] : [0];
  const len = level >= 3 ? 20 : 15;
  for (const z of zs) {
    P.push(barrel(len, 2, 8 + len / 2, 40, z, PZ.metal));
    P.push(part(new THREE.ConeGeometry(3.4, 4.5, 10), PZ.dark, { x: 9 + len, y: 40, z, rz: -Math.PI / 2 })); // spray nozzle
  }
  if (level >= 3) P.push(part(new THREE.CylinderGeometry(4.6, 4.6, 7, 12), PZ.hazard, { x: -4, y: 39, z: 0, rx: Math.PI / 2 }));
  return mergeParts(P);
}

/** Small toxic vial on top of the head (glowing, turns with the head). */
export function poisonVialGeometry(level = 1) {
  return mergeParts([part(new THREE.CylinderGeometry(2.6 + level * 0.3, 2.6 + level * 0.3, 7, 10), '#ffffff', { x: -3, y: 47 })]);
}

/** Frost Coil crystal (emissive, spins above the head): bigger with the level, a cluster of three at L3. */
export function coilCrystalGeometry(level = 1) {
  const s = level >= 2 ? 1.15 : 1;
  const P = [part(new THREE.OctahedronGeometry(6 * s, 0), '#ffffff', { y: 56, sy: 1.6 })];
  if (level >= 3) for (const [x, z] of [[-5, 4], [4, -5]]) P.push(part(new THREE.OctahedronGeometry(3.4, 0), '#ffffff', { x, y: 53, z, sy: 1.7 }));
  return mergeParts(P);
}

const K = { wood: '#5a3f2a', woodDark: '#3a281b', awningA: '#c98a2e', awningB: '#3b2b3f', metal: '#5b616b', gold: '#e2b04a', crate: '#6b4a2f' };

/** Shop kiosk: a small lantern-lit market stall (faces +X towards the counter). Footprint ≈ 24, height ≈ 56. */
export function kioskGeometry() {
  const P = [];
  P.push(part(new THREE.BoxGeometry(50, 4, 40), K.woodDark, { y: 2 }));                         // floor
  P.push(part(new THREE.BoxGeometry(12, 16, 38), K.wood, { x: 16, y: 12 }));                   // counter
  P.push(part(new THREE.BoxGeometry(14, 2, 40), K.woodDark, { x: 16, y: 21 }));                // counter top
  for (const [x, z] of [[-22, -18], [-22, 18], [22, -18], [22, 18]]) P.push(part(new THREE.CylinderGeometry(1.6, 1.8, 46, 6), K.woodDark, { x, y: 25, z }));
  for (let i = 0; i < 6; i++) {                                                                  // striped awning
    P.push(part(new THREE.BoxGeometry(58, 2.4, 8), i % 2 ? K.awningB : K.awningA, { y: 50 - 0, z: -20 + i * 8 + 4, rz: -0.2 }));
  }
  P.push(part(new THREE.CylinderGeometry(7, 7, 1.6, 16), K.gold, { x: 30, y: 40, rz: Math.PI / 2 })); // coin sign
  P.push(part(new THREE.BoxGeometry(2, 10, 2), K.metal, { x: 26, y: 44 }));
  P.push(part(new THREE.BoxGeometry(12, 10, 12), K.crate, { x: -12, y: 9, z: 10, ry: 0.4 }));    // goods
  P.push(part(new THREE.CylinderGeometry(5, 5, 12, 10), K.wood, { x: -12, y: 10, z: -10 }));
  return mergeParts(P);
}

/** Kiosk lanterns (unlit glowing material). */
export function kioskLanternGeometry() {
  return mergeParts([
    part(new THREE.SphereGeometry(2.8, 10, 8), '#ffffff', { x: 22, y: 38, z: -18 }),
    part(new THREE.SphereGeometry(2.8, 10, 8), '#ffffff', { x: 22, y: 38, z: 18 }),
  ]);
}

/** Reward crate: iron-bound wooden chest with a glowing lock (≈ 30 × 22, height 22). Faces +X. */
export function crateGeometry() {
  const P = [];
  P.push(part(new THREE.BoxGeometry(30, 16, 22), '#6b4a2f', { y: 8 }));
  P.push(part(new THREE.BoxGeometry(31, 6, 23), '#5a3d26', { y: 19, rz: 0 }));               // lid
  for (const x of [-11, 11]) P.push(part(new THREE.BoxGeometry(3, 23, 23.5), '#3a3f46', { x, y: 11 })); // iron bands
  P.push(part(new THREE.BoxGeometry(31.5, 2.5, 23.5), '#3a3f46', { y: 16 }));
  return mergeParts(P);
}

/** Crate glow: the lock + a soft light pillar so the crate reads from afar (additive, separate material). */
export function crateGlowGeometry() {
  const lock = part(new THREE.BoxGeometry(2, 5, 5), '#ffffff', { x: 15.5, y: 13 });
  const pillar = new THREE.CylinderGeometry(9, 14, 140, 16, 1, true).toNonIndexed();
  pillar.translate(0, 70, 0);
  const pos = pillar.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.max(0, 1 - pos.getY(i) / 140) * 0.55;
    col[i * 3] = k; col[i * 3 + 1] = k * 0.82; col[i * 3 + 2] = k * 0.45;
  }
  pillar.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pillar.deleteAttribute('uv');
  return mergeParts([lock, pillar]);
}

/** Grenade in flight: small sphere with a fuse cap (tinted per type by instance colour). */
export function grenadeGeometry() {
  return mergeParts([
    part(new THREE.SphereGeometry(4.5, 10, 8), '#ffffff', {}),
    part(new THREE.CylinderGeometry(1.4, 1.4, 3, 6), '#888888', { y: 5 }),
  ]);
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

// ---------------- environment props: geometry from the shared layout descriptors (systems/Props.js) ----------------
// They collide since D40 — the colliders come from the same descriptors, so visuals and blocking always match.
export { PROP_KINDS };

/** @param {object} p descriptor from systems/Props.js rollProp() */
export function propParts(p) {
  const P = [];
  const x = p.x, z = p.y;
  if (p.kind === 'rock') {
    const s = p.s;
    P.push(part(new THREE.DodecahedronGeometry(s, 0), p.dark ? '#2e333b' : '#3a4049', { x, y: s * 0.35, z, rx: p.rx, ry: p.ry, sy: p.sy }));
    if (p.twin) P.push(part(new THREE.DodecahedronGeometry(s * 0.45, 0), '#262a31', { x: x + s * 0.8, y: s * 0.2, z: z + s * 0.3, ry: p.twinRy, sy: 0.6 }));
  } else if (p.kind === 'ruin') {
    const { w, h, d, ry } = p;
    P.push(part(new THREE.BoxGeometry(w, h, d), '#3b4048', { x, y: h / 2, z, ry }));
    P.push(part(new THREE.BoxGeometry(w * 0.5, h * 0.3, d * 1.1), '#2f343b', { x: x + 6, y: h + 2, z, ry, rz: 0.2 }));
    P.push(part(new THREE.BoxGeometry(8, 6, 8), '#33383f', { x: x - w * 0.7, y: 3, z: z + 9, ry: p.blockRy }));
  } else if (p.kind === 'stump') {
    P.push(part(new THREE.CylinderGeometry(5, 8, p.h, 7), '#2b241e', { x, y: p.h / 2, z }));
    P.push(part(new THREE.CylinderGeometry(1.6, 2.4, 18, 5), '#2b241e', { x: x + 6, y: p.h + 4, z, rz: -0.9 }));
  } else if (p.kind === 'post') {
    P.push(part(new THREE.BoxGeometry(4, p.h, 4), '#3a2f25', { x, y: p.h / 2, z, rz: p.rz }));
    P.push(part(new THREE.BoxGeometry(26, 2.5, 2), '#3a2f25', { x: x + 12, y: p.h * 0.7, z, rz: -0.25 }));
  } else themedPropParts(p, P);
  return P;
}

const PR = { // D45 decor palette
  wood: '#5e4430', woodDark: '#3e2c1f', woodPale: '#7a5f45', iron: '#2c3036', rope: '#8a7a5c',
  pine: '#1f3a28', pineDark: '#162c1e', pineLight: '#2b4a33', bark: '#3a2a1e', deadBark: '#4a3d33',
  reed: '#6c7348', reedTip: '#8a6f45', salt: '#b9b6a2', saltDark: '#8e8b7a',
  ice: '#9fc4e4', iceDeep: '#6e95bd', snow: '#d9e2ec', snowRock: '#56606e',
  basalt: '#1d1a1c', basaltTop: '#2b2729', ember: '#a8391c', emberRock: '#2a2224',
};

/** Decor of maps 2–6 (same descriptor → same colliders, systems/Props.js). Low-poly, merged into one draw call. */
function themedPropParts(p, P) {
  const x = p.x, z = p.y;
  switch (p.kind) {
    case 'saltrock': case 'snowrock': case 'ember': {
      const s = p.s;
      const body = p.kind === 'saltrock' ? (p.dark ? PR.saltDark : PR.salt) : p.kind === 'snowrock' ? PR.snowRock : PR.emberRock;
      P.push(part(new THREE.DodecahedronGeometry(s, 0), body, { x, y: s * 0.35, z, rx: p.rx, ry: p.ry, sy: p.sy }));
      if (p.kind === 'snowrock') P.push(part(new THREE.DodecahedronGeometry(s * 0.8, 0), PR.snow, { x, y: s * 0.62, z, ry: p.ry, sy: 0.35 }));
      if (p.kind === 'ember') P.push(part(new THREE.DodecahedronGeometry(s * 0.35, 0), PR.ember, { x: x + s * 0.3, y: s * 0.55, z, ry: p.rx }));
      if (p.twin) P.push(part(new THREE.DodecahedronGeometry(s * 0.45, 0), p.kind === 'snowrock' ? PR.snow : body, { x: x + s * 0.8, y: s * 0.2, z: z + s * 0.3, ry: p.twinRy, sy: 0.6 }));
      break;
    }
    case 'crate': {
      const s = p.s;
      P.push(part(new THREE.BoxGeometry(s * 2, s * 2, s * 2), PR.wood, { x, y: s, z, ry: p.ry }));
      P.push(part(new THREE.BoxGeometry(s * 2.06, s * 0.3, s * 2.06), PR.woodDark, { x, y: s * 1.4, z, ry: p.ry }));
      if (p.stack) P.push(part(new THREE.BoxGeometry(s * 1.4, s * 1.4, s * 1.4), PR.woodPale, { x, y: s * 2.7, z, ry: p.ry + p.topRy }));
      break;
    }
    case 'barrel': {
      const one = (bx, bz) => {
        P.push(part(new THREE.CylinderGeometry(p.r, p.r * 0.9, p.h, 9), PR.wood, { x: bx, y: p.h / 2, z: bz }));
        for (const k of [0.25, 0.75]) P.push(part(new THREE.CylinderGeometry(p.r + 0.4, p.r + 0.4, 1.4, 9), PR.iron, { x: bx, y: p.h * k, z: bz }));
      };
      one(x, z);
      if (p.pair) one(x + Math.cos(p.pairA) * p.r * 2.1, z + Math.sin(p.pairA) * p.r * 2.1);
      break;
    }
    case 'bollard':
      P.push(part(new THREE.CylinderGeometry(4.2, 5, p.h, 8), PR.woodDark, { x, y: p.h / 2, z }));
      P.push(part(new THREE.CylinderGeometry(5.4, 5.4, 2, 8), PR.iron, { x, y: p.h, z }));
      if (p.rope) P.push(part(new THREE.TorusGeometry(5.6, 1, 4, 10), PR.rope, { x, y: p.h * 0.6, z, rx: Math.PI / 2 }));
      break;
    case 'planks':
      for (let i = 0; i < p.n; i++) {
        P.push(part(new THREE.BoxGeometry(p.w, 2.4, 7), i % 2 ? PR.woodPale : PR.wood, { x, y: 1.4 + i * 2.5, z: z + (i - p.n / 2) * 2, ry: p.ry + i * 0.06 }));
      }
      break;
    case 'pine': {
      const h = p.h, cr = p.cr;
      const shade = p.shade < 0.33 ? PR.pineDark : p.shade < 0.66 ? PR.pine : PR.pineLight;
      P.push(part(new THREE.CylinderGeometry(2.4, 3.6, h * 0.35, 6), PR.bark, { x, y: h * 0.17, z }));
      for (let i = 0; i < 3; i++) {
        const k = 1 - i * 0.27;
        P.push(part(new THREE.ConeGeometry(cr * k, h * 0.42, 7), i === 1 ? PR.pine : shade, { x, y: h * (0.36 + i * 0.2), z, rz: p.tilt, ry: i }));
      }
      break;
    }
    case 'deadtree': {
      const h = p.h;
      P.push(part(new THREE.CylinderGeometry(1.6, 3.6, h, 6), PR.deadBark, { x, y: h / 2, z, rz: p.lean }));
      for (let i = 0; i < 3; i++) {
        const a = p.ry + i * 2.1;
        P.push(part(new THREE.CylinderGeometry(0.8, 1.5, h * 0.4, 5), PR.deadBark, {
          x: x + Math.cos(a) * 6, y: h * (0.55 + i * 0.12), z: z + Math.sin(a) * 6, rx: Math.sin(a) * 0.9, rz: Math.cos(a) * 0.9,
        }));
      }
      break;
    }
    case 'reeds':
      for (let i = 0; i < p.n; i++) {
        const a = p.seed * 6.28 + i * 2.4, d = (i / p.n) * p.s * 0.6;
        const h = p.s * (1.3 + ((i * 37) % 7) / 10);
        P.push(part(new THREE.CylinderGeometry(0.6, 1, h, 4), PR.reed, { x: x + Math.cos(a) * d, y: h / 2, z: z + Math.sin(a) * d, rx: Math.sin(a) * 0.15, rz: Math.cos(a) * 0.15 }));
        if (i % 2 === 0) P.push(part(new THREE.CylinderGeometry(1.4, 1.4, 5, 5), PR.reedTip, { x: x + Math.cos(a) * d, y: h - 1, z: z + Math.sin(a) * d }));
      }
      break;
    case 'icespike': case 'basalt': {
      const ice = p.kind === 'icespike';
      for (let i = 0; i < p.n; i++) {
        const a = p.ry + (i / p.n) * Math.PI * 2, d = i === 0 ? 0 : p.w * 1.1;
        const h = p.h * (1 - i * 0.22);
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        if (ice) {
          P.push(part(new THREE.ConeGeometry(p.w * (1 - i * 0.15), h, 5), i === 0 ? PR.ice : PR.iceDeep, { x: px, y: h / 2, z: pz, rx: Math.sin(a) * 0.12 * i, rz: Math.cos(a) * 0.12 * i }));
        } else {
          P.push(part(new THREE.CylinderGeometry(p.w, p.w * 1.05, h, 6), PR.basalt, { x: px, y: h / 2, z: pz }));
          P.push(part(new THREE.CylinderGeometry(p.w * 0.98, p.w * 0.98, 1.6, 6), PR.basaltTop, { x: px, y: h + 0.4, z: pz }));
        }
      }
      break;
    }
    default:
      P.push(part(new THREE.DodecahedronGeometry(12, 0), '#3a4049', { x, y: 4, z }));
  }
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
  for (const [name, body, eyes, eyesMat] of [
    ['runner', runnerGeometry, runnerEyesGeometry, 'eyes'],
    ['brute', bruteGeometry, bruteEyesGeometry, 'eyes'],
    ['gloam-warden', wardenGeometry, wardenEyesGeometry, 'eyesBoss'],
    ['spitter', spitterGeometry, spitterEyesGeometry, 'eyesSpitter'],
    ['husk', huskGeometry, huskEyesGeometry, 'eyes'],
    ['fog-mother', motherGeometry, motherEyesGeometry, 'eyesMother'],
  ]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(body(), materials.character), new THREE.Mesh(eyes(), materials[eyesMat]));
    out.set(name, tag(g, name));
  }
  out.set('glob', tag(new THREE.Mesh(globGeometry(), materials.glob), 'glob'));
  out.set('bullet', tag(new THREE.Mesh(bulletGeometry(), materials.bullet), 'bullet'));
  out.set('muzzle', tag(new THREE.Mesh(muzzleGeometry(), materials.muzzle), 'muzzle'));
  const beacon = new THREE.Group();
  beacon.add(new THREE.Mesh(beaconGeometry(), materials.prop), new THREE.Mesh(beaconLanternGeometry(), materials.lanternGlass));
  out.set('beacon', tag(beacon, 'beacon'));
  out.set('build-pad', tag(new THREE.Mesh(padGeometry(), materials.prop), 'build-pad'));
  for (let lv = 1; lv <= 3; lv++) { // D50: every device level is its own model
    const turret = new THREE.Group();
    turret.add(new THREE.Mesh(turretBaseGeometry(lv), materials.character), new THREE.Mesh(turretHeadGeometry(lv), materials.character));
    out.set(`guard-turret-lv${lv}`, tag(turret, `guard-turret-lv${lv}`));
    const coil = new THREE.Group();
    coil.add(new THREE.Mesh(coilGeometry(lv), materials.character), new THREE.Mesh(coilHeadGeometry(lv), materials.character),
      new THREE.Mesh(coilCrystalGeometry(lv), materials.crystal));
    out.set(`frost-coil-lv${lv}`, tag(coil, `frost-coil-lv${lv}`));
    const poison = new THREE.Group();
    poison.add(new THREE.Mesh(poisonBaseGeometry(lv), materials.character), new THREE.Mesh(poisonTanksGeometry(lv), materials.toxic),
      new THREE.Mesh(poisonHeadGeometry(lv), materials.character), new THREE.Mesh(poisonVialGeometry(lv), materials.toxic));
    out.set(`poison-turret-lv${lv}`, tag(poison, `poison-turret-lv${lv}`));
  }
  for (const id of WEAPON_MODEL_IDS) out.set(`weapon-${id}`, tag(new THREE.Mesh(weaponGeometry(id), materials.character), `weapon-${id}`));
  const crate = new THREE.Group();
  crate.add(new THREE.Mesh(crateGeometry(), materials.prop), new THREE.Mesh(crateGlowGeometry(), materials.crateGlow));
  out.set('crate', tag(crate, 'crate'));
  out.set('grenade', tag(new THREE.Mesh(grenadeGeometry(), materials.character), 'grenade'));
  const kiosk = new THREE.Group();
  kiosk.add(new THREE.Mesh(kioskGeometry(), materials.prop), new THREE.Mesh(kioskLanternGeometry(), materials.lantern));
  out.set('kiosk', tag(kiosk, 'kiosk'));
  for (const kind of PROP_KINDS) out.set(`prop-${kind}`, tag(new THREE.Mesh(mergeParts(propParts(rollProp(kind, rng, 0, 0))), materials.prop), `prop-${kind}`));
  return out;
}
