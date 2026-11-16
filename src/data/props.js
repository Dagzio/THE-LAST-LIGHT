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
  if (!t || t.flat || t.wall) return 0;
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
