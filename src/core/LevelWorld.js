// KILL LIST (D78): the static + door part of a level's world, built from level data (data/levels/*.js): wall boxes,
// furniture footprints, doors (shapes switched off while open) and the room graph the AI routes through (rooms
// connected by doors / openings — a breadth-first walk over ~10 rooms, not A* / navmesh: CLAUDE.md rule 14 keeps
// full pathfinding out; inside a room walkers slide around furniture).
import { CollisionWorld, BLOCK } from '../systems/Collision.js';
import { PROP_TYPES, propBox } from '../data/props.js';

export const DOOR = {
  openDist: 62,       // units from the door centre (+ half its width) at which a door opens for a character
  openTime: 0.28,     // s to slide open / shut
  closeDelay: 0.9,    // s with nobody near before it shuts
  passable: 0.65,     // open fraction from which it no longer blocks
  unlockDist: 70,     // units: the hero with the key card unlocks the secure door from this close
};

const WALL_BLOCKS = { glass: BLOCK.MOVE };
const DOOR_BLOCKS = { glass: BLOCK.MOVE };

export class LevelWorld {
  /** @param {object} level data/levels/*.js */
  constructor(level) {
    this.level = level;
    this.world = new CollisionWorld();
    const T = level.wallThickness, h = T / 2;
    // walls (end caps overlap the corners)
    for (const w of level.walls) {
      const blocks = WALL_BLOCKS[w.style] ?? BLOCK.ALL;
      for (const [a, b] of wallPieces(w, h)) {
        if (w.y0 === w.y1) this.world.addBox(a, w.y0 - h, b, w.y0 + h, 'wall', blocks);
        else this.world.addBox(w.x0 - h, a, w.x0 + h, b, 'wall', blocks);
      }
    }
    // furniture
    for (const p of level.props) {
      const t = PROP_TYPES[p.type];
      if (!t || !t.blocks) continue;
      const [x0, y0, x1, y1] = propBox(p);
      this.world.addBox(x0, y0, x1, y1, 'prop', t.blocks);
    }
    // doors
    this.doors = level.doors.map((d) => {
      const hw = d.width / 2;
      const shape = d.axis === 'x'
        ? this.world.addBox(d.x - hw, d.y - h + 2, d.x + hw, d.y + h - 2, 'door', DOOR_BLOCKS[d.kind] ?? BLOCK.ALL)
        : this.world.addBox(d.x - h + 2, d.y - hw, d.x + h - 2, d.y + hw, 'door', DOOR_BLOCKS[d.kind] ?? BLOCK.ALL);
      return { def: d, id: d.id, shape, open: 0, target: 0, locked: !!d.lock, nearAt: -Infinity, lastChangeAt: 0 };
    });
    this.zones = level.zones;
    this._buildLinks();
  }

  doorById(id) { return this.doors.find((d) => d.id === id) || null; }

  /** Room id at a point (rooms do not overlap), or null (inside a wall / outside). */
  zoneAt(x, y) {
    for (const z of this.zones) {
      const r = z.rect;
      if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return z.id;
    }
    return null;
  }

  _zone(id) { return this.zones.find((z) => z.id === id); }

  _buildLinks() {
    this.links = [];
    const add = (a, b, x, y, door) => {
      const A = this._zone(a), B = this._zone(b);
      if (!A || !B) return;
      // which way the boundary runs: rooms stacked north/south share a horizontal wall
      const horiz = Math.abs(A.rect[3] - B.rect[1]) < 1 || Math.abs(A.rect[1] - B.rect[3]) < 1;
      const sideOf = (Z) => (horiz ? Math.sign((Z.rect[1] + Z.rect[3]) / 2 - y) : Math.sign((Z.rect[0] + Z.rect[2]) / 2 - x));
      const off = 34;
      const pa = horiz ? { x, y: y + sideOf(A) * off } : { x: x + sideOf(A) * off, y };
      const pb = horiz ? { x, y: y + sideOf(B) * off } : { x: x + sideOf(B) * off, y };
      this.links.push({ a, b, pa, pb, door });
    };
    for (const d of this.doors) if (d.def.zones && d.def.zones.length === 2) add(d.def.zones[0], d.def.zones[1], d.def.x, d.def.y, d);
    for (const o of this.level.openings || []) add(o.zones[0], o.zones[1], o.x, o.y, null);
  }

  /**
   * Waypoints from (x0, y0) to (x1, y1) through the rooms (doors that are unlocked or `canOpen(door)`), written into
   * `out` (array of {x, y}), the goal last. Returns false when there is no way (stays empty).
   */
  route(x0, y0, x1, y1, out, canOpen = null) {
    out.length = 0;
    const za = this.zoneAt(x0, y0), zb = this.zoneAt(x1, y1);
    if (!za || !zb || za === zb) { out.push({ x: x1, y: y1 }); return true; }
    const prev = new Map([[za, null]]);
    const queue = [za];
    while (queue.length) {
      const z = queue.shift();
      if (z === zb) break;
      for (const l of this.links) {
        if (l.door && l.door.locked && !(canOpen && canOpen(l.door))) continue;
        const next = l.a === z ? l.b : l.b === z ? l.a : null;
        if (!next || prev.has(next)) continue;
        prev.set(next, { z, l });
        queue.push(next);
      }
    }
    if (!prev.has(zb)) return false;
    const steps = [];
    for (let z = zb; prev.get(z); z = prev.get(z).z) steps.push(prev.get(z));
    steps.reverse();
    for (const { z, l } of steps) {
      const fromA = l.a === z;
      out.push(fromA ? l.pa : l.pb, fromA ? l.pb : l.pa);
    }
    out.push({ x: x1, y: y1 });
    return true;
  }

  /**
   * Doors: an unlocked door opens while a living character is near it and shuts a moment after the last one left
   * (never on someone standing in the doorway). The shape stops blocking once it is mostly open.
   * @param {Array<{x:number,y:number,radius:number,alive:boolean}>} bodies
   */
  updateDoors(bodies, time, dt) {
    for (const d of this.doors) {
      const D = d.def;
      if (!d.locked) {
        const reach = DOOR.openDist + D.width / 2;
        for (let i = 0; i < bodies.length; i++) {
          const b = bodies[i];
          if (!b.alive) continue;
          const dx = b.x - D.x, dy = b.y - D.y;
          if (dx * dx + dy * dy <= reach * reach) { d.nearAt = time; break; }
        }
        const want = time - d.nearAt < DOOR.closeDelay ? 1 : 0;
        if (want === 0 && d.open > 0 && this._blocked(d, bodies)) d.nearAt = time; // someone in the doorway
        else d.target = want;
      } else d.target = 0;
      const prevOpen = d.open;
      const step = dt / DOOR.openTime;
      d.open = d.target > d.open ? Math.min(1, d.open + step) : Math.max(0, d.open - step);
      if (prevOpen === 0 && d.open > 0) d.lastChangeAt = time;
      d.shape.on = d.open < DOOR.passable;
    }
  }

  _blocked(d, bodies) {
    const s = d.shape;
    for (const b of bodies) {
      if (!b.alive) continue;
      if (b.x + b.radius > s.minX && b.x - b.radius < s.maxX && b.y + b.radius > s.minY && b.y - b.radius < s.maxY) return true;
    }
    return false;
  }
}

/** Solid pieces [from, to] of a wall line along its main axis, gaps cut out, ends extended by half the thickness. */
export function wallPieces(w, h) {
  const horiz = w.y0 === w.y1;
  let a = (horiz ? Math.min(w.x0, w.x1) : Math.min(w.y0, w.y1)) - h;
  const end = (horiz ? Math.max(w.x0, w.x1) : Math.max(w.y0, w.y1)) + h;
  const out = [];
  const gaps = [...(w.gaps || [])].sort((p, q) => p[0] - q[0]);
  for (const [g0, g1] of gaps) {
    if (g0 > a) out.push([a, g0]);
    a = Math.max(a, g1);
  }
  if (end > a) out.push([a, end]);
  return out;
}
