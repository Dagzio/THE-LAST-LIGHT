// User settings persisted in localStorage with explicit keys (H5 §7, §8, §9):
// sound, music and language are read at startup before the first sound / first text.
// Every access is wrapped: an empty, blocked or corrupted storage falls back to defaults (sound & music ON).

const asBool = (v) => (v === null ? true : v === '1');

export const Prefs = {
  getSoundOn() {
    try { return asBool(localStorage.getItem('tll.soundOn')); } catch (e) { return true; }
  },
  setSoundOn(on) {
    try { localStorage.setItem('tll.soundOn', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  },
  getMusicOn() {
    try { return asBool(localStorage.getItem('tll.musicOn')); } catch (e) { return true; }
  },
  setMusicOn(on) {
    try { localStorage.setItem('tll.musicOn', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  },
  getLang() {
    try { return localStorage.getItem('tll.lang'); } catch (e) { return null; }
  },
  setLang(lang) {
    try { localStorage.setItem('tll.lang', lang); } catch (e) { /* storage unavailable */ }
  },
  getQuality() {
    try { return localStorage.getItem('tll.quality'); } catch (e) { return null; }
  },
  setQuality(quality) {
    try { localStorage.setItem('tll.quality', quality); } catch (e) { /* storage unavailable */ }
  },
};
