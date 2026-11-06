// Map environment in 3D: painted ash ground, dark shore/water around the map, merged decorative props.
// Ground texture is painted once on a CPU canvas (render-guard rule 1: survives a GPU-process restart).
// Props are decorative and never block movement in the MVP (01_GDD §11); all static props = one draw call.
import * as THREE from '../../lib/three.module.js';
import { cpuCanvas } from './render-guard.js';
import { SeededRandom } from '../core/SeededRandom.js';
import { mergeParts, propParts, PROP_KINDS, tag } from './models.js';
import { KIOSK } from '../data/kiosk.js';

const TEX_W = 2048;

function paintGround(mapW, mapH, seed) {
  const texH = Math.round((TEX_W * mapH) / mapW);
  const { canvas, g } = cpuCanvas(TEX_W, texH);
  const k = TEX_W / mapW; // texture px per world unit
  const rng = new SeededRandom(seed);
  g.scale(k, k);

  const grad = g.createRadialGradient(mapW / 2, mapH / 2, 80, mapW / 2, mapH / 2, mapW * 0.62);
  grad.addColorStop(0, '#3a3e46');
  grad.addColorStop(0.55, '#2f3239');
  grad.addColorStop(1, '#23262c');
  g.fillStyle = grad;
  g.fillRect(0, 0, mapW, mapH);

  // ash speckles
  for (let i = 0; i < 14000; i++) {
    const v = 34 + Math.floor(rng.next() * 46);
    g.fillStyle = `rgba(${v},${v + 3},${v + 8},0.55)`;
    const s = 1.2 + rng.next() * 1.8;
    g.fillRect(rng.next() * mapW, rng.next() * mapH, s, s);
  }
  // moss patches
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(52,70,58,${0.18 + rng.next() * 0.2})`;
    g.beginPath();
    g.ellipse(rng.next() * mapW, rng.next() * mapH, 20 + rng.next() * 70, 12 + rng.next() * 34, rng.next() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // wet dark patches
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(16,20,26,0.35)';
    g.beginPath();
    g.ellipse(rng.next() * mapW, rng.next() * mapH, 30 + rng.next() * 80, 20 + rng.next() * 40, rng.next() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // cracks
  g.strokeStyle = 'rgba(14,16,20,0.55)';
  g.lineWidth = 1.6;
  for (let i = 0; i < 90; i++) {
    let x = rng.next() * mapW, y = rng.next() * mapH;
    g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (rng.next() - 0.5) * 50; y += (rng.next() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  // old stone plaza in the centre (the beacon stands here from Phase 3)
  g.save();
  g.translate(mapW / 2, mapH / 2);
  g.fillStyle = 'rgba(70,74,82,0.35)';
  g.beginPath(); g.arc(0, 0, 190, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(160,168,180,0.16)';
  g.lineWidth = 4;
  for (const r of [70, 125, 190]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(ang) * 70, Math.sin(ang) * 70); g.lineTo(Math.cos(ang) * 190, Math.sin(ang) * 190); g.stroke();
  }
  g.restore();
  // worn paths from the plaza to the four sides
  g.strokeStyle = 'rgba(78,74,66,0.22)';
  g.lineWidth = 46;
  g.lineCap = 'round';
  for (const [x, y] of [[mapW / 2, 20], [mapW / 2, mapH - 20], [20, mapH / 2], [mapW - 20, mapH / 2]]) {
    g.beginPath(); g.moveTo(mapW / 2, mapH / 2); g.lineTo(x, y); g.stroke();
  }
  // shore darkening at the edges
  const edge = 70;
  for (const [x, y, w, h, x0, y0, x1, y1] of [
    [0, 0, mapW, edge, 0, 0, 0, edge], [0, mapH - edge, mapW, edge, 0, mapH, 0, mapH - edge],
    [0, 0, edge, mapH, 0, 0, edge, 0], [mapW - edge, 0, edge, mapH, mapW, 0, mapW - edge, 0],
  ]) {
    const lg = g.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, 'rgba(8,12,16,0.75)');
    lg.addColorStop(1, 'rgba(8,12,16,0)');
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
  }
  return canvas;
}

/**
 * @param {{width:number,height:number,artSeed:number,playerSpawn:{x:number,y:number}}} map
 * @returns {{group: THREE.Group, groundTexture: THREE.Texture, dispose: () => void}}
 */
export function buildEnvironment(map, materials, { merge = true } = {}) {
  const group = new THREE.Group();
  const mapW = map.width, mapH = map.height;

  // Ground
  const tex = new THREE.CanvasTexture(paintGround(mapW, mapH, map.artSeed));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const groundMat = new THREE.MeshLambertMaterial({ map: tex });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapH), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(mapW / 2, 0, mapH / 2);
  ground.receiveShadow = true;
  group.add(tag(ground, 'ground'));

  // Dark shallow water / wet rock around the map (decorative surround, also under the fog)
  const shoreMat = new THREE.MeshLambertMaterial({ color: 0x0d151c });
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(mapW + 3000, mapH + 3000), shoreMat);
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(mapW / 2, -2, mapH / 2);
  group.add(shore);

  // Props: border rocks along the map edge + scattered ruins/rocks/stumps/posts (never on the plaza or spawn)
  const rng = new SeededRandom(map.artSeed ^ 0x5bd1e995);
  const parts = [];
  const step = 70;
  for (let x = 0; x <= mapW; x += step) {
    parts.push(...propParts('rock', rng, x + (rng.next() - 0.5) * 30, -18 - rng.next() * 30));
    parts.push(...propParts('rock', rng, x + (rng.next() - 0.5) * 30, mapH + 18 + rng.next() * 30));
  }
  for (let y = step; y < mapH; y += step) {
    parts.push(...propParts('rock', rng, -18 - rng.next() * 30, y + (rng.next() - 0.5) * 30));
    parts.push(...propParts('rock', rng, mapW + 18 + rng.next() * 30, y + (rng.next() - 0.5) * 30));
  }
  const cx = mapW / 2, cy = mapH / 2;
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 46; tries++) {
    const x = 60 + rng.next() * (mapW - 120), y = 60 + rng.next() * (mapH - 120);
    if (Math.hypot(x - cx, y - cy) < KIOSK.maxDistFromBeacon + 50) continue;          // plaza + kiosk zone (D39)
    if (Math.hypot(x - map.playerSpawn.x, y - map.playerSpawn.y) < 120) continue;    // spawn
    if (Math.abs(x - cx) < 40 || Math.abs(y - cy) < 40) continue;                     // keep the four paths clear
    parts.push(...propParts(PROP_KINDS[Math.floor(rng.next() * PROP_KINDS.length)], rng, x, y));
    placed++;
  }
  const props = new THREE.Mesh(mergeParts(parts), materials.prop);
  props.castShadow = true;
  props.receiveShadow = true;
  group.add(tag(props, 'props'));

  return {
    group,
    groundTexture: tex,
    dispose() {
      ground.geometry.dispose(); groundMat.dispose(); tex.dispose();
      shore.geometry.dispose(); shoreMat.dispose();
      props.geometry.dispose();
    },
  };
}
