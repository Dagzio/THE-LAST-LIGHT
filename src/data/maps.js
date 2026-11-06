// Campaign maps (data-driven, 04_ARCH §11). MVP: one map.
// waveCount is shown on the map card; Phase 4 must keep it equal to the wave config length.

export const MAPS = [
  {
    id: 'ashen_coast',
    nameKey: 'map.ashen_coast.name',
    descKey: 'map.ashen_coast.desc',
    waveCount: 5,
    finalWaveBoss: true,
    artSeed: 7331, // cosmetic decoration layout of the arena ground
    width: 2000,   // world units (3D map, decision 2026-11-06: bigger map, camera follows the player)
    height: 1300,
    playerSpawn: { x: 1000, y: 820 },
    beacon: { x: 1000, y: 650 },                         // centre of the old stone plaza
    buildPads: [{ x: 850, y: 650 }, { x: 1150, y: 650 }], // MVP: two fixed pads next to the beacon
    // Fixed spawn points on the edges, by group (waves pick a group in Phase 4).
    spawnPoints: {
      north: [{ x: 1000, y: 30 }, { x: 760, y: 30 }, { x: 1240, y: 30 }],
      south: [{ x: 1000, y: 1270 }, { x: 760, y: 1270 }, { x: 1240, y: 1270 }],
      west: [{ x: 30, y: 650 }, { x: 30, y: 460 }, { x: 30, y: 840 }],
      east: [{ x: 1970, y: 650 }, { x: 1970, y: 460 }, { x: 1970, y: 840 }],
    },
  },
];

export const getMap = (id) => MAPS.find((m) => m.id === id) || null;
