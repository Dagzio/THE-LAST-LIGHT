// Main firearm loop: MANUAL fire towards the aim point (user decision 2026-11-06, replaces the auto-fire of 02_SPEC §5),
// magazine, reload. A shot happens only when: the simulation runs (caller), the trigger is held, not reloading,
// the fire cooldown is over and ammo > 0.
// One trigger pull = one round from the magazine; pelletsPerShot projectiles per pull (shotgun).
// All timers are game-clock timestamps: they freeze with the simulation.
import { PROJECTILES } from '../data/balance.js';
import { muzzlePoint } from '../data/keeperRig.js';

const MIN_CONVERGE = 40; // world units: an aim point closer than this to the muzzle keeps the plain aim direction

export class WeaponState {
  /** @param {object} stats effective weapon stats (base + upgrades + perks) */
  constructor(stats) { this.equip(stats); }

  equip(stats) {
    this.stats = stats;
    this.weaponId = stats.id;
    this.ammo = stats.magazineSize;     // a new map / equip starts with a full magazine
    this.reloading = false;
    this.reloadStartedAt = 0;
    this.reloadEndsAt = 0;
    this.nextShotAt = 0;
    this.lastShotAt = -Infinity;
  }

  /** 0..1 progress of the current reload (presentation). */
  reloadProgress(time) {
    if (!this.reloading) return 0;
    const d = this.reloadEndsAt - this.reloadStartedAt;
    return d > 0 ? Math.min(1, Math.max(0, (time - this.reloadStartedAt) / d)) : 1;
  }
}

export class WeaponSystem {
  /**
   * @param {import('../entities/ProjectilePool.js').ProjectilePool} pool
   * @param {{next:()=>number}} rng seeded run RNG (spread)
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(pool, rng, events) {
    this.pool = pool;
    this.rng = rng;
    this.events = events;
  }

  /** Starts a reload if allowed. Returns true if a reload actually started (never twice). */
  startReload(w, time) {
    if (w.reloading || w.ammo >= w.stats.magazineSize) return false;
    w.reloading = true;
    w.reloadStartedAt = time;
    w.reloadEndsAt = time + w.stats.reloadDuration;
    this.events.emit('reloadStart', w.weaponId);
    return true;
  }

  /**
   * Manual fire (user decision 2026-11-06): shoots while the trigger ("fire": mouse button / touch) is held,
   * in the direction the keeper aims (player.aimAngle). Every shot spends one round, target or not.
   * @param {WeaponState} w
   * @param {import('../entities/Player.js').Player} player
   * @param {boolean} fireHeld trigger held this step
   * @param {boolean} manualReload R / touch RELOAD pressed this step
   */
  update(w, player, fireHeld, manualReload, time) {
    if (w.reloading && time >= w.reloadEndsAt) {
      w.reloading = false;
      w.ammo = w.stats.magazineSize;
      this.events.emit('reloadEnd', w.weaponId);
    }
    if (manualReload) this.startReload(w, time);
    if (!player.alive) return false;
    if (w.ammo <= 0 && !w.reloading) this.startReload(w, time); // auto reload once on an empty magazine
    if (!fireHeld || w.reloading || w.ammo <= 0 || time < w.nextShotAt) return false;
    this._fire(w, player, time);
    if (w.ammo <= 0) this.startReload(w, time);
    return true;
  }

  _fire(w, player, time) {
    const s = w.stats;
    w.ammo -= 1;
    w.nextShotAt = time + s.fireInterval;
    w.lastShotAt = time;
    // D52: rounds leave the barrel tip of the gun in the keeper's raised right hand (data/keeperRig.js — the same point
    // the renderer puts the flash on), and fly to the aim point (they converge on the reticle, not parallel beside it)
    const aim = player.aimAngle;
    const mz = muzzlePoint(w.weaponId);
    const c = Math.cos(aim), sn = Math.sin(aim);
    const mx = player.x + c * mz.f - sn * mz.s;
    const my = player.y + sn * mz.f + c * mz.s;
    let base = aim;
    if (player.hasAim) {
      const dx = player.aimX - mx, dy = player.aimY - my;
      if (dx * dx + dy * dy > MIN_CONVERGE * MIN_CONVERGE && dx * c + dy * sn > 0) base = Math.atan2(dy, dx);
    }
    const spread = (s.spreadAngle * Math.PI) / 180;
    const pellets = Math.max(1, s.pelletsPerShot | 0);
    for (let i = 0; i < pellets; i++) {
      const a = base + (this.rng.next() - 0.5) * spread;
      const p = this.pool.spawn();
      p.x = p.prevX = mx;
      p.y = p.prevY = my;
      p.vx = Math.cos(a) * s.projectileSpeed;
      p.vy = Math.sin(a) * s.projectileSpeed;
      p.angle = a;
      p.maxDistance = s.range * PROJECTILES.rangeSlack;
      p.hitsLeft = Math.min(PROJECTILES.maxHitsCap, 1 + (s.penetrationCount | 0));
      p.weaponId = s.id;
      p.spawnedAt = time;
    }
    this.events.emit('shot', mx, my, base, w.weaponId);
  }
}
