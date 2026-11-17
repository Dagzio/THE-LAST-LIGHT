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
  reception: { w: 150, d: 40, h: 34, cover: 'low' },
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
  coat_stand: { w: 15, d: 15, h: 54, shape: 'circle', r: 4, bullet: false, sight: false },
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
  papers: { w: 40, d: 30, h: 1, flat: true },
  stairs: { w: 120, d: 70, h: 6, flat: true },
  notice_board: { w: 50, d: 3, h: 30, wall: true },
  tv_wall: { w: 80, d: 3, h: 40, wall: true },
  elevator: { w: 60, d: 3, h: 70, wall: true },
  extinguisher: { w: 8, d: 6, h: 18, wall: true },
  exit_sign: { w: 24, d: 3, h: 9, wall: true },
  wall_clock: { w: 14, d: 3, h: 14, wall: true },
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

/** Footprint box of a placed prop (rot = quarter turns) → [minX, minY, maxX, maxY]. */
export function propBox(p) {
  const T = PROP_TYPES[p.type];
  const turned = (p.rot | 0) % 2 === 1;
  const hw = (turned ? T.d : T.w) / 2, hd = (turned ? T.w : T.d) / 2;
  return [p.x - hw, p.y - hd, p.x + hw, p.y + hd];
}
