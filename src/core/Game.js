// Game: owns the runtime (state machine, clock, loop, input, renderers) and exposes domain commands for the UI.
// The UI never changes state directly — it calls these commands.
// Rendering: the menus show the user's still picture (D81, #menuBg — no 3D flyover, nothing drawn per frame); a level
// run is drawn in top-down 3D by three.js (#world3d). KILL LIST (D78): story levels (data/levels) instead of the wave maps.
import { GameStateMachine, STATES } from './GameStateMachine.js';
import { GameClock } from './GameClock.js';
import { GameLoop } from './GameLoop.js';
import { Viewport } from '../platform/Viewport.js';
import { InputManager } from '../platform/InputManager.js';
import { Storage } from '../platform/StorageService.js';
import { Prefs } from '../platform/Prefs.js';
import { Renderer3D } from '../render3d/Renderer3D.js';
import { GameEvents } from './GameEvents.js';
import { MissionRun } from './MissionRun.js';
import { Progress } from './Progress.js';
import { createRunSeed } from './SeededRandom.js';
import { QUALITY_LEVELS, QUALITY_PRESETS, resolveAutoQuality } from '../config/settings.js';
import { getLevel, LEVELS } from '../data/levels/index.js';
import { AUTO_AIM } from '../data/player.js';
import { nextLevelId, isLastLevel, defaultLevelSelection } from '../systems/Campaign.js';
import { CHEATS } from '../config/constants.js';

export class Game {
  /** @param {HTMLCanvasElement} canvas2d input surface of the menus @param {HTMLCanvasElement} canvas3d level run */
  constructor(canvas2d, canvas3d) {
    this.sm = new GameStateMachine(STATES.BOOT);
    this.clock = new GameClock();
    const savedQuality = Prefs.getQuality() || 'auto';
    this.qualitySetting = savedQuality === 'auto' || QUALITY_LEVELS.includes(savedQuality) ? savedQuality : 'auto';
    this.quality = this._resolveQuality();
    this.viewport = new Viewport(canvas2d, () => QUALITY_PRESETS[this.quality].dprCap);
    this.input = new InputManager(this.viewport);
    this.renderer3d = null;
    try {
      this.renderer3d = new Renderer3D(canvas3d, this.quality);
      this.renderer3d.aimClient = () => this.input.aim; // live cursor / finger for the reticle (read-only)
      // D75: mobile auto fire — only at an enemy already on the screen (as of the last drawn frame; read-only)
      const r3 = this.renderer3d, pt = { x: 0, y: 0 }, inset = AUTO_AIM.viewInset;
      this.inView = (x, y) => {
        r3.projectToScreen(x, y, 16, pt);
        return pt.x >= inset && pt.x <= r3.viewW - inset && pt.y >= inset && pt.y <= r3.viewH - inset;
      };
    } catch (e) {
      console.error('WebGL renderer could not be created', e); // the menus keep working; a level cannot start
    }
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (a, fdt) => this.render(a, fdt) });
    this.loop.fpsCap = QUALITY_PRESETS[this.quality].fpsCap;

    this.presentationTime = 0;   // real time for menu decoration only (not simulation)
    /** @type {((run: MissionRun, time: number) => void) | null} set by main.js: called after every simulation step */
    this.onSimStep = null;
    this.selectedMapId = LEVELS[0].id;
    this.mapId = null;
    this.events = new GameEvents();  // presentation hooks: sound, particles, HUD
    this.run = null;                 // MissionRun of the current level attempt
    this.frameListeners = new Set();
    this.progress = new Progress();  // the only owner of the profile
    this.economy = this.progress;    // (legacy name read by a few UI parts: loadStatus)

    // Defeat / victory are reported once by the run; the profile is updated first, then the state changes.
    this.events.on('mapDefeat', () => {
      if (this.run) this.progress.recordLevelResult(this.run);
      this.sm.set(STATES.MAP_DEFEAT);
    });
    this.events.on('mapVictory', () => {
      if (this.run) this.progress.recordLevelResult(this.run);
      this.sm.set(STATES.MAP_VICTORY);
    });

    this.sm.onChange((next) => {
      if (next === STATES.RUNNING) this.input.clearPressed(); // edge presses made while frozen must not fire on resume
      if (next === STATES.PAUSED) this.input.releaseAll();
      if (next !== STATES.RUNNING && this.run) this.run.cancelGrenadeAim();
      if (next !== STATES.RUNNING) this.setTimeScale(1);
      if (this.renderer3d) this.renderer3d.pausedDrawn = false;
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
    if (this.renderer3d && this.renderer3d.busy()) return; // shaders compiling / context lost: the game waits
    this.clock.advance(dt);
    if (this.run) {
      this.run.autoFire = !!this.touchMode;              // D74: the mobile version shoots by itself
      this.run.autoAim.inView = this.inView || null;      // D75: at enemies on the screen only
      this.run.update(this.input, dt, this.clock.time);
      if (this.onSimStep) this.onSimStep(this.run, this.clock.time);
    }
  }

  // ---------------- presentation (reads state only) ----------------
  render(alpha, frameDt) {
    this.presentationTime += frameDt;
    if (this.sm.inMap && this.run && this.renderer3d) {
      this.renderer3d.render(this.run, frameDt, this.clock.time, !this.sm.is(STATES.RUNNING), alpha);
    } else {
      this.viewport.ensure(); // menus: the still picture is CSS (#menuBg); only the input surface follows the size
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

  /** Level select opens on the newest unlocked, not yet cleared level (H5 §11). */
  openMapSelect() {
    this.selectedMapId = defaultLevelSelection(this.progress.profile);
    return this.sm.set(STATES.MAP_SELECT);
  }

  backToMenu() { return this.sm.set(STATES.MAIN_MENU); }

  isMapUnlocked(id) { return this.progress.profile.unlockedLevels.includes(id); }

  isMapCleared(id) { return this.progress.profile.completedLevels.includes(id); }

  /** Test cheat (CHEATS): main menu logo tap → every level opens. @returns {boolean} something changed */
  cheatUnlockAllMaps() { return CHEATS && this.progress.cheatUnlockAll() > 0; }

  selectMap(id) { if (getLevel(id) && this.isMapUnlocked(id)) this.selectedMapId = id; }

  /** Starts the selected (unlocked) level with a fresh run. Guarded against a double start. */
  beginMap() {
    const level = getLevel(this.selectedMapId);
    if (!this.sm.is(STATES.MAP_SELECT) || !level || !this.renderer3d || !this.isMapUnlocked(level.id)) return false;
    return this._startRun(level);
  }

  /** CONTINUE after a victory (not the last level): back to level select with the next level selected. */
  continueCampaign() {
    if (!this.sm.is(STATES.MAP_VICTORY) || !this.run) return false;
    const next = nextLevelId(this.run.mapId);
    this.exitToMenu();
    this.selectedMapId = next && this.isMapUnlocked(next) ? next : defaultLevelSelection(this.progress.profile);
    return this.sm.set(STATES.MAP_SELECT);
  }

  /** Read-only summary of the finished level for the results screen (recording happened once already). */
  resultSummary() {
    const r = this.run;
    if (!r || !r.over) return null;
    return {
      won: r.victory, reason: r.defeat, mapId: r.mapId, mapNameKey: r.level.nameKey,
      time: r.stats.time, kills: r.stats.kills, shots: r.stats.shotsFired, hits: r.stats.hits,
      damageTaken: Math.round(r.stats.damageTaken), ghost: !r.stats.spotted,
      best: this.progress.profile.bestTimes[r.mapId] || 0,
      last: r.victory && isLastLevel(r.mapId),
    };
  }

  /** RETRY / PLAY AGAIN after the level is over: a completely fresh run of the same level. */
  retryMap() {
    const level = getLevel(this.mapId);
    if (!this.sm.mapOver || !level) return false;
    return this._startRun(level);
  }

  /** Game speed (1 = normal). Presentation-side controller, the simulation stays fixed-step. */
  setTimeScale(k) { this.loop.timeScale = Number.isFinite(k) && k > 0 ? Math.min(1, k) : 1; }

  /** G / the grenade button: arm a frag grenade (a second press puts it away). */
  armGrenade(type = 'frag') { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.armGrenade(type)); }

  /** Q / the HUD weapon block: the next carried weapon. */
  switchWeapon(id = null) { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.switchWeapon(id)); }

  /** E / the touch button / the label: open the crate in reach. */
  interact() { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.interact(this.clock.time)); }

  _startRun(level) {
    this.mapId = level.id;
    this.clock.reset();
    this._disposeRun();
    this.run = new MissionRun(level, createRunSeed(), this.events);
    this.run.particles.setQualityFactor(QUALITY_PRESETS[this.quality].particles);
    this.renderer3d.loadMap(level, this.run.player.x, this.run.player.y); // warm-up: no step until shaders are ready
    this.input.pointerMapper = (cx, cy, out) => this.renderer3d.screenToGround(cx, cy, out);
    this.input.releaseAll();
    this.loop.resetTiming();
    const ok = this.sm.set(STATES.RUNNING);
    if (ok) this.events.emit('mapStarted', level.id);
    return ok;
  }

  /** Pause from the level; resume returns there (02_SPEC §2, C3). */
  pause() { return this.sm.set(STATES.PAUSED); }

  resume() { return this.sm.set(STATES.RUNNING); }

  /** Leaves the level (after the exit confirmation). The run is discarded. */
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

  /** Pause → EXIT (confirmed): leave the level straight to level select, the same level stays selected. */
  exitToMapSelect() {
    const id = this.mapId;
    if (!this.exitToMenu()) return false;
    this.selectedMapId = id && this.isMapUnlocked(id) ? id : defaultLevelSelection(this.progress.profile);
    return this.sm.set(STATES.MAP_SELECT);
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
