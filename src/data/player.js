// Hero base stats. D79: the user's run clips are in — the speed is back at 95 (the run clip's own pace ≈ 92). While he
// shoots / aims (and a moment after) he moves × aimMoveMult: the strafe / back clips are slow, faster they would slide.

export const PLAYER = {
  radius: 15,
  maxHp: 100,
  moveSpeed: 95,            // units/s
  aimMoveMult: 0.75,        // × while shooting / aiming
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
 * the user's model + the aim poses (render3d/humans.js HumanTemplate.muzzle, gun lengths of data/humanModels.js),
 * so the bullets start where the renderer draws the barrel tip. Enemies use the same table.
 */
export const MUZZLE = {
  pistol: { f: 15, s: 6.6, h: 41.4 },  // D80: real-size guns held at their grips (Pistol Idle pose)
  smg: { f: 17.7, s: 7.2, h: 40.5 },   // standing Firing Rifle pose
  rifle: { f: 24, s: 7.2, h: 41.7 },   // (enemies' rifles)
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
