// KILL LIST (D78): armed human enemies. Perception (throttled): a view cone + range + line of sight (walls, closed
// doors and tall furniture block it; glass and desks do not), a short "feel" radius at any angle, gunshots heard
// (half the distance through walls), and an enemy who spots the hero alerts the others near him.
// Modes: idle (post) / patrol → alert (go to the last known spot through the rooms) → combat (face, keep a distance,
// strafe, shoot bursts after a reaction time) → search (look around) → return (back to the post / patrol).
// D148 (Marseille): flee (an unarmed man alarmed runs for his way out — reached: 'escaped'), assault (an attacker
// heads for a spot through the rooms, shooting at the hero on the way, never stopping to fight), and the sniper (never
// moves; once woken his laser holds on the hero in sight for `aim` s, then the shot — lost sight, the aim falls back).
// Movement slides along walls and furniture; the room route comes from LevelWorld (rule 14: no A* / navmesh).
// Everything runs on the game clock; randomness comes from the run's seeded RNG.
import { AI_TUNING as T } from '../data/humans.js';
import { muzzleOf } from '../data/player.js';
import { BLOCK } from './Collision.js';

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const NEXT = { x: 0, y: 0 };
/** D117: a glass wall / door — seen through, stops rounds. */
const isGlass = (s) => (s.kind === 'wall' || s.kind === 'door') && !(s.blocks & BLOCK.SIGHT);

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
    /** D85 stealth: the STEALTH rules (null = the mission's perception), the light at a point, the global SEARCH */
    this.stealth = null;
    this.lightAt = null;
    this.searchUntil = -Infinity;
  }

  /** D85: the global SEARCH level is on (a body found, a loud shot heard) — the enemies see further, faster. */
  searching(time) { return time < this.searchUntil; }

  /** D82 (user request): an enemy opens fire only once he is on the screen. */
  _onScreen(e) { return !this.inView || this.inView(e.x, e.y); }

  _rand(a, b) { return a + (b - a) * this.rng.next(); }

  update(enemies, player, dt, time) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;
      const g = e.gun, ai = e.ai;
      if (ai.mode === 'grabbed' || e.dummy) { e.vx = 0; e.vy = 0; continue; } // D85: held in a takedown; D88: a dummy
      if (g.reloading && time >= g.reloadEndsAt) { g.reloading = false; g.ammo = g.stats.magazineSize; g.burstLeft = g.stats.burst || 1; }
      if (e.type.sniper) { this._sniper(e, player, dt, time); continue; } // D148
      if (time >= ai.thinkAt) {
        ai.thinkAt = time + T.thinkInterval * (0.85 + 0.3 * this.rng.next());
        if (this.stealth && ai.mode !== 'combat') this._perceiveStealth(e, player, time);
        else this._perceive(e, player, enemies, time);
        if (this.stealth && !this.noBodies && ai.mode !== 'combat') this._lookForBodies(e, enemies, time); // D95: not in the lessons
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
    // D118: a guard busy at the files (his back to the room) does not feel the hero close behind him — he can be crept
    // up on and taken down (the mission's takedown); only what is in front of him is seen
    const near = e.busy && e.ai.mode === 'idle' ? 0 : V.near;
    if (!tracking && d > near && Math.abs(angDiff(Math.atan2(dy, dx), e.faceAngle)) > (V.fov * Math.PI) / 360) return false;
    // D82: a hero crouched behind low cover is hidden by the low objects too (D85: or crouching)
    return this.world.clear(e.x, e.y, p.x, p.y, null, p.lowProfile ? BLOCK.SIGHT | BLOCK.LOW : BLOCK.SIGHT);
  }

  // ---------------- D85 stealth perception (MODES_DESIGN_D85.md §3.4) ----------------
  /**
   * The suspicion meter: fills while the hero is in the view cone and line of sight — faster close, in the light,
   * upright, moving, in the middle of the cone; falls after a grace when he is out of sight. Stages: notice (stop and
   * look) → investigate (walk to the spot) → full: spotted (combat).
   */
  _perceiveStealth(e, p, time) {
    const S = this.stealth, ai = e.ai, V = e.type.view;
    const dt = Number.isFinite(ai.thoughtAt) ? Math.min(0.5, time - ai.thoughtAt) : 0;
    ai.thoughtAt = time;
    let seen = false, rate = 0;
    if (p.alive) {
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      const busy = e.busy && ai.mode === 'idle';
      const search = this.searching(time);
      const lum = this.lightAt ? this.lightAt(p.x, p.y) : 1;
      const lightK = clamp01((lum - S.light.dark) / (S.light.lit - S.light.dark));
      const reach = V.range * (0.5 + 0.5 * lightK) * (busy ? S.busy.range : 1) * (search ? S.search.rangeMult : 1);
      const half = ((V.fov * Math.PI) / 360) * (busy ? S.busy.fov : 1);
      const a = Math.abs(angDiff(Math.atan2(dy, dx), e.faceAngle));
      const sp = Math.hypot(p.vx, p.vy);
      const mask = p.lowProfile ? BLOCK.SIGHT | BLOCK.LOW : BLOCK.SIGHT;
      if (d <= reach && a <= half && this.world.clear(e.x, e.y, p.x, p.y, null, mask)) {
        seen = true;
        const distK = 1 - 0.75 * clamp01((d - V.near) / Math.max(1, reach - V.near));
        const periph = a > S.peripheral.from * half ? S.peripheral.mult : 1;
        const stanceK = p.lowProfile ? S.stance.crouch : S.stance.stand;
        const motionK = sp < S.motion.stillBelow ? S.motion.still : sp > S.motion.runAbove ? S.motion.run : S.motion.walk;
        const part = p.cover ? this.bodySeen(e, p, mask) : 1; // D126: in cover — by the part of him seen
        rate = S.rate * distK * (0.3 + 0.7 * lightK) * stanceK * motionK * periph * part * (0.6 / e.type.reaction)
          * (ai.investigate ? S.investigate.fillMult : 1) * (search ? S.search.fillMult : 1);
      }
      // felt at any angle: an upright, moving hero very close
      if (!p.lowProfile && sp > S.motion.stillBelow && d <= S.feel.dist && this.world.clear(e.x, e.y, p.x, p.y)) { seen = true; rate += S.feel.rate; }
    }
    if (seen) {
      ai.suspicion = Math.min(1, ai.suspicion + rate * dt);
      ai.seenAt = time;
      ai.lastSeenX = p.x; ai.lastSeenY = p.y; ai.lastSeenAt = time;
    } else if (time - ai.seenAt > S.decayAfter) ai.suspicion = Math.max(0, ai.suspicion - S.decay * dt);
    if (ai.suspicion >= 1) {
      ai.investigate = false;
      ai.mode = 'combat';
      ai.aware = true;
      ai.strafeUntil = 0;
      ai.reactAt = time + e.type.reaction * 0.6;
      ai.sees = seen;
      this.events.emit('spotted', e);
      return;
    }
    if (seen && ai.suspicion >= S.investigateAt && ai.mode !== 'alert') this.investigate(e, p.x, p.y, time, ai.suspicion);
    ai.sees = false; // nobody shoots before the meter is full
  }

  /**
   * D87 stealth: does this guard see the point (x, y) now — in his cone, within his range at the light there (× mult),
   * in line of sight? (A witness of a takedown / a kill.)
   */
  seesPoint(e, x, y, time, mult = 1) {
    if (!e.alive || e.ai.mode === 'grabbed') return false;
    const S = this.stealth, V = e.type.view, ai = e.ai;
    const busy = e.busy && ai.mode === 'idle';
    const lum = this.lightAt ? this.lightAt(x, y) : 1;
    const lightK = S ? clamp01((lum - S.light.dark) / (S.light.lit - S.light.dark)) : 1;
    const reach = V.range * (0.5 + 0.5 * lightK) * mult * (busy && S ? S.busy.range : 1) * (S && this.searching(time) ? S.search.rangeMult : 1);
    const dx = x - e.x, dy = y - e.y;
    if (dx * dx + dy * dy > reach * reach) return false;
    const half = ((V.fov * Math.PI) / 360) * (busy && S ? S.busy.fov : 1);
    if (ai.mode !== 'combat' && Math.abs(angDiff(Math.atan2(dy, dx), e.faceAngle)) > half) return false;
    return this.world.clear(e.x, e.y, x, y, null, BLOCK.SIGHT);
  }

  /** D85: walk to a suspicious spot (a glimpse, a noise, a body) and search there; never interrupts a fight. */
  investigate(e, x, y, time, s = 0) {
    const ai = e.ai;
    if (!e.alive || ai.mode === 'combat' || ai.mode === 'grabbed') return;
    ai.suspicion = Math.max(ai.suspicion, s);
    ai.seenAt = Math.max(ai.seenAt, time);
    if (ai.mode !== 'alert') this.events.emit('suspicion', e, 'investigate');
    ai.mode = 'alert';
    ai.investigate = true;
    ai.lastSeenX = x; ai.lastSeenY = y;
    ai.routeGoalX = NaN;
  }

  /** D85: a noise in stealth (running steps, a silenced / loud shot, a takedown) — heard within r, half through walls. */
  hearStealth(enemies, x, y, r, kind, time) {
    const S = this.stealth;
    for (const e of enemies) {
      if (!e.alive || e.ai.mode === 'combat' || e.ai.mode === 'grabbed') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > r || (d > r * 0.5 && !this.world.clear(e.x, e.y, x, y))) continue;
      this.investigate(e, x, y, time, kind === 'loud' ? S.hearing.loud : S.hearing.quiet);
    }
    if (kind === 'loud') this.searchUntil = Math.max(this.searchUntil, time + S.search.duration);
  }

  /** D85: a dead body in sight raises the search (each body is found once). */
  _lookForBodies(e, enemies, time) {
    const S = this.stealth, ai = e.ai, V = e.type.view;
    if (time < (ai.bodyCheckAt || 0)) return;
    ai.bodyCheckAt = time + S.bodies.every;
    const half = (V.fov * Math.PI) / 360;
    for (const b of enemies) {
      if (b === e || b.alive || b.found) continue;
      const dark = this.lightAt && this.lightAt(b.x, b.y) < S.light.dark;
      const reach = V.range * S.bodies.rangeMult * (dark ? S.bodies.darkMult : 1);
      const dx = b.x - e.x, dy = b.y - e.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (Math.abs(angDiff(Math.atan2(dy, dx), e.faceAngle)) > half || !this.world.clear(e.x, e.y, b.x, b.y)) continue;
      b.found = true;
      const second = this.searching(time); // D87: found while the search is on — the director raises the alarm
      this.searchUntil = Math.max(this.searchUntil, time + S.search.duration);
      this.investigate(e, b.x, b.y, time, 0.6);
      this.events.emit('bodyFound', e, b, second);
      return;
    }
  }

  /**
   * D126: how much of a hero in cover this enemy sees (0…1): his middle and four points round him (his shoulders as
   * seen from the enemy, the side towards / away from the cover) — each a line of sight. Out of cover: 1.
   */
  bodySeen(e, p, mask = BLOCK.SIGHT) {
    if (!p.cover) return 1;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, r = (p.radius || 15) * 0.9;
    const sx = (-dy / d) * r, sy = (dx / d) * r, nx = (p.cover.nx || 0) * r, ny = (p.cover.ny || 0) * r;
    let n = 0;
    for (const [ox, oy] of [[0, 0], [sx, sy], [-sx, -sy], [nx, ny], [-nx, -ny]]) if (this.world.clear(e.x, e.y, p.x + ox, p.y + oy, null, mask)) n += 1;
    return n / 5;
  }

  _perceive(e, p, enemies, time) {
    const ai = e.ai;
    if (ai.mode === 'flee') { ai.sees = false; return; } // D148: running, he looks only where he runs
    let sees = this._sees(e, p);
    // D148: an attacker keeps heading for his spot — he only notes the hero to shoot at him on the way
    if (ai.mode === 'assault') {
      if (sees && !ai.sees) ai.reactAt = Math.max(ai.reactAt, time + e.type.reaction);
      if (sees) { ai.lastSeenX = p.x; ai.lastSeenY = p.y; ai.lastSeenAt = time; ai.aware = true; }
      ai.sees = sees;
      return;
    }
    if (sees && e.type.unarmed) { this.flee(e, time); ai.sees = false; return; } // D148: the dispatcher runs
    // D126: a hero in cover, only partly showing, is not spotted at once — the glimpse builds by the part seen
    const C = T.coverSpot, gdt = Number.isFinite(ai.glimpseAt) ? Math.min(0.5, time - ai.glimpseAt) : 0;
    ai.glimpseAt = time;
    if (sees && ai.mode !== 'combat' && p.cover) {
      const part = this.bodySeen(e, p, p.lowProfile ? BLOCK.SIGHT | BLOCK.LOW : BLOCK.SIGHT);
      if (part < C.full) {
        ai.glimpse = Math.min(1, (ai.glimpse || 0) + gdt * C.rate * part);
        if (ai.glimpse < 1) sees = false;
      }
    } else if (!sees) ai.glimpse = Math.max(0, (ai.glimpse || 0) - gdt * C.fade);
    if (sees) {
      ai.glimpse = 0;
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
    if (!e.alive || ai.mode === 'combat' || ai.mode === 'flee' || ai.mode === 'assault' || ai.mode === 'grabbed') return;
    if (e.type.unarmed && e.fleeTo) { this.flee(e, time); return; } // D148
    ai.mode = 'alert';
    ai.aware = true;
    ai.lastSeenX = x; ai.lastSeenY = y;
    ai.reactAt = time + e.type.reaction * 0.6;
    ai.routeGoalX = NaN; // new route
  }

  /** D148: an unarmed man alarmed runs for his way out (`fleeTo`); with none he stays put. */
  flee(e, time) {
    const ai = e.ai;
    if (!e.alive || !e.fleeTo || e.captured || ai.mode === 'flee' || ai.mode === 'grabbed') return;
    ai.mode = 'flee'; ai.aware = true; ai.goalX = e.fleeTo[0]; ai.goalY = e.fleeTo[1]; ai.routeGoalX = NaN;
    ai.progressAt = time; ai.progressX = e.x; ai.progressY = e.y;
    this.events.emit('flees', e);
  }

  /** D148: an attacker heads for (gx, gy) — shooting at the hero on the way, never turning to hunt him. */
  assault(e, gx, gy, time) {
    const ai = e.ai;
    if (!e.alive) return;
    ai.mode = 'assault'; ai.aware = true; ai.goalX = gx; ai.goalY = gy; ai.routeGoalX = NaN;
    ai.reactAt = time + e.type.reaction;
    ai.progressAt = time; ai.progressX = e.x; ai.progressY = e.y;
  }

  /**
   * D148: the sniper — he stands; woken (`active`), the hero in sight within his range: his laser holds on him and
   * `ai.aim` fills over `aim` s (lost sight: it falls back); full — the shot (not bound to the screen: the laser is the
   * warning), then a pause of `after` s.
   */
  _sniper(e, p, dt, time) {
    const S = e.type.sniper, ai = e.ai, g = e.gun;
    e.vx = 0; e.vy = 0;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    const sees = e.active && p.alive && d <= e.type.view.range
      && this.world.clear(e.x, e.y, p.x, p.y, null, p.lowProfile ? BLOCK.SIGHT | BLOCK.LOW : BLOCK.SIGHT);
    ai.sees = sees;
    if (sees) {
      if (!ai.aware) this.events.emit('spotted', e);
      ai.mode = 'combat'; ai.aware = true; ai.lastSeenX = p.x; ai.lastSeenY = p.y; ai.lastSeenAt = time;
      const da = angDiff(Math.atan2(dy, dx), e.faceAngle), mt = 3 * dt;
      e.faceAngle += Math.abs(da) <= mt ? da : Math.sign(da) * mt;
    }
    if (time < g.nextShotAt || g.reloading) { ai.aim = 0; return; }
    ai.aim = sees ? Math.min(1, ai.aim + dt / S.aim) : Math.max(0, ai.aim - dt * S.lose);
    if (ai.aim < 1) return;
    ai.aim = 0;
    g.nextShotAt = time + S.after;
    const s = g.stats, a = Math.atan2(dy, dx) + (this.rng.next() - 0.5) * (s.spreadAngle * Math.PI) / 180 * (p.dodging ? 6 : 1);
    const b = this.pool.spawn();
    if (!b) return;
    b.x = b.prevX = e.x + Math.cos(a) * 20; b.y = b.prevY = e.y + Math.sin(a) * 20;
    b.vx = Math.cos(a) * s.projectileSpeed; b.vy = Math.sin(a) * s.projectileSpeed;
    b.angle = a; b.maxDistance = s.range * 1.1; b.hitsLeft = 1; b.weaponId = s.id; b.stats = s; b.hostile = true; b.spawnedAt = time;
    g.ammo -= 1; g.lastShotAt = time;
    if (g.ammo <= 0) this._reload(e, time);
    this.events.emit('enemyShot', b.x, b.y, a, s.id, e);
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
    if (this.stealth && e.ai.mode !== 'combat') {
      // D87: wounded and alive — he knows he is under attack: straight to combat (the director raises the alarm)
      const ai = e.ai;
      ai.mode = 'combat'; ai.aware = true; ai.suspicion = 1; ai.investigate = false; ai.strafeUntil = 0;
      ai.lastSeenX = p.x; ai.lastSeenY = p.y; ai.lastSeenAt = time;
      ai.reactAt = time + 0.35;
      this.searchUntil = Math.max(this.searchUntil, time + this.stealth.search.duration);
      this.events.emit('spotted', e);
      return;
    }
    if (e.ai.mode !== 'combat') {
      this.alert(e, p.x, p.y, time);
      e.ai.reactAt = time + 0.35;
    }
  }

  // ---------------- behaviour ----------------
  _behave(e, p, dt, time) {
    const ai = e.ai, S = e.type.speed;
    let mx = 0, my = 0, speed = 0, face = e.faceAngle, turn = 4;
    // D85 stealth: noticing something (the meter rising) — he stops and turns towards it
    const noticing = this.stealth && (ai.mode === 'idle' || ai.mode === 'patrol' || ai.mode === 'return')
      && ai.suspicion >= this.stealth.noticeAt && time - ai.seenAt < 1;
    if (noticing) {
      face = Math.atan2(ai.lastSeenY - e.y, ai.lastSeenX - e.x);
      turn = 2;
      ai.progressAt = time; ai.progressX = e.x; ai.progressY = e.y;
    } else switch (ai.mode) {
      case 'idle': {
        face = ai.post.angle;
        if (Math.hypot(e.x - ai.post.x, e.y - ai.post.y) > 24) ai.mode = 'return';
        break;
      }
      case 'patrol': {
        const pt = ai.patrol[ai.patrolIdx];
        if (time < ai.waitUntil) {
          // D85: waiting at the point just reached — looking where the data says (or on to the next point)
          face = Number.isFinite(ai.lookAt) ? ai.lookAt : Math.atan2(pt.y - e.y, pt.x - e.x);
          turn = 2;
          break;
        }
        const dx = pt.x - e.x, dy = pt.y - e.y, d = Math.hypot(dx, dy);
        if (d < T.arriveDist) {
          ai.lookAt = Number.isFinite(pt.look) ? pt.look : NaN;
          ai.patrolIdx = (ai.patrolIdx + 1) % ai.patrol.length;
          ai.waitUntil = time + (Number.isFinite(pt.wait) ? pt.wait : this._rand(1.0, 2.2));
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
        // D85: investigating (stealth) is a brisk walk, not a charge
        mx = dx / d; my = dy / d; speed = ai.investigate ? S.patrol * this.stealth.investigate.speedMult : S.combat; face = Math.atan2(dy, dx); turn = 7;
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
      case 'flee': { // D148: for his way out at a run; reached — gone
        if (!this._next(e, ai.goalX, ai.goalY, NEXT)) {
          if (Math.hypot(e.x - ai.goalX, e.y - ai.goalY) < 60) { if (!e.escaped) { e.escaped = true; this.events.emit('escaped', e); } }
          else ai.routeGoalX = NaN; // (knocked off his way — a new one next step)
          break;
        }
        const dx = NEXT.x - e.x, dy = NEXT.y - e.y, d = Math.hypot(dx, dy) || 1;
        mx = dx / d; my = dy / d; speed = S.combat; face = Math.atan2(dy, dx); turn = 8;
        break;
      }
      case 'assault': { // D148: to his spot, the gun on the hero while he sees him
        turn = 7;
        const there = !this._next(e, ai.goalX, ai.goalY, NEXT);
        if (there && Math.hypot(e.x - ai.goalX, e.y - ai.goalY) > 60) ai.routeGoalX = NaN; // (off his way: a new one)
        if (!there) {
          const dx = NEXT.x - e.x, dy = NEXT.y - e.y, d = Math.hypot(dx, dy) || 1;
          mx = dx / d; my = dy / d; speed = S.combat * (ai.sees ? 0.8 : 1); face = Math.atan2(dy, dx);
        }
        if (ai.sees) face = Math.atan2(p.y - e.y, p.x - e.x);
        break;
      }
      case 'search': {
        const k = time - (ai.searchStart || time);
        face = (ai.lookBase || 0) + Math.sin(k * 1.4) * 1.3;
        turn = 3;
        if (time >= ai.searchUntil) { ai.mode = 'return'; ai.routeGoalX = NaN; ai.investigate = false; }
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
          if (ai.mode === 'alert' || ai.mode === 'return' || ai.mode === 'flee' || ai.mode === 'assault') ai.routeIdx = Math.min(ai.routeIdx + 1, ai.route.length); // skip a waypoint it cannot reach
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
    if (e.harmless || (ai.mode !== 'combat' && ai.mode !== 'assault') || !ai.sees || !p.alive || time < ai.reactAt || g.reloading) return; // D88 (D148: an attacker on his way too)
    if (!this._onScreen(e)) return; // D82: never from off the screen
    const to = Math.atan2(p.y - e.y, p.x - e.x);
    if (Math.abs(angDiff(to, e.faceAngle)) > 0.3 || time < g.nextShotAt) return;
    if (g.ammo <= 0) { this._reload(e, time); return; }
    const mz = muzzleOf(s.gun);
    const c = Math.cos(e.faceAngle), sn = Math.sin(e.faceAngle);
    const mx = e.x + c * mz.f - sn * mz.s, my = e.y + sn * mz.f + c * mz.s;
    if (this.world.segmentHit(e.x, e.y, mx, my, 0) !== Infinity) { g.nextShotAt = time + 0.3; return; } // D82: barrel past a wall: no shot
    // D117: glass (seen through, stops rounds) between him and the hero — he does not empty his gun into it
    if (this.world.segmentHit(mx, my, p.x, p.y, 0, isGlass) !== Infinity) { g.nextShotAt = time + 0.3; return; }
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
    // D88: a victim held in a takedown is never pushed (the hero stands closer than the bodies' radii — the push made
    // both slide away across the map)
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (!a.alive || a.ai.mode === 'grabbed') continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (!b.alive || b.ai.mode === 'grabbed') continue;
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
