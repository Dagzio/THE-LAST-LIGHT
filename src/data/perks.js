// Temporary crate perks (03_ECONOMY §11) — they last until the end of the current map only (MapRun.temporaryPerks)
// and never touch the PlayerProfile. Crate rules (user decision D41): 30 % per wave on waves 2–5, max 1 per map,
// it disappears after 30 s.

// D52 (user decision 2026-11-11, replaces the % roll of D41 / D46): at most ONE crate per wave, at a random moment of
// it. From firstWaveIndex on, every wave is a 50 / 50 (waveChance) — some waves have none. Never on the first or the
// last wave of a map. A map can list fixed crate waves instead (map.crateWaves — map 1: waves 3 and 4 only) or add
// guaranteed ones on top of the rule (map.crateGuaranteedWaves — the last map: wave 1, even though it is the first).
export const CRATE = {
  waveChance: 0.5,
  firstWaveIndex: 1,        // wave 2 (0-based index): from map 2 the first crate comes on wave 2 or 3 (50 / 50 each)
  spawnWithin: 15,          // s — appears at a random moment in the first seconds of the wave
  lifetime: 30,             // s, then it disappears (timer shown above it)
  interactRadius: 60,       // × INTERACT RANGE (D14)
  choices: 3,
  placement: { margin: 120, minFromPlayer: 220, minFromBeacon: 260, minFromKiosk: 130, minFromPads: 120, minFromSpawns: 220, tries: 50 },
};

/**
 * cat (D51, user decision 2026-11-09): a crate offers ONE perk of each category — weapon / keeper / beacon & defense.
 * Weapon perks change the run's weapon stats; keeper perks the keeper; beacon perks the beacon, the turrets, the flare.
 */
export const PERK_CATEGORIES = ['weapon', 'keeper', 'beacon'];

export const PERKS = {
  // weapon
  overpressure: { id: 'overpressure', cat: 'weapon', icon: 'damage', damageMult: 1.15 },
  quick_hands: { id: 'quick_hands', cat: 'weapon', icon: 'reload', reloadMult: 0.85 },
  piercing_rounds: { id: 'piercing_rounds', cat: 'weapon', icon: 'penetration', penetration: 1 },
  extended_mag: { id: 'extended_mag', cat: 'weapon', icon: 'magazine', magazineMult: 1.20 },
  fast_trigger: { id: 'fast_trigger', cat: 'weapon', icon: 'fireRate', fireRateMult: 1.10 },
  heavy_impact: { id: 'heavy_impact', cat: 'weapon', icon: 'impact', knockback: 14 }, // world units per hit (not the boss)
  keen_eye: { id: 'keen_eye', cat: 'weapon', icon: 'crit', critBonus: 0.10 },              // D51: +10 pp crit chance
  // keeper
  fleet_footed: { id: 'fleet_footed', cat: 'keeper', icon: 'mobility', speedMult: 1.10 },
  reinforced_coat: { id: 'reinforced_coat', cat: 'keeper', icon: 'armor', damageTakenMult: 0.90 },
  second_wind: { id: 'second_wind', cat: 'keeper', icon: 'heart', hpRegen: 1.5 },         // D51: HP per second
  quick_step: { id: 'quick_step', cat: 'keeper', icon: 'dash', dodgeCooldownMult: 0.75 }, // D51: dash cooldown −25 %
  thick_skin: { id: 'thick_skin', cat: 'keeper', icon: 'heart', maxHpBonus: 25 },         // D51: +25 max HP (healed now)
  // beacon & defense
  beacon_focus: { id: 'beacon_focus', cat: 'beacon', icon: 'beam', beamDeg: 10 },
  emergency_repair: { id: 'emergency_repair', cat: 'beacon', icon: 'repair', repair: 20, once: true }, // only if damaged
  turret_overclock: { id: 'turret_overclock', cat: 'beacon', icon: 'turret', deviceFireRateMult: 1.20 }, // D51
  stone_skin: { id: 'stone_skin', cat: 'beacon', icon: 'shield', beaconDamageMult: 0.80 },              // D51
  warm_light: { id: 'warm_light', cat: 'beacon', icon: 'sun', beaconRegen: 1.5 },          // D51: integrity per second
  flare_cache: { id: 'flare_cache', cat: 'beacon', icon: 'flare', flareChargeMult: 1.30 }, // D51: flare charges faster
};

export const PERK_ORDER = Object.keys(PERKS);
