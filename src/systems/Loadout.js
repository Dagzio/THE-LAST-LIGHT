// Effective stats from permanent progression (03_ECONOMY §6–7). Pure functions: profile data in, stats out.
// Temporary map perks (Phase 6) are applied on top of these by the map run, never stored in the profile.
import { getWeapon } from '../data/weapons.js';
import { UPGRADE_NODES, PLAYER_UPGRADES } from '../data/upgrades.js';
import { PLAYER } from '../data/player.js';

/**
 * @param {string} weaponId
 * @param {Record<string, number>} upgrades node ranks
 * @returns {object} weapon stats with upgrades applied (weaponDamageMult is DamageCalculator step 2)
 */
export function effectiveWeaponStats(weaponId, upgrades = {}) {
  const base = getWeapon(weaponId) || getWeapon('pistol');
  const r = (id) => upgrades[id] | 0;
  const N = UPGRADE_NODES;
  let nodes = 0;
  for (const k in upgrades) nodes += upgrades[k] | 0;
  return {
    ...base,
    weaponLevel: 1 + nodes,
    weaponDamageMult: 1 + N.damage.perRank * r('damage'),
    fireInterval: base.fireInterval * (1 - N.fireRate.perRank * r('fireRate')),
    reloadDuration: base.reloadDuration * (1 - N.reload.perRank * r('reload')),
    magazineSize: Math.ceil(base.magazineSize * (1 + N.magazine.perRank * r('magazine')) - 1e-9),
    critChance: base.critChance + N.critChance.perRank * r('critChance'),
    spreadAngle: base.spreadAngle * (1 - N.reducedSpread.perRank * r('reducedSpread')),
    pelletsPerShot: base.pelletsPerShot + N.extraPellet.perRank * r('extraPellet'),
    penetrationCount: base.penetrationCount + N.penetration.perRank * r('penetration'),
  };
}

/** Keeper modifiers from permanent player upgrades. */
export function playerModifiers(playerUpgrades = {}) {
  const r = (id) => playerUpgrades[id] | 0;
  const U = PLAYER_UPGRADES;
  return {
    maxHp: PLAYER.maxHp + U.vitality.perRank * r('vitality'),
    damageTakenMult: 1 - U.armor.perRank * r('armor'),
    speedMult: 1 + U.mobility.perRank * r('mobility'),
    dodgeCooldownMult: 1 - U.quick_dodge.perRank * r('quick_dodge'),
    interactMult: 1 + U.interact_range.perRank * r('interact_range'),
  };
}

/** Loadout of a fresh profile (tests, fallback). */
export function defaultLoadout() {
  return { weaponStats: effectiveWeaponStats('pistol', {}), player: playerModifiers({}) };
}
