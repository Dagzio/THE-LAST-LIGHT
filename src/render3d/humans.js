// KILL LIST (D78): skinned human characters — the user's Tripo models with their Mixamo skeleton, animated by the
// user's Mixamo clips (assets/anims/human.json, tools/convert-anims.mjs). Presentation only: a HumanView reads the
// state it is given each frame and never touches the simulation.
//
// The models share the animation rig (same bone names and rest rotations), so every bone's local rotation is copied
// as is; only the Hips (world rotation + position in cm in the files) is converted into the model's own Hips parent
// frame and scaled by its Hips height. Layers: the legs (idle / walk) and the upper body (relaxed / aim / reload /
// hit) are separate clips mixed by weight, so the hero can walk and shoot at the same time; death is a full clip.
// The node tree is cloned per character; geometry, texture, material and clips are shared.
import * as THREE from '../../lib/three.module.js';
import { HUMAN_ANIM } from '../data/humanModels.js';

const LOWER = new Set(['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'LeftToe_End',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'RightToe_End']);
const clean = (n) => (n || '').replace(/^mixamorig:?/, '');

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

/** One loaded model (hero / enemy): skeleton, clips for that skeleton, the gun mount on its right hand. */
export class HumanTemplate {
  /**
   * @param {{root: THREE.Object3D, mesh: THREE.SkinnedMesh, bones: Map<string, THREE.Bone>}} model parseSkinnedGLB()
   * @param {object} anims assets/anims/human.json
   * @param {number} height game units
   */
  constructor(model, anims, height) {
    this.root = model.root;
    this.mesh = model.mesh;
    this.root.traverse((o) => { o.name = clean(o.name); });
    this.skeleton = this.mesh.skeleton;
    this.bones = model.bones; // clean name → bone
    this.mesh.frustumCulled = false; // bind-pose bounds do not follow the animated bones
    this.root.updateMatrixWorld(true);
    const B = (n) => this.bones.get(n);
    const headTop = B('HeadTop_End') ? B('HeadTop_End').getWorldPosition(_v).y : 1;
    this.scale = height / (headTop + 0.02);
    this.height = height;
    this.clips = this._buildClips(anims);
    this.rootSpeed = {}; // cm/s of each clip → game units/s
    const unitsPerCm = this.hipsK * this.scale;
    for (const id in anims.clips) this.rootSpeed[id] = anims.clips[id].rootSpeed * unitsPerCm;
    this.mount = this._gunMount(anims);
  }

  /** Track sets per clip: full / upper / lower, Hips converted into this skeleton. */
  _buildClips(anims) {
    const hips = this.bones.get('Hips');
    const parent = hips.parent;
    parent.updateMatrixWorld(true);
    const pInv = parent.matrixWorld.clone().invert();
    const pqInv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.hipsK = hips.getWorldPosition(_v).y / HUMAN_ANIM.srcHipsCm; // model units per cm of the source rig
    this.hipsLocal = {}; // clip id → Float32Array of local Hips quaternions (gun mount pose)
    const out = {};
    for (const [id, c] of Object.entries(anims.clips)) {
      const n = c.frames;
      const times = new Float32Array(n);
      for (let i = 0; i < n; i++) times[i] = Math.min(c.duration, i / anims.fps);
      const full = [], upper = [], lower = [];
      for (const [name, vals] of Object.entries(c.q)) {
        if (!this.bones.has(name)) continue;
        let values = Float32Array.from(vals);
        if (name === 'Hips') {
          for (let i = 0; i < n; i++) {
            _q.fromArray(values, i * 4).premultiply(pqInv);
            if (i > 0) { // keep the sign continuous (no flip in the interpolation)
              const d = _q.x * values[i * 4 - 4] + _q.y * values[i * 4 - 3] + _q.z * values[i * 4 - 2] + _q.w * values[i * 4 - 1];
              if (d < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w);
            }
            _q.toArray(values, i * 4);
          }
          this.hipsLocal[id] = values;
        }
        const tr = new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
        full.push(tr);
        (LOWER.has(name) ? lower : upper).push(tr);
      }
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        _v.set(c.hips[i * 3], c.hips[i * 3 + 1], c.hips[i * 3 + 2]).multiplyScalar(this.hipsK).applyMatrix4(pInv);
        _v.toArray(pos, i * 3);
      }
      const hp = new THREE.VectorKeyframeTrack('Hips.position', times, pos);
      full.push(hp);
      lower.push(hp);
      out[id] = {
        full: new THREE.AnimationClip(id, c.duration, full),
        upper: new THREE.AnimationClip(`${id}.upper`, c.duration, upper),
        lower: new THREE.AnimationClip(`${id}.lower`, c.duration, lower),
        duration: c.duration,
      };
    }
    return out;
  }

  /** Poses this template's own skeleton at a clip frame (one-off measurements, not per frame). */
  _pose(anims, id, frame) {
    const c = anims.clips[id];
    const rest = [];
    for (const b of this.skeleton.bones) rest.push([b, b.quaternion.clone(), b.position.clone()]);
    for (const [name, vals] of Object.entries(c.q)) {
      const b = this.bones.get(name);
      if (!b) continue;
      if (name === 'Hips') b.quaternion.fromArray(this.hipsLocal[id], frame * 4);
      else b.quaternion.fromArray(vals, frame * 4);
    }
    this.root.updateMatrixWorld(true);
    return () => { for (const [b, q, p] of rest) { b.quaternion.copy(q); b.position.copy(p); } this.root.updateMatrixWorld(true); };
  }

  /**
   * Where a gun sits in the right hand: grip at the palm, barrel from the right palm towards the left one (the aim
   * pose of the "walkFire" clip), level with the ground. → { pos, quat } local to the RightHand bone, `yaw` — the
   * barrel's angle away from the body facing in the aim pose (the renderer turns the body by it, so the barrel points
   * at the aim), and `tip(len)` — the muzzle of a gun of that length in the character frame (+X forward, game units).
   */
  _gunMount(anims) {
    const R = this.bones.get('RightHand'), L = this.bones.get('LeftHand');
    const RM = this.bones.get('RightHandMiddle1'), LM = this.bones.get('LeftHandMiddle1');
    if (!R || !L) return null;
    const frame = Math.min(anims.clips.walkFire.frames - 1, Math.round(0.5 * anims.fps));
    const restore = this._pose(anims, 'walkFire', frame);
    const palm = (hand, mid, out) => {
      hand.getWorldPosition(out);
      if (mid) out.lerp(mid.getWorldPosition(_v2), 0.55);
      return out;
    };
    const gripR = palm(R, RM, new THREE.Vector3());
    const gripL = palm(L, LM, new THREE.Vector3());
    const barrel = gripL.clone().sub(gripR);
    barrel.y *= 0.25; // mostly level (the pose holds the gun a bit down)
    barrel.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(barrel, up).normalize();
    const yAxis = new THREE.Vector3().crossVectors(side, barrel).normalize();
    const gunWorld = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(barrel, yAxis, side));
    const handQ = R.getWorldQuaternion(new THREE.Quaternion());
    const quat = handQ.clone().invert().multiply(gunWorld);
    R.updateMatrixWorld(true);
    const pos = gripR.clone().applyMatrix4(R.matrixWorld.clone().invert());
    // the model faces +Z in its own frame; the game turns it to +X (rotY = π/2): game (x, y=z_model→, ...) mapping:
    // model (mx, my, mz) → character frame (f = mz, h = my, s = −mx … right side = −mx) scaled to game units
    const s = this.scale;
    const yaw = Math.atan2(-barrel.x, barrel.z); // sim angle of the barrel vs the facing (+ = towards the right side)
    const grip = { f: gripR.z * s, s: -gripR.x * s, h: gripR.y * s };
    const dir = { f: barrel.z, s: -barrel.x, h: barrel.y };
    restore();
    return { pos, quat, yaw, grip, dir };
  }

  /**
   * Muzzle of a gun `length` long in the character frame WITH the aim compensation (body turned by −yaw):
   * { f: forward, s: right, h: height } game units.
   */
  muzzle(length) {
    const m = this.mount;
    if (!m) return { f: 20, s: 4, h: 34 };
    const f = m.grip.f + m.dir.f * length, sd = m.grip.s + m.dir.s * length, h = m.grip.h + m.dir.h * length;
    const c = Math.cos(-m.yaw), sn = Math.sin(-m.yaw); // rotate (f, s) by −yaw
    return { f: f * c - sd * sn, s: f * sn + sd * c, h };
  }

  /** A new character: its own bones + mixer, shared geometry / clips. @param {THREE.Material} material */
  instantiate(material) {
    const root = this.root.clone(true);
    const byName = new Map();
    let mesh = null;
    root.traverse((o) => { if (o.isBone) byName.set(o.name, o); if (o.isSkinnedMesh) mesh = o; });
    const bones = this.skeleton.bones.map((b) => byName.get(b.name));
    mesh.bind(new THREE.Skeleton(bones, this.skeleton.boneInverses), mesh.bindMatrix);
    mesh.material = material;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return new HumanView(this, root, mesh, byName);
  }
}

/**
 * One character on screen. update(dt, st) — st: { speed (units/s), moveDot (cos between movement and facing), aim
 * (bool), reload (0…1 progress, < 0 = no), hitAge (s since the last hit), deadAge (s since death, < 0 = alive) }.
 */
export class HumanView {
  constructor(tpl, root, mesh, bones) {
    this.tpl = tpl;
    this.mesh = mesh;
    this.bones = bones;
    this.group = new THREE.Group();   // placed and turned by the renderer (faces +X)
    this.wrap = new THREE.Group();
    this.wrap.rotation.y = Math.PI / 2;
    this.wrap.scale.setScalar(tpl.scale);
    this.wrap.add(root);
    this.group.add(this.wrap);
    this.hand = bones.get('RightHand');
    this.mixer = new THREE.AnimationMixer(root);
    const C = tpl.clips;
    const act = (clip) => { const a = this.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); return a; };
    this.a = {
      idleL: act(C.idle.lower), walkL: act(C.walk.lower),
      idleU: act(C.idle.upper), walkU: act(C.walk.upper), fireU: act(C.walkFire.upper),
      reloadU: act(C.reload.upper), hitU: act(C.hit.upper), die: act(C.die.full),
    };
    for (const k of ['reloadU', 'hitU', 'die']) this.a[k].timeScale = 0; // their time is set from the state
    this.a.die.setLoop(THREE.LoopOnce, 1);
    this.a.die.clampWhenFinished = true;
    this.w = { walk: 0, aim: 0, reload: 0, hit: 0, dead: 0 };
    this.guns = {};
    this.gun = null;
    this.muzzle = null;
    this.aimYaw = 0;
    this.relaxedWalk = 'idle'; // which upper body plays while walking without aiming ('idle' = gun held low, 'walk' = arm swing)
  }

  /** Adds a gun model (shared geometry, baked: grip at 0, barrel +X, game units) for weapon key `id`. */
  addGun(id, geometry, material, length) {
    const m = this.tpl.mount;
    if (!m || !this.hand) return;
    const g = new THREE.Mesh(geometry, material);
    g.position.copy(m.pos);
    g.quaternion.copy(m.quat);
    g.scale.setScalar(1 / this.tpl.scale); // the hand bone lives in model units
    g.castShadow = true;
    g.visible = false;
    g.userData.length = length;
    this.hand.add(g);
    this.guns[id] = g;
  }

  setGun(id) {
    const g = this.guns[id] || null;
    if (g === this.gun) return;
    if (this.gun) this.gun.visible = false;
    this.gun = g;
    if (g) {
      g.visible = true;
      if (this.muzzle) { g.add(this.muzzle); this.muzzle.position.set(g.userData.length + 1, 0.6, 0); }
    }
  }

  /** A flash object that sits on the muzzle of the current gun. */
  attachMuzzle(obj) {
    this.muzzle = obj;
    if (this.gun) { this.gun.add(obj); obj.position.set(this.gun.userData.length + 1, 0.6, 0); }
  }

  update(dt, st) {
    const A = HUMAN_ANIM, w = this.w, a = this.a, tpl = this.tpl;
    const k = Math.min(1, Math.max(0, dt) * A.blendRate);
    const dead = st.deadAge >= 0;
    const tWalk = dead ? 0 : Math.min(1, st.speed / 14);
    const tAim = !dead && st.aim && !(st.reload >= 0) ? 1 : 0;
    const tReload = !dead && st.reload >= 0 ? 1 : 0;
    const tHit = !dead && st.hitAge < A.hitTime ? Math.sin((st.hitAge / A.hitTime) * Math.PI) : 0;
    w.walk += (tWalk - w.walk) * k;
    w.aim += (tAim - w.aim) * k;
    w.reload += (tReload - w.reload) * Math.min(1, dt * A.blendRate * 1.5);
    w.hit = tHit;
    w.dead += ((dead ? 1 : 0) - w.dead) * Math.min(1, dt * 12);
    const live = 1 - w.dead;

    // legs
    a.walkL.setEffectiveWeight(w.walk * live);
    a.idleL.setEffectiveWeight((1 - w.walk) * live);
    const rate = Math.min(A.walkRateMax, Math.max(0.6, st.speed / (tpl.rootSpeed.walk || 29)));
    a.walkL.timeScale = st.moveDot < -0.35 ? -rate : rate; // walking backwards while aiming the other way
    // upper body: reload > aim > relaxed; the hit flinch on top
    const up = live * (1 - w.hit * 0.85);
    const rl = w.reload, am = w.aim * (1 - rl), relaxed = Math.max(0, 1 - rl - am);
    const walkUp = this.relaxedWalk === 'walk' ? w.walk : 0;
    a.reloadU.setEffectiveWeight(rl * up);
    a.fireU.setEffectiveWeight(am * up);
    a.walkU.setEffectiveWeight(relaxed * walkUp * up);
    a.idleU.setEffectiveWeight(relaxed * (1 - walkUp) * up);
    a.hitU.setEffectiveWeight(w.hit * live);
    a.fireU.timeScale = 0.6 + 0.4 * w.walk;
    a.walkU.timeScale = rate;
    if (st.reload >= 0) a.reloadU.time = Math.min(0.999, st.reload) * tpl.clips.reload.duration;
    if (w.hit > 0) a.hitU.time = Math.min(tpl.clips.hit.duration * 0.999, st.hitAge / A.hitTime * tpl.clips.hit.duration);
    a.die.setEffectiveWeight(w.dead);
    if (dead) a.die.time = Math.min(tpl.clips.die.duration, st.deadAge);
    this.mixer.update(Math.max(0, dt));
    // the body turns a little while aiming so the barrel (not the chest) points at the aim
    this.aimYaw = tpl.mount ? tpl.mount.yaw * w.aim * (1 - w.reload) * live : 0;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

/** Gun model → baked geometry: grip at the origin, muzzle on +X at `length`, up +Y (game units). */
export function bakeGunGeometry(geometry, entry) {
  geometry.rotateY(entry.rotY);
  const [gx, gy, gz] = entry.grip, [tx, ty] = entry.tip;
  geometry.translate(-gx, -gy, -gz);
  geometry.rotateZ(-Math.atan2(ty - gy, tx - gx));
  const s = entry.length / Math.hypot(tx - gx, ty - gy);
  geometry.scale(s, s, s);
  geometry.computeBoundingSphere();
  return geometry;
}
