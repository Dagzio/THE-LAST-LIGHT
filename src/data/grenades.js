// Grenades (03_ECONOMY §8, D15: sold one at a time, cap 3 per type for the current map; radii unchanged by D27).
// Prices go through shopPrice() (−15 %, D40). Stock lives in the map run only (never in the profile).

export const GRENADES = {
  frag: {
    id: 'frag', nameKey: 'grenade.frag', price: 15, requiredPlayerLevel: 1,
    radius: 90, damage: 45,
    knockback: 40,            // world units outward (small), not for the boss
    critChance: 0, critMultiplier: 1,
  },
  cryo: {
    id: 'cryo', nameKey: 'grenade.cryo', price: 20, requiredPlayerLevel: 2,
    radius: 90,
    slow: 0.55, slowDuration: 2.5,         // regular enemies
    bossSlow: 0.25, bossSlowDuration: 1.5, // the boss: weaker, never a freeze
  },
  molotov: {
    id: 'molotov', nameKey: 'grenade.molotov', price: 20, requiredPlayerLevel: 3,
    radius: 75, duration: 4.0, tickDamage: 10, tickInterval: 0.5,
    critChance: 0, critMultiplier: 1,
  },
};

export const GRENADE_ORDER = ['frag', 'cryo', 'molotov'];

export const GRENADE_RULES = {
  capPerType: 3,
  maxThrowRange: 320,       // world units from the keeper
  tapThrowRange: 220,       // touch tap without dragging: straight ahead
  flightTime: 0.5,          // s from the throw to the blast (game clock)
  arcHeight: 70,            // presentation: peak height of the lob (+ 0.12 × distance)
  previewDots: 14,          // dotted trajectory while aiming (user decision D41)
};

export const getGrenade = (id) => GRENADES[id] || null;
