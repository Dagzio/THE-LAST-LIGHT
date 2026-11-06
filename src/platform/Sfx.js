// SFX context (vanilla.md §5): never suspended; muted by flags while hidden/blurred/rotated.
// Every play() wakes its own context (rule 9); buffers are reused across rebuilds (rule 1).
import { newCtx, closeCtx } from './audioCommon.js';
import { buildSfxBuffer } from './SfxLibrary.js';
import { Prefs } from './Prefs.js';

export const Sfx = (() => {
  let ac = null;
  let on = Prefs.getSoundOn();
  const muted = new Set(); // reasons: 'focus', 'orientation'
  const bufs = {};

  const ctx = () => (ac ??= newCtx());
  const wake = () => {
    const a = ctx();
    if (a && a.state !== 'running') a.resume().catch(() => {}); // from 'suspended' and 'interrupted'
  };

  return {
    ctx,
    wake,
    alive: () => ac,
    /** @param {number} [rate] playbackRate (pitch variation for repeated sounds, GDD §18) */
    play(name, rate = 1) {
      const a = ctx();
      if (!on || muted.size > 0 || !a) return;
      const buf = bufs[name] ?? (bufs[name] = buildSfxBuffer(name, a));
      if (!buf) return;
      wake();
      try {
        const s = a.createBufferSource(); // a new node per sound
        s.buffer = buf;
        if (rate !== 1) s.playbackRate.value = rate;
        s.connect(a.destination);
        s.start();
      } catch (e) { /* SFX never throws */ }
    },
    /** Rebuild: close the context; buffers stay (AudioBuffer plays in any context). */
    reset() { closeCtx(ac); ac = null; },
    setMuted(reason, value) { if (value) muted.add(reason); else muted.delete(reason); },
    set(value) { on = !!value; Prefs.setSoundOn(on); },
    get on() { return on; },
  };
})();
