// Skinned human characters (D78 / D79) — the user's Tripo models with their Mixamo skeleton, animated by the user's
// Mixamo clips (assets/anims/human.json, tools/convert-anims.mjs). Presentation only: a HumanView reads the state it is
// given each frame and never touches the simulation.
//
// The models share the animation rig, so every bone's local rotation is copied as is; only the Hips (world rotation +
// position in cm in the files) is converted into the model's own Hips parent frame and scaled by its Hips height.
// Layers (D79):
//  - legs: idle / walk / run / walk back / strafe left / strafe right, mixed by the movement direction relative to the
//    facing (pistol: its own walk / run legs);
//  - upper body, two weapon sets — rifle (rifle, SMG) and pistol: relaxed (idle / run), aim (Firing Rifle / Pistol
//    Idle), reload (Reloading; the pistol has no clip: Pistol Idle + procedural hand moves), hit, grenade toss (the gun
//    goes to the left hand while the right arm throws — works with both sets);
//  - death: one of two full-body clips.
// The node tree is cloned per character; geometry, texture, material and clips are shared.
import * as THREE from '../../lib/three.module.js';
import { HUMAN_ANIM } from '../data/humanModels.js';

const LOWER = new Set(['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'LeftToe_End',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'RightToe_End']);
const clean = (n) => (n || '').replace(/^mixamorig:?/, '');
const setOf = (gunId) => (gunId === 'pistol' ? 'pistol' : 'rifle');
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _axis = new THREE.Vector3();
const _q3 = new THREE.Quaternion();

/** One loaded model (hero / enemy): skeleton, clips for that skeleton, gun mounts. */
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
    this.bones = model.bones;
    this.mesh.frustumCulled = false;
    this.root.updateMatrixWorld(true);
    const headTop = this.bones.get('HeadTop_End') ? this.bones.get('HeadTop_End').getWorldPosition(_v).y : 1;
    this.scale = height / (headTop + 0.02);
    this.height = height;
    this.anims = anims;
    this.clips = this._buildClips(anims);
    this.rootSpeed = {};
    const unitsPerCm = this.hipsK * this.scale;
    for (const id in anims.clips) this.rootSpeed[id] = anims.clips[id].rootSpeed * unitsPerCm;
    this.mounts = { rifle: this._mount('rifle'), pistol: this._mount('pistol') };
    this.mount = this.mounts.rifle; // (dev viewer info)
  }

  _buildClips(anims) {
    const hips = this.bones.get('Hips');
    const parent = hips.parent;
    parent.updateMatrixWorld(true);
    const pInv = parent.matrixWorld.clone().invert();
    const pqInv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.hipsK = hips.getWorldPosition(_v).y / HUMAN_ANIM.srcHipsCm;
    this.hipsLocal = {};
    this.hipsPos = {};
    const out = {};
    for (const [id, c] of Object.entries(anims.clips)) {
      const n = c.frames;
      const times = new Float32Array(n);
      for (let i = 0; i < n; i++) times[i] = Math.min(c.duration, i / anims.fps);
      const full = [], upper = [], lower = [];
      for (const [name, vals] of Object.entries(c.q)) {
        if (!this.bones.has(name)) continue;
        const values = Float32Array.from(vals);
        if (name === 'Hips') {
          for (let i = 0; i < n; i++) {
            _q.fromArray(values, i * 4).premultiply(pqInv);
            if (i > 0) {
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
      this.hipsPos[id] = pos;
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

  /** Poses this template's own skeleton at a clip time (one-off measurements). Returns a restore function. */
  _pose(id, time) {
    const c = this.anims.clips[id];
    const f = Math.max(0, Math.min(c.frames - 1, Math.round(time * this.anims.fps)));
    const rest = [];
    for (const b of this.skeleton.bones) rest.push([b, b.quaternion.clone(), b.position.clone()]);
    for (const [name, vals] of Object.entries(c.q)) {
      const b = this.bones.get(name);
      if (!b) continue;
      if (name === 'Hips') { b.quaternion.fromArray(this.hipsLocal[id], f * 4); b.position.fromArray(this.hipsPos[id], f * 3); } else b.quaternion.fromArray(vals, f * 4);
    }
    this.root.updateMatrixWorld(true);
    return () => { for (const [b, q, p] of rest) { b.quaternion.copy(q); b.position.copy(p); } this.root.updateMatrixWorld(true); };
  }

  _palm(side, out) {
    const hand = this.bones.get(`${side}Hand`), mid = this.bones.get(`${side}HandMiddle1`);
    hand.getWorldPosition(out);
    if (mid) out.lerp(mid.getWorldPosition(_v2), 0.55);
    return out;
  }

  /**
   * Gun mount of a weapon set: grip at the right palm, the barrel (rifle: right palm → left palm in the "fire" pose;
   * pistol: along the forearm in the "pIdle" pose), level-ish. → { pos, quat } local to RightHand, the same gun moved to
   * the LEFT hand while the right arm throws a grenade (carry: { pos, quat } local to LeftHand, at the toss hand-off
   * moment), `yaw` — the barrel's angle vs the facing in the aim pose (sim angle, + = right side), grip / dir in the
   * character frame (+X forward, game units).
   */
  _mount(set) {
    const R = this.bones.get('RightHand'), L = this.bones.get('LeftHand'), RF = this.bones.get('RightForeArm');
    if (!R || !L || !RF) return null;
    const pose = set === 'pistol' ? 'pIdle' : 'fire';
    let restore = this._pose(pose, 0.33);
    const gripR = this._palm('Right', new THREE.Vector3());
    const barrel = new THREE.Vector3();
    if (set === 'pistol') barrel.copy(R.getWorldPosition(new THREE.Vector3())).sub(RF.getWorldPosition(_v2));
    else barrel.copy(this._palm('Left', new THREE.Vector3())).sub(gripR);
    barrel.y *= set === 'pistol' ? 0.15 : 0.25;
    barrel.normalize();
    const side = new THREE.Vector3().crossVectors(barrel, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, barrel).normalize();
    const gunWorldQ = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(barrel, up, side));
    const quat = R.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(gunWorldQ);
    const pos = gripR.clone().applyMatrix4(R.matrixWorld.clone().invert());
    const s = this.scale;
    const out = {
      pos, quat,
      yaw: Math.atan2(-barrel.x, barrel.z),
      grip: { f: gripR.z * s, s: -gripR.x * s, h: gripR.y * s },
      dir: { f: barrel.z, s: -barrel.x, h: barrel.y },
    };
    restore();
    // the left-hand carry for the grenade toss: where the right-hand gun is at the hand-off moment, in LeftHand space
    restore = this._pose('throw', HUMAN_ANIM.throwHandOff);
    const gunM = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1)).premultiply(R.matrixWorld);
    const local = L.matrixWorld.clone().invert().multiply(gunM);
    const cp = new THREE.Vector3(), cq = new THREE.Quaternion(), cs = new THREE.Vector3();
    local.decompose(cp, cq, cs);
    out.carry = { pos: cp, quat: cq };
    restore();
    return out;
  }

  /** Muzzle of a gun `length` long in the character frame with the aim compensation (body turned by −yaw). */
  muzzle(gunId, length) {
    const m = this.mounts[setOf(gunId)];
    if (!m) return { f: 20, s: 4, h: 34 };
    const f = m.grip.f + m.dir.f * length, sd = m.grip.s + m.dir.s * length, h = m.grip.h + m.dir.h * length;
    const c = Math.cos(-m.yaw), sn = Math.sin(-m.yaw);
    return { f: f * c - sd * sn, s: f * sn + sd * c, h };
  }

  /** A new character: its own bones + mixer, shared geometry / clips. @param {THREE.Material} material */
  instantiate(material, variant = 0) {
    const root = this.root.clone(true);
    const byName = new Map();
    let mesh = null;
    root.traverse((o) => { if (o.isBone) byName.set(o.name, o); if (o.isSkinnedMesh) mesh = o; });
    const bones = this.skeleton.bones.map((b) => byName.get(b.name));
    mesh.bind(new THREE.Skeleton(bones, this.skeleton.boneInverses), mesh.bindMatrix);
    mesh.material = material;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return new HumanView(this, root, mesh, byName, variant);
  }
}

const LEGS = ['idle', 'walk', 'run', 'back', 'strafeL', 'strafeR', 'pWalk', 'pRun'];
const UPPER = ['idle', 'run', 'fire', 'reload', 'hit', 'throw', 'pIdle', 'pWalk', 'pRun'];

/**
 * One character on screen. update(dt, st) — st: { speed (units/s), moveRel (movement direction minus facing, rad, sim
 * convention: + = to the right), aim (bool), reload (0…1 progress, < 0 = no), hitAge (s since the last hit), deadAge
 * (s since death, < 0 = alive), shotAge (s since the last shot), throwAim (bool: a grenade is being aimed), throwAge
 * (s since the last throw, Infinity = none) }.
 */
export class HumanView {
  constructor(tpl, root, mesh, bones, variant = 0) {
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
    this.leftHand = bones.get('LeftHand');
    this.mixer = new THREE.AnimationMixer(root);
    const C = tpl.clips;
    const act = (clip) => { const a = this.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); return a; };
    this.L = {};
    for (const k of LEGS) if (C[k]) this.L[k] = act(C[k].lower);
    this.U = {};
    for (const k of UPPER) if (C[k]) this.U[k] = act(C[k].upper);
    for (const k of ['reload', 'hit', 'throw']) if (this.U[k]) this.U[k].timeScale = 0; // time set from the state
    const dieId = variant % 2 && C.die2 ? 'die2' : 'die';
    this.die = act(C[dieId].full);
    this.dieDur = C[dieId].duration;
    this.die.setLoop(THREE.LoopOnce, 1);
    this.die.clampWhenFinished = true;
    this.die.timeScale = 0;
    this.w = { move: 0, run: 0, aim: 0, reload: 0, dead: 0, throw: 0, f: 1, b: 0, l: 0, r: 0 };
    this.guns = {};
    this.gun = null;
    this.gunId = '';
    this.set = 'rifle';
    this.inLeft = false;
    this.muzzle = null;
    this.aimYaw = 0;
  }

  /** Adds a gun model (shared geometry, baked: grip at 0, barrel +X, game units) for weapon key `id`. */
  addGun(id, geometry, material, length) {
    if (!this.hand) return;
    const g = new THREE.Mesh(geometry, material);
    g.scale.setScalar(1 / this.tpl.scale);
    g.castShadow = true;
    g.visible = false;
    g.userData.length = length;
    this.hand.add(g);
    this.guns[id] = g;
  }

  _mountGun(left) {
    const g = this.gun, m = this.tpl.mounts[this.set];
    if (!g || !m) return;
    const hand = left ? this.leftHand : this.hand;
    if (g.parent !== hand) hand.add(g);
    const t = left ? m.carry : m;
    g.position.copy(t.pos);
    g.quaternion.copy(t.quat);
    this.inLeft = left;
  }

  setGun(id) {
    const g = this.guns[id] || null;
    if (g === this.gun && id === this.gunId) return;
    if (this.gun) this.gun.visible = false;
    this.gun = g;
    this.gunId = id;
    this.set = setOf(id);
    if (g) {
      g.visible = true;
      this._mountGun(false);
      if (this.muzzle) { g.add(this.muzzle); this.muzzle.position.set(g.userData.length + 1, 0.6, 0); }
    }
  }

  /** A flash object that sits on the muzzle of the current gun. */
  attachMuzzle(obj) {
    this.muzzle = obj;
    if (this.gun) { this.gun.add(obj); obj.position.set(this.gun.userData.length + 1, 0.6, 0); }
  }

  update(dt, st) {
    const A = HUMAN_ANIM, w = this.w, tpl = this.tpl, L = this.L, U = this.U, R = tpl.rootSpeed;
    const k = Math.min(1, Math.max(0, dt) * A.blendRate);
    const dead = st.deadAge >= 0;
    const pistol = this.set === 'pistol';
    const ease = (key, target, rate = 1) => { w[key] += (target - w[key]) * Math.min(1, k * rate); return w[key]; };

    // ---- legs: direction weights (forward / back / left / right) and walk → run by speed
    const sp = dead ? 0 : st.speed;
    const move = ease('move', Math.min(1, sp / 12));
    const rel = Number.isFinite(st.moveRel) ? st.moveRel : 0;
    const cf = Math.cos(rel), sr = Math.sin(rel);
    let f = Math.max(0, cf), b = Math.max(0, -cf), r = Math.max(0, sr), l = Math.max(0, -sr);
    const sum = f + b + r + l || 1;
    f = ease('f', f / sum); b = ease('b', b / sum); r = ease('r', r / sum); l = ease('l', l / sum);
    const run = ease('run', smooth(A.runFrom, A.runTo, sp));
    const live = 1 - ease('dead', dead ? 1 : 0, 1.2);
    const fwdWalk = pistol ? L.pWalk : L.walk, fwdRun = pistol ? L.pRun : L.run;
    for (const a of Object.values(L)) a.setEffectiveWeight(0);
    L.idle.setEffectiveWeight((1 - move) * live);
    fwdWalk.setEffectiveWeight(move * f * (1 - run) * live);
    fwdRun.setEffectiveWeight(move * f * run * live);
    if (L.back) L.back.setEffectiveWeight(move * b * live);
    if (L.strafeL) L.strafeL.setEffectiveWeight(move * l * live);
    if (L.strafeR) L.strafeR.setEffectiveWeight(move * r * live);
    const rate = (id, max) => Math.min(max, Math.max(0.6, sp / (R[id] || 30)));
    fwdWalk.timeScale = rate(pistol ? 'pWalk' : 'walk', A.walkRateMax);
    fwdRun.timeScale = rate(pistol ? 'pRun' : 'run', 1.6);
    if (L.back) L.back.timeScale = rate('back', A.walkRateMax);
    if (L.strafeL) L.strafeL.timeScale = rate('strafeL', A.walkRateMax);
    if (L.strafeR) L.strafeR.timeScale = rate('strafeR', A.walkRateMax);

    // ---- upper body
    const reloading = !dead && st.reload >= 0;
    const throwing = !dead && (st.throwAim || st.throwAge < A.throwRelease);
    const thr = ease('throw', throwing ? 1 : 0, 1.6);
    const rl = ease('reload', reloading ? 1 : 0, 1.5) * (1 - thr);
    const am = ease('aim', !dead && st.aim && !reloading ? 1 : 0) * (1 - rl) * (1 - thr);
    const hit = !dead && st.hitAge < A.hitTime ? Math.sin((st.hitAge / A.hitTime) * Math.PI) : 0;
    const relaxed = Math.max(0, 1 - rl - am - thr);
    const up = live * (1 - hit * 0.8);
    for (const a of Object.values(U)) a.setEffectiveWeight(0);
    if (pistol) {
      // pistol: Pistol Idle is the ready / aim pose; walking and running swing the arms of their clips; the reload is
      // Pistol Idle with procedural hand moves (no clip from the user)
      const moving = move * f;
      U.pIdle.setEffectiveWeight((am + rl + relaxed * (1 - moving)) * up);
      U.pWalk.setEffectiveWeight(relaxed * moving * (1 - run) * up);
      U.pRun.setEffectiveWeight(relaxed * moving * run * up);
      U.pWalk.timeScale = fwdWalk.timeScale;
      U.pRun.timeScale = fwdRun.timeScale;
    } else {
      const moving = move * f * run;
      U.idle.setEffectiveWeight(relaxed * (1 - moving) * up);
      U.run.setEffectiveWeight(relaxed * moving * up);
      U.run.timeScale = fwdRun.timeScale;
      U.fire.setEffectiveWeight(am * up);
      U.reload.setEffectiveWeight(rl * up);
      if (reloading) U.reload.time = Math.min(0.999, st.reload) * tpl.clips.reload.duration;
    }
    U.hit.setEffectiveWeight(hit * live);
    if (hit > 0) U.hit.time = A.hitFrom + Math.min(1, st.hitAge / A.hitTime) * A.hitSpan;
    // grenade toss: while aiming, the arm winds up and holds; on the throw the clip plays on from the hold
    let tossT = -1;
    if (thr > 0.001) {
      tossT = st.throwAim && !(st.throwAge < A.throwRelease) ? Math.min(A.throwHold, A.throwStart + (st.throwAimAge || 0)) : A.throwHold + Math.max(0, st.throwAge);
      tossT = Math.min(tpl.clips.throw.duration * 0.999, tossT);
      U.throw.time = tossT;
      U.throw.setEffectiveWeight(thr * up);
    }
    // death
    this.die.setEffectiveWeight(1 - live);
    if (dead) this.die.time = Math.min(this.dieDur, st.deadAge);
    this.mixer.update(Math.max(0, dt));

    // the gun goes to the left hand while the right arm throws
    const left = thr > 0.5 && tossT >= A.throwHandOff && tossT < A.throwHandBack;
    if (left !== this.inLeft) this._mountGun(left);

    // ---- procedural layers (after the clips): recoil, pistol reload
    if (!dead) this._procedural(st, pistol, rl, am);
    const m = tpl.mounts[this.set];
    this.aimYaw = m ? m.yaw * Math.max(am, pistol ? rl : 0) * live : 0;
  }

  /** Rotates a bone about a world axis (keeps its parent chain). */
  _rotateWorld(bone, axisW, angle) {
    if (!bone || !angle) return;
    bone.parent.updateMatrixWorld(true);
    bone.parent.getWorldQuaternion(_q2);
    bone.getWorldQuaternion(_q);
    _q.premultiply(_q3.setFromAxisAngle(axisW, angle));
    bone.quaternion.copy(_q2.invert().multiply(_q));
    bone.updateMatrixWorld(true);
  }

  _procedural(st, pistol, rl, am) {
    const A = HUMAN_ANIM;
    const kick = st.shotAge >= 0 && st.shotAge < A.recoilTime ? 1 - st.shotAge / A.recoilTime : 0;
    const pr = st.reload >= 0 ? st.reload : -1;
    if (!kick && !(pistol && rl > 0.01)) return;
    this.group.updateMatrixWorld(true);
    // the character's right-side axis in the world (+Z of the group frame): a positive turn lifts the muzzle
    _axis.set(0, 0, 1).applyQuaternion(this.group.getWorldQuaternion(_q2)).normalize();
    const B = (n) => this.bones.get(n);
    if (kick) {
      const kk = kick * kick;
      this._rotateWorld(B('RightHand'), _axis, (pistol ? A.recoilPistol : A.recoilRifle) * kk);
      this._rotateWorld(B('RightForeArm'), _axis, (pistol ? 0.08 : 0.04) * kk);
    }
    if (pistol && pr >= 0) {
      // pistol reload: the gun tips up and in, the left hand drops to the belt for a magazine and comes back
      const tip = Math.sin(Math.PI * clamp01(pr / 0.95)) * rl;
      const drop = (smooth(0.12, 0.38, pr) - smooth(0.55, 0.82, pr)) * rl;
      this._rotateWorld(B('RightForeArm'), _axis, 0.35 * tip);
      this._rotateWorld(B('RightHand'), _axis, 0.45 * tip);
      this._rotateWorld(B('LeftArm'), _axis, -0.9 * drop);
      this._rotateWorld(B('LeftForeArm'), _axis, -0.5 * drop);
      const seat = Math.max(0, Math.sin(Math.PI * clamp01((pr - 0.7) / 0.12))); // the magazine slapped in
      this._rotateWorld(B('RightHand'), _axis, -0.12 * seat * rl);
    }
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
