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
function box(out, x, y0, z, w, h, d, f) {
  const put = (g) => { g.translate(x, y0, z); out.push(g); };
  if (f.top) { const g = quad(f.top, w, d); g.rotateX(-Math.PI / 2); g.translate(0, h, 0); put(g); }
  if (f.front) { const g = quad(f.front, w, h); g.translate(0, h / 2, d / 2); put(g); }
  if (f.back) { const g = quad(f.back, w, h); g.rotateY(Math.PI); g.translate(0, h / 2, -d / 2); put(g); }
  const left = f.left || f.side, right = f.right || f.side;
  if (left) { const g = quad(left, d, h); g.rotateY(-Math.PI / 2); g.translate(-w / 2, h / 2, 0); put(g); }
  if (right) { const g = quad(right, d, h); g.rotateY(Math.PI / 2); g.translate(w / 2, h / 2, 0); put(g); }
}

/** The faces of one workstation W × D in its own frame (its front — the user's side — towards +z). */
function workstationFaces(W, D, out) {
  const s = Math.sqrt((W / 60) * (D / 30)), Hd = 1.28 * 30 * A.surf * s, Hb = Hd - SLAB; // the desk top's height
  // the desk: its sides below the top (pictures with their legs / pedestal), the top slab
  box(out, 0, 0, 0, W, Hb, D, { front: 'desk_front', back: 'desk_back', left: 'desk_left', right: 'desk_right' });
  box(out, 0, Hb, 0, W + 0.6, SLAB, D + 0.6, { top: 'wood', front: 'wood', back: 'wood', side: 'wood' });
  const y = Hd, mx = -W * 0.05, mz = -D * 0.2;
  // the monitor: the foot, the neck, the panel (screen to the front, its back panel behind)
  box(out, mx, y, mz + 0.4, 0.23 * K, 0.4, 0.15 * K, { top: 'monitor_foot', front: 'stand_abs', back: 'stand_abs', side: 'stand_abs' });
  box(out, mx, y + 0.4, mz - 0.4, 0.045 * K, 0.17 * K, 0.025 * K, { front: 'stand_abs', back: 'stand_abs', side: 'stand_abs' });
  box(out, mx, y + 0.13 * K, mz - 0.1, 0.52 * K, 0.318 * K, 0.038 * K, { front: 'monitor_front', back: 'monitor_back', top: 'monitor_abs', side: 'monitor_abs' });
  // the keyboard and the mouse in front of it, the phone at the left, the tower at the right back
  box(out, mx, y, D * 0.17, 0.445 * K, 0.024 * K, 0.171 * K, { top: 'keyboard_top', front: 'keyboard_abs', back: 'keyboard_abs', side: 'keyboard_abs' });
  box(out, mx + 0.34 * K, y, D * 0.19, 0.065 * K, 0.038 * K, 0.122 * K, { top: 'mouse_top', front: 'mouse_abs', back: 'mouse_abs', side: 'mouse_abs' });
  box(out, -W / 2 + 0.16 * K, y, D * 0.06, 0.205 * K, 0.049 * K, 0.185 * K, { top: 'phone_top', front: 'phone_abs', back: 'phone_abs', side: 'phone_abs' });
  box(out, W / 2 - 0.15 * K, y, -D * 0.12, 0.195 * K, 0.43 * K, 0.42 * K, { top: 'tower_top', front: 'tower_front', back: 'tower_back', side: 'tower_side' });
}

/** Every workstation of a level (data/propModels.js custom: 'workstation') → [mesh] ([] when none). */
export function buildWorkstations(props, shadows, lights = null) {
  const parts = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const p of props) {
    const m = PROP_MODELS[p.type];
    if (!m || m.custom !== 'workstation' || p.drawn === false) continue;
    const t = PROP_TYPES[p.type], own = [];
    workstationFaces(t.w, Math.max(1, t.d), own);
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
