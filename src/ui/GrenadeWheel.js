// D61 (user decision): the grenade wheel. Hold the grenade button (touch, or the HUD button with the mouse) or G — the
// game slows down by 95 %, three black cells fan out next to the button (frag / cryo / molotov with their stock); slide
// the finger / mouse towards a cell to light it up, release to ARM that grenade. A tap without sliding arms the current
// type (or drops an armed one). The armed grenade is thrown by the next shot: pressing fire shows the arc and the
// landing circle, releasing throws (core/MapRun.js). Presentation + input only: the game state changes through Game.
import { STATES } from '../core/GameStateMachine.js';
import { GRENADE_ORDER } from '../data/grenades.js';
import { T } from '../i18n/i18n.js';
import { Sfx } from '../platform/Sfx.js';

export const WHEEL_TIME_SCALE = 0.05;      // the game runs at 5 % while the wheel is open
// screen degrees from the button. Touch: left, up-left, up (the button sits bottom-right, other buttons to its right);
// desktop (D62): up-left, up, up-right — the button is in the middle of the action bar (DASH left, FLARE right)
const TOUCH_ANGLES = { frag: 180, cryo: -135, molotov: -90 };
const DESK_ANGLES = { frag: -140, cryo: -90, molotov: -40 };
const DEAD = 16;                           // CSS px of slide before a direction counts (less = a tap)
const CONE = 50;                           // degrees around a cell's direction that pick it

export class GrenadeWheel {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.root = document.getElementById('gWheel');
    this.name = document.getElementById('gWheelName');
    this.cells = {};
    for (const t of GRENADE_ORDER) {
      const c = this.root.querySelector(`[data-type="${t}"]`);
      this.cells[t] = { el: c, count: c.querySelector('b') };
    }
    this.open = false;
    this.via = null;      // 'pointer' | 'key'
    this.pointerId = null;
    this.anchor = null;   // the button the wheel opened from
    this.sx = 0; this.sy = 0; this.cx = 0; this.cy = 0; this.radius = 0;
    this.sel = null;
    this.moved = false;

    for (const id of ['grenadeBtn', 'hudGrenade']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (this.open) return;
        if (!this._open(btn, e.clientX, e.clientY, 'pointer')) return;
        this.pointerId = e.pointerId;
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      });
      btn.addEventListener('pointermove', (e) => { if (this.open && e.pointerId === this.pointerId) this._track(e.clientX, e.clientY); });
      btn.addEventListener('pointerup', (e) => { if (this.open && e.pointerId === this.pointerId) this._close(true); });
      btn.addEventListener('pointercancel', (e) => { if (this.open && e.pointerId === this.pointerId) this._close(false); });
      btn.addEventListener('animationend', () => btn.classList.remove('denied'));
    }
    // G on the keyboard: polled every frame (works during the slow motion and needs no own key listener)
    this.keyWas = false;
    this.mx = 0; this.my = 0; // the mouse anywhere (over HUD buttons the canvas does not see it)
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.mx = e.clientX; this.my = e.clientY; } }, { passive: true });
    game.onFrame(() => this._frame());
    game.sm.onChange((s) => { if (s !== STATES.RUNNING && this.open) this._close(false); });
  }

  _frame() {
    const g = this.game;
    const key = g.sm.is(STATES.RUNNING) && this.input.isDown('throwGrenade');
    // a G tap shorter than a frame: open + close at once (= a tap: arm the current type / drop the armed one)
    if (!key && !this.open && this.input.pressedQueue.delete('throwGrenade') && g.sm.is(STATES.RUNNING)) {
      const btn = document.getElementById('hudGrenade');
      if (btn && this._open(btn, this.mx, this.my, 'key')) this._close(true);
    }
    if (key && !this.keyWas && !this.open) {
      this.input.pressedQueue.delete('throwGrenade'); // this press is the hold, not a tap
      const btn = document.getElementById('hudGrenade');
      if (btn) this._open(btn, this.mx, this.my, 'key');
    }
    if (this.open && this.via === 'key') {
      this._track(this.mx, this.my);
      if (!key) this._close(true);
    }
    this.keyWas = key;
  }

  _open(btn, x, y, via) {
    const g = this.game, run = g.run;
    if (!g.sm.is(STATES.RUNNING) || !run) return false;
    if (run.grenades.total() === 0) { btn.classList.add('denied'); Sfx.play('deny'); return false; }
    this.angles = btn.id === 'hudGrenade' ? DESK_ANGLES : TOUCH_ANGLES;
    const r = btn.getBoundingClientRect();
    this.cx = r.left + r.width / 2; this.cy = r.top + r.height / 2;
    this.radius = Math.max(84, r.width * (btn.id === 'hudGrenade' ? 1.75 : 1.45)); // desktop: clear of DASH / FLARE below
    this.root.style.left = `${this.cx}px`;
    this.root.style.top = `${this.cy}px`;
    this.root.style.setProperty('--gw-r', `${this.radius}px`);
    const size = Math.round(Math.min(76, Math.max(56, this.radius * 0.62)));
    this.root.style.setProperty('--gw-cell', `${size}px`);
    for (const t of GRENADE_ORDER) {
      const n = run.grenades.stock[t] | 0, c = this.cells[t];
      const a = (this.angles[t] * Math.PI) / 180; // cells fan out up / left of the button (it sits bottom-right)
      c.el.style.left = `${Math.round(Math.cos(a) * this.radius - size / 2)}px`;
      c.el.style.top = `${Math.round(Math.sin(a) * this.radius - size / 2)}px`;
      c.count.textContent = String(n);
      c.el.classList.toggle('empty', n === 0);
      c.el.classList.remove('sel');
    }
    const mid = (this.angles.cryo * Math.PI) / 180, nd = this.radius + size * 0.95; // the name: past the middle cell
    this.name.style.left = `${Math.round(Math.cos(mid) * nd)}px`;
    this.name.style.top = `${Math.round(Math.sin(mid) * nd)}px`;
    this.anchor = btn; this.via = via; this.sx = x; this.sy = y;
    this.sel = null; this.moved = false;
    this.open = true;
    btn.classList.add('pressed');
    this.root.classList.add('on');
    this._setName(run.grenadeArmed || null);
    run.holdFire = true;
    g.setTimeScale(WHEEL_TIME_SCALE);
    return true;
  }

  _track(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dx = x - this.sx, dy = y - this.sy;
    if (!this.moved && Math.hypot(dx, dy) < DEAD) return;
    this.moved = true;
    let pick = null;
    // straight onto a cell (the mouse goes there) …
    const size = this.radius * 0.42;
    for (const t of GRENADE_ORDER) {
      const a = (this.angles[t] * Math.PI) / 180;
      if (Math.hypot(x - (this.cx + Math.cos(a) * this.radius), y - (this.cy + Math.sin(a) * this.radius)) < size) pick = t;
    }
    // … or the direction of the slide (a thumb does not travel the whole way)
    if (!pick && Math.hypot(dx, dy) >= DEAD) {
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      let best = CONE;
      for (const t of GRENADE_ORDER) {
        const d = Math.abs(((ang - this.angles[t] + 540) % 360) - 180);
        if (d < best) { best = d; pick = t; }
      }
    }
    if (pick === this.sel) return;
    if (this.sel) this.cells[this.sel].el.classList.remove('sel');
    this.sel = pick;
    if (pick) this.cells[pick].el.classList.add('sel');
    this._setName(pick);
  }

  _setName(type) {
    this.name.textContent = type ? T(`grenade.${type}`) : '';
  }

  _close(commit) {
    if (!this.open) return;
    const g = this.game, run = g.run;
    this.open = false;
    this.root.classList.remove('on');
    if (this.anchor) this.anchor.classList.remove('pressed');
    if (this.anchor && this.pointerId !== null) { try { this.anchor.releasePointerCapture(this.pointerId); } catch (e) { /* gone */ } }
    this.pointerId = null;
    g.setTimeScale(1);
    if (run) run.holdFire = false;
    if (!commit || !run || !g.sm.is(STATES.RUNNING)) return;
    if (this.sel) { // a cell picked: arm it (an empty one is refused)
      if (g.armGrenade(this.sel)) Sfx.play('click'); else Sfx.play('deny');
    } else if (!this.moved) { // a tap: drop an armed grenade, else arm the current type
      if (run.grenadeArmed) { g.disarmGrenade(); Sfx.play('click'); } else {
        run.grenades.ensureSelection();
        if (g.armGrenade(run.grenades.selected)) Sfx.play('click');
      }
    }
  }
}
