// Single place for outgoing damage (02_SPEC §6). Order:
// 1 base → 2 permanent weapon upgrades → 3 permanent player upgrades → 4 temporary map perks →
// 5 critical → 6 illuminated → 6b hit direction (D52) → 7 armor/resistance → 8 clamp to a minimum.
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
 * @param {number} [dirMult] hit-direction multiplier (hitDirectionMult), 1 for explosions / ticks
 * @returns {{amount:number, crit:boolean}} shared object — copy the fields if you keep them
 */
export function computeDamage(base, source, target, mods, rng, dirMult = 1) {
  let dmg = base;                                          // 1
  dmg *= mods.weaponDamageMult * (source.weaponDamageMult || 1); // 2 (permanent weapon upgrades, systems/Loadout.js)
  dmg *= mods.playerDamageMult;                            // 3
  dmg *= mods.temporaryDamageMult * (source.temporaryDamageMult || 1); // 4 (crate perks, MapRun withPerks)
  const critChance = (source.critChance || 0) + (mods.critChanceBonus || 0);
  result.crit = critChance > 0 && rng.next() < critChance;
  if (result.crit) dmg *= source.critMultiplier || 1;     // 5
  if (target.illuminated) dmg *= 1 + DAMAGE.illuminatedBonus; // 6
  if (dirMult > 0 && dirMult < 1) dmg *= dirMult;          // 6b
  dmg -= target.armor || 0;                                // 7 (flat)
  if (!Number.isFinite(dmg) || dmg < DAMAGE.minDamage) dmg = DAMAGE.minDamage; // 8
  result.amount = dmg;
  return result;
}

/**
 * D52 hit direction: a bullet flying with velocity (vx, vy) into an enemy that faces e.faceAngle. The shot comes from
 * −v; front = the enemy looks at it, back = the bullet hits it from behind. Data: DAMAGE.directional.
 */
export function hitDirectionMult(e, vx, vy) {
  const D = DAMAGE.directional;
  const v = Math.hypot(vx, vy);
  if (!(v > 0) || !Number.isFinite(e.faceAngle)) return 1;
  const c = -(Math.cos(e.faceAngle) * vx + Math.sin(e.faceAngle) * vy) / v; // cos(facing, direction to the shooter)
  if (c >= D.frontCos) return 1;
  if (c > D.backCos) return D.sideMult;
  return e.type && (e.type.boss || e.type.rearArmor) ? D.backMult : 1;
}
