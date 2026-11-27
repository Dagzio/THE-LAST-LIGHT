// D145 (user: level 1's new entrance — the reference NEW/references/Location1/L01-parking.png, the user's Marseille
// atlases NEW/marseille/L01-parking): the business centre's underground parking, south of the office floor (a level
// below — drawn beside it), mirrored from the reference so its stair core comes up under the archive. The hero comes
// down the ramp from the street, crosses the parking past the security booth and takes the service stairs up into the
// archive. Data only (world units, 1 m ≈ 30; x → east, y → south), merged into data/levels/office.js.
// Rooms (no overlaps — core/LevelWorld.js routes between them): sidewalk / street (outdoors), ramp, the hall (parking,
// parking_ne, parking_e, parking_w, parking_s), the glass security booth, the electrical room, the service stairs.

const W = (x0, y0, x1, y1, style, gaps = []) => ({ x0, y0, x1, y1, style, gaps });

export const PARKING = {
  zones: [
    { id: 'sidewalk', rect: [1960, 1710, 2360, 1790], floor: 'sidewalk', light: 'dark', wallLights: false },
    { id: 'street', rect: [1960, 1790, 2360, 1990], floor: 'road', light: 'dark', wallLights: false },
    { id: 'ramp', rect: [1960, 1990, 2140, 2420], floor: 'ramp', light: 'dim', wallLights: false },
    { id: 'service_stairs', rect: [250, 1700, 560, 2230], floor: 'concrete', light: 'dim', wallLights: false },
    { id: 'parking', rect: [560, 1990, 1760, 2620], floor: 'parking', light: 'cool', wallLights: false },
    { id: 'booth', rect: [1760, 1990, 1960, 2170], floor: 'parking', light: 'dark', wallLights: false },
    { id: 'parking_ne', rect: [1760, 2170, 1960, 2620], floor: 'parking', light: 'cool', wallLights: false },
    { id: 'parking_e', rect: [1960, 2420, 2140, 2620], floor: 'parking', light: 'cool', wallLights: false },
    { id: 'parking_w', rect: [250, 2230, 560, 2620], floor: 'parking', light: 'cool', wallLights: false },
    { id: 'parking_s', rect: [250, 2620, 1560, 2860], floor: 'parking', light: 'cool', wallLights: false },
    { id: 'electrical', rect: [1560, 2620, 2140, 2860], floor: 'epoxy', light: 'dark', wallLights: false },
  ],

  walls: [
    // the street: the building's corner on its west, a site fence on its east and north beyond the office
    W(1960, 1700, 1960, 1990, 'cladding'),
    W(2150, 1700, 2360, 1700, 'fence'),
    W(2360, 1700, 2360, 1990, 'fence'),
    W(2140, 1990, 2360, 1990, 'cladding'),
    // the parking's outer walls (dark cladding)
    W(560, 1990, 1960, 1990, 'cladding'),
    W(250, 1700, 250, 2860, 'cladding'),
    W(250, 2860, 2140, 2860, 'cladding'),
    W(2140, 1990, 2140, 2860, 'cladding'),
    // the ramp's west side (cast concrete) — it opens into the hall at its foot
    W(1960, 1990, 1960, 2420, 'formwork'),
    // the service stairs' core
    W(560, 1700, 560, 2230, 'formwork'),
    W(250, 2230, 560, 2230, 'formwork', [[400, 480]]),
    // the glass security booth by the ramp's foot
    W(1760, 1990, 1760, 2170, 'glass'),
    W(1760, 2170, 1960, 2170, 'glass', [[1810, 1890]]),
    // the electrical room
    W(1560, 2620, 2140, 2620, 'formwork', [[1640, 1720]]),
    W(1560, 2620, 1560, 2860, 'formwork'),
  ],

  doors: [
    { id: 'svc_archive', x: 410, y: 1700, axis: 'x', width: 80, kind: 'metal', zones: ['archive', 'service_stairs'] },
    { id: 'svc_parking', x: 440, y: 2230, axis: 'x', width: 80, kind: 'metal', zones: ['service_stairs', 'parking_w'] },
    { id: 'booth', x: 1850, y: 2170, axis: 'x', width: 80, kind: 'glass', zones: ['booth', 'parking_ne'] },
    { id: 'electrical', x: 1680, y: 2620, axis: 'x', width: 80, kind: 'metal', zones: ['parking', 'electrical'] },
  ],
  openings: [
    { x: 2160, y: 1790, zones: ['sidewalk', 'street'] },
    { x: 2050, y: 1990, zones: ['street', 'ramp'] },
    { x: 2050, y: 2420, zones: ['ramp', 'parking_e'] },
    { x: 1960, y: 2520, zones: ['parking_ne', 'parking_e'] },
    { x: 1760, y: 2400, zones: ['parking', 'parking_ne'] },
    { x: 560, y: 2420, zones: ['parking', 'parking_w'] },
    { x: 1060, y: 2620, zones: ['parking', 'parking_s'] },
    { x: 405, y: 2620, zones: ['parking_w', 'parking_s'] },
  ],

  props: [
    // --- the street: a lantern, a tree in its pit, bollards along the kerb
    { type: 'street_lantern', x: 2318, y: 1736 },
    { type: 'tree_pit', x: 2040, y: 1748 }, { type: 'street_tree', x: 2040, y: 1748 },
    ...[2150, 2210, 2270, 2330].map((x) => ({ type: 'street_bollard', x, y: 1786 })),
    // --- the ramp: cones at its foot
    { type: 'traffic_cone', x: 1990, y: 2400 }, { type: 'traffic_cone', x: 2110, y: 2400 },
    // --- the north row: cars nose to the wall between the columns, wheel stops, an empty bay or two
    ...[700, 1000, 1300, 1600].map((x) => ({ type: 'parking_column', x, y: 2075 })),
    { type: 'car_sedan_dark', x: 800, y: 2075, rot: 2 }, { type: 'wheel_stop_yellow', x: 800, y: 2012 },
    { type: 'wheel_stop_yellow', x: 900, y: 2012 },
    { type: 'car_hatch', x: 1100, y: 2084, rot: 2 }, { type: 'wheel_stop_gray', x: 1100, y: 2012 },
    { type: 'car_wagon', x: 1200, y: 2073, rot: 0 }, { type: 'wheel_stop_gray', x: 1200, y: 2012 },
    { type: 'wheel_stop_yellow', x: 1400, y: 2012 },
    { type: 'car_sedan_silver', x: 1500, y: 2073, rot: 2 }, { type: 'wheel_stop_yellow', x: 1500, y: 2012 },
    // --- the middle island: three cars driven in from the north aisle, concrete blocks behind them, columns
    ...[700, 1000, 1300].map((x) => ({ type: 'parking_column', x, y: 2540 })),
    { type: 'car_compact', x: 820, y: 2470, rot: 0 }, { type: 'parking_barrier', x: 820, y: 2566 },
    { type: 'car_sedan_black', x: 1120, y: 2465, rot: 0 }, { type: 'parking_barrier', x: 1120, y: 2566 },
    { type: 'parking_barrier', x: 1420, y: 2566 },
    { type: 'traffic_cone', x: 1405, y: 2470 }, { type: 'traffic_cone', x: 1440, y: 2484 },
    // --- the west bay: the white van, cases by the wall
    { type: 'van', x: 350, y: 2440, rot: 2 }, { type: 'wheel_stop_gray', x: 350, y: 2350 },
    { type: 'case_light', x: 520, y: 2575 }, { type: 'case_dark', x: 500, y: 2600 }, { type: 'storage_tote', x: 535, y: 2602 },
    // --- the south side: racks on the west wall, a utility cabinet, pallets and boxes on the south wall
    { type: 'storage_rack', x: 272, y: 2680, rot: 3 }, { type: 'cargo_rack', x: 274, y: 2740, rot: 3 },
    { type: 'case_gray', x: 285, y: 2800 }, { type: 'case_olive', x: 290, y: 2828 }, { type: 'case_dark', x: 312, y: 2832 },
    { type: 'utility_cabinet', x: 560, y: 2835, rot: 2 },
    { type: 'pallet', x: 760, y: 2832, rot: 2 },
    { type: 'carton', x: 751, y: 2830, elev: 4 }, { type: 'carton', x: 769, y: 2830, elev: 4 }, { type: 'carton', x: 760, y: 2830, elev: 17 },
    { type: 'cargo_box', x: 860, y: 2834 }, { type: 'cargo_box', x: 878, y: 2834 }, { type: 'cargo_box', x: 869, y: 2834, elev: 13 },
    { type: 'equipment_crate', x: 950, y: 2836 }, { type: 'lidded_bin', x: 1010, y: 2838 },
    { type: 'equipment_stand', x: 1240, y: 2836 },
    { type: 'drain_grate', x: 1060, y: 2340 }, { type: 'drain_grate', x: 1360, y: 2340 },
    { type: 'drain_grate', x: 900, y: 2700 },
    // --- the security booth: a desk with its monitors towards the hall, the guard's chair
    { type: 'booth_desk', x: 1860, y: 2026, rot: 0 },
    // --- the electrical room: the generator on its plinth, the switchgear, the alarm panel (D145: the next step's
    // "panel" — the alarm is cut off here), junction boxes
    { type: 'generator_plinth', x: 1900, y: 2800, rot: 2 }, { type: 'generator', x: 1900, y: 2800, rot: 2, elev: 8 },
    { type: 'switchgear', x: 1582, y: 2760, rot: 3 },
    { type: 'alarm_panel', x: 1790, y: 2633, rot: 0 },
    { type: 'junction_large', x: 1990, y: 2633, rot: 0 }, { type: 'junction_small', x: 2030, y: 2633, rot: 0 },
    { type: 'safety_box_red', x: 2126.5, y: 2700, rot: 1 },
    // --- the service stairs: two flights up to the archive
    { type: 'stairs', x: 335, y: 1900, rot: 1 }, { type: 'stairs', x: 475, y: 1900, rot: 1 },
    { type: 'stair_rail', x: 405, y: 1900, rot: 1 },
    // --- on the walls: cold strip lights, louvers, the lift (out of service) by the stair door, card readers
    ...[850, 1150, 1450].map((x) => ({ type: 'strip_light', x, y: 2002.5, rot: 0 })),
    ...[700, 1100].map((x) => ({ type: 'strip_light', x, y: 2847.5, rot: 2 })),
    { type: 'strip_light', x: 262.5, y: 2520, rot: 3 }, { type: 'strip_light', x: 2127.5, y: 2520, rot: 1 },
    { type: 'strip_light', x: 1880, y: 2847.5, rot: 2 },
    { type: 'louver_tall', x: 640, y: 2001.5, rot: 0 }, { type: 'louver_wide', x: 1650, y: 2001.5, rot: 0 },
    { type: 'lift_doors', x: 320, y: 2243, rot: 0 }, { type: 'card_reader', x: 372, y: 2241.5, rot: 0 },
    { type: 'card_reader', x: 1630, y: 2608.5, rot: 2 },
    { type: 'wall_case_yellow', x: 262.5, y: 2300, rot: 3 }, { type: 'service_panel', x: 1450, y: 2848.5, rot: 2 },
  ],

  // painted lines of the bays, hazard stripes at the ramp's foot, oil and dirt
  decals: [
    ...[750, 850, 950, 1050, 1150, 1250, 1350, 1450, 1550].map((x) => ({ t: 'marking', x, y: 2075, w: 150, d: 6, r: Math.PI / 2 })),
    ...[770, 870, 1070, 1170, 1370, 1470].map((x) => ({ t: 'marking', x, y: 2470, w: 150, d: 6, r: Math.PI / 2 })),
    { t: 'marking', x: 1120, y: 2160, w: 980, d: 6 },
    { t: 'hazard', x: 2050, y: 2412, w: 170, d: 26 }, { t: 'hazard', x: 440, y: 2245, w: 90, d: 22 },
    { t: 'hazard', x: 1680, y: 2607, w: 90, d: 22 },
    // (no 'dirt' here: on the light concrete it read as smoke)
    { t: 'scuff', x: 1400, y: 2250, w: 120 }, { t: 'scuff', x: 700, y: 2720, w: 110, r: 0.8 },
    { t: 'coffee', x: 900, y: 2110, w: 46 }, { t: 'coffee', x: 1180, y: 2500, w: 40, r: 1.2 },
  ],
  lights: [
    { x: 1900, y: 2760, kind: 'dim', sx: 1.6, sz: 1.2 }, // the electrical room's one lamp
    { x: 2050, y: 2200, kind: 'dim', sx: 0.8, sz: 1.8 },  // the ramp
  ],

  // the night shift in the parking (Ardent's guards, as upstairs)
  enemies: [
    // (posts kept off the doors — a door opens for anyone standing near it)
    { type: 'thug', x: 1866, y: 2072, angle: -Math.PI / 2, busy: true },                                                      // in the booth, at the monitors (his back to the door)
    { type: 'gunman', x: 700, y: 2290, angle: 0, patrol: [[700, 2290, 2, Math.PI / 2], [1650, 2290, 2, Math.PI / 2]] },     // the north aisle
    { type: 'thug', x: 420, y: 2700, angle: 0, patrol: [[420, 2700, 2.5, Math.PI / 2], [1400, 2700, 2.5, -Math.PI / 2]] },   // the south aisle
    { type: 'thug', x: 520, y: 2340, angle: 0, patrol: [[520, 2340, 3, Math.PI / 2], [700, 2350, 2, 0]] },                 // near the stair door
    { type: 'gunman', x: 1560, y: 2540, angle: Math.PI, patrol: [[1560, 2540, 3, Math.PI], [1560, 2400, 2, -Math.PI / 2]] }, // by the electrical room
  ],
};
