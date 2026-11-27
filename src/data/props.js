// Furniture / equipment of the office location (D78; D79: every object collides, bullets by height).
// Footprint w × d (game units, before the prop's 90° turns), height h, collision shape (box / circle with radius r).
// What a prop blocks follows its height (systems/Collision.js BLOCK bits): every standing object stops walkers; a
// bullet flies at shoulder height (≈ 41, data/player.js MUZZLE) — only objects taller than BULLET_HEIGHT stop it (an
// overturned chair, a desk or a counter never does); a look (eye height) is blocked only above EYE_HEIGHT. Flat things
// (rugs, papers, stairs) and wall-mounted decor block nothing. `bullet` / `sight` override the height rule where the
// shape is mostly air (a plant's leaves). 1 m ≈ 30 game units (a character is 56 tall).
// D82 cover: 'low' — the hero crouches behind it (it then also stops enemy rounds and looks aimed at him: BLOCK.LOW);
// 'high' — he presses against it (it stops rounds anyway). Chairs, plants and small things are never cover.
export const BULLET_HEIGHT = 38;
export const EYE_HEIGHT = 46;

export const PROP_TYPES = {
  workstation: { w: 60, d: 30, h: 23, cover: 'low' },          // desk + monitors + PC + keyboard
  exec_desk: { w: 76, d: 36, h: 24, cover: 'low' },
  chair: { w: 18, d: 18, h: 32, shape: 'circle', r: 9 },
  chair_meeting: { w: 16, d: 16, h: 28, shape: 'circle', r: 8 },
  conf_table: { w: 200, d: 70, h: 23, cover: 'low' },
  armchair: { w: 30, d: 28, h: 25 },
  coffee_table: { w: 32, d: 32, h: 14, shape: 'circle', r: 16 },
  round_table: { w: 36, d: 36, h: 23, shape: 'circle', r: 18, cover: 'low' },
  // D97 (user: the curved desk collided as a box): parts — collision boxes [x0, z0, x1, z1] in parts of w × d (z front-
  // ward), the desk's U-shape traced from its top picture's outline (data/viewOutlines.js), 10 strips
  // D111: re-traced from the new top picture (NEW/Office/office new sprites — a deeper curve)
  reception: { w: 150, d: 40, h: 34, cover: 'low', parts: [[-0.5, -0.49, -0.4, 0.155], [-0.4, -0.49, -0.3, 0.33], [-0.3, -0.12, -0.2, 0.43],
    [-0.2, 0.04, -0.1, 0.49], [-0.1, 0.105, 0.0, 0.49], [0.0, 0.105, 0.1, 0.49], [0.1, 0.04, 0.2, 0.49], [0.2, -0.12, 0.3, 0.43],
    [0.3, -0.49, 0.4, 0.315], [0.4, -0.49, 0.5, 0.155]] },
  filing_cabinet: { w: 20, d: 24, h: 42, cover: 'high' },
  archive_shelf: { w: 70, d: 18, h: 62, cover: 'high' },
  bookcase: { w: 50, d: 14, h: 56, cover: 'high' },
  printer: { w: 28, d: 24, h: 32, cover: 'low' },
  server_rack: { w: 24, d: 30, h: 66, cover: 'high' },
  server_rack_open: { w: 24, d: 30, h: 66, cover: 'high' },
  console: { w: 120, d: 36, h: 44, cover: 'high' },             // the three monitors on it stop bullets
  terminal: { w: 50, d: 28, h: 32, cover: 'low' },
  turnstile: { w: 10, d: 36, h: 30 },
  coffee_counter: { w: 52, d: 24, h: 44, bullet: false },
  vending: { w: 32, d: 26, h: 60, cover: 'high' },
  boxes: { w: 34, d: 26, h: 22, cover: 'low' },
  boxes_tall: { w: 26, d: 26, h: 40, cover: 'high' },
  trolley: { w: 30, d: 18, h: 26, cover: 'low' },
  plant: { w: 18, d: 18, h: 44, shape: 'circle', r: 9, bullet: false, sight: false },
  whiteboard: { w: 54, d: 10, h: 48, cover: 'high' },
  overturned_chair: { w: 24, d: 18, h: 16 },
  // D116 (user): the fallen chairs — the office chairs lying on their side (render: their models laid down)
  chair_down: { w: 30, d: 20, h: 18 },
  chair_meeting_down: { w: 28, d: 18, h: 16 },
  broken_monitor: { w: 26, d: 18, h: 8 },
  // D83 lights and decor of the reference (render3d/officeLights.js lights them): a floor lamp stands (a thin pole —
  // stops walkers only); a planter is low cover with plants on it; the rest blocks nothing
  floor_lamp: { w: 12, d: 12, h: 52, shape: 'circle', r: 5, bullet: false, sight: false },
  planter: { w: 64, d: 16, h: 20, cover: 'low' },
  desk_lamp: { w: 8, d: 8, h: 14, decor: true },
  cable_tray: { w: 100, d: 12, h: 0, decor: true },
  wall_light: { w: 40, d: 3, h: 4, wall: true },
  alarm_light: { w: 6, d: 3, h: 6, wall: true },
  // D85: more of the user's catalogue (NEW/Office/office sprites; sizes from its catalogue, 1 m = 30 units)
  exec_chair: { w: 18, d: 18, h: 32, shape: 'circle', r: 9 },
  sofa: { w: 72, d: 28, h: 25 },
  glass_cabinet: { w: 36, d: 14, h: 56, cover: 'high' },
  low_cabinet: { w: 36, d: 15, h: 24, cover: 'low' },
  locker: { w: 12, d: 15, h: 54, cover: 'high' },
  shredder: { w: 12, d: 9, h: 18 },
  coffee_vending: { w: 16, d: 18, h: 42, cover: 'high' },
  water_cooler: { w: 12, d: 12, h: 39, shape: 'circle', r: 6, bullet: false },
  open_box: { w: 18, d: 15, h: 12 },
  steel_bin: { w: 10, d: 10, h: 20, shape: 'circle', r: 5 },
  recycling_bin: { w: 13, d: 12, h: 20 },
  fire_hose: { w: 24, d: 6, h: 20, wall: true },
  electrical: { w: 15, d: 6, h: 18, wall: true },
  first_aid: { w: 12, d: 5, h: 15, wall: true },
  air_conditioner: { w: 27, d: 7, h: 9, wall: true },
  security_camera: { w: 5, d: 10, h: 6, wall: true },
  // flat / wall-mounted (no collision)
  rug_large: { w: 170, d: 110, h: 0, flat: true },
  rug_small: { w: 100, d: 66, h: 0, flat: true },
  papers: { w: 14.7, d: 11, h: 1, flat: true }, // D112 / D114 / D116 (user): the papers on the floor −25 %, −30 %, −30 %
  stairs: { w: 120, d: 70, h: 6, flat: true },
  notice_board: { w: 50, d: 3, h: 30, wall: true },
  tv_wall: { w: 80, d: 3, h: 40, wall: true },
  elevator: { w: 60, d: 3, h: 70, wall: true },
  extinguisher: { w: 8, d: 6, h: 18, wall: true },
  exit_sign: { w: 24, d: 3, h: 9, wall: true },
  wall_clock: { w: 14, d: 3, h: 14, wall: true },
  // D88: the training ground (NEW/tutorial/sprites; catalogue sizes, 1 m = 30 units). Trees / boulders stop walkers
  // and rounds; the canopy, tent and screens are tall cover; targets stop rounds (they count the hits)
  tree: { w: 60, d: 60, h: 160, shape: 'circle', r: 14, sight: false },
  boulder: { w: 39, d: 30, h: 22, cover: 'low' },
  bush: { w: 36, d: 30, h: 27, bullet: false, sight: false },
  grass_tuft: { w: 15, d: 15, h: 13, decor: true },
  flowers: { w: 18, d: 15, h: 15, decor: true },
  canopy: { w: 120, d: 90, h: 78, decor: true },
  canopy_pole: { w: 4, d: 4, h: 78, shape: 'circle', r: 3, bullet: false, sight: false }, // D116: the canopy's legs stop walkers (not drawn)
  tent: { w: 66, d: 54, h: 54, cover: 'high' },
  fabric_screen: { w: 60, d: 5, h: 66, bullet: false, cover: 'high' },
  signal_amber: { w: 8, d: 8, h: 57, shape: 'circle', r: 4, bullet: false, sight: false },
  signal_green: { w: 8, d: 8, h: 57, shape: 'circle', r: 4, bullet: false, sight: false },
  blue_hurdle: { w: 45, d: 9, h: 20 },
  blue_mat: { w: 60, d: 36, h: 2, flat: true },
  concrete_cover: { w: 60, d: 14, h: 30, cover: 'low' },
  jersey_barrier: { w: 60, d: 17, h: 27, cover: 'low' },
  round_target: { w: 14, d: 12, h: 46 },
  torso_target: { w: 15, d: 9, h: 40 },
  sandbags: { w: 90, d: 24, h: 30, cover: 'low' },
  steel_cover: { w: 60, d: 6, h: 33, cover: 'low' },
  ammo_box: { w: 12, d: 8, h: 7, decor: true },
  barrel: { w: 18, d: 18, h: 27, shape: 'circle', r: 9, cover: 'low' },
  equipment_case: { w: 24, d: 17, h: 17, cover: 'low' },
  supply_chest: { w: 48, d: 24, h: 22, cover: 'low' },
  supply_chest_open: { w: 48, d: 24, h: 22, cover: 'low' },
  weapon_chest: { w: 54, d: 26, h: 22, cover: 'low' },
  weapon_chest_open: { w: 54, d: 26, h: 22, cover: 'low' },
  crate_wood: { w: 30, d: 30, h: 30, cover: 'low' },
  crate_wood_tall: { w: 30, d: 30, h: 60, cover: 'high' },
  workbench: { w: 60, d: 22, h: 24, cover: 'low' },
  medical_case: { w: 17, d: 12, h: 12, decor: true },
  small_medkit: { w: 10, d: 7, h: 3, decor: true },
  mesh_fence: { w: 90, d: 3, h: 60, decor: true },        // drawn along the 'fence' walls (render only)
  mesh_gate_closed: { w: 93, d: 6, h: 63, decor: true },
  mesh_gate_open: { w: 93, d: 6, h: 63, decor: true },
  // D145: level 1's parking (Marseille, the user's catalogue NEW/marseille/L01-parking; sizes × 30). Cars and the van are
  // cover (low / high); the columns are high cover; small cases are low cover; floor and wall things block nothing
  car_sedan_dark: { w: 62, d: 140, h: 45, cover: 'low' },
  car_hatch: { w: 59, d: 122, h: 49, cover: 'low' },
  car_wagon: { w: 62, d: 143, h: 47, cover: 'low' },
  car_compact: { w: 58, d: 116, h: 47, cover: 'low' },
  car_sedan_black: { w: 63, d: 143, h: 44, cover: 'low' },
  car_sedan_silver: { w: 64, d: 145, h: 44, cover: 'low' },
  van: { w: 74, d: 162, h: 74, cover: 'high' },
  street_tree: { w: 60, d: 60, h: 190, shape: 'circle', r: 10, sight: false },
  street_lantern: { w: 13, d: 13, h: 102, shape: 'circle', r: 4, bullet: false, sight: false },
  street_bollard: { w: 6, d: 6, h: 27, shape: 'circle', r: 3, bullet: false },
  tree_pit: { w: 43, d: 43, h: 1, flat: true },
  generator: { w: 104, d: 41, h: 49, cover: 'high' },
  generator_plinth: { w: 115, d: 51, h: 8, decor: true },
  switchgear: { w: 65, d: 21, h: 62, cover: 'high' },
  booth_desk: { w: 78, d: 40, h: 24, cover: 'low' },
  booth_chair: { w: 21, d: 20, h: 31, shape: 'circle', r: 10 },
  parking_barrier: { w: 66, d: 22, h: 16 },
  wheel_stop_gray: { w: 52, d: 6, h: 4, decor: true },
  wheel_stop_yellow: { w: 52, d: 7, h: 4, decor: true },
  traffic_cone: { w: 10, d: 10, h: 16, shape: 'circle', r: 5, bullet: false },
  parking_column: { w: 18, d: 18, h: 83, cover: 'high' },
  drain_grate: { w: 150, d: 6, h: 1, flat: true },
  storage_rack: { w: 36, d: 21, h: 58, cover: 'high' },
  cargo_rack: { w: 37, d: 25, h: 44, cover: 'high' },
  utility_cabinet: { w: 104, d: 29, h: 56, cover: 'high' },
  equipment_crate: { w: 22, d: 22, h: 21, cover: 'low' },
  lidded_bin: { w: 28, d: 22, h: 28, cover: 'low' },
  case_light: { w: 16, d: 16, h: 15 },
  case_dark: { w: 13, d: 13, h: 13 },
  case_gray: { w: 14, d: 14, h: 13 },
  case_olive: { w: 15, d: 15, h: 15 },
  storage_tote: { w: 13, d: 13, h: 12 },
  pallet: { w: 35, d: 24, h: 4, decor: true },
  carton: { w: 16, d: 14, h: 13 },
  cargo_box: { w: 16, d: 15, h: 13 },
  equipment_stand: { w: 19, d: 18, h: 16 },
  stair_rail: { w: 74, d: 5, h: 41, decor: true }, // between the two flights of the service stairs
  // on the parking's walls
  lift_doors: { w: 55, d: 6, h: 68, wall: true },
  strip_light: { w: 36, d: 5, h: 4, wall: true },
  louver_tall: { w: 14, d: 3, h: 22, wall: true },
  louver_wide: { w: 21, d: 3, h: 11, wall: true },
  alarm_panel: { w: 26, d: 6, h: 23, wall: true },
  service_panel: { w: 14, d: 5, h: 17, wall: true },
  junction_large: { w: 14, d: 5, h: 18, wall: true },
  junction_small: { w: 11, d: 5, h: 13, wall: true },
  wall_case_yellow: { w: 5, d: 5, h: 20, wall: true },
  safety_box_red: { w: 7, d: 5, h: 13, wall: true },
  card_reader: { w: 4, d: 3, h: 7, wall: true },
  // D148: Marseille level 2 — the safe flat, its stairwell and hall, the roofs (the user's catalogue NEW/marseille/L02;
  // sizes × 30, generated from it): cover by height; floor / wall things block nothing
  mf_kitchen: { w: 85.2, d: 72.6, h: 27.3, cover: 'low' },
  mf_fridge: { w: 20.7, d: 21.3, h: 50.4, cover: 'high' },
  mf_pantry: { w: 21.9, d: 16.8, h: 50.4, cover: 'high' },
  mf_wardrobe: { w: 27.6, d: 16.8, h: 55.5, cover: 'high' },
  mf_toilet: { w: 12.6, d: 21.6, h: 24.3 },
  mf_sink: { w: 17.1, d: 14.4, h: 26.1 },
  mf_shower: { w: 32.4, d: 30.9, h: 57.6, bullet: false },
  mf_bath_cover: { w: 13.2, d: 13.5, h: 1.6, flat: true },
  mf_bed: { w: 46.8, d: 62.7, h: 30.6, cover: 'low' },
  mf_nightstand: { w: 14.7, d: 14.4, h: 18.6 },
  mf_end_table: { w: 14.7, d: 14.7, h: 19.2 },
  mf_desk: { w: 41.1, d: 24, h: 22.8, cover: 'low' },
  mf_bookcase: { w: 34.8, d: 9.9, h: 27.3, cover: 'low' },
  mf_sideboard: { w: 43.2, d: 14.7, h: 27.3, cover: 'low' },
  mf_sofa_leather: { w: 60.6, d: 26.1, h: 25.2, cover: 'low' },
  mf_armchair: { w: 19.5, d: 21, h: 25.5 },
  mf_chair: { w: 12.9, d: 13.5, h: 25.8, shape: 'circle', r: 5.2 },
  mf_chair_curved: { w: 13.5, d: 13.5, h: 27, shape: 'circle', r: 5.4 },
  mf_table: { w: 28.5, d: 26.1, h: 22.8, cover: 'low' },
  mf_table_round: { w: 30.6, d: 30.6, h: 22.5, shape: 'circle', r: 13.8, cover: 'low' },
  mf_sofa_olive: { w: 57.3, d: 25.8, h: 25.8, cover: 'low' },
  mf_sofa_red: { w: 52.5, d: 24, h: 24.6, cover: 'low' },
  mf_hutch: { w: 60, d: 16.5, h: 53.4, cover: 'high' },
  mf_trunk: { w: 22.8, d: 13.2, h: 12.3 },
  mf_laptop: { w: 10.2, d: 7.5, h: 6.9, decor: true },
  mf_notes: { w: 6.3, d: 8.7, h: 1, flat: true },
  mf_books: { w: 11.1, d: 5.4, h: 7.2, decor: true },
  mf_book_stack: { w: 8.1, d: 5.7, h: 4.2, decor: true },
  mf_lamp: { w: 8.1, d: 8.1, h: 11.1, decor: true },
  mf_lamp_small: { w: 6, d: 6, h: 9.3, decor: true },
  mf_plant: { w: 15.3, d: 14.1, h: 26.1, shape: 'circle', r: 5.6, bullet: false, sight: false },
  mf_rug_study: { w: 67.5, d: 80.4, h: 1, flat: true },
  mf_rug_red: { w: 32.7, d: 50.4, h: 1, flat: true },
  mf_rug_green: { w: 30.6, d: 49.5, h: 1, flat: true },
  mf_rug_lounge: { w: 26.4, d: 46.8, h: 1, flat: true },
  mf_runner_bed: { w: 17.1, d: 47.7, h: 1, flat: true },
  mf_runner_lobby: { w: 27.6, d: 66.3, h: 1, flat: true },
  mf_blood: { w: 19.5, d: 16.5, h: 1, flat: true },
  mf_ottoman: { w: 18.3, d: 17.7, h: 13.8 },
  mf_sectional: { w: 75, d: 51.6, h: 24, cover: 'low' },
  mf_mailboxes: { w: 26.4, d: 5.7, h: 22.2, wall: true },
  mf_bicycle: { w: 53.1, d: 16.2, h: 33.3, bullet: false, sight: false, noAo: true },
  mf_tree_pot: { w: 25.5, d: 24.3, h: 47.1, shape: 'circle', r: 9.7, bullet: false, sight: false },
  mf_basket: { w: 11.1, d: 11.1, h: 14.7, shape: 'circle', r: 4.4 },
  mf_crate: { w: 16.8, d: 11.4, h: 9.9 },
  mf_case: { w: 16.8, d: 10.5, h: 9.3 },
  mf_balustrade: { w: 36, d: 3, h: 29.7, decor: true },
  mf_newel: { w: 4.8, d: 4.8, h: 30.9, decor: true },
  mf_handrail: { w: 78.6, d: 3.3, h: 36, decor: true },
  guard_rail: { w: 60, d: 2.7, h: 31.5, decor: true },
  mf_ladder: { w: 14.7, d: 8.7, h: 76.2, wall: true },
  mf_planks: { w: 67.5, d: 31.8, h: 5.1, flat: true },
  mf_hatch: { w: 35.4, d: 40.2, h: 33.6 },
  mf_water_tank: { w: 63.9, d: 60.6, h: 102.6, parts: [[-0.5, -0.5, -0.38, -0.38], [0.38, -0.5, 0.5, -0.38], [-0.5, 0.38, -0.38, 0.5], [0.38, 0.38, 0.5, 0.5]], bullet: false, sight: false, noAo: true },
  mf_ac: { w: 27.3, d: 11.4, h: 20.7, cover: 'low' },
  mf_ac_top: { w: 26.4, d: 15.9, h: 21.9, cover: 'low' },
  mf_hvac: { w: 33.3, d: 14.1, h: 18.6, cover: 'low' },
  mf_pump: { w: 13.8, d: 8.7, h: 11.4 },
  mf_canister: { w: 6.3, d: 6.3, h: 21.6, shape: 'circle', r: 2.5 },
  mf_pipe: { w: 35.4, d: 10.2, h: 9.6 },
  mf_chimney_pot: { w: 8.7, d: 8.7, h: 15, decor: true },
  mf_dish: { w: 24.9, d: 21, h: 28.5, bullet: false, sight: false, noAo: true },
  mf_skylight: { w: 58.2, d: 41.7, h: 13.5, cover: 'low' },
  mf_clothesline: { w: 66.6, d: 4.8, h: 47.4, decor: true },
  mf_sheet: { w: 14.4, d: 2, h: 22.5, decor: true },
  mf_towel: { w: 11.7, d: 2, h: 16.5, decor: true },
  mf_pot: { w: 17.7, d: 17.7, h: 23.7, shape: 'circle', r: 7.1, bullet: false, sight: false },
  mf_planter: { w: 18.9, d: 8.7, h: 12 },
  mf_roof_lantern: { w: 5.7, d: 6.9, h: 9, wall: true },
  mf_alley_lantern: { w: 7.8, d: 12, h: 14.4, wall: true },
  mf_drain: { w: 6, d: 6, h: 1, flat: true },
  mf_window_facade: { w: 46.5, d: 1.5, h: 49.5, wall: true },
  mf_window: { w: 34.5, d: 1.5, h: 36, wall: true },
  mf_window_kitchen: { w: 19.5, d: 1.5, h: 34.5, wall: true },
  mf_window_bath: { w: 24, d: 1.5, h: 13.5, wall: true },
  mf_picture: { w: 10.5, d: 1.5, h: 13.5, wall: true },
  mf_portrait: { w: 13.5, d: 1.5, h: 16.5, wall: true },
  mf_plaque: { w: 6, d: 1.5, h: 7.5, wall: true },
  mf_plaster_patch: { w: 33, d: 1.5, h: 22.5, wall: true },
  mf_damp: { w: 19.5, d: 1.5, h: 39, wall: true },
  mf_sconce: { w: 5.4, d: 6.3, h: 8.7, wall: true },
  mf_entry_lantern: { w: 8.7, d: 12, h: 17.4, wall: true },
  mf_neon_pink: { w: 25.5, d: 1.5, h: 2.4, wall: true },
  mf_neon_cyan: { w: 25.5, d: 1.5, h: 2.4, wall: true },
  // D148: Marseille level 3 — the container terminal and the pier (NEW/marseille/L03). The crane is drawn at half its
  // size (its full 18 m frame towered into the camera); the floodlight masts are one picture on a post
  mt_container_red: { w: 73.1, d: 365.8, h: 77.7, cover: 'high' },
  mt_container_blue: { w: 73.1, d: 365.8, h: 77.7, cover: 'high' },
  mt_container_green: { w: 73.1, d: 365.8, h: 77.7, cover: 'high' },
  mt_container_rust: { w: 73.1, d: 365.8, h: 77.7, cover: 'high' },
  mt_container_open_side: { w: 102.9, d: 365.7, h: 77.7, cover: 'high' },
  mt_container_open_end: { w: 96.9, d: 396.3, h: 77.7, cover: 'high' },
  mt_pallet: { w: 33.5, d: 24, h: 4.5, flat: true },
  mt_crate: { w: 36.6, d: 34.8, h: 32.4, cover: 'low' },
  mt_box: { w: 26.1, d: 21.9, h: 17.4, cover: 'low' },
  mt_cage: { w: 37.5, d: 30.9, h: 32.7, cover: 'low' },
  mt_carton: { w: 17.1, d: 13.5, h: 12.9 },
  mt_case: { w: 25.8, d: 22.5, h: 21.3, cover: 'low' },
  mt_drum_red: { w: 17.9, d: 17.9, h: 25.9, shape: 'circle', r: 8.1, cover: 'low' },
  mt_drum_striped: { w: 17.9, d: 17.9, h: 25.9, shape: 'circle', r: 8.1, cover: 'low' },
  mt_drum_blue: { w: 17.9, d: 17.9, h: 25.9, shape: 'circle', r: 8.1, cover: 'low' },
  mt_forklift: { w: 39.9, d: 107.7, h: 66.6, cover: 'low' },
  mt_truck: { w: 85.2, d: 245.4, h: 103.5, cover: 'high' },
  mt_boat: { w: 71.4, d: 183.6, h: 57.6, decor: true },
  mt_mast: { w: 46.5, d: 46.5, h: 315, shape: 'circle', r: 8, bullet: false, sight: false, noAo: true },
  mt_crane: { w: 166.5, d: 345, h: 277.5, bullet: false, sight: false, parts: [[-0.5, -0.5, -0.4, -0.44], [0.4, -0.5, 0.5, -0.44], [-0.5, 0.44, -0.4, 0.5], [0.4, 0.44, 0.5, 0.5]], noAo: true }, // (its four legs)
  mt_bollard: { w: 22, d: 22, h: 20.2, shape: 'circle', r: 9.9, cover: 'low' },
  mt_fender: { w: 12, d: 11.4, h: 28.2, decor: true },
  mt_quay_ladder: { w: 17.3, d: 11.6, h: 65.7, decor: true },
  mt_hawser: { w: 54.3, d: 43.5, h: 5.4, flat: true },
  mt_pile: { w: 9.2, d: 9.2, h: 46.2, decor: true },
  mt_jetty_lantern: { w: 8.1, d: 8.1, h: 32.4, shape: 'circle', r: 3.2, bullet: false, sight: false, noAo: true },
  mt_fence_lantern: { w: 9.6, d: 10.5, h: 10.8, wall: true },
  port_rail: { w: 70.8, d: 3.8, h: 30.6, decor: true },
  port_fence: { w: 74.4, d: 2.7, h: 57.6, decor: true },
  mt_gangway: { w: 46.8, d: 318, h: 34.5, flat: true },
  mt_hatch_cover: { w: 297.6, d: 355.5, h: 20.7, cover: 'low' },
  mt_winch: { w: 82.8, d: 48.3, h: 48.6, cover: 'low' },
  mt_capstan: { w: 33, d: 33, h: 24, shape: 'circle', r: 14.8, cover: 'low' },
  mt_fairlead: { w: 35.1, d: 15.9, h: 21.9 },
  mt_lifebuoy: { w: 27, d: 5.7, h: 27, wall: true },
  mt_vent: { w: 16.8, d: 17.1, h: 42.9, shape: 'circle', r: 6.7 },
  mt_nav_mast: { w: 27, d: 20.4, h: 110.4, shape: 'circle', r: 8.2, bullet: false, sight: false },
  mt_control_desk: { w: 85.2, d: 57.9, h: 23.1, cover: 'low' },
  mt_task_chair: { w: 21.3, d: 21.6, h: 28.8, shape: 'circle', r: 8.5 },
  mt_monitor_blue: { w: 17.5, d: 6.9, h: 14.1, decor: true },
  mt_monitor_cyan: { w: 17.5, d: 6.9, h: 14.1, decor: true },
  mt_radio: { w: 10.6, d: 8.8, h: 6.1, decor: true },
  mt_lockers: { w: 41.1, d: 16.8, h: 55.5, cover: 'high' },
  mt_workbench: { w: 59.4, d: 22.2, h: 28.6, cover: 'low' },
  mt_shelf: { w: 33.6, d: 12.9, h: 35.1, cover: 'low' },
  mt_bookcase: { w: 24.9, d: 11.4, h: 48.6, cover: 'high' },
  mt_binders: { w: 17.4, d: 5.4, h: 9.1, decor: true },
  mt_laptop: { w: 11.7, d: 9.3, h: 9, decor: true },
  mt_storage_box: { w: 14.1, d: 10.5, h: 9.6 },
  mt_parts_bin: { w: 10.7, d: 10.2, h: 7.2, decor: true },
  mt_hose: { w: 14.1, d: 6.6, h: 21.9, wall: true },
  mt_window_warm: { w: 43.5, d: 1.5, h: 40.5, wall: true },
  mt_window_dark: { w: 43.5, d: 1.5, h: 40.5, wall: true },
  mt_bridge_window: { w: 84, d: 1.5, h: 25.5, wall: true },
  mt_ship_window: { w: 24, d: 1.5, h: 19.5, wall: true },
  mt_gooseneck: { w: 7.9, d: 12, h: 11.4, wall: true },
  mt_caged_lantern: { w: 6.6, d: 9.9, h: 11.4, wall: true },
  mt_work_light: { w: 9.6, d: 9.3, h: 11.7, wall: true },
  mt_hazard_strip: { w: 4.5, d: 1.5, h: 21, wall: true },
  mt_brick_runoff: { w: 54, d: 1.5, h: 13.5, wall: true },
  mt_damp: { w: 25.5, d: 1.5, h: 19.5, wall: true },
  mt_rust: { w: 16.5, d: 1.5, h: 36, wall: true },
  mt_junction: { w: 12.6, d: 7.2, h: 15.6, wall: true },
  mt_drain: { w: 29.8, d: 9.4, h: 2.4, flat: true },
  mt_rails: { w: 54.6, d: 90, h: 4.4, flat: true },
  mt_safety_post: { w: 7.8, d: 7.5, h: 29.1, shape: 'circle', r: 3, bullet: false, noAo: true },
};

const MOVE = 1, BULLET = 2, SIGHT = 4, LOW = 8;

/** Collision mask of a prop type (Collision.js BLOCK bits) from its height and overrides. */
export function propBlocks(t) {
  if (!t || t.flat || t.wall || t.decor) return 0;
  let m = MOVE;
  if (t.bullet !== false && t.h > BULLET_HEIGHT) m |= BULLET;
  if (t.sight !== false && t.h > EYE_HEIGHT) m |= SIGHT;
  if (t.cover === 'low') m |= LOW;
  return m;
}

/**
 * D97: the collision boxes of a placed prop with `parts` (world [minX, minY, maxX, maxY] each), or null. The quarter
 * turns as the renderer turns the prop (three.js about +Y by −rot·90°: local (x, z) → (x cos + z sin, −x sin + z cos)).
 */
export function propParts(p) {
  const T = PROP_TYPES[p.type];
  if (T && !T.parts && p.yaw && T.w > T.d * 1.5) return yawParts(p, T);
  if (!T || !T.parts) return null;
  const a = -((p.rot | 0) & 3) * (Math.PI / 2), c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  return T.parts.map(([x0, z0, x1, z1]) => {
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => [x * T.w, z * T.d]).map(([x, z]) => [x * c + z * s, -x * s + z * c]);
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
    return [p.x + Math.min(...xs), p.y + Math.min(...zs), p.x + Math.max(...xs), p.y + Math.max(...zs)];
  });
}

/**
 * D117: a long prop turned off the quarter turns (`yaw`, rad — a slanted sandbag wall) collides as a row of small boxes
 * along its length (each the box round one piece of the turned footprint) — not one big box round the whole slant.
 * The turn matches the renderer's: θ = −(rot·π/2 + yaw) about the vertical.
 */
function yawParts(p, T) {
  const n = Math.max(2, Math.ceil(T.w / T.d)), th = -(((p.rot | 0) & 3) * (Math.PI / 2) + p.yaw), c = Math.cos(th), s = Math.sin(th);
  const hl = T.w / (2 * n), hd = (T.d / 2) * 0.9, out = [];
  for (let i = 0; i < n; i++) {
    const mx = -T.w / 2 + (i + 0.5) * (T.w / n);
    const pts = [[mx - hl, -hd], [mx + hl, -hd], [mx - hl, hd], [mx + hl, hd]].map(([x, z]) => [x * c + z * s, -x * s + z * c]);
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
    out.push([p.x + Math.min(...xs), p.y + Math.min(...zs), p.x + Math.max(...xs), p.y + Math.max(...zs)]);
  }
  return out;
}

/** Footprint box of a placed prop (rot = quarter turns) → [minX, minY, maxX, maxY]. */
export function propBox(p) {
  const T = PROP_TYPES[p.type];
  const turned = (p.rot | 0) % 2 === 1;
  const hw = (turned ? T.d : T.w) / 2, hd = (turned ? T.w : T.d) / 2;
  return [p.x - hw, p.y - hd, p.x + hw, p.y + hd];
}
