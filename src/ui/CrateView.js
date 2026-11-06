// Crate reward (Underlords "CHOOSE A BOON", PROJECT_AUDIT.md §6.6): three cards — grey header with a round icon,
// black body with the effect and "until the end of the map". Shown in CRATE_REWARD_OPEN (and under Settings when
// paused from it). No close button: the world stays frozen until one perk is chosen (02_SPEC §14).
import { STATES } from '../core/GameStateMachine.js';
import { T, onLanguageChange } from '../i18n/i18n.js';
import { PERKS } from '../data/perks.js';
import { Sfx } from '../platform/Sfx.js';

const ICON = {
  damage: '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  reload: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 3.5V8h-4.5"/>',
  mobility: '<path d="M5 18l5-12 4 8 3-4 3 8"/>',
  armor: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  penetration: '<path d="M2 12h20M16 7l5 5-5 5"/><path d="M9 6v12"/>',
  magazine: '<path d="M8 3h8v18H8z"/><path d="M8 8h8M8 13h8"/>',
  beam: '<path d="M4 20L12 4l8 16"/><path d="M12 4v16"/>',
  repair: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  fireRate: '<path d="M4 6l6 6-6 6M11 6l6 6-6 6"/>',
  impact: '<circle cx="9" cy="12" r="4"/><path d="M15 8l6-3M15 12h7M15 16l6 3"/>',
};

export class CrateView {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('popup-crate');
    this.cards = document.getElementById('crateCards');
    this.cards.addEventListener('click', (e) => {
      const b = e.target.closest('[data-perk]');
      if (!b) return;
      if (this.game.chooseCratePerk(b.dataset.perk)) Sfx.play('perk');
    });
    game.sm.onChange(() => this._sync());
    onLanguageChange(() => { if (this.visible) this._build(); });
  }

  get visible() { return this.root.classList.contains('show'); }

  _sync() {
    const g = this.game;
    const show = g.sm.is(STATES.CRATE_REWARD_OPEN) || (g.sm.is(STATES.PAUSED) && g.resumeState === STATES.CRATE_REWARD_OPEN);
    if (show === this.visible) return;
    this.root.classList.toggle('show', show);
    if (show) this._build();
  }

  _build() {
    const ids = (this.game.run && this.game.run.crateChoices) || [];
    this.cards.replaceChildren();
    for (const id of ids) {
      const perk = PERKS[id];
      const card = document.createElement('button');
      card.className = 'boon-card';
      card.dataset.perk = id;
      card.dataset.nosfx = '';
      card.innerHTML = `<span class="boon-head"><span class="shop-card-ico"><svg viewBox="0 0 24 24">${ICON[perk.icon] || ICON.damage}</svg></span>`
        + '<span class="boon-name"></span></span><span class="boon-body"><span class="boon-fx"></span><span class="boon-note"></span></span>';
      card.querySelector('.boon-name').textContent = T(`perk.${id}`);
      card.querySelector('.boon-fx').textContent = T(`perk.${id}.fx`);
      card.querySelector('.boon-note').textContent = T(perk.once ? 'crate.once' : 'crate.untilEnd');
      this.cards.append(card);
    }
  }
}
