// Textured 3D models from the user (Tripo, D54 2026-11-11), optimized offline to *.min.glb (meshoptimizer, 512 px
// textures; guns 256 px). Presentation data only: where each file sits in the game frame (faces +X, up +Y, right
// +Z, game units) and how the procedural vertex rig bends it (render3d/rig.js). Numbers were measured from the models
// (width / height profiles, barrel and neck search) — see PROJECT_AUDIT D54.
const DIR = 'assets/models/';

/**
 * Enemies. height — game units; rotY — bake rotation (Tripo faces +Z → π/2; the runner already faces +X → 0).
 * rig (fractions of the height): hipY — legs swing below it; shoulderY / shoulderZ / armZ / armMinY — the arm
 * region (armZ ≥ 9 = no arm rig, the attack is the body lunge); quad — four or more legs: diagonal pairs swing, legX
 * = distance of the leg pivots from the body centre.
 */
export const ENEMY_GLB = {
  grunt: { file: `${DIR}grunt.min.glb`, height: 40, rotY: Math.PI / 2,
    rig: { hipY: 0.32, shoulderY: 0.66, shoulderZ: 0.22, armZ: 0.24, armMinY: 0.34, legSwing: 0.5 } },
  runner: { file: `${DIR}runner.min.glb`, height: 42, rotY: 0,
    rig: { hipY: 0.4, shoulderY: 0.7, shoulderZ: 0.2, armZ: 99, armMinY: 0.5, legSwing: 0.55 } },
  husk: { file: `${DIR}husk.min.glb`, height: 44, rotY: Math.PI / 2,
    rig: { hipY: 0.24, shoulderY: 0.62, shoulderZ: 0.26, armZ: 0.3, armMinY: 0.2, legSwing: 0.45 } },
  spitter: { file: `${DIR}spitter.min.glb`, height: 36, rotY: Math.PI / 2,
    rig: { hipY: 0.28, shoulderY: 0.9, shoulderZ: 0.2, armZ: 99, armMinY: 0.9, legSwing: 0.45, quad: true, legX: 0.18 } },
  brute: { file: `${DIR}brute.min.glb`, height: 58, rotY: Math.PI / 2,
    rig: { hipY: 0.22, shoulderY: 0.9, shoulderZ: 0.2, armZ: 99, armMinY: 0.9, legSwing: 0.35, quad: true, legX: 0.2 } },
  fog_mother: { file: `${DIR}mother.min.glb`, height: 130, rotY: Math.PI / 2,
    rig: { hipY: 0.18, shoulderY: 0.9, shoulderZ: 0.2, armZ: 99, armMinY: 0.9, legSwing: 0.3, quad: true, legX: 0.2 } },
};

/** Rig in game units for a model entry (the shader works in the baked frame). */
export function enemyRig(entry) {
  const H = entry.height, r = entry.rig;
  return {
    hipY: r.hipY * H, shoulderY: r.shoulderY * H, shoulderZ: r.shoulderZ * H, armZ: r.armZ * H, armZLow: r.armZ * H,
    armSplitY: 0, armMinY: r.armMinY * H, legSwing: r.legSwing, quad: !!r.quad, legX: (r.legX || 0) * H,
  };
}

/**
 * Guns in the keeper's hands. rotY turns the barrel to +X (muzzle by the thinner end); grip / tip — the hand point and
 * the muzzle in that rotated raw frame. The game maps grip → tip onto keeperRig GUN_FRAME (same muzzle as before,
 * so the simulation's bullet start does not change).
 */
export const GUN_GLB = {
  pistol: { file: `${DIR}pistol.min.glb`, rotY: 0.0059, grip: [-0.2992, 0.4963, 0.0017], tip: [0.5002, 0.6218, 0.0017] },
  smg: { file: `${DIR}smg.min.glb`, rotY: -0.0018, grip: [-0.14, 0.3466, -0.0138], tip: [0.5, 0.469, -0.0138] },
  shotgun: { file: `${DIR}shotgun.min.glb`, rotY: -3.1398, grip: [-0.1993, 0.1459, -0.0006], tip: [0.5, 0.187, -0.0006] },
  assault_rifle: { file: `${DIR}rifle.min.glb`, rotY: 0.8881, grip: [-0.2395, 0.2103, -0.004], tip: [0.6341, 0.2806, -0.004] },
};

/**
 * Turrets per device type and level (1…3). rotY turns the barrel to +X; center — base centre (raw x, z); split —
 * raw height of the neck: triangles above it form the head that turns to the target; baseR — base radius (raw), scaled
 * to TURRET_BASE_RADIUS game units. tipD / tipY (raw) — the muzzle (→ data/defenses.js muzzleOffset / muzzleHeight).
 */
export const TURRET_BASE_RADIUS = 30;
export const TURRET_GLB = {
  guard_turret: [
    { file: `${DIR}turret1.min.glb`, rotY: 1.609, center: [0.013, -0.115], split: 0.343, baseR: 0.412, tipD: 0.617, tipY: 0.569 },
    { file: `${DIR}turret2.min.glb`, rotY: 1.451, center: [-0.014, -0.131], split: 0.413, baseR: 0.496, tipD: 0.631, tipY: 0.568 },
    { file: `${DIR}turret3.min.glb`, rotY: 1.693, center: [0.035, -0.14], split: 0.319, baseR: 0.435, tipD: 0.642, tipY: 0.446 },
  ],
  frost_coil: [
    { file: `${DIR}ice-turret1.min.glb`, rotY: 0.078, center: [-0.042, -0.031], split: 0.391, baseR: 0.48, tipD: 0.543, tipY: 0.627 },
    { file: `${DIR}ice-turret2.min.glb`, rotY: 1.339, center: [0.042, -0.052], split: 0.438, baseR: 0.484, tipD: 0.571, tipY: 0.632 },
    { file: `${DIR}ice-turret3.min.glb`, rotY: 0, center: [0.041, 0.042], split: 0.343, baseR: 0.552, tipD: 0.459, tipY: 0.59 },
  ],
  poison_turret: [
    { file: `${DIR}poison-turret1.min.glb`, rotY: -0.096, center: [-0.121, 0.049], split: 0.524, baseR: 0.503, tipD: 0.623, tipY: 0.655 },
    { file: `${DIR}poison-turret2.min.glb`, rotY: 0.055, center: [-0.083, -0.016], split: 0.344, baseR: 0.442, tipD: 0.561, tipY: 0.61 },
    { file: `${DIR}poison-turret3.min.glb`, rotY: -0.125, center: [-0.047, 0.043], split: 0.468, baseR: 0.507, tipD: 0.554, tipY: 0.623 },
  ],
};

/** Muzzle of a turret level in game units: { offset: forward from the pad centre, height }. */
export function turretMuzzle(entry) {
  const s = TURRET_BASE_RADIUS / entry.baseR;
  return { offset: Math.round(entry.tipD * s * 0.95), height: Math.round(entry.tipY * s) };
}
