// D96 (user: new models for the office and the training ground): props drawn from the user's 3D models
// (assets/models/props, copied unchanged) instead of the view pictures — data/propModels.js `model`.
//   - impostor: the model rendered ONCE (when the assets load) from the game camera's angle into a picture with
//     transparency, then drawn like the old camera-facing sprites (the camera never turns, so it looks the same as the
//     3D model at a quad's cost: 20 trees × 7.8 k triangles would break the triangle budget). `fill` — extra copies of
//     the model, turned and slightly shrunk, rendered into the same picture: a denser crown (no holes in the leaves).
//   - otherwise a real 3D mesh (props that turn — the executive chair), one instanced mesh per model.
// Presentation only; the collision of the prop stays in data/props.js.
import * as THREE from '../../lib/three.module.js';
import { loadGLB } from './glb.js';
import { PROP_MODELS } from '../data/propModels.js';
import { CAMERA } from '../config/camera.js';

const DIR = 'assets/models/props/';
const TILT = (CAMERA.tilt * Math.PI) / 180;
const LEAN = Math.PI / 2 - TILT;                  // the sprite quad leans back by this (faces the camera)
const UP = new THREE.Vector3(0, Math.sin(TILT), -Math.cos(TILT)); // the camera's up on the ground plane's frame
const BAKE_H = 512;                               // px: the impostor picture's height

const raw = new Map();     // file → { geometry (height 1, base at y 0), texture }
const baked = new Map();   // file → { texture, w, y0, y1 } (units for a model of height 1)

/** Every model file the props name. */
function files() {
  const out = new Set();
  for (const m of Object.values(PROP_MODELS)) {
    if (!m.model) continue;
    for (const f of [].concat(m.model.file)) out.add(f);
  }
  return [...out];
}

/** Loads every prop model (once; a missing file keeps the old picture). */
export function preloadPropModels() {
  return Promise.all(files().map((f) => (raw.has(f) ? null : loadGLB(DIR + f).then((m) => { if (m) raw.set(f, m); }))));
}

/** The model a prop shows ({ m: the model entry, file }), or null (no model / not loaded). */
export function modelOf(p) {
  const e = PROP_MODELS[p.type], m = e && e.model;
  if (!m) return null;
  let f = m.file;
  if (Array.isArray(f)) f = f[(Math.abs(Math.round(p.x * 7 + p.y * 13)) >>> 0) % f.length];
  return raw.has(f) ? { m, file: f } : null;
}

/**
 * Renders the impostor pictures (needs the WebGL renderer; once — a context loss keeps them: the pixels are read back
 * into plain textures).
 */
export function bakeImpostors(renderer) {
  const todo = [];
  for (const m of Object.values(PROP_MODELS)) if (m.model && m.model.impostor) for (const f of [].concat(m.model.file)) if (raw.has(f) && !baked.has(f)) todo.push([f, m.model]);
  if (!todo.length) return;
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a80, 2.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(-0.3, 1, 0.35);
  scene.add(sun);
  const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  for (const [f, cfg] of todo) {
    const { geometry, texture } = raw.get(f);
    // D98: a model may ask for its own light (a tree: less fill, a stronger key from the scene's sun side — volume)
    const L = cfg.look || {};
    hemi.intensity = L.hemi ?? 2.2;
    sun.intensity = L.sun ?? 1.0;
    sun.position.set(-0.32, 0.8, 0.3); // (the level's sun: up, from the left and towards the camera)
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ map: texture });
    // the model + its fill copies (turned, shrunk towards the crown's middle)
    const copies = [[0, 1]].concat(cfg.fill || []);
    for (const [turn, k] of copies) {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.rotation.y = turn;
      mesh.scale.set(k, k, k);
      mesh.position.y = (1 - k) * (cfg.fillAt ?? 0.62); // shrunk about the crown, not the base
      group.add(mesh);
    }
    scene.add(group);
    // the picture's frame: the model's points on the camera's right (x) / up axes
    const pos = geometry.attributes.position, v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const u = v.dot(UP);
      if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (u < y0) y0 = u; if (u > y1) y1 = u;
    }
    const pad = 0.02;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const H = BAKE_H, W = Math.max(16, Math.round((H * (x1 - x0)) / (y1 - y0)));
    const cam = new THREE.OrthographicCamera(x0, x1, y1, y0, 0.01, 20);
    const dir = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT)); // from the model towards the camera
    cam.position.copy(dir).multiplyScalar(8);
    cam.up.copy(UP);
    cam.lookAt(0, 0, 0);
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace; // (written as sRGB — read back as sRGB below: no double darkening)
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    const px = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    rt.dispose();
    scene.remove(group);
    mat.dispose();
    if (cfg.look) grade(px, W, H, cfg.look);
    const tex = new THREE.DataTexture(px, W, H, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    baked.set(f, { texture: tex, w0: x0, w1: x1, y0, y1 });
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
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
    if (mo.m.impostor && !baked.has(mo.file)) continue;
    (groups.get(mo.file) || groups.set(mo.file, { m: mo.m, list: [] }).get(mo.file)).list.push(p);
  }
  const out = [];
  for (const [file, { m, list }] of groups) {
    if (m.impostor) {
      const b = baked.get(file), parts = [];
      for (const p of list) {
        const s = m.height * (p.scale || 1) * (0.92 + 0.16 * hash01(p));        // a little variety
        const g = new THREE.PlaneGeometry((b.w1 - b.w0) * s, (b.y1 - b.y0) * s);
        g.translate(((b.w0 + b.w1) / 2) * s, ((b.y0 + b.y1) / 2) * s, 0);     // the model's base point at the origin
        g.rotateX(-LEAN);
        // D98: the part of the picture below the base point (the crown's near side) would sink under the ground and be cut
        // off flat — the quad is moved along the camera's view line (the picture stays put on screen) until it is above
        const low = Math.min(0, b.y0 * s) * Math.cos(LEAN), t = -low / Math.cos(TILT) + 0.5;
        g.translate(p.x, (p.elev || 0) + t * Math.cos(TILT), p.y + t * Math.sin(TILT));
        parts.push(g);
      }
      const geo = mergeQuads(parts);
      const mat = new THREE.MeshLambertMaterial({ map: b.texture, alphaTest: 0.45, side: THREE.DoubleSide, transparent: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      mesh.userData.ownMaterial = true;
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
      im.userData.ownMaterial = true;
      out.push(im);
    }
  }
  return out;
}

/** True when a prop is drawn from a model (its view box / sprite is not built). */
export const hasModel = (p) => p.drawn !== false && !!modelOf(p) && (!modelOf(p).m.impostor || baked.has(modelOf(p).file));

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
 *   tint / mix: the colour pulled towards the level's palette (olive greens of the grass), keeping its light and shade;
 *   shade: the crown darker towards its bottom and its inner (lower) side — the ambient occlusion of a real crown;
 *   rim: its upper-left edge (the sun side) a little lighter. px: RGBA bytes, rows bottom-up (WebGL readback).
 */
function grade(px, W, H, L) {
  const [tr, tg, tb] = L.tint || [1, 1, 1], mix = L.mix ?? 0, shade = L.shade ?? 0, rim = L.rim ?? 0, sphere = L.sphere ?? 0;
  // the picture's opaque rows (bottom-up) — the shading follows the crown, not the whole picture
  let top = 0, bot = H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 4) if (px[(y * W + x) * 4 + 3] > 40) { bot = Math.min(bot, y); top = Math.max(top, y); }
  const span = Math.max(1, top - bot);
  // D98: the crown as a ball — its middle and size from the opaque pixels; a light from the sun's side (up-left, front)
  let cx = 0, cy = 0, n = 0, x0 = W, x1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (px[(y * W + x) * 4 + 3] > 40) { cx += x; cy += y; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  cx /= n || 1; cy /= n || 1;
  const rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, span / 2);
  const lx = -0.5, ly = 0.55, lz = 0.67;
  // the alpha a few px up-left (rim: the edge facing the sun)
  const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : px[(y * W + x) * 4 + 3]);
  const R = Math.max(2, Math.round(W / 90));
  for (let y = 0; y < H; y++) {
    const v = (y - bot) / span; // 0 bottom … 1 top
    const ao = 1 - shade * Math.pow(1 - Math.min(1, Math.max(0, v)), 1.6);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i + 3] < 8) continue;
      let r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      r += (lum * tr - r) * mix; g += (lum * tg - g) * mix; b += (lum * tb - b) * mix;
      let k = ao;
      if (sphere > 0) { // lambert on the ball's normal, eased (never black: 1 − sphere … 1 + sphere / 2)
        const nx = (x - cx) / rx, ny = (y - cy) / ry, q = Math.min(1, nx * nx + ny * ny), nz = Math.sqrt(1 - q);
        const d = Math.max(0, nx * lx + ny * ly + nz * lz);
        k *= 1 - sphere + sphere * 1.5 * d;
      }
      if (rim > 0 && a(x - R, y + R) < 40) k *= 1 + rim; // the up-left neighbour is outside the crown: a lit edge
      px[i] = Math.min(255, r * k * 255); px[i + 1] = Math.min(255, g * k * 255); px[i + 2] = Math.min(255, b * k * 255);
    }
  }
}
