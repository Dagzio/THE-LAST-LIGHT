// Top-level game state machine (02_SPEC §2 + H5 TAP_TO_PLAY).
// Phase 1 uses RUNNING as the in-map state; Phase 4 splits it into MAP_INTRO / WAVE_ACTIVE / INTERMISSION.

export const STATES = Object.freeze({
  BOOT: 'BOOT',
  TAP_TO_PLAY: 'TAP_TO_PLAY',
  MAIN_MENU: 'MAIN_MENU',
  MAP_SELECT: 'MAP_SELECT',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  MAP_DEFEAT: 'MAP_DEFEAT',
});

const TRANSITIONS = {
  BOOT: ['TAP_TO_PLAY'],
  TAP_TO_PLAY: ['MAIN_MENU'],
  MAIN_MENU: ['MAP_SELECT'],
  MAP_SELECT: ['MAIN_MENU', 'RUNNING'],
  RUNNING: ['PAUSED', 'MAIN_MENU', 'MAP_DEFEAT'],
  PAUSED: ['RUNNING', 'MAIN_MENU'],
  MAP_DEFEAT: ['RUNNING', 'MAIN_MENU'], // RETRY → a fresh run; or back to the main menu
};

/** States in which the world simulation (GameClock) advances. */
const SIMULATING = new Set([STATES.RUNNING]);

export class GameStateMachine {
  constructor(initial = STATES.BOOT) {
    this.state = initial;
    this.previous = null;
    this.listeners = new Set();
  }

  is(state) { return this.state === state; }

  can(next) { return (TRANSITIONS[this.state] || []).includes(next); }

  /** Transitions to `next`. Invalid or repeated transitions are ignored (idempotent) and return false. */
  set(next, payload) {
    if (next === this.state || !this.can(next)) return false;
    this.previous = this.state;
    this.state = next;
    for (const fn of this.listeners) fn(next, this.previous, payload);
    return true;
  }

  get simulating() { return SIMULATING.has(this.state); }

  /** In-map states: the game scene is on screen. */
  get inMap() { return this.state === STATES.RUNNING || this.state === STATES.PAUSED || this.state === STATES.MAP_DEFEAT; }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
