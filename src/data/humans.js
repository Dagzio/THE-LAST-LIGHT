// KILL LIST (D78): armed human enemies. Location 1 (office) — the terrorists who took the floor. One user model for all
// of them (assets/models/enemy.glb); the types differ by weapon, stats, a tint and a size. Police / SWAT / guards of the
// later locations are added here as new types (their own models when the user provides them).
// Speeds in units/s (the hero runs 95), view in units / degrees, times in s.

export const HUMAN_TYPES = {
  thug: {
    id: 'thug', nameKey: 'enemy.thug', model: 'enemy', weapon: 'enemy_pistol',
    hp: 45, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 30, combat: 76 },
    view: { range: 430, fov: 120, near: 80 },   // near: noticed at any angle this close
    reaction: 0.6,                              // s from first sight to the first shot
    keepRange: 220,                             // likes to fight from about here
    tint: 0xffffff,
  },
  gunman: {
    id: 'gunman', nameKey: 'enemy.gunman', model: 'enemy', weapon: 'enemy_rifle',
    hp: 60, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 30, combat: 70 },
    view: { range: 470, fov: 110, near: 80 },
    reaction: 0.65,
    keepRange: 280,
    tint: 0xc9d2e0,
  },
  heavy: {
    id: 'heavy', nameKey: 'enemy.heavy', model: 'enemy', weapon: 'enemy_heavy',
    hp: 150, armor: 2, radius: 17, scale: 1.08,
    speed: { patrol: 26, combat: 54 },
    view: { range: 450, fov: 110, near: 90 },
    reaction: 0.5,
    keepRange: 200,
    tint: 0x8c8f96,
  },
};

/** How enemies think (systems/HumanAISystem.js). */
export const AI_TUNING = {
  thinkInterval: 0.1,        // s between perception checks (not every step: weak phones)
  hearShot: 520,             // units: an unsuppressed shot is heard this far (half through walls)
  alertShare: 340,           // units: an enemy that spots the player alerts the others this close
  searchTime: 6,             // s an enemy searches the last known spot before going back
  loseSightGrace: 1.2,       // s an enemy keeps shooting at the spot after losing sight
  strafeEvery: [1.2, 2.4],   // s between strafe direction changes in a fight
  arriveDist: 14,            // units: a waypoint counts as reached
  burstPause: [0.7, 1.3],    // s between bursts (rifles)
  movingTargetSpread: 1.6,   // × spread when the player runs; × 2.5 while he rolls
  stuckTime: 1.5,            // s without progress → next waypoint / give up
  onScreenInset: 24,         // CSS px: D82 — an enemy shoots only when his whole body is this far inside the screen
};
