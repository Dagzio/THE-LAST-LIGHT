// Entry point: shows the splash at once (H5 §1), preloads the game behind a real progress bar (H5 3D guide §7),
// then starts it. TAP TO PLAY replaces the bar only when everything is loaded; taps before that are ignored.
import { installBrowserHygiene } from './platform/BrowserHygiene.js';
import { applyTranslations } from './i18n/i18n.js';
import { startPreload, onProgress, loaded, gameStarted, gameReady } from './loader.js';

installBrowserHygiene();
applyTranslations();

const splash = document.getElementById('screen-splash');
const bar = document.getElementById('loadBar');
const fill = document.getElementById('loadFill');
const pct = document.getElementById('loadPct');
requestAnimationFrame(() => splash.querySelectorAll('.fade').forEach((n) => n.classList.add('show')));
const shownAt = performance.now();

onProgress((p) => {
  const n = Math.floor(p * 100);
  fill.style.width = `${(p * 100).toFixed(1)}%`;
  pct.textContent = `${n}%`;
  bar.setAttribute('aria-valuenow', String(n));
});

startPreload()
  .then(() => import('./main.js'))
  .then((m) => { gameStarted(); m.startGame({ loaded, shownAt }); gameReady(); })
  .catch((e) => console.error('Game failed to start', e));
