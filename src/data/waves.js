// Wave compositions per map (02_SPEC §11, 03_ECONOMY §4 and §10). Data only — the WaveSystem runs them.
// Group: enemyId, count, spawnInterval (s), spawnPointGroup (key of map.spawnPoints), initialDelay (s from the wave
// start). Optional `bossHpBelow`: the group starts only when the alive boss falls below that HP fraction (boss adds);
// if the boss dies first, the group is skipped. `reward` = wave-clear coin bonus (granted once).

export const WAVE_TIMING = {
  intro: 3.0,              // s of "GET READY" before wave 1
  intermission: 20.0,      // s between waves (START NEXT WAVE skips it)
  maxAliveAdds: 8,         // boss wave: cap of alive non-boss enemies (adds wait while the cap is reached)
};

export const WAVES = {
  ashen_coast: [
    { // 1 — 8 Grunt: learn to shoot and move
      reward: 15,
      groups: [
        { enemyId: 'grunt', count: 4, spawnInterval: 2.0, spawnPointGroup: 'north', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 4, spawnInterval: 2.0, spawnPointGroup: 'east', initialDelay: 5.0 },
      ],
    },
    { // 2 — 8 Grunt + 3 Runner: pressure by speed
      reward: 20,
      groups: [
        { enemyId: 'grunt', count: 4, spawnInterval: 1.8, spawnPointGroup: 'west', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 4, spawnInterval: 1.8, spawnPointGroup: 'south', initialDelay: 3.0 },
        { enemyId: 'runner', count: 3, spawnInterval: 2.5, spawnPointGroup: 'north', initialDelay: 7.0 },
      ],
    },
    { // 3 — 8 Grunt + 4 Runner + 1 Brute: target priority
      reward: 25,
      groups: [
        { enemyId: 'grunt', count: 4, spawnInterval: 1.6, spawnPointGroup: 'north', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 4, spawnInterval: 1.6, spawnPointGroup: 'east', initialDelay: 2.5 },
        { enemyId: 'runner', count: 2, spawnInterval: 2.0, spawnPointGroup: 'south', initialDelay: 5.0 },
        { enemyId: 'runner', count: 2, spawnInterval: 2.0, spawnPointGroup: 'west', initialDelay: 7.0 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'west', initialDelay: 9.0 },
      ],
    },
    { // 4 — 10 Grunt + 5 Runner + 2 Brute: tests the shop / defenses
      reward: 30,
      groups: [
        { enemyId: 'grunt', count: 5, spawnInterval: 1.5, spawnPointGroup: 'north', initialDelay: 1.0 },
        { enemyId: 'grunt', count: 5, spawnInterval: 1.5, spawnPointGroup: 'south', initialDelay: 2.0 },
        { enemyId: 'runner', count: 3, spawnInterval: 1.8, spawnPointGroup: 'east', initialDelay: 5.0 },
        { enemyId: 'runner', count: 2, spawnInterval: 1.8, spawnPointGroup: 'west', initialDelay: 8.0 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'east', initialDelay: 6.0 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'west', initialDelay: 14.0 },
      ],
    },
    { // 5 — Gloam Warden + limited adds by boss HP
      reward: 50,
      boss: true,
      groups: [
        { enemyId: 'gloam_warden', count: 1, spawnInterval: 1.0, spawnPointGroup: 'north', initialDelay: 2.0 },
        { enemyId: 'grunt', count: 4, spawnInterval: 1.5, spawnPointGroup: 'south', initialDelay: 4.0 },
        { enemyId: 'runner', count: 3, spawnInterval: 1.5, spawnPointGroup: 'east', initialDelay: 0, bossHpBelow: 0.66 },
        { enemyId: 'grunt', count: 4, spawnInterval: 1.5, spawnPointGroup: 'west', initialDelay: 0, bossHpBelow: 0.33 },
        { enemyId: 'brute', count: 1, spawnInterval: 1.0, spawnPointGroup: 'north', initialDelay: 1.0, bossHpBelow: 0.33 },
      ],
    },
  ],
};

export const getWaves = (mapId) => WAVES[mapId] || null;
