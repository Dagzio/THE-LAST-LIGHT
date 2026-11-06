// Graphics quality presets (04_ARCH §6/§9.2 + H5 guide engines/3d-threejs.md §3).
// The setting is like Sound/Music: own key, survives a progress reset. All presets show the SAME game —
// lower ones trim only what costs GPU time; gameplay signals (enemies, bullets, telegraphs) are never removed.
// Default (setting "auto"): desktop → high, phone → medium, weak phone (≤ 2 GB or ≤ 2 cores) → low.

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const TOUCH = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
const DPR = typeof devicePixelRatio === 'number' ? Math.max(1, devicePixelRatio) : 1;

export const QUALITY_PRESETS = {
  high: {
    dprCap: 1.5,                                   // 2D menu canvas
    maxPR: Math.min(DPR, TOUCH ? 1.5 : 2), minPR: 1, // 3D render resolution (max / floor of adaptation)
    shadows: true, shadowSize: TOUCH ? 1024 : 2048,
    particles: 1.0, trails: 'on', aniso: 4, fpsCap: TOUCH ? 60 : 0, lantern: true,
  },
  medium: {
    dprCap: 1.25,
    maxPR: Math.min(DPR, 1.25), minPR: 0.8,
    shadows: true, shadowSize: 1024,
    particles: 0.65, trails: 'reduced', aniso: 2, fpsCap: 60, lantern: true,
  },
  low: {
    dprCap: 1.0,
    maxPR: Math.min(DPR, 0.9), minPR: 0.6,
    shadows: false, shadowSize: 512,   // no shadow map — blob shadows under characters instead
    particles: 0.35, trails: 'off', aniso: 1, fpsCap: 60, lantern: false,
  },
};

/** Hard ceiling for the 2D menu canvas drawing buffer area (pixels). */
export const MAX_BUFFER_PIXELS = 2560 * 1440;

/** AUTO: cautious on touch devices; uses several hints, never only one property. */
export function resolveAutoQuality() {
  if (!TOUCH) return 'high';
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const memory = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;
  return memory <= 2 || cores <= 2 ? 'low' : 'medium';
}

/** MSAA is chosen once, when the WebGL context is created: desktops always, phones only on High with DPR < 2. */
export const antialiasFor = (quality) => !TOUCH || (quality === 'high' && DPR < 2);
