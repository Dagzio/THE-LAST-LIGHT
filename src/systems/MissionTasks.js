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
// Restart points (D141/D143, user: at the key moments, with exactly what was carried then): every objective's start
// and the computer started — a death restarts from the last one: the guns, rounds and grenades of that moment, the
// facts, who is down, what is open. Pure simulation, game clock only; balance numbers in data/tasks.js / the level.
import { TASKS } from '../data/tasks.js';
import { SeededRandom } from '../core/SeededRandom.js';

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
  }

  dispose() { if (this._unsub) { this._unsub(); this._unsub = null; } }

  get objective() { return this.run.level.objectives[this.run.objectiveIndex] || null; }

  /** The HUD's progress of the current objective (a hold: its per cent, once started), or null. */
  objectiveProgress() {
    const o = this.objective;
    if (!o || o.type !== 'hold' || !this.activated) return null;
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
      if (o && o.type === 'hold' && o.activate === pk.def.id && !this.activated && input.consumePressed('interact')) this._activate(pk, time);
      return;
    }
    if (pk.def.kind !== 'search') { this.searching = null; return; }
    const S = TASKS.search;
    if (!input.isDown('interact')) { this.searching = null; return; }
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
    if (!found) return;
    // D143 (user): found — the other places of this task are not searched any more (their dots go)
    for (const q of run.pickups) if (q.def.kind === 'search' && q.def.task === task) q.taken = true;
    if (o.gives) run.give(o.gives, time);
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
    this._save();
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
    if (cp.activated) {
      const o = this.objective, pc = o && run.pickups.find((k) => k.def.id === o.activate);
      if (pc) { this.activated = true; this.holdProgress = 0; this.nextTrickleAt = o.trickle ? o.trickle.first : Infinity; }
    }
  }
}
