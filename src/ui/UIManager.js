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

const SCREEN_BY_STATE = {
  BOOT: 'splash',
  TAP_TO_PLAY: 'splash',
  MAIN_MENU: 'menu',
  MAP_SELECT: 'mapSelect',
  RUNNING: 'game',
  PAUSED: 'game',
};

export class UIManager {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.settings = new SettingsView(game);
    this.openPopups = [];          // stack of open popup names (top = last)
    this.confirmKind = null;       // 'reset' | 'exit'
    this.confirmText = document.getElementById('confirmText');

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

  // ---------------- splash / TAP TO PLAY (H5 §1) ----------------
  runSplash() {
    const el = document.getElementById('screen-splash');
    const prompt = document.getElementById('tapPrompt');
    requestAnimationFrame(() => el.querySelectorAll('.fade').forEach((n) => n.classList.add('show')));
    setTimeout(() => {
      this.game.showTapToPlay();
      prompt.classList.add('show');
      el.classList.add('ready-tap');
    }, SPLASH_TAP_DELAY_MS);
    const enter = () => {
      if (!el.classList.contains('ready-tap')) return; // early tap = no-op
      el.removeEventListener('click', enter);
      AC.unlock();               // first real gesture unlocks audio
      Sfx.play('start');
      this.game.enterMainMenu();
      Music.start();             // once, on entering the main menu; never restarted
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

  /** Page hidden / focus lost / phone rotated: a real pause, the same path as the Pause button (H5 §5). */
  autoPause() {
    if (this.game.sm.is(STATES.RUNNING)) this.openSettings();
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
    Sfx.play('click'); // every tap gives feedback (H5 §14); click is a user gesture
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
    if (this.confirmKind) this.confirmText.textContent = T(this.confirmKind === 'reset' ? 'confirm.reset' : 'confirm.exit');
  }
}
