// D116 (user: the conference table "of awful quality, with square corners — fix it properly or remodel it"): built in
// code instead of from its atlas pictures (the source top is only 232 × 81 px and its rounded ends sat on a box). The
// table of the user's picture, as a real model: a stadium-shaped top (semicircular ends) in a crisp walnut texture with
// its three cable hatches, a bevelled edge, two steel panel legs under the ends and a rail between them. One mesh for
// every such table of a level, one canvas texture (drawn once). Presentation only — the collision stays in props.js.
import * as THREE from '../../lib/three.module.js';
import { PROP_TYPES } from '../data/props.js';
import { PROP_MODELS } from '../data/propModels.js';

const TEX_W = 1024, TEX_H = 512;
const WOOD = [0, 0, 1024, 358];     // px: the top (200 × 70 units)
const EDGE = [0, 366, 1024, 30];    // the top's edge
const STEEL = [0, 404, 1024, 108];  // the legs and the rail
const TOP = 2.4;                    // units: the top's thickness
let texture = null;

/** A small seeded random (the grain is the same every time). */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function drawTexture() {
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d'), r = rng(116);
  // walnut: a warm base, long grain along the table, a few darker figure streaks, a soft sheen
  const [wx, wy, ww, wh] = WOOD;
  const base = g.createLinearGradient(0, wy, 0, wy + wh);
  base.addColorStop(0, '#5b3620'); base.addColorStop(0.5, '#68402a'); base.addColorStop(1, '#58341f');
  g.fillStyle = base; g.fillRect(wx, wy, ww, wh);
  for (let i = 0; i < 340; i++) {
    const y = wy + r() * wh, amp = 1 + r() * 5, f = 0.004 + r() * 0.01, ph = r() * 6.28, dark = r() < 0.6;
    g.strokeStyle = dark ? `rgba(38, 20, 10, ${0.08 + r() * 0.22})` : `rgba(150, 98, 60, ${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    for (let x = 0; x <= ww; x += 16) { const yy = y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    g.stroke();
  }
  for (let i = 0; i < 9; i++) { // figure: long soft dark bands
    const y = wy + r() * wh, h = 6 + r() * 16;
    const gr = g.createLinearGradient(0, y - h, 0, y + h);
    gr.addColorStop(0, 'rgba(30,15,6,0)'); gr.addColorStop(0.5, `rgba(30,15,6,${0.12 + r() * 0.12})`); gr.addColorStop(1, 'rgba(30,15,6,0)');
    g.fillStyle = gr; g.fillRect(wx, y - h, ww, h * 2);
  }
  const sheen = g.createRadialGradient(ww * 0.42, wh * 0.35, 10, ww * 0.42, wh * 0.35, ww * 0.55);
  sheen.addColorStop(0, 'rgba(255, 225, 190, 0.10)'); sheen.addColorStop(1, 'rgba(255, 225, 190, 0)');
  g.fillStyle = sheen; g.fillRect(wx, wy, ww, wh);
  // the darker rim near the rounded edge (the varnish thicker there)
  const R = wh / 2;
  const stadium = (inset) => { g.beginPath(); g.arc(R, wy + R, R - inset, Math.PI / 2, Math.PI * 1.5); g.arc(ww - R, wy + R, R - inset, -Math.PI / 2, Math.PI / 2); g.closePath(); };
  for (let k = 0; k < 7; k++) { stadium(k * 1.6); g.strokeStyle = `rgba(25, 12, 5, ${0.28 - k * 0.04})`; g.lineWidth = 2; g.stroke(); }
  // the three cable hatches (the user's picture: 22 … 78 % of the length, 42 … 56 % of the depth)
  const hx0 = ww * 0.22, hx1 = ww * 0.78, hy0 = wy + wh * 0.42, hy1 = wy + wh * 0.56, gap = ww * 0.008, hw = (hx1 - hx0 - 2 * gap) / 3;
  for (let i = 0; i < 3; i++) {
    const x = hx0 + i * (hw + gap);
    g.fillStyle = '#7d8186'; g.fillRect(x - 3, hy0 - 3, hw + 6, hy1 - hy0 + 6);           // the steel frame
    g.fillStyle = '#16181b'; g.fillRect(x, hy0, hw, hy1 - hy0);                            // the lid
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, hy0, hw, 2);                     // its lit edge
    g.fillStyle = '#2a2d31'; g.fillRect(x + hw * 0.08, hy0 + (hy1 - hy0) * 0.62, hw * 0.84, 2); // the brush slot
  }
  // the edge: the same walnut, end grain darker
  const [, ey, , eh] = EDGE;
  const eg = g.createLinearGradient(0, ey, 0, ey + eh);
  eg.addColorStop(0, '#6d4630'); eg.addColorStop(0.4, '#4a2a17'); eg.addColorStop(1, '#2e180c');
  g.fillStyle = eg; g.fillRect(0, ey, TEX_W, eh);
  // brushed dark steel
  const [, sy, , sh] = STEEL;
  g.fillStyle = '#2f3236'; g.fillRect(0, sy, TEX_W, sh);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.05})`; g.fillRect(0, sy + r() * sh, TEX_W, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** u, v of a texture pixel (x, y). */
const U = (x) => x / TEX_W, V = (y) => 1 - y / TEX_H;

/** The faces of one table in its own frame: W × D, the top at H. */
function tableGeometry(W, D, H) {
  const parts = [];
  // the top: a stadium (semicircular ends of radius D / 2), bevelled
  const R = D / 2, L = W / 2 - R, b = 0.5;
  const s = new THREE.Shape();
  s.moveTo(-L, -R + b); s.lineTo(L, -R + b);
  s.absarc(L, 0, R - b, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-L, R - b);
  s.absarc(-L, 0, R - b, Math.PI / 2, Math.PI * 1.5, false);
  const top = new THREE.ExtrudeGeometry(s, { depth: TOP - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 20 });
  top.rotateX(-Math.PI / 2);
  top.translate(0, H - TOP + b, 0);
  const tp = top.attributes.position, tn = top.attributes.normal, tuv = top.attributes.uv;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
    if (tn.getY(i) > 0.6) tuv.setXY(i, U(WOOD[0] + ((x + W / 2) / W) * WOOD[2]), V(WOOD[1] + ((z + D / 2) / D) * WOOD[3]));
    else tuv.setXY(i, U(((x + W / 2) / W) * TEX_W * 0.98 + ((z + D / 2) / D) * 10), V(EDGE[1] + ((H - y) / TOP) * EDGE[3]));
  }
  parts.push(top);
  // the steel: two panel legs under the ends and a rail between them
  const legH = H - TOP, lx = W / 2 - D * 0.45, steel = (g) => {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, U(((p.getX(i) + p.getZ(i) + W) / (2 * W)) * TEX_W), V(STEEL[1] + ((p.getY(i) % 12) / 12) * STEEL[3]));
    parts.push(g);
  };
  for (const sx of [-1, 1]) {
    const leg = new THREE.BoxGeometry(3, legH, D * 0.55).toNonIndexed();
    leg.translate(sx * lx, legH / 2, 0);
    steel(leg);
    const foot = new THREE.BoxGeometry(5, 1.2, D * 0.62).toNonIndexed();
    foot.translate(sx * lx, 0.6, 0);
    steel(foot);
  }
  const rail = new THREE.BoxGeometry(2 * lx, 3, 2.4).toNonIndexed();
  rail.translate(0, legH - 4.5, 0);
  steel(rail);
  return parts;
}

/** Every custom-built prop of a level (the conference tables) → meshes ([] when none). */
export function buildCustomProps(props, shadows) {
  const parts = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const p of props) {
    const m = PROP_MODELS[p.type];
    if (!m || m.custom !== 'confTable' || p.drawn === false) continue;
    const t = PROP_TYPES[p.type];
    m4.compose(pos.set(p.x, p.elev || 0, p.y), q.setFromAxisAngle(up, -(((p.rot | 0) & 3) * Math.PI) / 2), one);
    for (const g of tableGeometry(t.w, t.d, t.h)) parts.push(g.applyMatrix4(m4));
  }
  if (!parts.length) return [];
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    const c = ng.attributes.position.count;
    P.set(ng.attributes.position.array, o * 3); N.set(ng.attributes.normal.array, o * 3); UV.set(ng.attributes.uv.array, o * 2);
    o += c;
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  geo.computeBoundingSphere();
  if (!texture) texture = drawTexture();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: texture }));
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.matrixAutoUpdate = false;
  mesh.userData.ownMaterial = true;
  return [mesh];
}
