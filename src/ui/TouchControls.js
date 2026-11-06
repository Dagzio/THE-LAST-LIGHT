// Touch adapter (decision D12, 04_ARCH §15): a floating virtual stick in the left part of the screen, manual aim
// in the right part (user decision 2026-11-06: the keeper turns to the point under the finger and fires while the
// finger is down; dragging moves the aim point) and neon action buttons (DASH, RELOAD) bottom-right. It only feeds InputManager sources — gameplay code is the
// same for keyboard and touch. Shown only on touch devices. Multi-touch: each pointer is tracked by id.
import { STATES } from '../core/GameStateMachine.js';
import { GRENADE_RULES } from '../data/grenades.js';

const SOURCE = 'touch';
const GRENADE_DRAG_FULL = 110; // CSS px of drag for the maximum throw range
const GRENADE_DRAG_DEAD = 12;  // below this it is a tap (throw straight ahead)
const STICK_ZONE = 0.45;     // left 45% of the screen width starts the stick
const STICK_RADIUS = 56;     // CSS px of thumb travel for full speed
const DEAD_ZONE = 0.12;

export class TouchControls {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.root = document.getElementById('touchControls');
    this.stick = document.getElementById('touchStick');
    this.knob = document.getElementById('touchKnob');
    this.stickPointer = null;
    this.aimPointer = null;
    this.baseX = 0;
    this.baseY = 0;

    const coarse = matchMedia('(pointer: coarse)');
    const markTouch = () => document.body.classList.add('touch');
    if (coarse.matches) markTouch();
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') markTouch(); }, true);

    const canvas = document.getElementById('world3d'); // the stick lives on the 3D map canvas
    canvas.addEventListener('pointerdown', (e) => this._stickDown(e));
    window.addEventListener('pointermove', (e) => this._stickMove(e));
    window.addEventListener('pointerup', (e) => this._stickUp(e));
    window.addEventListener('pointercancel', (e) => this._stickUp(e));

    this.root.querySelectorAll('[data-touch-action]').forEach((btn) => {
      const action = btn.dataset.touchAction;
      const press = (e) => {
        e.preventDefault();
        if (!this.game.sm.is(STATES.RUNNING)) return;
        btn.classList.add('pressed');
        this.input.setSourceAction(SOURCE, action, true);
      };
      const release = () => {
        btn.classList.remove('pressed');
        this.input.setSourceAction(SOURCE, action, false);
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    });

    // Grenade (D41): hold the button and drag — the drag vector (scaled) is the throw offset in the world;
    // release throws, a tap without dragging throws straight ahead. Pointer capture keeps tracking off the button.
    this.grenadeBtn = document.getElementById('grenadeBtn');
    this.grenadePointer = null;
    this.gx = 0; this.gy = 0; this.gDragged = false;
    const gb = this.grenadeBtn;
    gb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this.game.sm.is(STATES.RUNNING) || this.grenadePointer !== null) return;
      if (!this.game.run || this.game.run.grenades.total() === 0) { gb.classList.add('denied'); return; }
      this.grenadePointer = e.pointerId;
      this.gx = e.clientX; this.gy = e.clientY; this.gDragged = false;
      try { gb.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      gb.classList.add('pressed');
    });
    gb.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.grenadePointer) return;
      const dx = e.clientX - this.gx, dy = e.clientY - this.gy;
      if (!this.gDragged && Math.hypot(dx, dy) < GRENADE_DRAG_DEAD) return;
      this.gDragged = true;
      const ga = this.input.grenadeAim;
      const k = GRENADE_RULES.maxThrowRange / GRENADE_DRAG_FULL; // screen right/down = world +x/+y (top-down camera)
      ga.active = true; ga.ox = dx * k; ga.oy = dy * k;
    });
    const end = (e) => {
      if (e.pointerId !== this.grenadePointer) return;
      this.grenadePointer = null;
      gb.classList.remove('pressed');
      const ga = this.input.grenadeAim;
      if (e.type === 'pointercancel') { ga.active = false; return; }
      ga.active = false; ga.released = true; ga.tap = !this.gDragged;
    };
    gb.addEventListener('pointerup', end);
    gb.addEventListener('pointercancel', end);
    gb.addEventListener('animationend', () => gb.classList.remove('denied'));

    // Leaving RUNNING (pause, popups, exit) drops every touch so nothing sticks on resume.
    game.sm.onChange((state) => { if (state !== STATES.RUNNING) this.reset(); });
  }

  _stickDown(e) {
    if (e.pointerType === 'mouse') return;
    if (!this.game.sm.is(STATES.RUNNING)) return;
    if (e.clientX > window.innerWidth * STICK_ZONE) { this._aimDown(e); return; }
    if (this.stickPointer !== null) return;
    this.stickPointer = e.pointerId;
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.stick.style.transform = `translate(${this.baseX}px, ${this.baseY}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.root.classList.add('stick-active');
  }

  _aimDown(e) {
    if (this.aimPointer !== null) return;
    this.aimPointer = e.pointerId;
    this.input.setAimClient(e.clientX, e.clientY);
    this.input.setSourceAction(SOURCE, 'fire', true);
  }

  _stickMove(e) {
    if (e.pointerId === this.aimPointer) { this.input.setAimClient(e.clientX, e.clientY); return; }
    if (e.pointerId !== this.stickPointer) return;
    let dx = e.clientX - this.baseX;
    let dy = e.clientY - this.baseY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) { dx = (dx / len) * STICK_RADIUS; dy = (dy / len) * STICK_RADIUS; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let ax = dx / STICK_RADIUS, ay = dy / STICK_RADIUS;
    if (Math.hypot(ax, ay) < DEAD_ZONE) { ax = 0; ay = 0; }
    this.input.setSourceAxis(SOURCE, ax, ay);
  }

  _stickUp(e) {
    if (e.pointerId === this.aimPointer) {
      this.aimPointer = null;
      this.input.setSourceAction(SOURCE, 'fire', false);
      this.input.clearAim(); // the keeper keeps facing the last direction
      return;
    }
    if (e.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.input.setSourceAxis(SOURCE, 0, 0);
    this.knob.style.transform = 'translate(0px, 0px)';
    this.stick.style.transform = '';
    this.root.classList.remove('stick-active');
  }

  reset() {
    this.stickPointer = null;
    this.grenadePointer = null;
    if (this.grenadeBtn) this.grenadeBtn.classList.remove('pressed');
    const ga = this.input.grenadeAim;
    ga.active = false; ga.released = false; ga.tap = false;
    if (this.aimPointer !== null) { this.aimPointer = null; this.input.clearAim(); }
    this.input.setSourceAction(SOURCE, 'fire', false);
    this.input.setSourceAxis(SOURCE, 0, 0);
    this.root.classList.remove('stick-active');
    this.knob.style.transform = 'translate(0px, 0px)';
    this.stick.style.transform = '';
    this.root.querySelectorAll('[data-touch-action]').forEach((btn) => {
      btn.classList.remove('pressed');
      this.input.setSourceAction(SOURCE, btn.dataset.touchAction, false);
    });
  }
}
