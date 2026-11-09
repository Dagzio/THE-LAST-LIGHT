// Poison ticks (D51, Poison Turret): an enemy poisoned by a round takes poisonDps × tick damage every tick until the
// poison runs out. Goes through the DamageCalculator like every other damage, without armour (as grenades — Husk);
// a kill by poison is reported once like any other kill. Game-clock timestamps: nothing ticks while paused.
import { computeDamage, NEUTRAL_MODIFIERS } from './DamageCalculator.js';

const SRC = { critChance: 0, critMultiplier: 1 }; // poison never crits
const NO_ARMOR = { illuminated: false, armor: 0 };

export class PoisonSystem {
  /** @param {import('../core/GameEvents.js').GameEvents} events @param {{next:()=>number}} rng */
  constructor(events, rng) {
    this.events = events;
    this.rng = rng;
  }

  update(enemies, time) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || !(e.poisonDps > 0)) continue;
      // every tick that is due and still inside the poison window (catches up after a long step)
      while (e.alive && e.poisonNextTick <= time && e.poisonNextTick <= e.poisonUntil + 1e-9) {
        NO_ARMOR.illuminated = e.illuminated;
        const res = computeDamage(e.poisonDps * e.poisonTick, SRC, NO_ARMOR, NEUTRAL_MODIFIERS, this.rng);
        e.poisonNextTick += e.poisonTick;
        const killed = e.applyDamage(res.amount, time);
        this.events.emit('poisonTick', e.x, e.y, res.amount);
        if (killed) this.events.emit('kill', e, time);
      }
      if (time > e.poisonUntil) e.poisonDps = 0;
    }
  }
}
