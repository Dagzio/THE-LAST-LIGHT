// Enemy behaviour (02_SPEC §8–9), data-driven and shared by all regular enemies:
// MOVE_TO_BEACON — straight line to the beacon (no A*; MVP decor never blocks paths), speed × slow;
// ATTACK_BEACON — stops at the beacon edge + reach, hits it every attackInterval (first hit one interval after
// arriving, so an enemy killed before its attack never damages the beacon). Damage is discrete, never per frame.
// Contact damage to the player / ATTACK_PLAYER for Runner arrive in Phase 4 (D17).
import { ENEMY_STATES } from '../entities/Enemy.js';
import { BEACON } from '../data/beacon.js';

export class EnemyAISystem {
  /** @param {import('../core/GameEvents.js').GameEvents} events */
  constructor(events) {
    this.events = events;
  }

  /**
   * @param {Array} enemies
   * @param {import('../entities/Beacon.js').Beacon} beacon
   * @returns {boolean} true exactly once — when an attack destroyed the beacon this step
   */
  update(enemies, beacon, dt, time) {
    let fell = false;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) { e.attackingBeacon = false; continue; }
      const t = e.type;
      const dx = beacon.x - e.x, dy = beacon.y - e.y;
      const dist = Math.hypot(dx, dy);
      const stopAt = beacon.radius + e.radius + t.attackReach;
      e.beaconThreat = Math.max(0, 1 - (dist - stopAt) / BEACON.threatRadius);

      if (e.state === ENEMY_STATES.MOVE_TO_BEACON) {
        e.attackingBeacon = false;
        if (dist <= stopAt) {
          e.state = ENEMY_STATES.ATTACK_BEACON;
          e.nextAttackAt = time + t.attackInterval;
          continue;
        }
        const step = Math.min(dist - stopAt, t.moveSpeed * e.slowFactor(time) * dt);
        if (dist > 1e-6 && step > 0) {
          e.x += (dx / dist) * step;
          e.y += (dy / dist) * step;
        }
        e.faceAngle = Math.atan2(dy, dx);
      } else if (e.state === ENEMY_STATES.ATTACK_BEACON) {
        e.attackingBeacon = !beacon.destroyed;
        e.faceAngle = Math.atan2(dy, dx);
        if (beacon.destroyed) continue;
        if (time >= e.nextAttackAt) {
          e.nextAttackAt = time + t.attackInterval;
          e.lastAttackAt = time;
          if (beacon.applyDamage(t.beaconDamage, time)) fell = true;
          this.events.emit('beaconHit', e.x + (dx / dist) * e.radius, e.y + (dy / dist) * e.radius, t.beaconDamage);
        }
      }
    }
    return fell;
  }
}
