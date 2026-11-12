// Save Manager (02_SPEC §15): the only owner of the persistent PlayerProfile in storage.
// load → parse → migrate → validate/normalise; a corrupted save falls back to the backup, then to a default profile,
// and reports it (status) so the UI can show a clear message — never a crash. Every successful save also keeps the
// previous valid save as a backup. No live map state is saved (a reload restarts the map, the profile stays).
import { Storage } from '../platform/StorageService.js';
import { WEAPONS } from '../data/weapons.js';
import { WEAPON_NODES, UPGRADE_NODES, WEAPON_UPGRADE, PLAYER_UPGRADES, estimateWeaponSpent } from '../data/upgrades.js';
import { MAPS } from '../data/maps.js';
import { levelForXp } from '../data/progression.js';
import { TUTORIAL_STEP_IDS } from '../data/tutorial.js';
import { INTRO_IDS } from '../data/intros.js';

// v2 (Phase 7b): + tutorial { done, seen[] }
export const SCHEMA_VERSION = 2;
export const PROFILE_KEY = 'profile';
export const BACKUP_KEY = 'profile.backup';
const MAX_COINS = 1e9;
const MAX_XP = 1e9;

export function createDefaultProfile() {
  return {
    schemaVersion: SCHEMA_VERSION,
    coins: 0,
    totalXp: 0,
    playerLevel: 1,
    ownedWeapons: ['pistol'],
    equippedWeaponId: 'pistol',
    weaponProgress: { pistol: { level: 1, upgrades: {}, spent: 0 } }, // spent (D63): coins put into it, for selling
    playerUpgrades: {},
    unlockedMaps: [MAPS[0].id],
    completedMaps: [],
    statistics: { totalKills: 0, mapsWon: 0, mapsFailed: 0 },
    tutorial: { done: false, seen: [] },
    intros: [], // D45: one-time new enemy / map feature cards already shown (missing in older saves → [])
  };
}

/** Brings older schemas up to the current one. Unknown (future) versions are rejected (null). */
export function migrateProfile(data) {
  if (!data || typeof data !== 'object') return null;
  let d = data;
  if (d.schemaVersion === 1) {
    // v1 → v2: tutorial flag. A player who already played (has XP) is not sent through the tutorial again.
    d = { ...d, schemaVersion: 2, tutorial: { done: (d.totalXp | 0) > 0, seen: [] } };
  }
  if (d.schemaVersion === SCHEMA_VERSION) return d;
  return null; // a future version is not understood
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
  const fix = (cond) => { if (!cond) repaired = true; };

  const coins = int(data.coins, 0, MAX_COINS);
  fix(coins !== null && coins === data.coins);
  p.coins = coins ?? 0;
  const xp = int(data.totalXp, 0, MAX_XP);
  fix(xp !== null && xp === data.totalXp);
  p.totalXp = xp ?? 0;
  p.playerLevel = levelForXp(p.totalXp); // derived, never trusted
  fix(data.playerLevel === p.playerLevel);

  const owned = Array.isArray(data.ownedWeapons) ? data.ownedWeapons.filter((id) => WEAPONS[id] && WEAPONS[id].inMvp) : [];
  if (!owned.includes('pistol')) owned.unshift('pistol');
  p.ownedWeapons = [...new Set(owned)];
  fix(Array.isArray(data.ownedWeapons) && p.ownedWeapons.length === data.ownedWeapons.length);
  p.equippedWeaponId = p.ownedWeapons.includes(data.equippedWeaponId) ? data.equippedWeaponId : 'pistol';
  fix(p.equippedWeaponId === data.equippedWeaponId);

  p.weaponProgress = {};
  const wp = data.weaponProgress && typeof data.weaponProgress === 'object' ? data.weaponProgress : {};
  for (const id of p.ownedWeapons) {
    const src = wp[id] && typeof wp[id].upgrades === 'object' && wp[id].upgrades ? wp[id].upgrades : {};
    const upgrades = {};
    let total = 0;
    for (const nodeId of WEAPON_NODES[id] || []) {
      let r = int(src[nodeId], 0, UPGRADE_NODES[nodeId].max) ?? 0;
      fix(src[nodeId] === undefined || r === src[nodeId]);
      r = Math.min(r, WEAPON_UPGRADE.maxWeaponLevel - 1 - total); // weaponLevel never above the cap (12)
      if (r > 0) upgrades[nodeId] = r;
      total += r;
    }
    // D63: coins spent on the weapon (selling). Older saves have none → estimated from the price and the ranks.
    const spent = wp[id] ? int(wp[id].spent, 0, MAX_COINS) : null;
    p.weaponProgress[id] = { level: 1 + total, upgrades, spent: spent ?? estimateWeaponSpent(id, WEAPONS[id].price, upgrades) };
    fix(wp[id] && wp[id].level === 1 + total);
  }

  const pu = data.playerUpgrades && typeof data.playerUpgrades === 'object' ? data.playerUpgrades : {};
  for (const id of Object.keys(PLAYER_UPGRADES)) {
    const r = int(pu[id], 0, PLAYER_UPGRADES[id].max) ?? 0;
    fix(pu[id] === undefined || r === pu[id]);
    if (r > 0) p.playerUpgrades[id] = r;
  }

  const mapIds = new Set(MAPS.map((m) => m.id));
  const unlocked = Array.isArray(data.unlockedMaps) ? data.unlockedMaps.filter((id) => mapIds.has(id)) : [];
  if (!unlocked.includes(MAPS[0].id)) unlocked.unshift(MAPS[0].id);
  p.unlockedMaps = [...new Set(unlocked)];
  p.completedMaps = Array.isArray(data.completedMaps) ? [...new Set(data.completedMaps.filter((id) => mapIds.has(id)))] : [];

  const st = data.statistics && typeof data.statistics === 'object' ? data.statistics : {};
  for (const k of Object.keys(p.statistics)) p.statistics[k] = int(st[k], 0, MAX_COINS) ?? 0;

  const tu = data.tutorial && typeof data.tutorial === 'object' ? data.tutorial : {};
  fix(typeof tu.done === 'boolean');
  p.tutorial.done = tu.done === true;
  p.tutorial.seen = Array.isArray(tu.seen) ? [...new Set(tu.seen.filter((id) => TUTORIAL_STEP_IDS.includes(id)))] : [];
  p.intros = Array.isArray(data.intros) ? [...new Set(data.intros.filter((id) => INTRO_IDS.includes(id)))] : [];
  return { profile: p, repaired };
}

function parse(raw) {
  if (raw === null || raw === undefined) return { missing: true, profile: null };
  try {
    const migrated = migrateProfile(JSON.parse(raw));
    return { missing: false, ...validateProfile(migrated) };
  } catch (e) {
    return { missing: false, profile: null };
  }
}

export class SaveManager {
  /** @param {typeof Storage} storage */
  constructor(storage = Storage) {
    this.storage = storage;
  }

  /**
   * @returns {{profile: object, status: 'new'|'ok'|'repaired'|'restored-backup'|'reset-corrupt'}}
   */
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
