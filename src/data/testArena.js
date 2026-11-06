// TEST HARNESS (Phases 2–3) — until waves (Phase 4) and the shop (Phase 5) exist:
// - Grunts keep coming from the map edges towards the beacon at a fixed interval (capped);
// - both build pads get a device through the SAME placement command the shop will use (no debug keys/flags).
// Replaced by the WaveSystem in Phase 4 and the shop in Phase 5 (delete this file then).

export const TEST_ARENA = {
  spawn: {
    enemyId: 'grunt',
    firstDelay: 2.0,     // s of game time after the map start
    interval: 3.5,       // s between spawns
    maxAlive: 7,         // never more alive test enemies than this
    groups: ['north', 'east', 'south', 'west'], // cycles through the map's spawn groups
  },
  devices: [
    { padIndex: 0, defenseId: 'guard_turret' },
    { padIndex: 1, defenseId: 'frost_coil' },
  ],
};
