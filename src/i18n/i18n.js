// i18n runtime (H5 §8): first launch — navigator.language (fallback EN), then the saved choice.
import { LANGS, LOCALES } from './locales.js';
import { Prefs } from '../platform/Prefs.js';

const dynamicHooks = new Set();

function detectLang() {
  const saved = Prefs.getLang();
  if (saved && LOCALES[saved]) return saved;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  const lang = LOCALES[nav] ? nav : 'en';
  Prefs.setLang(lang); // H5: store the detected language right away
  return lang;
}

let currentLang = detectLang();

export const getLang = () => currentLang;

/** Translate `key`, substituting `{name}` params. Fallback: lang → en → key (+ warning). Never undefined. */
export function T(key, params) {
  let v = LOCALES[currentLang]?.[key] ?? LOCALES.en[key];
  if (v === undefined) {
    console.warn('i18n missing', key);
    return key;
  }
  if (params) v = v.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
  return v;
}

/** Re-translate static markup and run dynamic hooks (JS-built text). */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const label = T(el.dataset.i18nAria);
    el.setAttribute('aria-label', label);
    el.title = label;
  });
  document.documentElement.lang = currentLang;
  document.documentElement.dataset.lang = currentLang; // [data-lang="ar"|"ja"] CSS; layout is never mirrored
  for (const fn of dynamicHooks) fn();
}

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  Prefs.setLang(lang);
  applyTranslations();
}

/** Register a function that rebuilds JS-generated text on language change. */
export function onLanguageChange(fn) {
  dynamicHooks.add(fn);
  return () => dynamicHooks.delete(fn);
}
