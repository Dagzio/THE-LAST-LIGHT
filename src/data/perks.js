// Temporary crate perks (03_ECONOMY §11) — they last until the end of the current map only (MapRun.temporaryPerks)
// and never touch the PlayerProfile. Crate rules (user decision D41): 30 % per wave on waves 2–5, max 1 per map,
// it disappears after 30 s.

export const CRATE = {
  chance: 0.35,             // D46: 30 % + 5 %
  firstWaveIndex: 1,        // wave 2 (0-based index); a map can override it (map.crateFirstWaveIndex, D46: map 1 → wave 3)
  maxPerMap: 1,
  spawnWithin: 15,          // s — appears at a random moment in the first seconds of the wave
  lifetime: 30,             // s, then it disappears (timer shown above it)
  interactRadius: 60,       // × INTERACT RANGE (D14)
  choices: 3,
  placement: { margin: 120, minFromPlayer: 220, minFromBeacon: 260, minFromKiosk: 130, minFromPads: 120, minFromSpawns: 220, tries: 50 },
};

/** kind: 'weapon' perks change the run's weapon stats; others change the keeper / beacon. */
export const PERKS = {
  overpressure: { id: 'overpressure', icon: 'damage', damageMult: 1.15 },
  quick_hands: { id: 'quick_hands', icon: 'reload', reloadMult: 0.85 },
  fleet_footed: { id: 'fleet_footed', icon: 'mobility', speedMult: 1.10 },
  reinforced_coat: { id: 'reinforced_coat', icon: 'armor', damageTakenMult: 0.90 },
  piercing_rounds: { id: 'piercing_rounds', icon: 'penetration', penetration: 1 },
  extended_mag: { id: 'extended_mag', icon: 'magazine', magazineMult: 1.20 },
  beacon_focus: { id: 'beacon_focus', icon: 'beam', beamDeg: 10 },
  emergency_repair: { id: 'emergency_repair', icon: 'repair', repair: 20, once: true }, // only offered if damaged
  fast_trigger: { id: 'fast_trigger', icon: 'fireRate', fireRateMult: 1.10 },
  heavy_impact: { id: 'heavy_impact', icon: 'impact', knockback: 14 }, // world units per bullet hit (not the boss)
};

export const PERK_ORDER = Object.keys(PERKS);
