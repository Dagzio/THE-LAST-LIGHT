// Skinned human characters (D78 / D79) — the user's Tripo models with their Mixamo skeleton, animated by the user's
// Mixamo clips (assets/anims/human.json, tools/convert-anims.mjs). Presentation only: a HumanView reads the state it is
// given each frame and never touches the simulation.
//
// The models share the animation rig, so every bone's local rotation is copied as is; only the Hips (world rotation +
// position in cm in the files) is converted into the model's own Hips parent frame and scaled by its Hips height.
// Layers (D79):
//  - legs: idle / walk / run / walk back / strafe left / strafe right, mixed by the movement direction relative to the
//    facing (pistol: its own walk / run legs);
//  - upper body, two weapon sets — rifle (rifle, SMG) and pistol: relaxed (idle / run), aim (Firing Rifle held still /
//    Pistol Idle), reload (Reloading; D84 the pistol: "Pistol Reload" / "Pistol Reloading Idle"), hit, grenade toss
//    (the gun goes to the left hand while the right arm throws — works with both sets);
//  - full body: death, the rolls (D82 / D83), cover (Crouch Idle, kneeling fire, wall sneaks), busy, the takedown (D85);
//    moving crouched (D86): the legs of Crouched Sneaking / Crouch Walking, the arms of the crouch idle with the gun.
// D86: the locomotion clips play in step (one gait phase, offset by each clip's left-foot swing); the torso keeps the
// orientation the upper-body clips give it over whatever hips the legs' clip has (strafes turn them up to ±95°).
// D82: standing, the legs + hips come from the aim clip itself, and the body is turned by the barrel's measured yaw —
// the gun points exactly at the aim; the enemies pick random variants of idle / run / hit / reload / death.
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
const _tq = new THREE.Quaternion(), _tp = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const FOOTFALLS = [0.25, 0.75]; // D90: gait phases where a foot comes down (0 = the left foot's mid-swing)

/** One loaded model (hero / enemy): skeleton, clips for that skeleton, gun mounts. */
export class HumanTemplate {
  /**
   * @param {{root: THREE.Object3D, mesh: THREE.SkinnedMesh, bones: Map<string, THREE.Bone>}} model parseSkinnedGLB()
   * @param {object} anims assets/anims/human.json
   * @param {number} height game units
   */
  constructor(model, anims, height, ref = null) {
    this.root = model.root;
    this.mesh = model.mesh;
    this.root.traverse((o) => { o.name = clean(o.name); });
    this.skeleton = this.mesh.skeleton;
    this.bones = model.bones;
    this.mesh.frustumCulled = false;
    this.root.updateMatrixWorld(true);
    // rest pose (world + local rotation per bone): the reference other models are retargeted against
    this.rest = { world: new Map(), local: new Map() };
    for (const [name, b] of this.bones) { this.rest.world.set(name, b.getWorldQuaternion(new THREE.Quaternion())); this.rest.local.set(name, b.quaternion.clone()); }
    const headTop = this.bones.get('HeadTop_End') ? this.bones.get('HeadTop_End').getWorldPosition(_v).y : 1;
    this.scale = height / (headTop + 0.02);
    this.height = height;
    this.anims = anims;
    this.clips = this._buildClips(anims, ref);
    // ground speed of each clip (units/s): its travel, or (D86, "In Place" clips) the speed its planted foot implies;
    // gait — the phase of the left foot's swing (looping clips are played in step by it)
    this.rootSpeed = {};
    this.gait = {};
    const unitsPerCm = this.hipsK * this.scale;
    for (const id in anims.clips) {
      const c = anims.clips[id];
      this.rootSpeed[id] = (c.rootSpeed > 1 ? c.rootSpeed : (c.stride || 0) * HUMAN_ANIM.strideK) * unitsPerCm;
      if (Number.isFinite(c.off)) this.gait[id] = c.off;
    }
    this.mounts = { rifle: this._mount('rifle'), pistol: this._mount('pistol') };
    this.mount = this.mounts.rifle; // (dev viewer info)
  }

  /**
   * D81: per-bone rest correction against a reference model whose bones match the clips (the hero): C = Rref⁻¹ · Rthis
   * (world rest rotations). null when every bone matches (then the clip rotations are copied as is).
   */
  _corrections(ref) {
    if (!ref) return null;
    const out = new Map();
    let differs = false;
    for (const [name, w] of this.rest.world) {
      const r = ref.world.get(name);
      if (!r) continue;
      const c = r.clone().invert().multiply(w);
      if (2 * Math.acos(Math.min(1, Math.abs(c.w))) > 0.035) differs = true; // > 2°
      out.set(name, c);
    }
    return differs ? out : null;
  }

  /**
   * Retargets one clip onto this skeleton (D81: the enemy's right arm bones are rolled up to 166° against the hero's):
   * the clip's world rotations on the reference rig (S) carry this rig's rest offset: T = S · C, local = Tparent⁻¹ · T
   * (Hips: into its parent frame). → name → Float32Array of local quaternions.
   */
  _retarget(c, corr, ref, pqInv) {
    const n = c.frames, hips = this.bones.get('Hips');
    const order = [];
    const visit = (b) => { order.push(b); for (const ch of b.children) if (ch.isBone) visit(ch); };
    visit(hips);
    const S = new Map(), T = new Map(), out = {};
    for (const b of order) { S.set(b.name, new THREE.Quaternion()); T.set(b.name, new THREE.Quaternion()); if (c.q[b.name]) out[b.name] = new Float32Array(n * 4); }
    const lq = new THREE.Quaternion(), loc = new THREE.Quaternion(), I = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      for (const b of order) {
        const name = b.name, tr = c.q[name];
        if (tr) lq.fromArray(tr, i * 4); else lq.copy(ref.local.get(name) || this.rest.local.get(name) || I);
        const s = S.get(name), t = T.get(name);
        if (b === hips) s.copy(lq); else s.copy(S.get(b.parent.name)).multiply(lq);
        t.copy(s).multiply(corr.get(name) || I);
        if (!tr) continue;
        if (b === hips) loc.copy(pqInv).multiply(t); else loc.copy(T.get(b.parent.name)).invert().multiply(t);
        loc.toArray(out[name], i * 4);
      }
    }
    return out;
  }

  _buildClips(anims, ref) {
    const hips = this.bones.get('Hips');
    const parent = hips.parent;
    parent.updateMatrixWorld(true);
    const pInv = parent.matrixWorld.clone().invert();
    const pqInv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.hipsUp = new THREE.Vector3(0, 1, 0).applyQuaternion(pqInv).normalize(); // D86: the vertical in the Hips' parent frame
    this.hipsK = hips.getWorldPosition(_v).y / HUMAN_ANIM.srcHipsCm;
    const corr = this._corrections(ref);
    this.retargeted = !!corr;
    this.hipsLocal = {};
    this.hipsPos = {};
    this.localQ = {};
    const out = {};
    for (const [id, c] of Object.entries(anims.clips)) {
      const n = c.frames;
      const times = new Float32Array(n);
      for (let i = 0; i < n; i++) times[i] = Math.min(c.duration, i / anims.fps);
      const full = [], upper = [], lower = [];
      const re = corr ? this._retarget(c, corr, ref, pqInv) : null;
      this.localQ[id] = {};
      for (const [name, vals] of Object.entries(c.q)) {
        if (!this.bones.has(name)) continue;
        const values = re ? re[name] : Float32Array.from(vals);
        if (name === 'Hips' && !re) for (let i = 0; i < n; i++) _q.fromArray(values, i * 4).premultiply(pqInv).toArray(values, i * 4);
        // keep each track on one hemisphere (no flips when the mixer interpolates)
        for (let i = 1; i < n; i++) {
          const d = values[i * 4] * values[i * 4 - 4] + values[i * 4 + 1] * values[i * 4 - 3] + values[i * 4 + 2] * values[i * 4 - 2] + values[i * 4 + 3] * values[i * 4 - 1];
          if (d < 0) for (let k = 0; k < 4; k++) values[i * 4 + k] = -values[i * 4 + k];
        }
        this.localQ[id][name] = values;
        if (name === 'Hips') this.hipsLocal[id] = values;
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
    for (const [name, vals] of Object.entries(this.localQ[id])) {
      const b = this.bones.get(name);
      b.quaternion.fromArray(vals, f * 4);
      if (name === 'Hips') b.position.fromArray(this.hipsPos[id], f * 3);
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
      up: { f: up.z, s: -up.x, h: up.y },
    };
    restore();
    // the left-hand carry for the grenade toss: the gun keeps its direction of the hand-off moment, and the LEFT palm
    // holds it (D81) — a pistol by its grip, a long gun by the fore-end — in LeftHand space
    restore = this._pose('throw', HUMAN_ANIM.throwHandOff);
    const one = new THREE.Vector3(1, 1, 1);
    const gunM = new THREE.Matrix4().compose(pos, quat, one).premultiply(R.matrixWorld);
    const gq = new THREE.Quaternion().setFromRotationMatrix(_m.extractRotation(gunM));
    const barrelW = new THREE.Vector3(1, 0, 0).applyQuaternion(gq);
    const held = this._palm('Left', new THREE.Vector3()).addScaledVector(barrelW, -(set === 'pistol' ? 0 : HUMAN_ANIM.carryForeEnd) / this.scale);
    gunM.compose(held, gq, one);
    const local = L.matrixWorld.clone().invert().multiply(gunM);
    const cp = new THREE.Vector3(), cq = new THREE.Quaternion(), cs = new THREE.Vector3();
    local.decompose(cp, cq, cs);
    out.carry = { pos: cp, quat: cq };
    restore();
    return out;
  }

  /** Muzzle of a gun (tip { x along the barrel, y up } in its baked frame) in the character frame, aim-compensated. */
  muzzle(gunId, tip) {
    const m = this.mounts[setOf(gunId)];
    if (!m) return { f: 20, s: 4, h: 34 };
    const t = typeof tip === 'number' ? { x: tip, y: 0 } : tip;
    const f = m.grip.f + m.dir.f * t.x + m.up.f * t.y, sd = m.grip.s + m.dir.s * t.x + m.up.s * t.y, h = m.grip.h + m.dir.h * t.x + m.up.h * t.y;
    const c = Math.cos(-m.yaw), sn = Math.sin(-m.yaw);
    return { f: f * c - sd * sn, s: f * sn + sd * c, h };
  }

  /**
   * A new character: its own bones + mixer, shared geometry / clips. @param {THREE.Material} material
   * @param {number} variant per-character number; with `mixed` (enemies, D82) it picks random clip variants
   */
  instantiate(material, variant = 0, mixed = false) {
    const root = this.root.clone(true);
    const byName = new Map();
    let mesh = null;
    root.traverse((o) => { if (o.isBone) byName.set(o.name, o); if (o.isSkinnedMesh) mesh = o; });
    const bones = this.skeleton.bones.map((b) => byName.get(b.name));
    mesh.bind(new THREE.Skeleton(bones, this.skeleton.boneInverses), mesh.bindMatrix);
    mesh.material = material;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return new HumanView(this, root, mesh, byName, pickClips(this.clips, variant, mixed));
  }
}

/**
 * D82: the clip of each role for one character. The hero (mixed = false) keeps the base set; every enemy gets a random
 * (per-character, stable) pick among the user's variants of the same action.
 */
function pickClips(C, variant, mixed) {
  const base = { walk: 'walk', idle: 'idle', run: 'run', hit: 'hit', reload: 'reload', die: 'die' };
  if (!mixed) return base;
  let h = (Math.imul(Math.abs(variant | 0) + 1, 2654435761) >>> 0);
  const pick = (list) => { const id = list[h % list.length]; h = (Math.imul(h ^ (h >>> 15), 2246822519) >>> 0) + 7; return C[id] ? id : list[0]; };
  return {
    walk: C.rwalk ? 'rwalk' : 'walk', // D83 (user request): the enemies walk with "Rifle Walk"
    idle: pick(['idle', 'idle2']),
    run: pick(['run', 'run2', 'run3']),
    hit: pick(['hit', 'hit2']),
    reload: pick(['reload', 'reload2']),
    die: pick(['die', 'die2', 'die3']),
  };
}

// leg / upper-body layers by ROLE (the clip of a role comes from pickClips); the rest are fixed clips
const LEGS = ['back', 'backRun', 'strafeL', 'strafeR', 'pWalk', 'pRun', 'pStrafeL', 'pStrafeR'];
const UPPER = ['fire', 'throw', 'pIdle', 'pWalk', 'pRun'];
const FIRE_POSE_T = 0.33;   // the aim pose = "Firing Rifle" held at this time (the gun mount is measured on it)
const _pt = new THREE.Vector3();

/**
 * One character on screen. update(dt, st) — st: { speed (units/s), moveRel (movement direction minus facing, rad, sim
 * convention: + = to the right), aim (bool), reload (0…1 progress, < 0 = no), hitAge (s since the last hit), deadAge
 * (s since death, < 0 = alive), shotAge (s since the last shot), throwAim (bool: a grenade is being aimed), throwAge
 * (s since the last throw, Infinity = none), dodge (0…1 roll progress, < 0 = none), crouch (bool: behind low cover) }.
 */
export class HumanView {
  constructor(tpl, root, mesh, bones, pick) {
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
    this.pick = pick;
    // every action + its clip id (D86: the torso fix reads the hips of the clips driving the upper body)
    this.acts = [];
    this.idOf = new Map();
    const act = (clip) => {
      const a = this.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0);
      const m = /^(.*?)(\.(upper|lower))?$/.exec(clip.name);
      this.acts.push(a); this.idOf.set(a, m[1]); a.upperDriver = m[3] !== 'lower';
      return a;
    };
    this.L = {};
    for (const k of LEGS) if (C[k]) this.L[k] = act(C[k].lower);
    this.L.walk = act(C[pick.walk].lower);
    this.L.idle = act(C[pick.idle].lower);
    this.L.run = act(C[pick.run].lower);
    // D82: standing while aiming, the legs + hips come from the aim clip itself (Pistol Idle / Firing Rifle) — mixed
    // with another clip's hips the torso turned away and the gun pointed 40–45° off the aim
    this.L.pIdle = act(C.pIdle.lower);
    this.L.fire = act(C.fire.lower);
    this.L.fire.timeScale = 0;
    this.L.fire.time = FIRE_POSE_T;
    this.U = {};
    for (const k of UPPER) if (C[k]) this.U[k] = act(C[k].upper);
    this.U.idle = act(C[pick.idle].upper);
    this.U.run = act(C[pick.run].upper);
    this.U.hit = act(C[pick.hit].upper);
    this.U.reload = act(C[pick.reload].upper);
    this.reloadDur = C[pick.reload].duration;
    for (const k of ['reload', 'hit', 'throw', 'fire']) if (this.U[k]) this.U[k].timeScale = 0; // time set from the state
    if (this.U.fire) this.U.fire.time = FIRE_POSE_T;
    // full-body layers: the death, the rolls (D82 / D83), cover (D83), busy idle (D83)
    const once = (id) => { const a = act(C[id].full); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0; return a; };
    const held = (id, t = 0) => { if (!C[id]) return null; const a = act(C[id].full); a.timeScale = 0; a.time = t; return a; };
    const loop = (id) => (C[id] ? act(C[id].full) : null);
    this.die = once(pick.die);
    this.dieDur = C[pick.die].duration;
    this.dodges = {};
    for (const id of ['dodge', 'dodge2']) if (C[id]) this.dodges[id] = { a: once(id), dur: C[id].duration };
    this.dodge = this.dodges.dodge ? this.dodges.dodge.a : null; // (dev viewer)
    // cover (D83): low — kneeling (rifle: Idle Crouching, pistol: Pistol Kneeling Idle), kneeling fire (Crouch Rapid
    // Fire held / Pistol Kneeling Idle), kneeling strafes along it; high — back to it, the gun up (Peek And Aim held at
    // its start), sneaking sideways (Left / Right Cover Sneak); Stand To Crouch / Crouch To Standing between them
    this.cv = {
      // D85 (user): crouched in cover — "Crouch Idle" (both guns), moving along — the "Crouch Walk Strafe" clips
      // D88 (user): only the Cover/Crouch clips, for both guns (Pistol Kneeling Idle is gone)
      lowIdle: loop('crouchIdle2'), lowFire: held('crouchFire', 0.3),
      // D86: moving crouched — the LEGS of "Crouched Sneaking Left / Right" (sideways) and "Crouch Walking" (forward /
      // back); the arms keep the gun as in the crouch idle (the sneaks are unarmed clips)
      lowL: C.crouchL ? act(C.crouchL.lower) : null, lowR: C.crouchR ? act(C.crouchR.lower) : null,
      walk: C.crouchWalk ? act(C.crouchWalk.lower) : null,
      upRifle: C.crouchIdle2 ? act(C.crouchIdle2.upper) : null,
      // D90 (user): behind LOW cover — back to it in "Male Crouch Pose", moving along it — the whole "Crouched Sneaking
      // Left / Right" clips (the stealth crouch out of cover keeps the clips above)
      coverIdle: held('crouchPose', 0),
      coverSL: C.crouchL ? act(C.crouchL.full) : null, coverSR: C.crouchR ? act(C.crouchR.full) : null,
      // D90: leaning out of high cover — the user's left / right takes (by the side of the corner)
      peekL: held('peekL', 0), peekR: held('peekR', 0), highL: loop('coverL'), highR: loop('coverR'),
      toCrouch: held('toCrouch'), toStand: held('toStand'),
    };
    this.takedownAct = C.takedown ? held('takedown') : null; // D85 stealth: the takedown from behind
    this.takedownDur = C.takedown ? C.takedown.duration : 1;
    this.crouchIdle = this.cv.lowIdle; this.crouchWalk = null; // (dev viewer)
    this.trans = null;       // { a: action, from, to (clip s), dur (s), age (s) } — a stand ↔ kneel transition playing
    this.lowWas = false;
    this.busy = loop('files'); // D83: a posted enemy going through the files (until alerted)
    this.w = { move: 0, run: 0, aim: 0, reload: 0, dead: 0, throw: 0, dodge: 0, low: 0, high: 0, lowAim: 0, busy: 0, f: 1, b: 0, l: 0, r: 0 };
    this.dodgeId = 'dodge';
    // D84: the user's two pistol reloads ("Pistol Reload" with a step, "Pistol Reloading Idle" in place): upper body +
    // its own legs while standing (no twist against Pistol Idle's hips); the time follows the reload's progress
    this.pRel = {};
    for (const id of ['pReload', 'pReload2']) {
      if (!C[id]) continue;
      const u = act(C[id].upper), l = act(C[id].lower);
      u.timeScale = l.timeScale = 0;
      this.pRel[id] = { u, l, dur: C[id].duration };
    }
    this.pRelId = this.pRel.pReload2 ? 'pReload2' : 'pReload';
    this.guns = {};
    this.gun = null;
    this.gunId = '';
    this.set = 'rifle';
    this.inLeft = false;
    this.muzzle = null;
    this.aimYaw = 0;
    this.phase = Math.random(); // D86: the shared gait phase (cycles) of the locomotion clips (presentation only)
    // D86: the bones turned after the mixer (torso fix, recoil) and their last mixer-given rotation
    this.touched = ['Spine', 'RightHand', 'RightForeArm'].filter((n) => bones.get(n)).map((n) => [bones.get(n), bones.get(n).quaternion.clone()]);
    this.torsoTwist = 0;        // D86: the last torso fix (rad, dev / checks)
    this.gaitHz = 0;            // D87: the legs' cadence (gait cycles/s) this frame — the footsteps follow it
    this.footfalls = 0;         // D90: feet put down so far (the footstep one-shots follow it)
  }

  /**
   * D86: every looping locomotion clip in `list` is played IN STEP — one shared phase (advanced by the weighted cadence
   * of the clips at this ground speed), each clip offset by its own left-foot swing — so forward + strafe (diagonals),
   * walk ↔ run and the crouch set blend without the feet crossing. `back` plays the given clips in reverse.
   */
  _gaitStep(dt, sp, list, back) {
    const R = this.tpl.rootSpeed, G = this.tpl.gait, A = HUMAN_ANIM;
    let wsum = 0, fsum = 0;
    for (const a of list) {
      if (!a) continue;
      const w = a.getEffectiveWeight();
      if (w < 1e-3) continue;
      const id = this.idOf.get(a), dur = a.getClip().duration;
      const max = /run|Run/.test(id) ? A.runRateMax : A.walkRateMax;
      // D95 (user: feet sliding after a stop): standing (he has stopped, the walk only fading out) the legs hold still
      const rate = sp < 2 ? 0 : Math.min(max, Math.max(0.6, sp / (R[id] || 30)));
      fsum += (w * rate) / dur;
      wsum += w;
    }
    if (wsum > 0) {
      // D90: a foot comes down at a quarter cycle after each foot's mid-swing (phase 0 = the left foot's) — counted
      // for the footstep sounds that follow the legs (main.js)
      const p0 = this.phase, p1 = p0 + (dt * fsum) / wsum;
      for (const at of FOOTFALLS) if ((p0 < at && p1 >= at) || (p0 < at + 1 && p1 >= at + 1)) this.footfalls += 1;
      this.phase = p1 % 1;
      this.gaitHz = Math.max(this.gaitHz, fsum / wsum); // D87: the cadence (cycles/s) — the footsteps' pace
    }
    for (const a of list) {
      if (!a) continue;
      a.timeScale = 0;
      const id = this.idOf.get(a), dur = a.getClip().duration;
      const ph = (back && back.has(a) ? 1 - this.phase : this.phase) + (G[id] || 0);
      a.time = (ph - Math.floor(ph)) * dur * 0.999;
    }
  }

  /**
   * D86: the torso keeps the pose of the clips that drive the upper body, whatever the legs' hips do — the strafe /
   * back / crouch-sneak clips turn the hips up to ±55°, and the aim pose rides on them (the gun swung off the aim, then
   * the whole body was turned back by it and the legs walked crooked). The hips' yaw against the weighted hips of the
   * upper-body clips (at their current times) is taken off the Spine.
   */
  _torsoFix() {
    const tpl = this.tpl, fps = tpl.anims.fps, up = tpl.hipsUp;
    let sx = 0, sy = 0, sz = 0, sw = 0, tw = 0;
    for (const a of this.acts) {
      if (!a.upperDriver) continue;
      const w = a.getEffectiveWeight();
      if (w < 1e-3) continue;
      const id = this.idOf.get(a), arr = tpl.hipsLocal[id];
      if (!arr) continue;
      const n = arr.length / 4, f = Math.max(0, Math.min(n - 1, Math.round(a.time * fps))) * 4;
      let x = arr[f], y = arr[f + 1], z = arr[f + 2], qw = arr[f + 3];
      if (tw > 0 && x * sx + y * sy + z * sz + qw * sw < 0) { x = -x; y = -y; z = -z; qw = -qw; }
      sx += x * w; sy += y * w; sz += z * w; sw += qw * w; tw += w;
    }
    const hips = this.bones.get('Hips'), spine = this.bones.get('Spine');
    if (tw < 1e-3 || !hips || !spine) { this.torsoTwist = 0; return; }
    _q.set(sx, sy, sz, sw).normalize();                        // the reference hips (parent frame)
    _q2.copy(_q).multiply(_tq.copy(hips.quaternion).invert()); // C = ref · now⁻¹ (parent frame)
    let ang = 2 * Math.atan2(_q2.x * up.x + _q2.y * up.y + _q2.z * up.z, _q2.w); // (its turn about the vertical, checks)
    this.torsoTwist = -Math.atan2(Math.sin(ang), Math.cos(ang));
    if (1 - Math.abs(_q2.w) < 1e-6) return;
    // the whole correction (turn + lean), not only the yaw: the spine's world rotation gets C (taken to the world)
    hips.parent.updateMatrixWorld(true);
    hips.parent.getWorldQuaternion(_tp);
    _q2.premultiply(_tp).multiply(_tq.copy(_tp).invert());     // Cw = P · C · P⁻¹
    hips.updateMatrixWorld(true);
    spine.getWorldQuaternion(_q).premultiply(_q2);             // the spine's corrected world rotation
    hips.getWorldQuaternion(_tq);
    spine.quaternion.copy(_tq.invert().multiply(_q));
  }

  /** Adds a gun model (shared geometry, baked: grip at 0, barrel +X, game units) for weapon key `id`. */
  addGun(id, geometry, material) {
    if (!this.hand) return;
    const g = new THREE.Mesh(geometry, material);
    g.scale.setScalar(1 / this.tpl.scale);
    g.castShadow = true;
    g.visible = false;
    g.userData.tip = geometry.userData.tip || { x: 10, y: 0 };
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
      if (this.muzzle) { g.add(this.muzzle); this.muzzle.position.set(g.userData.tip.x + 0.6, g.userData.tip.y, 0); }
    }
  }

  /** A flash object that sits on the muzzle of the current gun. */
  attachMuzzle(obj) {
    this.muzzle = obj;
    if (this.gun) { this.gun.add(obj); obj.position.set(this.gun.userData.tip.x + 0.6, this.gun.userData.tip.y, 0); }
  }

  update(dt, st) {
    const A = HUMAN_ANIM, w = this.w, tpl = this.tpl, L = this.L, U = this.U, R = tpl.rootSpeed;
    const k = Math.min(1, Math.max(0, dt) * A.blendRate);
    const dead = st.deadAge >= 0;
    const pistol = this.set === 'pistol';
    const ease = (key, target, rate = 1) => { w[key] += (target - w[key]) * Math.min(1, k * rate); return w[key]; };

    // ---- full-body layers: death, the rolls (D82 / D83), cover (D83), busy idle (D83)
    const live = 1 - ease('dead', dead ? 1 : 0, 1.2);
    const rollId = st.dodgeClip && this.dodges[st.dodgeClip] ? st.dodgeClip : 'dodge';
    const rolling = !dead && st.dodge >= 0 && !!this.dodges[rollId];
    if (rolling) { w.dodge = 1; this.dodgeId = rollId; } else ease('dodge', 0, 2.5); // starts at once, blends out as he gets up
    // D85: the takedown — a full-body clip like the roll (its time follows the takedown's progress)
    const tdOn = !dead && st.takedown >= 0 && !!this.takedownAct;
    if (tdOn) w.td = 1; else ease('td', 0, 2.5);
    const dg = 1 - (1 - (this.dodges[this.dodgeId] ? w.dodge : 0)) * (1 - (w.td || 0));
    const cv = this.cv;
    const lowOn = !dead && !rolling && !tdOn && (st.cover === 'low' || !!st.crouch) && !!cv.lowIdle;
    // D87: aiming in high cover = leaning out of its corner ("Female Peek And Aim" by the lean, st.peek 0…1)
    const peekK = st.cover === 'high' ? st.peek || 0 : 0;
    const highOn = !dead && !rolling && st.cover === 'high' && (!st.aim || peekK > 0) && !!(cv.peekL || cv.peekR);
    const lowW = ease('low', lowOn ? 1 : 0, 1.3) * (1 - dg);
    const highW = ease('high', highOn ? 1 : 0, 1.3) * (1 - dg) * (1 - lowW);
    const busyW = ease('busy', st.busy && !dead && this.busy ? 1 : 0, 0.8) * (1 - dg) * (1 - lowW) * (1 - highW);
    // stand ↔ kneel: the user's transition clips, a short part of each, blended over the layers
    if (lowOn !== this.lowWas) {
      this.lowWas = lowOn;
      const a = lowOn ? cv.toCrouch : cv.toStand;
      this.trans = a && !rolling && !dead ? (lowOn ? { a, from: 0.3, to: 1.15, dur: 0.5, age: 0 } : { a, from: 0.1, to: 0.8, dur: 0.45, age: 0 }) : null;
    }
    let tr = 0;
    if (this.trans) {
      const T = this.trans;
      T.age += Math.max(0, dt);
      const q = T.age / T.dur;
      if (q >= 1 || rolling || dead) { T.a.setEffectiveWeight(0); this.trans = null; } else {
        tr = (1 - smooth(0.55, 1, q)) * live * (1 - dg);
        T.a.time = T.from + (T.to - T.from) * smooth(0, 1, q);
      }
    }
    const fullW = lowW + highW + busyW;
    const normal = live * (1 - dg) * (1 - fullW) * (1 - tr); // what is left for the leg + upper-body layers

    // ---- legs: direction weights (forward / back / left / right) and walk → run by speed
    const sp = dead ? 0 : st.speed;
    this.gaitHz = 0; // (set by the gait steps below)
    const move = ease('move', Math.min(1, sp / 12));
    const rel = Number.isFinite(st.moveRel) ? st.moveRel : 0;
    const cf = Math.cos(rel), sr = Math.sin(rel);
    let f = Math.max(0, cf), b = Math.max(0, -cf), r = Math.max(0, sr), l = Math.max(0, -sr);
    const sum = f + b + r + l || 1;
    f = ease('f', f / sum); b = ease('b', b / sum); r = ease('r', r / sum); l = ease('l', l / sum);
    const run = ease('run', smooth(A.runFrom, A.runTo, sp));
    const fwdWalk = pistol ? L.pWalk : L.walk, fwdRun = pistol ? L.pRun : L.run;
    // D86: the user's strafes per gun (Pistol Strafe / Rifle Strafe), running backwards — Rifle Run Backwards
    const sideL = (pistol && L.pStrafeL) || L.strafeL, sideR = (pistol && L.pStrafeR) || L.strafeR;
    const backRun = L.backRun || null;
    for (const a of Object.values(L)) a.setEffectiveWeight(0);
    // standing: the pistol stance always; with a long gun the aim stance while aiming (aim weight from last frame)
    const stand = (1 - move) * normal;
    // D84: which pistol reload clip this reload plays (picked per reload by the renderer), its legs while standing
    if (st.reloadClip && this.pRel[st.reloadClip] && st.reload >= 0) this.pRelId = st.reloadClip;
    const PR = this.pRel[this.pRelId];
    for (const r0 of Object.values(this.pRel)) { r0.u.setEffectiveWeight(0); r0.l.setEffectiveWeight(0); }
    const wr = PR ? w.reload : 0; // the reload weight of the last frame (like w.aim below)
    // D95 (user: running, reloading and stopping slid the feet): the reload clip's own legs (it takes a step) only for a
    // reload begun standing still; begun on the move he keeps the pistol stance's planted legs
    if (st.reload >= 0 && !this.wasReloading) this.relStill = sp < 2;
    this.wasReloading = st.reload >= 0;
    const relLegs = PR && this.relStill ? wr : 0;
    if (pistol) { L.pIdle.setEffectiveWeight(stand * (1 - relLegs)); if (PR) PR.l.setEffectiveWeight(stand * relLegs); }
    else { L.fire.setEffectiveWeight(stand * w.aim); L.idle.setEffectiveWeight(stand * (1 - w.aim)); }
    fwdWalk.setEffectiveWeight(move * f * (1 - run) * normal);
    fwdRun.setEffectiveWeight(move * f * run * normal);
    if (L.back) L.back.setEffectiveWeight(move * b * (backRun ? 1 - run : 1) * normal);
    if (backRun) backRun.setEffectiveWeight(move * b * run * normal);
    if (sideL) sideL.setEffectiveWeight(move * l * normal);
    if (sideR) sideR.setEffectiveWeight(move * r * normal);
    // D86: all the leg clips in step (one gait phase, offset per clip by its left-foot swing)
    this._gaitStep(dead ? 0 : dt, sp, [fwdWalk, fwdRun, L.back, backRun, sideL, sideR]);

    // ---- upper body
    const reloading = !dead && st.reload >= 0;
    const throwing = !dead && (st.throwAim || st.throwAge < A.throwRelease);
    const thr = ease('throw', throwing ? 1 : 0, 1.6);
    const rl = ease('reload', reloading ? 1 : 0, 1.5) * (1 - thr);
    const am = ease('aim', !dead && st.aim && !reloading ? 1 : 0) * (1 - rl) * (1 - thr);
    const hit = !dead && st.hitAge < A.hitTime ? Math.sin((st.hitAge / A.hitTime) * Math.PI) : 0;
    const relaxed = Math.max(0, 1 - rl - am - thr);
    const up = normal * (1 - hit * 0.8);
    for (const a of Object.values(U)) a.setEffectiveWeight(0);
    if (pistol) {
      // pistol: Pistol Idle is the ready / aim pose; walking and running swing the arms of their clips; the reload is
      // the user's clip (D84), its time following the reload's progress
      const moving = move * f;
      U.pIdle.setEffectiveWeight((am + (PR ? 0 : rl) + relaxed * (1 - moving)) * up);
      if (PR) {
        PR.u.setEffectiveWeight(rl * up);
        if (reloading) { PR.u.time = PR.l.time = Math.min(0.999, st.reload) * PR.dur; }
      }
      U.pWalk.setEffectiveWeight(relaxed * moving * (1 - run) * up);
      U.pRun.setEffectiveWeight(relaxed * moving * run * up);
      U.pWalk.timeScale = U.pRun.timeScale = 0; // the arms swing in step with the legs (D86)
      U.pWalk.time = fwdWalk.time;
      U.pRun.time = fwdRun.time;
    } else {
      const moving = move * f * run;
      U.idle.setEffectiveWeight(relaxed * (1 - moving) * up);
      U.run.setEffectiveWeight(relaxed * moving * up);
      U.run.timeScale = 0;
      U.run.time = fwdRun.time;
      U.fire.setEffectiveWeight(am * up);       // held still at FIRE_POSE_T: a steady aim (the kick is procedural)
      U.reload.setEffectiveWeight(rl * up);
      if (reloading) U.reload.time = Math.min(0.999, st.reload) * this.reloadDur;
    }
    U.hit.setEffectiveWeight(hit * normal);
    if (hit > 0) U.hit.time = A.hitFrom + Math.min(1, st.hitAge / A.hitTime) * A.hitSpan;
    // grenade toss: while aiming, the arm winds up and holds; on the throw the clip plays on from the hold
    let tossT = -1;
    if (thr > 0.001) {
      tossT = st.throwAim && !(st.throwAge < A.throwRelease) ? Math.min(A.throwHold, A.throwStart + (st.throwAimAge || 0)) : A.throwHold + Math.max(0, st.throwAge);
      tossT = Math.min(tpl.clips.throw.duration * 0.999, tossT);
      U.throw.time = tossT;
      U.throw.setEffectiveWeight(thr * up);
    }
    // full body
    this.die.setEffectiveWeight(1 - live);
    if (dead) this.die.time = Math.min(this.dieDur, st.deadAge);
    for (const [id, d] of Object.entries(this.dodges)) {
      d.a.setEffectiveWeight(id === this.dodgeId ? (this.dodges[this.dodgeId] ? w.dodge : 0) * (1 - (w.td || 0)) * live : 0);
      if (rolling && id === rollId) d.a.time = Math.min(0.999, st.dodge) * d.dur;
    }
    if (this.takedownAct) {
      this.takedownAct.setEffectiveWeight((w.td || 0) * live);
      if (tdOn) { const a = st.takedownFrom ?? 0, b = st.takedownTo ?? this.takedownDur; this.takedownAct.time = Math.min(this.takedownDur * 0.999, a + (b - a) * st.takedown); }
    }
    // cover: kneeling / kneeling fire / kneeling strafes; back to it / sneaking sideways (in place clips: own pace)
    const lowAim = ease('lowAim', lowOn && st.aim ? 1 : 0, 1.5);
    const cm = Math.min(1, sp / 10), lr = l + r || 1, shL = l / lr, shR = r / lr;
    const fw = (a, v) => { if (a) a.setEffectiveWeight(a.getEffectiveWeight() + v); };
    for (const a of Object.values(cv)) if (a) a.setEffectiveWeight(0);
    const lw = lowW * live * (1 - tr), hw = highW * live * (1 - tr);
    const inLow = st.cover === 'low' && !!cv.coverIdle;
    fw(inLow ? cv.coverIdle : cv.lowIdle, lw * (1 - cm) * (1 - lowAim)); // D90: back to low cover — Male Crouch Pose
    fw(cv.lowFire, lw * (1 - cm) * lowAim); // D88 (user): the Cover/Crouch clips for both guns (no Pistol Kneeling Idle)
    let crouchBack = null;
    if (inLow) {
      // D90: along low cover (back to it) — the whole Crouched Sneaking Left / Right clips; firing over it — kneeling fire
      fw(cv.coverSL, lw * cm * shL * (1 - lowAim)); fw(cv.coverSR, lw * cm * shR * (1 - lowAim));
      fw(cv.lowFire, lw * cm * lowAim);
    } else if (cv.walk) {
      // D85 stealth crouch (not in cover): forward / back — the crouch walk (backwards played in reverse), sideways —
      // D86 "Crouched Sneaking Left / Right"
      const fb = f + b, side = l + r, tot = fb + side || 1;
      fw(cv.walk, lw * cm * (fb / tot));
      fw(cv.lowL, lw * cm * (l / tot)); fw(cv.lowR, lw * cm * (r / tot));
      if (b > f) crouchBack = this._backSet || (this._backSet = new Set([cv.walk]));
      fw(cv.upRifle, lw * cm); // the gun-holding arms over the crouched legs (D88: Crouch Idle's, both guns)
    }
    // D90: high cover — back to it; leaning out of the corner plays the user's take for that side (st.peekSide: +1 his
    // right, −1 his left)
    const peekA = (st.peekSide < 0 ? cv.peekL : cv.peekR) || cv.peekL || cv.peekR;
    fw(peekA, hw * (1 - cm));
    if (peekA) peekA.time = peekK > 0 ? A.peekFrom + (A.peekHoldAt - A.peekFrom) * smooth(0, 1, peekK) : 0; // (0 → back to the wall)
    fw(cv.highL, hw * cm * shL); fw(cv.highR, hw * cm * shR);
    // the crouch / cover set in step too (its own clips; the stand clips are idle while it plays)
    if (lw + hw > 1e-3) this._gaitStep(dt, sp, [cv.walk, cv.lowL, cv.lowR, cv.coverSL, cv.coverSR, cv.highL, cv.highR], crouchBack);
    if (this.trans) this.trans.a.setEffectiveWeight(tr);
    if (this.busy) this.busy.setEffectiveWeight(busyW * live);
    // D86: the mixer writes a bone only when its blended value CHANGED since the last frame — a held pose (the rifle aim
    // is one still frame) would keep (and pile up) last frame's procedural turns. So the bones touched after the mixer
    // get the mixer's own values back first.
    for (const [b, q] of this.touched) b.quaternion.copy(q);
    this.mixer.update(Math.max(0, dt));
    for (const [b, q] of this.touched) q.copy(b.quaternion);
    if (!dead) this._torsoFix(); // D86: the torso keeps the upper-body clips' pose over the legs' hips

    // the gun goes to the left hand while the right arm throws
    const left = thr > 0.5 && tossT >= A.throwHandOff && tossT < A.throwHandBack;
    if (left !== this.inLeft) this._mountGun(left);

    // D82: where the barrel points in THIS pose (relative to the body's facing) — the renderer turns the body by it,
    // so the gun itself points at the aim whatever the legs do (walking / strafing hips sway the torso)
    const aimW = Math.max(am * normal, lowAim * lowW * live * (1 - Math.min(1, sp / 10)), highW * live * smooth(0.3, 1, peekK)); // D86: kneeling aim only (the sneaks are no aim pose); D87: the peek
    const yawNow = aimW > 0.001 && this.gun && !this.inLeft ? this._barrelYaw() : 0;

    // ---- procedural layer (after the clips): recoil
    if (!dead && normal > 0.05) this._procedural(st, pistol);
    // D86: eased — the leftover sway of the stride no longer rocks the whole body from side to side
    this.aimYaw += (yawNow * aimW - this.aimYaw) * Math.min(1, Math.max(0, dt) * A.aimYawRate);
  }

  /** The barrel's yaw relative to the body's facing (sim convention: + = to the right). */
  _barrelYaw() {
    this.group.updateMatrixWorld(true);
    const d = _pt.set(1, 0, 0).transformDirection(this.gun.matrixWorld);
    d.applyQuaternion(this.group.getWorldQuaternion(_q2).invert());
    return Math.atan2(d.z, d.x);
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

  /** The procedural kick of a shot (after the clips). D84: the pistol reload is the user's clip now (no IK). */
  _procedural(st, pistol) {
    const A = HUMAN_ANIM;
    const kick = st.shotAge >= 0 && st.shotAge < A.recoilTime ? 1 - st.shotAge / A.recoilTime : 0;
    if (!kick) return;
    this.group.updateMatrixWorld(true);
    // the character's right-side axis in the world (+Z of the group frame): a positive turn lifts the muzzle
    _axis.set(0, 0, 1).applyQuaternion(this.group.getWorldQuaternion(_q2)).normalize();
    const B = (n) => this.bones.get(n);
    const kk = kick * kick;
    this._rotateWorld(B('RightHand'), _axis, (pistol ? A.recoilPistol : A.recoilRifle) * kk);
    this._rotateWorld(B('RightForeArm'), _axis, (pistol ? 0.08 : 0.04) * kk);
  }

  dispose() {
    if (this.fadeMat) { this.fadeMat.dispose(); this.fadeMat = null; } // D92: a fading body's own material
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

/**
 * Gun model → baked geometry (game units): barrel along +X, up +Y, the palm point (entry.hand) at the origin, scaled to
 * its real size (entry.size). geometry.userData.tip = the muzzle { x, y } in that frame.
 */
export function bakeGunGeometry(geometry, entry) {
  geometry.rotateY(entry.rotY);
  const [gx, gy, gz] = entry.grip, [tx, ty] = entry.tip;
  geometry.translate(-gx, -gy, -gz);
  geometry.rotateZ(-Math.atan2(ty - gy, tx - gx));
  const s = entry.length / Math.hypot(tx - gx, ty - gy);
  geometry.scale(s, s, s);
  const [hx, hy] = entry.hand || [0, 0], k = entry.size || 1;
  geometry.translate(-hx, -hy, 0);
  geometry.scale(k, k, k);
  geometry.computeBoundingSphere();
  geometry.userData.tip = { x: (entry.length - hx) * k, y: -hy * k };
  return geometry;
}
