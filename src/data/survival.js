// D85 SURVIVAL (MODES_DESIGN_D85.md §4): every number of the survival rules — a couple of enemies at a time from
// off-screen entry points, a very smooth ramp, supplies appearing around the office. t — seconds survived.

export const SURVIVAL = {
  firstSpawnAt: 6,
  interval: { base: 8, extra: 10, tau: 300 },        // s between groups: base + extra · e^(−t/tau)  (18 → 8)
  group: { start: 1.5, per: 240, max: 4 },           // group size: start + t/per (fractional part = chance of one more)
  alive: { start: 3, per: 90, max: 10 },             // living enemies at once: start + floor(t/per)
  retarget: 3,                                       // s: enemies not fighting are sent towards the hero again…
  retargetJitter: 150,                               // …± this many units
  spawn: { minDist: 650, losDist: 900, retry: 1, offsets: [[0, 0], [24, 18], [-24, 18], [0, -28]] },
  // the enemy mix and their strength over minutes θ
  weights: (m) => ({
    thug: Math.max(0.25, 1 - 0.12 * m),
    gunman: Math.min(0.6, 0.15 + 0.07 * m),
    heavy: m < 4 ? 0 : Math.min(0.3, 0.05 + 0.05 * (m - 4)),
  }),
  mult: (m) => ({
    hp: Math.min(1.5, 0.9 + 0.04 * m),
    damage: Math.min(1.4, 0.8 + 0.04 * m),
    spread: Math.max(0.8, 1.15 - 0.025 * m),
    reaction: Math.max(0.8, 1.2 - 0.03 * m),
  }),
  threatEvery: 90,                                   // s per threat level (HUD), max 10
  bodyFade: 12,
  // supplies
  // D88: ammoMags — a box of rounds gives this many magazines to every carried gun
  crate: { first: 12, every: 35, max: 2, maxLate: 3, lateAt: 300, firstNear: 700, openedFor: 6, grenades: 2, ammoMags: 2 },
  medkit: { first: 25, every: 30, max: 2, expire: 90 },
  pickupMinDist: 300,
};
