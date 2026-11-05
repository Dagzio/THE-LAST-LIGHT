// Responsive canvas with a fixed logical world (04_ARCH §6, decision C10):
// the whole 1280×720 arena always fits (uniform scale, never stretched); the extra screen area
// shows an extended decorative surround instead of black bars. The drawing buffer uses a
// capped devicePixelRatio from the quality preset and a hard pixel ceiling.
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config/constants.js';
import { MAX_BUFFER_PIXELS } from '../config/settings.js';

export class Viewport {
  /** @param {HTMLCanvasElement} canvas  @param {() => number} getDprCap */
  constructor(canvas, getDprCap) {
    this.canvas = canvas;
    this.getDprCap = getDprCap;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = 1;
    this.bufferWidth = 0;
    this.bufferHeight = 0;
    this.scale = 1;     // buffer pixels per world unit
    this.offsetX = 0;   // buffer pixels
    this.offsetY = 0;
    this.version = 0;   // increments when the buffer/transform changes (render caches invalidate)
    this.dirty = true;
    const mark = () => { this.dirty = true; };
    window.addEventListener('resize', mark);
    window.addEventListener('orientationchange', mark);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', mark);
  }

  invalidate() { this.dirty = true; }

  /** Recomputes sizes only when something changed. Returns true if the buffer was resized. */
  ensure() {
    if (!this.dirty) return false;
    this.dirty = false;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    let dpr = Math.min(window.devicePixelRatio || 1, this.getDprCap());
    if (!(dpr > 0)) dpr = 1;
    const pixels = cssW * cssH * dpr * dpr;
    if (pixels > MAX_BUFFER_PIXELS) dpr = Math.sqrt(MAX_BUFFER_PIXELS / (cssW * cssH));
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));

    const changed = bw !== this.bufferWidth || bh !== this.bufferHeight;
    if (changed) {
      this.canvas.width = bw; // only on a real change — never every frame
      this.canvas.height = bh;
    }
    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.dpr = dpr;
    this.bufferWidth = bw;
    this.bufferHeight = bh;
    this.scale = Math.min(bw / WORLD_WIDTH, bh / WORLD_HEIGHT);
    this.offsetX = (bw - WORLD_WIDTH * this.scale) / 2;
    this.offsetY = (bh - WORLD_HEIGHT * this.scale) / 2;
    this.version += 1;
    return changed;
  }

  applyWorldTransform(ctx) {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  /** Visible world rectangle including the extended surround (world units). */
  visibleWorldRect(out = {}) {
    out.x = -this.offsetX / this.scale;
    out.y = -this.offsetY / this.scale;
    out.w = this.bufferWidth / this.scale;
    out.h = this.bufferHeight / this.scale;
    return out;
  }

  /** Client (CSS) coordinates → world coordinates. */
  clientToWorld(clientX, clientY, out = {}) {
    const rect = this.canvas.getBoundingClientRect();
    const bx = (clientX - rect.left) * (this.bufferWidth / Math.max(1, rect.width));
    const by = (clientY - rect.top) * (this.bufferHeight / Math.max(1, rect.height));
    out.x = (bx - this.offsetX) / this.scale;
    out.y = (by - this.offsetY) / this.scale;
    return out;
  }
}
