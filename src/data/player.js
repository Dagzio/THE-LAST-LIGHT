// Hero base stats. D79: the user's run clips are in — the speed is back at 95 (the run clip's own pace ≈ 92). While he
// shoots / aims (and a moment after) he moves × aimMoveMult: the strafe / back clips are slow, faster they would slide.

export const PLAYER = {
  radius: 15,
  maxHp: 100,
  moveSpeed: 95,            // units/s
  aimMoveMult: 0.75,        // × while shooting / aiming
  // D82 (user request): Space = the user's "Dodge" clip — a dive roll. Moving: rolls where he moves; standing: where
  // his arms point. The hero travels along the clip's own path (curve: travelled fraction at every 1/13 of the roll,
  // measured from the clip's Hips — no foot sliding), cannot shoot meanwhile and is untouchable while diving / rolling.
  dodge: {
    duration: 0.95,         // s (the 1.3 s clip played × 1.37)
    distance: 105,          // units (the clip's 193 cm at the hero's size)
    curve: [0, 0.038, 0.116, 0.229, 0.374, 0.516, 0.640, 0.725, 0.795, 0.860, 0.915, 0.963, 0.992, 1],
    invulnerableFrom: 0.33, // fraction of the roll: from the dive…
    invulnerableTo: 0.8,    // …until he gets up
    cooldown: 2.5,          // s, counted from the roll start
  },
  hitInvulnerability: 0.08, // s after a hit (bullets: no long i-frames)
};

/** Travelled fraction of the roll at a fraction k (0…1) of its time. */
export function dodgeTravel(k) {
  const c = PLAYER.dodge.curve, n = c.length - 1;
  if (!(k > 0)) return 0;
  if (k >= 1) return 1;
  const f = k * n, i = Math.floor(f), t = f - i;
  return c[i] + (c[i + 1] - c[i]) * t;
}

/**
 * D82 cover (user request): the hero who walks INTO a cover object takes cover against it — crouched behind low cover
 * (desks, counters, boxes: data/props.js cover 'low'), pressed against high cover (walls, cabinets, shelves, racks:
 * 'high'). Chairs and small things are never cover. Crouched, the low objects stop the enemy rounds and hide him from
 * their eyes; he stands up to shoot (and stays up popUp s after the last shot). Walking away from the object leaves it.
 */
export const COVER = {
  reach: 4,                 // units between the body's edge and the object's surface that still count as contact
  enterTime: 0.15,          // s of pushing into the object before he takes cover
  pushDot: 0.5,             // how directly he must push into it (cos)
  exitDot: 0.35,            // moving away from it this directly leaves the cover
  crouchSpeedMult: 0.55,    // × speed while crouched
  popUp: 0.5,               // s he stays up after a shot from low cover
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
 * D82: the barrel runs beside the body's centre (mz.s to the right), so a body turned straight at the aim point would
 * aim the gun past it. The body turns left by this angle: the barrel line then goes through the aim point at distance d.
 */
export function barrelOffsetAngle(mz, d) {
  if (!(d > 1)) return 0;
  const k = mz.s / d;
  return Math.asin(k > 0.5 ? 0.5 : k < -0.5 ? -0.5 : k);
}

/**
 * D76 (kept): the hero walks front first — the body faces the movement direction and turns to the aim while shooting /
 * aiming a grenade (and a moment after the last shot); standing, he faces the aim. alwaysAimMouse — D82 option (off):
 * with a mouse the body would face the reticle even while walking.
 */
export const FACING = {
  aimHold: 0.6,             // s the body keeps facing the aim after the trigger is let go
  alwaysAimMouse: false,
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
