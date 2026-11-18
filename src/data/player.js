// Hero base stats. D79: the user's run clips are in — the speed is back at 95 (the run clip's own pace ≈ 92). While he
// shoots / aims (and a moment after) he moves × aimMoveMult: the strafe / back clips are slow, faster they would slide.

export const PLAYER = {
  radius: 15,
  maxHp: 100,
  moveSpeed: 95,            // units/s
  aimMoveMult: 0.75,        // × while shooting / aiming
  // D82 (user request): Space = a dive roll (the user's clips). Moving: rolls where he moves; standing: where his arms
  // point. The hero travels along the clip's own path (curve: travelled fraction at every 1/13 of the roll, measured
  // from the clip's Hips — no foot sliding), cannot shoot meanwhile and is untouchable while diving / rolling.
  // D83: two rolls ("Dodge", "Dodge 2"), one picked at random (seeded) for every roll; both clips played × 1.37.
  dodge: {
    cooldown: 2.5,          // s, counted from the roll start
    variants: [
      {
        clip: 'dodge',
        duration: 0.95,         // s (the 1.3 s clip)
        distance: 105,          // units (the clip's 193 cm at the hero's size)
        curve: [0, 0.038, 0.116, 0.229, 0.374, 0.516, 0.640, 0.725, 0.795, 0.860, 0.915, 0.963, 0.992, 1],
        invulnerableFrom: 0.33, // fraction of the roll: from the dive…
        invulnerableTo: 0.8,    // …until he gets up
      },
      {
        clip: 'dodge2',
        duration: 1.1,          // s (the 1.5 s clip)
        distance: 131,          // units (242 cm)
        curve: [0, 0.092, 0.218, 0.368, 0.527, 0.686, 0.792, 0.836, 0.890, 0.924, 0.954, 0.977, 0.993, 1],
        invulnerableFrom: 0.31,
        invulnerableTo: 0.73,
      },
    ],
  },
  hitInvulnerability: 0.08, // s after a hit (bullets: no long i-frames)
};

/** The roll variant (data) of a player's current / last roll. */
export const dodgeOf = (p) => PLAYER.dodge.variants[p && p.dodgeVariant | 0] || PLAYER.dodge.variants[0];

/** Travelled fraction of a roll (variant v) at a fraction k (0…1) of its time. */
export function dodgeTravel(k, v = PLAYER.dodge.variants[0]) {
  const c = v.curve, n = c.length - 1;
  if (!(k > 0)) return 0;
  if (k >= 1) return 1;
  const f = k * n, i = Math.floor(f), t = f - i;
  return c[i] + (c[i + 1] - c[i]) * t;
}

/**
 * Cover (D82; D83 user design): near an object one can hide behind, the COVER button (touch) / Q (PC) appears; pressed,
 * the hero steps up to it and takes cover — kneeling behind low cover (desks, counters, boxes: data/props.js cover
 * 'low'), back to it behind high cover (walls, cabinets, shelves, racks: 'high'). Chairs and small things are never
 * cover. In cover he moves only along the object (crouched / sneaking sideways) and stops at its end. Kneeling, the low
 * objects stop the enemy rounds and hide him; shooting from it (kneeling fire) exposes him for popUp s. Q / the button
 * again, pushing away from the object for a moment or a roll leaves the cover.
 */
export const COVER = {
  reach: 14,                // units between the body's edge and the object's surface: the button / Q appears
  snapTime: 0.2,            // s to step up to the object
  crouchSpeedMult: 0.45,    // × speed moving along low cover (kneeling strafe)
  sneakSpeedMult: 0.5,      // × speed moving along high cover (back to it)
  exitDot: 0.6,             // pushing away from the object this directly…
  exitHold: 0.3,            // …for this long leaves the cover
  popUp: 0.5,               // s he stays exposed after a shot from low cover
  // D87 (user request): behind HIGH cover he can shoot only from its corner — he leans out past the edge ("Female Peek
  // And Aim"), really exposed there; away from an edge the trigger does nothing (a hint says so). Low cover: over it.
  // D90 (user): the corner is his limit — moving along, he stops when his centre is edgeStop from the end of the face
  // (his body's edge about at the corner; the model is drawn hugging the object: render3d coverHug)
  edgeStop: 13,
  edgeProbe: 16,            // units along the cover: no cover there (or only its corner) → he stands at an edge
  peekOut: 24,              // units he leans out past the edge (his body clears the corner — and can be hit)
  clearShot: 70,            // D100: in high cover he fires only if this much of the line to the aim is free of walls
  frontDot: 0.15,           // D99: aim this far in front of him (cos to the wall's normal) — he fires without leaning out
  peekIn: 0.34,             // s to lean out / back (D97, user: 0.16 was a jerk)
  peekHold: 0.45,           // s he stays out after the last shot
  edgeHintEvery: 1.5,       // s between the "move to the edge" hints
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
  alwaysAimMouse: true,     // D85 (user request): with a mouse the hero faces the cursor while moving too (strafe / back legs)
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
