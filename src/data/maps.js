// Campaign maps (data-driven, 04_ARCH §11). Six maps (user decision D45, 2026-11-08): every map has its own theme
// (data/themes.js), decor, waves (data/waves.js) and ONE gameplay feature. Map 1 is unchanged.
// waveCount is shown on the map card and must equal the wave config length in data/waves.js (unit-tested).
// D52 difficulty (user decision): enemyHpMult scales enemy HP, enemyDamageMult every damage they deal (attacks, contact,
// boss attacks), bossHpMult is extra boss HP on top (maps 2+; D55: 1.4 × 1.25 = 1.75); rewardMult scales kill rewards (coins and XP, rounded).
// buildPads[].name → shop label key shop.pad.<name>.
// decor: scattered props (systems/Props.js) — `kinds` is a pick list (repeats = weight), `clear` keeps the plaza and
// the kiosk zone free, `border` is the prop kind along the playable edges (`borderSides` limits the edges), `groves`
// are fixed clusters inside the clearing (Pine Hollow: they block turret line of sight on purpose).
// slowZones: circles that slow everyone inside (Salt Marsh feature), × slowZoneMult on movement speed.
import { KIOSK } from './kiosk.js';

const SIDES4 = (w, h) => ({
  north: [{ x: w / 2, y: 30 }, { x: w / 2 - 240, y: 30 }, { x: w / 2 + 240, y: 30 }],
  south: [{ x: w / 2, y: h - 30 }, { x: w / 2 - 240, y: h - 30 }, { x: w / 2 + 240, y: h - 30 }],
  west: [{ x: 30, y: h / 2 }, { x: 30, y: h / 2 - 190 }, { x: 30, y: h / 2 + 190 }],
  east: [{ x: w - 30, y: h / 2 }, { x: w - 30, y: h / 2 - 190 }, { x: w - 30, y: h / 2 + 190 }],
});

export const MAPS = [
  {
    id: 'ashen_coast',
    nameKey: 'map.ashen_coast.name',
    descKey: 'map.ashen_coast.desc',
    theme: 'ash',
    waveCount: 5,
    finalWaveBoss: true,
    completionReward: 50, // coins, once on victory (03_ECONOMY §4)
    crateWaves: [2, 3], // D52: the first map has a crate on wave 3 and on wave 4, no other (learns the basics first)
    enemyHpMult: 1,
    enemyDamageMult: 1,
    bossHpMult: 1,
    rewardMult: 1.0,
    artSeed: 7331, // cosmetic decoration layout of the arena ground
    width: 2000,   // world units (3D map, decision 2026-11-06: bigger map, camera follows the player)
    height: 1300,
    playerSpawn: { x: 1000, y: 820 },
    beacon: { x: 1000, y: 650 },                         // centre of the old stone plaza
    buildPads: [{ x: 850, y: 650, name: 'west' }, { x: 1150, y: 650, name: 'east' }],
    spawnPoints: SIDES4(2000, 1300),
    decor: { count: 46, clear: KIOSK.maxDistFromBeacon + 50, kinds: ['rock', 'ruin', 'stump', 'post'], border: 'rock' },
  },
  {
    // Feature: the sea is south — enemies come from three sides only, through narrow approaches.
    id: 'drowned_pier',
    nameKey: 'map.drowned_pier.name',
    descKey: 'map.drowned_pier.desc',
    featureKey: 'feature.drowned_pier',
    theme: 'pier',
    waveCount: 10, // D60: 6 + 4
    finalWaveBoss: false,
    completionReward: 70,
    enemyHpMult: 1.2,
    enemyDamageMult: 1.25,
    bossHpMult: 1.75, // D55: +25 % (was 1.4)
    rewardMult: 1.1,
    artSeed: 9127,
    width: 2000,
    height: 1150,
    playerSpawn: { x: 1000, y: 1010 },
    beacon: { x: 1000, y: 840 },                         // on the pier head, the sea behind it
    buildPads: [{ x: 850, y: 840, name: 'west' }, { x: 1150, y: 840, name: 'east' }],
    spawnPoints: {
      north: [{ x: 1000, y: 30 }, { x: 720, y: 30 }, { x: 1280, y: 30 }],
      west: [{ x: 30, y: 420 }, { x: 30, y: 620 }, { x: 30, y: 820 }],
      east: [{ x: 1970, y: 420 }, { x: 1970, y: 620 }, { x: 1970, y: 820 }],
    },
    decor: {
      count: 52, clear: 400, kinds: ['crate', 'barrel', 'bollard', 'planks', 'rock', 'post'], border: 'rock',
      borderSides: ['north', 'west', 'east'], seaSouth: true,
    },
  },
  {
    // Feature: a dense pine forest — trees block bullets and the turrets' line of sight.
    id: 'pine_hollow',
    nameKey: 'map.pine_hollow.name',
    descKey: 'map.pine_hollow.desc',
    featureKey: 'feature.pine_hollow',
    theme: 'forest',
    waveCount: 11, // D60: 6 + 5
    finalWaveBoss: true,
    completionReward: 90,
    enemyHpMult: 1.35,
    enemyDamageMult: 1.45,
    bossHpMult: 1.75, // D55: +25 % (was 1.4)
    rewardMult: 1.2,
    artSeed: 4481,
    width: 2000,
    height: 1300,
    playerSpawn: { x: 1000, y: 820 },
    beacon: { x: 1000, y: 650 },
    buildPads: [{ x: 850, y: 650, name: 'west' }, { x: 1150, y: 650, name: 'east' }],
    spawnPoints: SIDES4(2000, 1300),
    decor: {
      count: 170, clear: 330, kinds: ['pine', 'pine', 'pine', 'pine', 'deadtree', 'rock', 'stump'], border: 'pine', pathHalf: 52,
      // four small groves on the diagonals inside the clearing (inside turret range of the pads)
      groves: [{ x: 1180, y: 470, n: 3 }, { x: 820, y: 470, n: 3 }, { x: 820, y: 830, n: 2 }, { x: 1180, y: 830, n: 3 }],
    },
  },
  {
    // Feature: salt pools slow everyone inside (enemies and the keeper) — Cryo grenades and the Frost Coil combo well.
    id: 'salt_marsh',
    nameKey: 'map.salt_marsh.name',
    descKey: 'map.salt_marsh.desc',
    featureKey: 'feature.salt_marsh',
    theme: 'marsh',
    waveCount: 13, // D60: 7 + 6
    finalWaveBoss: false,
    completionReward: 110,
    enemyHpMult: 1.5,
    enemyDamageMult: 1.65,
    bossHpMult: 1.75, // D55: +25 % (was 1.4)
    rewardMult: 1.3,
    artSeed: 6203,
    width: 2000,
    height: 1300,
    playerSpawn: { x: 1000, y: 820 },
    beacon: { x: 1000, y: 650 },
    buildPads: [{ x: 850, y: 650, name: 'west' }, { x: 1150, y: 650, name: 'east' }],
    spawnPoints: SIDES4(2000, 1300),
    slowZoneMult: 0.6, // −40 % movement inside a pool
    slowZones: [
      { x: 1000, y: 250, r: 95 }, { x: 540, y: 650, r: 90 }, { x: 1460, y: 650, r: 90 }, { x: 1000, y: 1060, r: 95 },
      { x: 420, y: 290, r: 120 }, { x: 1600, y: 1010, r: 120 }, { x: 1560, y: 300, r: 85 }, { x: 440, y: 1020, r: 95 },
    ],
    decor: { count: 64, clear: 380, kinds: ['reeds', 'reeds', 'saltrock', 'deadtree', 'post', 'rock'], border: 'rock' },
  },
  {
    // Feature: a third device pad north of the beacon.
    id: 'frost_ridge',
    nameKey: 'map.frost_ridge.name',
    descKey: 'map.frost_ridge.desc',
    featureKey: 'feature.frost_ridge',
    theme: 'ice',
    waveCount: 13, // D60: 7 + 6
    finalWaveBoss: false,
    completionReward: 130,
    enemyHpMult: 1.7,
    enemyDamageMult: 1.85,
    bossHpMult: 1.75, // D55: +25 % (was 1.4)
    rewardMult: 1.4,
    artSeed: 3319,
    width: 2000,
    height: 1300,
    playerSpawn: { x: 1000, y: 870 },
    beacon: { x: 1000, y: 700 },
    buildPads: [{ x: 850, y: 700, name: 'west' }, { x: 1150, y: 700, name: 'east' }, { x: 1000, y: 550, name: 'north' }],
    spawnPoints: SIDES4(2000, 1300),
    decor: { count: 62, clear: 380, kinds: ['icespike', 'icespike', 'snowrock', 'snowrock', 'rock', 'deadtree'], border: 'snowrock' },
  },
  {
    // Final map: attacks from all four sides, the Fog Mother at the end.
    id: 'black_lighthouse',
    nameKey: 'map.black_lighthouse.name',
    descKey: 'map.black_lighthouse.desc',
    featureKey: 'feature.black_lighthouse',
    theme: 'black',
    waveCount: 15, // D60: 8 + 7
    finalWaveBoss: true,
    completionReward: 180,
    enemyHpMult: 1.9,
    enemyDamageMult: 2.1,
    bossHpMult: 1.75, // D55: +25 % (was 1.4)
    crateGuaranteedWaves: [0], // D52: the last map gives a crate on wave 1 for sure, then the 50 / 50 rule
    rewardMult: 1.5,
    artSeed: 8805,
    width: 2000,
    height: 1300,
    playerSpawn: { x: 1000, y: 820 },
    beacon: { x: 1000, y: 650 },
    buildPads: [{ x: 850, y: 650, name: 'west' }, { x: 1150, y: 650, name: 'east' }],
    spawnPoints: SIDES4(2000, 1300),
    decor: { count: 58, clear: 400, kinds: ['basalt', 'basalt', 'ruin', 'ember', 'rock'], border: 'basalt' },
  },
];

export const getMap = (id) => MAPS.find((m) => m.id === id) || null;

/** Is the point inside a slow zone of the map? (Salt Marsh) */
export function inSlowZone(map, x, y) {
  const zones = map.slowZones;
  if (!zones) return false;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i], dx = x - z.x, dy = y - z.y;
    if (dx * dx + dy * dy <= z.r * z.r) return true;
  }
  return false;
}

/** Speed multiplier of the terrain under a body (1 = normal ground). */
export const terrainSpeed = (map, x, y) => (inSlowZone(map, x, y) ? map.slowZoneMult || 1 : 1);
