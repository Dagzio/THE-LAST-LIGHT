// D85 (user request): one demo level, three modes — MISSION (the level as it was), STEALTH (a different job done
// unseen) and SURVIVAL (endless waves, supplies around the office). Design: MODES_DESIGN_D85.md.
// A level lists its modes (level.modes: mode id → override); resolveLevel() merges the chosen mode's override over the
// base level. Overrides never change the office itself (walls, rooms, furniture) — only who is where and what to do.

export const MODE_IDS = ['mission', 'stealth', 'survival'];

export const MODES = {
  mission: { id: 'mission', nameKey: 'mode.mission.name', descKey: 'mode.mission.desc' },
  stealth: { id: 'stealth', nameKey: 'mode.stealth.name', descKey: 'mode.stealth.desc' },
  survival: { id: 'survival', nameKey: 'mode.survival.name', descKey: 'mode.survival.desc' },
};

/** The modes a level offers, in the order of MODE_IDS (a level without `modes` has the mission only). */
export function levelModes(level) {
  if (!level || !level.modes) return ['mission'];
  return MODE_IDS.filter((id) => id === 'mission' || level.modes[id]);
}

/**
 * The level data of one mode: the base level + its override. Mission → the base level itself (unchanged behaviour).
 * Doors are overridden by id (partial fields); survival builds its pickups from its spots (dormant until spawned).
 */
export function resolveLevel(level, modeId) {
  if (level && level.fixedMode) return { ...level, modeId: level.fixedMode }; // D88: the training ground — its lessons only
  const ov = level && level.modes && level.modes[modeId];
  if (!ov || modeId === 'mission') return { ...level, modeId: 'mission' };
  const doors = level.doors.map((d) => (ov.doors && ov.doors[d.id] ? { ...d, ...ov.doors[d.id] } : d));
  const out = { ...level, ...ov, doors, modeId, modes: undefined };
  if (ov.pickupSpots) {
    out.pickups = [
      ...ov.pickupSpots.crate.map(([x, y], i) => ({ id: `crate${i}`, kind: 'crate', item: null, x, y, dormant: true })),
    ];
  }
  return out;
}
