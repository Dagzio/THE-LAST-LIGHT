// KILL LIST (D78): firearms. The hero starts every level with the pistol (user decision); the SMG is found in a crate.
// D88: the reserve ammo is limited (below). Enemy guns live here too,
// so every gun number is in one place. spreadAngle — degrees (full cone); burst — rounds per trigger pull (enemies).
// range — units the bullet flies; projectileSpeed — units/s; muzzle height / offsets come from data/player.js MUZZLE.
// D82 (user request): the hero's guns +10 % damage (pistol 20 → 22, SMG 12 → 13.2), the enemies' −25 %
// (pistol 7 → 5.25, rifle 5 → 3.75, heavy 6 → 4.5).

// D88 (user request): every gun of the hero has a limited reserve — `reserve` rounds come with it, `reserveMax` is the
// most he can carry for it; `ammo` — the rounds class it takes (pistol rounds: the pistols; rifle rounds: SMG, M4A1).
// More are taken from the bodies of the enemies (AMMO_DROPS, by the gun the enemy held).
export const WEAPONS = {
  pistol: {
    id: 'pistol', nameKey: 'weapon.pistol', gun: 'pistol', ammo: 'pistol',
    damage: 22, fireInterval: 0.3, magazineSize: 12, reloadDuration: 1.6, range: 560, // D83: 1.3 → 1.6 s (a calmer reload, user)
    projectileSpeed: 1000, spreadAngle: 1.5, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    noise: 520, reserve: 36, reserveMax: 60,
  },
  smg: {
    id: 'smg', nameKey: 'weapon.smg', gun: 'smg', ammo: 'rifle',
    damage: 13.2, fireInterval: 0.085, magazineSize: 30, reloadDuration: 1.8, range: 480,
    projectileSpeed: 1050, spreadAngle: 6, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    noise: 560, reserve: 60, reserveMax: 120,
  },
  // D88 (user request): the M4A1 — taken in the training ground (and later levels); slower than the SMG, harder hitting,
  // more accurate, further
  rifle: {
    id: 'rifle', nameKey: 'weapon.rifle', gun: 'rifle', ammo: 'rifle',
    damage: 19, fireInterval: 0.12, magazineSize: 30, reloadDuration: 2.0, range: 620,
    projectileSpeed: 1150, spreadAngle: 2.5, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    noise: 620, reserve: 60, reserveMax: 120,
  },
  // D85 stealth only (NEW GAME.docx asset list): quiet (heard at 140 instead of 520); a shot at an unaware enemy
  // does ×sneakMult. D87 (user: stealth was "just kill everyone"): ×3 → ×2.5 — one shot fells only a thug (55, a side
  // hit 46.8 ≥ 45); a gunman (60) survives it and raises the alarm. D88 (user): 5 in the magazine + 5 in reserve
  pistol_sd: {
    id: 'pistol_sd', nameKey: 'weapon.pistol_sd', gun: 'pistol', ammo: 'pistol',
    damage: 22, fireInterval: 0.45, magazineSize: 5, reloadDuration: 1.6, range: 420,
    projectileSpeed: 950, spreadAngle: 1.5, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    noise: 140, sneakMult: 2.5, reserve: 5, reserveMax: 15,
  },
  // --- enemies (shoot at the hero; damage per bullet)
  enemy_pistol: {
    id: 'enemy_pistol', gun: 'pistol', hostile: true, drops: 'pistol',
    damage: 5.25, fireInterval: 0.55, burst: 1, magazineSize: 10, reloadDuration: 1.7, range: 520,
    projectileSpeed: 650, spreadAngle: 7, pelletsPerShot: 1, critChance: 0, critMultiplier: 1, penetrationCount: 0,
  },
  enemy_rifle: {
    id: 'enemy_rifle', gun: 'rifle', hostile: true, drops: 'rifle',
    damage: 3.75, fireInterval: 0.11, burst: 3, magazineSize: 24, reloadDuration: 2.0, range: 560,
    projectileSpeed: 720, spreadAngle: 8, pelletsPerShot: 1, critChance: 0, critMultiplier: 1, penetrationCount: 0,
  },
  enemy_heavy: {
    id: 'enemy_heavy', gun: 'rifle', hostile: true, drops: 'rifle',
    damage: 4.5, fireInterval: 0.1, burst: 5, magazineSize: 40, reloadDuration: 2.4, range: 560,
    projectileSpeed: 720, spreadAngle: 9, pelletsPerShot: 1, critChance: 0, critMultiplier: 1, penetrationCount: 0,
  },
};

/** Weapons the hero can carry, in slot order (1, 2, 3); slot 1 holds whichever pistol the mode gives (D85). */
export const HERO_WEAPONS = ['pistol', 'smg', 'rifle'];

/**
 * D88 (user request): rounds on a dead enemy, by the class of his gun (`drops`): pistol rounds 5–12, rifle rounds
 * 10–15 (the SMG and the M4A1 take them). Taken by walking over the body — into the carried gun of that class (the one
 * in the hands first), up to its reserveMax; what does not fit stays on the body.
 */
export const AMMO_DROPS = { pistol: [5, 12], rifle: [10, 15] };

export const getWeapon = (id) => WEAPONS[id] || null;
