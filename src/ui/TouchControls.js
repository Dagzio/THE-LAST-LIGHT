// Touch adapter (decision D12, 04_ARCH §15): a floating virtual stick in the left part of the screen and
// neon action buttons (DASH, RELOAD) bottom-right. It only feeds InputManager sources — gameplay code is the
// same for keyboard and touch. Shown only on touch devices. Multi-touch: each pointer is tracked by id.
import { STATES } from '../core/GameStateMachine.js';

const SOURCE = 'touch';
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

    // Leaving RUNNING (pause, popups, exit) drops every touch so nothing sticks on resume.
    game.sm.onChange((state) => { if (state !== STATES.RUNNING) this.reset(); });
  }

  _stickDown(e) {
    if (e.pointerType === 'mouse' || this.stickPointer !== null) return;
    if (!this.game.sm.is(STATES.RUNNING)) return;
    if (e.clientX > window.innerWidth * STICK_ZONE) return;
    this.stickPointer = e.pointerId;
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.stick.style.transform = `translate(${this.baseX}px, ${this.baseY}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.root.classList.add('stick-active');
  }

  _stickMove(e) {
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
    if (e.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.input.setSourceAxis(SOURCE, 0, 0);
    this.knob.style.transform = 'translate(0px, 0px)';
    this.stick.style.transform = '';
    this.root.classList.remove('stick-active');
  }

  reset() {
    this.stickPointer = null;
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
