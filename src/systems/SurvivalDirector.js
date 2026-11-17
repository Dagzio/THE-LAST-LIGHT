// D85 SURVIVAL director (MODES_DESIGN_D85.md §4): enemies come in a couple at a time from entry points the hero
// cannot see (never on the screen, never close, never in his line of sight nearby), with a very smooth ramp of the
// interval, the group size, the number alive, the mix of types and their strength; supplies (crates with the SMG /
// grenades, medkits) appear at random spots and are refreshed over time. Its own seeded RNG stream; game clock only.
import { SURVIVAL as S } from '../data/survival.js';
import { HUMAN_TYPES } from '../data/humans.js';
import { WEAPONS } from '../data/weapons.js';
import { SeededRandom } from '../core/SeededRandom.js';

/** The ramp at t seconds survived (pure, for tests and the HUD). */
export function survivalCurves(t) {
  const m = t / 60;
  return {
    interval: S.interval.base + S.interval.extra * Math.exp(-t / S.interval.tau),
    group: Math.min(S.group.max, S.group.start + t / S.group.per),
    cap: Math.min(S.alive.max, S.alive.start + Math.floor(t / S.alive.per)),
    weights: S.weights(m),
    mult: S.mult(m),
    threat: Math.min(10, 1 + Math.floor(t / S.threatEvery)),
  };
}

export class SurvivalDirector {
  /** @param {import('../core/MissionRun.js').MissionRun} run */
  constructor(run) {
    this.run = run;
    this.rng = new SeededRandom((run.runSeed ^ 0x9e3779b9) >>> 0);
    this.points = run.level.spawnPoints || [];
    this.nextSpawnAt = S.firstSpawnAt;
    this.retargetAt = S.retarget;
    this.lastPoint = null;
    this.crateAt = S.crate.first;
    this.medkitAt = S.medkit.first;
    this.firstCrate = true;
    this.lastSpot = null;
    this.threat = 1;
    this.spawnLog = [];             // [t, point id, n] (tests, the HUD's spawn hint)
    this.hint = null;               // { x, y, until } the last group's entry point
    this.typeCache = new Map();
    run.stats.threat = 1;
    /** (x, y) → true when on the screen (set by Game; null in tests) */
    this.inView = null;
  }

  get autoFireAllowed() { return true; }

  update(dt, time) {
    const run = this.run, t = run.stats.time, C = survivalCurves(t);
    if (C.threat !== this.threat) { this.threat = C.threat; run.stats.threat = Math.max(run.stats.threat, C.threat); run.events.emit('threatLevel', C.threat); }
    // spawns
    if (t >= this.nextSpawnAt) {
      const alive = run.enemiesLeft;
      if (alive >= C.cap) this.nextSpawnAt = t + 2; // full: try again when a slot frees
      else {
        const pt = this._pickSpawnPoint();
        if (!pt) this.nextSpawnAt = t + S.spawn.retry;
        else {
          const g = C.group, n = Math.min(C.cap - alive, Math.floor(g) + (this.rng.next() < g - Math.floor(g) ? 1 : 0));
          this._spawnGroup(pt, Math.max(1, n), t, C, time);
          this.nextSpawnAt = t + C.interval;
        }
      }
    }
    // everyone not fighting keeps coming at the hero
    if (t >= this.retargetAt) {
      this.retargetAt = t + S.retarget;
      const p = run.player;
      for (const e of run.enemies) {
        if (!e.alive || e.ai.mode === 'combat') continue;
        const j = S.retargetJitter;
        run.ai.alert(e, p.x + (this.rng.next() - 0.5) * 2 * j, p.y + (this.rng.next() - 0.5) * 2 * j, time);
      }
    }
    this._supplies(t, time);
  }

  // ---------------- spawning ----------------
  _validPoint(pt) {
    const run = this.run, p = run.player, d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d < S.spawn.minDist) return false;
    if (this.inView && this.inView(pt.x, pt.y)) return false;
    if (d < S.spawn.losDist && run.world.clear(pt.x, pt.y, p.x, p.y)) return false;
    return true;
  }

  _pickSpawnPoint() {
    const ok = this.points.filter((pt) => this._validPoint(pt));
    if (!ok.length) return null;
    const pool = ok.length > 1 ? ok.filter((pt) => pt !== this.lastPoint) : ok;
    const pt = pool[Math.floor(this.rng.next() * pool.length) % pool.length];
    this.lastPoint = pt;
    return pt;
  }

  /** A type of the current mix, its stats scaled to the minute (cached per 30 s tier). */
  _scaled(C, t) {
    const w = C.weights, sum = w.thug + w.gunman + w.heavy;
    let r = this.rng.next() * sum;
    const id = (r -= w.thug) < 0 ? 'thug' : (r -= w.gunman) < 0 ? 'gunman' : 'heavy';
    const tier = Math.floor(t / 30), key = `${id}:${tier}`;
    let c = this.typeCache.get(key);
    if (!c) {
      const base = HUMAN_TYPES[id], m = C.mult, wpn = WEAPONS[base.weapon];
      c = {
        type: { ...base, hp: Math.round(base.hp * m.hp), reaction: base.reaction * m.reaction },
        weapon: { ...wpn, damage: wpn.damage * m.damage, spreadAngle: wpn.spreadAngle * m.spread },
      };
      this.typeCache.set(key, c);
    }
    return c;
  }

  _spawnGroup(pt, n, t, C, time) {
    const run = this.run, p = run.player, off = S.spawn.offsets;
    for (let i = 0; i < n; i++) {
      const c = this._scaled(C, t);
      const [ox, oy] = off[i % off.length];
      const e = run._spawnEnemy({ type: c.type.id, x: pt.x + ox, y: pt.y + oy, angle: Math.atan2(p.y - pt.y, p.x - pt.x) }, false, c.type, c.weapon);
      if (e) run.ai.alert(e, p.x, p.y, time);
    }
    this.spawnLog.push([Math.round(t * 10) / 10, pt.id, n]);
    this.hint = { x: pt.x, y: pt.y, until: time + 2.5 };
    run.events.emit('survivalSpawn', pt.id, n);
  }

  // ---------------- supplies ----------------
  _supplies(t, time) {
    const run = this.run;
    // opened crates go away after a moment; medkits nobody took expire (only while off the screen)
    for (const pk of run.pickups) {
      if (pk.taken) continue;
      if (pk.def.kind === 'crate' && pk.openedAt >= 0 && time - pk.openedAt > S.crate.openedFor) pk.taken = true;
      else if (pk.def.kind === 'medkit' && time > pk.until && !(this.inView && this.inView(pk.def.x, pk.def.y))) pk.taken = true;
    }
    const active = (kind) => run.pickups.filter((pk) => !pk.taken && pk.def.kind === kind && !(kind === 'crate' && pk.openedAt >= 0)).length;
    if (t >= this.crateAt) {
      this.crateAt = t + S.crate.every;
      const max = t >= S.crate.lateAt ? S.crate.maxLate : S.crate.max;
      const item = !run.inventory.includes('smg') ? 'smg' : (run.grenades.stock.frag | 0) < 3 ? 'grenades' : null;
      if (item && active('crate') < max) {
        const pk = this._spot('crate', this.firstCrate ? S.crate.firstNear : Infinity);
        if (pk) {
          this.firstCrate = false;
          pk.taken = false; pk.openedAt = -1; pk.item = item; pk.count = item === 'grenades' ? S.crate.grenades : 1;
          run.events.emit('pickupSpawned', pk);
        }
      }
    }
    if (t >= this.medkitAt) {
      this.medkitAt = t + S.medkit.every;
      if (active('medkit') < S.medkit.max) {
        const pk = this._spot('medkit', Infinity);
        if (pk) { pk.taken = false; pk.until = time + S.medkit.expire; run.events.emit('pickupSpawned', pk); }
      }
    }
  }

  /** A free spot of a kind: not too close, preferably off the screen, not the one freed last. */
  _spot(kind, maxDist) {
    const run = this.run, p = run.player;
    const free = run.pickups.filter((pk) => pk.taken && pk.def.kind === kind && pk !== this.lastSpot)
      .filter((pk) => { const d = Math.hypot(pk.def.x - p.x, pk.def.y - p.y); return d >= S.pickupMinDist && d <= maxDist; });
    if (!free.length) return null;
    const off = free.filter((pk) => !(this.inView && this.inView(pk.def.x, pk.def.y)));
    const pool = off.length ? off : free;
    const pk = pool[Math.floor(this.rng.next() * pool.length) % pool.length];
    this.lastSpot = pk;
    return pk;
  }

  /** The HUD arrow: a medkit when hurt, else the nearest unopened crate. */
  objectiveTarget(out = {}) {
    const run = this.run, p = run.player;
    const want = p.hp < p.maxHp * 0.5 ? 'medkit' : 'crate';
    let best = null, bd = Infinity;
    for (const pk of run.pickups) {
      if (pk.taken || pk.def.kind !== want || pk.openedAt >= 0) continue;
      const d = Math.hypot(pk.def.x - p.x, pk.def.y - p.y);
      if (d < bd) { bd = d; best = pk; }
    }
    if (!best) return null;
    out.x = best.def.x; out.y = best.def.y;
    return out;
  }
}
