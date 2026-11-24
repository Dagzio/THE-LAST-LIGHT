// D85 STEALTH on the office — "GHOST COPY" (MODES_DESIGN_D85.md §3.1–3.2): copy ORPHEUS from the server terminal and
// leave unseen by the service elevator. Start in the stairwell (the mission's exit). The server card: take down the
// night supervisor on his lobby ↔ corridor loop (he carries it) or take the spare from the dark security room.
// Two ways to the server door: the corridor (a timed patrol) or conference → print room → corridor.
// Patrol points: [x, y, wait s?, look angle?] (rad: 0 east, π/2 south, π west, −π/2 north).

export const OFFICE_STEALTH = {
  playerSpawn: { x: 175, y: 400, angle: 0 },
  doors: { exit: { lock: null } },                         // the stairwell door is open; the server door keeps its key card
  loadout: { weapons: ['pistol_sd'], grenades: {} },
  bodyFade: Infinity,                                       // bodies stay — they can be found
  briefing: { start: 'call.office.stealthBrief', turn: 'call.office.stealthDone' },
  enemies: [
    { type: 'thug', x: 300, y: 540, angle: 0, patrol: [[300, 540, 2, Math.PI / 2], [1200, 540, 2, -Math.PI / 2]] },        // E1 open space, the middle aisle
    { type: 'thug', x: 305, y: 655, angle: Math.PI, busy: true },                                                         // E2 at the cabinets (his back to the room)
    { type: 'gunman', x: 560, y: 850, angle: 0, patrol: [[560, 850, 2.5, Math.PI / 2], [1180, 850, 2.5, 2.36]] },          // E3 the south aisle
    { type: 'thug', x: 1370, y: 320, angle: 0, patrol: [[1370, 320], [1730, 320, 1.5, -Math.PI / 2], [1730, 560], [1370, 560, 1.5, 2.6]] }, // E4 conference loop
    { type: 'thug', x: 1360, y: 740, angle: Math.PI, busy: true },                                                         // E5 print room, at the printers
    { type: 'gunman', x: 650, y: 1010, angle: 0, patrol: [[650, 1010, 2, Math.PI], [1880, 1010, 2, 0]] },                  // E6 the corridor
    { type: 'gunman', x: 1000, y: 1300, angle: -Math.PI / 2, carries: 'keycard',                                            // E7 the night supervisor
      patrol: [[1000, 1300, 3, Math.PI / 2], [1120, 1190], [1120, 1075], [1820, 1075, 3, 0], [1120, 1075], [1120, 1190]] },
    { type: 'thug', x: 1200, y: 1290, angle: Math.PI / 2 },                                                                // E8 at the reception, facing the entrance
    { type: 'heavy', x: 1990, y: 1300, angle: Math.PI },                                                                    // E9 security (dark), the spare card behind him
    { type: 'thug', x: 1850, y: 1610, angle: -Math.PI / 2, busy: true },                                                   // E10 manager's office, files
    { type: 'gunman', x: 1840, y: 420, angle: Math.PI / 2, patrol: [[1840, 420, 2, -Math.PI / 2], [1840, 820, 2, 0]] },      // E11 server, the west aisle
    { type: 'gunman', x: 2085, y: 610, angle: Math.PI },                                                                    // E12 server, watching the middle aisle
    { type: 'thug', x: 600, y: 1250, angle: Math.PI },                                                                      // E13 break room
    // D87 (user: more guards, harder): crossing sightlines — every room watched from two sides, the routes overlap
    { type: 'gunman', x: 950, y: 300, angle: Math.PI / 2, patrol: [[950, 300, 2, 0], [950, 890, 2, Math.PI]] },             // E14 open space, the N–S lane
    { type: 'gunman', x: 2100, y: 1040, angle: Math.PI },                                                                   // E15 corridor east end, the server door
    { type: 'gunman', x: 800, y: 1410, angle: 0, patrol: [[800, 1410, 2, -Math.PI / 2], [1600, 1410, 2, -Math.PI / 2]] },    // E16 lobby, the back lane
    { type: 'thug', x: 300, y: 1580, angle: 0, patrol: [[300, 1580, 2.5, -Math.PI / 2], [700, 1580, 2.5, -Math.PI / 2]] },   // E17 archive
    { type: 'gunman', x: 1350, y: 800, angle: 0, patrol: [[1350, 800, 2, -Math.PI / 2], [1750, 800, 2, Math.PI / 2]] },      // E18 print room
    { type: 'gunman', x: 1870, y: 300, angle: 0, patrol: [[1870, 300, 2, Math.PI / 2], [2100, 300, 2, Math.PI / 2]] },       // E19 server, the north lane
    { type: 'thug', x: 1720, y: 1200, angle: 0, busy: true },                                                               // E20 security, at the monitors
    { type: 'thug', x: 400, y: 300, angle: 0, patrol: [[400, 300, 2, Math.PI / 2], [1200, 300, 2, Math.PI / 2]] },           // E21 open space, the north aisle
  ],
  reinforcements: { after: 'alarm', enemies: [
    { type: 'gunman', x: 165, y: 345, angle: 0 }, { type: 'gunman', x: 165, y: 455, angle: 0 }, { type: 'heavy', x: 1200, y: 1640, angle: -Math.PI / 2 },
  ] },
  pickups: [
    { id: 'keycard', kind: 'keycard', x: 2080, y: 1290 },     // the spare card
    { id: 'terminal', kind: 'terminal', x: 2097, y: 868, hold: 6 },
    { id: 'intel_conf', kind: 'intel', x: 1720, y: 470 },
    { id: 'intel_mgr', kind: 'intel', x: 2030, y: 1600 },
  ],
  objectives: [
    { id: 'card', textKey: 'obj.st.card', target: 'keycard', done: 'keycard' },
    { id: 'copy', textKey: 'obj.st.copy', target: 'terminal', done: 'copy' },
    { id: 'exit', textKey: 'obj.st.exit', target: 'exit' },
  ],
  exit: { rect: [1455, 1060, 1545, 1120], x: 1500, y: 1095 },
};
