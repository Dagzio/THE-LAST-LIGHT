// D141 (user: the office becomes story level 1 — STORY_DESIGN_D133.md §3): the sub-tasks of a story level, read from
// its objectives:
//   type 'search' — the item (key card…) lies in one of the level's search spots (pickups of kind 'search' with the
//                   objective's `task` id); which one is picked by the run's seed (rule 19), kept on a restart. Hold E
//                   (the touch button) 1.2 s at a spot with a white dot; moving or a hit breaks it off. No hints.
//   type 'hold'   — the progress runs while the hero is inside `zone` ([x0, y0, x1, y1]); outside it waits (kept).
//                   `waves` come in at fractions of the progress, hunting the hero; when it is full the objective's
//                   `gives` fact is set (the drive → the level's turn: the exit opens, the reinforcements).
// And the restart points: every objective's start is a checkpoint — a death restarts the run from the current one
// (who is down, what is carried, what is open). Pure simulation, game clock only; balance numbers in data/tasks.js.
import { TASKS } from '../data/tasks.js';
import { INTERACT } from '../data/player.js';
import { SeededRandom } from '../core/SeededRandom.js';

const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

export class MissionTasks {
  /** @param {import('../core/MissionRun.js').MissionRun} run */
  constructor(run) {
    this.run = run;
    this.rng = new SeededRandom((run.runSeed ^ 0x5ea4c4e1) >>> 0); // its own stream: the other rolls stay as they were
    run.enemies.forEach((e, i) => { e.spawnIdx = i; });
    // where each search task's item lies: its spots (the level's 'search' pickups of that task), one picked
    this.hidden = {};
    for (const o of run.level.objectives) {
      if (o.type !== 'search') continue;
      const spots = run.level.pickups.filter((p) => p.kind === 'search' && p.task === o.id);
      if (spots.length) this.hidden[o.id] = spots[Math.floor(this.rng.next() * spots.length) % spots.length].id;
    }
    this.searching = null;      // { pk, t0, progress }
    this.searchNote = null;     // { x, y, found, until } the last search's result over its spot
    this.holdProgress = 0;      // s done of the current hold
    this.wavesDone = 0;
    this.waveWarn = null;       // { x, y, until } the next wave's entry point
    this.lastIndex = -1;
    this.snapshot = null;
  }

  get objective() { return this.run.level.objectives[this.run.objectiveIndex] || null; }

  /** The HUD's progress of the current objective (a hold: its per cent), or null. */
  objectiveProgress() {
    const o = this.objective;
    if (!o || o.type !== 'hold') return null;
    return Math.min(100, Math.floor((this.holdProgress / o.duration) * 100));
  }

  /** The current search's progress 0…1 (HUD label), or 0. */
  get searchProgress() { return this.searching ? this.searching.progress : 0; }

  /** Before the hero moves: holding E at a search spot. */
  preUpdate(input, dt, time) {
    const run = this.run, p = run.player, pk = run.interactTarget;
    const o = this.objective;
    if (!p.alive || p.takedown || !pk || pk.def.kind !== 'search' || run.over) { this.searching = null; return; }
    const S = TASKS.search;
    const holding = input.isDown('interact');
    if (!holding) { this.searching = null; return; }
    if (!this.searching || this.searching.pk !== pk) this.searching = { pk, t0: time, progress: 0 };
    const s = this.searching;
    // moved off the spot or hit: it starts over
    if (Math.hypot(p.vx, p.vy) > S.stillBelow || p.lastHitAt > s.t0) { s.t0 = time; s.progress = 0; return; }
    s.progress = Math.min(1, s.progress + dt / (pk.def.hold || S.hold));
    input.consumePressed('interact');
    if (s.progress < 1) return;
    // the search is done: the spot is empty or holds the task's item
    pk.taken = true;
    this.searching = null;
    const task = pk.def.task, found = !!task && this.hidden[task] === pk.def.id && o && o.id === task;
    this.searchNote = { x: pk.def.x, y: pk.def.y, found, until: time + S.resultFor };
    run.events.emit('searched', pk.def.id, found);
    if (found && o.gives) run.give(o.gives, time);
  }

  /** After the AI: the hold's progress and its waves; a new objective — a new restart point. */
  update(dt, time) {
    const run = this.run, p = run.player;
    if (run.objectiveIndex !== this.lastIndex) { this.lastIndex = run.objectiveIndex; this._onObjective(time); }
    const o = this.objective;
    if (!o || o.type !== 'hold' || run.over || !p.alive) return;
    if (inRect(o.zone, p.x, p.y)) this.holdProgress = Math.min(o.duration, this.holdProgress + dt);
    const f = this.holdProgress / o.duration, waves = o.waves || [];
    const next = waves[this.wavesDone];
    if (next) {
      const pt = (o.spawnPoints || {})[next.from];
      if (pt && f >= next.at - (TASKS.hold.waveWarn / o.duration) && !this.waveWarn) this.waveWarn = { x: pt.x, y: pt.y, until: Infinity };
      if (f >= next.at) {
        this.wavesDone += 1;
        this.waveWarn = null;
        if (pt) {
          next.enemies.forEach((type, i) => run._spawnEnemy({ type, x: pt.x + (i % 2 ? 22 : -22), y: pt.y + (i > 1 ? 24 : 0), angle: Math.atan2(p.y - pt.y, p.x - pt.x) }, true));
          run.events.emit('taskWave', this.wavesDone, next.from);
        }
      }
    }
    if (this.holdProgress >= o.duration && o.gives) { this.waveWarn = null; run.give(o.gives, time); }
  }

  /** The HUD arrow: a point target [x, y] of the objective (a search room, the hold's terminal). */
  objectiveTarget(out = {}) {
    const o = this.objective;
    if (o && Array.isArray(o.target)) { out.x = o.target[0]; out.y = o.target[1]; return out; }
    return null;
  }

  // ---------------- restart points ----------------
  _onObjective(time) {
    this.holdProgress = 0; this.wavesDone = 0; this.waveWarn = null; this.searching = null;
    this.snapshot = this._snap();
    this.run.restartPoint = this.snapshot;
  }

  /** What a restart from here needs (plain data). */
  _snap() {
    const run = this.run, p = run.player;
    return {
      kind: 'mission',
      objectiveIndex: run.objectiveIndex,
      at: [Math.round(p.x), Math.round(p.y), p.aimAngle],
      weapons: run.inventory.map((id) => [id, run.weaponStates[id].ammo, run.weaponStates[id].reserve]),
      current: run.weapon.weaponId,
      grenades: { ...run.grenades.stock },
      has: { ...run.has },
      dead: run.enemies.filter((e) => !e.alive && e.spawnIdx !== undefined).map((e) => e.spawnIdx),
      taken: run.pickups.filter((pk) => pk.taken || pk.openedAt >= 0).map((pk) => pk.def.id),
      unlocked: run.doors.filter((d) => d.def.lock && !d.locked).map((d) => d.id),
      reinforced: run.reinforced,
      hidden: { ...this.hidden },
    };
  }

  /** A fresh run continues from a restart point (Game.retryMap after a death). */
  applyCheckpoint(cp) {
    if (!cp || cp.kind !== 'mission') return;
    const run = this.run, p = run.player;
    this.hidden = { ...cp.hidden };
    run.enemies = run.enemies.filter((e) => !cp.dead.includes(e.spawnIdx));
    [p.x, p.y] = cp.at; p.prevX = p.x; p.prevY = p.y;
    p.aimAngle = p.bodyAngle = cp.at[2]; p.facingX = Math.cos(cp.at[2]); p.facingY = Math.sin(cp.at[2]);
    for (const [id, ammo, reserve] of cp.weapons) {
      if (!run.weaponStates[id]) run.giveWeapon(id, false);
      const w = run.weaponStates[id];
      if (w) { w.ammo = ammo; w.reserve = reserve; }
    }
    if (run.weaponStates[cp.current]) run.switchWeapon(cp.current);
    for (const [t, n] of Object.entries(cp.grenades)) if (t in run.grenades.stock) run.grenades.stock[t] = n;
    Object.assign(run.has, cp.has);
    for (const pk of run.pickups) if (cp.taken.includes(pk.def.id)) { pk.taken = true; pk.openedAt = 0; }
    for (const d of run.doors) if (cp.unlocked.includes(d.id)) d.locked = false;
    if (cp.reinforced) run.callReinforcements();
    run.objectiveIndex = cp.objectiveIndex;
    run.resumed = true; // (the level's opening dialogue is not played again)
  }
}
