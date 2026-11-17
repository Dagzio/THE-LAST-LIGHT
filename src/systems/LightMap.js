// D85 STEALTH: how lit every spot of the level is — a grid of luminance built once per run from the level's baked
// lights (data/lighting.js: the rooms' moods, the props' screens / lamps, the level's own lights). The detection of
// the stealth AI reads it: in the shadows an enemy sees half as far and notices slower. Pure simulation data.
import { levelLights, lightAt } from '../data/lighting.js';

const CELL = 30;
const RGB = [0, 0, 0];
// the rooms' own light between the pools (the moods of data/lighting.js) and how strongly the pools count
const MOOD_AMBIENT = { warm: 0.16, cool: 0.14, dim: 0.06, dark: 0 };
const POOL_K = 1.5;

export class LightMap {
  /** @param {object} level a (resolved) level */
  constructor(level) {
    this.w = Math.ceil(level.width / CELL);
    this.h = Math.ceil(level.height / CELL);
    this.cells = new Float32Array(this.w * this.h);
    const lights = levelLights(level);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL;
        lightAt(lights, x, y, RGB);
        const z = level.zones.find((q) => x >= q.rect[0] && x <= q.rect[2] && y >= q.rect[1] && y <= q.rect[3]);
        const base = z ? MOOD_AMBIENT[z.light || 'warm'] ?? 0.1 : 0;
        this.cells[j * this.w + i] = base + POOL_K * (0.3 * RGB[0] + 0.59 * RGB[1] + 0.11 * RGB[2]);
      }
    }
  }

  /** Luminance at a ground point (0 = dark). */
  at(x, y) {
    const i = Math.min(this.w - 1, Math.max(0, Math.floor(x / CELL)));
    const j = Math.min(this.h - 1, Math.max(0, Math.floor(y / CELL)));
    return this.cells[j * this.w + i];
  }
}
