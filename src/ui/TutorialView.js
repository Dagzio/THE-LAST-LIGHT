// Tutorial hint view (D11 / D43, no narrator): a spotlight ring around the highlighted HUD element (the rest of the
// screen dimmed), a bouncing arrow towards it and a hint card with GOT IT / SKIP TUTORIAL. The card sits on the
// opposite half of the screen from the target. While visible the target rect is re-measured every frame
// (elements may appear a frame later, the screen may rotate). Presentation only — actions go to TutorialSystem.
import { T, onLanguageChange } from '../i18n/i18n.js';
import { TUTORIAL } from '../data/tutorial.js';
import { Sfx } from '../platform/Sfx.js';

const ICON = {
  beacon: '<path d="M9 22l1.5-12h3L15 22zM8.5 8h7l-1-3h-5zM11 2h2v2h-2z"/>',
  move: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
  wave: '<path d="M6 4l6 6 6-6M6 11l6 6 6-6"/>',
  aim: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  beam: '<path d="M4 20L12 4l8 16"/><path d="M12 4v16"/>',
  dash: '<path d="M5 5l7 7-7 7M12 5l7 7-7 7"/>',
  shop: '<path d="M3 4h2.5l2.2 11h10.6L21 7H7"/><circle cx="9.5" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
  grenade: '<circle cx="11" cy="14" r="6.5"/><path d="M11 7.5V5h3l2-2M14 5l3 3"/>',
  device: '<path d="M6 20h12l-2-6H8z"/><path d="M8 14V9h8v5M16 11h6"/>',
  crate: '<path d="M3 8h18v12H3zM3 8l3-4h12l3 4M12 8v12"/>',
  flare: '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2M5.3 5.3l2.2 2.2M16.5 16.5l2.2 2.2M5.3 18.7l2.2-2.2M16.5 7.5l2.2-2.2"/>',
  boss: '<path d="M5 9l2-5 3 3 2-4 2 4 3-3 2 5"/><path d="M6 9h12v4a6 6 0 0 1-12 0z"/>',
};
const PAD = 8;

export class TutorialView {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = { root: $('tutorial'), spot: $('tutSpot'), arrow: $('tutArrow'), card: $('tutCard'), ico: $('tutIco'), text: $('tutText') };
    this.step = null;
    this.raf = 0;
    this.last = '';
    game.tutorial.onChange((id) => this._show(id));
    onLanguageChange(() => { if (this.step) this._text(); });
  }

  _show(id) {
    cancelAnimationFrame(this.raf);
    this.step = id ? TUTORIAL.steps[id] : null;
    this.el.root.hidden = !this.step;
    document.body.classList.toggle('tutorial-on', !!this.step);
    if (!this.step) return;
    Sfx.play('open');
    this.el.ico.innerHTML = `<svg viewBox="0 0 24 24">${ICON[this.step.icon] || ICON.beacon}</svg>`;
    this._text();
    this.last = '';
    const loop = () => { this._place(); this.raf = requestAnimationFrame(loop); };
    loop();
  }

  _text() {
    const touch = document.body.classList.contains('touch');
    this.el.text.textContent = T(touch && this.step.touchText ? this.step.touchText : this.step.text);
  }

  /** Spotlight + arrow on the target (or a full dim without one); the card on the other half of the screen. */
  _place() {
    const touch = document.body.classList.contains('touch');
    const sel = this.step.target[touch ? 'touch' : 'desk'];
    const t = sel ? document.querySelector(sel) : null;
    const r = t ? t.getBoundingClientRect() : null;
    const has = !!r && r.width > 0 && r.height > 0;
    const W = window.innerWidth, H = window.innerHeight;
    const key = has ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)},${W},${H}` : `none,${W},${H}`;
    if (key === this.last) return;
    this.last = key;
    const s = this.el.spot.style, a = this.el.arrow, c = this.el.card;
    if (has) {
      s.left = `${r.left - PAD}px`; s.top = `${r.top - PAD}px`;
      s.width = `${r.width + PAD * 2}px`; s.height = `${r.height + PAD * 2}px`;
      this.el.spot.classList.add('on');
      const below = r.top + r.height / 2 < H / 2; // target in the top half → arrow under it pointing up
      a.hidden = false;
      a.classList.toggle('up', below);
      const ax = r.left + r.width / 2;
      a.style.left = `${ax}px`;
      a.style.top = below ? `${r.bottom + PAD + 6}px` : `${r.top - PAD - 6}px`;
      c.classList.toggle('top', !below);
    } else {
      s.left = `${W / 2}px`; s.top = `${H / 2}px`; s.width = '0px'; s.height = '0px';
      this.el.spot.classList.remove('on');
      a.hidden = true;
      c.classList.remove('top');
    }
  }
}
