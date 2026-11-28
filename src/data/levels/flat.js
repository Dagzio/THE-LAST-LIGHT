// D148 / D149 — Marseille, level 2 "The Old Port: the safe flat" (STORY_DESIGN_D133.md §6). D149 (user: too empty,
// not like the references, the stairs a slab with a rail): rebuilt on the references themselves —
// NEW/references/Location1/L02-1.png (the house cut open, its three floors side by side) and L02-2.png (its roofs), at
// their own scale (a floor ≈ 8 × 10 m, one screen; rooms 36 units a metre, the furniture its real size) and furnished
// from the catalogue's placement of the reference (NEW/marseille/L02/catalog.json). Data only (world units; x → east,
// y → south). Prop `rot`: FACE_S 0 … — where its front faces (the catalogue's 0 / 90 / 180 / 270° → S / E / N / W).
//
// The floors are drawn apart like the reference and joined by their stairs (level.stairs — core/MissionRun.js): a
// flight down sinks into its stairwell, a flight up rises to its wall; its far end takes the hero to the other floor.
//   A — the 4th floor: Moro's flat (the stair hall, the bathroom with the stash, the kitchen, the living room / study,
//       the bedroom); B — the 3rd floor: the stair hall, the left / right flats, the flat behind the middle door;
//   C — the ground floor: the hall with its stairs, the mailboxes' corner, the side door to the alley; the alley's fire
//       escape up to the roofs: the terrace, a plank over the alley, the middle roof (the stair hut, the water tank),
//       another plank, the west roof with the open hatch — the way out.
// Section 1: [СЦЕНА] Moro dead, the laptop → [ЗВОНОК] Vance: "a traitor" — Lyra: the stash under the bath → the
// stash (the silenced pistol) → [ЗАЧИСТКА] the cleaners, top to bottom (the shield trooper first up the stairs).
// Section 2: the street is the police's — the alley, the fire escape → [ПОБЕГ] the helicopter's searchlight over the
// roofs (shelter in the stair hut / under the tank) → the cleaners' leader carries the liquidation order → the hatch.
const W = (x0, y0, x1, y1, style, gaps = []) => ({ x0, y0, x1, y1, style, gaps });
const FACE_S = 0, FACE_W = 1, FACE_N = 2, FACE_E = 3; // prop `rot`: where its front faces

/** A part of the level drawn at an offset: its rooms, walls, props in local units. */
function part(ox, oy, area) {
  const X = (x) => ox + x, Y = (y) => oy + y;
  return {
    X, Y,
    z: (id, x0, y0, x1, y1, floor, extra = {}) => ({ id, rect: [X(x0), Y(y0), X(x1), Y(y1)], floor, light: 'dark', wallLights: false, area, ...extra }),
    w: (x0, y0, x1, y1, style, gaps = []) => W(X(x0), Y(y0), X(x1), Y(y1), style, gaps.map(([a, b]) => (y0 === y1 ? [X(a), X(b)] : [Y(a), Y(b)]))),
    p: (type, x, y, o = {}) => ({ type, x: X(x), y: Y(y), ...o }),
    o: (x, y, a, b) => ({ x: X(x), y: Y(y), zones: [a, b] }),
    r: (x0, y0, x1, y1) => [X(x0), Y(y0), X(x1), Y(y1)],
    at: (x, y, angle) => [X(x), Y(y), angle],
    steps: (axis, from, to, n) => ({ axis, from, to, n }),
  };
}
const A = part(100, 1220, 'A'), B = part(520, 1220, 'B'), C = part(950, 1220, 'C'), R = part(100, 40, 'roofs');
const PI = Math.PI;

/** The street front of a floor (outside its south wall): shuttered windows with iron guards and flower boxes. */
function facade(P, xs, y, extra = []) {
  const out = [];
  for (const x of xs) {
    out.push(P.p('mf_window_facade', x, y + 7.75, { rot: FACE_S }), P.p('mf_window_guard', x, y + 9.6, { rot: FACE_S }), P.p('mf_flower_box', x, y + 12, { rot: FACE_S }));
  }
  return [...out, ...extra];
}
/** Three terracotta pots on a chimney (a wall's top at `elev`). */
const pots = (P, x, y, elev = 78) => [-10, 0, 10].map((dx) => P.p('mf_chimney_pot', x + dx, y, { elev }));

export const FLAT = {
  id: 'flat',
  nameKey: 'level.flat.name',
  descKey: 'level.flat.desc',
  location: 'marseille',
  requires: 'office',
  preview: 'assets/ui/previews/flat.webp',
  width: 1600,
  height: 1700,
  wallHeight: 78,
  wallThickness: 14,
  buildingRect: [100, 1220, 1210, 1573],
  nightWindows: false, // (the office's lit night windows do not fit the old house: its own window pictures instead)
  playerSpawn: { x: A.X(196), y: A.Y(60), angle: PI / 2 }, // up the stairs, in the 4th floor's stair hall
  menuModes: ['mission'],
  modes: { mission: {} },
  loadout: { weapons: ['pistol', 'smg'], grenades: { frag: 1 } }, // (Kane keeps the SMG of the Ardent job)
  enemyTypes: ['cleaner', 'assaulter', 'shield', 'moro'],
  lighting: { hemi: 0.85, key: 0.95, exposure: 1.22, sky: 0xbfcfec, ground: 0x22252c, sun: 0xd6e0f5, background: 0x05070b },

  zones: [
    // ===== A — the 4th floor, Moro's flat
    A.z('a_bath', 0, 0, 120, 135, 'bath_tile'),
    A.z('a_hall', 120, 0, 238, 135, 'floorboards', { light: 'dim' }),
    A.z('a_stair', 238, 0, 292, 80, 'floorboards', { steps: A.steps('y', -70, 0, 7), side: 'plaster' }), // down (north) into the well
    A.z('a_hall_e', 238, 80, 292, 135, 'floorboards'),
    A.z('a_kitchen', 0, 135, 120, 247, 'terracotta'),
    A.z('a_bed', 0, 247, 120, 353, 'floorboards'),
    A.z('a_living', 120, 135, 292, 353, 'floorboards'),
    A.z('a_street', 0, 360, 292, 440, 'setts', { area: null }),
    // ===== B — the 3rd floor
    B.z('b_left', 0, 0, 106, 220, 'terracotta'),
    B.z('b_up', 106, 0, 157, 140, 'floorboards', { steps: B.steps('y', 70, 0, 7) }),                      // up (north) to the 4th
    B.z('b_down', 157, 0, 208, 140, 'floorboards', { steps: B.steps('y', -70, 0, 7), side: 'plaster' }),  // down (north) to the ground floor
    B.z('b_hall', 106, 140, 208, 220, 'encaustic', { light: 'dim' }),
    B.z('b_right', 208, 0, 302, 220, 'encaustic'),
    B.z('b_bottom', 0, 220, 302, 353, 'encaustic'),
    B.z('b_street', 0, 360, 302, 440, 'setts', { area: null }),
    // ===== C — the ground floor, the alley, the fire escape
    C.z('c_hall', 0, 0, 136, 349, 'encaustic', { light: 'dim' }),
    C.z('c_stair', 136, 0, 188, 245, 'floorboards', { steps: C.steps('y', 70, 0, 10) }),                   // up (north) to the 3rd
    C.z('c_hall_s', 136, 245, 188, 349, 'encaustic'),
    C.z('c_annex', 188, 126, 260, 349, 'encaustic'),
    C.z('c_alley', 188, -220, 300, 126, 'setts'),
    C.z('c_fire', 188, -320, 300, -220, 'grating', { steps: C.steps('y', 70, 0, 6), side: 'brick' }),     // the fire escape up (north)
    C.z('c_street', 0, 356, 300, 440, 'setts', { area: null }),
    // ===== the roofs
    R.z('r_left', 0, 280, 310, 660, 'roof'),
    R.z('r_plank1', 310, 470, 390, 530, 'planks'),
    R.z('r_mid', 390, 300, 950, 660, 'roof'),
    R.z('r_mid_nw', 390, 220, 560, 300, 'roof'),
    R.z('r_hut', 560, 150, 720, 300, 'planks', { light: 'dim' }),
    R.z('r_mid_ne', 720, 220, 950, 300, 'roof'),
    R.z('r_plank2', 950, 250, 1030, 310, 'planks'),
    R.z('r_terrace', 1030, 100, 1330, 400, 'roof'),
  ],

  walls: [
    // ===== A
    A.w(0, 0, 292, 0, 'limestone'), A.w(0, 0, 0, 353, 'limestone'), A.w(0, 353, 292, 353, 'limestone'), A.w(292, 0, 292, 353, 'limestone'),
    A.w(120, 0, 120, 135, 'plaster', [[78, 130]]),          // bathroom | stair hall (the bathroom's door)
    A.w(0, 135, 292, 135, 'plaster', [[126, 178]]),         // the hall → the living room (the flat's door)
    A.w(120, 135, 120, 190, 'plaster'),                     // the kitchen opens into the living room below this
    A.w(0, 247, 120, 247, 'plaster'),
    A.w(120, 247, 120, 353, 'plaster', [[258, 310]]),       // the bedroom's door
    A.w(238, 0, 238, 80, 'banister'),                       // the stairwell's balustrade
    // ===== B
    B.w(0, 0, 302, 0, 'limestone'), B.w(0, 0, 0, 353, 'limestone'), B.w(0, 353, 302, 353, 'limestone'), B.w(302, 0, 302, 353, 'limestone'),
    B.w(106, 0, 106, 220, 'plaster', [[154, 206]]), B.w(208, 0, 208, 220, 'plaster', [[154, 206]]),
    B.w(0, 220, 302, 220, 'plaster', [[131, 183]]),
    B.w(157, 0, 157, 140, 'edge'),                          // between the flights (the balustrade's pictures below)
    // ===== C
    C.w(0, 0, 188, 0, 'limestone'), C.w(0, 0, 0, 349, 'limestone'), C.w(0, 349, 260, 349, 'limestone'),
    C.w(136, 0, 136, 245, 'edge'),                          // the stair's open side (its balustrade pictures)
    C.w(188, 0, 188, 245, 'limestone'),
    C.w(188, 126, 260, 126, 'limestone', [[202, 254]]),     // the side door to the alley
    C.w(260, 126, 260, 349, 'limestone'),
    C.w(188, -320, 188, 0, 'brick'), C.w(300, -320, 300, 126, 'brick'), C.w(260, 126, 300, 126, 'brick'), C.w(188, -320, 300, -320, 'brick'),
    // ===== the roofs: the neighbours' walls behind (north), low parapets on the drops, the planks' sides open
    R.w(0, 280, 310, 280, 'limestone'), R.w(0, 280, 0, 660, 'parapet'), R.w(0, 660, 310, 660, 'parapet'),
    R.w(310, 280, 310, 660, 'parapet', [[470, 530]]),
    R.w(310, 470, 390, 470, 'edge'), R.w(310, 530, 390, 530, 'edge'),
    R.w(390, 220, 560, 220, 'limestone'), R.w(720, 220, 950, 220, 'limestone'),
    R.w(390, 220, 390, 660, 'parapet', [[470, 530]]), R.w(390, 660, 950, 660, 'parapet'), R.w(950, 220, 950, 660, 'parapet', [[250, 310]]),
    R.w(560, 150, 720, 150, 'limestone'), R.w(560, 150, 560, 300, 'limestone'), R.w(720, 150, 720, 300, 'limestone'),
    R.w(560, 300, 720, 300, 'limestone', [[610, 670]]),     // the stair hut, its doorway south
    R.w(950, 250, 1030, 250, 'edge'), R.w(950, 310, 1030, 310, 'edge'),
    R.w(1030, 100, 1330, 100, 'limestone'), R.w(1030, 100, 1030, 400, 'parapet', [[250, 310]]),
    R.w(1330, 100, 1330, 400, 'rail'), R.w(1030, 400, 1330, 400, 'rail'), // the terrace's railings (the fire escape, the tiled roof below)
    R.w(450, 620, 510, 620, 'brick'),                       // a chimney on the middle roof
  ],
  doors: [],
  openings: [
    A.o(265, 80, 'a_stair', 'a_hall_e'), A.o(238, 108, 'a_hall', 'a_hall_e'), A.o(120, 104, 'a_bath', 'a_hall'),
    A.o(152, 135, 'a_hall', 'a_living'), A.o(120, 218, 'a_kitchen', 'a_living'), A.o(120, 284, 'a_bed', 'a_living'),
    B.o(106, 180, 'b_left', 'b_hall'), B.o(208, 180, 'b_right', 'b_hall'), B.o(131, 140, 'b_hall', 'b_up'),
    B.o(182, 140, 'b_hall', 'b_down'), B.o(157, 220, 'b_hall', 'b_bottom'),
    C.o(136, 300, 'c_hall', 'c_hall_s'), C.o(162, 245, 'c_stair', 'c_hall_s'), C.o(188, 300, 'c_hall_s', 'c_annex'),
    C.o(228, 126, 'c_annex', 'c_alley'), C.o(244, -220, 'c_alley', 'c_fire'),
    R.o(310, 500, 'r_left', 'r_plank1'), R.o(390, 500, 'r_plank1', 'r_mid'), R.o(475, 300, 'r_mid', 'r_mid_nw'),
    R.o(835, 300, 'r_mid', 'r_mid_ne'), R.o(640, 300, 'r_mid', 'r_hut'), R.o(950, 280, 'r_mid_ne', 'r_plank2'), R.o(1030, 280, 'r_plank2', 'r_terrace'),
  ],
  // D149: the stairs between the floors — a flight's far end (rect) takes the hero to the other floor (to: x, y, facing);
  // `leads` — the areas this way leads to (the objective marker), `forward` — the way on
  stairs: [
    { id: 'a_down', area: 'A', rect: A.r(238, 0, 292, 32), to: B.at(131, 52, PI / 2), forward: true, leads: ['B', 'C', 'roofs'] },
    { id: 'b_up', area: 'B', rect: B.r(106, 0, 157, 32), to: A.at(265, 100, PI / 2), leads: ['A'] },
    { id: 'b_down', area: 'B', rect: B.r(157, 0, 208, 32), to: C.at(162, 52, PI / 2), forward: true, leads: ['C', 'roofs'] },
    { id: 'c_up', area: 'C', rect: C.r(136, 0, 188, 32), to: B.at(182, 52, PI / 2), leads: ['A', 'B'] },
    { id: 'c_fire', area: 'C', rect: C.r(188, -320, 300, -288), to: R.at(1262, 180, PI), forward: true, leads: ['roofs'] },
    { id: 'r_down', area: 'roofs', rect: R.r(1292, 130, 1330, 230), to: C.at(244, -200, PI / 2), leads: ['A', 'B', 'C'] },
  ],
  // the neighbours' tiled roof (L02-2's right), the helicopter's light does not see in the stair hut / under the tank
  roofs: [{ rect: R.r(1030, 400, 1400, 690), ridge: 'x', height: 95 }],
  shelters: [R.r(567, 157, 713, 293), R.r(446, 238, 494, 282)],

  props: [
    // ======================= A — the 4th floor (L02-1, left) =======================
    // the bathroom: toilet, basin, bidet on the west wall, the curtained shower, the tiled cover (the stash) lifted
    A.p('mf_shower', 96, 26), A.p('mf_toilet', 18, 40, { rot: FACE_E }), A.p('mf_sink', 15, 72, { rot: FACE_E }),
    A.p('mf_bidet', 15.4, 102, { rot: FACE_E }), A.p('mf_bath_cover', 80, 110, { yaw: 0.6 }), A.p('mf_basket_small', 104, 124),
    A.p('mf_window_bath', 62, 7.75, { rot: FACE_S }), A.p('mf_sconce', 22, 10.2, { rot: FACE_S }), A.p('mf_cloth', 30, 74, { elev: 26 }),
    // the stair hall: the well going down, its balustrade, a lamp, a trunk, the flat's door standing open
    A.p('mf_newel', 238, 80), A.p('mf_sconce', 265, 10.2, { rot: FACE_S }), A.p('mf_portrait', 150, 7.75, { rot: FACE_S }),
    A.p('mf_plaster_patch', 222, 7.75, { rot: FACE_S }), A.p('mf_trunk', 196, 13.6, { rot: FACE_S }), A.p('mf_basket', 226, 24),
    A.p('mf_sconce', 130, 10.2, { rot: FACE_S }),
    A.p('mf_door_leaf', 175, 154, { rot: FACE_W }), A.p('mf_door_leaf', 122, 117, { rot: FACE_S, yaw: 0.3 }),
    // the kitchen: the L-shaped counter (hob, sink, board, bottles), the fridge, the pan rail
    A.p('mf_kitchen', 50, 178, { rot: FACE_S }), A.p('mf_fridge', 102, 153, { rot: FACE_S }), A.p('mf_pan_rail', 44, 143.7, { rot: FACE_S }),
    A.p('mf_hob', 76, 152, { elev: 27.3 }), A.p('mf_sink_double', 20, 196, { elev: 27.3, rot: FACE_E }), A.p('mf_board', 56, 151, { elev: 27.3 }),
    A.p('mf_bottle', 30, 150, { elev: 27.3 }), A.p('mf_jar', 16, 160, { elev: 27.3 }), A.p('mf_plates', 17, 212, { elev: 27.3 }),
    A.p('mf_pan', 88, 151, { elev: 27.3 }), A.p('mf_basket_small', 103, 230), A.p('mf_moss', 60, 142.75, { rot: FACE_S }),
    // the bedroom: the bed (head on the west wall), the wardrobe, the nightstand's lamp, the runner, the door open
    A.p('mf_wardrobe', 15.4, 268, { rot: FACE_E }), A.p('mf_bed', 38.4, 318, { rot: FACE_W }), A.p('mf_nightstand', 62, 261.2, { rot: FACE_S }),
    A.p('mf_lamp_small', 62, 261, { elev: 18.6 }), A.p('mf_runner_bed', 86, 318), A.p('mf_sconce', 100, 257.2, { rot: FACE_S }),
    A.p('mf_door_leaf', 101, 307, { rot: FACE_S, yaw: -0.25 }), A.p('mf_case', 100, 336),
    // the living room / study: the bookcase, the desk (the laptop, papers, a mug), the rug, the leather sofa (its
    // throw), the lamp table, the knocked-over chair, the blood — and Moro (enemies, below); boxes along the south wall
    A.p('mf_bookcase', 228, 147, { rot: FACE_S }), A.p('mf_books', 220, 147, { elev: 27.3 }), A.p('mf_shelf_plant', 240, 147, { elev: 27.3 }),
    A.p('mf_picture', 270, 142.75, { rot: FACE_S }), A.p('mf_lamp_stand', 192, 147), A.p('mf_lamp_small', 192, 147, { elev: 21.6 }),
    A.p('mf_rug_study', 214, 262), A.p('mf_desk', 205, 238, { rot: FACE_S }), A.p('mf_chair_curved', 205, 219, { rot: FACE_N }),
    A.p('mf_laptop', 208, 235, { elev: 22.8 }), A.p('mf_notes', 190, 242, { elev: 22.8, yaw: 0.3 }), A.p('mf_notes', 196, 246, { elev: 22.9, yaw: -0.4 }),
    A.p('mf_mug', 224, 240, { elev: 22.8 }), A.p('mf_tin', 227, 232, { elev: 22.8 }), A.p('mf_ink', 186, 233, { elev: 22.8 }),
    A.p('mf_sofa_leather', 272, 262, { rot: FACE_W }), A.p('mf_throw', 273, 282, { rot: FACE_W, elev: 7 }), A.p('mf_cushion', 271, 246, { rot: FACE_W, elev: 10 }),
    A.p('mf_end_table', 276, 218), A.p('mf_lamp', 276, 218, { elev: 19.2 }),
    A.p('mf_chair_curved', 204, 302, { rot: FACE_S, yaw: 2.3 }), A.p('mf_blood', 248, 314),
    A.p('mf_trunk', 238, 339.4, { rot: FACE_N }), A.p('mf_crate', 238, 339, { elev: 12.3 }), A.p('mf_case', 276, 322, { rot: FACE_W }),
    A.p('mf_case', 162, 341), A.p('mf_plant', 136, 334),
    // the street front
    ...facade(A, [52, 146, 240], 353, [A.p('mf_downpipe', 6, 362.4, { rot: FACE_S }), A.p('mf_damp', 100, 360.75, { rot: FACE_S }), A.p('mf_bollard', 60, 420), A.p('mf_bollard', 230, 420)]),

    // ======================= B — the 3rd floor (L02-1, middle) =======================
    // the left flat: the pantry and the kitchenette, a plant, the table with the fruit bowl, the green sofa, the rug
    B.p('mf_pantry', 18, 15.4, { rot: FACE_S }), B.p('mf_kitchenette', 51, 16.9, { rot: FACE_S }), B.p('mf_shelf_plant', 18, 15, { elev: 50.4 }),
    B.p('mf_bowl', 44, 17, { elev: 37.5 }), B.p('mf_mug', 60, 16, { elev: 37.5 }), B.p('mf_plant', 90, 80), B.p('mf_plaster_patch', 88, 7.75, { rot: FACE_S }),
    B.p('mf_table', 64, 120), B.p('mf_chair_curved', 64, 101, { rot: FACE_S }), B.p('mf_chair_curved', 64, 139, { rot: FACE_N }),
    B.p('mf_chair_curved', 44, 120, { rot: FACE_E }), B.p('mf_fruit', 64, 118, { elev: 22.8 }), B.p('mf_placemat', 56, 124, { elev: 22.8 }),
    B.p('mf_cloth', 72, 112, { elev: 22.9 }), B.p('mf_sofa_olive', 19.9, 180, { rot: FACE_E }),
    B.p('mf_cushion', 20, 164, { rot: FACE_E, elev: 10 }), B.p('mf_cushion', 20, 196, { rot: FACE_E, elev: 10 }), B.p('mf_rug_green', 62, 182),
    B.p('mf_lamp_stand', 92, 204), B.p('mf_lamp_small', 92, 204, { elev: 21.6 }),
    // the stair hall: the two flights (the balustrade between them, a newel), the lamp; the flats' doors open
    B.p('mf_balustrade_sloped', 157, 40, { rot: FACE_E, elev: 40 }), B.p('mf_balustrade_sloped', 157, 100, { rot: FACE_E, elev: 10 }),
    B.p('mf_newel', 157, 140), B.p('mf_sconce', 157, 10.2, { rot: FACE_S }), B.p('mf_plaque', 132, 7.75, { rot: FACE_S, elev: 50 }),
    B.p('mf_door_leaf', 125, 201, { rot: FACE_S }), B.p('mf_door_leaf', 189, 201, { rot: FACE_S }), B.p('mf_door_central', 135, 241, { rot: FACE_W }),
    // the right flat: the window, a cabinet with a lamp, the laid table and its chairs, the red sofa, the rug, a plant
    B.p('mf_window', 246, 7.75, { rot: FACE_S }), B.p('mf_wall_cabinet', 283, 13.5, { rot: FACE_S }), B.p('mf_lamp_small', 283, 13, { elev: 31.5 }),
    B.p('mf_table_walnut', 258, 104), B.p('mf_chair', 258, 86, { rot: FACE_S }), B.p('mf_chair', 258, 122, { rot: FACE_N }),
    B.p('mf_chair', 238, 104, { rot: FACE_E }), B.p('mf_chair', 278, 104, { rot: FACE_W }),
    B.p('mf_placemat', 250, 100, { elev: 22.5 }), B.p('mf_placemat', 266, 108, { elev: 22.5 }), B.p('mf_food', 250, 100, { elev: 22.6 }),
    B.p('mf_plates', 266, 107, { elev: 22.6 }), B.p('mf_bottle', 262, 97, { elev: 22.5 }), B.p('mf_mug', 252, 110, { elev: 22.5 }),
    B.p('mf_sofa_red', 283, 166, { rot: FACE_W }), B.p('mf_cushion', 283, 150, { rot: FACE_W, elev: 10 }), B.p('mf_cushion', 283, 182, { rot: FACE_W, elev: 10 }),
    B.p('mf_rug_red', 248, 166), B.p('mf_end_table', 284, 203), B.p('mf_lamp', 284, 203, { elev: 19.2 }), B.p('mf_plant', 225, 24),
    B.p('mf_service_cabinet', 222, 208),
    // the flat behind the middle door: the hutch, the round table (doily, flowers), the sectional, the ottoman, the
    // sideboard with its lamp, the armchair, the trunk, the rug, plants
    B.p('mf_hutch', 60, 235.3, { rot: FACE_S }), B.p('mf_plates', 48, 235, { elev: 30 }), B.p('mf_bowl', 70, 236, { elev: 30 }),
    B.p('mf_picture', 112, 227.75, { rot: FACE_S }), B.p('mf_portrait', 210, 227.75, { rot: FACE_S }),
    B.p('mf_table_round', 58, 310), B.p('mf_doily', 58, 310, { elev: 22.5 }), B.p('mf_flowers', 58, 309, { elev: 22.6 }),
    B.p('mf_chair_curved', 58, 290, { rot: FACE_S }), B.p('mf_chair_curved', 58, 330, { rot: FACE_N }),
    B.p('mf_chair_curved', 38, 310, { rot: FACE_E }), B.p('mf_chair_curved', 78, 310, { rot: FACE_W }),
    B.p('mf_lamp_stand', 14, 262), B.p('mf_lamp_small', 14, 262, { elev: 21.6 }),
    B.p('mf_sectional', 162, 312, { rot: FACE_N }), B.p('mf_throw', 150, 322, { rot: FACE_N, elev: 8 }), B.p('mf_ottoman', 198, 272),
    B.p('mf_sideboard', 262, 234.4, { rot: FACE_S }), B.p('mf_lamp', 276, 234, { elev: 27.3 }), B.p('mf_books', 250, 234, { elev: 27.3 }),
    B.p('mf_armchair', 272, 322, { rot: FACE_W, yaw: 0.4 }), B.p('mf_trunk', 226, 330, { rot: FACE_N }), B.p('mf_rug_lounge', 228, 292, { rot: FACE_W }),
    B.p('mf_plant', 14, 336), B.p('mf_basket', 286, 338),
    ...facade(B, [52, 151, 250], 353, [B.p('mf_downpipe', 296, 362.4, { rot: FACE_S }), B.p('mf_moss', 200, 360.75, { rot: FACE_S }), B.p('mf_bollard', 100, 420), B.p('mf_bollard', 280, 420)]),

    // ======================= C — the ground floor (L02-1, right) =======================
    // the hall: the mailboxes, lamps, the potted tree, the bicycle on the wall, the runner at the stairs' foot
    C.p('mf_mailboxes', 72, 9.9, { rot: FACE_S }), C.p('mf_mailboxes', 100, 9.9, { rot: FACE_S }), C.p('mf_sconce', 28, 10.2, { rot: FACE_S }),
    C.p('mf_sconce', 128, 10.2, { rot: FACE_S }), C.p('mf_tree_pot', 26, 200), C.p('mf_bicycle', 15.1, 282, { rot: FACE_E }),
    C.p('mf_runner_lobby', 162, 300), C.p('mf_damp', 60, 7.75, { rot: FACE_S }),
    C.p('mf_balustrade_sloped', 136, 60, { rot: FACE_E, elev: 48 }), C.p('mf_balustrade_sloped', 136, 125, { rot: FACE_E, elev: 30 }),
    C.p('mf_balustrade_sloped', 136, 190, { rot: FACE_E, elev: 12 }), C.p('mf_newel', 136, 245),
    // the mailboxes' corner (the annex): baskets, the meters' cabinet; the side door to the alley standing open
    C.p('mf_basket', 245, 300), C.p('mf_basket_small', 247, 330), C.p('mf_service_cabinet', 250, 200, { rot: FACE_W }),
    C.p('mf_alley_door', 252, 106, { rot: FACE_W }), C.p('mf_plaster_patch', 226, 133.7, { rot: FACE_S }),
    // the street front: the ornate double door (the police are out there), the transom, windows
    C.p('mf_door_left', 62, 357.5, { rot: FACE_S }), C.p('mf_door_right', 83, 357.5, { rot: FACE_S }), C.p('mf_transom', 72, 357.8, { rot: FACE_S }),
    C.p('mf_window_narrow', 22, 357.75, { rot: FACE_S }), C.p('mf_window_narrow', 128, 357.75, { rot: FACE_S }),
    C.p('mf_window_facade', 225, 357.75, { rot: FACE_S }), C.p('mf_window_guard', 225, 359.6, { rot: FACE_S }),
    C.p('mf_bollard', 40, 420), C.p('mf_bollard', 150, 420), C.p('mf_bollard', 270, 420),
    // the alley: pots and a planter, its lantern, the fire escape's railings
    C.p('mf_pot', 283, 90), C.p('mf_pot', 283, -40), C.p('mf_pot', 205, -150), C.p('mf_planter', 202, 40, { rot: FACE_E }),
    C.p('mf_alley_lantern', 200, -310.5, { rot: FACE_S }), C.p('mf_neon_pink', 260, -310.5, { rot: FACE_S }),
    C.p('mf_rail_sloped', 196, -270, { rot: FACE_E }), C.p('mf_rail_sloped', 292, -270, { rot: FACE_W }),

    // ======================= the roofs (L02-2) =======================
    // the west roof: the open hatch (out), the clothesline and its washing, the air conditioner, pots, a lamp
    R.p('mf_hatch', 130, 560, { rot: FACE_S }), R.p('mf_clothesline', 150, 330), R.p('mf_sheet', 135, 331, { elev: 14 }),
    R.p('mf_linen', 160, 331, { elev: 18 }), R.p('mf_towel', 178, 331, { elev: 16 }), R.p('mf_ac', 21, 380, { rot: FACE_E }),
    R.p('mf_pot', 30, 310), R.p('mf_pot', 280, 610), R.p('mf_drain', 200, 640), R.p('mf_pipe', 200, 420),
    R.p('mf_roof_lantern', 250, 291, { rot: FACE_S }), R.p('mf_window_narrow', 80, 287.75, { rot: FACE_S }), R.p('mf_neon_pink', 190, 287.75, { rot: FACE_S }),
    R.p('mf_planks', 350, 500),
    // the middle roof: the water tank on its legs, the stair hut (its lamp, a ladder), units, the chimney, the skylight
    R.p('mf_water_tank', 470, 260), R.p('mf_canister', 520, 240), R.p('mf_roof_lantern', 690, 311, { rot: FACE_S }),
    R.p('mf_ladder', 588, 311.4, { rot: FACE_S }), R.p('mf_hvac', 610, 340, { rot: FACE_S }), R.p('mf_ac', 780, 324, { rot: FACE_S }),
    R.p('mf_ac_top', 540, 640, { rot: FACE_N }), ...pots(R, 480, 620), R.p('mf_skylight', 860, 590),
    R.p('mf_pump', 640, 645), R.p('mf_pipe', 680, 645), R.p('mf_pump', 720, 645), R.p('mf_pipe', 760, 645),
    R.p('mf_drain', 500, 500), R.p('mf_drain', 800, 450), R.p('mf_roof_lantern', 450, 231, { rot: FACE_S }), R.p('mf_roof_lantern', 850, 231, { rot: FACE_S }),
    R.p('mf_window_narrow', 900, 227.75, { rot: FACE_S }), R.p('mf_window_narrow', 760, 227.75, { rot: FACE_S }),
    ...pots(R, 420, 220), ...pots(R, 640, 150), R.p('mf_pot', 930, 640), R.p('mf_planks', 990, 280),
    // the terrace: air conditioners, the dish, plants, a unit by the railing; the chimney behind
    R.p('mf_ac', 1100, 118, { rot: FACE_S }), R.p('mf_ac', 1160, 118, { rot: FACE_S }), R.p('mf_dish', 1250, 140, { rot: FACE_S, yaw: -0.5 }),
    R.p('mf_pot', 1050, 370), R.p('mf_pot', 1300, 370), R.p('mf_hvac', 1200, 385, { rot: FACE_N }), R.p('mf_pipe', 1098, 300),
    ...pots(R, 1260, 100), R.p('mf_roof_lantern', 1080, 111, { rot: FACE_S }),
    // the neighbours' tiled roof: its chimney, the dish, the dormer
    ...pots(R, 1110, 545, 95), R.p('mf_dish', 1170, 500, { rot: FACE_S, elev: 55, yaw: 0.6 }), R.p('mf_dormer', 1260, 640, { rot: FACE_S, elev: 22 }),
  ],

  decals: [
    { t: 'prints', x: A.X(190), y: A.Y(150), w: 30, r: -1.2 }, { t: 'prints', x: A.X(250), y: A.Y(80), w: 28, r: 0.3 },
    { t: 'scuff', x: B.X(157), y: B.Y(180), w: 70 }, { t: 'scuff', x: C.X(80), y: C.Y(200), w: 90, r: 0.6 }, { t: 'coffee', x: B.X(250), y: B.Y(110), w: 20 },
  ],
  lights: [
    { x: C.X(110), y: C.Y(400), kind: 'red', sx: 1.8, sz: 1.0 }, { x: C.X(200), y: C.Y(410), kind: 'screen', sx: 1.8, sz: 1.0 }, // the police at the front door
    { x: A.X(200), y: A.Y(70), kind: 'dim', sx: 0.9, sz: 0.6 }, { x: B.X(157), y: B.Y(90), kind: 'dim', sx: 0.7, sz: 0.9 },
    { x: C.X(166), y: C.Y(120), kind: 'dim', sx: 0.6, sz: 1.2 }, { x: C.X(244), y: C.Y(-60), kind: 'lamp', sx: 0.9, sz: 1.4 },
    { x: R.X(640), y: R.Y(225), kind: 'dim', sx: 0.9, sz: 0.8 },
  ],

  enemies: [
    // Moro — dead before Kane came (a body from the start)
    { type: 'moro', x: A.X(236), y: A.Y(298), angle: 2.4, dead: true },
    // the cleaners on the 3rd floor and the ground floor, the alley (all of them — the clear)
    { type: 'cleaner', x: B.X(80), y: B.Y(56), angle: PI / 2, tag: 'stair' },
    { type: 'assaulter', x: B.X(30), y: B.Y(66), angle: 0, tag: 'stair' },
    { type: 'cleaner', x: B.X(232), y: B.Y(46), angle: PI / 2, tag: 'stair' },
    { type: 'cleaner', x: B.X(104), y: B.Y(272), angle: -PI / 2, tag: 'stair' },
    { type: 'assaulter', x: B.X(240), y: B.Y(280), angle: PI, tag: 'stair' },
    { type: 'assaulter', x: C.X(72), y: C.Y(150), angle: -PI / 2, tag: 'stair' },
    { type: 'cleaner', x: C.X(100), y: C.Y(300), angle: -PI / 2, tag: 'stair', patrol: [[C.X(100), C.Y(300), 2, -PI / 2], [C.X(50), C.Y(130), 2, PI / 2]] },
    { type: 'cleaner', x: C.X(224), y: C.Y(250), angle: PI, tag: 'stair' },
    { type: 'assaulter', x: C.X(244), y: C.Y(-110), angle: PI / 2, tag: 'stair' },
    // the roofs (the leader carries the order)
    { type: 'cleaner', x: R.X(1150), y: R.Y(300), angle: PI, patrol: [[R.X(1150), R.Y(300), 2, PI], [R.X(1150), R.Y(160), 2, 0]] },
    { type: 'assaulter', x: R.X(660), y: R.Y(420), angle: 0, patrol: [[R.X(660), R.Y(420), 2, 0], [R.X(880), R.Y(420), 2, PI]] },
    { type: 'cleaner', x: R.X(850), y: R.Y(530), angle: PI, patrol: [[R.X(850), R.Y(530), 2, PI], [R.X(560), R.Y(530), 2, 0]] },
    { type: 'shield', x: R.X(430), y: R.Y(440), angle: 0 },
    { type: 'assaulter', x: R.X(200), y: R.Y(450), angle: 0, carries: 'order', tag: 'leader' },
    { type: 'cleaner', x: R.X(60), y: R.Y(620), angle: -PI / 2, patrol: [[R.X(60), R.Y(620), 2, -PI / 2], [R.X(60), R.Y(400), 2, PI / 2]] },
  ],

  pickups: [
    // [СЦЕНА] what Kane looks at in the flat
    { id: 'inspect_moro', kind: 'inspect', task: 'scene', x: A.X(236), y: A.Y(306), h: 22, dialogue: 'flat.moro' },
    { id: 'inspect_laptop', kind: 'inspect', task: 'scene', x: A.X(208), y: A.Y(234), h: 34, dialogue: 'flat.laptop' },
    // Lyra's stash under the bath's tiles — the passport and the silenced pistol (there after the call)
    { id: 'stash', kind: 'crate', item: 'pistol_sd', gives: 'stash', hidden: true, dormant: true, wakeOn: 'stash', x: A.X(80), y: A.Y(110) },
    // supplies: rounds in the mailboxes' corner, grenades in the stair hut
    { id: 'ammo_store', kind: 'crate', item: 'ammo', count: 2, x: C.X(230), y: C.Y(330) },
    { id: 'grenades_hut', kind: 'crate', item: 'grenades', count: 2, x: R.X(640), y: R.Y(200) },
  ],

  // the police helicopter over the roofs: its round, then after the hero; lit 1.5 s — its gunner (from the south-west)
  searchlights: [
    { kind: 'heli', path: [[R.X(1180), R.Y(250)], [R.X(700), R.Y(330)], [R.X(250), R.Y(500)], [R.X(700), R.Y(580)]], speed: 60, chase: 78, radius: 80, spot: 1.5, lose: 3,
      burst: 3, shotGap: 0.14, every: 1.3, damage: 6, side: -0.86, from: 380, during: ['order', 'exit'] },
  ],

  objectives: [
    { id: 'scene', type: 'inspect', textKey: 'obj.flat.scene', target: [A.X(220), A.Y(260)], done: 'sceneDone' },
    { id: 'call', type: 'call', textKey: 'obj.flat.call', dialogue: 'flat.call', done: 'called' },
    { id: 'stash', textKey: 'obj.flat.stash', target: 'stash', done: 'stash' },
    { id: 'clear', type: 'clear', tag: 'stair', textKey: 'obj.flat.clear', done: 'cleared',
      // the first ones up the stairs (from the well): the shield trooper and a cleaner behind him
      spawn: [{ type: 'shield', x: A.X(265), y: A.Y(58), angle: PI / 2, tag: 'stair', hunt: true }, { type: 'cleaner', x: A.X(265), y: A.Y(36), angle: PI / 2, tag: 'stair', hunt: true }] },
    { id: 'roof', type: 'reach', room: 'r_terrace', textKey: 'obj.flat.roof', target: [C.X(244), C.Y(-300)], done: 'onRoof', startDialogue: 'flat.street' },
    { id: 'order', textKey: 'obj.flat.order', target: 'order', done: 'order', startDialogue: 'flat.heli' },
    { id: 'exit', textKey: 'obj.flat.exit', target: 'exit' },
  ],
  exit: { rect: [R.X(96), R.Y(522), R.X(164), R.Y(598)], x: R.X(130), y: R.Y(560) },
};
