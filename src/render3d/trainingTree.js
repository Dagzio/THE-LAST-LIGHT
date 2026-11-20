// D120 → D122 (user: the training ground's tree — the new textures in NEW/tutorial/new sprites/TREE; the crown "worked out
// carefully, real-looking from every side"; the user's crown model TREE.glb is too heavy as it is): the tree as a real
// low-poly model —
//   - the crown: the user's crown model, its foliage thinned offline (tools/build-tree-crown.mjs → tree_crown.bin:
//     ~1 600 of its 11 073 leaves, each as one quad, picked evenly through the crown and grown to keep it as dense), every leaf with the
//     leaf picture of the user's tree atlas and its own tint; foliage lighting (each leaf lit by where it is in the crown
//     — no black backs) — real leaves in 3D from every side, no projected pictures;
//   - the trunk: a tapered cylinder with the atlas bark wrapped round it, a root flare, five limbs up into the crown.
// All the crowns are ONE instanced mesh (the same model, each tree turned and sized a little differently — seeded by its
// spot), all the trunks one mesh. Presentation only — the collision stays in data/props.js.
import * as THREE from '../../lib/three.module.js';
import { TREE_ATLAS as T } from '../data/treeAtlas.js';
import { PROP_MODELS } from '../data/propModels.js';

const HEIGHT = 150;            // units: the tree's height (as before)
const CROWN_FILE = 'assets/models/props/tree_crown.bin';
const CROWN_Y = 1.49;          // m: the crown model's origin above the ground (its leaves start at the trunk's top, 1.79 m)
const BARK_LIGHT = 1.9;        // vertex colour of the bark (the tile is dark, the crown shades it)
const LEAF_LIGHT = 1.22;       // …and of the leaves (× their own tint)
const LEAF_WARM = [2.6, 1.15, 0.75]; // D123: the leaves' tone (r, g, b ×) — the yellow-green of the ground's grass
let crownGeo = null, crownLoad = null, barkMat = null, leafMat = null;

function texture() {
  const t = new THREE.TextureLoader().load(T.file);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function materials() {
  if (!barkMat) {
    const t = texture();
    barkMat = new THREE.MeshLambertMaterial({ map: t, vertexColors: true });
    leafMat = new THREE.MeshLambertMaterial({ map: t, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
    // foliage: both sides of a leaf lit alike (the normal is the leaf's place in the crown, never flipped for its back)
    leafMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );'); };
  }
  return { barkMat, leafMat };
}

/** Loads the crown (once; a missing file leaves the trees with their trunks only). */
export function preloadTreeCrown() {
  if (!crownLoad) {
    crownLoad = fetch(CROWN_FILE).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { if (b) crownGeo = crownGeometry(b); }).catch(() => null);
  }
  return crownLoad;
}

/** tree_crown.bin → a geometry (metres): the leaves on the atlas' leaf tile, tinted, with foliage normals. */
function crownGeometry(buf) {
  const dv = new DataView(buf), n = dv.getUint32(0, true);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), CL = new Float32Array(n * 3);
  const [u0, v0, u1, v1] = T.tiles.leaf_upper.uv;
  let o = 4;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < 3; d++) P[i * 3 + d] = dv.getFloat32(o + d * 4, true);
    for (let d = 0; d < 3; d++) N[i * 3 + d] = dv.getFloat32(o + 12 + d * 4, true);
    const gu = dv.getFloat32(o + 24, true), gv = dv.getFloat32(o + 28, true);
    UV[i * 2] = u0 + (u1 - u0) * gu; UV[i * 2 + 1] = v1 - (v1 - v0) * gv; // (glTF uv: v down)
    for (let d = 0; d < 3; d++) CL[i * 3 + d] = (dv.getUint8(o + 32 + d) / 255) * LEAF_LIGHT;
    cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2];
    o += 36;
  }
  cx /= n; cy /= n; cz /= n;
  // light and colour by the leaf's place (the reference: sunlit yellow-green tips, a shaded inside): higher and further
  // out → lighter and warmer; low and inner → darker
  let ymin = Infinity, ymax = -Infinity, rmax = 0;
  for (let i = 0; i < n; i++) { ymin = Math.min(ymin, P[i * 3 + 1]); ymax = Math.max(ymax, P[i * 3 + 1]); rmax = Math.max(rmax, Math.hypot(P[i * 3] - cx, P[i * 3 + 2] - cz)); }
  for (let i = 0; i < n; i++) {
    const h = (P[i * 3 + 1] - ymin) / (ymax - ymin || 1), out = Math.min(1, Math.hypot(P[i * 3] - cx, P[i * 3 + 2] - cz) / (rmax || 1));
    // D123 (user: more yellow, a tone of sunlight, like the grass and the bushes): the whole crown warmed to their
    // yellow-green, the sunlit top and rim warmer still
    const k = 0.62 + 0.55 * h + 0.3 * out, warm = Math.max(0, h * 0.8 + out * 0.6 - 0.45);
    CL[i * 3] *= k * LEAF_WARM[0] * (1 + warm * 0.9); CL[i * 3 + 1] *= k * LEAF_WARM[1] * (1 + warm * 0.28); CL[i * 3 + 2] *= k * LEAF_WARM[2] * (1 - warm * 0.35);
  }
  // foliage normals: the leaf's own, bent towards where it sits in the crown (out and up) — the crown lit as a volume
  for (let i = 0; i < n; i++) {
    const rx = P[i * 3] - cx, ry = (P[i * 3 + 1] - cy) * 0.8, rz = P[i * 3 + 2] - cz, rl = Math.hypot(rx, ry, rz) || 1;
    const nx = N[i * 3] * 0.25 + (rx / rl) * 0.6, ny = Math.abs(N[i * 3 + 1]) * 0.25 + (ry / rl) * 0.6 + 0.55, nz = N[i * 3 + 2] * 0.25 + (rz / rl) * 0.6;
    const l = Math.hypot(nx, ny, nz) || 1;
    N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setAttribute('color', new THREE.BufferAttribute(CL, 3));
  g.translate(0, CROWN_Y, 0);
  g.computeBoundingSphere();
  return g;
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
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(BARK_LIGHT), 3));
  out.push(g);
}

/** The trunk of one tree (its foot at the origin; game frame, units), `s` units per metre. */
function trunkFaces(s, rnd, out) {
  const V = (x, y, z) => new THREE.Vector3(x * s, y * s, z * s); // (glTF / game frame: y up)
  limb(V(0, -0.05, 0), V(0, 0.5, 0), 0.36 * s, 0.19 * s, out, 10);   // the root flare
  limb(V(0, 0.45, 0), V(0.05, 2.9, 0.05), 0.19 * s, 0.1 * s, out);    // the trunk, into the crown
  for (let k = 0; k < 5; k++) {                                      // five limbs spreading up into the crown
    const a = (k / 5) * Math.PI * 2 + rnd() * 0.7, y0 = 2.0 + k * 0.22;
    limb(V(0.03, y0, 0.03), V(Math.cos(a) * 1.5, y0 + 1.1 + rnd() * 0.4, Math.sin(a) * 1.4), 0.075 * s, 0.03 * s, out, 6);
  }
}

/** A small seeded random for one tree (−0.5 … 0.5), the same every load. */
function treeRandom(p) {
  let h = (Math.imul(Math.round(p.x * 19) ^ Math.imul(Math.round(p.y * 7), 0x9e3779b1), 0x85ebca6b) >>> 0) || 3;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296 - 0.5; };
}

/** Every tree of a level (data/propModels.js custom: 'tree') → [trunks mesh, crowns instanced mesh] ([] when none). */
export function buildTrees(props, shadows) {
  const trees = props.filter((p) => { const m = PROP_MODELS[p.type]; return m && m.custom === 'tree' && p.drawn !== false; });
  if (!trees.length) return [];
  const { barkMat: bm, leafMat: lm } = materials();
  const parts = [], places = [];
  for (const p of trees) {
    const rnd = treeRandom(p), own = [];
    const s = (HEIGHT / T.size[2]) * (p.scale || 1) * (0.92 + 0.16 * (rnd() + 0.5));
    const yaw = (rnd() + 0.5) * Math.PI * 2;
    trunkFaces(s, rnd, own);
    for (const g of own) { g.rotateY(yaw); g.translate(p.x, p.elev || 0, p.y); parts.push(g); }
    places.push({ p, s, yaw });
  }
  const out = [];
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), CL = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2); CL.set(g.attributes.color.array, o * 3);
    o += c; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(CL, 3));
  geo.computeBoundingSphere();
  const trunks = new THREE.Mesh(geo, bm);
  trunks.castShadow = shadows; trunks.receiveShadow = shadows; trunks.matrixAutoUpdate = false;
  out.push(trunks);
  if (crownGeo) {
    const crowns = new THREE.InstancedMesh(crownGeo, lm, places.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pv = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    places.forEach(({ p, s, yaw }, i) => crowns.setMatrixAt(i, M.compose(Pv.set(p.x, p.elev || 0, p.y), Q.setFromAxisAngle(UP, yaw), S.set(s, s, s))));
    crowns.castShadow = shadows; crowns.receiveShadow = false;
    crowns.frustumCulled = false;
    crowns.userData.sharedGeometry = true; // (the crown model is kept for the next level)
    out.push(crowns);
  }
  return out;
}
