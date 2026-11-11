// Off-screen indicators (user decision 2026-11-06): arrows at the screen edge pointing to things outside the 3D view.
// Phase 2: the nearest enemies. The beacon (blinking when attacked) and the kiosk (in intermission) use the same
// pool from Phase 3 / Phase 5 — types 'beacon' / 'kiosk' are styled already.
// A fixed pool of DOM arrows; per frame only transforms of the visible ones are written. Reads state only.
import { STATES } from '../core/GameStateMachine.js';

const MAX_ENEMY_ARROWS = 6;
// D53: HUD blocks the badges keep clear of (+ AVOID_PAD around them: badge radius + a little air)
const AVOID_SELECTORS = ['#screen-game .hud-top', '#screen-game .hud-player', '#screen-game .corner-tl', '#screen-game .corner-tr',
  '#screen-game .grenade-slots', '#btnNextWave', '.touch-actions']; // not the stick: badges ignore taps, and on a small
// phone the left edge is the only free run
const AVOID_PAD = 28;
const P2 = { x: 0, y: 0 }; // reused
const EDGE = 58;          // CSS px from the screen edge to the badge centre (badge + pointer stay inside the H5 margin)
// D53: a round badge with an icon (what it is) + a pointer that turns around it (where it is)
const POINT = '<i class="oi-point"><svg viewBox="0 0 24 24"><path d="M4 4l18 8-18 8 4-8z"/></svg></i>';
const ICONS = {
  enemy: '<path d="M5 20l3-9M10 21l2-10M15 20l-1-9"/><path d="M4 11c0-4 4-7 8-7s8 3 8 7"/><circle cx="9" cy="8.5" r="1"/><circle cx="15" cy="8.5" r="1"/>',
  beacon: '<path d="M9 22l1.5-12h3L15 22z"/><path d="M8.5 8h7l-1-3h-5z"/><path d="M4 6l3 1M20 6l-3 1M12 2v1.5"/>',
  kiosk: '<path d="M3 4h2l2.4 10.5h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
  crate: '<rect x="3.5" y="9" width="17" height="11" rx="1"/><path d="M3.5 9l2-4h13l2 4M12 9v11M9.5 13h5"/>',
};
const indicatorHtml = (kind) => `${POINT}<span class="oi-badge"><svg viewBox="0 0 24 24">${ICONS[kind]}</svg></span>`;

export class OffscreenIndicators {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('offscreen');
    this.arrows = [];
    for (let i = 0; i < MAX_ENEMY_ARROWS; i++) {
      const el = document.createElement('div');
      el.className = 'offscreen-arrow enemy';
      el.innerHTML = indicatorHtml('enemy');
      this.root.appendChild(el);
      this.arrows.push({ el, on: false, x: 0, y: 0, a: 0, boss: false });
    }
    const be = document.createElement('div');
    be.className = 'offscreen-arrow beacon';
    be.innerHTML = indicatorHtml('beacon');
    this.root.appendChild(be);
    this.beaconArrow = { el: be, on: false, x: 0, y: 0, a: 0, alert: false };
    const ki = document.createElement('div');
    ki.className = 'offscreen-arrow kiosk';
    ki.innerHTML = indicatorHtml('kiosk');
    this.root.appendChild(ki);
    this.kioskArrow = { el: ki, on: false, x: 0, y: 0, a: 0 }; // between waves only (D28)
    const cr = document.createElement('div');
    cr.className = 'offscreen-arrow crate';
    cr.innerHTML = indicatorHtml('crate');
    this.root.appendChild(cr);
    this.crateArrow = { el: cr, on: false, x: 0, y: 0, a: 0 }; // while a crate lies on the map (Phase 6)
    this.pick = new Array(MAX_ENEMY_ARROWS).fill(null);
    this.pickD = new Array(MAX_ENEMY_ARROWS).fill(Infinity);
    this.pt = { x: 0, y: 0 };
    this.avoidRects = undefined; // HUD blocks (measured twice a second)
    this.avoidTick = 0;
    game.onFrame(() => this.update());
  }

  _hideAll() {
    for (const a of this.arrows) if (a.on) { a.on = false; a.el.classList.remove('on'); }
    for (const b of [this.beaconArrow, this.kioskArrow, this.crateArrow]) if (b.on) { b.on = false; b.el.classList.remove('on'); }
  }

  /**
   * D53: a badge that would sit on a HUD block (wave header, keeper block, corner buttons, touch buttons, START …)
   * slides along the screen edge until it is clear of every block — the nearest free spot; only if the whole edge
   * run is blocked it steps inwards past the block. The block rects are re-measured twice a second (layout reads only
   * then, never between the style writes of a frame).
   */
  _avoid(x, y, W, H, out) {
    out.x = x; out.y = y;
    const rs = this.avoidRects;
    if (!rs || !rs.length) return out;
    const hit = (px, py) => rs.find((r) => px > r.l && px < r.r && py > r.t && py < r.b);
    const r0 = hit(x, y);
    if (!r0) return out;
    const lo = EDGE, hiX = W - EDGE, hiY = H - EDGE;
    const horiz = Math.abs(y - lo) < 1 || Math.abs(y - hiY) < 1; // on the top / bottom edge: slide along x
    // nearest free position along this edge: the run [lo, hi] minus every block crossing the edge line
    const free = (v, other, alongX) => {
      const hi = alongX ? hiX : hiY;
      const cuts = rs.filter((r) => (alongX ? other > r.t && other < r.b : other > r.l && other < r.r))
        .map((r) => (alongX ? [r.l, r.r] : [r.t, r.b])).sort((a, b) => a[0] - b[0]);
      let best = null, bd = Infinity, at = lo;
      const test = (a, b) => { if (b < a) return; const p = Math.min(b, Math.max(a, v)); const d = Math.abs(p - v); if (d < bd) { bd = d; best = p; } };
      for (const [a, b] of cuts) { test(at, Math.min(hi, a)); at = Math.max(at, b); }
      test(at, hi);
      return best;
    };
    const p = free(horiz ? x : y, horiz ? y : x, horiz);
    if (p !== null && Math.abs(p - (horiz ? x : y)) < (horiz ? W : H) * 0.35) { // a gap not too far from the true spot
      if (horiz) out.x = p; else out.y = p;
      return out;
    }
    // no gap nearby: step past the block towards the screen centre (stays on this side of the screen)
    const down = horiz ? y < H / 2 : x < W / 2;
    for (let r = r0, n = 0; r && n < 4; r = hit(out.x, out.y), n++) { // past every block met on the way in
      if (horiz) out.y = down ? r.b : r.t; else out.x = down ? r.r : r.l;
    }
    out.x = Math.min(hiX, Math.max(lo, out.x)); // never off the screen (a tiny phone may have no free spot at all)
    out.y = Math.min(hiY, Math.max(lo, out.y));
    return out;
  }

  _measureAvoid() {
    if (++this.avoidTick < 30 && this.avoidRects !== undefined) return;
    this.avoidTick = 0;
    const pad = AVOID_PAD;
    const rects = [];
    for (const sel of AVOID_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (!el.offsetWidth || !el.offsetHeight) continue;
        const r = el.getBoundingClientRect();
        rects.push({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad });
      }
    }
    this.avoidRects = rects;
  }

  /** Places arrow `a` on the screen edge towards the projected point; hides it when the point is on screen. */
  _place(a, px, py, W, H) {
    if (px >= 0 && px <= W && py >= 0 && py <= H) { if (a.on) { a.on = false; a.el.classList.remove('on'); } return; }
    const cx = W / 2, cy = H / 2;
    const dx = px - cx, dy = py - cy;
    const ang = Math.atan2(dy, dx);
    const k = Math.min((cx - EDGE) / Math.max(1e-6, Math.abs(dx)), (cy - EDGE) / Math.max(1e-6, Math.abs(dy)));
    this._avoid(cx + dx * k, cy + dy * k, W, H, P2);
    const x = P2.x, y = P2.y;
    if (!a.on) { a.on = true; a.el.classList.add('on'); }
    if (Math.abs(x - a.x) > 0.5 || Math.abs(y - a.y) > 0.5 || Math.abs(ang - a.a) > 0.01) {
      a.x = x; a.y = y; a.a = ang;
      a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      a.el.style.setProperty('--a', `${ang.toFixed(3)}rad`); // the pointer turns, the icon stays upright
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
      const boss = !!e.type.boss; // D53: the boss gets its own colour
      if (boss !== a.boss) { a.boss = boss; a.el.classList.toggle('boss', boss); }
      r3.projectToScreen(e.x, e.y, 16, this.pt);
      const dx = this.pt.x - cx, dy = this.pt.y - cy;
      const ang = Math.atan2(dy, dx);
      // intersection of the ray from the centre with the inset screen rectangle
      const hx = cx - EDGE, hy = cy - EDGE;
      const k = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hy / Math.max(1e-6, Math.abs(dy)));
      this._avoid(cx + dx * k, cy + dy * k, W, H, P2);
      const x = P2.x, y = P2.y;
      if (!a.on) { a.on = true; a.el.classList.add('on'); }
      if (Math.abs(x - a.x) > 0.5 || Math.abs(y - a.y) > 0.5 || Math.abs(ang - a.a) > 0.01) {
        a.x = x; a.y = y; a.a = ang;
        a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      a.el.style.setProperty('--a', `${ang.toFixed(3)}rad`); // the pointer turns, the icon stays upright
      }
    }
  }
}
