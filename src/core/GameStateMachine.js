// Top-level game state machine (02_SPEC §2 + H5 TAP_TO_PLAY). KILL LIST (D78): no shop / crate-choice / tutorial
// states — a level is RUNNING, PAUSED or over (MAP_DEFEAT / MAP_VICTORY; "map" = level in the code names).

export const STATES = Object.freeze({
  BOOT: 'BOOT',
  TAP_TO_PLAY: 'TAP_TO_PLAY',
  MAIN_MENU: 'MAIN_MENU',
  MAP_SELECT: 'MAP_SELECT',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  MAP_DEFEAT: 'MAP_DEFEAT',
  MAP_VICTORY: 'MAP_VICTORY',
});

const TRANSITIONS = {
  BOOT: ['TAP_TO_PLAY'],
  TAP_TO_PLAY: ['MAIN_MENU'],
  MAIN_MENU: ['MAP_SELECT'],
  MAP_SELECT: ['MAIN_MENU', 'RUNNING'],
  RUNNING: ['PAUSED', 'MAIN_MENU', 'MAP_DEFEAT', 'MAP_VICTORY'],
  PAUSED: ['RUNNING', 'MAIN_MENU'],
  MAP_DEFEAT: ['RUNNING', 'MAIN_MENU'],  // RETRY → a fresh run; or back to the main menu
  MAP_VICTORY: ['RUNNING', 'MAIN_MENU'], // PLAY AGAIN → a fresh run; or back to the main menu
};

/** States in which the world simulation (GameClock) advances. */
const SIMULATING = new Set([STATES.RUNNING]);

/** In-level states: the game scene is on screen. */
const IN_MAP = new Set([STATES.RUNNING, STATES.PAUSED, STATES.MAP_DEFEAT, STATES.MAP_VICTORY]);

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

  get inMap() { return IN_MAP.has(this.state); }

  /** The level is over (defeat or victory screen). */
  get mapOver() { return this.state === STATES.MAP_DEFEAT || this.state === STATES.MAP_VICTORY; }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
