export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/** Returns `v` if it is a finite number, otherwise `fallback` (guards against NaN/Infinity). */
export const finiteOr = (v, fallback) => (Number.isFinite(v) ? v : fallback);
