// KILL LIST (D78, 2026-11-16): the user's human models (Tripo, Mixamo skeleton, NEW/Office/models — copied unchanged,
// not compressed: user request) and the Mixamo animations converted offline by tools/convert-anims.mjs.
// Presentation data only. Frame of a character in the game: faces +X, up +Y, game units (1 m ≈ 30 units).
const DIR = 'assets/models/';

/** height — game units from the soles to the top of the head. */
export const HUMAN_MODELS = {
  hero: { file: `${DIR}hero.glb`, height: 56 },
  enemy: { file: `${DIR}enemy.glb`, height: 56 },
  // D89: the training ground's instructors / dummies (NEW/tutorial/models — the same Mixamo rig, the enemies' clips)
  enemyTraining: { file: `${DIR}enemy_training.glb`, height: 56 },
};

/** Enemy model of a level (level.enemyModel) — the key of HUMAN_MODELS; the office keeps the default enemy. */
export const enemyModelOf = (level) => (level && HUMAN_MODELS[level.enemyModel] ? level.enemyModel : 'enemy');

/**
 * Animations (assets/anims/human.json, D79: the user's full Mixamo set — rifle idle / run / strafes / back / fire /
 * reload / hit / toss, pistol idle / walk / run, two deaths; D82: + the roll, crouch idle / walk and the enemies'
 * variants — rifle idle 2, rifle run 2 / 3, walking hit, walking reload, walking death). srcHipsCm — the Hips rest height of the rig they were
 * made on (the Hips track is scaled by the model's own Hips height / this). Layers: render3d/humans.js.
 */
export const HUMAN_ANIM = {
  file: 'assets/anims/human.json',
  srcHipsCm: 55.0,
  // presentation tuning (D79)
  blendRate: 10,        // 1/s — how fast the layer weights follow the state
  walkRateMax: 2.3,     // walk / strafe / back clips are played up to this fast (beyond, the feet would slide)
  runRateMax: 1.6,      // run clips
  strideK: 1.12,        // D86: "In Place" clips — ground speed = planted-foot speed × this (calibrated on the clips with travel)
  aimYawRate: 10,       // D86: 1/s — how fast the body's barrel correction follows (eases out the stride's sway)
  // D90 (user: closer to the wall): in cover the model is drawn this many units nearer the object than his collision
  // circle allows (the circle is wider than the body's depth); presentation only
  coverHugHigh: 7,
  coverHugLow: 6,
  // D110 (user): turning on the spot (standing, below `below` u/s) faster than `from` rad/s he side-steps toward the turn:
  // the steps' pace = a foot this far from his axis (radius) moving with the turn, between minSpeed and maxSpeed u/s
  turnSteps: { below: 8, from: 1.4, radius: 9, minSpeed: 14, maxSpeed: 38 },
  // D110: standing up from low cover — the parts of "Crouch To Standing With Rifle" / "Stand To Crouch" (s) from the
  // kneel to the upright stance (measured on the Hips height: 21 → 53 / 52 → 22)
  rise: { upFrom: 0.1, upTo: 0.72, downFrom: 0.08, downTo: 0.65 },
  peekFrom: 0.2,        // D87: "Female Peek And Aim" — leaning out plays from here (s)…
  peekHoldAt: 1.2,      // …to the held aim (the clip: lean 0.3–0.9, aim held 0.9–1.6, back 1.7–2.4)
  runFrom: 48,          // units/s: walk legs below, run legs above (mixed in between)
  runTo: 78,
  hitTime: 0.45,        // s the hit flinch shows on the upper body…
  hitFrom: 0.05,        // …taken from this part of "Hit Reaction" (s)
  hitSpan: 0.55,
  throwStart: 0.6,      // "Toss Grenade": aiming winds the arm up from here…
  throwHold: 1.55,      // …and holds the cocked arm here; the throw plays on from it (the hand flies ~0.25 s later)
  throwRelease: 1.05,   // s the rest of the toss plays after the throw
  throwHandOff: 0.7,    // the gun is in the LEFT hand between these clip times (the right arm throws)
  throwHandBack: 2.5,
  carryForeEnd: 8,      // units from the grip: where the LEFT palm holds a long gun meanwhile (D81; a pistol — by its grip)
  recoilTime: 0.09,     // s of the procedural kick per shot
  recoilPistol: 0.22,   // rad (hand) — pistols kick more
  recoilRifle: 0.08,
};

/**
 * Guns in the hands (the existing user models). rotY turns the raw mesh barrel to +X; grip / tip — reference points in
 * that rotated raw frame (D54) that set the barrel line; length — grip → tip in the baked frame. D80 (user request:
 * real sizes, held right): hand — where the right palm holds it in that baked frame (the pistol grip found from the
 * mesh profile: behind the magazine); size — the final scale, so the whole gun is about its real length
 * (1 m ≈ 30 units: pistol ≈ 22 cm, SMG ≈ 57 cm, rifle ≈ 86 cm).
 */
export const GUN_MODELS = {
  pistol: { file: `${DIR}pistol.min.glb`, rotY: 0.0059, grip: [-0.2992, 0.4963, 0.0017], tip: [0.5002, 0.6218, 0.0017], length: 7.5, hand: [-0.9, -1.4], size: 0.67 },
  smg: { file: `${DIR}smg.min.glb`, rotY: Math.PI - 0.0018, grip: [-0.26, 0.34, 0.0138], tip: [0.46, 0.55, 0.0138], length: 15, hand: [-5.0, 0.2], size: 0.78 },
  rifle: { file: `${DIR}rifle.min.glb`, rotY: 0.8881, grip: [-0.2395, 0.2103, -0.004], tip: [0.6341, 0.2806, -0.004], length: 23, hand: [-2.1, -1.6], size: 0.79 },
};

/** Weapon id (player / enemy weapon data) → gun model. */
export const gunModelOf = (weaponId) => (weaponId === 'smg' ? 'smg' : weaponId === 'pistol' || weaponId === 'pistol_sd' || weaponId === 'enemy_pistol' ? 'pistol' : 'rifle');
