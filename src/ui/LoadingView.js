// D93 (user: a level opened black with only the dialogue on it, the picture came later): the level's loading screen —
// the level's art, its name and mode, a progress bar (the renderer's load: scene, shaders, textures, first frames).
// It covers the whole game screen until the run starts (Game._pollLoading → 'mapStarted'), then fades out.
import { T } from '../i18n/i18n.js';
import { getLevel } from '../data/levels/index.js';
import { MODES } from '../data/modes.js';

export class LoadingView {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    const $ = (id) => document.getElementById(id);
    this.el = { root: $('levelLoading'), bg: $('llBg'), name: $('llName'), mode: $('llMode'), fill: $('llFill'), text: $('llText') };
    const ev = game.events;
    ev.on('mapLoading', (id, modeId) => this._show(id, modeId));
    ev.on('mapLoadProgress', (p) => this._progress(p));
    ev.on('mapStarted', () => this._hide());
    game.sm.onChange(() => { if (!game.sm.inMap) this._hide(true); });
  }

  _show(id, modeId) {
    const level = getLevel(id), mode = MODES[modeId], el = this.el;
    if (level && level.preview && el.bg.getAttribute('src') !== level.preview) el.bg.src = level.preview;
    el.name.textContent = level ? T(level.nameKey) : '';
    el.mode.textContent = mode && modeId !== 'tutorial' ? T(mode.nameKey) : '';
    el.text.textContent = T('load.level');
    this.shown = -1;
    this._progress(0);
    el.root.classList.remove('out');
    el.root.hidden = false;
    document.body.classList.add('level-loading');
  }

  _progress(p) {
    const v = Math.round(p * 100);
    if (v === this.shown) return;
    this.shown = v;
    this.el.fill.style.setProperty('--p', `${v}%`);
  }

  _hide(now = false) {
    const el = this.el;
    document.body.classList.remove('level-loading');
    if (el.root.hidden) return;
    if (now) { el.root.hidden = true; return; }
    el.root.classList.add('out');
    setTimeout(() => { if (el.root.classList.contains('out')) el.root.hidden = true; }, 380); // (UI fade, not game time)
  }
}
