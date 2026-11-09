// Off-screen indicators (user decision 2026-11-06): arrows at the screen edge pointing to things outside the 3D view.
// Phase 2: the nearest enemies. The beacon (blinking when attacked) and the kiosk (in intermission) use the same
// pool from Phase 3 / Phase 5 — types 'beacon' / 'kiosk' are styled already.
// A fixed pool of DOM arrows; per frame only transforms of the visible ones are written. Reads state only.
import { STATES } from '../core/GameStateMachine.js';

const MAX_ENEMY_ARROWS = 6;
const EDGE = 44;          // CSS px from the screen edge (inside the H5 30 px margin)
const ARROW_SVG = '<svg viewBox="0 0 24 24"><path d="M3 4l19 8-19 8 5-8z"/></svg>';

export class OffscreenIndicators {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('offscreen');
    this.arrows = [];
    for (let i = 0; i < MAX_ENEMY_ARROWS; i++) {
      const el = document.createElement('div');
      el.className = 'offscreen-arrow enemy';
      el.innerHTML = ARROW_SVG;
      this.root.appendChild(el);
      this.arrows.push({ el, on: false, x: 0, y: 0, a: 0 });
    }
    const be = document.createElement('div');
    be.className = 'offscreen-arrow beacon';
    be.innerHTML = ARROW_SVG;
    this.root.appendChild(be);
    this.beaconArrow = { el: be, on: false, x: 0, y: 0, a: 0, alert: false };
    const ki = document.createElement('div');
    ki.className = 'offscreen-arrow kiosk';
    ki.innerHTML = ARROW_SVG;
    this.root.appendChild(ki);
    this.kioskArrow = { el: ki, on: false, x: 0, y: 0, a: 0 }; // between waves only (D28)
    const cr = document.createElement('div');
    cr.className = 'offscreen-arrow crate';
    cr.innerHTML = ARROW_SVG;
    this.root.appendChild(cr);
    this.crateArrow = { el: cr, on: false, x: 0, y: 0, a: 0 }; // while a crate lies on the map (Phase 6)
    this.pick = new Array(MAX_ENEMY_ARROWS).fill(null);
    this.pickD = new Array(MAX_ENEMY_ARROWS).fill(Infinity);
    this.pt = { x: 0, y: 0 };
    this.avoidRect = undefined; // touch keeper block (measured twice a second)
    this.avoidTick = 0;
    this.avoidStart = null;
    game.onFrame(() => this.update());
  }

  _hideAll() {
    for (const a of this.arrows) if (a.on) { a.on = false; a.el.classList.remove('on'); }
    for (const b of [this.beaconArrow, this.kioskArrow, this.crateArrow]) if (b.on) { b.on = false; b.el.classList.remove('on'); }
  }

  /**
   * D51: on touch the keeper block sits top-left — an arrow landing on it slides down the left edge below it.
   * The block rect is re-measured twice a second (one layout read), not every frame.
   */
  _avoid(x, y) {
    const r = this.avoidRect;
    if (r && x < r.right + 14 && y > r.top - 14 && y < r.bottom + 14) return r.bottom + 18;
    const s = this.avoidStart; // desktop START NEXT WAVE (bottom centre): arrows on the bottom edge go above it
    if (s && x > s.left - 14 && x < s.right + 14 && y > s.top - 14) return s.top - 18;
    return y;
  }

  _measureAvoid() {
    if (++this.avoidTick < 30 && this.avoidRect !== undefined) return;
    this.avoidTick = 0;
    const touch = document.body.classList.contains('touch');
    const el = touch ? document.querySelector('#screen-game .hud-player') : null;
    const r = el && el.offsetWidth ? el.getBoundingClientRect() : null;
    this.avoidRect = r ? { right: r.right, top: r.top, bottom: r.bottom } : null;
    const sb = !touch ? document.getElementById('btnNextWave') : null;
    const s = sb && sb.offsetWidth ? sb.getBoundingClientRect() : null;
    this.avoidStart = s ? { left: s.left, right: s.right, top: s.top } : null;
  }

  /** Places arrow `a` on the screen edge towards the projected point; hides it when the point is on screen. */
  _place(a, px, py, W, H) {
    if (px >= 0 && px <= W && py >= 0 && py <= H) { if (a.on) { a.on = false; a.el.classList.remove('on'); } return; }
    const cx = W / 2, cy = H / 2;
    const dx = px - cx, dy = py - cy;
    const ang = Math.atan2(dy, dx);
    const k = Math.min((cx - EDGE) / Math.max(1e-6, Math.abs(dx)), (cy - EDGE) / Math.max(1e-6, Math.abs(dy)));
    const x = cx + dx * k, y = this._avoid(cx + dx * k, cy + dy * k);
    if (!a.on) { a.on = true; a.el.classList.add('on'); }
    if (Math.abs(x - a.x) > 0.5 || Math.abs(y - a.y) > 0.5 || Math.abs(ang - a.a) > 0.01) {
      a.x = x; a.y = y; a.a = ang;
      a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
    }
  }

  update() {
    const g = this.game;
    const r3 = g.renderer3d;
    if (!g.sm.inMap || !g.run || !r3) { this._hideAll(); return; }
    if (!g.sm.is(STATES.RUNNING) && r3.pausedDrawn) return; // frozen frame — arrows stay
    const W = r3.viewW, H = r3.viewH; // cached size: no layout read between the arrow style writes
    this._measureAvoid();
    const p = g.run.player;

    // Nearest off-screen alive enemies (selection without sorting/allocations).
    const pick = this.pick, pickD = this.pickD;
    for (let i = 0; i < pick.length; i++) { pick[i] = null; pickD[i] = Infinity; }
    // perf: an enemy well inside the camera's view box is on screen for sure — no projection needed
    const view = r3.rig.view, inX = view.w * 0.38, inY = view.h * 0.3, camX = r3.rig.x, camY = r3.rig.y;
    for (const e of g.run.enemies) {
      if (!e.alive) continue;
      if (Math.abs(e.x - camX) < inX && Math.abs(e.y - camY) < inY) continue;
      r3.projectToScreen(e.x, e.y, 16, this.pt);
      if (this.pt.x >= 0 && this.pt.x <= W && this.pt.y >= 0 && this.pt.y <= H) continue; // on screen
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      let worst = 0;
      for (let i = 1; i < pick.length; i++) if (pickD[i] > pickD[worst]) worst = i;
      if (d < pickD[worst]) { pick[worst] = e; pickD[worst] = d; }
    }

    // Beacon: shown when off-screen, blinking while it is being attacked.
    const bc = g.run.beacon;
    r3.projectToScreen(bc.x, bc.y, 60, this.pt);
    this._place(this.beaconArrow, this.pt.x, this.pt.y, W, H);
    const alert = !bc.destroyed && g.clock.time - bc.lastHitAt < 1.5;
    if (alert !== this.beaconArrow.alert) { this.beaconArrow.alert = alert; this.beaconArrow.el.classList.toggle('alert', alert); }

    // Kiosk: between waves only (prep / intermission)
    const ka = this.kioskArrow;
    if (g.run.betweenWaves) {
      r3.projectToScreen(g.run.kiosk.x, g.run.kiosk.y, 30, this.pt);
      this._place(ka, this.pt.x, this.pt.y, W, H);
    } else if (ka.on) { ka.on = false; ka.el.classList.remove('on'); }

    // Crate: while it lies on the map
    const ca = this.crateArrow, crate = g.run.crates.crate;
    if (crate) {
      r3.projectToScreen(crate.x, crate.y, 20, this.pt);
      this._place(ca, this.pt.x, this.pt.y, W, H);
    } else if (ca.on) { ca.on = false; ca.el.classList.remove('on'); }

    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < this.arrows.length; i++) {
      const a = this.arrows[i];
      const e = pick[i];
      if (!e) { if (a.on) { a.on = false; a.el.classList.remove('on'); } continue; }
      r3.projectToScreen(e.x, e.y, 16, this.pt);
      const dx = this.pt.x - cx, dy = this.pt.y - cy;
      const ang = Math.atan2(dy, dx);
      // intersection of the ray from the centre with the inset screen rectangle
      const hx = cx - EDGE, hy = cy - EDGE;
      const k = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hy / Math.max(1e-6, Math.abs(dy)));
      const x = cx + dx * k, y = this._avoid(cx + dx * k, cy + dy * k);
      if (!a.on) { a.on = true; a.el.classList.add('on'); }
      if (Math.abs(x - a.x) > 0.5 || Math.abs(y - a.y) > 0.5 || Math.abs(ang - a.a) > 0.01) {
        a.x = x; a.y = y; a.a = ang;
        a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
      }
    }
  }
}
