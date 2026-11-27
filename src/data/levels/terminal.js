// D148 — Marseille, level 3 "The container terminal" (STORY_DESIGN_D133.md §6; the references
// NEW/references/Location1/L03-1.png — the fenced container yard, its floodlight masts, the dispatcher's brick office by
// the water — and L03-2.png — the pier: the gantry crane, the cargo ship and its gangway, the watch tower; the user's
// atlases NEW/marseille/L03). Before dawn, rain. Data only (world units, 1 m ≈ 30; x → east, y → south).
//
// South: the container yard (aisles between rows of containers — the maze; the rows' gaps are the ways through), the
// dispatcher's office at its east side, the quay along the east water with his motorboat at its south end. North,
// behind the fence and its gate: the pier — the crane at its west edge (its walkway over the water: the sniper), the
// watch platform in the middle, the ship "Meridian" moored along the north with its gangway.
// Section 1 (yard): [стелс] the floodlights sweep the aisles, the night shift patrols — seen: the alarm (groups from the
// gates until it is cut in the office) and the dispatcher runs for his boat → [ЗАХВАТ ЖИВЫМ] the dispatcher from behind →
// [ДОПРОС] the ship, the berth, the hour; the pier gate opens.
// Section 2 (pier): [СНАЙПЕРСКАЯ ДУЭЛЬ] the glint on the crane — cover to cover to the watch platform, its rifle, the
// shot → [ПРИКРЫТИЕ СВЕРХУ] 90 s from the platform while the crew lowers the gangway (cleaners from three sides; one who
// reaches the gangway's foot — the crew is hit) → on board.
const W = (x0, y0, x1, y1, style, gaps = [], extra = {}) => ({ x0, y0, x1, y1, style, gaps, ...extra });
const FACE_S = 0, FACE_W = 1, FACE_N = 2, FACE_E = 3; // prop `rot`: where its front faces

const BOXES = ['mt_container_red', 'mt_container_blue', 'mt_container_green', 'mt_container_rust'];
/** A row of containers end to end along x at y (each 366 long), its `gaps` left open; what is left over — crates. */
function row(y, x0, x1, gaps, seed) {
  const out = [], segs = [];
  let a = x0, i = seed;
  for (const [g0, g1] of gaps) { segs.push([a, g0]); a = g1; }
  segs.push([a, x1]);
  for (const [s0, s1] of segs) {
    let x = s0 + 3;
    while (x + 366 <= s1 - 3) { out.push({ type: BOXES[i++ % BOXES.length], x: x + 183, y, rot: i % 2 ? FACE_W : FACE_E }); x += 369; }
    for (let c = x + 22; c + 20 <= s1 - 3; c += 44) out.push({ type: (i++ % 3) ? 'mt_crate' : 'mt_cage', x: c, y });
  }
  return out;
}

export const TERMINAL = {
  id: 'terminal',
  nameKey: 'level.terminal.name',
  descKey: 'level.terminal.desc',
  location: 'marseille',
  requires: 'flat',
  preview: 'assets/ui/previews/terminal.webp',
  width: 2900,
  height: 3000,
  wallHeight: 78,
  wallThickness: 20,
  outdoor: true,
  buildingRect: [2240, 1660, 2600, 2040], // (the dispatcher's office)
  playerSpawn: { x: 420, y: 2950, angle: -Math.PI / 2 }, // on the road at the yard's south gate
  menuModes: ['mission'],
  modes: { mission: {} },
  loadout: { weapons: ['pistol_sd', 'smg', 'rifle'], grenades: { frag: 2 } },
  enemyTypes: ['cleaner', 'assaulter', 'shield', 'sniper', 'dispatcher'],
  spriteWalls: { fence: 'port_fence', rail: 'port_rail' }, // (the port's own chain-link and guardrail)
  lighting: { hemi: 0.85, key: 1.0, exposure: 1.22, sky: 0xb7c8e6, ground: 0x20232a, sun: 0xd0dcf2, background: 0x04070c },

  zones: [
    // --- the water (never walked: the quay's edges stop walkers) and the ship
    { id: 'water_n', rect: [0, 0, 2900, 40], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_w', rect: [0, 40, 700, 400], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_e', rect: [2100, 40, 2900, 400], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_s1', rect: [0, 400, 1300, 480], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_s2', rect: [1360, 400, 2900, 480], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_crane', rect: [0, 480, 300, 1450], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_quay', rect: [2800, 480, 2900, 3000], floor: 'water', light: 'dark', wallLights: false },
    { id: 'deck', rect: [700, 40, 2100, 400], floor: 'deck_plate', light: 'dark', wallLights: false },
    { id: 'gangway', rect: [1300, 400, 1360, 480], floor: 'grating', light: 'dark', wallLights: false },
    // --- the pier (round the watch platform and its steps)
    { id: 'pier_w', rect: [300, 480, 1000, 1450], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'pier_n', rect: [1000, 480, 1140, 840], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'tower', rect: [1000, 840, 1140, 960], floor: 'grating', light: 'dark', wallLights: false, elev: 70, side: 'bulwark', zoom: 1.65, look: [255, 820] },
    { id: 'tower_steps', rect: [1000, 960, 1140, 1080], floor: 'grating', light: 'dark', wallLights: false, steps: { axis: 'y', from: 70, to: 0, n: 6 } },
    { id: 'pier_s', rect: [1000, 1080, 1140, 1450], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'pier_c', rect: [1140, 480, 2000, 1450], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'pier_e', rect: [2000, 480, 2800, 1450], floor: 'quay', light: 'dark', wallLights: false },
    // --- the yard: aisles and the container rows between them (walked only through their gaps)
    { id: 'aisle0', rect: [300, 1450, 2600, 1660], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'row1', rect: [300, 1660, 2240, 1740], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'aisle1', rect: [300, 1740, 2240, 1960], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'row2', rect: [300, 1960, 2240, 2040], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'aisle2', rect: [300, 2040, 2600, 2260], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'row3', rect: [300, 2260, 2600, 2340], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'aisle3', rect: [300, 2340, 2600, 2560], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'row4', rect: [300, 2560, 2600, 2640], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'aisle4', rect: [300, 2640, 2600, 2900], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'quay_e', rect: [2600, 1450, 2800, 2900], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'office_ctrl', rect: [2240, 1660, 2600, 1850], floor: 'grating', light: 'dim', wallLights: false },
    { id: 'office_store', rect: [2240, 1850, 2600, 2040], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'road', rect: [300, 2900, 2800, 3000], floor: 'road', light: 'dark', wallLights: false },
  ],

  walls: [
    // the quay's edges (the water) and the gangway's sides
    W(300, 480, 1300, 480, 'edge'), W(1360, 480, 2800, 480, 'edge'), W(300, 480, 300, 1450, 'edge'), W(2800, 480, 2800, 3000, 'edge'),
    W(1300, 400, 1300, 480, 'edge'), W(1360, 400, 1360, 480, 'edge'),
    // the ship: its bulwark (low steel), the bridge house aft
    W(700, 40, 2100, 40, 'bulwark'), W(700, 40, 700, 400, 'bulwark'), W(2100, 40, 2100, 400, 'bulwark'), W(700, 400, 2100, 400, 'bulwark', [[1300, 1360]]),
    W(1800, 80, 2060, 80, 'painted_steel'), W(1800, 80, 1800, 330, 'painted_steel'), W(2060, 80, 2060, 330, 'painted_steel'), W(1800, 330, 2060, 330, 'painted_steel'),
    // the watch platform's railing (up on it) and its stair's
    W(1000, 840, 1140, 840, 'rail', [], { elev: 70 }), W(1000, 840, 1000, 960, 'rail', [], { elev: 70 }), W(1140, 840, 1140, 960, 'rail', [], { elev: 70 }),
    W(1000, 960, 1000, 1080, 'rail'), W(1140, 960, 1140, 1080, 'rail'),
    // the yard's fence (its gate to the pier; the way in from the road) — the port's chain-link
    W(300, 1450, 2800, 1450, 'fence', [[1360, 1440]]), W(300, 1450, 300, 2900, 'fence'), W(300, 2900, 2800, 2900, 'fence', [[380, 460]]),
    // the dispatcher's office (brick): the control room and the store; doors west (control room) and south (store)
    W(2240, 1660, 2600, 1660, 'brick'), W(2240, 1660, 2240, 2040, 'brick', [[1728, 1792]]), W(2600, 1660, 2600, 2040, 'brick'),
    W(2240, 2040, 2600, 2040, 'brick', [[2368, 2432]]), W(2240, 1850, 2600, 1850, 'brick', [[2468, 2532]]),
  ],

  doors: [
    { id: 'gangway_gate', x: 1330, y: 400, axis: 'x', width: 60, kind: 'gate', lock: 'gangway' }, // (lowered: open)
    { id: 'pier_gate', x: 1400, y: 1450, axis: 'x', width: 80, kind: 'gate', lock: 'pierGate', zones: ['aisle0', 'pier_c'] },
    { id: 'ctrl_door', x: 2240, y: 1760, axis: 'y', width: 64, kind: 'metal', zones: ['aisle1', 'office_ctrl'] },
    { id: 'store_door', x: 2400, y: 2040, axis: 'x', width: 64, kind: 'metal', zones: ['office_store', 'aisle2'] },
    { id: 'inner_door', x: 2500, y: 1850, axis: 'x', width: 64, kind: 'wood', zones: ['office_ctrl', 'office_store'] },
  ],
  openings: [
    { x: 1330, y: 480, zones: ['gangway', 'pier_c'] },
    { x: 1000, y: 660, zones: ['pier_w', 'pier_n'] }, { x: 1140, y: 660, zones: ['pier_n', 'pier_c'] },
    { x: 1070, y: 960, zones: ['tower', 'tower_steps'] }, { x: 1070, y: 1080, zones: ['tower_steps', 'pier_s'] },
    { x: 1000, y: 1260, zones: ['pier_w', 'pier_s'] }, { x: 1140, y: 1260, zones: ['pier_s', 'pier_c'] },
    { x: 2000, y: 960, zones: ['pier_c', 'pier_e'] },
    // the rows' gaps
    { x: 750, y: 1660, zones: ['aisle0', 'row1'] }, { x: 750, y: 1740, zones: ['row1', 'aisle1'] },
    { x: 1550, y: 1660, zones: ['aisle0', 'row1'] }, { x: 1550, y: 1740, zones: ['row1', 'aisle1'] },
    { x: 1150, y: 1960, zones: ['aisle1', 'row2'] }, { x: 1150, y: 2040, zones: ['row2', 'aisle2'] },
    { x: 1850, y: 1960, zones: ['aisle1', 'row2'] }, { x: 1850, y: 2040, zones: ['row2', 'aisle2'] },
    { x: 550, y: 2260, zones: ['aisle2', 'row3'] }, { x: 550, y: 2340, zones: ['row3', 'aisle3'] },
    { x: 1450, y: 2260, zones: ['aisle2', 'row3'] }, { x: 1450, y: 2340, zones: ['row3', 'aisle3'] },
    { x: 2400, y: 2260, zones: ['aisle2', 'row3'] }, { x: 2400, y: 2340, zones: ['row3', 'aisle3'] },
    { x: 950, y: 2560, zones: ['aisle3', 'row4'] }, { x: 950, y: 2640, zones: ['row4', 'aisle4'] },
    { x: 1750, y: 2560, zones: ['aisle3', 'row4'] }, { x: 1750, y: 2640, zones: ['row4', 'aisle4'] },
    { x: 2450, y: 2560, zones: ['aisle3', 'row4'] }, { x: 2450, y: 2640, zones: ['row4', 'aisle4'] },
    // the yard's east side opens onto the quay
    { x: 2600, y: 1555, zones: ['aisle0', 'quay_e'] }, { x: 2600, y: 2150, zones: ['aisle2', 'quay_e'] },
    { x: 2600, y: 2450, zones: ['aisle3', 'quay_e'] }, { x: 2600, y: 2770, zones: ['aisle4', 'quay_e'] },
    { x: 2600, y: 2300, zones: ['row3', 'quay_e'] }, { x: 2600, y: 2600, zones: ['row4', 'quay_e'] },
    { x: 420, y: 2900, zones: ['road', 'aisle4'] },
  ],

  props: [
    // ===== the yard: the rows of containers (the maze), their gaps open
    ...row(1700, 300, 2240, [[700, 800], [1500, 1600]], 0),
    ...row(2000, 300, 2240, [[1100, 1200], [1800, 1900]], 1),
    ...row(2300, 300, 2600, [[500, 600], [1400, 1500], [2350, 2450]], 2),
    ...row(2600, 300, 2600, [[900, 1000], [1700, 1800], [2400, 2500]], 3),
    // in the aisles: open containers (crates inside), forklifts, pallets, drums, cages — cover along the way
    { type: 'mt_container_open_side', x: 1150, y: 1555, rot: FACE_W }, { type: 'mt_crate', x: 1110, y: 1556 }, { type: 'mt_crate', x: 1170, y: 1556 },
    { type: 'mt_forklift', x: 520, y: 1850, rot: FACE_E }, { type: 'mt_pallet', x: 580, y: 1880 }, { type: 'mt_pallet', x: 580, y: 1880, elev: 4.5 },
    { type: 'mt_drum_red', x: 1350, y: 1800 }, { type: 'mt_drum_blue', x: 1372, y: 1806 }, { type: 'mt_drum_striped', x: 1358, y: 1828 },
    { type: 'mt_container_open_end', x: 900, y: 2150, rot: FACE_E }, { type: 'mt_cage', x: 860, y: 2150 },
    { type: 'mt_box', x: 1700, y: 2120 }, { type: 'mt_box', x: 1730, y: 2128 }, { type: 'mt_crate', x: 1715, y: 2160 },
    { type: 'mt_forklift', x: 2100, y: 2420, rot: FACE_W }, { type: 'mt_pallet', x: 2040, y: 2440 }, { type: 'mt_case', x: 2040, y: 2440, elev: 4.5 },
    { type: 'mt_drum_red', x: 700, y: 2450 }, { type: 'mt_drum_striped', x: 722, y: 2462 },
    { type: 'mt_crate', x: 1250, y: 2480 }, { type: 'mt_crate', x: 1290, y: 2480 }, { type: 'mt_crate', x: 1270, y: 2480, elev: 32 },
    { type: 'mt_container_open_side', x: 1500, y: 2780, rot: FACE_E }, { type: 'mt_pallet', x: 600, y: 2780 }, { type: 'mt_carton', x: 600, y: 2780, elev: 4.5 },
    { type: 'mt_drum_blue', x: 2300, y: 2760 }, { type: 'mt_drum_red', x: 2322, y: 2770 }, { type: 'mt_cage', x: 2050, y: 2800 },
    // the floodlight masts (their lamps sweep the aisles)
    { type: 'mt_mast', x: 340, y: 1490 }, { type: 'mt_mast', x: 2560, y: 2860 },
    // ===== the dispatcher's office: the control room (the desk and its screens, lockers, the radio), the store
    { type: 'mt_control_desk', x: 2470, y: 1700, rot: FACE_S }, { type: 'mt_task_chair', x: 2532, y: 1752, rot: FACE_W },
    { type: 'mt_monitor_blue', x: 2450, y: 1690, elev: 23, rot: FACE_S }, { type: 'mt_monitor_cyan', x: 2492, y: 1690, elev: 23, rot: FACE_S },
    { type: 'mt_radio', x: 2520, y: 1700, elev: 23 }, { type: 'mt_lockers', x: 2290, y: 1677, rot: FACE_S },
    { type: 'mt_bookcase', x: 2585, y: 1790, rot: FACE_W }, { type: 'mt_binders', x: 2585, y: 1790, elev: 49 },
    { type: 'mt_window_dark', x: 2380, y: 1670.8, rot: FACE_S },
    { type: 'mt_workbench', x: 2530, y: 2010, rot: FACE_N }, { type: 'mt_shelf', x: 2560, y: 1870, rot: FACE_S },
    { type: 'mt_storage_box', x: 2280, y: 2010 }, { type: 'mt_parts_bin', x: 2530, y: 2008, elev: 29 },
    { type: 'mt_junction', x: 2300, y: 1863.6, rot: FACE_S }, { type: 'mt_hose', x: 2589, y: 1990, rot: FACE_W },
    { type: 'mt_gooseneck', x: 2400, y: 2058, rot: FACE_S }, { type: 'mt_window_warm', x: 2310, y: 2050.8, rot: FACE_S },
    { type: 'mt_window_warm', x: 2530, y: 2050.8, rot: FACE_S }, { type: 'mt_brick_runoff', x: 2470, y: 2050.8, rot: FACE_S },
    // ===== the east quay: bollards, the jetty's lanterns, the dispatcher's motorboat at its south end
    ...[1600, 1900, 2200, 2500, 2800].map((y) => ({ type: 'mt_bollard', x: 2775, y })),
    { type: 'mt_jetty_lantern', x: 2770, y: 1750 }, { type: 'mt_jetty_lantern', x: 2770, y: 2650 },
    { type: 'mt_boat', x: 2850, y: 2760, solid: false }, { type: 'mt_hawser', x: 2740, y: 2700 }, { type: 'mt_quay_ladder', x: 2790, y: 2840, rot: FACE_E },

    // ===== the pier: the crane at the west edge (its rails), crates, the truck, two stacks, bollards along the edge
    { type: 'mt_crane', x: 300, y: 820 },
    ...[525, 615, 705, 795, 885, 975, 1065, 1155, 1245, 1335, 1405].map((y) => ({ type: 'mt_rails', x: 360, y })),
    ...[480, 860, 1560, 1960, 2380, 2700].map((x) => ({ type: 'mt_bollard', x, y: 500 })),
    { type: 'mt_hawser', x: 560, y: 520 }, { type: 'mt_hawser', x: 2300, y: 520 },
    { type: 'mt_truck', x: 1640, y: 880, rot: FACE_W },
    { type: 'mt_container_blue', x: 2380, y: 760, rot: FACE_W }, { type: 'mt_container_red', x: 2380, y: 860, rot: FACE_E },
    { type: 'mt_container_green', x: 640, y: 1140, rot: FACE_E },
    { type: 'mt_crate', x: 780, y: 760 }, { type: 'mt_crate', x: 820, y: 760 }, { type: 'mt_box', x: 800, y: 795 },
    { type: 'mt_pallet', x: 1300, y: 760 }, { type: 'mt_crate', x: 1300, y: 760, elev: 4.5 }, { type: 'mt_cage', x: 1340, y: 765 },
    { type: 'mt_crate', x: 1250, y: 1150 }, { type: 'mt_crate', x: 1290, y: 1150 }, { type: 'mt_box', x: 1270, y: 1185 },
    { type: 'mt_drum_red', x: 1900, y: 1150 }, { type: 'mt_drum_blue', x: 1922, y: 1158 }, { type: 'mt_drum_striped', x: 1880, y: 1170 },
    { type: 'mt_cage', x: 2150, y: 1150 }, { type: 'mt_crate', x: 2195, y: 1150 }, { type: 'mt_forklift', x: 560, y: 1330, rot: FACE_N },
    { type: 'mt_crate', x: 820, y: 1300 }, { type: 'mt_box', x: 850, y: 1305 },
    { type: 'mt_jetty_lantern', x: 700, y: 520 }, { type: 'mt_jetty_lantern', x: 1500, y: 520 }, { type: 'mt_jetty_lantern', x: 2200, y: 520 },
    { type: 'mt_safety_post', x: 1290, y: 500 }, { type: 'mt_safety_post', x: 1370, y: 500 },
    // the watch platform: two cases for cover up there (the rifle's case is the crate below)
    { type: 'mt_case', x: 1022, y: 862, elev: 70 }, { type: 'mt_case', x: 1118, y: 862, elev: 70 },
    // ===== the ship: hatch covers, the winch, capstans, vents; the bridge house (its windows, the mast); lifebuoys
    { type: 'mt_gangway', x: 1330, y: 440 },
    { type: 'mt_hatch_cover', x: 960, y: 220, rot: FACE_W }, { type: 'mt_hatch_cover', x: 1590, y: 220, rot: FACE_W },
    { type: 'mt_winch', x: 1330, y: 110 }, { type: 'mt_capstan', x: 760, y: 100 }, { type: 'mt_capstan', x: 760, y: 340 },
    { type: 'mt_vent', x: 1240, y: 360 }, { type: 'mt_vent', x: 1420, y: 360 }, { type: 'mt_fairlead', x: 2080, y: 200, rot: FACE_W },
    { type: 'mt_bridge_window', x: 1880, y: 340.8, rot: FACE_S }, { type: 'mt_bridge_window', x: 1980, y: 340.8, rot: FACE_S },
    { type: 'mt_nav_mast', x: 1930, y: 200, elev: 78 }, { type: 'mt_rust', x: 1830, y: 340.8, rot: FACE_S },
    { type: 'mt_lifebuoy', x: 900, y: 412.9, rot: FACE_S }, { type: 'mt_lifebuoy', x: 1700, y: 412.9, rot: FACE_S },
  ],

  decals: [
    { t: 'marking', x: 1400, y: 1500, w: 300, d: 6 }, { t: 'hazard', x: 1400, y: 1470, w: 90, d: 22 },
    { t: 'hazard', x: 1330, y: 500, w: 70, d: 22 }, { t: 'marking', x: 1550, y: 680, w: 900, d: 6 },
    { t: 'scuff', x: 1000, y: 2150, w: 140, r: 0.4 }, { t: 'scuff', x: 1600, y: 1000, w: 160 }, { t: 'coffee', x: 2470, y: 1760, w: 30 },
  ],
  lights: [
    { x: 340, y: 1600, kind: 'flood', sx: 1, sz: 1 }, { x: 2560, y: 2760, kind: 'flood', sx: 1, sz: 1 },
    { x: 1400, y: 1380, kind: 'dim', sx: 1.4, sz: 1 }, { x: 1070, y: 900, kind: 'dim', sx: 0.8, sz: 0.8 },
    { x: 1930, y: 360, kind: 'lamp', sx: 1.5, sz: 1 },
  ],

  enemies: [
    // the yard's night shift
    { type: 'cleaner', x: 500, y: 1850, angle: 0, patrol: [[500, 1850, 2, 0], [2000, 1850, 2.5, Math.PI]] },
    { type: 'assaulter', x: 2000, y: 2150, angle: Math.PI, patrol: [[2000, 2150, 2, Math.PI], [600, 2150, 2.5, 0]] },
    { type: 'cleaner', x: 2195, y: 1700, angle: Math.PI, busy: false },
    { type: 'cleaner', x: 400, y: 2450, angle: 0, patrol: [[400, 2450, 3, 0], [1700, 2450, 2, Math.PI]] },
    { type: 'assaulter', x: 2700, y: 1600, angle: Math.PI / 2, patrol: [[2700, 1600, 2, Math.PI / 2], [2700, 2600, 3, -Math.PI / 2]] },
    { type: 'cleaner', x: 1300, y: 2770, angle: Math.PI, patrol: [[1300, 2770, 2, Math.PI], [2200, 2770, 2, 0]] },
    // the dispatcher at his desk (unarmed; alarmed — he runs for the boat)
    // (busy at his screens, his back to the room: he does not feel the hero creeping up behind him)
    { type: 'dispatcher', x: 2470, y: 1746, angle: -Math.PI / 2, busy: true, harmless: true, capture: true, tag: 'dispatcher', flee: [2765, 2770] },
    // the pier: the sniper on the crane's walkway (over the water: never reached), two of the cleaners
    { type: 'sniper', x: 255, y: 820, angle: 0, elev: 205, tag: 'sniper', wakeOn: 'sniper' },
    { type: 'cleaner', x: 1700, y: 760, angle: Math.PI / 2, patrol: [[1700, 760, 2, Math.PI / 2], [2200, 1000, 2, Math.PI]] },
    { type: 'assaulter', x: 2250, y: 1300, angle: Math.PI, patrol: [[2250, 1300, 3, Math.PI], [1700, 1300, 2, 0]] },
  ],

  pickups: [
    { id: 'rifle_case', kind: 'crate', item: 'sniper', x: 1070, y: 870, elev: 70 }, // the watch platform's rifle
    { id: 'ammo_aisle', kind: 'crate', item: 'ammo', count: 2, x: 1720, y: 2190 },
    { id: 'grenades_box', kind: 'crate', item: 'grenades', count: 2, x: 900, y: 2190 },
    { id: 'ammo_pier', kind: 'crate', item: 'ammo', count: 2, x: 1200, y: 1300 },
    // the alarm's panel (E while it rings): the office's store
    { id: 'alarm_cut_office', kind: 'activate', task: 'alarm', label: 'hud.alarmCut', x: 2300, y: 1880 },
  ],

  // [стелс] by choice: seen — the alarm; groups from the gates until it is cut (the office's store)
  alarm: {
    radio: 3, first: 6, every: [12, 18], group: [1, 2], maxAlive: 4, types: ['cleaner', 'assaulter'],
    from: { gateS: { x: 420, y: 2850 }, quayE: { x: 2700, y: 2850 }, aisleW: { x: 360, y: 1560 } },
    during: ['capture'], dialogue: 'term.alarm', offDialogue: 'term.alarmOff',
  },
  // the floodlight masts' lamps sweep the aisles: lit 0.9 s — the alarm
  searchlights: [
    { kind: 'sweep', x: 340, y: 1490, top: 300, reach: 420, from: 0.2, to: 1.35, period: 9, radius: 64, spot: 0.9, during: ['capture'] },
    { kind: 'sweep', x: 2560, y: 2860, top: 300, reach: 440, from: -2.95, to: -1.75, period: 11, radius: 64, spot: 0.9, during: ['capture'] },
  ],

  objectives: [
    { id: 'capture', type: 'capture', tag: 'dispatcher', textKey: 'obj.term.capture', done: 'captured' },
    { id: 'talk', type: 'call', textKey: 'obj.term.talk', dialogue: 'term.talk', done: 'talked', gives: 'pierGate' },
    { id: 'pier', type: 'reach', room: 'pier_c', textKey: 'obj.term.pier', target: [1400, 1450], done: 'atPier' },
    { id: 'sniper', type: 'clear', tag: 'sniper', via: 'rifle_case', textKey: 'obj.term.sniper', done: 'sniperDown', startDialogue: 'term.sniper' },
    {
      id: 'cover', type: 'defend', textKey: 'obj.term.cover', duration: 90, guard: [1240, 480, 1420, 620], reachFor: 3,
      gives: 'gangway', done: 'gangway', startDialogue: 'term.cover', look: [1330, 620], target: [1070, 900],
      spawnPoints: { west: { x: 520, y: 1300 }, gate: { x: 1400, y: 1560 }, east: { x: 2650, y: 950 } },
      waves: { first: 4, every: [7, 10], group: [1, 2], maxAlive: 5, types: ['cleaner', 'assaulter', 'cleaner', 'shield'], from: ['west', 'east', 'gate', 'west', 'east'] },
    },
    { id: 'board', textKey: 'obj.term.board', target: 'exit' },
  ],
  exit: { rect: [1240, 300, 1420, 398], x: 1330, y: 360 },
};
