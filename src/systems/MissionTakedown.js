// D118 (user: in the manager's office a guard searches a cabinet — the player can sneak up behind him and kill him
// silently): the story mission's silent takedown — the stealth run's takedown (StealthDirector: reach, rear arc, the
// clip's timeline, the kill) without the stealth rules (no stance, no light, no alarm, no witnesses). Only a guard who
// knows nothing of the hero (not fighting, not alerted, not searching) can be taken. Pure simulation, game clock only.
import { StealthDirector } from './StealthDirector.js';
import { MissionTasks } from './MissionTasks.js';
import { STEALTH } from '../data/stealth.js';
import { PLAYER } from '../data/player.js';

/** D149: the speeds while sneaking (the controller's profile: only the crouch pace differs). */
const SNEAK_SPEEDS = { walk: PLAYER.moveSpeed, run: PLAYER.moveSpeed, crouch: STEALTH.missionSneak.speed };

export class MissionTakedown {
  /** @param {import('../core/MissionRun.js').MissionRun} run */
  constructor(run) {
    this.run = run;
    this.takedownTarget = null;
    this.alarmRaised = true; // (StealthDirector's witness check: off — no alarm in the mission)
    this.witnessAt = Infinity;
    run.stats.takedowns = 0;
    // D141: a story level's sub-tasks (search, hold) and its restart points — when its objectives have types
    this.tasks = run.level.objectives.some((o) => o.type) ? new MissionTasks(run) : null;
  }

  get searching() { return this.tasks ? this.tasks.searching : null; }
  get searchNote() { return this.tasks ? this.tasks.searchNote : null; }
  objectiveProgress() { return this.tasks ? this.tasks.objectiveProgress() : null; }
  objectiveTextKey() { return this.tasks ? this.tasks.objectiveTextKey() : null; }
  holdLabel() { return this.tasks ? this.tasks.holdLabel() : null; }
  /** D143: the sub-task's marker (undefined — the run's own rules). */
  taskTarget(out) { return this.tasks ? this.tasks.objectiveTarget(out) : undefined; }
  applyCheckpoint(cp) { if (this.tasks) this.tasks.applyCheckpoint(cp); }
  get alarmOn() { return !!this.tasks && this.tasks.alarmOn; }        // D146
  alarmPanels() { return this.tasks ? this.tasks.alarmPanels() : null; }
  dispose() { if (this.tasks) this.tasks.dispose(); }

  /** Before the hero moves: a takedown in progress goes on; F / E (touch) starts one on an unaware guard from behind. */
  preUpdate(input, dt, time) {
    const run = this.run, p = run.player;
    if (this.tasks) this.tasks.preUpdate(input, dt, time);
    // D149 (user): C / the touch button — sneaking on and off (slower, low, unheard: systems/HumanAISystem.js _sees)
    if (input.consumePressed('crouch') && p.alive && !p.takedown) p.sneak = !p.sneak;
    const sneaking = !!p.sneak && p.alive && !p.dodging && !p.cover && !p.takedown;
    p.stance = sneaking ? 'crouch' : 'stand';
    p.moveMode = sneaking ? 'crouch' : 'walk';
    run.controller.speedProfile = sneaking ? SNEAK_SPEEDS : null;
    if (!p.alive) { this.takedownTarget = null; return; }
    if (p.takedown) {
      this._takedownStep(time);
      input.consumePressed('takedown');
      return;
    }
    const e = this._findTakedown();
    // D148: the man to be taken alive can be caught from behind running too (the hero is faster)
    const runner = e && e.capture && e.ai.mode === 'flee';
    this.takedownTarget = e && !e.captured && (runner || (!e.ai.aware && e.ai.mode !== 'search' && !e.ai.investigate && !(e.ai.suspicion > 0.3))) ? e : null;
    if (this.takedownTarget) {
      const viaE = !run.interactTarget && input.consumePressed('interact'); // (touch: the context button; as in stealth)
      if (input.consumePressed('takedown') || viaE) this._startTakedown(this.takedownTarget, time);
    } else input.consumePressed('takedown');
  }

  update(dt, time) { if (this.tasks) this.tasks.update(dt, time); }

  /** D148: the searchlights of the level (the renderer draws them), or null. */
  get searchlights() { return this.tasks && this.tasks.lights ? this.tasks.lights.list : null; }

  /**
   * The takedown's timeline (the stealth run's). D148: the man to be taken alive — the blow lands, he goes down on his
   * knees alive (no kill, no noise); the rest of the clip plays as usual.
   */
  _takedownStep(time) {
    const td = this.run.player.takedown, e = td && td.e;
    if (e && e.capture && !td.killed && !(this.run.player.lastHitAt > td.t0) && time - td.t0 >= STEALTH.takedown.killAt) {
      td.killed = true; // (the timeline's "kill" moment — he is only knocked down)
      if (this.tasks) this.tasks.capture(e); else { e.captured = true; e.ai.mode = 'grabbed'; }
      this.run.stats.takedowns += 1;
    }
    StealthDirector.prototype._takedownStep.call(this, time);
    if (e && e.captured) { e.ai.mode = 'grabbed'; e.crouch = true; } // (the end of the clip leaves him kneeling, held)
  }
}

// the takedown itself — the stealth run's (one rule set, one clip timeline)
MissionTakedown.prototype._findTakedown = StealthDirector.prototype._findTakedown;
MissionTakedown.prototype._startTakedown = StealthDirector.prototype._startTakedown;
