// Office furniture as the user's painted sprites (D81, NEW/Office/office sprites → data/propAtlas.js). Presentation
// data only: the collision footprint / height of every prop stays in data/props.js.
//
// A sprite is drawn on a "card" inside the prop's footprint: its bottom edge on the floor along the footprint's south
// (camera-near) edge, its top above the north edge, leaning so the art keeps its proportions on screen. The card is
// sorted with the 3D scene, so people walk behind / in front of furniture correctly and walls never cut it.
//   sprite  — atlas name;  width — the art's width in game units;
//   squash  — on-screen height of the art vs its drawn proportions (the art is painted from a lower angle than the
//             game camera: tall fronts are lowered so the screen height ≈ the real object's — the shelves of the
//             archive do not hide the people in the aisle);
//   front / back — the card reaches this far beyond the footprint (art that also shows the chairs around a table);
//   iso     — 3/4 art facing down-left: mirrored for props turned east (rot 3) or north (rot 2);
//   flat    — lies on the floor (papers);  wall — hangs flat on the wall face (a notice board).
export const PROP_SPRITES = {
  workstation: { sprite: 'workstation', width: 64, squash: 0.8, iso: true },
  terminal: { sprite: 'workstation', width: 54, squash: 0.8, iso: true },
  exec_desk: { sprite: 'work_desk', width: 80, squash: 0.75, iso: true },
  chair: { sprite: 'swivel_chair', width: 22, squash: 0.85, iso: true },
  chair_meeting: { sprite: 'meeting_chair', width: 18, squash: 1, iso: true },
  conf_table: { sprite: 'conference_table', width: 262, squash: 0.85, front: 23, back: 23 },
  armchair: { sprite: 'lounge_armchair', width: 34, squash: 1, iso: true },
  round_table: { sprite: 'round_table', width: 40, squash: 1 },
  coffee_table: { sprite: 'round_table', width: 34, squash: 1 },
  reception: { sprite: 'reception', width: 160, squash: 0.65, back: 20, iso: true },
  filing_cabinet: { sprite: 'filing_cabinet', width: 20, squash: 0.8 },
  archive_shelf: { sprite: 'archive_shelf', width: 72, squash: 0.6 },
  bookcase: { sprite: 'bookcase', width: 52, squash: 0.6 },
  printer: { sprite: 'printer', width: 30, squash: 1 },
  server_rack: { sprite: 'rack_closed', width: 26, squash: 0.95 },
  server_rack_open: { sprite: 'rack_open', width: 26, squash: 0.95 },
  console: { sprite: 'console', width: 128, squash: 0.9, front: 32 },
  turnstile: { sprite: 'turnstile_post', width: 14, squash: 0.85 },
  coffee_counter: { sprite: 'coffee_machine', width: 54, squash: 0.6 },
  vending: { sprite: 'vending', width: 34, squash: 0.95 },
  boxes: { sprite: 'boxes_pair', width: 36, squash: 1 },
  boxes_tall: { sprite: 'boxes_stack', width: 30, squash: 1 },
  trolley: { sprite: 'trolley', width: 32, squash: 0.75 },
  plant: { sprite: 'plant', width: 24, squash: 0.85 },
  whiteboard: { sprite: 'notice_board', width: 54, squash: 0.9 },
  overturned_chair: { sprite: 'overturned_chair', width: 28, squash: 0.75, iso: true },
  broken_monitor: { sprite: 'damaged_monitor', width: 28, squash: 0.7, iso: true },
  papers: { sprite: 'papers', width: 22, flat: true }, // D112 / D114 (user): −25 %, then −30 %
  notice_board: { sprite: 'notice_board', width: 50, wall: true },
};
