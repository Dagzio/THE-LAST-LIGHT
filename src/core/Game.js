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
import { levelModes, resolveLevel } from '../data/modes.js';
import { AUTO_AIM } from '../data/player.js';
import { AI_TUNING } from '../data/humans.js';
import { nextLevelId, isLastLevel, defaultLevelSelection, isLevelOpen } from '../systems/Campaign.js';
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
      // D82: enemies open fire only from the screen (the whole body inside, a little margin)
      const aiInset = AI_TUNING.onScreenInset;
      this.inViewAI = (x, y) => {
        r3.projectToScreen(x, y, 0, pt);
        if (pt.x < aiInset || pt.x > r3.viewW - aiInset || pt.y > r3.viewH - aiInset) return false;
        r3.projectToScreen(x, y, 56, pt);
        return pt.y >= aiInset;
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
    this._modeId = Prefs.getMode() || 'mission'; // D85: the last chosen mode (a UI preference)
    this.modeId = 'mission';
    this.mapId = null;
    this.events = new GameEvents();  // presentation hooks: sound, particles, HUD
    this.run = null;                 // MissionRun of the current level attempt
    this.dialogueOpen = false;       // D88: set by ui/DialogueView while a dialogue is on screen (no simulation step)
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
    if (!this.sm.simulating || this.dialogueOpen) return; // D88: a dialogue on screen — the game waits
    if (this.renderer3d && this.renderer3d.busy()) return; // shaders compiling / context lost: the game waits
    this.clock.advance(dt);
    if (this.run) {
      this.run.autoFire = !!this.touchMode;              // D74: the mobile version shoots by itself
      this.run.autoAim.inView = this.inView || null;      // D75: at enemies on the screen only
      this.run.ai.inView = this.inViewAI || null;         // D82: enemies fire only from the screen
      if (this.run.mode && 'inView' in this.run.mode) this.run.mode.inView = this.inViewAI || null; // D85: survival spawns off screen
      this.run.update(this.input, dt, this.clock.time);
      if (this.onSimStep) this.onSimStep(this.run, this.clock.time);
    }
  }

  // ---------------- presentation (reads state only) ----------------
  render(alpha, frameDt) {
    this.presentationTime += frameDt;
    if (this.sm.inMap && this.run && this.renderer3d) {
      this.renderer3d.render(this.run, frameDt, this.clock.time, !this.sm.is(STATES.RUNNING) || !!this.dialogueOpen, alpha);
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

  isMapUnlocked(id) { return isLevelOpen(this.progress.profile, getLevel(id)); } // D88 / D90

  isMapCleared(id) { return this.progress.profile.completedLevels.includes(id); }

  /** Test cheat (CHEATS): main menu logo tap → every level opens. @returns {boolean} something changed */
  cheatUnlockAllMaps() { return CHEATS && this.progress.cheatUnlockAll() > 0; }

  selectMap(id) { if (getLevel(id) && this.isMapUnlocked(id)) this.selectedMapId = id; }

  /** D85: the modes the selected level offers, and the chosen one (a UI preference, kept in Prefs). */
  availableModes(levelId = this.selectedMapId) { return levelModes(getLevel(levelId)); }

  get selectedModeId() {
    const modes = this.availableModes();
    return modes.includes(this._modeId) ? this._modeId : modes[0];
  }

  selectMode(modeId) {
    if (!this.availableModes().includes(modeId)) return false;
    this._modeId = modeId;
    Prefs.setMode(modeId);
    return true;
  }

  /** Starts the selected (unlocked) level with a fresh run in the selected mode. Guarded against a double start. */
  beginMap() {
    const level = getLevel(this.selectedMapId);
    if (!this.sm.is(STATES.MAP_SELECT) || !level || !this.renderer3d || !this.isMapUnlocked(level.id)) return false;
    return this._startRun(level, this.selectedModeId);
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
    const mb = (this.progress.profile.modeBests[r.mapId] || {})[r.modeId] || null;
    return {
      won: r.victory, reason: r.defeat, mapId: r.mapId, mapNameKey: r.level.nameKey, modeId: r.modeId,
      time: r.stats.time, kills: r.stats.kills, shots: r.stats.shotsFired, hits: r.stats.hits,
      damageTaken: Math.round(r.stats.damageTaken), ghost: !r.stats.spotted,
      best: r.modeId === 'mission' ? this.progress.profile.bestTimes[r.mapId] || 0 : mb ? mb.time : 0,
      last: r.victory && isLastLevel(r.mapId) && r.modeId !== 'survival',
      // D85: stealth — medals, intel, takedowns; survival — threat, best kills, a new record
      medals: r.modeId === 'stealth' && r.mode ? r.mode.medals() : null,
      intel: r.intel, intelTotal: r.level.pickups.filter((p) => p.kind === 'intel').length,
      takedowns: r.stats.takedowns || 0, threat: r.stats.threat || 0,
      bestKills: mb ? mb.kills || 0 : 0, newRecord: !!(this.progress.lastResult && this.progress.lastResult.run === r && this.progress.lastResult.newRecord),
    };
  }

  /** RETRY / PLAY AGAIN after the level is over: a completely fresh run of the same level (and mode). */
  retryMap() {
    const level = getLevel(this.mapId);
    if (!this.sm.mapOver || !level) return false;
    return this._startRun(level, this.modeId || 'mission');
  }

  /** Game speed (1 = normal). Presentation-side controller, the simulation stays fixed-step. */
  setTimeScale(k) { this.loop.timeScale = Number.isFinite(k) && k > 0 ? Math.min(1, k) : 1; }

  /** G / the grenade button: arm a frag grenade (a second press puts it away). */
  armGrenade(type = 'frag') { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.armGrenade(type)); }

  /** Q / the HUD weapon block: the next carried weapon. */
  switchWeapon(id = null) { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.switchWeapon(id)); }

  /** D83: the COVER button / the Q label: take the cover here, or leave it (Q itself goes through the input). */
  toggleCover() { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.toggleCover(this.clock.time)); }

  /** E / the touch button / the label: open the crate in reach. */
  interact() { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.interact(this.clock.time)); }

  _startRun(level, modeId = 'mission') {
    this.mapId = level.id;
    this.modeId = modeId;
    this.clock.reset();
    this._disposeRun();
    const resolved = resolveLevel(level, modeId); // D85: the level as the mode has it (same office, other job)
    this.run = new MissionRun(resolved, createRunSeed(), this.events);
    this.run.particles.setQualityFactor(QUALITY_PRESETS[this.quality].particles);
    this.renderer3d.loadMap(resolved, this.run.player.x, this.run.player.y); // warm-up: no step until shaders are ready
    this.input.pointerMapper = (cx, cy, out) => this.renderer3d.screenToGround(cx, cy, out);
    this.input.releaseAll();
    this.loop.resetTiming();
    document.body.dataset.mode = resolved.modeId; // D88: the training ground → 'tutorial'
    const ok = this.sm.set(STATES.RUNNING);
    if (ok) this.events.emit('mapStarted', level.id, modeId);
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
