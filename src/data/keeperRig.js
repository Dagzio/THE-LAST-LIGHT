// The keeper's model, stance and how he holds each weapon (D52; skeleton since D56, 2026-11-12). Pure data / math —
// the simulation reads muzzlePoint() (bullets leave the barrel tip) and the renderer (render3d/keeperSkeleton.js) puts
// the gun at the same place and the hands on it (two-bone IK). Frame: the keeper faces +X, up +Y, his right side +Z,
// game units (the keeper is 54 tall).

/** D56: the user's Tripo model with a Mixamo skeleton (T-pose, 1 unit tall, faces +Z → rotY turns it to +X). */
export const KEEPER_MODEL = { file: 'assets/models/player.min.glb', height: 54, rotY: Math.PI / 2 };

/**
 * Combat stance (user decisions D55 / D56): hips lowered → the leg IK bends the knees; the torso leans forward; the
 * shoulders come forward a little (more reach for the short arms); feet a bit wider than at rest.
 * Walk: the feet step along the movement direction (stride ± `stride`, lifted by `lift`), two steps per walk cycle.
 */
export const KEEPER_STANCE = { hipDrop: 2.4, hipBack: 0.6, lean: 0.12, shoulderForward: 0.3, footSpread: 1, stride: 8, lift: 3.5 };

/** Gun models: their grip and barrel tip in the reference gun frame (render3d/glbModels.js bakeGun maps the
 *  textured guns onto it); scale — the size in the hands (D55: pistol / SMG halved; D56: long guns for the short arms). */
export const GUN_FRAME = {
  pistol: { grip: [18.5, 32, 7], tip: [32.4, 34.2, 7], scale: 0.52 },
  smg: { grip: [19.5, 31.4, 5.6], tip: [40.6, 33.8, 4], scale: 0.52 },
  shotgun: { grip: [17.5, 31.4, 5.6], tip: [52.6, 34.4, 4], scale: 0.62 },
  assault_rifle: { grip: [20.5, 31.4, 5.6], tip: [52.4, 34, 4], scale: 0.64 },
};
const gunId = (id) => (GUN_FRAME[id] ? id : id === 'machine_gun' ? 'assault_rifle' : 'pistol');

/**
 * How each gun is held (keeper frame). at — the right palm (on the handle); gun — where the gun's grip point sits
 * relative to the palm (the fist wraps the handle under the slide); left — the left palm relative to the right one;
 * hands — finger direction (`along`) and palm normal (`palm`) of each hand.
 * Pistol (D55, user decision): both hands on the grip, arms forward (isosceles); long guns: the left hand under the
 * fore-end, the stock at the chest.
 */
const RIGHT_GRIP = { along: [1, -0.35, 0], palm: [0, 0, -1] };
const LEFT_WRAP = { along: [1, -0.35, 0], palm: [0, 0, 1] };
const LEFT_UNDER = { along: [0.35, 0, 1], palm: [0, 1, 0] };
export const GUN_HOLD = {
  pistol: { at: [11.5, 38.6, 0.9], gun: [-1.6, 2, 0], left: [-0.2, -0.4, -1.8], hands: [RIGHT_GRIP, LEFT_WRAP] },
  smg: { at: [9, 37.6, 1.6], gun: [2.6, 2.4, 0], left: [5.5, -0.6, -1.3], hands: [RIGHT_GRIP, LEFT_UNDER] },
  shotgun: { at: [7.5, 37, 1.6], gun: [0, 1.4, 0], left: [7.5, -0.6, -1.5], hands: [RIGHT_GRIP, LEFT_UNDER] },
  assault_rifle: { at: [7.5, 37, 1.6], gun: [0, 1.4, 0], left: [7.5, -0.4, -1.5], hands: [RIGHT_GRIP, LEFT_UNDER] },
};
export const holdOf = (weaponId) => GUN_HOLD[gunId(weaponId)];

/** How the gun model is placed: p' = (p - grip) * scale + hand (hand = the right palm + the gun offset). */
export function gunPlacement(weaponId) {
  const id = gunId(weaponId), g = GUN_FRAME[id], h = GUN_HOLD[id];
  return { grip: g.grip, scale: g.scale, hand: [h.at[0] + h.gun[0], h.at[1] + h.gun[1], h.at[2] + h.gun[2]] };
}

/** Barrel tip in the keeper frame: { f: forward, s: right side, h: height } — the bullet start point (sim + render). */
export function muzzlePoint(weaponId) {
  const { grip, scale, hand } = gunPlacement(weaponId), t = GUN_FRAME[gunId(weaponId)].tip;
  return { f: hand[0] + (t[0] - grip[0]) * scale, h: hand[1] + (t[1] - grip[1]) * scale, s: hand[2] + (t[2] - grip[2]) * scale };
}
