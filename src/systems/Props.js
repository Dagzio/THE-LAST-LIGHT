// Map decor layout (pure data, no three.js): the SAME descriptors drive the 3D geometry (render3d/models.js) and the
// collision circles (systems/Collision.js), so what you see is exactly what blocks (user decision D40: every object
// collides — decor, beacon, pads, kiosk). Deterministic per map (artSeed).
import { SeededRandom } from '../core/SeededRandom.js';
import { KIOSK } from '../data/kiosk.js';

export const PROP_KINDS = ['rock', 'ruin', 'stump', 'post'];

/** Rolls every random parameter of one prop up front (geometry + colliders read the descriptor only). */
export function rollProp(kind, rng, x, y) {
  const r = () => rng.next();
  if (kind === 'rock') {
    const s = 10 + r() * 22;
    return { kind, x, y, s, dark: r() < 0.5, rx: r() * 3, ry: r() * 3, sy: 0.55 + r() * 0.3, twin: r() < 0.5, twinRy: r() * 3 };
  }
  if (kind === 'ruin') return { kind, x, y, w: 18 + r() * 26, h: 14 + r() * 26, d: 10 + r() * 8, ry: r() * Math.PI, blockRy: r() };
  if (kind === 'stump') return { kind, x, y, h: 10 + r() * 18 };
  return { kind: 'post', x, y, h: 16 + r() * 12, rz: (r() - 0.5) * 0.4 };
}

/** Border rocks along the edges + scattered props (never on the plaza / kiosk zone, the spawn or the four paths). */
export function layoutProps(map) {
  const rng = new SeededRandom(map.artSeed ^ 0x5bd1e995);
  const mapW = map.width, mapH = map.height;
  const out = [];
  const step = 70;
  for (let x = 0; x <= mapW; x += step) {
    out.push(rollProp('rock', rng, x + (rng.next() - 0.5) * 30, -18 - rng.next() * 30));
    out.push(rollProp('rock', rng, x + (rng.next() - 0.5) * 30, mapH + 18 + rng.next() * 30));
  }
  for (let y = step; y < mapH; y += step) {
    out.push(rollProp('rock', rng, -18 - rng.next() * 30, y + (rng.next() - 0.5) * 30));
    out.push(rollProp('rock', rng, mapW + 18 + rng.next() * 30, y + (rng.next() - 0.5) * 30));
  }
  const cx = map.beacon.x, cy = map.beacon.y;
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 46; tries++) {
    const x = 60 + rng.next() * (mapW - 120), y = 60 + rng.next() * (mapH - 120);
    if (Math.hypot(x - cx, y - cy) < KIOSK.maxDistFromBeacon + 50) continue;           // plaza + kiosk zone
    if (Math.hypot(x - map.playerSpawn.x, y - map.playerSpawn.y) < 120) continue;      // spawn
    if (Math.abs(x - cx) < 40 || Math.abs(y - cy) < 40) continue;                       // the four paths stay clear
    out.push(rollProp(PROP_KINDS[Math.floor(rng.next() * PROP_KINDS.length)], rng, x, y));
    placed++;
  }
  return out;
}

/** Collision circles of a prop, in map coordinates (x, y on the ground). */
export function propColliders(p) {
  const c = [];
  if (p.kind === 'rock') {
    c.push({ x: p.x, y: p.y, r: p.s * 0.85 });
    if (p.twin) c.push({ x: p.x + p.s * 0.8, y: p.y + p.s * 0.3, r: p.s * 0.4 });
  } else if (p.kind === 'ruin') {
    // a wall segment rotated by ry: circles along its long axis (3D rotation.y = ry → axis (cos ry, −sin ry))
    const ax = Math.cos(p.ry), ay = -Math.sin(p.ry);
    const rad = p.d / 2 + 1;
    const n = Math.max(1, Math.ceil(p.w / p.d));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : -p.w / 2 + rad + (i * (p.w - 2 * rad)) / (n - 1);
      c.push({ x: p.x + ax * t, y: p.y + ay * t, r: rad });
    }
    c.push({ x: p.x - p.w * 0.7, y: p.y + 9, r: 5.5 }); // fallen block
  } else if (p.kind === 'stump') {
    c.push({ x: p.x, y: p.y, r: 7 });
  } else {
    c.push({ x: p.x, y: p.y, r: 3 });
    for (const dx of [6, 14, 22]) c.push({ x: p.x + dx, y: p.y, r: 2.5 }); // crossbar
  }
  return c;
}
