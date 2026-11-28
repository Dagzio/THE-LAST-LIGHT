// KILL LIST (D78): armed human enemies. Location 1 (office) — the terrorists who took the floor. One user model for all
// of them (assets/models/enemy.glb); the types differ by weapon, stats, a tint and a size. Police / SWAT / guards of the
// later locations are added here as new types (their own models when the user provides them).
// Speeds in units/s (the hero runs 95), view in units / degrees, times in s.

// D97 (user): the enemies notice the hero 20 % closer (view range × 0.8: 430 → 344, 470 → 376, 450 → 360)
export const HUMAN_TYPES = {
  thug: {
    id: 'thug', nameKey: 'enemy.thug', model: 'enemy', weapon: 'enemy_pistol',
    hp: 45, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 30, combat: 76 },
    view: { range: 344, fov: 120, near: 80 },   // near: noticed at any angle this close
    reaction: 0.6,                              // s from first sight to the first shot
    keepRange: 220,                             // likes to fight from about here
    tint: 0xffffff,
  },
  gunman: {
    id: 'gunman', nameKey: 'enemy.gunman', model: 'enemy', weapon: 'enemy_rifle',
    hp: 60, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 30, combat: 70 },
    view: { range: 376, fov: 110, near: 80 },
    reaction: 0.65,
    keepRange: 280,
    tint: 0xc9d2e0,
  },
  heavy: {
    id: 'heavy', nameKey: 'enemy.heavy', model: 'enemy', weapon: 'enemy_heavy',
    hp: 150, armor: 2, radius: 17, scale: 1.08,
    speed: { patrol: 26, combat: 54 },
    view: { range: 360, fov: 110, near: 90 },
    reaction: 0.5,
    keepRange: 200,
    tint: 0x8c8f96,
  },
  // D148 (Marseille, levels 2–3 — STORY_DESIGN_D133.md §6): Vance's "cleaners", each type its own model (the user's
  // NEW/enemies). flashlight — a torch on the gun (presentation: a light cone ahead of him); the shield trooper
  // (D149, user: the frontal block left no way to kill him) — no block, the toughest of them all (hp + armour);
  // sniper — he never moves, aims `aim` s along a visible laser (lost sight: the aim falls back), then fires
  cleaner: {
    id: 'cleaner', nameKey: 'enemy.cleaner', model: 'cleaner', weapon: 'enemy_pistol',
    hp: 50, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 30, combat: 78 },
    view: { range: 350, fov: 115, near: 80 },
    reaction: 0.55, keepRange: 220, tint: 0xffffff, flashlight: true,
  },
  assaulter: {
    id: 'assaulter', nameKey: 'enemy.assaulter', model: 'assaulter', weapon: 'enemy_rifle',
    hp: 70, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 30, combat: 72 },
    view: { range: 376, fov: 110, near: 80 },
    reaction: 0.6, keepRange: 270, tint: 0xffffff, flashlight: true,
  },
  shield: {
    id: 'shield', nameKey: 'enemy.shield', model: 'shieldTrooper', weapon: 'enemy_pistol',
    hp: 230, armor: 3, radius: 17, scale: 1,
    speed: { patrol: 26, combat: 50 },
    view: { range: 340, fov: 110, near: 80 },
    reaction: 0.6, keepRange: 150, tint: 0xffffff,
  },
  sniper: {
    id: 'sniper', nameKey: 'enemy.sniper', model: 'sniper', weapon: 'enemy_sniper',
    hp: 40, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 0, combat: 0 },
    view: { range: 1500, fov: 360, near: 0 },
    reaction: 0, keepRange: 0, tint: 0xffffff,
    sniper: { aim: 1.9, after: 1.6, lose: 0.6 }, // s of aim before the shot / pause after it / the aim falls back ×this per s of no sight
  },
  // D148 (level 2): Moro, the department's man in Marseille — found dead in the safe flat (a body from the start; the
  // training ground's model: one of the department's people)
  moro: {
    id: 'moro', nameKey: 'enemy.moro', model: 'enemyTraining', weapon: 'enemy_pistol', unarmed: true,
    hp: 1, armor: 0, radius: 15, scale: 1, speed: { patrol: 0, combat: 0 }, view: { range: 0, fov: 0, near: 0 },
    reaction: 1, keepRange: 0, tint: 0xffffff,
  },
  // D148 (level 3): the port's dispatcher — Corvin's man, unarmed; taken alive from behind (MissionTasks 'capture')
  dispatcher: {
    id: 'dispatcher', nameKey: 'enemy.dispatcher', model: 'enemy', weapon: 'enemy_pistol', unarmed: true,
    hp: 40, armor: 0, radius: 15, scale: 1,
    speed: { patrol: 28, combat: 92 },
    view: { range: 300, fov: 110, near: 70 },
    reaction: 0.7, keepRange: 400, tint: 0xd9c9a6,
  },
};

/** How enemies think (systems/HumanAISystem.js). */
export const AI_TUNING = {
  thinkInterval: 0.1,        // s between perception checks (not every step: weak phones)
  // D126 (user: a hero in cover, barely showing, was spotted at once): in cover his body is checked at 5 points (the
  // middle, the shoulders, front / back) — partly hidden (`full` of them or fewer seen), an enemy needs
  // 1 / (rate × the part seen) s of sight to spot him (half seen ≈ 1.4 s); out of sight the glimpse fades (`fade` /s)
  coverSpot: { rate: 1.4, full: 0.99, fade: 0.8 },
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
