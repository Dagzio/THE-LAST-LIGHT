// Save Manager (02_SPEC §15): the only owner of the persistent profile in storage.
// load → parse → migrate → validate/normalise; a corrupted save falls back to the backup, then to a default profile,
// and reports it (status) so the UI can show a clear message — never a crash. Every successful save also keeps the
// previous valid save as a backup. No live level state is saved (a reload restarts the level, the profile stays).
// KILL LIST (D78) — schema 3: the campaign of levels. Profiles of THE LAST LIGHT (schema 1–2) belong to another game:
// they live under the old storage prefix and are never read.
import { Storage } from '../platform/StorageService.js';
import { LEVELS } from '../data/levels/index.js';

export const SCHEMA_VERSION = 3;
export const PROFILE_KEY = 'profile';
export const BACKUP_KEY = 'profile.backup';
const MAX_N = 1e9;

export function createDefaultProfile() {
  return {
    schemaVersion: SCHEMA_VERSION,
    unlockedLevels: [LEVELS[0].id],
    completedLevels: [],
    bestTimes: {},            // level id → seconds of the fastest win
    statistics: { totalKills: 0, levelsWon: 0, levelsFailed: 0 },
  };
}

/** Brings older schemas up to the current one. Unknown versions are rejected (null). */
export function migrateProfile(data) {
  if (!data || typeof data !== 'object') return null;
  return data.schemaVersion === SCHEMA_VERSION ? data : null;
}

const int = (v, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : null);

/**
 * Validates and normalises a (migrated) profile. Never throws.
 * @returns {{profile: object|null, repaired: boolean}} profile null = unusable
 */
export function validateProfile(data) {
  if (!data || typeof data !== 'object' || data.schemaVersion !== SCHEMA_VERSION) return { profile: null, repaired: false };
  const p = createDefaultProfile();
  let repaired = false;
  const ids = new Set(LEVELS.map((m) => m.id));
  const unlocked = Array.isArray(data.unlockedLevels) ? data.unlockedLevels.filter((id) => ids.has(id)) : [];
  if (!unlocked.includes(LEVELS[0].id)) { unlocked.unshift(LEVELS[0].id); repaired = true; }
  p.unlockedLevels = [...new Set(unlocked)];
  p.completedLevels = Array.isArray(data.completedLevels) ? [...new Set(data.completedLevels.filter((id) => ids.has(id)))] : [];
  const bt = data.bestTimes && typeof data.bestTimes === 'object' ? data.bestTimes : {};
  for (const id of Object.keys(bt)) {
    const v = Number(bt[id]);
    if (ids.has(id) && Number.isFinite(v) && v > 0) p.bestTimes[id] = Math.round(v * 10) / 10;
  }
  const st = data.statistics && typeof data.statistics === 'object' ? data.statistics : {};
  for (const k of Object.keys(p.statistics)) {
    const v = int(st[k], 0, MAX_N);
    if (v === null && st[k] !== undefined) repaired = true;
    p.statistics[k] = v ?? 0;
  }
  return { profile: p, repaired };
}

function parse(raw) {
  if (raw === null || raw === undefined) return { missing: true, profile: null };
  try {
    return { missing: false, ...validateProfile(migrateProfile(JSON.parse(raw))) };
  } catch (e) {
    return { missing: false, profile: null };
  }
}

export class SaveManager {
  /** @param {typeof Storage} storage */
  constructor(storage = Storage) { this.storage = storage; }

  /** @returns {{profile: object, status: 'new'|'ok'|'repaired'|'restored-backup'|'reset-corrupt'}} */
  loadProfile() {
    const main = parse(this.storage.get(PROFILE_KEY, null));
    if (main.missing) return { profile: createDefaultProfile(), status: 'new' };
    if (main.profile) return { profile: main.profile, status: main.repaired ? 'repaired' : 'ok' };
    const backup = parse(this.storage.get(BACKUP_KEY, null));
    if (backup.profile) {
      this._write(PROFILE_KEY, backup.profile);
      return { profile: backup.profile, status: 'restored-backup' };
    }
    const fresh = createDefaultProfile();
    this._write(PROFILE_KEY, fresh);
    return { profile: fresh, status: 'reset-corrupt' };
  }

  /** Saves a valid profile; the previous valid save becomes the backup. Returns false if storage failed. */
  saveProfile(profile) {
    const { profile: clean } = validateProfile(profile);
    if (!clean) return false;
    const prev = this.storage.get(PROFILE_KEY, null);
    if (prev !== null && parse(prev).profile) this.storage.set(BACKUP_KEY, prev);
    return this._write(PROFILE_KEY, clean);
  }

  _write(key, profile) {
    try { return this.storage.set(key, JSON.stringify(profile)); } catch (e) { return false; }
  }
}
