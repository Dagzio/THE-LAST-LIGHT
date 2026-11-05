// Fullscreen toggle (H5 §12, vanilla.md §10). Hidden on iOS: webkitRequestFullscreen exists there
// but works only for <video> (PITFALLS 59) — check the device before feature detection.
// iPhone/iPad, including iPadOS that reports itself as a Mac.
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const fullscreenSupported = () => {
  if (isIOS()) return false;
  const d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen);
};

export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export function toggleFullscreen() {
  if (!fullscreenSupported()) return;
  const d = document.documentElement;
  try {
    if (isFullscreen()) {
      const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      if (p && p.catch) p.catch(() => {});
    } else {
      const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* browser refused */ }
}

/** Hides fullscreen buttons where unsupported and keeps their icon state in sync (F11 included). */
export function initFullscreenButtons(buttons) {
  if (!fullscreenSupported()) {
    buttons.forEach((b) => b.remove());
    return;
  }
  const sync = () => buttons.forEach((b) => b.classList.toggle('on', isFullscreen()));
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  window.addEventListener('resize', sync); // F11 browser fullscreen does not always fire fullscreenchange
  sync();
}
