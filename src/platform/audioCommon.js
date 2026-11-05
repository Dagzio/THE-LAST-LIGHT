// Shared helpers for the Web Audio scheme of the H5 standard (engines/vanilla.md §5–6).
// All audio goes through Web Audio only — no <audio>/new Audio() (no lock-screen media player).

export const newCtx = () => {
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    return C ? new C() : null;
  } catch (e) {
    return null;
  }
};

export const closeCtx = (c) => {
  if (c) try { c.close().catch(() => {}); } catch (e) { /* already closed */ }
};

/** Local file → AudioBuffer. Used only for music files shipped in assets/ (no remote URLs). */
export const loadBuf = async (ac, url) => {
  try {
    const r = await fetch(url);
    return await ac.decodeAudioData(await r.arrayBuffer());
  } catch (e) {
    return null;
  }
};

export const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
