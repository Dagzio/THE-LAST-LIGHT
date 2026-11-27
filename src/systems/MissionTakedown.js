// D118 (user: in the manager's office a guard searches a cabinet — the player can sneak up behind him and kill him
// silently): the story mission's silent takedown — the stealth run's takedown (StealthDirector: reach, rear arc, the
// clip's timeline, the kill) without the stealth rules (no stance, no light, no alarm, no witnesses). Only a guard who
// knows nothing of the hero (not fighting, not alerted, not searching) can be taken. Pure simulation, game clock only.
import { StealthDirector } from './StealthDirector.js';
import { MissionTasks } from './MissionTasks.js';

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
  applyCheckpoint(cp) { if (this.tasks) this.tasks.applyCheckpoint(cp); }

  /** Before the hero moves: a takedown in progress goes on; F / E (touch) starts one on an unaware guard from behind. */
  preUpdate(input, dt, time) {
    const run = this.run, p = run.player;
    if (this.tasks) this.tasks.preUpdate(input, dt, time);
    if (!p.alive) { this.takedownTarget = null; return; }
    if (p.takedown) {
      this._takedownStep(time);
      input.consumePressed('takedown');
      return;
    }
    const e = this._findTakedown();
    this.takedownTarget = e && !e.ai.aware && e.ai.mode !== 'search' && !e.ai.investigate && !(e.ai.suspicion > 0.3) ? e : null;
    if (this.takedownTarget) {
      const viaE = !run.interactTarget && input.consumePressed('interact'); // (touch: the context button; as in stealth)
      if (input.consumePressed('takedown') || viaE) this._startTakedown(this.takedownTarget, time);
    } else input.consumePressed('takedown');
  }

  update(dt, time) { if (this.tasks) this.tasks.update(dt, time); }
}

// the takedown itself — the stealth run's (one rule set, one clip timeline)
MissionTakedown.prototype._findTakedown = StealthDirector.prototype._findTakedown;
MissionTakedown.prototype._startTakedown = StealthDirector.prototype._startTakedown;
MissionTakedown.prototype._takedownStep = StealthDirector.prototype._takedownStep;
