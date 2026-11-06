// Fixed pool of projectiles: no allocation per shot. Each bullet remembers which enemies it hit,
// so one bullet never damages the same enemy twice; penetration allows a limited number of DIFFERENT enemies.
import { PROJECTILES } from '../data/balance.js';

class Projectile {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.prevX = 0; this.prevY = 0;
    this.vx = 0; this.vy = 0;
    this.angle = 0;
    this.travelled = 0;
    this.maxDistance = 0;
    this.radius = PROJECTILES.radius;
    this.hitsLeft = 1;
    this.hitIds = new Array(PROJECTILES.maxHitsCap).fill(0);
    this.hitCount = 0;
    this.weaponId = '';
    this.spawnedAt = 0;
  }

  hasHit(id) {
    for (let i = 0; i < this.hitCount; i++) if (this.hitIds[i] === id) return true;
    return false;
  }

  markHit(id) {
    if (this.hitCount < this.hitIds.length) this.hitIds[this.hitCount++] = id;
    this.hitsLeft -= 1;
  }
}

export class ProjectilePool {
  constructor(capacity) {
    this.items = Array.from({ length: capacity }, () => new Projectile());
    this.cursor = 0;
    this.activeCount = 0;
  }

  /** Takes a free projectile; if the pool is full the oldest one is recycled (never fails). */
  spawn() {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const p = this.items[(this.cursor + k) % n];
      if (!p.active) { this.cursor = (this.cursor + k + 1) % n; this.activeCount++; return this._reset(p); }
    }
    let oldest = this.items[0];
    for (const p of this.items) if (p.spawnedAt < oldest.spawnedAt) oldest = p;
    return this._reset(oldest);
  }

  release(p) {
    if (!p.active) return;
    p.active = false;
    this.activeCount--;
  }

  clear() {
    for (const p of this.items) p.active = false;
    this.activeCount = 0;
  }

  _reset(p) {
    p.active = true;
    p.hitCount = 0;
    p.travelled = 0;
    return p;
  }
}
