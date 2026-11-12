// Tower-defense layer (01_GDD §10, 02_SPEC §10): fixed build pads, each with ONE active device.
// D50 (2026-11-09): devices have 3 levels; a pad keeps every device bought on it during the map run (`owned`:
// id → level), so buying another type on an occupied pad swaps it in and the old one waits in the pad's storage —
// switching back is free. Both devices are shooting turrets with their own TargetingSystem (same priority rules as
// the spec) and fire pooled projectiles through the shared projectile/damage pipeline; L2+ fire from two barrels.
// The Frost Coil's rounds slow what they hit (ProjectileSystem reads stats.slowOnHit).
// D52: devices have HP (data/defenses.js DEVICE_HP); a broken one (0 HP) stays on its pad, does not shoot and is not
// attacked until repaired. HP is kept per device type on the pad (`health`), so a swap never heals or breaks anything.
// All timers are game-clock timestamps — nothing advances while the simulation is paused.
// Coins and the "only between waves" rule are validated by the shop (Game) before these commands are called.
import { TargetingSystem } from './TargetingSystem.js';
import { getDefense, defenseStats, MAX_DEVICE_LEVEL, DEVICE_HP } from '../data/defenses.js';
import { PROJECTILES } from '../data/balance.js';

export class DefenseSystem {
  /**
   * @param {Array<{x:number,y:number}>} padPositions from the map
   * @param {import('../entities/ProjectilePool.js').ProjectilePool} pool
   * @param {{next:()=>number}} rng
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(padPositions, pool, rng, events) {
    // spent (D63): coins put into each device type on this pad during the run (buy + upgrades + repairs), for selling
    this.pads = padPositions.map((p, index) => ({ index, x: p.x, y: p.y, device: null, owned: {}, health: {}, spent: {} }));
    this.pool = pool;
    this.rng = rng;
    this.events = events;
    /** @type {import('./Collision.js').CollisionWorld|null} turret line of sight (D40) */
    this.world = null;
    this.fireRateMult = 1; // crate perk TURRET_OVERCLOCK (D51): every device fires faster
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
    const prev = pad.device;
    if (prev) pad.health[prev.id] = prev.hp; // the one going to storage keeps its damage
    let hp = pad.health[id] ?? stats.maxHp;
    if (prev && prev.id === id && stats.maxHp > prev.maxHp) hp += stats.maxHp - prev.maxHp; // level-up: + the new HP
    hp = Math.min(stats.maxHp, Math.max(0, hp));
    pad.health[id] = hp;
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
      hp,
      maxHp: stats.maxHp,
      lastHitAt: -Infinity, // presentation: hit flash
    };
    this.events.emit('devicePlaced', pad.index, id, level);
  }

  get devices() {
    return this.pads;
  }

  /** A device that can be attacked / shoots (installed and not broken). */
  static working(d) { return !!d && d.hp > 0; }

  /**
   * Damage to a device (enemy hit, spitter glob, boss impact). Returns true exactly once — when it breaks.
   * A broken device ignores damage.
   */
  damage(d, amount, time) {
    if (!d || d.hp <= 0 || !(amount > 0) || !Number.isFinite(amount)) return false;
    d.hp = Math.max(0, d.hp - amount);
    d.lastHitAt = time;
    this.pads[d.padIndex].health[d.id] = d.hp;
    this.events.emit('deviceHit', d.x, d.y, amount, d.padIndex);
    if (d.hp > 0) return false;
    d.targeting = new TargetingSystem(); // forget the target: it starts fresh after the repair
    this.events.emit('deviceBroken', d.padIndex, d.id);
    return true;
  }

  /** Price of a full repair of the device on a pad (0 = nothing to repair). Like the beacon (D40). */
  repairCost(padIndex) {
    const d = this.pads[padIndex] && this.pads[padIndex].device;
    if (!d) return 0;
    const missing = Math.max(0, d.maxHp - d.hp);
    if (missing <= 0) return 0;
    return Math.max(1, Math.round((DEVICE_HP.repair.fullFromOnePercent * missing) / (d.maxHp * 0.99)));
  }

  /** Repairs the device on a pad to full. Coins are validated / taken by the caller (Game). */
  repair(padIndex, time) {
    const pad = this.pads[padIndex];
    const d = pad && pad.device;
    if (!d || d.hp >= d.maxHp) return false;
    const wasBroken = d.hp <= 0;
    d.hp = d.maxHp;
    pad.health[d.id] = d.hp;
    if (wasBroken) d.nextActionAt = time + d.stats.fireInterval;
    this.events.emit('deviceRepaired', padIndex, d.id);
    return true;
  }

  update(enemies, time) {
    for (let i = 0; i < this.pads.length; i++) {
      const d = this.pads[i].device;
      if (d && d.hp > 0) this._turret(d, enemies, time); // a broken device does nothing until repaired
    }
  }

  _turret(d, enemies, time) {
    const s = d.stats;
    if (this.world && !d.canSee) d.canSee = (e) => this.world.clear(d.x, d.y, e.x, e.y); // own pad is skipped (start inside)
    const target = d.targeting.update(d, enemies, s.range, time, this.world ? d.canSee : null);
    if (target) d.aimAngle = Math.atan2(target.y - d.y, target.x - d.x);
    if (!target || time < d.nextActionAt) return;
    d.nextActionAt = time + s.fireInterval / this.fireRateMult;
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

  /** D63: books coins put into a device type on a pad (the shop calls it after a successful purchase). */
  addSpent(padIndex, id, coins) {
    const pad = this.pads[padIndex];
    if (!pad || !pad.owned[id] || !(coins > 0)) return;
    pad.spent[id] = (pad.spent[id] | 0) + (coins | 0);
  }

  /** Coins put into a device type on a pad (0 = none / not bought). */
  spentOn(padIndex, id) {
    const pad = this.pads[padIndex];
    return pad && pad.owned[id] ? pad.spent[id] | 0 : 0;
  }

  /**
   * D63: removes a device type bought on a pad (installed or in the pad's storage) with its level, HP and record.
   * An installed one leaves the pad empty. Returns the coins that were spent on it, or -1 if it is not on the pad.
   */
  sell(padIndex, id) {
    const pad = this.pads[padIndex];
    if (!pad || !pad.owned[id]) return -1;
    const spent = pad.spent[id] | 0;
    if (pad.device && pad.device.id === id) pad.device = null;
    delete pad.owned[id];
    delete pad.health[id];
    delete pad.spent[id];
    this.events.emit('deviceSold', padIndex, id);
    return spent;
  }

  clear() { for (const p of this.pads) { p.device = null; p.owned = {}; p.health = {}; p.spent = {}; } }
}
