// Boss attack patterns. Every attack is telegraphed on the ground before it deals damage; the boss stands still while
// casting. Adds (reinforcements) are wave groups with a boss-HP trigger in data/waves.js.
// Damage numbers here are base values — the map's enemyMult scales them (D45).

// Gloam Warden (approved before Phase 4, PROJECT_AUDIT.md D35, variant "Slam + ring").
export const GLOAM_WARDEN = {
  // 1) GLOAM SLAM — a red circle under the keeper; damage when the telegraph ends.
  slam: {
    interval: 5.0,         // s between slams (counted from the end of the previous one)
    firstDelay: 3.0,       // s after the boss appears
    triggerRange: 420,     // only when the keeper is this close to the boss
    telegraph: 1.1,        // s of warning
    radius: 110,
    damage: 28,            // to the keeper
  },
  // 2) DARK TIDE — the ring around the boss charges, then a wave rolls out to `radius`.
  tide: {
    interval: 9.0,
    firstDelay: 6.0,
    telegraph: 1.3,
    radius: 260,
    playerDamage: 18,
    beaconDamage: 15,      // only if the beacon is inside the ring
  },
  impactFx: 0.35,          // s the impact flash stays visible (presentation)
};

// Fog Mother (D45, map 6 final boss): the Warden's two attacks, bigger, plus SUMMON — marked circles around her,
// a Grunt rises from each one when the telegraph ends (no reward for summoned Grunts: the fight cannot be farmed).
export const FOG_MOTHER = {
  slam: { interval: 5.5, firstDelay: 4.0, triggerRange: 460, telegraph: 1.15, radius: 125, damage: 30 },
  tide: { interval: 10.0, firstDelay: 7.0, telegraph: 1.4, radius: 300, playerDamage: 20, beaconDamage: 18 },
  summon: {
    interval: 14.0,
    firstDelay: 9.0,
    telegraph: 1.2,
    count: 3,
    distance: 120,         // circles around the boss
    markRadius: 30,
    enemyId: 'grunt',
  },
  impactFx: 0.35,
};

export const BOSSES = { gloam_warden: GLOAM_WARDEN, fog_mother: FOG_MOTHER };
export const getBossPattern = (id) => BOSSES[id] || GLOAM_WARDEN;
