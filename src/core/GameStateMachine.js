// Top-level game state machine (02_SPEC §2 + H5 TAP_TO_PLAY).
// In a map, RUNNING is the simulating state; the wave flow (MAP_INTRO / WAVE_ACTIVE / INTERMISSION of the spec)
// is the run's own phase (MapRun.waves.phase), because all three advance the same game clock. States that freeze
// the clock (PAUSED; SHOP_OPEN / CRATE_REWARD_OPEN from Phases 5–6) are top-level states here.

export const STATES = Object.freeze({
  BOOT: 'BOOT',
  TAP_TO_PLAY: 'TAP_TO_PLAY',
  MAIN_MENU: 'MAIN_MENU',
  MAP_SELECT: 'MAP_SELECT',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  MAP_DEFEAT: 'MAP_DEFEAT',
  MAP_VICTORY: 'MAP_VICTORY',
  SHOP_OPEN: 'SHOP_OPEN',   // world + intermission timer frozen (02_SPEC §12)
});

const TRANSITIONS = {
  BOOT: ['TAP_TO_PLAY'],
  TAP_TO_PLAY: ['MAIN_MENU'],
  MAIN_MENU: ['MAP_SELECT'],
  MAP_SELECT: ['MAIN_MENU', 'RUNNING'],
  RUNNING: ['PAUSED', 'MAIN_MENU', 'MAP_DEFEAT', 'MAP_VICTORY', 'SHOP_OPEN'],
  SHOP_OPEN: ['RUNNING', 'PAUSED', 'MAIN_MENU'],
  PAUSED: ['RUNNING', 'SHOP_OPEN', 'MAIN_MENU'], // resume returns to where the pause started
  MAP_DEFEAT: ['RUNNING', 'MAIN_MENU'],  // RETRY → a fresh run; or back to the main menu
  MAP_VICTORY: ['RUNNING', 'MAIN_MENU'], // PLAY AGAIN → a fresh run; or back to the main menu
};

/** States in which the world simulation (GameClock) advances. */
const SIMULATING = new Set([STATES.RUNNING]);

/** In-map states: the game scene is on screen. */
const IN_MAP = new Set([STATES.RUNNING, STATES.PAUSED, STATES.MAP_DEFEAT, STATES.MAP_VICTORY, STATES.SHOP_OPEN]);

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

  /** The map is over (defeat or victory screen). */
  get mapOver() { return this.state === STATES.MAP_DEFEAT || this.state === STATES.MAP_VICTORY; }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
