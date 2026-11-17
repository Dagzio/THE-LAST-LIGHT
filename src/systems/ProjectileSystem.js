// Projectile movement and hits (04_ARCH §8): swept segment–circle test (no tunnelling at high speed), nearest hit along
// the segment first, each target at most once per bullet, limited distinct targets (1 + penetration). Damage goes
// through DamageCalculator only. KILL LIST (D78): enemy rounds (`hostile`) hit only the hero — never other enemies —
// and fly through him while he rolls (dodge invulnerability). Walls / closed doors / tall furniture stop every round.
import { computeDamage, hitDirectionMult, NEUTRAL_MODIFIERS } from './DamageCalculator.js';
import { PLAYER } from '../data/player.js';
import { BLOCK } from './Collision.js';

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
    /** @type {import('./Collision.js').CollisionWorld|null} */
    this.world = null;
    /** @type {import('../entities/Player.js').Player|null} target of hostile rounds */
    this.player = null;
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
      if (p.hostile) this._collideHero(p, time);
      else this._collide(p, enemies, time);
      if (p.active && p.travelled >= p.maxDistance) this.pool.release(p);
    }
  }

  _wall(p, mask = BLOCK.BULLET) {
    return this.world ? this.world.segmentHit(p.prevX, p.prevY, p.x, p.y, p.radius, null, mask) : Infinity;
  }

  _blocked(p, t) {
    const ex = p.x - p.prevX, ey = p.y - p.prevY;
    this.events.emit('bulletBlocked', p.prevX + ex * t, p.prevY + ey * t, p.angle);
    this.pool.release(p);
  }

  /** An enemy round: the hero (unless rolling) or the first wall on this step's segment (D82: crouched behind low cover, the low objects stop it too). */
  _collideHero(p, time) {
    const h = this.player;
    const wallT = this._wall(p, h && h.crouched ? BLOCK.BULLET | BLOCK.LOW : BLOCK.BULLET);
    if (h && h.alive && !h.isInvulnerable(time)) {
      const sx = p.prevX, sy = p.prevY, ex = p.x - sx, ey = p.y - sy;
      const l2 = ex * ex + ey * ey;
      let t = l2 > 0 ? ((h.x - sx) * ex + (h.y - sy) * ey) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = sx + ex * t - h.x, cy = sy + ey * t - h.y, rr = h.radius + p.radius;
      if (cx * cx + cy * cy <= rr * rr && t < wallT) {
        const stats = p.stats || this.getWeaponStats(p.weaponId);
        const applied = h.applyDamage(stats.damage, time, PLAYER.hitInvulnerability);
        if (applied > 0) this.events.emit('playerHit', sx + ex * t, sy + ey * t, applied, p.weaponId, p.angle);
        this.pool.release(p);
        return;
      }
    }
    if (wallT !== Infinity) this._blocked(p, wallT);
  }

  _collide(p, enemies, time) {
    const sx = p.prevX, sy = p.prevY;
    const ex = p.x - sx, ey = p.y - sy;
    const segLen2 = ex * ex + ey * ey;
    const wallT = this._wall(p); // first static obstacle: enemies behind it are not hit
    while (p.hitsLeft > 0) {
      let hit = null, hitT = wallT;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (!e.alive || p.hasHit(e.id)) continue;
        let t = segLen2 > 0 ? ((e.x - sx) * ex + (e.y - sy) * ey) / segLen2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = sx + ex * t - e.x, cy = sy + ey * t - e.y;
        const rr = e.radius + p.radius;
        if (cx * cx + cy * cy <= rr * rr && t < hitT) { hitT = t; hit = e; }
      }
      if (!hit) break;
      p.markHit(hit.id);
      const stats = p.stats || this.getWeaponStats(p.weaponId);
      const r = computeDamage(stats.damage, stats, hit, this.modifiers, this.rng, hitDirectionMult(hit, p.vx, p.vy));
      // D85: the silenced pistol fells an enemy who is not fighting the hero (unaware) — ×sneakMult
      if (stats.sneakMult && hit.ai && hit.ai.mode !== 'combat') r.amount *= stats.sneakMult;
      const killed = hit.applyDamage(r.amount, time);
      const hx = sx + ex * hitT, hy = sy + ey * hitT;
      this.events.emit('hit', hx, hy, r.amount, r.crit, hit, p.angle);
      if (killed) this.events.emit('kill', hit, time);
      if (p.hitsLeft <= 0) { this.pool.release(p); return; }
    }
    if (wallT !== Infinity && p.active) this._blocked(p, wallT);
  }
}
