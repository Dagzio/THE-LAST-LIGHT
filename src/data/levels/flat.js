// D148 — Marseille, level 2 "The Old Port: the safe flat" (STORY_DESIGN_D133.md §6; the references
// NEW/references/Location1/L02-1.png — the house cut open floor by floor — and L02-2.png — its roofs; the user's
// atlases NEW/marseille/L02). Night, the old house by the port. Data only (world units, 1 m ≈ 30; x → east, y → south).
//
// The house is drawn as its floors side by side (like the reference): the 4th floor — the landing and Moro's flat (A),
// the stairs down to the 3rd floor — its landing and two neighbours' flats (B), the stairs down to the ground floor —
// the hall, the store, the porch to the street (C); its back door to the courtyard and the fire escape up to the roofs
// (drawn north of the house): the east roof, a plank over the alley, the middle roof with the stair hut and the water
// tank, another plank, the west roof with the open hatch — the way out.
// Section 1 (flat and stairwell): [СЦЕНА] Moro dead, the laptop → [ЗВОНОК] Vance: "a traitor" — Lyra: the stash under
// the bath → the stash (the silenced pistol) → [ЗАЧИСТКА] the cleaners, top to bottom (the first one with a shield).
// Section 2 (roofs): the street is the police's — the courtyard, the fire escape → [ПОБЕГ] the police helicopter's
// searchlight (lit too long — its gunner fires; shelter in the stair hut / under the tank) → the cleaners' leader
// carries the liquidation order (director-level clearance) → the hatch on the west roof.
const W = (x0, y0, x1, y1, style, gaps = []) => ({ x0, y0, x1, y1, style, gaps });
const FACE_S = 0, FACE_W = 1, FACE_N = 2, FACE_E = 3; // prop `rot`: where its front faces

/** A chimney stack (a short brick wall) and its pots on top. */
function stack(x, y) {
  return { wall: W(x - 30, y, x + 30, y, 'brick'), pots: [-18, 0, 18].map((dx) => ({ type: 'mf_chimney_pot', x: x + dx, y, elev: 78 })) };
}
const STACKS = [stack(1330, 260), stack(2030, 300), stack(1980, 900), stack(2530, 400), stack(2930, 720), stack(330, 700), stack(830, 350)];

export const FLAT = {
  id: 'flat',
  nameKey: 'level.flat.name',
  descKey: 'level.flat.desc',
  location: 'marseille',
  requires: 'office',
  preview: 'assets/ui/previews/flat.webp',
  width: 3140,
  height: 2340,
  wallHeight: 78,
  wallThickness: 20,
  buildingRect: [100, 1260, 2780, 2260],
  nightWindows: false, // (the office's lit night windows do not fit the old house: its own window pictures instead)
  playerSpawn: { x: 670, y: 1330, angle: Math.PI / 2 }, // on the 4th-floor landing, at Moro's door
  menuModes: ['mission'],
  modes: { mission: {} },
  loadout: { weapons: ['pistol', 'smg'], grenades: { frag: 1 } }, // (Kane keeps the SMG of the Ardent job)
  enemyTypes: ['cleaner', 'assaulter', 'shield', 'moro'],
  // a rainy night: colder, darker than the office
  lighting: { hemi: 0.85, key: 0.95, exposure: 1.22, sky: 0xbfcfec, ground: 0x22252c, sun: 0xd6e0f5, background: 0x05070b },

  zones: [
    // --- the house: 4th floor (A)
    { id: 'a_land', rect: [100, 1260, 860, 1400], floor: 'terracotta', light: 'dim', wallLights: false },
    { id: 'a_bath', rect: [100, 1400, 480, 1600], floor: 'bath_tile', light: 'dark', wallLights: false },
    { id: 'a_hall', rect: [480, 1400, 860, 1600], floor: 'floorboards', light: 'dark', wallLights: false },
    { id: 'a_kitchen', rect: [100, 1600, 300, 2000], floor: 'terracotta', light: 'dark', wallLights: false },
    { id: 'a_living', rect: [300, 1600, 860, 2000], floor: 'floorboards', light: 'dark', wallLights: false },
    { id: 'a_bed', rect: [100, 2000, 420, 2260], floor: 'floorboards', light: 'dark', wallLights: false },
    { id: 'a_lounge', rect: [420, 2000, 860, 2260], floor: 'floorboards', light: 'dark', wallLights: false },
    { id: 'stair_ab', rect: [860, 1260, 1060, 1400], floor: 'terracotta', light: 'dim', wallLights: false },
    // --- 3rd floor (B): the landing, the west flat (living room, bedroom), the east flat (kitchen, lounge)
    { id: 'b_land', rect: [1060, 1260, 1820, 1400], floor: 'terracotta', light: 'dim', wallLights: false },
    { id: 'b_w_room', rect: [1060, 1400, 1440, 1830], floor: 'encaustic', light: 'dark', wallLights: false },
    { id: 'b_w_bed', rect: [1060, 1830, 1440, 2260], floor: 'floorboards', light: 'dark', wallLights: false },
    { id: 'b_e_kitchen', rect: [1440, 1400, 1820, 1760], floor: 'encaustic', light: 'dark', wallLights: false },
    { id: 'b_e_lounge', rect: [1440, 1760, 1820, 2260], floor: 'floorboards', light: 'dark', wallLights: false },
    { id: 'stair_bc', rect: [1820, 1260, 2020, 1400], floor: 'terracotta', light: 'dim', wallLights: false },
    // --- ground floor (C): the hall, the store, the porch (the street doors), the concierge's room
    { id: 'c_hall', rect: [2020, 1260, 2780, 1900], floor: 'encaustic', light: 'dim', wallLights: false },
    { id: 'c_store', rect: [2020, 1900, 2240, 2260], floor: 'terracotta', light: 'dark', wallLights: false },
    { id: 'c_porch', rect: [2240, 1900, 2560, 2060], floor: 'encaustic', light: 'dark', wallLights: false },
    { id: 'c_office', rect: [2560, 1900, 2780, 2260], floor: 'floorboards', light: 'dark', wallLights: false },
    // --- the courtyard and the fire escape up
    { id: 'yard', rect: [2780, 1260, 3080, 1900], floor: 'setts', light: 'dark', wallLights: false },
    { id: 'fire_esc', rect: [2860, 1000, 3060, 1260], floor: 'grating', light: 'dark', wallLights: false },
    // --- the roofs (the alleys between them are the dark drop)
    { id: 'roof_e', rect: [2340, 260, 3080, 1000], floor: 'roof', light: 'dark', wallLights: false },
    { id: 'plank_23', rect: [2200, 560, 2340, 640], floor: 'planks', light: 'dark', wallLights: false },
    { id: 'roof_m', rect: [1200, 160, 2200, 1000], floor: 'roof', light: 'dark', wallLights: false },
    { id: 'plank_12', rect: [1060, 380, 1200, 460], floor: 'planks', light: 'dark', wallLights: false },
    { id: 'roof_w', rect: [100, 260, 1060, 1000], floor: 'roof', light: 'dark', wallLights: false },
  ],

  walls: [
    // the house — outer walls (stone) and its rooms (old lime plaster)
    W(100, 1260, 860, 1260, 'limestone'), W(860, 1260, 1060, 1260, 'limestone'), W(1060, 1260, 1820, 1260, 'limestone'),
    W(1820, 1260, 2020, 1260, 'limestone'), W(2020, 1260, 2780, 1260, 'limestone'),
    W(100, 1260, 100, 2260, 'limestone'), W(100, 2260, 860, 2260, 'limestone'), W(860, 1400, 860, 2260, 'limestone'),
    W(860, 1400, 1060, 1400, 'limestone'), W(1060, 1400, 1060, 2260, 'limestone'), W(1060, 2260, 1820, 2260, 'limestone'),
    W(1820, 1400, 1820, 2260, 'limestone'), W(1820, 1400, 2020, 1400, 'limestone'), W(2020, 1400, 2020, 2260, 'limestone'),
    W(2020, 2260, 2240, 2260, 'limestone'), W(2560, 2260, 2780, 2260, 'limestone'),
    W(2780, 1260, 2780, 2260, 'limestone', [[1465, 1535]]),
    // A: the flat
    W(100, 1400, 860, 1400, 'plaster', [[635, 705]]),
    W(480, 1400, 480, 1600, 'plaster', [[1473, 1537]]),
    W(100, 1600, 860, 1600, 'plaster', [[600, 720]]),
    W(300, 1600, 300, 2000, 'plaster', [[1740, 1840]]),
    W(100, 2000, 860, 2000, 'plaster', [[333, 397], [560, 780]]),
    W(420, 2000, 420, 2260, 'plaster'),
    // B: the neighbours
    W(1060, 1400, 1820, 1400, 'plaster', [[1215, 1285], [1595, 1665]]),
    W(1440, 1400, 1440, 2260, 'plaster'),
    W(1060, 1830, 1440, 1830, 'plaster', [[1203, 1267]]),
    W(1440, 1760, 1820, 1760, 'plaster', [[1560, 1700]]),
    // C: the ground floor
    W(2020, 1900, 2780, 1900, 'plaster', [[2093, 2157], [2320, 2480], [2623, 2687]]),
    W(2240, 1900, 2240, 2260, 'plaster'), W(2560, 1900, 2560, 2260, 'plaster'),
    W(2240, 2060, 2560, 2060, 'limestone', [[2330, 2470]]),
    // the courtyard (brick) and the fire escape's railings
    W(2780, 1260, 2860, 1260, 'brick'), W(3060, 1260, 3080, 1260, 'brick'), W(3080, 1260, 3080, 1900, 'brick'), W(2780, 1900, 3080, 1900, 'brick'),
    W(2860, 1000, 2860, 1260, 'rail'), W(3060, 1000, 3060, 1260, 'rail'),
    // the roofs: low parapets round them (crouch behind), gaps for the planks; the planks' sides are the drop
    W(2340, 260, 3080, 260, 'parapet'), W(3080, 260, 3080, 1000, 'parapet'), W(2340, 1000, 3080, 1000, 'parapet', [[2860, 3060]]),
    W(2340, 260, 2340, 1000, 'parapet', [[560, 640]]),
    W(2200, 560, 2340, 560, 'edge'), W(2200, 640, 2340, 640, 'edge'),
    W(1200, 160, 2200, 160, 'parapet'), W(2200, 160, 2200, 1000, 'parapet', [[560, 640]]), W(1200, 1000, 2200, 1000, 'parapet'),
    W(1200, 160, 1200, 1000, 'parapet', [[380, 460]]),
    W(1060, 380, 1200, 380, 'edge'), W(1060, 460, 1200, 460, 'edge'),
    W(100, 260, 1060, 260, 'parapet'), W(100, 260, 100, 1000, 'parapet'), W(100, 1000, 1060, 1000, 'parapet'),
    W(1060, 260, 1060, 1000, 'parapet', [[380, 460]]),
    // the stair hut on the middle roof (its doorway south — a shelter from the light)
    W(1600, 700, 1800, 700, 'limestone'), W(1600, 700, 1600, 880, 'limestone'), W(1800, 700, 1800, 880, 'limestone'),
    W(1600, 880, 1800, 880, 'limestone', [[1660, 1740]]),
    ...STACKS.map((s) => s.wall),
    // the ground-floor hall's two columns (cover in the fight on the way down)
    W(2270, 1600, 2310, 1600, 'limestone'), W(2490, 1600, 2530, 1600, 'limestone'),
  ],

  doors: [
    { id: 'flat_door', x: 670, y: 1400, axis: 'x', width: 70, kind: 'wood', zones: ['a_land', 'a_hall'] },
    { id: 'bath_door', x: 480, y: 1505, axis: 'y', width: 64, kind: 'wood', zones: ['a_hall', 'a_bath'] },
    { id: 'bed_door', x: 365, y: 2000, axis: 'x', width: 64, kind: 'wood', zones: ['a_living', 'a_bed'] },
    { id: 'bw_door', x: 1250, y: 1400, axis: 'x', width: 70, kind: 'wood', zones: ['b_land', 'b_w_room'] },
    { id: 'be_door', x: 1630, y: 1400, axis: 'x', width: 70, kind: 'wood', zones: ['b_land', 'b_e_kitchen'] },
    { id: 'bw_bed', x: 1235, y: 1830, axis: 'x', width: 64, kind: 'wood', zones: ['b_w_room', 'b_w_bed'] },
    { id: 'store_door', x: 2125, y: 1900, axis: 'x', width: 64, kind: 'wood', zones: ['c_hall', 'c_store'] },
    { id: 'office_door', x: 2655, y: 1900, axis: 'x', width: 64, kind: 'wood', zones: ['c_hall', 'c_office'] },
    { id: 'street_doors', x: 2400, y: 2060, axis: 'x', width: 140, kind: 'wood', lock: 'police' }, // (the police outside: never)
    { id: 'back_door', x: 2780, y: 1500, axis: 'y', width: 70, kind: 'metal', zones: ['c_hall', 'yard'] },
  ],
  openings: [
    { x: 860, y: 1330, zones: ['a_land', 'stair_ab'] }, { x: 1060, y: 1330, zones: ['stair_ab', 'b_land'] },
    { x: 1820, y: 1330, zones: ['b_land', 'stair_bc'] }, { x: 2020, y: 1330, zones: ['stair_bc', 'c_hall'] },
    { x: 660, y: 1600, zones: ['a_hall', 'a_living'] }, { x: 300, y: 1790, zones: ['a_kitchen', 'a_living'] },
    { x: 670, y: 2000, zones: ['a_living', 'a_lounge'] }, { x: 1630, y: 1760, zones: ['b_e_kitchen', 'b_e_lounge'] },
    { x: 2400, y: 1900, zones: ['c_hall', 'c_porch'] },
    { x: 2960, y: 1260, zones: ['yard', 'fire_esc'] }, { x: 2960, y: 1000, zones: ['fire_esc', 'roof_e'] },
    { x: 2340, y: 600, zones: ['roof_e', 'plank_23'] }, { x: 2200, y: 600, zones: ['plank_23', 'roof_m'] },
    { x: 1200, y: 420, zones: ['roof_m', 'plank_12'] }, { x: 1060, y: 420, zones: ['plank_12', 'roof_w'] },
  ],
  // the helicopter's light does not see in here: the stair hut, under the water tank
  shelters: [[1610, 712, 1790, 878], [1398, 300, 1442, 342]],

  props: [
    // ===== 4th floor — the landing: tall windows on the street side, a sconce, the floor plaque; Moro's door
    { type: 'mf_window_facade', x: 260, y: 1270.8, rot: FACE_S }, { type: 'mf_window_facade', x: 500, y: 1270.8, rot: FACE_S },
    { type: 'mf_sconce', x: 380, y: 1273, rot: FACE_S }, { type: 'mf_sconce', x: 780, y: 1273, rot: FACE_S },
    { type: 'mf_plaque', x: 720, y: 1270.8, rot: FACE_S }, { type: 'mf_plant', x: 130, y: 1375 },
    { type: 'mf_damp', x: 640, y: 1270.8, rot: FACE_S },
    // the stairs down to the 3rd floor (two flights, the banister between them)
    { type: 'stairs', x: 960, y: 1298, rot: FACE_S }, { type: 'stairs', x: 960, y: 1362, rot: FACE_N },
    ...[890, 926, 962, 998, 1034].map((x) => ({ type: 'mf_balustrade', x, y: 1330 })),
    { type: 'mf_newel', x: 872, y: 1330 },
    // ===== Moro's flat — the bathroom (the stash: a tiled cover by the shower)
    { type: 'mf_shower', x: 142, y: 1443 }, { type: 'mf_toilet', x: 300, y: 1421, rot: FACE_S }, { type: 'mf_sink', x: 220, y: 1417, rot: FACE_S },
    { type: 'mf_bath_cover', x: 172, y: 1520 }, { type: 'mf_window_bath', x: 400, y: 1410.8, rot: FACE_S },
    { type: 'mf_basket', x: 455, y: 1578 },
    // the entry hall: a little table with a lamp, a runner from the door, a picture
    { type: 'mf_end_table', x: 836, y: 1440 }, { type: 'mf_lamp_small', x: 836, y: 1440, elev: 19 },
    { type: 'mf_runner_lobby', x: 670, y: 1500 }, { type: 'mf_picture', x: 780, y: 1410.8, rot: FACE_S },
    { type: 'mf_portrait', x: 560, y: 1410.8, rot: FACE_S },
    // the living room / study — the desk with the laptop, the bookcases, the leather sofa; Moro on the floor
    { type: 'mf_rug_study', x: 580, y: 1800 }, { type: 'mf_desk', x: 560, y: 1730 },
    { type: 'mf_laptop', x: 552, y: 1728, elev: 23 }, { type: 'mf_notes', x: 582, y: 1734, elev: 23 },
    { type: 'mf_lamp_small', x: 530, y: 1725, elev: 23 }, { type: 'mf_chair_curved', x: 512, y: 1786, rot: FACE_S, yaw: 0.9 },
    { type: 'mf_bookcase', x: 410, y: 1615, rot: FACE_S }, { type: 'mf_books', x: 398, y: 1615, elev: 27 },
    { type: 'mf_bookcase', x: 800, y: 1615, rot: FACE_S }, { type: 'mf_book_stack', x: 812, y: 1615, elev: 27 },
    { type: 'mf_sofa_leather', x: 837, y: 1820, rot: FACE_W }, { type: 'mf_end_table', x: 838, y: 1700 },
    { type: 'mf_lamp', x: 838, y: 1700, elev: 19 }, { type: 'mf_armchair', x: 720, y: 1940, rot: FACE_S },
    { type: 'mf_blood', x: 650, y: 1858 }, { type: 'mf_plant', x: 330, y: 1975 },
    // the kitchen
    { type: 'mf_kitchen', x: 153, y: 1647, rot: FACE_S }, { type: 'mf_fridge', x: 270, y: 1621, rot: FACE_S },
    { type: 'mf_table', x: 200, y: 1880 }, { type: 'mf_chair', x: 200, y: 1850, rot: FACE_S }, { type: 'mf_chair', x: 200, y: 1912, rot: FACE_N },
    // the bedroom
    { type: 'mf_bed', x: 210, y: 2041, rot: FACE_S }, { type: 'mf_nightstand', x: 258, y: 2018, rot: FACE_S },
    { type: 'mf_lamp_small', x: 258, y: 2018, elev: 19 }, { type: 'mf_wardrobe', x: 330, y: 2241, rot: FACE_N },
    { type: 'mf_rug_green', x: 330, y: 2140 },
    // the lounge
    { type: 'mf_rug_lounge', x: 640, y: 2130, rot: FACE_W }, { type: 'mf_sofa_olive', x: 640, y: 2237, rot: FACE_N },
    { type: 'mf_ottoman', x: 640, y: 2150 }, { type: 'mf_armchair', x: 820, y: 2110, rot: FACE_W },
    { type: 'mf_sideboard', x: 480, y: 2017.5, rot: FACE_S }, { type: 'mf_lamp', x: 470, y: 2017, elev: 27 },
    { type: 'mf_plant', x: 838, y: 2238 },

    // ===== 3rd floor — the landing
    { type: 'mf_window_facade', x: 1160, y: 1270.8, rot: FACE_S }, { type: 'mf_window_facade', x: 1420, y: 1270.8, rot: FACE_S },
    { type: 'mf_sconce', x: 1300, y: 1273, rot: FACE_S }, { type: 'mf_plaque', x: 1720, y: 1270.8, rot: FACE_S },
    { type: 'mf_trunk', x: 1460, y: 1385 }, { type: 'mf_plaster_patch', x: 1560, y: 1270.8, rot: FACE_S },
    { type: 'stairs', x: 1920, y: 1298, rot: FACE_S }, { type: 'stairs', x: 1920, y: 1362, rot: FACE_N },
    ...[1850, 1886, 1922, 1958, 1994].map((x) => ({ type: 'mf_balustrade', x, y: 1330 })),
    // the west flat: the living room (the red sofa, a round table), the bedroom
    { type: 'mf_rug_red', x: 1250, y: 1640 }, { type: 'mf_sofa_red', x: 1082, y: 1620, rot: FACE_E },
    { type: 'mf_table_round', x: 1260, y: 1640 }, { type: 'mf_chair_curved', x: 1225, y: 1640, rot: FACE_E }, { type: 'mf_chair_curved', x: 1296, y: 1640, rot: FACE_W },
    { type: 'mf_hutch', x: 1422, y: 1620, rot: FACE_W }, { type: 'mf_bookcase', x: 1150, y: 1415, rot: FACE_S },
    { type: 'mf_lamp', x: 1150, y: 1415, elev: 27 }, { type: 'mf_tree_pot', x: 1400, y: 1800 },
    { type: 'mf_bed', x: 1101, y: 2010, rot: FACE_E }, { type: 'mf_nightstand', x: 1084, y: 1945 },
    { type: 'mf_wardrobe', x: 1300, y: 2241, rot: FACE_N }, { type: 'mf_runner_bed', x: 1150, y: 2120 },
    { type: 'mf_crate', x: 1410, y: 2235 }, { type: 'mf_case', x: 1380, y: 2240 },
    // the east flat: the kitchen (pantry, fridge, the table), the lounge (the sectional, the armchair)
    { type: 'mf_pantry', x: 1720, y: 1418.4, rot: FACE_S }, { type: 'mf_fridge', x: 1780, y: 1420.6, rot: FACE_S },
    { type: 'mf_table', x: 1600, y: 1590 }, { type: 'mf_chair', x: 1600, y: 1558, rot: FACE_S }, { type: 'mf_chair', x: 1600, y: 1622, rot: FACE_N },
    { type: 'mf_chair', x: 1565, y: 1590, rot: FACE_E }, { type: 'mf_chair', x: 1635, y: 1590, rot: FACE_W },
    { type: 'mf_rug_lounge', x: 1630, y: 2030 }, { type: 'mf_sectional', x: 1680, y: 2215, rot: FACE_N },
    { type: 'mf_armchair', x: 1480, y: 1900, rot: FACE_E }, { type: 'mf_sideboard', x: 1800, y: 1900, rot: FACE_W },
    { type: 'mf_plant', x: 1470, y: 2240 }, { type: 'mf_lamp', x: 1800, y: 1940, elev: 27 },

    // ===== ground floor — the hall: the mailboxes, a bicycle, the potted tree, the runner to the porch
    ...[2380, 2408, 2436].map((x) => ({ type: 'mf_mailboxes', x, y: 1273, rot: FACE_S })),
    { type: 'mf_bicycle', x: 2600, y: 1290 }, { type: 'mf_tree_pot', x: 2745, y: 1300 },
    { type: 'mf_runner_lobby', x: 2400, y: 1780 }, { type: 'mf_sconce', x: 2220, y: 1273, rot: FACE_S },
    { type: 'mf_sconce', x: 2660, y: 1273, rot: FACE_S }, { type: 'mf_plaque', x: 2300, y: 1270.8, rot: FACE_S },
    { type: 'mf_basket', x: 2040, y: 1880 }, { type: 'mf_trunk', x: 2760, y: 1860, rot: FACE_W },
    { type: 'mf_tree_pot', x: 2045, y: 1440 }, { type: 'mf_sofa_red', x: 2400, y: 1430, rot: FACE_S }, { type: 'mf_end_table', x: 2460, y: 1430 },
    { type: 'mf_trunk', x: 2650, y: 1560 }, { type: 'mf_crate', x: 2150, y: 1720 }, { type: 'mf_crate', x: 2170, y: 1720 }, { type: 'mf_crate', x: 2160, y: 1720, elev: 10 },
    { type: 'mf_tree_pot', x: 2290, y: 1640 }, { type: 'mf_tree_pot', x: 2510, y: 1640 },
    // the store, the concierge's room, the porch's lantern
    { type: 'mf_crate', x: 2050, y: 2235 }, { type: 'mf_crate', x: 2070, y: 2235 }, { type: 'mf_crate', x: 2060, y: 2235, elev: 10 },
    { type: 'mf_case', x: 2210, y: 2238 }, { type: 'mf_trunk', x: 2215, y: 2000, rot: FACE_W }, { type: 'mf_basket', x: 2040, y: 2100 },
    { type: 'mf_desk', x: 2670, y: 2030 }, { type: 'mf_chair', x: 2670, y: 2000, rot: FACE_S }, { type: 'mf_lamp_small', x: 2640, y: 2026, elev: 23 },
    { type: 'mf_bookcase', x: 2670, y: 2245, rot: FACE_N }, { type: 'mf_portrait', x: 2700, y: 1910.8, rot: FACE_S },
    { type: 'mf_entry_lantern', x: 2400, y: 2043, rot: FACE_N },
    // the courtyard: pots, a planter, crates, the lantern by the back door
    { type: 'mf_pot', x: 3050, y: 1870 }, { type: 'mf_pot', x: 2810, y: 1870 }, { type: 'mf_planter', x: 2930, y: 1885 },
    { type: 'mf_crate', x: 3060, y: 1450 }, { type: 'mf_crate', x: 3060, y: 1470 }, { type: 'mf_alley_lantern', x: 2795, y: 1400, rot: FACE_E },
    { type: 'mf_bicycle', x: 2960, y: 1700 },
    // the fire escape (two flights up to the east roof)
    { type: 'stairs', x: 2915, y: 1130, rot: FACE_E }, { type: 'stairs', x: 3005, y: 1130, rot: FACE_W },

    // ===== the east roof: the air conditioners, the dish, the skylight, a pump, the drains
    { type: 'mf_ac', x: 2420, y: 290, rot: FACE_S }, { type: 'mf_ac_top', x: 2460, y: 293, rot: FACE_S }, { type: 'mf_hvac', x: 2700, y: 285, rot: FACE_S },
    { type: 'mf_dish', x: 2980, y: 300, rot: FACE_S }, { type: 'mf_skylight', x: 2720, y: 640 },
    { type: 'mf_pump', x: 3050, y: 520, rot: FACE_W }, { type: 'mf_canister', x: 3055, y: 560 }, { type: 'mf_pipe', x: 2600, y: 820 },
    { type: 'mf_drain', x: 2500, y: 900 }, { type: 'mf_drain', x: 2850, y: 500 }, { type: 'mf_pot', x: 2380, y: 960 },
    // the middle roof: the stair hut (its lamp, a ladder by its door), the water tank, the clothesline, more units
    { type: 'mf_roof_lantern', x: 1700, y: 891, rot: FACE_S }, { type: 'mf_ladder', x: 1625, y: 892, rot: FACE_S },
    { type: 'mf_water_tank', x: 1420, y: 320 },
    { type: 'mf_clothesline', x: 1900, y: 450 }, { type: 'mf_sheet', x: 1880, y: 451, elev: 14 }, { type: 'mf_towel', x: 1924, y: 451, elev: 18 },
    { type: 'mf_ac', x: 2160, y: 760, rot: FACE_W }, { type: 'mf_ac_top', x: 2160, y: 800, rot: FACE_W }, { type: 'mf_hvac', x: 1300, y: 960, rot: FACE_S },
    { type: 'mf_skylight', x: 1450, y: 700 }, { type: 'mf_pump', x: 1850, y: 940 }, { type: 'mf_drain', x: 1700, y: 400 },
    { type: 'mf_pot', x: 1240, y: 200 }, { type: 'mf_canister', x: 1580, y: 190 }, { type: 'mf_pipe', x: 1500, y: 980 },
    { type: 'mf_roof_lantern', x: 2030, y: 311, rot: FACE_S },
    // the planks over the alleys
    { type: 'mf_planks', x: 2270, y: 600 }, { type: 'mf_planks', x: 1130, y: 420 },
    // the west roof: the hatch (the way out), planters along the parapet, the clothesline, a unit
    { type: 'mf_hatch', x: 250, y: 420, rot: FACE_S },
    ...[420, 520, 620].map((x) => ({ type: 'mf_planter', x, y: 280 })),
    { type: 'mf_clothesline', x: 600, y: 820 }, { type: 'mf_sheet', x: 585, y: 821, elev: 14 }, { type: 'mf_sheet', x: 625, y: 821, elev: 14 },
    { type: 'mf_ac', x: 1030, y: 900, rot: FACE_W }, { type: 'mf_pot', x: 140, y: 960 }, { type: 'mf_pot', x: 1020, y: 300 },
    { type: 'mf_drain', x: 400, y: 600 }, { type: 'mf_canister', x: 140, y: 600 },
    { type: 'mf_roof_lantern', x: 830, y: 361, rot: FACE_S }, { type: 'mf_roof_lantern', x: 330, y: 711, rot: FACE_S },
    ...STACKS.flatMap((s) => s.pots),
  ],

  decals: [
    { t: 'blood', x: 640, y: 1850, w: 60, r: 0.5 }, { t: 'prints', x: 700, y: 1520, w: 34, r: -1.4 }, { t: 'prints', x: 760, y: 1340, w: 30, r: 0.2 },
    { t: 'scuff', x: 1250, y: 1330, w: 90 }, { t: 'scuff', x: 2400, y: 1500, w: 120, r: 0.6 }, { t: 'coffee', x: 1600, y: 1600, w: 30 },
  ],
  lights: [
    { x: 2400, y: 2160, kind: 'red', sx: 1.6, sz: 1.0 }, { x: 2470, y: 2180, kind: 'screen', sx: 1.6, sz: 1.0 }, // the police outside the street doors
    { x: 1700, y: 760, kind: 'dim', sx: 0.9, sz: 0.8 }, // inside the stair hut
  ],

  enemies: [
    // Moro — dead before Kane came (a body from the start)
    { type: 'moro', x: 630, y: 1830, angle: 0.35, dead: true },
    // the cleaners in the stairwell (all of them — the clear): the 3rd floor, the ground floor
    { type: 'assaulter', x: 1700, y: 1330, angle: Math.PI, tag: 'stair' },
    { type: 'cleaner', x: 1200, y: 1560, angle: 0.4, tag: 'stair', patrol: [[1200, 1560, 2, 0], [1340, 1720, 2, Math.PI / 2]] },
    { type: 'cleaner', x: 1300, y: 2000, angle: Math.PI, tag: 'stair', patrol: [[1300, 2000, 2.5, Math.PI], [1200, 2150, 2, Math.PI / 2]] },
    { type: 'cleaner', x: 1680, y: 1500, angle: Math.PI / 2, tag: 'stair' },
    { type: 'assaulter', x: 1560, y: 2050, angle: -Math.PI / 2, tag: 'stair' },
    { type: 'shield', x: 2300, y: 1480, angle: -Math.PI / 2, tag: 'stair' },
    { type: 'cleaner', x: 2560, y: 1650, angle: Math.PI, tag: 'stair', patrol: [[2560, 1650, 2, Math.PI], [2700, 1450, 2, -Math.PI / 2]] },
    { type: 'assaulter', x: 2140, y: 2080, angle: -Math.PI / 2, tag: 'stair' },
    // the roofs (the leader carries the order)
    { type: 'cleaner', x: 2700, y: 500, angle: Math.PI, patrol: [[2700, 500, 2, Math.PI], [2500, 800, 2, Math.PI / 2], [2900, 850, 2, 0]] },
    { type: 'assaulter', x: 1760, y: 620, angle: 0, patrol: [[1760, 620, 3, 0], [2000, 620, 2, 0]] },
    { type: 'cleaner', x: 1400, y: 250, angle: 0, patrol: [[1400, 250, 2, 0], [2100, 250, 2, Math.PI]] },
    { type: 'shield', x: 1290, y: 470, angle: 0 },
    { type: 'assaulter', x: 420, y: 560, angle: 0, carries: 'order', tag: 'leader' },
    { type: 'cleaner', x: 760, y: 900, angle: 0, patrol: [[760, 900, 2, 0], [760, 560, 2, -Math.PI / 2]] },
  ],

  pickups: [
    // [СЦЕНА] what Kane looks at in the flat
    { id: 'inspect_moro', kind: 'inspect', task: 'scene', x: 640, y: 1838, h: 22, dialogue: 'flat.moro' },
    { id: 'inspect_laptop', kind: 'inspect', task: 'scene', x: 552, y: 1726, h: 34, dialogue: 'flat.laptop' },
    // Lyra's stash under the bath — the passport and the silenced pistol (there after the call)
    { id: 'stash', kind: 'crate', item: 'pistol_sd', gives: 'stash', hidden: true, dormant: true, wakeOn: 'stash', x: 172, y: 1520 },
    // supplies: rounds in the ground floor's store, grenades in the stair hut
    { id: 'ammo_store', kind: 'crate', item: 'ammo', count: 2, x: 2110, y: 2200 },
    { id: 'grenades_hut', kind: 'crate', item: 'grenades', count: 2, x: 1760, y: 760 },
  ],

  // the police helicopter over the roofs: its round, then after the hero; lit 1.5 s — its gunner (from the south-west)
  searchlights: [
    { kind: 'heli', path: [[2700, 620], [1700, 380], [600, 620], [1700, 860]], speed: 60, chase: 78, radius: 82, spot: 1.5, lose: 3,
      burst: 3, shotGap: 0.14, every: 1.3, damage: 6, side: -0.86, from: 380, during: ['order', 'exit'] },
  ],

  objectives: [
    { id: 'scene', type: 'inspect', textKey: 'obj.flat.scene', target: [600, 1780], done: 'sceneDone' },
    { id: 'call', type: 'call', textKey: 'obj.flat.call', dialogue: 'flat.call', done: 'called' },
    { id: 'stash', textKey: 'obj.flat.stash', target: 'stash', done: 'stash' },
    { id: 'clear', type: 'clear', tag: 'stair', textKey: 'obj.flat.clear', done: 'cleared',
      // the first ones up the stairs: the shield trooper and a cleaner behind him
      spawn: [{ type: 'shield', x: 1000, y: 1300, angle: Math.PI, tag: 'stair', hunt: true }, { type: 'cleaner', x: 1040, y: 1365, angle: Math.PI, tag: 'stair', hunt: true }] },
    { id: 'roof', type: 'reach', room: 'roof_e', textKey: 'obj.flat.roof', target: [2960, 1130], done: 'onRoof', startDialogue: 'flat.street' },
    { id: 'order', textKey: 'obj.flat.order', target: 'order', done: 'order', startDialogue: 'flat.heli' },
    { id: 'exit', textKey: 'obj.flat.exit', target: 'exit' },
  ],
  exit: { rect: [196, 366, 304, 474], x: 250, y: 420 },
};
