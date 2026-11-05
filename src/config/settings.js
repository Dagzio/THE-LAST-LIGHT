// Quality presets (04_ARCH §6, §9.2). Starting values — confirm by profiling.
// Lowering quality removes only decorative effects, never gameplay signals.

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const QUALITY_PRESETS = {
  low:    { dprCap: 1.0,  particles: 0.35, trails: 'off',     shadows: 'off',     background: 'reduced' },
  medium: { dprCap: 1.25, particles: 0.65, trails: 'reduced', shadows: 'reduced', background: 'medium' },
  high:   { dprCap: 1.5,  particles: 1.0,  trails: 'on',      shadows: 'on',      background: 'full' },
};

/** Hard ceiling for the canvas drawing buffer area (pixels), protects weak GPUs on huge screens. */
export const MAX_BUFFER_PIXELS = 2560 * 1440;

/**
 * AUTO picks a cautious preset on touch devices. Uses several hints, never only one property.
 * @returns {'low'|'medium'|'high'}
 */
export function resolveAutoQuality() {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (!coarse) return 'high';
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  return cores <= 4 || memory <= 3 ? 'low' : 'medium';
}
