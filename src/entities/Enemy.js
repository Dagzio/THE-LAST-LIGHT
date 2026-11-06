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
    this.state = ENEMY_STATES.IDLE;
    this.deathAt = 0;
    this.lastHitAt = -Infinity;
    // Flags used by targeting priorities; filled by later phases (beacon, light).
    this.attackingBeacon = false;
    this.beaconThreat = 0;
    this.illuminated = false;
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
