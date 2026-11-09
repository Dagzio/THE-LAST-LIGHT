// Weapon sounds (user request 2026-11-09): every weapon sound follows what the keeper actually does.
// - Shot: on the 'shot' event (the frame the round leaves), small random pitch/volume spread, voice limit.
// - Reload: cues are laid on the REAL reload of this weapon (base × upgrades × perks) and fired by the SIMULATION clock
//   after each step, so they freeze with pause / shop / tutorial / hidden tab, never run ahead of the reload ring and
//   the last cue lands exactly when the magazine is full. A cue that falls between two steps starts that much into
//   its file, so the timing stays exact at any frame rate. A cancelled reload (new run, re-equip) drops its cues.
// Presentation only: reads the weapon state, never changes it. Math.random is cosmetic here (not gameplay).
import { Sfx } from './Sfx.js';
import { weaponSounds, DEFAULT_WEAPON_SOUNDS } from '../data/sounds.js';

const spread = (k) => (k > 0 ? (Math.random() * 2 - 1) * k : 0);

export class WeaponAudio {
  /** @param {import('../core/GameEvents.js').GameEvents} events */
  constructor(events) {
    this.cur = null; // reload being voiced: {w, start, rate, cues:[{sfx, startAt, offset}], next}
    events.on('shot', (x, y, angle, weaponId) => this.shot(weaponId));
  }

  /** Sounds of a weapon; a set whose file is missing falls back to the synthesized one (never silent). */
  sounds(weaponId) {
    const s = weaponSounds(weaponId);
    return {
      shot: Sfx.has(s.shot.sfx) ? s.shot : DEFAULT_WEAPON_SOUNDS.shot,
      reload: s.reload.cues.every((c) => Sfx.has(c.sfx)) ? s.reload : DEFAULT_WEAPON_SOUNDS.reload,
    };
  }

  shot(weaponId) {
    const s = this.sounds(weaponId).shot;
    // Only ever quieter than the file level (no clipping on overlaps); pitch both ways.
    Sfx.play(s.sfx, (s.rate || 1) * (1 + spread(s.pitch)), { gain: 1 - Math.random() * (s.vol || 0), voices: s.voices });
  }

  /** Reload plan: where each cue starts on this reload's timeline (s from its start) and from where in its file. */
  plan(w) {
    const duration = Math.max(0, w.reloadEndsAt - w.reloadStartedAt);
    const r = this.sounds(w.weaponId).reload;
    const rate = r.refDuration > 0 && duration > 0 ? Math.min(r.maxRate || 1, Math.max(1, r.refDuration / duration)) : 1;
    const cues = r.cues.map((q) => {
      const startAt = q.at * duration - q.hit / rate; // the key click lands at `at` of the reload
      return startAt >= 0 ? { sfx: q.sfx, startAt, offset: 0 } : { sfx: q.sfx, startAt: 0, offset: -startAt * rate };
    }).sort((a, b) => a.startAt - b.startAt);
    return { w, start: w.reloadStartedAt, rate, cues, next: 0 };
  }

  /** Called after every simulation step (Game.update). */
  update(run, time) {
    const w = run ? run.weapon : null;
    if (w && w.reloading && (!this.cur || this.cur.w !== w || this.cur.start !== w.reloadStartedAt)) this.cur = this.plan(w);
    const c = this.cur;
    if (!c) return;
    if (c.w !== w || c.start !== w.reloadStartedAt) { this.cur = null; return; } // another run / another reload
    const t = time - c.start;
    while (c.next < c.cues.length && c.cues[c.next].startAt <= t) {
      const q = c.cues[c.next++];
      Sfx.play(q.sfx, c.rate, { offset: q.offset + (t - q.startAt) * c.rate });
    }
    // Kept until the reload is over (all cues done or not): dropping it earlier would plan the same reload again.
    if (!w.reloading) this.cur = null; // the end step has just fired the last cues
  }
}
