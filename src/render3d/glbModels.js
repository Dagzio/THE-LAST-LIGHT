// D54: bakes the user's textured GLB guns and turrets into the game frame (data/models3d.js numbers).
import * as THREE from '../../lib/three.module.js';
import { GUN_FRAME } from '../data/keeperRig.js';
import { TURRET_BASE_RADIUS } from '../data/models3d.js';

const gunFrameOf = (id) => GUN_FRAME[id] || GUN_FRAME.pistol;

/**
 * A gun model → the old gun frame of keeperRig GUN_FRAME: its grip lands on GUN_FRAME.grip and its muzzle exactly on
 * GUN_FRAME.tip (uniform scale + a small pitch around the grip), so the hand placement and the simulation's muzzle
 * point stay as they were.
 */
export function bakeGun(geometry, entry, weaponId) {
  const F = gunFrameOf(weaponId);
  geometry.rotateY(entry.rotY);
  const [gx, gy, gz] = entry.grip, [tx, ty] = entry.tip;
  const G = F.grip, T = F.tip;
  const lenNew = Math.hypot(tx - gx, ty - gy), lenOld = Math.hypot(T[0] - G[0], T[1] - G[1]);
  const pitch = Math.atan2(T[1] - G[1], T[0] - G[0]) - Math.atan2(ty - gy, tx - gx);
  const s = lenOld / lenNew;
  geometry.translate(-gx, -gy, -gz);
  geometry.rotateZ(pitch);
  geometry.scale(s, s, s);
  geometry.translate(G[0], G[1], G[2]);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A turret model → { base, head } in the game frame: base centre on the origin, barrel along +X, scaled so the base
 * radius is TURRET_BASE_RADIUS. Triangles whose centre is above the neck height (entry.split) form the head, which
 * the renderer turns towards the target around the origin. Both share the vertex buffers.
 */
export function bakeTurret(geometry, entry) {
  const s = TURRET_BASE_RADIUS / entry.baseR;
  geometry.translate(-entry.center[0], 0, -entry.center[1]);
  geometry.rotateY(entry.rotY);
  const P = geometry.attributes.position;
  const idx = geometry.index ? geometry.index.array : null;
  const triCount = idx ? idx.length / 3 : P.count / 3;
  const base = [], head = [];
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const cy = (P.getY(a) + P.getY(b) + P.getY(c)) / 3;
    (cy > entry.split ? head : base).push(a, b, c);
  }
  geometry.scale(s, s, s);
  const part = (list) => {
    const g = new THREE.BufferGeometry();
    for (const name in geometry.attributes) g.setAttribute(name, geometry.attributes[name]);
    g.setIndex(list);
    g.computeBoundingSphere();
    return g;
  };
  return { base: part(base), head: part(head) };
}
