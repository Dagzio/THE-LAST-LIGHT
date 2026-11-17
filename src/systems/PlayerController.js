// Player movement and dodge (02_SPEC §4). Reads only abstract input (getMove / consumePressed / pointerWorld),
// never keys or DOM — keyboard and touch drive it the same way.
import { PLAYER, COVER, dodgeTravel, dodgeOf } from '../data/player.js';
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
    /** @type {{next:()=>number}|null} D83: the run's seeded RNG (which roll clip) */
    this.rng = null;
    /** D85 stealth: { walk, run, crouch } speeds (player.moveMode picks one); null = the normal speed */
    this.speedProfile = null;
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

    if (player.takedown) { player.vx = 0; player.vy = 0; input.consumePressed('dash'); input.consumePressed('cover'); return; } // D85: locked
    if (input.consumePressed('dash')) this._tryDodge(player, moving, time);
    if (input.consumePressed('cover')) this.toggleCover(player, time);
    if (player.dodging && time >= player.dodgeEndsAt) player.dodging = false;

    const x0 = player.x, y0 = player.y;
    if (player.dodging) {
      // D82: along the roll clip's own path (fast in the dive, slow while getting up); untouchable in the dive / roll
      const D = dodgeOf(player), k0 = (time - player.dodgeStartAt) / D.duration, k1 = k0 + dt / D.duration;
      const step = (dodgeTravel(k1, D) - dodgeTravel(k0, D)) * D.distance;
      player.vx = dt > 0 ? (player.dodgeDirX * step) / dt : 0;
      player.vy = dt > 0 ? (player.dodgeDirY * step) / dt : 0;
      if (k1 > D.invulnerableFrom && k0 < D.invulnerableTo) {
        player.invulnerableUntil = Math.max(player.invulnerableUntil, player.dodgeStartAt + D.invulnerableTo * D.duration);
      }
    } else if (player.cover) {
      this._coverMove(player, dt, time);
    } else {
      const aiming = time < player.faceAimUntil; // D79: slower while shooting / aiming
      const SP = this.speedProfile; // D85 stealth: walk (silent) / run / crouch
      const base = SP ? (player.moveMode === 'run' ? SP.run : player.moveMode === 'crouch' ? SP.crouch : SP.walk) : PLAYER.moveSpeed;
      const speed = base * this.speedMult * (aiming ? PLAYER.aimMoveMult : 1);
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
    this._coverAfterMove(player, x0, y0, dt, time);
  }

  /** D83: Q / the COVER button — takes the cover offered here, or leaves the current one. */
  toggleCover(p, time) {
    if (!p.alive || p.dodging) return false;
    if (p.cover) { this._leaveCover(p); return true; }
    const c = this.world ? this.world.coverAt(p.x, p.y, p.radius + COVER.reach, CONTACT) : null;
    if (!c) return false;
    p.cover = { kind: c.shape.cover, nx: c.nx, ny: c.ny };
    p.coverSnapUntil = time + COVER.snapTime;
    p.coverAwayFor = 0;
    this.events.emit('cover', c.shape.cover);
    return true;
  }

  _leaveCover(p) { p.cover = null; p.crouched = false; p.coverAwayFor = 0; }

  /** In cover: steps up to the object first, then moves only along it (kneeling / sneaking sideways). */
  _coverMove(p, dt, time) {
    const c = p.cover, C = COVER;
    const tx = -c.ny, ty = c.nx;                          // along the object
    const along = move.x * tx + move.y * ty, away = move.x * c.nx + move.y * c.ny;
    const speed = PLAYER.moveSpeed * this.speedMult * (c.kind === 'low' ? C.crouchSpeedMult : C.sneakSpeedMult);
    p.vx = tx * along * speed;
    p.vy = ty * along * speed;
    if (time < p.coverSnapUntil && dt > 0) {             // step up to it (the push-out stops him at its face)
      const g = this.world ? this.world.coverAt(p.x, p.y, p.radius + C.reach, CONTACT) : null;
      const go = g ? Math.max(0, g.gap - p.radius - 0.5) : 0;
      const sp = Math.min(go / dt, go / Math.max(dt, p.coverSnapUntil - time) + 60);
      p.vx -= c.nx * sp; p.vy -= c.ny * sp;
    }
    // pushing away from the object for a moment leaves the cover
    p.coverAwayFor = away > C.exitDot ? p.coverAwayFor + dt : 0;
    if (p.coverAwayFor >= C.exitHold) this._leaveCover(p);
  }

  /** After the move: keep the cover's normal / kind up to date, stop at the object's end; the button / Q offer. */
  _coverAfterMove(p, x0, y0, dt, time) {
    const reach = p.radius + COVER.reach;
    if (p.cover && !p.dodging) {
      const wasFace = Math.abs(p.cover.nx) >= 0.97 || Math.abs(p.cover.ny) >= 0.97;
      let c = this.world ? this.world.coverAt(p.x, p.y, reach, CONTACT) : null;
      // past the object's end (the nearest point is its corner): back to where he was — he stops at the edge
      if (!c || (wasFace && time >= p.coverSnapUntil && c.shape.box && Math.abs(c.nx) < 0.97 && Math.abs(c.ny) < 0.97)) {
        p.x = x0; p.y = y0; p.vx = 0; p.vy = 0;
        c = this.world ? this.world.coverAt(p.x, p.y, reach, CONTACT) : null;
      }
      if (c) { p.cover.kind = c.shape.cover; p.cover.nx = c.nx; p.cover.ny = c.ny; } else this._leaveCover(p);
    }
    const here = !p.cover && !p.dodging && p.alive && this.world ? this.world.coverAt(p.x, p.y, reach, CONTACT) : null;
    p.coverHere = here ? here.shape.cover : null;
  }

  _tryDodge(player, moving, time) {
    if (player.dodging || time < player.dodgeReadyAt) return false; // cooldown / already rolling
    // D82 (user request): moving — the roll goes where he moves; standing — where his arms (the body) point
    let dx = Math.cos(player.bodyAngle), dy = Math.sin(player.bodyAngle);
    if (moving) { const l = Math.hypot(move.x, move.y) || 1; dx = move.x / l; dy = move.y / l; }
    // D83: one of the two roll clips at random (seeded)
    const n = PLAYER.dodge.variants.length;
    player.dodgeVariant = this.rng ? Math.min(n - 1, Math.floor(this.rng.next() * n)) : 0;
    player.dodging = true;
    player.dodgeDirX = dx;
    player.dodgeDirY = dy;
    player.dodgeStartAt = time;
    player.dodgeFromX = player.x;
    player.dodgeFromY = player.y;
    player.dodgeEndsAt = time + dodgeOf(player).duration;
    player.dodgeCooldown = PLAYER.dodge.cooldown * this.dodgeCooldownMult; // presentation: DASH button progress ring
    player.dodgeReadyAt = time + player.dodgeCooldown;
    this._leaveCover(player);
    this.events.emit('dash', player.x, player.y);
    return true;
  }
}

const CONTACT = { shape: null, nx: 0, ny: 0, gap: 0 };

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
