// Enemy behaviour (02_SPEC §8–9), data-driven and shared by all enemies (the boss adds its attacks in BossSystem):
// MOVE_TO_BEACON — straight line to the beacon (no A*; MVP decor never blocks paths), speed × slow;
// ATTACK_BEACON — stops at the beacon edge + reach, hits it every attackInterval (first hit one interval after
//   arriving, so an enemy killed before its attack never damages the beacon). Damage is discrete, never per frame;
// ATTACK_PLAYER — only types with `chase` (Runner, D17): a close keeper pulls it off its path for a short time;
// contact damage (D17) — any enemy touching the keeper hurts him; the keeper's hit invulnerability limits the rate.
// A light separation pass keeps bodies from stacking on one spot (no physics engine).
// Emergency Flare (D38): a stunned enemy stands still, does not attack and deals no contact damage.
// D52: a walker passing close to a working device turns on it for a few seconds (data/defenses.js DEVICE_AGGRO), then
// goes on to the beacon; a Spitter lobs every n-th glob at a device in reach.
import { ENEMY_STATES } from '../entities/Enemy.js';
import { BEACON } from '../data/beacon.js';
import { AI } from '../data/balance.js';
import { terrainSpeed } from '../data/maps.js';
import { isStructure, COLLIDER } from './Collision.js';
import { DEVICE_AGGRO } from '../data/defenses.js';

const isDecor = (c) => !isStructure(c);

const CONTACT_PAD = AI.contactPad;
const SEPARATION = AI.separation;
const ARRIVE_EPS = 0.5; // world units

export class EnemyAISystem {
  /** @param {import('../core/GameEvents.js').GameEvents} events */
  constructor(events) {
    this.events = events;
    /** @type {import('./Collision.js').CollisionWorld|null} static obstacles (D40): walkers slide around them */
    this.world = null;
    /** @type {object|null} map data: slow zones (Salt Marsh, D45) */
    this.map = null;
    /** @type {((e:object, target:object, time:number, device?:object)=>void)|null} ranged attack (Spitter glob) */
    this.onRanged = null;
    /** @type {import('./DefenseSystem.js').DefenseSystem|null} devices enemies may turn on (D52), set by the map run */
    this.defenses = null;
  }

  /** Nearest working device whose pad edge is within DEVICE_AGGRO.range of the enemy (null if none). */
  _deviceNear(e, reach) {
    if (!this.defenses) return null;
    let best = null, bestD = Infinity;
    for (const pad of this.defenses.pads) {
      const d = pad.device;
      if (!d || d.hp <= 0) continue;
      const gap = Math.hypot(d.x - e.x, d.y - e.y) - COLLIDER.pad - e.radius;
      if (gap <= reach && gap < bestD) { bestD = gap; best = d; }
    }
    return best;
  }

  /**
   * D52: an enemy busy with a device walks up to it and hits it (beacon damage, attack interval) until the attack time
   * is over. Returns true while it is busy this step (the normal beacon logic is skipped).
   */
  _attackDevice(e, t, dt, time) {
    const d = e.devTarget, A = DEVICE_AGGRO;
    const pad = d && this.defenses ? this.defenses.pads[d.padIndex] : null;
    if (!d || d.hp <= 0 || !pad || pad.device !== d || (e.devUntil > 0 && time >= e.devUntil) || (e.devUntil === 0 && time >= e.devGiveUpAt)) {
      e.devTarget = null;
      e.devReadyAt = time + A.cooldown;
      return false;
    }
    const dx = d.x - e.x, dy = d.y - e.y;
    const dist = Math.hypot(dx, dy);
    const stopAt = COLLIDER.pad + e.radius + t.attackReach;
    if (dist > 1e-6) e.faceAngle = Math.atan2(dy, dx);
    if (dist > stopAt + ARRIVE_EPS) {
      const step = Math.min(dist - stopAt, t.moveSpeed * e.slowFactor(time) * dt);
      if (step > 0) this._step(e, (dx / dist) * step, (dy / dist) * step, time);
      return true;
    }
    if (e.devUntil === 0) { e.devUntil = time + A.attackTime; e.nextAttackAt = time + A.firstHit; }
    if (time >= e.nextAttackAt) {
      e.nextAttackAt = time + t.attackInterval;
      e.lastAttackAt = time;
      this.defenses.damage(d, t.beaconDamage, time);
    }
    return true;
  }

  /**
   * Moves an enemy; with a collision world it slides around obstacles (side preference from its id). While it is
   * squeezing past decor (stuck fallback) only the beacon / pads / kiosk block it.
   */
  _step(e, dx, dy, time) {
    if (this.map && this.map.slowZones) { const k = terrainSpeed(this.map, e.x, e.y); dx *= k; dy *= k; }
    if (this.world && time < e.phaseUntil) {
      this.world.move(e, dx, dy, (e.id & 1) ? 1 : -1, isStructure); // still slides around the beacon / pads / kiosk
      // never end the squeeze inside a rock (it would pop back where it got stuck)
      if (e.phaseUntil - time < 0.1 && this.world.overlaps(e, isDecor)) e.phaseUntil = time + 0.2;
    }
    else if (this.world) this.world.move(e, dx, dy, (e.id & 1) ? 1 : -1);
    else { e.x += dx; e.y += dy; }
  }

  /**
   * Heading towards (ux, uy) around decor (2026-11-09, no pathfinding): a short look-ahead ray; if it is blocked the
   * side headings are tried, the last chosen side first (no zig-zag). `reach` caps the ray (it never tests the
   * beacon the enemy is walking to). Re-checked on a timer, staggered by id. Returns the angle offset to use.
   */
  _steer(e, ux, uy, reach, time) {
    if (time < e.steerCheckAt) return e.steerOffset;
    e.steerCheckAt = time + AI.steerInterval + (e.id % 7) * 0.01;
    const only = time < e.phaseUntil ? isStructure : null; // squeezing past decor: steer around structures only
    const look = Math.min(reach, e.radius * 2 + AI.steerLook);
    if (look <= 1 || this._clear(e, ux, uy, look, only)) { e.steerOffset = 0; return 0; }
    const side = e.steerSide || ((e.id & 1) ? 1 : -1);
    for (const a of AI.steerAngles) {
      for (const s of [side, -side]) {
        const ang = a * s, c = Math.cos(ang), sn = Math.sin(ang);
        if (this._clear(e, ux * c - uy * sn, ux * sn + uy * c, look, only)) { e.steerOffset = ang; e.steerSide = s; return ang; }
      }
    }
    e.steerOffset = side * Math.PI / 2; // boxed in: hug sideways along the obstacle
    e.steerSide = side;
    return e.steerOffset;
  }

  /** A body of this enemy (slightly slimmer, so a touching obstacle still counts) can walk `look` along (dx, dy). */
  _clear(e, dx, dy, look, filter = null) {
    return this.world.segmentHit(e.x, e.y, e.x + dx * look, e.y + dy * look, e.radius * 0.9, filter) === Infinity;
  }

  /** Stuck fallback: no real progress towards the beacon in a window → squeeze past decor for a moment. */
  _watchProgress(e, dist, time) {
    if (time < e.progressAt) return;
    if (dist > e.progressDist - AI.progressMin && e.progressDist !== Infinity) {
      e.phaseUntil = time + AI.phaseTime;
      e.steerCheckAt = time; // re-plan at once around the structures only
    }
    e.progressDist = dist;
    e.progressAt = time + AI.progressWindow;
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
    this._time = time;
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
        if (pd > 1e-6 && step > 0) this._step(e, (px / pd) * step, (py / pd) * step, time);
        e.faceAngle = Math.atan2(py, px);
      } else if (e.state === ENEMY_STATES.MOVE_TO_BEACON) {
        e.attackingBeacon = false;
        // D52: a working device close to its path distracts a walker for a moment (bosses / spitters never stop)
        if (this.defenses && !t.boss && !t.ranged) {
          if (!e.devTarget && time >= e.devReadyAt) {
            const d = this._deviceNear(e, DEVICE_AGGRO.range);
            if (d) { e.devTarget = d; e.devUntil = 0; e.devGiveUpAt = time + DEVICE_AGGRO.giveUpAfter; }
          }
          if (e.devTarget && this._attackDevice(e, t, dt, time)) continue;
        }
        // + ARRIVE_EPS: the last step lands exactly on the ring; float rounding could leave it 1e-13 short forever
        if (dist <= stopAt + ARRIVE_EPS) {
          e.state = ENEMY_STATES.ATTACK_BEACON;
          e.nextAttackAt = time + t.attackInterval;
          continue;
        }
        const step = Math.min(dist - stopAt, t.moveSpeed * e.slowFactor(time) * dt);
        if (dist > 1e-6 && step > 0) {
          let ux = dx / dist, uy = dy / dist;
          if (this.world) {
            this._watchProgress(e, dist, time);
            const off = this._steer(e, ux, uy, dist - stopAt, time);
            if (off !== 0) { const c = Math.cos(off), s = Math.sin(off); const rx = ux * c - uy * s; uy = ux * s + uy * c; ux = rx; }
          }
          this._step(e, ux * step, uy * step, time);
          e.faceAngle = Math.atan2(uy, ux);
        } else e.faceAngle = Math.atan2(dy, dx);
      } else if (e.state === ENEMY_STATES.ATTACK_BEACON) {
        e.attackingBeacon = !beacon.destroyed;
        e.faceAngle = Math.atan2(dy, dx);
        if (beacon.destroyed) continue;
        if (time >= e.nextAttackAt) {
          e.nextAttackAt = time + t.attackInterval;
          e.lastAttackAt = time;
          if (t.ranged && this.onRanged) { // Spitter: damage on landing; every n-th glob at a device in reach (D52)
            e.globCount += 1;
            const dev = e.globCount % DEVICE_AGGRO.spitterEvery === 0 ? this._deviceNear(e, DEVICE_AGGRO.spitterReach) : null;
            if (dev) { e.faceAngle = Math.atan2(dev.y - e.y, dev.x - e.x); this.onRanged(e, dev, time, dev); }
            else this.onRanged(e, beacon, time);
            continue;
          }
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
    // (an enemy squeezing past decor — stuck fallback — is only kept out of the beacon / pads / kiosk)
    if (this.world) {
      for (let i = 0; i < n; i++) {
        const e = enemies[i];
        if (e.alive) this.world.pushOut(e, this._time < e.phaseUntil ? isStructure : null);
      }
    }
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
