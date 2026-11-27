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
