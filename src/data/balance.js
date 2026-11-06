// Cross-system tuning values (04_ARCH §9, 02_SPEC §5–6).

export const TARGETING = {
  searchInterval: 0.12,        // s — full search is throttled (spec: 0.10–0.15)
  // Single-pass threat score; higher wins. Order of the spec priorities is kept by the weights.
  weights: {
    attackingBeacon: 1000,     // 1. enemy currently attacking the beacon (Phase 4)
    beaconThreat: 500,         // 2. enemy in the beacon danger zone, scaled 0..1 by closeness (Phase 4)
    illuminated: 200,          // 3. enemy lit by the beam (Phase 3)
    proximity: 100,            // 4. closer to the player = higher, scaled 0..1 inside weapon range
  },
  stickiness: 15,              // keep the current target unless another one scores this much higher
};

export const DAMAGE = {
  minDamage: 1,                // step 8: clamp
  illuminatedBonus: 0.15,      // step 6: +15% (GDD §9.2), used once Illuminated exists (Phase 3)
};

export const PROJECTILES = {
  radius: 3,
  rangeSlack: 1.1,             // a bullet flies up to range × slack, then disappears
  maxHitsCap: 4,               // hard cap of distinct targets per bullet (1 + penetration)
};

export const CAPS = {
  projectiles: 160,            // gameplay entities: oldest is recycled only if the pool is full
  particles: 220,              // decorative; scaled by the quality preset
};

export const ENEMY_FX = {
  deathFade: 0.45,             // s — dead body fades out, then the entity is removed
  hitFlash: 0.08,              // s
};
