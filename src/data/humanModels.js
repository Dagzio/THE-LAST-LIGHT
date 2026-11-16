// KILL LIST (D78, 2026-11-16): the user's human models (Tripo, Mixamo skeleton, NEW/Office/models — copied unchanged,
// not compressed: user request) and the Mixamo animations converted offline by tools/convert-anims.mjs.
// Presentation data only. Frame of a character in the game: faces +X, up +Y, game units (1 m ≈ 30 units).
const DIR = 'assets/models/';

/** height — game units from the soles to the top of the head. */
export const HUMAN_MODELS = {
  hero: { file: `${DIR}hero.glb`, height: 56 },
  enemy: { file: `${DIR}enemy.glb`, height: 56 },
};

/**
 * Animations (assets/anims/human.json, D79: the user's full Mixamo set — rifle idle / run / strafes / back / fire /
 * reload / hit / toss, pistol idle / walk / run, two deaths). srcHipsCm — the Hips rest height of the rig they were
 * made on (the Hips track is scaled by the model's own Hips height / this). Layers: render3d/humans.js.
 */
export const HUMAN_ANIM = {
  file: 'assets/anims/human.json',
  srcHipsCm: 55.0,
  // presentation tuning (D79)
  blendRate: 10,        // 1/s — how fast the layer weights follow the state
  walkRateMax: 2.3,     // walk / strafe / back clips are played up to this fast (beyond, the feet would slide)
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
  recoilTime: 0.09,     // s of the procedural kick per shot
  recoilPistol: 0.22,   // rad (hand) — pistols kick more
  recoilRifle: 0.08,
};

/**
 * Guns in the hands (the existing user models). rotY turns the raw mesh barrel to +X; grip / tip — hand point and
 * muzzle in that rotated raw frame (measured, D54). length — grip → muzzle in game units.
 */
export const GUN_MODELS = {
  pistol: { file: `${DIR}pistol.min.glb`, rotY: 0.0059, grip: [-0.2992, 0.4963, 0.0017], tip: [0.5002, 0.6218, 0.0017], length: 7.5 },
  smg: { file: `${DIR}smg.min.glb`, rotY: Math.PI - 0.0018, grip: [-0.26, 0.34, 0.0138], tip: [0.46, 0.55, 0.0138], length: 15 },
  rifle: { file: `${DIR}rifle.min.glb`, rotY: 0.8881, grip: [-0.2395, 0.2103, -0.004], tip: [0.6341, 0.2806, -0.004], length: 23 },
};

/** Weapon id (player / enemy weapon data) → gun model. */
export const gunModelOf = (weaponId) => (weaponId === 'smg' ? 'smg' : weaponId === 'pistol' || weaponId === 'enemy_pistol' ? 'pistol' : 'rifle');
