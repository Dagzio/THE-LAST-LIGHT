// Single simulation clock. Every gameplay timer/cooldown reads `time` from here.
// The clock advances only through `advance(dt)` called by the fixed-step loop while
// the state allows simulation, so Pause/Shop/Crate/hidden tab freeze everything at once.

export class GameClock {
  constructor() {
    this.time = 0;      // seconds of simulated time since the run started
    this.stepCount = 0;
  }

  advance(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.time += dt;
    this.stepCount += 1;
  }

  reset() {
    this.time = 0;
    this.stepCount = 0;
  }
}
