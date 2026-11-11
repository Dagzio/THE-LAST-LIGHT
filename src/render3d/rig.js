// Procedural "rig" for static models (D52, 2026-11-11, user decision: animate in the game, no skeleton).
// The vertex shader bends regions of the mesh around pivots — legs around the hip, arms around the shoulders — in the
// model's own frame (faces +X, up +Y, right +Z, game units). Walk = legs swing, arms counter-swing; attack = both arms
// raise and strike; a pose can hold the arms forward (the keeper aiming his weapon). Death / bob / lean stay on the
// object transform. One material per model; instanced meshes read the animation per instance (attribute aAnim), a
// single mesh reads uniforms. The same code goes into the shadow depth material, so shadows move too.
import * as THREE from '../../lib/three.module.js';

/**
 * rig: { hipY, shoulderY, shoulderZ, armZ, armZLow, armSplitY, armMinY } — game units in the baked model frame.
 *   armZ — |z| beyond which a vertex belongs to an arm (above armSplitY); armZLow — the same below armSplitY (claws that
 *   hang next to the legs); armMinY — arms end above this height.
 */
const GLSL = /* glsl */`
uniform vec4 uRigA;   // hipY, shoulderY, shoulderZ, armZ
uniform vec4 uRigB;   // armZLow, armSplitY, armMinY, legSwing
uniform vec4 uPose;   // right arm raise, left arm raise, left arm inward (yaw), recoil
#ifdef RIG_INSTANCED
attribute vec4 aAnim; // walk phase (rad), walk blend 0..1, attack 0..1, (spare)
#define RIG_ANIM aAnim
#else
uniform vec4 uAnim;
#define RIG_ANIM uAnim
#endif
vec3 rigRotZ(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z); }
vec3 rigRotY(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(q.x * c + q.z * s, q.y, -q.x * s + q.z * c); }
float rigArmW(vec3 p) {
  float z = abs(p.z);
  float lim = p.y < uRigB.y ? uRigB.x : uRigA.w;
  return smoothstep(lim - 0.8, lim + 0.8, z) * (1.0 - smoothstep(uRigA.y - 0.5, uRigA.y + 2.0, p.y)) * step(uRigB.z, p.y);
}
float rigLegW(vec3 p, float armW) { return (1.0 - smoothstep(uRigA.x - 3.0, uRigA.x + 1.0, p.y)) * (1.0 - armW); }
void rigDeform(inout vec3 p, inout vec3 n) {
  float swing = sin(RIG_ANIM.x) * RIG_ANIM.y;
  float armW = rigArmW(p);
  float legW = rigLegW(p, armW);
  if (legW > 0.001) {
    float a = swing * uRigB.w * clamp(p.z * 0.8, -1.0, 1.0) * legW; // right leg forward while the left goes back
    vec3 piv = vec3(0.0, uRigA.x, p.z);
    p = piv + rigRotZ(p - piv, a);
    n = rigRotZ(n, a);
  }
  if (armW > 0.001) {
    float right = step(0.0, p.z);
    float a = -swing * 0.45 * (right * 2.0 - 1.0) * (1.0 - max(uPose.x, uPose.y))   // walk counter-swing (not while aiming)
            + RIG_ANIM.z * 1.5                                                        // attack: both arms strike forward
            + mix(uPose.y, uPose.x, right) - uPose.w * right;                         // aim pose + recoil kick
    float yaw = (1.0 - right) * uPose.z;                                              // left hand towards the gun
    vec3 piv = vec3(0.0, uRigA.y, (right * 2.0 - 1.0) * uRigA.z);
    vec3 q = rigRotZ(p - piv, a * armW);
    q = rigRotY(q, -yaw * armW);
    p = piv + q;
    n = rigRotY(rigRotZ(n, a * armW), -yaw * armW);
  }
}
`;

/**
 * Injects the rig into a material (Lambert / Standard, or a MeshDepthMaterial for the shadow pass when `depth`).
 * `shared` holds the uniforms (one block per model, shared by its colour and depth materials).
 */
export function applyRig(material, shared, instanced, depth = false) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    if (instanced) shader.defines = { ...(shader.defines || {}), RIG_INSTANCED: 1 };
    let vs = shader.vertexShader.replace('#include <common>', `#include <common>\n${GLSL}`);
    if (depth) { // the depth shader has no normal chunk outside its #ifdefs: bend the position only
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 rigN0 = vec3(0.0, 1.0, 0.0); rigDeform(transformed, rigN0);');
    } else {
      vs = vs
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 rigP = position; rigDeform(rigP, objectNormal);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = rigP;');
    }
    shader.vertexShader = vs;
  };
  material.customProgramCacheKey = () => `rig-${instanced ? 'i' : 'u'}-${depth ? 'd' : 'c'}`;
  return material;
}

/** Uniform block for one model. */
export function rigUniforms(rig) {
  return {
    uRigA: { value: new THREE.Vector4(rig.hipY, rig.shoulderY, rig.shoulderZ, rig.armZ) },
    uRigB: { value: new THREE.Vector4(rig.armZLow ?? rig.armZ, rig.armSplitY ?? 0, rig.armMinY ?? 0, rig.legSwing ?? 0.5) },
    uPose: { value: new THREE.Vector4(0, 0, 0, 0) },
    uAnim: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
}

/**
 * Bakes a loaded GLB geometry into the game frame: the Tripo models face +Z and are 1 unit tall → rotate to face +X,
 * scale to `height` game units, feet on y = 0.
 */
export function bakeModel(geometry, height) {
  geometry.rotateY(Math.PI / 2);
  geometry.scale(height, height, height);
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
