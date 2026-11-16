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
//    Pistol Idle), reload (Reloading; the pistol has no clip: Pistol Idle + the left hand by IK, D82), hit, grenade toss
//    (the gun goes to the left hand while the right arm throws — works with both sets);
//  - full body: death, the roll (Dodge, D82), crouching behind low cover (Idle Crouching / Crouch Walking, D82).
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
const _q3 = new THREE.Quaternion();

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
    this.rootSpeed = {};
    const unitsPerCm = this.hipsK * this.scale;
    for (const id in anims.clips) this.rootSpeed[id] = anims.clips[id].rootSpeed * unitsPerCm;
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
  const base = { idle: 'idle', run: 'run', hit: 'hit', reload: 'reload', die: 'die' };
  if (!mixed) return base;
  let h = (Math.imul(Math.abs(variant | 0) + 1, 2654435761) >>> 0);
  const pick = (list) => { const id = list[h % list.length]; h = (Math.imul(h ^ (h >>> 15), 2246822519) >>> 0) + 7; return C[id] ? id : list[0]; };
  return {
    idle: pick(['idle', 'idle2']),
    run: pick(['run', 'run2', 'run3']),
    hit: pick(['hit', 'hit2']),
    reload: pick(['reload', 'reload2']),
    die: pick(['die', 'die2', 'die3']),
  };
}

// leg / upper-body layers by ROLE (the clip of a role comes from pickClips); the rest are fixed clips
const LEGS = ['walk', 'back', 'strafeL', 'strafeR', 'pWalk', 'pRun'];
const UPPER = ['fire', 'throw', 'pIdle', 'pWalk', 'pRun'];
const FIRE_POSE_T = 0.33;   // the aim pose = "Firing Rifle" held at this time (the gun mount is measured on it)
const _ik = { a: new THREE.Vector3(), f: new THREE.Vector3(), h: new THREE.Vector3(), t: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Vector3(), q: new THREE.Quaternion(), I: new THREE.Quaternion() };
const _pt = new THREE.Vector3(), _pt2 = new THREE.Vector3(), _up = new THREE.Vector3();
// D82 pistol reload: the left wrist's path (reload progress → point), points refreshed every frame
const RELOAD_PTS = { cur: new THREE.Vector3(), belt: new THREE.Vector3(), under: new THREE.Vector3(), seated: new THREE.Vector3(), slide: new THREE.Vector3(), racked: new THREE.Vector3(), tgt: new THREE.Vector3(), pole: new THREE.Vector3() };
const RELOAD_PATH = [[0.12, 'cur'], [0.3, 'belt'], [0.42, 'belt'], [0.58, 'under'], [0.66, 'seated'], [0.72, 'seated'], [0.78, 'slide'], [0.84, 'racked'], [0.9, 'cur']];

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
    const act = (clip) => { const a = this.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); return a; };
    this.L = {};
    for (const k of LEGS) if (C[k]) this.L[k] = act(C[k].lower);
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
    // full-body layers: the death, the roll (D82), crouching behind low cover (D82)
    const once = (id) => { const a = act(C[id].full); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0; return a; };
    this.die = once(pick.die);
    this.dieDur = C[pick.die].duration;
    this.dodge = C.dodge ? once('dodge') : null;
    this.dodgeDur = C.dodge ? C.dodge.duration : 1;
    this.crouchIdle = C.crouchIdle ? act(C.crouchIdle.full) : null;
    this.crouchWalk = C.crouchWalk ? act(C.crouchWalk.full) : null;
    this.w = { move: 0, run: 0, aim: 0, reload: 0, dead: 0, throw: 0, dodge: 0, crouch: 0, f: 1, b: 0, l: 0, r: 0 };
    this.guns = {};
    this.gun = null;
    this.gunId = '';
    this.set = 'rifle';
    this.inLeft = false;
    this.muzzle = null;
    this.aimYaw = 0;
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

    // ---- full-body layers: death, the roll (D82), crouching behind low cover (D82)
    const live = 1 - ease('dead', dead ? 1 : 0, 1.2);
    const rolling = !dead && st.dodge >= 0 && !!this.dodge;
    if (rolling) w.dodge = 1; else ease('dodge', 0, 2.5); // the roll starts at once and blends out as he gets up
    const dg = w.dodge;
    const cr = ease('crouch', !dead && st.crouch && !rolling && this.crouchIdle ? 1 : 0, 1.3) * (1 - dg);
    const normal = live * (1 - dg) * (1 - cr);   // what is left for the leg + upper-body layers

    // ---- legs: direction weights (forward / back / left / right) and walk → run by speed
    const sp = dead ? 0 : st.speed;
    const move = ease('move', Math.min(1, sp / 12));
    const rel = Number.isFinite(st.moveRel) ? st.moveRel : 0;
    const cf = Math.cos(rel), sr = Math.sin(rel);
    let f = Math.max(0, cf), b = Math.max(0, -cf), r = Math.max(0, sr), l = Math.max(0, -sr);
    const sum = f + b + r + l || 1;
    f = ease('f', f / sum); b = ease('b', b / sum); r = ease('r', r / sum); l = ease('l', l / sum);
    const run = ease('run', smooth(A.runFrom, A.runTo, sp));
    const fwdWalk = pistol ? L.pWalk : L.walk, fwdRun = pistol ? L.pRun : L.run;
    for (const a of Object.values(L)) a.setEffectiveWeight(0);
    // standing: the pistol stance always; with a long gun the aim stance while aiming (aim weight from last frame)
    const stand = (1 - move) * normal;
    if (pistol) L.pIdle.setEffectiveWeight(stand);
    else { L.fire.setEffectiveWeight(stand * w.aim); L.idle.setEffectiveWeight(stand * (1 - w.aim)); }
    fwdWalk.setEffectiveWeight(move * f * (1 - run) * normal);
    fwdRun.setEffectiveWeight(move * f * run * normal);
    if (L.back) L.back.setEffectiveWeight(move * b * normal);
    if (L.strafeL) L.strafeL.setEffectiveWeight(move * l * normal);
    if (L.strafeR) L.strafeR.setEffectiveWeight(move * r * normal);
    const rate = (id, max) => Math.min(max, Math.max(0.6, sp / (R[id] || 30)));
    fwdWalk.timeScale = rate(pistol ? 'pWalk' : 'walk', A.walkRateMax);
    fwdRun.timeScale = rate(pistol ? 'pRun' : this.pick.run, 1.6);
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
    const up = normal * (1 - hit * 0.8);
    for (const a of Object.values(U)) a.setEffectiveWeight(0);
    if (pistol) {
      // pistol: Pistol Idle is the ready / aim pose; walking and running swing the arms of their clips; the reload is
      // Pistol Idle + the left hand moved by IK (D82, _pistolReload — no pistol reload clip from the user)
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
    if (this.dodge) {
      this.dodge.setEffectiveWeight(dg * live);
      if (rolling) this.dodge.time = Math.min(0.999, st.dodge) * this.dodgeDur;
    }
    if (this.crouchIdle) {
      const cm = this.crouchWalk ? Math.min(1, sp / 10) : 0;
      this.crouchIdle.setEffectiveWeight(cr * (1 - cm) * live);
      if (this.crouchWalk) {
        this.crouchWalk.setEffectiveWeight(cr * cm * live);
        this.crouchWalk.timeScale = Math.min(A.walkRateMax, Math.max(0.6, sp / (R.crouchWalk || 30)));
      }
    }
    this.mixer.update(Math.max(0, dt));

    // the gun goes to the left hand while the right arm throws
    const left = thr > 0.5 && tossT >= A.throwHandOff && tossT < A.throwHandBack;
    if (left !== this.inLeft) this._mountGun(left);

    // D82: where the barrel points in THIS pose (relative to the body's facing) — the renderer turns the body by it,
    // so the gun itself points at the aim whatever the legs do (walking / strafing hips sway the torso)
    const aimW = Math.max(am, pistol ? rl : 0) * normal;
    const yawNow = aimW > 0.001 && this.gun && !this.inLeft ? this._barrelYaw() : 0;

    // ---- procedural layers (after the clips): recoil, pistol reload
    if (!dead && normal > 0.05) this._procedural(st, pistol, rl * normal, am);
    this.aimYaw = yawNow * aimW;
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

  /** Rotates a bone by a world-space rotation q (keeps its parent chain). */
  _rotateWorldQ(bone, q) {
    bone.parent.updateMatrixWorld(true);
    bone.parent.getWorldQuaternion(_q2);
    bone.getWorldQuaternion(_q);
    _q.premultiply(q);
    bone.quaternion.copy(_q2.invert().multiply(_q));
    bone.updateMatrixWorld(true);
  }

  /**
   * D82: two-bone IK of an arm — the wrist goes to world point `target`, the elbow bends towards world point `pole`.
   * Starts from the animated pose (the bend plane of the clip at weight 0), so blending in / out never jumps.
   */
  _armIK(side, target, pole) {
    const A = this.bones.get(`${side}Arm`), F = this.bones.get(`${side}ForeArm`), H = this.bones.get(`${side}Hand`);
    if (!A || !F || !H) return;
    const { a, f, h, t, p, e, q } = _ik;
    A.getWorldPosition(a); F.getWorldPosition(f); H.getWorldPosition(h);
    const l1 = a.distanceTo(f), l2 = f.distanceTo(h);
    t.copy(target).sub(a);
    const d = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, t.length()));
    t.normalize();
    p.copy(pole).sub(a);
    p.addScaledVector(t, -p.dot(t));
    if (p.lengthSq() < 1e-8) return;
    p.normalize();
    const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    e.copy(a).addScaledVector(t, l1 * cosA).addScaledVector(p, l1 * Math.sqrt(1 - cosA * cosA)); // the new elbow
    q.setFromUnitVectors(f.sub(a).normalize(), _pt.copy(e).sub(a).normalize());
    this._rotateWorldQ(A, q);
    F.getWorldPosition(f); H.getWorldPosition(h);
    const wrist = _pt2.copy(a).addScaledVector(t, d);
    q.setFromUnitVectors(h.sub(f).normalize(), wrist.sub(f).normalize());
    this._rotateWorldQ(F, q);
  }

  /**
   * D82 pistol reload (the user has no pistol reload clip; the old procedural shake is gone): the gun turns up and in
   * to the chest, the LEFT hand (IK) goes from the gun to the belt for a magazine, pushes it up into the grip, racks
   * the slide and takes the gun again. pr — reload progress 0…1, k — layer weight.
   */
  _pistolReload(pr, k) {
    const B = (n) => this.bones.get(n);
    const gun = this.gun;
    if (!gun || !gun.visible) return;
    // the right arm: the gun up and in
    const tilt = smooth(0, 0.16, pr) * (1 - smooth(0.86, 1, pr)) * k;
    const seat = (smooth(0.6, 0.66, pr) - smooth(0.66, 0.74, pr)) * k; // the magazine slapped home
    _up.set(0, 1, 0);
    this._rotateWorld(B('RightForeArm'), _axis, 0.16 * tilt);
    this._rotateWorld(B('RightForeArm'), _up, 0.4 * tilt);
    this._rotateWorld(B('RightHand'), _axis, 0.28 * tilt - 0.08 * seat);
    // the left hand: keys of the path (character frame: f forward, h up, s right; or a point of the gun)
    const reach = smooth(0.04, 0.2, pr) * (1 - smooth(0.86, 0.98, pr)) * k; // IK weight: from the grip and back
    if (reach < 0.002) return;
    this.group.updateMatrixWorld(true);
    const P = RELOAD_PTS;
    B('LeftHand').getWorldPosition(P.cur);
    this._charPoint(4, 29, -8, P.belt);
    gun.localToWorld(P.under.set(-1, -9, 0));
    gun.localToWorld(P.seated.set(-1, -6.5, 0));
    gun.localToWorld(P.slide.set(1, 3.5, -1));
    gun.localToWorld(P.racked.set(-3.5, 3.5, -1));
    const path = RELOAD_PATH;
    P.tgt.copy(P.cur);
    for (let i = 0; i < path.length - 1; i++) {
      const [t0, k0] = path[i], [t1, k1] = path[i + 1];
      if (pr <= t0) { P.tgt.copy(P[k0]); break; }
      if (pr <= t1) { P.tgt.copy(P[k0]).lerp(P[k1], smooth(t0, t1, pr)); break; }
    }
    P.tgt.lerp(P.cur, 1 - reach);
    this._charPoint(-6, 18, -22, P.pole); // the elbow down, back and out to the left
    this._armIK('Left', P.tgt, P.pole);
  }

  /** A point of the character frame (f forward, h up, s right; game units) → world. */
  _charPoint(f, h, s, out) { return out.set(f, h, s).applyMatrix4(this.group.matrixWorld); }

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
    if (pistol && pr >= 0 && rl > 0.01) this._pistolReload(pr, rl);
  }

  dispose() {
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
