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
  flightTime: 0.55,         // s from the throw to the blast (game clock)
  arcHeight: 70,            // presentation: peak height of the lob (+ 0.12 × distance)
  previewDots: 14,          // dotted trajectory while aiming
};

export const getGrenade = (id) => GRENADES[id] || null;
