// Device tags (D52, user decision 2026-11-11): above every installed device — its level, an HP bar and, while it is
// damaged, a small wrench button with the full-repair price (works any time the map runs, like the beacon wrench).
// One small DOM tag per build pad, created once; per frame only the transform of a visible tag is written, the rest
// (level, fill, price, states) only when the value changes. Reads state only; the repair goes through Game.
import { STATES } from '../core/GameStateMachine.js';
import { T, onLanguageChange } from '../i18n/i18n.js';
import { Sfx } from '../platform/Sfx.js';

const TAG_HEIGHT = 74; // world height above the pad (over the turret models)
const WRENCH = '<svg class="ico" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>';

export class DeviceTags {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.host = document.getElementById('deviceTags');
    this.tags = [];
    this.pt = { x: 0, y: 0 };
    this.run = null;
    this.host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dev-fix]');
      if (!b || b.disabled) return;
      Sfx.play(this.game.hudRepairDevice(Number(b.dataset.devFix)).ok ? 'buy' : 'deny');
      e.stopPropagation();
    });
    onLanguageChange(() => { for (const t of this.tags) t.fix.setAttribute('aria-label', T('aria.repairDevice')); });
    game.onFrame(() => this.update());
  }

  _build(n) {
    this.host.replaceChildren();
    this.tags = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'dev-tag';
      el.innerHTML = `<b class="dev-lv"></b><i class="dev-hp"><i></i></i><button class="dev-fix" data-dev-fix="${i}" data-nosfx>${WRENCH}<span class="dev-cost"><b>0</b><i class="coin-ico"></i></span></button>`;
      this.host.append(el);
      const fix = el.querySelector('.dev-fix');
      fix.setAttribute('aria-label', T('aria.repairDevice'));
      this.tags.push({
        el, fix, lv: el.querySelector('.dev-lv'), fill: el.querySelector('.dev-hp > i'), cost: el.querySelector('.dev-cost b'),
        on: false, x: -1, y: -1, level: -1, pct: -1, broken: null, fixOn: null, price: -1, poor: null,
      });
    }
  }

  _hide(t) { if (t.on) { t.on = false; t.el.classList.remove('on'); } }

  update() {
    const g = this.game, run = g.run, r3 = g.renderer3d;
    if (!g.sm.inMap || !run || !r3 || run.over) { for (const t of this.tags) this._hide(t); return; }
    if (run !== this.run || this.tags.length !== run.defenses.pads.length) { this.run = run; this._build(run.defenses.pads.length); }
    const running = g.sm.is(STATES.RUNNING);
    if (!running && r3.pausedDrawn) return; // frozen frame: the tags stay where they are
    const W = r3.viewW, H = r3.viewH;
    const pads = run.defenses.pads;
    for (let i = 0; i < pads.length; i++) {
      const t = this.tags[i], d = pads[i].device;
      if (!d) { this._hide(t); continue; }
      r3.projectToScreen(d.x, d.y, TAG_HEIGHT, this.pt);
      if (this.pt.x < 0 || this.pt.x > W || this.pt.y < 0 || this.pt.y > H) { this._hide(t); continue; }
      if (!t.on) { t.on = true; t.el.classList.add('on'); }
      const x = Math.round(this.pt.x), y = Math.round(this.pt.y);
      if (x !== t.x || y !== t.y) { t.x = x; t.y = y; t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
      if (d.level !== t.level) { t.level = d.level; t.lv.textContent = String(d.level); }
      const pct = Math.round((d.hp / d.maxHp) * 200) / 2; // 0.5 % steps: no style write for tiny changes
      if (pct !== t.pct) { t.pct = pct; t.fill.style.width = `${pct}%`; }
      const broken = d.hp <= 0;
      if (broken !== t.broken) { t.broken = broken; t.el.classList.toggle('broken', broken); }
      const o = g.deviceRepairOffer(i, true);
      const fixOn = o.reason !== 'full' && o.cost > 0;
      if (fixOn !== t.fixOn) { t.fixOn = fixOn; t.el.classList.toggle('hurt', fixOn); }
      if (!fixOn) continue;
      if (o.cost !== t.price) { t.price = o.cost; t.cost.textContent = String(o.cost); }
      const poor = !o.canBuy;
      if (poor !== t.poor) { t.poor = poor; t.fix.disabled = poor; t.fix.classList.toggle('poor', poor); }
    }
  }
}
