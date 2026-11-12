// D56 (2026-11-12): the keeper's skeleton (the user's Tripo model, Mixamo bones) posed from code every frame — no
// animation clips. Combat stance (lowered hips → the leg IK bends the knees, torso lean), the walk (feet stepping along
// the movement), both hands on the gun by two-bone IK (data/keeperRig.js GUN_HOLD) with the fingers closed around it,
// arms hanging when he dies. Presentation only: reads the state it is given, never the simulation.
import * as THREE from '../../lib/three.module.js';
import { KEEPER_MODEL, KEEPER_STANCE, holdOf } from '../data/keeperRig.js';

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const CURL = [1.0, 1.15, 0.75];  // rad per finger joint around the handle
const THUMB_CURL = [0, 0.35, 0.35];

// scratch objects (no allocation per frame)
const V = Array.from({ length: 10 }, () => new THREE.Vector3());
const Q = Array.from({ length: 4 }, () => new THREE.Quaternion());
const M1 = new THREE.Matrix4(), M2 = new THREE.Matrix4();

export class KeeperSkeleton {
  /** @param {{root: THREE.Object3D, mesh: THREE.SkinnedMesh, bones: Map<string, THREE.Bone>, texture: THREE.Texture}} model */
  constructor(model) {
    this.group = new THREE.Group(); // the keeper frame (faces +X, game units)
    const wrap = new THREE.Group();
    const geo = model.mesh.geometry;
    geo.computeBoundingBox();
    const h = geo.boundingBox.max.y - geo.boundingBox.min.y || 1;
    wrap.rotation.y = KEEPER_MODEL.rotY;
    wrap.scale.setScalar(KEEPER_MODEL.height / h);
    wrap.position.y = -geo.boundingBox.min.y * (KEEPER_MODEL.height / h);
    wrap.add(model.root);
    this.group.add(wrap);
    this.mesh = model.mesh;
    this.mesh.material = new THREE.MeshLambertMaterial({ map: model.texture });
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false; // the bind-pose bounds do not follow the posed bones
    const B = (n) => model.bones.get(n);
    this.b = {};
    for (const n of ['Hips', 'Spine', 'Spine1', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm',
      'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']) {
      this.b[n] = B(n);
      if (!this.b[n]) throw new Error(`keeper bone missing: ${n}`);
    }
    this.fingers = { Left: [], Right: [] };
    for (const side of ['Left', 'Right']) {
      for (const f of FINGERS) this.fingers[side].push({ bones: [1, 2, 3].map((k) => B(`${side}Hand${f}${k}`)).filter(Boolean), curl: CURL });
      this.fingers[side].push({ bones: [1, 2, 3].map((k) => B(`${side}HandThumb${k}`)).filter(Boolean), curl: THUMB_CURL });
    }
    this.tmp = { z: new THREE.Vector3(), y: new THREE.Vector3(), t: new THREE.Vector3(), pole: new THREE.Vector3() };
    this.rest = [...model.bones.values()].map((b) => [b, b.quaternion.clone(), b.position.clone()]);
    // rest measurements in the keeper frame (the group is still at the origin: world = keeper frame)
    this.group.updateMatrixWorld(true);
    const wp = (b, v) => b.getWorldPosition(v);
    this.hipsRest = wp(this.b.Hips, new THREE.Vector3());
    this.ankle = { Left: wp(this.b.LeftFoot, new THREE.Vector3()), Right: wp(this.b.RightFoot, new THREE.Vector3()) };
    this.footQ = { Left: this.b.LeftFoot.getWorldQuaternion(new THREE.Quaternion()), Right: this.b.RightFoot.getWorldQuaternion(new THREE.Quaternion()) };
    this.hand = {};
    for (const side of ['Left', 'Right']) {
      const hand = this.b[`${side}Hand`], mid = B(`${side}HandMiddle1`);
      const p0 = wp(hand, new THREE.Vector3()), p1 = mid ? wp(mid, new THREE.Vector3()) : p0.clone().add(new THREE.Vector3(0, 0, side === 'Left' ? -3 : 3));
      const along = p1.clone().sub(p0), palmLen = along.length();
      along.normalize();
      const palm = new THREE.Vector3(0, -1, 0).addScaledVector(along, along.y).normalize(); // T-pose: palms face down
      this.hand[side] = { q: hand.getWorldQuaternion(new THREE.Quaternion()), along, palm, palmLen };
    }
  }

  /** Back to the bind pose (every frame starts here, so nothing drifts). */
  _reset() {
    for (const [b, q, p] of this.rest) { b.quaternion.copy(q); b.position.copy(p); }
  }

  _setWorldQ(bone, qW) {
    bone.parent.getWorldQuaternion(Q[3]);
    bone.quaternion.copy(Q[3].invert().multiply(qW));
    bone.updateMatrixWorld(true);
  }

  _rotateWorld(bone, axisW, angle) {
    Q[0].setFromAxisAngle(axisW, angle);
    bone.getWorldQuaternion(Q[1]);
    this._setWorldQ(bone, Q[0].multiply(Q[1]));
  }

  /** Turns `bone` so the direction to `child` points at the world point `target` (shortest rotation). */
  _aim(bone, child, target) {
    const a = bone.getWorldPosition(V[6]), c = child.getWorldPosition(V[7]);
    const cur = c.sub(a).normalize(), want = V[8].copy(target).sub(a).normalize();
    if (!(cur.lengthSq() > 0) || !(want.lengthSq() > 0)) return;
    Q[0].setFromUnitVectors(cur, want);
    bone.getWorldQuaternion(Q[1]);
    this._setWorldQ(bone, Q[0].multiply(Q[1]));
  }

  /** Two-bone IK: a (root) → b (middle) → c (end) reaches `target` (world); the middle joint bends towards `pole`. */
  _ik(a, b, c, target, pole) {
    const pa = a.getWorldPosition(V[0]), pb = b.getWorldPosition(V[1]), pc = c.getWorldPosition(V[2]);
    const la = pa.distanceTo(pb), lb = pb.distanceTo(pc);
    const dir = V[3].copy(target).sub(pa);
    const d = Math.min(Math.max(dir.length(), Math.abs(la - lb) + 1e-3), la + lb - 1e-3);
    dir.normalize();
    const cosA = (la * la + d * d - lb * lb) / (2 * la * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const side = V[4].copy(pole).addScaledVector(dir, -pole.dot(dir));
    if (side.lengthSq() < 1e-8) side.set(0, -1, 0);
    side.normalize();
    const elbow = V[5].copy(pa).addScaledVector(dir, la * cosA).addScaledVector(side, la * sinA);
    const end = V[9].copy(pa).addScaledVector(dir, d);
    this._aim(a, b, elbow);
    this._aim(b, c, end);
  }

  /** Keeper-frame point / direction → world (into `out`). */
  _pt(x, y, z, out) { return out.set(x, y, z).applyMatrix4(this.group.matrixWorld); }
  _dir(x, y, z, out) { return out.set(x, y, z).transformDirection(this.group.matrixWorld); }

  /** The hand's fingers along `along`, palm facing `palm` (keeper frame), then closed around the handle. */
  _orientHand(side, along, palm, grip) {
    const r = this.hand[side];
    const a = V[0].fromArray(along).normalize(), n = V[1].fromArray(palm).addScaledVector(a, -V[1].fromArray(palm).dot(a)).normalize();
    M1.makeBasis(a, n, V[2].crossVectors(a, n));
    M2.makeBasis(r.along, r.palm, V[3].crossVectors(r.along, r.palm)).transpose();
    Q[2].setFromRotationMatrix(M1.multiply(M2)).multiply(r.q);  // keeper-frame orientation of the hand
    this.group.getWorldQuaternion(Q[1]);
    this._setWorldQ(this.b[`${side}Hand`], Q[1].multiply(Q[2]));
    if (!grip) return;
    const axis = V[4].crossVectors(a, n).transformDirection(this.group.matrixWorld); // curling moves the tips to the palm
    for (const f of this.fingers[side]) f.bones.forEach((bone, k) => { if (f.curl[k]) this._rotateWorld(bone, axis, f.curl[k]); });
  }

  /**
   * Poses the skeleton for this frame. s: { weaponId, phase (walk cycle, rad), blend (0…1 walking), moveRel (move
   * direction in the keeper frame, rad), kick (recoil 0…1), down (0…1: dead — arms hang, stance off) }.
   */
  update(s) {
    const S = KEEPER_STANCE, up = 1 - (s.down || 0);
    this._reset();
    this.group.updateWorldMatrix(true, true);
    // stance: hips lower and back, torso leans, shoulders forward
    const hips = this.b.Hips;
    this._pt(this.hipsRest.x - S.hipBack * up, this.hipsRest.y - S.hipDrop * up, this.hipsRest.z, V[0]);
    hips.position.copy(hips.parent.worldToLocal(V[0]));
    hips.updateMatrixWorld(true);
    const T = this.tmp, zAxis = this._dir(0, 0, 1, T.z), yAxis = this._dir(0, 1, 0, T.y);
    this._rotateWorld(this.b.Spine, zAxis, -S.lean * up);
    this._rotateWorld(this.b.RightShoulder, yAxis, S.shoulderForward * up);
    this._rotateWorld(this.b.LeftShoulder, yAxis, -S.shoulderForward * up);
    // legs: feet step along the movement (two steps per cycle), knees forward
    const cx = Math.cos(s.moveRel || 0), cz = Math.sin(s.moveRel || 0), bl = (s.blend || 0) * up;
    for (const side of ['Left', 'Right']) {
      const ph = s.phase + (side === 'Left' ? 0 : Math.PI);
      const st = Math.sin(ph) * S.stride * bl, lift = Math.max(0, Math.cos(ph)) * S.lift * bl;
      const r = this.ankle[side], spread = (side === 'Left' ? -1 : 1) * S.footSpread * up;
      const t = this._pt(r.x + cx * st, r.y + lift, r.z + spread + cz * st, T.t);
      const pole = this._dir(1, 0, 0, T.pole); // D59: knees straight forward (not splayed)
      this._ik(this.b[`${side}UpLeg`], this.b[`${side}Leg`], this.b[`${side}Foot`], t, pole);
      this.group.getWorldQuaternion(Q[1]);
      this._setWorldQ(this.b[`${side}Foot`], Q[1].multiply(this.footQ[side])); // the foot stays flat
    }
    // arms: on the gun, or hanging (dead)
    const hold = holdOf(s.weaponId);
    const kick = (s.kick || 0);
    for (const [k, side] of [[0, 'Right'], [1, 'Left']]) {
      const hand = hold.hands[k], r = this.hand[side];
      const sgn = side === 'Left' ? -1 : 1;
      let px, py, pz;
      if (up > 0.5) {
        px = hold.at[0] - kick * 1.6 + (k ? hold.left[0] : 0);
        py = hold.at[1] + kick * 0.5 + (k ? hold.left[1] : 0);
        pz = hold.at[2] + (k ? hold.left[2] : 0);
        // the wrist sits behind the palm centre (half a palm back along the fingers, a little off the palm side)
        const a = V[0].fromArray(hand.along).normalize(), n = V[1].fromArray(hand.palm).normalize();
        px -= a.x * r.palmLen * 0.55 + n.x * 0.7; py -= a.y * r.palmLen * 0.55 + n.y * 0.7; pz -= a.z * r.palmLen * 0.55 + n.z * 0.7;
      } else { px = 1; py = 25; pz = sgn * 9; }
      const t = this._pt(px, py, pz, T.t);
      const pole = this._dir(-0.4, -1, sgn * 0.9, T.pole);
      this._ik(this.b[`${side}Arm`], this.b[`${side}ForeArm`], this.b[`${side}Hand`], t, pole);
      if (up > 0.5) this._orientHand(side, hand.along, hand.palm, true);
    }
  }
}
