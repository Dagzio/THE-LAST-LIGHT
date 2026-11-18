// D85: the office furniture as "view boxes" built from the user's 5-view sheets (data/propModels.js, atlas
// data/propViews.js). A box per prop: footprint from data/props.js, height from the front view's proportions; the top
// view lies on top, front / back / left / right stand on the sides — cut out by their transparency (alpha test), so
// legs, gaps and silhouettes read from any side and the props can face any way. All of a level's boxes are ONE mesh
// (one draw call) with a lit material (the scene's light + the baked lights as vertex colours) that casts the
// silhouette shadows. Presentation only.
// D88: a second atlas — the training ground (data/trainingViews.js); a prop model names its atlas (`atlas`), each atlas
// is one mesh.
import * as THREE from '../../lib/three.module.js';
import { PROP_VIEW_ATLAS } from '../data/propViews.js';
import { TRAINING_VIEW_ATLAS } from '../data/trainingViews.js';
import { PROP_MODELS } from '../data/propModels.js';
import { PROP_TYPES } from '../data/props.js';
import { lightAt } from './officeLights.js';
import { CAMERA } from '../config/camera.js';
import { VIEW_OUTLINES } from '../data/viewOutlines.js';
import { hasModel } from './propModels3d.js';

// D90: foliage drawn as one picture turned to the camera (it never turns: no yaw) — leaning back by this angle
const SPRITE_LEAN = Math.PI / 2 - (CAMERA.tilt * Math.PI) / 180;

const VIEW_AMBIENT = 1.0;  // vertex colour without a light nearby (the scene's own lights do the rest)…
const VIEW_GAIN = 0.9;     // …plus the baked lights around (lamps, screens)
const VIEW_MAX = 1.9;
const LT = [0, 0, 0];

export const VIEW_ATLASES = { office: PROP_VIEW_ATLAS, training: TRAINING_VIEW_ATLAS };
const textures = {};

/** The view atlas texture (loaded once per atlas). */
export function propViewTexture(aniso = 4, atlas = 'office') {
  let texture = textures[atlas];
  if (!texture) {
    texture = textures[atlas] = new THREE.TextureLoader().load(VIEW_ATLASES[atlas].file);
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  if (texture.anisotropy !== aniso) { texture.anisotropy = aniso; if (texture.image) texture.needsUpdate = true; }
  return texture;
}

/** Resolves when the atlases have loaded (or failed — a missing file must not block the game). */
export function preloadPropViews() {
  return Promise.all(Object.keys(VIEW_ATLASES).map((k) => new Promise((res) => {
    const t = textures[k] = new THREE.TextureLoader().load(VIEW_ATLASES[k].file, () => res(), undefined, () => res());
    t.colorSpace = THREE.SRGBColorSpace;
  })));
}

/** The catalogue object a prop shows (a list → one per prop, stable by its position), or null. */
function viewOf(p) {
  const m = PROP_MODELS[p.type];
  if (!m) return null;
  let id = m.view;
  if (Array.isArray(id)) id = id[(Math.abs(Math.round(p.x * 7 + p.y * 13)) >>> 0) % id.length];
  const A = VIEW_ATLASES[m.atlas || 'office'];
  const item = A.items[id];
  return item ? { m, item, A, id, outline: (VIEW_OUTLINES[m.atlas || 'office'] || {})[id] || null } : null;
}

/** True when the prop is drawn as a view box (its old sprite / 3D build is not used). */
export const hasView = (p) => p.drawn !== false && !!viewOf(p);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

/** One textured quad (w × h, facing +z, centre at the origin) with the atlas rect's uv. */
function quad(rect, w, h, A) {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const W = A.width, H = A.height;
  const [rx, ry, rw, rh] = rect;
  const u0 = (rx + 0.5) / W, u1 = (rx + rw - 0.5) / W, v0 = 1 - (ry + rh - 0.5) / H, v1 = 1 - (ry + 0.5) / H;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  return g;
}

/**
 * D111: a quad showing only a horizontal band of a picture — from f0 to f1 of its height (parts from the bottom).
 */
function quadBand(rect, w, h, A, f0, f1, s0 = 0, s1 = 1) {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const [rx, ry, rw, rh] = rect;
  // D112: s0 … s1 — a part of the picture's width (a pot's columns)
  const u0 = (rx + 0.5 + (rw - 1) * s0) / A.width, u1 = (rx + 0.5 + (rw - 1) * s1) / A.width;
  const vAt = (f) => 1 - (ry + rh - 0.5 - (rh - 1) * f) / A.height;
  const v0 = vAt(f0), v1 = vAt(f1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  return g;
}

/**
 * D93: the walls along one outline loop ([x, z] parts of the footprint) — each wall shows the side picture it faces
 * (front / back / left / right by its outward normal), projected straight onto it (the picture's x / the depth → u).
 * D111: Hw — the walls' own height (up to the main surface); the pictures keep their mapping over the whole height H.
 */
function outlineWalls(loop, W, D, H, item, A, Hw = H, inset = 0, y0 = 0) {
  let area = 0;
  for (let i = 0; i < loop.length; i++) { const [x0, z0] = loop[i], [x1, z1] = loop[(i + 1) % loop.length]; area += x0 * z1 - x1 * z0; }
  const sgn = area >= 0 ? 1 : -1; // (x, z) loop turning: the outward normal side
  if (inset > 0) {
    // D111: the walls a little inside the outline (the simplified loop strayed past the top picture's edge at sharp
    // ends — a wall top showed beside the desk top); the top picture now always overhangs them a bit, like a desk's lip
    const P = loop.map(([x, z]) => [x * W, z * D]), n = P.length;
    const out = (i) => { const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % n], L = Math.hypot(x1 - x0, z1 - z0) || 1; return [((z1 - z0) / L) * sgn, (-(x1 - x0) / L) * sgn]; };
    loop = P.map(([x, z], i) => {
      const a = out((i - 1 + n) % n), b = out(i);
      let mx = a[0] + b[0], mz = a[1] + b[1];
      const L = Math.hypot(mx, mz) || 1;
      mx /= L; mz /= L;
      return [(x - mx * inset) / W, (z - mz * inset) / D];
    });
  }
  const pos = [], nor = [], uv = [];
  const uvOf = (view, x, z, y) => {
    const r = item[view] || item.front || item.back;
    const u = view === 'front' ? (x + W / 2) / W : view === 'back' ? (W / 2 - x) / W : view === 'left' ? (z + D / 2) / D : (D / 2 - z) / D;
    const [rx, ry, rw, rh] = r;
    return [(rx + 0.5 + Math.min(1, Math.max(0, u)) * (rw - 1)) / A.width, 1 - (ry + 0.5 + (1 - y / H) * (rh - 1)) / A.height];
  };
  for (let i = 0; i < loop.length; i++) {
    const x0 = loop[i][0] * W, z0 = loop[i][1] * D, x1 = loop[(i + 1) % loop.length][0] * W, z1 = loop[(i + 1) % loop.length][1] * D;
    const ex = x1 - x0, ez = z1 - z0, L = Math.hypot(ex, ez);
    if (L < 0.3) continue;
    const nx = (ez / L) * sgn, nz = (-ex / L) * sgn; // outward (the loop's area > 0: counter-clockwise in x / z)
    const view = Math.abs(nz) >= Math.abs(nx) ? (nz > 0 ? 'front' : 'back') : nx > 0 ? 'right' : 'left';
    const a = [x0, y0, z0], b = [x1, y0, z1], c = [x1, Hw, z1], d = [x0, Hw, z0];
    // outward-facing winding (seen from the normal's side: a → b → c counter-clockwise)
    const tri = sgn > 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d]; // ((b - a) × (c - a) ∝ (-ez, 0, ex): inward for sgn > 0)
    for (const p of tri) { pos.push(p[0], p[1], p[2]); nor.push(nx, 0, nz); uv.push(...uvOf(view, p[0], p[2], p[1])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** D112: the convex hull of a loop of [x, z] points (counter-clockwise; monotone chain). */
function hull(loop) {
  const p = [...loop].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * D112: a plant's crown — a closed "bulb" through rings of the top picture's outline: rings = [[y, scale, cx, cz], …]
 * (the outline scaled about cx / cz). Every vertex takes the side picture its band faces at its own x / z and height,
 * so the narrow bottom shows the stems in the pictures' middle and the widest ring the whole crown.
 */
function crownWalls(loop, W, D, H, item, A, rings) {
  let area = 0;
  for (let i = 0; i < loop.length; i++) { const [x0, z0] = loop[i], [x1, z1] = loop[(i + 1) % loop.length]; area += x0 * z1 - x1 * z0; }
  const sgn = area >= 0 ? 1 : -1, n = loop.length;
  const R = rings.map(([y, s, cx, cz]) => loop.map(([x, z]) => [cx + (x * W - cx) * s, y, cz + (z * D - cz) * s]));
  const uvOf = (view, p) => {
    const r = item[view] || item.front || item.back;
    const [x, y, z] = p;
    const u = view === 'front' ? (x + W / 2) / W : view === 'back' ? (W / 2 - x) / W : view === 'left' ? (z + D / 2) / D : (D / 2 - z) / D;
    const [rx, ry, rw, rh] = r;
    return [(rx + 0.5 + Math.min(1, Math.max(0, u)) * (rw - 1)) / A.width, 1 - (ry + 0.5 + (1 - Math.min(1, y / H)) * (rh - 1)) / A.height];
  };
  const pos = [], nor = [], uv = [];
  for (let k = 0; k + 1 < R.length; k++) {
    for (let i = 0; i < n; i++) {
      const a = R[k][i], b = R[k][(i + 1) % n], c = R[k + 1][(i + 1) % n], d = R[k + 1][i];
      const mx = ((a[0] + d[0]) - (b[0] + c[0])) / 2, mz = ((a[2] + d[2]) - (b[2] + c[2])) / 2, L = Math.hypot(mx, mz);
      if (L < 0.2) continue;
      const nx = (-mz / L) * sgn, nz = (mx / L) * sgn; // outward (as outlineWalls: the edge b − a turned)
      const view = Math.abs(nz) >= Math.abs(nx) ? (nz > 0 ? 'front' : 'back') : nx > 0 ? 'right' : 'left';
      const tri = sgn > 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
      for (const p of tri) { pos.push(p[0], p[1], p[2]); nor.push(nx, 0, nz); uv.push(...uvOf(view, p)); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** The faces of one prop (world space). */
function propFaces(p, out) {
  const v = viewOf(p);
  if (!v) return;
  const { m, item, A } = v, t = PROP_TYPES[p.type];
  const rot = (p.rot | 0) & 3;
  const base = _m.compose(_p.set(p.x, p.elev || 0, p.y), _q.setFromAxisAngle(UP, -(rot * Math.PI) / 2), _s);
  const W = p.w || m.drawW || t.w, D = m.drawD || Math.max(1, t.d); // (p.w: a fence piece cut to its wall)
  const front = item.front || item.back;
  // D111: the user's new office atlases (every view fits its bounding face; `surf` — the main surface height)
  const surf = m.surf ?? item.surf;
  if (surf !== undefined && !m.sprite && !m.flatTop) { lowPolyFaces(p, m, item, A, t, base, W, D, surf, v.outline, out); return; }
  if (m.wall) {
    // on the wall: the front picture, its own proportions, standing just off the wall face
    const h = (W * front[3]) / front[2];
    const g = quad(front, W, h, A);
    g.translate(0, m.at || 40, 0.6);
    out.push(g.applyMatrix4(base));
    return;
  }
  if (m.sprite) {
    // D90 (user: the trees were boxes with flat sides): trees / bushes / grass — the front picture as one quad standing
    // at the base, turned to the camera (a picture of the tree on screen, from any spot); its size from drawW / the
    // catalogue width, its height from the picture's proportions
    const pic = item.front || item.top, w = (m.drawW || t.w) * (m.sprite.scale || 1), h = (w * pic[3]) / pic[2];
    const g = quad(pic, w, h, A);
    g.translate(0, h / 2, 0);
    g.rotateX(-SPRITE_LEAN * (m.sprite.lean ?? 1));
    g.translate(p.x, p.elev || 0, p.y + (m.sprite.back || 0));
    out.push(g);
    return;
  }
  if (m.flatTop) { // D88: a mat on the ground — only its top picture, just above the floor
    const g = quad(item.top, W, D, A); g.rotateX(-Math.PI / 2); g.translate(0, 0.6, 0);
    out.push(g.applyMatrix4(base));
    return;
  }
  const Hv = front ? (W * front[3]) / front[2] : t.h;
  const faces = [];
  if (item.top) { const g = quad(item.top, W, D, A); g.rotateX(-Math.PI / 2); g.translate(0, Hv * (m.top ?? 1), 0); faces.push(g); }
  // D93 (user: boxes with gaps at the corners): the side walls follow the top picture's outline, the side pictures
  // projected onto them (a curved desk gets a curved front, a chair one body) — the box sides only without an outline
  if (v.outline && !m.box) {
    for (const loop of v.outline) faces.push(outlineWalls(loop, W, D, Hv, item, A));
    for (const g of faces) out.push(g.applyMatrix4(base));
    return;
  }
  if (item.front) { const g = quad(item.front, W, Hv, A); g.translate(0, Hv / 2, D / 2); faces.push(g); }
  if (item.back) { const g = quad(item.back, W, Hv, A); g.rotateY(Math.PI); g.translate(0, Hv / 2, -D / 2); faces.push(g); }
  if (item.left) { const g = quad(item.left, D, Hv, A); g.rotateY(-Math.PI / 2); g.translate(-W / 2, Hv / 2, 0); faces.push(g); }
  if (item.right) { const g = quad(item.right, D, Hv, A); g.rotateY(Math.PI / 2); g.translate(W / 2, Hv / 2, 0); faces.push(g); }
  for (const g of faces) out.push(g.applyMatrix4(base));
}

/**
 * D111 (user: the office objects redone as low-poly models with these pictures on their faces; no see-through gaps in
 * the objects): every view of the new atlases fits its bounding face, so
 *  - on a wall: a shallow box (its depth from data/props.js) — the front picture, the top / side pictures on its edges;
 *  - standing: the side walls (along the top picture's outline, or the box sides) rise only to the main surface `surf`
 *    with the lower part of the side pictures, the top picture lies ON that surface (a desk's top, not over the
 *    monitor), and what rises above it (monitors, a coffee machine, the plant in a planter) stands in the middle as a
 *    cross of the front and side pictures' upper parts.
 */
function lowPolyFaces(p, m, item, A, t, base, W, D, surf, outline, out) {
  const front = item.front || item.back;
  const faces = [];
  if (m.pack && !m.wall) {
    // D111: the new catalogue has ONE box / case — a stack of them fills the prop's footprint (nx × nz, ny layers),
    // each a little off (seeded by the position: a natural pile)
    const [nx, nz, ny] = m.pack, cw = W / nx, cd = D / nz;
    const cellH = heightOf(m, item, t, cw, cd);
    let seed = Math.abs(Math.round(p.x * 13 + p.y * 7)) || 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const cell = [];
      cellFaces(m, item, A, cw * 0.97, cd * 0.97, cellH, surf, outline, cell);
      const jx = k ? rnd() * cw * 0.08 : 0, jz = k ? rnd() * cd * 0.08 : 0, yaw = k ? rnd() * 0.12 : 0;
      for (const g of cell) {
        g.rotateY(yaw);
        g.translate((i + 0.5) * cw - W / 2 + jx, k * cellH, (j + 0.5) * cd - D / 2 + jz);
        faces.push(g);
      }
    }
    for (const g of faces) out.push(g.applyMatrix4(base));
    return;
  }
  if (m.pot && item.pot && !m.wall) {
    // D112 (user: the plants must have a solid pot joined by its texture, no crossing planes): the pot — a box of its
    // measured size (item.pot: height, x0…x1 of the width, z0…z1 of the depth), each side showing that side picture's
    // pot band (its own columns: the texture meets at the corners), the soil on top; the crown — walls along the top
    // picture's outline from the pot's rim up (the leaves band of the pictures), the rosette seen from above on top
    const H = heightOf(m, item, t, W, D), [ph, x0, x1, z0, z1] = item.pot, Hp = H * ph;
    const px0 = (x0 - 0.5) * W, px1 = (x1 - 0.5) * W, pz0 = (z0 - 0.5) * D, pz1 = (z1 - 0.5) * D;
    const pw = px1 - px0, pd = pz1 - pz0, cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2;
    const side = (rect, w, s0, s1, ry, x, z) => {
      if (!rect) return;
      const g = quadBand(rect, w, Hp, A, 0, ph, s0, s1);
      if (ry) g.rotateY(ry);
      g.translate(x, Hp / 2, z); faces.push(g);
    };
    side(item.front, pw, x0, x1, 0, cx, pz1);
    side(item.back, pw, 1 - x1, 1 - x0, Math.PI, cx, pz0);       // (the back picture runs right → left)
    side(item.left, pd, z0, z1, -Math.PI / 2, px0, cz);          // (the left one back → front)
    side(item.right, pd, 1 - z1, 1 - z0, Math.PI / 2, px1, cz);
    if (front) { const g = quadBand(front, pw, pd, A, Math.max(0, ph - 0.03), ph, x0, x1); g.rotateX(-Math.PI / 2); g.translate(cx, Hp - 0.3, cz); faces.push(g); }
    if (outline) {
      // the crown: from the pot's rim (the outline shrunk to the pot) out to the whole crown at its middle, a little in
      // again at the top — a rounded volume, not a column
      const sPot = Math.min(1, Math.max(pw / W, pd / D)), yMid = Hp + (H - Hp) * 0.55;
      const rings = [[Hp, sPot, cx, cz], [yMid, 1, 0, 0], [H, 0.75, 0, 0]];
      // (the convex hull of the leaves' outline: the star of leaf tips made the bulb's sides a row of slats)
      for (const loop of outline) faces.push(crownWalls(hull(loop), W, D, H, item, A, rings));
    }
    if (item.top) { const g = quad(item.top, W, D, A); g.rotateX(-Math.PI / 2); g.translate(0, H * (m.topAt ?? 0.82), 0); faces.push(g); }
    for (const g of faces) out.push(g.applyMatrix4(base));
    return;
  }
  if (m.wall) {
    const h = (W * front[3]) / front[2], dep = Math.max(1, t.d || 2), y = m.at || 40;
    const g = quad(front, W, h, A); g.translate(0, y, dep + 0.3); faces.push(g);
    if (item.top) { const q = quad(item.top, W, dep, A); q.rotateX(-Math.PI / 2); q.translate(0, y + h / 2, dep / 2 + 0.3); faces.push(q); }
    if (item.left) { const q = quad(item.left, dep, h, A); q.rotateY(-Math.PI / 2); q.translate(-W / 2, y, dep / 2 + 0.3); faces.push(q); }
    if (item.right) { const q = quad(item.right, dep, h, A); q.rotateY(Math.PI / 2); q.translate(W / 2, y, dep / 2 + 0.3); faces.push(q); }
    for (const q of faces) out.push(q.applyMatrix4(base));
    return;
  }
  cellFaces(m, item, A, W, D, heightOf(m, item, t, W, D), surf, outline, faces);
  for (const g of faces) out.push(g.applyMatrix4(base));
}

/**
 * D111: the drawn height (units) — `drawH`, else the catalogue height scaled as the footprint is (the mean of its width
 * and depth scales: a turnstile or a whiteboard laid out narrower / deeper than the catalogue keeps a sane height).
 */
function heightOf(m, item, t, W, D) {
  if (m.drawH) return m.drawH;
  const [w, d, h] = item.size || [];
  if (!(w > 0 && d > 0 && h > 0)) return t.h;
  return h * 30 * Math.sqrt((W / (w * 30)) * (D / (d * 30)));
}

/** D111: the faces of one standing object W × D × H in its own frame (no placement). */
function cellFaces(m, item, A, W, D, H, surf, outline, faces) {
  const front = item.front || item.back;
  const s = Math.min(1, Math.max(0.03, surf)), Hs = H * s;
  if (item.top) { const g = quad(item.top, W, D, A); g.rotateX(-Math.PI / 2); g.translate(0, Hs, 0); faces.push(g); }
  if (outline && !m.box) {
    const inset = Math.min(1, 0.02 * Math.min(W, D)); // units (≤ 1)
    for (const loop of outline) faces.push(outlineWalls(loop, W, D, H, item, A, Hs, inset));
  } else {
    const side = (rect, w, ry, x, z) => { if (!rect) return; const g = quadBand(rect, w, Hs, A, 0, s); g.rotateY(ry); g.translate(x, Hs / 2, z); faces.push(g); };
    side(item.front, W, 0, 0, D / 2);
    side(item.back, W, Math.PI, 0, -D / 2);
    side(item.left, D, -Math.PI / 2, -W / 2, 0);
    side(item.right, D, Math.PI / 2, W / 2, 0);
  }
  if (s < 0.97) {
    // above the surface: the front picture's upper part across, the side picture's along — crossing where the pictures
    // show it stands (item.up: a monitor behind the middle, a coffee machine at the back), else in the middle
    const hu = H - Hs, [ux, uz] = item.up || [0, 0];
    if (front) { const g = quadBand(front, W, hu, A, s, 1); g.translate(0, Hs + hu / 2, uz * D); faces.push(g); }
    const sideP = item.left || item.right;
    if (sideP) { const g = quadBand(sideP, D, hu, A, s, 1); g.rotateY(-Math.PI / 2); g.translate(ux * W, Hs + hu / 2, 0); faces.push(g); }
  }
}

/**
 * One geometry with the view boxes of every prop of a level that has views in `atlas` (position / normal / uv /
 * colour), or null.
 * @param {Array} props (the level's + render-only ones)  @param {Array|null} lights baked lights  @param {string} atlas
 */
export function buildPropViews(props, lights = null, atlas = 'office') {
  const parts = [];
  for (const p of props) {
    if (p.drawn === false || hasModel(p)) continue; // D96: drawn from its 3D model
    const m = PROP_MODELS[p.type];
    if (!m || (m.atlas || 'office') !== atlas) continue;
    propFaces(p, parts);
  }
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
