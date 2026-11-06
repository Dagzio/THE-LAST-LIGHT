// Static collision world (D40): circles for the beacon, build pads (+ devices), kiosk and all decor. Not a physics
// engine — bodies are pushed out of circles; straight-line walkers slide around obstacles (no pathfinding, rule 14).
// Bullets stop at the first circle on their segment. A uniform grid keeps queries local (weak phones).
import { layoutProps, propColliders } from './Props.js';

const CELL = 128;
const OFFSET = 64; // cells may be negative (border rocks)
const key = (cx, cy) => (cx + OFFSET) * 4096 + (cy + OFFSET);

export class CollisionWorld {
  constructor() {
    this.circles = [];
    this.cells = new Map();
    this.stamp = 0;
  }

  add(x, y, r, kind) {
    const c = { x, y, r, kind, q: 0 };
    this.circles.push(c);
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = key(cx, cy);
        let list = this.cells.get(k);
        if (!list) { list = []; this.cells.set(k, list); }
        list.push(c);
      }
    }
    return c;
  }

  /** Calls fn(circle) once for each circle whose cell touches the box. fn returning true stops the query. */
  _query(minX, minY, maxX, maxY, fn) {
    const q = ++this.stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const y0 = Math.floor(minY / CELL), y1 = Math.floor(maxY / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(key(cx, cy));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          if (c.q === q) continue;
          c.q = q;
          if (fn(c)) return;
        }
      }
    }
  }

  _deepest(x, y, r) {
    let best = null, bestPen = 0;
    this._query(x - r, y - r, x + r, y + r, (c) => {
      const dx = x - c.x, dy = y - c.y, R = c.r + r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R) return false;
      const pen = R - Math.sqrt(d2);
      if (pen > bestPen) { bestPen = pen; best = c; }
      return false;
    });
    return best;
  }

  /** Pushes a body {x, y, radius} out of every circle it overlaps. Returns true if it was moved. */
  pushOut(ent) {
    let moved = false;
    for (let i = 0; i < 4; i++) {
      const c = this._deepest(ent.x, ent.y, ent.radius);
      if (!c) break;
      let nx = ent.x - c.x, ny = ent.y - c.y;
      let d = Math.hypot(nx, ny);
      if (d < 1e-6) { nx = 1; ny = 0; d = 1; }
      const R = c.r + ent.radius;
      ent.x = c.x + (nx / d) * R;
      ent.y = c.y + (ny / d) * R;
      moved = true;
    }
    return moved;
  }

  /**
   * Moves a walker by (dx, dy) and resolves collisions. Head-on hits get a sideways slide so enemies that walk in
   * straight lines go around obstacles (side: +1 / −1 preferred direction when the hit is dead centre).
   */
  move(ent, dx, dy, side = 1) {
    ent.x += dx;
    ent.y += dy;
    const len = Math.hypot(dx, dy);
    for (let i = 0; i < 4; i++) {
      const c = this._deepest(ent.x, ent.y, ent.radius);
      if (!c) return;
      let nx = ent.x - c.x, ny = ent.y - c.y;
      let d = Math.hypot(nx, ny);
      if (d < 1e-6) { nx = -dx || 1; ny = -dy; d = Math.hypot(nx, ny); }
      nx /= d; ny /= d;
      const R = c.r + ent.radius;
      ent.x = c.x + nx * R;
      ent.y = c.y + ny * R;
      if (len > 1e-6 && i === 0) {
        const dot = (dx * nx + dy * ny) / len;
        if (dot < -0.35) {
          const cross = dx * ny - dy * nx;
          const s = Math.abs(cross) > len * 0.05 ? (cross > 0 ? -1 : 1) : side;
          ent.x += -ny * s * len;
          ent.y += nx * s * len;
        }
      }
    }
  }

  /**
   * First static hit along a segment (circles inflated by `radius`). Circles that contain the start point are
   * ignored (a bullet leaving its own turret pad / a muzzle inside a rock). Returns t in [0, 1] or Infinity.
   */
  segmentHit(x0, y0, x1, y1, radius = 0) {
    const dx = x1 - x0, dy = y1 - y0;
    const a = dx * dx + dy * dy;
    let best = Infinity;
    if (a < 1e-12) return best;
    const pad = radius;
    this._query(Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad, (c) => {
      const R = c.r + radius;
      const fx = x0 - c.x, fy = y0 - c.y;
      const cc = fx * fx + fy * fy - R * R;
      if (cc <= 0) return false; // starts inside → ignore this circle
      const b = 2 * (fx * dx + fy * dy);
      const disc = b * b - 4 * a * cc;
      if (disc < 0) return false;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t <= 1 && t < best) best = t;
      return false;
    });
    return best;
  }

  /** Line of sight between two points (turret targeting): false if a static circle is in between. */
  clear(x0, y0, x1, y1) { return this.segmentHit(x0, y0, x1, y1, 0) === Infinity; }
}

export const COLLIDER = {
  beacon: 60,       // the stone plinth of the lighthouse (model radius 58–64)
  pad: 36,          // build pad disc (devices stand on it)
  kiosk: 28,
};

/** Builds the static world of a map run: beacon, pads, kiosk (this run's spot) and every decor prop. */
export function buildCollisionWorld(map, kiosk) {
  const w = new CollisionWorld();
  w.add(map.beacon.x, map.beacon.y, COLLIDER.beacon, 'beacon');
  for (const p of map.buildPads) w.add(p.x, p.y, COLLIDER.pad, 'pad');
  if (kiosk) w.add(kiosk.x, kiosk.y, COLLIDER.kiosk, 'kiosk');
  for (const prop of layoutProps(map)) for (const c of propColliders(prop)) w.add(c.x, c.y, c.r, prop.kind);
  return w;
}
