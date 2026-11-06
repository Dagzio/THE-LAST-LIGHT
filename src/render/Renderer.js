// Canvas 2D renderer of the menu backdrop. Reads state only — never mutates game state (rule 12).
// Static layers are cached in offscreen canvases and rebuilt only when the viewport buffer,
// the map or the quality preset changes; the per-frame work is a few drawImage calls.
import { WORLD_WIDTH as W, WORLD_HEIGHT as H } from '../config/constants.js';
import {
  makeCanvas, makeGlowSprite, makeBeamSprite, drawBackdropStatic, drawArenaGround, BACKDROP_LANTERN,
} from './ProceduralArt.js';

export class Renderer {
  /** @param {HTMLCanvasElement} canvas @param {import('../platform/Viewport.js').Viewport} viewport */
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.layers = { backdrop: null };
    this.layerKeys = { backdrop: '' };
    this.rect = { x: 0, y: 0, w: W, h: H };
    // Sprites are created once and reused by every frame.
    this.sprites = {
      beam: makeBeamSprite(760, 120),
      lanternGlow: makeGlowSprite(90, 'rgba(255,200,120,0.9)'),
      fog: makeGlowSprite(220, 'rgba(150,170,200,0.10)'),
    };
  }

  _layer(name, key, draw) {
    if (this.layerKeys[name] === key && this.layers[name]) return this.layers[name];
    const vp = this.viewport;
    const c = this.layers[name] && this.layers[name].width === vp.bufferWidth && this.layers[name].height === vp.bufferHeight
      ? this.layers[name] : makeCanvas(vp.bufferWidth, vp.bufferHeight);
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    vp.applyWorldTransform(g);
    draw(g, vp.visibleWorldRect(this.rect));
    this.layers[name] = c;
    this.layerKeys[name] = key;
    return c;
  }

  /** Menu backdrop (splash, main menu, map select). The map run itself is drawn in 3D (render3d/). */
  render(view) {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    this._renderBackdrop(g, view);
  }

  _renderBackdrop(g, view) {
    const vp = this.viewport;
    const layer = this._layer('backdrop', `${vp.version}`, drawBackdropStatic);
    g.drawImage(layer, 0, 0);
    vp.applyWorldTransform(g);
    const t = view.realTime;
    const rect = vp.visibleWorldRect(this.rect);

    // Drifting fog (decorative, real time — menus are not part of the simulation).
    const fogCount = view.quality === 'low' ? 2 : 4;
    const fog = this.sprites.fog;
    for (let i = 0; i < fogCount; i++) {
      const speed = 8 + i * 5;
      const span = rect.w + fog.width;
      const fx = rect.x - fog.width + ((t * speed + i * 410) % span);
      const fy = 330 + i * 60;
      g.drawImage(fog, fx, fy - fog.height / 2, fog.width * 1.6, fog.height);
    }

    // Lighthouse beam sweeping around the vertical axis (side view): two opposite beams.
    const { x: lx, y: ly } = BACKDROP_LANTERN;
    const phase = t * (Math.PI * 2 / 14); // 14 s per revolution, as the beacon in the GDD
    const beam = this.sprites.beam;
    g.save();
    g.translate(lx, ly);
    g.globalCompositeOperation = 'lighter';
    for (const side of [1, -1]) {
      const sx = Math.cos(phase) * side;
      if (Math.abs(sx) < 0.02) continue;
      g.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(phase) * side * 0.5 + 0.5);
      g.save();
      g.scale(sx, 1);
      g.drawImage(beam, 0, -beam.height / 2);
      g.restore();
    }
    g.globalAlpha = 0.8 + 0.2 * Math.sin(t * 3.1);
    const glow = this.sprites.lanternGlow;
    g.drawImage(glow, -glow.width / 2, -glow.height / 2);
    g.restore();
  }

  /** Small preview of a map for the map-select card (drawn once into its own canvas). */
  static drawMapThumb(canvas, seed) {
    const g = canvas.getContext('2d');
    const s = Math.min(canvas.width / W, canvas.height / H);
    g.setTransform(s, 0, 0, s, (canvas.width - W * s) / 2, (canvas.height - H * s) / 2);
    drawArenaGround(g, { x: -W, y: -H, w: W * 3, h: H * 3 }, seed);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
