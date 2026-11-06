// Enemy types (02_SPEC §9, 03_ECONOMY §3). Numbers approved by the user before Phase 4 (Q3 → PROJECT_AUDIT.md D35,
// variant "Balance"). Rewards come from the economy table (granted to the profile from Phase 5).
// Every regular enemy shares one AI (EnemyAISystem); differences are data only.
// contactDamage — dealt to the keeper on touch, then the keeper's hit invulnerability (data/player.js) applies.

export const ENEMIES = {
  grunt: {
    id: 'grunt',
    radius: 17,
    maxHp: 40,               // 3 pistol shots
    moveSpeed: 55,           // world units / s (map edge → beacon ≈ 15 s)
    beaconDamage: 6,         // per hit on the beacon
    attackInterval: 1.5,     // s between hits; the first hit comes one interval after arriving
    attackReach: 30,         // attacks from this distance to the beacon edge
    contactDamage: 8,
    armor: 0,                // flat damage reduction (DamageCalculator step 7)
    bossSlowFactor: 1,       // 1 = full slow effect
    barHeight: 46,           // world height of the HP bar (presentation)
    reward: { coins: 2, xp: 5 },
  },
  runner: {
    id: 'runner',
    radius: 13,
    maxHp: 22,               // 2 pistol shots
    moveSpeed: 115,          // map edge → beacon ≈ 7 s
    beaconDamage: 4,
    attackInterval: 1.0,
    attackReach: 26,
    contactDamage: 10,
    armor: 0,
    bossSlowFactor: 1,
    barHeight: 40,
    // ATTACK_PLAYER (D17): a keeper closer than aggroRange pulls the runner off its path for up to chaseDuration;
    // it gives up when the keeper gets farther than aggroRange × giveUpFactor, then ignores him for cooldown.
    chase: { aggroRange: 170, chaseDuration: 3.0, giveUpFactor: 1.6, cooldown: 4.0 },
    reward: { coins: 2, xp: 6 },
  },
  brute: {
    id: 'brute',
    radius: 27,
    maxHp: 180,              // 13 pistol shots
    moveSpeed: 32,           // map edge → beacon ≈ 25 s
    beaconDamage: 20,
    attackInterval: 2.2,
    attackReach: 32,
    contactDamage: 18,
    armor: 0,
    bossSlowFactor: 1,
    barHeight: 62,
    reward: { coins: 5, xp: 12 },
  },
  gloam_warden: {
    id: 'gloam_warden',
    boss: true,              // one per map, final wave only; attacks in data/boss.js
    nameKey: 'boss.gloam_warden',
    radius: 46,
    maxHp: 1400,
    moveSpeed: 28,
    beaconDamage: 25,
    attackInterval: 2.5,
    attackReach: 40,
    contactDamage: 20,
    armor: 0,
    bossSlowFactor: 0.5,     // slows are half as strong, never a full freeze (02_SPEC §10)
    barHeight: 0,            // no world bar: the boss bar is in the HUD
    reward: { coins: 30, xp: 80 },
  },
};

export const getEnemyType = (id) => ENEMIES[id] || null;
