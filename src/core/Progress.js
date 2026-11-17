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
    const p = this.profile, id = run.mapId, mode = run.modeId || 'mission';
    p.statistics.totalKills += run.stats.kills | 0;
    const t = Math.round(run.stats.time * 10) / 10;
    // D85: survival never completes / unlocks / fails a level — it keeps its best time and kills
    if (mode === 'survival') {
      const b = (p.modeBests[id] = p.modeBests[id] || {}).survival;
      const newRecord = !b || t > b.time || (run.stats.kills | 0) > b.kills;
      p.modeBests[id].survival = { time: Math.max(t, b ? b.time : 0), kills: Math.max(run.stats.kills | 0, b ? b.kills : 0) };
      this.lastResult = { run, newRecord };
      this._commit();
      return true;
    }
    if (mode === 'stealth' && run.victory) {
      const b = (p.modeBests[id] = p.modeBests[id] || {}).stealth;
      const md = run.mode && run.mode.medals ? run.mode.medals() : {};
      const medals = (md.ghost ? 1 : 0) + (md.noKills ? 1 : 0) + (md.fast ? 1 : 0);
      const newRecord = !b || t < b.time || medals > b.medals;
      p.modeBests[id].stealth = { time: b ? Math.min(b.time, t) : t, medals: Math.max(medals, b ? b.medals : 0), intel: Math.max(run.intel | 0, b ? b.intel : 0) };
      this.lastResult = { run, newRecord };
    } else this.lastResult = { run, newRecord: false };
    if (run.victory) {
      p.statistics.levelsWon += 1;
      if (!p.completedLevels.includes(id)) p.completedLevels.push(id);
      if (mode === 'mission' && (!(p.bestTimes[id] > 0) || t < p.bestTimes[id])) { p.bestTimes[id] = t; this.lastResult.newRecord = true; }
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
