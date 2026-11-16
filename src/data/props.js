// KILL LIST (D78): furniture / equipment types of the office location. Footprint w × d (game units, before the
// prop's 90° turns), height h, and what it blocks (systems/Collision.js BLOCK bits: 1 move, 2 bullets, 4 sight).
// Low furniture stops walkers but bullets and looks pass over it; tall cabinets / racks / machines stop everything.
// 1 m ≈ 30 game units (a character is 56 tall). The 3D look is built in render3d/officeProps.js.
const M = 1, MB = 3, ALL = 7, NONE = 0;

export const PROP_TYPES = {
  desk: { w: 60, d: 30, h: 23, blocks: M },
  workstation: { w: 60, d: 30, h: 23, blocks: M },          // desk + monitors + PC + keyboard
  exec_desk: { w: 76, d: 36, h: 24, blocks: M },
  chair: { w: 18, d: 18, h: 32, blocks: NONE },             // office swivel chair
  chair_meeting: { w: 16, d: 16, h: 28, blocks: NONE },
  conf_table: { w: 200, d: 70, h: 23, blocks: M },
  armchair: { w: 30, d: 28, h: 25, blocks: M },
  sofa: { w: 76, d: 30, h: 25, blocks: M },
  coffee_table: { w: 32, d: 32, h: 14, blocks: M },
  round_table: { w: 36, d: 36, h: 23, blocks: M },
  reception: { w: 150, d: 40, h: 34, blocks: MB },
  filing_cabinet: { w: 20, d: 24, h: 42, blocks: ALL },
  archive_shelf: { w: 70, d: 18, h: 62, blocks: ALL },
  bookcase: { w: 50, d: 14, h: 56, blocks: ALL },
  printer: { w: 28, d: 24, h: 32, blocks: MB },
  server_rack: { w: 24, d: 30, h: 66, blocks: ALL },
  server_rack_open: { w: 24, d: 30, h: 66, blocks: ALL },
  console: { w: 120, d: 36, h: 24, blocks: M },             // security console with three monitors
  terminal: { w: 50, d: 28, h: 24, blocks: M },             // server room terminal desk (laptop)
  turnstile: { w: 10, d: 36, h: 30, blocks: M },
  coffee_counter: { w: 52, d: 24, h: 28, blocks: MB },
  kitchen_counter: { w: 100, d: 24, h: 28, blocks: MB },
  vending: { w: 32, d: 26, h: 60, blocks: ALL },
  fridge: { w: 26, d: 26, h: 60, blocks: ALL },
  water_cooler: { w: 14, d: 14, h: 38, blocks: M },
  boxes: { w: 34, d: 26, h: 22, blocks: M },
  boxes_tall: { w: 26, d: 26, h: 40, blocks: MB },
  trolley: { w: 30, d: 18, h: 26, blocks: M },
  plant: { w: 18, d: 18, h: 44, blocks: M },
  whiteboard: { w: 54, d: 10, h: 48, blocks: M },
  bin: { w: 10, d: 10, h: 14, blocks: NONE },
  // wall / floor decor (no collision)
  notice_board: { w: 50, d: 3, h: 30, blocks: NONE, wall: true },
  tv_wall: { w: 80, d: 3, h: 40, blocks: NONE, wall: true },
  elevator: { w: 60, d: 3, h: 70, blocks: NONE, wall: true },
  extinguisher: { w: 8, d: 6, h: 18, blocks: NONE, wall: true },
  exit_sign: { w: 24, d: 3, h: 9, blocks: NONE, wall: true },
  papers: { w: 40, d: 30, h: 1, blocks: NONE },
  overturned_chair: { w: 24, d: 18, h: 16, blocks: NONE },
  broken_monitor: { w: 26, d: 18, h: 8, blocks: NONE },
  stairs: { w: 120, d: 70, h: 6, blocks: NONE },
};

/** Footprint box of a placed prop (rot = quarter turns) → [minX, minY, maxX, maxY]. */
export function propBox(p) {
  const T = PROP_TYPES[p.type];
  const turned = (p.rot | 0) % 2 === 1;
  const hw = (turned ? T.d : T.w) / 2, hd = (turned ? T.w : T.d) / 2;
  return [p.x - hw, p.y - hd, p.x + hw, p.y + hd];
}
