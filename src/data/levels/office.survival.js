// D85 SURVIVAL on the office (MODES_DESIGN_D85.md §4): hold out in the office as long as you can. Enemies come in a
// couple at a time through the stairwell, the elevator, the main door and three far rooms (never in view); supplies
// (crates: the SMG / rounds / grenades; D128: no medkits — the wounds heal by themselves) appear at random spots and are refreshed over time.

export const OFFICE_SURVIVAL = {
  playerSpawn: { x: 1200, y: 1480, angle: -Math.PI / 2 },
  doors: { exit: { lock: null }, server: { lock: null } },  // the glass entrance stays shut
  loadout: { weapons: ['pistol'], grenades: {} },
  bodyFade: 12,
  briefing: { start: 'call.office.survivalBrief' },
  enemies: [],
  reinforcements: null,
  objectives: [],
  exit: null,
  spawnPoints: [
    { id: 'stairs', x: 175, y: 400 }, { id: 'elevator', x: 1500, y: 1080 }, { id: 'entrance', x: 1200, y: 1660 },
    { id: 'server', x: 2000, y: 295 }, { id: 'archive', x: 330, y: 1590 }, { id: 'conference', x: 1760, y: 300 },
  ],
  pickupSpots: {
    crate: [[950, 1640], [1450, 1640], [450, 1400], [690, 1585], [850, 540], [600, 300], [1550, 560], [1950, 880],
      [1800, 1300], [1700, 1662], [1500, 800], [350, 1040]],
  },
};
