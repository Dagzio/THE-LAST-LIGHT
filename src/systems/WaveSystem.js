// Wave manager (02_SPEC §11): INTRO → wave 1 → INTERMISSION (20 s) → wave 2 … → COMPLETE after the final wave.
// A wave ends only when every spawn group has finished AND no enemy is alive. The clear is reported exactly once
// per wave; waves never skip or repeat. START NEXT WAVE works only in INTRO / INTERMISSION, so a double press
// cannot start two waves. Boss adds: groups with `bossHpBelow` start when the alive boss drops below that fraction
// and are skipped if the boss dies first. All timers are game-clock timestamps (pause / shop freeze them).
import { WAVE_TIMING } from '../data/waves.js';
import { getEnemyType } from '../data/enemies.js';

export const WAVE_PHASE = Object.freeze({
  INTRO: 'INTRO',
  ACTIVE: 'ACTIVE',
  INTERMISSION: 'INTERMISSION',
  COMPLETE: 'COMPLETE',
});

const SPAWN_JITTER = 24; // world units around the spawn point, so groups do not stack on one spot

export class WaveSystem {
  /**
   * @param {Array} waves wave configs of the map (data/waves.js)
   * @param {Record<string, Array<{x:number,y:number}>>} spawnPoints map spawn point groups
   * @param {{next:()=>number}} rng seeded run RNG
   * @param {import('../core/GameEvents.js').GameEvents} events
   * @param {(enemyId:string, x:number, y:number, time:number)=>object|null} spawn creates + registers an enemy
   */
  constructor(waves, spawnPoints, rng, events, spawn) {
    this.waves = waves;
    this.spawnPoints = spawnPoints;
    this.rng = rng;
    this.events = events;
    this.spawnFn = spawn;
    this.phase = WAVE_PHASE.INTRO;
    this.waveIndex = 0;          // current wave (ACTIVE) or the next one (INTRO / INTERMISSION)
    this.phaseEndsAt = 0;
    this.groups = [];
    this.cleared = [];           // per wave: reported once
    this.boss = null;            // the boss enemy of the current wave, once spawned
    this.waveStartedAt = 0;
  }

  get total() { return this.waves.length; }

  /** 1-based number of the current (ACTIVE) or upcoming wave. */
  get waveNumber() { return Math.min(this.total, this.waveIndex + 1); }

  get isFinalWave() { return this.waveIndex === this.total - 1; }

  start(time) {
    this.phase = WAVE_PHASE.INTRO;
    this.phaseEndsAt = time + WAVE_TIMING.intro;
  }

  /** Seconds left in INTRO / INTERMISSION (0 otherwise). */
  timeLeft(time) {
    if (this.phase !== WAVE_PHASE.INTRO && this.phase !== WAVE_PHASE.INTERMISSION) return 0;
    return Math.max(0, this.phaseEndsAt - time);
  }

  /** START NEXT WAVE / skip the intro. Ignored in any other phase (double-press safe). */
  startNextWave(time) {
    if (this.phase !== WAVE_PHASE.INTERMISSION && this.phase !== WAVE_PHASE.INTRO) return false;
    this._beginWave(time);
    return true;
  }

  /** Enemies still to defeat in the active wave: alive + not yet spawned (hidden boss adds are not counted). */
  remaining(enemies) {
    if (this.phase !== WAVE_PHASE.ACTIVE) return 0;
    let n = 0;
    for (const e of enemies) if (e.alive) n++;
    for (const g of this.groups) if (!g.skipped && !g.cfg.bossHpBelow) n += g.cfg.count - g.spawned;
    return n;
  }

  update(enemies, time) {
    if (this.phase === WAVE_PHASE.INTRO || this.phase === WAVE_PHASE.INTERMISSION) {
      if (time >= this.phaseEndsAt) this._beginWave(time);
      return;
    }
    if (this.phase !== WAVE_PHASE.ACTIVE) return;

    const cfg = this.waves[this.waveIndex];
    let addsAlive = 0;
    if (cfg.boss) for (const e of enemies) if (e.alive && !e.type.boss) addsAlive++;

    let allDone = true;
    for (const g of this.groups) {
      if (g.skipped || g.spawned >= g.cfg.count) continue;
      if (!g.started) {
        // checked live: the boss may have spawned earlier in this same pass
        const bossAlive = !!this.boss && this.boss.alive;
        if (this.boss && !bossAlive) { g.skipped = true; continue; } // boss died before this threshold
        if (bossAlive && this.boss.hp / this.boss.maxHp < g.cfg.bossHpBelow) {
          g.started = true;
          g.nextAt = time + g.cfg.initialDelay;
        } else { allDone = false; continue; }
      }
      allDone = false;
      if (time < g.nextAt) continue;
      const isBoss = this._isBossId(g.cfg.enemyId);
      if (cfg.boss && !isBoss && addsAlive >= WAVE_TIMING.maxAliveAdds) continue; // wait for room
      const e = this._spawn(g, time);
      g.spawned += 1;
      g.nextAt = time + g.cfg.spawnInterval;
      if (e) {
        if (e.type.boss) this.boss = e;
        else addsAlive++;
      }
    }

    if (!allDone) return;
    for (const e of enemies) if (e.alive) return;
    this._completeWave(time);
  }

  _isBossId(id) { const t = getEnemyType(id); return !!(t && t.boss); }

  _spawn(g, time) {
    const points = this.spawnPoints[g.cfg.spawnPointGroup];
    if (!points || points.length === 0) return null; // invalid data: the group just finishes empty
    const pt = points[Math.floor(this.rng.next() * points.length) % points.length];
    const x = pt.x + (this.rng.next() - 0.5) * 2 * SPAWN_JITTER;
    const y = pt.y + (this.rng.next() - 0.5) * 2 * SPAWN_JITTER;
    return this.spawnFn(g.cfg.enemyId, x, y, time);
  }

  _beginWave(time) {
    const cfg = this.waves[this.waveIndex];
    if (!cfg) return;
    this.groups = cfg.groups.map((g) => ({
      cfg: g,
      spawned: 0,
      started: !(g.bossHpBelow > 0),
      skipped: false,
      nextAt: time + (g.initialDelay || 0),
    }));
    this.boss = null;
    this.phase = WAVE_PHASE.ACTIVE;
    this.phaseEndsAt = 0;
    this.waveStartedAt = time;
    this.events.emit('waveStart', this.waveIndex, this.total, !!cfg.boss);
  }

  _completeWave(time) {
    const i = this.waveIndex;
    if (this.cleared[i]) return;
    this.cleared[i] = true;
    const cfg = this.waves[i];
    const final = i === this.total - 1;
    this.events.emit('waveCleared', i, cfg.reward | 0, final);
    if (final) {
      this.phase = WAVE_PHASE.COMPLETE;
      return;
    }
    this.waveIndex = i + 1;
    this.phase = WAVE_PHASE.INTERMISSION;
    this.phaseEndsAt = time + WAVE_TIMING.intermission;
  }
}
