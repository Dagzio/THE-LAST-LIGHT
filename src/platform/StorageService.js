// The only module that touches localStorage. Every key gets the game prefix (H5 §9).
// Robust to a missing/blocked/corrupted storage: reads fall back to defaults, writes fail silently.
import { STORAGE_PREFIX } from '../config/constants.js';

/** Settings survive a progress reset (H5 §10). Everything else with the prefix is game progress. */
export const SETTINGS_KEYS = ['soundOn', 'musicOn', 'lang', 'quality'];

const full = (key) => STORAGE_PREFIX + key;

export const Storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(full(key));
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(full(key), String(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  getBool(key, fallback) {
    const v = this.get(key, null);
    return v === null ? fallback : v === '1';
  },

  setBool(key, value) {
    return this.set(key, value ? '1' : '0');
  },

  getJSON(key, fallback) {
    const v = this.get(key, null);
    if (v === null) return fallback;
    try { return JSON.parse(v); } catch (e) { return fallback; }
  },

  setJSON(key, value) {
    try { return this.set(key, JSON.stringify(value)); } catch (e) { return false; }
  },

  remove(key) {
    try { localStorage.removeItem(full(key)); } catch (e) { /* storage unavailable */ }
  },

  /** Removes every game key except settings (sound, music, language, quality). */
  clearProgress() {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX) && !SETTINGS_KEYS.includes(k.slice(STORAGE_PREFIX.length))) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* storage unavailable */ }
  },
};
