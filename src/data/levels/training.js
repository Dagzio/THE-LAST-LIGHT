// D88 (user request): the training ground — a short tutorial level before the office. Every mechanic of the game, one
// yard at a time (the lessons: data/tutorial.js, the rules: systems/TutorialDirector.js). Built like the office from
// the user's art (NEW/tutorial: the 5-view object sheets, the ground atlas; reference NEW/tutorial/sprites/reference/
// level.png — eight yards round a field, fenced paths between them). Adapted to the game's mechanics: the reference's
// "lie down" yard (there is no prone in the game) is the ROLL yard — a dive roll across the blue mat; the yards are
// rectangles (the AI routes through rooms), the winding paths straight.
//
// The way (clockwise from the armory): A armory (start: take the SMG and the M4A1) → B range (shoot the targets with
// each gun, switch, reload, take rounds) → C cover yard (low cover, the corner peek of high cover, rounds from the
// bodies) → D stealth yard (sneak up, takedown) → E grenade yard → F roll yard → G ambush (they shoot back; D128: the
// wounds heal by themselves — catch your breath in cover) → the south gate (D128: the medic yard is gone, no medkits).
// Every gate opens when its lesson is done.
import { TUTORIAL } from '../tutorial.js';

const W = (x0, y0, x1, y1, style, gaps = []) => ({ x0, y0, x1, y1, style, gaps });
const G = (id, x, y, axis, zones) => ({ id, x, y, axis, width: 90, kind: 'gate', lock: 'step', zones });
const Y = 'yard', F = 'fence';
// D116 (user: the canopy's legs had no collision): a canopy and its four legs (stop walkers; not drawn — the canopy is)
const canopy = (x, y) => [{ type: 'canopy', x, y }, ...[[-58, -43], [58, -43], [-58, 43], [58, 43]].map(([dx, dy]) => ({ type: 'canopy_pole', x: x + dx, y: y + dy, drawn: false }))];

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
  // D107 (user): on a phone the cover yard is framed higher (part of the view; − = north) — the top hint covered the dummies
  touchFrame: { cover: -0.2, range: -0.18 },
  manualCrates: true,          // D110: the lessons teach E / the button — the crates here are not opened by walking up
  noXray: true,               // D90 (user): no X-ray silhouette of the hero through the walls here
  footsteps: 'outdoor',        // D89 / D93: the user's steps1 on every floor here (data/sounds.js STEP_SETS)
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
    { id: 'p1', rect: [355, 1080, 445, 1200], floor: 'gravel', light: 'day' },
    { id: 'p2', rect: [355, 560, 445, 680], floor: 'gravel', light: 'day' },
    { id: 'p3', rect: [760, 295, 920, 385], floor: 'gravel', light: 'day' },
    { id: 'p4', rect: [1520, 295, 1700, 385], floor: 'gravel', light: 'day' },
    { id: 'p5', rect: [1945, 560, 2035, 700], floor: 'gravel', light: 'day' },
    { id: 'p6', rect: [1945, 1080, 2035, 1200], floor: 'gravel', light: 'day' },
    { id: 'exit', rect: [1945, 1640, 2035, 1790], floor: 'gravel', light: 'day' }, // D128: south of the ambush yard
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
    W(1740, 1200, 2240, 1200, Y, [[1945, 2035]]), W(1740, 1640, 2240, 1640, Y, [[1945, 2035]]), W(1740, 1200, 1740, 1640, Y), W(2240, 1200, 2240, 1640, Y),
    // the fenced paths
    W(355, 1080, 355, 1200, F), W(445, 1080, 445, 1200, F),
    W(355, 560, 355, 680, F), W(445, 560, 445, 680, F),
    W(760, 295, 920, 295, F), W(760, 385, 920, 385, F),
    W(1520, 295, 1700, 295, F), W(1520, 385, 1700, 385, F),
    W(1945, 560, 1945, 700, F), W(2035, 560, 2035, 700, F),
    W(1945, 1080, 1945, 1200, F), W(2035, 1080, 2035, 1200, F),
    W(1945, 1640, 1945, 1790, F), W(2035, 1640, 2035, 1790, F),
  ],

  // the gates: locked until their lesson is done (the tutorial opens them)
  doors: [
    G('gA', 400, 1200, 'x', ['armory', 'p1']),
    G('gB', 400, 680, 'x', ['range', 'p2']),
    G('gC', 760, 340, 'y', ['cover', 'p3']),
    G('gD', 1520, 340, 'y', ['stealth', 'p4']),
    G('gE', 1990, 560, 'x', ['grenade', 'p5']),
    G('gF', 1990, 1080, 'x', ['roll', 'p6']),
    G('gG', 1990, 1640, 'x', ['ambush', 'exit']), // D128: the ambush yard's south gate — the way out
  ],
  openings: [
    { x: 400, y: 1080, zones: ['p1', 'range'] },
    { x: 400, y: 560, zones: ['p2', 'cover'] },
    { x: 920, y: 340, zones: ['p3', 'stealth'] },
    { x: 1700, y: 340, zones: ['p4', 'grenade'] },
    { x: 1990, y: 700, zones: ['p5', 'roll'] },
    { x: 1990, y: 1200, zones: ['p6', 'ambush'] },
  ],

  props: [
    // --- A armory: two open weapon chests (SMG, M4A1), a workbench, cases, a canopy
    { type: 'weapon_chest_open', x: 290, y: 1320, rot: 0 }, { type: 'weapon_chest_open', x: 500, y: 1320, rot: 0 },
    ...canopy(250, 1555), // D89: over the cases, not over the SMG chest (it hid the chest)
    { type: 'workbench', x: 600, y: 1480, rot: 1 }, { type: 'ammo_box', x: 600, y: 1460, rot: 1, elev: 24 }, { type: 'ammo_box', x: 600, y: 1500, rot: 1, elev: 24 },
    { type: 'equipment_case', x: 238, y: 1572 }, { type: 'crate_wood', x: 600, y: 1610 }, { type: 'barrel', x: 190, y: 1450 }, { type: 'barrel', x: 190, y: 1480 },
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
    { type: 'crate_wood', x: 1460, y: 240 }, { type: 'barrel', x: 960, y: 160 }, { type: 'signal_amber', x: 1505, y: 405 },
    // --- E grenade yard: three dummies behind sandbags, the open grenade chest
    // D117 (user's sketch): a sandbag U opening north — the bottom wall, two slanted wings (yaw), three crouched dummies
    // inside it; the grenade chest south of it, lengthwise
    { type: 'sandbags', x: 1925, y: 292 }, { type: 'sandbags', x: 2015, y: 292 },
    { type: 'sandbags', x: 1855, y: 240, yaw: Math.atan2(104, 50) }, { type: 'sandbags', x: 2085, y: 240, yaw: Math.atan2(104, -50) },
    { type: 'supply_chest_open', x: 1970, y: 430, rot: 0 }, { type: 'barrel', x: 1730, y: 160 }, { type: 'crate_wood', x: 2200, y: 520 },
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
    { type: 'signal_amber', x: 2050, y: 1625 },
    // --- the field round the yards (outside the walls): trees, bushes, grass
    // D116 (user): half the trees (20 → 10), each crown clear of the yard walls
    ...[[1100, 820], [1400, 760], [1250, 1050], [880, 1080], [1560, 1120], [60, 900], [2340, 300], [2340, 1500], [500, 1740], [1250, 1420]]
      .map(([x, y]) => ({ type: 'tree', x, y })),
    // D126 (user): no rocks in the game — the boulders (every third spot) are gone, the bushes stay
    ...[[960, 700], [1180, 940], [820, 1200], [1620, 1300], [2300, 600], [100, 650]]
      .map(([x, y]) => ({ type: 'bush', x, y })),
    ...[[1000, 900], [1320, 920], [1700, 1000], [780, 1300], [900, 1400], [1600, 660], [1300, 700], [1040, 1100]]
      .map(([x, y], i) => ({ type: i % 2 ? 'flowers' : 'grass_tuft', x, y })),
  ],

  // dummies: stand still, never shoot; the stealth guards walk, see (stealth rules) but never shoot; the ambush shoots.
  // D89 bulletProof: the takedown guards and the grenade dummies are felled only the way their lesson teaches; the cover
  // dummies take rounds only in their own lesson (TutorialDirector); the ambush is dormant (a dummy) until the hero walks in
  enemies: [
    { type: 'thug', x: 290, y: 325, angle: Math.PI / 2, dummy: true, bulletProof: true, tag: 'cover1' },
    { type: 'gunman', x: 705, y: 325, angle: Math.PI / 2, dummy: true, bulletProof: true, tag: 'cover2' },
    // D116 (user): both guards patrol, the opposite ways — north–south lines (one goes south while the other goes north);
    // walking along them or waiting at their ends (facing away from it) they never look into the west entrance: the
    // hero is not caught just stepping in (fully spotted now fails the lesson)
    { type: 'thug', x: 1250, y: 170, angle: Math.PI / 2, harmless: true, bulletProof: true, tag: 'stealth', patrol: [[1250, 170, 3.5, 0], [1250, 550, 3.5, 0]] },
    { type: 'thug', x: 1380, y: 560, angle: -Math.PI / 2, harmless: true, bulletProof: true, tag: 'stealth', patrol: [[1380, 560, 3.5, 0], [1380, 170, 3.5, 0]] },
    // D117: crouched inside the sandbag U (two by its upper ends, one in the middle by its bottom wall)
    { type: 'thug', x: 1882, y: 212, angle: Math.PI / 2, dummy: true, bulletProof: true, crouch: true, tag: 'grenade' },
    { type: 'thug', x: 2058, y: 212, angle: Math.PI / 2, dummy: true, bulletProof: true, crouch: true, tag: 'grenade' },
    { type: 'thug', x: 1970, y: 252, angle: Math.PI / 2, dummy: true, bulletProof: true, crouch: true, tag: 'grenade' },
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
    { id: 'grenade_chest', kind: 'crate', item: 'grenades', count: 2, x: 1970, y: 430, hidden: true, refill: 1.5, label: 'hud.take.grenades' },
  ],

  // the lessons (data/tutorial.js) are the objectives (the level card counts them); the exit counts after the last one
  objectives: TUTORIAL.steps.map((s) => ({ id: s.id, textKey: s.textKey })),
  exit: { rect: [1950, 1700, 2030, 1790], x: 1990, y: 1745 }, // D128: south of the ambush yard
  // the roll lesson: a roll started or ended on the mats
  rollMat: [1915, 860, 2065, 920],
};
