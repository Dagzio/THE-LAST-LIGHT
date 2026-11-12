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
// D64: the splash art is cover-fitted (cropped differently per screen shape), so the logo column is placed at a point of
// the picture itself — between the lamp (left) and the moon, its bottom kept above the ground line.
const ART = { w: 1672, h: 941, x: 0.4, y: 0.335, ground: 0.55 };
const inner = document.getElementById('splashInner');
function placeSplash() {
  if (!splash.classList.contains('active')) return;
  const W = innerWidth, H = innerHeight, k = Math.max(W / ART.w, H / ART.h);
  const ox = (W - ART.w * k) / 2, oy = (H - ART.h * k) / 2;
  const logo = inner.querySelector('.logo');
  const lw = logo.offsetWidth, lh = logo.offsetHeight;
  const ground = oy + ART.ground * ART.h * k;
  let cy = oy + ART.y * ART.h * k;
  cy = Math.max(lh / 2 + 12, Math.min(cy, ground - 10 - lh / 2));    // never on the ground, never off the top
  const cx = Math.min(W - lw / 2 - 30, Math.max(lw / 2 + 30, ox + ART.x * ART.w * k));
  splash.style.setProperty('--splash-x', `${Math.round(cx)}px`);
  splash.style.setProperty('--splash-y', `${Math.round(cy - lh / 2)}px`);
}
placeSplash();
addEventListener('resize', placeSplash);
requestAnimationFrame(() => splash.querySelectorAll('.fade').forEach((n) => n.classList.add('show')));
const shownAt = performance.now();

onProgress((p) => {
  const n = Math.floor(p * 100);
  fill.style.setProperty('--p', `${(p * 100).toFixed(1)}%`); // D66: the fill reveals its inner layer
  pct.textContent = `${n}%`;
  bar.setAttribute('aria-valuenow', String(n));
});

startPreload()
  .then(() => import('./main.js'))
  .then((m) => { gameStarted(); m.startGame({ loaded, shownAt }); gameReady(); })
  .catch((e) => console.error('Game failed to start', e));
