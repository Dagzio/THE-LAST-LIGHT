// Enemy types (02_SPEC §9, 03_ECONOMY §3). Rewards come from the economy table.
// Phase 2 needs only a test Grunt. HP/speed/radius below are PROVISIONAL — the full enemy table
// (HP, speed, beacon damage, attack interval, contact damage) is approved with the user before Phase 4 (Q3).

export const ENEMIES = {
  grunt: {
    id: 'grunt',
    radius: 17,
    maxHp: 40,          // PROVISIONAL: 3 pistol shots
    moveSpeed: 0,       // PROVISIONAL: test dummies stand still in Phase 2
    armor: 0,           // flat damage reduction (DamageCalculator step 7)
    reward: { coins: 2, xp: 5 }, // 03_ECONOMY §3 (granted from Phase 5)
  },
};

export const getEnemyType = (id) => ENEMIES[id] || null;
