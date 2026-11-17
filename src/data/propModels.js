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
export const PROP_MODELS = {
  workstation: { view: 'workstation', top: 0.9 },
  terminal: { view: 'workstation', top: 0.9 },
  exec_desk: { view: 'executive_desk', top: 0.9 },
  chair: { view: 'mesh_chair', top: 0.8 },
  exec_chair: { view: 'executive_chair', top: 0.8 },
  chair_meeting: { view: 'cantilever_chair', top: 0.8 },
  conf_table: { view: 'conference_table', top: 1 },
  armchair: { view: 'lounge_armchair', top: 0.85 },
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
  plant: { view: ['broadleaf_planter', 'palm_planter', 'snake_planter'], top: 0.75 },
  planter: { view: 'long_planter', top: 0.8 },
  whiteboard: { view: 'mobile_whiteboard', top: 1 },
  coat_stand: { view: 'coat_stand', top: 0.9 },
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
};
