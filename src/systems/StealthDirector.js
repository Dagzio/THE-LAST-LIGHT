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
  }

  /** On touch the gun never fires by itself in stealth (it would give the hero away); after the alarm it may. */
  get autoFireAllowed() { return this.alarmRaised; }

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
      this._takedownStep(time);
      input.consumePressed('crouch'); input.consumePressed('takedown'); input.consumePressed('interact');
      return;
    }
    if (input.consumePressed('crouch')) p.stance = p.stance === 'crouch' ? 'stand' : 'crouch';
    if (p.dodging) p.stance = 'stand';
    input.getMove(M);
    const tilt = Math.hypot(M.x, M.y);
    const running = input.isDown('run') || (input.analogActive() && tilt >= 0.95);
    if (running && p.stance === 'crouch' && input.isDown('run')) p.stance = 'stand'; // Shift stands him up
    p.moveMode = p.stance === 'crouch' || p.crouched ? 'crouch' : running && tilt > 0.1 ? 'run' : 'walk';
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
      if (e.ai.mode === 'combat') combat = true;
      else if (e.ai.suspicion > 0.05 || e.ai.investigate || e.ai.mode === 'search') wary = true;
    }
    if (combat) this.raiseAlarm(time);
    const lvl = this.alarmRaised ? ALERT.ALARM : ai.searching(time) ? ALERT.SEARCH : wary ? ALERT.SUSPICION : ALERT.CALM;
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
    p.takedown = { e, t0: time, killed: false, fromX: p.x, fromY: p.y, face: e.faceAngle };
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
    const bx = e.x - Math.cos(td.face) * T.behind, by = e.y - Math.sin(td.face) * T.behind;
    p.x = td.fromX + (bx - td.fromX) * s;
    p.y = td.fromY + (by - td.fromY) * s;
    p.vx = 0; p.vy = 0;
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
