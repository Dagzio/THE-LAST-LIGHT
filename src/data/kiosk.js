// Shop kiosk (02_SPEC §12, user decision D39): a new random spot every map run (run seed), never farther than
// maxDistFromBeacon from the beacon, never on the beacon, a build pad or the keeper's spawn.

export const KIOSK = {
  radius: 24,                 // body footprint (presentation + placement)
  interactRadius: 70,         // base radius (spec 60–75); INTERACT RANGE adds +15% per rank
  minDistFromBeacon: 150,     // outside the beacon + its attack ring
  maxDistFromBeacon: 360,     // user decision D39
  minDistFromPads: 95,
  minDistFromSpawn: 90,
  placementTries: 60,
};
