// D96 (user: new models for the office and the training ground): props drawn from the user's 3D models
// (assets/models/props, copied unchanged) instead of the view pictures — data/propModels.js `model`.
//   - impostor: the model rendered ONCE (when the assets load) from the game camera's angle into a picture with
//     transparency, then drawn as a camera-facing quad (the camera never turns, so it looks the same as the 3D model at
//     a quad's cost — 20 trees × 7.8 k triangles or 50 chairs × 7 k would break the triangle budget). `fill` — extra
//     copies turned / shrunk into the same picture (a denser crown). D99: `turns` — props that face 4 ways (chairs): the
//     4 quarter turns rendered side by side into one picture, each prop's quad shows its turn (one draw call a model).
//   - baked (D99): the picture made OFFLINE (tools: the huge tree model — 60 MB, 2 M triangles — ships as its picture
//     only); `baked: { file, frame: [x0, x1, y0, y1] }`.
//   - otherwise a real 3D mesh, one instanced mesh per model.
// Every model is normalised on load: height 1, base at y 0 (the user's files come in metres or centimetres).
// Presentation only; the collision of the prop stays in data/props.js.
import * as THREE from '../../lib/three.module.js';
import { loadGLB } from './glb.js';
import { PROP_MODELS } from '../data/propModels.js';
import { CAMERA } from '../config/camera.js';

const DIR = 'assets/models/props/';
const TILT = (CAMERA.tilt * Math.PI) / 180;
const LEAN = Math.PI / 2 - TILT;                  // the sprite quad leans back by this (faces the camera)
const BAKE_H = 512;                               // px: the impostor picture's height (cfg.bakeH overrides)

const raw = new Map();     // file → { geometry (height 1, base at y 0), texture }
const baked = new Map();   // file → { texture, frame: [x0, x1, y0, y1] (units for a model of height 1), cells }

/** The model entries (each file once). */
function entries() {
  const out = [];
  for (const m of Object.values(PROP_MODELS)) if (m.model) for (const f of [].concat(m.model.file)) out.push([f, m.model]);
  return out;
}

/** Loads every prop model / offline-baked picture (once; a missing file keeps the old view picture). */
export function preloadPropModels() {
  return Promise.all(entries().map(([f, cfg]) => {
    if (raw.has(f) || baked.has(f)) return null;
    if (cfg.baked) {
      return new Promise((res) => {
        const t = new THREE.TextureLoader().load(DIR + cfg.baked.file, () => {
          baked.set(f, { texture: t, frame: cfg.baked.frame, cells: 1 });
          res();
        }, undefined, () => res());
        t.colorSpace = THREE.SRGBColorSpace;
      });
    }
    return loadGLB(DIR + f).then((m) => { if (m) { normalise(m.geometry); raw.set(f, m); } });
  }));
}

/** Height 1, base at y 0, centred on x / z (the files come in metres or centimetres). */
export function normalise(g) {
  g.computeBoundingBox();
  const b = g.boundingBox, k = 1 / Math.max(1e-6, b.max.y - b.min.y);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k);
  g.computeBoundingBox();
  g.computeBoundingSphere();
}

/** The model a prop shows ({ m: the model entry, file }), or null (no model / not loaded). */
export function modelOf(p) {
  const e = PROP_MODELS[p.type], m = e && e.model;
  if (!m) return null;
  let f = m.file;
  if (Array.isArray(f)) f = f[(Math.abs(Math.round(p.x * 7 + p.y * 13)) >>> 0) % f.length];
  return raw.has(f) || baked.has(f) ? { m, file: f } : null;
}

/**
 * The impostor picture of one model: the model (+ its fill copies), turned by each of `turns` quarter turns, rendered
 * from the game camera's angle side by side → { px (RGBA, rows bottom-up), W (one cell), H, frame }.
 */
export function renderImpostor(renderer, geometry, texture, cfg) {
  const L = cfg.look || {}, turns = cfg.turns ? 4 : 1, H = cfg.bakeH || BAKE_H;
  // D100 (user: the trees looked like huge bushes): a picture may be taken from lower than the game camera (bakeTilt,
  // degrees from the vertical) — a tree then shows its trunk and height (the usual top-down game cheat)
  const tilt = cfg.bakeTilt != null ? (cfg.bakeTilt * Math.PI) / 180 : TILT;
  const up = new THREE.Vector3(0, Math.sin(tilt), -Math.cos(tilt));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a80, L.hemi ?? 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, L.sun ?? 1.0);
  sun.position.set(-0.32, 0.8, 0.3); // (the level's sun: up, from the left and towards the camera)
  scene.add(sun);
  // D104 (user: shadows in the foliage — less of a flat picture): `selfShadow` — a real shadow map in the bake: the upper
  // leaf clusters shade the lower ones and the branches (the model is height 1 around the origin)
  const selfShadow = !!L.selfShadow;
  if (selfShadow) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -0.9; sc.right = 0.9; sc.top = 0.9; sc.bottom = -0.9; sc.near = 0.01; sc.far = 4;
    sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.004; sun.shadow.radius = 2;
    sun.position.multiplyScalar(1.6); sun.target.position.set(0, 0.45, 0); scene.add(sun.target);
  }
  const mat = new THREE.MeshLambertMaterial({ map: texture });
  const group = new THREE.Group();
  for (const [turn, k] of [[0, 1]].concat(cfg.fill || [])) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = mesh.receiveShadow = selfShadow;
    mesh.rotation.y = turn;
    mesh.scale.set(k, k, k);
    mesh.position.y = (1 - k) * (cfg.fillAt ?? 0.62); // shrunk about the crown, not the base
    group.add(mesh);
  }
  scene.add(group);
  // one frame for every turn: the model's points on the camera's right (x) / up axes, all turns
  const pos = geometry.attributes.position, v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let r = 0; r < turns; r++) {
    const a = -r * (Math.PI / 2) + (cfg.turn || 0), c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i);
      const x = v.x * c + v.z * s, z = -v.x * s + v.z * c, u = v.y * up.y + z * up.z;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (u < y0) y0 = u; if (u > y1) y1 = u;
    }
  }
  const pad = 0.02;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = Math.max(16, Math.round((H * (x1 - x0)) / (y1 - y0)));
  const cam = new THREE.OrthographicCamera(x0, x1, y1, y0, 0.01, 20);
  cam.position.set(0, Math.cos(tilt) * 8, Math.sin(tilt) * 8);
  cam.up.copy(up);
  cam.lookAt(0, 0, 0);
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace; // (written as sRGB — read back as sRGB: no double darkening)
  const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const out = new Uint8Array(W * turns * H * 4), cell = new Uint8Array(W * H * 4);
  const prevShadow = renderer.shadowMap.enabled, prevType = renderer.shadowMap.type;
  if (selfShadow) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.needsUpdate = true; }
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  for (let r = 0; r < turns; r++) {
    group.rotation.y = -r * (Math.PI / 2) + (cfg.turn || 0);
    renderer.clear();
    if (selfShadow) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, cell);
    if (cfg.look) grade(cell, W, H, cfg.look);
    for (let y = 0; y < H; y++) out.set(cell.subarray(y * W * 4, (y + 1) * W * 4), (y * W * turns + r * W) * 4);
  }
  renderer.setRenderTarget(prevTarget);
  if (selfShadow) { renderer.shadowMap.enabled = prevShadow; renderer.shadowMap.type = prevType; renderer.shadowMap.needsUpdate = true; sun.shadow.map && sun.shadow.map.dispose(); }
  renderer.setClearColor(prevClear, prevAlpha);
  rt.dispose();
  mat.dispose();
  return { px: out, W, H, turns, frame: [x0, x1, y0, y1] };
}

/**
 * Renders the impostor pictures (needs the WebGL renderer; once — a context loss keeps them: the pixels are read back
 * into plain textures).
 */
export function bakeImpostors(renderer) {
  for (const [f, cfg] of entries()) {
    if (!cfg.impostor || cfg.baked || baked.has(f) || !raw.has(f)) continue;
    const { geometry, texture } = raw.get(f);
    const r = renderImpostor(renderer, geometry, texture, cfg);
    const tex = new THREE.DataTexture(r.px, r.W * r.turns, r.H, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    baked.set(f, { texture: tex, frame: r.frame, cells: r.turns });
  }
}

/**
 * The meshes of a level's model props: one per model file (impostor quads merged / a real mesh instanced).
 * @returns {THREE.Mesh[]}
 */
export function buildPropModels(props, shadows) {
  const groups = new Map();
  for (const p of props) {
    if (p.drawn === false) continue;
    const mo = modelOf(p);
    if (!mo) continue;
    if ((mo.m.impostor || mo.m.baked) && !baked.has(mo.file)) continue;
    (groups.get(mo.file) || groups.set(mo.file, { m: mo.m, list: [] }).get(mo.file)).list.push(p);
  }
  const out = [];
  for (const [file, { m, list }] of groups) {
    if (m.impostor || m.baked) {
      const b = baked.get(file), [fx0, fx1, fy0, fy1] = b.frame, parts = [];
      for (const p of list) {
        const s = m.height * (p.scale || 1) * (m.vary === false ? 1 : 0.92 + 0.16 * hash01(p)); // a little variety
        const g = new THREE.PlaneGeometry((fx1 - fx0) * s, (fy1 - fy0) * s);
        if (b.cells > 1) { // D99: the quarter turn's cell of the picture
          const c = ((p.rot | 0) & 3) % b.cells, uv = g.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setX(i, (c + uv.getX(i)) / b.cells);
        }
        g.translate(((fx0 + fx1) / 2) * s, ((fy0 + fy1) / 2) * s, 0);   // the model's base point at the origin
        g.rotateX(-LEAN);
        // D98: the part of the picture below the base point (the crown's near side) would sink under the ground and be
        // cut off flat — the quad is moved along the camera's view line (the picture stays put on screen) above it
        // D100: `lift` — moved further along it (a tall tree's picture leans back over the yard walls behind it and was cut
        // by them; lifted towards the camera it passes over them, the same on screen)
        const low = Math.min(0, fy0 * s) * Math.cos(LEAN), t = -low / Math.cos(TILT) + 0.5 + (m.lift || 0);
        g.translate(p.x, (p.elev || 0) + t * Math.cos(TILT), p.y + t * Math.sin(TILT));
        parts.push(g);
      }
      const geo = mergeQuads(parts);
      const mat = new THREE.MeshLambertMaterial({ map: b.texture, alphaTest: 0.45, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows && m.castShadow !== false;
      if (m.groundShadow) out.push(groundShadows(list, m));
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      out.push(mesh);
    } else {
      const { geometry, texture } = raw.get(file);
      const mat = new THREE.MeshLambertMaterial({ map: texture });
      const im = new THREE.InstancedMesh(geometry, mat, list.length);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
      list.forEach((p, i) => {
        const s = m.height * (p.scale || 1);
        Q.setFromAxisAngle(Y, -(((p.rot | 0) & 3) * Math.PI) / 2 + (m.turn || 0));
        M.compose(P.set(p.x, p.elev || 0, p.y), Q, S.set(s, s, s));
        im.setMatrixAt(i, M);
      });
      im.castShadow = shadows;
      im.receiveShadow = shadows;
      out.push(im);
    }
  }
  return out;
}

/** True when a prop is drawn from a model (its view box / sprite is not built). */
export const hasModel = (p) => {
  if (p.drawn === false) return false;
  const mo = modelOf(p);
  return !!mo && (!(mo.m.impostor || mo.m.baked) || baked.has(mo.file));
};

const hash01 = (p) => ((Math.abs(Math.round(p.x * 13.1 + p.y * 7.7)) % 97) / 97);

function mergeQuads(parts) {
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const idx = [], pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2);
    for (const i of g.index.array) idx.push(i + o);
    o += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}

/**
 * D98 (user: the trees looked flat and too green for the place): the baked picture graded —
 *   tint / mix: the colour pulled towards the level's palette, keeping its light and shade;
 *   shade: darker towards its bottom (ambient occlusion); sphere: lit like a ball from the sun's side;
 *   rim: its upper-left edge (the sun side) a little lighter; gain (D99): brighter overall (the black chair).
 * px: RGBA bytes, rows bottom-up (WebGL readback).
 */
function grade(px, W, H, L) {
  const [tr, tg, tb] = L.tint || [1, 1, 1], mix = L.mix ?? 0, shade = L.shade ?? 0, rim = L.rim ?? 0, sphere = L.sphere ?? 0, gain = L.gain ?? 1;
  let top = 0, bot = H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 4) if (px[(y * W + x) * 4 + 3] > 40) { bot = Math.min(bot, y); top = Math.max(top, y); }
  const span = Math.max(1, top - bot);
  let cx = 0, cy = 0, n = 0, x0 = W, x1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (px[(y * W + x) * 4 + 3] > 40) { cx += x; cy += y; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  cx /= n || 1; cy /= n || 1;
  const rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, span / 2);
  const lx = -0.5, ly = 0.55, lz = 0.67;
  const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : px[(y * W + x) * 4 + 3]);
  const R = Math.max(2, Math.round(W / 90));
  // D104: `depth` — local contrast of the light (each pixel against its neighbourhood's mean, opaque pixels only): the
  // leaf clusters stand out from the shaded hollows between them (a cheap ambient occlusion of the crown)
  const depth = L.depth ?? 0;
  let blur = null;
  if (depth > 0) {
    const lum = new Float32Array(W * H), cov = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const o = px[i * 4 + 3] > 40 ? 1 : 0; cov[i] = o; lum[i] = o * (0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2]) / 255; }
    const box = (src, rad) => { // separable box blur (twice ≈ gaussian)
      const t = new Float32Array(W * H), o = new Float32Array(W * H);
      for (let y = 0; y < H; y++) { let s = 0; for (let x = -rad; x <= rad; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { t[y * W + x] = s / (2 * rad + 1); s += src[y * W + Math.min(W - 1, x + rad + 1)] - src[y * W + Math.max(0, x - rad)]; } }
      for (let x = 0; x < W; x++) { let s = 0; for (let y = -rad; y <= rad; y++) s += t[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { o[y * W + x] = s / (2 * rad + 1); s += t[Math.min(H - 1, y + rad + 1) * W + x] - t[Math.max(0, y - rad) * W + x]; } }
      return o;
    };
    const rad = Math.max(3, Math.round(W / 45));
    const bl = box(box(lum, rad), rad), bc = box(box(cov, rad), rad);
    blur = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) blur[i] = bc[i] > 0.05 ? bl[i] / bc[i] : 0;
    blur.lum = lum;
  }
  for (let y = 0; y < H; y++) {
    const v = (y - bot) / span;
    const ao = 1 - shade * Math.pow(1 - Math.min(1, Math.max(0, v)), 1.6);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i + 3] < 8) continue;
      let r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      // D101: only the foliage takes the tint (by its greenness) — the trunk keeps its bark brown
      const gm = mix * Math.min(1, Math.max(0, (g - Math.max(r, b)) * 6));
      r += (lum * tr - r) * gm; g += (lum * tg - g) * gm; b += (lum * tb - b) * gm;
      let k = ao * gain;
      if (blur) { const l = blur.lum[y * W + x], m = blur[y * W + x]; if (m > 0.01) k *= Math.max(0.4, Math.min(1.3, 1 + depth * (l - m) / m)); }
      if (sphere > 0) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry, q = Math.min(1, nx * nx + ny * ny), nz = Math.sqrt(1 - q);
        const d = Math.max(0, nx * lx + ny * ly + nz * lz);
        k *= 1 - sphere + sphere * 1.5 * d;
      }
      if (rim > 0 && a(x - R, y + R) < 40) k *= 1 + rim;
      px[i] = Math.min(255, r * k * 255); px[i + 1] = Math.min(255, g * k * 255); px[i + 2] = Math.min(255, b * k * 255);
    }
  }
}

// D101: the level's sun casts towards +x / −z (render3d/Renderer3D.js SUN_DIR −260, 820, 300 → shadows the other way)
const SHADOW_DIR = new THREE.Vector2(260, -300).normalize();
let shadowTex = null;

/** D101: soft ground shadows under model props (a tree: from its trunk towards the sun's shadow side) — one mesh. */
function groundShadows(list, m) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const G = m.groundShadow, parts = [];
  for (const p of list) {
    const h = m.height * (p.scale || 1), r = h * G.r, o = h * G.off;
    const q = new THREE.PlaneGeometry(r * 2, r * 1.7);
    q.rotateX(-Math.PI / 2);
    q.translate(p.x + SHADOW_DIR.x * o, 0.6, p.y + SHADOW_DIR.y * o);
    parts.push(q);
  }
  const mesh = new THREE.Mesh(mergeQuads(parts), new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: G.alpha ?? 0.5, depthWrite: false }));
  mesh.renderOrder = 2;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
