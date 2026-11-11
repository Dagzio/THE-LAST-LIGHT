// Player base stats (02_SPEC §4, 01_GDD §8.3–8.4). Permanent/temporary multipliers are applied by systems.

export const PLAYER = {
  radius: 18,
  maxHp: 100,
  moveSpeed: 124,           // px/s — D54 (user decision): 190 − 35 %; MOBILITY / FLEET FOOTED are % of it
  dodge: {
    duration: 0.2,          // s
    speed: 530,             // px/s (GDD 500–560)
    cooldown: 4.0,          // s, counted from the dodge start
    invulnerability: 0.2,   // s; equals the dodge duration (PROJECT_AUDIT.md C9)
  },
  // Short invulnerability after taking a hit, so one contact cannot drain HP every step.
  // PROVISIONAL (GDD: "короткое окно" without a number) — confirm with the enemy table before Phase 4.
  hitInvulnerability: 0.6,
  muzzleOffset: 24,         // px from the center to the pistol muzzle (visual + projectile origin)
};
