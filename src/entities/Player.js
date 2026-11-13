// Player entity: plain state, no rendering, no input. Stats come from data/player.js.
import { PLAYER } from '../data/player.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER.radius;
    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.alive = true;

    this.facingX = 1;          // last non-zero movement direction (dodge fallback)
    this.facingY = 0;
    this.hasMoved = false;     // until the first move, a standing dodge goes towards the cursor
    this.aimAngle = 0;         // where the keeper looks and shoots (manual aim)
    this.aimX = x;             // aim point on the ground (reticle), valid while hasAim
    this.aimY = y;
    this.hasAim = false;
    // D76: where the body faces — the movement direction; the aim while shooting / aiming a grenade (FACING)
    this.bodyAngle = 0;
    this.faceAimUntil = 0;     // game-clock time until which the body keeps facing the aim after a shot

    this.dodging = false;
    this.dodgeEndsAt = 0;
    this.dodgeReadyAt = 0;     // game-clock time when dodge is available again
    this.dodgeCooldown = 0;    // length of the current cooldown (s) — the DASH button fills its ring over it
    this.dodgeDirX = 1;
    this.dodgeDirY = 0;
    this.invulnerableUntil = 0;
    // D62 poison (Spitter spit): damage every poisonEvery s until poisonUntil
    this.poisonUntil = 0;
    this.poisonNextAt = 0;
    this.poisonDamage = 0;
    this.poisonEvery = 1;
    this.lastHitAt = -Infinity; // presentation: hurt flash
    this.damageTakenMult = 1;   // permanent ARMOR upgrade (−2% per rank), set from the loadout
  }

  isInvulnerable(time) { return time < this.invulnerableUntil; }

  /**
   * Incoming damage (02_SPEC §6): base → permanent Armor → (temporary armor, Phase 6) → invulnerability → HP.
   * @returns {number} damage actually applied (0 if ignored)
   */
  applyDamage(amount, time, hitInvulnerability = PLAYER.hitInvulnerability, ignoreInvulnerability = false) {
    if (!this.alive || !(amount > 0) || !Number.isFinite(amount)) return 0;
    if (!ignoreInvulnerability && this.isInvulnerable(time)) return 0; // D62: poison ticks go through it
    const reduced = amount * (this.damageTakenMult > 0 ? this.damageTakenMult : 1);
    const applied = Math.min(this.hp, reduced);
    this.hp -= applied;
    this.lastHitAt = time;
    this.invulnerableUntil = Math.max(this.invulnerableUntil, time + hitInvulnerability);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return applied;
  }
}
