// The keeper's procedural rig + where his weapon sits (D52, 2026-11-11). Pure data / math — the simulation reads the
// muzzle point (bullets leave the barrel tip, not the body centre) and the renderer uses the same numbers to put the gun
// into the raised hands and the flash on its tip. Frame: the keeper faces +X, up +Y, his right side +Z (game units).
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
  kneeY: 0.28 * H, // D55: knee height (the stance bends the legs there)
};

/**
 * Arm poses while holding a weapon: right / left — radians forward from hanging; rightYaw / leftYaw — each hand turned
 * in towards the body's centre line. D55 (user decision): the pistol is held in both hands (isosceles stance — both
 * arms forward, the hands meet in front of the chest). The long guns use the same hold on the centre line (the stock
 * to the chest): the arms are rigid (no elbows in this rig), so the left hand cannot reach a fore-end ahead of the grip.
 */
export const KEEPER_POSES = {
  pistol: { right: 1.36, left: 1.33, rightYaw: 0.5, leftYaw: 0.53 },
  twoHanded: { right: 1.34, left: 1.36, rightYaw: 0.46, leftYaw: 0.55 },
};
export const poseFor = (weaponId) => (weaponId === 'pistol' ? KEEPER_POSES.pistol : KEEPER_POSES.twoHanded);

/**
 * D55 combat stance (user decision): knees slightly bent — the knees go forward by `knee`, the body sinks by `drop`
 * (the feet stay), the torso leans forward by `lean` rad around the hips. The shader (render3d/rig.js rigStance) and
 * stancePoint() below apply the same formula, so the gun stays in the hands.
 */
export const KEEPER_STANCE = { knee: 3, drop: 1.4, lean: 0.1 };

/** Gun models (render3d/models.js weaponGeometry): their grip (right hand) and barrel tip in the gun's own frame.
 *  scale — the size in the hands (D55: the pistol and the SMG were twice too big for the keeper → about half);
 *  hold — D55: shift of the gun from the hand point (game units, keeper frame) so the fist wraps the handle. */
export const GUN_FRAME = {
  pistol: { grip: [18.5, 32, 7], tip: [32.4, 34.2, 7], scale: 0.52, hold: [-1, 4, -1.2] },
  smg: { grip: [19.5, 31.4, 5.6], tip: [40.6, 33.8, 4], scale: 0.52, hold: [4, 4, -1.2] },
  shotgun: { grip: [17.5, 31.4, 5.6], tip: [52.6, 34.4, 4], scale: 0.78, hold: [0, 2, -1.2] },
  assault_rifle: { grip: [20.5, 31.4, 5.6], tip: [52.4, 34, 4], scale: 0.8, hold: [0, 2, -1.2] },
};
const gunOf = (id) => GUN_FRAME[id] || (id === 'machine_gun' ? GUN_FRAME.assault_rifle : GUN_FRAME.pistol);

/** The right hand in the aiming pose, before the stance (the arm swings forward around the shoulder, then turns in). */
export function handPoint(weaponId) {
  const r = KEEPER_RIG, pose = poseFor(weaponId), a = pose.right, L = r.shoulderY - r.handY;
  const x = L * Math.sin(a), y = -L * Math.cos(a), z = r.handZ - r.shoulderZ; // relative to the shoulder pivot
  const c = Math.cos(pose.rightYaw || 0), s = Math.sin(pose.rightYaw || 0);     // rigRotY(+yaw): in towards −Z
  return [x * c + z * s, r.shoulderY + y, r.shoulderZ - x * s + z * c];
}

/** How the gun model is placed in the hands (before the stance): p' = (p - grip) * scale + hand (hand + hold). */
export function gunPlacement(weaponId) {
  const g = gunOf(weaponId), h = handPoint(weaponId), o = g.hold || [0, 0, 0];
  return { grip: g.grip, scale: g.scale ?? 1, hand: [h[0] + o[0], h[1] + o[1], h[2] + o[2]] };
}

/** Stance transform of a body-frame point above the hips (the hands, the gun): sink, then lean around the hips. */
export function stancePoint([x, y, z], k = 1) {
  const S = KEEPER_STANCE, py = KEEPER_RIG.hipY - S.drop * k, a = -S.lean * k;
  const qx = x, qy = y - S.drop * k - py;
  return [qx * Math.cos(a) - qy * Math.sin(a), py + qx * Math.sin(a) + qy * Math.cos(a), z];
}

/** Barrel tip in the gun's placement, before the stance (the renderer's flash is a child of the gun). */
export function muzzleLocal(weaponId) {
  const { grip, scale, hand } = gunPlacement(weaponId), t = gunOf(weaponId).tip;
  return [hand[0] + (t[0] - grip[0]) * scale, hand[1] + (t[1] - grip[1]) * scale, hand[2] + (t[2] - grip[2]) * scale];
}

/** Barrel tip in the keeper frame: { f: forward, s: right side, h: height } — the bullet start point (sim + render). */
export function muzzlePoint(weaponId) {
  const [f, h, s] = stancePoint(muzzleLocal(weaponId));
  return { f, h, s };
}
