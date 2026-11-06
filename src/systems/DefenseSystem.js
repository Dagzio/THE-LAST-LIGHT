// Tower-defense layer (01_GDD §10, 02_SPEC §10): fixed build pads, each holds null or ONE device.
// place() is the single placement command (Phase 3: called by the test harness; Phase 5: by the shop between waves).
// Guard Turret: own TargetingSystem (same priority rules as the spec), fires pooled projectiles through the shared
// projectile/damage pipeline. Frost Coil: periodic AoE pulse applying a non-stacking slow.
// All timers are game-clock timestamps — nothing advances while the simulation is paused.
import { TargetingSystem } from './TargetingSystem.js';
import { getDefense } from '../data/defenses.js';
import { PROJECTILES } from '../data/balance.js';

export class DefenseSystem {
  /**
   * @param {Array<{x:number,y:number}>} padPositions from the map
   * @param {import('../entities/ProjectilePool.js').ProjectilePool} pool
   * @param {{next:()=>number}} rng
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(padPositions, pool, rng, events) {
    this.pads = padPositions.map((p, index) => ({ index, x: p.x, y: p.y, device: null }));
    this.pool = pool;
    this.rng = rng;
    this.events = events;
    /** @type {import('./Collision.js').CollisionWorld|null} turret line of sight (D40) */
    this.world = null;
  }

  /**
   * Places a device on a free pad. Invalid pad / unknown device / occupied pad → false, nothing changes.
   * (Coins and the "only between waves" rule are validated by the shop in Phase 5 before calling this.)
   */
  place(padIndex, defenseId, time) {
    const pad = this.pads[padIndex];
    const stats = getDefense(defenseId);
    if (!pad || !stats || pad.device) return false;
    pad.device = {
      id: defenseId,
      stats,
      x: pad.x,
      y: pad.y,
      padIndex,
      nextActionAt: time + (stats.pulseInterval || stats.fireInterval || 0),
      aimAngle: -Math.PI / 2,
      lastActionAt: -Infinity,
      targeting: defenseId === 'guard_turret' ? new TargetingSystem() : null,
    };
    this.events.emit('devicePlaced', padIndex, defenseId);
    return true;
  }

  get devices() {
    return this.pads;
  }

  update(enemies, time) {
    for (let i = 0; i < this.pads.length; i++) {
      const d = this.pads[i].device;
      if (!d) continue;
      if (d.id === 'guard_turret') this._turret(d, enemies, time);
      else if (d.id === 'frost_coil') this._coil(d, enemies, time);
    }
  }

  _turret(d, enemies, time) {
    const s = d.stats;
    if (this.world && !d.canSee) d.canSee = (e) => this.world.clear(d.x, d.y, e.x, e.y); // own pad is skipped (start inside)
    const target = d.targeting.update(d, enemies, s.range, time, this.world ? d.canSee : null);
    if (target) d.aimAngle = Math.atan2(target.y - d.y, target.x - d.x);
    if (!target || time < d.nextActionAt) return;
    d.nextActionAt = time + s.fireInterval;
    d.lastActionAt = time;
    const a = d.aimAngle + (this.rng.next() - 0.5) * ((s.spreadAngle * Math.PI) / 180);
    const p = this.pool.spawn();
    p.x = p.prevX = d.x + Math.cos(a) * 20;
    p.y = p.prevY = d.y + Math.sin(a) * 20;
    p.vx = Math.cos(a) * s.projectileSpeed;
    p.vy = Math.sin(a) * s.projectileSpeed;
    p.angle = a;
    p.maxDistance = s.range * PROJECTILES.rangeSlack;
    p.hitsLeft = 1 + (s.penetrationCount | 0);
    p.weaponId = s.id;
    p.spawnedAt = time;
    this.events.emit('turretShot', p.x, p.y, a);
  }

  _coil(d, enemies, time) {
    const s = d.stats;
    if (time < d.nextActionAt) return;
    d.nextActionAt = time + s.pulseInterval;
    d.lastActionAt = time;
    const r2 = s.radius * s.radius;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const dx = e.x - d.x, dy = e.y - d.y;
      if (dx * dx + dy * dy <= (s.radius + e.radius) ** 2 || dx * dx + dy * dy <= r2) e.applySlow(s.slow, s.slowDuration, time);
    }
    this.events.emit('frostPulse', d.x, d.y, s.radius);
  }

  clear() { for (const p of this.pads) p.device = null; }
}
