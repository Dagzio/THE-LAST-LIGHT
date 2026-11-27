// D148 (Marseille — STORY_DESIGN_D133.md §4: [ПОБЕГ] от прожектора, level 2's roofs; the terminal's towers, level 3):
// searchlights — a lit circle on the ground that moves; the hero inside it (not under a shelter) is seen.
//   kind 'heli'  — the police helicopter: it flies its `path` (loop) until it sees the hero, then follows him (`chase`
//                  speed) until it has lost him for `lose` s. In its light longer than `spot` s → the gunner fires bursts
//                  at him (rounds from the helicopter's side — walls and shelters stop them like any rounds).
//   kind 'sweep' — a tower's lamp: its circle swings between two angles round the tower (`arc`, `period` s) at `reach`;
//                  the hero in it `spot` s → the level's alarm (MissionTasks._raiseAlarm), once.
// `during` — the objectives it works in (none: always). Shelters: level.shelters (rects — awnings, the stair huts),
// where the light does not see. Pure simulation on the game clock; the renderer draws `list` (x, y, r, on, hot).
const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

export class Searchlights {
  /** @param {import('../core/MissionRun.js').MissionRun} run  @param {import('./MissionTasks.js').MissionTasks} tasks */
  constructor(run, tasks) {
    this.run = run;
    this.tasks = tasks;
    this.list = run.level.searchlights.map((def) => {
      const start = def.kind === 'heli' ? def.path[0] : [def.x + Math.cos(def.from) * def.reach, def.y + Math.sin(def.from) * def.reach];
      return { def, x: start[0], y: start[1], r: def.radius, on: false, hot: 0, exposure: 0, wp: 1, chaseUntil: -Infinity, nextBurstAt: 0, burstLeft: 0, nextShotAt: 0, raised: false };
    });
  }

  _active(L) {
    const o = this.tasks.objective, d = L.def.during;
    return !d || (!!o && d.includes(o.id));
  }

  _sheltered(x, y) {
    for (const r of this.run.level.shelters || []) if (inRect(r, x, y)) return true;
    return false;
  }

  update(dt, time) {
    const run = this.run, p = run.player;
    for (const L of this.list) {
      const D = L.def;
      L.on = this._active(L) && !run.over;
      if (!L.on) { L.exposure = 0; L.hot = 0; continue; }
      if (D.kind === 'heli') this._fly(L, dt, time);
      else {
        // a tower's lamp: a smooth swing between `from` and `to` (radians), `period` s for there and back
        const k = 0.5 - 0.5 * Math.cos((time / D.period) * Math.PI * 2);
        const a = D.from + (D.to - D.from) * k;
        L.x = D.x + Math.cos(a) * D.reach; L.y = D.y + Math.sin(a) * D.reach;
      }
      const inLight = p.alive && Math.hypot(p.x - L.x, p.y - L.y) <= L.r && !this._sheltered(p.x, p.y);
      L.exposure = inLight ? L.exposure + dt : Math.max(0, L.exposure - dt * 1.5);
      L.hot = Math.min(1, L.exposure / D.spot);
      if (D.kind === 'heli') {
        if (inLight) L.chaseUntil = time + D.lose;
        if (L.exposure >= D.spot) this._fire(L, time);
      } else if (L.exposure >= D.spot && !L.raised && this.tasks._alarmWatch()) {
        L.raised = true;
        run.events.emit('spotted', null);
        this.tasks._raiseAlarm(time);
      }
    }
  }

  /** The helicopter: its round (path) or after the hero (seen lately) — the circle glides, never jumps. */
  _fly(L, dt, time) {
    const D = L.def, p = this.run.player;
    let tx, ty, sp;
    if (time < L.chaseUntil && p.alive) { tx = p.x; ty = p.y; sp = D.chase; }
    else {
      const w = D.path[L.wp % D.path.length];
      tx = w[0]; ty = w[1]; sp = D.speed;
      if (Math.hypot(tx - L.x, ty - L.y) < 20) L.wp = (L.wp + 1) % D.path.length;
    }
    const dx = tx - L.x, dy = ty - L.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { const step = Math.min(d, sp * dt); L.x += (dx / d) * step; L.y += (dy / d) * step; }
  }

  /** The gunner: bursts of `burst` rounds every `every` s while the hero stays lit — from the helicopter's side. */
  _fire(L, time) {
    const D = L.def, run = this.run, p = run.player;
    if (L.burstLeft <= 0) {
      if (time < L.nextBurstAt) return;
      L.burstLeft = D.burst; L.nextShotAt = time;
    }
    if (time < L.nextShotAt) return;
    L.burstLeft -= 1;
    L.nextShotAt = time + D.shotGap;
    if (L.burstLeft <= 0) L.nextBurstAt = time + D.every;
    const b = run.projectiles.spawn();
    if (!b) return;
    // from up there: the round starts `from` units out on the helicopter's side and flies at the hero (a slight scatter)
    const side = D.side, a = side + (run.rng.next() - 0.5) * 0.5;
    const sx = p.x - Math.cos(a) * D.from, sy = p.y - Math.sin(a) * D.from;
    const aim = Math.atan2(p.y - sy, p.x - sx) + (run.rng.next() - 0.5) * 0.05;
    const s = { id: 'heli_gun', damage: D.damage, range: D.from * 1.6, projectileSpeed: 1500 };
    b.x = b.prevX = sx; b.y = b.prevY = sy;
    b.vx = Math.cos(aim) * s.projectileSpeed; b.vy = Math.sin(aim) * s.projectileSpeed;
    b.angle = aim; b.maxDistance = s.range; b.hitsLeft = 1; b.weaponId = s.id; b.stats = s; b.hostile = true; b.spawnedAt = time;
    run.events.emit('heliShot', sx, sy, aim);
  }

  /** For a restart point: where the lights are (the tower's alarm already raised stays raised). */
  snap() { return this.list.map((L) => ({ x: L.x, y: L.y, wp: L.wp, raised: L.raised })); }

  restore(s) {
    s.forEach((q, i) => { const L = this.list[i]; if (!L || !q) return; L.x = q.x; L.y = q.y; L.wp = q.wp; L.raised = !!q.raised; });
  }
}
