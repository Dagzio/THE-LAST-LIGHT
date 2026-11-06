// Campaign (Phase 7): map order and unlock state from data/maps.js + the profile. Pure helpers — the Economy is the
// only code that writes the profile (completedMaps / unlockedMaps). Adding a map = adding an entry to MAPS
// (optional `next` id; otherwise the next map in the list).
import { MAPS, getMap } from '../data/maps.js';

/** Id of the map unlocked by winning `id`, or null if it is the last one. */
export function nextMapId(id) {
  const m = getMap(id);
  if (!m) return null;
  if (m.next) return getMap(m.next) ? m.next : null;
  const i = MAPS.findIndex((x) => x.id === id);
  return i >= 0 && i < MAPS.length - 1 ? MAPS[i + 1].id : null;
}

export const isLastMap = (id) => !nextMapId(id);

/** Maps the player can open (H5: locked / non-existing maps are not shown). */
export function unlockedMaps(profile) {
  return MAPS.filter((m) => profile.unlockedMaps.includes(m.id));
}

/** H5 §11: map select opens on the newest unlocked map that is not cleared yet (else the last unlocked). */
export function defaultMapSelection(profile) {
  const open = unlockedMaps(profile);
  const fresh = open.find((m) => !profile.completedMaps.includes(m.id));
  return (fresh || open[open.length - 1] || MAPS[0]).id;
}

/** Campaign totals for the Congrats screen. */
export function campaignSummary(profile) {
  return {
    mapsCleared: profile.completedMaps.length,
    mapsTotal: MAPS.length,
    totalKills: profile.statistics.totalKills,
    level: profile.playerLevel,
  };
}
