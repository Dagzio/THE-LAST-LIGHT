// Device-independent input (02_SPEC §3, 04_ARCH §15). Sources (keyboard/mouse now, a touch adapter
// in Phase 2) feed abstract actions and a movement axis; gameplay reads only:
//   getMove(out), isDown(action), consumePressed(action), getAimWorld(out), pointer.world
// Aim (manual shooting, user decision 2026-11-06): desktop — the mouse cursor, left button = "fire" (hold = auto);
// touch — the point under the finger in the right part of the screen (TouchControls sets it), touching = fire.
// Listeners are attached once. Keyup, blur and tab hiding release everything (no stuck keys).
import { KEY_BINDINGS, ACTIONS } from '../config/controls.js';

const CODE_TO_ACTION = new Map();
for (const action of ACTIONS) for (const code of KEY_BINDINGS[action]) CODE_TO_ACTION.set(code, action);

/** Keys whose browser default (page scroll) must not happen during play. */
const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class InputManager {
  /** @param {import('./Viewport.js').Viewport} viewport */
  constructor(viewport) {
    this.viewport = viewport;
    this.keyboardDown = new Set();      // actions held via keyboard
    this.sourceDown = new Map();        // sourceId → Set(actions) (touch buttons etc.)
    this.sourceAxes = new Map();        // sourceId → {x, y} analog axes (virtual stick)
    this.pressedQueue = new Set();      // edge-triggered presses not yet consumed by a fixed update
    this.pointer = { clientX: 0, clientY: 0, inside: false, world: { x: 0, y: 0 } };
    this.pointerMapper = null;          // (clientX, clientY, out) → world point; set by the 3D renderer in a map
    this.aim = { active: false, clientX: 0, clientY: 0 }; // screen point the keeper looks/shoots at
    this._attached = false;
  }

  attach() {
    if (this._attached) return;
    this._attached = true;
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    for (const canvas of document.querySelectorAll('canvas.game-canvas')) {
      canvas.addEventListener('pointermove', (e) => this._onPointer(e, true));
      canvas.addEventListener('pointerdown', (e) => this._onPointer(e, true));
      canvas.addEventListener('pointerleave', (e) => this._onPointer(e, false));
      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button === 0) this.setSourceAction('mouse', 'fire', true);
      });
    }
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.setSourceAction('mouse', 'fire', false);
    });
  }

  _onKey(e, down) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = CODE_TO_ACTION.get(e.code);
    if (!action) return;
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    if (down) {
      if (!e.repeat && !this.keyboardDown.has(action)) this.pressedQueue.add(action);
      this.keyboardDown.add(action);
    } else {
      this.keyboardDown.delete(action);
    }
  }

  _onPointer(e, inside) {
    this.pointer.clientX = e.clientX;
    this.pointer.clientY = e.clientY;
    this.pointer.inside = inside;
    if (e.pointerType === 'mouse') this.setAimClient(e.clientX, e.clientY); // the keeper always follows the cursor
  }

  // ---- aim ----
  setAimClient(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    this.aim.active = true;
    this.aim.clientX = clientX;
    this.aim.clientY = clientY;
  }

  /** Touch released: keep the current facing, no aim point. */
  clearAim() { this.aim.active = false; }

  /** Aim point on the ground in world units, or null when there is none (the keeper keeps his facing). */
  getAimWorld(out) {
    if (!this.aim.active || !this.pointerMapper) return null;
    return this.pointerMapper(this.aim.clientX, this.aim.clientY, out);
  }

  // ---- source API for adapters (touch controls) ----
  setSourceAxis(sourceId, x, y) {
    const v = this.sourceAxes.get(sourceId) || { x: 0, y: 0 };
    v.x = Number.isFinite(x) ? x : 0;
    v.y = Number.isFinite(y) ? y : 0;
    this.sourceAxes.set(sourceId, v);
  }

  setSourceAction(sourceId, action, down) {
    let set = this.sourceDown.get(sourceId);
    if (!set) { set = new Set(); this.sourceDown.set(sourceId, set); }
    if (down && !set.has(action)) this.pressedQueue.add(action);
    if (down) set.add(action); else set.delete(action);
  }

  // ---- read API for gameplay ----
  isDown(action) {
    if (this.keyboardDown.has(action)) return true;
    for (const set of this.sourceDown.values()) if (set.has(action)) return true;
    return false;
  }

  /** True once per press; call from fixed update. */
  consumePressed(action) {
    if (!this.pressedQueue.has(action)) return false;
    this.pressedQueue.delete(action);
    return true;
  }

  /** Combined movement vector, length ≤ 1 (diagonal normalized). */
  getMove(out = { x: 0, y: 0 }) {
    let x = (this.isDown('moveRight') ? 1 : 0) - (this.isDown('moveLeft') ? 1 : 0);
    let y = (this.isDown('moveDown') ? 1 : 0) - (this.isDown('moveUp') ? 1 : 0);
    for (const v of this.sourceAxes.values()) { x += v.x; y += v.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    out.x = Number.isFinite(x) ? x : 0;
    out.y = Number.isFinite(y) ? y : 0;
    return out;
  }

  /** Pointer position in world units (computed on demand, no per-frame work). */
  pointerWorld() {
    const { clientX, clientY, world } = this.pointer;
    if (this.pointerMapper) return this.pointerMapper(clientX, clientY, world);
    return this.viewport.clientToWorld(clientX, clientY, world);
  }

  /** Drops edge presses that happened while the simulation was not running (pause, menus). */
  clearPressed() { this.pressedQueue.clear(); }

  releaseAll() {
    this.keyboardDown.clear();
    for (const set of this.sourceDown.values()) set.clear();
    for (const v of this.sourceAxes.values()) { v.x = 0; v.y = 0; }
    this.pressedQueue.clear();
  }
}
