// three.js renderer of a level run (top-down 3D). KILL LIST (D78): the office location (render3d/OfficeScene.js),
// skinned human characters with the user's models + Mixamo clips (render3d/humans.js), pickups, tracers, grenades.
// Reads the 2D simulation state (x, y on the ground → X, Z) and never changes it (rule 12). Follows the H5 3D guide:
// quality presets applied live, shader warm-up + context-loss guard, the paused frame drawn once, adaptive resolution,
// shared materials, instancing for the many small things (draw calls stay low on weak phones).
import * as THREE from '../../lib/three.module.js';
import { createRenderGuard, cpuCanvas } from './render-guard.js';
import { createMaterials } from './materials.js';
import { buildOfficeScene, officeMaterials, preloadOfficeTextures, setOfficeAnisotropy } from './OfficeScene.js';
import { preloadPropModels, bakeImpostors } from './propModels3d.js';
import { HumanTemplate, bakeGunGeometry } from './humans.js';
import { parseSkinnedGLB, loadGLB, blobTexture } from './glb.js';
import { HUMAN_MODELS, HUMAN_ANIM, GUN_MODELS, gunModelOf, enemyModelOf } from '../data/humanModels.js';
import { GRENADES, GRENADE_RULES } from '../data/grenades.js';
import { CameraRig, distanceFor } from './CameraRig.js';
import { dodgeOf } from '../data/player.js';
import { STEALTH } from '../data/stealth.js';
import { StealthOverlay } from './StealthOverlay.js';
import { BLOCK } from '../systems/Collision.js';

// D93 (user: the level showed black with the dialogue on top): the textures still downloading (every TextureLoader goes
// through the default manager) — the level counts as loaded only once none is pending
const TEX = { started: 0, done: 0 };
{
  const LM = THREE.DefaultLoadingManager, start = LM.itemStart, end = LM.itemEnd;
  LM.itemStart = (url) => { TEX.started++; start(url); };
  LM.itemEnd = (url) => { TEX.done++; end(url); };
}

const BLOCK_MOVE = BLOCK.MOVE;
import { CAMERA, CAMERA_TOUCH } from '../config/camera.js';
import { QUALITY_PRESETS, antialiasFor, TOUCH } from '../config/settings.js';

// the key light's fixed offset from what it lights and its shadow camera's axes (texel snapping, D81)
const SUN_DIR = new THREE.Vector3(-260, 820, 300);
const SUN_Z = SUN_DIR.clone().normalize();
const SUN_X = new THREE.Vector3(0, 1, 0).cross(SUN_Z).normalize();
const SUN_Y = SUN_Z.clone().cross(SUN_X);
// D83: the night mood (was 0.9 / 1.6) — the rooms' own lights bring them up. D86 (user: "too dark, the hero is often
// hard to see"): exposure 1.0 → 1.3 (ACES keeps the lamps from blowing out), a brighter fill; the characters get a
// little self-light of their own texture and a rim along the silhouette (hero cool, enemies warm) — readable in any room
const LIGHTING = { hemi: 0.68, key: 1.2, exposure: 1.3 };
const CHAR_LOOK = {
  hero: { selfLight: 0.2, rim: 0xcfe6ff, rimStrength: 0.75, rimPower: 2.2 },
  enemy: { selfLight: 0.14, rim: 0xffb48a, rimStrength: 0.5, rimPower: 2.4 },
};
const MAX_BULLETS = 200;
const MAX_BARS = 32;
const MAX_POOLS = 40;
const MAX_HL = 12; // D90: highlighted objects of a lesson at once
const TILT = (CAMERA.tilt * Math.PI) / 180;
const SHOT_FLASH = 0.05;
// D92: the fall of the dead — the clips fall forward ~25 units (hips) and lie ~60 long; the turn towards free room
const DEATH_FALL = 62;     // units of floor the fall needs ahead (a band DEATH_WIDE wide: the arms spread)
const DEATH_WIDE = 16;
const DEATH_DRIFT = 0.4;   // rad: the fall drifts to his right (measured: the head ends ~55 ahead, ~24 to the right)
const DEATH_TURN = 0.35;   // s the turn towards free room eases in
const DEATH_TURNS = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.57, -1.57]; // rad, the smallest first
const DEATH_FADE_AT = 1.1; // s: no room anywhere — he fades out after the fall…
const DEATH_FADE = 0.5;    // …this fast (and every body this fast before the run removes it)
const smooth01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const P = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const FLAT_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const FACE_CAM = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(Math.PI / 2 - TILT));
const WHITE = new THREE.Color(1, 1, 1);
const HERO_TRACER = new THREE.Color(1.6, 1.45, 1.0);
const ENEMY_TRACER = new THREE.Color(1.8, 0.75, 0.35);
const V = new THREE.Vector3();
const NDC = new THREE.Vector2();
const AIM_PT = { x: 0, y: 0 };
const OBJ_PT = { x: 0, y: 0 };
const colorCache = new Map();
const rgbOf = (hex) => { let c = colorCache.get(hex); if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); } return c; };

/** A canvas-painted icon texture ('!' / '?' / chevron). */
function iconTexture(draw) {
  const { canvas, g } = cpuCanvas(64, 64);
  draw(g);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Renderer3D {
  /** @param {HTMLCanvasElement} canvas @param {string} quality resolved preset name */
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: antialiasFor(quality), powerPreference: 'high-performance', stencil: true }); // D86: stencil — the hero's X-ray
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LIGHTING.exposure;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090d);
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, CAMERA.near, CAMERA.far);
    this.rig = new CameraRig(TOUCH ? CAMERA_TOUCH : CAMERA);
    this.mats = createMaterials();

    // office lighting: cool ambient from above + one key light with shadows (follows the camera)
    // D83: the night office — a dimmer fill; the rooms are lit by their baked lamps / ceiling pools (OfficeScene)
    this.hemi = new THREE.HemisphereLight(0xc9d6ec, 0x2b2722, LIGHTING.hemi);
    this.sun = new THREE.DirectionalLight(0xffe6c8, LIGHTING.key); // D79: the key light — the furniture shadows read
    this.sun.shadow.camera.near = 50;
    this.sun.shadow.camera.far = 2000;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.radius = 3;
    this.sun.shadow.normalBias = 0.5;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this._buildDynamic();
    this.assetsReady = this._loadAssets();
    this.office = null;
    this.map = null;
    this.views = new Map();      // enemy id → HumanView
    this.hero = null;
    this.bodyYaw = undefined;
    this.lastSyncTime = 0;
    this.shakeUntil = 0;
    this.shakeAmp = 0;
    this.shakeDur = 1;
    this.pausedDrawn = false;
    this.sizeDirty = true;
    this.sizeObserved = false;
    if (typeof ResizeObserver !== 'undefined') {
      this.sizeObserver = new ResizeObserver(() => { this.sizeDirty = true; });
      this.sizeObserver.observe(canvas);
      this.sizeObserved = true;
    }
    const markDirty = () => { this.sizeDirty = true; this.pausedDrawn = false; };
    window.addEventListener('resize', markDirty);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', markDirty);
    this.pixelRatio = 1;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.guard = createRenderGuard(THREE, this.renderer, this.scene, this.camera, {
      qualityKey: 'kl.quality',
      onRestored: () => { this.pausedDrawn = false; },
    });
    this.applyQuality(quality);
  }

  // ---------------- assets (loaded once at start, before TAP TO PLAY) ----------------
  async _loadAssets() {
    const fetchBuf = (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    const [animRes, heroBuf, enemyBuf, trainingBuf, guns, grenade] = await Promise.all([
      fetch(HUMAN_ANIM.file).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetchBuf(HUMAN_MODELS.hero.file),
      fetchBuf(HUMAN_MODELS.enemy.file),
      fetchBuf(HUMAN_MODELS.enemyTraining.file),
      Promise.all(Object.entries(GUN_MODELS).map(([id, e]) => loadGLB(e.file).then((m) => [id, m]))),
      loadGLB('assets/models/grenade.min.glb'),
      preloadOfficeTextures(),
      preloadPropModels(), // D96: the user's prop models (trees, plants, the executive chair)
    ]);
    this.anims = animRes;
    try { bakeImpostors(this.renderer); } catch (e) { console.error('prop impostors failed (the pictures stay)', e); } // D96
    this.templates = {};
    // phones: the 4K body textures are drawn at 2K (the files stay unchanged — user request: no compression)
    const maxTex = TOUCH ? 2048 : 4096;
    const make = (key, buf, ref) => {
      if (!buf || !animRes) return null;
      try {
        const m = parseSkinnedGLB(buf);
        const tpl = new HumanTemplate(m, animRes, HUMAN_MODELS[key].height, ref);
        tpl.materials = new Map();
        this.templates[key] = tpl;
        return bodyTexture(m.image, maxTex).then((t) => { tpl.texture = t; });
      } catch (e) { console.error('character model failed', key, e); return null; }
    };
    // D81: the clips fit the hero's rig; the enemy's bones are retargeted against the hero's rest pose
    const heroTex = make('hero', heroBuf, null);
    const heroRest = this.templates.hero ? this.templates.hero.rest : null;
    const enemyTex = make('enemy', enemyBuf, heroRest);
    const trainingTex = make('enemyTraining', trainingBuf, heroRest);
    await Promise.all([heroTex, enemyTex, trainingTex]);
    this.gunGeos = {};
    for (const [id, m] of guns) {
      if (!m) continue;
      this.gunGeos[id] = { geometry: bakeGunGeometry(m.geometry, GUN_MODELS[id]), material: new THREE.MeshLambertMaterial({ map: m.texture }), length: GUN_MODELS[id].length };
    }
    if (grenade) {
      const g = grenade.geometry;
      g.computeBoundingBox();
      const s = 11 / (g.boundingBox.max.y - g.boundingBox.min.y || 1);
      g.scale(s, s, s);
      g.center();
      this.grenadeMesh.geometry = g;
      this.grenadeMesh.material = new THREE.MeshLambertMaterial({ map: grenade.texture });
    }
    return true;
  }

  /** Shared skinned material per template + tint. */
  _material(tpl, tint = 0xffffff, look = CHAR_LOOK.enemy) {
    let m = tpl.materials.get(tint);
    if (!m) {
      // D86: self-light (the texture as emissive, a fraction) + a rim light on the silhouette (fresnel to the camera)
      m = new THREE.MeshLambertMaterial({ map: tpl.texture, color: tint, emissive: 0xffffff, emissiveMap: tpl.texture, emissiveIntensity: look.selfLight });
      const rim = { rimColor: { value: new THREE.Color(look.rim).multiplyScalar(look.rimStrength) }, rimPower: { value: look.rimPower } };
      m.onBeforeCompile = (sh) => {
        if (!sh.fragmentShader.includes('vViewPosition')) return;
        Object.assign(sh.uniforms, rim);
        sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimPower;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
          'outgoingLight += rimColor * pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), rimPower);\n#include <opaque_fragment>');
      };
      tpl.materials.set(tint, m);
    }
    return m;
  }

  _newView(key, tint, gunId, scale = 1, variant = 0) {
    const tpl = this.templates && this.templates[key];
    if (!tpl) return null;
    const hero = key === 'hero';
    const v = tpl.instantiate(this._material(tpl, tint, hero ? CHAR_LOOK.hero : CHAR_LOOK.enemy), variant, !hero); // D82: enemies mix clip variants
    if (scale !== 1) v.wrap.scale.multiplyScalar(scale);
    for (const [id, g] of Object.entries(this.gunGeos || {})) v.addGun(id, g.geometry, hero ? this._stenciled(g.material) : g.material);
    if (hero) this._xray(v);
    const flash = new THREE.Mesh(this.flashGeo, this.flashMat);
    flash.visible = false;
    flash.renderOrder = 7;
    v.attachMuzzle(flash);
    v.flash = flash;
    v.setGun(gunId);
    v.isHero = key === 'hero';
    this._castShadow(v);
    this.scene.add(v.group);
    return v;
  }

  /** D86: the hero's pixels mark the stencil (his X-ray silhouette is never drawn over himself). */
  _stenciled(mat) {
    if (mat.userData.stencilOf) return mat;
    this._stencilMats = this._stencilMats || new Map();
    let m = this._stencilMats.get(mat);
    if (!m) {
      m = mat.clone();
      Object.assign(m, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
      m.userData.stencilOf = mat;
      this._stencilMats.set(mat, m);
    }
    return m;
  }

  /**
   * D86 (user: "the hero is often hard to see"): his X-ray silhouette — the same skinned mesh in one flat colour, drawn
   * only where something stands in front of him (depth GREATER: a wall, a tall cabinet) and not over his own pixels
   * (stencil) — the hero stays readable behind the walls the tilted camera puts in front of him.
   */
  _xray(v) {
    const mesh = v.mesh;
    Object.assign(mesh.material, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    // drawn after the level's opaque meshes (they sort by material before depth): a wall in front is already there, so
    // the hero's stencil marks only his really visible pixels
    mesh.renderOrder = 5;
    for (const g of Object.values(v.guns)) g.renderOrder = 5;
    if (!this.xrayMat) {
      this.xrayMat = new THREE.MeshBasicMaterial({
        color: 0x8fd0ff, transparent: true, opacity: 0.42, depthWrite: false, depthFunc: THREE.GreaterDepth,
        stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, toneMapped: false,
      });
    }
    const x = new THREE.SkinnedMesh(mesh.geometry, this.xrayMat);
    x.bind(mesh.skeleton, mesh.bindMatrix);
    x.position.copy(mesh.position); x.quaternion.copy(mesh.quaternion); x.scale.copy(mesh.scale);
    x.frustumCulled = false;
    x.castShadow = false;
    x.renderOrder = 20;
    mesh.parent.add(x);
    v.xray = x;
  }

  /** The hero casts a real shadow whenever shadows are on; the enemies only on presets with crowdShadows (High). */
  _castShadow(v) {
    const pr = QUALITY_PRESETS[this.quality];
    const on = !!pr.shadows && (v.isHero || !!pr.crowdShadows);
    v.mesh.castShadow = on;
    for (const g of Object.values(v.guns)) g.castShadow = on;
  }

  // ---------------- scene objects ----------------
  _buildDynamic() {
    const m = this.mats;
    // muzzle flash: two crossed quads (a star), additive
    const fl = new THREE.PlaneGeometry(10, 5);
    const fl2 = fl.clone().rotateX(Math.PI / 2);
    this.flashGeo = mergeSimple([fl, fl2]);
    this.flashGeo.translate(4, 0, 0);
    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd68a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    // tracers
    this.bullets = new THREE.InstancedMesh(new THREE.BoxGeometry(16, 1.1, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BULLETS);
    this.bullets.frustumCulled = false;
    this.bullets.setColorAt(0, WHITE);
    this.bullets.count = 0;
    // reticle (D82, user request: a crosshair as in the original game): ring + four ticks + a centre dot, flat on the
    // floor at the aim point, drawn over everything
    const parts = [new THREE.RingGeometry(9, 11.5, 32)];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      parts.push(new THREE.PlaneGeometry(7, 2.2).rotateZ(a).translate(Math.cos(a) * 17, Math.sin(a) * 17, 0));
    }
    parts.push(new THREE.CircleGeometry(2.2, 12));
    const reticleGeo = mergeSimple(parts);
    reticleGeo.rotateX(-Math.PI / 2);
    this.reticle = new THREE.Mesh(reticleGeo, new THREE.MeshBasicMaterial({ color: 0xffe9c2, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
    this.reticle.renderOrder = 12;
    this.reticle.visible = false;
    // grenade aim
    this.aimDots = new THREE.InstancedMesh(new THREE.SphereGeometry(2, 8, 6), m.grenadeAim, GRENADE_RULES.previewDots);
    this.aimDots.frustumCulled = false;
    this.aimDots.visible = false;
    const aimRing = new THREE.RingGeometry(0.9, 1, 40);
    aimRing.rotateX(-Math.PI / 2);
    this.aimRing = new THREE.Mesh(aimRing, m.grenadeAimRing);
    this.aimRing.visible = false;
    this.aimRing.renderOrder = 6;
    // grenades in flight (replaced by the user's model when it loads) + blast rings
    this.grenadeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(4, 10, 8), new THREE.MeshLambertMaterial({ color: 0x4b5348 }), 8);
    this.grenadeMesh.frustumCulled = false;
    this.grenadeMesh.count = 0;
    this.blastRings = [0, 1, 2].map(() => {
      const r = new THREE.Mesh(aimRing, m.blast.clone());
      r.visible = false;
      r.renderOrder = 5;
      return r;
    });
    // HP bars over hurt enemies
    this.hpBack = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.hpBack, MAX_BARS);
    this.hpFill = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.hpFill, MAX_BARS);
    this.hpBack.frustumCulled = this.hpFill.frustumCulled = false;
    this.hpBack.renderOrder = 10;
    this.hpFill.renderOrder = 11;
    // alert icons above enemies: '?' (searching) and '!' (fighting)
    const iconMat = (draw) => new THREE.MeshBasicMaterial({ map: iconTexture(draw), transparent: true, depthWrite: false, depthTest: false });
    const glyph = (txt, col) => (g) => {
      g.fillStyle = 'rgba(10,12,16,0.75)'; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 34);
    };
    this.iconAlert = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13), iconMat(glyph('?', '#ffd23a')), MAX_BARS);
    this.iconCombat = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13), iconMat(glyph('!', '#ff4a3a')), MAX_BARS);
    for (const im of [this.iconAlert, this.iconCombat]) { im.frustumCulled = false; im.renderOrder = 14; im.count = 0; }
    // objective marker (a bobbing chevron) + a pulsing ring on the floor under it
    this.objMarker = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), iconMat((g) => {
      g.fillStyle = '#ffcf3a'; g.strokeStyle = '#3a2a00'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(8, 14); g.lineTo(32, 50); g.lineTo(56, 14); g.lineTo(44, 14); g.lineTo(32, 32); g.lineTo(20, 14); g.closePath(); g.fill(); g.stroke();
    }));
    this.objMarker.renderOrder = 15;
    this.objMarker.visible = false;
    const objRing = new THREE.RingGeometry(0.82, 1, 40);
    objRing.rotateX(-Math.PI / 2);
    this.objRing = new THREE.Mesh(objRing, new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.objRing.renderOrder = 3;
    this.objRing.visible = false;
    // D90 (user: light up the objects themselves): the training ground's highlights — a glowing frame round a prop
    // (4 bars), a ring under a target / an enemy, a bobbing chevron over each
    const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    this.hlBars = new THREE.InstancedMesh(flat, hlMat, MAX_HL * 4);
    this.hlRings = new THREE.InstancedMesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), hlMat, MAX_HL);
    this.hlArrows = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13), this.objMarker.material, MAX_HL);
    for (const im of [this.hlBars, this.hlRings, this.hlArrows]) { im.frustumCulled = false; im.count = 0; im.renderOrder = im === this.hlArrows ? 15 : 3; }
    // D92: a direction arrow painted on the ground (the roll lesson: across the mats); unit length along +x
    const arrowGeo = new THREE.PlaneGeometry(1, 1); arrowGeo.rotateX(-Math.PI / 2);
    this.hlGroundArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ map: iconTexture((g) => {
      g.fillStyle = '#ffcf3a'; g.strokeStyle = 'rgba(40, 28, 0, 0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(4, 24); g.lineTo(38, 24); g.lineTo(38, 12); g.lineTo(60, 32); g.lineTo(38, 52); g.lineTo(38, 40); g.lineTo(4, 40); g.closePath(); g.fill(); g.stroke();
    }), transparent: true, depthWrite: false }));
    this.hlGroundArrow.renderOrder = 6; // (over the mats)
    this.hlGroundArrow.visible = false;
    this.scene.add(this.hlGroundArrow);
    // crate "in reach" ring
    this.reachRing = new THREE.Mesh(objRing, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.reachRing.renderOrder = 3;
    this.reachRing.visible = false;
    // blood pools under the dead (dosed: small, dark)
    const pool = iconTexture((g) => {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(90,8,8,0.85)'); gr.addColorStop(0.7, 'rgba(70,6,6,0.6)'); gr.addColorStop(1, 'rgba(60,4,4,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false }), MAX_POOLS);
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 2;
    this.pools.count = 0;
    // blob shadows (Low preset: no shadow map)
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.blob, MAX_BARS + 1);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.blobs.count = 0;
    // D88: rounds on a body (taken by walking over it) — a small glowing magazine bobbing over him
    const magGeo = new THREE.BoxGeometry(4, 9, 2.4);
    magGeo.translate(0, 0, 0);
    this.ammoMarks = new THREE.InstancedMesh(magGeo, new THREE.MeshBasicMaterial({ color: 0xffc04a }), MAX_POOLS);
    this.ammoMarks.frustumCulled = false;
    this.ammoMarks.count = 0;
    this.scene.add(this.ammoMarks);
    // particles (normal blending: dark blood / dust must show on light floors)
    this.particleGeo = new THREE.BufferGeometry();
    this.particlePos = null;
    this.particleCol = null;
    this.particles = new THREE.Points(this.particleGeo, new THREE.PointsMaterial({ size: 4, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
    this.particles.frustumCulled = false;
    this.scene.add(this.bullets, this.reticle, this.aimDots, this.aimRing, this.grenadeMesh, ...this.blastRings, this.hpBack, this.hpFill,
      this.iconAlert, this.iconCombat, this.objMarker, this.objRing, this.reachRing, this.hlBars, this.hlRings, this.hlArrows, this.pools, this.blobs, this.particles);
  }

  _ensureParticleBuffers(capacity) {
    if (this.particlePos && this.particlePos.length === capacity * 3) return;
    this.particlePos = new Float32Array(capacity * 3);
    this.particleCol = new Float32Array(capacity * 3);
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleCol, 3).setUsage(THREE.DynamicDrawUsage));
  }

  // ---------------- pickups (crates, medkits, key card, drive) ----------------
  _buildPickups(level) {
    const g = new THREE.Group();
    const mat = (c, basic = false) => (basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }));
    const olive = mat(0x3d4630), trim = mat(0x8c8f86), stripe = mat(0xd9b23a), white = mat(0xeeeeea), red = mat(0xc4231b);
    const card = mat(0x58c8ff, true), drive = mat(0xff9a2a, true), dark = mat(0x1b1e22);
    this.pickupViews = level.pickups.map((def) => {
      const root = new THREE.Group();
      root.position.set(def.x, 0, def.y);
      let lid = null, spin = null;
      if (def.hidden) { /* D88: the training ground's chests — the prop is drawn already */ } else if (def.kind === 'crate') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 20).translate(0, 6, 0), olive);
        const band = new THREE.Mesh(new THREE.BoxGeometry(41, 2, 21).translate(0, 8, 0), stripe);
        lid = new THREE.Group();
        lid.position.set(0, 12, -10);
        lid.add(new THREE.Mesh(new THREE.BoxGeometry(40, 4, 20).translate(0, 2, 10), olive));
        lid.add(new THREE.Mesh(new THREE.BoxGeometry(41, 1, 4).translate(0, 4.2, 10), trim));
        for (const s of [-1, 1]) root.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 13, 21).translate(s * 19, 6.5, 0), trim));
        root.add(body, band, lid);
        root.rotation.y = 0.15;
      } else if (def.kind === 'medkit') {
        root.add(new THREE.Mesh(new THREE.BoxGeometry(16, 8, 11).translate(0, 4, 0), white));
        root.add(new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 2.6).translate(0, 8.2, 0), red));
        root.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 9).translate(0, 8.2, 0), red));
      } else if (def.kind === 'keycard') {
        spin = new THREE.Group();
        spin.add(new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 7), card), new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3).translate(-3, 0, -1), dark));
        spin.position.y = 28;
        root.add(spin);
      } else if (def.kind === 'intel') {
        // D85 stealth: a confidential folder (amber), spinning like the key card
        spin = new THREE.Group();
        spin.add(new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 9), drive), new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 1.2).translate(0, 0, -2), white));
        spin.position.y = 28;
        root.add(spin);
      } else if (def.kind === 'drive') {
        spin = new THREE.Group();
        spin.add(new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 3.6), drive), new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.6).translate(6, 0, 0), trim));
        spin.position.y = 30;
        root.add(spin);
      }
      root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(root);
      return { def, root, lid, spin };
    });
    this.pickupGroup = g;
    this.scene.add(g);
  }

  _syncPickups(run, time) {
    for (let i = 0; i < this.pickupViews.length; i++) {
      const v = this.pickupViews[i], st = run.pickups[i];
      v.root.visible = !st.taken;
      if (v.lid) {
        const k = st.openedAt >= 0 ? Math.min(1, (time - st.openedAt) / 0.35) : 0;
        v.lid.rotation.x = -k * 1.9;
      }
      if (v.spin) { v.spin.rotation.y = time * 2.2; v.spin.position.y = (v.def.kind === 'drive' ? 30 : 28) + Math.sin(time * 3) * 2; }
    }
    const it = run.interactTarget;
    this.reachRing.visible = !!it;
    if (it) { this._flat(this.reachRing, it.def.x, it.def.y, (it.def.hidden ? 44 : 30) + Math.sin(time * 6) * 2, 1.2, 0.85); } // D88: round the chest prop
    // D90: the lesson's objects lit up (training ground) — instead of the area marker
    const hl = run.mode && run.mode.highlights && !run.over ? run.mode.highlights() : null;
    // D92: the level's pointed supplies (the office's SMG crate) — lit too, the objective marker stays
    const ptr = !run.over && run.pointers ? run.pointers() : null;
    this._syncHighlights(hl && hl.length ? (ptr && ptr.length ? hl.concat(ptr) : hl) : ptr, time);
    // objective marker over the current target (yellow chevron + ring)
    const t = hl && hl.length ? null : run.objectiveTarget(OBJ_PT);
    this.objMarker.visible = this.objRing.visible = !!t && !run.over;
    if (t) {
      this.objMarker.position.set(t.x, 70 + Math.sin(time * 3.2) * 4, t.y);
      this.objMarker.quaternion.copy(FACE_CAM);
      this._flat(this.objRing, t.x, t.y, 26 + (time * 18) % 14, 1.0, 0.65 - ((time * 18) % 14) / 30);
    }
  }

  /** D92: where a dead enemy falls — the first turn whose floor ahead is free (walls, doors, furniture), else a fade. */
  _planDeath(v, e, run) {
    v.deathOff = 0; v.deathFade = false;
    v.deathFace = e.faceAngle;
    const w = run.world;
    if (!w) return;
    for (const off of DEATH_TURNS) {
      const a = e.faceAngle + off + DEATH_DRIFT;
      if (w.segmentHit(e.x, e.y, e.x + Math.cos(a) * DEATH_FALL, e.y + Math.sin(a) * DEATH_FALL, DEATH_WIDE, null, BLOCK_MOVE) === Infinity) { v.deathOff = off; return; }
    }
    v.deathFade = run.modeId !== 'stealth'; // (stealth: the body must stay for the guards — no fade)
  }

  /** D92: a view's opacity (its own copy of the shared material, the same shader program); 0 hides it. */
  _fadeView(v, k) {
    if (k >= 0.999 && !v.fadeMat) return;
    if (!v.fadeMat) {
      const src = v.mesh.material, m = src.clone();
      m.onBeforeCompile = src.onBeforeCompile; // (the rim light: the same program as the shared material)
      m.transparent = true;
      v.mesh.material = m;
      v.fadeMat = m;
    }
    v.fadeMat.opacity = Math.max(0, Math.min(1, k));
    for (const g of Object.values(v.guns)) if (k < 0.6) g.visible = false;
    v.group.visible = v.group.visible && k > 0.01;
  }

  /** D90: frames / rings / chevrons over the highlighted objects (pulsing). */
  _syncHighlights(hl, time) {
    let bars = 0, rings = 0, arrows = 0, groundArrow = false;
    const pulse = 0.55 + 0.45 * Math.sin(time * 5), T = 2.2;
    if (hl) {
      for (const h of hl) {
        if (arrows >= MAX_HL) break;
        if (h.arrow) { // D92: the ground arrow (no chevron)
          const [x0, y0, x1, y1] = h.arrow, len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
          const g = this.hlGroundArrow, k = 0.5 + 0.5 * Math.sin(time * 4);
          g.visible = true;
          g.position.set((x0 + x1) / 2, 4, (y0 + y1) / 2);
          g.rotation.set(0, -a, 0);
          g.scale.set(len, 1, len * 0.42);
          g.material.opacity = 0.55 + 0.4 * k;
          groundArrow = true;
          continue;
        }
        let top = 34;
        if (h.r) {
          const ex = h.e ? this._lx(h.e) : h.x, ey = h.e ? this._ly(h.e) : h.y;
          const r = h.r + pulse * 3;
          P.set(ex, 1.7, ey); S.set(r, 1, r); M.compose(P, Q.identity(), S); this.hlRings.setMatrixAt(rings++, M);
          top = h.e && h.e.alive ? 80 : 30;
          P.set(ex, top + Math.sin(time * 3.2) * 3, ey);
        } else {
          const g = 4 + pulse * 2, w = h.w + g * 2, d = h.d + g * 2;
          for (const [cx, cz, sx, sz] of [[0, -d / 2, w + T, T], [0, d / 2, w + T, T], [-w / 2, 0, T, d], [w / 2, 0, T, d]]) {
            P.set(h.x + cx, 1.7, h.y + cz); S.set(sx, 1, sz); M.compose(P, Q.identity(), S); this.hlBars.setMatrixAt(bars++, M);
          }
          P.set(h.x, top + 20 + Math.sin(time * 3.2) * 3, h.y);
        }
        S.set(1, 1, 1); M.compose(P, FACE_CAM, S); this.hlArrows.setMatrixAt(arrows++, M);
      }
    }
    this.hlBars.count = bars; this.hlRings.count = rings; this.hlArrows.count = arrows;
    if (!groundArrow) this.hlGroundArrow.visible = false;
    for (const im of [this.hlBars, this.hlRings, this.hlArrows]) im.instanceMatrix.needsUpdate = true;
    this.hlBars.material.opacity = 0.55 + 0.4 * pulse;
  }

  // ---------------- level lifecycle ----------------
  /** Builds the level and returns the shader warm-up promise (no frames until it is ready). */
  loadMap(level, spawnX, spawnY) {
    this.unloadMap();
    this.map = level;
    // D93: the load's progress — the scene built (now), the shaders warmed, the textures arrived, the first frames drawn
    const ls = this.loadState = { t0: performance.now(), warmed: false, tex0: TEX.done, texWant: 0, frames: 0 };
    this.bodyYaw = undefined;
    this.gAimAt = undefined;
    this.shakeUntil = 0;
    this.lastSyncTime = 0;
    this.heroDeadAge = 0;
    const pr = QUALITY_PRESETS[this.quality];
    // D88: a level may bring its own light (the training ground is outdoors by day); else the night office
    const Lt = { ...LIGHTING, ...(level.lighting || {}) };
    this.hemi.intensity = Lt.hemi; this.sun.intensity = Lt.key; this.renderer.toneMappingExposure = Lt.exposure;
    this.hemi.color.set(Lt.sky ?? 0xc9d6ec); this.hemi.groundColor.set(Lt.ground ?? 0x2b2722); this.sun.color.set(Lt.sun ?? 0xffe6c8);
    this.scene.background.set(Lt.background ?? 0x07090d);
    this.office = buildOfficeScene(level, { aniso: pr.aniso, shadows: true });
    this.scene.add(this.office.group);
    this._buildPickups(level);
    // D85: the stealth run's view cones / suspicion bars / noise rings
    if (level.modeId === 'stealth' || level.modeId === 'tutorial') this.stealthOverlay = new StealthOverlay(this.scene, FACE_CAM, this.quality === 'low' ? 12 : 24); // D88: the tutorial's stealth yard
    this._resize(true);
    this.rig.snap(spawnX, spawnY, level.width, level.height);
    this._placeCamera();
    this.pausedDrawn = false;
    ls.texWant = TEX.started - ls.tex0; // (the scene's textures were asked for while it was built)
    return this.assetsReady.then(() => {
      if (this.map !== level) return null;
      this.hero = this._newView('hero', 0xffffff, 'pistol');
      return this._warmAll();
    }).then(() => { ls.warmed = true; });
  }

  /** Every material the level may show is compiled now (an enemy view per type, the guns), not on first sight. */
  _warmAll() {
    const warm = [];
    for (const type of ['thug', 'gunman', 'heavy']) { const v = this._enemyView({ id: -1 - warm.length, typeId: type, type: ENEMY_LOOK[type] }); if (v) warm.push(v); }
    for (const v of warm) for (const g of Object.values(v.guns)) g.visible = true;
    return this.guard.warmUp().then(() => { for (const v of warm) v.dispose(); });
  }

  unloadMap() {
    this.loadState = null; // D93
    if (this.stealthOverlay) { this.stealthOverlay.dispose(); this.stealthOverlay = null; }
    if (this.office) { this.scene.remove(this.office.group); this.office.dispose(); this.office = null; }
    if (this.pickupGroup) {
      this.scene.remove(this.pickupGroup);
      this.pickupGroup.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      this.pickupGroup = null;
    }
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    if (this.hero) { this.hero.dispose(); this.hero = null; }
    this.map = null;
  }

  /** D85: a noise of the run (event 'noise') → an expanding ring on the floor (stealth runs only). */
  noise(x, y, r) { if (this.stealthOverlay && this.map && this.map.modeId === 'stealth') this.stealthOverlay.addNoise(x, y, r, this.lastSyncTime); } // D90: not on the training ground

  busy() { return this.guard.busy(); }

  /**
   * D93: the level's load — progress 0…1 and whether it is ready to play (shaders warmed, no texture downloading,
   * two frames already on screen: the first frame uploads the textures and compiles what the warm-up missed).
   */
  loadProgress() {
    const ls = this.loadState;
    if (!ls) return { p: 1, ready: true };
    const pending = TEX.started - TEX.done, want = Math.max(1, ls.texWant), got = Math.max(0, want - pending);
    const t = (performance.now() - ls.t0) / 1000;
    const warm = ls.warmed ? 1 : Math.min(0.9, t / 2.5);            // (no real progress inside the warm-up: eased on time)
    const p = 0.1 + 0.45 * warm + 0.3 * Math.min(1, got / want) + 0.15 * Math.min(1, ls.frames / 2);
    return { p: Math.min(1, p), ready: ls.warmed && pending === 0 && ls.frames >= 2 };
  }

  // ---------------- quality (applied live, H5 3D guide §3) ----------------
  applyQuality(quality) {
    this.quality = quality;
    const pr = QUALITY_PRESETS[quality];
    this.pixelRatio = pr.maxPR;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    const sh = this.sun.shadow;
    if (sh.map) { sh.map.dispose(); sh.map = null; }
    this.renderer.shadowMap.enabled = pr.shadows;
    this.sun.castShadow = pr.shadows;
    sh.mapSize.set(pr.shadowSize, pr.shadowSize);
    this.blobs.visible = !pr.shadows || !pr.crowdShadows; // enemies without a real shadow get a soft blob
    this.heroBlob = !pr.shadows;
    if (this.hero) this._castShadow(this.hero);
    for (const v of this.views.values()) this._castShadow(v);
    setOfficeAnisotropy(pr.aniso);
    for (const mat of Object.values(this.mats)) mat.needsUpdate = true;
    for (const mat of Object.values(officeMaterials())) mat.needsUpdate = true;
    this.sizeDirty = true;
    this.pausedDrawn = false;
    return this.guard.warmUp();
  }

  // ---------------- sizing & camera ----------------
  _resize(force) {
    if (!this.sizeDirty && !force && this.sizeObserved) return;
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    if (!this.sizeDirty && !force && w === this.cssW && h === this.cssH) return;
    this.cssW = w;
    this.cssH = h;
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
    const sc = this.sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
    sc.updateProjectionMatrix();
  }

  _placeCamera(time = -1) {
    const d = distanceFor(this.rig.view.h);
    let x = this.rig.x, z = this.rig.y;
    if (time >= 0 && time < this.shakeUntil) {
      const k = Math.min(1, (this.shakeUntil - time) / this.shakeDur);
      x += Math.sin(time * 73) * this.shakeAmp * k;
      z += Math.cos(time * 61) * this.shakeAmp * k;
    }
    this.camera.position.set(x, d * Math.cos(TILT), z + d * Math.sin(TILT));
    this.camera.lookAt(x, 0, z);
    // D81: the shadow map moves in whole texels (shadow edges no longer crawl / flicker while the camera follows)
    const sh = this.sun.shadow, texel = (sh.camera.right - sh.camera.left) / Math.max(1, sh.mapSize.x);
    const r = x * SUN_X.x + z * SUN_X.z, u = x * SUN_Y.x + z * SUN_Y.z;
    const dr = Math.round(r / texel) * texel - r, du = Math.round(u / texel) * texel - u;
    const tx = x + SUN_X.x * dr + SUN_Y.x * du, ty = SUN_X.y * dr + SUN_Y.y * du, tz = z + SUN_X.z * dr + SUN_Y.z * du;
    this.sun.target.position.set(tx, ty, tz);
    this.sun.position.set(tx + SUN_DIR.x, ty + SUN_DIR.y, tz + SUN_DIR.z);
  }

  /** Client (CSS px) → ground point in world units. */
  screenToGround(clientX, clientY, out = {}) {
    if (!(this.cssW > 0)) this._resize(true);
    NDC.set(((clientX - this.viewLeft) / Math.max(1, this.cssW)) * 2 - 1, -((clientY - this.viewTop) / Math.max(1, this.cssH)) * 2 + 1);
    V.set(NDC.x, NDC.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const t = -this.camera.position.y / (V.y || -1e-6);
    out.x = this.camera.position.x + V.x * t;
    out.y = this.camera.position.z + V.z * t;
    return out;
  }

  /** World point (x, y on the ground, height h) → CSS px of the canvas. */
  projectToScreen(x, y, h, out = {}) {
    V.set(x, h, y).project(this.camera);
    out.x = ((V.x + 1) / 2) * this.viewW;
    out.y = ((1 - V.y) / 2) * this.viewH;
    return out;
  }

  get viewW() { return this.cssW > 0 ? this.cssW : this.canvas.clientWidth; }
  get viewH() { return this.cssH > 0 ? this.cssH : this.canvas.clientHeight; }

  // ---------------- frame ----------------
  /**
   * @param {import('../core/MissionRun.js').MissionRun} run
   * @param {number} frameDt real seconds since the last frame (camera smoothing, the hero's fall)
   * @param {number} time simulation clock (all animation reads it, so a pause freezes everything)
   */
  render(run, frameDt, time, paused, alpha = 1) {
    if (!run || !this.map || !this.hero || this.guard.busy()) return false;
    this._resize(false);
    this.frameDt = frameDt;
    const falling = !run.player.alive && this.heroDeadAge < 3;
    if (paused && this.pausedDrawn && !falling) return false;
    this.alpha = paused ? 1 : Math.min(1, Math.max(0, alpha));
    const p = run.player;
    // D95 (user: the aim drifted while leaning out): leaning out of the corner the camera stays on his spot in cover — the
    // cursor's ground point (the aim) does not slide with the lean, the shots go where he points
    const pk = p.peek, fx = pk ? pk.baseX : this._lx(p), fy = pk ? pk.baseY : this._ly(p);
    if (!paused || falling) this.rig.follow(fx, fy, frameDt, this.map.width, this.map.height);
    this._placeCamera(time);
    this._sync(run, time);
    this.renderer.render(this.scene, this.camera);
    if (this.loadState && this.loadState.warmed && TEX.started === TEX.done) this.loadState.frames++; // D93
    this.pausedDrawn = paused && !falling;
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
    this.adaptWindows = (this.adaptWindows || 0) + 1;
    const floor = QUALITY_PRESETS[this.quality].minPR;
    if (fps < 45 && this.pixelRatio > floor) {
      this.pixelRatio = Math.max(floor, this.pixelRatio - 0.25);
      this.sizeDirty = true;
    }
  }

  _lx(o) { return o.prevX === undefined ? o.x : o.prevX + (o.x - o.prevX) * this.alpha; }
  _ly(o) { return o.prevY === undefined ? o.y : o.prevY + (o.y - o.prevY) * this.alpha; }

  /** Is a ground point inside the camera view (+ margin)? Characters off screen skip their animation update. */
  _onScreen(x, y, margin = 140) {
    const v = this.rig.view;
    return Math.abs(x - this.rig.x) < v.w / 2 + margin && Math.abs(y - this.rig.y) < v.h / 2 + margin + 60;
  }

  _enemyView(e) {
    let v = this.views.get(e.id);
    if (!v) {
      const L = e.type;
      const key = enemyModelOf(this.map);
      v = this._newView(this.templates && this.templates[key] ? key : 'enemy', L.tint ?? 0xffffff, gunModelOf(e.gun ? e.gun.stats.id : 'enemy_rifle'), L.scale || 1, Math.abs(e.id));
      if (!v) return null;
      if (e.id >= 0) this.views.set(e.id, v);
    }
    return v;
  }

  _sync(run, time) {
    const p = run.player;
    const dt = Math.min(0.1, Math.max(0, time - this.lastSyncTime));
    this.lastSyncTime = time;
    const pr = QUALITY_PRESETS[this.quality];

    // ---- hero
    const tgt = Number.isFinite(p.bodyAngle) ? p.bodyAngle : p.aimAngle;
    if (this.bodyYaw === undefined || !p.alive) this.bodyYaw = this.bodyYaw ?? tgt;
    if (p.alive) this.bodyYaw += Math.atan2(Math.sin(tgt - this.bodyYaw), Math.cos(tgt - this.bodyYaw)) * Math.min(1, dt * 20);
    const hx = this._lx(p), hy = this._ly(p);
    const h = this.hero;
    h.setGun(gunModelOf(run.weapon.weaponId));
    const speed = p.alive ? Math.hypot(p.vx, p.vy) : 0;
    const moveDir = Math.atan2(p.vy, p.vx);
    const w = run.weapon;
    if (!p.alive) this.heroDeadAge += this.frameDt || 0; else this.heroDeadAge = 0;
    const gAim = run.grenadePreview.active;
    if (gAim && this.gAimAt === undefined) this.gAimAt = time;
    if (!gAim) this.gAimAt = undefined;
    h.update(p.alive ? dt : (this.frameDt || 0), {
      speed: p.dodging ? 0 : Math.min(speed, 200),
      moveRel: speed > 1 ? moveDir - this.bodyYaw : 0,
      aim: run.heroAiming,
      reload: w.reloading ? w.reloadProgress(time) : -1,
      reloadClip: pistolReloadOf(w.reloadStartedAt), // D84: one of the user's two pistol reloads, per reload
      hitAge: time - p.lastHitAt,
      deadAge: p.alive ? -1 : this.heroDeadAge,
      shotAge: time - w.lastShotAt,
      throwAim: gAim,
      throwAimAge: gAim ? time - this.gAimAt : 0,
      throwAge: time - run.grenades.lastThrowAt,
      dodge: p.dodging ? Math.min(1, Math.max(0, (time - p.dodgeStartAt) / Math.max(0.01, p.dodgeEndsAt - p.dodgeStartAt))) : -1, // D82: the roll clip
      dodgeClip: dodgeOf(p).clip,                                                                                                 // D83: which roll
      cover: p.alive && p.cover ? p.cover.kind : null,                                                                            // D83: cover poses
      crouch: p.alive && !p.cover && p.stance === 'crouch',                                                                        // D85: stealth crouch
      peek: p.alive && p.peek ? p.peek.k : 0,                                                                                       // D87: leaning out of the corner
      peekSide: p.peek ? p.peek.side : 0,                                                                                           // D90: +1 his right, −1 his left
      takedown: p.alive && p.takedown ? Math.min(1, Math.max(0, (time - p.takedown.t0) / STEALTH.takedown.duration)) : -1,         // D85: the takedown clip
      takedownFrom: STEALTH.takedown.clipFrom, takedownTo: STEALTH.takedown.clipTo,
    });
    // D90: in cover the model hugs the object (eased in / out; facing it to fire over low cover — no hug)
    const hugOn = p.alive && p.cover && !p.dodging && (p.cover.kind === 'high' || !run.heroAiming);
    const hug = hugOn ? (p.cover.kind === 'low' ? HUMAN_ANIM.coverHugLow : HUMAN_ANIM.coverHugHigh) : 0;
    const hk = Math.min(1, (this.frameDt || 0) * 12);
    this.hugX = (this.hugX || 0) + ((hugOn ? -p.cover.nx * hug : 0) - (this.hugX || 0)) * hk;
    this.hugY = (this.hugY || 0) + ((hugOn ? -p.cover.ny * hug : 0) - (this.hugY || 0)) * hk;
    h.group.position.set(hx + this.hugX, 0, hy + this.hugY);
    h.group.rotation.y = -(this.bodyYaw - h.aimYaw);
    if (h.xray) h.xray.visible = p.alive && !(this.map && this.map.noXray); // D86; D90: off where the level says so
    h.flash.visible = p.alive && time - w.lastShotAt >= 0 && time - w.lastShotAt < SHOT_FLASH;
    if (h.flash.visible) h.flash.rotation.x = (w.lastShotAt * 97.3) % (Math.PI * 2);

    // ---- enemies
    let bars = 0, alerts = 0, combats = 0, pools = 0, blobs = 0, mags = 0;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (const e of run.enemies) {
      seen.add(e.id);
      const v = this._enemyView(e);
      if (!v) continue;
      const ex = this._lx(e), ey = this._ly(e);
      const vis = this._onScreen(ex, ey);
      v.group.visible = vis;
      if (!e.alive && pools < MAX_POOLS && vis) {
        const age = time - e.deathAt, s = Math.min(1, Math.max(0, (age - 0.8) / 2.5)) * 34;
        if (s > 0.5) { P.set(ex + Math.cos(e.faceAngle) * 16, 0.5, ey + Math.sin(e.faceAngle) * 16); S.set(s, s, 1); M.compose(P, FLAT_X, S); this.pools.setMatrixAt(pools++, M); }
      }
      if (!e.alive && e.ammoDrop > 0 && mags < MAX_POOLS && vis && time - e.deathAt > 0.8) { // D88
        P.set(ex, 22 + Math.sin(time * 3 + e.id) * 2.5, ey); Q.setFromAxisAngle(UP, time * 2 + e.id); S.set(1, 1, 1);
        M.compose(P, Q, S); this.ammoMarks.setMatrixAt(mags++, M);
      }
      if (!vis) continue;
      const g = e.gun, ai = e.ai;
      const sp = e.alive ? Math.hypot(e.vx, e.vy) : 0;
      v.update(dt, {
        speed: sp,
        moveRel: sp > 1 ? Math.atan2(e.vy, e.vx) - e.faceAngle : 0,
        shotAge: time - g.lastShotAt,
        throwAge: Infinity,
        aim: e.alive && ai.mode === 'combat',
        reload: g.reloading ? Math.min(1, (time - g.reloadStartedAt) / Math.max(0.01, g.reloadEndsAt - g.reloadStartedAt)) : -1,
        reloadClip: pistolReloadOf(g.reloadStartedAt + e.id),
        hitAge: time - e.lastHitAt,
        deadAge: e.alive ? -1 : time - e.deathAt,
        busy: !!e.busy && e.alive && ai.mode === 'idle' && sp < 2, // D83: going through the files until alerted
      });
      // D92 (user: the dead must not fall through walls / furniture / the floor): the fall goes where there is room (a
      // turn of up to 90° eased in while he staggers); with no room he fades out right after the fall. Bodies no
      // longer sink through the floor before the run removes them — they fade (stealth: they stay, the guards find them)
      let yaw = e.faceAngle;
      if (!e.alive) {
        if (v.deathOff === undefined) this._planDeath(v, e, run);
        const age = time - e.deathAt;
        yaw += v.deathOff * smooth01(age / DEATH_TURN);
        let fade = v.deathFade ? 1 - smooth01((age - DEATH_FADE_AT) / DEATH_FADE) : 1;
        if (Number.isFinite(run.bodyFade)) fade = Math.min(fade, 1 - smooth01((age - (run.bodyFade - DEATH_FADE - 0.3)) / DEATH_FADE));
        this._fadeView(v, fade);
      }
      v.group.position.set(ex, 0, ey);
      v.group.rotation.y = -(yaw - v.aimYaw);
      v.flash.visible = e.alive && time - g.lastShotAt >= 0 && time - g.lastShotAt < SHOT_FLASH;
      if (v.flash.visible) v.flash.rotation.x = (g.lastShotAt * 91.7) % (Math.PI * 2);
      if (!e.alive) continue;
      const top = 62 * (e.type.scale || 1);
      if (e.hp < e.maxHp && bars < MAX_BARS) {
        const bw = 30, fill = Math.max(0, e.hp / e.maxHp), bz = ey - 4;
        P.set(ex, top + 4, bz); S.set(bw + 2, 4.5, 1); M.compose(P, FACE_CAM, S); this.hpBack.setMatrixAt(bars, M);
        P.set(ex - (bw * (1 - fill)) / 2, top + 4.3, bz + 0.2); S.set(Math.max(0.01, bw * fill), 3, 1); M.compose(P, FACE_CAM, S); this.hpFill.setMatrixAt(bars, M);
        bars++;
      }
      const icon = ai.mode === 'combat' && ai.sees ? this.iconCombat : (ai.mode === 'alert' || ai.mode === 'search' || (ai.mode === 'combat' && !ai.sees)) ? this.iconAlert : null;
      if (icon) {
        const n = icon === this.iconCombat ? combats++ : alerts++;
        if (n < MAX_BARS) { P.set(ex, top + 16 + Math.sin(time * 5 + e.id) * 1.5, ey); S.set(1, 1, 1); M.compose(P, FACE_CAM, S); icon.setMatrixAt(n, M); }
      }
      if (this.blobs.visible && blobs < MAX_BARS) { P.set(ex, 0.6, ey); S.set(36, 36, 1); M.compose(P, FLAT_X, S); this.blobs.setMatrixAt(blobs++, M); }
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { v.dispose(); this.views.delete(id); } // bodies removed by the run
    if (this.blobs.visible && this.heroBlob && p.alive) { P.set(hx, 0.6, hy); S.set(36, 36, 1); M.compose(P, FLAT_X, S); this.blobs.setMatrixAt(blobs++, M); }
    this.hpBack.count = this.hpFill.count = bars;
    this.iconAlert.count = Math.min(MAX_BARS, alerts);
    this.iconCombat.count = Math.min(MAX_BARS, combats);
    this.pools.count = pools;
    this.blobs.count = blobs;
    this.ammoMarks.count = mags;
    this.ammoMarks.instanceMatrix.needsUpdate = true;
    for (const im of [this.hpBack, this.hpFill, this.iconAlert, this.iconCombat, this.pools, this.blobs]) im.instanceMatrix.needsUpdate = true;

    // ---- level: doors, pickups, objective
    this.office.update(run);
    this._syncPickups(run, time);
    if (this.stealthOverlay) {
      // D87: the cones follow the drawn (interpolated) enemy, not the last simulation step
      const at = this._coneAt || (this._coneAt = { x: 0, y: 0 });
      this.stealthOverlay.sync(run, time, (x, y) => this._onScreen(x, y, 60), (e) => { at.x = this._lx(e); at.y = this._ly(e); return at; });
    }

    // ---- reticle (live cursor with this frame's camera)
    // D93 (mobile aim assist): the crosshair sits on the locked target (red while the trigger is held)
    const lock = run.autoFire && p.alive && run.autoAim.target;
    if (lock) {
      const L = lock, lx = L.prevX !== undefined ? this._lx(L) : L.x, ly = L.prevY !== undefined ? this._ly(L) : L.y;
      this.reticle.visible = true;
      this.reticle.position.set(lx, 1.4, ly);
      this.reticle.material.color.setHex(time - run.weapon.lastShotAt < 0.25 ? 0xff5a3c : 0xffe9c2);
      const s = 1.15 + 0.08 * Math.sin(time * 6); this.reticle.scale.set(s, 1, s);
    } else { this.reticle.visible = p.alive && p.hasAim && !run.autoFire; this.reticle.scale.set(1, 1, 1); this.reticle.material.color.setHex(0xffe9c2); }
    if (this.reticle.visible && !lock) {
      const a = this.aimClient && this.aimClient();
      if (a && a.active) { this.screenToGround(a.clientX, a.clientY, AIM_PT); this.reticle.position.set(AIM_PT.x, 1.4, AIM_PT.y); }
      else this.reticle.position.set(p.aimX, 1.4, p.aimY);
    }

    // ---- tracers
    let b = 0;
    for (const pr0 of run.projectiles.items) {
      if (!pr0.active || b >= MAX_BULLETS) continue;
      Q.setFromAxisAngle(UP, -pr0.angle);
      P.set(pr0.x, 41, pr0.y); S.setScalar(1);
      M.compose(P, Q, S);
      this.bullets.setColorAt(b, pr0.hostile ? ENEMY_TRACER : HERO_TRACER);
      this.bullets.setMatrixAt(b++, M);
    }
    this.bullets.count = b;
    this.bullets.instanceMatrix.needsUpdate = true;
    if (b > 0 && this.bullets.instanceColor) this.bullets.instanceColor.needsUpdate = true;

    this._syncGrenades(run, time);

    // ---- particles (decorative)
    const parts = run.particles.items;
    this._ensureParticleBuffers(parts.length);
    let k = 0;
    for (const q of parts) {
      if (!q.active) continue;
      const fade = q.life / q.maxLife;
      const c = rgbOf(q.color);
      this.particlePos[k * 3] = q.x; this.particlePos[k * 3 + 1] = 30 * fade + 4; this.particlePos[k * 3 + 2] = q.y;
      this.particleCol[k * 3] = c.r; this.particleCol[k * 3 + 1] = c.g; this.particleCol[k * 3 + 2] = c.b;
      k++;
    }
    this.particleGeo.setDrawRange(0, k);
    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;
    this.particles.visible = pr.particles > 0;
  }

  _syncGrenades(run, time) {
    const pv = run.grenadePreview, gs = run.grenades, p = run.player;
    this.aimDots.visible = this.aimRing.visible = pv.active;
    if (pv.active) {
      const G = GRENADES[gs.selected] || GRENADES.frag;
      this._flat(this.aimRing, pv.x, pv.y, G.radius, 1.5, 0.55 + 0.25 * Math.sin(time * 10));
      const n = GRENADE_RULES.previewDots, d = Math.hypot(pv.x - p.x, pv.y - p.y), H = GRENADE_RULES.arcHeight + d * 0.12;
      Q.identity(); S.setScalar(1);
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        P.set(p.x + (pv.x - p.x) * t, 40 + 4 * H * t * (1 - t) - 36 * t, p.y + (pv.y - p.y) * t);
        M.compose(P, Q, S);
        this.aimDots.setMatrixAt(i, M);
      }
      this.aimDots.count = n;
      this.aimDots.instanceMatrix.needsUpdate = true;
    }
    let k = 0;
    for (const g of gs.flying) {
      if (k >= 8) break;
      const t = Math.min(1, Math.max(0, (time - g.t0) / (g.t1 - g.t0)));
      const d = Math.hypot(g.x1 - g.x0, g.y1 - g.y0), H = GRENADE_RULES.arcHeight + d * 0.12;
      P.set(g.x0 + (g.x1 - g.x0) * t, 40 + 4 * H * t * (1 - t) - 34 * t, g.y0 + (g.y1 - g.y0) * t);
      Q.setFromAxisAngle(UP, time * 9); S.setScalar(1);
      M.compose(P, Q, S);
      this.grenadeMesh.setMatrixAt(k++, M);
    }
    this.grenadeMesh.count = k;
    this.grenadeMesh.visible = k > 0;
    if (k) this.grenadeMesh.instanceMatrix.needsUpdate = true;
    for (const r of this.blastRings) r.visible = false;
    let bi = 0;
    for (const bl of gs.blasts) {
      const f = (time - bl.at) / 0.45;
      if (f < 0 || f >= 1 || bi >= this.blastRings.length) continue;
      this._flat(this.blastRings[bi++], bl.x, bl.y, bl.r * (0.35 + 0.8 * f), 2.5, 0.95 * (1 - f));
    }
  }

  _flat(mesh, x, y, scale, h, opacity) {
    mesh.visible = true;
    mesh.position.set(x, h, y);
    mesh.scale.set(scale, 1, scale);
    mesh.material.opacity = opacity;
  }

  /** Light camera shake (explosions, hits on the hero). On the game clock — pause freezes it. */
  shake(amount, duration) {
    const t = this.lastSyncTime || 0;
    if (t + duration < this.shakeUntil && amount <= this.shakeAmp) return;
    this.shakeAmp = amount;
    this.shakeDur = duration;
    this.shakeUntil = t + duration;
  }

  /**
   * Level-select preview: a real top-down render of the level's 3D scene into a 2D canvas (off-screen, then copied).
   * @returns {HTMLCanvasElement|null}
   */
  renderMapPreview(level, size = 640) {
    if (this.guard.busy() || this.office) return null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f14);
    scene.add(new THREE.HemisphereLight(0xe2ebff, 0x2b2722, 1.7));
    const sun = new THREE.DirectionalLight(0xfff1de, 1.2);
    sun.position.set(level.width / 2 - 300, 1200, level.height / 2 + 500);
    sun.target.position.set(level.width / 2, 0, level.height / 2);
    scene.add(sun, sun.target);
    const office = buildOfficeScene(level, { aniso: 4, shadows: false });
    scene.add(office.group);
    const half = Math.max(level.width, level.height) / 2 * 0.86;
    const cx = level.width / 2 + 40, cz = level.height / 2 + 50;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 10, 4000);
    cam.position.set(cx, 1500, cz + 250);
    cam.lookAt(cx, 0, cz);
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
    this.sizeDirty = true;
    this.cssW = this.cssH = -1;
    office.dispose();
    this.pausedDrawn = false;
    return out;
  }

  /** Diagnostics for the debug overlay. */
  info() {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, pixelRatio: this.pixelRatio };
  }
}

/** D84: which of the user's two pistol reload clips a reload plays — from its start time (stable, presentation only). */
function pistolReloadOf(startedAt) {
  return (Math.floor((Number(startedAt) || 0) * 997) & 1) ? 'pReload' : 'pReload2';
}

/** Looks of the enemy types for the warm-up views (the run's enemies carry their own type). */
const ENEMY_LOOK = {
  thug: { tint: 0xffffff, scale: 1 },
  gunman: { tint: 0xc9d2e0, scale: 1 },
  heavy: { tint: 0x8c8f96, scale: 1.08 },
};

/** Merges simple indexed geometries (position / normal / uv) into one non-indexed geometry. */
function mergeSimple(list) {
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of flat) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/** The body texture from the GLB image, drawn at most `max` px (phones: 2048) — the file itself is unchanged. */
async function bodyTexture(blob, max) {
  if (!blob) return null;
  try {
    const probe = await createImageBitmap(blob);
    let bmp = probe;
    if (probe.width > max || probe.height > max) {
      const k = max / Math.max(probe.width, probe.height);
      bmp = await createImageBitmap(blob, { resizeWidth: Math.round(probe.width * k), resizeHeight: Math.round(probe.height * k), resizeQuality: 'high' });
      probe.close();
    }
    const tex = new THREE.Texture(bmp);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  } catch (e) {
    return blobTexture(blob);
  }
}
