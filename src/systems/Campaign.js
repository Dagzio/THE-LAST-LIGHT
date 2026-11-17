// Campaign: level order and unlock state from data/levels + the profile. Pure helpers — core/Progress.js is the only
// code that writes the profile (completedLevels / unlockedLevels).
import { LEVELS, getLevel } from '../data/levels/index.js';

/** Id of the level unlocked by winning `id`, or null if it is the last one. */
export function nextLevelId(id) {
  const m = getLevel(id);
  if (!m) return null;
  if (m.next) return getLevel(m.next) ? m.next : null;
  const i = LEVELS.findIndex((x) => x.id === id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1].id : null;
}

export const isLastLevel = (id) => !nextLevelId(id);

export function unlockedLevels(profile) {
  return LEVELS.filter((m) => m.alwaysOpen || profile.unlockedLevels.includes(m.id)); // D88: the training ground
}

/** H5 §11: level select opens on the newest unlocked level that is not cleared yet (else the last unlocked). */
export function defaultLevelSelection(profile) {
  const open = unlockedLevels(profile);
  const fresh = open.find((m) => !profile.completedLevels.includes(m.id));
  return (fresh || open[open.length - 1] || LEVELS[0]).id;
}
