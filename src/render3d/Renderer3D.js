// three.js renderer of the map run (top-down 3D, decision 2026-11-06). Reads the 2D simulation state
// (x, y on the ground → X, Z in 3D) and never changes it (rule 12). Follows the H5 3D guide:
// quality presets applied live, shader warm-up + context-loss guard, paused frame drawn once,
// adaptive resolution, shared materials, instancing (draw calls stay low on weak phones).
import * as THREE from '../../lib/three.module.js';
import { createRenderGuard } from './render-guard.js';
import { createMaterials } from './materials.js';
import { buildEnvironment } from './Environment.js';
import { playerGeometry, gruntGeometry, gruntEyesGeometry, bulletGeometry, muzzleGeometry, tag } from './models.js';
import { CameraRig, distanceFor } from './CameraRig.js';
import { CAMERA } from '../config/camera.js';
import { QUALITY_PRESETS, antialiasFor } from '../config/settings.js';
import { ENEMY_FX } from '../data/balance.js';
import { PLAYER } from '../data/player.js';

const MAX_ENEMIES = 96;
const MAX_BULLETS = 192;
const RELOAD_SEGMENTS = 16;
const GUN_HEIGHT = 34;
const TILT = (CAMERA.tilt * Math.PI) / 180;

// reusable temporaries (no allocation in the frame loop)
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const P = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const FLAT_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const WHITE = new THREE.Color(1, 1, 1);
const FLASH = new THREE.Color(2.6, 2.4, 2.2);
const V = new THREE.Vector3();
const NDC = new THREE.Vector2();
const colorCache = new Map();

function rgbOf(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
}

export class Renderer3D {
  /** @param {HTMLCanvasElement} canvas @param {string} quality resolved preset name */
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: antialiasFor(quality), powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.Fog(0x070a12, 1100, 2300);
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, CAMERA.near, CAMERA.far);
    this.rig = new CameraRig();
    this.mats = createMaterials();

    // Lights: cold night sky + moon (shadows) + the keeper's amber lantern.
    this.hemi = new THREE.HemisphereLight(0x9aaad0, 0x22252c, 1.7);
    this.moon = new THREE.DirectionalLight(0xc8d6ff, 2.1);
    this.moon.shadow.camera.near = 50;
    this.moon.shadow.camera.far = 2200;
    this.moon.shadow.bias = -0.0008;
    this.moon.shadow.normalBias = 0.6;
    this.scene.add(this.hemi, this.moon, this.moon.target);

    this._buildDynamic();
    this.env = null;
    this.map = null;
    this.pausedDrawn = false;
    this.sizeDirty = true;
    this.pixelRatio = 1;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    const markDirty = () => { this.sizeDirty = true; this.pausedDrawn = false; };
    window.addEventListener('resize', markDirty);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', markDirty);

    this.guard = createRenderGuard(THREE, this.renderer, this.scene, this.camera, {
      qualityKey: 'tll.quality',
      onRestored: () => { this.pausedDrawn = false; },
    });
    this.applyQuality(quality);
  }

  // ---------------- scene objects ----------------
  _buildDynamic() {
    const m = this.mats;
    // Player: merged body + lantern + point light; two ghost copies for the dodge trail.
    this.player = new THREE.Group();
    this.playerBody = tag(new THREE.Mesh(playerGeometry(), m.character), 'keeper');
    this.playerBody.castShadow = true;
    this.lanternMesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), m.lantern);
    this.lanternMesh.position.set(-5, 17, -12);
    this.lanternLight = new THREE.PointLight(0xffb36a, 900, 300, 1.6);
    this.lanternLight.position.set(-5, 24, -12);
    this.player.add(this.playerBody, this.lanternMesh, this.lanternLight);
    this.ghosts = [0, 1].map(() => {
      const g = new THREE.Mesh(this.playerBody.geometry, m.ghost);
      g.visible = false;
      this.scene.add(g);
      return g;
    });
    this.scene.add(this.player);

    // Enemies (instanced): body + glowing eyes.
    this.grunts = new THREE.InstancedMesh(gruntGeometry(), m.character, MAX_ENEMIES);
    this.grunts.castShadow = true;
    this.grunts.setColorAt(0, WHITE);
    this.grunts.frustumCulled = false;
    this.gruntEyes = new THREE.InstancedMesh(gruntEyesGeometry(), m.eyes, MAX_ENEMIES);
    this.gruntEyes.frustumCulled = false;
    this.scene.add(tag(this.grunts, 'grunt'), this.gruntEyes);

    // Bullets (instanced), muzzle flash, target marker, HP bars, reload arc, blob shadows, particles.
    this.bullets = new THREE.InstancedMesh(bulletGeometry(), m.bullet, MAX_BULLETS);
    this.bullets.frustumCulled = false;
    this.muzzle = new THREE.Mesh(muzzleGeometry(), m.muzzle);
    this.muzzle.visible = false;
    this.marker = new THREE.Mesh(new THREE.RingGeometry(23, 26, 40), m.marker);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.hpBack = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.hpBack, MAX_ENEMIES);
    this.hpFill = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.hpFill, MAX_ENEMIES);
    this.hpBack.frustumCulled = this.hpFill.frustumCulled = false;
    this.hpBack.renderOrder = 10;
    this.hpFill.renderOrder = 11;
    this.reloadArc = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 2, 2.4), m.reload, RELOAD_SEGMENTS);
    this.reloadArc.frustumCulled = false;
    this.reloadArc.count = 0;
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.blob, MAX_ENEMIES + 1);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.scene.add(this.bullets, this.muzzle, this.marker, this.hpBack, this.hpFill, this.reloadArc, this.blobs);

    this.particleGeo = new THREE.BufferGeometry();
    this.particlePos = null;
    this.particleCol = null;
    this.particles = new THREE.Points(this.particleGeo, m.particles);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  _ensureParticleBuffers(capacity) {
    if (this.particlePos && this.particlePos.length === capacity * 3) return;
    this.particlePos = new Float32Array(capacity * 3);
    this.particleCol = new Float32Array(capacity * 3);
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleCol, 3).setUsage(THREE.DynamicDrawUsage));
  }

  // ---------------- map lifecycle ----------------
  /** Builds the map environment and returns the shader warm-up promise (no frames until it is ready). */
  loadMap(map, spawnX, spawnY) {
    this.unloadMap();
    this.map = map;
    this.env = buildEnvironment(map, this.mats);
    this.env.groundTexture.anisotropy = QUALITY_PRESETS[this.quality].aniso;
    this.scene.add(this.env.group);
    this._resize(true);
    this.rig.snap(spawnX, spawnY, map.width, map.height);
    this._placeCamera();
    this.pausedDrawn = false;
    return this.guard.warmUp();
  }

  unloadMap() {
    if (!this.env) return;
    this.scene.remove(this.env.group);
    this.env.dispose();
    this.env = null;
    this.map = null;
  }

  busy() { return this.guard.busy(); }

  // ---------------- quality (applied live, H5 3D guide §3) ----------------
  applyQuality(quality) {
    this.quality = quality;
    const pr = QUALITY_PRESETS[quality];
    this.pixelRatio = pr.maxPR;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    // shadows
    const sh = this.moon.shadow;
    if (sh.map) { sh.map.dispose(); sh.map = null; }
    this.renderer.shadowMap.enabled = pr.shadows;
    this.moon.castShadow = pr.shadows;
    sh.mapSize.set(pr.shadowSize, pr.shadowSize);
    this.blobs.visible = !pr.shadows;
    this.lanternLight.visible = pr.lantern;
    if (this.env) this.env.groundTexture.anisotropy = pr.aniso;
    for (const mat of Object.values(this.mats)) mat.needsUpdate = true;
    this.sizeDirty = true;
    this.pausedDrawn = false;
    return this.guard.warmUp(); // MUST after every preset change (white-screen protection)
  }

  // ---------------- sizing & camera ----------------
  _resize(force) {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    // The canvas is display:none outside a map, so its CSS size can change without a resize event.
    if (!this.sizeDirty && !force && w === this.cssW && h === this.cssH) return;
    this.cssW = w;
    this.cssH = h;
    this.sizeDirty = false;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.rig.setAspect(w / h);
    const ext = this.rig.view;
    const half = Math.max(ext.w, ext.h) / 2 + 160;
    const sc = this.moon.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
    sc.updateProjectionMatrix();
  }

  _placeCamera() {
    const d = distanceFor(this.rig.view.h);
    const x = this.rig.x, z = this.rig.y;
    this.camera.position.set(x, d * Math.cos(TILT), z + d * Math.sin(TILT));
    this.camera.lookAt(x, 0, z);
    this.moon.position.set(x - 320, 900, z + 380);
    this.moon.target.position.set(x, 0, z);
  }

  /** Client (CSS px) → ground point in world units (dodge-towards-cursor fallback). */
  screenToGround(clientX, clientY, out = {}) {
    const r = this.canvas.getBoundingClientRect();
    NDC.set(((clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -((clientY - r.top) / Math.max(1, r.height)) * 2 + 1);
    V.set(NDC.x, NDC.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const t = -this.camera.position.y / (V.y || -1e-6);
    out.x = this.camera.position.x + V.x * t;
    out.y = this.camera.position.z + V.z * t;
    return out;
  }

  /** World point (x, y on the ground, height h) → CSS px of the canvas (for off-screen indicators). */
  projectToScreen(x, y, h, out = {}) {
    V.set(x, h, y).project(this.camera);
    out.x = ((V.x + 1) / 2) * this.canvas.clientWidth;
    out.y = ((1 - V.y) / 2) * this.canvas.clientHeight;
    return out;
  }

  // ---------------- frame ----------------
  /**
   * @param {import('../core/MapRun.js').MapRun} run
   * @param {number} frameDt real seconds since the last frame (camera smoothing only)
   * @param {number} time simulation clock (all animation reads it, so pause freezes everything)
   * @param {boolean} paused
   */
  render(run, frameDt, time, paused) {
    if (!run || !this.map || this.guard.busy()) return false;
    this._resize(false);
    if (paused && this.pausedDrawn) return false; // the paused frame does not change: draw it once
    this._sync(run, time);
    if (!paused) this.rig.follow(run.player.x, run.player.y, frameDt, this.map.width, this.map.height);
    this._placeCamera();
    this.renderer.render(this.scene, this.camera);
    this.pausedDrawn = paused;
    if (!paused) this._adapt(frameDt);
    return true;
  }

  /** Adaptive resolution on top of the preset: avg fps < 45 over 2 s → −0.25 pixel ratio (not below the floor). */
  _adapt(frameDt) {
    if (!(frameDt > 0)) return;
    this.fpsAcc += frameDt;
    this.fpsFrames += 1;
    if (this.fpsAcc < 2) return;
    const fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    const floor = QUALITY_PRESETS[this.quality].minPR;
    if (fps < 45 && this.pixelRatio > floor) {
      this.pixelRatio = Math.max(floor, this.pixelRatio - 0.25);
      this.sizeDirty = true;
    }
  }

  _sync(run, time) {
    const p = run.player;
    const preset = QUALITY_PRESETS[this.quality];

    // Player
    const aim = p.aimAngle;
    this.player.visible = p.alive;
    this.player.position.set(p.x, 0, p.y);
    this.player.rotation.y = -aim;
    const flicker = p.isInvulnerable(time) && Math.floor(time * 30) % 2 === 0;
    this.playerBody.visible = !flicker;
    const trail = p.dodging && preset.trails !== 'off';
    for (let k = 0; k < this.ghosts.length; k++) {
      const g = this.ghosts[k];
      g.visible = trail;
      if (trail) {
        g.position.set(p.x - p.vx * 0.03 * (k + 1), 0, p.y - p.vy * 0.03 * (k + 1));
        g.rotation.y = -aim;
      }
    }

    // Enemies + HP bars + blob shadows
    let n = 0, bars = 0, blobs = 0;
    for (const e of run.enemies) {
      if (n >= MAX_ENEMIES) break;
      let scale = 1, sink = 0;
      if (!e.alive) {
        const f = Math.min(1, (time - e.deathAt) / ENEMY_FX.deathFade);
        scale = 1 - f * 0.6;
        sink = -f * 14;
      }
      const face = Math.atan2(p.y - e.y, p.x - e.x);
      Q.setFromAxisAngle(UP, -face);
      S.setScalar(scale);
      P.set(e.x, sink, e.y);
      M.compose(P, Q, S);
      this.grunts.setMatrixAt(n, M);
      this.gruntEyes.setMatrixAt(n, M);
      this.grunts.setColorAt(n, e.alive && time - e.lastHitAt < ENEMY_FX.hitFlash ? FLASH : WHITE);
      if (e.alive && e.hp < e.maxHp) {
        const w = 34, fill = Math.max(0, e.hp / e.maxHp);
        P.set(e.x, 46, e.y - 24); S.set(w + 2, 6, 1); M.compose(P, FLAT_X, S); this.hpBack.setMatrixAt(bars, M);
        P.set(e.x - (w * (1 - fill)) / 2, 46.5, e.y - 24); S.set(Math.max(0.01, w * fill), 4, 1); M.compose(P, FLAT_X, S);
        this.hpFill.setMatrixAt(bars, M);
        bars++;
      }
      if (this.blobs.visible && e.alive) { P.set(e.x, 0.6, e.y); S.set(44, 44, 1); M.compose(P, FLAT_X, S); this.blobs.setMatrixAt(blobs++, M); }
      n++;
    }
    if (this.blobs.visible && p.alive) { P.set(p.x, 0.6, p.y); S.set(44, 44, 1); M.compose(P, FLAT_X, S); this.blobs.setMatrixAt(blobs++, M); }
    this.grunts.count = this.gruntEyes.count = n;
    this.hpBack.count = this.hpFill.count = bars;
    this.blobs.count = blobs;
    for (const im of [this.grunts, this.gruntEyes, this.hpBack, this.hpFill, this.blobs]) im.instanceMatrix.needsUpdate = true;
    if (this.grunts.instanceColor) this.grunts.instanceColor.needsUpdate = true;

    // Target marker
    const t = run.target;
    this.marker.visible = !!(t && t.alive);
    if (this.marker.visible) {
      this.marker.position.set(t.x, 1.2, t.y);
      this.marker.scale.setScalar(1 + Math.sin(time * 8) * 0.05);
    }

    // Bullets
    let b = 0;
    for (const pr of run.projectiles.items) {
      if (!pr.active || b >= MAX_BULLETS) continue;
      Q.setFromAxisAngle(UP, -pr.angle);
      P.set(pr.x, GUN_HEIGHT, pr.y); S.setScalar(1);
      M.compose(P, Q, S);
      this.bullets.setMatrixAt(b++, M);
    }
    this.bullets.count = b;
    this.bullets.instanceMatrix.needsUpdate = true;

    // Muzzle flash
    const w = run.weapon;
    this.muzzle.visible = p.alive && time - w.lastShotAt < 0.06;
    if (this.muzzle.visible) {
      this.muzzle.position.set(p.x + Math.cos(aim) * (PLAYER.muzzleOffset + 8), GUN_HEIGHT, p.y + Math.sin(aim) * (PLAYER.muzzleOffset + 8));
      this.muzzle.rotation.y = -aim;
    }

    // Reload arc above the keeper (progress = number of lit segments)
    if (w.reloading && p.alive) {
      const lit = Math.max(1, Math.round(w.reloadProgress(time) * RELOAD_SEGMENTS));
      for (let i = 0; i < lit; i++) {
        const a = -Math.PI / 2 + (i / RELOAD_SEGMENTS) * Math.PI * 2;
        Q.setFromAxisAngle(UP, -(a + Math.PI / 2)); // segment along the tangent of the ring
        P.set(p.x + Math.cos(a) * 12, 66, p.y - 26 + Math.sin(a) * 12); S.setScalar(1);
        M.compose(P, Q, S);
        this.reloadArc.setMatrixAt(i, M);
      }
      this.reloadArc.count = lit;
      this.reloadArc.instanceMatrix.needsUpdate = true;
    } else this.reloadArc.count = 0;

    // Particles (decorative)
    const parts = run.particles.items;
    this._ensureParticleBuffers(parts.length);
    let k = 0;
    for (const q of parts) {
      if (!q.active) continue;
      const fade = q.life / q.maxLife;
      const c = rgbOf(q.color);
      this.particlePos[k * 3] = q.x; this.particlePos[k * 3 + 1] = 18; this.particlePos[k * 3 + 2] = q.y;
      this.particleCol[k * 3] = c.r * fade; this.particleCol[k * 3 + 1] = c.g * fade; this.particleCol[k * 3 + 2] = c.b * fade;
      k++;
    }
    this.particleGeo.setDrawRange(0, k);
    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;
  }

  /** Diagnostics for the debug overlay. */
  info() {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, pixelRatio: this.pixelRatio };
  }
}
