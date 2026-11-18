// D85 (user request): the office furniture from the user's 5-view sheets (NEW/Office/office sprites, packed by
// tools/build-prop-views.py → data/propViews.js). Presentation only: the collision footprint / height of every prop
// stays in data/props.js.
//
// Each standing prop is a "view box" (render3d/propViews.js): its footprint w × d from data/props.js, its height from
// the front view's proportions; the top view lies on top, the front / back / left / right views stand on its sides
// (cut out by their transparency), so the prop can face any way and casts its real silhouette as a shadow.
//   view  — catalogue object id (or a list: one picked per prop, stable by position);
//   top   — the top picture's height as a part of the box height (the top view shows everything from above: drawn a
//           little lower it sits on the main surface rather than on the highest point);
//   wall  — hangs on a wall: only the front picture, centred at height `at` (units).
// D93: the side walls follow the top picture's outline (data/viewOutlines.js) — `box: true` keeps the plain box;
//   sprite — thin / leafy things: the front picture as one quad turned to the camera.
export const PROP_MODELS = {
  workstation: { view: 'workstation', top: 0.9 },
  terminal: { view: 'workstation', top: 0.9 },
  exec_desk: { view: 'executive_desk', top: 0.9 },
  // D99 (user models): the desk chairs — the wheeled office chair (as the executive one)
  chair: { view: 'mesh_chair', top: 0.8, model: { file: 'exec_chair.glb', height: 32, impostor: true, turns: true, bakeH: 256, vary: false, look: { hemi: 2.8, gain: 1.65 } } },
  // D96 (user models, assets/models/props): `model` — drawn from the 3D model (render3d/propModels3d.js); the view is the
  // fallback while it loads. height — units; impostor — a camera-facing picture rendered from the model; fill — extra
  // copies [turn rad, scale] rendered into it (a denser crown)
  // D99: a 4-turn impostor (50 chairs × 2–7.5 k triangles would break the budget); brighter (user: too dark)
  exec_chair: { view: 'executive_chair', top: 0.8, model: { file: 'exec_chair.glb', height: 34, impostor: true, turns: true, bakeH: 256, vary: false, look: { hemi: 2.8, gain: 1.65 } } },
  chair_meeting: { view: 'cantilever_chair', top: 0.8, model: { file: 'meeting_chair.glb', height: 29, impostor: true, turns: true, bakeH: 256, vary: false, look: { gain: 1.1 } } },
  conf_table: { view: 'conference_table', top: 1 },
  armchair: { view: 'lounge_armchair', top: 0.85, model: { file: 'armchair.glb', height: 26, impostor: true, turns: true, bakeH: 256, vary: false, look: { hemi: 2.6, gain: 1.4 } } },
  sofa: { view: 'sofa', top: 0.85 },
  coffee_table: { view: 'marble_coffee_table', top: 1 },
  round_table: { view: 'round_meeting_table', top: 1 },
  reception: { view: 'reception', top: 0.95 },
  filing_cabinet: { view: 'filing_cabinet', top: 1 },
  archive_shelf: { view: 'archive_shelf', top: 1 },
  bookcase: { view: 'bookcase', top: 1 },
  glass_cabinet: { view: 'glass_cabinet', top: 1 },
  low_cabinet: { view: 'low_cabinet', top: 1 },
  locker: { view: 'locker', top: 1 },
  printer: { view: 'copier', top: 1 },
  shredder: { view: 'shredder', top: 1 },
  server_rack: { view: 'server_rack', top: 1 },
  server_rack_open: { view: 'network_rack', top: 1 },
  console: { view: 'security_console', top: 0.85 },
  turnstile: { view: 'turnstile', top: 1 },
  coffee_counter: { view: 'coffee_station', top: 0.9 },
  coffee_vending: { view: 'coffee_vending', top: 1 },
  vending: { view: 'snack_vending', top: 1 },
  water_cooler: { view: 'water_cooler', top: 1 },
  boxes: { view: 'closed_boxes', top: 1 },
  boxes_tall: { view: 'flight_cases', top: 1 },
  open_box: { view: 'open_box', top: 1 },
  // D93: thin / leafy things — one picture turned to the camera (the outline walls suit solid furniture)
  plant: { view: ['broadleaf_planter', 'palm_planter', 'snake_planter'], top: 0.75, sprite: { lean: 1 },
    model: { file: ['plant_broadleaf.glb', 'plant_palm.glb', 'plant_snake.glb', 'plant_dracaena.glb'], height: 42, impostor: true } },
  planter: { view: 'long_planter', top: 0.8 },
  whiteboard: { view: 'mobile_whiteboard', top: 1 },
  coat_stand: { view: 'coat_stand', top: 0.9, sprite: { lean: 1 } },
  steel_bin: { view: 'steel_bin', top: 1 },
  recycling_bin: { view: 'recycling_bin', top: 1 },
  desk_lamp: { view: 'desk_lamp', top: 0.8 },
  // on the walls
  wall_light: { view: 'wall_light', wall: true, at: 66 },
  notice_board: { view: 'cork_board', wall: true, at: 40 },
  tv_wall: { view: 'wall_display', wall: true, at: 42 },
  wall_clock: { view: 'clock', wall: true, at: 58 },
  extinguisher: { view: 'extinguisher_cabinet', wall: true, at: 30 },
  fire_hose: { view: 'fire_hose_cabinet', wall: true, at: 34 },
  electrical: { view: 'electrical_cabinet', wall: true, at: 40 },
  first_aid: { view: 'first_aid', wall: true, at: 40 },
  air_conditioner: { view: 'air_conditioner', wall: true, at: 68 },
  security_camera: { view: 'security_camera', wall: true, at: 70 },
  // D88: the training ground — the user's sheets in their own atlas (data/trainingViews.js)
  // D90: foliage — one picture turned to the camera (render3d/propViews.js `sprite`), not a box of views
  // D99 (user): the user's second, detailed tree (60 MB, 2 M triangles) — its picture baked OFFLINE from the model
  // (tools/bake-impostor.html: 785 × 768 webp, 79 KB) — the game never loads the model
  tree: { view: 'deciduous_tree', top: 1, atlas: 'training', drawW: 120, drawD: 120, sprite: { lean: 1 },
    // D100 (user: the trees looked like huge bushes): baked from 62° off the vertical (tools/bake-impostor.html tilt=62)
    // — the trunk and the height show; drawn 170 high
    model: { file: 'tree_big', height: 170, lift: 75, baked: { file: 'tree_big.webp', frame: [-0.4816, 0.4816, -0.0526, 0.9566] } } },
  boulder: { view: 'boulder', top: 1, atlas: 'training' },
  bush: { view: 'leafy_bush', top: 0.9, atlas: 'training', sprite: { lean: 1 } },
  grass_tuft: { view: 'grass_tuft', top: 0.8, atlas: 'training', sprite: { lean: 1 } },
  flowers: { view: 'wildflower_clump', top: 0.8, atlas: 'training', sprite: { lean: 1 } },
  canopy: { view: 'camouflage_canopy', top: 1, atlas: 'training' },
  tent: { view: 'field_tent', top: 1, atlas: 'training' },
  fabric_screen: { view: 'fabric_screen', top: 1, atlas: 'training' },
  signal_amber: { view: 'signal_post_amber', top: 1, atlas: 'training' },
  signal_green: { view: 'signal_post_green', top: 1, atlas: 'training' },
  blue_hurdle: { view: 'blue_hurdle', top: 1, atlas: 'training' },
  blue_mat: { view: 'blue_mat', top: 1, atlas: 'training', flatTop: true },
  concrete_cover: { view: 'concrete_cover', top: 1, atlas: 'training' },
  jersey_barrier: { view: 'jersey_barrier', top: 1, atlas: 'training' },
  round_target: { view: 'round_target', top: 1, atlas: 'training' },
  torso_target: { view: 'torso_target', top: 1, atlas: 'training' },
  sandbags: { view: 'sandbag_wall', top: 1, atlas: 'training' },
  steel_cover: { view: 'steel_cover', top: 1, atlas: 'training' },
  ammo_box: { view: 'ammo_box', top: 1, atlas: 'training' },
  barrel: { view: 'blue_barrel', top: 1, atlas: 'training' },
  equipment_case: { view: 'equipment_case', top: 1, atlas: 'training' },
  supply_chest: { view: 'supply_chest_closed', top: 1, atlas: 'training' },
  supply_chest_open: { view: 'supply_chest_open', top: 1, atlas: 'training' },
  weapon_chest: { view: 'weapon_chest_closed', top: 1, atlas: 'training' },
  weapon_chest_open: { view: 'weapon_chest_open', top: 1, atlas: 'training' },
  crate_wood: { view: 'wood_storage_crate', top: 1, atlas: 'training' },
  crate_wood_tall: { view: 'wood_storage_crate', top: 1, atlas: 'training' },
  workbench: { view: 'wood_workbench', top: 0.9, atlas: 'training' },
  medical_case: { view: 'medical_case', top: 1, atlas: 'training' },
  small_medkit: { view: 'small_medkit', top: 1, atlas: 'training' },
  mesh_fence: { view: 'mesh_fence', top: 1, atlas: 'training' },
  mesh_gate_closed: { view: 'mesh_gate_closed', top: 1, atlas: 'training' },
  mesh_gate_open: { view: 'mesh_gate_open', top: 1, atlas: 'training' },
};
