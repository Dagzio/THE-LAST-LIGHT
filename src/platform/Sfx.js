// SFX context (vanilla.md §5): never suspended; muted by flags while hidden/blurred/rotated.
// Every play() wakes its own context (rule 9); buffers are reused across rebuilds (rule 1).
// Sounds are synthesized (SfxLibrary) unless a recorded file of the same name is loaded (data/sounds.js) — files are
// decoded once in an OfflineAudioContext, so the AudioBuffers are context-free and survive the iPhone rebuild too.
import { newCtx, closeCtx } from './audioCommon.js';
import { buildSfxBuffer, SFX_NAMES } from './SfxLibrary.js';
import { Prefs } from './Prefs.js';

const decode = (c, data) => new Promise((resolve, reject) => {
  const p = c.decodeAudioData(data, resolve, reject); // callback form for old Safari, promise form elsewhere
  if (p && typeof p.then === 'function') p.then(resolve, reject);
});

export const Sfx = (() => {
  let ac = null;
  let on = Prefs.getSoundOn();
  const muted = new Set(); // reasons: 'focus', 'orientation'
  const bufs = {};
  const files = {};        // name → {trim, gain} of a loaded recorded file
  const voices = {};       // name → playing [{s, g}] (only for sounds with a voice limit)

  const ctx = () => (ac ??= newCtx());
  const wake = () => {
    const a = ctx();
    if (a && a.state !== 'running') a.resume().catch(() => {}); // from 'suspended' and 'interrupted'
  };

  // Voice limit: the oldest copy fades out in ~10 ms (no click) so rapid fire stays crisp instead of a wash.
  function limit(a, name, s, g, max) {
    const list = (voices[name] ??= []);
    const v = { s, g };
    list.push(v);
    s.onended = () => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); };
    while (list.length > max) {
      const old = list.shift();
      try {
        old.g.gain.setTargetAtTime(0, a.currentTime, 0.008);
        old.s.stop(a.currentTime + 0.05);
      } catch (e) { /* already stopped */ }
    }
  }

  return {
    ctx,
    wake,
    alive: () => ac,
    /** True if `name` can sound (a loaded file or a synth recipe). */
    has: (name) => !!files[name] || SFX_NAMES.includes(name),
    /**
     * @param {number} [rate] playbackRate (pitch variation for repeated sounds, GDD §18)
     * @param {{gain?:number, offset?:number, voices?:number}} [opts] gain × the file's own gain; offset — seconds
     *   into the sound (after the file's trimmed silence); voices — max copies of this sound at once
     */
    play(name, rate = 1, opts = null) {
      const a = ctx();
      if (!on || muted.size > 0 || !a) return;
      const buf = bufs[name] ?? (bufs[name] = buildSfxBuffer(name, a));
      if (!buf) return;
      const f = files[name];
      const offset = (f ? f.trim : 0) + (opts && opts.offset > 0 ? opts.offset : 0);
      if (offset >= buf.duration) return;
      const gain = (f ? f.gain : 1) * (opts && opts.gain != null ? opts.gain : 1);
      const max = opts && opts.voices > 0 ? opts.voices : 0;
      wake();
      try {
        const s = a.createBufferSource(); // a new node per sound
        s.buffer = buf;
        if (rate !== 1) s.playbackRate.value = rate;
        if (gain !== 1 || max) {
          const g = a.createGain();
          g.gain.value = gain;
          s.connect(g);
          g.connect(a.destination);
          if (max) limit(a, name, s, g, max);
        } else s.connect(a.destination);
        s.start(0, offset);
      } catch (e) { /* SFX never throws */ }
    },
    /**
     * Loads recorded files (data/sounds.js → SFX_FILES). Until a file is decoded (or if it fails) the synthesized
     * sound of the same name — if any — keeps playing, so a missing file never silences the game.
     */
    async loadFiles(map, dir) {
      const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      let dec = null;
      try { dec = C ? new C(2, 1, 44100) : null; } catch (e) { dec = null; }
      await Promise.all(Object.entries(map).map(async ([name, f]) => {
        try {
          const r = await fetch(dir + f.file);
          if (!r.ok) return;
          const c = dec || ctx();
          if (!c) return;
          const buf = await decode(c, await r.arrayBuffer());
          bufs[name] = buf;
          files[name] = { trim: Math.max(0, f.trim || 0), gain: f.gain > 0 ? f.gain : 1 };
        } catch (e) { /* keep the synth fallback */ }
      }));
    },
    /** Rebuild: close the context; buffers stay (AudioBuffer plays in any context). */
    reset() { closeCtx(ac); ac = null; for (const k in voices) voices[k].length = 0; },
    setMuted(reason, value) { if (value) muted.add(reason); else muted.delete(reason); },
    set(value) { on = !!value; Prefs.setSoundOn(on); },
    get on() { return on; },
  };
})();
