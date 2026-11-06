// Tutorial director (D11 / D43): listens to gameplay events and shows each hint ONCE (seen ids live in the profile).
// A hint in a running map pauses the world (state TUTORIAL) until GOT IT; inside the open shop it overlays the shop
// (the shop already freezes the world). Skipping (after the confirmation) turns the whole tutorial off for good.
// Only the first map and only while the profile flag is not done. It never changes gameplay data.
import { STATES } from '../core/GameStateMachine.js';
import { TUTORIAL, TUTORIAL_STEP_IDS } from '../data/tutorial.js';

export class TutorialSystem {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.active = null;     // step id on screen
    this.queue = [];
    this.listeners = new Set();
    const ev = game.events;
    ev.on('mapStarted', () => { this.queue = []; this.active = null; this.trigger('beacon'); });
    ev.on('enemySpawn', (e) => this.trigger(e.type && e.type.boss ? 'boss' : 'shoot'));
    ev.on('playerHit', () => this.trigger('dash'));
    ev.on('waveCleared', (i, reward, final) => { if (!final) this.trigger('shop'); });
    ev.on('crateSpawn', () => this.trigger('crate'));
    ev.on('flareReady', () => this.trigger('flare'));
    ev.on('purchase', (kind) => { if (kind === 'defense') this.trigger('device'); });
    game.sm.onChange((s) => {
      if (s === STATES.SHOP_OPEN) this.trigger('shopTabs', true); // the shop overview always comes first
      if (!game.sm.inMap) { this.queue = []; this.active = null; this._notify(); }
    });
    game.onFrame(() => this._poll());
  }

  get enabled() {
    const g = this.game, t = g.economy.profile.tutorial;
    return !t.done && !!g.run && g.run.mapId === TUTORIAL.mapId && !g.run.over;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  _notify() { for (const fn of this.listeners) fn(this.active); }

  _seen(id) { return this.game.economy.profile.tutorial.seen.includes(id); }

  /** Queues a step if the tutorial is on and the step was never shown (`first`: ahead of the queue). */
  trigger(id, first = false) {
    if (!TUTORIAL.steps[id] || !this.enabled || this._seen(id) || this.active === id || this.queue.includes(id)) return;
    if (first) this.queue.unshift(id); else this.queue.push(id);
    this._next();
  }

  /** Conditions that are states, not events (checked each frame while the map runs). */
  _poll() {
    if (!this.enabled) return;
    const g = this.game, r = g.run;
    if (g.sm.is(STATES.RUNNING)) {
      if (!this._seen('light') && r.enemies.some((e) => e.alive && e.illuminated)) this.trigger('light');
      if (!this._seen('grenade') && r.grenades.total() > 0 && r.waves.phase === 'ACTIVE') this.trigger('grenade');
    }
    if (!this.active && this.queue.length) this._next();
  }

  _next() {
    if (this.active || !this.queue.length) return;
    const sm = this.game.sm;
    const id = this.queue[0];
    // shop hints wait for the open shop; all others need the running map (shown over a frozen world)
    const inShop = sm.is(STATES.SHOP_OPEN);
    const shopStep = id === 'shopTabs' || id === 'device';
    if (shopStep ? !inShop : !sm.is(STATES.RUNNING)) return;
    this.queue.shift();
    this.active = id;
    if (sm.is(STATES.RUNNING)) sm.set(STATES.TUTORIAL);
    this._notify();
  }

  /** GOT IT: the step is stored as seen; the world resumes; a chained step follows. */
  dismiss() {
    const id = this.active;
    if (!id) return false;
    this.active = null;
    this.game.economy.markTutorialSeen(id, TUTORIAL_STEP_IDS);
    if (this.game.sm.is(STATES.TUTORIAL)) this.game.sm.set(STATES.RUNNING);
    this._notify();
    const then = TUTORIAL.steps[id].then;
    if (then) this.trigger(then);
    this._next();
    return true;
  }

  /** SKIP (confirmed): no more hints, ever (until RESET PROGRESS). */
  skip() {
    this.game.economy.skipTutorial();
    this.queue = [];
    const wasActive = !!this.active;
    this.active = null;
    if (wasActive && this.game.sm.is(STATES.TUTORIAL)) this.game.sm.set(STATES.RUNNING);
    this._notify();
  }
}
