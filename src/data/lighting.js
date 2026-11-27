// D83 (user request: "the lighting as in the level reference — a night office lit by its lamps"): baked lights of the
// office. No real-time lights are added (weak phones): every light is drawn as a soft additive pool on the floor (one
// mesh for the level) and tints the furniture sprites near it (vertex colours of the sprite cards). The key light of
// the renderer still casts the shadows; the hemisphere fill is dimmed for the night.
// Where the lights are: the rooms' ceiling lights (data: zone.light — the room's mood), lights that come with props
// (screens, lamps, the reception's LED strip, vending machines, server racks) and the level's own list (alarms).
/** Light kinds: colour, pool radius (units), power (pool brightness / sprite lift), stretch of the pool (x, z). */
export const LIGHT_KINDS = {
  ceiling: { color: [1.0, 0.88, 0.7], radius: 160, power: 0.48 },
  cool: { color: [0.8, 0.9, 1.0], radius: 160, power: 0.42 },
  dim: { color: [1.0, 0.84, 0.62], radius: 140, power: 0.3 },
  lamp: { color: [1.0, 0.64, 0.3], radius: 105, power: 1.0 },
  desk: { color: [1.0, 0.72, 0.42], radius: 50, power: 0.85 },
  screen: { color: [0.42, 0.68, 1.0], radius: 54, power: 0.6 },
  vend: { color: [0.75, 0.9, 1.0], radius: 52, power: 0.62 },
  rack: { color: [0.3, 0.75, 1.0], radius: 34, power: 0.42 },
  red: { color: [1.0, 0.18, 0.12], radius: 105, power: 0.75 },
  led: { color: [1.0, 0.72, 0.42], radius: 48, power: 0.9 },
  wall: { color: [1.0, 0.92, 0.8], radius: 80, power: 0.4 },
  // D148 (Marseille 2–3): the bars' neon over the alleys, the terminal's floodlights
  neonPink: { color: [1.0, 0.3, 0.72], radius: 90, power: 0.55 },
  neonCyan: { color: [0.3, 0.88, 1.0], radius: 90, power: 0.55 },
  flood: { color: [0.92, 0.95, 1.0], radius: 260, power: 0.5 },
};

/** Room moods (zone.light): which ceiling light kind, how dense the grid (units between lights). */
const MOODS = {
  warm: { kind: 'ceiling', step: 230 },
  cool: { kind: 'cool', step: 260 },
  dim: { kind: 'dim', step: 300 },
  dark: { kind: 'dim', step: 0 },     // no ceiling lights: lit by its own lamps / screens only
  day: { kind: 'dim', step: 0 },      // D88: outdoors in daylight (the training ground): no pools, lit everywhere
};

/** Lights that come with a prop: [kind, forward offset (towards its front), sideways, stretch x, stretch z]. */
const PROP_LIGHTS = {
  workstation: [['screen', 6, 0, 1.3, 0.9]],
  terminal: [['screen', 4, 0, 1.2, 0.9]],
  console: [['screen', 10, 0, 2.6, 1.0]],
  reception: [['led', 26, 0, 3.4, 0.55]],
  vending: [['vend', 18, 0, 1.0, 1.0]],
  coffee_counter: [['desk', 14, 0, 1.4, 1.0]],
  server_rack: [['rack', 16, 0, 1, 1]],
  server_rack_open: [['rack', 16, 0, 1, 1]],
  floor_lamp: [['lamp', 0, 0, 1, 1]],
  desk_lamp: [['desk', 0, 0, 1, 1]],
  wall_light: [['wall', 14, 0, 1.6, 0.8]],
  alarm_light: [['red', 10, 0, 1, 1]],
  tv_wall: [['screen', 18, 0, 2.2, 0.8]],
  // D145: the parking (Marseille, level 1): cold strip lights on its walls, the booth's monitors, the street lantern
  strip_light: [['cool', 26, 0, 1.7, 0.9]],
  booth_desk: [['screen', 10, 0, 2.0, 1.0]],
  street_lantern: [['lamp', 0, 0, 1.5, 1.5]],
  // D148: Marseille levels 2–3
  mf_lamp: [['lamp', 0, 0, 1, 1]], mf_lamp_small: [['desk', 0, 0, 1.2, 1.2]], mf_sconce: [['wall', 14, 0, 1.4, 0.9]],
  mf_entry_lantern: [['lamp', 16, 0, 1.5, 1.5]], mf_roof_lantern: [['lamp', 12, 0, 1.2, 1.2]], mf_alley_lantern: [['lamp', 14, 0, 1.3, 1.3]],
  mf_neon_pink: [['neonPink', 12, 0, 1.6, 0.9]], mf_neon_cyan: [['neonCyan', 12, 0, 1.6, 0.9]],
  mt_jetty_lantern: [['lamp', 0, 0, 1.4, 1.4]], mt_fence_lantern: [['lamp', 12, 0, 1.2, 1.2]], mt_gooseneck: [['lamp', 18, 0, 1.4, 1.4]],
  mt_caged_lantern: [['lamp', 12, 0, 1.2, 1.2]], mt_work_light: [['cool', 18, 0, 1.2, 1.0]],
  mt_monitor_blue: [['screen', 6, 0, 1, 1]], mt_monitor_cyan: [['screen', 6, 0, 1, 1]], mt_mast: [['flood', 0, 0, 1, 1]],
};

/**
 * Every light of a level: { x, z, kind, sx, sz } (sx / sz — the pool's stretch).
 * @param {object} level data/levels/*.js
 */
export function levelLights(level) {
  const out = [];
  for (const z of level.zones) {
    const mood = MOODS[z.light || 'warm'] || MOODS.warm;
    if (!mood.step) continue;
    const [x0, y0, x1, y1] = z.rect;
    const nx = Math.max(1, Math.round((x1 - x0) / mood.step)), ny = Math.max(1, Math.round((y1 - y0) / mood.step));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      out.push({ x: x0 + ((i + 0.5) * (x1 - x0)) / nx, z: y0 + ((j + 0.5) * (y1 - y0)) / ny, kind: mood.kind, sx: 1, sz: 1 });
    }
  }
  for (const p of level.props) {
    const list = PROP_LIGHTS[p.type];
    if (!list || p.lit === false) continue;
    const rot = (p.rot | 0) & 3;
    const fx = [0, -1, 0, 1][rot], fz = [1, 0, -1, 0][rot]; // the prop's front: south at 0, west at 1, north at 2, east at 3
    for (const [kind, f, s, sx, sz] of list) {
      const turned = rot % 2 === 1;
      out.push({ x: p.x + fx * f - fz * s, z: p.y + fz * f + fx * s, kind, sx: turned ? sz : sx, sz: turned ? sx : sz });
    }
  }
  for (const l of level.lights || []) out.push({ x: l.x, z: l.y, kind: l.kind, sx: l.sx || 1, sz: l.sz || 1 });
  return out.filter((l) => LIGHT_KINDS[l.kind]);
}

/** The light reaching a floor point (x, z) → out [r, g, b] (0 = only the night ambient). */
export function lightAt(lights, x, z, out = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (const l of lights) {
    const K = LIGHT_KINDS[l.kind], R = K.radius;
    const dx = (x - l.x) / (R * l.sx), dz = (z - l.z) / (R * l.sz), t = dx * dx + dz * dz;
    if (t >= 1) continue;
    const f = (1 - t) * (1 - t) * K.power;
    out[0] += K.color[0] * f; out[1] += K.color[1] * f; out[2] += K.color[2] * f;
  }
  return out;
}
