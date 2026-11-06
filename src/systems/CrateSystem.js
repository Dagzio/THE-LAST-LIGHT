// Random crates (01_GDD §14, 02_SPEC §14, D41): on waves 2–5 a seeded 30 % roll; max 1 crate per map; it appears at
// a valid random spot (not near the keeper, beacon, kiosk, pads, enemy spawns, not inside obstacles) and disappears
// after 30 s. Opening it offers 3 temporary perks (the map run applies the chosen one, once).
import { CRATE, PERKS, PERK_ORDER } from '../data/perks.js';

export class CrateSystem {
  /**
   * @param {object} map
   * @param {{next:()=>number}} rng seeded run RNG (its own stream)
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(map, rng, events) {
    this.map = map;
    this.rng = rng;
    this.events = events;
    this.spawned = 0;
    this.pendingAt = null;  // scheduled spawn time for this wave
    this.crate = null;      // { x, y, spawnedAt, expiresAt }
    this.world = null;
  }

  /** Wave start: maybe schedule a crate (seeded roll). */
  onWaveStart(waveIndex, time) {
    this.pendingAt = null;
    if (waveIndex < CRATE.firstWaveIndex || this.spawned >= CRATE.maxPerMap || this.crate) return;
    if (this.rng.next() >= CRATE.chance) return;
    this.pendingAt = time + this.rng.next() * CRATE.spawnWithin;
  }

  update(player, kiosk, time) {
    if (this.pendingAt !== null && time >= this.pendingAt) {
      this.pendingAt = null;
      const spot = this._place(player, kiosk);
      if (spot) { // no valid spot → the crate is skipped, never an endless search
        this.crate = { x: spot.x, y: spot.y, spawnedAt: time, expiresAt: time + CRATE.lifetime };
        this.spawned += 1;
        this.events.emit('crateSpawn', spot.x, spot.y);
      }
    }
    if (this.crate && time >= this.crate.expiresAt) {
      const c = this.crate;
      this.crate = null;
      this.events.emit('crateExpired', c.x, c.y);
    }
  }

  _place(player, kiosk) {
    const P = CRATE.placement, m = this.map;
    const spawns = Object.values(m.spawnPoints).flat();
    for (let i = 0; i < P.tries; i++) {
      const x = P.margin + this.rng.next() * (m.width - 2 * P.margin);
      const y = P.margin + this.rng.next() * (m.height - 2 * P.margin);
      if (Math.hypot(x - player.x, y - player.y) < P.minFromPlayer) continue;
      if (Math.hypot(x - m.beacon.x, y - m.beacon.y) < P.minFromBeacon) continue;
      if (kiosk && Math.hypot(x - kiosk.x, y - kiosk.y) < P.minFromKiosk) continue;
      if (m.buildPads.some((p) => Math.hypot(x - p.x, y - p.y) < P.minFromPads)) continue;
      if (spawns.some((s) => Math.hypot(x - s.x, y - s.y) < P.minFromSpawns)) continue;
      if (this.world) { // not inside or touching an obstacle
        const probe = { x, y, radius: 26 };
        if (this.world.pushOut(probe)) continue;
      }
      return { x, y };
    }
    return null;
  }

  /** Remaining seconds (presentation). */
  timeLeft(time) { return this.crate ? Math.max(0, this.crate.expiresAt - time) : 0; }

  /** Takes the crate (it is gone after this) and rolls the offered perks. */
  open(time, isOffered) {
    if (!this.crate) return null;
    this.crate = null;
    const pool = PERK_ORDER.filter((id) => isOffered(PERKS[id]));
    const out = [];
    while (out.length < CRATE.choices && pool.length > 0) {
      const k = Math.floor(this.rng.next() * pool.length) % pool.length;
      out.push(pool.splice(k, 1)[0]);
    }
    this.events.emit('crateOpen', out);
    return out;
  }

  clear() { this.crate = null; this.pendingAt = null; }
}
