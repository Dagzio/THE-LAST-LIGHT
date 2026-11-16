// KILL LIST — location 1, level 1 "Office" (user decision D78, 2026-11-16: the first location is an office floor;
// the story / full level list is in NEW/NEW GAME.docx). Data only: geometry, doors, furniture, enemies, pickups and
// objectives in world units (x → east, y → south; 1 m ≈ 30 units). Built into the collision world by
// core/LevelWorld.js and into the 3D scene by render3d/OfficeScene.js.
//
// Flow: lobby (start, pistol) → corridor → security room (key card) → secure door → server room (the ORPHEUS drive)
// → reinforcements arrive → open-space → stairwell exit. Two crates: the SMG (archive) and 2 grenades (manager's
// office). Prop rotation `rot` = quarter turns: the prop's front faces south at 0, west at 1, north at 2, east at 3.
// D81: the furniture is drawn with the user's sprites (painted from the front) — big pieces face the camera (south),
// types without art were replaced by ones with art; `drawn: false` — a chair already painted in its table's / desk's
// sprite (it still collides).
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

  // rooms: floor material + the routing graph of the AI (zone → zone through doors / openings). D83: light — the
  // room's night mood (render3d/officeLights.js: warm / cool / dim ceiling lights, dark = only its own lamps / screens)
  zones: [
    { id: 'lobby', rect: [750, 1130, 1650, 1700], floor: 'marble', light: 'warm' },
    { id: 'corridor', rect: [250, 950, 2150, 1130], floor: 'tile_dark', light: 'dim' },
    { id: 'break', rect: [250, 1130, 750, 1450], floor: 'tile_light', light: 'warm' },
    { id: 'archive', rect: [250, 1450, 750, 1700], floor: 'concrete', light: 'dim' },
    { id: 'security', rect: [1650, 1130, 2150, 1450], floor: 'epoxy', light: 'dark' },
    { id: 'manager', rect: [1650, 1450, 2150, 1700], floor: 'walnut', light: 'dark' },
    { id: 'open', rect: [250, 250, 1300, 950], floor: 'carpet', light: 'cool' },
    { id: 'conference', rect: [1300, 250, 1800, 620], floor: 'oak', light: 'warm' },
    { id: 'print', rect: [1300, 620, 1800, 950], floor: 'tile_light', light: 'dim' },
    { id: 'server', rect: [1800, 250, 2150, 950], floor: 'access', light: 'dark' },
    { id: 'stairs', rect: [100, 300, 250, 500], floor: 'concrete', light: 'dim', wallLights: false },
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
    { type: 'chair', x: 1200, y: 1322, rot: 0, drawn: false },
    { type: 'armchair', x: 800, y: 1474, rot: 3 }, { type: 'armchair', x: 800, y: 1526, rot: 3 }, { type: 'coffee_table', x: 862, y: 1500 },
    { type: 'armchair', x: 925, y: 1458, rot: 1 }, { type: 'armchair', x: 925, y: 1542, rot: 1 },
    { type: 'armchair', x: 1600, y: 1474, rot: 1 }, { type: 'armchair', x: 1600, y: 1526, rot: 1 }, { type: 'coffee_table', x: 1538, y: 1500 },
    { type: 'armchair', x: 1475, y: 1458, rot: 3 }, { type: 'armchair', x: 1475, y: 1542, rot: 3 },
    { type: 'plant', x: 782, y: 1162 }, { type: 'plant', x: 1618, y: 1162 }, { type: 'plant', x: 782, y: 1668 },
    { type: 'plant', x: 1618, y: 1668 }, { type: 'plant', x: 1100, y: 1668 }, { type: 'plant', x: 1300, y: 1668 },
    { type: 'turnstile', x: 1060, y: 1140 }, { type: 'turnstile', x: 1150, y: 1140 },
    { type: 'turnstile', x: 1250, y: 1140 }, { type: 'turnstile', x: 1340, y: 1140 },
    { type: 'plant', x: 1622, y: 1300 },
    { type: 'rug_large', x: 862, y: 1500 }, { type: 'rug_large', x: 1538, y: 1500 },
    { type: 'papers', x: 1150, y: 1450, rot: 1 }, { type: 'overturned_chair', x: 1290, y: 1300, rot: 3 },
    // D83 (the level reference): floor lamps by the lounge corners, a desk lamp on the reception, more papers
    { type: 'floor_lamp', x: 862, y: 1430 }, { type: 'floor_lamp', x: 1538, y: 1430 },
    { type: 'floor_lamp', x: 780, y: 1600 }, { type: 'floor_lamp', x: 1620, y: 1600 },
    { type: 'desk_lamp', x: 1255, y: 1352, elev: 34 },
    { type: 'papers', x: 1330, y: 1415, rot: 2 }, { type: 'papers', x: 1010, y: 1610, rot: 3 },
    // --- corridor
    { type: 'elevator', x: 1500, y: 1118.5, rot: 2 }, { type: 'extinguisher', x: 700, y: 1121, rot: 2 },
    { type: 'plant', x: 272, y: 972 }, { type: 'plant', x: 2128, y: 972 }, { type: 'plant', x: 2128, y: 1108 },
    { type: 'plant', x: 900, y: 1108 },
    { type: 'wall_clock', x: 1590, y: 1121, rot: 2 }, { type: 'notice_board', x: 820, y: 1121, rot: 2 },
    // --- break room
    { type: 'vending', x: 300, y: 1158, rot: 0 }, { type: 'boxes', x: 352, y: 1155 },
    { type: 'coffee_counter', x: 650, y: 1152, rot: 0 }, { type: 'vending', x: 712, y: 1160, rot: 0 },
    { type: 'round_table', x: 450, y: 1290 },
    { type: 'chair_meeting', x: 450, y: 1258, rot: 0 }, { type: 'chair_meeting', x: 450, y: 1322, rot: 2 },
    { type: 'chair_meeting', x: 418, y: 1290, rot: 3 }, { type: 'chair_meeting', x: 482, y: 1290, rot: 1 },
    { type: 'round_table', x: 620, y: 1360 },
    { type: 'chair_meeting', x: 620, y: 1328, rot: 0 }, { type: 'overturned_chair', x: 660, y: 1400, rot: 1 },
    { type: 'plant', x: 722, y: 1422 },
    { type: 'wall_clock', x: 400, y: 1141.5, rot: 0 },
    { type: 'papers', x: 560, y: 1400, rot: 1 },
    // --- archive
    { type: 'archive_shelf', x: 420, y: 1540, rot: 0 }, { type: 'archive_shelf', x: 420, y: 1620, rot: 0 },
    { type: 'archive_shelf', x: 590, y: 1540, rot: 0 }, { type: 'archive_shelf', x: 590, y: 1620, rot: 0 },
    { type: 'filing_cabinet', x: 272, y: 1480, rot: 3 }, { type: 'filing_cabinet', x: 272, y: 1506, rot: 3 },
    { type: 'boxes', x: 290, y: 1670 }, { type: 'boxes_tall', x: 722, y: 1478 }, { type: 'trolley', x: 700, y: 1672 },
    { type: 'papers', x: 500, y: 1580 },
    // --- security
    { type: 'console', x: 2050, y: 1158, rot: 0 }, { type: 'chair', x: 2050, y: 1198, rot: 2, drawn: false },
    { type: 'filing_cabinet', x: 1672, y: 1380, rot: 3 }, { type: 'filing_cabinet', x: 1672, y: 1404, rot: 3 },
    { type: 'server_rack', x: 1675, y: 1170, rot: 3 }, { type: 'tv_wall', x: 1760, y: 1141.5, rot: 0 },
    { type: 'boxes', x: 2110, y: 1420 }, { type: 'broken_monitor', x: 1840, y: 1250, rot: 2 },
    { type: 'filing_cabinet', x: 1758, y: 1428, rot: 2 }, { type: 'filing_cabinet', x: 1780, y: 1428, rot: 2 },
    { type: 'filing_cabinet', x: 1802, y: 1428, rot: 2 },
    { type: 'alarm_light', x: 1960, y: 1141.5, rot: 0 }, { type: 'papers', x: 1900, y: 1330, rot: 2 },
    // --- manager
    { type: 'exec_desk', x: 1950, y: 1600, rot: 0 }, { type: 'chair', x: 1950, y: 1566, rot: 0 },
    { type: 'armchair', x: 1912, y: 1652, rot: 2 }, { type: 'armchair', x: 1988, y: 1652, rot: 2 },
    { type: 'bookcase', x: 1735, y: 1467, rot: 0 }, { type: 'bookcase', x: 1790, y: 1467, rot: 0 },
    { type: 'armchair', x: 1674, y: 1555, rot: 3 }, { type: 'armchair', x: 1674, y: 1607, rot: 3 },
    { type: 'plant', x: 2125, y: 1675 }, { type: 'plant', x: 1680, y: 1478 }, { type: 'plant', x: 2125, y: 1478 },
    { type: 'rug_small', x: 1950, y: 1570 }, { type: 'wall_clock', x: 2000, y: 1461.5, rot: 0 },
    { type: 'floor_lamp', x: 2122, y: 1560 }, { type: 'floor_lamp', x: 1700, y: 1500 },
    { type: 'desk_lamp', x: 1982, y: 1594, elev: 24 }, { type: 'papers', x: 1870, y: 1640, rot: 1 },
    // --- open space: six blocks of four workstations in two rows facing the camera (D81: the art shows their fronts)
    ...cluster(450, 400), ...cluster(750, 400), ...cluster(1050, 400),
    ...cluster(450, 680), ...cluster(750, 680), ...cluster(1050, 680),
    { type: 'whiteboard', x: 880, y: 268, rot: 0 }, { type: 'notice_board', x: 600, y: 261.5, rot: 0 },
    { type: 'printer', x: 1272, y: 860, rot: 1 }, { type: 'plant', x: 1278, y: 780 },
    { type: 'plant', x: 272, y: 272 }, { type: 'plant', x: 1278, y: 272 }, { type: 'plant', x: 272, y: 928 },
    { type: 'plant', x: 760, y: 928 }, { type: 'boxes', x: 300, y: 830 }, { type: 'boxes_tall', x: 300, y: 870 },
    { type: 'overturned_chair', x: 700, y: 545, rot: 2 }, { type: 'papers', x: 790, y: 560 },
    { type: 'broken_monitor', x: 620, y: 520, rot: 1 }, { type: 'exit_sign', x: 261.5, y: 400, rot: 3 },
    ...[600, 622, 644, 670, 692, 714].map((y) => ({ type: 'filing_cabinet', x: 272, y, rot: 3 })),
    { type: 'wall_clock', x: 1100, y: 261.5, rot: 0 },
    // D83 (the reference): planters with plants between the desk blocks (low cover), more papers, a second printer
    ...planter(600, 400), ...planter(900, 400), ...planter(600, 680), ...planter(900, 680),
    { type: 'papers', x: 1000, y: 770, rot: 2 }, { type: 'papers', x: 560, y: 790, rot: 1 }, { type: 'papers', x: 1180, y: 470 },
    { type: 'papers', x: 380, y: 520, rot: 3 }, { type: 'overturned_chair', x: 1150, y: 560, rot: 0 },
    { type: 'printer', x: 1272, y: 330, rot: 1 },
    // --- conference
    { type: 'conf_table', x: 1550, y: 435, rot: 0 },
    { type: 'chair_meeting', x: 1480, y: 385, rot: 0, drawn: false }, { type: 'chair_meeting', x: 1550, y: 385, rot: 0, drawn: false },
    { type: 'chair_meeting', x: 1620, y: 385, rot: 0, drawn: false }, { type: 'chair_meeting', x: 1480, y: 485, rot: 2, drawn: false },
    { type: 'chair_meeting', x: 1550, y: 485, rot: 2, drawn: false }, { type: 'chair_meeting', x: 1620, y: 485, rot: 2, drawn: false },
    { type: 'chair_meeting', x: 1432, y: 435, rot: 3, drawn: false }, { type: 'chair_meeting', x: 1668, y: 435, rot: 1, drawn: false },
    { type: 'tv_wall', x: 1550, y: 261.5, rot: 0 }, { type: 'plant', x: 1322, y: 272 }, { type: 'plant', x: 1778, y: 272 },
    { type: 'wall_clock', x: 1700, y: 261.5, rot: 0 },
    { type: 'floor_lamp', x: 1330, y: 590 }, { type: 'floor_lamp', x: 1770, y: 590 }, { type: 'papers', x: 1440, y: 545, rot: 1 },
    // --- print room
    { type: 'printer', x: 1323, y: 700, rot: 3 }, { type: 'printer', x: 1323, y: 780, rot: 3 },
    { type: 'archive_shelf', x: 1660, y: 639, rot: 0 }, { type: 'archive_shelf', x: 1740, y: 639, rot: 0 },
    { type: 'boxes', x: 1650, y: 700 }, { type: 'trolley', x: 1440, y: 900 }, { type: 'boxes_tall', x: 1322, y: 920 },
    { type: 'papers', x: 1460, y: 740, rot: 2 }, { type: 'papers', x: 1600, y: 860 }, { type: 'boxes', x: 1760, y: 920 },
    // --- server room
    ...rackRow(1890, 2112, 360), ...rackRow(1890, 2112, 520), ...rackRow(1890, 1994, 680),
    { type: 'terminal', x: 2097, y: 828, rot: 0 }, { type: 'chair', x: 2097, y: 800, rot: 0 },
    { type: 'boxes', x: 1830, y: 920 },
    // D83 (the reference): cable trays over the rack rows, red alarm lights
    { type: 'cable_tray', x: 2001, y: 360, len: 240 }, { type: 'cable_tray', x: 2001, y: 520, len: 240 }, { type: 'cable_tray', x: 1942, y: 680, len: 130 },
    { type: 'alarm_light', x: 1850, y: 261.5, rot: 0 }, { type: 'alarm_light', x: 2110, y: 261.5, rot: 0 },
    // --- stairwell
    { type: 'stairs', x: 175, y: 400, rot: 1 },
  ],

  // D83 (the level reference): signs of the attack and wear on the floors — t: atlas decal (render3d/OfficeScene.js
  // DECAL_TILES), w × d units, r — turn (rad). Presentation only.
  decals: [
    // lobby: a body was dragged from the reception, bloody prints to the corridor, scuffs on the marble
    { t: 'bloodSmear', x: 1330, y: 1440, w: 120, d: 60, r: 0.5 }, { t: 'blood', x: 1385, y: 1478, w: 70 },
    { t: 'prints', x: 1300, y: 1250, w: 110, d: 55, r: 1.9 }, { t: 'scuff', x: 1000, y: 1520, w: 120 },
    { t: 'scuff', x: 1420, y: 1610, w: 110, r: 1.2 }, { t: 'dirt', x: 1200, y: 1660, w: 160, d: 60 },
    // corridor
    { t: 'prints', x: 1150, y: 1060, w: 120, d: 55, r: 3.3 }, { t: 'blood', x: 1720, y: 1050, w: 55, r: 2 },
    { t: 'dirt', x: 600, y: 1040, w: 200, d: 80 }, { t: 'dirt', x: 1900, y: 1030, w: 180, d: 70 },
    // open space: the fight — blood by the overturned chairs, spilled coffee
    { t: 'blood', x: 735, y: 552, w: 80, r: 0.8 }, { t: 'bloodSmear', x: 800, y: 590, w: 100, d: 50, r: -0.3 },
    { t: 'coffee', x: 480, y: 525, w: 40 }, { t: 'coffee', x: 1110, y: 760, w: 34, r: 1 }, { t: 'scuff', x: 1000, y: 600, w: 110 },
    // break room, conference, print room
    { t: 'coffee', x: 520, y: 1380, w: 46 }, { t: 'blood', x: 640, y: 1420, w: 50, r: 2.5 }, { t: 'scuff', x: 420, y: 1200, w: 90 },
    { t: 'coffee', x: 1620, y: 540, w: 36 }, { t: 'dirt', x: 1550, y: 800, w: 160, d: 90 },
    // archive: the storage floor markings
    { t: 'marking', x: 505, y: 1500, w: 300, d: 12 }, { t: 'marking', x: 505, y: 1660, w: 300, d: 12 },
    { t: 'hazard', x: 285, y: 1580, w: 150, d: 36, r: Math.PI / 2 }, { t: 'hazard', x: 715, y: 1630, w: 100, d: 36, r: Math.PI / 2 },
    // security, manager, server room
    { t: 'blood', x: 2020, y: 1240, w: 60, r: 1.4 }, { t: 'scuff', x: 1800, y: 1300, w: 100 }, { t: 'coffee', x: 2050, y: 1660, w: 30 },
    { t: 'hazard', x: 1975, y: 930, w: 90, d: 30 }, { t: 'dirt', x: 1960, y: 600, w: 200, d: 80 },
  ],
  // D83: extra lights (render3d/officeLights.js kinds); the rooms' ceiling lights and the props' own glow come by themselves
  lights: [
    { x: 1850, y: 300, kind: 'red' }, { x: 2110, y: 300, kind: 'red' }, { x: 1960, y: 1180, kind: 'red' },
    { x: 1975, y: 920, kind: 'red', sx: 0.8, sz: 0.6 },
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
    { type: 'thug', x: 1850, y: 1610, angle: -Math.PI / 2, busy: true }, // D83: going through the manager's files
    { type: 'thug', x: 300, y: 540, angle: 0, patrol: [[300, 540], [1200, 540]] },
    { type: 'gunman', x: 1150, y: 840, angle: Math.PI },
    { type: 'thug', x: 350, y: 300, angle: 0, busy: true }, // D83: going through the files
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

/** Four workstations in two rows around (cx, cy), all facing the camera (south), each chair behind its desk. */
function cluster(cx, cy) {
  const out = [];
  for (const dy of [-36, 36]) for (const dx of [-31, 31]) {
    out.push({ type: 'workstation', x: cx + dx, y: cy + dy, rot: 0 }, { type: 'chair', x: cx + dx, y: cy + dy - 28, rot: 0 });
  }
  return out;
}

/** D83: a planter (north–south, low cover) with two plants standing on it (drawn only: the planter collides). */
function planter(x, y) {
  return [
    { type: 'planter', x, y, rot: 1 },
    { type: 'plant', x, y: y - 16, elev: 20, solid: false },
    { type: 'plant', x, y: y + 16, elev: 20, solid: false },
  ];
}

/** A row of server racks facing south from x0 to x1 at y. */
function rackRow(x0, x1, y) {
  const out = [];
  let i = 0;
  for (let x = x0; x <= x1; x += 26, i++) out.push({ type: i % 3 === 1 ? 'server_rack_open' : 'server_rack', x, y, rot: 0 });
  return out;
}
