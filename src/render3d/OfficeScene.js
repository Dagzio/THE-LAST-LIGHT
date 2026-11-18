// KILL LIST (D78): the office location in 3D, built from level data (data/levels/office.js): floors per room with the
// user's seamless textures (NEW/Office/textures → assets/textures/office), walls per style with a dark top cap (reads
// like a floor plan from the top-down camera), glass partitions, sliding doors (one instanced mesh per door kind),
// furniture / equipment (render3d/officeProps.js) merged into one mesh per material, and soft light pools on the
// floors. Presentation only: update() reads the doors' open state; nothing here touches the simulation.
import * as THREE from '../../lib/three.module.js';
import { PropBuilder, buildProp } from './officeProps.js';
import { paintOfficeAtlas } from './officeAtlas.js';
import { cpuCanvas } from './render-guard.js';
import { PROP_TYPES, propBox } from '../data/props.js';
import { TILE, tileUV } from './officeAtlas.js';
import { buildPropCards, hasSprite, propAtlasTexture, preloadPropAtlas } from './propSprites.js';
import { levelLights, LIGHT_KINDS } from './officeLights.js';
import { buildPropViews, hasView, propViewTexture, preloadPropViews, VIEW_ATLASES } from './propViews.js';
import { buildPropModels } from './propModels3d.js';

const POOL_GAIN = 0.9;    // D83: floor pool brightness per unit of light power
// D83: floor decal kinds → atlas tiles (render3d/officeAtlas.js)
const DECAL_TILES = { blood: TILE.blood, bloodSmear: TILE.bloodSmear, coffee: TILE.coffee, scuff: TILE.scuff, hazard: TILE.hazard, marking: TILE.marking, prints: TILE.prints, dirt: TILE.dirt };


const TEX_DIR = 'assets/textures/office/';
// floor / wall material → texture file + tile size (world units per repeat)
const FLOORS = {
  marble: ['marble', 115], carpet: ['carpet', 110], tile_light: ['tile_light', 90], tile_dark: ['tile_dark', 90],
  oak: ['oak', 110], walnut: ['walnut', 110], concrete: ['concrete', 160], epoxy: ['epoxy', 160], access: ['access', 80],
  // D88: the training ground (the user's ground atlas, one texture per material, mirrored repeat)
  grass: ['training/summer_grass.webp', 150], grass_worn: ['training/trampled_grass.webp', 150],
  grass_soil: ['training/grass_soil.webp', 150], dirt: ['training/packed_dirt.webp', 150], sand: ['training/dry_sand.webp', 150],
  gravel: ['training/fine_gravel.webp', 120], yard_concrete: ['training/worn_concrete.webp', 160],
  pavers: ['training/concrete_pavers.webp', 130], rubber: ['training/rubber_tiles.webp', 110],
  asphalt: ['training/dark_asphalt.webp', 160], stony: ['training/stony_ground.webp', 150],
};
const WALLS = {
  ext: ['concrete_blue', 130], int: ['plaster_cool', 110], warm: ['plaster_warm', 110], acoustic: ['acoustic', 80],
  steel: ['steel_panels', 90], walnut: ['walnut_panels', 100],
  yard: ['training/smooth_concrete.webp', 110], // D88: the training yards' low concrete walls
};
/** D88: wall styles drawn as a row of the user's sprites instead of a box (collision: data in core/LevelWorld.js). */
const SPRITE_WALLS = { fence: 'mesh_fence' };
// plain colours with a sheen (merged into the vcShiny mesh); the rest of COLORS are dull (vc mesh)
const SHINY = { leather: 0x34373d, cushion: 0x41444a, chrome: 0xbfc5cc, black: 0x17191d, metal: 0x7f858d, metalDark: 0x2c3037, stone: 0x36373c };
const COLORS = {
  metalDark: 0x2a2e35, metal: 0x7f858d, chrome: 0xc4c9d0, black: 0x16181c, leather: 0x26282c, fabric: 0x4f555e,
  white: 0xe4e2dd, cream: 0xd6cdbe, stone: 0x36373c, pot: 0x8c8c88, soil: 0x3a2a1c, plant: 0x2c6629, plantLight: 0x4b8a35,
  cardboard: 0xb08559, tape: 0xd4c39a, red: 0xae2a22, binder: 0x2c4b76, baseboard: 0x26282c,
  yellow: 0x9c7420, cable: 0x2a5aa8, // D83 cable trays
};

const texCache = new Map();
/** Loads (once) a repeating sRGB texture of the office set. */
// D88: 'training/x.webp' — a training-ground texture (assets/textures/training), repeated mirrored (atlas README)
const texUrl = (name) => (name.includes('/') ? `assets/textures/${name}` : `${TEX_DIR}${name}.png`);
const texWrap = (name) => (name.includes('/') ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping);

function officeTexture(name, aniso) {
  let t = texCache.get(name);
  if (!t) {
    t = new THREE.TextureLoader().load(texUrl(name));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = texWrap(name);
    texCache.set(name, t);
  }
  if (aniso && t.anisotropy !== aniso) { t.anisotropy = aniso; if (t.image) t.needsUpdate = true; }
  return t;
}

/** Resolves when every office texture has loaded (or failed — a missing file must not block the game). */
export function preloadOfficeTextures() {
  const names = new Set([...Object.values(FLOORS), ...Object.values(WALLS)].map((e) => e[0]));
  return Promise.all([preloadPropAtlas(), preloadPropViews(), ...[...names].map((n) => new Promise((res) => {
    const t = new THREE.TextureLoader().load(texUrl(n), () => res(), undefined, () => res());
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = texWrap(n);
    texCache.set(n, t);
  }))]);
}

let sharedMats = null;
/** Materials shared by every office scene (game, menu backdrop, previews). */
export function officeMaterials(aniso = 4) {
  if (sharedMats) return sharedMats;
  const m = {};
  for (const [k, c] of Object.entries(COLORS)) m[k] = new THREE.MeshLambertMaterial({ color: c });
  // a little sheen where the catalogue shows it (leather, chrome, plastic, metal)
  const shiny = (c, spec, sh) => new THREE.MeshPhongMaterial({ color: c, specular: spec, shininess: sh });
  m.leather = shiny(0x34373d, 0x3a3a3a, 28);
  m.cushion = shiny(0x41444a, 0x3a3a3a, 22);
  m.chrome = shiny(0xbfc5cc, 0x9a9a9a, 70);
  m.black = shiny(0x17191d, 0x2a2a2a, 40);
  m.metal = shiny(0x7f858d, 0x444444, 30);
  m.metalDark = shiny(0x2c3037, 0x2a2a2a, 30);
  m.stone = shiny(0x36373c, 0x555555, 60);
  // the plain-colour furniture parts are merged into two vertex-coloured meshes (dull / with a sheen): 2 draw calls
  m.vc = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.vcShiny = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x333333, shininess: 34 });
  m.wood = new THREE.MeshLambertMaterial({ map: officeTexture('oak', aniso) });
  m.walnut = new THREE.MeshLambertMaterial({ map: officeTexture('walnut', aniso) });
  m.concrete = new THREE.MeshLambertMaterial({ map: officeTexture('concrete', aniso) });
  m.glass = new THREE.MeshLambertMaterial({ color: 0xa9d2e6, transparent: true, opacity: 0.26, depthWrite: false });
  m.lightstrip = new THREE.MeshBasicMaterial({ color: 0xffdcaa });
  const atlas = new THREE.CanvasTexture(paintOfficeAtlas());
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = aniso;
  m.screen = new THREE.MeshBasicMaterial({ map: atlas });
  m.decal = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.4 });
  m.wallTop = new THREE.MeshLambertMaterial({ color: 0x1b1e23 });
  m.wallTopLight = new THREE.MeshLambertMaterial({ color: 0x9a978f }); // D88: the training yards' concrete caps
  // D79: rugs (atlas), soft contact shadows under furniture and along the walls
  m.rug = new THREE.MeshLambertMaterial({ map: atlas, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const soft = (paint) => { const c = cpuCanvas(128, 128); paint(c.g); const t = new THREE.CanvasTexture(c.canvas); return t; };
  // alpha masks: white on black (alphaMap reads the green channel)
  const aoBox = soft((g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 24; i++) { g.fillStyle = 'rgba(255,255,255,0.075)'; const k = i * 2.4; roundRect(g, k, k, 128 - 2 * k, 128 - 2 * k, 26 - i); } });
  const aoEdge = soft((g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#e6e6e6'); gr.addColorStop(0.35, '#595959'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  m.aoBox = new THREE.MeshBasicMaterial({ alphaMap: aoBox, color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false });
  m.aoEdge = new THREE.MeshBasicMaterial({ alphaMap: aoEdge, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
  for (const [k, [file]] of Object.entries(FLOORS)) m[`floor_${k}`] = new THREE.MeshLambertMaterial({ map: officeTexture(file, aniso) });
  for (const [k, [file]] of Object.entries(WALLS)) m[`wall_${k}`] = new THREE.MeshLambertMaterial({ map: officeTexture(file, aniso) });
  m.outside = new THREE.MeshLambertMaterial({ color: 0x0c0f14 });
  // soft light pools (ceiling lights seen on the floor), additive
  const { canvas, g } = cpuCanvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 63);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const pool = new THREE.CanvasTexture(canvas);
  // D83: every light's pool carries its own colour / strength (vertex colours, render3d/officeLights.js)
  m.lightPool = new THREE.MeshBasicMaterial({ map: pool, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  m.lampShade = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  m.alarm = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  // D83: floor decals (blood, stains, scuffs, floor markings) — soft edges over the floor, under everything else
  m.stain = new THREE.MeshLambertMaterial({ map: atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // door leaves
  m.door_wood = m.walnut; m.door_metal = m.metal; m.door_secure = new THREE.MeshLambertMaterial({ color: 0x3b4048 }); m.door_glass = m.glass;
  // D88: the training ground's mesh gates — the user's gate picture on a thin leaf (alpha cut)
  m.door_gate = new THREE.MeshLambertMaterial({ color: 0x5d6168 });
  m.lockLight = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // D81: the user's furniture sprites (pre-lit art: unlit, a touch darker to sit in the night office) and the
  // invisible material of their shadow casters
  // D83: lit by the baked lights near them (vertex colours: the night ambient + the lamps / screens around)
  m.propCards = new THREE.MeshBasicMaterial({ map: propAtlasTexture(aniso), vertexColors: true, transparent: true, alphaTest: 0.04, depthWrite: true, side: THREE.DoubleSide });
  m.shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  // D85: the furniture view boxes (the user's 5-view sheets): lit, cut out by alpha, both sides in the shadow map
  m.propViews = new THREE.MeshLambertMaterial({ map: propViewTexture(aniso), vertexColors: true, alphaTest: 0.5, shadowSide: THREE.DoubleSide, side: THREE.DoubleSide }); // D93: outline walls seen through the gaps
  m.propViewsTraining = new THREE.MeshLambertMaterial({ map: propViewTexture(aniso, 'training'), vertexColors: true, alphaTest: 0.5, shadowSide: THREE.DoubleSide, side: THREE.DoubleSide });
  sharedMats = m;
  return m;
}

/** Sets the anisotropy of every office texture (graphics preset, applied live). */
export function setOfficeAnisotropy(aniso) {
  for (const t of texCache.values()) if (t.anisotropy !== aniso) { t.anisotropy = aniso; if (t.image) t.needsUpdate = true; }
  propAtlasTexture(aniso);
  propViewTexture(aniso);
  propViewTexture(aniso, 'training');
}

function roundRect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
}

/** Merges non-indexed geometries (position / normal / uv) into one. */
function merge(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const withColor = list.some((g) => g.attributes.color);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const col = withColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col && g.attributes.color) col.set(g.attributes.color.array, o * 3);
    o += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** A horizontal rectangle on the floor with world uv / tile. */
function floorRect(x0, z0, x1, z1, tile, y = 0) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, -p.getZ(i) / tile);
  return g.toNonIndexed();
}

/**
 * Wall pieces for DRAWING (D81 — the flickering / see-through joints): like wallPieces() (collision), but no two walls
 * overlap, so no faces lie in one plane and fight: a wall that ends on another wall's body stops at its face, at an L
 * corner the horizontal wall owns the corner square, collinear walls meet end to end. Glass never owns a joint (a solid
 * wall ignores glass; glass stops at the solid wall's face).
 */
export function drawPieces(level, w, h) {
  const horiz = w.y0 === w.y1, glass = w.style === 'glass';
  const lo = horiz ? Math.min(w.x0, w.x1) : Math.min(w.y0, w.y1), hi = horiz ? Math.max(w.x0, w.x1) : Math.max(w.y0, w.y1);
  const line = horiz ? w.y0 : w.x0;
  const ext = (p, atStart) => {
    let corner = false, stem = false, collinear = false;
    for (const o of level.walls) {
      if (o === w || (!glass && o.style === 'glass')) continue;
      const oh = o.y0 === o.y1;
      const olo = oh ? Math.min(o.x0, o.x1) : Math.min(o.y0, o.y1), ohi = oh ? Math.max(o.x0, o.x1) : Math.max(o.y0, o.y1);
      const oline = oh ? o.y0 : o.x0;
      if (oh === horiz) { if (oline === line && (atStart ? ohi === p : olo === p)) collinear = true; continue; }
      if (oline !== p || line < olo || line > ohi) continue; // the other wall's line does not pass this end
      if (line === olo || line === ohi) corner = true; else stem = true;
    }
    if (glass) return corner || stem ? -h : h;
    if (collinear) return 0;
    if (stem) return -h;
    if (corner) return horiz ? h : -h;
    return h;
  };
  let a = lo - ext(lo, true);
  const end = hi + ext(hi, false);
  const out = [];
  for (const [g0, g1] of [...(w.gaps || [])].sort((p, q) => p[0] - q[0])) {
    if (g0 > a) out.push([a, g0]);
    a = Math.max(a, g1);
  }
  if (end > a) out.push([a, end]);
  return out;
}

/** Builds the 3D office of a level. @returns {{group, doors, update(run, time), dispose()}} */
export function buildOfficeScene(level, { aniso = 4, shadows = true } = {}) {
  const mats = officeMaterials(aniso);
  const group = new THREE.Group();
  const buckets = new Map(); // material key → geometry list
  const put = (k, g) => { let l = buckets.get(k); if (!l) { l = []; buckets.set(k, l); } l.push(g); };
  const H = level.wallHeight, T = level.wallThickness, h = T / 2;

  // floors (one per room) + the dark surroundings
  for (const z of level.zones) {
    const [x0, y0, x1, y1] = z.rect;
    const [, tile] = FLOORS[z.floor] || FLOORS.concrete;
    put(`floor_${FLOORS[z.floor] ? z.floor : 'concrete'}`, floorRect(x0, y0, x1, y1, tile));
  }
  const pad = 1600;
  // D88: outdoors (the training ground) the ground goes on as the level's own floor
  const outKey = level.outside && FLOORS[level.outside] ? level.outside : null;
  put(outKey ? `floor_${outKey}` : 'outside', floorRect(-pad, -pad, level.width + pad, level.height + pad, outKey ? FLOORS[outKey][1] : 100, outKey ? -0.6 : -2));

  // walls
  const spriteWalls = []; // D88: render-only sprites along the fence lines
  for (const w of level.walls) {
    const horiz = w.y0 === w.y1;
    if (SPRITE_WALLS[w.style]) {
      const type = SPRITE_WALLS[w.style], step = PROP_TYPES[type].w;
      for (const [a, b] of drawPieces(level, w, 0)) {
        const n = Math.max(1, Math.round((b - a) / step)), len = (b - a) / n;
        for (let i = 0; i < n; i++) {
          const c = a + len * (i + 0.5);
          spriteWalls.push({ type, x: horiz ? c : w.x0, y: horiz ? w.y0 : c, rot: horiz ? 0 : 1, w: len });
        }
      }
      continue;
    }
    for (const [a, b] of drawPieces(level, w, h)) {
      const len = b - a;
      if (w.style === 'glass') {
        const glass = new THREE.BoxGeometry(horiz ? len : 3, H - 8, horiz ? 3 : len);
        glass.translate(horiz ? (a + b) / 2 : w.x0, (H - 8) / 2 + 4, horiz ? w.y0 : (a + b) / 2);
        put('glass', glass.toNonIndexed());
        for (const [yy, hh] of [[0, 4], [H - 4, 4]]) {
          const rail = new THREE.BoxGeometry(horiz ? len : 6, hh, horiz ? 6 : len);
          rail.translate(horiz ? (a + b) / 2 : w.x0, yy + hh / 2, horiz ? w.y0 : (a + b) / 2);
          put('metalDark', rail.toNonIndexed());
        }
        for (let s = a + 4; s <= b - 4; s += Math.max(40, len / Math.max(1, Math.round(len / 70)))) {
          const post = new THREE.BoxGeometry(4, H, 6);
          if (!horiz) post.rotateY(Math.PI / 2);
          post.translate(horiz ? s : w.x0, H / 2, horiz ? w.y0 : s);
          put('metalDark', post.toNonIndexed());
        }
        continue;
      }
      const [, tile] = WALLS[w.style] || WALLS.int;
      const sx = horiz ? len : T, sz = horiz ? T : len;
      const g = new THREE.BoxGeometry(sx, H, sz);
      // world uv on the sides
      const uv = g.attributes.uv;
      const dims = [[sz, H], [sz, H], [sx, sz], [sx, sz], [sx, H], [sx, H]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
      g.translate(horiz ? (a + b) / 2 : w.x0, H / 2, horiz ? w.y0 : (a + b) / 2);
      put(`wall_${WALLS[w.style] ? w.style : 'int'}`, g.toNonIndexed());
      put(w.style === 'yard' ? 'wallTopLight' : 'wallTop', floorRect(horiz ? a : w.x0 - h, horiz ? w.y0 - h : a, horiz ? b : w.x0 + h, horiz ? w.y0 + h : b, 100, H + 0.2));
    }
  }

  // D79: baseboards, soft shadow strips along the walls, night windows on the outer walls
  const [bx0, by0, bx1, by1] = buildingRect(level);
  for (const w of level.walls) {
    if (w.style === 'glass' || SPRITE_WALLS[w.style]) continue;
    const horiz = w.y0 === w.y1;
    const outer = !level.outdoor && (horiz ? (w.y0 === by0 || w.y0 === by1) : (w.x0 === bx0 || w.x0 === bx1)); // D88: no night windows outdoors
    for (const [a, b] of drawPieces(level, w, h)) {
      const len = b - a, mid = (a + b) / 2;
      const bb = new THREE.BoxGeometry(horiz ? len : T + 2.4, 4, horiz ? T + 2.4 : len);
      bb.translate(horiz ? mid : w.x0, 2, horiz ? w.y0 : mid);
      if (!level.outdoor) put('baseboard', bb.toNonIndexed());
      for (const side of [-1, 1]) {
        const g = new THREE.PlaneGeometry(len, 30);
        g.rotateX(-Math.PI / 2);                    // v = 1 (the dark edge) on −z
        if (side < 0) g.rotateY(Math.PI);           // dark edge on +z
        if (!horiz) g.rotateY(Math.PI / 2);
        const off = h + 15;
        g.translate(horiz ? mid : w.x0 + side * off, 0.22, horiz ? w.y0 + side * off : mid);
        put('aoEdge', g.toNonIndexed());
      }
      if (!outer) continue;
      // which side faces into the building
      const inward = horiz ? Math.sign((by0 + by1) / 2 - w.y0) : Math.sign((bx0 + bx1) / 2 - w.x0);
      const lo = horiz ? bx0 : by0, hi = horiz ? bx1 : by1;
      const s0 = Math.max(a + 14, lo + 18), s1 = Math.min(b - 14, hi - 18);
      if (s1 - s0 < 40) continue;
      const n = Math.max(1, Math.round((s1 - s0) / 96)), pw = (s1 - s0) / n;
      const [u0, v0, u1, v1] = tileUV(TILE.window);
      for (let i = 0; i < n; i++) {
        const c = s0 + pw * (i + 0.5);
        const g = new THREE.PlaneGeometry(pw - 10, 52);
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? v1 : v0);
        if (horiz) { if (inward < 0) g.rotateY(Math.PI); } else g.rotateY(inward > 0 ? Math.PI / 2 : -Math.PI / 2);
        const off = h + 0.5;
        g.translate(horiz ? c : w.x0 + inward * off, 44, horiz ? w.y0 + inward * off : c);
        put('screen', g.toNonIndexed());
      }
    }
  }

  // props + door frames. D81: props with the user's sprite art are drawn as sprite cards (propSprites.js); their 3D
  // build only casts the shadow (an invisible mesh)
  const pb = new PropBuilder(), shadowOnly = new PropBuilder();
  // D83: render-only decor of the lighting (wall lights over each room's north wall) + the level's props
  const extras = level.outdoor ? spriteWalls : [...wallLights(level), ...spriteWalls]; // D88: no wall lamps outdoors
  const allProps = [...level.props, ...extras];
  for (const p of extras) if (!hasView(p)) buildProp(pb, p);
  for (const p of level.props) {
    if (hasView(p) || p.drawn === false) continue; // D85: drawn as a view box (it casts its own silhouette shadow)
    if (!hasSprite(p)) { buildProp(pb, p); continue; }
    const t = PROP_TYPES[p.type];
    // D95 (user: wrong shadows): a sprite card casts no 3D shadow — its primitive stand-in cast a different shape; the
    // soft contact shadow under it stays

  }
  for (const d of level.doors) {
    const hw = d.width / 2;
    for (const s of [-1, 1]) {
      pb.place(d.axis === 'x' ? d.x + s * (hw + 1) : d.x, d.axis === 'x' ? d.y : d.y + s * (hw + 1), d.axis === 'x' ? 0 : 1);
      pb.box('metalDark', 3, H - 4, T + 2, 0, 0, 0);
    }
    if (d.kind === 'gate') continue; // D92 (user): the yard gates have no header beam over the passage (a black plank)
    pb.place(d.x, d.y, d.axis === 'x' ? 0 : 1);
    pb.box('metalDark', d.width + 6, 6, T + 2, 0, H - 8, 0);
  }
  for (const [k, list] of pb.parts) for (const g of list) put(k, g);
  // D79: a soft contact shadow under every standing object (ambient occlusion look)
  for (const p of level.props) {
    const t = PROP_TYPES[p.type];
    if (!t || t.flat || t.wall || t.decor || p.solid === false || !(t.h > 2)) continue;
    const pad = 6 + Math.min(16, t.h * 0.22);
    for (const [x0, y0, x1, y1] of [propBox(p)]) { // (one soft quad — overlapping quads under parts would stack darker)
      const ao = new THREE.PlaneGeometry(x1 - x0 + 2 * pad, y1 - y0 + 2 * pad);
      ao.rotateX(-Math.PI / 2);
      ao.translate((x0 + x1) / 2, 0.45, (y0 + y1) / 2);
      put('aoBox', ao.toNonIndexed());
    }
  }

  // D83: the baked lights — a soft additive pool per light, in its own colour / strength (render3d/officeLights.js)
  const lights = levelLights({ ...level, props: allProps });
  for (const l of lights) {
    const K = LIGHT_KINDS[l.kind], R = K.radius;
    const g = new THREE.PlaneGeometry(R * 2 * l.sx, R * 2 * l.sz);
    g.rotateX(-Math.PI / 2);
    g.translate(l.x, 0.35, l.z);
    const ng = g.toNonIndexed(), n = ng.attributes.position.count, a = new Float32Array(n * 3);
    const k = K.power * POOL_GAIN;
    for (let i = 0; i < n; i++) { a[i * 3] = K.color[0] * k; a[i * 3 + 1] = K.color[1] * k; a[i * 3 + 2] = K.color[2] * k; }
    ng.setAttribute('color', new THREE.BufferAttribute(a, 3));
    put('lightPool', ng);
  }
  // D83: floor decals of the level (blood, stains, scuffs, floor markings)
  for (const d of level.decals || []) {
    const tile = DECAL_TILES[d.t];
    if (tile === undefined) continue;
    const g = new THREE.PlaneGeometry(d.w || 40, d.d || d.w || 40);
    const [u0, v0, u1, v1] = tileUV(tile), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    g.rotateX(-Math.PI / 2);
    g.rotateY(d.r || 0);
    g.translate(d.x, 0.4, d.y);
    put('stain', g.toNonIndexed());
  }

  // plain-colour parts → vertex colours in two shared buckets
  for (const [k, list] of [...buckets]) {
    const shinyHex = SHINY[k], flatHex = COLORS[k];
    const hex = shinyHex ?? flatHex;
    if (hex === undefined) continue;
    const c = new THREE.Color(hex);
    for (const g of list) {
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      put(shinyHex !== undefined ? 'vcShiny' : 'vc', g);
    }
    buckets.delete(k);
  }

  // one mesh per material
  const meshes = [];
  for (const [k, list] of buckets) {
    const mat = mats[k];
    if (!mat) { console.warn('office material missing', k); continue; }
    const mesh = new THREE.Mesh(merge(list), mat);
    const flat = k.startsWith('floor_') || k === 'outside' || k === 'lightPool' || k === 'rug' || k === 'stain';
    // D81: walls take no shadows — at the grazing angles of their sides the shadow map drew moving stripes (acne)
    mesh.receiveShadow = shadows && k !== 'lightPool' && k !== 'screen' && !k.startsWith('wall');
    mesh.castShadow = shadows && !flat && k !== 'glass' && k !== 'screen' && k !== 'decal' && k !== 'lampShade' && k !== 'lightstrip' && k !== 'alarm';
    if (k === 'lightPool') mesh.renderOrder = 1;
    if (k === 'stain') { mesh.renderOrder = 1; mesh.castShadow = false; }
    if (k === 'aoEdge' || k === 'aoBox') { mesh.renderOrder = 2; mesh.receiveShadow = false; mesh.castShadow = false; }
    if (k === 'glass') mesh.renderOrder = 5;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    meshes.push(mesh);
  }

  // D81: the sprite cards (one mesh) + the invisible shadow casters of those props
  // D85: the view boxes (one mesh) — every prop with the user's 5-view art
  for (const [atlas, mat] of [['office', mats.propViews], ['training', mats.propViewsTraining]]) { // D88: one mesh per atlas
    const viewGeo = buildPropViews(allProps, lights, atlas);
    if (!viewGeo) continue;
    const vm = new THREE.Mesh(viewGeo, mat);
    vm.castShadow = shadows;
    vm.receiveShadow = shadows;
    vm.matrixAutoUpdate = false;
    group.add(vm);
    meshes.push(vm);
  }
  // D96: the props drawn from the user's 3D models (impostor pictures / instanced meshes)
  const modelMeshes = buildPropModels(level.props, shadows);
  for (const mm of modelMeshes) group.add(mm);
  // the old sprite cards: only the props without views (overturned chair, broken monitor, papers, trolley)
  const cardGeo = buildPropCards({ ...level, props: level.props.filter((p) => !hasView(p)) }, lights);
  if (cardGeo) {
    const cards = new THREE.Mesh(cardGeo, mats.propCards);
    cards.renderOrder = 3; // after the floor decals (pools, contact shadows), before glass
    cards.matrixAutoUpdate = false;
    group.add(cards);
    meshes.push(cards);
  }
  const casters = [];
  for (const list of shadowOnly.parts.values()) casters.push(...list);
  if (casters.length) {
    const sm = new THREE.Mesh(merge(casters), mats.shadowOnly);
    sm.castShadow = true;
    // invisible on screen (writes neither colour nor depth); the shadow map draws it with its own depth material
    sm.matrixAutoUpdate = false;
    group.add(sm);
    meshes.push(sm);
  }

  // doors: one instanced mesh per kind (sliding leaves)
  const leafGeo = new THREE.BoxGeometry(1, H - 8, 6);
  leafGeo.translate(0, (H - 8) / 2, 0);
  const kinds = {};
  for (const d of level.doors) (kinds[d.kind] = kinds[d.kind] || []).push(d);
  const doorViews = [];
  // D88: the training ground's gates — the user's mesh gate picture (both sides, alpha cut) as the sliding leaf
  const gateGeo = kinds.gate ? gateLeafGeometry(H) : null;
  for (const [kind, list] of Object.entries(kinds)) {
    const gate = kind === 'gate' && gateGeo;
    const im = new THREE.InstancedMesh(gate ? gateGeo : leafGeo, gate ? mats.propViewsTraining : mats[`door_${kind}`] || mats.door_wood, list.length);
    im.castShadow = shadows && kind !== 'glass';
    im.frustumCulled = false;
    if (kind === 'glass') im.renderOrder = 5;
    group.add(im);
    list.forEach((d, i) => doorViews.push({ def: d, im, i, shown: -1 }));
  }
  // lock lights on the locked doors (red → green)
  const lockDoors = level.doors.filter((d) => d.lock && d.lock !== 'never');
  const lockMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 5, 2), mats.lockLight, Math.max(1, lockDoors.length * 2));
  lockMesh.frustumCulled = false;
  lockMesh.setColorAt(0, new THREE.Color(1, 0, 0));
  group.add(lockMesh);

  const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const RED = new THREE.Color(1.6, 0.15, 0.1), GREEN = new THREE.Color(0.2, 1.6, 0.4);
  // D92: the side of a gate's wall where its yard is (its first zone) — the leaf slides there, clear of the path fences
  const yardSide = (d) => {
    const z = d.zones && level.zones.find((q) => q.id === d.zones[0]);
    if (!z) return 1;
    const c = d.axis === 'x' ? (z.rect[1] + z.rect[3]) / 2 - d.y : (z.rect[0] + z.rect[2]) / 2 - d.x;
    return c < 0 ? -1 : 1;
  };
  const placeLeaf = (v, open) => {
    const d = v.def, off = open * d.width * 0.98;
    // D92 (user: the open gates flickered in the wall): a yard gate first steps out of the wall line, then slides along
    // its outer face (not inside the wall — its picture is taller than the fence and fought the wall's faces)
    const out = d.kind === 'gate' ? Math.min(1, open * 5) * (T / 2 + 2.5) * yardSide(d) : 0;
    if (d.axis === 'x') { P.set(d.x - off, 4, d.y + out); Q.identity(); } else { P.set(d.x + out, 4, d.y - off); Q.setFromAxisAngle(UP, Math.PI / 2); }
    S.set(d.width, 1, 1);
    M.compose(P, Q, S);
    v.im.setMatrixAt(v.i, M);
    v.im.instanceMatrix.needsUpdate = true;
  };
  for (const v of doorViews) placeLeaf(v, 0);
  let lockKey = '';
  const placeLocks = (lockedOf) => {
    let k = 0, key = '';
    for (const d of lockDoors) {
      const locked = lockedOf(d.id);
      key += locked ? '1' : '0';
      for (const s of [-1, 1]) {
        const off = d.width / 2 + 7;
        if (d.axis === 'x') P.set(d.x + off, 44, d.y + s * (T / 2 + 1.2)); else P.set(d.x + s * (T / 2 + 1.2), 44, d.y + off);
        Q.identity(); S.set(1, 1, 1);
        if (d.axis !== 'x') Q.setFromAxisAngle(UP, Math.PI / 2);
        M.compose(P, Q, S);
        lockMesh.setMatrixAt(k, M);
        lockMesh.setColorAt(k, locked ? RED : GREEN);
        k++;
      }
    }
    lockMesh.count = k;
    lockMesh.instanceMatrix.needsUpdate = true;
    if (lockMesh.instanceColor) lockMesh.instanceColor.needsUpdate = true;
    return key;
  };
  lockKey = placeLocks((id) => !!level.doors.find((d) => d.id === id).lock);

  return {
    group,
    meshes,
    /** Door leaves follow the run's door state (only changed doors are written). */
    update(run) {
      if (!run || !run.doors) return;
      for (const v of doorViews) {
        const st = run.doors.find((x) => x.def === v.def);
        if (!st) continue;
        const o = Math.round(st.open * 100) / 100;
        if (o !== v.shown) { v.shown = o; placeLeaf(v, o); }
      }
      let key = '';
      for (const d of lockDoors) { const st = run.doors.find((x) => x.def === d); key += st && st.locked ? '1' : '0'; }
      if (key !== lockKey) lockKey = placeLocks((id) => { const st = run.doors.find((x) => x.id === id); return !!(st && st.locked); });
    },
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      // D96: their own materials; the merged impostor quads (an instanced model keeps the shared, cached geometry)
      for (const mm of modelMeshes) { mm.material.dispose(); if (!mm.isInstancedMesh) mm.geometry.dispose(); }
      leafGeo.dispose();
      if (gateGeo) gateGeo.dispose();
      lockMesh.geometry.dispose();
      for (const c of [...group.children]) group.remove(c);
    },
  };
}

/** D88: a gate leaf 1 unit wide (scaled to the door's width like the box leaves), the mesh gate's front picture. */
function gateLeafGeometry(wallH) {
  const A = VIEW_ATLASES.training, item = A.items.mesh_gate_closed;
  const rect = item && (item.front || item.back);
  const g = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  const h = rect ? Math.max(wallH, (PROP_TYPES.mesh_gate_closed.w * rect[3]) / rect[2]) : wallH;
  g.scale(1, h, 1);
  g.translate(0, h / 2 - 4, 0); // (the leaves are placed 4 above the floor)
  if (rect) {
    const [rx, ry, rw, rh] = rect, uv = g.attributes.uv;
    const u0 = (rx + 0.5) / A.width, u1 = (rx + rw - 0.5) / A.width, v0 = 1 - (ry + rh - 0.5) / A.height, v1 = 1 - (ry + 0.5) / A.height;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  }
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

/**
 * D83: wall lights along the inside of every room's north wall (the face the camera sees) — one per ~260 units, kept
 * clear of door gaps and of other things hung on that wall. Render-only props (render3d/officeLights.js lights them).
 */
function wallLights(level) {
  const out = [], T = level.wallThickness;
  for (const z of level.zones) {
    if (z.wallLights === false) continue;
    const [x0, y0, x1] = z.rect;
    const wall = level.walls.find((w) => w.y0 === w.y1 && w.y0 === y0 && Math.min(w.x0, w.x1) <= x0 + 1 && Math.max(w.x0, w.x1) >= x1 - 1 && w.style !== 'glass');
    if (!wall) continue;
    const n = Math.max(1, Math.round((x1 - x0) / 260));
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
      const y = y0 + T / 2 + 1.5;
      if ((wall.gaps || []).some(([a, b]) => x > a - 30 && x < b + 30)) continue;
      if (level.props.some((p) => { const t = PROP_TYPES[p.type]; return t && t.wall && Math.abs(p.y - y) < 14 && Math.abs(p.x - x) < (t.w / 2 + 26); })) continue;
      out.push({ type: 'wall_light', x, y, rot: 0 });
    }
  }
  return out;
}

/** The building's outer rectangle: the walls that bound most rooms (the stairwell sticks out of it). */
function buildingRect(level) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const z of level.zones) {
    if (z.id === 'stairs') continue;
    x0 = Math.min(x0, z.rect[0]); y0 = Math.min(y0, z.rect[1]); x1 = Math.max(x1, z.rect[2]); y1 = Math.max(y1, z.rect[3]);
  }
  return [x0, y0, x1, y1];
}
