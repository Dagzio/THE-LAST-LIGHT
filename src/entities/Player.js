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

    this.aimPose = false;      // D82: the arms hold the gun up at the aim (presentation reads it; set by the run)

    // D82 / D83 cover (data/player.js COVER): the object he is behind, and whether the low objects shield him now
    this.cover = null;         // { kind: 'low' | 'high', nx, ny } — n points from the object to him
    this.coverHere = null;     // the cover kind he could take right here ('low' / 'high'): the button / Q shows
    this.coverSnapUntil = 0;   // steps up to the object until this time
    this.coverAwayFor = 0;     // s he has pushed away from the object
    this.exposedUntil = 0;     // kneeling fire from low cover: exposed until this time
    this.rise = null;          // D110: standing up from low cover to fire { k 0…1, until, up } (PlayerController._riseGate)
    this.crouched = false;
    // D85 stealth: stance (C) and how he moves; a takedown in progress locks him
    this.stance = 'stand';     // 'stand' | 'crouch'
    this.moveMode = 'walk';    // 'walk' | 'run' | 'crouch' (stealth speeds)
    this.takedown = null;      // { e, t0, killed } while a takedown plays

    this.dodging = false;
    this.dodgeVariant = 0;     // D83: which roll clip (data/player.js PLAYER.dodge.variants)
    this.dodgeStartAt = 0;
    this.dodgeFromX = x;       // D82: the roll follows the clip's path from here
    this.dodgeFromY = y;
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

  /** D85: low to the ground — kneeling behind cover or crouching (low objects then hide him from the eyes). */
  get lowProfile() { return this.crouched || this.stance === 'crouch'; }

  /**
   * Incoming damage (02_SPEC §6): base → permanent Armor → (temporary armor, Phase 6) → invulnerability → HP.
   * @returns {number} damage actually applied (0 if ignored)
   */
  applyDamage(amount, time, hitInvulnerability = PLAYER.hitInvulnerability, ignoreInvulnerability = false) {
    if (!this.alive || !(amount > 0) || !Number.isFinite(amount)) return 0;
    if (!ignoreInvulnerability && this.isInvulnerable(time)) return 0; // D62: poison ticks go through it
    const reduced = amount * (this.damageTakenMult > 0 ? this.damageTakenMult : 1);
    // D89: the training ground never kills him (minHp — the ambush only hurts; the medkit lesson follows)
    const applied = Math.max(0, Math.min(this.hp - (this.minHp > 0 ? this.minHp : 0), reduced));
    this.hp -= applied;
    this.lastHitAt = time;
    this.invulnerableUntil = Math.max(this.invulnerableUntil, time + hitInvulnerability);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return applied;
  }
}
