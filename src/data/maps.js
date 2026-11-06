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
  },
];

export const getMap = (id) => MAPS.find((m) => m.id === id) || null;
