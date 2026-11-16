// Hero base stats (KILL LIST D78). The movement speed is lower than THE LAST LIGHT's 95: the user's Mixamo set has a
// walk only (no run) — faster than ≈ 2.7 × the clip's own speed the feet slide (data/humanModels.js walkRateMax).
// With a run animation from the user it can go back up.

export const PLAYER = {
  radius: 15,
  maxHp: 100,
  moveSpeed: 72,            // units/s
  dodge: {                  // a short roll / dash (Space)
    duration: 0.22,         // s
    speed: 420,             // units/s
    cooldown: 2.5,          // s, counted from the dodge start
    invulnerability: 0.22,  // s (= the duration)
  },
  hitInvulnerability: 0.08, // s after a hit (bullets: no long i-frames)
};

/**
 * Muzzle of each gun in the hero's frame with the aim pose: f forward, s right, h height (game units). Measured from
 * the user's model + the "walkFire" pose (render3d/humans.js HumanTemplate.muzzle, gun lengths of data/humanModels.js),
 * so the bullets start where the renderer draws the barrel tip. Enemies use the same table.
 */
export const MUZZLE = {
  pistol: { f: 9, s: 7, h: 41.5 },
  smg: { f: 15, s: 7, h: 41.8 },
  rifle: { f: 24, s: 7, h: 42.2 },
};
export const muzzleOf = (gun) => MUZZLE[gun] || MUZZLE.pistol;

/**
 * D76 (kept): the hero walks front first — the body faces the movement direction and turns to the aim while shooting /
 * aiming a grenade (and a moment after the last shot).
 */
export const FACING = {
  aimHold: 0.6,             // s the body keeps facing the aim after the trigger is let go
};

/** D74 / D75 (kept): the mobile version aims and shoots by itself at the nearest visible enemy on the screen. */
export const AUTO_AIM = {
  rangeFactor: 0.9,
  switchRatio: 0.7,
  lineOfSight: true,
  viewInset: 12,
};

/** Interaction (crates, pickups) and the hero's own noise. */
export const INTERACT = {
  radius: 46,               // units from the hero's centre to a crate's centre (E / the touch button)
  pickupRadius: 30,         // medkits, key card, drive: picked up by walking over them
  medkitHeal: 50,
};
