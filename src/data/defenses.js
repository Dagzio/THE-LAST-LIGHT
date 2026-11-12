// Tower-defense devices (03_ECONOMY §9, 02_SPEC §10). Radii ×0.72 for the 3D camera (user decision D27).
// Placement is only on a build pad and only between waves through the shop.
//
// Levels (user decision D50, 2026-11-09): every device has 3 levels, bought one after another with "UPGRADE" (no
// choice). The level changes the stats AND the model (render3d/models.js). Shop prices = shopPrice(base):
//   Guard Turret 85 → 72 · L2 71 → 60 · L3 106 → 90;  Frost Coil 75 → 64 · L2 65 → 55 · L3 94 → 80.
// Frost Coil (D50): a shooting turret like the Guard Turret — 35 % less damage, every hit slows the enemy
// (25 / 40 / 60 %, never stacking, bosses get bossSlowFactor of it).
// A pad keeps every device bought on it during the map run (with its level); switching back to one is free.

import { TURRET_GLB, turretMuzzle } from './models3d.js';

export const MAX_DEVICE_LEVEL = 3;
export const FROST_DAMAGE_MULT = 0.65; // −35 % of the Guard Turret damage at the same level

const GUARD_LEVELS = [
  { damage: 5, barrels: 1, fireInterval: 0.65, range: 215 },                     // 300 × 0.72
  { damage: 6, barrels: 2, fireInterval: 0.65, range: 215, upgradePrice: 71 },   // double barrel: 2 rounds a volley
  { damage: 7, barrels: 2, fireInterval: 0.5, range: 235, upgradePrice: 106 },   // faster, harder, a bit further
];

export const DEFENSES = {
  guard_turret: {
    id: 'guard_turret', nameKey: 'defense.guard_turret', price: 85,
    projectileSpeed: 620, spreadAngle: 2, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    muzzleHeight: 30, muzzleOffset: 20, barrelGap: 8,
    levels: GUARD_LEVELS,
  },
  frost_coil: {
    id: 'frost_coil', nameKey: 'defense.frost_coil', price: 75,
    projectileSpeed: 560, spreadAngle: 2, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    muzzleHeight: 44, muzzleOffset: 14, barrelGap: 10,
    levels: [
      { damage: GUARD_LEVELS[0].damage * FROST_DAMAGE_MULT, barrels: 1, fireInterval: 0.65, range: 215, slowOnHit: 0.25, slowDuration: 1.5 },
      { damage: GUARD_LEVELS[1].damage * FROST_DAMAGE_MULT, barrels: 2, fireInterval: 0.65, range: 215, slowOnHit: 0.4, slowDuration: 1.5, upgradePrice: 65 },
      { damage: GUARD_LEVELS[2].damage * FROST_DAMAGE_MULT, barrels: 2, fireInterval: 0.5, range: 235, slowOnHit: 0.6, slowDuration: 1.8, upgradePrice: 94 },
    ],
  },
};

// Poison Turret (D51, 2026-11-09): greenish rounds — half the Guard damage on hit, then poison: small damage every
// 0.5 s for a few seconds (a new hit refreshes it, never stacks; poison ignores armour). Shop 68 → L2 58 → L3 85.
DEFENSES.poison_turret = {
  id: 'poison_turret', nameKey: 'defense.poison_turret', price: 80,
  projectileSpeed: 560, spreadAngle: 2, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
  muzzleHeight: 38, muzzleOffset: 16, barrelGap: 9,
  levels: [
    { damage: GUARD_LEVELS[0].damage * 0.5, barrels: 1, fireInterval: 0.65, range: 215, poisonDps: 2, poisonDuration: 3, poisonTick: 0.5 },
    { damage: GUARD_LEVELS[1].damage * 0.5, barrels: 2, fireInterval: 0.65, range: 215, poisonDps: 3, poisonDuration: 3.5, poisonTick: 0.5, upgradePrice: 68 },
    { damage: GUARD_LEVELS[2].damage * 0.5, barrels: 2, fireInterval: 0.5, range: 235, poisonDps: 4, poisonDuration: 4, poisonTick: 0.5, upgradePrice: 100 },
  ],
};

// Device health (D52, user decision 2026-11-11): every device has HP by level; a device at 0 HP is broken — it does
// not shoot until repaired (its level is kept). Repair to full, proportional to the damage, like the beacon: from 1 %
// to 100 % costs fullFromOnePercent coins (shop DEFENSES card or the small wrench next to its world HP bar).
export const DEVICE_HP = { perLevel: [120, 160, 200], repair: { fullFromOnePercent: 40 } };
// Enemies passing close to a working device turn on it: within `range` of its pad edge an enemy walks up and hits it
// with its beacon damage for `attackTime` s, then goes on to the beacon and ignores devices for `cooldown` s
// (`giveUpAfter`: it could not reach it). Bosses do not stop — their slam / tide damage devices inside the area.
// Spitters lob every `spitterEvery`-th glob at a working device within their reach of it.
// D58 (user decision): attackTime 3 → 9 s (+6) — distracted enemies stay on a device longer
export const DEVICE_AGGRO = { range: 80, attackTime: 9, giveUpAfter: 4, cooldown: 8, firstHit: 0.4, spitterEvery: 3, spitterReach: 300 };

// D54: rounds start at the barrel tip of the user's turret model of that level (muzzleOffset forward from the pad centre,
// muzzleHeight — the height they fly at, presentation)
for (const id in TURRET_GLB) {
  const d = DEFENSES[id];
  if (!d) continue;
  TURRET_GLB[id].forEach((e, i) => { const m = turretMuzzle(e); if (d.levels[i]) Object.assign(d.levels[i], { muzzleOffset: m.offset, muzzleHeight: m.height }); });
}

export const getDefense = (id) => DEFENSES[id] || null;

const statsCache = new Map();

/** Effective stats of a device at a level (1…3): base fields + that level's numbers. Cached, never mutated. */
export function defenseStats(id, level = 1) {
  const d = getDefense(id);
  if (!d) return null;
  const lv = Math.min(MAX_DEVICE_LEVEL, Math.max(1, level | 0));
  const key = `${id}@${lv}`;
  let s = statsCache.get(key);
  if (!s) {
    const { levels, ...base } = d;
    s = Object.freeze({ ...base, ...levels[lv - 1], level: lv, maxHp: DEVICE_HP.perLevel[lv - 1] });
    statsCache.set(key, s);
  }
  return s;
}

/** Base price of the next level of a device (null at the max level). */
export function upgradeBasePrice(id, level) {
  const d = getDefense(id);
  if (!d || level >= MAX_DEVICE_LEVEL) return null;
  return d.levels[level].upgradePrice;
}
