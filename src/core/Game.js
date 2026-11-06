// Game: owns the runtime (state machine, clock, loop, input, renderers) and exposes domain commands for the UI.
// The UI never changes state directly — it calls these commands.
// Rendering: menus use the 2D canvas backdrop (#world); a map run is drawn in top-down 3D by three.js (#world3d).
import { GameStateMachine, STATES } from './GameStateMachine.js';
import { GameClock } from './GameClock.js';
import { GameLoop } from './GameLoop.js';
import { Viewport } from '../platform/Viewport.js';
import { InputManager } from '../platform/InputManager.js';
import { Storage } from '../platform/StorageService.js';
import { Prefs } from '../platform/Prefs.js';
import { Renderer } from '../render/Renderer.js';
import { Renderer3D } from '../render3d/Renderer3D.js';
import { GameEvents } from './GameEvents.js';
import { MapRun } from './MapRun.js';
import { createRunSeed } from './SeededRandom.js';
import { QUALITY_LEVELS, QUALITY_PRESETS, resolveAutoQuality } from '../config/settings.js';
import { getMap, MAPS } from '../data/maps.js';

export class Game {
  /** @param {HTMLCanvasElement} canvas2d menu backdrop @param {HTMLCanvasElement} canvas3d map run */
  constructor(canvas2d, canvas3d) {
    this.sm = new GameStateMachine(STATES.BOOT);
    this.clock = new GameClock();
    const savedQuality = Prefs.getQuality() || 'auto';
    this.qualitySetting = savedQuality === 'auto' || QUALITY_LEVELS.includes(savedQuality) ? savedQuality : 'auto';
    this.quality = this._resolveQuality();
    this.viewport = new Viewport(canvas2d, () => QUALITY_PRESETS[this.quality].dprCap);
    this.input = new InputManager(this.viewport);
    this.renderer = new Renderer(canvas2d, this.viewport);
    this.renderer3d = null;
    try {
      this.renderer3d = new Renderer3D(canvas3d, this.quality);
    } catch (e) {
      console.error('WebGL renderer could not be created', e); // the menus keep working; a map cannot start
    }
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (a, fdt) => this.render(a, fdt) });
    this.loop.fpsCap = QUALITY_PRESETS[this.quality].fpsCap;

    this.presentationTime = 0;   // real time for menu decoration only (not simulation)
    this.selectedMapId = MAPS[0].id;
    this.mapId = null;
    this.events = new GameEvents();  // presentation hooks: sound, particles, HUD
    this.run = null;                 // MapRun of the current map attempt
    this._view = { scene: 'backdrop', realTime: 0, simTime: 0, quality: this.quality };
    this.frameListeners = new Set();
    // Defeat / victory are reported once by the MapRun; the state machine ignores repeats.
    this.events.on('mapDefeat', () => this.sm.set(STATES.MAP_DEFEAT));
    this.events.on('mapVictory', () => this.sm.set(STATES.MAP_VICTORY));

    this.sm.onChange((next) => {
      // Edge presses made while the world was frozen must not fire on resume.
      if (next === STATES.RUNNING) this.input.clearPressed();
      if (next === STATES.PAUSED) this.input.releaseAll();
      if (this.renderer3d) this.renderer3d.pausedDrawn = false; // redraw once with the new overlay state
    });
  }

  start() {
    this.input.attach();
    // Coming back from a hidden tab must not apply the accumulated time (04_ARCH §5).
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.loop.resetTiming(); });
    this.loop.start();
  }

  get canPlay() { return !!this.renderer3d; }

  // ---------------- simulation ----------------
  update(dt) {
    if (!this.sm.simulating) return;
    // Shaders still compiling or the WebGL context is lost: the game waits (H5 3D guide §5.3).
    if (this.renderer3d && this.renderer3d.busy()) return;
    this.clock.advance(dt);
    if (this.run) this.run.update(this.input, dt, this.clock.time);
  }

  // ---------------- presentation (reads state only) ----------------
  render(alpha, frameDt) {
    this.presentationTime += frameDt;
    if (this.sm.inMap && this.run && this.renderer3d) {
      this.renderer3d.render(this.run, frameDt, this.clock.time, !this.sm.is(STATES.RUNNING));
    } else {
      this.viewport.ensure();
      const v = this._view;
      v.realTime = this.presentationTime;
      v.simTime = this.clock.time;
      v.quality = this.quality;
      this.renderer.render(v);
    }
    for (const fn of this.frameListeners) fn(frameDt);
  }

  onFrame(fn) { this.frameListeners.add(fn); return () => this.frameListeners.delete(fn); }

  // ---------------- quality ----------------
  _resolveQuality() { return this.qualitySetting === 'auto' ? resolveAutoQuality() : this.qualitySetting; }

  /** @param {'auto'|'low'|'medium'|'high'} setting — applied live, the run continues */
  setQuality(setting) {
    if (setting !== 'auto' && !QUALITY_LEVELS.includes(setting)) return;
    this.qualitySetting = setting;
    const prev = this.quality;
    this.quality = this._resolveQuality();
    Prefs.setQuality(setting);
    this.viewport.invalidate();
    this.loop.fpsCap = QUALITY_PRESETS[this.quality].fpsCap;
    if (this.run) this.run.particles.setQualityFactor(QUALITY_PRESETS[this.quality].particles);
    if (this.renderer3d && prev !== this.quality) this.renderer3d.applyQuality(this.quality);
  }

  // ---------------- commands (called by UI) ----------------
  enterMainMenu() { return this.sm.set(STATES.MAIN_MENU); }

  showTapToPlay() { return this.sm.set(STATES.TAP_TO_PLAY); }

  openMapSelect() { return this.sm.set(STATES.MAP_SELECT); }

  backToMenu() { return this.sm.set(STATES.MAIN_MENU); }

  selectMap(id) { if (getMap(id)) this.selectedMapId = id; }

  /** Starts the selected map with a fresh MapRun. Guarded against double start. */
  beginMap() {
    const map = getMap(this.selectedMapId);
    if (!this.sm.is(STATES.MAP_SELECT) || !map || !this.renderer3d) return false;
    return this._startRun(map);
  }

  /** RETRY / PLAY AGAIN after the map is over: a completely fresh run of the same map (01_GDD §15). */
  retryMap() {
    const map = getMap(this.mapId);
    if (!this.sm.mapOver || !map) return false;
    return this._startRun(map);
  }

  /** START NEXT WAVE (HUD): only while the map runs; the run ignores it outside the intro / intermission. */
  startNextWave() {
    if (!this.sm.is(STATES.RUNNING) || !this.run) return false;
    return this.run.startNextWave(this.clock.time);
  }

  _startRun(map) {
    this.mapId = map.id;
    this.clock.reset();
    this._disposeRun();
    this.run = new MapRun(map, createRunSeed(), this.events);
    this.run.particles.setQualityFactor(QUALITY_PRESETS[this.quality].particles);
    this.renderer3d.loadMap(map, this.run.player.x, this.run.player.y); // warm-up: no step until shaders are ready
    this.input.pointerMapper = (cx, cy, out) => this.renderer3d.screenToGround(cx, cy, out);
    this.input.releaseAll();
    this.loop.resetTiming();
    return this.sm.set(STATES.RUNNING);
  }

  pause() { return this.sm.set(STATES.PAUSED); }

  resume() { return this.sm.set(STATES.RUNNING); }

  /** Leaves the map (after the exit confirmation). The map run is discarded. */
  exitToMenu() {
    if (!this.sm.inMap) return false;
    this.mapId = null;
    this._disposeRun();
    if (this.renderer3d) this.renderer3d.unloadMap();
    this.input.pointerMapper = null;
    this.clock.reset();
    this.viewport.invalidate();
    return this.sm.set(STATES.MAIN_MENU);
  }

  _disposeRun() {
    if (this.run) this.run.dispose();
    this.run = null;
  }

  /** H5 §10: erase all game data (settings stay) and restart as a first launch (splash → TAP TO PLAY). */
  resetProgress() {
    Storage.clearProgress();
    location.reload();
  }
}
