// Camera follow math (no three.js here — testable with node:test). Presentation only: it reads the player position
// and never changes game state. The rig follows a ground point (x, y in world units) with exponential smoothing and
// keeps the view inside the map (+ a small margin of the decorative shore).
import { CAMERA } from '../config/camera.js';

/** Visible world extents on the ground for a screen aspect (contain: at least minViewWidth × minViewHeight). */
export function viewExtents(aspect, cfg = CAMERA) {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  const h = Math.max(cfg.minViewHeight, cfg.minViewWidth / a);
  return { w: h * a, h };
}

/** Camera distance from the look-at point so that `viewH` world units fit vertically. */
export function distanceFor(viewH, cfg = CAMERA) {
  return viewH / 2 / Math.tan(((cfg.fov * Math.PI) / 180) / 2);
}

function clampAxis(v, half, size, margin) {
  if (size + 2 * margin <= 2 * half) return size / 2;     // map smaller than the view on this axis: centre it
  const min = half - margin, max = size - half + margin;
  return v < min ? min : v > max ? max : v;
}

export class CameraRig {
  constructor(cfg = CAMERA) {
    this.cfg = cfg;
    this.x = 0;
    this.y = 0;
    this.view = viewExtents(16 / 9, cfg);
  }

  setAspect(aspect) { this.view = viewExtents(aspect, this.cfg); }

  /** Instantly centre on a point (map start). */
  snap(x, y, mapW, mapH) {
    this.x = clampAxis(x, this.view.w / 2, mapW, this.cfg.edgeMargin);
    this.y = clampAxis(y, this.view.h / 2, mapH, this.cfg.edgeMargin);
  }

  /** Smoothly follow (frame-rate independent). dt is clamped so a hitch never overshoots. */
  follow(tx, ty, dt, mapW, mapH) {
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return; // never let a bad target poison the camera
    const cx = clampAxis(tx, this.view.w / 2, mapW, this.cfg.edgeMargin);
    const cy = clampAxis(ty, this.view.h / 2, mapH, this.cfg.edgeMargin);
    const hl = this.cfg.followHalfLife;
    const k = hl > 0 ? 1 - Math.pow(0.5, Math.min(0.1, Math.max(0, dt)) / hl) : 1;
    this.x += (cx - this.x) * k;
    this.y += (cy - this.y) * k;
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) { this.x = cx; this.y = cy; }
  }
}
