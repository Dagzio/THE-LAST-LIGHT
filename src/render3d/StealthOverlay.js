// D85 STEALTH visuals (MODES_DESIGN_D85.md §3.10) — like the stealth games: every enemy's view cone on the floor
// (coloured by his state: calm blue → noticing yellow → investigating orange → combat red; the part filled by his
// suspicion meter brighter), clipped by walls / closed doors / tall furniture (the same rays the AI's eyes use);
// suspicion bars over the heads; expanding rings for the noises the hero makes. Presentation only: reads the run.
// D87 (user: "smoother vision light"): the cones are drawn every frame at the enemy's interpolated position and
// current facing; the clipped ray lengths ease towards their recast values (≤ RECASTS_PER_FRAME cones recast per
// frame, round robin), the colour and the suspicion fill ease too; soft edges — the alpha falls off towards the
// sides and the far end (apex → middle ring → rim).
// Cost: ONE mesh for all cones (≤ MAX_CONES × 2 fans × RAYS × 9 vertices), two instanced meshes (bars, rings).
import * as THREE from '../../lib/three.module.js';
import { BLOCK } from '../systems/Collision.js';

const RAYS = 24;
const MAX_CONES = 12;
const MAX_RINGS = 8;
const RECASTS_PER_FRAME = 4;
const Y = 1.3;
const MID = 0.55;          // the middle ring at this fraction of each ray
const EDGE = 0.22;         // the outer fraction of the cone (each side) that fades to 0
const COLORS = {
  calm: [0.3, 0.58, 1.0], notice: [1.0, 0.82, 0.23], investigate: [1.0, 0.6, 0.16], combat: [1.0, 0.23, 0.16],
};
const M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion();
const RING_C = new THREE.Color();
const smoothstep = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

export class StealthOverlay {
  /** @param {THREE.Scene} scene  @param {THREE.Quaternion} faceCam the billboard rotation (bars face the camera) */
  constructor(scene, faceCam, rays = RAYS) {
    this.scene = scene;
    this.faceCam = faceCam;
    this.rays = rays;
    const verts = MAX_CONES * 2 * rays * 9;
    this.pos = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 4);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.cones = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.cones.frustumCulled = false;
    this.cones.renderOrder = 2;
    // the angular falloff per ray (0 at the sides → 1 in the middle)
    this.edgeK = new Float32Array(rays + 1);
    for (let i = 0; i <= rays; i++) { const u = Math.min(i, rays - i) / rays; this.edgeK[i] = smoothstep(u / EDGE); }
    // suspicion bars (back + fill), amber
    const plane = new THREE.PlaneGeometry(1, 1);
    this.barBack = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false }), MAX_CONES);
    this.barFill = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ color: 0xffb02e, depthTest: false, depthWrite: false }), MAX_CONES);
    for (const b of [this.barBack, this.barFill]) { b.frustumCulled = false; b.count = 0; }
    this.barBack.renderOrder = 13; this.barFill.renderOrder = 14;
    // noise rings
    const ring = new THREE.RingGeometry(0.965, 1, 48);
    ring.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), MAX_RINGS);
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 3;
    this.rings.setColorAt(0, RING_C.setScalar(1)); // the colour attribute exists from the start (no shader recompile later)
    this.rings.count = 0;
    this.ringList = [];           // { x, y, r, at }
    this.cache = new Map();       // enemy id → { dist, tgt (ray lengths now / target), col, s, castAt, x, y, a }
    this.frame = 0;
    this.lastTime = -1;
    this.recastCursor = 0;
    scene.add(this.cones, this.barBack, this.barFill, this.rings);
  }

  /** A noise of the run (event 'noise'): an expanding ring. */
  addNoise(x, y, r, time) {
    if (this.ringList.length >= MAX_RINGS) this.ringList.shift();
    this.ringList.push({ x, y, r, at: time });
  }

  /**
   * @param {import('../core/MissionRun.js').MissionRun} run
   * @param {(x, y) => boolean} onScreen
   * @param {(e) => {x:number, y:number}} [posOf] the enemy's drawn (interpolated) position
   */
  sync(run, time, onScreen, posOf = null) {
    this.frame++;
    const dt = this.lastTime < 0 ? 0 : Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    const p = run.player, world = run.world;
    // the nearest on-screen living enemies
    const list = this._list || (this._list = []);
    list.length = 0;
    for (const e of run.enemies) {
      if (!e.alive || e.ai.mode === 'grabbed' || !onScreen(e.x, e.y)) continue;
      list.push(e);
    }
    list.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const n = Math.min(MAX_CONES, list.length);
    let v = 0, bars = 0, recasts = 0;
    const R = this.rays;
    const ease = Math.min(1, dt * 12), easeC = Math.min(1, dt * 6);
    // round robin: the cones recast this frame start after the last one recast
    for (let j = 0; j < n; j++) {
      const k = (this.recastCursor + j) % n, e = list[k], c = this._cone(e);
      const fresh = !c.cast;
      const moved = Math.abs(e.x - c.x) > 2 || Math.abs(e.y - c.y) > 2 || Math.abs(e.faceAngle - c.a) > 0.02 || c.range !== this._range(e);
      if ((fresh || moved) && (fresh || recasts < RECASTS_PER_FRAME)) {
        this._cast(e, c, world);
        if (fresh) c.dist.set(c.tgt);
        recasts++;
        this.recastCursor = (k + 1) % n;
      }
    }
    for (let k = 0; k < n; k++) {
      const e = list[k], ai = e.ai, c = this._cone(e);
      for (let i = 0; i <= R; i++) c.dist[i] += (c.tgt[i] - c.dist[i]) * ease;
      const s = ai.suspicion || 0;
      const state = ai.mode === 'combat' ? 'combat' : ai.investigate || ai.mode === 'alert' || ai.mode === 'search' ? 'investigate' : s >= 0.05 ? 'notice' : 'calm';
      const tc = COLORS[state];
      for (let q = 0; q < 3; q++) c.col[q] += (tc[q] - c.col[q]) * easeC;
      c.s += ((state === 'combat' ? 0 : s) - c.s) * Math.min(1, dt * 10);
      c.bright += ((state === 'calm' ? 0 : 1) - c.bright) * easeC;
      const at = posOf ? posOf(e) : e;
      const half = this._half(e);
      const baseA = 0.34 + 0.08 * c.bright;
      v = this._fan(v, c, at.x, at.y, e.faceAngle, half, 1, c.col, baseA);
      if (c.s > 0.02) v = this._fan(v, c, at.x, at.y, e.faceAngle, half, Math.min(1, c.s), c.col, 0.6);
      // the suspicion bar over his head
      if (s > 0.02 && s < 1 && bars < MAX_CONES) {
        const top = 62 * (e.type.scale || 1) + 10, w = 26;
        P.set(at.x, top, at.y - 4); S.set(w + 2, 4, 1); M.compose(P, this.faceCam, S); this.barBack.setMatrixAt(bars, M);
        P.set(at.x - (w * (1 - s)) / 2, top + 0.2, at.y - 3.8); S.set(Math.max(0.01, w * s), 2.6, 1); M.compose(P, this.faceCam, S); this.barFill.setMatrixAt(bars, M);
        bars++;
      }
    }
    // clear the rest of the buffer (zero-area triangles)
    this.pos.fill(0, v * 3);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.setDrawRange(0, v);
    this.barBack.count = this.barFill.count = bars;
    this.barBack.instanceMatrix.needsUpdate = this.barFill.instanceMatrix.needsUpdate = true;
    // the noise rings: grow to r in 0.45 s and fade
    let r = 0;
    this.ringList = this.ringList.filter((q) => time - q.at < 0.6 && time >= q.at);
    for (const q of this.ringList) {
      const k = (time - q.at) / 0.45;
      if (k > 1) continue;
      P.set(q.x, 1.6, q.y); S.set(q.r * k, 1, q.r * k); M.compose(P, Q.identity(), S);
      this.rings.setColorAt(r, RING_C.setScalar(1 - k * k)); // additive: fades out as it reaches its radius
      this.rings.setMatrixAt(r++, M);
    }
    this.rings.count = r;
    this.rings.instanceMatrix.needsUpdate = true;
    if (r && this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    // forget enemies gone from the run
    if (this.frame % 120 === 0) { const ids = new Set(run.enemies.map((e) => e.id)); for (const id of this.cache.keys()) if (!ids.has(id)) this.cache.delete(id); }
  }

  _range(e) { const busy = e.busy && e.ai.mode === 'idle'; return e.type.view.range * (busy ? 0.6 : 1); }
  _half(e) { const busy = e.busy && e.ai.mode === 'idle'; return ((e.type.view.fov * Math.PI) / 360) * (busy ? 0.75 : 1); }

  _cone(e) {
    let c = this.cache.get(e.id);
    if (!c) {
      const R = this.rays;
      c = { cast: false, x: NaN, y: NaN, a: NaN, range: 0, dist: new Float32Array(R + 1), tgt: new Float32Array(R + 1), col: [...COLORS.calm], s: 0, bright: 0 };
      this.cache.set(e.id, c);
    }
    return c;
  }

  /** Recasts the rays of a cone (relative to his facing: ray i keeps its angle offset, so a turn shows at once). */
  _cast(e, c, world) {
    const R = this.rays, range = this._range(e), half = this._half(e);
    c.x = e.x; c.y = e.y; c.a = e.faceAngle; c.range = range; c.cast = true;
    for (let i = 0; i <= R; i++) {
      const a = e.faceAngle - half + (2 * half * i) / R;
      const t = world.segmentHit(e.x, e.y, e.x + Math.cos(a) * range, e.y + Math.sin(a) * range, 0, null, BLOCK.SIGHT);
      c.tgt[i] = range * (t === Infinity ? 1 : t);
    }
  }

  /** One fan of a cone from (x, y): apex → middle ring → rim at `frac` of each ray; soft sides and far end. */
  _fan(v, c, x, y, face, half, frac, col, aApex) {
    const R = this.rays, pos = this.pos, colA = this.col, K = this.edgeK;
    const cap = pos.length / 3;
    const put = (px, pz, a) => {
      pos[v * 3] = px; pos[v * 3 + 1] = Y; pos[v * 3 + 2] = pz;
      colA[v * 4] = col[0]; colA[v * 4 + 1] = col[1]; colA[v * 4 + 2] = col[2]; colA[v * 4 + 3] = a;
      v++;
    };
    for (let i = 0; i < R; i++) {
      if (v + 9 > cap) return v;
      const a0 = face - half + (2 * half * i) / R, a1 = face - half + (2 * half * (i + 1)) / R;
      const d0 = c.dist[i] * frac, d1 = c.dist[i + 1] * frac;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const k0 = K[i], k1 = K[i + 1];
      const am0 = aApex * 0.55 * k0, am1 = aApex * 0.55 * k1; // the middle ring
      const m0x = x + c0 * d0 * MID, m0z = y + s0 * d0 * MID, m1x = x + c1 * d1 * MID, m1z = y + s1 * d1 * MID;
      const r0x = x + c0 * d0, r0z = y + s0 * d0, r1x = x + c1 * d1, r1z = y + s1 * d1;
      // apex → middle
      put(x, y, aApex * Math.max(k0, k1)); put(m0x, m0z, am0); put(m1x, m1z, am1);
      // middle → rim (two triangles), fading to nothing at the far end
      const ar0 = aApex * 0.12 * k0, ar1 = aApex * 0.12 * k1; // a faint rim: the range stays readable
      put(m0x, m0z, am0); put(r0x, r0z, ar0); put(r1x, r1z, ar1);
      put(m0x, m0z, am0); put(r1x, r1z, ar1); put(m1x, m1z, am1);
    }
    return v;
  }

  dispose() {
    for (const o of [this.cones, this.barBack, this.barFill, this.rings]) { this.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
    this.cache.clear();
  }
}
