// Tiny synchronous event bus for presentation hooks (sound, particles, HUD).
// Systems emit facts ("shot", "hit", "kill"); listeners never change gameplay state.
// Positional arguments avoid allocating an event object per emit.

export class GameEvents {
  constructor() { this.listeners = new Map(); }

  on(type, fn) {
    let set = this.listeners.get(type);
    if (!set) { set = new Set(); this.listeners.set(type, set); }
    set.add(fn);
    return () => set.delete(fn);
  }

  emit(type, a, b, c, d) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of set) fn(a, b, c, d);
  }
}
