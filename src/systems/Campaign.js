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

/**
 * Is a level open in this profile? D88: an always-open level (the training ground) is; D90 (user): a level that
 * `requires` another is closed until that one is completed (the office waits for the training ground — old saves too).
 */
export function isLevelOpen(profile, level) {
  if (!level) return false;
  if (level.alwaysOpen) return true;
  return profile.unlockedLevels.includes(level.id) && (!level.requires || profile.completedLevels.includes(level.requires));
}

export function unlockedLevels(profile) {
  return LEVELS.filter((m) => isLevelOpen(profile, m));
}

/** H5 §11: level select opens on the newest unlocked level that is not cleared yet (else the last unlocked). */
export function defaultLevelSelection(profile) {
  const open = unlockedLevels(profile);
  const fresh = open.find((m) => !profile.completedLevels.includes(m.id));
  return (fresh || open[open.length - 1] || LEVELS[0]).id;
}
