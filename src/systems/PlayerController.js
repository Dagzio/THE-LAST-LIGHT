// Player movement and dodge (02_SPEC §4). Reads only abstract input (getMove / consumePressed / pointerWorld),
// never keys or DOM — keyboard and touch drive it the same way.
import { PLAYER } from '../data/player.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config/constants.js';

const move = { x: 0, y: 0 }; // reused

export class PlayerController {
  /**
   * @param {import('../core/GameEvents.js').GameEvents} events
   * @param {{w:number,h:number}} bounds playable map size in world units
   */
  constructor(events, bounds = { w: WORLD_WIDTH, h: WORLD_HEIGHT }) {
    this.events = events;
    this.bounds = bounds;
    // Permanent (Phase 5) and temporary (Phase 6) speed multipliers.
    this.speedMult = 1;
    this.dodgeCooldownMult = 1;
  }

  /**
   * @param {import('../entities/Player.js').Player} player
   * @param {{getMove:Function, consumePressed:Function, pointerWorld?:Function, pointer?:{inside:boolean}}} input
   */
  update(player, input, dt, time) {
    if (!player.alive) { player.vx = 0; player.vy = 0; return; }
    input.getMove(move);
    const moving = move.x !== 0 || move.y !== 0;
    if (moving) {
      const len = Math.hypot(move.x, move.y) || 1;
      player.facingX = move.x / len;
      player.facingY = move.y / len;
      player.hasMoved = true;
    }

    if (input.consumePressed('dash')) this._tryDodge(player, input, moving, time);
    if (player.dodging && time >= player.dodgeEndsAt) player.dodging = false;

    if (player.dodging) {
      player.vx = player.dodgeDirX * PLAYER.dodge.speed;
      player.vy = player.dodgeDirY * PLAYER.dodge.speed;
    } else {
      const speed = PLAYER.moveSpeed * this.speedMult;
      player.vx = move.x * speed; // |move| ≤ 1 → diagonal is never faster
      player.vy = move.y * speed;
    }

    const r = player.radius;
    player.x = clamp(player.x + player.vx * dt, r, this.bounds.w - r);
    player.y = clamp(player.y + player.vy * dt, r, this.bounds.h - r);
  }

  _tryDodge(player, input, moving, time) {
    if (player.dodging || time < player.dodgeReadyAt) return false; // cooldown / already dashing
    let dx = player.facingX, dy = player.facingY;
    // Standing: last movement direction; if the player never moved — towards the cursor (GDD §8.3).
    if (!moving && !player.hasMoved && input.pointer && input.pointer.inside && input.pointerWorld) {
      const p = input.pointerWorld();
      const len = Math.hypot(p.x - player.x, p.y - player.y);
      if (len > 1) { dx = (p.x - player.x) / len; dy = (p.y - player.y) / len; }
    }
    player.dodging = true;
    player.dodgeDirX = dx;
    player.dodgeDirY = dy;
    player.dodgeEndsAt = time + PLAYER.dodge.duration;
    player.dodgeReadyAt = time + PLAYER.dodge.cooldown * this.dodgeCooldownMult;
    player.invulnerableUntil = Math.max(player.invulnerableUntil, time + PLAYER.dodge.invulnerability);
    this.events.emit('dash', player.x, player.y);
    return true;
  }
}

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
