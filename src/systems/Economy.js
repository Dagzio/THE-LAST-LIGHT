// Economy / Progression API (02_SPEC §12, 03_ECONOMY): the only code that changes the PlayerProfile.
// Rewards: kill (coins + XP), wave bonus and map completion (coins) — callers guarantee "once" per enemy/wave/map
// and the economy just books them. Purchases follow validate → debit → apply → save → notify; an invalid purchase
// changes nothing. Offers (state + price + reason) are computed here so the UI only displays them.
import { WEAPONS, getWeapon } from '../data/weapons.js';
import { WEAPON_UPGRADE, UPGRADE_NODES, WEAPON_NODES, PLAYER_UPGRADES, PLAYER_UPGRADE_COST_GROWTH, shopPrice } from '../data/upgrades.js';
import { levelForXp } from '../data/progression.js';
import { effectiveWeaponStats, playerModifiers } from './Loadout.js';
import { nextMapId } from './Campaign.js';

/** Reasons an offer cannot be bought (i18n keys `shop.reason.*`). */
export const REASON = Object.freeze({
  COINS: 'coins', LEVEL: 'level', OWNED: 'owned', NOT_OWNED: 'notOwned', MAX: 'max', WEAPON_MAX: 'weaponMax',
  UNKNOWN: 'unknown', CLOSED: 'closed', PAD_BUSY: 'padBusy',
});

export class Economy {
  /**
   * @param {{loadProfile:Function, saveProfile:Function}} saveManager
   * @param {import('../core/GameEvents.js').GameEvents} events
   */
  constructor(saveManager, events) {
    this.saveManager = saveManager;
    this.events = events;
    const { profile, status } = saveManager.loadProfile();
    this.profile = profile;
    this.loadStatus = status;
  }

  get coins() { return this.profile.coins; }
  get level() { return this.profile.playerLevel; }

  // ---------------- rewards ----------------
  /** @param {{coins:number, xp:number}} reward */
  grantKill(reward) {
    if (!reward) return;
    const p = this.profile;
    p.coins = Math.min(1e9, p.coins + Math.max(0, reward.coins | 0));
    p.statistics.totalKills += 1;
    this._addXp(Math.max(0, reward.xp | 0));
    this._commit();
  }

  grantCoins(amount) {
    const a = Math.max(0, amount | 0);
    if (a === 0) return;
    this.profile.coins = Math.min(1e9, this.profile.coins + a);
    this._commit();
  }

  /** Map result (Phase 7): a win marks the map completed and unlocks the next one from the campaign data. */
  recordMapResult(mapId, won) {
    const p = this.profile;
    if (won) {
      p.statistics.mapsWon += 1;
      if (!p.completedMaps.includes(mapId)) p.completedMaps.push(mapId);
      const next = nextMapId(mapId);
      if (next && !p.unlockedMaps.includes(next)) {
        p.unlockedMaps.push(next);
        this.events.emit('mapUnlocked', next);
      }
    } else p.statistics.mapsFailed += 1;
    this._commit();
  }

  // ---------------- tutorial flag (D11/D43): lives in the profile, cleared only by RESET PROGRESS ----------------
  markTutorialSeen(id, allIds) {
    const t = this.profile.tutorial;
    if (t.done || t.seen.includes(id)) return;
    t.seen.push(id);
    if (allIds && allIds.every((s) => t.seen.includes(s))) t.done = true;
    this._commit();
  }

  /** One-time intro card shown (D45): stored once, saved. */
  markIntroSeen(id) {
    const list = this.profile.intros;
    if (!Array.isArray(list) || list.includes(id)) return;
    list.push(id);
    this._commit();
  }

  skipTutorial() {
    if (this.profile.tutorial.done) return;
    this.profile.tutorial.done = true;
    this._commit();
  }

  _addXp(xp) {
    if (!(xp > 0)) return;
    const p = this.profile;
    const before = p.playerLevel;
    p.totalXp = Math.min(1e9, p.totalXp + xp);
    p.playerLevel = levelForXp(p.totalXp);
    if (p.playerLevel > before) this.events.emit('levelUp', p.playerLevel, before);
  }

  _commit() {
    this.saveManager.saveProfile(this.profile);
    this.events.emit('profileChanged', this.profile);
  }

  // ---------------- loadout ----------------
  weaponUpgrades(id) { const w = this.profile.weaponProgress[id]; return w ? w.upgrades : {}; }

  weaponLevel(id) { const w = this.profile.weaponProgress[id]; return w ? w.level : 1; }

  /** Effective stats of the equipped weapon + keeper modifiers for a map run. */
  loadout() {
    const id = this.profile.equippedWeaponId;
    return { weaponStats: effectiveWeaponStats(id, this.weaponUpgrades(id)), player: playerModifiers(this.profile.playerUpgrades) };
  }

  // ---------------- offers (read-only, for the shop UI) ----------------
  /** @returns {{id, price, requiredLevel, owned, equipped, canBuy, reason}} */
  weaponOffer(id) {
    const w = getWeapon(id);
    const p = this.profile;
    if (!w || !w.inMvp) return { id, canBuy: false, reason: REASON.UNKNOWN };
    const owned = p.ownedWeapons.includes(id);
    const o = { id, price: shopPrice(w.price), requiredLevel: w.requiredPlayerLevel, owned, equipped: p.equippedWeaponId === id, canBuy: false, reason: null };
    if (owned) o.reason = REASON.OWNED;
    else if (p.playerLevel < w.requiredPlayerLevel) o.reason = REASON.LEVEL;
    else if (p.coins < o.price) o.reason = REASON.COINS;
    else o.canBuy = true;
    return o;
  }

  weaponUpgradeCost(weaponId, nodeId) {
    const node = UPGRADE_NODES[nodeId];
    const base = WEAPON_UPGRADE.baseCost[weaponId] || 0;
    const mult = node && node.unique ? WEAPON_UPGRADE.uniqueCostMultiplier : 1;
    return shopPrice(base * (1 + WEAPON_UPGRADE.costGrowth * (this.weaponLevel(weaponId) - 1)) * mult);
  }

  /** @returns {{weaponId, nodeId, rank, max, cost, canBuy, reason}} */
  weaponUpgradeOffer(weaponId, nodeId) {
    const node = UPGRADE_NODES[nodeId];
    const p = this.profile;
    if (!node || !(WEAPON_NODES[weaponId] || []).includes(nodeId)) return { weaponId, nodeId, canBuy: false, reason: REASON.UNKNOWN };
    const rank = this.weaponUpgrades(weaponId)[nodeId] | 0;
    const o = { weaponId, nodeId, rank, max: node.max, cost: this.weaponUpgradeCost(weaponId, nodeId), canBuy: false, reason: null };
    if (!p.ownedWeapons.includes(weaponId)) o.reason = REASON.NOT_OWNED;
    else if (rank >= node.max) o.reason = REASON.MAX;
    else if (this.weaponLevel(weaponId) >= WEAPON_UPGRADE.maxWeaponLevel) o.reason = REASON.WEAPON_MAX;
    else if (p.coins < o.cost) o.reason = REASON.COINS;
    else o.canBuy = true;
    return o;
  }

  playerUpgradeCost(id) {
    const u = PLAYER_UPGRADES[id];
    return u ? shopPrice(u.baseCost * (1 + PLAYER_UPGRADE_COST_GROWTH * (this.profile.playerUpgrades[id] | 0))) : 0;
  }

  playerUpgradeOffer(id) {
    const u = PLAYER_UPGRADES[id];
    if (!u) return { id, canBuy: false, reason: REASON.UNKNOWN };
    const rank = this.profile.playerUpgrades[id] | 0;
    const o = { id, rank, max: u.max, cost: this.playerUpgradeCost(id), canBuy: false, reason: null };
    if (rank >= u.max) o.reason = REASON.MAX;
    else if (this.profile.coins < o.cost) o.reason = REASON.COINS;
    else o.canBuy = true;
    return o;
  }

  // ---------------- purchases: validate → debit → apply → save → notify ----------------
  buyWeapon(id) {
    const o = this.weaponOffer(id);
    if (!o.canBuy) return { ok: false, reason: o.reason };
    const p = this.profile;
    p.coins -= o.price;
    p.ownedWeapons.push(id);
    p.weaponProgress[id] = { level: 1, upgrades: {} };
    p.equippedWeaponId = id; // a new weapon is equipped right away
    this._commit();
    this.events.emit('purchase', 'weapon', id);
    return { ok: true };
  }

  equipWeapon(id) {
    const p = this.profile;
    if (!p.ownedWeapons.includes(id)) return { ok: false, reason: REASON.NOT_OWNED };
    if (p.equippedWeaponId === id) return { ok: true };
    p.equippedWeaponId = id;
    this._commit();
    return { ok: true };
  }

  buyWeaponUpgrade(weaponId, nodeId) {
    const o = this.weaponUpgradeOffer(weaponId, nodeId);
    if (!o.canBuy) return { ok: false, reason: o.reason };
    const p = this.profile;
    const wp = p.weaponProgress[weaponId];
    p.coins -= o.cost;
    wp.upgrades[nodeId] = o.rank + 1;
    wp.level += 1;
    this._commit();
    this.events.emit('purchase', 'weaponUpgrade', weaponId, nodeId);
    return { ok: true };
  }

  buyPlayerUpgrade(id) {
    const o = this.playerUpgradeOffer(id);
    if (!o.canBuy) return { ok: false, reason: o.reason };
    const p = this.profile;
    p.coins -= o.cost;
    p.playerUpgrades[id] = o.rank + 1;
    this._commit();
    this.events.emit('purchase', 'playerUpgrade', id);
    return { ok: true };
  }

  /** Coins for a temporary map purchase (defense devices). Validated before; nothing changes if short. */
  spend(amount) {
    const a = amount | 0;
    if (!(a > 0) || this.profile.coins < a) return false;
    this.profile.coins -= a;
    this._commit();
    return true;
  }
}

export const MVP_WEAPON_IDS = Object.values(WEAPONS).filter((w) => w.inMvp).map((w) => w.id);
