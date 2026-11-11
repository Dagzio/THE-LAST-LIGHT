// The keeper's procedural rig + where his weapon sits (D52, 2026-11-11). Pure data / math — the simulation reads the
// muzzle point (bullets leave the barrel tip, not the body centre) and the renderer uses the same numbers to put the gun
// into the raised hand and the flash on its tip. Frame: the keeper faces +X, up +Y, his right side +Z (game units).
// Model: assets/models/player.min.glb (Tripo, 1 unit tall, baked to KEEPER_MODEL.height).

export const KEEPER_MODEL = { file: 'assets/models/player.min.glb', height: 54 };

const H = KEEPER_MODEL.height; // the grunt and the other enemies: data/models3d.js (D54)
/** Pivots measured from the model's width profile (fractions of its height). */
export const KEEPER_RIG = {
  hipY: 0.42 * H, shoulderY: 0.80 * H, shoulderZ: 0.13 * H, armZ: 0.145 * H, armZLow: 0.145 * H, armSplitY: 0, armMinY: 0.40 * H,
  legSwing: 0.45, handY: 0.47 * H, handZ: 0.19 * H,
  // D53 baked arm weights (render3d/rig.js bakeArmWeights): the hands hang at y 0.40H…0.53H beside the coat sides —
  // there only skin-coloured vertices or ones beyond handZ0 (sleeve cuffs) are arm (measured from the model)
  handBand: [0.40 * H, 0.53 * H], handZ0: 7.6,
};

/** Arm poses while holding a weapon (radians forward from hanging; yaw turns the left hand in towards the gun). */
export const KEEPER_POSES = {
  pistol: { right: 1.45, left: 0.2, leftYaw: 0 },
  twoHanded: { right: 1.35, left: 1.25, leftYaw: 0.8 },
};
export const poseFor = (weaponId) => (weaponId === 'pistol' ? KEEPER_POSES.pistol : KEEPER_POSES.twoHanded);

/** Gun models (render3d/models.js weaponGeometry): their grip (right hand) and barrel tip in the gun's own frame.
 *  scale — the long guns were sized for the old box keeper; at the new model's proportions they are shrunk a little. */
export const GUN_FRAME = {
  pistol: { grip: [18.5, 32, 7], tip: [32.4, 34.2, 7], scale: 1 },
  smg: { grip: [19.5, 31.4, 5.6], tip: [40.6, 33.8, 4], scale: 0.85 },
  shotgun: { grip: [17.5, 31.4, 5.6], tip: [52.6, 34.4, 4], scale: 0.78 },
  assault_rifle: { grip: [20.5, 31.4, 5.6], tip: [52.4, 34, 4], scale: 0.8 },
};
const gunOf = (id) => GUN_FRAME[id] || (id === 'machine_gun' ? GUN_FRAME.assault_rifle : GUN_FRAME.pistol);

/** The right hand in the raised pose (the arm swings forward around the shoulder pivot). */
export function handPoint(weaponId) {
  const r = KEEPER_RIG, a = poseFor(weaponId).right, L = r.shoulderY - r.handY;
  return [L * Math.sin(a), r.shoulderY - L * Math.cos(a), r.handZ];
}

/** How the gun model is placed: p' = (p - grip) * scale + hand. */
export function gunPlacement(weaponId) {
  const g = gunOf(weaponId);
  return { grip: g.grip, scale: g.scale ?? 1, hand: handPoint(weaponId) };
}

/** Barrel tip in the keeper frame: { f: forward, s: right side, h: height } — the bullet start point (sim + render). */
export function muzzlePoint(weaponId) {
  const { grip, scale, hand } = gunPlacement(weaponId), t = gunOf(weaponId).tip;
  return { f: hand[0] + (t[0] - grip[0]) * scale, h: hand[1] + (t[1] - grip[1]) * scale, s: hand[2] + (t[2] - grip[2]) * scale };
}
