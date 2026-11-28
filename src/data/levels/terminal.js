// D148 / D149 — Marseille, level 3 "The container terminal" (STORY_DESIGN_D133.md §6). D149 (user: rework it closer to
// the references): laid out from the catalogue's placement of the references themselves (NEW/marseille/L03/catalog.json)
// — L03-1.png: the fenced container yard (its containers, stacks, pallets, drums, forklifts, the floodlight masts, the
// gates), the dispatcher's brick office by the quay, the jetty with his motorboat; L03-2.png: the pier north of the yard
// (the gantry crane on its rails at the water, the cargo ship "Meridian" and its gangway, the box truck, crates, cages,
// containers, the access tower). A reference pixel → the world by the two mappings below (the yard ≈ 1.7 units a pixel
// across, 1.63 deep; the pier joined to it at the fence, its vehicle gate on the yard's). Data only (world units).
//
// Section 1 (yard): [стелс] the floodlights sweep the aisles, the night shift patrols — seen: the alarm (groups from the
// gates until it is cut in the office) and the dispatcher runs for his boat → [ЗАХВАТ ЖИВЫМ] the dispatcher, busy at his
// screens, from behind → [ДОПРОС] the ship, the berth, the hour; the pier gate opens.
// Section 2 (pier): [СНАЙПЕРСКАЯ ДУЭЛЬ] the glint in the crane's cab — cover to cover to the watch platform, its rifle,
// the shot → [ПРИКРЫТИЕ СВЕРХУ] 90 s from the platform while the crew lowers the gangway (one who reaches its foot —
// the crew is hit) → on board.
const W = (x0, y0, x1, y1, style, gaps = [], extra = {}) => ({ x0, y0, x1, y1, style, gaps, ...extra });
const FACE_S = 0, FACE_W = 1, FACE_N = 2, FACE_E = 3; // prop `rot`: where its front faces (catalogue 0 / 90 / 180 / 270° → S / E / N / W)
const PI = Math.PI;

/** L03-1 (the yard) → world. */
const Y1 = (px, py) => [Math.round(300 + (px - 100) * 1.7), Math.round(1330 + (py - 150) * 1.63)];
/** L03-2 (the pier) → world. */
const P2 = (px, py) => [Math.round(454 + px * 1.65), Math.round(507 + (py - 295) * 1.63)];
/** A prop at a reference point. */
const at = (map, type, px, py, o = {}) => { const [x, y] = map(px, py); return { type, x, y, ...o }; };

// the yard's containers (world centres; FACE_E / FACE_W lie along x — 366 × 73; FACE_S / FACE_N along y) and stacks
const BOX = { x: 366, y: 73 };
const YARD_BOXES = [
  // [type, x, y, along ('x' | 'y'), stacked type on top (or null)]
  ['mt_container_blue', 1045, 1431, 'x', 'mt_container_red'],
  ['mt_container_blue_20', 760, 1438, 'y', null],
  ['mt_container_green', 1600, 1394, 'x', null],
  ['mt_container_open_end', 2005, 1545, 'y', null],
  ['mt_container_red', 645, 1623, 'x', null],
  ['mt_container_open_side', 1123, 1599, 'x', null],
  ['mt_container_red', 1623, 1583, 'x', null],
  ['mt_container_green', 1667, 1814, 'x', 'mt_container_blue'],
  ['mt_container_green', 1026, 1780, 'x', null],
  ['mt_container_green', 569, 1907, 'y', null],
  ['mt_container_red', 1150, 1943, 'x', null],
  ['mt_container_blue', 530, 2244, 'x', 'mt_container_rust'],
  ['mt_container_open_side', 1318, 2094, 'x', null],
  ['mt_container_blue', 1798, 2121, 'y', null],
  ['mt_container_blue', 1143, 2321, 'x', null],
  ['mt_container_red', 1697, 2281, 'y', null],
];
const SIZE = { mt_container_blue_20: [73, 182], mt_container_open_end: [97, 396], mt_container_open_side: [103, 366] };
function footprint([type, x, y, along]) {
  const [a, b] = SIZE[type] || [BOX.y, BOX.x]; // (width, length)
  return along === 'x' ? [x - b / 2, y - a / 2, x + b / 2, y + a / 2] : [x - a / 2, y - b / 2, x + a / 2, y + b / 2];
}
function yardBoxes() {
  const out = [];
  for (const c of YARD_BOXES) {
    const [type, x, y, along, top] = c;
    const rot = along === 'x' ? (Math.round(x) % 2 ? FACE_W : FACE_E) : (Math.round(y) % 2 ? FACE_S : FACE_N);
    out.push({ type, x, y, rot });
    if (top) out.push({ type: top, x, y, rot: rot ^ 2, elev: 78, solid: false }); // (stacked: drawn on top, the bottom one collides)
  }
  return out;
}

/**
 * D149: the yard as a grid of rooms for the enemies' way-finding (rule 14: rooms and their openings, no navmesh): the
 * rect cut into nx × ny cells; two neighbours are joined where their shared edge has the widest gap between the
 * containers (at least `clear` units from any) — so the routes go round the maze through its real gaps.
 */
function gridZones(prefix, rect, nx, ny, blocks, clear = 26) {
  const [x0, y0, x1, y1] = rect, cw = (x1 - x0) / nx, ch = (y1 - y0) / ny;
  const zones = [], openings = [];
  const id = (i, j) => `${prefix}${i}_${j}`;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    zones.push({ id: id(i, j), rect: [Math.round(x0 + i * cw), Math.round(y0 + j * ch), Math.round(x0 + (i + 1) * cw), Math.round(y0 + (j + 1) * ch)], floor: 'quay', light: 'dark', wallLights: false });
  }
  const gap = (px, py) => { let d = Infinity; for (const [a, b, c, e] of blocks) { const dx = Math.max(a - px, 0, px - c), dy = Math.max(b - py, 0, py - e); d = Math.min(d, Math.hypot(dx, dy)); } return d; };
  const best = (pts) => { let m = null, md = clear; for (const p of pts) { const d = gap(p[0], p[1]); if (d > md) { md = d; m = p; } } return m; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const zx0 = x0 + i * cw, zy0 = y0 + j * ch;
    if (i + 1 < nx) { const x = Math.round(zx0 + cw), p = best(Array.from({ length: 13 }, (_, k) => [x, Math.round(zy0 + ch * (k + 0.5) / 13)])); if (p) openings.push({ x: p[0], y: p[1], zones: [id(i, j), id(i + 1, j)] }); }
    if (j + 1 < ny) { const y = Math.round(zy0 + ch), p = best(Array.from({ length: 13 }, (_, k) => [Math.round(zx0 + cw * (k + 0.5) / 13), y])); if (p) openings.push({ x: p[0], y: p[1], zones: [id(i, j), id(i, j + 1)] }); }
  }
  return { zones, openings };
}
const YARD = gridZones('y', [300, 1330, 2110, 2474], 6, 4, YARD_BOXES.map(footprint));

export const TERMINAL = {
  id: 'terminal',
  nameKey: 'level.terminal.name',
  descKey: 'level.terminal.desc',
  location: 'marseille',
  requires: 'flat',
  preview: 'assets/ui/previews/terminal.webp',
  width: 3300,
  height: 2720,
  wallHeight: 78,
  wallThickness: 20,
  outdoor: true,
  buildingRect: [2110, 2060, 2420, 2370], // (the dispatcher's office)
  playerSpawn: { x: 380, y: 2560, angle: -PI / 2 }, // on the road, at the yard's vehicle gate
  menuModes: ['mission'],
  modes: { mission: {} },
  loadout: { weapons: ['pistol_sd', 'smg', 'rifle'], grenades: { frag: 2 } },
  enemyTypes: ['cleaner', 'assaulter', 'shield', 'sniper', 'dispatcher'],
  spriteWalls: { fence: 'port_fence', rail: 'port_rail' }, // (the port's own chain-link and guardrail)
  lighting: { hemi: 0.85, key: 1.0, exposure: 1.22, sky: 0xb7c8e6, ground: 0x20232a, sun: 0xd0dcf2, background: 0x04070c },

  zones: [
    // --- the water and the ship (its deck raised over the water, the bridge house a block)
    { id: 'water_n', rect: [0, 0, 3300, 90], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_w', rect: [0, 90, 1010, 507], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_e', rect: [2930, 90, 3300, 507], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_s1', rect: [1010, 480, 2196, 507], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_s2', rect: [2256, 480, 2930, 507], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_pier_w', rect: [0, 507, 454, 1330], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_pier_e', rect: [3213, 507, 3300, 1330], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_ne', rect: [2380, 1330, 3300, 1420], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_jetty', rect: [2560, 1420, 3300, 1500], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_boat', rect: [2380, 1500, 3300, 2060], floor: 'water', light: 'dark', wallLights: false },
    { id: 'water_se', rect: [2540, 2060, 3300, 2720], floor: 'water', light: 'dark', wallLights: false },
    { id: 'lot_w', rect: [0, 1330, 300, 2720], floor: 'road', light: 'dark', wallLights: false }, // (outside the fence)
    { id: 'deck', rect: [1010, 90, 2540, 480], floor: 'deck_plate', light: 'dark', wallLights: false, elev: 40, side: 'bulwark' },
    { id: 'bridge', rect: [2540, 90, 2930, 480], floor: 'deck_plate', light: 'dark', wallLights: false, elev: 112, side: 'bulwark' },
    { id: 'gangway', rect: [2196, 480, 2256, 600], floor: 'grating', light: 'dark', wallLights: false, steps: { axis: 'y', from: 40, to: 0, n: 5 } },
    // --- the pier (round the watch platform and its steps)
    { id: 'pier_w', rect: [454, 507, 1440, 1330], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'pier_n', rect: [1440, 600, 1580, 840], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'pier_gw', rect: [1440, 507, 2196, 600], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'pier_ge', rect: [2256, 507, 3213, 600], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'tower', rect: [1440, 840, 1580, 960], floor: 'grating', light: 'dark', wallLights: false, elev: 70, side: 'bulwark', zoom: 1.7, zoomTouch: 2.1, look: [700, 420] },
    { id: 'tower_steps', rect: [1440, 960, 1580, 1080], floor: 'grating', light: 'dark', wallLights: false, steps: { axis: 'y', from: 70, to: 0, n: 6 } },
    { id: 'pier_s', rect: [1440, 1080, 1580, 1330], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'pier_e', rect: [1580, 600, 3213, 1330], floor: 'quay', light: 'dark', wallLights: false },
    // --- the yard (its grid of rooms); east of it the quay strip along the water (the jetty off it), the dispatcher's
    // office at the road (L03-1: the control room behind, the workshop in front), its front, the strip beside it
    ...YARD.zones,
    { id: 'quay_n', rect: [2110, 1330, 2380, 2060], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'jetty', rect: [2380, 1420, 2560, 1500], floor: 'planks', light: 'dark', wallLights: false },
    { id: 'office_ctrl', rect: [2110, 2060, 2420, 2200], floor: 'grating', light: 'dim', wallLights: false },
    { id: 'office_shop', rect: [2110, 2200, 2420, 2370], floor: 'quay', light: 'dim', wallLights: false },
    { id: 'quay_e', rect: [2420, 2060, 2540, 2370], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'office_front', rect: [2110, 2370, 2540, 2474], floor: 'quay', light: 'dark', wallLights: false },
    { id: 'road', rect: [300, 2474, 2540, 2720], floor: 'road', light: 'dark', wallLights: false },
  ],

  walls: [
    // the quay's edges (the water) and the jetty's
    W(454, 507, 2196, 507, 'edge'), W(2256, 507, 3213, 507, 'edge'), W(454, 507, 454, 1330, 'edge'), W(3213, 507, 3213, 1330, 'edge'),
    W(2196, 480, 2196, 600, 'rail'), W(2256, 480, 2256, 600, 'rail'), // the gangway's railings
    W(2380, 1330, 2380, 1420, 'edge'), W(2380, 1500, 2380, 2060, 'edge'), W(2380, 1420, 2560, 1420, 'edge'), W(2380, 1500, 2560, 1500, 'edge'), W(2560, 1420, 2560, 1500, 'edge'),
    W(2420, 2060, 2540, 2060, 'edge'), W(2540, 2060, 2540, 2720, 'edge'),
    // the ship: its railing round the raised deck; the bridge house's foot
    W(1010, 90, 2540, 90, 'rail', [], { elev: 40 }), W(1010, 90, 1010, 480, 'rail', [], { elev: 40 }), W(1010, 480, 2540, 480, 'rail', [[2196, 2256]], { elev: 40 }),
    W(2540, 90, 2540, 480, 'edge'),
    // the watch platform's railing (up on it) and its stair's
    W(1440, 840, 1580, 840, 'rail', [], { elev: 70 }), W(1440, 840, 1440, 960, 'rail', [], { elev: 70 }), W(1580, 840, 1580, 960, 'rail', [], { elev: 70 }),
    W(1440, 960, 1440, 1080, 'rail'), W(1580, 960, 1580, 1080, 'rail'),
    // the fences: between the pier and the yard / the quay (only the vehicle gate), round the yard (its gates to the
    // road) and the office's front
    W(454, 1330, 2110, 1330, 'fence', [[990, 1070]]), W(300, 1330, 454, 1330, 'fence'), W(2110, 1330, 2380, 1330, 'fence'), W(2380, 1330, 3213, 1330, 'edge'),
    W(300, 1330, 300, 2474, 'fence'), W(300, 2474, 2110, 2474, 'fence', [[330, 430], [1900, 1950]]), W(2110, 2474, 2540, 2474, 'fence'),
    // the dispatcher's office (brick): the control room (doors to the yard and to the quay), the workshop behind its
    // wall (a doorway), the front door to the road side
    W(2110, 2060, 2420, 2060, 'brick', [[2240, 2304]]), W(2110, 2060, 2110, 2370, 'brick', [[2100, 2164]]), W(2420, 2060, 2420, 2370, 'brick'),
    W(2110, 2370, 2420, 2370, 'brick', [[2233, 2297]]), W(2110, 2200, 2420, 2200, 'brick', [[2128, 2192]]),
  ],

  doors: [
    { id: 'gangway_gate', x: 2226, y: 480, axis: 'x', width: 60, kind: 'gate', lock: 'gangway' }, // (lowered: open)
    { id: 'pier_gate', x: 1030, y: 1330, axis: 'x', width: 80, kind: 'gate', lock: 'pierGate', zones: ['pier_w', 'y2_0'] },
    { id: 'ctrl_door', x: 2110, y: 2132, axis: 'y', width: 64, kind: 'metal', zones: ['y5_2', 'office_ctrl'] },
    { id: 'ctrl_back', x: 2272, y: 2060, axis: 'x', width: 64, kind: 'metal', zones: ['quay_n', 'office_ctrl'] },
    { id: 'shop_door', x: 2265, y: 2370, axis: 'x', width: 64, kind: 'metal', zones: ['office_shop', 'office_front'] },
  ],
  openings: [
    ...YARD.openings,
    { x: 2226, y: 600, zones: ['gangway', 'pier_e'] },
    { x: 1440, y: 700, zones: ['pier_w', 'pier_n'] }, { x: 1510, y: 600, zones: ['pier_n', 'pier_gw'] }, { x: 1580, y: 700, zones: ['pier_n', 'pier_e'] },
    { x: 1440, y: 553, zones: ['pier_w', 'pier_gw'] }, { x: 2600, y: 600, zones: ['pier_ge', 'pier_e'] },
    { x: 1510, y: 960, zones: ['tower', 'tower_steps'] }, { x: 1510, y: 1080, zones: ['tower_steps', 'pier_s'] },
    { x: 1440, y: 1200, zones: ['pier_w', 'pier_s'] }, { x: 1580, y: 1200, zones: ['pier_s', 'pier_e'] },
    { x: 2110, y: 1500, zones: ['y5_0', 'quay_n'] }, { x: 2110, y: 1760, zones: ['y5_1', 'quay_n'] }, { x: 2110, y: 1980, zones: ['y5_2', 'quay_n'] },
    { x: 2380, y: 1460, zones: ['quay_n', 'jetty'] }, { x: 2160, y: 2200, zones: ['office_ctrl', 'office_shop'] },
    { x: 2110, y: 2420, zones: ['y5_3', 'office_front'] }, { x: 2480, y: 2370, zones: ['office_front', 'quay_e'] },
    { x: 380, y: 2474, zones: ['road', 'y0_3'] }, { x: 1925, y: 2474, zones: ['road', 'y5_3'] },
  ],

  props: [
    // ===================== the yard (L03-1) =====================
    ...yardBoxes(),
    // pallets stacked (5, 4, 4, 6, 4, 5 high), drums, forklifts, crates
    ...[0, 1, 2, 3, 4].map((k) => at(Y1, 'mt_pallet', 250, 169, { elev: k * 4.5 })), ...[0, 1, 2, 3].map((k) => at(Y1, 'mt_pallet', 1110, 202, { elev: k * 4.5 })),
    ...[0, 1, 2, 3].map((k) => at(Y1, 'mt_pallet', 1127, 255, { elev: k * 4.5 })), ...[0, 1, 2, 3, 4, 5].map((k) => at(Y1, 'mt_pallet', 677, 792, { elev: k * 4.5 })),
    ...[0, 1, 2, 3].map((k) => at(Y1, 'mt_pallet', 719, 798, { elev: k * 4.5 })), ...[0, 1, 2, 3, 4].map((k) => at(Y1, 'mt_pallet', 1011, 735, { elev: k * 4.5 })),
    at(Y1, 'mt_drum_striped', 212, 197), at(Y1, 'mt_drum_striped', 239, 195), at(Y1, 'mt_drum_blue', 262, 190),
    at(Y1, 'mt_drum_red', 824, 488), at(Y1, 'mt_drum_blue', 844, 479), at(Y1, 'mt_drum_striped', 868, 483),
    at(Y1, 'mt_forklift', 136, 461, { rot: FACE_E, yaw: -0.4 }), at(Y1, 'mt_forklift', 1079, 703, { rot: FACE_W, yaw: 0.15 }),
    at(Y1, 'mt_crate', 650, 330, { solid: false }), at(Y1, 'mt_box', 668, 345, { solid: false }),
    { type: 'mt_crate', x: 1120, y: 1598, solid: false }, { type: 'mt_crate', x: 1160, y: 1600, solid: false }, // (cargo inside the open containers)
    { type: 'mt_box', x: 1240, y: 2094, solid: false }, { type: 'mt_crate', x: 1380, y: 2094, solid: false },
    // the floodlight masts, the fences' posts and lanterns, the gates standing open
    at(Y1, 'mt_mast', 163, 231), at(Y1, 'mt_mast', 1283, 233),
    { type: 'mt_gate_leaf', x: 360, y: 2490, rot: FACE_E, yaw: -0.6 }, { type: 'mt_gate_ped', x: 1960, y: 2490, rot: FACE_S, yaw: 0.9 },
    { type: 'mt_gate_leaf', x: 975, y: 1346, rot: FACE_S, yaw: 0.7 }, { type: 'mt_gate_leaf', x: 1086, y: 1346, rot: FACE_S, yaw: -0.7 },
    ...[600, 1400, 1800].map((x) => ({ type: 'mt_fence_lantern', x, y: 1340, rot: FACE_S })),
    ...[1600, 2000].map((y) => ({ type: 'mt_fence_lantern', x: 310, y, rot: FACE_E })),
    { type: 'mt_hazard_strip', x: 430, y: 2484, rot: FACE_S }, { type: 'mt_drain', x: 1100, y: 2420 },
    // ===================== the office (L03-1, right) =====================
    // the control room: the bookcase, the window, the back door; the L-desk — two screens, the radio, the phone, the
    // laptop — the chair pushed back, boxes of files, the shelf; a strip light, damp
    { type: 'mt_bookcase', x: 2134, y: 2075.7, rot: FACE_S }, { type: 'mt_binders', x: 2134, y: 2075, elev: 48.6 },
    { type: 'mt_storage_box', x: 2160, y: 2077 }, { type: 'mt_storage_box', x: 2160, y: 2077, elev: 9.6 },
    { type: 'mt_window_upper', x: 2196, y: 2070.8, rot: FACE_S }, { type: 'mt_strip_light', x: 2196, y: 2072.9, rot: FACE_S, elev: 22 },
    { type: 'mt_door_utility', x: 2242, y: 2082, rot: FACE_E, yaw: -0.9 }, { type: 'mt_damp', x: 2330, y: 2070.8, rot: FACE_S },
    { type: 'mt_control_desk', x: 2366, y: 2099, rot: FACE_S }, { type: 'mt_window_side', x: 2409.3, y: 2150, rot: FACE_W },
    { type: 'mt_monitor_blue', x: 2346, y: 2083, elev: 23.1, rot: FACE_S }, { type: 'mt_monitor_cyan', x: 2382, y: 2086, elev: 23.1, rot: FACE_S, yaw: -0.35 },
    { type: 'mt_keyboard', x: 2350, y: 2103, elev: 23.1 }, { type: 'mt_mouse', x: 2366, y: 2105, elev: 23.1 }, { type: 'mt_laptop', x: 2396, y: 2112, elev: 23.1, yaw: -0.6 },
    { type: 'mt_radio', x: 2332, y: 2090, elev: 23.1 }, { type: 'mt_receiver', x: 2330, y: 2104, elev: 23.1 }, { type: 'mt_mic', x: 2340, y: 2110, elev: 23.1 },
    { type: 'mt_desk_accessory', x: 2398, y: 2088, elev: 23.1 }, { type: 'mt_task_chair', x: 2398, y: 2156, rot: FACE_N, yaw: 0.7 },
    // the workshop: the lockers, the shelf of parts bins, the alarm's panel on its back wall; the workbench (tools, a
    // case, a tin) under its lamp; crates and boxes in the corner, the hose
    { type: 'mt_lockers', x: 2246, y: 2218.4, rot: FACE_S }, { type: 'mt_lockers', x: 2288, y: 2218.4, rot: FACE_S },
    { type: 'mt_shelf', x: 2338, y: 2216.5, rot: FACE_S }, { type: 'mt_parts_bin', x: 2330, y: 2216, elev: 35.1 }, { type: 'mt_parts_bin', x: 2346, y: 2216, elev: 35.1 },
    { type: 'mt_parts_bin', x: 2338, y: 2217, elev: 18 }, { type: 'mt_strip_light', x: 2288, y: 2212.9, rot: FACE_S, elev: 22 },
    { type: 'mt_junction', x: 2212, y: 2213.6, rot: FACE_S }, { type: 'mt_hazard_strip', x: 2224, y: 2210.8, rot: FACE_S },
    { type: 'mt_workbench', x: 2398.9, y: 2296, rot: FACE_W }, { type: 'mt_hand_tools', x: 2398, y: 2278, elev: 28.6 }, { type: 'mt_bench_case', x: 2400, y: 2300, elev: 28.6 },
    { type: 'mt_parts_tin', x: 2396, y: 2316, elev: 28.6 }, { type: 'mt_work_light', x: 2409.3, y: 2270, rot: FACE_W }, { type: 'mt_hose', x: 2409.3, y: 2345, rot: FACE_W },
    { type: 'mt_crate', x: 2140, y: 2340 }, { type: 'mt_box', x: 2142, y: 2340, elev: 32.4 }, { type: 'mt_storage_box', x: 2176, y: 2352 }, { type: 'mt_storage_box', x: 2176, y: 2352, elev: 9.6 },
    { type: 'mt_case', x: 2138, y: 2300 }, { type: 'mt_storage_box', x: 2340, y: 2353 }, { type: 'mt_pallet', x: 2336, y: 2298 },
    { type: 'mt_carton', x: 2328, y: 2294, elev: 4.5 }, { type: 'mt_carton', x: 2345, y: 2300, elev: 4.5 }, { type: 'mt_carton', x: 2336, y: 2297, elev: 17.4 },
    // its front (to the road): two windows, the lamp over the door standing open, the hose reel, the downpipes, the stains
    { type: 'mt_window_warm', x: 2165, y: 2380.8, rot: FACE_S }, { type: 'mt_window_warm', x: 2362, y: 2380.8, rot: FACE_S },
    { type: 'mt_caged_lantern', x: 2265, y: 2385, rot: FACE_S }, { type: 'mt_hose', x: 2404, y: 2384.3, rot: FACE_S },
    { type: 'mt_downpipe', x: 2116, y: 2382.1, rot: FACE_S }, { type: 'mt_downpipe', x: 2414, y: 2382.1, rot: FACE_S },
    { type: 'mt_brick_runoff', x: 2205, y: 2380.8, rot: FACE_S }, { type: 'mt_brick_runoff', x: 2320, y: 2380.8, rot: FACE_S },
    { type: 'mt_door_entry', x: 2310, y: 2392, rot: FACE_E, yaw: 0.6 }, { type: 'mt_drain', x: 2265, y: 2392 },
    { type: 'mt_gooseneck', x: 2409.3, y: 2120, rot: FACE_W }, { type: 'mt_window_dark', x: 2120.7, y: 2280, rot: FACE_E },
    // the strip beside the office and its front: bollards, fenders, the ladder down to the water, a lantern
    { type: 'mt_bollard', x: 2525, y: 2110 }, { type: 'mt_bollard', x: 2525, y: 2300 }, { type: 'mt_bollard', x: 2525, y: 2450 },
    { type: 'mt_fender', x: 2546, y: 2200, rot: FACE_E }, { type: 'mt_fender', x: 2546, y: 2380, rot: FACE_E }, { type: 'mt_quay_ladder', x: 2547, y: 2250, rot: FACE_E },
    { type: 'mt_jetty_lantern', x: 2528, y: 2075 }, { type: 'mt_case', x: 2440, y: 2450 }, { type: 'mt_drum_blue', x: 2160, y: 2440 }, { type: 'mt_drum_striped', x: 2180, y: 2448 },
    // ===================== the quay strip along the yard, the jetty and the dispatcher's boat =====================
    { type: 'mt_container_red', x: 2200, y: 1720, rot: FACE_N }, { type: 'mt_drum_red', x: 2136, y: 1556 }, { type: 'mt_drum_banded', x: 2140, y: 1576 },
    { type: 'mt_crate', x: 2150, y: 2025 }, { type: 'mt_crate', x: 2150, y: 2025, elev: 32.4, solid: false }, { type: 'mt_cage', x: 2192, y: 2030 },
    ...[1390, 1560, 1780, 1990].map((y) => ({ type: 'mt_bollard', x: 2366, y })), { type: 'mt_hawser', x: 2316, y: 1640 },
    ...[1700, 1880].map((y) => ({ type: 'mt_fender', x: 2386, y, rot: FACE_E })), { type: 'mt_drain', x: 2300, y: 1840 },
    { type: 'mt_pile', x: 2392, y: 1412 }, { type: 'mt_pile', x: 2552, y: 1412 }, { type: 'mt_pile', x: 2552, y: 1508 }, { type: 'mt_pile', x: 2470, y: 1508 },
    { type: 'mt_jetty_lantern', x: 2396, y: 1428 }, { type: 'mt_jetty_lantern', x: 2548, y: 1428 }, { type: 'mt_hawser', x: 2500, y: 1462 },
    { type: 'mt_boat', x: 2680, y: 1560, rot: FACE_E, yaw: 0.25, solid: false }, { type: 'mt_outboard', x: 2780, y: 1590, solid: false },
    { type: 'mt_boat_fender', x: 2650, y: 1515 }, { type: 'mt_boat_fender', x: 2720, y: 1525 },

    // ===================== the pier (L03-2) =====================
    // the gantry crane at the water (its cab over the water: the sniper), its rails, its lifting gear
    { type: 'mt_crane', x: 760, y: 560 }, { type: 'mt_crane_console', x: 690, y: 430, elev: 226 }, { type: 'mt_crane_display', x: 712, y: 424, elev: 236 },
    { type: 'mt_spreader', x: 820, y: 360, elev: 150 }, { type: 'mt_hoist', x: 820, y: 360, elev: 200 },
    ...[560, 650, 740, 830, 920, 1010, 1100, 1190, 1280].map((y) => ({ type: 'mt_rails', x: 760, y })),
    ...[1170, 1260].map((y) => ({ type: 'mt_rails', x: 1905, y })), { type: 'mt_safety_post', x: 1860, y: 1210 }, { type: 'mt_safety_post', x: 1950, y: 1210 },
    { type: 'mt_hazard_strip', x: 1905, y: 1315, rot: FACE_S },
    // containers: a stack by the crane, two on the east of the pier
    at(P2, 'mt_container_red', 385, 500, { rot: FACE_S }), at(P2, 'mt_container_green', 385, 500, { rot: FACE_N, elev: 78, solid: false }),
    at(P2, 'mt_container_blue', 1378, 419, { rot: FACE_E }), at(P2, 'mt_container_red', 1434, 487, { rot: FACE_W }),
    // the box truck, crates, cages, pallets, cartons, drums
    at(P2, 'mt_truck', 787, 423, { rot: FACE_W, yaw: 0.4 }),
    at(P2, 'mt_case', 465, 453), at(P2, 'mt_crate', 469, 427), at(P2, 'mt_crate', 469, 427, { elev: 32, solid: false }), at(P2, 'mt_crate', 517, 463),
    ...[0, 1, 2, 3, 4].map((k) => at(P2, 'mt_pallet', 477, 500, { elev: k * 4.5 })),
    at(P2, 'mt_cage_empty', 1237, 415), at(P2, 'mt_crate', 1172, 528), at(P2, 'mt_crate', 1204, 541), at(P2, 'mt_crate', 1248, 511),
    ...[0, 1, 2].map((k) => at(P2, 'mt_pallet', 1265, 549, { elev: k * 4.5 })), ...[0, 1, 2, 3, 4].map((k) => at(P2, 'mt_pallet', 1316, 470, { elev: k * 4.5 })),
    at(P2, 'mt_drum_striped', 1416, 520), at(P2, 'mt_drum_banded', 1439, 518), at(P2, 'mt_drum_banded', 1461, 520),
    at(P2, 'mt_carton', 562, 661), at(P2, 'mt_cage', 573, 698), at(P2, 'mt_carton', 582, 679), at(P2, 'mt_box', 600, 661), at(P2, 'mt_crate', 647, 695),
    at(P2, 'mt_cage_empty', 1112, 690), at(P2, 'mt_cage_empty', 1168, 679), ...[0, 1, 2, 3, 4, 5].map((k) => at(P2, 'mt_pallet', 1172, 697, { elev: k * 4.5 })),
    // the quay's edge: bollards, coiled hawsers, lanterns; the access tower (east), its junction box
    at(P2, 'mt_bollard', 540, 299), at(P2, 'mt_bollard', 803, 297), at(P2, 'mt_bollard', 1260, 299), at(P2, 'mt_bollard', 1443, 297),
    at(P2, 'mt_hawser', 476, 313), at(P2, 'mt_hawser', 1387, 314), { type: 'mt_jetty_lantern', x: 1700, y: 520 }, { type: 'mt_jetty_lantern', x: 2700, y: 520 },
    { type: 'mt_container_blue', x: 2600, y: 1100, rot: FACE_S }, { type: 'mt_container_red', x: 2896, y: 1100, rot: FACE_N }, // (by the fence, L03-2 bottom right)
    at(P2, 'mt_access_tower', 1588, 616), at(P2, 'mt_junction', 1617, 582, { rot: FACE_S }),
    // the watch platform: two cases for cover up there (the rifle's case is the crate)
    { type: 'mt_case', x: 1462, y: 862, elev: 70 }, { type: 'mt_case', x: 1558, y: 862, elev: 70 },
    // ===================== the ship "Meridian" (L03-2, top) =====================
    { type: 'mt_hatch_cover', x: 1300, y: 270, elev: 40 }, { type: 'mt_hatch_cover', x: 1640, y: 270, elev: 40 }, { type: 'mt_hatch_cover', x: 1980, y: 270, elev: 40 },
    at(P2, 'mt_winch', 486, 151, { rot: FACE_W, elev: 40 }), at(P2, 'mt_winch', 496, 107, { rot: FACE_W, elev: 40 }), at(P2, 'mt_capstan', 435, 138, { elev: 40 }),
    at(P2, 'mt_nav_mast', 526, 147, { elev: 40 }), { type: 'mt_nav_mast', x: 2700, y: 260, elev: 112 }, { type: 'mt_radome', x: 2620, y: 200, elev: 112 },
    { type: 'mt_radome', x: 2820, y: 180, elev: 112 }, at(P2, 'mt_deck_post', 387, 133, { elev: 40 }), at(P2, 'mt_fairlead', 392, 128, { elev: 40 }),
    { type: 'mt_deck_post', x: 1240, y: 440, elev: 40 }, { type: 'mt_deck_post', x: 2380, y: 440, elev: 40 }, { type: 'mt_vent', x: 2470, y: 420, elev: 40 },
    { type: 'mt_vent', x: 1100, y: 420, elev: 40 }, { type: 'mt_box', x: 1630, y: 440, elev: 40 },
    // the bridge house's front: its windows, lifebuoys, the warning plates, rust
    { type: 'mt_bridge_window', x: 2640, y: 490.8, rot: FACE_S, elev: 50 }, { type: 'mt_bridge_window', x: 2830, y: 490.8, rot: FACE_S, elev: 50 },
    { type: 'mt_ship_window', x: 2580, y: 490.8, rot: FACE_S, elev: 20 }, { type: 'mt_ship_window_dark', x: 2720, y: 490.8, rot: FACE_S, elev: 20 },
    { type: 'mt_ship_window', x: 2890, y: 490.8, rot: FACE_S, elev: 20 }, { type: 'mt_lifebuoy', x: 2760, y: 492, rot: FACE_S, elev: 6 },
    { type: 'mt_warning_plate', x: 2600, y: 490.8, rot: FACE_S }, { type: 'mt_caged_lantern', x: 2680, y: 494, rot: FACE_S, elev: 30 },
    // the hull's side over the water: rust runs, the bow's lettering
    ...[1200, 1500, 1800, 2100, 2400].map((x) => ({ type: 'mt_rust', x, y: 490.8, rot: FACE_S })), { type: 'mt_bow_lettering', x: 1120, y: 490.8, rot: FACE_S },
  ],

  decals: [
    { t: 'marking', x: 1030, y: 1380, w: 140, d: 6 }, { t: 'hazard', x: 1030, y: 1316, w: 90, d: 22 },
    { t: 'hazard', x: 2226, y: 610, w: 70, d: 22 }, { t: 'marking', x: 1800, y: 640, w: 1400, d: 6 }, { t: 'marking', x: 1300, y: 2440, w: 900, d: 6 }, { t: 'marking', x: 1400, y: 2600, w: 2000, d: 5 },
    { t: 'scuff', x: 1000, y: 2150, w: 140, r: 0.4 }, { t: 'scuff', x: 1600, y: 1000, w: 160 }, { t: 'coffee', x: 2350, y: 2135, w: 26 },
  ],
  lights: [
    { x: 407, y: 1560, kind: 'flood', sx: 1, sz: 1 }, { x: 2311, y: 1560, kind: 'flood', sx: 1, sz: 1 },
    { x: 1030, y: 1400, kind: 'dim', sx: 1.4, sz: 1 }, { x: 1510, y: 900, kind: 'dim', sx: 0.8, sz: 0.8 }, { x: 2226, y: 560, kind: 'lamp', sx: 1.2, sz: 1.2 },
    { x: 2700, y: 540, kind: 'lamp', sx: 1.5, sz: 1 }, { x: 2470, y: 1460, kind: 'lamp', sx: 1.2, sz: 1 },
    { x: 2366, y: 2112, kind: 'screen', sx: 0.8, sz: 0.6 }, { x: 2265, y: 2412, kind: 'lamp', sx: 1, sz: 0.8 },
  ],

  enemies: [
    // the yard's night shift
    { type: 'cleaner', x: 438, y: 1520, angle: PI / 2, patrol: [[438, 1520, 2, PI / 2], [438, 2140, 2.5, -PI / 2]] },
    { type: 'assaulter', x: 880, y: 1700, angle: 0, patrol: [[880, 1700, 2, 0], [1400, 1700, 2.5, PI]] },
    { type: 'cleaner', x: 500, y: 2410, angle: 0, patrol: [[500, 2410, 3, 0], [1600, 2410, 2, PI]] },
    { type: 'cleaner', x: 1300, y: 1495, angle: 0, patrol: [[1300, 1495, 2, 0], [1900, 1495, 2, PI]] },
    { type: 'assaulter', x: 2065, y: 1850, angle: PI },
    { type: 'cleaner', x: 2285, y: 1400, angle: PI / 2, patrol: [[2285, 1400, 2, PI / 2], [2285, 2000, 3, -PI / 2]] },
    // the dispatcher at his screens (unarmed, busy — his back to the room; alarmed: he runs for his boat)
    { type: 'dispatcher', x: 2350, y: 2145, angle: -PI / 2, busy: true, harmless: true, capture: true, tag: 'dispatcher', flee: [2540, 1460] },
    // the pier: the sniper in the crane's cab over the water (never reached), two of the cleaners
    { type: 'sniper', x: 700, y: 440, angle: 0.4, elev: 228, tag: 'sniper', wakeOn: 'sniper' },
    { type: 'cleaner', x: 2000, y: 760, angle: PI / 2, patrol: [[2000, 760, 2, PI / 2], [2400, 1000, 2, PI]] },
    { type: 'assaulter', x: 2480, y: 1250, angle: PI, patrol: [[2480, 1250, 3, PI], [1900, 1250, 2, 0]] },
  ],

  pickups: [
    { id: 'rifle_case', kind: 'crate', item: 'sniper', x: 1510, y: 872, elev: 70 }, // the watch platform's rifle
    { id: 'ammo_yard', kind: 'crate', item: 'ammo', count: 2, x: 1290, y: 2240 },
    { id: 'grenades_box', kind: 'crate', item: 'grenades', count: 2, x: 700, y: 1500 },
    { id: 'ammo_pier', kind: 'crate', item: 'ammo', count: 2, x: 1350, y: 1250 },
    // the alarm's panel (E while it rings): the office's workshop
    { id: 'alarm_cut_office', kind: 'activate', task: 'alarm', label: 'hud.alarmCut', x: 2212, y: 2234 },
  ],

  // [стелс] by choice: seen — the alarm; groups from the gates until it is cut (the office's workshop)
  alarm: {
    radio: 3, first: 6, every: [12, 18], group: [1, 2], maxAlive: 4, types: ['cleaner', 'assaulter'],
    from: { gateS: { x: 380, y: 2430 }, gateE: { x: 1925, y: 2430 }, quayE: { x: 2480, y: 2420 }, pierGate: { x: 1030, y: 1380 } },
    during: ['capture'], dialogue: 'term.alarm', offDialogue: 'term.alarmOff',
  },
  // the floodlight masts' lamps sweep the aisles: lit 0.9 s — the alarm
  searchlights: [
    { kind: 'sweep', x: 407, y: 1462, top: 320, reach: 430, from: 0.15, to: 1.35, period: 9, radius: 64, spot: 0.9, during: ['capture'] },
    { kind: 'sweep', x: 2311, y: 1465, top: 320, reach: 470, from: 1.75, to: 2.9, period: 11, radius: 64, spot: 0.9, during: ['capture'] },
  ],

  objectives: [
    { id: 'capture', type: 'capture', tag: 'dispatcher', textKey: 'obj.term.capture', done: 'captured' },
    { id: 'talk', type: 'call', textKey: 'obj.term.talk', dialogue: 'term.talk', done: 'talked', gives: 'pierGate' },
    { id: 'pier', type: 'reach', room: 'pier_w', textKey: 'obj.term.pier', target: [1030, 1330], done: 'atPier' },
    { id: 'sniper', type: 'clear', tag: 'sniper', via: 'rifle_case', textKey: 'obj.term.sniper', done: 'sniperDown', startDialogue: 'term.sniper' },
    {
      id: 'cover', type: 'defend', textKey: 'obj.term.cover', duration: 90, guard: [2160, 600, 2292, 720], reachFor: 3,
      gives: 'gangway', done: 'gangway', startDialogue: 'term.cover', look: [2226, 600], target: [1510, 900],
      spawnPoints: { west: { x: 600, y: 1250 }, gate: { x: 1030, y: 1420 }, east: { x: 3100, y: 900 } },
      waves: { first: 4, every: [7, 10], group: [1, 2], maxAlive: 5, types: ['cleaner', 'assaulter', 'cleaner', 'shield'], from: ['west', 'east', 'gate', 'west', 'east'] },
    },
    { id: 'board', textKey: 'obj.term.board', target: 'exit' },
  ],
  exit: { rect: [2180, 400, 2272, 478], x: 2226, y: 440 },
};
