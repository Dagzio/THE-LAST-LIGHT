// Pause of sound by reasons + sound return on iPhone (vanilla.md §6, transferred without deviations).
// Also reports page suspension to the game so it opens a real pause (H5 §5, vanilla.md §7).
import { IOS } from './audioCommon.js';
import { Sfx } from './Sfx.js';
import { Music } from './Music.js';
import { AC } from './AudioUnlock.js';

let initialized = false;

/** Volume-only silence reasons ('orientation', 'exitPopup'): never suspend the music context (rule 3). */
export const duck = (reason) => Music.pause(reason);
export const unduck = (reason) => Music.resume(reason);

/**
 * @param {{onSuspend?: () => void}} hooks onSuspend — page hidden or lost focus (open the game pause).
 */
export function initAudioLifecycle({ onSuspend } = {}) {
  if (initialized) return;
  initialized = true;

  // iPhone: after returning from background the contexts may be dead for good →
  // the first real tap rebuilds both (rule 1). window capture: runs before any tap sound.
  const Rebuild = (() => {
    let need = false;
    ['touchend', 'click', 'keydown'].forEach((e) => window.addEventListener(e, () => {
      if (need && !document.hidden) { need = false; Sfx.reset(); Music.reset(); AC.unlock(); }
    }, true));
    return {
      away() { if (IOS && Sfx.alive()) need = true; }, // iPhone: after EVERY backgrounding
      check() { // Android/PC: only a "dead" context
        const c = Sfx.alive();
        if (!c || need) return;
        const t0 = c.currentTime;
        setTimeout(() => {
          if (!document.hidden && c === Sfx.alive() && (c.state !== 'running' || c.currentTime - t0 < 0.05)) need = true;
        }, 400);
      },
    };
  })();

  const R = new Set();
  // On EVERY event — pause/resume → sync, even if the reason is already in that state (rule 5).
  function set(r, v) {
    if (v) { R.add(r); Music.pause(r); } else { R.delete(r); Music.resume(r); }
    Sfx.setMuted('focus', R.size > 0);
    if (v && onSuspend) onSuspend(r);
  }
  document.addEventListener('visibilitychange', () => { set('hidden', document.hidden); if (document.hidden) Rebuild.away(); });
  window.addEventListener('blur', () => set('blur', true));
  window.addEventListener('focus', () => { set('blur', false); set('hidden', document.hidden); Rebuild.check(); }); // resume here (rule 4)
  window.addEventListener('pageshow', () => set('hidden', document.hidden));
  // Safety net: a tap means the page is visible and focused — drop stuck reasons (rule 10).
  document.addEventListener('pointerdown', () => {
    if (R.has('blur')) set('blur', false);
    if (R.has('hidden') && !document.hidden) set('hidden', false);
  }, true);
  if (document.hidden) set('hidden', true);
}
