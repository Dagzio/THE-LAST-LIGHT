// KILL LIST — dev tool (constants.js → DEBUG_MODELS): 3D model viewer (H5 guide engines/asset-viewer-3d.md).
// A "3D models" button in the main menu opens a window with every character animation (the user's hero / enemy
// models + the converted Mixamo clips, exactly as the game builds them) and every office prop (render3d/officeProps.js)
// on its own, with size / triangle info and a PNG snapshot. Dev only — MUST be off in a release.
import * as THREE from '../../lib/three.module.js';
import { PropBuilder, PROP_BUILDERS } from '../render3d/officeProps.js';
import { officeMaterials } from '../render3d/OfficeScene.js';
import { PROP_TYPES, propBlocks } from '../data/props.js';

const CLIPS = ['idle', 'walk', 'run', 'back', 'strafeL', 'strafeR', 'fire', 'reload', 'hit', 'throw', 'pIdle', 'pWalk', 'pRun', 'die', 'die2'];
const CSS = `
#dbg-models-btn { position: fixed; right: max(30px, env(safe-area-inset-right)); bottom: 30px; z-index: 9000;
  font: 800 13px/1 system-ui, sans-serif; color: #fff; background: rgba(10, 20, 40, .82); border: 1px dashed #ffd166;
  border-radius: 8px; padding: 9px 12px; cursor: pointer; display: none; }
body[data-screen="menu"] #dbg-models-btn { display: block; }
#dbg-models { position: fixed; inset: 0; z-index: 9001; display: flex; background: #121a26; color: #e6eef8;
  font: 13px/1.35 system-ui, sans-serif; user-select: text; }
#dbg-models aside { width: 230px; flex: 0 0 auto; overflow-y: auto; padding: 12px; background: #0c121b; border-right: 1px solid #263345; }
#dbg-models h3 { font-size: 14px; margin: 2px 0 10px; color: #ffd166; }
#dbg-models h4 { font-size: 12px; margin: 10px 0 6px; color: #8fb3e0; text-transform: uppercase; }
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
  btn.title = 'DEBUG: model / animation viewer';
  btn.dataset.nosfx = '';
  btn.addEventListener('click', open);
  document.body.appendChild(btn);
}

async function open() {
  if (document.getElementById('dbg-models')) return;
  const r3 = window.__game && window.__game.renderer3d;
  if (r3) await r3.assetsReady;
  const el = document.createElement('div');
  el.id = 'dbg-models';
  el.innerHTML = `<aside><h3>Models (debug)</h3><div class="list"></div></aside>
    <main><canvas></canvas><div class="bar"><div class="info"></div><button class="png">PNG</button><button class="x">Close</button></div>
    <div class="hint">drag — rotate · wheel — zoom · double-click — reset</div></main>`;
  document.body.appendChild(el);
  const canvas = el.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a3140);
  scene.add(new THREE.HemisphereLight(0xe2ebff, 0x2b2722, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1de, 1.5);
  sun.position.set(200, 400, 300);
  scene.add(sun);
  const grid = new THREE.GridHelper(300, 10, 0x55606e, 0x3a4350);
  scene.add(grid);
  const cam = new THREE.PerspectiveCamera(35, 1, 1, 5000);
  const orbit = { yaw: 0.7, pitch: 0.35, dist: 180, target: new THREE.Vector3(0, 25, 0) };
  let current = null, view = null, clipName = '', last = performance.now(), raf = 0;

  const entries = [];
  for (const key of ['hero', 'enemy']) for (const c of CLIPS) entries.push({ group: key === 'hero' ? 'Hero (player.glb)' : 'Enemy (enemy.glb)', name: `${key} · ${c}`, kind: 'human', key, clip: c });
  for (const type of Object.keys(PROP_BUILDERS)) entries.push({ group: 'Office props', name: type, kind: 'prop', type });
  const list = el.querySelector('.list');
  let lastGroup = '';
  for (const e of entries) {
    if (e.group !== lastGroup) { const h = document.createElement('h4'); h.textContent = e.group; list.appendChild(h); lastGroup = e.group; }
    const b = document.createElement('button');
    b.textContent = e.name;
    b.addEventListener('click', () => { list.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); show(e); });
    list.appendChild(b);
    e.btn = b;
  }

  function clear() {
    if (view) { view.dispose(); view = null; }
    if (current) { scene.remove(current); current.traverse((o) => { if (o.isMesh && o.userData.own) o.geometry.dispose(); }); current = null; }
  }

  function show(e) {
    clear();
    const info = el.querySelector('.info');
    if (e.kind === 'human') {
      const tpl = r3 && r3.templates && r3.templates[e.key];
      if (!tpl) { info.textContent = 'model not loaded'; return; }
      view = tpl.instantiate(new THREE.MeshLambertMaterial({ map: tpl.texture }));
      for (const [id, g] of Object.entries(r3.gunGeos || {})) view.addGun(id, g.geometry, g.material);
      view.setGun(e.clip.startsWith('p') ? 'pistol' : e.key === 'hero' ? 'smg' : 'rifle');
      for (const a of [...Object.values(view.L), ...Object.values(view.U), view.die]) a.setEffectiveWeight(0);
      const C = tpl.clips[e.clip];
      const act = view.mixer.clipAction(C.full);
      act.reset().play();
      act.timeScale = 1;
      act.setEffectiveWeight(1);
      clipName = e.clip;
      current = view.group;
      scene.add(current);
      orbit.target.set(0, 28, 0); orbit.dist = 150;
      const tris = (view.mesh.geometry.index ? view.mesh.geometry.index.count : view.mesh.geometry.attributes.position.count) / 3;
      info.textContent = `${e.name}\nheight ${tpl.height} units · ${Math.round(tris)} triangles · ${tpl.skeleton.bones.length} bones\nclip ${C.duration.toFixed(2)} s · root speed ${(tpl.rootSpeed[e.clip] || 0).toFixed(1)} units/s · gun yaw ${(tpl.mounts[view.set].yaw * 57.3).toFixed(1)}°`;
    } else {
      const b = new PropBuilder();
      b.place(0, 0, 0);
      PROP_BUILDERS[e.type](b);
      const mats = officeMaterials();
      const g = new THREE.Group();
      let tris = 0;
      for (const [k, parts] of b.parts) for (const geo of parts) { const m = new THREE.Mesh(geo, mats[k] || mats.metal); m.userData.own = true; g.add(m); tris += geo.attributes.position.count / 3; }
      current = g;
      scene.add(g);
      const T = PROP_TYPES[e.type] || { w: 40, d: 40, h: 40 };
      orbit.target.set(0, T.h / 2, 0); orbit.dist = Math.max(80, Math.max(T.w, T.d, T.h) * 2.4);
      info.textContent = `${e.name}\nfootprint ${T.w} × ${T.d}, height ${T.h} units · blocks ${['—', 'move', '', 'move+bullets', '', '', '', 'move+bullets+sight'][propBlocks(T)] || propBlocks(T)} · ${Math.round(tris)} triangles · ${b.parts.size} materials`;
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (view) view.mixer.update(dt);
    const cp = Math.cos(orbit.pitch);
    cam.position.set(orbit.target.x + Math.sin(orbit.yaw) * cp * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * cp * orbit.dist);
    cam.lookAt(orbit.target);
    renderer.render(scene, cam);
  }
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    orbit.yaw -= (e.clientX - drag.x) * 0.01;
    orbit.pitch = Math.max(-0.2, Math.min(1.45, orbit.pitch + (e.clientY - drag.y) * 0.01));
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(30, Math.min(1500, orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  canvas.addEventListener('dblclick', () => { orbit.yaw = 0.7; orbit.pitch = 0.35; });
  el.querySelector('.png').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `killlist-${clipName || 'model'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
  el.querySelector('.x').addEventListener('click', () => {
    cancelAnimationFrame(raf);
    clear();
    renderer.dispose();
    el.remove();
  });
  entries[0].btn.click();
  raf = requestAnimationFrame(frame);
}
