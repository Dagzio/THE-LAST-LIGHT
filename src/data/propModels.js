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
// render3d/propViews.js lowPolyFaces; the training ground keeps its own atlas and the older `top` factor.
// D93: the side walls follow the top picture's outline (data/viewOutlines.js) — `box: true` keeps the plain box;
//   sprite — thin / leafy things: the front picture as one quad turned to the camera.
//   cross  — D111: open frames (chairs, potted plants): front + side pictures crossing in the middle, the top at `topAt`.
//   model  — D96: drawn from a baked picture of the user's 3D model (render3d/propModels3d.js) — only the training tree
//            now (D111: the office chairs, armchair and plants went back to the atlas, their models removed).
export const PROP_MODELS = {
  workstation: { view: 'workstation' },
  terminal: { view: 'workstation' },
  exec_desk: { view: 'executive_desk' },
  // D111 (user): the chairs from the atlases (their 3D models removed) — `cross`: the front and side pictures as two
  // crossing planes through the middle, the top picture at the seat (the measured surface); render3d/propViews.js
  chair: { view: 'mesh_chair', cross: true },
  exec_chair: { view: 'executive_chair', cross: true },
  chair_meeting: { view: 'cantilever_chair', cross: true },
  conf_table: { view: 'conference_table' },
  armchair: { view: 'lounge_armchair', surf: 1 }, // (a padded block, as the sofa)
  sofa: { view: 'sofa', surf: 1 }, // (its back rest is not something standing on a surface)
  coffee_table: { view: 'marble_coffee_table' },
  round_table: { view: 'round_meeting_table', drawH: 23 }, // D111: the table height of the other desks (cover)
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
  console: { view: 'security_console' },
  turnstile: { view: 'turnstile' },
  coffee_counter: { view: 'coffee_station', drawH: 46 }, // D111: wider than the catalogue station — its own height
  coffee_vending: { view: 'coffee_vending' },
  vending: { view: 'snack_vending' },
  water_cooler: { view: 'water_cooler', surf: 1 }, // D111: the bottle on the walls (as a cross it read as an X)
  // D111: the new catalogue has one box / one case — stacked to fill the footprint (nx, nz, layers)
  boxes: { view: 'closed_boxes', pack: [2, 2, 2] },
  boxes_tall: { view: 'flight_cases', pack: [1, 2, 5] },
  open_box: { view: 'open_box' },
  // D111 (user): the potted plants from the atlases (their 3D models removed) — a cross through the pot, the crown seen
  // from above laid in its middle
  plant: { view: ['broadleaf_planter', 'palm_planter', 'snake_planter'], cross: true, topAt: 0.72 },
  planter: { view: 'long_planter', box: true }, // D111: its top view is the leaves — the box keeps the planter's own shape
  whiteboard: { view: 'mobile_whiteboard' },
  coat_stand: { view: 'coat_stand', sprite: { lean: 1 } },
  steel_bin: { view: 'steel_bin' },
  recycling_bin: { view: 'recycling_bin' },
  desk_lamp: { view: 'desk_lamp' },
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
    // D103 (user: back on the ground, much less tilt — mostly from above, a bit of trunk, volume as the first one): baked
    // from 48° (the D99 volume look + the olive foliage), standing on its base (no lift), its own cast shadow
    // D104 (user: shadows in the foliage): rebaked with a real shadow map (upper clusters shade the lower) + the clusters'
    // local contrast (tools/bake-impostor.html look: selfShadow, hemi 0.9, sun 2.8, depth 0.9, sphere 0.2, olive tint 0.6)
    model: { file: 'tree_big', height: 150, baked: { file: 'tree_big.webp', frame: [-0.4816, 0.4816, -0.0666, 0.8943] } } },
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
