// Single place for outgoing damage (02_SPEC §6). Order:
// 1 base → 2 permanent weapon upgrades → 3 permanent player upgrades → 4 temporary map perks →
// 5 critical → 6 illuminated → 7 armor/resistance → 8 clamp to a minimum.
// Weapons, grenades and turrets must all use this function (no duplicated formulas).
import { DAMAGE } from '../data/balance.js';

/** Neutral modifiers (Phase 2: no upgrades/perks yet). Reuse instead of allocating. */
export const NEUTRAL_MODIFIERS = Object.freeze({
  weaponDamageMult: 1,
  playerDamageMult: 1,
  temporaryDamageMult: 1,
  critChanceBonus: 0,
});

const result = { amount: 0, crit: false }; // reused output object (no per-hit allocation)

/**
 * @param {number} base
 * @param {{critChance:number, critMultiplier:number}} source weapon/device stats
 * @param {{illuminated:boolean, armor:number}} target
 * @param {typeof NEUTRAL_MODIFIERS} mods
 * @param {{next:()=>number}} rng seeded RNG (crit roll)
 * @returns {{amount:number, crit:boolean}} shared object — copy the fields if you keep them
 */
export function computeDamage(base, source, target, mods, rng) {
  let dmg = base;                                          // 1
  dmg *= mods.weaponDamageMult;                            // 2
  dmg *= mods.playerDamageMult;                            // 3
  dmg *= mods.temporaryDamageMult;                         // 4
  const critChance = (source.critChance || 0) + (mods.critChanceBonus || 0);
  result.crit = critChance > 0 && rng.next() < critChance;
  if (result.crit) dmg *= source.critMultiplier || 1;     // 5
  if (target.illuminated) dmg *= 1 + DAMAGE.illuminatedBonus; // 6
  dmg -= target.armor || 0;                                // 7 (flat)
  if (!Number.isFinite(dmg) || dmg < DAMAGE.minDamage) dmg = DAMAGE.minDamage; // 8
  result.amount = dmg;
  return result;
}
