// Grenades (01_GDD §8.6, 02_SPEC §13): stock for the current map only (bought one at a time, cap 3 per type),
// thrown by hand to a point (≤ maxThrowRange), lobbed over obstacles, blast after flightTime on the game clock.
// Frag: radial damage + small knockback. Cryo: slow (weaker for the boss, never a freeze). Molotov: fire zone with
// periodic ticks. One grenade is taken from the stock only after the instance was created. Damage goes through
// DamageCalculator; kills are reported once like any other kill.
import { GRENADES, GRENADE_ORDER, GRENADE_RULES } from '../data/grenades.js';
import { computeDamage, NEUTRAL_MODIFIERS } from './DamageCalculator.js';

const NO_ARMOR = { illuminated: false, armor: 0 }; // reused target view for grenade damage

export class GrenadeSystem {
  /**
   * @param {{next:()=>number}} rng
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(rng, events) {
    this.rng = rng;
    this.events = events;
    this.stock = { frag: 0, cryo: 0, molotov: 0 };
    this.selected = 'frag';
    this.flying = [];   // { type, x0, y0, x1, y1, t0, t1 }
    this.zones = [];    // molotov fire: { x, y, r, until, nextTick, startedAt }
    this.blasts = [];   // presentation: { type, x, y, r, at }
    this.world = null;
  }

  total() { return this.stock.frag + this.stock.cryo + this.stock.molotov; }

  /** Adds grenades up to the cap. Returns how many were added. */
  add(type, n = 1) {
    if (!(type in this.stock)) return 0;
    const room = GRENADE_RULES.capPerType - this.stock[type];
    const k = Math.max(0, Math.min(room, n | 0));
    this.stock[type] += k;
    if (k > 0 && this.stock[this.selected] === 0) this.selected = type;
    return k;
  }

  /** 1/2/3 or a slot tap: only a type that is in stock can be selected. */
  select(type) {
    if (!(type in this.stock) || this.stock[type] <= 0) return false;
    this.selected = type;
    return true;
  }

  /** If the selected type ran out: switch to the next type that has stock (frag → cryo → molotov), else keep it. */
  ensureSelection() {
    if (this.stock[this.selected] > 0) return;
    const i = GRENADE_ORDER.indexOf(this.selected);
    for (let k = 1; k <= GRENADE_ORDER.length; k++) {
      const t = GRENADE_ORDER[(i + k) % GRENADE_ORDER.length];
      if (this.stock[t] > 0) { this.selected = t; return; }
    }
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
   * Throws the selected grenade. Nothing happens with an empty stock.
   * @returns {boolean}
   */
  throw(player, tx, ty, time) {
    this.ensureSelection();
    const type = this.selected;
    if (!player.alive || !(this.stock[type] > 0) || !Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    const land = GrenadeSystem.landing(player.x, player.y, tx, ty);
    const g = { type, x0: player.x, y0: player.y, x1: land.x, y1: land.y, t0: time, t1: time + GRENADE_RULES.flightTime };
    this.flying.push(g);           // the instance exists …
    this.stock[type] -= 1;         // … only then the stock goes down (02_SPEC §13)
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
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      while (time >= z.nextTick && z.nextTick < z.until) {
        this._damageIn(z.x, z.y, z.r, GRENADES.molotov.tickDamage, GRENADES.molotov, enemies, z.nextTick);
        z.nextTick += GRENADES.molotov.tickInterval;
      }
      if (time >= z.until) this.zones.splice(i, 1);
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) if (time - this.blasts[i].at > 1.0) this.blasts.splice(i, 1);
  }

  _blast(g, enemies, time) {
    const G = GRENADES[g.type];
    const x = g.x1, y = g.y1;
    this.blasts.push({ type: g.type, x, y, r: G.radius, at: time });
    if (g.type === 'frag') {
      const r2 = (G.radius) ** 2;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy > (G.radius + e.radius) ** 2 && dx * dx + dy * dy > r2) continue;
        const killed = this._hit(e, G.damage, G, time);
        if (!killed && !e.type.boss && G.knockback > 0) {
          const d = Math.hypot(dx, dy) || 1;
          e.pushVX = (dx / d) * (G.knockback / 0.2);
          e.pushVY = (dy / d) * (G.knockback / 0.2);
          e.pushUntil = time + 0.2;
        }
      }
    } else if (g.type === 'cryo') {
      for (const e of enemies) {
        if (!e.alive || Math.hypot(e.x - x, e.y - y) > G.radius + e.radius) continue;
        if (e.type.boss) e.applySlow(G.bossSlow, G.bossSlowDuration, time, false);
        else e.applySlow(G.slow, G.slowDuration, time, false);
      }
    } else {
      this.zones.push({ x, y, r: G.radius, until: time + G.duration, nextTick: time, startedAt: time });
    }
    this.events.emit('grenadeBlast', g.type, x, y, G.radius);
  }

  _damageIn(x, y, r, dmg, src, enemies, time) {
    for (const e of enemies) {
      if (!e.alive || Math.hypot(e.x - x, e.y - y) > r + e.radius) continue;
      this._hit(e, dmg, src, time);
    }
  }

  _hit(e, base, src, time) {
    // Grenades ignore armour (Husk, D45): the calculator sees the target without its armour.
    NO_ARMOR.illuminated = e.illuminated;
    const res = computeDamage(base, src, NO_ARMOR, NEUTRAL_MODIFIERS, this.rng);
    const killed = e.applyDamage(res.amount, time);
    this.events.emit('hit', e.x, e.y, res.amount, false);
    if (killed) this.events.emit('kill', e, time);
    return killed;
  }

  clear() {
    this.stock = { frag: 0, cryo: 0, molotov: 0 };
    this.flying.length = 0;
    this.zones.length = 0;
    this.blasts.length = 0;
  }
}
