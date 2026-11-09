// Enemy entity (02_SPEC §9). Differences between types come from data/enemies.js.
// DEAD is final: it blocks further damage, targeting and (from Phase 5) a second reward.

export const ENEMY_STATES = Object.freeze({
  IDLE: 'IDLE',                 // Phase 2 test dummies; AI states arrive in Phase 4
  SPAWNING: 'SPAWNING',
  MOVE_TO_BEACON: 'MOVE_TO_BEACON',
  ATTACK_BEACON: 'ATTACK_BEACON',
  ATTACK_PLAYER: 'ATTACK_PLAYER',
  DEAD: 'DEAD',
});

let nextEnemyId = 1;

export class Enemy {
  /** @param {object} type entry of data/enemies.js */
  constructor(type, x, y) {
    this.id = nextEnemyId++;     // stable id (hit tracking, targeting)
    this.typeId = type.id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = type.radius;
    this.maxHp = type.maxHp;
    this.hp = type.maxHp;
    this.armor = type.armor || 0;
    this.state = ENEMY_STATES.MOVE_TO_BEACON;
    this.deathAt = 0;
    this.lastHitAt = -Infinity;
    // Flags used by targeting priorities; filled by later phases (beacon, light).
    this.attackingBeacon = false;
    this.beaconThreat = 0;
    this.illuminated = false;
    this.illuminatedUntil = -Infinity;
    this.faceAngle = 0;          // presentation: where the enemy looks (set by EnemyAISystem)
    // Slow (Frost Coil, Cryo): never stacks — the strongest active slow wins, a new pulse refreshes the duration.
    this.slowAmount = 0;
    this.slowUntil = -Infinity;
    // Beacon attack timing (game clock)
    this.nextAttackAt = 0;
    this.lastAttackAt = -Infinity;  // presentation: lunge on a beacon hit / contact hit
    // Runner ATTACK_PLAYER (D17)
    this.chaseEndsAt = 0;
    this.chaseReadyAt = 0;
    // Boss: true while an attack is telegraphed (the boss stands still)
    this.casting = false;
    // Emergency Flare: stun (no movement, no attacks, no contact damage) + short knockback
    this.stunUntil = 0;
    this.pushVX = 0;
    this.pushVY = 0;
    this.pushUntil = 0;
    // Steering around decor (EnemyAISystem, 2026-11-09): heading offset from the straight line + its re-check time,
    // progress watch (best distance to the beacon so far) and the last-resort "squeeze past decor" window.
    this.steerOffset = 0;
    this.steerSide = 0;
    this.steerCheckAt = 0;
    this.progressAt = 0;
    this.progressDist = Infinity;
    this.phaseUntil = -Infinity;
  }

  isStunned(time) { return time < this.stunUntil; }

  /** Current speed multiplier from slows (1 = no slow). */
  slowFactor(time) {
    return time < this.slowUntil ? 1 - this.slowAmount : 1;
  }

  /** Applies a slow without stacking: max(amount), duration refreshed to at least time + duration. */
  applySlow(amount, duration, time, scaled = true) {
    if (!this.alive || !(amount > 0) || !(duration > 0)) return;
    // scaled: the boss gets bossSlowFactor of it; false = the caller already passes the boss value (Cryo grenade)
    const a = Math.min(0.9, amount * (scaled ? (this.type.bossSlowFactor ?? 1) : 1));
    if (time >= this.slowUntil) this.slowAmount = a;
    else this.slowAmount = Math.max(this.slowAmount, a);
    this.slowUntil = Math.max(this.slowUntil, time + duration);
  }

  get alive() { return this.state !== ENEMY_STATES.DEAD; }

  /**
   * Applies final damage. Returns true exactly once — on the transition to DEAD.
   * A dead enemy ignores damage (no second kill, no second reward).
   */
  applyDamage(amount, time) {
    if (this.state === ENEMY_STATES.DEAD || !(amount > 0) || !Number.isFinite(amount)) return false;
    this.hp -= amount;
    this.lastHitAt = time;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = ENEMY_STATES.DEAD;
      this.deathAt = time;
      return true;
    }
    return false;
  }
}
