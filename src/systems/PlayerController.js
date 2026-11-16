// Player movement and dodge (02_SPEC §4). Reads only abstract input (getMove / consumePressed / pointerWorld),
// never keys or DOM — keyboard and touch drive it the same way.
import { PLAYER, COVER, dodgeTravel } from '../data/player.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config/constants.js';

const move = { x: 0, y: 0 }; // reused
const aim = { x: 0, y: 0 };

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
    /** @type {import('./Collision.js').CollisionWorld|null} static obstacles (D40) */
    this.world = null;
  }

  /**
   * @param {import('../entities/Player.js').Player} player
   * @param {{getMove:Function, consumePressed:Function, getAimWorld?:Function}} input
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

    // The keeper always faces the aim point (cursor / finger); without one he keeps his facing.
    const a = input.getAimWorld ? input.getAimWorld(aim) : null;
    player.hasAim = !!a;
    if (a) {
      const dx = a.x - player.x, dy = a.y - player.y;
      if (dx * dx + dy * dy > 4) player.aimAngle = Math.atan2(dy, dx);
      player.aimX = a.x;
      player.aimY = a.y;
    }

    if (input.consumePressed('dash')) this._tryDodge(player, moving, time);
    if (player.dodging && time >= player.dodgeEndsAt) player.dodging = false;

    if (player.dodging) {
      // D82: along the roll clip's own path (fast in the dive, slow while getting up); untouchable in the dive / roll
      const D = PLAYER.dodge, k0 = (time - player.dodgeStartAt) / D.duration, k1 = k0 + dt / D.duration;
      const step = (dodgeTravel(k1) - dodgeTravel(k0)) * D.distance;
      player.vx = dt > 0 ? (player.dodgeDirX * step) / dt : 0;
      player.vy = dt > 0 ? (player.dodgeDirY * step) / dt : 0;
      if (k1 > D.invulnerableFrom && k0 < D.invulnerableTo) {
        player.invulnerableUntil = Math.max(player.invulnerableUntil, player.dodgeStartAt + D.invulnerableTo * D.duration);
      }
    } else {
      const aiming = time < player.faceAimUntil; // D79: slower while shooting / aiming
      const speed = PLAYER.moveSpeed * this.speedMult * (aiming ? PLAYER.aimMoveMult : 1) * (player.crouched ? COVER.crouchSpeedMult : 1);
      player.vx = move.x * speed; // |move| ≤ 1 → diagonal is never faster
      player.vy = move.y * speed;
    }

    const r = player.radius;
    player.x = clamp(player.x + player.vx * dt, r, this.bounds.w - r);
    player.y = clamp(player.y + player.vy * dt, r, this.bounds.h - r);
    if (this.world && this.world.pushOut(player)) { // obstacles: slide along them (radial push-out keeps the tangent)
      player.x = clamp(player.x, r, this.bounds.w - r);
      player.y = clamp(player.y, r, this.bounds.h - r);
    }
    this._cover(player, moving, time);
  }

  /**
   * D82 cover: walking INTO a cover object for a moment takes cover against it; it is kept while he stands or moves
   * along it, and left when he walks away from it, slides off its end or rolls.
   */
  _cover(p, moving, time) {
    const C = COVER;
    const c = this.world && !p.dodging ? this.world.coverAt(p.x, p.y, p.radius + C.reach, CONTACT) : null;
    if (!c) { p.cover = null; p.coverSince = -1; return; }
    const len = Math.hypot(move.x, move.y) || 1;
    const into = moving ? -(move.x * c.nx + move.y * c.ny) / len : 0; // > 0: pushing into the object
    if (p.cover) {
      if (into < -C.exitDot) { p.cover = null; p.coverSince = -1; p.coverBlockUntil = time + 0.3; return; }
      p.cover.kind = c.shape.cover; p.cover.nx = c.nx; p.cover.ny = c.ny; // sliding along it (or onto the next one)
      return;
    }
    if (into < C.pushDot || time < p.coverBlockUntil) { p.coverSince = -1; return; }
    if (p.coverSince < 0) p.coverSince = time;
    if (time - p.coverSince >= C.enterTime) {
      p.cover = { kind: c.shape.cover, nx: c.nx, ny: c.ny };
      this.events.emit('cover', c.shape.cover);
    }
  }

  _tryDodge(player, moving, time) {
    if (player.dodging || time < player.dodgeReadyAt) return false; // cooldown / already rolling
    // D82 (user request): moving — the roll goes where he moves; standing — where his arms (the body) point
    let dx = Math.cos(player.bodyAngle), dy = Math.sin(player.bodyAngle);
    if (moving) { const l = Math.hypot(move.x, move.y) || 1; dx = move.x / l; dy = move.y / l; }
    player.dodging = true;
    player.dodgeDirX = dx;
    player.dodgeDirY = dy;
    player.dodgeStartAt = time;
    player.dodgeFromX = player.x;
    player.dodgeFromY = player.y;
    player.dodgeEndsAt = time + PLAYER.dodge.duration;
    player.dodgeCooldown = PLAYER.dodge.cooldown * this.dodgeCooldownMult; // presentation: DASH button progress ring
    player.dodgeReadyAt = time + player.dodgeCooldown;
    player.cover = null;
    player.crouched = false;
    this.events.emit('dash', player.x, player.y);
    return true;
  }
}

const CONTACT = { shape: null, nx: 0, ny: 0, gap: 0 };

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
