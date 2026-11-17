// User settings persisted in localStorage with explicit keys (H5 §7, §8, §9):
// sound, music and language are read at startup before the first sound / first text.
// Every access is wrapped: an empty, blocked or corrupted storage falls back to defaults (sound & music ON).

const asBool = (v) => (v === null ? true : v === '1');

export const Prefs = {
  getSoundOn() {
    try { return asBool(localStorage.getItem('kl.soundOn')); } catch (e) { return true; }
  },
  setSoundOn(on) {
    try { localStorage.setItem('kl.soundOn', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  },
  getMusicOn() {
    try { return asBool(localStorage.getItem('kl.musicOn')); } catch (e) { return true; }
  },
  setMusicOn(on) {
    try { localStorage.setItem('kl.musicOn', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  },
  getLang() {
    try { return localStorage.getItem('kl.lang'); } catch (e) { return null; }
  },
  setLang(lang) {
    try { localStorage.setItem('kl.lang', lang); } catch (e) { /* storage unavailable */ }
  },
  // D85: the last chosen game mode on the level select (mission / stealth / survival)
  getMode() {
    try { return localStorage.getItem('kl.mode'); } catch (e) { return null; }
  },
  setMode(mode) {
    try { localStorage.setItem('kl.mode', mode); } catch (e) { /* storage unavailable */ }
  },
  getQuality() {
    try { return localStorage.getItem('kl.quality'); } catch (e) { return null; }
  },
  setQuality(quality) {
    try { localStorage.setItem('kl.quality', quality); } catch (e) { /* storage unavailable */ }
  },
};
