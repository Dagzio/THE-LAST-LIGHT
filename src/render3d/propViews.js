// D85: the office furniture as "view boxes" built from the user's 5-view sheets (data/propModels.js, atlas
// data/propViews.js). A box per prop: footprint from data/props.js, height from the front view's proportions; the top
// view lies on top, front / back / left / right stand on the sides — cut out by their transparency (alpha test), so
// legs, gaps and silhouettes read from any side and the props can face any way. All of a level's boxes are ONE mesh
// (one draw call) with a lit material (the scene's light + the baked lights as vertex colours) that casts the
// silhouette shadows. Presentation only.
import * as THREE from '../../lib/three.module.js';
import { PROP_VIEW_ATLAS } from '../data/propViews.js';
import { PROP_MODELS } from '../data/propModels.js';
import { PROP_TYPES } from '../data/props.js';
import { lightAt } from './officeLights.js';

const VIEW_AMBIENT = 1.0;  // vertex colour without a light nearby (the scene's own lights do the rest)…
const VIEW_GAIN = 0.9;     // …plus the baked lights around (lamps, screens)
const VIEW_MAX = 1.9;
const LT = [0, 0, 0];

let texture = null;
/** The view atlas texture (loaded once). */
export function propViewTexture(aniso = 4) {
  if (!texture) {
    texture = new THREE.TextureLoader().load(PROP_VIEW_ATLAS.file);
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  if (texture.anisotropy !== aniso) { texture.anisotropy = aniso; if (texture.image) texture.needsUpdate = true; }
  return texture;
}

/** Resolves when the atlas has loaded (or failed — a missing file must not block the game). */
export function preloadPropViews() {
  return new Promise((res) => {
    texture = new THREE.TextureLoader().load(PROP_VIEW_ATLAS.file, () => res(), undefined, () => res());
    texture.colorSpace = THREE.SRGBColorSpace;
  });
}

/** The catalogue object a prop shows (a list → one per prop, stable by its position), or null. */
function viewOf(p) {
  const m = PROP_MODELS[p.type];
  if (!m) return null;
  let id = m.view;
  if (Array.isArray(id)) id = id[(Math.abs(Math.round(p.x * 7 + p.y * 13)) >>> 0) % id.length];
  const item = PROP_VIEW_ATLAS.items[id];
  return item ? { m, item } : null;
}

/** True when the prop is drawn as a view box (its old sprite / 3D build is not used). */
export const hasView = (p) => p.drawn !== false && !!viewOf(p);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

/** One textured quad (w × h, facing +z, centre at the origin) with the atlas rect's uv. */
function quad(rect, w, h) {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const W = PROP_VIEW_ATLAS.width, H = PROP_VIEW_ATLAS.height;
  const [rx, ry, rw, rh] = rect;
  const u0 = (rx + 0.5) / W, u1 = (rx + rw - 0.5) / W, v0 = 1 - (ry + rh - 0.5) / H, v1 = 1 - (ry + 0.5) / H;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  return g;
}

/** The faces of one prop (world space). */
function propFaces(p, out) {
  const v = viewOf(p);
  if (!v) return;
  const { m, item } = v, t = PROP_TYPES[p.type];
  const rot = (p.rot | 0) & 3;
  const base = _m.compose(_p.set(p.x, p.elev || 0, p.y), _q.setFromAxisAngle(UP, -(rot * Math.PI) / 2), _s);
  const W = t.w, D = Math.max(1, t.d);
  const front = item.front || item.back;
  if (m.wall) {
    // on the wall: the front picture, its own proportions, standing just off the wall face
    const h = (W * front[3]) / front[2];
    const g = quad(front, W, h);
    g.translate(0, m.at || 40, 0.6);
    out.push(g.applyMatrix4(base));
    return;
  }
  const Hv = front ? (W * front[3]) / front[2] : t.h;
  const faces = [];
  if (item.top) { const g = quad(item.top, W, D); g.rotateX(-Math.PI / 2); g.translate(0, Hv * (m.top ?? 1), 0); faces.push(g); }
  if (item.front) { const g = quad(item.front, W, Hv); g.translate(0, Hv / 2, D / 2); faces.push(g); }
  if (item.back) { const g = quad(item.back, W, Hv); g.rotateY(Math.PI); g.translate(0, Hv / 2, -D / 2); faces.push(g); }
  if (item.left) { const g = quad(item.left, D, Hv); g.rotateY(-Math.PI / 2); g.translate(-W / 2, Hv / 2, 0); faces.push(g); }
  if (item.right) { const g = quad(item.right, D, Hv); g.rotateY(Math.PI / 2); g.translate(W / 2, Hv / 2, 0); faces.push(g); }
  for (const g of faces) out.push(g.applyMatrix4(base));
}

/**
 * One geometry with the view boxes of every prop of a level that has views (position / normal / uv / colour), or null.
 * @param {object} level  @param {Array} props (the level's + render-only ones)  @param {Array|null} lights baked lights
 */
export function buildPropViews(props, lights = null) {
  const parts = [];
  for (const p of props) if (p.drawn !== false) propFaces(p, parts);
  if (!parts.length) return null;
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count, P = g.attributes.position.array;
    pos.set(P, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < c; i++) {
      let r = VIEW_AMBIENT, gg = VIEW_AMBIENT, b = VIEW_AMBIENT;
      if (lights) { lightAt(lights, P[i * 3], P[i * 3 + 2], LT); r += LT[0] * VIEW_GAIN; gg += LT[1] * VIEW_GAIN; b += LT[2] * VIEW_GAIN; }
      col[(o + i) * 3] = Math.min(VIEW_MAX, r); col[(o + i) * 3 + 1] = Math.min(VIEW_MAX, gg); col[(o + i) * 3 + 2] = Math.min(VIEW_MAX, b);
    }
    o += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
