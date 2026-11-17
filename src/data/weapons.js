// KILL LIST (D78): firearms. The hero starts every level with the pistol (user decision); the SMG is found in a crate.
// Reserve ammo is not limited yet (the design document plans limited ammo — a later step). Enemy guns live here too,
// so every gun number is in one place. spreadAngle — degrees (full cone); burst — rounds per trigger pull (enemies).
// range — units the bullet flies; projectileSpeed — units/s; muzzle height / offsets come from data/player.js MUZZLE.
// D82 (user request): the hero's guns +10 % damage (pistol 20 → 22, SMG 12 → 13.2), the enemies' −25 %
// (pistol 7 → 5.25, rifle 5 → 3.75, heavy 6 → 4.5).

export const WEAPONS = {
  pistol: {
    id: 'pistol', nameKey: 'weapon.pistol', gun: 'pistol',
    damage: 22, fireInterval: 0.3, magazineSize: 12, reloadDuration: 1.6, range: 560, // D83: 1.3 → 1.6 s (a calmer reload, user)
    projectileSpeed: 1000, spreadAngle: 1.5, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    noise: 520,
  },
  smg: {
    id: 'smg', nameKey: 'weapon.smg', gun: 'smg',
    damage: 13.2, fireInterval: 0.085, magazineSize: 30, reloadDuration: 1.8, range: 480,
    projectileSpeed: 1050, spreadAngle: 6, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    noise: 560,
  },
  // D85 stealth only (NEW GAME.docx asset list): quiet (heard at 140 instead of 520); a shot at an unaware enemy
  // does ×sneakMult. D87 (user: stealth was "just kill everyone"): ×3 → ×2.5 — one shot fells only a thug (55, a side
  // hit 46.8 ≥ 45); a gunman (60) survives it and raises the alarm; and the rounds are counted: the magazine + `reserve`
  pistol_sd: {
    id: 'pistol_sd', nameKey: 'weapon.pistol_sd', gun: 'pistol',
    damage: 22, fireInterval: 0.45, magazineSize: 10, reloadDuration: 1.6, range: 420,
    projectileSpeed: 950, spreadAngle: 1.5, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    noise: 140, sneakMult: 2.5, reserve: 10,
  },
  // --- enemies (shoot at the hero; damage per bullet)
  enemy_pistol: {
    id: 'enemy_pistol', gun: 'pistol', hostile: true,
    damage: 5.25, fireInterval: 0.55, burst: 1, magazineSize: 10, reloadDuration: 1.7, range: 520,
    projectileSpeed: 650, spreadAngle: 7, pelletsPerShot: 1, critChance: 0, critMultiplier: 1, penetrationCount: 0,
  },
  enemy_rifle: {
    id: 'enemy_rifle', gun: 'rifle', hostile: true,
    damage: 3.75, fireInterval: 0.11, burst: 3, magazineSize: 24, reloadDuration: 2.0, range: 560,
    projectileSpeed: 720, spreadAngle: 8, pelletsPerShot: 1, critChance: 0, critMultiplier: 1, penetrationCount: 0,
  },
  enemy_heavy: {
    id: 'enemy_heavy', gun: 'rifle', hostile: true,
    damage: 4.5, fireInterval: 0.1, burst: 5, magazineSize: 40, reloadDuration: 2.4, range: 560,
    projectileSpeed: 720, spreadAngle: 9, pelletsPerShot: 1, critChance: 0, critMultiplier: 1, penetrationCount: 0,
  },
};

/** Weapons the hero can carry, in slot order (1, 2). */
export const HERO_WEAPONS = ['pistol', 'smg'];

export const getWeapon = (id) => WEAPONS[id] || null;
