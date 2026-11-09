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
import { getDefense } from '../data/defenses.js';
import { shopPrice } from '../data/upgrades.js';
import { getGrenade, GRENADE_RULES } from '../data/grenades.js';
import { SaveManager } from './SaveManager.js';
import { Economy, REASON } from '../systems/Economy.js';
import { nextMapId, isLastMap, defaultMapSelection, campaignSummary } from '../systems/Campaign.js';
import { TutorialSystem } from '../systems/TutorialSystem.js';
import { CHEATS, CHEAT_COINS } from '../config/constants.js';

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
      this.renderer3d.aimClient = () => this.input.aim; // live cursor / finger for the reticle (read-only)
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
    // Permanent progression: the economy is the only owner of the PlayerProfile (saved after every change).
    this.economy = new Economy(new SaveManager(), this.events);
    this.resumeState = STATES.RUNNING; // where PAUSED returns to (RUNNING or SHOP_OPEN)

    // Defeat / victory are reported once by the MapRun; the state machine ignores repeats.
    // The profile is updated first, so the results / Congrats screen shown on the state change reads final numbers.
    this.events.on('mapDefeat', () => {
      if (this.run) this.economy.recordMapResult(this.run.mapId, false);
      this.sm.set(STATES.MAP_DEFEAT);
    });
    this.events.on('mapVictory', (mapId) => {
      this.economy.recordMapResult(mapId, true);
      this.sm.set(STATES.MAP_VICTORY);
    });
    // Rewards: the MapRun reports each kill / wave / map completion exactly once.
    this.events.on('killReward', (reward) => this.economy.grantKill(reward));
    this.events.on('coinReward', (amount) => this.economy.grantCoins(amount));

    this.tutorial = new TutorialSystem(this); // hints for the first map (D11 / D43)

    this.sm.onChange((next) => {
      // Edge presses made while the world was frozen must not fire on resume.
      if (next === STATES.RUNNING) this.input.clearPressed();
      if (next === STATES.PAUSED || next === STATES.SHOP_OPEN || next === STATES.CRATE_REWARD_OPEN || next === STATES.TUTORIAL) this.input.releaseAll();
      if (next !== STATES.RUNNING && this.run) this.run.cancelGrenadeAim(); // never thrown on resume
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
    // E: open the crate in reach, else the shop at the kiosk (prep / intermission) — top-level state changes.
    if (this.run && this.input.consumePressed('interact')) {
      if (this.run.canOpenCrate) { this.openCrate(); return; }
      if (this.run.canShop) { this.openShop(); return; }
    }
    if (this.run) this.run.update(this.input, dt, this.clock.time);
  }

  // ---------------- presentation (reads state only) ----------------
  render(alpha, frameDt) {
    this.presentationTime += frameDt;
    if (this.sm.inMap && this.run && this.renderer3d) {
      this.renderer3d.render(this.run, frameDt, this.clock.time, !this.sm.is(STATES.RUNNING), alpha);
    } else if (this.renderer3d && this.renderer3d.renderMenu(this.presentationTime, frameDt)) {
      document.body.classList.add('menu3d'); // D46: the 3D lighthouse scene is the menu backdrop
    } else {
      document.body.classList.remove('menu3d');
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

  /** Map select opens on the newest unlocked, not yet cleared map (H5 §11). */
  openMapSelect() {
    this.selectedMapId = defaultMapSelection(this.economy.profile);
    return this.sm.set(STATES.MAP_SELECT);
  }

  backToMenu() { return this.sm.set(STATES.MAIN_MENU); }

  isMapUnlocked(id) { return this.economy.profile.unlockedMaps.includes(id); }

  // ---------------- test cheats (constants.js → CHEATS = false in a release) ----------------
  /** Main menu logo tap: every map opens. @returns {boolean} something changed */
  cheatUnlockAllMaps() { return CHEATS && this.economy.cheatUnlockAllMaps() > 0; }

  /** Coin balance tap (HUD / shop): +CHEAT_COINS; the HUD shows the "+N" pop. */
  cheatCoins() {
    if (!CHEATS) return false;
    this.economy.grantCoins(CHEAT_COINS);
    this.events.emit('cheatCoins', CHEAT_COINS);
    return true;
  }

  selectMap(id) { if (getMap(id) && this.isMapUnlocked(id)) this.selectedMapId = id; }

  /** Starts the selected (unlocked) map with a fresh MapRun. Guarded against double start. */
  beginMap() {
    const map = getMap(this.selectedMapId);
    if (!this.sm.is(STATES.MAP_SELECT) || !map || !this.renderer3d || !this.isMapUnlocked(map.id)) return false;
    return this._startRun(map);
  }

  /** CONTINUE after a victory (not the last map): back to map select with the next map selected. */
  continueCampaign() {
    if (!this.sm.is(STATES.MAP_VICTORY) || !this.run) return false;
    const next = nextMapId(this.run.mapId);
    this.exitToMenu();
    this.selectedMapId = next && this.isMapUnlocked(next) ? next : defaultMapSelection(this.economy.profile);
    return this.sm.set(STATES.MAP_SELECT);
  }

  /**
   * Read-only summary of the finished map run for the results / Congrats screen. Rewards were already booked once
   * during the run — showing (or re-opening) this screen never grants anything.
   */
  resultSummary() {
    const r = this.run;
    if (!r || !r.over) return null;
    return {
      won: r.victory, reason: r.defeat, mapId: r.mapId, mapNameKey: r.map.nameKey,
      waves: r.stats.wavesCleared, wavesTotal: r.waves.total, kills: r.stats.kills,
      coins: r.rewards.coins, xp: r.rewards.xp, last: r.victory && isLastMap(r.mapId),
      campaign: campaignSummary(this.economy.profile),
    };
  }

  /** RETRY / PLAY AGAIN after the map is over: a completely fresh run of the same map (01_GDD §15). */
  retryMap() {
    const map = getMap(this.mapId);
    if (!this.sm.mapOver || !map) return false;
    return this._startRun(map);
  }

  /** Emergency Flare from the HUD button (desktop click); keyboard Q / touch go through the input actions. */
  useFlare() {
    if (!this.sm.is(STATES.RUNNING) || !this.run) return false;
    return this.run.useFlare(this.clock.time);
  }

  /** START NEXT WAVE (HUD): only while the map runs; the run ignores it outside the intro / intermission. */
  startNextWave() {
    if (!this.run) return false;
    if (this.sm.is(STATES.SHOP_OPEN)) { if (!this.run.betweenWaves) return false; this.closeShop(); } // from inside the shop
    if (!this.sm.is(STATES.RUNNING)) return false;
    return this.run.startNextWave(this.clock.time);
  }

  _startRun(map) {
    this.mapId = map.id;
    this.clock.reset();
    this._disposeRun();
    this.run = new MapRun(map, createRunSeed(), this.events, this.economy.loadout());
    this.run.particles.setQualityFactor(QUALITY_PRESETS[this.quality].particles);
    this.renderer3d.loadMap(map, this.run.player.x, this.run.player.y); // warm-up: no step until shaders are ready
    this.input.pointerMapper = (cx, cy, out) => this.renderer3d.screenToGround(cx, cy, out);
    this.input.releaseAll();
    this.loop.resetTiming();
    const ok = this.sm.set(STATES.RUNNING);
    if (ok) this.events.emit('mapStarted', map.id); // tutorial: the first hint (beacon)
    return ok;
  }

  /** Pause from the map or from the open shop; resume returns exactly there (02_SPEC §2, C3). */
  pause() {
    if ([STATES.RUNNING, STATES.SHOP_OPEN, STATES.CRATE_REWARD_OPEN, STATES.TUTORIAL].includes(this.sm.state)) this.resumeState = this.sm.state;
    return this.sm.set(STATES.PAUSED);
  }

  resume() {
    const back = [STATES.SHOP_OPEN, STATES.CRATE_REWARD_OPEN, STATES.TUTORIAL].includes(this.resumeState) ? this.resumeState : STATES.RUNNING;
    return this.sm.set(back);
  }

  // ---------------- crate (02_SPEC §14): the world is frozen until ONE perk is chosen ----------------
  openCrate() {
    if (!this.sm.is(STATES.RUNNING) || !this.run || !this.run.canOpenCrate) return false;
    if (!this.run.openCrate(this.clock.time)) return false;
    return this.sm.set(STATES.CRATE_REWARD_OPEN);
  }

  chooseCratePerk(id) {
    if (!this.sm.is(STATES.CRATE_REWARD_OPEN) || !this.run) return false;
    if (!this.run.choosePerk(id)) return false;
    return this.sm.set(STATES.RUNNING);
  }

  // ---------------- grenades (shop, one at a time, cap per type) ----------------
  grenadeOffer(type) {
    const G = getGrenade(type);
    const run = this.run;
    const o = { type, price: G ? shopPrice(G.price) : 0, requiredLevel: G ? G.requiredPlayerLevel : 1,
      stock: run ? run.grenades.stock[type] | 0 : 0, cap: GRENADE_RULES.capPerType, canBuy: false, reason: null };
    if (!G) o.reason = REASON.UNKNOWN;
    else if (!this.shopOpen || !run || !run.betweenWaves) o.reason = REASON.CLOSED;
    else if (this.economy.level < G.requiredPlayerLevel) o.reason = REASON.LEVEL;
    else if (o.stock >= o.cap) o.reason = 'cap';
    else if (this.economy.coins < o.price) o.reason = REASON.COINS;
    else o.canBuy = true;
    return o;
  }

  shopBuyGrenade(type) {
    const o = this.grenadeOffer(type);
    if (!o.canBuy) return { ok: false, reason: o.reason };
    if (!this.economy.spend(o.price)) return { ok: false, reason: REASON.COINS };
    this.run.grenades.add(type, 1);
    this.events.emit('purchase', 'grenade', type);
    return { ok: true };
  }

  /** HUD grenade slot tap / click: select a type that is in stock. */
  selectGrenade(type) { return !!(this.run && this.sm.is(STATES.RUNNING) && this.run.grenades.select(type)); }

  // ---------------- shop (02_SPEC §12): opening freezes the world and the intermission timer ----------------
  openShop() {
    if (!this.sm.is(STATES.RUNNING) || !this.run || !this.run.canShop) return false;
    return this.sm.set(STATES.SHOP_OPEN);
  }

  closeShop() { return this.sm.is(STATES.SHOP_OPEN) && this.sm.set(STATES.RUNNING); }

  get shopOpen() { return this.sm.is(STATES.SHOP_OPEN); }

  /** After a profile purchase/equip: the current run gets the new stats (between waves). */
  _afterProfileChange(result) {
    if (result.ok && this.run) this.run.applyLoadout(this.economy.loadout());
    return result;
  }

  shopBuyWeapon(id) { return this.shopOpen ? this._afterProfileChange(this.economy.buyWeapon(id)) : { ok: false, reason: REASON.CLOSED }; }

  shopEquipWeapon(id) { return this.shopOpen ? this._afterProfileChange(this.economy.equipWeapon(id)) : { ok: false, reason: REASON.CLOSED }; }

  shopBuyWeaponUpgrade(weaponId, nodeId) {
    return this.shopOpen ? this._afterProfileChange(this.economy.buyWeaponUpgrade(weaponId, nodeId)) : { ok: false, reason: REASON.CLOSED };
  }

  shopBuyPlayerUpgrade(id) { return this.shopOpen ? this._afterProfileChange(this.economy.buyPlayerUpgrade(id)) : { ok: false, reason: REASON.CLOSED }; }

  /** Defense device on a free pad for this map run: validate → debit (profile coins) → place. */
  shopBuyDefense(padIndex, defenseId) {
    const offer = this.defenseOffer(padIndex, defenseId);
    if (!offer.canBuy) return { ok: false, reason: offer.reason };
    if (!this.economy.spend(offer.price)) return { ok: false, reason: REASON.COINS };
    const placed = this.run.defenses.place(padIndex, defenseId, this.clock.time);
    if (!placed) { this.economy.grantCoins(offer.price); return { ok: false, reason: REASON.PAD_BUSY }; } // never lose coins
    this.events.emit('purchase', 'defense', defenseId, padIndex);
    return { ok: true };
  }

  /** Beacon repair to full (D40): validate → debit → repair. Not discounted (its price is set directly). */
  repairOffer() {
    const run = this.run;
    const cost = run ? run.beaconRepairCost() : 0;
    const o = { cost, canBuy: false, reason: null };
    if (!this.shopOpen || !run || !run.betweenWaves) o.reason = REASON.CLOSED;
    else if (cost <= 0) o.reason = 'full';
    else if (this.economy.coins < cost) o.reason = REASON.COINS;
    else o.canBuy = true;
    return o;
  }

  shopRepairBeacon() {
    const o = this.repairOffer();
    if (!o.canBuy) return { ok: false, reason: o.reason };
    return this._repairBeacon(o.cost);
  }

  /**
   * HUD repair button (D46): the same full repair at the same price, available any time while the map runs
   * (also during a wave), without going to the kiosk.
   */
  hudRepairOffer() {
    const run = this.run;
    const cost = run ? run.beaconRepairCost() : 0;
    const o = { cost, canBuy: false, reason: null };
    if (!run || run.over || !this.sm.is(STATES.RUNNING)) o.reason = REASON.CLOSED;
    else if (cost <= 0) o.reason = 'full';
    else if (this.economy.coins < cost) o.reason = REASON.COINS;
    else o.canBuy = true;
    return o;
  }

  hudRepairBeacon() {
    const o = this.hudRepairOffer();
    if (!o.canBuy) return { ok: false, reason: o.reason };
    return this._repairBeacon(o.cost);
  }

  _repairBeacon(cost) {
    if (!this.economy.spend(cost)) return { ok: false, reason: REASON.COINS };
    const b = this.run.beacon;
    b.repair(b.maxIntegrity - b.integrity);
    this.events.emit('purchase', 'repair', cost);
    return { ok: true };
  }

  defenseOffer(padIndex, defenseId) {
    const d = getDefense(defenseId);
    const pad = this.run && this.run.defenses.pads[padIndex];
    const o = { padIndex, defenseId, price: d ? shopPrice(d.price) : 0, canBuy: false, reason: null };
    if (!this.shopOpen || !this.run || !this.run.betweenWaves) o.reason = REASON.CLOSED;
    else if (!d || !pad) o.reason = REASON.UNKNOWN;
    else if (pad.device) o.reason = REASON.PAD_BUSY;
    else if (this.economy.coins < d.price) o.reason = REASON.COINS;
    else o.canBuy = true;
    return o;
  }

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

  /** Pause → EXIT (confirmed, D46): leave the map straight to map select, the same map stays selected. */
  exitToMapSelect() {
    const id = this.mapId;
    if (!this.exitToMenu()) return false;
    this.selectedMapId = id && this.isMapUnlocked(id) ? id : defaultMapSelection(this.economy.profile);
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
