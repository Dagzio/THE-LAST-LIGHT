// KILL LIST — location 1, level 1 "Office" (user decision D78, 2026-11-16: the first location is an office floor;
// the story / full level list is in NEW/NEW GAME.docx). Data only: geometry, doors, furniture, enemies, pickups and
// objectives in world units (x → east, y → south; 1 m ≈ 30 units). Built into the collision world by
// core/LevelWorld.js and into the 3D scene by render3d/OfficeScene.js.
//
// Flow: lobby (start, pistol) → corridor → security room (key card) → secure door → server room (the ORPHEUS drive)
// → reinforcements arrive → open-space → stairwell exit. Two crates: the SMG (archive) and 2 grenades (manager's
// office). Prop rotation `rot` = quarter turns: the prop's front faces south at 0, west at 1, north at 2, east at 3.
const W = (x0, y0, x1, y1, style, gaps = []) => ({ x0, y0, x1, y1, style, gaps });

export const OFFICE = {
  id: 'office',
  nameKey: 'level.office.name',
  descKey: 'level.office.desc',
  location: 'office',
  width: 2250,
  height: 1800,
  wallHeight: 78,
  wallThickness: 20,
  playerSpawn: { x: 1200, y: 1630, angle: -Math.PI / 2 },

  // rooms: floor material + the routing graph of the AI (zone → zone through doors / openings)
  zones: [
    { id: 'lobby', rect: [750, 1130, 1650, 1700], floor: 'marble' },
    { id: 'corridor', rect: [250, 950, 2150, 1130], floor: 'tile_dark' },
    { id: 'break', rect: [250, 1130, 750, 1450], floor: 'tile_light' },
    { id: 'archive', rect: [250, 1450, 750, 1700], floor: 'concrete' },
    { id: 'security', rect: [1650, 1130, 2150, 1450], floor: 'epoxy' },
    { id: 'manager', rect: [1650, 1450, 2150, 1700], floor: 'walnut' },
    { id: 'open', rect: [250, 250, 1300, 950], floor: 'carpet' },
    { id: 'conference', rect: [1300, 250, 1800, 620], floor: 'oak' },
    { id: 'print', rect: [1300, 620, 1800, 950], floor: 'tile_light' },
    { id: 'server', rect: [1800, 250, 2150, 950], floor: 'access' },
    { id: 'stairs', rect: [100, 300, 250, 500], floor: 'concrete' },
  ],

  // walls: axis-aligned lines (centre line, thickness above) with gaps [from, to] along the line for doors / openings
  walls: [
    W(250, 250, 2150, 250, 'ext'),
    W(250, 950, 1300, 950, 'int', [[440, 560], [940, 1060]]),
    W(1300, 950, 1800, 950, 'int', [[1510, 1590]]),
    W(1800, 950, 2150, 950, 'steel', [[1935, 2015]]),
    W(1300, 620, 1800, 620, 'glass', [[1510, 1590]]),
    W(250, 1130, 2150, 1130, 'int', [[460, 540], [1050, 1350], [1860, 1940]]),
    W(250, 1450, 750, 1450, 'int', [[460, 540]]),
    W(1650, 1450, 2150, 1450, 'int', [[1860, 1940]]),
    W(250, 1700, 2150, 1700, 'ext', [[1140, 1260]]),
    W(100, 300, 250, 300, 'ext'),
    W(100, 500, 250, 500, 'ext'),
    W(250, 250, 250, 1700, 'ext', [[360, 440]]),
    W(100, 300, 100, 500, 'ext'),
    W(2150, 250, 2150, 1700, 'ext'),
    W(1300, 250, 1300, 620, 'acoustic', [[390, 470]]),
    W(1300, 620, 1300, 950, 'int'),
    W(1800, 250, 1800, 950, 'steel'),
    W(750, 1130, 750, 1700, 'warm'),
    W(1650, 1130, 1650, 1700, 'warm'),
  ],

  // doors in the wall gaps: axis 'x' = the door spans along x (a horizontal wall). lock: null (opens for anyone
  // near), 'keycard' / 'drive' (opens once the player has it), 'never' (decoration). kind → look.
  doors: [
    { id: 'break', x: 500, y: 1130, axis: 'x', width: 80, kind: 'wood', zones: ['corridor', 'break'] },
    { id: 'archive', x: 500, y: 1450, axis: 'x', width: 80, kind: 'wood', zones: ['break', 'archive'] },
    { id: 'security', x: 1900, y: 1130, axis: 'x', width: 80, kind: 'metal', zones: ['corridor', 'security'] },
    { id: 'manager', x: 1900, y: 1450, axis: 'x', width: 80, kind: 'wood', zones: ['security', 'manager'] },
    { id: 'print', x: 1550, y: 950, axis: 'x', width: 80, kind: 'wood', zones: ['corridor', 'print'] },
    { id: 'server', x: 1975, y: 950, axis: 'x', width: 80, kind: 'secure', lock: 'keycard', zones: ['corridor', 'server'] },
    { id: 'confprint', x: 1550, y: 620, axis: 'x', width: 80, kind: 'glass', zones: ['conference', 'print'] },
    { id: 'confopen', x: 1300, y: 430, axis: 'y', width: 80, kind: 'wood', zones: ['open', 'conference'] },
    { id: 'exit', x: 250, y: 400, axis: 'y', width: 80, kind: 'secure', lock: 'drive', zones: ['open', 'stairs'] },
    { id: 'entrance', x: 1200, y: 1700, axis: 'x', width: 120, kind: 'glass', lock: 'never', zones: [] },
  ],
  // gaps without a door (routing only)
  openings: [
    { x: 500, y: 950, zones: ['open', 'corridor'] },
    { x: 1000, y: 950, zones: ['open', 'corridor'] },
    { x: 1200, y: 1130, zones: ['corridor', 'lobby'] },
  ],

  props: [
    // --- lobby
    { type: 'reception', x: 1200, y: 1360, rot: 0 },
    { type: 'chair', x: 1200, y: 1322, rot: 0 },
    { type: 'sofa', x: 800, y: 1500, rot: 3 }, { type: 'coffee_table', x: 862, y: 1500 },
    { type: 'armchair', x: 925, y: 1458, rot: 1 }, { type: 'armchair', x: 925, y: 1542, rot: 1 },
    { type: 'sofa', x: 1600, y: 1500, rot: 1 }, { type: 'coffee_table', x: 1538, y: 1500 },
    { type: 'armchair', x: 1475, y: 1458, rot: 3 }, { type: 'armchair', x: 1475, y: 1542, rot: 3 },
    { type: 'plant', x: 782, y: 1162 }, { type: 'plant', x: 1618, y: 1162 }, { type: 'plant', x: 782, y: 1668 },
    { type: 'plant', x: 1618, y: 1668 }, { type: 'plant', x: 1100, y: 1668 }, { type: 'plant', x: 1300, y: 1668 },
    { type: 'turnstile', x: 1060, y: 1140 }, { type: 'turnstile', x: 1150, y: 1140 },
    { type: 'turnstile', x: 1250, y: 1140 }, { type: 'turnstile', x: 1340, y: 1140 },
    { type: 'water_cooler', x: 1622, y: 1300 },
    { type: 'papers', x: 1150, y: 1450, rot: 1 }, { type: 'overturned_chair', x: 1290, y: 1300, rot: 3 },
    // --- corridor
    { type: 'elevator', x: 1500, y: 1118.5, rot: 2 }, { type: 'extinguisher', x: 700, y: 1121, rot: 2 },
    { type: 'plant', x: 272, y: 972 }, { type: 'plant', x: 2128, y: 972 }, { type: 'plant', x: 2128, y: 1108 },
    { type: 'plant', x: 900, y: 1108 }, { type: 'bin', x: 1640, y: 1118 },
    // --- break room
    { type: 'kitchen_counter', x: 272, y: 1290, rot: 3 }, { type: 'fridge', x: 274, y: 1172, rot: 3 },
    { type: 'coffee_counter', x: 650, y: 1152, rot: 0 }, { type: 'vending', x: 712, y: 1160, rot: 0 },
    { type: 'round_table', x: 450, y: 1290 },
    { type: 'chair_meeting', x: 450, y: 1258, rot: 0 }, { type: 'chair_meeting', x: 450, y: 1322, rot: 2 },
    { type: 'chair_meeting', x: 418, y: 1290, rot: 3 }, { type: 'chair_meeting', x: 482, y: 1290, rot: 1 },
    { type: 'round_table', x: 620, y: 1360 },
    { type: 'chair_meeting', x: 620, y: 1328, rot: 0 }, { type: 'overturned_chair', x: 660, y: 1400, rot: 1 },
    { type: 'plant', x: 722, y: 1422 }, { type: 'bin', x: 300, y: 1230 },
    // --- archive
    { type: 'archive_shelf', x: 420, y: 1540, rot: 0 }, { type: 'archive_shelf', x: 420, y: 1620, rot: 0 },
    { type: 'archive_shelf', x: 590, y: 1540, rot: 0 }, { type: 'archive_shelf', x: 590, y: 1620, rot: 0 },
    { type: 'filing_cabinet', x: 272, y: 1480, rot: 3 }, { type: 'filing_cabinet', x: 272, y: 1506, rot: 3 },
    { type: 'boxes', x: 290, y: 1670 }, { type: 'boxes_tall', x: 722, y: 1478 }, { type: 'trolley', x: 700, y: 1672 },
    { type: 'papers', x: 500, y: 1580 },
    // --- security
    { type: 'console', x: 2112, y: 1290, rot: 1 }, { type: 'chair', x: 2066, y: 1290, rot: 3 },
    { type: 'filing_cabinet', x: 1672, y: 1380, rot: 3 }, { type: 'filing_cabinet', x: 1672, y: 1404, rot: 3 },
    { type: 'server_rack', x: 1675, y: 1170, rot: 3 }, { type: 'tv_wall', x: 1760, y: 1141.5, rot: 0 },
    { type: 'boxes', x: 2110, y: 1420 }, { type: 'broken_monitor', x: 1990, y: 1200, rot: 2 },
    // --- manager
    { type: 'exec_desk', x: 1950, y: 1600, rot: 0 }, { type: 'chair', x: 1950, y: 1640, rot: 2 },
    { type: 'armchair', x: 1915, y: 1545, rot: 0 }, { type: 'armchair', x: 1985, y: 1545, rot: 0 },
    { type: 'bookcase', x: 2133, y: 1540, rot: 1 }, { type: 'bookcase', x: 2133, y: 1610, rot: 1 },
    { type: 'sofa', x: 1673, y: 1580, rot: 3 }, { type: 'plant', x: 2125, y: 1675 }, { type: 'plant', x: 1680, y: 1478 },
    // --- open space: six clusters of four workstations (back to back), chairs facing the screens
    ...cluster(450, 400), ...cluster(750, 400), ...cluster(1050, 400),
    ...cluster(450, 680), ...cluster(750, 680), ...cluster(1050, 680),
    { type: 'whiteboard', x: 880, y: 268, rot: 0 }, { type: 'notice_board', x: 600, y: 261.5, rot: 0 },
    { type: 'printer', x: 1272, y: 860, rot: 1 }, { type: 'water_cooler', x: 1280, y: 780 },
    { type: 'plant', x: 272, y: 272 }, { type: 'plant', x: 1278, y: 272 }, { type: 'plant', x: 272, y: 928 },
    { type: 'plant', x: 760, y: 928 }, { type: 'boxes', x: 300, y: 830 }, { type: 'boxes_tall', x: 300, y: 870 },
    { type: 'overturned_chair', x: 700, y: 545, rot: 2 }, { type: 'papers', x: 790, y: 560 },
    { type: 'broken_monitor', x: 620, y: 520, rot: 1 }, { type: 'exit_sign', x: 261.5, y: 400, rot: 3 },
    // --- conference
    { type: 'conf_table', x: 1550, y: 435, rot: 0 },
    { type: 'chair_meeting', x: 1480, y: 385, rot: 0 }, { type: 'chair_meeting', x: 1550, y: 385, rot: 0 },
    { type: 'chair_meeting', x: 1620, y: 385, rot: 0 }, { type: 'chair_meeting', x: 1480, y: 485, rot: 2 },
    { type: 'chair_meeting', x: 1550, y: 485, rot: 2 }, { type: 'chair_meeting', x: 1620, y: 485, rot: 2 },
    { type: 'chair_meeting', x: 1432, y: 435, rot: 3 }, { type: 'chair_meeting', x: 1668, y: 435, rot: 1 },
    { type: 'tv_wall', x: 1550, y: 261.5, rot: 0 }, { type: 'plant', x: 1322, y: 272 }, { type: 'plant', x: 1778, y: 272 },
    // --- print room
    { type: 'printer', x: 1323, y: 700, rot: 3 }, { type: 'printer', x: 1323, y: 780, rot: 3 },
    { type: 'archive_shelf', x: 1781, y: 720, rot: 1 }, { type: 'archive_shelf', x: 1781, y: 850, rot: 1 },
    { type: 'boxes', x: 1650, y: 700 }, { type: 'trolley', x: 1440, y: 900 }, { type: 'boxes_tall', x: 1322, y: 920 },
    // --- server room
    ...rackRow(1890, 2112, 360), ...rackRow(1890, 2112, 520), ...rackRow(1890, 1994, 680),
    { type: 'terminal', x: 2124, y: 860, rot: 1 }, { type: 'chair', x: 2088, y: 860, rot: 3 },
    { type: 'boxes', x: 1830, y: 920 },
    // --- stairwell
    { type: 'stairs', x: 175, y: 400, rot: 1 },
  ],

  // enemies: type (data/humans.js), post, facing (rad: 0 east, π/2 south, π west, −π/2 north), optional patrol loop
  enemies: [
    { type: 'thug', x: 980, y: 1250, angle: 0, patrol: [[980, 1250], [1420, 1250]] },
    { type: 'thug', x: 1560, y: 1390, angle: Math.PI },
    { type: 'gunman', x: 400, y: 1040, angle: 0, patrol: [[400, 1040], [1750, 1040]] },
    { type: 'thug', x: 560, y: 1230, angle: Math.PI / 2 },
    { type: 'thug', x: 330, y: 1580, angle: 0, patrol: [[330, 1580], [690, 1580]] },
    { type: 'heavy', x: 1990, y: 1300, angle: Math.PI, carries: null },
    { type: 'gunman', x: 1750, y: 1250, angle: Math.PI / 2, patrol: [[1750, 1250], [1750, 1400]] },
    { type: 'thug', x: 1850, y: 1610, angle: -Math.PI / 2 },
    { type: 'thug', x: 300, y: 540, angle: 0, patrol: [[300, 540], [1200, 540]] },
    { type: 'gunman', x: 1150, y: 840, angle: Math.PI },
    { type: 'thug', x: 350, y: 300, angle: 0 },
    { type: 'gunman', x: 600, y: 840, angle: 0, patrol: [[600, 840], [1100, 840]] },
    { type: 'thug', x: 1700, y: 330, angle: Math.PI },
    { type: 'thug', x: 1380, y: 560, angle: -Math.PI / 4 },
    { type: 'gunman', x: 1400, y: 800, angle: 0, patrol: [[1400, 800], [1700, 800]] },
    { type: 'gunman', x: 1840, y: 450, angle: Math.PI / 2, patrol: [[1840, 440], [1840, 800]] },
    { type: 'gunman', x: 2000, y: 770, angle: Math.PI / 2 },
  ],
  // after the drive is taken (the "turn" of the level): they come in already hunting the player
  reinforcements: {
    after: 'drive',
    enemies: [
      { type: 'gunman', x: 165, y: 345, angle: 0 },
      { type: 'gunman', x: 165, y: 455, angle: 0 },
      { type: 'heavy', x: 1200, y: 1250, angle: -Math.PI / 2 },
    ],
  },

  pickups: [
    { id: 'crate_smg', kind: 'crate', item: 'smg', x: 690, y: 1585 },
    { id: 'crate_grenades', kind: 'crate', item: 'grenades', count: 2, x: 1700, y: 1662 },
    { id: 'medkit_break', kind: 'medkit', x: 300, y: 1410 },
    { id: 'medkit_open', kind: 'medkit', x: 1000, y: 545 },
    { id: 'keycard', kind: 'keycard', x: 2080, y: 1290 },
    { id: 'drive', kind: 'drive', x: 2097, y: 860 },
  ],

  // objectives in order; `done` — the run fact that completes it
  objectives: [
    { id: 'keycard', textKey: 'obj.keycard', target: 'keycard' },
    { id: 'drive', textKey: 'obj.drive', target: 'drive' },
    { id: 'exit', textKey: 'obj.exit', target: 'exit' },
  ],
  exit: { rect: [110, 310, 240, 490], x: 175, y: 400 },
};

/** Four workstations back to back around (cx, cy) with their chairs. */
function cluster(cx, cy) {
  const out = [];
  for (const dx of [-31, 31]) {
    out.push({ type: 'workstation', x: cx + dx, y: cy - 16, rot: 2 }, { type: 'chair', x: cx + dx, y: cy - 46, rot: 0 });
    out.push({ type: 'workstation', x: cx + dx, y: cy + 16, rot: 0 }, { type: 'chair', x: cx + dx, y: cy + 46, rot: 2 });
  }
  return out;
}

/** A row of server racks facing south from x0 to x1 at y. */
function rackRow(x0, x1, y) {
  const out = [];
  let i = 0;
  for (let x = x0; x <= x1; x += 26, i++) out.push({ type: i % 3 === 1 ? 'server_rack_open' : 'server_rack', x, y, rot: 0 });
  return out;
}
