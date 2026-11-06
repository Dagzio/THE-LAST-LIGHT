// Permanent upgrades (03_ECONOMY §6–7). Data only: the formulas live in systems/Loadout.js and systems/Economy.js.

// ---------------- weapon upgrade tree ----------------
export const WEAPON_UPGRADE = {
  maxWeaponLevel: 10,           // weaponLevel = 1 + purchased nodes (≤ 9 nodes per weapon)
  costGrowth: 0.22,             // cost = round(base × (1 + 0.22 × (weaponLevel − 1)) × multiplier)
  uniqueCostMultiplier: 1.35,
  baseCost: { pistol: 25, smg: 35, shotgun: 40, assault_rifle: 50, machine_gun: 65 },
};

/** Node types: effect per rank, max rank. `unique` nodes cost ×1.35. */
export const UPGRADE_NODES = {
  damage: { id: 'damage', nameKey: 'upg.damage', max: 3, perRank: 0.08 },          // +8% damage
  fireRate: { id: 'fireRate', nameKey: 'upg.fireRate', max: 3, perRank: 0.05 },    // fire interval −5%
  reload: { id: 'reload', nameKey: 'upg.reload', max: 2, perRank: 0.08 },          // reload −8%
  magazine: { id: 'magazine', nameKey: 'upg.magazine', max: 2, perRank: 0.15 },    // magazine +15%, rounded up
  critChance: { id: 'critChance', nameKey: 'upg.critChance', max: 1, perRank: 0.05, unique: true },        // +5 pp
  reducedSpread: { id: 'reducedSpread', nameKey: 'upg.reducedSpread', max: 1, perRank: 0.2, unique: true }, // spread −20%
  extraPellet: { id: 'extraPellet', nameKey: 'upg.extraPellet', max: 1, perRank: 1, unique: true },        // +1 pellet
  penetration: { id: 'penetration', nameKey: 'upg.penetration', max: 1, perRank: 1, unique: true },        // +1 target
};

/** Which nodes each weapon has (machine gun: after MVP). */
export const WEAPON_NODES = {
  pistol: ['damage', 'fireRate', 'reload', 'magazine', 'critChance'],
  smg: ['damage', 'fireRate', 'reload', 'magazine', 'reducedSpread'],
  shotgun: ['damage', 'fireRate', 'reload', 'extraPellet', 'magazine'],
  assault_rifle: ['damage', 'fireRate', 'reload', 'magazine', 'penetration'],
};

/** Display name overrides (03_ECONOMY §6: the shotgun calls its damage node "Pellet Damage"). */
export const NODE_NAME_OVERRIDES = { shotgun: { damage: 'upg.pelletDamage' } };

// ---------------- permanent player upgrades ----------------
export const PLAYER_UPGRADE_COST_GROWTH = 0.45; // cost = round(base × (1 + 0.45 × currentRank))

export const PLAYER_UPGRADES = {
  vitality: { id: 'vitality', nameKey: 'pup.vitality', max: 5, baseCost: 35, perRank: 10 },           // +10 Max HP
  armor: { id: 'armor', nameKey: 'pup.armor', max: 5, baseCost: 45, perRank: 0.02 },                  // −2% damage taken
  mobility: { id: 'mobility', nameKey: 'pup.mobility', max: 5, baseCost: 40, perRank: 0.03 },         // +3% move speed
  quick_dodge: { id: 'quick_dodge', nameKey: 'pup.quick_dodge', max: 5, baseCost: 45, perRank: 0.04 }, // −4% dodge cooldown
  interact_range: { id: 'interact_range', nameKey: 'pup.interact_range', max: 3, baseCost: 35, perRank: 0.15 }, // +15% (D14)
};

export const PLAYER_UPGRADE_ORDER = ['vitality', 'armor', 'mobility', 'quick_dodge', 'interact_range'];
