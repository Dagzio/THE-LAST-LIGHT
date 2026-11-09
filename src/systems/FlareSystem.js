// Emergency Flare (01_GDD §9.3, D38): charge 0–100 from kills (temporary, lives in the map run), activated with Q /
// the flare button only during an active wave at full charge. The pulse from the beacon reveals every enemy
// (Illuminated), stuns regular enemies and throws those near the beacon outwards. The boss only gets a short
// Illuminated — its telegraphs and attacks are never interrupted. No direct damage. Game-clock timestamps only.
import { FLARE } from '../data/balance.js';
import { ENEMY_STATES } from '../entities/Enemy.js';

export class FlareSystem {
  /** @param {import('../core/GameEvents.js').GameEvents} events */
  constructor(events) {
    this.events = events;
    this.charge = 0;
    this.lastUsedAt = -Infinity;
    this.uses = 0;
    this.chargeMult = 1; // crate perk FLARE_CACHE (D51)
  }

  get ready() { return this.charge >= FLARE.maxCharge; }

  /** 0..1 */
  get fraction() { return Math.min(1, this.charge / FLARE.maxCharge); }

  /** Kill → charge (each kill is reported once by the map run). Emits 'flareReady' once when it fills up. */
  addKill(enemy) {
    if (!enemy || this.ready) return;
    const add = FLARE.chargePerKill[enemy.typeId] || 0;
    if (!(add > 0)) return;
    this.charge = Math.min(FLARE.maxCharge, this.charge + add * this.chargeMult);
    if (this.ready) this.events.emit('flareReady');
  }

  /**
   * @param {boolean} waveActive only during WAVE_ACTIVE
   * @returns {boolean} true if the flare fired (charge spent)
   */
  activate(enemies, beacon, time, waveActive) {
    if (!waveActive || !this.ready) return false;
    this.charge = 0;
    this.lastUsedAt = time;
    this.uses += 1;
    const r2 = FLARE.knockbackRadius * FLARE.knockbackRadius;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      if (e.type.boss) {
        e.illuminatedUntil = Math.max(e.illuminatedUntil, time + FLARE.bossIlluminate);
        e.illuminated = true;
        continue;
      }
      e.illuminatedUntil = Math.max(e.illuminatedUntil, time + FLARE.illuminate);
      e.illuminated = true;
      e.stunUntil = Math.max(e.stunUntil, time + FLARE.stun);
      e.nextAttackAt = e.stunUntil + e.type.attackInterval; // the beacon attack restarts after the stun
      e.attackingBeacon = false;
      const dx = e.x - beacon.x, dy = e.y - beacon.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) {
        const d = Math.sqrt(d2) || 1;
        const ux = d2 > 1e-6 ? dx / d : 1, uy = d2 > 1e-6 ? dy / d : 0;
        const v = FLARE.knockbackDistance / FLARE.knockbackTime;
        e.pushVX = ux * v;
        e.pushVY = uy * v;
        e.pushUntil = time + FLARE.knockbackTime;
        if (e.state === ENEMY_STATES.ATTACK_BEACON) e.state = ENEMY_STATES.MOVE_TO_BEACON; // must walk back first
      }
    }
    this.events.emit('flare', beacon.x, beacon.y);
    return true;
  }
}
