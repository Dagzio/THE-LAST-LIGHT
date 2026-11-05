// Music context (vanilla.md §5, transferred without deviations): own AudioContext, shuffled playlist,
// suspend() only for 'hidden'/'blur', every other silence ('orientation', popups) = gain 0,
// rebuild continues from the same position. Starts once on entering the main menu.
import { newCtx, closeCtx, loadBuf } from './audioCommon.js';
import { Prefs } from './Prefs.js';
import { AC } from './AudioUnlock.js';

export const Music = (() => {
  let ac = null, gain = null, list = [], i = 0, started = false, on = Prefs.getMusicOn();
  let src = null, cur = null, pend = null, busy = false, retry = false;
  const cache = {};
  const LIFE = ['hidden', 'blur'];
  const Life = new Set(); // page hidden / unfocused → suspend() (only these two reasons!)
  const Hush = new Set(); // 'orientation', 'exitPopup' … → volume 0, context keeps running

  const ctx = () => {
    if (!ac && (ac = newCtx())) { gain = ac.createGain(); gain.connect(ac.destination); }
    return ac;
  };
  const shuffle = (a) => {
    for (let j = a.length - 1; j > 0; j--) { const k = (Math.random() * (j + 1)) | 0; [a[j], a[k]] = [a[k], a[j]]; }
    return a;
  };

  function play(buf, off) {
    const s = ac.createBufferSource();
    s.buffer = buf;
    s.connect(gain);
    s.onended = () => { if (src === s) { src = null; cur = null; next(); } }; // next track (no loop)
    s.start(0, off);
    src = s;
    cur = { buf, at: ac.currentTime, off };
  }
  const place = () => (cur ? cur.off + ac.currentTime - cur.at : 0);

  async function next() {
    const a = ctx();
    if (!a || busy || list.length === 0) return; // no tracks yet (D10) — nothing to fetch
    busy = true;
    if (i >= list.length) { shuffle(list); i = 0; }
    const url = list[i];
    const buf = cache[url] ?? (cache[url] = await loadBuf(a, url));
    busy = false;
    i++;
    if (!buf || src || a !== ac) return;
    play(buf, 0);
  }

  function level() {
    const t = ac.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(Hush.size ? 0 : 1, t, 0.05);
  }

  // resume() outside a gesture may fail on iOS → retry on taps until the context runs (rule 8).
  const TAPS = ['pointerdown', 'pointerup', 'touchend', 'click'];
  function disarm() { retry = false; TAPS.forEach((e) => document.removeEventListener(e, onTap, true)); }
  function onTap() { AC.unlock(); if (ac && ac.state === 'running') disarm(); }
  function armRetry() { if (retry) return; retry = true; TAPS.forEach((e) => document.addEventListener(e, onTap, true)); }

  // Single decision point; called on EVERY event, without deduplication (rule 5).
  function sync() {
    if (!started) return;
    const a = ctx();
    if (!a) return;
    level();
    if (on && Life.size === 0) {
      if (a.state === 'suspended' || a.state === 'interrupted') { a.resume().catch(() => {}); armRetry(); }
      if (!src) { if (pend) { play(pend.buf, pend.off % pend.buf.duration); pend = null; } else next(); }
    } else if (a.state === 'running') a.suspend().catch(() => {}); // track position is kept
  }

  return {
    ctx,
    sync,
    init(tracks) { list = shuffle(tracks.slice()); i = 0; },
    start() { started = true; sync(); }, // first time — start, then a cheap sync
    pause(r) { (LIFE.includes(r) ? Life : Hush).add(r); sync(); },
    resume(r) { Life.delete(r); Hush.delete(r); sync(); },
    // Rebuild (only from a tap): remember track + position, close the context; sync() makes a new one.
    reset() {
      if (cur) pend = { buf: cur.buf, off: place() };
      if (src) { src.onended = null; try { src.stop(); } catch (e) { /* stopped */ } src = null; }
      cur = null;
      closeCtx(ac); ac = null; gain = null;
      disarm();
    },
    set(v) { on = !!v; Prefs.setMusicOn(on); sync(); },
    get on() { return on; },
    get started() { return started; },
  };
})();
