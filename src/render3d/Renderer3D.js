// three.js renderer of the map run (top-down 3D, decision 2026-11-06). Reads the 2D simulation state
// (x, y on the ground → X, Z in 3D) and never changes it (rule 12). Follows the H5 3D guide:
// quality presets applied live, shader warm-up + context-loss guard, paused frame drawn once,
// adaptive resolution, shared materials, instancing (draw calls stay low on weak phones).
import * as THREE from '../../lib/three.module.js';
import { createRenderGuard } from './render-guard.js';
import { createMaterials } from './materials.js';
import { buildEnvironment } from './Environment.js';
import {
  playerGeometry, gruntGeometry, gruntEyesGeometry, bulletGeometry, muzzleGeometry, tag,
  beaconGeometry, beaconLanternGeometry, beamGeometry, padGeometry, turretBaseGeometry, turretHeadGeometry,
  coilGeometry, coilHeadGeometry, coilCrystalGeometry, reticleGeometry,
  poisonBaseGeometry, poisonHeadGeometry, poisonTanksGeometry, poisonVialGeometry,
  runnerGeometry, runnerEyesGeometry, bruteGeometry, bruteEyesGeometry, wardenGeometry, wardenEyesGeometry,
  telegraphDiscGeometry, telegraphRingGeometry, kioskGeometry, kioskLanternGeometry,
  crateGeometry, crateGlowGeometry, grenadeGeometry,
  spitterGeometry, spitterEyesGeometry, huskGeometry, huskEyesGeometry, motherGeometry, motherEyesGeometry, globGeometry,
  bootGeometry, weaponGeometry, weaponTip, WEAPON_MODEL_IDS,
} from './models.js';
import { ENEMY_STATES } from '../entities/Enemy.js';
import { GRENADES, GRENADE_RULES } from '../data/grenades.js';
import { BEACON } from '../data/beacon.js';
import { getBossPattern } from '../data/boss.js';
import { getTheme } from '../data/themes.js';
import { MenuScene } from './MenuScene.js';
import { loadGLB, loadSkinnedGLB } from './glb.js';
import { applyRig, rigUniforms, bakeModel } from './rig.js';
import { KeeperSkeleton } from './keeperSkeleton.js';
import { KEEPER_MODEL, gunPlacement, muzzlePoint, holdOf } from '../data/keeperRig.js';
import { ENEMY_GLB, enemyRig, GUN_GLB, TURRET_GLB } from '../data/models3d.js';
import { getEnemyType } from '../data/enemies.js';
import { bakeGun, bakeTurret } from './glbModels.js';
import { FLARE } from '../data/balance.js';
import { CameraRig, distanceFor } from './CameraRig.js';
import { CAMERA } from '../config/camera.js';
import { QUALITY_PRESETS, antialiasFor } from '../config/settings.js';
import { ENEMY_FX } from '../data/balance.js';
import { PLAYER } from '../data/player.js';

const MAX_ENEMIES = 96;
// One instanced body + eyes per enemy type (2 draw calls per type that is on the map; empty types are hidden).
const ENEMY_MODELS = {
  grunt: { body: gruntGeometry, eyes: gruntEyesGeometry, eyesMat: 'eyes', cap: MAX_ENEMIES, tag: 'grunt' },
  runner: { body: runnerGeometry, eyes: runnerEyesGeometry, eyesMat: 'eyes', cap: 48, tag: 'runner' },
  brute: { body: bruteGeometry, eyes: bruteEyesGeometry, eyesMat: 'eyes', cap: 16, tag: 'brute' },
  gloam_warden: { body: wardenGeometry, eyes: wardenEyesGeometry, eyesMat: 'eyesBoss', cap: 2, tag: 'gloam-warden' },
  spitter: { body: spitterGeometry, eyes: spitterEyesGeometry, eyesMat: 'eyesSpitter', cap: 24, tag: 'spitter' },
  husk: { body: huskGeometry, eyes: huskEyesGeometry, eyesMat: 'eyes', cap: 24, tag: 'husk' },
  fog_mother: { body: motherGeometry, eyes: motherEyesGeometry, eyesMat: 'eyesMother', cap: 2, tag: 'fog-mother' },
};
const MAX_GLOBS = 24;
const SUMMON_MARKS = 3;
// Procedural gait per enemy type (D45, presentation only): step frequency (rad/s at full speed), body lift, roll
// (side to side), forward pitch, squash & stretch; float = hovering bosses. All on the instance transform → no
// extra draw calls, no skinning.
// D58: how each type strikes (presentation, on the instance transform): a wind-up in the last `wind` s before the
// hit (pitch > 0 = rears back, crouch = squat, back = pulls back × reach) and the strike over `dur` s after it (pitch
// < 0 = dives forward, reach × radius forward, hop = jump height, squash = body squash on the impact). The grunt keeps
// its D54 lunge + arm swing (no entry).
const STRIKE = {
  runner: { wind: 0.3, dur: 0.32, windPitch: 0.22, crouch: 0.16, back: 0.25, pitch: -0.5, reach: 1.0, hop: 7, squash: 0.08 },   // pounce
  husk: { wind: 0.35, dur: 0.26, windPitch: 0.3, crouch: 0.05, back: 0.35, pitch: -0.45, reach: 0.65, hop: 0, squash: 0.06 },  // head-butt bite
  spitter: { wind: 0.3, dur: 0.24, windPitch: 0.4, crouch: 0, back: 0.2, pitch: -0.6, reach: 0.55, hop: 0, squash: 0.05 },     // neck snap bite
  brute: { wind: 0.45, dur: 0.34, windPitch: 0.35, crouch: 0, back: 0.2, pitch: -0.32, reach: 0.5, hop: 5, squash: 0.14 },     // rear up + slam
  gloam_warden: { wind: 0.5, dur: 0.42, windPitch: 0.25, crouch: 0, back: 0.15, pitch: -0.25, reach: 0.4, hop: 6, squash: 0.1 },
  fog_mother: { wind: 0.5, dur: 0.42, windPitch: 0.25, crouch: 0, back: 0.15, pitch: -0.28, reach: 0.4, hop: 6, squash: 0.1 },
};
const STRIKE_OUT = { pitch: 0, lunge: 0, lift: 0, sy: 1, sxz: 1 };
/** D58: the strike pose of an enemy now (wind-up before its next hit on the keeper / beacon / a device, then the hit). */
function strikePose(e, S, time) {
  const o = STRIKE_OUT, R = e.radius;
  o.pitch = 0; o.lunge = 0; o.lift = 0; o.sy = 1; o.sxz = 1;
  const k = (time - e.lastAttackAt) / S.dur;
  if (k >= 0 && k < 1) { // the hit: fast dive (first 30 %), then back
    const s = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7, e3 = s * s * (3 - 2 * s);
    o.pitch = S.pitch * e3;
    o.lunge = S.reach * R * e3;
    o.lift = S.hop * Math.sin(Math.min(1, k / 0.6) * Math.PI);
    const imp = k > 0.2 && k < 0.5 ? Math.sin(((k - 0.2) / 0.3) * Math.PI) * S.squash : 0;
    o.sy = 1 - imp; o.sxz = 1 + imp * 0.6;
    return o;
  }
  const next = e.meleeAt > time ? e.meleeAt
    : (e.attackingBeacon || (e.devTarget && e.devUntil > 0)) && e.nextAttackAt > time ? e.nextAttackAt : 0;
  if (next && next - time < S.wind) { // the wind-up: rears / pulls back / squats
    const w = 1 - (next - time) / S.wind, e3 = w * w * (3 - 2 * w);
    o.pitch = S.windPitch * e3;
    o.lunge = -S.back * R * 0.4 * e3;
    o.sy = 1 - S.crouch * e3; o.sxz = 1 + S.crouch * 0.4 * e3;
  }
  return o;
}

const GAIT = {
  grunt: { freq: 9, bob: 2.2, roll: 0.13, pitch: 0.06, squash: 0.05 },
  runner: { freq: 16, bob: 3.2, roll: 0.05, pitch: 0.14, squash: 0.07 },
  brute: { freq: 5.5, bob: 3.8, roll: 0.09, pitch: 0.05, squash: 0.06 },
  spitter: { freq: 8, bob: 1.6, roll: 0.1, pitch: 0.03, squash: 0.08 },
  husk: { freq: 6, bob: 1.4, roll: 0.07, pitch: 0.03, squash: 0.03 },
  gloam_warden: { freq: 3, bob: 2.5, roll: 0.04, pitch: 0.02, squash: 0.02, float: 3 },
  fog_mother: { freq: 2.2, bob: 3, roll: 0.05, pitch: 0.02, squash: 0.03, float: 6 },
};
const E = new THREE.Euler();
const ASH = new THREE.Color(0.06, 0.055, 0.065); // dead bodies darken to ash before they crumble
const TINT = new THREE.Color();
const ZERO = new THREE.Vector3(0, 0, 0);
const AIM_PT = { x: 0, y: 0 };
const CASTING = new THREE.Color(1.35, 1.0, 1.7); // boss tint while an attack is telegraphed
const MAX_BULLETS = 192;
const RELOAD_SEGMENTS = 16;
const GUN_HEIGHT = 34;
const KEEPER_FALL = 0.55; // s — the textured keeper falls over when he dies
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
const ICE_BOLT = new THREE.Color(0.45, 0.85, 1.6);
const TOXIC_BOLT = new THREE.Color(0.55, 1.6, 0.35);
const POISONED = new THREE.Color(0.8, 1.35, 0.7); // D51: a poisoned enemy turns sickly green
const LIT = new THREE.Color(1.55, 1.32, 0.95);    // Illuminated: warm highlight, never a white silhouette
const SLOWED = new THREE.Color(0.72, 0.92, 1.45); // slowed: frosty blue
const LIT_SLOWED = new THREE.Color(1.2, 1.25, 1.4);
const LANTERN_OK = new THREE.Color(0xffc46a);
const LANTERN_HIT = new THREE.Color(0xff5a3a);
const V = new THREE.Vector3();
const NDC = new THREE.Vector2();
const colorCache = new Map();

/** Shows / hides a device model; hidden ones also stop their per-frame matrix updates (perf). */
function showModel(root, on) {
  root.visible = on;
  root.traverse((o) => { o.matrixAutoUpdate = on; });
  if (on) root.updateMatrixWorld(true);
}

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
    this.modelsReady = this._loadModels(); // D52: textured keeper + grunt (the procedural ones stay as the fallback)
    this.yaws = new Map();     // enemy id → smoothed facing (presentation)
    this.lastSyncTime = 0;
    this.shakeUntil = 0;
    this.shakeAmp = 0;
    this.shakeDur = 1;
    this.env = null;
    this.map = null;
    this.pausedDrawn = false;
    this.sizeDirty = true;
    this.sizeObserved = false;
    if (typeof ResizeObserver !== 'undefined') {
      this.sizeObserver = new ResizeObserver(() => { this.sizeDirty = true; });
      this.sizeObserver.observe(canvas);
      this.sizeObserved = true;
    }
    window.addEventListener('resize', () => { this.sizeDirty = true; }); // created once (not in the frame loop)
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
    this.playerBody = tag(new THREE.Mesh(playerGeometry(false, false), m.character), 'keeper');
    this.playerBody.castShadow = true;
    // Arms + gun of the equipped weapon (2026-11-09): a child of the body, so it bobs and leans with it; the muzzle
    // flash is a child of the gun at its barrel tip — it can never drift off the weapon.
    this.weaponGeos = {};
    for (const id of WEAPON_MODEL_IDS) this.weaponGeos[id] = weaponGeometry(id);
    this.weaponMesh = new THREE.Mesh(this.weaponGeos.pistol, m.character);
    this.weaponMesh.castShadow = true;
    this.weaponShown = 'pistol';
    this.playerBody.add(this.weaponMesh);
    // Legs (D45 walk cycle): two boots swinging from hip pivots; the body bobs and leans above them
    const bootGeo = bootGeometry();
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(0, 12, s * 5);
      const boot = new THREE.Mesh(bootGeo, m.character);
      boot.castShadow = true;
      hip.add(boot);
      this.player.add(hip);
      return hip;
    });
    this.walk = { phase: 0, blend: 0, lastTime: 0 };
    this.lanternMesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), m.lantern);
    this.lanternMesh.position.set(-5, 17, -12);
    this.lanternLight = new THREE.PointLight(0xffb36a, 900, 300, 1.6);
    this.lanternLight.position.set(-5, 24, -12);
    this.player.add(this.playerBody, this.lanternMesh, this.lanternLight);
    const ghostGeo = playerGeometry(false, true); // dodge trail: the silhouette with arms
    this.ghosts = [0, 1].map(() => {
      const g = new THREE.Mesh(ghostGeo, m.ghost);
      g.visible = false;
      this.scene.add(g);
      return g;
    });
    this.scene.add(this.player);

    // Enemies (instanced per type): body + glowing eyes.
    this.enemyViews = {};
    for (const [id, def] of Object.entries(ENEMY_MODELS)) {
      const body = new THREE.InstancedMesh(def.body(), m.character, def.cap);
      body.castShadow = true;
      body.setColorAt(0, WHITE);
      body.frustumCulled = false;
      const eyes = new THREE.InstancedMesh(def.eyes(), m[def.eyesMat], def.cap);
      eyes.frustumCulled = false;
      body.visible = eyes.visible = false;
      this.scene.add(tag(body, def.tag), eyes);
      this.enemyViews[id] = { body, eyes, cap: def.cap, n: 0 };
    }
    // Boss telegraphs (own materials: their opacity animates independently)
    const tele = (geo, mat, order) => {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.visible = false;
      mesh.renderOrder = order;
      this.scene.add(mesh);
      return mesh;
    };
    this.tele = {
      slamFill: tele(telegraphDiscGeometry(), m.telegraphFill, 3),
      slamEdge: tele(telegraphRingGeometry(0.95), m.telegraphEdge, 4),
      tideEdge: tele(telegraphRingGeometry(0.97), m.telegraphEdge, 4),
      tideWave: tele(telegraphRingGeometry(0.8), m.telegraphFill, 3),
      impact: tele(telegraphRingGeometry(0.72), m.impact, 5),
    };
    // Fog Mother summon marks (violet discs + edges, one per rising enemy)
    this.summonMarks = [];
    for (let i = 0; i < SUMMON_MARKS; i++) {
      this.summonMarks.push({ fill: tele(telegraphDiscGeometry(), m.summonFill, 3), edge: tele(telegraphRingGeometry(0.88), m.impact, 4) });
    }
    // Spitter globs in flight (instanced, unlit green)
    this.globMesh = new THREE.InstancedMesh(globGeometry(), m.glob, MAX_GLOBS);
    this.globMesh.frustumCulled = false;
    this.globMesh.visible = false;
    this.scene.add(tag(this.globMesh, 'glob'));
    // Shop kiosk (moves to the run's random spot) + its interact-radius ring (between waves)
    this.kiosk = new THREE.Group();
    const kb = new THREE.Mesh(kioskGeometry(), m.prop);
    kb.castShadow = true;
    this.kiosk.add(kb, new THREE.Mesh(kioskLanternGeometry(), m.lantern));
    this.kioskLight = new THREE.PointLight(0xffb36a, 500, 160, 1.6);
    this.kioskLight.position.set(10, 46, 0);
    this.kiosk.add(this.kioskLight);
    this.scene.add(tag(this.kiosk, 'kiosk'));
    this.kioskRing = tele(telegraphRingGeometry(0.94), m.padRune, 2);

    // Phase 6 — crate, grenade aim (dotted arc + landing ring), grenades in flight, blasts and fire zones
    this.crate = new THREE.Group();
    const cb = new THREE.Mesh(crateGeometry(), m.prop);
    cb.castShadow = true;
    this.crate.add(cb, new THREE.Mesh(crateGlowGeometry(), m.crateGlow));
    this.crate.visible = false;
    this.scene.add(tag(this.crate, 'crate'));
    const dot = new THREE.SphereGeometry(2.2, 8, 6);
    this.aimDots = new THREE.InstancedMesh(dot, m.grenadeAim, GRENADE_RULES.previewDots);
    this.aimDots.frustumCulled = false;
    this.aimDots.renderOrder = 6;
    this.aimDots.visible = false;
    this.scene.add(this.aimDots);
    this.aimRing = tele(telegraphRingGeometry(0.9), m.grenadeAimRing, 6);
    this.grenadeMesh = new THREE.InstancedMesh(grenadeGeometry(), m.grenadeBody, 16);
    this.grenadeMesh.frustumCulled = false;
    this.grenadeMesh.setColorAt(0, WHITE);
    this.grenadeMesh.visible = false;
    this.scene.add(this.grenadeMesh);
    this.blastRings = [0, 1, 2, 3].map(() => tele(telegraphRingGeometry(0.6), m.blast, 5));
    this.fireZones = [0, 1, 2, 3].map(() => tele(telegraphDiscGeometry(), m.fire, 3));

    // Emergency Flare pulse: a warm light ring rolling out from the beacon over the arena
    this.flareRing = tele(telegraphRingGeometry(0.93), m.impact, 5);
    this.flareRing.material.color.set(0xffd890);

    // Bullets (instanced), muzzle flash, aim reticle, HP bars, reload arc, blob shadows, particles.
    this.bullets = new THREE.InstancedMesh(bulletGeometry(), m.bullet, MAX_BULLETS);
    this.bullets.frustumCulled = false;
    this.bullets.setColorAt(0, WHITE); // creates instanceColor before the shader warm-up (no recompile on the first ice round)
    this.muzzle = new THREE.Mesh(muzzleGeometry(), m.muzzle);
    this.muzzle.visible = false;
    this.muzzle.renderOrder = 7;
    this._placeMuzzle('pistol');
    this.weaponMesh.add(this.muzzle); // fixed to the barrel tip (moves with every bob / lean / turn of the keeper)
    this.reticle = new THREE.Mesh(reticleGeometry(), m.reticle);
    this.reticle.visible = false;
    this.reticle.renderOrder = 12;
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
    this.scene.add(this.bullets, this.reticle, this.hpBack, this.hpFill, this.reloadArc, this.blobs);

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
    // A new run restarts the game clock at 0: drop every clock-based presentation state of the previous run
    // (an old shake end time made the camera fly off after RETRY).
    this.shakeUntil = 0;
    this.lastSyncTime = 0;
    this.walk.lastTime = 0;
    this.walk.blend = 0;
    this.yaws.clear();
    this._applyTheme(getTheme(map.theme));
    this.env = buildEnvironment(map, this.mats);
    this.env.groundTexture.anisotropy = QUALITY_PRESETS[this.quality].aniso;
    this.scene.add(this.env.group);
    this._buildMapObjects(map);
    this._resize(true);
    this.rig.snap(spawnX, spawnY, map.width, map.height);
    this._placeCamera();
    this.pausedDrawn = false;
    this.keeperFall = 0;
    // the textured models load once at start; the warm-up compiles their rig shaders with the map (no hitch in a fight)
    return this.modelsReady.then(() => { this._applyTurretModels(); return this._warmAll(); });
  }

  // ---------------- D52 textured models (Tripo, simplified offline) + procedural rig ----------------
  /**
   * D52 / D54: the user's textured models (data/models3d.js). Loaded once in parallel; a file that fails keeps the
   * procedural model of that object. Guns are ready before the keeper uses them (same promise).
   */
  async _loadModels() {
    const enemyIds = Object.keys(ENEMY_GLB), gunIds = Object.keys(GUN_GLB);
    const turretKeys = [];
    for (const id in TURRET_GLB) TURRET_GLB[id].forEach((e, i) => turretKeys.push([`${id}@${i + 1}`, e]));
    const [kp, enemies, guns, turrets] = await Promise.all([
      loadSkinnedGLB(KEEPER_MODEL.file),
      Promise.all(enemyIds.map((id) => loadGLB(ENEMY_GLB[id].file))),
      Promise.all(gunIds.map((id) => loadGLB(GUN_GLB[id].file))),
      Promise.all(turretKeys.map(([, e]) => loadGLB(e.file))),
    ]);
    this.gunModels = {};
    gunIds.forEach((id, i) => {
      const m = guns[i];
      if (m) this.gunModels[id] = { geometry: bakeGun(m.geometry, GUN_GLB[id], id), material: new THREE.MeshLambertMaterial({ map: m.texture }) };
    });
    if (kp) this._useKeeperModel(kp);
    enemyIds.forEach((id, i) => { if (enemies[i]) this._useEnemyModel(id, enemies[i]); });
    this.turretModels = {};
    turretKeys.forEach(([key, e], i) => {
      const m = turrets[i];
      if (m) this.turretModels[key] = { ...bakeTurret(m.geometry, e), material: new THREE.MeshLambertMaterial({ map: m.texture }) };
    });
  }

  /** Rigged material (Lambert like the other characters) + the matching shadow depth material. */
  _rigMaterials(texture, uniforms, instanced) {
    const mat = applyRig(new THREE.MeshLambertMaterial({ map: texture }), uniforms, instanced, false);
    const depth = applyRig(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, instanced, true);
    return { mat, depth };
  }

  /** D56: the keeper with his skeleton (render3d/keeperSkeleton.js); the dodge ghosts keep the light silhouette. */
  _useKeeperModel(model) {
    try { this.keeper = new KeeperSkeleton(model); } catch (e) { this.keeper = null; return; } // keeps the procedural keeper
    this.playerBody.geometry = new THREE.BufferGeometry(); // the skinned model (a child) draws him now
    this.playerBody.add(this.keeper.group);
    // D58: the lantern glow becomes a flashlight under the barrel of every gun (moves with the gun, recoil included)
    this.weaponMesh.add(this.lanternMesh, this.lanternLight);
    this.lanternMesh.scale.setScalar(0.4);
    for (const leg of this.legs) leg.visible = false; // the legs are part of the model
    this.legsHidden = true;
    // the gun alone (no box arms), its grip at the right palm (data/keeperRig.js GUN_HOLD); the flash on its barrel tip
    this.weaponMats = {};
    for (const id of WEAPON_MODEL_IDS) {
      const tex = this.gunModels && this.gunModels[id]; // D54: the user's gun model (else the procedural one)
      const g = tex ? tex.geometry : weaponGeometry(id, true);
      const { grip, scale, hand } = gunPlacement(id);
      g.translate(-grip[0], -grip[1], -grip[2]).scale(scale, scale, scale).translate(hand[0], hand[1], hand[2]);
      this.weaponGeos[id] = g;
      if (tex) this.weaponMats[id] = tex.material;
    }
    this.weaponShown = '';
  }

  /** D54: a textured enemy model (any type) with the vertex rig; the procedural one stays for LOW crowds. */
  _useEnemyModel(id, { geometry, texture }) {
    const v = this.enemyViews[id], entry = ENEMY_GLB[id];
    if (!v || !entry) return;
    bakeModel(geometry, entry.height, entry.rotY);
    geometry.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array(v.cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    v.rigU = rigUniforms(enemyRig(entry));
    const { mat, depth } = this._rigMaterials(texture, v.rigU, true);
    v.boxView = { geometry: v.body.geometry, material: v.body.material, depth: v.body.customDepthMaterial };
    v.rigView = { geometry, material: mat, depth };
    v.boss = !!(getEnemyType(id) && getEnemyType(id).boss);
    this._crowdLod();
  }

  /**
   * D52 / D54: textured or procedural enemies by the preset (texturedCrowd: LOW keeps the light procedural crowd;
   * a boss is always textured — there is one of it). The eyes are in the texture of the textured models.
   */
  _crowdLod() {
    const pr = QUALITY_PRESETS[this.quality];
    if (!this.enemyViews || !pr) return;
    for (const id in this.enemyViews) {
      const v = this.enemyViews[id];
      if (!v.rigView) continue;
      const use = pr.texturedCrowd !== false || v.boss ? v.rigView : v.boxView;
      v.body.geometry = use.geometry;
      v.body.material = use.material;
      v.body.customDepthMaterial = use.depth;
      v.rigged = use === v.rigView; // animation per instance (aAnim) only on the textured model
    }
  }

  /** D54: the user's turret models on every pad (base + head that turns), replacing the procedural ones. */
  _applyTurretModels() {
    if (!this.turretModels || !this.padViews) return;
    for (const pv of this.padViews) {
      for (const key in pv.models) {
        const tm = this.turretModels[key];
        const mv = pv.models[key];
        if (!tm || mv.textured) continue;
        const root = mv.root;
        for (const c of [...root.children]) root.remove(c);
        const base = new THREE.Mesh(tm.base, tm.material);
        const head = new THREE.Group();
        head.add(new THREE.Mesh(tm.head, tm.material));
        root.add(base, head);
        root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        root.visible = pv.shown === key;
        showModel(root, root.visible);
        pv.models[key] = { root, head, crystal: null, textured: true };
      }
    }
  }

  /** D54: every hidden model the map may show (enemy types, turret levels) is compiled now, not on first sight. */
  _warmAll() {
    const flip = [];
    for (const id in this.enemyViews) { const b = this.enemyViews[id].body; if (!b.visible) { b.visible = true; flip.push(b); } }
    for (const pv of this.padViews || []) for (const key in pv.models) { const r = pv.models[key].root; if (!r.visible) { r.visible = true; flip.push(r); } }
    return this.guard.warmUp().then(() => { for (const o of flip) o.visible = false; });
  }

  /** Sky, fog and the two scene lights of the map's theme (D45). No light is added or removed (no shader rebuild). */
  _applyTheme(T) {
    this.scene.background.set(T.sky);
    this.scene.fog.color.set(T.sky);
    this.scene.fog.near = T.fog[0];
    this.scene.fog.far = T.fog[1];
    this.hemi.color.set(T.hemi[0]);
    this.hemi.groundColor.set(T.hemi[1]);
    this.hemi.intensity = T.hemi[2];
    this.moon.color.set(T.moon[0]);
    this.moon.intensity = T.moon[1];
  }

  /**
   * Menu backdrop in 3D (D46): splash, main menu and map select. Built on first use, kept for later visits.
   * @returns {boolean} false while the renderer is busy (context lost / warm-up) — the 2D backdrop is drawn instead
   */
  renderMenu(t, frameDt) {
    if (this.guard.busy() || this.env) return false;
    if (!this.menu) {
      this.menu = new MenuScene(this.quality, this.mats);
      this.renderer.compile(this.menu.scene, this.menu.camera); // warm the shaders once
    }
    this._resize(false);
    this.menu.setAspect(this.camera.aspect);
    this.menu.update(t);
    this.renderer.render(this.menu.scene, this.menu.camera);
    this._adapt(frameDt);
    return true;
  }

  /**
   * Map-select preview (D46): a real top-down render of the map's 3D scene — themed ground, decor, beacon, pads and
   * the theme's light — into a 2D canvas. Square crop of the map height around the beacon. Off-screen (render
   * target), so it works while the game canvas is hidden in the menus. Everything built here is disposed again.
   * @returns {HTMLCanvasElement|null}
   */
  renderMapPreview(map, size = 640) {
    if (this.guard.busy() || this.env) return null; // never while a map is on (it shares the renderer)
    const T = getTheme(map.theme);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(T.shore);
    const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2] * 1.15);
    const moon = new THREE.DirectionalLight(T.moon[0], T.moon[1]);
    moon.position.set(map.beacon.x - 320, 900, map.beacon.y + 380);
    moon.target.position.set(map.beacon.x, 0, map.beacon.y);
    const glow = new THREE.PointLight(0xffb060, 2600, 700, 1.2);
    glow.position.set(map.beacon.x, 160, map.beacon.y);
    scene.add(hemi, moon, moon.target, glow);
    const env = buildEnvironment(map, this.mats);
    scene.add(env.group);
    const beacon = new THREE.Mesh(beaconGeometry(), this.mats.prop);
    beacon.position.set(map.beacon.x, 0, map.beacon.y);
    const pads = map.buildPads.map((p) => { const m = new THREE.Mesh(padGeometry(), this.mats.prop); m.position.set(p.x, 0, p.y); return m; });
    scene.add(beacon, ...pads);
    const half = Math.min(map.height, map.width) / 2;
    const cx = Math.min(map.width - half, Math.max(half, map.beacon.x));
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 10, 4000);
    cam.position.set(cx, 1500, map.height / 2 + 260); // the game's slight tilt
    cam.lookAt(cx, 0, map.height / 2);
    // Rendered into the (hidden) game canvas at the preview size — the screen path keeps the ACES tone mapping and the
    // sRGB output of the real scene — and copied right away in the same task (no preserveDrawingBuffer needed).
    const prevShadow = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.render(scene, cam);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    out.getContext('2d').drawImage(this.renderer.domElement, 0, 0);
    this.renderer.shadowMap.enabled = prevShadow;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.sizeDirty = true; // the next map sizes the canvas again
    this.cssW = this.cssH = -1;
    env.dispose();
    beacon.geometry.dispose();
    for (const p of pads) p.geometry.dispose();
    this.pausedDrawn = false;
    return out;
  }

  unloadMap() {
    if (!this.env) return;
    this.scene.remove(this.env.group);
    this.env.dispose();
    if (this.mapObjects) { this.scene.remove(this.mapObjects); this.mapObjects = null; }
    if (this.mapGeos) { for (const geo of this.mapGeos) geo.dispose(); this.mapGeos = null; }
    if (this.beam) { this.beam.geometry.dispose(); this.beam = null; }
    this.env = null;
    this.map = null;
  }

  busy() { return this.guard.busy(); }

  /** D52: enemy bodies cast shadows only on presets with crowdShadows (HIGH). */
  _crowdShadows() {
    const pr = QUALITY_PRESETS[this.quality];
    if (!this.enemyViews || !pr) return; // built before the first applyQuality: that call sets it
    for (const id in this.enemyViews) this.enemyViews[id].body.castShadow = !!(pr.shadows && pr.crowdShadows);
  }

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
    this.blobs.visible = !pr.shadows || !pr.crowdShadows; // D52: enemy blobs also when only the crowd has no shadows
    this.playerBlob = !pr.shadows;                         // the keeper has a real shadow whenever shadows are on
    this._crowdShadows();
    this._crowdLod();
    this.lanternLight.visible = pr.lantern;
    this.kioskLight.visible = pr.lantern; // light count changes only here, followed by the shader warm-up
    if (this.env) this.env.groundTexture.anisotropy = pr.aniso;
    for (const mat of Object.values(this.mats)) mat.needsUpdate = true;
    this.sizeDirty = true;
    this.pausedDrawn = false;
    return this.guard.warmUp(); // MUST after every preset change (white-screen protection)
  }

  // ---------------- sizing & camera ----------------
  _resize(force) {
    // perf 2026-11-09: reading clientWidth every frame (after the HUD's DOM writes) forced a style + layout pass per
    // frame — the top JS cost on a throttled CPU. A ResizeObserver flags real size changes (window resize, rotation,
    // the canvas shown / hidden); without it the size is still polled every frame.
    if (!this.sizeDirty && !force && this.sizeObserved) return;
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    // The canvas is display:none outside a map, so its CSS size can change without a resize event.
    if (!this.sizeDirty && !force && w === this.cssW && h === this.cssH) return;
    this.cssW = w;
    this.cssH = h;
    // cached for the per-frame projections (no layout reads per enemy / per pointer move — perf 2026-11-09)
    const r = this.canvas.getBoundingClientRect();
    this.viewLeft = r.left;
    this.viewTop = r.top;
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

  _placeCamera(time = -1) {
    const d = distanceFor(this.rig.view.h);
    let x = this.rig.x, z = this.rig.y;
    if (time >= 0 && time < this.shakeUntil) { // decaying shake (presentation only)
      const k = Math.min(1, (this.shakeUntil - time) / this.shakeDur);
      x += Math.sin(time * 73) * this.shakeAmp * k;
      z += Math.cos(time * 61) * this.shakeAmp * k;
    }
    this.camera.position.set(x, d * Math.cos(TILT), z + d * Math.sin(TILT));
    this.camera.lookAt(x, 0, z);
    this.moon.position.set(x - 320, 900, z + 380);
    this.moon.target.position.set(x, 0, z);
  }

  /** Client (CSS px) → ground point in world units (dodge-towards-cursor fallback). */
  screenToGround(clientX, clientY, out = {}) {
    if (!(this.cssW > 0)) this._resize(true);
    NDC.set(((clientX - this.viewLeft) / Math.max(1, this.cssW)) * 2 - 1, -((clientY - this.viewTop) / Math.max(1, this.cssH)) * 2 + 1);
    V.set(NDC.x, NDC.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const t = -this.camera.position.y / (V.y || -1e-6);
    out.x = this.camera.position.x + V.x * t;
    out.y = this.camera.position.z + V.z * t;
    return out;
  }

  /** World point (x, y on the ground, height h) → CSS px of the canvas (for off-screen indicators). */
  projectToScreen(x, y, h, out = {}) {
    V.set(x, h, y).project(this.camera);
    out.x = ((V.x + 1) / 2) * this.viewW;
    out.y = ((1 - V.y) / 2) * this.viewH;
    return out;
  }

  /** Canvas size in CSS px as of this frame (cached in _resize — reading clientWidth after DOM writes forces layout). */
  get viewW() { return this.cssW > 0 ? this.cssW : this.canvas.clientWidth; }
  get viewH() { return this.cssH > 0 ? this.cssH : this.canvas.clientHeight; }

  // ---------------- frame ----------------
  /**
   * @param {import('../core/MapRun.js').MapRun} run
   * @param {number} frameDt real seconds since the last frame (camera smoothing only)
   * @param {number} time simulation clock (all animation reads it, so pause freezes everything)
   * @param {boolean} paused
   */
  render(run, frameDt, time, paused, alpha = 1) {
    if (!run || !this.map || this.guard.busy()) return false;
    this._resize(false);
    this.frameDt = frameDt;
    const dying = !!this.keeper && !run.player.alive && this.keeperFall < KEEPER_FALL; // the keeper is still falling
    if (paused && this.pausedDrawn && !dying) return false; // the paused frame does not change: draw it once
    // Interpolation between the last two fixed steps (alpha 0…1): the camera and the bodies move every frame,
    // not in 60 Hz jumps against a smoothly moving camera (that read as a blurred / doubled keeper).
    this.alpha = paused ? 1 : Math.min(1, Math.max(0, alpha));
    const p = run.player;
    const px = this._lerpX(p), py = this._lerpY(p);
    if (!paused) this.rig.follow(px, py, frameDt, this.map.width, this.map.height);
    this._placeCamera(time);
    this._sync(run, time);
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

    // Player (D52: the textured keeper falls when he dies — presentation time, the world is already stopped)
    const aim = p.aimAngle;
    this.player.visible = p.alive || !!this.keeper;
    const ppx = this._lerpX(p), ppy = this._lerpY(p);
    this.player.position.set(ppx, 0, ppy);
    this.player.rotation.y = -aim;
    // D54: no flicker on a hit (the HUD flashes a red edge instead)
    this.playerBody.visible = true;
    for (const leg of this.legs) leg.visible = !this.legsHidden;
    this.weaponState = run.weapon;
    this._animateKeeper(p, aim, time);
    const trail = p.dodging && preset.trails !== 'off';
    for (let k = 0; k < this.ghosts.length; k++) {
      const g = this.ghosts[k];
      g.visible = trail;
      if (trail) {
        g.position.set(ppx - p.vx * 0.03 * (k + 1), 0, ppy - p.vy * 0.03 * (k + 1));
        g.rotation.y = -aim;
      }
    }

    // Enemies (per type) + HP bars + blob shadows. Walk / hit / death animation is procedural on the instance
    // transform (D45): gait per type, a short squash on every hit, a fall onto the side and a crumble into ash.
    const views = this.enemyViews;
    for (const id in views) views[id].n = 0;
    let bars = 0, blobs = 0;
    const fdt = Math.min(0.1, Math.max(0, time - this.lastSyncTime));
    this.lastSyncTime = time;
    for (const e of run.enemies) {
      const v = views[e.typeId] || views.grunt;
      if (v.n >= v.cap) continue;
      const A = GAIT[e.typeId] || GAIT.grunt;
      const stunned = e.alive && e.isStunned(time);
      const yaw = this._yaw(e, e.faceAngle, fdt) + (stunned ? Math.sin(time * 22 + e.id) * 0.35 : 0); // stun: dazed wobble
      let roll = 0, pitch = 0, lift = 0, sy = 1, sxz = 1, scale = 1, walkPh = 0, walkOn = 0;
      if (e.alive) {
        const moving = !stunned && !e.casting && (e.state === ENEMY_STATES.MOVE_TO_BEACON || e.state === ENEMY_STATES.ATTACK_PLAYER);
        if (moving) {
          const ph = time * A.freq * e.slowFactor(time) + e.id * 1.7;
          walkPh = ph * 0.5; walkOn = 1; // rigged legs: one stride per two body bobs
          lift = Math.abs(Math.sin(ph)) * A.bob;
          roll = Math.sin(ph) * A.roll;
          pitch = -A.pitch;
          const s = Math.sin(ph * 2) * A.squash;
          sy = 1 + s; sxz = 1 - s * 0.5;
        } else { // idle / attacking: slow breathing
          const s = Math.sin(time * 2.6 + e.id) * 0.025;
          sy = 1 + s; sxz = 1 - s * 0.5;
        }
        if (A.float) lift += A.float + Math.sin(time * 1.3 + e.id) * A.float * 0.5;
        const hk = (time - e.lastHitAt) / 0.14; // hit punch: squashes down and widens, then springs back
        if (hk >= 0 && hk < 1) { const k = (1 - hk) * 0.14; sy *= 1 - k * 0.7; sxz *= 1 + k; }
      } else {
        const f = Math.min(1, (time - e.deathAt) / ENEMY_FX.deathFade);
        const fall = Math.min(1, f / 0.35);
        roll = (1 - (1 - fall) ** 3) * (e.type.boss ? 0.5 : 1.3) * ((e.id & 1) ? 1 : -1); // tips over sideways
        const sinkK = Math.max(0, (f - 0.35) / 0.65);
        lift = -sinkK * e.radius * 0.9;              // crumbles into the ground
        scale = 1 - sinkK * 0.35;
      }
      if (v.rigged) { // the textured model walks with its legs: a softer body squash, the arms strike on an attack
        sy = 1 + (sy - 1) * 0.35; sxz = 1 + (sxz - 1) * 0.35; roll *= 0.6;
        const ak = (time - e.lastAttackAt) / 0.35;
        let atk = e.alive && ak >= 0 && ak < 1 ? Math.sin(ak * Math.PI) : 0;
        const wu = e.alive && e.meleeAt > time ? 1 - Math.min(1, (e.meleeAt - time) / 0.35) : 0; // D54 wind-up: arms drawn back
        if (wu > 0 && atk === 0) atk = -0.55 * wu;
        v.body.geometry.attributes.aAnim.setXYZW(v.n, walkPh, walkOn, atk, 0);
      }
      const SP = e.alive && STRIKE[e.typeId];
      let lunge = 0;
      if (SP) { // D58: the type's own strike (pounce / bite / slam) with a wind-up
        const st = strikePose(e, SP, time);
        pitch += st.pitch; lift += st.lift; lunge = st.lunge; sy *= st.sy; sxz *= st.sxz;
      } else {
        const reach = e.radius * 0.4;
        lunge = e.alive && time - e.lastAttackAt < 0.22 ? Math.sin(((time - e.lastAttackAt) / 0.22) * Math.PI) * reach : 0;
        if (!lunge && e.alive && e.meleeAt > time && e.meleeAt - time < 0.35) lunge = -reach * 0.35 * (1 - (e.meleeAt - time) / 0.35); // D54: leans back before the strike
      }
      E.set(roll, -yaw, pitch, 'YXZ');
      Q.setFromEuler(E);
      S.set(sxz * scale, sy * scale, sxz * scale);
      P.set(this._lerpX(e) + Math.cos(yaw) * lunge, lift, this._lerpY(e) + Math.sin(yaw) * lunge);
      M.compose(P, Q, S);
      v.body.setMatrixAt(v.n, M);
      if (!e.alive) M.compose(P, Q, ZERO); // the eyes go out at the moment of death
      v.eyes.setMatrixAt(v.n, M);
      const slowed = e.alive && time < e.slowUntil;
      let tint = WHITE;
      if (!e.alive) tint = TINT.copy(WHITE).lerp(ASH, Math.min(1, (time - e.deathAt) / (ENEMY_FX.deathFade * 0.5)));
      else if (time - e.lastHitAt < ENEMY_FX.hitFlash) tint = FLASH;
      else if (e.casting) tint = CASTING;
      else if (e.illuminated) tint = slowed ? LIT_SLOWED : LIT;
      else if (slowed) tint = SLOWED;
      else if (e.alive && time < e.poisonUntil) tint = POISONED;
      v.body.setColorAt(v.n, tint);
      v.n++;
      const barY = e.type.barHeight;
      const ex = this._lerpX(e), ey = this._lerpY(e);
      if (e.alive && barY > 0 && e.hp < e.maxHp) {
        const w = Math.max(34, e.radius * 2), fill = Math.max(0, e.hp / e.maxHp);
        const bz = ey - e.radius - 8;
        P.set(ex, barY, bz); S.set(w + 2, 6, 1); M.compose(P, FLAT_X, S); this.hpBack.setMatrixAt(bars, M);
        P.set(ex - (w * (1 - fill)) / 2, barY + 0.5, bz); S.set(Math.max(0.01, w * fill), 4, 1); M.compose(P, FLAT_X, S);
        this.hpFill.setMatrixAt(bars, M);
        bars++;
      }
      if (this.blobs.visible && e.alive && blobs < MAX_ENEMIES) {
        const s = e.radius * 2.6;
        P.set(ex, 0.6, ey); S.set(s, s, 1); M.compose(P, FLAT_X, S); this.blobs.setMatrixAt(blobs++, M);
      }
    }
    if (this.playerBlob && p.alive) { P.set(ppx, 0.6, ppy); S.set(44, 44, 1); M.compose(P, FLAT_X, S); this.blobs.setMatrixAt(blobs++, M); }
    for (const id in views) {
      const v = views[id];
      v.body.count = v.eyes.count = v.n;
      v.body.visible = v.n > 0; // no draw call for types that are not on the map
      v.eyes.visible = v.n > 0 && !v.rigged; // the textured grunt has its eyes in the texture
      if (v.n > 0) {
        v.body.instanceMatrix.needsUpdate = v.eyes.instanceMatrix.needsUpdate = true;
        if (v.body.instanceColor) v.body.instanceColor.needsUpdate = true;
        if (v.rigged) v.body.geometry.attributes.aAnim.needsUpdate = true;
      }
    }
    this.hpBack.count = this.hpFill.count = bars;
    this.blobs.count = blobs;
    for (const im of [this.hpBack, this.hpFill, this.blobs]) im.instanceMatrix.needsUpdate = true;

    this._syncBoss(run, time);

    // Aim reticle on the ground (cursor / finger) — where the keeper shoots
    // Placed from the live cursor / finger with THIS frame's camera, so it stays exactly under the pointer while
    // the camera glides (the simulation's aim point updates only on fixed steps and shimmered against the camera).
    this.reticle.visible = p.alive && p.hasAim;
    if (this.reticle.visible) {
      const a = this.aimClient && this.aimClient();
      if (a && a.active) { this.screenToGround(a.clientX, a.clientY, AIM_PT); this.reticle.position.set(AIM_PT.x, 1.4, AIM_PT.y); }
      else this.reticle.position.set(p.aimX, 1.4, p.aimY);
    }

    this._syncMapObjects(run, time);

    // Bullets
    let b = 0;
    for (const pr of run.projectiles.items) {
      if (!pr.active || b >= MAX_BULLETS) continue;
      Q.setFromAxisAngle(UP, -pr.angle);
      P.set(pr.x, pr.stats ? pr.stats.muzzleHeight || GUN_HEIGHT : this.gunY || GUN_HEIGHT, pr.y); S.setScalar(1); // each round at its barrel height
      M.compose(P, Q, S);
      this.bullets.setColorAt(b, pr.weaponId === 'frost_coil' ? ICE_BOLT : pr.weaponId === 'poison_turret' ? TOXIC_BOLT : WHITE); // D50/D51
      this.bullets.setMatrixAt(b++, M);
    }
    this.bullets.count = b;
    this.bullets.instanceMatrix.needsUpdate = true;
    if (b > 0 && this.bullets.instanceColor) this.bullets.instanceColor.needsUpdate = true;

    // Weapon in the hands (changes with the equipped weapon) + muzzle flash at its barrel tip
    const w = run.weapon;
    if (w.weaponId !== this.weaponShown) {
      const id = this.weaponGeos[w.weaponId] ? w.weaponId : (w.weaponId === 'machine_gun' ? 'assault_rifle' : 'pistol');
      this.weaponMesh.geometry = this.weaponGeos[id];
      this.weaponMesh.material = (this.weaponMats && this.weaponMats[id]) || this.mats.character;
      this.weaponShown = w.weaponId;
      this._placeMuzzle(id);
    }
    const since = time - w.lastShotAt;
    this.muzzle.visible = p.alive && since >= 0 && since < 0.06;
    if (this.muzzle.visible) { // a fresh star each shot: random roll + a quick shrink
      const k = 1 - since / 0.06;
      this.muzzle.rotation.x = (w.lastShotAt * 97.3) % (Math.PI * 2);
      this.muzzle.scale.setScalar(this.muzzleScale * (0.7 + 0.3 * k));
    }

    // Reload arc above the keeper (progress = number of lit segments)
    if (w.reloading && p.alive) {
      const lit = Math.max(1, Math.round(w.reloadProgress(time) * RELOAD_SEGMENTS));
      for (let i = 0; i < lit; i++) {
        const a = -Math.PI / 2 + (i / RELOAD_SEGMENTS) * Math.PI * 2;
        Q.setFromAxisAngle(UP, -(a + Math.PI / 2)); // segment along the tangent of the ring
        P.set(ppx + Math.cos(a) * 12, 66, ppy - 26 + Math.sin(a) * 12); S.setScalar(1);
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

  /** Puts the muzzle flash on the barrel tip of a weapon model (local to the gun; size per weapon). */
  _placeMuzzle(id) {
    const tip = weaponTip(id);
    if (this.keeper) { // the gun sits in the hands — the same muzzle point the simulation fires from
      const m = muzzlePoint(id);
      this.muzzle.position.set(m.f - 1, m.h, m.s);
      this.gunY = m.h;
      const back = id === 'pistol' ? 2.2 : 4.5, down = id === 'pistol' ? 1.5 : 1.9; // D58 flashlight under the barrel
      this.lanternMesh.position.set(m.f - back, m.h - down, m.s);
      this.lanternLight.position.set(m.f - back + 3, m.h - down, m.s);
    } else {
      this.muzzle.position.set(tip.x - 1, tip.y, tip.z); // the star starts 2 units behind its origin: overlap the tip
      this.gunY = GUN_HEIGHT;
    }
    this.muzzleScale = tip.flash * (this.keeper ? gunPlacement(id).scale : 1);
    this.muzzle.scale.setScalar(this.muzzleScale);
  }

  _lerpX(o) { return o.prevX === undefined ? o.x : o.prevX + (o.x - o.prevX) * this.alpha; }
  _lerpY(o) { return o.prevY === undefined ? o.y : o.prevY + (o.y - o.prevY) * this.alpha; }

  // ---------------- D45 animation helpers (presentation state lives here, never in the simulation) ----------------
  /** Keeper walk cycle: steps follow the distance walked (no foot sliding), the body bobs and leans into the move. */
  _animateKeeper(p, aim, time) {
    const w = this.walk;
    const dt = Math.min(0.1, Math.max(0, time - w.lastTime));
    w.lastTime = time;
    const speed = p.alive ? Math.hypot(p.vx, p.vy) : 0;
    const target = p.dodging ? 0 : Math.min(1, speed / PLAYER.moveSpeed);
    w.blend += (target - w.blend) * Math.min(1, dt * 12);
    if (!p.dodging) w.phase += ((speed * dt) / 62) * Math.PI * 2; // one full stride ≈ 62 world units
    const b = w.blend;
    const body = this.playerBody;
    const rel = Math.atan2(p.vy, p.vx) - aim;           // movement direction in the keeper's own frame
    const swing = Math.sin(w.phase);
    body.position.y = Math.abs(swing) * 2.2 * b;
    body.rotation.z = -0.1 * Math.cos(rel) * b;          // leans forward / back with the move
    body.rotation.x = -0.07 * Math.sin(rel) * b + swing * 0.035 * b; // leans sideways + a light sway
    body.scale.set(1, 1, 1);
    if (p.dodging) { body.rotation.z = -0.3 * Math.cos(rel); body.rotation.x = -0.3 * Math.sin(rel); body.scale.set(1.04, 0.92, 1.04); }
    this.legs[0].rotation.z = swing * 0.6 * b;
    this.legs[1].rotation.z = -swing * 0.6 * b;
    if (!this.keeper) return;
    // D56 skeleton: stance, walk, both hands on the gun (IK), a recoil kick; he falls over sideways when he dies
    const w0 = this.weaponState, id = w0 ? w0.weaponId : 'pistol';
    const since = w0 ? time - w0.lastShotAt : 1;
    const kick = p.alive && since >= 0 && since < 0.09 ? 1 - since / 0.09 : 0;
    let down = 0;
    if (!p.alive) { // presentation time — the world is stopped by then; the gun drops out of sight
      this.keeperFall = Math.min(KEEPER_FALL, (this.keeperFall || 0) + (this.frameDt || 0));
      const k = this.keeperFall / KEEPER_FALL;
      down = 1 - (1 - k) ** 3;
      body.rotation.x = down * (Math.PI / 2) * 0.96;
      body.rotation.z = 0;
      body.position.y = 0;
    } else this.keeperFall = 0;
    this.keeper.update({ weaponId: id, phase: w.phase, blend: p.alive && !p.dodging ? b : 0, moveRel: rel, kick, down });
    this._gunKick(id, kick);
    this.weaponMesh.visible = p.alive;
  }

  /** D56 recoil: the gun jumps back and its muzzle up around the right palm (the hands follow it by IK). */
  _gunKick(id, kick) {
    const g = this.weaponMesh, at = holdOf(id).at;
    const t = this._gunT || (this._gunT = { m: new THREE.Matrix4(), a: new THREE.Matrix4(), v: new THREE.Vector3() });
    t.m.makeTranslation(at[0] - kick * 1.6, at[1] + kick * 0.5, at[2]);
    t.m.multiply(t.a.makeRotationZ(kick * 0.12)).multiply(t.a.makeTranslation(-at[0], -at[1], -at[2]));
    t.m.decompose(g.position, g.quaternion, t.v);
  }

  /** Smoothed facing per enemy (turns take ~0.1 s instead of snapping). Keyed by the enemy id, pruned on growth. */
  _yaw(e, target, dt) {
    let y = this.yaws.get(e.id);
    if (y === undefined) y = target;
    else { const d = Math.atan2(Math.sin(target - y), Math.cos(target - y)); y += d * Math.min(1, dt * 14); }
    this.yaws.set(e.id, y);
    if (this.yaws.size > 220) this.yaws.clear(); // dead ids accumulate over a long map: cheap reset
    return y;
  }

  /** Light camera shake (D45): explosions, boss impacts, hits on the keeper. On the game clock — pause freezes it. */
  shake(amount, duration) {
    const t = this.lastSyncTime || 0;
    if (t + duration < this.shakeUntil && amount <= this.shakeAmp) return; // a stronger shake is already running
    this.shakeAmp = amount;
    this.shakeDur = duration;
    this.shakeUntil = t + duration;
  }

  // ---------------- boss telegraphs (same circle/ring as the damage test in BossSystem) ----------------
  _syncBoss(run, time) {
    const t = this.tele;
    for (const k in t) t[k].visible = false;
    for (const s of this.summonMarks) s.fill.visible = s.edge.visible = false;
    const bs = run.bossSystem;
    if (!bs || !bs.boss) return;
    const a = bs.attack;
    const pulse = 0.5 + 0.5 * Math.sin(time * 18);
    if (a) {
      const k = bs.progress(time);
      if (a.kind === 'summon') {
        for (let i = 0; i < a.points.length && i < SUMMON_MARKS; i++) {
          const pt = a.points[i], s = this.summonMarks[i];
          this._flat(s.edge, pt.x, pt.y, a.radius, 1.3, 0.5 + 0.4 * pulse);
          this._flat(s.fill, pt.x, pt.y, Math.max(0.01, a.radius * k), 1.2, 0.25 + 0.35 * k);
        }
      } else if (a.kind === 'slam') {
        this._flat(t.slamEdge, a.x, a.y, a.radius, 1.3, 0.55 + 0.4 * pulse);
        this._flat(t.slamFill, a.x, a.y, Math.max(0.01, a.radius * k), 1.2, 0.18 + 0.3 * k);
      } else {
        this._flat(t.tideEdge, a.x, a.y, a.radius, 1.3, 0.45 + 0.4 * pulse);
        this._flat(t.tideWave, a.x, a.y, Math.max(0.01, a.radius * k), 1.2, 0.2 + 0.35 * k);
      }
    }
    const imp = bs.lastImpact;
    const fx = getBossPattern(bs.boss.typeId).impactFx;
    if (imp && time - imp.at < fx && time >= imp.at) {
      const f = (time - imp.at) / fx;
      this._flat(t.impact, imp.x, imp.y, imp.radius * (0.92 + 0.25 * f), 1.4, 0.85 * (1 - f));
    }
  }

  // ---------------- Phase 6: crate, grenade aim / flight / blasts (same numbers as the simulation) ----------------
  _syncGrenades(run, time) {
    // crate (bobbing, glowing pillar)
    const cr = run.crates.crate;
    this.crate.visible = !!cr;
    if (cr) {
      this.crate.position.set(cr.x, Math.sin(time * 3) * 1.5, cr.y);
      this.crate.rotation.y = time * 0.6;
      const left = cr.expiresAt - time; // blink in the last 5 s
      this.crate.children[1].visible = left > 5 || Math.floor(time * 6) % 2 === 0;
    }

    // aim: landing ring with the grenade radius + dotted lob from the keeper
    const pv = run.grenadePreview, gs = run.grenades, p = run.player;
    const aiming = pv.active;
    this.aimDots.visible = aiming;
    this.aimRing.visible = false;
    if (aiming) {
      const G = GRENADES[gs.selected];
      this._flat(this.aimRing, pv.x, pv.y, G.radius, 1.5, 0.55 + 0.25 * Math.sin(time * 10));
      const n = GRENADE_RULES.previewDots;
      const d = Math.hypot(pv.x - p.x, pv.y - p.y);
      const H = GRENADE_RULES.arcHeight + d * 0.12;
      Q.identity(); S.setScalar(1);
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        P.set(p.x + (pv.x - p.x) * t, 30 + 4 * H * t * (1 - t) - 26 * t, p.y + (pv.y - p.y) * t);
        M.compose(P, Q, S);
        this.aimDots.setMatrixAt(i, M);
      }
      this.aimDots.count = n;
      this.aimDots.instanceMatrix.needsUpdate = true;
    }

    // grenades in flight (same arc)
    let k = 0;
    for (const g of gs.flying) {
      if (k >= 16) break;
      const t = Math.min(1, Math.max(0, (time - g.t0) / (g.t1 - g.t0)));
      const d = Math.hypot(g.x1 - g.x0, g.y1 - g.y0);
      const H = GRENADE_RULES.arcHeight + d * 0.12;
      P.set(g.x0 + (g.x1 - g.x0) * t, 30 + 4 * H * t * (1 - t) - 26 * t, g.y0 + (g.y1 - g.y0) * t);
      Q.setFromAxisAngle(UP, time * 9); S.setScalar(1);
      M.compose(P, Q, S);
      this.grenadeMesh.setMatrixAt(k, M);
      this.grenadeMesh.setColorAt(k, rgbOf(g.type === 'frag' ? '#59616b' : g.type === 'cryo' ? '#8fd4ff' : '#c76a2a'));
      k++;
    }
    this.grenadeMesh.count = k;
    this.grenadeMesh.visible = k > 0;
    if (k > 0) {
      this.grenadeMesh.instanceMatrix.needsUpdate = true;
      if (this.grenadeMesh.instanceColor) this.grenadeMesh.instanceColor.needsUpdate = true;
    }

    // Spitter globs: a high lob from the spitter's mouth to the beacon (same timing as the simulation)
    let gn = 0;
    for (const gl of run.globs) {
      if (gn >= MAX_GLOBS) break;
      const t = Math.min(1, Math.max(0, (time - gl.t0) / (gl.t1 - gl.t0)));
      const H = 60 + Math.hypot(gl.x1 - gl.x0, gl.y1 - gl.y0) * 0.25;
      P.set(gl.x0 + (gl.x1 - gl.x0) * t, 26 + 4 * H * t * (1 - t) + 40 * t, gl.y0 + (gl.y1 - gl.y0) * t);
      Q.setFromAxisAngle(UP, -Math.atan2(gl.y1 - gl.y0, gl.x1 - gl.x0));
      S.setScalar(1 + 0.15 * Math.sin(time * 20 + gn));
      M.compose(P, Q, S);
      this.globMesh.setMatrixAt(gn++, M);
    }
    this.globMesh.count = gn;
    this.globMesh.visible = gn > 0;
    if (gn > 0) this.globMesh.instanceMatrix.needsUpdate = true;

    // blasts (short expanding ring) and molotov fire zones (flickering disc for their duration)
    for (const r of this.blastRings) r.visible = false;
    let bi = 0;
    for (const b of gs.blasts) {
      const f = (time - b.at) / 0.4;
      if (f < 0 || f >= 1 || bi >= this.blastRings.length) continue;
      const ring = this.blastRings[bi++];
      ring.material.color.set(b.type === 'frag' ? 0xffb070 : b.type === 'cryo' ? 0x9fe4ff : 0xff7a2a);
      this._flat(ring, b.x, b.y, b.r * (0.4 + 0.75 * f), 2.5, 0.9 * (1 - f));
    }
    for (const z of this.fireZones) z.visible = false;
    let zi = 0;
    for (const z of gs.zones) {
      if (zi >= this.fireZones.length) break;
      const fade = Math.min(1, (z.until - time) / 0.4);
      this._flat(this.fireZones[zi++], z.x, z.y, z.r, 1.8, (0.32 + 0.12 * Math.sin(time * 23 + z.x)) * Math.max(0, fade));
    }
  }

  _flat(mesh, x, y, scale, h, opacity) {
    mesh.visible = true;
    mesh.position.set(x, h, y);
    mesh.scale.set(scale, 1, scale);
    mesh.material.opacity = opacity;
  }

  // ---------------- beacon, beam, pads, devices ----------------
  _buildMapObjects(map) {
    const m = this.mats;
    const g = new THREE.Group();
    const geos = [];
    const mk = (geo, mat, name) => { geos.push(geo); const mesh = new THREE.Mesh(geo, mat); return name ? tag(mesh, name) : mesh; };
    const bx = map.beacon.x, bz = map.beacon.y;

    this.beaconMesh = mk(beaconGeometry(), m.prop, 'beacon');
    this.beaconMesh.castShadow = true;
    this.beaconMesh.receiveShadow = true;
    this.beaconMesh.position.set(bx, 0, bz);
    if (!this.lanternMat) this.lanternMat = new THREE.MeshBasicMaterial({ color: LANTERN_OK, vertexColors: true });
    this.beaconLantern = mk(beaconLanternGeometry(), this.lanternMat);
    this.beaconLantern.position.set(bx, 0, bz);
    this.beaconLight = new THREE.PointLight(0xffb060, 2200, 560, 1.25);
    this.beaconLight.position.set(bx, 140, bz);
    g.add(this.beaconMesh, this.beaconLantern, this.beaconLight);

    // Beam: same angle/width/range as LightSystem (visual = detection)
    this.beamPivot = new THREE.Group();
    this.beamPivot.position.set(bx, 2.2, bz);
    this.beamHalf = -1;
    this.beam = new THREE.Mesh(new THREE.BufferGeometry(), m.beam);
    this.beam.renderOrder = 2;
    this.beamPivot.add(this.beam);
    g.add(this.beamPivot);

    // Build pads + a model of every device × level per pad (D50: the level changes the model). Geometry is built once
    // per map and shared by the pads; only the installed one is visible (hidden meshes cost no draw call).
    const deviceGeo = {};
    for (let lv = 1; lv <= 3; lv++) {
      deviceGeo[`guard_turret@${lv}`] = { base: turretBaseGeometry(lv), head: turretHeadGeometry(lv) };
      deviceGeo[`frost_coil@${lv}`] = { base: coilGeometry(lv), head: coilHeadGeometry(lv), crystal: coilCrystalGeometry(lv) };
      deviceGeo[`poison_turret@${lv}`] = { base: poisonBaseGeometry(lv), head: poisonHeadGeometry(lv), crystal: poisonVialGeometry(lv), crystalMat: 'toxic', glow: poisonTanksGeometry(lv) };
    }
    for (const k in deviceGeo) for (const p in deviceGeo[k]) if (deviceGeo[k][p].isBufferGeometry) geos.push(deviceGeo[k][p]);
    this.padViews = map.buildPads.map((pad) => {
      const padMesh = mk(padGeometry(), m.prop, 'build-pad');
      padMesh.position.set(pad.x, 0, pad.y);
      padMesh.receiveShadow = true;
      const rune = mk(new THREE.RingGeometry(20, 24, 32), m.padRune);
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(pad.x, 6.6, pad.y);
      g.add(padMesh, rune);
      const models = {};
      for (const key in deviceGeo) {
        const dg = deviceGeo[key];
        const root = new THREE.Group();
        const head = new THREE.Group();
        const base = new THREE.Mesh(dg.base, m.character);
        head.add(new THREE.Mesh(dg.head, m.character));
        let crystal = null;
        if (dg.crystal) { crystal = new THREE.Mesh(dg.crystal, m[dg.crystalMat || 'crystal']); head.add(crystal); }
        root.add(base, head);
        if (dg.glow) root.add(new THREE.Mesh(dg.glow, m.toxic)); // static glowing parts (poison tanks)
        root.position.set(pad.x, 6, pad.y);
        root.traverse((o) => { if (o.isMesh && o !== crystal) o.castShadow = true; });
        showModel(root, false); // hidden models skip the per-frame matrix work (turned on while shown)
        tag(root, key.replace('_', '-').replace('@', '-lv'));
        g.add(root);
        models[key] = { root, head, crystal };
      }
      return { rune, models, shown: null };
    });

    this.mapObjects = g;
    this.mapGeos = geos;
    this.scene.add(g);
  }

  _syncMapObjects(run, time) {
    // Beam
    const half = run.light.halfAngle;
    if (half !== this.beamHalf) {
      this.beamHalf = half;
      this.beam.geometry.dispose();
      this.beam.geometry = beamGeometry(BEACON.light.range, half);
    }
    this.beamPivot.rotation.y = -run.light.angle;
    this.beamPivot.visible = !run.beacon.destroyed;

    // Beacon lantern: red flash on hit, dark when fallen
    const b = run.beacon;
    if (b.destroyed) {
      this.lanternMat.color.setRGB(0.12, 0.1, 0.1);
      this.beaconLight.visible = false;
    } else {
      const k = Math.max(0, 1 - (time - b.lastHitAt) / 0.3);
      this.lanternMat.color.copy(LANTERN_OK).lerp(LANTERN_HIT, k);
      this.beaconLight.visible = true;
      const sinceFlare = time - run.flare.lastUsedAt;
      const flash = sinceFlare >= 0 && sinceFlare < 0.5 ? 1 + 2.5 * (1 - sinceFlare / 0.5) : 1;
      this.beaconLight.intensity = 2200 * (0.9 + 0.1 * Math.sin(time * 2.7)) * flash;
    }

    // Kiosk faces the beacon; its reach ring shows between waves and brightens when the keeper is inside
    const k = run.kiosk;
    this.kiosk.position.set(k.x, 0, k.y);
    this.kiosk.rotation.y = -Math.atan2(b.y - k.y, b.x - k.x);
    this.kioskRing.visible = false;
    if (run.betweenWaves) {
      const near = run.playerAtKiosk;
      this._flat(this.kioskRing, k.x, k.y, run.interactRadius, 1.6, near ? 0.75 : 0.3 + 0.15 * Math.sin(time * 4));
    }

    this._syncGrenades(run, time);

    // Emergency Flare pulse ring
    const fk = (time - run.flare.lastUsedAt) / FLARE.pulseFx;
    this.flareRing.visible = false;
    if (fk >= 0 && fk < 1) {
      // linear growth: the wave stays readable while it crosses the screen
      this._flat(this.flareRing, b.x, b.y, Math.max(1, FLARE.pulseRadius * fk), 2, 0.9 * (1 - fk * 0.7));
    }

    // Pads & devices
    const pads = run.defenses.pads;
    for (let i = 0; i < this.padViews.length; i++) {
      const v = this.padViews[i];
      const d = pads[i] ? pads[i].device : null;
      v.rune.visible = !d;
      const key = d ? `${d.id}@${d.level}` : null;
      if (key !== v.shown) {
        if (v.shown) showModel(v.models[v.shown].root, false);
        if (key && v.models[key]) showModel(v.models[key].root, true);
        v.shown = key;
      }
      if (!d || !v.models[key]) continue;
      const mv = v.models[key];
      mv.head.rotation.y = -d.aimAngle;
      const recoil = time - d.lastActionAt < 0.1 ? (1 - (time - d.lastActionAt) / 0.1) * 3 : 0;
      // D52: a hit shakes the device for a moment; a broken one hangs its barrel to the ground until repaired
      const hk = time - d.lastHitAt < 0.18 ? (1 - (time - d.lastHitAt) / 0.18) * 2.5 : 0;
      const jx = hk ? Math.sin(time * 90) * hk : 0, jz = hk ? Math.cos(time * 77) * hk : 0;
      mv.head.position.set(-Math.cos(d.aimAngle) * recoil + jx, d.hp <= 0 ? -3 : 0, -Math.sin(d.aimAngle) * recoil + jz);
      mv.head.rotation.z = d.hp <= 0 ? -0.55 : 0;
      if (mv.crystal && d.id === 'frost_coil') {
        mv.crystal.rotation.y = time * 1.6 + d.aimAngle; // spins on its own (the head turns it with the aim)
        mv.crystal.position.y = Math.sin(time * 2.2) * 2;
      }
      // a fresh install / level-up pops in (presentation only, on the game clock)
      const pk = (time - d.installedAt) / 0.35;
      mv.root.scale.setScalar(pk >= 0 && pk < 1 ? 1 + Math.sin(pk * Math.PI) * 0.18 : 1);
    }
  }

  /** Diagnostics for the debug overlay. */
  info() {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, pixelRatio: this.pixelRatio };
  }
}
