// Player movement and dodge (02_SPEC §4). Reads only abstract input (getMove / consumePressed / pointerWorld),
// never keys or DOM — keyboard and touch drive it the same way.
import { PLAYER, COVER, dodgeTravel, dodgeOf } from '../data/player.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config/constants.js';
import { BLOCK } from './Collision.js';

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

  _leaveCover(p) { p.cover = null; p.crouched = false; p.coverAwayFor = 0; p.peek = null; }

  /**
   * D87: is he at an edge of his HIGH cover? → +1 / −1 (the side along the cover's tangent where it ends), or 0.
   * When both sides end (a short object) the one towards the aim wins.
   */
  coverEdge(p) {
    const c = p.cover;
    if (!c || !this.world) return 0;
    const tx = -c.ny, ty = c.nx;
    let side = 0, best = -Infinity;
    for (const s of [1, -1]) {
      if (!this._endsAt(p, s, COVER.edgeProbe, 'high')) continue;
      const toAim = p.hasAim ? (p.aimX - p.x) * tx * s + (p.aimY - p.y) * ty * s : 0;
      if (toAim > best) { best = toAim; side = s; }
    }
    return side;
  }

  /**
   * D90: does his cover's face end within d along its tangent (side s)? The probe runs just off the face (1 unit), so
   * the first unit past the end already counts — not his centre's distance, which made the corner fuzzy. kind: the
   * face must be cover of this kind to go on (null — any cover).
   */
  _endsAt(p, s, d, kind = null) {
    const w = this.world;
    const g0 = w.coverAt(p.x, p.y, p.radius + COVER.reach, PROBE0);
    if (!g0) return true;
    const tx = -g0.ny, ty = g0.nx, off = g0.gap - 1;
    // D97: along a curved prop (its boxes, one group) the next box steps back — look further for it
    const grp = g0.shape.group, g = w.coverAt(p.x + tx * s * d - g0.nx * off, p.y + ty * s * d - g0.ny * off, grp ? 16 : 3, EDGE);
    if (grp) return !g || g.shape.group !== grp;
    return !g || (!!kind && g.shape.cover !== kind) || (!g.shape.group && !!g.shape.box && Math.abs(g.nx) < 0.97 && Math.abs(g.ny) < 0.97); // D97: a group's joints are no end
  }

  /**
   * D87: the trigger in HIGH cover — at an edge he leans out past it (really moves there: exposed, his rounds clear the
   * corner) and may fire once mostly out; away from an edge he cannot (a hint, `manual` fire only). Not in high cover:
   * the trigger as is. Called every step after the move. → may he fire now.
   */
  peekGate(p, wantFire, manual, dt, time) {
    const C = COVER;
    if (!p.cover || p.cover.kind !== 'high' || p.dodging || !p.alive) { p.peek = null; return wantFire; }
    // D99 (user): aimed away from the wall (in front of him) he simply fires from where he stands — leaning out of the
    // corner is only for an aim behind the wall; aimed into the wall away from a corner the trigger does nothing (no hint)
    // D100 (user: by a corner he fired into the wall's end): only when the line to the aim is clear of the wall close by
    if (wantFire && !p.peek && p.hasAim) {
      const dx = p.aimX - p.x, dy = p.aimY - p.y, L = Math.hypot(dx, dy) || 1;
      if ((dx * p.cover.nx + dy * p.cover.ny) / L > C.frontDot && this._clearShot(p)) return true;
    }
    if (wantFire) {
      if (!p.peek) {
        const side = this.coverEdge(p);
        if (!side) return false;
        p.peek = { side, k: 0, baseX: p.x, baseY: p.y, until: 0 };
      }
      p.peek.until = time + C.peekHold;
    }
    const pk = p.peek;
    if (!pk) return false;
    const out = time < pk.until;
    pk.k = Math.min(1, Math.max(0, pk.k + (out ? 1 : -1) * (dt / C.peekIn)));
    const tx = -p.cover.ny, ty = p.cover.nx, off = pk.side * C.peekOut * pk.k;
    const ox = p.x, oy = p.y;
    p.x = pk.baseX + tx * off; p.y = pk.baseY + ty * off;
    if (this.world) this.world.pushOut(p);
    // D102 (user: he slid out of the corner standing still): his real speed of the step out / back — the renderer's
    // legs walk it (≈ 2 steps each way)
    p.vx = dt > 0 ? (p.x - ox) / dt : 0; p.vy = dt > 0 ? (p.y - oy) / dt : 0;
    if (!out && pk.k <= 0) { p.x = pk.baseX; p.y = pk.baseY; p.peek = null; return false; }
    // D97 (user: the first shot after leaning out made a sound and took a round but no bullet flew — half out, the
    // barrel was still behind the corner and the wall took the shot): it fires only once he is fully out
    // D100: fully out, and still no wall right in front of the barrel (the aim past the corner's own end) — else no
    // shot (no round wasted into the wall)
    return wantFire && pk.k >= 1 && this._clearShot(p);
  }

  /** D100: is the line from him to the aim free of walls / tall cover for the first COVER.clearShot units? */
  _clearShot(p) {
    if (!this.world || !p.hasAim) return true;
    const dx = p.aimX - p.x, dy = p.aimY - p.y, L = Math.hypot(dx, dy);
    if (L < 1) return false;
    const n = Math.min(L, COVER.clearShot), t = this.world.segmentHit(p.x, p.y, p.x + (dx / L) * n, p.y + (dy / L) * n, 0, null, BLOCK.BULLET);
    return t === Infinity;
  }

  /** In cover: steps up to the object first, then moves only along it (kneeling / sneaking sideways). */
  _coverMove(p, dt, time) {
    const c = p.cover, C = COVER;
    if (p.peek) { p.vx = 0; p.vy = 0; p.coverAwayFor = 0; return; } // D87: leaning out of the corner — no walking
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
    if (p.cover && !p.dodging && !p.peek) { // (D87: leaning out past the edge keeps the cover)
      const wasFace = Math.abs(p.cover.nx) >= 0.97 || Math.abs(p.cover.ny) >= 0.97;
      let c = this.world ? this.world.coverAt(p.x, p.y, reach, CONTACT) : null;
      // past the object's end (the nearest point is its corner): back to where he was — he stops at the edge
      if (!c || (wasFace && time >= p.coverSnapUntil && c.shape.box && !c.shape.group && Math.abs(c.nx) < 0.97 && Math.abs(c.ny) < 0.97)) {
        p.x = x0; p.y = y0; p.vx = 0; p.vy = 0;
        c = this.world ? this.world.coverAt(p.x, p.y, reach, CONTACT) : null;
      }
      if (c) { p.cover.kind = c.shape.cover; p.cover.nx = c.nx; p.cover.ny = c.ny; } else this._leaveCover(p);
      // D90 (user): the corner is his limit — his body's edge stops at the end of the face (any cover), never past it
      if (p.cover && wasFace && time >= p.coverSnapUntil) {
        const along = (p.x - x0) * -p.cover.ny + (p.y - y0) * p.cover.nx;
        if (Math.abs(along) > 1e-6 && this._endsAt(p, Math.sign(along), COVER.edgeStop)) { p.x = x0; p.y = y0; p.vx = 0; p.vy = 0; }
      }
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
const EDGE = { shape: null, nx: 0, ny: 0, gap: 0 }; // D87: the edge probes (CONTACT stays the hero's own contact)
const PROBE0 = { shape: null, nx: 0, ny: 0, gap: 0 }; // D90: his own contact for the probes

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
