// PHASE 2 TEST HARNESS — static test Grunts to verify targeting and combat without waves.
// Replaced by the WaveSystem in Phase 4 (delete this file then).

export const TEST_ARENA = {
  dummies: [
    { enemyId: 'grunt', x: 760, y: 640 },
    { enemyId: 'grunt', x: 1260, y: 700 },
    { enemyId: 'grunt', x: 1150, y: 1010 },
    { enemyId: 'grunt', x: 380, y: 300 },   // far away: off-screen indicator check
    { enemyId: 'grunt', x: 1720, y: 1120 }, // far away: off-screen indicator check
  ],
  respawnDelay: 2.0, // s of game time after the last dummy dies
};
