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
    this.pick = new Array(MAX_ENEMY_ARROWS).fill(null);
    this.pickD = new Array(MAX_ENEMY_ARROWS).fill(Infinity);
    this.pt = { x: 0, y: 0 };
    game.onFrame(() => this.update());
  }

  _hideAll() {
    for (const a of this.arrows) if (a.on) { a.on = false; a.el.classList.remove('on'); }
    for (const b of [this.beaconArrow, this.kioskArrow]) if (b.on) { b.on = false; b.el.classList.remove('on'); }
  }

  /** Places arrow `a` on the screen edge towards the projected point; hides it when the point is on screen. */
  _place(a, px, py, W, H) {
    if (px >= 0 && px <= W && py >= 0 && py <= H) { if (a.on) { a.on = false; a.el.classList.remove('on'); } return; }
    const cx = W / 2, cy = H / 2;
    const dx = px - cx, dy = py - cy;
    const ang = Math.atan2(dy, dx);
    const k = Math.min((cx - EDGE) / Math.max(1e-6, Math.abs(dx)), (cy - EDGE) / Math.max(1e-6, Math.abs(dy)));
    const x = cx + dx * k, y = cy + dy * k;
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
    if ((g.sm.is(STATES.PAUSED) || g.sm.is(STATES.SHOP_OPEN)) && r3.pausedDrawn) return; // frozen frame — arrows stay
    const W = r3.canvas.clientWidth, H = r3.canvas.clientHeight;
    const p = g.run.player;

    // Nearest off-screen alive enemies (selection without sorting/allocations).
    const pick = this.pick, pickD = this.pickD;
    for (let i = 0; i < pick.length; i++) { pick[i] = null; pickD[i] = Infinity; }
    for (const e of g.run.enemies) {
      if (!e.alive) continue;
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
      const x = cx + dx * k, y = cy + dy * k;
      if (!a.on) { a.on = true; a.el.classList.add('on'); }
      if (Math.abs(x - a.x) > 0.5 || Math.abs(y - a.y) > 0.5 || Math.abs(ang - a.a) > 0.01) {
        a.x = x; a.y = y; a.a = ang;
        a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
      }
    }
  }
}
