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

// Emergency Flare (01_GDD §9.3, approved before Phase 4b — PROJECT_AUDIT.md D38). No direct damage.
export const FLARE = {
  maxCharge: 100,
  chargePerKill: { grunt: 5, runner: 5, brute: 12, gloam_warden: 0 }, // ≈ 3 uses per map
  illuminate: 4.0,          // s of Illuminated for regular enemies (same +15% bonus, no stacking)
  bossIlluminate: 2.0,      // s for the boss; its telegraphs / attacks are never interrupted
  stun: 1.2,                // s regular enemies stand still and do not attack (beacon attack timer restarts)
  knockbackRadius: 220,     // enemies this close to the beacon are thrown outwards…
  knockbackDistance: 80,    // …by this many world units…
  knockbackTime: 0.25,      // …over this time
  pulseFx: 1.0,             // s of the expanding light ring (presentation)
  pulseRadius: 1100,        // world units the ring reaches (covers the arena from the beacon)
};

// Enemy body tuning (EnemyAISystem): contact reach and crowd separation.
export const AI = {
  contactPad: 2,            // world units of extra reach for contact damage
  separation: 0.5,          // share of an overlap between two bodies resolved per step
};

// Static collision circles (D40, systems/Collision.js); decor circles come from systems/Props.js.
export const COLLIDERS = {
  beacon: 60,               // the stone plinth of the lighthouse (model radius 58–64)
  pad: 36,                  // build pad disc (devices stand on it)
  kiosk: 28,
};

export const ENEMY_FX = {
  deathFade: 0.45,             // s — dead body fades out, then the entity is removed
  hitFlash: 0.08,              // s
};
