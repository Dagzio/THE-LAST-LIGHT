// D120 / D121 (user: new textures for the training ground's trees — NEW/tutorial/new sprites/TREE; the first build showed
// crossing flat pictures and a too dark trunk — "the textures are made as planes to be stretched over a low-poly
// model's faces"): the tree built as a low-poly model with the atlas projected onto its faces (data/treeAtlas.js):
//   - the crown: ONE closed, lumpy volume (a deformed sphere filling the crown's measured bounds); each of its faces
//     takes the projection it faces — the top view for the faces looking up, the front / right / back / left views for
//     the sides (each mapped exactly as projected: the catalogue's pivots and sizes) — the leaves' alpha cuts its
//     outline, so the volume reads as foliage from any side, with no crossing planes;
//   - the trunk: a tapered cylinder with the bark wrapped round it (twice round, along its length), a root flare, three
//     limbs into the crown; brightened (vertex colour) — the bark tile is dark and the crown shades it.
// Every tree of a level is ONE mesh (alpha cut, double-sided, casting its leafy shadow); each tree is turned and sized a
// little differently (seeded by its spot). Presentation only — the collision stays in data/props.js.
import * as THREE from '../../lib/three.module.js';
import { TREE_ATLAS as T } from '../data/treeAtlas.js';
import { PROP_MODELS } from '../data/propModels.js';

const HEIGHT = 150;       // units: the tree's height (as the old model)
const BARK_LIGHT = 1.9;   // vertex colour of the trunk / limbs (the bark lit up)
let material = null;

function sharedMaterial() {
  if (!material) {
    const t = new THREE.TextureLoader().load(T.file);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    // (front faces only: the crown has its own inner shell, lit as the outside — a double-sided back face was lit
    // from behind and showed black through the gaps between the leaves)
    material = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.42, side: THREE.FrontSide, vertexColors: true });
  }
  return material;
}

// the crown's bounds in the tree's frame (metres; x right, y back, z up) — from the top view's and the side views' pivots
const TOP = T.tiles.crown_top, FR = T.tiles.crown_front, RI = T.tiles.crown_right;
const X0 = -TOP.pivot[0] * TOP.size[0], X1 = X0 + TOP.size[0];
const Y0 = -TOP.pivot[1] * TOP.size[1], Y1 = Y0 + TOP.size[1];
const Z0 = -FR.pivot[1] * FR.size[1], Z1 = Z0 + FR.size[1];

/** uv in the atlas of a tile at local (s, t) ∈ 0…1 (bottom-left origin). */
const at = (tile, s, t) => { const [u0, v0, u1, v1] = T.tiles[tile].uv; return [u0 + (u1 - u0) * s, v0 + (v1 - v0) * t]; };

/** The crown's projection of a point (tree frame, metres) seen along `view` → [u, v] in the atlas. */
function project(view, x, y, z) {
  const side = (tile, along) => { const c = T.tiles[tile]; return at(tile, c.pivot[0] + along / c.size[0], c.pivot[1] + z / c.size[1]); };
  switch (view) {
    case 'top': return at('crown_top', TOP.pivot[0] + x / TOP.size[0], TOP.pivot[1] + y / TOP.size[1]);
    case 'front': return side('crown_front', x);   // seen from −Y: u → +X
    case 'back': return side('crown_back', -x);    // seen from +Y: u → −X
    case 'right': return side('crown_right', y);   // seen from +X: u → +Y
    default: return side('crown_left', -y);        // seen from −X: u → −Y
  }
}

/** A small deterministic noise of a direction (the crown's lumps; the same at the same point — the mesh stays closed). */
function lump(nx, ny, nz, seed) {
  const f = (a, b, c) => Math.sin(a * 3.1 + seed) * Math.cos(b * 2.7 - seed * 0.7) + Math.sin(c * 3.7 + a * 1.3 + seed * 1.9);
  return f(nx, ny, nz) * 0.13 + Math.sin(nx * 7.3 + nz * 5.1 + seed) * 0.06 + Math.sin(ny * 9.1 - nx * 4.3 + seed * 2.3) * 0.04;
}

/**
 * D121: the crown — leaf clusters: flattened, lumpy caps at different heights (a big one on top, a ring round it lower
 * down) and a shaded underside. Every cap takes the TOP view by its position (one planar projection for all of them:
 * seen from the game camera they line up into the picture of the crown, and still have volume and depth); the caps
 * stop short of vertical (no stretched streaks); their normals tip upwards (lit as foliage); an inner face for each
 * (seen through the gaps between the leaves). Tree frame (metres) → game frame (units of `s`).
 */
function crownFaces(s, seed, rnd, out) {
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2, RX = (X1 - X0) / 2, RY = (Y1 - Y0) / 2;
  const pos = [], nor = [], uv = [], col = [];
  const cap = (px, py, pz, rx, ry, rz, light, open = 0.34) => {
    const g = new THREE.SphereGeometry(1, 13, 5, 0, Math.PI * 2, 0, Math.PI * open).toNonIndexed();
    const p = g.attributes.position, start = pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uz = p.getY(i), uy = -p.getZ(i);
      const k = 1 + lump(ux, uy, uz, seed + px * 3.1 + py * 1.7);
      const x = px + ux * rx * k, y = py + uy * ry * k, z = pz + uz * rz * k;
      pos.push(x * s, z * s, -y * s);
      const nx = ux / rx, ny = uy / ry, nz = uz / rz + 0.9 / rz, nl = Math.hypot(nx, ny, nz) || 1; // tipped up
      nor.push(nx / nl, nz / nl, -ny / nl);
      uv.push(...project('top', x, y, z));
      const lit = light * (0.86 + 0.14 * uz); // (a little darker towards the cap's rim)
      col.push(lit, lit, lit);
    }
    // the inner face (wound the other way, the same normals / pictures, shaded)
    const end = pos.length / 3;
    for (let v = start; v < end; v += 3) for (const k of [0, 2, 1]) {
      const i = v + k;
      pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); nor.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
      uv.push(uv[i * 2], uv[i * 2 + 1]); col.push(col[i * 3] * 0.72, col[i * 3 + 1] * 0.72, col[i * 3 + 2] * 0.72);
    }
    g.dispose();
  };
  // the shaded underside (a wide low dome turned over: seen from the side, under the clusters)
  const z0 = Z0 + (Z1 - Z0) * 0.32;
  cap(cx, cy, z0, RX * 0.78, RY * 0.78, (Z1 - Z0) * 0.28, 0.62, 0.5);
  // the ring of clusters round the crown, lower down, then the middle ones, the top one
  const n = 6;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + seed * 0.37 + rnd() * 0.4, d = 0.5 + rnd() * 0.12;
    cap(cx + Math.cos(a) * RX * d, cy + Math.sin(a) * RY * d, Z0 + (Z1 - Z0) * (0.42 + rnd() * 0.12), RX * (0.5 + rnd() * 0.1), RY * (0.5 + rnd() * 0.1), (Z1 - Z0) * 0.3, 1.0);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + seed + rnd() * 0.6;
    cap(cx + Math.cos(a) * RX * 0.22, cy + Math.sin(a) * RY * 0.22, Z0 + (Z1 - Z0) * (0.6 + rnd() * 0.08), RX * 0.55, RY * 0.55, (Z1 - Z0) * 0.3, 1.08);
  }
  cap(cx + rnd() * 0.3, cy + rnd() * 0.3, Z0 + (Z1 - Z0) * 0.72, RX * 0.5, RY * 0.5, (Z1 - Z0) * 0.3, 1.15);
  out.push(geometryOf(pos, nor, uv, col));
}
/** A tapered limb from A to B (game units), the bark wrapped round it. */
function limb(A, B, r0, r1, out, seg = 9) {
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 3, true).toNonIndexed();
  const [bu0, bv0, bu1, bv1] = T.tiles.bark_trunk.uv;
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const su = uv.getX(i), tv = Math.min(1, Math.max(0, (p.getY(i) + len / 2) / len)); // (the tile once round, along it)
    uv.setXY(i, bu0 + (bu1 - bu0) * (0.03 + 0.94 * su), bv0 + (bv1 - bv0) * (0.03 + 0.94 * tv));
  }
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(BARK_LIGHT);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.push(g);
}

/** The faces of one tree (its foot at the origin; game frame), `s` units per metre, `rnd` its seeded random. */
function treeFaces(s, rnd, seed, out) {
  const V = (x, y, z) => new THREE.Vector3(x * s, z * s, -y * s); // tree frame (metres) → game
  limb(V(0, 0, -0.05), V(0, 0, 0.5), 0.36 * s, 0.19 * s, out, 10);        // the root flare
  limb(V(0, 0, 0.45), V(0.05, 0.02, Z0 + 0.9), 0.19 * s, 0.11 * s, out);   // the trunk, into the crown
  for (let k = 0; k < 3; k++) {                                            // three limbs up into the crown
    const a = (k / 3) * Math.PI * 2 + rnd() * 0.8;
    limb(V(0.04, 0.02, Z0 + 0.4 + k * 0.25), V(Math.cos(a) * 1.3, Math.sin(a) * 1.1, Z0 + 1.6 + k * 0.3), 0.08 * s, 0.035 * s, out, 6);
  }
  crownFaces(s, seed, rnd, out);
}

function geometryOf(pos, nor, uv, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** A small seeded random for one tree (−0.5 … 0.5), the same every load. */
function treeRandom(p) {
  let h = (Math.imul(Math.round(p.x * 19) ^ Math.imul(Math.round(p.y * 7), 0x9e3779b1), 0x85ebca6b) >>> 0) || 3;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296 - 0.5; };
}

/** Every tree of a level (data/propModels.js custom: 'tree') → [mesh] ([] when none). */
export function buildTrees(props, shadows) {
  const parts = [];
  for (const p of props) {
    const m = PROP_MODELS[p.type];
    if (!m || m.custom !== 'tree' || p.drawn === false) continue;
    const rnd = treeRandom(p), own = [];
    const s = (HEIGHT / T.size[2]) * (p.scale || 1) * (0.92 + 0.16 * (rnd() + 0.5));
    treeFaces(s, rnd, (rnd() + 0.5) * 10, own);
    const yaw = (rnd() + 0.5) * Math.PI * 2;
    for (const g of own) { g.rotateY(yaw); g.translate(p.x, p.elev || 0, p.y); parts.push(g); }
  }
  if (!parts.length) return [];
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), C = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2);
    C.set(g.attributes.color.array, o * 3);
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
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  return [mesh];
}
