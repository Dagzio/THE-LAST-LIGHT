// D121 (user: new textures for the security console — NEW/Office/office new sprites/CONSOLE): the console built as the
// catalogue assembles it (data/consoleAtlas.js, tools/build-console.py): the desk top extruded from its own outline (the
// operator's curved cut-out) with the stone top on it, two drawer pedestals, the modesty panel, the PC under the desk,
// six monitors on three stands (2 × 3, the side pairs turned in, three CCTV pictures), the keyboard, the mouse, the
// phone and the PTZ controller — every part a low-poly box whose faces carry their own projections.
// The catalogue's frame (metres; x right, y rear, z up; the operator at −y) → the prop's frame (front = +z): the desk
// parts fill the prop's footprint (x, depth scaled to it), the equipment keeps its own proportions (one scale) and
// stands on the desk top. Every console of a level is ONE mesh (the baked lights as vertex colours). Presentation only.
import * as THREE from '../../lib/three.module.js';
import { PROP_TYPES } from '../data/props.js';
import { PROP_MODELS } from '../data/propModels.js';
import { CONSOLE_ATLAS as C } from '../data/consoleAtlas.js';
import { lightAt } from './officeLights.js';

const DESK_PARTS = new Set(['desktop', 'drawer_pedestal', 'modesty_panel', 'pc_tower']);
const TOP_Z = 0.76; // m: the desk top's height in the catalogue
let material = null;

function sharedMaterial() {
  if (!material) {
    const t = new THREE.TextureLoader().load(C.file);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    material = new THREE.MeshLambertMaterial({ map: t, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  }
  return material;
}

/** A quad w × h facing +z showing the region `id` (a tile or a sample). */
function quad(id, w, h) {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const [u0, v0, u1, v1] = C.uv[id] || C.uv.stone;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  return g;
}

/** A box w × h × d (its bottom centre at the origin) with the faces { top, bottom, front (+z), back, left, right }. */
function box(w, h, d, f) {
  const out = [];
  const add = (g) => out.push(g);
  if (f.top) { const g = quad(f.top, w, d); g.rotateX(-Math.PI / 2); g.translate(0, h, 0); add(g); }
  if (f.bottom) { const g = quad(f.bottom, w, d); g.rotateX(Math.PI / 2); add(g); }
  if (f.front) { const g = quad(f.front, w, h); g.translate(0, h / 2, d / 2); add(g); }
  if (f.back) { const g = quad(f.back, w, h); g.rotateY(Math.PI); g.translate(0, h / 2, -d / 2); add(g); }
  if (f.left) { const g = quad(f.left, d, h); g.rotateY(-Math.PI / 2); g.translate(-w / 2, h / 2, 0); add(g); }
  if (f.right) { const g = quad(f.right, d, h); g.rotateY(Math.PI / 2); g.translate(w / 2, h / 2, 0); add(g); }
  return out;
}

/** The desk top: extruded from its outline (its own cut-out), the stone picture on top, the stone edge round it. */
function deskTop(W, D, thick, y0) {
  const O = C.outline, pts = [...O.rear, ...[...O.front].reverse()];
  const shape = new THREE.Shape(pts.map(([fx, fy]) => new THREE.Vector2((fx - 0.5) * W, -(fy - 0.5) * D)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 1 }); // (non-indexed already)
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const [t0, tv0, t1, tv1] = C.uv.desk_top, [s0, sv0, s1, sv1] = C.uv.stone;
  for (let i = 0; i < p.count; i++) {
    const fx = p.getX(i) / W + 0.5, fy = p.getZ(i) / D + 0.5; // fy: 0 rear … 1 front
    if (n.getY(i) > 0.5) uv.setXY(i, t0 + (t1 - t0) * fx, tv1 - (tv1 - tv0) * fy);
    else uv.setXY(i, s0 + (s1 - s0) * fx, sv0 + (sv1 - sv0) * ((p.getY(i) - y0) / thick));
  }
  delete g.attributes.uv2;
  return [g];
}

/** The faces of one console W × D (the prop's footprint) in its own frame. */
function consoleFaces(W, D, out) {
  const desk = C.parts.desktop.size;
  const sx = W / desk[0], sz = D / desk[1], sy = sz, sd = (sx + sz) / 2; // desk / equipment scales (units per metre)
  const deskTopY = TOP_Z * sy;
  const yOf = (z) => (z <= TOP_Z + 1e-3 ? z * sy : deskTopY + (z - TOP_Z) * sd);
  for (const inst of C.assembly) {
    const part = C.parts[inst.part];
    let [w, d, h] = part.size;
    const deskPart = DESK_PARTS.has(inst.part);
    const kw = deskPart ? sx : sd, kd = deskPart ? sz : sd, kh = deskPart ? sy : sd;
    let [cx, cy, cz] = inst.at;
    // (the stand's pole up to the upper monitor's middle — in the catalogue it stood out above the pair)
    if (inst.part === 'monitor_stand_pole') { const z0 = cz - h / 2, z1 = 1.36; h = z1 - z0; cz = (z0 + z1) / 2; }
    const gx = cx * sx, gz = -cy * sz, gyBottom = deskPart ? (cz - h / 2) * sy : yOf(cz) - (h * kh) / 2;
    let geos;
    if (inst.part === 'desktop') geos = deskTop(W, D, h * sy, gyBottom);
    else {
      const faces = { ...part.faces };
      if (inst.front) faces.front = inst.front;
      geos = box(w * kw, h * kh, d * kd, faces);
    }
    const yaw = ((inst.yaw || 0) * Math.PI) / 180;
    for (const g of geos) {
      if (inst.part !== 'desktop') { if (yaw) g.rotateY(yaw); g.translate(gx, gyBottom, gz); }
      out.push(g);
    }
  }
}

/** Every security console of a level (data/propModels.js custom: 'securityConsole') → [mesh] ([] when none). */
export function buildConsoles(props, shadows, lights = null) {
  const parts = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const p of props) {
    const m = PROP_MODELS[p.type];
    if (!m || m.custom !== 'securityConsole' || p.drawn === false) continue;
    const t = PROP_TYPES[p.type], own = [];
    consoleFaces(t.w, t.d, own);
    m4.compose(pos.set(p.x, p.elev || 0, p.y), q.setFromAxisAngle(up, -(((p.rot | 0) & 3) * Math.PI) / 2 - (p.yaw || 0)), one);
    for (const g of own) parts.push(g.applyMatrix4(m4));
  }
  if (!parts.length) return [];
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), CL = new Float32Array(n * 3);
  const LT = [0, 0, 0];
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count, gp = g.attributes.position.array;
    P.set(gp, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < c; i++) {
      let r = 1, gg = 1, b = 1;
      if (lights) { lightAt(lights, gp[i * 3], gp[i * 3 + 2], LT); r += LT[0] * 0.9; gg += LT[1] * 0.9; b += LT[2] * 0.9; }
      CL[(o + i) * 3] = Math.min(1.9, r); CL[(o + i) * 3 + 1] = Math.min(1.9, gg); CL[(o + i) * 3 + 2] = Math.min(1.9, b);
    }
    o += c;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(CL, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, sharedMaterial());
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.matrixAutoUpdate = false;
  return [mesh];
}
