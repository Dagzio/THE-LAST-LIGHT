// Decorative particles (muzzle sparks, impacts, death bursts). Fixed pool, no allocation per spawn.
// Updated in the fixed simulation step, so they freeze on pause. When the cap is reached new decorative
// particles are simply dropped (gameplay entities are never dropped). Cosmetic randomness only.

class Particle {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1; this.size = 2; this.color = '#fff'; this.drag = 0;
  }
}

export class Particles {
  constructor(capacity) {
    this.items = Array.from({ length: capacity }, () => new Particle());
    this.limit = capacity;      // scaled by the quality preset
    this.activeCount = 0;
  }

  setQualityFactor(f) { this.limit = Math.max(8, Math.floor(this.items.length * f)); }

  burst(x, y, count, speed, life, size, color, drag = 4) {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.limit) return;
      const p = this._free();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.maxLife = p.life = life * (0.6 + Math.random() * 0.4);
      p.size = size; p.color = color; p.drag = drag;
      this.activeCount++;
    }
  }

  /** Cone burst along `angle` (muzzle). */
  cone(x, y, angle, spread, count, speed, life, size, color) {
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.limit) return;
      const p = this._free();
      if (!p) return;
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random() * 0.5);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.maxLife = p.life = life * (0.6 + Math.random() * 0.4);
      p.size = size; p.color = color; p.drag = 8;
      this.activeCount++;
    }
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; this.activeCount--; continue; }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  clear() { for (const p of this.items) p.active = false; this.activeCount = 0; }

  _free() {
    for (const p of this.items) if (!p.active) return p;
    return null;
  }
}
