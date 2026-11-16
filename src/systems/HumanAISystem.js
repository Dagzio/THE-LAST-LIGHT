// KILL LIST (D78): armed human enemies. Perception (throttled): a view cone + range + line of sight (walls, closed
// doors and tall furniture block it; glass and desks do not), a short "feel" radius at any angle, gunshots heard
// (half the distance through walls), and an enemy who spots the hero alerts the others near him.
// Modes: idle (post) / patrol → alert (go to the last known spot through the rooms) → combat (face, keep a distance,
// strafe, shoot bursts after a reaction time) → search (look around) → return (back to the post / patrol).
// Movement slides along walls and furniture; the room route comes from LevelWorld (rule 14: no A* / navmesh).
// Everything runs on the game clock; randomness comes from the run's seeded RNG.
import { AI_TUNING as T } from '../data/humans.js';
import { muzzleOf } from '../data/player.js';
import { BLOCK } from './Collision.js';

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const NEXT = { x: 0, y: 0 };

export class HumanAISystem {
  /**
   * @param {import('../core/GameEvents.js').GameEvents} events
   * @param {{next:()=>number}} rng
   * @param {import('../entities/ProjectilePool.js').ProjectilePool} pool
   * @param {import('../core/LevelWorld.js').LevelWorld} level
   */
  constructor(events, rng, pool, level) {
    this.events = events;
    this.rng = rng;
    this.pool = pool;
    this.level = level;
    this.world = level.world;
    /** D82: (x, y) → true when that ground point is on the screen (set by Game; null in tests = everywhere) */
    this.inView = null;
  }

  /** D82 (user request): an enemy opens fire only once he is on the screen. */
  _onScreen(e) { return !this.inView || this.inView(e.x, e.y); }

  _rand(a, b) { return a + (b - a) * this.rng.next(); }

  update(enemies, player, dt, time) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const g = e.gun, ai = e.ai;
      if (g.reloading && time >= g.reloadEndsAt) { g.reloading = false; g.ammo = g.stats.magazineSize; g.burstLeft = g.stats.burst || 1; }
      if (time >= ai.thinkAt) {
        ai.thinkAt = time + T.thinkInterval * (0.85 + 0.3 * this.rng.next());
        this._perceive(e, player, enemies, time);
      }
      this._behave(e, player, dt, time);
      this._shoot(e, player, time);
    }
    this._separate(enemies, player);
  }

  // ---------------- perception ----------------
  _sees(e, p) {
    if (!p.alive) return false;
    const V = e.type.view, dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > V.range * V.range) return false;
    const d = Math.sqrt(d2);
    const tracking = e.ai.mode === 'combat';
    if (!tracking && d > V.near && Math.abs(angDiff(Math.atan2(dy, dx), e.faceAngle)) > (V.fov * Math.PI) / 360) return false;
    // D82: a hero crouched behind low cover is hidden by the low objects too
    return this.world.clear(e.x, e.y, p.x, p.y, null, p.crouched ? BLOCK.SIGHT | BLOCK.LOW : BLOCK.SIGHT);
  }

  _perceive(e, p, enemies, time) {
    const ai = e.ai;
    const sees = this._sees(e, p);
    if (sees) {
      if (ai.mode !== 'combat') {
        ai.reactAt = Math.max(ai.reactAt > time ? ai.reactAt : 0, time + e.type.reaction * (ai.aware ? 0.6 : 1));
        if (!ai.aware) this.events.emit('spotted', e);
        ai.mode = 'combat';
        ai.aware = true;
        ai.strafeUntil = 0;
        this._share(e, enemies, time, p.x, p.y);
      }
      ai.lastSeenX = p.x; ai.lastSeenY = p.y; ai.lastSeenAt = time;
    }
    ai.sees = sees;
  }

  /** An enemy who spotted the hero alerts the others near him (in sight of him or in the same room). */
  _share(src, enemies, time, x, y) {
    const zone = this.level.zoneAt(src.x, src.y);
    for (const o of enemies) {
      if (o === src || !o.alive || o.ai.mode === 'combat') continue;
      const d = Math.hypot(o.x - src.x, o.y - src.y);
      if (d > T.alertShare) continue;
      if (this.level.zoneAt(o.x, o.y) !== zone && !this.world.clear(src.x, src.y, o.x, o.y)) continue;
      this.alert(o, x, y, time);
    }
  }

  /** Something suspicious at (x, y): go and look (never interrupts a fight). */
  alert(e, x, y, time) {
    const ai = e.ai;
    if (!e.alive || ai.mode === 'combat') return;
    ai.mode = 'alert';
    ai.aware = true;
    ai.lastSeenX = x; ai.lastSeenY = y;
    ai.reactAt = time + e.type.reaction * 0.6;
    ai.routeGoalX = NaN; // new route
  }

  /** A shot / blast heard at (x, y) with this loudness (units). */
  hear(enemies, x, y, noise, time) {
    for (const e of enemies) {
      if (!e.alive || e.ai.mode === 'combat') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > noise) continue;
      if (d > noise * 0.5 && !this.world.clear(e.x, e.y, x, y)) continue; // half as far through walls
      this.alert(e, x, y, time);
    }
  }

  /** Shot by the hero: turn to him right away. */
  onHit(e, p, time) {
    if (!e.alive) return;
    if (e.ai.mode !== 'combat') {
      this.alert(e, p.x, p.y, time);
      e.ai.reactAt = time + 0.35;
    }
  }

  // ---------------- behaviour ----------------
  _behave(e, p, dt, time) {
    const ai = e.ai, S = e.type.speed;
    let mx = 0, my = 0, speed = 0, face = e.faceAngle, turn = 4;
    switch (ai.mode) {
      case 'idle': {
        face = ai.post.angle;
        if (Math.hypot(e.x - ai.post.x, e.y - ai.post.y) > 24) ai.mode = 'return';
        break;
      }
      case 'patrol': {
        const pt = ai.patrol[ai.patrolIdx];
        if (time < ai.waitUntil) { face = Math.atan2(pt.y - e.y, pt.x - e.x); turn = 2; break; }
        const dx = pt.x - e.x, dy = pt.y - e.y, d = Math.hypot(dx, dy);
        if (d < T.arriveDist) {
          ai.patrolIdx = (ai.patrolIdx + 1) % ai.patrol.length;
          ai.waitUntil = time + this._rand(1.0, 2.2);
          break;
        }
        mx = dx / d; my = dy / d; speed = S.patrol; face = Math.atan2(dy, dx);
        break;
      }
      case 'alert': {
        if (!this._next(e, ai.lastSeenX, ai.lastSeenY, NEXT)) {
          ai.mode = 'search'; ai.searchUntil = time + T.searchTime; ai.lookBase = e.faceAngle; ai.searchStart = time;
          break;
        }
        const dx = NEXT.x - e.x, dy = NEXT.y - e.y, d = Math.hypot(dx, dy) || 1;
        mx = dx / d; my = dy / d; speed = S.combat; face = Math.atan2(dy, dx); turn = 7;
        break;
      }
      case 'combat': {
        turn = 8;
        if (ai.sees) {
          const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
          face = Math.atan2(dy, dx);
          const k = e.type.keepRange;
          if (d > k + 90 || !this._onScreen(e)) { mx = dx / d; my = dy / d; speed = S.combat; } // D82: closes in until on the screen
          else if (d < k - 110) { mx = -dx / d; my = -dy / d; speed = S.combat * 0.75; }
          else {
            if (time >= ai.strafeUntil) {
              ai.strafeDir = this.rng.next() < 0.5 ? -1 : 1;
              ai.strafeUntil = time + this._rand(T.strafeEvery[0], T.strafeEvery[1]);
              ai.strafeStop = this.rng.next() < 0.35; // sometimes stands still and aims
            }
            if (!ai.strafeStop) { mx = (-dy / d) * ai.strafeDir; my = (dx / d) * ai.strafeDir; speed = S.combat * 0.55; }
          }
        } else if (time - ai.lastSeenAt < T.loseSightGrace) {
          face = Math.atan2(ai.lastSeenY - e.y, ai.lastSeenX - e.x);
        } else {
          ai.mode = 'alert';
          ai.routeGoalX = NaN;
        }
        break;
      }
      case 'search': {
        const k = time - (ai.searchStart || time);
        face = (ai.lookBase || 0) + Math.sin(k * 1.4) * 1.3;
        turn = 3;
        if (time >= ai.searchUntil) { ai.mode = 'return'; ai.routeGoalX = NaN; }
        break;
      }
      case 'return': {
        const home = ai.patrol ? ai.patrol[0] : ai.post;
        if (!this._next(e, home.x, home.y, NEXT)) {
          ai.mode = ai.patrol ? 'patrol' : 'idle';
          ai.patrolIdx = ai.patrol ? 1 % ai.patrol.length : 0;
          break;
        }
        const dx = NEXT.x - e.x, dy = NEXT.y - e.y, d = Math.hypot(dx, dy) || 1;
        mx = dx / d; my = dy / d; speed = S.patrol * 1.2; face = Math.atan2(dy, dx);
        break;
      }
      default: break;
    }
    // stuck: no progress for a while → a short side step (alternating sides)
    if (speed > 0) {
      if (time < ai.sideUntil) { mx = ai.sideX; my = ai.sideY; }
      else if (time - ai.progressAt > T.stuckTime) {
        const moved = Math.hypot(e.x - ai.progressX, e.y - ai.progressY);
        if (moved < 12) {
          const s = (e.id + Math.floor(time)) % 2 ? 1 : -1;
          ai.sideX = -my * s; ai.sideY = mx * s; ai.sideUntil = time + 0.5;
          mx = ai.sideX; my = ai.sideY;
          if (ai.mode === 'alert' || ai.mode === 'return') ai.routeIdx = Math.min(ai.routeIdx + 1, ai.route.length); // skip a waypoint it cannot reach
        }
        ai.progressAt = time; ai.progressX = e.x; ai.progressY = e.y;
      }
    } else { ai.progressAt = time; ai.progressX = e.x; ai.progressY = e.y; }

    const x0 = e.x, y0 = e.y;
    if (speed > 0) this.world.move(e, mx * speed * dt, my * speed * dt, (e.id & 1) ? 1 : -1, null, BLOCK.MOVE);
    e.vx = dt > 0 ? (e.x - x0) / dt : 0;
    e.vy = dt > 0 ? (e.y - y0) / dt : 0;
    const da = angDiff(face, e.faceAngle), maxTurn = turn * dt;
    e.faceAngle += Math.abs(da) <= maxTurn ? da : Math.sign(da) * maxTurn;
  }

  /** Next waypoint towards (gx, gy) through the rooms → NEXT; false when arrived (or there is no way). */
  _next(e, gx, gy, out) {
    const ai = e.ai;
    if (!(Math.hypot(gx - ai.routeGoalX, gy - ai.routeGoalY) < 40) || !ai.route.length) {
      ai.routeGoalX = gx; ai.routeGoalY = gy;
      ai.routeIdx = 0;
      if (!this.level.route(e.x, e.y, gx, gy, ai.route)) { ai.route.length = 0; return false; }
    }
    while (ai.routeIdx < ai.route.length) {
      const w = ai.route[ai.routeIdx];
      if (Math.hypot(w.x - e.x, w.y - e.y) > T.arriveDist + (ai.routeIdx === ai.route.length - 1 ? 6 : 0)) { out.x = w.x; out.y = w.y; return true; }
      ai.routeIdx++;
    }
    return false;
  }

  // ---------------- shooting ----------------
  _shoot(e, p, time) {
    const ai = e.ai, g = e.gun, s = g.stats;
    if (ai.mode !== 'combat' || !ai.sees || !p.alive || time < ai.reactAt || g.reloading) return;
    if (!this._onScreen(e)) return; // D82: never from off the screen
    const to = Math.atan2(p.y - e.y, p.x - e.x);
    if (Math.abs(angDiff(to, e.faceAngle)) > 0.3 || time < g.nextShotAt) return;
    if (g.ammo <= 0) { this._reload(e, time); return; }
    const mz = muzzleOf(s.gun);
    const c = Math.cos(e.faceAngle), sn = Math.sin(e.faceAngle);
    const mx = e.x + c * mz.f - sn * mz.s, my = e.y + sn * mz.f + c * mz.s;
    if (this.world.segmentHit(e.x, e.y, mx, my, 0) !== Infinity) { g.nextShotAt = time + 0.3; return; } // D82: barrel past a wall: no shot
    let spread = (s.spreadAngle * Math.PI) / 180;
    if (p.dodging) spread *= 2.5;
    else if (Math.hypot(p.vx, p.vy) > 20) spread *= T.movingTargetSpread;
    const base = Math.atan2(p.y - my, p.x - mx);
    const a = base + (this.rng.next() - 0.5) * spread;
    const b = this.pool.spawn();
    b.x = b.prevX = mx; b.y = b.prevY = my;
    b.vx = Math.cos(a) * s.projectileSpeed; b.vy = Math.sin(a) * s.projectileSpeed;
    b.angle = a;
    b.maxDistance = s.range * 1.1;
    b.hitsLeft = 1;
    b.weaponId = s.id;
    b.stats = s;
    b.hostile = true;
    b.spawnedAt = time;
    g.ammo -= 1;
    g.lastShotAt = time;
    g.burstLeft -= 1;
    if (g.burstLeft > 0) g.nextShotAt = time + s.fireInterval;
    else {
      g.burstLeft = s.burst || 1;
      g.nextShotAt = time + ((s.burst || 1) > 1 ? this._rand(T.burstPause[0], T.burstPause[1]) : s.fireInterval * this._rand(0.9, 1.5));
    }
    this.events.emit('enemyShot', mx, my, a, s.id, e);
    if (g.ammo <= 0) this._reload(e, time);
  }

  _reload(e, time) {
    const g = e.gun;
    if (g.reloading) return;
    g.reloading = true;
    g.reloadStartedAt = time;
    g.reloadEndsAt = time + g.stats.reloadDuration;
  }

  /** Bodies are solid: enemies push each other apart and step out of the hero (he is never moved by them). */
  _separate(enemies, p) {
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y, R = a.radius + b.radius, d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), k = (R - d) / d * 0.5;
        a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k;
      }
      if (p.alive) {
        const dx = a.x - p.x, dy = a.y - p.y, R = a.radius + p.radius, d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 1e-9) { const d = Math.sqrt(d2), k = (R - d) / d; a.x += dx * k; a.y += dy * k; }
      }
      this.world.pushOut(a);
    }
  }
}
