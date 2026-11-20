// Grenades (01_GDD §8.6, 02_SPEC §13; KILL LIST D78: frag only, found in a crate). Stock for the current level only,
// thrown by hand to a point (≤ maxThrowRange), lobbed over obstacles, blast after flightTime on the game clock: radial
// damage + a small knockback; walls and closed doors shield the enemies behind them. One grenade is taken from the
// stock only after the instance was created. Damage goes through DamageCalculator; kills are reported once.
import { GRENADES, GRENADE_ORDER, GRENADE_RULES } from '../data/grenades.js';
import { computeDamage, NEUTRAL_MODIFIERS } from './DamageCalculator.js';
import { CollisionWorld, BLOCK } from './Collision.js';

const NO_ARMOR = { illuminated: false, armor: 0 }; // grenades ignore armour
const PT = { x: 0, y: 0 }, NRM = { nx: 0, ny: 0 };
/** D116: what a grenade bounces off — walls (glass, fences too), doors (closed), props taller than the eye (high cover). */
const grenadeBlocks = (s) => s.kind === 'wall' || s.kind === 'door' || !!(s.blocks & BLOCK.SIGHT);

export class GrenadeSystem {
  /**
   * @param {{next:()=>number}} rng
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(rng, events) {
    this.rng = rng;
    this.events = events;
    this.stock = {};
    for (const t of GRENADE_ORDER) this.stock[t] = 0;
    this.selected = GRENADE_ORDER[0];
    this.flying = [];   // { type, x0, y0, x1, y1, t0, t1 }
    this.blasts = [];   // presentation: { type, x, y, r, at }
    this.lastThrowAt = -Infinity; // presentation: the hero's toss animation
    /** @type {import('./Collision.js').CollisionWorld|null} */
    this.world = null;
  }

  total() { let n = 0; for (const t of GRENADE_ORDER) n += this.stock[t] | 0; return n; }

  /** Adds grenades up to the cap. Returns how many were added. */
  add(type, n = 1) {
    if (!(type in this.stock)) return 0;
    const room = GRENADE_RULES.capPerType - this.stock[type];
    const k = Math.max(0, Math.min(room, n | 0));
    this.stock[type] += k;
    if (k > 0 && this.stock[this.selected] === 0) this.selected = type;
    return k;
  }

  select(type) {
    if (!(type in this.stock) || this.stock[type] <= 0) return false;
    this.selected = type;
    return true;
  }

  ensureSelection() {
    if (this.stock[this.selected] > 0) return;
    for (const t of GRENADE_ORDER) if (this.stock[t] > 0) { this.selected = t; return; }
  }

  /** Landing point for a throw from (px, py) towards (tx, ty), clamped to the max range. */
  static landing(px, py, tx, ty, out = {}) {
    let dx = tx - px, dy = ty - py;
    const d = Math.hypot(dx, dy);
    const max = GRENADE_RULES.maxThrowRange;
    if (d > max) { dx *= max / d; dy *= max / d; }
    out.x = px + dx;
    out.y = py + dy;
    return out;
  }

  /**
   * D116 (user: no grenades over walls into other rooms; a ricochet): the way of a throw from (px, py) towards (tx, ty)
   * — a low lob along the ground plane: a wall, a door, a fence or a tall prop on the way (low cover is lobbed over)
   * turns it back off its face (mirrored), keeping `bounce` of the distance left and of the speed; `maxBounces` at most.
   * → out { pts: [x, y, …] (the throw point, every bounce, the rest point), dt: [s per leg], bounces }.
   */
  static path(world, px, py, tx, ty, out = { pts: [], dt: [], bounces: 0 }) {
    const R = GRENADE_RULES;
    const land = GrenadeSystem.landing(px, py, tx, ty, PT);
    let dx = land.x - px, dy = land.y - py;
    const D = Math.hypot(dx, dy);
    out.pts.length = 0; out.dt.length = 0; out.bounces = 0;
    out.pts.push(px, py);
    if (D < 1e-6) { out.pts.push(px, py); out.dt.push(R.flightTime); return out; }
    const v0 = D / R.flightTime; // (a throw that hits nothing keeps the old flight time)
    let x = px, y = py, left = D, speed = v0;
    dx /= D; dy /= D;
    for (let k = 0; k <= R.maxBounces; k++) {
      const ex = x + dx * left, ey = y + dy * left;
      const t = world ? world.segmentHit(x, y, ex, ey, R.radius, grenadeBlocks, BLOCK.MOVE) : Infinity;
      if (t === Infinity || k === R.maxBounces) {
        // (the last allowed leg stops at a face it would hit)
        const f = t === Infinity ? 1 : Math.max(0, t - 0.02);
        out.pts.push(x + (ex - x) * f, y + (ey - y) * f);
        out.dt.push((left * f) / speed);
        return out;
      }
      const hx = x + (ex - x) * t, hy = y + (ey - y) * t;
      CollisionWorld.normalAt(world.hitShape, hx, hy, R.radius, NRM);
      const run = left * t;
      out.pts.push(hx + NRM.nx * 0.5, hy + NRM.ny * 0.5);
      out.dt.push(run / speed);
      out.bounces += 1;
      // mirrored off the face; what was left of the throw and its speed shrink
      const dot = dx * NRM.nx + dy * NRM.ny;
      dx -= 2 * dot * NRM.nx; dy -= 2 * dot * NRM.ny;
      x = hx + NRM.nx * 0.5; y = hy + NRM.ny * 0.5;
      left = (left - run) * R.bounce + R.bounceMin;
      speed *= R.bounce;
    }
    return out;
  }

  /** Throws the selected grenade. Nothing happens with an empty stock. */
  throw(player, tx, ty, time) {
    this.ensureSelection();
    const type = this.selected;
    if (!player.alive || !(this.stock[type] > 0) || !Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    // D116: the way with its bounces; the blast where it comes to rest, when it does
    const way = GrenadeSystem.path(this.world, player.x, player.y, tx, ty, { pts: [], dt: [], bounces: 0 });
    const n = way.pts.length;
    const ts = [time];
    for (const d of way.dt) ts.push(ts[ts.length - 1] + d);
    this.flying.push({ type, x0: player.x, y0: player.y, x1: way.pts[n - 2], y1: way.pts[n - 1], t0: time, t1: ts[ts.length - 1], pts: way.pts, dt: way.dt, bounces: way.bounces });
    this.stock[type] -= 1;
    this.lastThrowAt = time;
    this.ensureSelection();
    this.events.emit('grenadeThrow', type, player.x, player.y);
    return true;
  }

  update(enemies, time) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const g = this.flying[i];
      if (time < g.t1) continue;
      this.flying.splice(i, 1);
      this._blast(g, enemies, time);
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) if (time - this.blasts[i].at > 1.0) this.blasts.splice(i, 1);
  }

  _blast(g, enemies, time) {
    const G = GRENADES[g.type];
    const x = g.x1, y = g.y1;
    this.blasts.push({ type: g.type, x, y, r: G.radius, at: time });
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d > G.radius + e.radius) continue;
      if (this.world && !this.world.clear(x, y, e.x, e.y)) continue; // walls / closed doors shield
      const falloff = 1 - 0.5 * Math.min(1, d / G.radius);        // full in the centre, half at the edge
      const killed = this._hit(e, G.damage * falloff, G, time);
      if (!killed && G.knockback > 0) {
        const k = d || 1;
        e.x += (dx / k) * G.knockback * 0.5;
        e.y += (dy / k) * G.knockback * 0.5;
        if (this.world) this.world.pushOut(e);
      }
    }
    this.events.emit('grenadeBlast', g.type, x, y, G.radius);
  }

  _hit(e, base, src, time) {
    const res = computeDamage(base, src, NO_ARMOR, NEUTRAL_MODIFIERS, this.rng);
    const killed = e.applyDamage(res.amount, time);
    this.events.emit('hit', e.x, e.y, res.amount, false, e, 0);
    if (killed) this.events.emit('kill', e, time);
    return killed;
  }

  clear() {
    for (const t of GRENADE_ORDER) this.stock[t] = 0;
    this.flying.length = 0;
    this.blasts.length = 0;
  }
}
