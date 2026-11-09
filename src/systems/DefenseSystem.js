// Tower-defense layer (01_GDD §10, 02_SPEC §10): fixed build pads, each with ONE active device.
// D50 (2026-11-09): devices have 3 levels; a pad keeps every device bought on it during the map run (`owned`:
// id → level), so buying another type on an occupied pad swaps it in and the old one waits in the pad's storage —
// switching back is free. Both devices are shooting turrets with their own TargetingSystem (same priority rules as
// the spec) and fire pooled projectiles through the shared projectile/damage pipeline; L2+ fire from two barrels.
// The Frost Coil's rounds slow what they hit (ProjectileSystem reads stats.slowOnHit).
// All timers are game-clock timestamps — nothing advances while the simulation is paused.
// Coins and the "only between waves" rule are validated by the shop (Game) before these commands are called.
import { TargetingSystem } from './TargetingSystem.js';
import { getDefense, defenseStats, MAX_DEVICE_LEVEL } from '../data/defenses.js';
import { PROJECTILES } from '../data/balance.js';

export class DefenseSystem {
  /**
   * @param {Array<{x:number,y:number}>} padPositions from the map
   * @param {import('../entities/ProjectilePool.js').ProjectilePool} pool
   * @param {{next:()=>number}} rng
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(padPositions, pool, rng, events) {
    this.pads = padPositions.map((p, index) => ({ index, x: p.x, y: p.y, device: null, owned: {} }));
    this.pool = pool;
    this.rng = rng;
    this.events = events;
    /** @type {import('./Collision.js').CollisionWorld|null} turret line of sight (D40) */
    this.world = null;
  }

  /** Level of `id` bought on this pad (0 = not bought). */
  ownedLevel(padIndex, id) {
    const pad = this.pads[padIndex];
    return pad ? pad.owned[id] | 0 : 0;
  }

  /**
   * Buys a NEW device type for a pad (level 1) and installs it; an installed one goes to the pad's storage.
   * Invalid pad / unknown device / already bought on this pad → false, nothing changes.
   */
  place(padIndex, defenseId, time) {
    const pad = this.pads[padIndex];
    if (!pad || !getDefense(defenseId) || pad.owned[defenseId]) return false;
    pad.owned[defenseId] = 1;
    this._install(pad, defenseId, time);
    return true;
  }

  /** Installs a device already bought on this pad (free swap). False if not bought or already installed. */
  equip(padIndex, defenseId, time) {
    const pad = this.pads[padIndex];
    if (!pad || !pad.owned[defenseId] || (pad.device && pad.device.id === defenseId)) return false;
    this._install(pad, defenseId, time);
    return true;
  }

  /** Upgrades the installed device one level (max 3). Returns the new level, or 0 if not possible. */
  upgrade(padIndex, time) {
    const pad = this.pads[padIndex];
    const d = pad && pad.device;
    if (!d || d.level >= MAX_DEVICE_LEVEL) return 0;
    pad.owned[d.id] = d.level + 1;
    this._install(pad, d.id, time, d.aimAngle);
    this.events.emit('deviceUpgraded', padIndex, d.id, pad.owned[d.id]);
    return pad.owned[d.id];
  }

  _install(pad, id, time, aimAngle = -Math.PI / 2) {
    const level = pad.owned[id];
    const stats = defenseStats(id, level);
    pad.device = {
      id,
      level,
      stats,
      x: pad.x,
      y: pad.y,
      padIndex: pad.index,
      nextActionAt: time + stats.fireInterval,
      aimAngle,
      lastActionAt: -Infinity,
      installedAt: time, // presentation: the model pops in on install / level-up
      targeting: new TargetingSystem(),
    };
    this.events.emit('devicePlaced', pad.index, id, level);
  }

  get devices() {
    return this.pads;
  }

  update(enemies, time) {
    for (let i = 0; i < this.pads.length; i++) {
      const d = this.pads[i].device;
      if (d) this._turret(d, enemies, time);
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
    const barrels = Math.max(1, s.barrels | 0);
    const nx = -Math.sin(d.aimAngle), ny = Math.cos(d.aimAngle); // across the barrels
    for (let b = 0; b < barrels; b++) {
      const side = barrels === 1 ? 0 : (b === 0 ? -0.5 : 0.5) * s.barrelGap;
      const a = d.aimAngle + (this.rng.next() - 0.5) * ((s.spreadAngle * Math.PI) / 180);
      const p = this.pool.spawn();
      p.x = p.prevX = d.x + Math.cos(a) * s.muzzleOffset + nx * side;
      p.y = p.prevY = d.y + Math.sin(a) * s.muzzleOffset + ny * side;
      p.vx = Math.cos(a) * s.projectileSpeed;
      p.vy = Math.sin(a) * s.projectileSpeed;
      p.angle = a;
      p.maxDistance = s.range * PROJECTILES.rangeSlack;
      p.hitsLeft = 1 + (s.penetrationCount | 0);
      p.weaponId = s.id;
      p.stats = s; // this device's level (two pads may hold different levels of the same device)
      p.spawnedAt = time;
      this.events.emit('turretShot', p.x, p.y, a, s.id);
    }
  }

  clear() { for (const p of this.pads) { p.device = null; p.owned = {}; } }
}
