// Settings panel (Underlords tabs: GAME / VIDEO / AUDIO / LANGUAGE). In the game scene it is the pause popup.
// The view only displays settings and calls commands; it holds no game rules.
import { T, getLang, setLang, onLanguageChange } from '../i18n/i18n.js';
import { LANGS, LANG_NAMES } from '../i18n/locales.js';
import { QUALITY_LEVELS } from '../config/settings.js';
import { BUILD_VERSION } from '../config/constants.js';
import { Sfx } from '../platform/Sfx.js';
import { Music } from '../platform/Music.js';

export class SettingsView {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('popup-settings');
    this.tabs = [...this.root.querySelectorAll('.tab')];
    this.pages = [...this.root.querySelectorAll('.tab-page')];
    this.soundBtn = document.getElementById('toggleSound');
    this.musicBtn = document.getElementById('toggleMusic');
    this.autoBtn = document.getElementById('qualityAuto');
    this.slider = document.getElementById('qualitySlider');
    this.qualityName = document.getElementById('qualityName');
    this.langGrid = document.getElementById('langGrid');
    this.buildLabel = document.getElementById('buildLabel');
    this.current = 'audio';

    this.tabs.forEach((tab) => tab.addEventListener('click', () => this.showTab(tab.dataset.tab)));
    this.soundBtn.addEventListener('click', () => { Sfx.set(!Sfx.on); this.refresh(); });
    this.musicBtn.addEventListener('click', () => { Music.set(!Music.on); this.refresh(); });
    this.autoBtn.addEventListener('click', () => {
      const auto = this.game.qualitySetting === 'auto';
      this.game.setQuality(auto ? this.game.quality : 'auto');
      this.refresh();
    });
    this._buildLanguageList();
    this._bindSlider();
    onLanguageChange(() => this.refresh());
  }

  /** @param {{inGame:boolean}} opts */
  prepare({ inGame }) {
    // GAME tab (reset progress) only from the main menu.
    const gameTab = this.tabs.find((t) => t.dataset.tab === 'game');
    gameTab.hidden = inGame;
    this.showTab(inGame && this.current === 'game' ? 'audio' : this.current);
    this.refresh();
  }

  showTab(name) {
    this.current = name;
    this.tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    this.pages.forEach((p) => p.classList.toggle('active', p.dataset.page === name));
  }

  refresh() {
    this.soundBtn.setAttribute('aria-checked', Sfx.on ? 'true' : 'false');
    this.musicBtn.setAttribute('aria-checked', Music.on ? 'true' : 'false');
    const auto = this.game.qualitySetting === 'auto';
    this.autoBtn.setAttribute('aria-checked', auto ? 'true' : 'false');
    const idx = QUALITY_LEVELS.indexOf(this.game.quality);
    const k = idx / (QUALITY_LEVELS.length - 1);
    this.slider.style.setProperty('--p', `${k * 100}%`); // fill (share of the track)
    this.slider.style.setProperty('--k', String(k));     // thumb (kept inside the slider box)
    this.slider.setAttribute('aria-valuenow', String(idx));
    this.slider.classList.toggle('disabled', auto);
    this.qualityName.textContent = T(`quality.${this.game.quality}`);
    this.buildLabel.textContent = T('settings.build', { v: BUILD_VERSION });
    const lang = getLang();
    this.langGrid.querySelectorAll('.lang-item').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  }

  _buildLanguageList() {
    for (const lang of LANGS) {
      const b = document.createElement('button');
      b.className = 'lang-item';
      b.dataset.lang = lang;
      b.lang = lang;
      b.textContent = LANG_NAMES[lang]; // each name in its own language, never translated
      if (lang === 'ar') b.dir = 'rtl';
      b.addEventListener('click', () => { setLang(lang); this.refresh(); });
      this.langGrid.appendChild(b);
    }
  }

  _bindSlider() {
    const pick = (clientX) => {
      const r = this.slider.getBoundingClientRect();
      const half = 15; // track inset (styles/ui.css --half)
      const t = Math.min(1, Math.max(0, (clientX - r.left - half) / Math.max(1, r.width - 2 * half)));
      const idx = Math.round(t * (QUALITY_LEVELS.length - 1));
      const level = QUALITY_LEVELS[idx];
      if (this.game.qualitySetting !== level) { this.game.setQuality(level); this.refresh(); }
    };
    let dragging = false;
    this.slider.addEventListener('pointerdown', (e) => {
      dragging = true;
      try { this.slider.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      pick(e.clientX);
      Sfx.play('click');
    });
    this.slider.addEventListener('pointermove', (e) => { if (dragging) pick(e.clientX); });
    const end = () => { dragging = false; };
    this.slider.addEventListener('pointerup', end);
    this.slider.addEventListener('pointercancel', end);
  }
}
