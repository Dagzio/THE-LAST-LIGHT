// Static collision world (D40, extended for KILL LIST D78): circles and axis-aligned boxes (walls, doors, furniture).
// Not a physics engine — bodies are pushed out of shapes and slide along them (no pathfinding inside, rule 14).
// Every shape says what it blocks (mask bits): movement, bullets, line of sight — a desk stops a walker but not a
// bullet or a look, a glass wall stops a walker but not a bullet or a look, a wall stops everything. A shape can be
// switched off (an open door). A uniform grid keeps every query local (weak phones).

const CELL = 128;
const OFFSET = 64; // cells may be negative
const key = (cx, cy) => (cx + OFFSET) * 4096 + (cy + OFFSET);

// LOW (D82): low cover — stops rounds and looks aimed at a hero crouched behind it (ALL does not include it: walls stop
// those anyway through BULLET / SIGHT)
export const BLOCK = Object.freeze({ MOVE: 1, BULLET: 2, SIGHT: 4, LOW: 8, ALL: 7 });

export class CollisionWorld {
  constructor() {
    this.shapes = [];
    this.cells = new Map();
    this.stamp = 0;
  }

  _index(s, minX, minY, maxX, maxY) {
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const y0 = Math.floor(minY / CELL), y1 = Math.floor(maxY / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = key(cx, cy);
        let list = this.cells.get(k);
        if (!list) { list = []; this.cells.set(k, list); }
        list.push(s);
      }
    }
    this.shapes.push(s);
    return s;
  }

  /** Circle obstacle. */
  add(x, y, r, kind, blocks = BLOCK.ALL) {
    return this._index({ box: false, x, y, r, kind, blocks, on: true, q: 0 }, x - r, y - r, x + r, y + r);
  }

  /** Axis-aligned box obstacle (minX, minY) – (maxX, maxY). */
  addBox(minX, minY, maxX, maxY, kind, blocks = BLOCK.ALL) {
    const s = { box: true, minX, minY, maxX, maxY, x: (minX + maxX) / 2, y: (minY + maxY) / 2, kind, blocks, on: true, q: 0 };
    return this._index(s, minX, minY, maxX, maxY);
  }

  /** Calls fn(shape) once for each enabled shape whose cell touches the box. fn returning true stops the query. */
  _query(minX, minY, maxX, maxY, mask, fn) {
    const q = ++this.stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const y0 = Math.floor(minY / CELL), y1 = Math.floor(maxY / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(key(cx, cy));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (s.q === q) continue;
          s.q = q;
          if (!s.on || !(s.blocks & mask)) continue;
          if (fn(s)) return;
        }
      }
    }
  }

  /** Penetration of a circle body into a shape → fills out {nx, ny, pen}; false when they do not touch. */
  static _contact(s, x, y, r, out) {
    if (!s.box) {
      const dx = x - s.x, dy = y - s.y, R = s.r + r, d2 = dx * dx + dy * dy;
      if (d2 >= R * R) return false;
      const d = Math.sqrt(d2);
      if (d < 1e-6) { out.nx = 1; out.ny = 0; } else { out.nx = dx / d; out.ny = dy / d; }
      out.pen = R - d;
      return true;
    }
    const cx = x < s.minX ? s.minX : x > s.maxX ? s.maxX : x;
    const cy = y < s.minY ? s.minY : y > s.maxY ? s.maxY : y;
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 > 1e-9) {
      if (d2 >= r * r) return false;
      const d = Math.sqrt(d2);
      out.nx = dx / d; out.ny = dy / d; out.pen = r - d;
      return true;
    }
    // centre inside the box: out through the nearest side
    const l = x - s.minX, rr = s.maxX - x, t = y - s.minY, b = s.maxY - y;
    const m = Math.min(l, rr, t, b);
    if (m === l) { out.nx = -1; out.ny = 0; } else if (m === rr) { out.nx = 1; out.ny = 0; } else if (m === t) { out.nx = 0; out.ny = -1; } else { out.nx = 0; out.ny = 1; }
    out.pen = m + r;
    return true;
  }

  _deepest(x, y, r, mask, filter, out) {
    let best = null, bestPen = 0;
    const c = CONTACT;
    this._query(x - r, y - r, x + r, y + r, mask, (s) => {
      if (filter && !filter(s)) return false;
      if (!CollisionWorld._contact(s, x, y, r, c)) return false;
      if (c.pen > bestPen) { bestPen = c.pen; best = s; out.nx = c.nx; out.ny = c.ny; out.pen = c.pen; }
      return false;
    });
    return best;
  }

  /** Pushes a body {x, y, radius} out of every shape it overlaps. Returns true if it was moved. */
  pushOut(ent, filter = null, mask = BLOCK.MOVE) {
    let moved = false;
    const o = OUT;
    for (let i = 0; i < 4; i++) {
      if (!this._deepest(ent.x, ent.y, ent.radius, mask, filter, o)) break;
      ent.x += o.nx * o.pen;
      ent.y += o.ny * o.pen;
      moved = true;
    }
    return moved;
  }

  /** True if the body overlaps any shape (filter(shape) → false skips it). */
  overlaps(ent, filter = null, mask = BLOCK.MOVE) { return !!this._deepest(ent.x, ent.y, ent.radius, mask, filter, OUT); }

  /**
   * Moves a walker by (dx, dy) and resolves collisions; head-on hits on a round shape get a sideways slide (side:
   * +1 / −1 preferred direction when the hit is dead centre). Boxes slide naturally along their faces.
   */
  move(ent, dx, dy, side = 1, filter = null, mask = BLOCK.MOVE) {
    ent.x += dx;
    ent.y += dy;
    const len = Math.hypot(dx, dy);
    const o = OUT;
    for (let i = 0; i < 4; i++) {
      const s = this._deepest(ent.x, ent.y, ent.radius, mask, filter, o);
      if (!s) return;
      ent.x += o.nx * o.pen;
      ent.y += o.ny * o.pen;
      if (!s.box && len > 1e-6 && i === 0) {
        const dot = (dx * o.nx + dy * o.ny) / len;
        if (dot < -0.35) {
          const cross = dx * o.ny - dy * o.nx;
          const sd = Math.abs(cross) > len * 0.05 ? (cross > 0 ? -1 : 1) : side;
          ent.x += -o.ny * sd * len;
          ent.y += o.nx * sd * len;
        }
      }
    }
  }

  /**
   * First hit along a segment (shapes inflated by `radius`). Shapes that contain the start point are ignored (a muzzle
   * inside a desk). Returns t in [0, 1] or Infinity. mask — what the segment is (bullet by default).
   */
  segmentHit(x0, y0, x1, y1, radius = 0, filter = null, mask = BLOCK.BULLET) {
    const dx = x1 - x0, dy = y1 - y0;
    const a = dx * dx + dy * dy;
    let best = Infinity;
    if (a < 1e-12) return best;
    const pad = radius;
    this._query(Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad, mask, (s) => {
      if (filter && !filter(s)) return false;
      let t;
      if (s.box) {
        // D82: a start inside the shape itself is ignored (a muzzle inside a desk), but a start within `radius` of its
        // face is a hit at once — before, a round fired right at a wall flew through it (the hero pressed against it)
        const cx = x0 < s.minX ? s.minX : x0 > s.maxX ? s.maxX : x0, cy = y0 < s.minY ? s.minY : y0 > s.maxY ? s.maxY : y0;
        if (radius > 0 && x0 > s.minX - radius && x0 < s.maxX + radius && y0 > s.minY - radius && y0 < s.maxY + radius
          && !(x0 > s.minX && x0 < s.maxX && y0 > s.minY && y0 < s.maxY) && (cx - x0) * dx + (cy - y0) * dy > 0) t = 0;
        else t = boxRay(x0, y0, dx, dy, s.minX - radius, s.minY - radius, s.maxX + radius, s.maxY + radius);
      } else {
        const R = s.r + radius;
        const fx = x0 - s.x, fy = y0 - s.y;
        const cc = fx * fx + fy * fy - R * R;
        if (cc <= 0 && fx * fx + fy * fy >= s.r * s.r && (fx * dx + fy * dy) < 0) { best = 0; return false; } // D82: same for circles (moving into it)
        if (cc <= 0) return false; // starts inside → ignore
        const b = 2 * (fx * dx + fy * dy);
        const disc = b * b - 4 * a * cc;
        if (disc < 0) return false;
        t = (-b - Math.sqrt(disc)) / (2 * a);
      }
      if (t >= 0 && t <= 1 && t < best) best = t;
      return false;
    });
    return best;
  }

  /** Line of sight between two points: false if a shape blocking `mask` (sight by default) is in between. */
  clear(x0, y0, x1, y1, filter = null, mask = BLOCK.SIGHT) { return this.segmentHit(x0, y0, x1, y1, 0, filter, mask) === Infinity; }

  /**
   * D82: the nearest cover shape (shape.cover = 'low' / 'high') whose surface is within `reach` of (x, y) → fills
   * out { shape, nx, ny, gap } (n: from the surface towards the point, gap: distance to the surface); null if none.
   */
  coverAt(x, y, reach, out) {
    let best = null, bestGap = reach;
    this._query(x - reach, y - reach, x + reach, y + reach, BLOCK.MOVE, (s) => {
      if (!s.cover) return false;
      let dx, dy;
      if (s.box) {
        dx = x - (x < s.minX ? s.minX : x > s.maxX ? s.maxX : x);
        dy = y - (y < s.minY ? s.minY : y > s.maxY ? s.maxY : y);
      } else { dx = x - s.x; dy = y - s.y; }
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) return false; // inside: not a contact
      const gap = s.box ? d : d - s.r;
      if (gap < bestGap) { bestGap = gap; best = s; out.nx = dx / d; out.ny = dy / d; out.gap = gap; }
      return false;
    });
    out.shape = best;
    return best ? out : null;
  }
}

const CONTACT = { nx: 0, ny: 0, pen: 0 };
const OUT = { nx: 0, ny: 0, pen: 0 };

/** Entry t of a ray (origin + t·d, t in [0, 1]) into a box; Infinity if it misses or starts inside. */
function boxRay(x0, y0, dx, dy, minX, minY, maxX, maxY) {
  if (x0 > minX && x0 < maxX && y0 > minY && y0 < maxY) return Infinity; // starts inside → ignore
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dx) < 1e-12) { if (x0 < minX || x0 > maxX) return Infinity; } else {
    let t1 = (minX - x0) / dx, t2 = (maxX - x0) / dx;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-12) { if (y0 < minY || y0 > maxY) return Infinity; } else {
    let t1 = (minY - y0) / dy, t2 = (maxY - y0) / dy;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin || tmax < 0 || tmin > 1) return Infinity;
  return tmin >= 0 ? tmin : Infinity;
}
