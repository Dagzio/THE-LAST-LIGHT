// Wave compositions per map (02_SPEC §11, 03_ECONOMY §4 and §10). Data only — the WaveSystem runs them.
// Group: enemyId, count, spawnInterval (s), spawnPointGroup (key of map.spawnPoints), initialDelay (s from the wave
// start). Optional `bossHpBelow`: the group starts only when the alive boss falls below that HP fraction (boss adds);
// if the boss dies first, the group is skipped. `reward` = wave-clear coin bonus (granted once).

export const WAVE_TIMING = {
  intro: 10.0,             // s of preparation before wave 1 — shop open, START WAVE available (user decision D39)
  intermission: 20.0,      // s between waves (START NEXT WAVE skips it)
  maxAliveAdds: 8,         // boss wave: cap of alive non-boss enemies (adds wait while the cap is reached)
  earlyStartBonus: 25,     // coins for START NEXT WAVE before the timer runs out — once per wave (user decision D40)
};

export const WAVES = {
  ashen_coast: [
    // D75 (user decision): the first map is a little easier — fewer enemies (was 8 / 11 / 13 / 17 + the boss wave),
    // HP and damage −20 % (maps.js), and the 5th wave is a regular one instead of the Gloam Warden.
    { // 1 — 6 Grunt: learn to shoot and move
      reward: 15,
      groups: [
        { enemyId: 'grunt', count: 3, spawnInterval: 2.0, spawnPointGroup: 'north', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 3, spawnInterval: 2.0, spawnPointGroup: 'east', initialDelay: 5.0 },
      ],
    },
    { // 2 — 6 Grunt + 2 Runner: pressure by speed
      reward: 20,
      groups: [
        { enemyId: 'grunt', count: 3, spawnInterval: 1.8, spawnPointGroup: 'west', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 3, spawnInterval: 1.8, spawnPointGroup: 'south', initialDelay: 3.0 },
        { enemyId: 'runner', count: 2, spawnInterval: 2.5, spawnPointGroup: 'north', initialDelay: 7.0 },
      ],
    },
    { // 3 — 6 Grunt + 3 Runner + 1 Brute: target priority
      reward: 25,
      groups: [
        { enemyId: 'grunt', count: 3, spawnInterval: 1.6, spawnPointGroup: 'north', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 3, spawnInterval: 1.6, spawnPointGroup: 'east', initialDelay: 2.5 },
        { enemyId: 'runner', count: 2, spawnInterval: 2.0, spawnPointGroup: 'south', initialDelay: 5.0 },
        { enemyId: 'runner', count: 1, spawnInterval: 2.0, spawnPointGroup: 'west', initialDelay: 7.0 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'west', initialDelay: 9.0 },
      ],
    },
    { // 4 — 8 Grunt + 4 Runner + 1 Brute: tests the shop / defenses
      reward: 30,
      groups: [
        { enemyId: 'grunt', count: 4, spawnInterval: 1.5, spawnPointGroup: 'north', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 4, spawnInterval: 1.5, spawnPointGroup: 'south', initialDelay: 2.0 },
        { enemyId: 'runner', count: 2, spawnInterval: 1.8, spawnPointGroup: 'east', initialDelay: 5.0 },
        { enemyId: 'runner', count: 2, spawnInterval: 1.8, spawnPointGroup: 'west', initialDelay: 8.0 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'east', initialDelay: 10.0 },
      ],
    },
    { // 5 — 9 Grunt + 4 Runner + 2 Brute: a regular last wave (no boss, no elite)
      reward: 50,
      groups: [
        { enemyId: 'grunt', count: 3, spawnInterval: 1.5, spawnPointGroup: 'north', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 3, spawnInterval: 1.5, spawnPointGroup: 'south', initialDelay: 2.5 },
        { enemyId: 'grunt', count: 3, spawnInterval: 1.5, spawnPointGroup: 'west', initialDelay: 6.0 },
        { enemyId: 'runner', count: 2, spawnInterval: 1.8, spawnPointGroup: 'east', initialDelay: 4.0 },
        { enemyId: 'runner', count: 2, spawnInterval: 1.8, spawnPointGroup: 'north', initialDelay: 9.0 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'east', initialDelay: 7.0 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'west', initialDelay: 13.0 },
      ],
    },
  ],

  // ---------------- D45: maps 2–6 (`elite` = final wave without a boss: shown as FINAL WAVE) ----------------
  // Shorthand: g(enemy, count, interval, side, delay, bossHpBelow?)
  drowned_pier: [ // three sides only (no south)
    { reward: 16, groups: [g('grunt', 4, 2.0, 'north', 1), g('grunt', 4, 2.0, 'west', 5)] },
    { reward: 20, groups: [g('grunt', 3, 1.8, 'east', 1), g('grunt', 3, 1.8, 'north', 3), g('runner', 3, 2.2, 'west', 6)] },
    { reward: 24, groups: [g('grunt', 3, 1.6, 'west', 1), g('grunt', 3, 1.6, 'east', 2.5), g('runner', 4, 1.8, 'north', 5), g('brute', 1, 1, 'north', 9)] },
    { reward: 28, groups: [g('grunt', 6, 1.4, 'north', 1), g('runner', 2, 1.6, 'east', 4), g('runner', 2, 1.6, 'west', 6), g('brute', 1, 1, 'east', 8)] },
    { reward: 32, groups: [g('grunt', 4, 1.4, 'west', 1), g('runner', 5, 1.5, 'north', 3), g('brute', 1, 1, 'east', 6), g('brute', 1, 1, 'west', 12)] },
    { reward: 45, elite: true, groups: [ // elite: two Brutes press from both flanks, Runners cut through the middle
      g('brute', 1, 1, 'west', 1), g('brute', 1, 1, 'east', 1), g('runner', 4, 1.2, 'north', 4), g('grunt', 4, 1.4, 'north', 7)] },
  ],
  pine_hollow: [ // the forest hides Runners; Spitter debuts in wave 2
    { reward: 18, groups: [g('grunt', 3, 1.8, 'north', 1), g('grunt', 3, 1.8, 'south', 3), g('runner', 2, 2.0, 'east', 6)] },
    { reward: 22, groups: [g('grunt', 4, 1.7, 'west', 1), g('runner', 3, 1.8, 'north', 3), g('spitter', 2, 3.0, 'east', 6)] },
    { reward: 26, groups: [g('grunt', 5, 1.6, 'south', 1), g('runner', 3, 1.6, 'west', 3), g('brute', 1, 1, 'north', 8)] },
    { reward: 30, groups: [g('grunt', 4, 1.5, 'east', 1), g('runner', 4, 1.5, 'south', 3), g('spitter', 3, 2.4, 'north', 5)] },
    { reward: 34, groups: [g('grunt', 4, 1.5, 'north', 1), g('runner', 3, 1.5, 'east', 3), g('spitter', 2, 2.4, 'west', 5), g('brute', 1, 1, 'south', 9)] },
    { reward: 60, boss: true, groups: [
      g('gloam_warden', 1, 1, 'north', 2), g('grunt', 4, 1.5, 'south', 4),
      g('runner', 2, 1.5, 'east', 0, 0.66), g('spitter', 2, 2.0, 'west', 0, 0.33)] },
  ],
  salt_marsh: [ // pools on every approach; Husk debuts in wave 2
    { reward: 20, groups: [g('grunt', 3, 1.8, 'north', 1), g('grunt', 3, 1.8, 'west', 3), g('runner', 2, 2.0, 'east', 6)] },
    { reward: 24, groups: [g('grunt', 4, 1.7, 'south', 1), g('runner', 2, 1.8, 'north', 4), g('husk', 2, 4.0, 'east', 6)] },
    { reward: 28, groups: [g('grunt', 4, 1.6, 'east', 1), g('runner', 3, 1.6, 'south', 3), g('spitter', 2, 2.6, 'west', 5), g('brute', 1, 1, 'north', 9)] },
    { reward: 32, groups: [g('grunt', 3, 1.6, 'west', 1), g('husk', 2, 3.0, 'north', 3), g('spitter', 3, 2.4, 'south', 6)] },
    { reward: 36, groups: [g('grunt', 4, 1.5, 'north', 1), g('runner', 4, 1.5, 'east', 3), g('husk', 2, 3.0, 'west', 5), g('brute', 1, 1, 'south', 10)] },
    { reward: 40, groups: [g('grunt', 4, 1.4, 'south', 1), g('runner', 3, 1.5, 'west', 3), g('spitter', 2, 2.2, 'east', 4), g('brute', 1, 1, 'north', 8)] },
    { reward: 55, elite: true, groups: [ // elite: an armoured line with Brutes behind it
      g('husk', 3, 2.0, 'north', 1), g('brute', 1, 1, 'east', 4), g('brute', 1, 1, 'west', 4), g('runner', 4, 1.2, 'south', 7)] },
  ],
  frost_ridge: [ // three pads — mixed waves from every side
    { reward: 22, groups: [g('grunt', 3, 1.8, 'north', 1), g('grunt', 3, 1.8, 'east', 3), g('runner', 3, 2.0, 'west', 6)] },
    { reward: 26, groups: [g('grunt', 5, 1.6, 'south', 1), g('runner', 3, 1.7, 'north', 3), g('spitter', 2, 2.6, 'east', 6)] },
    { reward: 30, groups: [g('grunt', 4, 1.6, 'west', 1), g('husk', 2, 3.0, 'north', 3), g('spitter', 2, 2.4, 'south', 5), g('brute', 1, 1, 'east', 9)] },
    { reward: 34, groups: [g('grunt', 5, 1.5, 'east', 1), g('runner', 4, 1.5, 'west', 3), g('husk', 2, 3.0, 'south', 6)] },
    { reward: 38, groups: [g('grunt', 4, 1.5, 'north', 1), g('runner', 3, 1.5, 'south', 3), g('spitter', 3, 2.2, 'west', 5), g('brute', 1, 1, 'east', 9)] },
    { reward: 42, groups: [g('grunt', 4, 1.4, 'south', 1), g('runner', 3, 1.4, 'north', 3), g('husk', 2, 2.6, 'east', 5), g('spitter', 2, 2.2, 'west', 7)] },
    { reward: 60, elite: true, groups: [ // elite: everyone at once, from four sides
      g('grunt', 3, 1.4, 'north', 1), g('runner', 4, 1.2, 'east', 2), g('husk', 2, 2.4, 'west', 3),
      g('spitter', 2, 2.4, 'south', 4), g('brute', 1, 1, 'north', 7), g('brute', 1, 1, 'south', 9)] },
  ],
  black_lighthouse: [ // the finale: four sides, the Fog Mother in the final wave (15 since D60)
    { reward: 24, groups: [g('grunt', 3, 1.7, 'north', 1), g('grunt', 2, 1.7, 'south', 3), g('runner', 2, 1.8, 'east', 5)] },
    { reward: 28, groups: [g('grunt', 3, 1.6, 'west', 1), g('runner', 3, 1.6, 'east', 3), g('spitter', 1, 1, 'north', 6)] },
    { reward: 32, groups: [g('grunt', 3, 1.6, 'south', 1), g('husk', 1, 1, 'north', 3), g('spitter', 2, 2.4, 'east', 5), g('brute', 1, 1, 'west', 9)] },
    { reward: 36, groups: [g('grunt', 3, 1.5, 'east', 1), g('runner', 3, 1.5, 'west', 3), g('husk', 2, 3.0, 'south', 5)] },
    { reward: 40, groups: [g('grunt', 2, 1.5, 'north', 1), g('runner', 3, 1.4, 'south', 2), g('spitter', 2, 2.2, 'west', 4), g('brute', 1, 1, 'east', 8)] },
    { reward: 44, groups: [g('grunt', 3, 1.4, 'west', 1), g('runner', 2, 1.4, 'north', 3), g('husk', 2, 2.6, 'east', 4), g('brute', 1, 1, 'south', 9)] },
    { reward: 48, groups: [
      g('grunt', 2, 1.4, 'south', 1), g('runner', 3, 1.3, 'east', 2), g('husk', 2, 2.4, 'north', 4),
      g('spitter', 2, 2.2, 'west', 5)] },
    { reward: 80, boss: true, groups: [
      g('fog_mother', 1, 1, 'north', 2), g('runner', 2, 1.4, 'south', 5),
      g('husk', 1, 1, 'east', 0, 0.66), g('spitter', 1, 1, 'west', 0, 0.4)] },
  ],
};

/**
 * D60 (user decision): more waves on maps 2–6 — +4…+7 in map order, inserted before the final (boss / elite) wave.
 * An extra wave repeats one of the map's last three regular waves (in turn, sides rotated), with `power` = HP and
 * damage multiplier of its enemies: +20 % over the previous extra wave (1.2, 1.4, …). The final wave keeps the last
 * step for its enemies (the boss itself is not scaled — its HP has bossHpMult). Rewards: +4 coins per extra wave.
 */
export const EXTRA_WAVES = { drowned_pier: 4, pine_hollow: 5, salt_marsh: 6, frost_ridge: 6, black_lighthouse: 7 };
export const WAVE_POWER_STEP = 0.2;

function extendWaves(list, n) {
  const final = list[list.length - 1], regular = list.slice(0, -1);
  const sides = [...new Set(regular.flatMap((w) => w.groups.map((x) => x.spawnPointGroup)))];
  const lastReward = regular[regular.length - 1].reward;
  const out = [...regular];
  for (let k = 1; k <= n; k++) {
    const tpl = regular[regular.length - 1 - ((k - 1) % Math.min(3, regular.length))];
    out.push({
      reward: lastReward + 4 * k,
      power: Math.round((1 + WAVE_POWER_STEP * k) * 100) / 100,
      groups: tpl.groups.map((x) => ({ ...x, spawnPointGroup: sides[(sides.indexOf(x.spawnPointGroup) + k) % sides.length] })),
    });
  }
  out.push({ ...final, power: Math.round((1 + WAVE_POWER_STEP * n) * 100) / 100 });
  return out;
}
for (const id in EXTRA_WAVES) WAVES[id] = extendWaves(WAVES[id], EXTRA_WAVES[id]);

/** Wave group shorthand (data only). */
function g(enemyId, count, spawnInterval, spawnPointGroup, initialDelay, bossHpBelow) {
  const o = { enemyId, count, spawnInterval, spawnPointGroup, initialDelay };
  if (bossHpBelow > 0) o.bossHpBelow = bossHpBelow;
  return o;
}

export const getWaves = (mapId) => WAVES[mapId] || null;
