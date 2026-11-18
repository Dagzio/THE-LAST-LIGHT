// D85 STEALTH director (MODES_DESIGN_D85.md §3): the rules of a stealth run around the normal mission loop — the
// hero's stance and speeds (walk is silent, Shift runs and is heard, C crouches), the light map the enemies' eyes
// read, silent takedowns from behind, the copy held at the server terminal, the alert level (calm → suspicion →
// search → alarm) and what the alarm does (data: STEALTH.onAlarm — 'fail' ends the job, 'combat' goes loud).
// Pure simulation: everything on the game clock, no DOM, no rendering.
import { STEALTH, ALERT } from '../data/stealth.js';
import { LightMap } from './LightMap.js';

const M = { x: 0, y: 0 };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class StealthDirector {
  /** @param {import('../core/MissionRun.js').MissionRun} run */
  constructor(run) {
    this.run = run;
    this.light = new LightMap(run.level);
    run.ai.stealth = STEALTH;
    run.ai.lightAt = (x, y) => this.light.at(x, y);
    run.controller.speedProfile = STEALTH.speeds;
    run.stats.takedowns = 0;
    run.stats.alarm = false;
    this.level = ALERT.CALM;
    this.maxLevel = ALERT.CALM;
    this.alarmRaised = false;
    this.failAt = Infinity;
    this.runNoiseAt = 0;
    this.takedownTarget = null;
    this.copying = false;
    this.witnessAt = 0;
    this.nextRadioAt = STEALTH.radio.every;
    // D88: the hero sneaks by default (C — an upright walk, Shift — run)
    run.player.sneak = true;
    run.player.stance = 'crouch';
    // D87: killing has a price — a body found during the search, a kill seen by another guard
    this._unsub = [
      run.events.on('bodyFound', (e, b, second) => { if (second && STEALTH.secondBodyAlarm) this.raiseAlarm(run.lastTime); }),
      run.events.on('kill', (e) => { if (e && e.x !== undefined) this._witness(e, run.lastTime); }),
      run.events.on('spotted', (e) => { if (e && e.ai) this._startRadio(e, run.lastTime); }), // D88
    ];
  }

  dispose() { for (const u of this._unsub) u(); this._unsub = []; }

  /**
   * D87: does another guard see the victim `e` now (a takedown in progress, a kill)? The first who does goes to combat
   * (he saw the attacker) — D88: and calls it in (the radio delay: downed in time, no alarm). → true if seen.
   */
  _witness(e, time) {
    if (this.alarmRaised) return false;
    const run = this.run, p = run.player;
    for (const o of run.enemies) {
      if (o === e || !o.alive || o.ai.mode === 'combat' || o.ai.mode === 'grabbed') continue;
      if (!run.ai.seesPoint(o, e.x, e.y, time, STEALTH.witness.rangeMult)) continue;
      const ai = o.ai;
      ai.mode = 'combat'; ai.aware = true; ai.suspicion = 1; ai.investigate = false;
      ai.lastSeenX = p.x; ai.lastSeenY = p.y; ai.lastSeenAt = time; ai.reactAt = time + 0.4;
      this._startRadio(o, time);
      run.events.emit('witness', o, e);
      return true;
    }
    return false;
  }

  /** D88: a guard who knows about the hero starts his radio call (once); the alarm when it ends and he still stands. */
  _startRadio(e, time) {
    if (Number.isFinite(e.ai.radioAt) || this.alarmRaised) return;
    e.ai.radioFor = STEALTH.spotted.radio;
    e.ai.radioAt = time + e.ai.radioFor;
    this.run.events.emit('radioCall', e);
  }

  /** D87: radio check-ins — one of the dead (unfound, dead long enough) is missed; the nearest guard goes to his spot. */
  _radio(time) {
    if (time < this.nextRadioAt) return;
    this.nextRadioAt = time + STEALTH.radio.every;
    const run = this.run, R = STEALTH.radio;
    const body = run.enemies.find((b) => !b.alive && !b.found && !b.radioed && time - b.deathAt >= R.after);
    if (!body) return;
    let best = null, bestD = Infinity;
    for (const g of run.enemies) {
      if (!g.alive || g.ai.mode === 'combat' || g.ai.mode === 'grabbed' || g.ai.investigate) continue;
      const d = Math.hypot(g.x - body.x, g.y - body.y);
      if (d < bestD) { bestD = d; best = g; }
    }
    if (!best) return;
    body.radioed = true;
    run.ai.investigate(best, body.x, body.y, time, 0.4);
    run.events.emit('radioCheck', best, body);
  }

  /** On touch the gun never fires by itself in stealth (it would give the hero away); after the alarm it may. */

  /** How visible the hero is now (0…1): the light where he stands and his stance (HUD eye). */
  get heroVisibility() {
    const p = this.run.player, L = STEALTH.light;
    const k = Math.min(1, Math.max(0, (this.light.at(p.x, p.y) - L.dark) / (L.lit - L.dark)));
    return (0.3 + 0.7 * k) * (p.lowProfile ? STEALTH.stance.crouch : 1);
  }

  /** Before the hero moves: stance / pace from the input, a takedown in progress, the copy at the terminal. */
  preUpdate(input, dt, time) {
    const run = this.run, p = run.player;
    if (!p.alive) return;
    if (p.takedown) {
      // D87: the struggle can be seen by another guard (checked a few times a second)
      if (!p.takedown.killed && time >= this.witnessAt) { this.witnessAt = time + STEALTH.witness.every; this._witness(p.takedown.e, time); }
      this._takedownStep(time);
      input.consumePressed('crouch'); input.consumePressed('takedown'); input.consumePressed('interact');
      return;
    }
    // D88: sneaking is the default stance (C toggles an upright walk); running (Shift / the stick pushed all the way)
    // stands him up while it lasts
    if (input.consumePressed('crouch')) p.sneak = !p.sneak;
    input.getMove(M);
    const tilt = Math.hypot(M.x, M.y);
    // D107 (user: on a phone the full stick made him run — the stealth yard could not be sneaked): like on PC he sneaks by
    // default; only the run key runs (the phone has none — it never runs in stealth)
    const running = input.isDown('run') && tilt > 0.1;
    p.stance = p.dodging || running ? 'stand' : p.sneak ? 'crouch' : 'stand';
    p.moveMode = p.stance === 'crouch' || p.crouched ? 'crouch' : running ? 'run' : 'walk';
    // running is heard (walking and crouching are silent — NEW GAME.docx)
    if (p.moveMode === 'run' && Math.hypot(p.vx, p.vy) > STEALTH.motion.runAbove && time >= this.runNoiseAt) {
      this.runNoiseAt = time + STEALTH.runNoise.every;
      run.noise(p.x, p.y, STEALTH.runNoise.radius, 'quiet');
    }
    // takedown: F, or E (the touch context button) when no crate / terminal is in reach
    this.takedownTarget = this._findTakedown();
    if (this.takedownTarget) {
      const viaE = !run.interactTarget && input.consumePressed('interact');
      if (input.consumePressed('takedown') || viaE) this._startTakedown(this.takedownTarget, time);
    } else input.consumePressed('takedown');
    // the copy: hold E (the button) at the terminal; letting go keeps the progress
    const pk = run.interactTarget;
    this.copying = false;
    if (pk && pk.def.kind === 'terminal' && !run.has.copy && input.isDown('interact') && !p.takedown) {
      this.copying = true;
      p.stance = 'stand';
      run.copyProgress = Math.min(1, run.copyProgress + dt / (pk.def.hold || STEALTH.copy.hold));
      if (run.copyProgress >= 1) {
        run.has.copy = true;
        pk.taken = true;
        run.events.emit('copyDone');
      }
    }
  }

  /** After the AI: the alert level, the alarm (once) and its consequence. */
  update(dt, time) {
    const run = this.run, ai = run.ai;
    let combat = false, wary = false;
    for (const e of run.enemies) {
      if (!e.alive) continue;
      if (e.ai.mode === 'combat') { combat = true; this._startRadio(e, time); }
      else if (e.ai.suspicion > 0.05 || e.ai.investigate || e.ai.mode === 'search') wary = true;
      // D88: his radio call is through — the alarm (a guard downed before that never makes it)
      if (Number.isFinite(e.ai.radioAt) && time >= e.ai.radioAt) this.raiseAlarm(time);
    }
    if (!this.alarmRaised) this._radio(time); // D87
    const lvl = this.alarmRaised ? ALERT.ALARM : combat || ai.searching(time) ? ALERT.SEARCH : wary ? ALERT.SUSPICION : ALERT.CALM;
    if (lvl !== this.level) { this.level = lvl; run.events.emit('alertLevel', lvl); }
    this.maxLevel = Math.max(this.maxLevel, lvl);
    if (time >= this.failAt) run._setDefeat('detected');
  }

  /** The alarm — once: 'fail' ends the job a moment later, 'combat' brings the reinforcements and wakes everyone. */
  raiseAlarm(time) {
    if (this.alarmRaised) return false;
    const run = this.run;
    this.alarmRaised = true;
    run.stats.alarm = true;
    run.events.emit('alarm');
    if (STEALTH.onAlarm === 'fail') this.failAt = time + STEALTH.failDelay;
    else {
      run.callReinforcements();
      for (const e of run.enemies) if (e.alive && Math.hypot(e.x - run.player.x, e.y - run.player.y) < 900) run.ai.alert(e, run.player.x, run.player.y, time);
    }
    return true;
  }

  /** The nearest enemy the hero can take down now: alive, not fighting, the hero in his rear arc within reach. */
  _findTakedown() {
    const run = this.run, p = run.player, T = STEALTH.takedown;
    if (p.dodging || p.cover) return null;
    const minAng = Math.PI - ((T.rearArcDeg / 2) * Math.PI) / 180;
    let best = null, bestD = T.reach;
    for (const e of run.enemies) {
      if (!e.alive || e.ai.mode === 'combat' || e.ai.mode === 'grabbed') continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      if (d > bestD) continue;
      if (Math.abs(angDiff(Math.atan2(dy, dx), e.faceAngle)) < minAng) continue; // not behind him
      best = e; bestD = d;
    }
    return best;
  }

  _startTakedown(e, time) {
    const p = this.run.player;
    // D88: the victim is held where he stood (ex, ey) — before, the body push moved him on and the hero followed
    p.takedown = { e, t0: time, killed: false, fromX: p.x, fromY: p.y, face: e.faceAngle, ex: e.x, ey: e.y };
    p.stance = 'stand';
    p.cover = null;
    e.ai.mode = 'grabbed';
    e.ai.sees = false;
    e.lastHitAt = time; // presentation: the victim flinches
    this.takedownTarget = null;
    this.run.events.emit('takedownStart', e);
  }

  /** The takedown's timeline: the hero steps in behind the victim, the kill, the release. */
  _takedownStep(time) {
    const run = this.run, p = run.player, td = p.takedown, T = STEALTH.takedown, e = td.e;
    const k = time - td.t0;
    // hurt before the kill: the victim breaks free
    if (!td.killed && p.lastHitAt > td.t0) {
      if (e.alive) { e.ai.mode = 'combat'; e.ai.suspicion = 1; e.ai.reactAt = time; }
      p.takedown = null;
      return;
    }
    const s = Math.min(1, k / T.snap);
    e.x = td.ex; e.y = td.ey; e.vx = 0; e.vy = 0; e.faceAngle = td.face;
    const bx = td.ex - Math.cos(td.face) * T.behind, by = td.ey - Math.sin(td.face) * T.behind;
    p.x = td.fromX + (bx - td.fromX) * s;
    p.y = td.fromY + (by - td.fromY) * s;
    p.vx = 0; p.vy = 0;
    // D93 (user sounds): the blows of the clip — the kick, then the hand (clip times measured on the skeleton)
    const ct = T.clipFrom + (T.clipTo - T.clipFrom) * Math.min(1, k / T.duration);
    if (!td.kicked && ct >= T.kickAt) { td.kicked = true; run.events.emit('takedownBlow', 'kick', e); }
    if (!td.punched && ct >= T.punchAt) { td.punched = true; run.events.emit('takedownBlow', 'punch', e); }
    if (!td.killed && k >= T.killAt) {
      td.killed = true;
      e.killedBy = 'takedown';
      if (e.applyDamage(e.hp + 1, time)) run.events.emit('kill', e, time);
      run.stats.takedowns += 1;
      run.noise(e.x, e.y, STEALTH.noise.takedown, 'quiet');
      run.events.emit('takedown', e);
    }
    if (k >= T.duration) p.takedown = null;
  }

  /** The result's medals: Ghost (never reached SEARCH), No kills, Fast. */
  medals() {
    const s = this.run.stats;
    return { ghost: this.maxLevel < ALERT.SEARCH, noKills: s.kills === 0, fast: s.time <= STEALTH.medals.parTime };
  }
}
