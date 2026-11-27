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
    this.busy = !!spawn.busy; // D83 presentation: a posted enemy going through the files until alerted
    // D85 stealth: an item he carries (loot on his body), his body found by another, how he died
    this.carries = spawn.carries || null;
    this.found = false;
    this.killedBy = null;
    // D88 training ground: a dummy stands still (no eyes, no moves), a harmless one never shoots; `tag` groups them for
    // the lessons; noCone — no view cone drawn for him
    this.dummy = !!spawn.dummy;
    this.harmless = !!spawn.harmless || this.dummy;
    this.noCone = !!spawn.noCone || this.dummy;
    this.tag = spawn.tag || null;
    // D89 training ground: rounds do not fell him (the lesson wants a takedown / a grenade) — ProjectileSystem
    this.bulletProof = !!spawn.bulletProof;
    // D117 presentation: he crouches where he stands (the grenade yard's dummies behind their sandbags)
    this.crouch = !!spawn.crouch;
    // D130 training ground: the area he keeps to ([x0, y0, x1, y1]; TutorialDirector holds him in it — the ambush stays
    // off the hero's cover), and his rounds × damageMult (the ambush hurts enough to show the wounds healing)
    this.leash = Array.isArray(spawn.leash) ? spawn.leash : null;
    this.avoid = spawn.avoid || null; // D132: { x, y, r, south } — a spot he keeps away from (the hero's first cover)
    // D148 (Marseille): the man to be taken alive (MissionTasks 'capture') and where he runs when alarmed; a sniper woken
    // by an objective (`wakeOn`: idle and blind until it starts); a body lying there from the start (Moro) that never fades
    this.capture = !!spawn.capture;
    this.captured = false;
    this.fleeTo = spawn.flee || null;
    this.wakeOn = spawn.wakeOn || null;
    this.active = !spawn.wakeOn;
    this.noFade = !!spawn.noFade || !!spawn.dead;
    this.elev = spawn.elev || 0; // D148 presentation: drawn this high (the sniper on the crane's walkway)
    if (spawn.carries) this.carries = spawn.carries;
    if (spawn.damageMult > 0) weapon = { ...weapon, damage: weapon.damage * spawn.damageMult };
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
      // D85: a patrol point may hold a wait (s) and a look angle while waiting
      patrol: spawn.patrol ? spawn.patrol.map(([x, y, wait, look]) => ({ x, y, wait, look })) : null,
      suspicion: 0,          // D85 stealth: 0…1 detection meter
      seenAt: -Infinity,     // last time he saw / felt the hero (stealth)
      investigate: false,    // walking to a suspicious spot (stealth)
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
      aim: 0,                // D148: a sniper's aim (0…1 along his laser)
      goalX: NaN,            // D148: where an attacker heads (mode 'assault') / a fleeing man runs (mode 'flee')
      goalY: NaN,
    };
    if (spawn.dead) { this.state = HUMAN_STATES.DEAD; this.hp = 0; this.deathAt = -1000; this.reported = true; } // D148: Moro
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
