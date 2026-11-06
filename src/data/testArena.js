// PHASE 2 TEST HARNESS — static test Grunts to verify targeting and combat without waves.
// Replaced by the WaveSystem in Phase 4 (delete this file then).

export const TEST_ARENA = {
  dummies: [
    { enemyId: 'grunt', x: 360, y: 200 },
    { enemyId: 'grunt', x: 980, y: 260 },
    { enemyId: 'grunt', x: 820, y: 560 },
  ],
  respawnDelay: 2.0, // s of game time after the last dummy dies
};
