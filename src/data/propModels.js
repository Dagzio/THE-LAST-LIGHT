// D85 (user request): the office furniture from the user's 5-view sheets (NEW/Office/office sprites, packed by
// tools/build-prop-views.py → data/propViews.js). Presentation only: the collision footprint / height of every prop
// stays in data/props.js.
//
// Each standing prop is a "view box" (render3d/propViews.js): its footprint w × d from data/props.js, its height from
// the front view's proportions; the top view lies on top, the front / back / left / right views stand on its sides
// (cut out by their transparency), so the prop can face any way and casts its real silhouette as a shadow.
//   view  — catalogue object id (or a list: one picked per prop, stable by position);
//   wall  — hangs on a wall (D111: a shallow box — its depth from data/props.js), centred at height `at` (units);
//   surf  — D111: the main surface height (a part of the height), overriding the one the atlas builder measured (the
//           side walls rise to it, the top picture lies on it, what stands above it is drawn in the middle).
// D111 (user): the office objects from the new atlases (NEW/Office/office new sprites, every view fits its face) —
// render3d/propViews.js lowPolyFaces; D115: the training ground's new atlases too (its own atlas file).
// D93: the side walls follow the top picture's outline (data/viewOutlines.js) — `box: true` keeps the plain box;
//   sprite — thin / leafy things: the front picture as one quad turned to the camera.
//   pot    — D112: a potted plant — a solid pot box (the pot band of the pictures wrapped round it) under a crown raised
//            along the top picture's outline (no crossing planes); the sizes measured by the atlas builder.
//   build  — D119: built from real parts with the parts of its pictures (render3d/officeBuilds.js).
//   model  — D96: drawn from the user's 3D model (render3d/propModels3d.js): the office chairs (impostors) and the
//            training tree (a baked picture); D112: the plants' and the armchair's models removed (atlas).
export const PROP_MODELS = {
  // D117 (user: the new PC textures; remodel the workstation): built in code — the desk + the new monitor, keyboard,
  // mouse, phone and PC tower (render3d/workstation.js); the view is the fallback
  workstation: { view: 'workstation', custom: 'workstation' },
  terminal: { view: 'workstation', custom: 'workstation' },
  exec_desk: { view: 'executive_desk' },
  // D117 (user: the chairs stood too neatly): pictures for 16 turns round (turns: 16) — the level sets them a little off
  // (yaw, data/levels/office.js scatter)
  // D112 (user): the chairs back on the user's 3D models (D99: 4-turn impostors baked from them, brighter); the view is
  // the fallback while they load
  chair: { view: 'mesh_chair', model: { file: 'exec_chair.glb', height: 32, impostor: true, turns: 16, bakeH: 256, vary: false, look: { hemi: 2.8, gain: 1.65 } } },
  exec_chair: { view: 'executive_chair', model: { file: 'exec_chair.glb', height: 34, impostor: true, turns: 16, bakeH: 256, vary: false, look: { hemi: 2.8, gain: 1.65 } } },
  chair_meeting: { view: 'cantilever_chair', model: { file: 'meeting_chair.glb', height: 29, impostor: true, turns: 16, bakeH: 256, vary: false, look: { gain: 1.1 } } },
  // D116 (user: the fallen chairs — our office chair, lying): the same models laid on their side (`lie`: the turn about
  // their depth axis), their own pictures (`key`); the view is the fallback while they load
  chair_down: { view: 'mesh_chair', model: { file: 'exec_chair.glb', key: 'exec_chair_down', lie: -Math.PI / 2, lieAxis: 'x', height: 32, impostor: true, turns: 16, bakeH: 256, vary: false, look: { hemi: 2.8, gain: 1.65 } } },
  chair_meeting_down: { view: 'cantilever_chair', model: { file: 'meeting_chair.glb', key: 'meeting_chair_down', lie: -Math.PI / 2, height: 29, impostor: true, turns: 16, bakeH: 256, vary: false, look: { gain: 1.1 } } },
  // D114 (user: odd panels on its sides / ends): a solid base box under a thin top slab; D116 (user: poor quality, square
  // corners — remodel it): built in code (render3d/confTable.js) — a stadium-shaped top with a crisp walnut texture and
  // its three cable hatches, two steel panel legs and a rail; the view is only the minimap / fallback
  conf_table: { view: 'conference_table', custom: 'confTable' },
  armchair: { view: 'lounge_armchair', build: 'armchair' }, // D119: remodelled (render3d/officeBuilds.js)
  sofa: { view: 'sofa', surf: 1 }, // (its back rest is not something standing on a surface)
  coffee_table: { view: 'marble_coffee_table' },
  // D111: the table height of the other desks (cover); D116: a pedestal table (its top slab, the pedestal under it)
  round_table: { view: 'round_meeting_table', drawH: 23, build: 'roundTable' }, // D119: remodelled
  reception: { view: 'reception' },
  filing_cabinet: { view: 'filing_cabinet' },
  archive_shelf: { view: 'archive_shelf' },
  bookcase: { view: 'bookcase' },
  glass_cabinet: { view: 'glass_cabinet' },
  low_cabinet: { view: 'low_cabinet' },
  locker: { view: 'locker' },
  printer: { view: 'copier' },
  shredder: { view: 'shredder' },
  server_rack: { view: 'server_rack' },
  server_rack_open: { view: 'network_rack' },
  // D121 (user: the new console textures, NEW/Office/office new sprites/CONSOLE): built from its catalogue's assembly
  // (render3d/securityConsole.js) — six monitors, two pedestals, the PC, the curved desk top
  console: { view: 'security_console', custom: 'securityConsole' },
  turnstile: { view: 'turnstile' },
  coffee_counter: { view: 'coffee_station', drawH: 46, build: 'coffeeCounter' }, // D111: its own height; D119: remodelled
  coffee_vending: { view: 'coffee_vending' },
  vending: { view: 'snack_vending' },
  water_cooler: { view: 'water_cooler', build: 'waterCooler' }, // D119: remodelled (a cabinet, a round bottle)
  // D111: the new catalogue has one box / one case — stacked to fill the footprint (nx, nz, layers)
  boxes: { view: 'closed_boxes', pack: [2, 2, 2] },
  boxes_tall: { view: 'flight_cases', pack: [1, 2, 5] },
  open_box: { view: 'open_box' },
  // D112 (user): the potted plants from the atlases — a solid pot joined by its texture, the crown above it (`pot`)
  // D116 (user: the snake plant looked boxy and wrong): its top picture shows the pot's rim — it lies on the pot, the
  // upright sword leaves are three planes round the middle (`per`: settings of one view of a list)
  plant: { view: ['broadleaf_planter', 'palm_planter', 'snake_planter'], pot: true, topAt: 0.72, per: { snake_planter: { topAt: 'pot', leaves: 3 } } },
  planter: { view: 'long_planter', build: 'planter' }, // D119: remodelled (a trough, the leaves over it)
  whiteboard: { view: 'mobile_whiteboard' },
  steel_bin: { view: 'steel_bin' },
  recycling_bin: { view: 'recycling_bin' },
  desk_lamp: { view: 'desk_lamp' },
  // D112 (user): the new rug again (lies on the floor)
  rug_large: { view: 'rug', flatTop: true },
  rug_small: { view: 'rug', flatTop: true },
  // on the walls
  wall_light: { view: 'wall_light', wall: true, at: 66 },
  notice_board: { view: 'cork_board', wall: true, at: 40 },
  tv_wall: { view: 'wall_display', wall: true, at: 42 },
  wall_clock: { view: 'clock', wall: true, at: 58 },
  extinguisher: { view: 'extinguisher_cabinet', wall: true, at: 30 },
  fire_hose: { view: 'fire_hose_cabinet', wall: true, at: 34 },
  electrical: { view: 'electrical_cabinet', wall: true, at: 40 },
  first_aid: { view: 'first_aid', wall: true, at: 60 }, // D122: above the coffee machine below it
  air_conditioner: { view: 'air_conditioner', wall: true, at: 68 },
  security_camera: { view: 'security_camera', wall: true, at: 70 },
  // D88: the training ground — the user's sheets in their own atlas (data/trainingViews.js)
  // D115 (user: new training-ground atlases, the office's logic): NEW/tutorial/new sprites — the same low-poly bodies as
  // the office (lowPolyFaces: `surf` / `up` measured by tools/build-training-assets.py; the old `top` factor gone)
  // D90: foliage — one picture turned to the camera (render3d/propViews.js `sprite`), not a box of views
  // D99 (user): the user's second, detailed tree (60 MB, 2 M triangles) — its picture baked OFFLINE from the model
  // (tools/bake-impostor.html: 785 × 768 webp, 79 KB) — the game never loads the model
  // D120 (user: the new tree textures, NEW/tutorial/new sprites/TREE): the tree built in code — trunk, branch cards, a
  // layered crown (render3d/trainingTree.js); the old baked picture (D99–D104) retired
  tree: { view: 'deciduous_tree', atlas: 'training', custom: 'tree', drawW: 120, drawD: 120 },
  boulder: { view: 'boulder', atlas: 'training' },
  bush: { view: 'leafy_bush', atlas: 'training', sprite: { lean: 1 } },
  grass_tuft: { view: 'grass_tuft', atlas: 'training', sprite: { lean: 1 } },
  flowers: { view: 'wildflower_clump', atlas: 'training', sprite: { lean: 1 } },
  canopy: { view: 'camouflage_canopy', atlas: 'training', box: true }, // D115: the net's notched outline hung threads
  // (D116: its legs collide as `canopy_pole` props — not drawn)
  tent: { view: 'field_tent', atlas: 'training', gable: true }, // D115: walls to the eaves, a two-slope roof
  fabric_screen: { view: 'fabric_screen', atlas: 'training' }, // (D116: brightened in the atlas — its cloth was near black)
  signal_amber: { view: 'signal_post_amber', atlas: 'training' },
  signal_green: { view: 'signal_post_green', atlas: 'training' },
  blue_hurdle: { view: 'blue_hurdle', atlas: 'training' },
  blue_mat: { view: 'blue_mat', atlas: 'training', flatTop: true },
  concrete_cover: { view: 'concrete_cover', atlas: 'training' },
  jersey_barrier: { view: 'jersey_barrier', atlas: 'training' },
  round_target: { view: 'round_target', atlas: 'training' },
  torso_target: { view: 'torso_target', atlas: 'training' },
  sandbags: { view: 'sandbag_wall', atlas: 'training' },
  steel_cover: { view: 'steel_cover', atlas: 'training' },
  ammo_box: { view: 'ammo_box', atlas: 'training' },
  barrel: { view: 'blue_barrel', atlas: 'training' },
  equipment_case: { view: 'equipment_case', atlas: 'training' },
  // D115: plain box sides (the latch notched the top outline — a slit in the front)
  supply_chest: { view: 'supply_chest_closed', atlas: 'training', box: true },
  supply_chest_open: { view: 'supply_chest_open', atlas: 'training', box: true },
  weapon_chest: { view: 'weapon_chest_closed', atlas: 'training' },
  weapon_chest_open: { view: 'weapon_chest_open', atlas: 'training' },
  crate_wood: { view: 'wood_storage_crate', atlas: 'training' },
  crate_wood_tall: { view: 'wood_storage_crate', atlas: 'training', pack: [1, 1, 2] }, // D115: two crates (its height 60)
  workbench: { view: 'wood_workbench', atlas: 'training' },
  medical_case: { view: 'medical_case', atlas: 'training' },
  small_medkit: { view: 'small_medkit', atlas: 'training' },
  mesh_fence: { view: 'mesh_fence', atlas: 'training' },
  mesh_gate_closed: { view: 'mesh_gate_closed', atlas: 'training' },
  mesh_gate_open: { view: 'mesh_gate_open', atlas: 'training' },
  // D145: level 1's parking — the user's Marseille catalogue (NEW/marseille/L01-parking), its own atlas
  // (tools/build-location-assets.py → data/views/marseille_l01.js), loaded with the level only
  car_sedan_dark: { view: 'dark_gray_sedan', atlas: 'marseille_l01' },
  car_hatch: { view: 'silver_hatchback', atlas: 'marseille_l01' },
  car_wagon: { view: 'blue_wagon', atlas: 'marseille_l01' },
  car_compact: { view: 'red_compact', atlas: 'marseille_l01' },
  car_sedan_black: { view: 'black_sedan', atlas: 'marseille_l01' },
  car_sedan_silver: { view: 'silver_sedan', atlas: 'marseille_l01' },
  van: { view: 'white_van', atlas: 'marseille_l01' },
  street_tree: { view: 'street_tree', atlas: 'marseille_l01', sprite: { lean: 1 }, drawW: 170 }, // (its crown ~6 m)
  stair_rail: { view: 'wall_stair_handrail', atlas: 'marseille_l01' },
  street_lantern: { view: 'street_lantern', atlas: 'marseille_l01', sprite: { lean: 1 } },
  street_bollard: { view: 'street_bollard', atlas: 'marseille_l01' },
  tree_pit: { view: 'tree_pit_frame', atlas: 'marseille_l01', flatTop: true },
  generator: { view: 'diesel_generator', atlas: 'marseille_l01' },
  generator_plinth: { view: 'generator_plinth', atlas: 'marseille_l01', box: true },
  switchgear: { view: 'switchgear_bank', atlas: 'marseille_l01' },
  booth_desk: { view: 'security_console_desk', atlas: 'marseille_l01' },
  booth_chair: { view: 'security_chair', atlas: 'marseille_l01' },
  parking_barrier: { view: 'concrete_parking_barrier', atlas: 'marseille_l01' },
  wheel_stop_gray: { view: 'gray_wheel_stop', atlas: 'marseille_l01', box: true },
  wheel_stop_yellow: { view: 'yellow_wheel_stop', atlas: 'marseille_l01', box: true },
  traffic_cone: { view: 'traffic_cone', atlas: 'marseille_l01' },
  parking_column: { view: 'parking_column', atlas: 'marseille_l01', box: true },
  drain_grate: { view: 'trench_drain_grate', atlas: 'marseille_l01', flatTop: true },
  storage_rack: { view: 'left_steel_storage_rack', atlas: 'marseille_l01' },
  cargo_rack: { view: 'right_open_cargo_rack', atlas: 'marseille_l01' },
  utility_cabinet: { view: 'stepped_utility_cabinet', atlas: 'marseille_l01' },
  equipment_crate: { view: 'large_gray_equipment_crate', atlas: 'marseille_l01', box: true },
  lidded_bin: { view: 'industrial_lidded_bin', atlas: 'marseille_l01' },
  case_light: { view: 'light_gray_equipment_trunk', atlas: 'marseille_l01', box: true },
  case_dark: { view: 'dark_hard_case', atlas: 'marseille_l01', box: true },
  case_gray: { view: 'gray_rack_case', atlas: 'marseille_l01', box: true },
  case_olive: { view: 'olive_rack_case', atlas: 'marseille_l01', box: true },
  storage_tote: { view: 'mustard_storage_tote', atlas: 'marseille_l01', box: true },
  pallet: { view: 'wood_shipping_pallet', atlas: 'marseille_l01', box: true },
  carton: { view: 'taped_shipping_carton', atlas: 'marseille_l01', box: true },
  cargo_box: { view: 'strapped_cargo_box', atlas: 'marseille_l01', box: true },
  equipment_stand: { view: 'small_equipment_stand', atlas: 'marseille_l01' },
  lift_doors: { view: 'elevator_door_unit', atlas: 'marseille_l01', wall: true, at: 34 },
  strip_light: { view: 'cool_strip_light', atlas: 'marseille_l01', wall: true, at: 70 },
  louver_tall: { view: 'stacked_wall_louver', atlas: 'marseille_l01', wall: true, at: 54 },
  louver_wide: { view: 'wide_wall_louver', atlas: 'marseille_l01', wall: true, at: 62 },
  alarm_panel: { view: 'generator_control_panel', atlas: 'marseille_l01', wall: true, at: 36 },
  service_panel: { view: 'rear_wall_service_panel', atlas: 'marseille_l01', wall: true, at: 38 },
  junction_large: { view: 'large_gray_junction_box', atlas: 'marseille_l01', wall: true, at: 44 },
  junction_small: { view: 'small_gray_junction_box', atlas: 'marseille_l01', wall: true, at: 44 },
  wall_case_yellow: { view: 'yellow_wall_case', atlas: 'marseille_l01', wall: true, at: 34 },
  safety_box_red: { view: 'red_safety_box', atlas: 'marseille_l01', wall: true, at: 40 },
  card_reader: { view: 'blue_card_reader', atlas: 'marseille_l01', wall: true, at: 36 },
};
