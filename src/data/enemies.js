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
    barHeight: 50,           // D54: above the taller textured model
    // ATTACK_PLAYER (D17): a keeper closer than aggroRange pulls the runner off its path for up to chaseDuration;
    // it gives up when the keeper gets farther than aggroRange × giveUpFactor, then ignores him for cooldown.
    // D58 (user decision): chaseDuration 3 → 9 s (+6) — a distracted runner fights the keeper longer
    chase: { aggroRange: 170, chaseDuration: 9.0, giveUpFactor: 1.6, cooldown: 4.0 },
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
    barHeight: 66,
    reward: { coins: 5, xp: 12 },
  },
  // Spitter (D45, from map 3): stops far from the beacon and lobs glowing globs at it (visible flight, damage on
  // landing). It never closes in — the keeper has to hunt it down.
  spitter: {
    id: 'spitter',
    radius: 15,
    maxHp: 34,
    moveSpeed: 50,
    beaconDamage: 8,         // per glob
    attackInterval: 2.6,
    attackReach: 230,        // stands this far from the beacon edge
    contactDamage: 6,
    armor: 0,
    bossSlowFactor: 1,
    barHeight: 44,
    ranged: { globSpeed: 260, globRadius: 7, // world units / s; travel time = distance / speed
      // D62 (user decision): the keeper within `range` (and not close enough to bite) gets a spit: after `windup` s the
      // spitter fixes where he stands and spits there in a straight line; the glob hits him if he is on its way
      // (hitMult × its glob damage + poison: poisonMult × it every second for poisonTime s), else it splats on the ground.
      keeper: { range: 220, windup: 0.5, hitMult: 0.35, poisonMult: 0.5, poisonTime: 4.5, poisonEvery: 1 } },
    reward: { coins: 3, xp: 8 },
  },
  // Husk (D45, from map 4): armoured shell — every bullet hit loses 3 damage; grenades ignore armour.
  husk: {
    id: 'husk',
    radius: 22,
    maxHp: 110,
    moveSpeed: 42,
    beaconDamage: 12,
    attackInterval: 1.8,
    attackReach: 30,
    contactDamage: 14,
    armor: 3,
    rearArmor: true,         // D52: bullets in its back −35 % (sides −15 % for everyone, data/balance.js DAMAGE)
    bossSlowFactor: 1,
    barHeight: 52,
    reward: { coins: 4, xp: 10 },
  },
  gloam_warden: {
    id: 'gloam_warden',
    boss: true,              // one per map, final wave only; attacks in data/boss.js
    nameKey: 'boss.gloam_warden',
    radius: 53,              // D55 (user decision): bosses bigger — the model ×1.3 (models3d BOSS_SCALE), the body ×1.15 (was 46; more gets stuck between the pads and the groves of Pine Hollow)
    maxHp: 1400,
    moveSpeed: 28,
    beaconDamage: 25,
    attackInterval: 2.5,
    attackReach: 40,
    contactDamage: 20,
    armor: 0,
    bossSlowFactor: 0.5,     // slows are half as strong, never a full freeze (02_SPEC §10)
    barHeight: 0,            // no world bar: the boss bar is in the HUD
    reward: { coins: 36, xp: 92 }, // 30 / 80 +20% / +15% (user decision D40)
  },
  // Fog Mother (D45): final boss of map 6. Slam + tide like the Warden, plus a telegraphed summon (data/boss.js).
  fog_mother: {
    id: 'fog_mother',
    boss: true,
    nameKey: 'boss.fog_mother',
    radius: 60,              // D55: the body ×1.15 (was 52), the model ×1.3
    maxHp: 3200,
    moveSpeed: 24,
    beaconDamage: 30,
    attackInterval: 2.5,
    attackReach: 44,
    contactDamage: 22,
    armor: 0,
    bossSlowFactor: 0.5,
    barHeight: 0,
    attackMult: 1.25,        // D52: the strongest boss — her slam / tide / beacon hits +25 % on top of the map
    reward: { coins: 60, xp: 150 },
  },
};

/**
 * Enemy type scaled for a map (D45; split HP / damage + boss HP in D52): HP × hpMult (bosses also × bossHpMult), every
 * damage × damageMult (boss attacks also × type.attackMult), kill reward × rewardMult (rounded). Returns the base entry
 * for a neutral map, so map 1 keeps the exact original objects.
 */
export function scaledEnemyType(type, hpMult = 1, rewardMult = 1, damageMult = hpMult, bossHpMult = 1) {
  if (!type) return type;
  const hp = hpMult * (type.boss ? bossHpMult : 1);
  const attack = damageMult * (type.attackMult || 1);
  if (hp === 1 && damageMult === 1 && rewardMult === 1 && attack === 1) return type;
  const r = type.reward || { coins: 0, xp: 0 };
  return {
    ...type,
    maxHp: Math.round(type.maxHp * hp),
    beaconDamage: Math.round(type.beaconDamage * damageMult),
    contactDamage: Math.round(type.contactDamage * damageMult),
    damageMult: attack, // boss attacks (data/boss.js numbers) read it
    reward: { coins: Math.round(r.coins * rewardMult), xp: Math.round(r.xp * rewardMult) },
  };
}

export const getEnemyType = (id) => ENEMIES[id] || null;
