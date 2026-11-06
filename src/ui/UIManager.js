// UIManager: shows the screen for the current state, manages popups and routes button actions
// to Game commands. It never computes game rules and never touches storage directly.
import { STATES } from '../core/GameStateMachine.js';
import { T, applyTranslations, onLanguageChange } from '../i18n/i18n.js';
import { MAPS, getMap } from '../data/maps.js';
import { Renderer } from '../render/Renderer.js';
import { Sfx } from '../platform/Sfx.js';
import { Music } from '../platform/Music.js';
import { AC } from '../platform/AudioUnlock.js';
import { toggleFullscreen, initFullscreenButtons } from '../platform/Fullscreen.js';
import { SPLASH_TAP_DELAY_MS } from '../config/constants.js';
import { SettingsView } from './SettingsView.js';
import { ShopView } from './ShopView.js';

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
};

const SAVE_NOTICE = { 'restored-backup': 'save.restored', 'reset-corrupt': 'save.reset', repaired: 'save.repaired' };

export class UIManager {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.settings = new SettingsView(game);
    this.shop = new ShopView(game);
    this.toast = document.getElementById('toast');
    this.openPopups = [];          // stack of open popup names (top = last)
    this.confirmKind = null;       // 'reset' | 'exit'
    this.confirmText = document.getElementById('confirmText');
    this.resultTitle = document.getElementById('resultTitle');
    this.resultRetry = document.getElementById('resultRetry');

    document.addEventListener('click', (e) => this._onClick(e));
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
      this._refreshResultText();
    }
  }

  _refreshResultText() {
    const sm = this.game.sm;
    if (!sm.mapOver) return;
    const victory = sm.is(STATES.MAP_VICTORY);
    const reason = this.game.run && this.game.run.defeat;
    this.resultTitle.textContent = T(victory ? 'victory.title' : reason === 'player' ? 'defeat.player' : 'defeat.beacon');
    this.resultRetry.textContent = T(victory ? 'victory.again' : 'defeat.retry');
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
    if (this.game.sm.is(STATES.RUNNING) || this.game.sm.is(STATES.SHOP_OPEN)) this.openSettings();
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
    this.confirmText.textContent = T(kind === 'reset' ? 'confirm.reset' : 'confirm.exit');
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
      this.game.exitToMenu();
    }
  }

  // ---------------- actions ----------------
  _onClick(e) {
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
      case 'retryMap': this.game.retryMap(); break;
      case 'resultMenu': this.game.exitToMenu(); break; // the map is already over: nothing to lose, no confirmation
      case 'startNextWave': this.game.startNextWave(); break;
      case 'flare': this.game.useFlare(); break;
      case 'openShop': if (!this.game.openShop()) Sfx.play('deny'); break; // glows only when it can open
      case 'closeShop': this.game.closeShop(); break;
      default: break;
    }
  }

  // ---------------- map select ----------------
  _buildMapCards() {
    const grid = document.getElementById('mapGrid');
    for (const map of MAPS) {
      const card = document.createElement('button');
      card.className = 'map-card';
      card.dataset.action = 'selectMap';
      card.dataset.mapId = map.id;
      const thumb = document.createElement('canvas');
      thumb.width = 320;
      thumb.height = 320;
      Renderer.drawMapThumb(thumb, map.artSeed);
      const name = document.createElement('span');
      name.className = 'map-card-name';
      name.dataset.i18n = map.nameKey;
      card.append(thumb, name);
      grid.appendChild(card);
    }
    this._refreshMapSelect();
  }

  _refreshMapSelect() {
    const map = getMap(this.game.selectedMapId);
    document.querySelectorAll('.map-card').forEach((c) => c.classList.toggle('selected', c.dataset.mapId === map.id));
    document.getElementById('mapName').textContent = T(map.nameKey);
    document.getElementById('mapDesc').textContent = T(map.descKey);
    document.getElementById('mapWaves').textContent = T('map.waves', { n: map.waveCount });
    document.getElementById('mapBoss').textContent = map.finalWaveBoss ? T('map.boss') : '';
    document.getElementById('mapBoss').hidden = !map.finalWaveBoss;
  }

  _refreshDynamicText() {
    this._refreshMapSelect();
    this._refreshResultText();
    if (this.confirmKind) this.confirmText.textContent = T(this.confirmKind === 'reset' ? 'confirm.reset' : 'confirm.exit');
  }
}
