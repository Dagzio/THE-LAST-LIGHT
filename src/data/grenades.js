// Grenades. KILL LIST (D78): frag only — found in a crate (2 in the office level), never bought. Stock lives in the
// level run only. G / the grenade button arms one, the next shot aims it, the release throws it (D61 flow kept).

export const GRENADES = {
  frag: {
    id: 'frag', nameKey: 'grenade.frag',
    radius: 95, damage: 99,     // D82: the hero's damage +10 % (was 90)
    knockback: 40,            // world units outward (small)
    critChance: 0, critMultiplier: 1,
  },
};

export const GRENADE_ORDER = ['frag'];

export const GRENADE_RULES = {
  capPerType: 3,
  maxThrowRange: 320,       // world units from the hero
  tapThrowRange: 220,       // touch tap without dragging: straight ahead
  flightTime: 0.55,         // s from the throw to the blast (game clock) — a throw that hits nothing on its way
  // D116 (user: no throws over walls into other rooms, a ricochet): a low lob that bounces off walls / doors / tall props
  radius: 3,                // world units: the grenade's size against the walls
  bounce: 0.45,             // a bounce keeps this part of the distance left and of the speed
  bounceMin: 12,            // world units: it always rolls back at least this far off a face
  maxBounces: 3,
  arcHeight: 26,            // presentation: the lob's bump over its straight drop from the hand (low — under the walls)
  previewDots: 14,          // dotted trajectory while aiming
};

export const getGrenade = (id) => GRENADES[id] || null;
