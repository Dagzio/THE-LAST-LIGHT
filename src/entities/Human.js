// KILL LIST (D78): an armed human enemy — plain state, no rendering. Stats come from data/humans.js, the gun from
// data/weapons.js. DEAD is final: no second kill, no second report. The AI state lives in `ai` (systems/HumanAISystem).

export const HUMAN_STATES = Object.freeze({ ACTIVE: 'ACTIVE', DEAD: 'DEAD' });

let nextHumanId = 1;

export class Human {
  /** @param {object} type data/humans.js entry @param {object} weapon data/weapons.js entry @param {object} spawn level entry */
  constructor(type, weapon, spawn) {
    this.id = nextHumanId++;
    this.typeId = type.id;
    this.type = type;
    this.x = spawn.x;
    this.y = spawn.y;
    this.prevX = spawn.x;
    this.prevY = spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.radius = type.radius;
    this.maxHp = type.hp;
    this.hp = type.hp;
    this.armor = type.armor || 0;
    this.state = HUMAN_STATES.ACTIVE;
    this.deathAt = 0;
    this.lastHitAt = -Infinity;
    this.faceAngle = Number.isFinite(spawn.angle) ? spawn.angle : 0; // where the body / eyes look
    this.illuminated = false; // DamageCalculator contract (no beam in KILL LIST)
    this.gun = {
      stats: weapon,
      ammo: weapon.magazineSize,
      reloading: false,
      reloadStartedAt: 0,
      reloadEndsAt: 0,
      nextShotAt: 0,
      burstLeft: weapon.burst || 1,
      lastShotAt: -Infinity,
    };
    this.ai = {
      mode: spawn.patrol ? 'patrol' : 'idle',
      post: { x: spawn.x, y: spawn.y, angle: this.faceAngle },
      patrol: spawn.patrol ? spawn.patrol.map(([x, y]) => ({ x, y })) : null,
      patrolIdx: 1,
      waitUntil: 0,
      sees: false,
      aware: false,          // has ever been alerted (reacts faster afterwards)
      reactAt: 0,
      lastSeenX: spawn.x,
      lastSeenY: spawn.y,
      lastSeenAt: -Infinity,
      route: [],
      routeIdx: 0,
      routeGoalX: NaN,
      routeGoalY: NaN,
      strafeDir: 1,
      strafeUntil: 0,
      searchUntil: 0,
      thinkAt: 0,
      progressAt: 0,
      progressX: spawn.x,
      progressY: spawn.y,
      sideUntil: 0,
      sideX: 0,
      sideY: 0,
    };
  }

  get alive() { return this.state !== HUMAN_STATES.DEAD; }

  /** Applies final damage. Returns true exactly once — on the transition to DEAD. */
  applyDamage(amount, time) {
    if (!this.alive || !(amount > 0) || !Number.isFinite(amount)) return false;
    this.hp -= amount;
    this.lastHitAt = time;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = HUMAN_STATES.DEAD;
      this.deathAt = time;
      this.vx = 0;
      this.vy = 0;
      return true;
    }
    return false;
  }
}
