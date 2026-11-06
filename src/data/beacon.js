// Beacon & rotating light (01_GDD §9, 02_SPEC §7–8). Position comes from the map (data/maps.js).

export const BEACON = {
  maxIntegrity: 250,          // GDD §9.1 (prototype value)
  radius: 46,                 // footprint of the tower base: enemies attack from its edge
  threatRadius: 320,          // beacon "danger zone" for turret targeting priority 2 (beaconThreat 0..1)
  light: {
    sectorDeg: 60,            // GDD: ~60°
    rotationPeriod: 14,       // s per full turn (GDD: ~14 s)
    range: 650,               // world units (user decision 2026-11-06)
    illuminatedLinger: 0.5,   // s — status stays this long after leaving the beam (same in logic and visuals)
    startAngle: -Math.PI / 2, // beam points north at the start of a map
  },
  // Shop repair to full integrity (user decision D40): price ∝ damage; from 1% to 100% costs 50 coins.
  repair: { fullFromOnePercent: 50 },
};
