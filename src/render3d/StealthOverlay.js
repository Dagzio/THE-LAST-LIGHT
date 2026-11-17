// D85 STEALTH visuals (MODES_DESIGN_D85.md §3.10) — like the stealth games: every enemy's view cone on the floor
// (coloured by his state: calm blue → noticing yellow → investigating orange → combat red; the part filled by his
// suspicion meter brighter), clipped by walls / closed doors / tall furniture (the same rays the AI's eyes use);
// suspicion bars over the heads; expanding rings for the noises the hero makes. Presentation only: reads the run.
// Cost: the cones are ONE mesh (≤ MAX_CONES × 2 fans × (RAYS + 1) triangles), the rays of a cone are recast only
// when its enemy moved / turned (staggered), the bars and rings are two instanced meshes.
import * as THREE from '../../lib/three.module.js';
import { BLOCK } from '../systems/Collision.js';

const RAYS = 16;
const MAX_CONES = 12;
const MAX_RINGS = 8;
const Y = 1.3;
const COLORS = {
  calm: [0.3, 0.58, 1.0], notice: [1.0, 0.82, 0.23], investigate: [1.0, 0.6, 0.16], combat: [1.0, 0.23, 0.16],
};
const M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion();
const RING_C = new THREE.Color();

export class StealthOverlay {
  /** @param {THREE.Scene} scene  @param {THREE.Quaternion} faceCam the billboard rotation (bars face the camera) */
  constructor(scene, faceCam, rays = RAYS) {
    this.scene = scene;
    this.faceCam = faceCam;
    this.rays = rays;
    const verts = MAX_CONES * 2 * rays * 3;
    this.pos = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 4);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.cones = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.cones.frustumCulled = false;
    this.cones.renderOrder = 2;
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
    this.cache = new Map();       // enemy id → { x, y, a, frame, dist: Float32Array }
    this.frame = 0;
    scene.add(this.cones, this.barBack, this.barFill, this.rings);
  }

  /** A noise of the run (event 'noise'): an expanding ring. */
  addNoise(x, y, r, time) {
    if (this.ringList.length >= MAX_RINGS) this.ringList.shift();
    this.ringList.push({ x, y, r, at: time });
  }

  /** @param {import('../core/MissionRun.js').MissionRun} run  @param {(x, y) => boolean} onScreen */
  sync(run, time, onScreen) {
    this.frame++;
    const p = run.player, world = run.world;
    // the nearest on-screen living enemies
    const list = [];
    for (const e of run.enemies) {
      if (!e.alive || e.ai.mode === 'grabbed' || !onScreen(e.x, e.y)) continue;
      list.push(e);
    }
    list.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const n = Math.min(MAX_CONES, list.length);
    let v = 0, bars = 0;
    const R = this.rays;
    for (let k = 0; k < n; k++) {
      const e = list[k], ai = e.ai, V = e.type.view;
      const busy = e.busy && ai.mode === 'idle';
      const range = V.range * (busy ? 0.6 : 1), half = ((V.fov * Math.PI) / 360) * (busy ? 0.75 : 1);
      // the rays: recast only when he moved / turned (and at most every 3rd frame per enemy)
      let c = this.cache.get(e.id);
      if (!c) { c = { x: NaN, y: NaN, a: NaN, frame: -9, range: 0, dist: new Float32Array(R + 1) }; this.cache.set(e.id, c); }
      const moved = Math.abs(e.x - c.x) > 4 || Math.abs(e.y - c.y) > 4 || Math.abs(e.faceAngle - c.a) > 0.05 || c.range !== range;
      if (moved && (this.frame - c.frame >= 3 || !Number.isFinite(c.x))) {
        c.x = e.x; c.y = e.y; c.a = e.faceAngle; c.frame = this.frame; c.range = range;
        for (let i = 0; i <= R; i++) {
          const a = e.faceAngle - half + (2 * half * i) / R;
          const ex = e.x + Math.cos(a) * range, ey = e.y + Math.sin(a) * range;
          const t = world.segmentHit(e.x, e.y, ex, ey, 0, null, BLOCK.SIGHT);
          c.dist[i] = range * (t === Infinity ? 1 : t);
        }
      }
      const s = ai.suspicion || 0;
      const state = ai.mode === 'combat' ? 'combat' : ai.investigate || ai.mode === 'alert' || ai.mode === 'search' ? 'investigate' : s >= 0.05 ? 'notice' : 'calm';
      const col = COLORS[state];
      const baseA = state === 'calm' ? 0.34 : 0.42;
      v = this._fan(v, c, c.a, half, 1, col, baseA, 0.1);
      if (s > 0.02 && state !== 'combat') v = this._fan(v, c, c.a, half, Math.min(1, s), col, 0.6, 0.32);
      // the suspicion bar over his head
      if (s > 0.02 && s < 1 && bars < MAX_CONES) {
        const top = 62 * (e.type.scale || 1) + 10, w = 26;
        P.set(e.x, top, e.y - 4); S.set(w + 2, 4, 1); M.compose(P, this.faceCam, S); this.barBack.setMatrixAt(bars, M);
        P.set(e.x - (w * (1 - s)) / 2, top + 0.2, e.y - 3.8); S.set(Math.max(0.01, w * s), 2.6, 1); M.compose(P, this.faceCam, S); this.barFill.setMatrixAt(bars, M);
        bars++;
      }
    }
    // clear the rest of the buffer (zero-area triangles)
    for (let i = v * 3; i < this.pos.length; i++) this.pos[i] = 0;
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

  /** One fan of a cone (apex → rim at `frac` of each ray's clipped length) into the buffer from vertex v. */
  _fan(v, c, face, half, frac, col, aApex, aRim) {
    const R = this.rays, pos = this.pos, colA = this.col;
    const ang = (i) => face - half + (2 * half * i) / R;
    for (let i = 0; i < R; i++) {
      if (v + 3 > pos.length / 3) return v;
      const d0 = c.dist[i] * frac, d1 = c.dist[i + 1] * frac, a0 = ang(i), a1 = ang(i + 1);
      const pts = [[c.x, c.y, aApex], [c.x + Math.cos(a0) * d0, c.y + Math.sin(a0) * d0, aRim], [c.x + Math.cos(a1) * d1, c.y + Math.sin(a1) * d1, aRim]];
      for (const [x, z, a] of pts) {
        pos[v * 3] = x; pos[v * 3 + 1] = Y; pos[v * 3 + 2] = z;
        colA[v * 4] = col[0]; colA[v * 4 + 1] = col[1]; colA[v * 4 + 2] = col[2]; colA[v * 4 + 3] = a;
        v++;
      }
    }
    return v;
  }

  dispose() {
    for (const o of [this.cones, this.barBack, this.barFill, this.rings]) { this.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
    this.cache.clear();
  }
}
