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
// D64 / D67: the splash art is shown whole on every screen (contain, the free bands filled by a blurred copy), so the
// logo column, the loading bar and TAP TO PLAY are placed by points of the picture itself: the logo between the lamp
// (left) and the moon, its bottom above the ground, never wider than the gap between them; the bar low in the centre.
const ART = { w: 1672, h: 941, x: 0.4, y: 0.335, ground: 0.55, gap: 0.41, barY: 0.857, barW: 0.465 };
const inner = document.getElementById('splashInner');
function placeSplash() {
  if (!splash.classList.contains('active')) return;
  const W = innerWidth, H = innerHeight, k = Math.min(W / ART.w, H / ART.h);
  const iw = ART.w * k, ih = ART.h * k, ox = (W - iw) / 2, oy = (H - ih) / 2;
  splash.style.setProperty('--splash-logo-max', `${Math.round(iw * ART.gap)}px`);
  splash.style.setProperty('--splash-bw', `${Math.round(Math.min(iw * ART.barW, 900))}px`);
  splash.style.setProperty('--bar-x', `${Math.round(ox + iw / 2)}px`);
  splash.style.setProperty('--bar-y', `${Math.round(oy + ih * ART.barY)}px`);
  const logo = inner.querySelector('.logo');
  const lw = logo.offsetWidth, lh = logo.offsetHeight;                 // after the width cap above
  const ground = oy + ART.ground * ih;
  let cy = oy + ART.y * ih;
  cy = Math.max(oy + lh / 2 + 8, Math.min(cy, ground - 10 - lh / 2));  // never on the ground, never off the picture's top
  const cx = Math.min(ox + iw - lw / 2 - 12, Math.max(ox + lw / 2 + 12, ox + ART.x * iw));
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
