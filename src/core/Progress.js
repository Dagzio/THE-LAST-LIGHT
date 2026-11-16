// KILL LIST (D78): the permanent progress — the only owner of the profile (saved after every change). A finished level
// run is recorded once (a second call for the same run object is ignored).
import { SaveManager } from './SaveManager.js';
import { nextLevelId } from '../systems/Campaign.js';
import { LEVELS } from '../data/levels/index.js';

export class Progress {
  /** @param {SaveManager} save */
  constructor(save = new SaveManager()) {
    this.save = save;
    const { profile, status } = save.loadProfile();
    this.profile = profile;
    this.loadStatus = status;
    this._recorded = new WeakSet();
  }

  _commit() { this.save.saveProfile(this.profile); }

  /** A finished level run → statistics, best time, the next level unlocked on a win. Once per run. */
  recordLevelResult(run) {
    if (!run || !run.over || this._recorded.has(run)) return false;
    this._recorded.add(run);
    const p = this.profile, id = run.mapId;
    p.statistics.totalKills += run.stats.kills | 0;
    if (run.victory) {
      p.statistics.levelsWon += 1;
      if (!p.completedLevels.includes(id)) p.completedLevels.push(id);
      const t = Math.round(run.stats.time * 10) / 10;
      if (!(p.bestTimes[id] > 0) || t < p.bestTimes[id]) p.bestTimes[id] = t;
      const next = nextLevelId(id);
      if (next && !p.unlockedLevels.includes(next)) p.unlockedLevels.push(next);
    } else p.statistics.levelsFailed += 1;
    this._commit();
    return true;
  }

  /** Test cheat (CHEATS): every level opens. @returns {number} levels newly unlocked */
  cheatUnlockAll() {
    let n = 0;
    for (const l of LEVELS) if (!this.profile.unlockedLevels.includes(l.id)) { this.profile.unlockedLevels.push(l.id); n++; }
    if (n) this._commit();
    return n;
  }
}
