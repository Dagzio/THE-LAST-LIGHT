// Player base stats (02_SPEC §4, 01_GDD §8.3–8.4). Permanent/temporary multipliers are applied by systems.

export const PLAYER = {
  radius: 18,
  maxHp: 100,
  moveSpeed: 95,            // px/s — D54: 190 − 35 % = 124; D56: − 10 % → 112; D59 (user decision): − 15 % → 95; MOBILITY / FLEET FOOTED are % of it
  dodge: {
    duration: 0.2,          // s
    speed: 530,             // px/s (GDD 500–560)
    cooldown: 4.0,          // s, counted from the dodge start
    invulnerability: 0.2,   // s; equals the dodge duration (PROJECT_AUDIT.md C9)
  },
  // Short invulnerability after taking a hit, so one contact cannot drain HP every step.
  // PROVISIONAL (GDD: "короткое окно" without a number) — confirm with the enemy table before Phase 4.
  hitInvulnerability: 0.2, // D62 (user decision): was 0.6
  muzzleOffset: 24,         // px from the center to the pistol muzzle (visual + projectile origin)
};

/**
 * D74 (user decision): the mobile version shoots by itself — at the nearest enemy the equipped weapon can actually
 * reach (its range, the enemy's edge) and see (no tree / rock in the way). Only the gun: grenades stay manual.
 * A finger on the aim side still aims and fires by hand and wins over the auto aim.
 */
export const AUTO_AIM = {
  rangeFactor: 0.95,        // of the weapon's range (the bullet starts at the muzzle, ahead of the keeper)
  switchRatio: 0.7,         // keep the current target unless another one is this much closer (no jitter)
  lineOfSight: true,        // never shoot into a tree while the enemy is behind it
};
