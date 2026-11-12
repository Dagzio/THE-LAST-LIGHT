// THE LAST LIGHT — dev tool (constants.js → DEBUG_MODELS): 3D model viewer + GLB/PNG export.
// Ported from the reference game sky-golf-3d (src/debug-models.js) per H5 guide engines/asset-viewer-3d.md.
// A "3D models" button in the main menu opens a window that shows every game model on its own — built by the
// game's own model code and materials (render3d/models.js), so it is exactly what the game draws — with size /
// triangle / material info, and exports the shown model as .glb (e.g. to rework it in Tripo AI) or PNG.
import * as THREE from '../../lib/three.module.js';
import { buildShowcase } from '../render3d/models.js';
import { createMaterials } from '../render3d/materials.js';
import { SeededRandom } from '../core/SeededRandom.js';
import { loadGLB, loadSkinnedGLB } from '../render3d/glb.js';
import { KeeperSkeleton } from '../render3d/keeperSkeleton.js';
import { applyRig, rigUniforms, bakeModel } from '../render3d/rig.js';
import { weaponGeometry } from '../render3d/models.js';
import { KEEPER_MODEL, gunPlacement } from '../data/keeperRig.js';
import { ENEMY_GLB, enemyRig, GUN_GLB, TURRET_GLB } from '../data/models3d.js';
import { bakeGun, bakeTurret } from '../render3d/glbModels.js';

/** Viewer names of the textured enemies (game type id → the tag the procedural model has in the list). */
const ENEMY_TAG = { grunt: 'grunt', runner: 'runner', husk: 'husk', spitter: 'spitter', brute: 'brute', fog_mother: 'fog-mother' };
const TURRET_TAG = { guard_turret: 'guard-turret', frost_coil: 'frost-coil', poison_turret: 'poison-turret' };

/**
 * D53 / D54: the textured models the game draws now (the user's Tripo models, *.min.glb) — the keeper in his aiming
 * pose with each of his textured guns (the same vertex rig as in the game), every textured enemy, every turret level
 * (base + head). They replace the procedural entries of the same name. Export gives the original game file.
 */
async function texturedModels() {
  const out = new Map();
  const gunIds = Object.keys(GUN_GLB), enemyIds = Object.keys(ENEMY_GLB);
  const tKeys = []; for (const id in TURRET_GLB) TURRET_GLB[id].forEach((e, i) => tKeys.push([id, i + 1, e]));
  const [keepers, guns, enemies, turrets] = await Promise.all([
    Promise.all(gunIds.map(() => loadSkinnedGLB(KEEPER_MODEL.file))), // one skeleton per pose
    Promise.all(gunIds.map((id) => loadGLB(GUN_GLB[id].file))),
    Promise.all(enemyIds.map((id) => loadGLB(ENEMY_GLB[id].file))),
    Promise.all(tKeys.map(([, , e]) => loadGLB(e.file))),
  ]);
  const rigged = (model, height, rig, rotY = Math.PI / 2) => {
    bakeModel(model.geometry, height, rotY);
    const u = rigUniforms(rig);
    const mat = applyRig(new THREE.MeshLambertMaterial({ map: model.texture }), u, false, false);
    const key = `viewer-${rigged.n = (rigged.n || 0) + 1}`; // own program per copy: three.js binds the uniforms of a shared program once
    mat.customProgramCacheKey = () => `rig-u-c-${key}`;
    return new THREE.Mesh(model.geometry, mat);
  };
  gunIds.forEach((id, i) => {
    if (!keepers[i]) return;
    {
      const g = new THREE.Group();
      const keeper = new KeeperSkeleton(keepers[i]); // D56: the game's skeleton pose (stance, both hands on the gun)
      keeper.update({ weaponId: id, phase: 0, blend: 0, moveRel: 0, kick: 0, down: 0 });
      const body = keeper.group;
      const m = guns[i];
      const gun = m ? bakeGun(m.geometry, GUN_GLB[id], id) : weaponGeometry(id, true);
      const { grip, scale, hand } = gunPlacement(id);
      gun.translate(-grip[0], -grip[1], -grip[2]).scale(scale, scale, scale).translate(hand[0], hand[1], hand[2]);
      const gunMesh = new THREE.Mesh(gun, m ? new THREE.MeshLambertMaterial({ map: m.texture }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
      g.add(body, gunMesh);
      g.userData.file = KEEPER_MODEL.file;
      out.set(id === 'pistol' ? 'keeper' : `keeper-${id}`, g);
    }
  });
  enemyIds.forEach((id, i) => {
    const m = enemies[i];
    if (!m) return;
    const e = ENEMY_GLB[id];
    const mesh = rigged(m, e.height, enemyRig(e), e.rotY);
    mesh.userData.file = e.file;
    out.set(ENEMY_TAG[id] || id, mesh);
  });
  tKeys.forEach(([id, lv, e], i) => {
    const m = turrets[i];
    if (!m) return;
    const { base, head } = bakeTurret(m.geometry, e);
    const mat = new THREE.MeshLambertMaterial({ map: m.texture });
    const g = new THREE.Group();
    const h = new THREE.Mesh(head, mat);
    h.rotation.y = -0.5; // the head turned a little: shows that it is a separate part
    g.add(new THREE.Mesh(base, mat), h);
    g.userData.file = e.file;
    out.set(`${TURRET_TAG[id]}-lv${lv}`, g);
  });
  return out;
}

const PREFIX = 'thelastlight';
const NAMES = {
  keeper: 'Keeper + pistol (textured)', 'keeper-smg': 'Keeper + SMG', 'keeper-shotgun': 'Keeper + shotgun', 'keeper-assault_rifle': 'Keeper + rifle', grunt: 'Grunt (textured)', bullet: 'Bullet tracer', muzzle: 'Muzzle flash',
  'prop-rock': 'Prop: rock', 'prop-ruin': 'Prop: ruin wall', 'prop-stump': 'Prop: dead stump', 'prop-post': 'Prop: fence post',
};

const CSS = `
#dbg-models-btn { position: fixed; right: max(30px, env(safe-area-inset-right)); bottom: 30px; z-index: 9000;
  font: 800 13px/1 system-ui, sans-serif; color: #fff; background: rgba(10, 20, 40, .82); border: 1px dashed #ffd166;
  border-radius: 8px; padding: 9px 12px; cursor: pointer; display: none; }
body[data-screen="menu"] #dbg-models-btn { display: block; }
#dbg-models { position: fixed; inset: 0; z-index: 9001; display: flex; background: #121a26; color: #e6eef8;
  font: 13px/1.35 system-ui, sans-serif; user-select: text; }
#dbg-models aside { width: 230px; flex: 0 0 auto; overflow-y: auto; padding: 12px; background: #0c121b; border-right: 1px solid #263345; }
#dbg-models h3 { font-size: 14px; margin: 2px 0 10px; color: #ffd166; }
#dbg-models aside button { display: block; width: 100%; text-align: left; margin: 0 0 4px; padding: 7px 9px; border-radius: 6px;
  border: 1px solid #263345; background: #172233; color: inherit; font: inherit; cursor: pointer; }
#dbg-models aside button.on { background: #2b4a75; border-color: #5aa2f2; }
#dbg-models main { position: relative; flex: 1 1 auto; min-width: 0; }
#dbg-models canvas { display: block; width: 100%; height: 100%; touch-action: none; }
#dbg-models .bar { position: absolute; left: 12px; right: 12px; top: 10px; display: flex; gap: 8px; align-items: flex-start; pointer-events: none; }
#dbg-models .info { flex: 1 1 auto; background: rgba(12, 18, 27, .8); border-radius: 6px; padding: 8px 10px; white-space: pre-line; }
#dbg-models .bar button { pointer-events: auto; padding: 8px 12px; border-radius: 6px; border: 1px solid #5aa2f2;
  background: #1d3a63; color: #fff; font: 700 13px/1 system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
#dbg-models .bar button.x { border-color: #ff8a8a; background: #4a1d26; }
#dbg-models .hint { position: absolute; left: 12px; bottom: 10px; opacity: .6; }
@media (max-width: 700px) { #dbg-models aside { width: 150px; padding: 8px; } #dbg-models aside button { padding: 6px 7px; font-size: 12px; } }
`;

export function initModelViewer() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const btn = document.createElement('button');
  btn.id = 'dbg-models-btn';
  btn.textContent = '3D models';
  btn.title = 'DEBUG: model viewer / GLB export';
  btn.dataset.nosfx = '';
  btn.addEventListener('click', open);
  document.body.appendChild(btn);
}

/* ------------------------------------------------------------------ viewer */

async function open() {
  if (document.getElementById('dbg-models') || open.busy) return;
  open.busy = true;
  const textured = await texturedModels().catch(() => new Map()); // D53
  open.busy = false;
  const el = document.createElement('div');
  el.id = 'dbg-models';
  el.innerHTML = `<aside><h3>Models (debug)</h3><div class="list"></div></aside>
    <main><canvas></canvas><div class="bar"><div class="info"></div>
    <button class="exp">Export .glb</button><button class="png">PNG</button><button class="pngs">All → 1 PNG</button>
    <button class="x">Close</button></div>
    <div class="hint">drag — rotate · wheel / pinch — zoom · double-click — reset</div></main>`;
  document.body.appendChild(el);
  const canvas = el.querySelector('canvas');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a3140);
  scene.add(new THREE.HemisphereLight(0xc8d4f0, 0x2a2e36, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.6);
  sun.position.set(300, 500, 200);
  scene.add(sun);
  const grid = new THREE.GridHelper(200, 20, 0x5a6a85, 0x3a4458);
  scene.add(grid);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 20000);

  // every model, built by the game's own code and materials
  const materials = createMaterials();
  const groups = new Map();
  const showcase = buildShowcase(materials, new SeededRandom(7));
  for (const [name, obj] of textured) showcase.set(name, obj); // D53: the textured keeper / grunt replace the old ones
  for (const [name, obj] of showcase) {
    const g = new THREE.Group();
    g.add(obj);
    groups.set(name, g);
  }

  // centre every model: footprint centre on the origin, bottom on the grid
  const box = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
  for (const g of groups.values()) {
    g.updateMatrixWorld(true);
    box.setFromObject(g);
    box.getCenter(ctr);
    g.children.forEach((c) => { c.position.x -= ctr.x; c.position.z -= ctr.z; c.position.y -= box.min.y; });
  }

  window.__viewer = { scene, renderer, groups }; // dev tool only: inspection from DevTools / test scripts
  let current = null, yaw = 0.7, pitch = 0.45, dist = 3, radius = 1;
  window.__viewer.orbit = (y, p, k = 1) => { yaw = y; pitch = p; dist = radius * 2.6 * k; }; // D55: set views from scripts
  const list = el.querySelector('.list');
  const info = el.querySelector('.info');
  for (const name of groups.keys()) {
    const b = document.createElement('button');
    b.textContent = NAMES[name] || name;
    b.dataset.model = name;
    b.dataset.nosfx = '';
    b.onclick = () => show(name);
    list.appendChild(b);
  }

  function stats(g) {
    let meshes = 0, tris = 0;
    const mats = new Set();
    g.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const geo = o.geometry;
      tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      const m = o.material;
      mats.add(`#${m.color?.getHexString?.() ?? '------'}${m.vertexColors ? ' +vertex colours' : ''}${m.map ? ' +texture' : ''}${m.transparent ? ' (transparent)' : ''}`);
    });
    g.updateMatrixWorld(true);
    box.setFromObject(g).getSize(size);
    return { meshes, tris: Math.round(tris), mats: [...mats], size: size.clone() };
  }

  function frameModel() {
    box.setFromObject(current).getSize(size);
    radius = Math.max(2, size.length() / 2);
    dist = radius * 2.6;
    yaw = 0.7; pitch = 0.45;
    grid.scale.setScalar(Math.max(0.2, radius / 60));
  }

  function show(name) {
    if (current) scene.remove(current);
    current = groups.get(name);
    scene.add(current);
    current.userData.name = name;
    frameModel();
    list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.model === name));
    const s = stats(current);
    info.textContent = `${NAMES[name] || name}  [${name}]\n` +
      `size: ${s.size.x.toFixed(1)} × ${s.size.y.toFixed(1)} × ${s.size.z.toFixed(1)} world units (player radius 18) · ${s.meshes} meshes · ${s.tris} triangles\n` +
      `materials: ${s.mats.join(', ')}`;
  }

  // orbit
  const pts = new Map();
  let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      p.x = e.clientX; p.y = e.clientY;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) dist = THREE.MathUtils.clamp(dist * pinch / d, radius * 0.6, radius * 12);
      pinch = d;
      return;
    }
    yaw -= (e.clientX - p.x) * 0.008;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - p.y) * 0.008, -1.2, 1.5);
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = THREE.MathUtils.clamp(dist * (1 + e.deltaY * 0.001), radius * 0.6, radius * 12); }, { passive: false });
  canvas.addEventListener('dblclick', frameModel);

  el.querySelector('.exp').onclick = () => {
    if (!current) return;
    const name = current.userData.name;
    const file = current.children[0] && current.children[0].userData.file; // D53: textured → the game's own file
    if (file) {
      const a = document.createElement('a');
      a.href = file;
      a.download = `${PREFIX}-${name}.glb`;
      a.click();
      return;
    }
    const blob = new Blob([toGLB(current, name)], { type: 'model/gltf-binary' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${PREFIX}-${name}.glb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // PNG with a transparent background: the model alone (no backdrop, no grid) seen from `view`, framed to fill a
  // `px` square and trimmed to its outline. A second renderer with an alpha channel does it off-screen.
  let shotR = null;
  function renderPNG(group, px, view) {
    if (!shotR) {
      shotR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      shotR.outputColorSpace = renderer.outputColorSpace;
      shotR.toneMapping = renderer.toneMapping;
      shotR.toneMappingExposure = renderer.toneMappingExposure;
      shotR.setClearColor(0x000000, 0);
    }
    shotR.setPixelRatio(1);
    const PX = 512; // first pass: where the model is in the frame
    shotR.setSize(PX, PX, false);
    const bg = scene.background, shown = current;
    scene.background = null; grid.visible = false;
    if (shown !== group) { if (shown) scene.remove(shown); scene.add(group); }
    group.updateMatrixWorld(true);
    const sph = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
    const c = new THREE.PerspectiveCamera(30, 1, 0.5, 20000);
    const d = sph.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.04;
    c.position.set(
      sph.center.x + Math.sin(view.yaw) * Math.cos(view.pitch) * d,
      sph.center.y + Math.sin(view.pitch) * d,
      sph.center.z + Math.cos(view.yaw) * Math.cos(view.pitch) * d);
    c.lookAt(sph.center);
    shotR.render(scene, c);
    const src = document.createElement('canvas');
    src.width = src.height = PX;
    const sx = src.getContext('2d');
    sx.drawImage(shotR.domElement, 0, 0);
    const a = sx.getImageData(0, 0, PX, PX).data;
    let x0 = PX, y0 = PX, x1 = -1, y1 = -1;
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
      if (a[(y * PX + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 >= 0) {
      const m = 6;
      x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(PX - 1, x1 + m); y1 = Math.min(PX - 1, y1 + m);
      const w = x1 - x0 + 1, h = y1 - y0 + 1, k = px / Math.max(w, h);
      shotR.setSize(Math.round(w * k), Math.round(h * k), false);
      c.setViewOffset(PX, PX, x0, y0, w, h);
      shotR.render(scene, c);
    }
    if (shown !== group) { scene.remove(group); if (shown) scene.add(shown); }
    scene.background = bg; grid.visible = true;
    const out = document.createElement('canvas');
    out.width = shotR.domElement.width; out.height = shotR.domElement.height;
    out.getContext('2d').drawImage(shotR.domElement, 0, 0);
    return out;
  }
  const savePNG = (cnv, file) => cnv.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');

  el.querySelector('.png').onclick = () => {
    if (current) savePNG(renderPNG(current, 2048, { yaw, pitch }), `${PREFIX}-${current.userData.name}.png`);
  };
  el.querySelector('.pngs').onclick = () => {
    const CELL = 512, COLS = 4, names = [...groups.keys()];
    const sheet = document.createElement('canvas');
    sheet.width = CELL * COLS;
    sheet.height = CELL * Math.ceil(names.length / COLS);
    const ctx = sheet.getContext('2d');
    names.forEach((name, i) => {
      const img = renderPNG(groups.get(name), CELL * 2, { yaw: 0.7, pitch: 0.45 });
      const k = Math.min((CELL * 0.92) / img.width, (CELL * 0.92) / img.height);
      const w = img.width * k, h = img.height * k;
      ctx.drawImage(img, (i % COLS) * CELL + (CELL - w) / 2, Math.floor(i / COLS) * CELL + (CELL - h) / 2, w, h);
    });
    savePNG(sheet, `${PREFIX}-models.png`);
  };

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    cam.aspect = w / Math.max(1, h);
    cam.updateProjectionMatrix();
    const cy = Math.max(0.5, size.y * 0.45);
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, cy + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(0, cy, 0);
    renderer.render(scene, cam);
  };
  raf = requestAnimationFrame(tick);

  el.querySelector('.x').onclick = () => {
    cancelAnimationFrame(raf);
    for (const g of groups.values()) g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of Object.values(materials)) { if (m.map) m.map.dispose(); if (m.alphaMap) m.alphaMap.dispose(); m.dispose(); }
    renderer.dispose();
    renderer.forceContextLoss();
    if (shotR) { shotR.dispose(); shotR.forceContextLoss(); }
    el.remove();
  };
  show(groups.keys().next().value);
}

/* ------------------------------------------------------------------ minimal GLB (glTF 2.0) writer (from sky-golf-3d) */

function dropDegenerate(g) {
  const p = g.attributes.position.array, keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < p.length / 9; t++) {
    a.fromArray(p, t * 9); b.fromArray(p, t * 9 + 3); c.fromArray(p, t * 9 + 6);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-14) keep.push(t);
  }
  if (keep.length * 9 === p.length) return g;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const s = attr.itemSize, src = attr.array, dst = new Float32Array(keep.length * 3 * s);
    keep.forEach((t, i) => dst.set(src.subarray(t * 3 * s, t * 3 * s + 3 * s), i * 3 * s));
    out.setAttribute(name, new THREE.BufferAttribute(dst, s));
  }
  g.dispose();
  return out;
}

// world transforms baked into the vertices (one node per mesh, relative to `root`); materials as
// metallic-roughness with the base colour / opacity / emissive; vertex colours exported as COLOR_0.
export function toGLB(root, name = 'model') {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m4 = new THREE.Matrix4();
  const json = {
    asset: { version: '2.0', generator: 'THE LAST LIGHT debug exporter' },
    scene: 0, scenes: [{ name, nodes: [] }], nodes: [], meshes: [], materials: [],
    accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }],
  };
  const parts = [];
  let length = 0;
  const view = (bytes, target) => {
    const pad = (4 - (length % 4)) % 4;
    if (pad) { parts.push(new Uint8Array(pad)); length += pad; }
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
    parts.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    length += bytes.byteLength;
    return json.bufferViews.length - 1;
  };
  const accessor = (arr, size, type, minmax) => {
    const acc = { bufferView: view(arr, 34962), componentType: 5126, count: arr.length / size, type };
    if (minmax) {
      const min = Array(size).fill(Infinity), max = Array(size).fill(-Infinity);
      for (let i = 0; i < arr.length; i++) { const k = i % size; if (arr[i] < min[k]) min[k] = arr[i]; if (arr[i] > max[k]) max[k] = arr[i]; }
      acc.min = min; acc.max = max;
    }
    json.accessors.push(acc);
    return json.accessors.length - 1;
  };
  const matIndex = new Map();
  const material = (m) => {
    if (matIndex.has(m)) return matIndex.get(m);
    const c = m.color || new THREE.Color(1, 1, 1);
    const out = {
      name: m.name || m.type,
      pbrMetallicRoughness: { baseColorFactor: [c.r, c.g, c.b, m.transparent ? m.opacity : 1], metallicFactor: 0, roughnessFactor: 1 },
    };
    if (m.side === THREE.DoubleSide) out.doubleSided = true;
    if (m.transparent) out.alphaMode = 'BLEND';
    json.materials.push(out);
    matIndex.set(m, json.materials.length - 1);
    return json.materials.length - 1;
  };

  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = dropDegenerate(o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
    if (o.material.flatShading || !g.attributes.normal) g.computeVertexNormals();
    const attributes = {
      POSITION: accessor(new Float32Array(g.attributes.position.array), 3, 'VEC3', true),
      NORMAL: accessor(new Float32Array(g.attributes.normal.array), 3, 'VEC3'),
    };
    if (g.attributes.color && o.material.vertexColors) attributes.COLOR_0 = accessor(new Float32Array(g.attributes.color.array), 3, 'VEC3');
    json.meshes.push({ name: o.userData.model || o.name || 'mesh', primitives: [{ attributes, material: material(o.material) }] });
    json.nodes.push({ name: o.userData.model || o.name || 'node', mesh: json.meshes.length - 1 });
    json.scenes[0].nodes.push(json.nodes.length - 1);
    g.dispose();
  });

  const pad4 = (n) => (4 - (n % 4)) % 4;
  length += pad4(length);
  json.buffers[0].byteLength = length;
  const bin = new Uint8Array(length);
  let off = 0;
  for (const p of parts) { bin.set(p, off); off += p.byteLength; }
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jp = pad4(jsonBytes.length);
  if (jp) { const j = new Uint8Array(jsonBytes.length + jp).fill(0x20); j.set(jsonBytes); jsonBytes = j; }
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jsonBytes.length).set(jsonBytes);
  const b = 20 + jsonBytes.length;
  dv.setUint32(b, bin.length, true); dv.setUint32(b + 4, 0x004e4942, true);
  new Uint8Array(out, b + 8, bin.length).set(bin);
  return out;
}
