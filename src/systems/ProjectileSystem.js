// Projectile movement and hits (04_ARCH §8): swept segment–circle test (no tunnelling at high speed),
// nearest hit along the segment first, each enemy at most once per bullet, limited distinct targets
// (1 + penetration). Damage goes through DamageCalculator only.
import { computeDamage, NEUTRAL_MODIFIERS } from './DamageCalculator.js';

export class ProjectileSystem {
  /**
   * @param {import('../entities/ProjectilePool.js').ProjectilePool} pool
   * @param {{next:()=>number}} rng seeded run RNG (crit rolls)
   * @param {import('../core/GameEvents.js').GameEvents} events
   * @param {(id:string)=>object} getWeaponStats effective stats by weapon id
   */
  constructor(pool, rng, events, getWeaponStats) {
    this.pool = pool;
    this.rng = rng;
    this.events = events;
    this.getWeaponStats = getWeaponStats;
    this.modifiers = NEUTRAL_MODIFIERS;
    /** @type {import('./Collision.js').CollisionWorld|null} bullets stop at decor / beacon / pads / kiosk (D40) */
    this.world = null;
  }

  update(enemies, dt, time) {
    const items = this.pool.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.travelled += Math.hypot(p.vx, p.vy) * dt;
      this._collide(p, enemies, time);
      if (p.active && p.travelled >= p.maxDistance) this.pool.release(p);
    }
  }

  _collide(p, enemies, time) {
    const sx = p.prevX, sy = p.prevY;
    const ex = p.x - sx, ey = p.y - sy;
    const segLen2 = ex * ex + ey * ey;
    // First static obstacle on this step's segment: enemies behind it are not hit.
    const wallT = this.world ? this.world.segmentHit(sx, sy, p.x, p.y, p.radius) : Infinity;
    while (p.hitsLeft > 0) {
      let hit = null, hitT = wallT;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (!e.alive || p.hasHit(e.id)) continue;
        // closest point of the segment to the enemy center
        let t = segLen2 > 0 ? ((e.x - sx) * ex + (e.y - sy) * ey) / segLen2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = sx + ex * t - e.x, cy = sy + ey * t - e.y;
        const rr = e.radius + p.radius;
        if (cx * cx + cy * cy <= rr * rr && t < hitT) { hitT = t; hit = e; }
      }
      if (!hit) break;
      p.markHit(hit.id);
      const stats = p.stats || this.getWeaponStats(p.weaponId);
      const r = computeDamage(stats.damage, stats, hit, this.modifiers, this.rng);
      const killed = hit.applyDamage(r.amount, time);
      const hx = sx + ex * hitT, hy = sy + ey * hitT;
      this.events.emit('hit', hx, hy, r.amount, r.crit);
      if (killed) this.events.emit('kill', hit, time);
      else if (stats.slowOnHit > 0) hit.applySlow(stats.slowOnHit, stats.slowDuration, time); // Frost Coil rounds (D50)
      else if (stats.knockback > 0 && !hit.type.boss) { // HEAVY_IMPACT perk: a small shove along the bullet
        const v = Math.hypot(p.vx, p.vy) || 1;
        hit.pushVX = (p.vx / v) * (stats.knockback / 0.12);
        hit.pushVY = (p.vy / v) * (stats.knockback / 0.12);
        hit.pushUntil = time + 0.12;
      }
      if (p.hitsLeft <= 0) { this.pool.release(p); return; }
    }
    if (wallT !== Infinity && p.active) { // still flying and the segment reaches an obstacle → it stops there
      this.events.emit('bulletBlocked', sx + ex * wallT, sy + ey * wallT, p.angle);
      this.pool.release(p);
    }
  }
}
