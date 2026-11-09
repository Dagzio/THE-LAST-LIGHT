// UIManager: shows the screen for the current state, manages popups and routes button actions
// to Game commands. It never computes game rules and never touches storage directly.
import { STATES } from '../core/GameStateMachine.js';
import { T, applyTranslations, onLanguageChange } from '../i18n/i18n.js';
import { MAPS, getMap } from '../data/maps.js';
import { drawMapPreview } from '../render/MapPainter.js';
import { layoutProps } from '../systems/Props.js';
import { Sfx } from '../platform/Sfx.js';
import { Music } from '../platform/Music.js';
import { AC } from '../platform/AudioUnlock.js';
import { toggleFullscreen, initFullscreenButtons } from '../platform/Fullscreen.js';
import { SPLASH_TAP_DELAY_MS, CHEATS } from '../config/constants.js';
import { SettingsView } from './SettingsView.js';
import { ShopView } from './ShopView.js';
import { CrateView } from './CrateView.js';
import { ResultsView } from './ResultsView.js';
import { TutorialView } from './TutorialView.js';

const SCREEN_BY_STATE = {
  BOOT: 'splash',
  TAP_TO_PLAY: 'splash',
  MAIN_MENU: 'menu',
  MAP_SELECT: 'mapSelect',
  RUNNING: 'game',
  PAUSED: 'game',
  MAP_DEFEAT: 'game',
  MAP_VICTORY: 'game',
  SHOP_OPEN: 'game',
  CRATE_REWARD_OPEN: 'game',
  TUTORIAL: 'game',
};

const CONFIRM_TEXT = { reset: 'confirm.reset', exit: 'confirm.exit', skipTutorial: 'confirm.skipTutorial' };

const SAVE_NOTICE = { 'restored-backup': 'save.restored', 'reset-corrupt': 'save.reset', repaired: 'save.repaired' };

export class UIManager {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.settings = new SettingsView(game);
    this.shop = new ShopView(game);
    this.crate = new CrateView(game);
    this.toast = document.getElementById('toast');
    this.openPopups = [];          // stack of open popup names (top = last)
    this.confirmKind = null;       // 'reset' | 'exit'
    this.confirmText = document.getElementById('confirmText');
    this.results = new ResultsView(game);
    this.tutorialView = new TutorialView(game);

    document.addEventListener('click', (e) => this._onClick(e));
    document.body.classList.toggle('cheats', CHEATS); // makes the cheat taps reachable (styles/game.css)
    document.getElementById('confirmYes').addEventListener('click', () => this._confirm(true));
    document.getElementById('confirmNo').addEventListener('click', () => this._confirm(false));
    initFullscreenButtons([...document.querySelectorAll('[data-fs]')]);

    game.sm.onChange((state) => this._syncScreen(state));
    onLanguageChange(() => this._refreshDynamicText());
    this._buildMapCards();
    applyTranslations();
    this._syncScreen(game.sm.state);
  }

  // ---------------- splash / TAP TO PLAY (H5 §1 + 3D guide §7: only after 100% loaded) ----------------
  /** @param {{loaded: Promise<void>, shownAt: number}} boot */
  runSplash({ loaded, shownAt }) {
    const el = document.getElementById('screen-splash');
    const prompt = document.getElementById('tapPrompt');
    requestAnimationFrame(() => el.querySelectorAll('.fade').forEach((n) => n.classList.add('show')));
    loaded.then(() => {
      const wait = Math.max(250, SPLASH_TAP_DELAY_MS - (performance.now() - shownAt)); // 100% stays readable a moment
      setTimeout(() => {
        this.game.showTapToPlay();
        prompt.classList.add('show');
        el.classList.add('ready-tap');
      }, wait);
    });
    const enter = () => {
      if (!el.classList.contains('ready-tap')) return; // early tap = no-op
      el.removeEventListener('click', enter);
      AC.unlock();               // first real gesture unlocks audio
      Sfx.play('start');
      this.game.enterMainMenu();
      Music.start();             // once, on entering the main menu; never restarted
      const notice = SAVE_NOTICE[this.game.economy.loadStatus];
      if (notice) this.showToast(T(notice)); // damaged save: say what happened (02_SPEC §15)
    };
    el.addEventListener('click', enter);
  }

  // ---------------- screens ----------------
  _syncScreen(state) {
    const id = SCREEN_BY_STATE[state] || 'splash';
    if (document.body.dataset.screen !== id) {
      document.querySelectorAll('.screen.active').forEach((s) => s.classList.remove('active'));
      document.getElementById(`screen-${id}`).classList.add('active');
      document.body.dataset.screen = id;
    }
    document.body.classList.toggle('paused', state === STATES.PAUSED);
    const over = state === STATES.MAP_DEFEAT || state === STATES.MAP_VICTORY;
    document.body.classList.toggle('defeat', state === STATES.MAP_DEFEAT);
    document.body.classList.toggle('victory', state === STATES.MAP_VICTORY);
    document.body.classList.toggle('map-over', over);
    if (over) {
      this._closeAll();
      this.results.show();
    } else this.results.hide();
    if (state === STATES.MAP_SELECT) { this._rebuildMapCards(); this._refreshMapSelect(); }
  }

  // ---------------- popups (close only with their own button, H5 §4) ----------------
  _open(name) {
    const el = document.getElementById(`popup-${name}`);
    if (!el || el.classList.contains('show')) return;
    el.classList.add('show');
    this.openPopups.push(name);
  }

  _close(name) {
    const el = document.getElementById(`popup-${name}`);
    if (!el) return;
    el.classList.remove('show');
    this.openPopups = this.openPopups.filter((n) => n !== name);
    // Back to the game exactly as it was, only when nothing else is open.
    if (this.openPopups.length === 0 && this.game.sm.is(STATES.PAUSED)) this.game.resume();
  }

  _closeAll() {
    for (const name of [...this.openPopups]) document.getElementById(`popup-${name}`).classList.remove('show');
    this.openPopups = [];
  }

  openSettings() {
    const inGame = this.game.sm.inMap;
    if (inGame) this.game.pause();
    this.settings.prepare({ inGame });
    this._open('settings');
  }

  /** Page hidden / focus lost / phone rotated: a real pause, the same path as the Pause button (H5 §5, C3). */
  autoPause() {
    const sm = this.game.sm;
    if (sm.is(STATES.RUNNING) || sm.is(STATES.SHOP_OPEN) || sm.is(STATES.CRATE_REWARD_OPEN) || sm.is(STATES.TUTORIAL)) this.openSettings();
  }

  /** Short notice at the bottom (not a gameplay timer — presentation only). */
  showToast(text, ms = 5000) {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  _ask(kind) {
    this.confirmKind = kind;
    if (kind === 'exit' && this.game.sm.inMap) this.game.pause();
    this.confirmText.textContent = T(CONFIRM_TEXT[kind] || 'confirm.exit');
    this._open('confirm');
  }

  _confirm(yes) {
    const kind = this.confirmKind;
    this.confirmKind = null;
    if (!yes) { this._close('confirm'); return; }
    if (kind === 'reset') {
      this._closeAll();
      this.game.resetProgress();
    } else if (kind === 'exit') {
      this._closeAll();
      this.game.exitToMapSelect(); // D46: back to map select, not the main menu
    } else if (kind === 'skipTutorial') {
      this._close('confirm');
      this.game.tutorial.skip();
    }
  }

  // ---------------- actions ----------------
  _onClick(e) {
    // Test cheats (constants.js → CHEATS): handled before the button below (the HUD coin badge sits inside the shop button)
    const cheat = CHEATS && e.target.closest('[data-cheat]');
    if (cheat) { this._cheat(cheat.dataset.cheat); return; }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (!('nosfx' in btn.dataset)) Sfx.play('click'); // every tap gives feedback (H5 §14); gameplay buttons have own sounds
    const action = btn.dataset.action;
    switch (action) {
      case 'newGame': this.game.openMapSelect(); break;
      case 'backToMenu': this.game.backToMenu(); break;
      case 'beginMap': this.game.beginMap(); break;
      case 'openSettings': this.openSettings(); break;
      case 'closeSettings': this._close('settings'); break;
      case 'openCredits': this._open('credits'); break;
      case 'closeCredits': this._close('credits'); break;
      case 'askReset': this._ask('reset'); break;
      case 'askExit': this._ask('exit'); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'selectMap': this.game.selectMap(btn.dataset.mapId); this._refreshMapSelect(); break;
      case 'mapPrev': this._turnMap(-1); break;
      case 'mapNext': this._turnMap(1); break;
      case 'retryMap': this.game.retryMap(); break;
      case 'continueCampaign': this.game.continueCampaign(); break;
      case 'tutorialOk': this.game.tutorial.dismiss(); break;
      case 'skipTutorial': this._ask('skipTutorial'); break;
      case 'resultMenu': this.game.exitToMenu(); break; // the map is already over: nothing to lose, no confirmation
      case 'startNextWave': this.game.startNextWave(); break;
      case 'flare': this.game.useFlare(); break;
      case 'repairBeacon': Sfx.play(this.game.hudRepairBeacon().ok ? 'buy' : 'deny'); break; // D46: HUD wrench
      case 'openShop': if (!this.game.openShop()) Sfx.play('deny'); break; // glows only when it can open
      case 'closeShop': this.game.closeShop(); break;
      case 'openCrate': if (!this.game.openCrate()) Sfx.play('deny'); break;
      case 'selectGrenade': if (this.game.selectGrenade(btn.dataset.type)) Sfx.play('click'); else Sfx.play('deny'); break;
      default: break;
    }
  }

  _cheat(kind) {
    if (kind === 'maps' && this.game.sm.is(STATES.MAIN_MENU)) Sfx.play(this.game.cheatUnlockAllMaps() ? 'buy' : 'click');
    else if (kind === 'coins') Sfx.play(this.game.cheatCoins() ? 'buy' : 'deny');
  }

  // ---------------- map select: carousel (user decision D45) ----------------
  // One big card at a time, ◀ ▶ arrows, dots for the whole campaign. Unlocked maps can be chosen; the NEXT locked map
  // is shown as a dark card with a lock (the goal); later maps stay hidden (H5 §11: no list of locked content).
  _buildMapCards() {
    this.thumbs = new Map(); // map id → painted preview canvas (painted once)
    this.viewIndex = 0;      // index in MAPS of the card on screen
    this._rebuildMapCards();
  }

  /** Maps the carousel shows (D46): the whole campaign — locked maps are browsable, but dark with a lock. */
  _visibleMaps() { return MAPS; }

  /**
   * Card preview: the painted 2D version at once, then (next tick) a real top-down render of the map's 3D scene
   * drawn over it (D46). Both cached per map.
   */
  _thumb(map) {
    let c = this.thumbs.get(map.id);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = Math.min(640, Math.round(320 * Math.min(2, window.devicePixelRatio || 1)));
      drawMapPreview(c, map, layoutProps(map));
      this.thumbs.set(map.id, c);
      setTimeout(() => {
        const r3 = this.game.renderer3d;
        if (!r3 || this.game.sm.inMap) return;
        const img = r3.renderMapPreview(map, c.width);
        if (img) c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      }, 30);
    }
    return c;
  }

  /** Rebuilt when map select opens / the language changes: starts on the game's selected (unlocked) map. */
  _rebuildMapCards() {
    const sel = MAPS.findIndex((m) => m.id === this.game.selectedMapId);
    if (sel >= 0) this.viewIndex = sel;
    const dots = document.getElementById('mapDots');
    dots.replaceChildren();
    for (let i = 0; i < MAPS.length; i++) dots.appendChild(document.createElement('i'));
    this._showMapCard();
  }

  _turnMap(dir) {
    const vis = this._visibleMaps();
    const next = Math.max(0, Math.min(vis.length - 1, this.viewIndex + dir));
    if (next === this.viewIndex) return;
    this.viewIndex = next;
    const map = MAPS[next];
    if (this.game.isMapUnlocked(map.id)) this.game.selectMap(map.id);
    this._showMapCard();
  }

  _showMapCard() {
    const vis = this._visibleMaps();
    this.viewIndex = Math.max(0, Math.min(vis.length - 1, this.viewIndex));
    const map = MAPS[this.viewIndex];
    const profile = this.game.economy.profile;
    const locked = !profile.unlockedMaps.includes(map.id);
    const cleared = profile.completedMaps.includes(map.id);

    const grid = document.getElementById('mapGrid');
    const card = document.createElement('div');
    card.className = `map-card selected${locked ? ' locked' : ''}`;
    const name = document.createElement('span');
    name.className = 'map-card-name';
    name.textContent = T(map.nameKey);
    const num = document.createElement('span');
    num.className = 'map-card-num';
    num.textContent = String(this.viewIndex + 1);
    card.append(this._thumb(map), num, name);
    if (locked) {
      const lock = document.createElement('span');
      lock.className = 'map-card-lock';
      lock.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
      card.append(lock);
    } else if (cleared) {
      const badge = document.createElement('span');
      badge.className = 'map-card-badge';
      badge.textContent = T('map.cleared');
      card.append(badge);
    }
    grid.replaceChildren(card);
    // the name stays on one line: long names / languages shrink (H5: shrink, never wrap a label)
    name.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(name).fontSize);
    while (fs > 13 && name.scrollWidth > name.clientWidth + 1) { fs -= 1; name.style.fontSize = `${fs}px`; }

    // arrows + dots
    document.querySelector('[data-action="mapPrev"]').disabled = this.viewIndex <= 0;
    document.querySelector('[data-action="mapNext"]').disabled = this.viewIndex >= vis.length - 1;
    const dots = document.getElementById('mapDots').children;
    for (let i = 0; i < dots.length; i++) {
      const m = MAPS[i];
      dots[i].className = [
        i === this.viewIndex ? 'on' : '',
        profile.completedMaps.includes(m.id) ? 'cleared' : profile.unlockedMaps.includes(m.id) ? 'open' : '',
      ].join(' ');
    }

    // info panel + BEGIN
    const state = document.getElementById('mapState');
    const prev = MAPS[this.viewIndex - 1];
    state.textContent = locked ? T('map.stateLocked', { map: prev ? T(prev.nameKey) : '' }) : T(cleared ? 'map.stateCleared' : 'map.stateNew');
    state.classList.toggle('cleared', cleared);
    state.classList.toggle('locked', locked);
    document.getElementById('mapName').textContent = T(map.nameKey);
    document.getElementById('mapDesc').textContent = T(map.descKey);
    document.getElementById('mapWaves').textContent = T('map.waves', { n: map.waveCount });
    document.getElementById('mapBoss').textContent = T(map.finalWaveBoss ? 'map.boss' : 'map.elite');
    document.querySelector('[data-action="beginMap"]').disabled = locked;
  }

  _refreshMapSelect() { this._showMapCard(); }

  _refreshDynamicText() {
    this._showMapCard(); // keeps the card on screen (also a locked one) — only its texts change
    if (this.confirmKind) this.confirmText.textContent = T(CONFIRM_TEXT[this.confirmKind] || 'confirm.exit');
  }
}
