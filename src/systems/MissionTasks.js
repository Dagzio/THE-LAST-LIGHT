// D141 (user: the office becomes story level 1 — STORY_DESIGN_D133.md §3): the sub-tasks of a story level, read from
// its objectives:
//   type 'search' — the item (key card…) lies in one of the level's search spots (pickups of kind 'search' with the
//                   objective's `task` id); which one is picked by the run's seed (rule 19), kept on a restart. Hold E
//                   (the touch button) at a spot with a white dot, in its room (D143: not through a wall); moving or a
//                   hit breaks it off. No hints. D143 (user): `room` — while the hero is outside it the marker points at
//                   `target`; inside — no marker, the handler's `dialogue` once ("in the desk or the cabinets"); the
//                   item found — the other spots go dark (nothing left to search).
//   type 'hold'   — D143 (user): first the computer is started (`activate` — a pickup of kind 'activate', E), then the
//                   progress runs while the hero is inside `zone` (kept while outside); the marker is gone, the per cent
//                   over the desk; its `dialogue` once; enemies `trickle` in (1–2 at a time) until it is full; then the
//                   objective's `gives` fact (the drive → the exit opens, the reinforcements).
// D148 (Marseille, levels 2–3 — STORY_DESIGN_D133.md §4):
//   type 'inspect' — [СЦЕНА] the scene: every spot of the task (pickups of kind 'inspect') is looked at (hold E, like a
//                    search — always "found"), each with its own `dialogue`; all of them → `done`. The marker leads to
//                    the nearest one left.
//   type 'call'    — [ЗВОНОК] its `dialogue` plays at once (the game waits while it is on) and it is done.
//   type 'clear'   — [ЗАЧИСТКА] / the sniper: done once no enemy tagged `tag` stands (those spawned later too);
//                    the marker on the nearest one left, the count in the text.
//   type 'capture' — [ЗАХВАТ ЖИВЫМ] the enemy tagged `tag` taken from behind (the takedown — he goes down on his knees,
//                    alive); killed → failure 'targetKilled'; alarmed he runs for `flee` — reached → 'escaped'.
//   type 'defend'  — [ПРИКРЫТИЕ СВЕРХУ] the progress runs `duration` s whatever the hero does (the crew works); enemies
//                    come in `waves` from `spawnPoints` heading for `guard` (a rect); one who stays in it `reachFor` s
//                    → failure 'crew'. Then `gives`.
//   level.searchlights — systems/Searchlights.js (the helicopter on the roofs, the towers of the terminal).
// Restart points (D141/D143, user: at the key moments, with exactly what was carried then): every objective's start
// and the computer started — a death restarts from the last one: the guns, rounds and grenades of that moment, the
// facts, who is down, what is open. Pure simulation, game clock only; balance numbers in data/tasks.js / the level.
import { TASKS } from '../data/tasks.js';
import { SeededRandom } from '../core/SeededRandom.js';
import { Searchlights } from './Searchlights.js';

const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

export class MissionTasks {
  /** @param {import('../core/MissionRun.js').MissionRun} run */
  constructor(run) {
    this.run = run;
    this.rng = new SeededRandom((run.runSeed ^ 0x5ea4c4e1) >>> 0); // its own stream: the other rolls stay as they were
    run.enemies.forEach((e, i) => { e.spawnIdx = i; });
    this.killed = new Set(); // spawn indices of the level's enemies down (bodies fade — the record stays)
    this._unsub = run.events.on('kill', (e) => { if (e && e.spawnIdx !== undefined) this.killed.add(e.spawnIdx); });
    // where each search task's item lies: its spots (the level's 'search' pickups of that task), one picked
    this.hidden = {};
    for (const o of run.level.objectives) {
      if (o.type !== 'search') continue;
      const spots = run.level.pickups.filter((p) => p.kind === 'search' && p.task === o.id);
      if (spots.length) this.hidden[o.id] = spots[Math.floor(this.rng.next() * spots.length) % spots.length].id;
    }
    this.searching = null;      // { pk, t0, progress }
    this.searchNote = null;     // { x, y, found, until } the last search's result over its spot
    this.saidRoom = false;      // the search room's dialogue played
    this.activated = false;     // the hold's computer started
    this.holdProgress = 0;      // s done of the current hold
    this.nextTrickleAt = Infinity;
    this.lastIndex = -1;
    this.snapshot = null;
    // D146 (STORY_DESIGN_D133.md §3.2 — stealth by choice): level.alarm — a guard who has seen the hero calls it in after
    // `radio` s (downed before that: no alarm); the alarm brings enemies in, 1–2 at a time, until it is cut at one of
    // its panels (E). Only during the objectives it lists (the download / the escape have their own enemies).
    this.alarm = null;           // null — quiet, 'on', 'off' (cut: for good)
    this.nextAlarmAt = Infinity;
    this.alarmSpawned = [];
    // D148: the facts the level's objectives complete / give (the run itself knows keycard / drive / copy)
    for (const o of run.level.objectives) for (const k of [o.done, o.gives]) if (k && !(k in run.has)) run.has[k] = false;
    this.inspected = new Set();  // the scene's spots looked at (pickup ids)
    this.defendTime = 0;         // s done of a 'defend'
    this.nextWaveAt = Infinity;
    this.waveIdx = 0;
    this.atGuard = new Map();    // enemy → s he has stood at the guarded spot
    this.lights = run.level.searchlights ? new Searchlights(run, this) : null;
    this._unsubs = [
      run.events.on('escaped', (e) => { if (e && e.capture && !run.over) run._setDefeat('escaped'); }),
      run.events.on('kill', (e) => { if (e && e.capture && !e.captured && !run.over) run._setDefeat('targetKilled'); }),
    ];
  }

  get alarmOn() { return this.alarm === 'on'; }

  /** The alarm's rules apply now (the level has one, the objective is one it covers). */
  _alarmWatch() {
    const A = this.run.level.alarm, o = this.objective;
    return !!A && !!o && A.during.includes(o.id);
  }

  _alarmUpdate(time) {
    const run = this.run, A = run.level.alarm;
    if (!A) return;
    if (this.alarm === null && this._alarmWatch()) {
      // his call starts the moment he first sees the hero (combat); it goes through if he still stands when it ends —
      // whether or not he still sees him (lost sight, he searches — the call is already on the air)
      for (const e of run.enemies) {
        if (!e.alive) continue;
        if (!(e.alarmAt > 0)) { if (e.ai.mode === 'combat' || e.ai.aware) e.alarmAt = time + A.radio; continue; } // (aware: saw him / heard the shots)
        if (time >= e.alarmAt) { this._raiseAlarm(time); break; }
      }
    }
    if (this.alarm !== 'on' || !this._alarmWatch() || time < this.nextAlarmAt) return;
    this.nextAlarmAt = time + A.every[0] + this.rng.next() * (A.every[1] - A.every[0]);
    this.alarmSpawned = this.alarmSpawned.filter((e) => e.alive);
    if (this.alarmSpawned.length >= A.maxAlive) return;
    // the nearest entry point that is not close to the hero (they come in, not appear beside him — nor a minute away);
    // none far enough: the farthest
    const p = run.player, minD = A.minDist || 700;
    let pt = null, near = Infinity, far = null, farD = -1;
    for (const q of Object.values(A.from)) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d >= minD && d < near) { near = d; pt = q; }
      if (d > farD) { farD = d; far = q; }
    }
    if (!pt) pt = far;
    const n = Math.min(A.maxAlive - this.alarmSpawned.length, A.group[0] + Math.floor(this.rng.next() * (A.group[1] - A.group[0] + 1)));
    for (let i = 0; i < n; i++) {
      const type = A.types[Math.floor(this.rng.next() * A.types.length) % A.types.length];
      const e = run._spawnEnemy({ type, x: pt.x + (i ? 24 : 0), y: pt.y, angle: Math.atan2(p.y - pt.y, p.x - pt.x) }, true);
      if (e) this.alarmSpawned.push(e);
    }
    run.events.emit('alarmWave', n);
  }

  _raiseAlarm(time) {
    const run = this.run, A = run.level.alarm;
    if (!A || this.alarm !== null) return;
    this.alarm = 'on';
    run.stats.alarm = true;
    this.nextAlarmAt = time + A.first;
    run.events.emit('alarm');
    if (A.dialogue) run.events.emit('dialogue', A.dialogue);
    // D148: a man to be taken alive runs for his way out
    for (const e of run.enemies) if (e.alive && e.capture && !e.captured) run.ai.flee(e, time);
  }

  _cutAlarm(pk) {
    const run = this.run, A = run.level.alarm;
    this.alarm = 'off';
    for (const q of run.pickups) if (q.def.task === 'alarm') q.taken = true;
    run.events.emit('alarmOff');
    if (A.offDialogue) run.events.emit('dialogue', A.offDialogue);
    this._save(); // a key moment: the alarm is down
  }

  /** The alarm panels to point at while it rings (the run's pointers: a frame + the second arrow). */
  alarmPanels() {
    if (this.alarm !== 'on') return null;
    return this.run.pickups.filter((q) => q.def.task === 'alarm' && !q.taken);
  }

  dispose() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    for (const u of this._unsubs || []) u();
    this._unsubs = [];
  }

  get objective() { return this.run.level.objectives[this.run.objectiveIndex] || null; }

  /** D148: the living enemies of a tag (a 'clear' / 'capture' objective's). */
  _tagged(tag) { return this.run.enemies.filter((e) => e.alive && e.tag === tag); }
  /** D148: the scene's spots of an 'inspect' objective. */
  _spots(o) { return this.run.pickups.filter((pk) => pk.def.kind === 'inspect' && pk.def.task === o.id); }

  /** The HUD's progress of the current objective (a hold: its per cent, once started; D148: left / seen / %), or null. */
  objectiveProgress() {
    const o = this.objective;
    if (!o) return null;
    if (o.type === 'clear') return this._tagged(o.tag).length;
    if (o.type === 'inspect') { const s = this._spots(o); return `${s.filter((pk) => pk.taken).length}/${s.length}`; }
    if (o.type === 'defend') return Math.min(100, Math.floor((this.defendTime / o.duration) * 100));
    if (o.type !== 'hold' || !this.activated) return null;
    return Math.min(100, Math.floor((this.holdProgress / o.duration) * 100));
  }

  /** The objective's text now (a hold not started yet has its own: "start the download"). */
  objectiveTextKey() {
    const o = this.objective;
    return o && o.type === 'hold' && o.activate && !this.activated ? o.activateKey : null;
  }

  /** The per cent over the hold's computer (HUD label): { x, y, p, paused } or null. */
  holdLabel() {
    const o = this.objective;
    if (!o || o.type !== 'hold' || !this.activated || this.run.over) return null;
    const pc = this.run.level.pickups.find((p) => p.id === o.activate);
    if (!pc) return null;
    return { x: pc.x, y: pc.y, p: this.objectiveProgress(), paused: !inRect(o.zone, this.run.player.x, this.run.player.y) };
  }

  /** Before the hero moves: holding E at a search spot; E at the hold's computer. */
  preUpdate(input, dt, time) {
    const run = this.run, p = run.player, pk = run.interactTarget;
    const o = this.objective;
    if (!p.alive || p.takedown || !pk || run.over) { this.searching = null; return; }
    if (pk.def.kind === 'activate') {
      this.searching = null;
      if (pk.def.task === 'alarm') { if (this.alarm === 'on' && input.consumePressed('interact')) this._cutAlarm(pk); return; } // D146
      if (o && o.type === 'hold' && o.activate === pk.def.id && !this.activated && input.consumePressed('interact')) this._activate(pk, time);
      return;
    }
    const inspect = pk.def.kind === 'inspect'; // D148: the scene's spots — held like a search
    if (pk.def.kind !== 'search' && !inspect) { this.searching = null; return; }
    const S = TASKS.search;
    if (!input.isDown('interact')) { this.searching = null; return; }
    if (!this.searching || this.searching.pk !== pk) this.searching = { pk, t0: time, progress: 0 };
    const s = this.searching;
    // moved off the spot or hit: it starts over
    if (Math.hypot(p.vx, p.vy) > S.stillBelow || p.lastHitAt > s.t0) { s.t0 = time; s.progress = 0; return; }
    s.progress = Math.min(1, s.progress + dt / (pk.def.hold || (inspect ? TASKS.inspect.hold : S.hold)));
    input.consumePressed('interact');
    if (s.progress < 1) return;
    // the search is done: the spot is empty or holds the task's item
    pk.taken = true;
    this.searching = null;
    if (inspect) { this._inspected(pk); return; }
    const task = pk.def.task, found = !!task && this.hidden[task] === pk.def.id && o && o.id === task;
    this.searchNote = { x: pk.def.x, y: pk.def.y, found, until: time + S.resultFor };
    run.events.emit('searched', pk.def.id, found);
    if (!found) return;
    // D143 (user): found — the other places of this task are not searched any more (their dots go)
    for (const q of run.pickups) if (q.def.kind === 'search' && q.def.task === task) q.taken = true;
    if (o.gives) run.give(o.gives, time);
  }

  /** D148: a spot of the scene looked at — its words; the last one completes the objective. */
  _inspected(pk) {
    const run = this.run, o = this.objective;
    this.inspected.add(pk.def.id);
    run.events.emit('inspected', pk.def.id);
    if (pk.def.dialogue) run.events.emit('dialogue', pk.def.dialogue);
    if (o && o.type === 'inspect' && o.id === pk.def.task && this._spots(o).every((q) => q.taken) && o.done) run.has[o.done] = true;
  }

  /** D148: the enemies an objective brings at its start (`spawn`: hunting the hero with `hunt`, else on their posts). */
  _spawnFor(o) {
    const run = this.run;
    for (const s of o.spawn || []) {
      const e = run._spawnEnemy(s, !!s.hunt);
      if (e && s.assault) run.ai.assault(e, s.assault[0], s.assault[1], run.lastTime);
    }
  }

  /** D148: a 'defend' objective's next group — from one of its points, heading for the guarded spot. */
  _wave(o, time) {
    const run = this.run, W = o.waves;
    this.nextWaveAt = time + W.every[0] + this.rng.next() * (W.every[1] - W.every[0]);
    const alive = this._tagged('attacker').length;
    if (alive >= (W.maxAlive || 6)) return;
    const from = W.from[this.waveIdx++ % W.from.length], pt = o.spawnPoints[from];
    if (!pt) return;
    const n = Math.min((W.maxAlive || 6) - alive, W.group[0] + Math.floor(this.rng.next() * (W.group[1] - W.group[0] + 1)));
    const g = o.guard, gx = (g[0] + g[2]) / 2, gy = (g[1] + g[3]) / 2;
    for (let i = 0; i < n; i++) {
      const type = W.types[Math.floor(this.rng.next() * W.types.length) % W.types.length];
      const e = run._spawnEnemy({ type, x: pt.x + (i ? 26 : 0), y: pt.y + (i ? 10 : 0), angle: Math.atan2(gy - pt.y, gx - pt.x), tag: 'attacker' }, false);
      if (e) run.ai.assault(e, gx + (this.rng.next() - 0.5) * (g[2] - g[0]) * 0.6, gy + (this.rng.next() - 0.5) * (g[3] - g[1]) * 0.6, time);
    }
    run.events.emit('taskWave', n, pt);
  }

  _activate(pk, time) {
    const run = this.run, o = this.objective;
    this.activated = true;
    pk.taken = true;
    this.holdProgress = 0;
    const T = o.trickle;
    this.nextTrickleAt = T ? time + T.first : Infinity;
    run.events.emit('taskStarted', o.id);
    if (o.dialogue) run.events.emit('dialogue', o.dialogue);
    this._save(); // a key moment: the download started
  }

  /** After the AI: the search room's words, the hold's progress and its trickle; a new objective — a restart point. */
  update(dt, time) {
    const run = this.run, p = run.player;
    if (run.objectiveIndex !== this.lastIndex) { this.lastIndex = run.objectiveIndex; this._onObjective(); }
    const o = this.objective;
    if (!o || run.over || !p.alive) return;
    this._alarmUpdate(time); // D146
    if (this.lights) this.lights.update(dt, time); // D148
    // D145: 'reach' — done once the hero is in its room (the parking crossed: on the service stairs)
    if (o.type === 'reach' && o.room && run.levelWorld.zoneAt(p.x, p.y) === o.room) { run.has[o.done] = true; return; }
    // D148: the other sub-tasks of Marseille
    if (o.type === 'call') { if (o.gives) run.give(o.gives, time); if (o.done) run.has[o.done] = true; return; } // (its words played at its start)
    if (o.type === 'clear') { if (!this._tagged(o.tag).length && o.done) run.has[o.done] = true; return; }
    if (o.type === 'capture') {
      const t = run.enemies.find((e) => e.capture && e.tag === o.tag);
      if (t && t.captured && o.done) run.has[o.done] = true;
      return;
    }
    if (o.type === 'defend') { this._defendUpdate(o, dt, time); return; }
    if (o.type === 'search' && !this.saidRoom && o.room && run.levelWorld.zoneAt(p.x, p.y) === o.room) {
      this.saidRoom = true;
      if (o.dialogue) run.events.emit('dialogue', o.dialogue);
    }
    if (o.type !== 'hold' || !this.activated) return;
    if (inRect(o.zone, p.x, p.y)) this.holdProgress = Math.min(o.duration, this.holdProgress + dt);
    const T = o.trickle;
    if (T && time >= this.nextTrickleAt && this.holdProgress < o.duration) {
      this.nextTrickleAt = time + T.every[0] + this.rng.next() * (T.every[1] - T.every[0]);
      const pt = (o.spawnPoints || {})[T.from[Math.floor(this.rng.next() * T.from.length) % T.from.length]];
      const n = T.group[0] + Math.floor(this.rng.next() * (T.group[1] - T.group[0] + 1));
      if (pt && run.enemiesLeft < (T.maxAlive || 6)) {
        for (let i = 0; i < n; i++) {
          const type = T.types[Math.floor(this.rng.next() * T.types.length) % T.types.length];
          run._spawnEnemy({ type, x: pt.x + (i ? 24 : 0), y: pt.y, angle: Math.atan2(p.y - pt.y, p.x - pt.x) }, true);
        }
        run.events.emit('taskWave', n, pt);
      }
    }
    if (this.holdProgress >= o.duration && o.gives) run.give(o.gives, time);
  }

  /** The HUD arrow / the marker: a search outside its room → its point; inside — none; a hold → its computer until started. */
  objectiveTarget(out = {}) {
    const run = this.run, o = this.objective;
    if (!o) return null;
    if (o.type === 'search' && o.room && run.levelWorld.zoneAt(run.player.x, run.player.y) === o.room) return null;
    // D148: the scene — the nearest spot left; a clear — its `via` supply first (the tower's rifle), then the nearest
    // one left; a capture — the man himself until he is down
    const p = run.player, nearest = (list, xy) => {
      let best = null, bd = Infinity;
      for (const q of list) { const [x, y] = xy(q), d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = [x, y]; } }
      if (best) { out.x = best[0]; out.y = best[1]; }
      return best ? out : null;
    };
    if (o.type === 'inspect') { const r = nearest(this._spots(o).filter((pk) => !pk.taken), (pk) => [pk.def.x, pk.def.y]); if (r) return r; }
    if (o.type === 'clear') {
      const via = o.via && run.pickups.find((pk) => pk.def.id === o.via);
      if (via && !via.taken && via.openedAt < 0) { out.x = via.def.x; out.y = via.def.y; return out; }
      const r = nearest(this._tagged(o.tag), (e) => [e.x, e.y]);
      if (r) return r;
    }
    if (o.type === 'capture') {
      const t = run.enemies.find((e) => e.capture && e.tag === o.tag && e.alive && !e.captured);
      if (t) { out.x = t.x; out.y = t.y; return out; }
    }
    if (o.type === 'hold' && o.activate) {
      if (this.activated) return null;
      const pc = run.level.pickups.find((p) => p.id === o.activate);
      if (pc) { out.x = pc.x; out.y = pc.y; return out; }
    }
    if (Array.isArray(o.target)) { out.x = o.target[0]; out.y = o.target[1]; return out; }
    return undefined; // (the run's own rules: the exit…)
  }

  // ---------------- restart points ----------------
  _onObjective() {
    this.holdProgress = 0; this.activated = false; this.nextTrickleAt = Infinity; this.searching = null; this.saidRoom = false;
    this._enterObjective();
    this._save();
    this._startObjective();
  }

  /** D148: what an objective's start sets up before its restart point is taken (its scene's spots, the woken sniper). */
  _enterObjective() {
    const run = this.run, o = this.objective;
    this.defendTime = 0; this.nextWaveAt = Infinity; this.waveIdx = 0; this.atGuard.clear();
    if (!o) return;
    // the scene's spots wait (dormant) until their objective — then the white dots come up
    if (o.type === 'inspect') for (const pk of this._spots(o)) if (!this.inspected.has(pk.def.id)) pk.taken = false;
    for (const e of run.enemies) if (e.wakeOn === o.id) e.active = true; // (the crane's sniper: from his duel on)
    for (const pk of run.pickups) if (pk.def.wakeOn === o.id && pk.openedAt < 0) pk.taken = false; // (the bath's stash: after the call)
  }

  /** D148: what an objective's start brings after its restart point (enemies, words) — a restart brings them again. */
  _startObjective() {
    const run = this.run, o = this.objective;
    if (!o) return;
    this._spawnFor(o);
    if (o.type === 'call' && o.dialogue) run.events.emit('dialogue', o.dialogue);
    if (o.startDialogue) run.events.emit('dialogue', o.startDialogue);
    if (o.type === 'defend') this.nextWaveAt = run.lastTime + o.waves.first;
  }

  /** D148: the guarded spot — the crew's time runs; an attacker who stands in it long enough ends it. */
  _defendUpdate(o, dt, time) {
    const run = this.run;
    this.defendTime = Math.min(o.duration, this.defendTime + dt);
    if (time >= this.nextWaveAt && this.defendTime < o.duration - (TASKS.defend.lastWave || 8)) this._wave(o, time);
    const g = o.guard;
    for (const e of this._tagged('attacker')) {
      const inside = inRect(g, e.x, e.y), t = inside ? (this.atGuard.get(e) || 0) + dt : 0;
      this.atGuard.set(e, t);
      if (t >= (o.reachFor || 3)) { run._setDefeat('crew'); return; }
    }
    if (this.defendTime >= o.duration && o.gives) run.give(o.gives, time);
  }

  _save() {
    this.snapshot = this._snap();
    this.run.restartPoint = this.snapshot;
    this.run.events.emit('checkpoint');
  }

  /** What a restart from here needs (plain data, the moment it is taken). */
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
      dead: [...this.killed],
      taken: run.pickups.filter((pk) => pk.taken || pk.openedAt >= 0).map((pk) => pk.def.id),
      unlocked: run.doors.filter((d) => d.def.lock && !d.locked).map((d) => d.id),
      reinforced: run.reinforced,
      hidden: { ...this.hidden },
      activated: this.activated,
      saidRoom: this.saidRoom,
      alarm: this.alarm, // D146: ringing / cut at that moment
      inspected: [...this.inspected], // D148: the scene's spots looked at
      captured: run.enemies.filter((e) => e.captured).map((e) => e.spawnIdx), // D148: the dispatcher on his knees
      lights: this.lights ? this.lights.snap() : null,
    };
  }

  /** A fresh run continues from a restart point (Game.retryMap after a death) — exactly as it was saved. */
  applyCheckpoint(cp) {
    if (!cp || cp.kind !== 'mission') return;
    const run = this.run, p = run.player;
    this.hidden = { ...cp.hidden };
    for (const i of cp.dead) this.killed.add(i);
    run.enemies = run.enemies.filter((e) => !this.killed.has(e.spawnIdx));
    [p.x, p.y] = cp.at; p.prevX = p.x; p.prevY = p.y;
    p.aimAngle = p.bodyAngle = cp.at[2]; p.facingX = Math.cos(cp.at[2]); p.facingY = Math.sin(cp.at[2]);
    // the guns of that moment only (a fresh run carries its start loadout — what was not carried then goes)
    run.inventory = run.inventory.filter((id) => cp.weapons.some(([w]) => w === id));
    for (const [id, ammo, reserve] of cp.weapons) {
      if (!run.weaponStates[id]) run.giveWeapon(id, false);
      const w = run.weaponStates[id];
      if (w) { w.ammo = ammo; w.reserve = reserve; w.reloading = false; }
    }
    run.weapon = run.weaponStates[cp.current] || run.weaponStates[run.inventory[0]];
    run.weaponStats = run.weapon.stats;
    for (const t of Object.keys(run.grenades.stock)) run.grenades.stock[t] = cp.grenades[t] | 0;
    Object.assign(run.has, cp.has);
    for (const pk of run.pickups) if (cp.taken.includes(pk.def.id)) { pk.taken = true; pk.openedAt = 0; }
    for (const d of run.doors) if (cp.unlocked.includes(d.id)) d.locked = false;
    if (cp.reinforced) run.callReinforcements();
    run.objectiveIndex = cp.objectiveIndex;
    this.lastIndex = cp.objectiveIndex; // (its start is this restart point — not saved over at once)
    this.snapshot = cp;
    run.restartPoint = cp;
    this.saidRoom = !!cp.saidRoom;
    // D146: the alarm as it was (ringing again from the restart — its next group a moment later; cut — its panels gone)
    this.alarm = cp.alarm || null;
    if (this.alarm === 'on') { this.nextAlarmAt = (run.level.alarm || {}).first || 5; run.stats.alarm = true; }
    if (this.alarm === 'off') for (const q of run.pickups) if (q.def.task === 'alarm') q.taken = true;
    if (cp.activated) {
      const o = this.objective, pc = o && run.pickups.find((k) => k.def.id === o.activate);
      if (pc) { this.activated = true; this.holdProgress = 0; this.nextTrickleAt = o.trickle ? o.trickle.first : Infinity; }
    }
    // D148: the scene's spots seen, the dispatcher taken, the woken sniper; the objective's own enemies come again
    for (const id of cp.inspected || []) this.inspected.add(id);
    for (const e of run.enemies) if ((cp.captured || []).includes(e.spawnIdx)) this.capture(e);
    for (let i = 0; i <= cp.objectiveIndex; i++) { const o = run.level.objectives[i]; for (const e of run.enemies) if (o && e.wakeOn === o.id) e.active = true; }
    if (this.lights && cp.lights) this.lights.restore(cp.lights);
    this._enterObjective();
    for (const pk of run.pickups) if (pk.def.kind === 'inspect' && this.inspected.has(pk.def.id)) pk.taken = true;
    this._startObjective();
  }

  /** D148: the man to be taken alive goes down on his knees (the takedown's blow; a restart from after it). */
  capture(e) {
    e.captured = true;
    e.harmless = true;
    e.crouch = true;
    e.ai.mode = 'grabbed'; // (held where he is: never moved, never pushed)
    e.vx = 0; e.vy = 0;
    this.run.events.emit('captured', e);
  }
}
