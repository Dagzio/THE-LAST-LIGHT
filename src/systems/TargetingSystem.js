// Auto-targeting (02_SPEC §5, 01_GDD §8.2). Single-pass threat score, no sorting, no allocation.
// Full search runs every TARGETING.searchInterval of game time; between searches the current target is
// only validated (dead / out of range → dropped and a search is forced on the next step).
// Stickiness: keep the current valid target unless another one scores clearly higher.
import { TARGETING } from '../data/balance.js';

export class TargetingSystem {
  constructor(config = TARGETING) {
    this.config = config;
    this.target = null;
    this.nextSearchAt = 0;
  }

  reset() { this.target = null; this.nextSearchAt = 0; }

  isValid(enemy, x, y, range) {
    if (!enemy || !enemy.alive) return false;
    const dx = enemy.x - x, dy = enemy.y - y;
    return dx * dx + dy * dy <= range * range;
  }

  score(enemy, d2, range) {
    const w = this.config.weights;
    const proximity = 1 - Math.min(1, Math.sqrt(d2) / range);
    return (enemy.attackingBeacon ? w.attackingBeacon : 0)
      + w.beaconThreat * (enemy.beaconThreat || 0)
      + (enemy.illuminated ? w.illuminated : 0)
      + w.proximity * proximity;
  }

  /**
   * @param {{x:number,y:number}} origin  shooter position
   * @param {Array} enemies
   * @param {number} range
   * @param {number} time  game clock
   * @param {((e:object)=>boolean)|null} [canSee] line of sight (D40: the beacon and decor block bullets)
   * @returns {object|null} current target
   */
  update(origin, enemies, range, time, canSee = null) {
    if (this.target && (!this.isValid(this.target, origin.x, origin.y, range) || (canSee && !canSee(this.target)))) {
      this.target = null;
      this.nextSearchAt = time; // look for the next one right away
    }
    if (time < this.nextSearchAt) return this.target;
    this.nextSearchAt = time + this.config.searchInterval;

    const range2 = range * range;
    let best = null, bestScore = -Infinity, currentScore = -Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const dx = e.x - origin.x, dy = e.y - origin.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > range2) continue;
      if (canSee && !canSee(e)) continue;
      const s = this.score(e, d2, range);
      if (e === this.target) currentScore = s;
      if (s > bestScore) { bestScore = s; best = e; }
    }
    if (this.target && currentScore > -Infinity && bestScore <= currentScore + this.config.stickiness) return this.target;
    this.target = best;
    return this.target;
  }
}
