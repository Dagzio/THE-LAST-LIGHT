// TEST HARNESS (Phases 3–4, user decision D36) — until the shop (Phase 5) exists:
// both build pads get a device through the SAME placement command the shop will use (no debug keys/flags).
// Enemies come from the real WaveSystem since Phase 4. Delete this file in Phase 5 (pads start empty).

export const TEST_ARENA = {
  devices: [
    { padIndex: 0, defenseId: 'guard_turret' },
    { padIndex: 1, defenseId: 'frost_coil' },
  ],
};
