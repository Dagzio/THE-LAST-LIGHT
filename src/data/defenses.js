// Tower-defense devices (03_ECONOMY §9, 02_SPEC §10). Radii ×0.72 for the 3D camera (user decision D27).
// Placement is only on a free build pad and (from Phase 5) only between waves through the shop.

export const DEFENSES = {
  guard_turret: {
    id: 'guard_turret', nameKey: 'defense.guard_turret', price: 85,
    range: 215,               // 300 × 0.72
    damage: 5, fireInterval: 0.65,
    projectileSpeed: 620, spreadAngle: 2, pelletsPerShot: 1, critChance: 0, critMultiplier: 1.5, penetrationCount: 0,
    muzzleHeight: 30,
  },
  frost_coil: {
    id: 'frost_coil', nameKey: 'defense.frost_coil', price: 75,
    radius: 110,              // 150 × 0.72
    pulseInterval: 2.0,       // s
    slow: 0.25,               // −25 % move speed
    slowDuration: 1.5,        // s; repeated pulses refresh, never stack (strongest slow wins)
  },
};

export const getDefense = (id) => DEFENSES[id] || null;
