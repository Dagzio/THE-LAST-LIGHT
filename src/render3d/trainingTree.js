// D120 (user: new textures for the training ground's trees — NEW/tutorial/new sprites/TREE, "do all the work with them"):
// the tree built in code from its atlas (data/treeAtlas.js, tools/build-tree.py) instead of the baked picture of the old
// model (D99–D104):
//   - the trunk: a tapered cylinder in its bark (the fibres along it), a root flare at the foot;
//   - the branches: the four branch cards (twice each, round the trunk) set on their own planes (the catalogue gives
//     each card's axes) from attachment points on the trunk;
//   - the crown: the leaves seen from above in three layers (turned, a little offset — depth seen from the game camera)
//     and the four side projections as upright cards through the trunk (its silhouette from any side).
// Every tree of a level is ONE mesh (alpha cut, double-sided, casting its leafy shadow). Each tree is turned and sized a
// little differently (seeded by its spot). Presentation only — the collision stays in data/props.js.
import * as THREE from '../../lib/three.module.js';
import { TREE_ATLAS as T } from '../data/treeAtlas.js';
import { PROP_MODELS } from '../data/propModels.js';

const HEIGHT = 150;   // units: the tree's height (as the old model)
let material = null;

function sharedMaterial() {
  if (!material) {
    const t = new THREE.TextureLoader().load(T.file);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    material = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide });
  }
  return material;
}

/** A quad of a tile: local x along its u (width w), local y along its v (height h), pivot at the origin. */
function tileQuad(tile, w, h) {
  const [u0, v0, u1, v1] = T.tiles[tile].uv, [pu, pv] = T.tiles[tile].pivot || [0.5, 0.5];
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  g.translate(w * (0.5 - pu), h * (0.5 - pv), 0); // the tile's pivot at the origin
  return g;
}

/** The tree's frame (x right, y back, z up; metres) → the game's (x right, y up, z front; units of `s`). */
const toGame = (v, s) => new THREE.Vector3(v[0] * s, v[2] * s, -v[1] * s);

/** The faces of one tree (its foot at the origin), `s` units per metre, `rnd` its seeded random (−0.5 … 0.5). */
function treeFaces(s, rnd, out) {
  // the trunk (tapered, bark along it: u twice round, v every metre), the root flare
  const trunkH = 3.6, bark = T.tiles.bark_trunk.uv;
  const trunk = (r0, r1, y0, y1, seg) => {
    const g = new THREE.CylinderGeometry(r1 * s, r0 * s, (y1 - y0) * s, seg, 1, true).toNonIndexed();
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const vy = Math.min(1, (p.getY(i) / s + (y1 - y0) / 2 + y0) / trunkH); // (the tile once along the trunk, once round)
      uv.setXY(i, bark[0] + (bark[2] - bark[0]) * (0.02 + 0.96 * uv.getX(i)), bark[1] + (bark[3] - bark[1]) * (0.02 + 0.96 * vy));
    }
    g.translate(0, ((y0 + y1) / 2) * s, 0);
    out.push(g);
  };
  trunk(0.3, 0.17, 0, 0.45, 10);
  trunk(0.17, 0.09, 0.45, trunkH, 10);
  // the branches: each card on its own plane from an attachment point on the trunk; the set twice (turned 180°)
  const cards = ['branch_1', 'branch_2', 'branch_3', 'branch_4'];
  for (let k = 0; k < 8; k++) {
    const id = cards[k % 4], c = T.tiles[id];
    const g = tileQuad(id, c.size[0] * s, c.size[1] * s);
    const U = toGame(c.u, 1).normalize(), V = toGame(c.v, 1).normalize(), N = new THREE.Vector3().crossVectors(U, V).normalize();
    g.applyMatrix4(new THREE.Matrix4().makeBasis(U, V, N));
    g.rotateY(k >= 4 ? Math.PI + 0.35 : 0);
    g.translate(0, (2.1 + (k % 4) * 0.32 + (k >= 4 ? 0.18 : 0) + rnd() * 0.2) * s, 0);
    out.push(g);
  }
  // the crown: the leaves from above in three layers, the side projections as upright cards through the trunk
  const top = T.tiles.crown_top;
  // (the lower layers smaller — inside the side silhouette; the top one caps the crown above the side cards)
  for (const [y, k, a] of [[3.75, 0.66, 0], [4.8, 0.84, 2.1], [5.75, 1.0, 4.2]]) {
    const g = tileQuad('crown_top', top.size[0] * s * k, top.size[1] * s * k);
    g.rotateX(-Math.PI / 2);
    g.rotateY(a + rnd() * 0.4);
    g.translate(rnd() * 0.25 * s, y * s, rnd() * 0.25 * s);
    out.push(g);
  }
  for (const [id, ry] of [['crown_front', 0], ['crown_right', -Math.PI / 2], ['crown_back', Math.PI * 0.25], ['crown_left', -Math.PI * 0.75]]) {
    const c = T.tiles[id], k = id === 'crown_back' || id === 'crown_left' ? 0.86 : 1;
    const g = tileQuad(id, c.size[0] * s * k, c.size[1] * s * k * 0.9); // (its top under the crown's top layer)
    g.rotateY(ry);
    out.push(g);
  }
}

/** D120: a small seeded random for one tree (−0.5 … 0.5), the same every load. */
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
    treeFaces(s, rnd, own);
    const yaw = (rnd() + 0.5) * Math.PI * 2;
    for (const g of own) { g.rotateY(yaw); g.translate(p.x, p.elev || 0, p.y); parts.push(g); }
  }
  if (!parts.length) return [];
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2);
    o += c;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, sharedMaterial());
  mesh.castShadow = shadows;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  return [mesh];
}
