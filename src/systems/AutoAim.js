// D74: auto aim for the mobile version — picks the nearest enemy within the weapon's range (to its edge) and in line
// of sight, keeps it while it stays valid (switches only to a clearly closer one) and aims the keeper at it.
// Pure simulation (no DOM): MapRun calls it on touch devices when no finger aims by hand.
import { AUTO_AIM } from '../data/player.js';
import { ENEMY_STATES } from '../entities/Enemy.js';

export class AutoAim {
  constructor(cfg = AUTO_AIM) {
    this.cfg = cfg;
    this.target = null;
    /** @type {import('./Collision.js').CollisionWorld|null} */
    this.world = null;
  }

  reset() { this.target = null; }

  _valid(e, p, reach) {
    if (!e || !e.alive || e.state === ENEMY_STATES.SPAWNING) return false;
    const d = Math.hypot(e.x - p.x, e.y - p.y) - (e.radius || 0);
    if (!(d <= reach)) return false;
    return !this.cfg.lineOfSight || !this.world || this.world.clear(p.x, p.y, e.x, e.y);
  }

  /**
   * @param {import('../entities/Player.js').Player} p
   * @param {Array} enemies
   * @param {number} range the equipped weapon's range
   * @returns {object|null} the enemy aimed at (the keeper's aimAngle / aimX / aimY are set), or null
   */
  update(p, enemies, range) {
    if (!p.alive || !(range > 0)) { this.target = null; return null; }
    const reach = range * this.cfg.rangeFactor;
    let best = null, bestD = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d >= bestD || !this._valid(e, p, reach)) continue;
      best = e; bestD = d;
    }
    // keep the current target unless the new one is clearly closer
    const cur = this.target;
    if (cur && cur !== best && this._valid(cur, p, reach)) {
      const dc = Math.hypot(cur.x - p.x, cur.y - p.y);
      if (!best || bestD > dc * this.cfg.switchRatio) best = cur;
    }
    this.target = best;
    if (!best) return null;
    const dx = best.x - p.x, dy = best.y - p.y;
    if (dx * dx + dy * dy > 4) p.aimAngle = Math.atan2(dy, dx);
    p.aimX = best.x; p.aimY = best.y; p.hasAim = true;
    return best;
  }
}
