import { FIXED_STEP, MAX_FRAME_DELTA } from '../config/constants.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * requestAnimationFrame loop with a fixed simulation step and an accumulator (04_ARCH §5).
 * - update(dt) is called 0..N times per frame with dt = FIXED_STEP;
 * - render(alpha, frameDt) is called exactly once per animation frame;
 * - a large frame delta (tab switch, hitch) is clamped to MAX_FRAME_DELTA;
 * - resetTiming() drops the accumulated time (used when the tab becomes visible again).
 * `tick(timestampMs)` is public so the stepping logic can be tested without a browser.
 */
export class GameLoop {
  /**
   * @param {{update:(dt:number)=>void, render:(alpha:number, frameDt:number)=>void,
   *          step?:number, maxFrameDelta?:number, raf?:Function, caf?:Function}} opts
   */
  constructor({ update, render, step = FIXED_STEP, maxFrameDelta = MAX_FRAME_DELTA, raf, caf }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxFrameDelta = maxFrameDelta;
    this.raf = raf || ((cb) => requestAnimationFrame(cb));
    this.caf = caf || ((id) => cancelAnimationFrame(id));
    this.accumulator = 0;
    this.lastTimestamp = null;
    this.running = false;
    this.rafId = 0;
    this.frameDt = 0;
    this.updateMs = 0;   // diagnostics: cost of the fixed updates in the last frame
    this.renderMs = 0;   // diagnostics: cost of the last render
    this.fpsCap = 0;
    this.timeScale = 1;  // D61 / D62: slow motion (the grenade wheel): every step advances step × timeScale (smooth)     // >0: skip animation frames faster than this (90–120 Hz phones, H5 3D guide §3)
    this._lastFrameTs = -Infinity;
    this._frame = (ts) => {
      if (!this.running) return;
      if (this.fpsCap > 0 && ts - this._lastFrameTs < 1000 / this.fpsCap - 6) { this.rafId = this.raf(this._frame); return; }
      this._lastFrameTs = ts;
      this.tick(ts);
      this.rafId = this.raf(this._frame);
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resetTiming();
    this.rafId = this.raf(this._frame);
  }

  stop() {
    this.running = false;
    if (this.rafId) this.caf(this.rafId);
    this.rafId = 0;
  }

  resetTiming() {
    this.lastTimestamp = null;
    this.accumulator = 0;
  }

  /** Advances the loop to `timestampMs`. Returns the number of fixed updates performed. */
  tick(timestampMs) {
    if (!Number.isFinite(timestampMs)) return 0;
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestampMs;
      this.frameDt = 0;
      this.render(0, 0);
      return 0;
    }
    let frameDt = (timestampMs - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestampMs;
    if (!(frameDt > 0)) frameDt = 0;
    if (frameDt > this.maxFrameDelta) frameDt = this.maxFrameDelta;
    this.frameDt = frameDt;
    this.accumulator += frameDt;

    let steps = 0;
    const t0 = now();
    // Small epsilon so 1/60 + 1/60 accumulations from 120 Hz don't lose a step to float error.
    while (this.accumulator + 1e-9 >= this.step) {
      this.update(this.timeScale > 0 && this.timeScale < 1 ? this.step * this.timeScale : this.step); // D62: slow motion = shorter steps (smooth)
      this.accumulator -= this.step;
      steps += 1;
    }
    if (this.accumulator < 0) this.accumulator = 0;
    const t1 = now();
    this.render(this.accumulator / this.step, frameDt);
    this.updateMs = t1 - t0;
    this.renderMs = now() - t1;
    return steps;
  }
}
