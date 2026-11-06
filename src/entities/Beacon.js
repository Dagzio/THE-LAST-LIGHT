// Beacon (01_GDD §9, 02_SPEC §8): own Integrity, separate from the player's HP.
// Destruction happens exactly once; repair never exceeds maxIntegrity.
import { BEACON } from '../data/beacon.js';

export class Beacon {
  constructor(x, y, maxIntegrity = BEACON.maxIntegrity) {
    this.x = x;
    this.y = y;
    this.radius = BEACON.radius;
    this.maxIntegrity = maxIntegrity;
    this.integrity = maxIntegrity;
    this.destroyed = false;
    this.lastHitAt = -Infinity;   // presentation: hit flash, off-screen alert
  }

  /** Discrete damage from an enemy attack. Returns true exactly once — when the beacon falls. */
  applyDamage(amount, time) {
    if (this.destroyed || !(amount > 0) || !Number.isFinite(amount)) return false;
    this.integrity = Math.max(0, this.integrity - amount);
    this.lastHitAt = time;
    if (this.integrity <= 0) {
      this.destroyed = true;
      return true;
    }
    return false;
  }

  /** Repair (crate perk EMERGENCY_REPAIR, Phase 6). Clamped to maxIntegrity; a fallen beacon is not repaired. */
  repair(amount) {
    if (this.destroyed || !(amount > 0) || !Number.isFinite(amount)) return 0;
    const before = this.integrity;
    this.integrity = Math.min(this.maxIntegrity, this.integrity + amount);
    return this.integrity - before;
  }
}
