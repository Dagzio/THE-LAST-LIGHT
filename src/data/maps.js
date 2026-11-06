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
    playerSpawn: { x: 640, y: 470 },
  },
];

export const getMap = (id) => MAPS.find((m) => m.id === id) || null;
