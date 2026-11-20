// D117 (user: new PC textures — replace the monitors and PCs of the office; remodel the workstation with the new PC):
// the workstation built in code from its own small atlas (data/workstationAtlas.js, tools/build-workstation.py):
//   - the desk: a top slab in its clean wood; its front / back / left / right pictures below the top (legs, the drawer
//     pedestal) on the sides, cut out by their transparency;
//   - on it the new equipment as real low-poly boxes with the PC atlas' faces: the monitor (screen, back, the foot and
//     neck), the keyboard, the mouse, the phone and the PC tower.
// Every workstation (and the server room's terminal) of a level is ONE mesh, lit like the atlas props (the baked lights
// as vertex colours). Presentation only — the collision stays in data/props.js.
import * as THREE from '../../lib/three.module.js';
import { PROP_TYPES } from '../data/props.js';
import { PROP_MODELS } from '../data/propModels.js';
import { WORKSTATION_ATLAS as A } from '../data/workstationAtlas.js';
import { lightAt } from './officeLights.js';

const SLAB = 1.2;      // units: the desk top's thickness
const K = 30 * 1.1;    // units per metre for the equipment (a touch over the real size: it reads from the top view)
let material = null;

function sharedMaterial() {
  if (!material) {
    const t = new THREE.TextureLoader().load(A.file);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    material = new THREE.MeshLambertMaterial({ map: t, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  }
  return material;
}

/** A quad w × h facing +z (centre at the origin) showing the atlas rect `name`. */
function quad(name, w, h) {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const [rx, ry, rw, rh] = A.rects[name];
  const u0 = (rx + 0.5) / A.width, u1 = (rx + rw - 0.5) / A.width, v0 = 1 - (ry + rh - 0.5) / A.height, v1 = 1 - (ry + 0.5) / A.height;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  return g;
}

/**
 * A box w × h × d standing at (x, y0, z) — faces { top, front, back, left, right } (atlas names; `side` for both
 * sides; a missing face is not drawn).
 */
function box(out, x, y0, z, w, h, d, f, yaw = 0) {
  const put = (g) => { if (yaw) g.rotateY(yaw); g.translate(x, y0, z); out.push(g); }; // D119: yaw — turned about its centre
  if (f.top) { const g = quad(f.top, w, d); g.rotateX(-Math.PI / 2); g.translate(0, h, 0); put(g); }
  if (f.front) { const g = quad(f.front, w, h); g.translate(0, h / 2, d / 2); put(g); }
  if (f.back) { const g = quad(f.back, w, h); g.rotateY(Math.PI); g.translate(0, h / 2, -d / 2); put(g); }
  const left = f.left || f.side, right = f.right || f.side;
  if (left) { const g = quad(left, d, h); g.rotateY(-Math.PI / 2); g.translate(-w / 2, h / 2, 0); put(g); }
  if (right) { const g = quad(right, d, h); g.rotateY(Math.PI / 2); g.translate(w / 2, h / 2, 0); put(g); }
}

/**
 * The faces of one workstation W × D in its own frame (its front — the user's side — towards +z). D119 (user: a little
 * chaos — the desk after a working day): `rnd` (seeded per desk, −0.5…0.5) sets the monitor a bit turned, the keyboard
 * pushed aside and askew, the mouse wherever it was left, the phone turned; the tower barely moves.
 */
function workstationFaces(W, D, out, rnd = () => 0) {
  const s = Math.sqrt((W / 60) * (D / 30)), Hd = 1.28 * 30 * A.surf * s, Hb = Hd - SLAB; // the desk top's height
  // the desk: its sides below the top (pictures with their legs / pedestal), the top slab
  box(out, 0, 0, 0, W, Hb, D, { front: 'desk_front', back: 'desk_back', left: 'desk_left', right: 'desk_right' });
  box(out, 0, Hb, 0, W + 0.6, SLAB, D + 0.6, { top: 'wood', front: 'wood', back: 'wood', side: 'wood' });
  const y = Hd, mx = -W * 0.05 + rnd() * 2.5, mz = -D * 0.2 + rnd() * 1;
  // the monitor (turned a little towards where its user sat): the foot, the neck, the panel
  const my = rnd() * 0.35, c = Math.cos(my), sn = Math.sin(my);
  const at = (dz) => [mx + sn * dz, mz + c * dz]; // a point dz in front of the stand, along the monitor's own axis
  { const [x, z] = at(0.4); box(out, x, y, z, 0.23 * K, 0.4, 0.15 * K, { top: 'monitor_foot', front: 'stand_abs', back: 'stand_abs', side: 'stand_abs' }, my); }
  { const [x, z] = at(-0.4); box(out, x, y + 0.4, z, 0.045 * K, 0.17 * K, 0.025 * K, { front: 'stand_abs', back: 'stand_abs', side: 'stand_abs' }, my); }
  { const [x, z] = at(-0.1); box(out, x, y + 0.13 * K, z, 0.52 * K, 0.318 * K, 0.038 * K, { front: 'monitor_front', back: 'monitor_back', top: 'monitor_abs', side: 'monitor_abs' }, my); }
  // the keyboard pushed aside and askew, the mouse left wherever, the phone turned, the tower at the right back
  const kx = mx + rnd() * 5, kz = D * 0.17 + rnd() * 2.5;
  box(out, kx, y, kz, 0.445 * K, 0.024 * K, 0.171 * K, { top: 'keyboard_top', front: 'keyboard_abs', back: 'keyboard_abs', side: 'keyboard_abs' }, rnd() * 0.5);
  box(out, kx + 0.34 * K + rnd() * 4, y, D * 0.19 + rnd() * 4, 0.065 * K, 0.038 * K, 0.122 * K, { top: 'mouse_top', front: 'mouse_abs', back: 'mouse_abs', side: 'mouse_abs' }, rnd() * 1.4);
  box(out, -W / 2 + 0.16 * K + rnd() * 2, y, D * 0.06 + rnd() * 2, 0.205 * K, 0.049 * K, 0.185 * K, { top: 'phone_top', front: 'phone_abs', back: 'phone_abs', side: 'phone_abs' }, rnd() * 0.9);
  box(out, W / 2 - 0.15 * K + rnd() * 0.8, y, -D * 0.12 + rnd() * 1, 0.195 * K, 0.43 * K, 0.42 * K, { top: 'tower_top', front: 'tower_front', back: 'tower_back', side: 'tower_side' }, rnd() * 0.12);
}

/** D119: a small seeded random for one desk (−0.5 … 0.5), the same every load. */
function deskRandom(p) {
  let h = (Math.imul(Math.round(p.x * 17) ^ Math.imul(Math.round(p.y * 11), 0x9e3779b1), 0x85ebca6b) >>> 0) || 7;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296 - 0.5; };
}

/** Every workstation of a level (data/propModels.js custom: 'workstation') → [mesh] ([] when none). */
export function buildWorkstations(props, shadows, lights = null) {
  const parts = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const p of props) {
    const m = PROP_MODELS[p.type];
    if (!m || m.custom !== 'workstation' || p.drawn === false) continue;
    const t = PROP_TYPES[p.type], own = [];
    workstationFaces(t.w, Math.max(1, t.d), own, deskRandom(p));
    m4.compose(pos.set(p.x, p.elev || 0, p.y), q.setFromAxisAngle(up, -(((p.rot | 0) & 3) * Math.PI) / 2 - (p.yaw || 0)), one);
    for (const g of own) parts.push(g.applyMatrix4(m4));
  }
  if (!parts.length) return [];
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), C = new Float32Array(n * 3);
  const LT = [0, 0, 0];
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count, gp = g.attributes.position.array;
    P.set(gp, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < c; i++) { // the baked lights (as the atlas props: 1 + 0.9 × the light there, ≤ 1.9)
      let r = 1, gg = 1, b = 1;
      if (lights) { lightAt(lights, gp[i * 3], gp[i * 3 + 2], LT); r += LT[0] * 0.9; gg += LT[1] * 0.9; b += LT[2] * 0.9; }
      C[(o + i) * 3] = Math.min(1.9, r); C[(o + i) * 3 + 1] = Math.min(1.9, gg); C[(o + i) * 3 + 2] = Math.min(1.9, b);
    }
    o += c;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, sharedMaterial());
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.matrixAutoUpdate = false;
  return [mesh];
}

/** Resolves when the workstation atlas has loaded (or failed — a missing file must not block the game). */
export function preloadWorkstation() {
  return new Promise((res) => {
    const t = sharedMaterial().map;
    if (t.image) { res(); return; }
    const img = new Image();
    img.onload = img.onerror = () => res();
    img.src = A.file;
  });
}
