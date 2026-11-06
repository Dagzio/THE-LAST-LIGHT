// Enemy types (02_SPEC §9, 03_ECONOMY §3). Rewards come from the economy table.
// Grunt numbers are PROVISIONAL (user choice 2026-11-06 for Phase 3: speed 55, 6 damage / 1.5 s); the full table
// for all enemies and the boss (+ contact damage to the player, D17) is approved before Phase 4 (Q3).

export const ENEMIES = {
  grunt: {
    id: 'grunt',
    radius: 17,
    maxHp: 40,               // PROVISIONAL: 3 pistol shots
    moveSpeed: 55,           // world units / s (edge of the map → beacon ≈ 15 s)
    beaconDamage: 6,         // per hit on the beacon
    attackInterval: 1.5,     // s between hits; the first hit comes one interval after arriving
    attackReach: 30,         // attacks from this distance to the beacon edge
    armor: 0,                // flat damage reduction (DamageCalculator step 7)
    bossSlowFactor: 1,       // 1 = normal enemy (bosses get weaker slows, Phase 4)
    reward: { coins: 2, xp: 5 }, // 03_ECONOMY §3 (granted from Phase 5)
  },
};

export const getEnemyType = (id) => ENEMIES[id] || null;
