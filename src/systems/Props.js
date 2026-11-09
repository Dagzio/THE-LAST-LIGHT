// Map decor layout (pure data, no three.js): the SAME descriptors drive the 3D geometry (render3d/models.js) and the
// collision circles (systems/Collision.js), so what you see is exactly what blocks (user decision D40: every object
// collides — decor, beacon, pads, kiosk). Deterministic per map (artSeed); the decor config lives in data/maps.js.
// Map 1 keeps its exact original layout (same RNG sequence); the extra rules below apply only when a map asks for them.
import { SeededRandom } from '../core/SeededRandom.js';
import { inSlowZone } from '../data/maps.js';

export const PROP_KINDS = [
  'rock', 'ruin', 'stump', 'post',                       // Ashen Coast
  'crate', 'barrel', 'bollard', 'planks',                // Drowned Pier
  'pine', 'deadtree',                                    // Pine Hollow
  'reeds', 'saltrock',                                   // Salt Marsh
  'icespike', 'snowrock',                                // Frost Ridge
  'basalt', 'ember',                                     // Black Lighthouse
];

/** Rolls every random parameter of one prop up front (geometry + colliders read the descriptor only). */
export function rollProp(kind, rng, x, y) {
  const r = () => rng.next();
  switch (kind) {
    case 'rock': case 'saltrock': case 'snowrock': case 'ember': {
      const s = 10 + r() * 22;
      return { kind, x, y, s, dark: r() < 0.5, rx: r() * 3, ry: r() * 3, sy: 0.55 + r() * 0.3, twin: r() < 0.5, twinRy: r() * 3 };
    }
    case 'ruin': return { kind, x, y, w: 18 + r() * 26, h: 14 + r() * 26, d: 10 + r() * 8, ry: r() * Math.PI, blockRy: r() };
    case 'stump': return { kind, x, y, h: 10 + r() * 18 };
    case 'post': return { kind: 'post', x, y, h: 16 + r() * 12, rz: (r() - 0.5) * 0.4 };
    case 'crate': return { kind, x, y, s: 9 + r() * 5, ry: r() * Math.PI, stack: r() < 0.45, topRy: r() };
    case 'barrel': return { kind, x, y, r: 7 + r() * 2.5, h: 16 + r() * 5, pair: r() < 0.45, pairA: r() * Math.PI * 2 };
    case 'bollard': return { kind, x, y, h: 12 + r() * 6, rope: r() < 0.5 };
    case 'planks': return { kind, x, y, w: 30 + r() * 22, ry: r() * Math.PI, n: 2 + Math.floor(r() * 3) };
    case 'pine': return { kind, x, y, h: 70 + r() * 50, cr: 20 + r() * 10, tilt: (r() - 0.5) * 0.08, shade: r() };
    case 'deadtree': return { kind, x, y, h: 36 + r() * 30, ry: r() * Math.PI * 2, lean: (r() - 0.5) * 0.3 };
    case 'reeds': return { kind, x, y, s: 12 + r() * 9, n: 5 + Math.floor(r() * 4), seed: r() };
    case 'icespike': return { kind, x, y, h: 28 + r() * 38, w: 7 + r() * 5, n: 2 + Math.floor(r() * 2), ry: r() * Math.PI * 2 };
    case 'basalt': return { kind, x, y, h: 22 + r() * 48, w: 8 + r() * 5, n: 2 + Math.floor(r() * 3), ry: r() * Math.PI * 2 };
    default: return { kind: 'post', x, y, h: 16 + r() * 12, rz: (r() - 0.5) * 0.4 };
  }
}

const cache = new WeakMap(); // map object → its prop list (maps are static data; layout is pure)

/** Border props along the edges + scattered props (never on the plaza / kiosk zone, the spawn or the paths). */
export function layoutProps(map) {
  let out = cache.get(map);
  if (out) return out;
  out = buildLayout(map);
  cache.set(map, out);
  return out;
}

function buildLayout(map) {
  const D = map.decor || { count: 46, clear: 500, kinds: ['rock', 'ruin', 'stump', 'post'], border: 'rock' };
  const rng = new SeededRandom(map.artSeed ^ 0x5bd1e995);
  const mapW = map.width, mapH = map.height;
  const out = [];
  const step = D.border === 'pine' ? 46 : 70; // the forest edge is denser
  const sides = D.borderSides || ['north', 'south', 'west', 'east'];
  const has = (s) => sides.includes(s);
  const border = D.border || 'rock';
  // Same RNG order as the original map-1 code: per x — top then bottom; per y — left then right.
  for (let x = 0; x <= mapW; x += step) {
    const a = rollProp(border, rng, x + (rng.next() - 0.5) * 30, -18 - rng.next() * 30);
    const b = rollProp(border, rng, x + (rng.next() - 0.5) * 30, mapH + 18 + rng.next() * 30);
    if (has('north')) out.push(a);
    if (has('south')) out.push(b);
  }
  for (let y = step; y < mapH; y += step) {
    const a = rollProp(border, rng, -18 - rng.next() * 30, y + (rng.next() - 0.5) * 30);
    const b = rollProp(border, rng, mapW + 18 + rng.next() * 30, y + (rng.next() - 0.5) * 30);
    if (has('west')) out.push(a);
    if (has('east')) out.push(b);
  }
  if (D.seaSouth) { // Drowned Pier: old mooring posts standing in the shallow water south of the map
    for (let x = 40; x < mapW; x += 120) out.push(rollProp('bollard', rng, x + (rng.next() - 0.5) * 40, mapH + 40 + rng.next() * 40));
  }

  const cx = map.beacon.x, cy = map.beacon.y;
  const pathHalf = D.pathHalf || 40;
  const spawns = D.clearSpawns === false || !map.featureKey ? [] : Object.values(map.spawnPoints).flat();
  const kinds = D.kinds;
  let placed = 0;
  for (let tries = 0; tries < D.count * 9 && placed < D.count; tries++) {
    const x = 60 + rng.next() * (mapW - 120), y = 60 + rng.next() * (mapH - 120);
    if (Math.hypot(x - cx, y - cy) < D.clear) continue;                                 // plaza + kiosk zone
    if (Math.hypot(x - map.playerSpawn.x, y - map.playerSpawn.y) < 120) continue;      // spawn
    if (Math.abs(x - cx) < pathHalf || Math.abs(y - cy) < pathHalf) continue;          // the four paths stay clear
    if (spawns.some((s) => Math.hypot(x - s.x, y - s.y) < 90)) continue;               // enemy entry points (maps 2–6)
    if (inSlowZone(map, x, y) || (map.slowZones && map.slowZones.some((z) => Math.hypot(x - z.x, y - z.y) < z.r + 24))) continue;
    out.push(rollProp(kinds[Math.floor(rng.next() * kinds.length)], rng, x, y));
    placed++;
  }
  // Groves (Pine Hollow): fixed tree clusters inside the clearing — they block bullets and turret sight on purpose
  for (const gr of D.groves || []) {
    for (let i = 0; i < gr.n; i++) {
      const a = (i / gr.n) * Math.PI * 2 + rng.next() * 0.8;
      const d = gr.n === 1 ? 0 : 24 + rng.next() * 12;
      out.push(rollProp('pine', rng, gr.x + Math.cos(a) * d, gr.y + Math.sin(a) * d));
    }
  }
  // Entry lanes (2026-11-09, all maps): from every spawn point towards the beacon the first stretch stays free of
  // scattered decor, wide enough for the biggest boss — enemies used to wedge between a prop and the border rocks
  // right where they enter. Filtering after the rolls keeps every other prop exactly where it was.
  const lanes = Object.values(map.spawnPoints).flat().map((s) => {
    const dx = cx - s.x, dy = cy - s.y, d = Math.hypot(dx, dy) || 1;
    return { x: s.x, y: s.y, ux: dx / d, uy: dy / d };
  });
  const borderCount = out.length - placed - (D.groves || []).reduce((n, g) => n + g.n, 0);
  return out.filter((p, i) => i < borderCount || !propColliders(p).some((c) => lanes.some((l) => inLane(l, c))));
}

const LANE = { length: 220, half: 60 }; // world units: half-width ≥ the biggest boss radius (52) + margin

function inLane(l, c) {
  const rx = c.x - l.x, ry = c.y - l.y;
  const along = rx * l.ux + ry * l.uy;
  if (along < -c.r - LANE.half || along > LANE.length + c.r) return false;
  const side = Math.abs(rx * -l.uy + ry * l.ux);
  return side < LANE.half + c.r;
}

/** Collision circles of a prop, in map coordinates (x, y on the ground). */
export function propColliders(p) {
  const c = [];
  switch (p.kind) {
    case 'rock': case 'saltrock': case 'snowrock': case 'ember':
      c.push({ x: p.x, y: p.y, r: p.s * 0.85 });
      if (p.twin) c.push({ x: p.x + p.s * 0.8, y: p.y + p.s * 0.3, r: p.s * 0.4 });
      break;
    case 'ruin': {
      // a wall segment rotated by ry: circles along its long axis (3D rotation.y = ry → axis (cos ry, −sin ry))
      const ax = Math.cos(p.ry), ay = -Math.sin(p.ry);
      const rad = p.d / 2 + 1;
      const n = Math.max(1, Math.ceil(p.w / p.d));
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : -p.w / 2 + rad + (i * (p.w - 2 * rad)) / (n - 1);
        c.push({ x: p.x + ax * t, y: p.y + ay * t, r: rad });
      }
      c.push({ x: p.x - p.w * 0.7, y: p.y + 9, r: 5.5 }); // fallen block
      break;
    }
    case 'stump': c.push({ x: p.x, y: p.y, r: 7 }); break;
    case 'crate': c.push({ x: p.x, y: p.y, r: p.s * 1.25 }); break;
    case 'barrel':
      c.push({ x: p.x, y: p.y, r: p.r + 1 });
      if (p.pair) c.push({ x: p.x + Math.cos(p.pairA) * p.r * 2.1, y: p.y + Math.sin(p.pairA) * p.r * 2.1, r: p.r + 1 });
      break;
    case 'bollard': c.push({ x: p.x, y: p.y, r: 6 }); break;
    case 'planks': {
      const ax = Math.cos(p.ry), ay = -Math.sin(p.ry);
      for (const t of [-p.w / 3, 0, p.w / 3]) c.push({ x: p.x + ax * t, y: p.y + ay * t, r: 7 });
      break;
    }
    case 'pine': c.push({ x: p.x, y: p.y, r: p.cr * 0.55 }); break;
    case 'deadtree': c.push({ x: p.x, y: p.y, r: 7 }); break;
    case 'reeds': c.push({ x: p.x, y: p.y, r: p.s * 0.6 }); break;
    case 'icespike': case 'basalt': c.push({ x: p.x, y: p.y, r: p.w * (p.n > 2 ? 1.7 : 1.4) }); break;
    default: // post
      c.push({ x: p.x, y: p.y, r: 3 });
      for (const dx of [6, 14, 22]) c.push({ x: p.x + dx, y: p.y, r: 2.5 }); // crossbar
  }
  return c;
}

/** All decor colliders of a map (kiosk / crate placement checks). */
export function mapColliders(map) {
  const out = [];
  for (const p of layoutProps(map)) for (const c of propColliders(p)) out.push(c);
  return out;
}
