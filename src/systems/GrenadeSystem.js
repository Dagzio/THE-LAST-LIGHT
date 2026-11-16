// Grenades (01_GDD §8.6, 02_SPEC §13; KILL LIST D78: frag only, found in a crate). Stock for the current level only,
// thrown by hand to a point (≤ maxThrowRange), lobbed over obstacles, blast after flightTime on the game clock: radial
// damage + a small knockback; walls and closed doors shield the enemies behind them. One grenade is taken from the
// stock only after the instance was created. Damage goes through DamageCalculator; kills are reported once.
import { GRENADES, GRENADE_ORDER, GRENADE_RULES } from '../data/grenades.js';
import { computeDamage, NEUTRAL_MODIFIERS } from './DamageCalculator.js';

const NO_ARMOR = { illuminated: false, armor: 0 }; // grenades ignore armour

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

  /** Throws the selected grenade. Nothing happens with an empty stock. */
  throw(player, tx, ty, time) {
    this.ensureSelection();
    const type = this.selected;
    if (!player.alive || !(this.stock[type] > 0) || !Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    const land = GrenadeSystem.landing(player.x, player.y, tx, ty);
    this.flying.push({ type, x0: player.x, y0: player.y, x1: land.x, y1: land.y, t0: time, t1: time + GRENADE_RULES.flightTime });
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
