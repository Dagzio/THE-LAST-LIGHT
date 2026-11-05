// Small seeded PRNG (mulberry32) for gameplay randomness (04_ARCH §10).
// Cosmetic effects may use their own instance; never Math.random() for gameplay.

export class SeededRandom {
  constructor(seed = 1) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    this.seed = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;
    this.state = this.seed;
  }

  /** Float in [0, 1). */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) { return min + (max - min) * this.next(); }

  /** Integer in [min, max]. */
  int(min, max) { return Math.floor(this.range(min, max + 1)); }

  pick(list) { return list.length ? list[Math.floor(this.next() * list.length)] : undefined; }
}

/** New random seed for a run (the seed itself is stored in MapRunState / debug stats). */
export const createRunSeed = () => (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
