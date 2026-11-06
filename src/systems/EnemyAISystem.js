// Enemy behaviour (02_SPEC §8–9), data-driven and shared by all enemies (the boss adds its attacks in BossSystem):
// MOVE_TO_BEACON — straight line to the beacon (no A*; MVP decor never blocks paths), speed × slow;
// ATTACK_BEACON — stops at the beacon edge + reach, hits it every attackInterval (first hit one interval after
//   arriving, so an enemy killed before its attack never damages the beacon). Damage is discrete, never per frame;
// ATTACK_PLAYER — only types with `chase` (Runner, D17): a close keeper pulls it off its path for a short time;
// contact damage (D17) — any enemy touching the keeper hurts him; the keeper's hit invulnerability limits the rate.
// A light separation pass keeps bodies from stacking on one spot (no physics engine).
// Emergency Flare (D38): a stunned enemy stands still, does not attack and deals no contact damage.
import { ENEMY_STATES } from '../entities/Enemy.js';
import { BEACON } from '../data/beacon.js';
import { AI } from '../data/balance.js';

const CONTACT_PAD = AI.contactPad;
const SEPARATION = AI.separation;

export class EnemyAISystem {
  /** @param {import('../core/GameEvents.js').GameEvents} events */
  constructor(events) {
    this.events = events;
    /** @type {import('./Collision.js').CollisionWorld|null} static obstacles (D40): walkers slide around them */
    this.world = null;
  }

  /** Moves an enemy; with a collision world it slides around obstacles (side preference from its id). */
  _step(e, dx, dy) {
    if (this.world) this.world.move(e, dx, dy, (e.id & 1) ? 1 : -1);
    else { e.x += dx; e.y += dy; }
  }

  /**
   * @param {Array} enemies
   * @param {import('../entities/Beacon.js').Beacon} beacon
   * @param {number} dt
   * @param {number} time
   * @param {import('../entities/Player.js').Player} [player] contact damage / chase target
   * @returns {boolean} true exactly once — when an attack destroyed the beacon this step
   */
  update(enemies, beacon, dt, time, player = null) {
    let fell = false;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) { e.attackingBeacon = false; continue; }
      // Emergency Flare: knockback slide, then stun (no movement, no attacks)
      if (time < e.pushUntil) {
        const k = Math.min(dt, e.pushUntil - time);
        e.x += e.pushVX * k;
        e.y += e.pushVY * k;
        if (this.world) this.world.pushOut(e); // a knockback never throws into a rock
      }
      if (e.isStunned(time)) { e.attackingBeacon = false; continue; }
      const t = e.type;
      const dx = beacon.x - e.x, dy = beacon.y - e.y;
      const dist = Math.hypot(dx, dy);
      const stopAt = beacon.radius + e.radius + t.attackReach;
      e.beaconThreat = Math.max(0, 1 - (dist - stopAt) / BEACON.threatRadius);

      // Runner: a close keeper pulls it into ATTACK_PLAYER (from moving or from the beacon).
      const chase = t.chase;
      if (chase && player && player.alive && e.state !== ENEMY_STATES.ATTACK_PLAYER && time >= e.chaseReadyAt
        && Math.hypot(player.x - e.x, player.y - e.y) <= chase.aggroRange) {
        e.state = ENEMY_STATES.ATTACK_PLAYER;
        e.chaseEndsAt = time + chase.chaseDuration;
        e.attackingBeacon = false;
      }

      if (e.casting) { e.attackingBeacon = false; continue; } // boss telegraphing: stands still

      if (e.state === ENEMY_STATES.ATTACK_PLAYER) {
        e.attackingBeacon = false;
        const px = player ? player.x - e.x : 0, py = player ? player.y - e.y : 0;
        const pd = Math.hypot(px, py);
        if (!player || !player.alive || time >= e.chaseEndsAt || pd > chase.aggroRange * chase.giveUpFactor) {
          e.state = ENEMY_STATES.MOVE_TO_BEACON;
          e.chaseReadyAt = time + chase.cooldown;
          continue;
        }
        const touch = e.radius + player.radius;
        const step = Math.min(Math.max(0, pd - touch), t.moveSpeed * e.slowFactor(time) * dt);
        if (pd > 1e-6 && step > 0) this._step(e, (px / pd) * step, (py / pd) * step);
        e.faceAngle = Math.atan2(py, px);
      } else if (e.state === ENEMY_STATES.MOVE_TO_BEACON) {
        e.attackingBeacon = false;
        if (dist <= stopAt) {
          e.state = ENEMY_STATES.ATTACK_BEACON;
          e.nextAttackAt = time + t.attackInterval;
          continue;
        }
        const step = Math.min(dist - stopAt, t.moveSpeed * e.slowFactor(time) * dt);
        if (dist > 1e-6 && step > 0) this._step(e, (dx / dist) * step, (dy / dist) * step);
        e.faceAngle = Math.atan2(dy, dx);
      } else if (e.state === ENEMY_STATES.ATTACK_BEACON) {
        e.attackingBeacon = !beacon.destroyed;
        e.faceAngle = Math.atan2(dy, dx);
        if (beacon.destroyed) continue;
        if (time >= e.nextAttackAt) {
          e.nextAttackAt = time + t.attackInterval;
          e.lastAttackAt = time;
          if (beacon.applyDamage(t.beaconDamage, time)) fell = true;
          this.events.emit('beaconHit', e.x + (dx / dist) * e.radius, e.y + (dy / dist) * e.radius, t.beaconDamage);
        }
      }
    }

    this._separate(enemies, beacon);
    if (player) this._contact(enemies, player, time);
    return fell;
  }

  /** Pushes overlapping bodies apart; the boss is never pushed. Beacon attackers slide along their attack ring. */
  _separate(enemies, beacon) {
    const n = enemies.length;
    for (let i = 0; i < n; i++) {
      const a = enemies[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < n; j++) {
        const b = enemies[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * SEPARATION;
        const ux = dx / d, uy = dy / d;
        const aFixed = !!a.type.boss, bFixed = !!b.type.boss;
        if (aFixed && bFixed) continue;
        const ka = aFixed ? 0 : bFixed ? 1 : 0.5, kb = 1 - ka;
        a.x -= ux * push * ka; a.y -= uy * push * ka;
        b.x += ux * push * kb; b.y += uy * push * kb;
      }
    }
    // Keep beacon attackers exactly on their ring (separation then only slides them sideways).
    for (let i = 0; i < n; i++) {
      const e = enemies[i];
      if (!e.alive || e.state !== ENEMY_STATES.ATTACK_BEACON) continue;
      const dx = e.x - beacon.x, dy = e.y - beacon.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) continue;
      const r = beacon.radius + e.radius + e.type.attackReach;
      e.x = beacon.x + (dx / d) * r;
      e.y = beacon.y + (dy / d) * r;
    }
    // Static obstacles win over crowd separation (nobody is pushed into a rock or a pad).
    if (this.world) for (let i = 0; i < n; i++) if (enemies[i].alive) this.world.pushOut(enemies[i]);
  }

  /** Contact damage: the first touching enemy hurts the keeper; his hit invulnerability blocks the rest. */
  _contact(enemies, player, time) {
    if (!player.alive || player.isInvulnerable(time)) return;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive || !(e.type.contactDamage > 0) || e.isStunned(time)) continue;
      const r = e.radius + player.radius + CONTACT_PAD;
      const dx = player.x - e.x, dy = player.y - e.y;
      if (dx * dx + dy * dy > r * r) continue;
      const applied = player.applyDamage(e.type.contactDamage, time);
      if (applied > 0) {
        e.lastAttackAt = time;
        this.events.emit('playerHit', player.x, player.y, applied, e.typeId);
      }
      return;
    }
  }
}
