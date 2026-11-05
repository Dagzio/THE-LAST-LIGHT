// Game: owns the runtime (state machine, clock, loop, viewport, input, renderer) and exposes
// domain commands for the UI. The UI never changes state directly — it calls these commands.
import { GameStateMachine, STATES } from './GameStateMachine.js';
import { GameClock } from './GameClock.js';
import { GameLoop } from './GameLoop.js';
import { Viewport } from '../platform/Viewport.js';
import { InputManager } from '../platform/InputManager.js';
import { Storage } from '../platform/StorageService.js';
import { Prefs } from '../platform/Prefs.js';
import { Renderer } from '../render/Renderer.js';
import { QUALITY_LEVELS, QUALITY_PRESETS, resolveAutoQuality } from '../config/settings.js';
import { WORLD_WIDTH, WORLD_HEIGHT, PROBE_SPEED } from '../config/constants.js';
import { getMap, MAPS } from '../data/maps.js';
import { clamp } from '../utils/MathUtils.js';

export class Game {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.sm = new GameStateMachine(STATES.BOOT);
    this.clock = new GameClock();
    const savedQuality = Prefs.getQuality() || 'auto';
    this.qualitySetting = savedQuality === 'auto' || QUALITY_LEVELS.includes(savedQuality) ? savedQuality : 'auto';
    this.quality = this._resolveQuality();
    this.viewport = new Viewport(canvas, () => QUALITY_PRESETS[this.quality].dprCap);
    this.input = new InputManager(this.viewport);
    this.renderer = new Renderer(canvas, this.viewport);
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (a, fdt) => this.render(a, fdt) });

    this.presentationTime = 0;   // real time for menu decoration only (not simulation)
    this.selectedMapId = MAPS[0].id;
    this.mapId = null;
    this.probe = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }; // Phase 1 runtime probe
    this._move = { x: 0, y: 0 };
    this._view = { scene: 'backdrop', realTime: 0, simTime: 0, quality: this.quality, mapSeed: 0, probe: null };
    this.frameListeners = new Set();

    this.sm.onChange((next) => {
      // Edge presses made while the world was frozen must not fire on resume.
      if (next === STATES.RUNNING) this.input.clearPressed();
      if (next === STATES.PAUSED) this.input.releaseAll();
    });
  }

  start() {
    this.input.attach();
    // Coming back from a hidden tab must not apply the accumulated time (04_ARCH §5).
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.loop.resetTiming(); });
    this.loop.start();
  }

  // ---------------- simulation ----------------
  update(dt) {
    if (!this.sm.simulating) return;
    this.clock.advance(dt);
    const m = this.input.getMove(this._move);
    this.probe.x = clamp(this.probe.x + m.x * PROBE_SPEED * dt, 0, WORLD_WIDTH);
    this.probe.y = clamp(this.probe.y + m.y * PROBE_SPEED * dt, 0, WORLD_HEIGHT);
  }

  // ---------------- presentation (reads state only) ----------------
  render(alpha, frameDt) {
    this.presentationTime += frameDt;
    this.viewport.ensure();
    const v = this._view;
    v.scene = this.sm.inMap ? 'arena' : 'backdrop';
    v.realTime = this.presentationTime;
    v.simTime = this.clock.time;
    v.quality = this.quality;
    v.mapSeed = this.mapId ? getMap(this.mapId).artSeed : 0;
    v.probe = this.sm.inMap ? this.probe : null;
    this.renderer.render(v);
    for (const fn of this.frameListeners) fn(frameDt);
  }

  onFrame(fn) { this.frameListeners.add(fn); return () => this.frameListeners.delete(fn); }

  // ---------------- quality ----------------
  _resolveQuality() { return this.qualitySetting === 'auto' ? resolveAutoQuality() : this.qualitySetting; }

  /** @param {'auto'|'low'|'medium'|'high'} setting */
  setQuality(setting) {
    if (setting !== 'auto' && !QUALITY_LEVELS.includes(setting)) return;
    this.qualitySetting = setting;
    this.quality = this._resolveQuality();
    Prefs.setQuality(setting);
    this.viewport.invalidate();
  }

  // ---------------- commands (called by UI) ----------------
  enterMainMenu() { return this.sm.set(STATES.MAIN_MENU); }

  showTapToPlay() { return this.sm.set(STATES.TAP_TO_PLAY); }

  openMapSelect() { return this.sm.set(STATES.MAP_SELECT); }

  backToMenu() { return this.sm.set(STATES.MAIN_MENU); }

  selectMap(id) { if (getMap(id)) this.selectedMapId = id; }

  /** Starts the selected map with a fresh run (Phase 1: empty arena). Guarded against double start. */
  beginMap() {
    if (!this.sm.is(STATES.MAP_SELECT) || !getMap(this.selectedMapId)) return false;
    this.mapId = this.selectedMapId;
    this.clock.reset();
    this.probe.x = WORLD_WIDTH / 2;
    this.probe.y = WORLD_HEIGHT / 2;
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
    this.clock.reset();
    return this.sm.set(STATES.MAIN_MENU);
  }

  /** H5 §10: erase all game data (settings stay) and restart as a first launch (splash → TAP TO PLAY). */
  resetProgress() {
    Storage.clearProgress();
    location.reload();
  }
}
