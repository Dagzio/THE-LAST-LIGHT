// Ground painter of a campaign map (Canvas 2D, world units). One source for the 3D ground texture
// (render3d/Environment.js) and the map-select preview (UIManager), so the preview shows the real map.
// Themes come from data/themes.js; map 1 ('ash') paints exactly like before D45 (same RNG order).
import { SeededRandom } from '../core/SeededRandom.js';
import { getTheme } from '../data/themes.js';

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/**
 * Paints the ground of `map` into `g`, which must already be scaled so that 1 unit = 1 world unit.
 * @param {CanvasRenderingContext2D} g
 * @param {object} map entry of data/maps.js
 * @param {{detail?:number}} [opt] detail < 1 thins out the speckles (small previews)
 */
export function paintMapGround(g, map, { detail = 1 } = {}) {
  const T = getTheme(map.theme);
  const mapW = map.width, mapH = map.height;
  const bx = map.beacon.x, by = map.beacon.y;
  const rng = new SeededRandom(map.artSeed);

  const grad = g.createRadialGradient(mapW / 2, mapH / 2, 80, mapW / 2, mapH / 2, mapW * 0.62);
  grad.addColorStop(0, T.ground[0]);
  grad.addColorStop(0.55, T.ground[1]);
  grad.addColorStop(1, T.ground[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, mapW, mapH);

  // speckles (ash / sand / needles / snow grains)
  const sp = T.speckle;
  const n = Math.round(sp.count * detail);
  for (let i = 0; i < n; i++) {
    const v = sp.base + Math.floor(rng.next() * sp.range);
    g.fillStyle = `rgba(${v + sp.tint[0]},${v + sp.tint[1]},${v + sp.tint[2]},0.55)`;
    const s = 1.2 + rng.next() * 1.8;
    g.fillRect(rng.next() * mapW, rng.next() * mapH, s, s);
  }
  // soft patches (moss, tide pools, salt, ice …)
  for (const P of T.patches) {
    for (let i = 0; i < P.count; i++) {
      g.fillStyle = rgba(P.color, P.alpha[1] > 0 ? P.alpha[0] + rng.next() * P.alpha[1] : P.alpha[0]);
      g.beginPath();
      g.ellipse(rng.next() * mapW, rng.next() * mapH, P.rx[0] + rng.next() * (P.rx[1] - P.rx[0]), P.ry[0] + rng.next() * (P.ry[1] - P.ry[0]), rng.next() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }
  // cracks
  g.strokeStyle = T.cracks.color;
  g.lineWidth = 1.6;
  for (let i = 0; i < T.cracks.count; i++) {
    let x = rng.next() * mapW, y = rng.next() * mapH;
    g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (rng.next() - 0.5) * 50; y += (rng.next() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  // salt-marsh pools (the slow zones — painted exactly where they slow)
  if (map.slowZones && T.pool) {
    for (const z of map.slowZones) {
      g.save();
      g.translate(z.x, z.y);
      g.fillStyle = T.pool.rim;
      g.beginPath(); g.ellipse(0, 0, z.r + 10, z.r * 0.92 + 9, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = T.pool.fill;
      g.beginPath(); g.ellipse(0, 0, z.r, z.r * 0.92, 0.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = T.pool.shine;
      g.lineWidth = 3;
      for (const k of [0.45, 0.7]) { g.beginPath(); g.ellipse(-z.r * 0.15, -z.r * 0.2, z.r * k, z.r * k * 0.5, 0.3, 3.6, 5.2); g.stroke(); }
      g.restore();
    }
  }
  if (T.plaza === 'deck') paintDeck(g, map, rng);
  else paintStonePlaza(g, bx, by);
  // worn paths from the plaza to every side enemies come from
  g.strokeStyle = T.path;
  g.lineWidth = 46;
  g.lineCap = 'round';
  const sides = { north: [bx, 20], south: [bx, mapH - 20], west: [20, by], east: [mapW - 20, by] };
  for (const key of ['north', 'south', 'west', 'east']) {
    if (!map.spawnPoints[key]) continue;
    const [x, y] = sides[key];
    g.beginPath(); g.moveTo(bx, by); g.lineTo(x, y); g.stroke();
  }
  // shore darkening at the edges (the sea side of the pier gets a wet, foamy edge instead)
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
  if (map.decor && map.decor.seaSouth) {
    g.strokeStyle = 'rgba(190,210,220,0.18)';
    g.lineWidth = 3;
    for (let x = 0; x < mapW; x += 26) {
      g.beginPath(); g.moveTo(x, mapH - 6 - Math.sin(x * 0.05) * 3); g.lineTo(x + 18, mapH - 5 - Math.sin((x + 18) * 0.05) * 3); g.stroke();
    }
  }
}

function paintStonePlaza(g, bx, by) {
  g.save();
  g.translate(bx, by);
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
}

/** Drowned Pier: a plank deck around the beacon that runs on to the sea edge, plus a boardwalk to the north. */
function paintDeck(g, map, rng) {
  const bx = map.beacon.x, by = map.beacon.y, mapH = map.height;
  const planks = (x0, y0, w, h, vertical) => {
    g.fillStyle = 'rgba(92,70,50,0.82)';
    g.fillRect(x0, y0, w, h);
    g.strokeStyle = 'rgba(30,22,16,0.7)';
    g.lineWidth = 2;
    const step = 16;
    if (vertical) for (let x = x0; x <= x0 + w; x += step) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke(); }
    else for (let y = y0; y <= y0 + h; y += step) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); }
    // weathered boards
    for (let i = 0; i < (w * h) / 2600; i++) {
      g.fillStyle = `rgba(${40 + Math.floor(rng.next() * 40)},${30 + Math.floor(rng.next() * 26)},20,0.35)`;
      if (vertical) g.fillRect(x0 + Math.floor(rng.next() * (w / step)) * step + 1, y0 + rng.next() * h, step - 2, 20 + rng.next() * 60);
      else g.fillRect(x0 + rng.next() * w, y0 + Math.floor(rng.next() * (h / step)) * step + 1, 20 + rng.next() * 60, step - 2);
    }
  };
  planks(bx - 270, by - 180, 540, mapH - (by - 180), true);   // the pier head, down to the sea
  planks(bx - 40, 180, 80, by - 180 - 180, true);             // boardwalk to the north
  g.strokeStyle = 'rgba(20,14,10,0.6)';
  g.lineWidth = 6;
  g.strokeRect(bx - 270, by - 180, 540, mapH - (by - 180) + 10);
}

/**
 * Small preview for the map-select card: ground + decor dots + beacon (Canvas 2D, any size).
 * @param {HTMLCanvasElement} canvas
 * @param {object} map
 * @param {Array<{kind:string,x:number,y:number}>} props layout (systems/Props.js)
 */
export function drawMapPreview(canvas, map, props) {
  const g = canvas.getContext('2d');
  const T = getTheme(map.theme);
  g.fillStyle = T.shore;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const s = Math.min(canvas.width / map.width, canvas.height / map.height) * 1.08; // fill the square, crop the sides
  g.save();
  g.translate(canvas.width / 2 - (map.width * s) / 2, canvas.height / 2 - (map.height * s) / 2);
  g.scale(s, s);
  paintMapGround(g, map, { detail: 0.35 });
  const dark = { pine: '#16261b', deadtree: '#2a2018', reeds: '#4b5232', saltrock: '#9a9886', icespike: '#a9c9e6', snowrock: '#c6d0dc', basalt: '#120f10', ember: '#5a2416', crate: '#5a3e26', barrel: '#4a3322', planks: '#5d4430', bollard: '#2b2622' };
  for (const p of props) {
    g.fillStyle = dark[p.kind] || '#1d2026';
    const r = p.kind === 'pine' ? p.cr : p.kind === 'rock' || p.kind.endsWith('rock') || p.kind === 'ember' ? p.s : 12;
    g.beginPath(); g.arc(p.x, p.y, Math.max(8, r), 0, Math.PI * 2); g.fill();
  }
  // beacon glow + tower
  const gl = g.createRadialGradient(map.beacon.x, map.beacon.y, 10, map.beacon.x, map.beacon.y, 260);
  gl.addColorStop(0, 'rgba(255,200,120,0.55)');
  gl.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gl;
  g.beginPath(); g.arc(map.beacon.x, map.beacon.y, 260, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3e7cf';
  g.beginPath(); g.arc(map.beacon.x, map.beacon.y, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c0392b';
  g.beginPath(); g.arc(map.beacon.x, map.beacon.y, 22, 0, Math.PI * 2); g.fill();
  g.restore();
}
