// Gloam Warden attack patterns (approved before Phase 4, PROJECT_AUDIT.md D35, variant "Slam + ring").
// Every attack is telegraphed on the ground before it deals damage; the boss stands still while casting.
// Adds (reinforcements) are wave groups with a boss-HP trigger in data/waves.js.

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
