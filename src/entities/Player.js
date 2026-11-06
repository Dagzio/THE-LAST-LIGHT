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
    this.aimAngle = 0;         // presentation: where the pistol points

    this.dodging = false;
    this.dodgeEndsAt = 0;
    this.dodgeReadyAt = 0;     // game-clock time when dodge is available again
    this.dodgeDirX = 1;
    this.dodgeDirY = 0;
    this.invulnerableUntil = 0;
    this.lastHitAt = -Infinity; // presentation: hurt flash
  }

  isInvulnerable(time) { return time < this.invulnerableUntil; }

  /**
   * Incoming damage after armor/temporary reductions (02_SPEC §6): invulnerability check → HP change.
   * @returns {number} damage actually applied (0 if ignored)
   */
  applyDamage(amount, time, hitInvulnerability = PLAYER.hitInvulnerability) {
    if (!this.alive || !(amount > 0) || !Number.isFinite(amount)) return 0;
    if (this.isInvulnerable(time)) return 0;
    const applied = Math.min(this.hp, amount);
    this.hp -= applied;
    this.lastHitAt = time;
    this.invulnerableUntil = Math.max(this.invulnerableUntil, time + hitInvulnerability);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return applied;
  }
}
