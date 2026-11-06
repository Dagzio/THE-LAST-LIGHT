// Firearms (03_ECONOMY §5). Base stats only; upgrades arrive in Phase 5.
// RANGES ×0.72 vs the original table (user decision 2026-11-06, 3D camera shows ~750 units): 520→375, 430→310,
// 270→195, 560→405, 480→345. Speeds/damage unchanged.
// spreadAngle in degrees (full cone). critChance/critMultiplier/penetrationCount: base values
// (the docs give no base crit — 0; multiplier PROVISIONAL 1.5 until Pistol Critical Chance exists in Phase 5).

export const WEAPONS = {
  pistol: {
    id: 'pistol', nameKey: 'weapon.pistol', requiredPlayerLevel: 1, price: 0, inMvp: true,
    damage: 14, fireInterval: 0.45, magazineSize: 12, reloadDuration: 1.25, range: 375,
    projectileSpeed: 560, spreadAngle: 1, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
  },
  smg: {
    id: 'smg', nameKey: 'weapon.smg', requiredPlayerLevel: 2, price: 120, inMvp: true,
    damage: 7, fireInterval: 0.14, magazineSize: 30, reloadDuration: 1.8, range: 310,
    projectileSpeed: 520, spreadAngle: 5, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
  },
  shotgun: {
    id: 'shotgun', nameKey: 'weapon.shotgun', requiredPlayerLevel: 3, price: 180, inMvp: true,
    damage: 8, fireInterval: 0.85, magazineSize: 6, reloadDuration: 2.1, range: 195,
    projectileSpeed: 440, spreadAngle: 22, pelletsPerShot: 5, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
  },
  assault_rifle: {
    id: 'assault_rifle', nameKey: 'weapon.assault_rifle', requiredPlayerLevel: 5, price: 280, inMvp: true,
    damage: 11, fireInterval: 0.2, magazineSize: 24, reloadDuration: 1.65, range: 405,
    projectileSpeed: 620, spreadAngle: 2, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
  },
  machine_gun: {
    id: 'machine_gun', nameKey: 'weapon.machine_gun', requiredPlayerLevel: 8, price: 450, inMvp: false,
    damage: 10, fireInterval: 0.11, magazineSize: 60, reloadDuration: 3.0, range: 345,
    projectileSpeed: 560, spreadAngle: 7, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
  },
};

export const getWeapon = (id) => WEAPONS[id] || null;
