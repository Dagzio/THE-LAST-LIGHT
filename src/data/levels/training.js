// D88 (user request): the training ground — a short tutorial level before the office. Every mechanic of the game, one
// yard at a time (the lessons: data/tutorial.js, the rules: systems/TutorialDirector.js). Built like the office from
// the user's art (NEW/tutorial: the 5-view object sheets, the ground atlas; reference NEW/tutorial/sprites/reference/
// level.png — eight yards round a field, fenced paths between them). Adapted to the game's mechanics: the reference's
// "lie down" yard (there is no prone in the game) is the ROLL yard — a dive roll across the blue mat; the yards are
// rectangles (the AI routes through rooms), the winding paths straight.
//
// The way (clockwise from the armory): A armory (start: take the SMG and the M4A1) → B range (shoot the targets with
// each gun, switch, reload, take rounds) → C cover yard (low cover, the corner peek of high cover, rounds from the
// bodies) → D stealth yard (sneak up, takedown) → E grenade yard → F roll yard → G ambush (they shoot back) → H medic
// (the medkit) → the south gate. Every gate opens when its lesson is done.
import { TUTORIAL } from '../tutorial.js';

const W = (x0, y0, x1, y1, style, gaps = []) => ({ x0, y0, x1, y1, style, gaps });
const G = (id, x, y, axis, zones) => ({ id, x, y, axis, width: 90, kind: 'gate', lock: 'step', zones });
const Y = 'yard', F = 'fence';

export const TRAINING = {
  id: 'training',
  nameKey: 'level.training.name',
  descKey: 'level.training.desc',
  location: 'training',
  preview: 'assets/ui/previews/training.webp', // D90: the user's card art (NEW/previewTutorial.png)
  alwaysOpen: true,          // never locked (the first level; a save made before it existed still sees it)
  fixedMode: 'tutorial',     // data/modes.js: one mode — the lessons
  outdoor: true,             // render: no night windows / wall lamps / baseboards; the ground goes on outside
  outside: 'grass',
  enemyModel: 'enemyTraining', // D89: the user's training enemy model (data/humanModels.js), the office one elsewhere
  noXray: true,                // D90 (user): no X-ray silhouette of the hero through the walls here
  footsteps: 'steps1',         // D89: the user's second steps recording (data/sounds.js LEVEL_FOOTSTEPS)
  lighting: { hemi: 1.15, key: 1.55, exposure: 1.0, sky: 0xe4eeff, ground: 0x55663a, sun: 0xfff0d6, background: 0x6c8748 },
  width: 2400,
  height: 1800,
  wallHeight: 46,
  wallThickness: 16,
  playerSpawn: { x: 400, y: 1560, angle: -Math.PI / 2 },
  bodyFade: Infinity,

  zones: [
    { id: 'armory', rect: [160, 1200, 640, 1640], floor: 'dirt', light: 'day' },
    { id: 'range', rect: [160, 680, 640, 1080], floor: 'sand', light: 'day' },
    { id: 'cover', rect: [160, 120, 760, 560], floor: 'dirt', light: 'day' },
    { id: 'stealth', rect: [920, 120, 1520, 600], floor: 'grass_soil', light: 'day' },
    { id: 'grenade', rect: [1700, 120, 2240, 560], floor: 'sand', light: 'day' },
    { id: 'roll', rect: [1740, 700, 2240, 1080], floor: 'pavers', light: 'day' },
    { id: 'ambush', rect: [1740, 1200, 2240, 1640], floor: 'dirt', light: 'day' },
    { id: 'medic', rect: [960, 1200, 1440, 1640], floor: 'yard_concrete', light: 'day' },
    { id: 'p1', rect: [355, 1080, 445, 1200], floor: 'gravel', light: 'day' },
    { id: 'p2', rect: [355, 560, 445, 680], floor: 'gravel', light: 'day' },
    { id: 'p3', rect: [760, 295, 920, 385], floor: 'gravel', light: 'day' },
    { id: 'p4', rect: [1520, 295, 1700, 385], floor: 'gravel', light: 'day' },
    { id: 'p5', rect: [1945, 560, 2035, 700], floor: 'gravel', light: 'day' },
    { id: 'p6', rect: [1945, 1080, 2035, 1200], floor: 'gravel', light: 'day' },
    { id: 'p7', rect: [1440, 1375, 1740, 1465], floor: 'gravel', light: 'day' },
    { id: 'exit', rect: [1155, 1640, 1245, 1790], floor: 'gravel', light: 'day' },
  ],

  walls: [
    // A armory
    W(160, 1200, 640, 1200, Y, [[355, 445]]), W(160, 1640, 640, 1640, Y), W(160, 1200, 160, 1640, Y), W(640, 1200, 640, 1640, Y),
    // B range
    W(160, 680, 640, 680, Y, [[355, 445]]), W(160, 1080, 640, 1080, Y, [[355, 445]]), W(160, 680, 160, 1080, Y), W(640, 680, 640, 1080, Y),
    // C cover yard (+ a free-standing wall: the high cover with corners)
    W(160, 120, 760, 120, Y), W(160, 560, 760, 560, Y, [[355, 445]]), W(160, 120, 160, 560, Y), W(760, 120, 760, 560, Y, [[295, 385]]),
    W(540, 430, 680, 430, Y),
    // D stealth yard
    W(920, 120, 1520, 120, Y), W(920, 600, 1520, 600, Y), W(920, 120, 920, 600, Y, [[295, 385]]), W(1520, 120, 1520, 600, Y, [[295, 385]]),
    // E grenade yard
    W(1700, 120, 2240, 120, Y), W(1700, 560, 2240, 560, Y, [[1945, 2035]]), W(1700, 120, 1700, 560, Y, [[295, 385]]), W(2240, 120, 2240, 560, Y),
    // F roll yard
    W(1740, 700, 2240, 700, Y, [[1945, 2035]]), W(1740, 1080, 2240, 1080, Y, [[1945, 2035]]), W(1740, 700, 1740, 1080, Y), W(2240, 700, 2240, 1080, Y),
    // G ambush
    W(1740, 1200, 2240, 1200, Y, [[1945, 2035]]), W(1740, 1640, 2240, 1640, Y), W(1740, 1200, 1740, 1640, Y, [[1375, 1465]]), W(2240, 1200, 2240, 1640, Y),
    // H medic
    W(960, 1200, 1440, 1200, Y), W(960, 1640, 1440, 1640, Y, [[1155, 1245]]), W(960, 1200, 960, 1640, Y), W(1440, 1200, 1440, 1640, Y, [[1375, 1465]]),
    // the fenced paths
    W(355, 1080, 355, 1200, F), W(445, 1080, 445, 1200, F),
    W(355, 560, 355, 680, F), W(445, 560, 445, 680, F),
    W(760, 295, 920, 295, F), W(760, 385, 920, 385, F),
    W(1520, 295, 1700, 295, F), W(1520, 385, 1700, 385, F),
    W(1945, 560, 1945, 700, F), W(2035, 560, 2035, 700, F),
    W(1945, 1080, 1945, 1200, F), W(2035, 1080, 2035, 1200, F),
    W(1440, 1375, 1740, 1375, F), W(1440, 1465, 1740, 1465, F),
    W(1155, 1640, 1155, 1790, F), W(1245, 1640, 1245, 1790, F),
  ],

  // the gates: locked until their lesson is done (the tutorial opens them)
  doors: [
    G('gA', 400, 1200, 'x', ['armory', 'p1']),
    G('gB', 400, 680, 'x', ['range', 'p2']),
    G('gC', 760, 340, 'y', ['cover', 'p3']),
    G('gD', 1520, 340, 'y', ['stealth', 'p4']),
    G('gE', 1990, 560, 'x', ['grenade', 'p5']),
    G('gF', 1990, 1080, 'x', ['roll', 'p6']),
    G('gG', 1740, 1420, 'y', ['ambush', 'p7']),
    G('gH', 1200, 1640, 'x', ['medic', 'exit']),
  ],
  openings: [
    { x: 400, y: 1080, zones: ['p1', 'range'] },
    { x: 400, y: 560, zones: ['p2', 'cover'] },
    { x: 920, y: 340, zones: ['p3', 'stealth'] },
    { x: 1700, y: 340, zones: ['p4', 'grenade'] },
    { x: 1990, y: 700, zones: ['p5', 'roll'] },
    { x: 1990, y: 1200, zones: ['p6', 'ambush'] },
    { x: 1440, y: 1420, zones: ['p7', 'medic'] },
  ],

  props: [
    // --- A armory: two open weapon chests (SMG, M4A1), a workbench, cases, a canopy
    { type: 'weapon_chest_open', x: 290, y: 1320, rot: 0 }, { type: 'weapon_chest_open', x: 500, y: 1320, rot: 0 },
    { type: 'canopy', x: 250, y: 1555 }, // D89: over the cases, not over the SMG chest (it hid the chest)
    { type: 'workbench', x: 600, y: 1480, rot: 1 }, { type: 'ammo_box', x: 600, y: 1460, rot: 1, elev: 24 }, { type: 'ammo_box', x: 600, y: 1500, rot: 1, elev: 24 },
    { type: 'equipment_case', x: 200, y: 1600 }, { type: 'crate_wood', x: 600, y: 1610 }, { type: 'barrel', x: 190, y: 1450 }, { type: 'barrel', x: 190, y: 1480 },
    { type: 'signal_green', x: 460, y: 1215 },
    // --- B range: targets along the north line, a sandbag backstop, the ammo table
    { type: 'sandbags', x: 270, y: 712 }, { type: 'sandbags', x: 530, y: 712 },
    // D89: the lane to gate B (x 355…445) is kept free — no target stands in the way out
    { type: 'round_target', x: 205, y: 760, target: true }, { type: 'torso_target', x: 265, y: 770, target: true },
    { type: 'round_target', x: 325, y: 760, target: true }, { type: 'torso_target', x: 475, y: 770, target: true },
    { type: 'round_target', x: 535, y: 760, target: true }, { type: 'torso_target', x: 595, y: 770, target: true },
    { type: 'workbench', x: 560, y: 990, rot: 0 }, { type: 'ammo_box', x: 545, y: 990, elev: 24 }, { type: 'ammo_box', x: 575, y: 992, elev: 24 },
    { type: 'barrel', x: 190, y: 1040 }, { type: 'signal_amber', x: 460, y: 695 },
    // --- C cover yard: low covers near the gate, sandbags before the two dummies, the free-standing wall (high cover)
    // D89: sandbags / dummies ~150 from the covers (were ~300: off the top of the screen from the lesson's spot)
    { type: 'concrete_cover', x: 280, y: 440 }, { type: 'steel_cover', x: 460, y: 200 },
    // the second dummy: hidden from the back of the free-standing wall, in sight once leaned out of its east corner
    { type: 'sandbags', x: 290, y: 360 }, { type: 'sandbags', x: 690, y: 362 },
    { type: 'barrel', x: 720, y: 520 }, { type: 'crate_wood', x: 190, y: 160 }, { type: 'signal_amber', x: 745, y: 405 },
    // --- D stealth yard: crates, screens, a tent — places to sneak between
    { type: 'crate_wood', x: 1090, y: 410 }, { type: 'crate_wood', x: 1122, y: 440 }, { type: 'crate_wood_tall', x: 1180, y: 320 },
    { type: 'fabric_screen', x: 1010, y: 500, rot: 1 }, { type: 'fabric_screen', x: 1320, y: 300 }, { type: 'tent', x: 1440, y: 480 },
    { type: 'crate_wood', x: 1400, y: 300 }, { type: 'barrel', x: 960, y: 160 }, { type: 'signal_amber', x: 1505, y: 405 },
    // --- E grenade yard: three dummies behind sandbags, the open grenade chest
    { type: 'sandbags', x: 2110, y: 340 }, { type: 'sandbags', x: 2020, y: 340 },
    { type: 'supply_chest_open', x: 1800, y: 490, rot: 0 }, { type: 'barrel', x: 1730, y: 160 }, { type: 'crate_wood', x: 2200, y: 520 },
    { type: 'signal_amber', x: 2050, y: 545 },
    // --- F roll yard: jersey barriers, hurdles, the blue mats (roll across them)
    { type: 'blue_mat', x: 1960, y: 890 }, { type: 'blue_mat', x: 2020, y: 890 },
    { type: 'jersey_barrier', x: 1850, y: 830, rot: 1 }, { type: 'jersey_barrier', x: 2130, y: 830, rot: 1 },
    { type: 'jersey_barrier', x: 1850, y: 960, rot: 1 }, { type: 'jersey_barrier', x: 2130, y: 960, rot: 1 },
    { type: 'blue_hurdle', x: 1800, y: 1040 }, { type: 'blue_hurdle', x: 2180, y: 740 },
    { type: 'barrel', x: 2210, y: 1040 }, { type: 'barrel', x: 1770, y: 730 }, { type: 'signal_amber', x: 2050, y: 1065 },
    // --- G ambush: crates and barriers to fight from
    { type: 'jersey_barrier', x: 1990, y: 1320 }, { type: 'crate_wood', x: 1880, y: 1395 }, { type: 'crate_wood', x: 2110, y: 1390 },
    { type: 'crate_wood_tall', x: 1820, y: 1580 }, { type: 'supply_chest', x: 2170, y: 1600 }, { type: 'equipment_case', x: 1780, y: 1260 },
    { type: 'signal_amber', x: 1755, y: 1485 },
    // --- H medic: the medical table, a tent, a canopy
    { type: 'workbench', x: 1150, y: 1330, rot: 0 }, { type: 'medical_case', x: 1135, y: 1330, elev: 24 }, { type: 'small_medkit', x: 1170, y: 1335, elev: 24 },
    { type: 'tent', x: 1030, y: 1270 }, { type: 'canopy', x: 1330, y: 1290 }, { type: 'equipment_case', x: 1390, y: 1600 },
    { type: 'signal_amber', x: 1260, y: 1625 },
    // --- the field round the yards (outside the walls): trees, bushes, rocks, grass
    ...[[820, 760], [1100, 820], [1400, 760], [1640, 900], [880, 1080], [1250, 1050], [1560, 1120], [760, 1500], [700, 900],
      [60, 300], [60, 900], [60, 1500], [2340, 300], [2340, 900], [2340, 1500], [800, 60], [1600, 60], [500, 1740], [1700, 1740], [2100, 1740]]
      .map(([x, y]) => ({ type: 'tree', x, y })),
    ...[[960, 700], [1180, 940], [1500, 980], [820, 1200], [1620, 1300], [880, 1650], [2300, 600], [100, 650], [1450, 680]]
      .map(([x, y], i) => ({ type: i % 3 === 2 ? 'boulder' : 'bush', x, y })),
    ...[[1000, 900], [1320, 920], [1700, 1000], [780, 1300], [900, 1400], [1600, 660], [1300, 700], [1040, 1100]]
      .map(([x, y], i) => ({ type: i % 2 ? 'flowers' : 'grass_tuft', x, y })),
  ],

  // dummies: stand still, never shoot; the stealth guards walk, see (stealth rules) but never shoot; the ambush shoots.
  // D89 bulletProof: the takedown guards and the grenade dummies are felled only the way their lesson teaches; the cover
  // dummies take rounds only in their own lesson (TutorialDirector); the ambush is dormant (a dummy) until the hero walks in
  enemies: [
    { type: 'thug', x: 290, y: 325, angle: Math.PI / 2, dummy: true, bulletProof: true, tag: 'cover1' },
    { type: 'gunman', x: 705, y: 325, angle: Math.PI / 2, dummy: true, bulletProof: true, tag: 'cover2' },
    { type: 'thug', x: 1000, y: 200, angle: 0, harmless: true, bulletProof: true, tag: 'stealth', patrol: [[1000, 200, 1.6, 0], [1440, 200, 1.6, Math.PI / 2]] },
    { type: 'thug', x: 1250, y: 530, angle: 0, harmless: true, bulletProof: true, tag: 'stealth' },
    { type: 'thug', x: 2080, y: 290, angle: Math.PI / 2, dummy: true, bulletProof: true, tag: 'grenade' },
    { type: 'thug', x: 2120, y: 310, angle: Math.PI / 2, dummy: true, bulletProof: true, tag: 'grenade' },
    { type: 'thug', x: 2160, y: 285, angle: Math.PI / 2, dummy: true, bulletProof: true, tag: 'grenade' },
    // D89: behind the two crates, on the screen as the hero walks in (were by the south wall, off the screen)
    { type: 'thug', x: 1880, y: 1435, angle: -Math.PI / 2, dummy: true, bulletProof: true, noCone: true, tag: 'ambush' },
    { type: 'thug', x: 2110, y: 1430, angle: -Math.PI / 2, dummy: true, bulletProof: true, noCone: true, tag: 'ambush' },
  ],
  reinforcements: null,

  // the open chests / the table / the medical case: taken with E (the label says what); `hidden` — no crate model (the
  // chest prop is drawn already). D90 (user: the rounds can always be taken) `refill` — s until it can be taken again
  pickups: [
    { id: 'chest_smg', kind: 'crate', item: 'smg', x: 290, y: 1320, hidden: true, refill: 1.5, label: 'hud.take.smg' },
    { id: 'chest_rifle', kind: 'crate', item: 'rifle', x: 500, y: 1320, hidden: true, refill: 1.5, label: 'hud.take.rifle' },
    { id: 'ammo_table', kind: 'crate', item: 'ammo', count: 1, x: 560, y: 990, hidden: true, refill: 1, label: 'hud.take.ammo' },
    { id: 'grenade_chest', kind: 'crate', item: 'grenades', count: 2, x: 1800, y: 490, hidden: true, refill: 1.5, label: 'hud.take.grenades' },
    { id: 'medkit_case', kind: 'crate', item: 'medkit', x: 1150, y: 1330, hidden: true, label: 'hud.take.medkit' },
  ],

  // the lessons (data/tutorial.js) are the objectives (the level card counts them); the exit counts after the last one
  objectives: TUTORIAL.steps.map((s) => ({ id: s.id, textKey: s.textKey })),
  exit: { rect: [1160, 1700, 1240, 1790], x: 1200, y: 1745 },
  // the roll lesson: a roll started or ended on the mats
  rollMat: [1915, 860, 2065, 920],
};
