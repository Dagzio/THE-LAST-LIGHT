// KILL LIST (D78): the office location in 3D, built from level data (data/levels/office.js): floors per room with the
// user's seamless textures (NEW/Office/textures → assets/textures/office), walls per style with a dark top cap (reads
// like a floor plan from the top-down camera), glass partitions, sliding doors (one instanced mesh per door kind),
// furniture / equipment (render3d/officeProps.js) merged into one mesh per material, and soft light pools on the
// floors. Presentation only: update() reads the doors' open state; nothing here touches the simulation.
import * as THREE from '../../lib/three.module.js';
import { PropBuilder, buildProp } from './officeProps.js';
import { paintOfficeAtlas } from './officeAtlas.js';
import { cpuCanvas } from './render-guard.js';
import { wallPieces } from '../core/LevelWorld.js';

const TEX_DIR = 'assets/textures/office/';
// floor / wall material → texture file + tile size (world units per repeat)
const FLOORS = {
  marble: ['marble', 115], carpet: ['carpet', 110], tile_light: ['tile_light', 90], tile_dark: ['tile_dark', 90],
  oak: ['oak', 110], walnut: ['walnut', 110], concrete: ['concrete', 160], epoxy: ['epoxy', 160], access: ['access', 80],
};
const WALLS = {
  ext: ['concrete_blue', 130], int: ['plaster_cool', 110], warm: ['plaster_warm', 110], acoustic: ['acoustic', 80],
  steel: ['steel_panels', 90], walnut: ['walnut_panels', 100],
};
// plain colours with a sheen (merged into the vcShiny mesh); the rest of COLORS are dull (vc mesh)
const SHINY = { leather: 0x34373d, cushion: 0x41444a, chrome: 0xbfc5cc, black: 0x17191d, metal: 0x7f858d, metalDark: 0x2c3037, stone: 0x36373c };
const COLORS = {
  metalDark: 0x2a2e35, metal: 0x7f858d, chrome: 0xc4c9d0, black: 0x16181c, leather: 0x26282c, fabric: 0x4f555e,
  white: 0xe4e2dd, cream: 0xd6cdbe, stone: 0x36373c, pot: 0x8c8c88, soil: 0x3a2a1c, plant: 0x2c6629, plantLight: 0x4b8a35,
  cardboard: 0xb08559, tape: 0xd4c39a, red: 0xae2a22, binder: 0x2c4b76,
};

const texCache = new Map();
/** Loads (once) a repeating sRGB texture of the office set. */
function officeTexture(name, aniso) {
  let t = texCache.get(name);
  if (!t) {
    t = new THREE.TextureLoader().load(`${TEX_DIR}${name}.png`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    texCache.set(name, t);
  }
  if (aniso && t.anisotropy !== aniso) { t.anisotropy = aniso; if (t.image) t.needsUpdate = true; }
  return t;
}

/** Resolves when every office texture has loaded (or failed — a missing file must not block the game). */
export function preloadOfficeTextures() {
  const names = new Set([...Object.values(FLOORS), ...Object.values(WALLS)].map((e) => e[0]));
  return Promise.all([...names].map((n) => new Promise((res) => {
    const t = new THREE.TextureLoader().load(`${TEX_DIR}${n}.png`, () => res(), undefined, () => res());
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    texCache.set(n, t);
  })));
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
  for (const [k, [file]] of Object.entries(FLOORS)) m[`floor_${k}`] = new THREE.MeshLambertMaterial({ map: officeTexture(file, aniso) });
  for (const [k, [file]] of Object.entries(WALLS)) m[`wall_${k}`] = new THREE.MeshLambertMaterial({ map: officeTexture(file, aniso) });
  m.outside = new THREE.MeshLambertMaterial({ color: 0x0c0f14 });
  // soft light pools (ceiling lights seen on the floor), additive
  const { canvas, g } = cpuCanvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 63);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const pool = new THREE.CanvasTexture(canvas);
  m.lightPool = new THREE.MeshBasicMaterial({ map: pool, color: 0xfff1dc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22 });
  // door leaves
  m.door_wood = m.walnut; m.door_metal = m.metal; m.door_secure = new THREE.MeshLambertMaterial({ color: 0x3b4048 }); m.door_glass = m.glass;
  m.lockLight = new THREE.MeshBasicMaterial({ color: 0xffffff });
  sharedMats = m;
  return m;
}

/** Sets the anisotropy of every office texture (graphics preset, applied live). */
export function setOfficeAnisotropy(aniso) {
  for (const t of texCache.values()) if (t.anisotropy !== aniso) { t.anisotropy = aniso; if (t.image) t.needsUpdate = true; }
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
  put('outside', floorRect(-pad, -pad, level.width + pad, level.height + pad, 100, -2));

  // walls
  for (const w of level.walls) {
    const horiz = w.y0 === w.y1;
    for (const [a, b] of wallPieces(w, h)) {
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
      put('wallTop', floorRect(horiz ? a : w.x0 - h, horiz ? w.y0 - h : a, horiz ? b : w.x0 + h, horiz ? w.y0 + h : b, 100, H + 0.2));
    }
  }

  // props + door frames
  const pb = new PropBuilder();
  for (const p of level.props) buildProp(pb, p);
  for (const d of level.doors) {
    const hw = d.width / 2;
    for (const s of [-1, 1]) {
      pb.place(d.axis === 'x' ? d.x + s * (hw + 1) : d.x, d.axis === 'x' ? d.y : d.y + s * (hw + 1), d.axis === 'x' ? 0 : 1);
      pb.box('metalDark', 3, H - 4, T + 2, 0, 0, 0);
    }
    pb.place(d.x, d.y, d.axis === 'x' ? 0 : 1);
    pb.box('metalDark', d.width + 6, 6, T + 2, 0, H - 8, 0);
  }
  for (const [k, list] of pb.parts) for (const g of list) put(k, g);

  // light pools: a grid of soft spots per room
  for (const z of level.zones) {
    const [x0, y0, x1, y1] = z.rect;
    const nx = Math.max(1, Math.round((x1 - x0) / 230)), ny = Math.max(1, Math.round((y1 - y0) / 230));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const cx = x0 + ((i + 0.5) * (x1 - x0)) / nx, cz = y0 + ((j + 0.5) * (y1 - y0)) / ny;
      const r = Math.min(150, Math.min((x1 - x0) / nx, (y1 - y0) / ny) * 0.75);
      const g = new THREE.PlaneGeometry(r * 2, r * 2);
      g.rotateX(-Math.PI / 2);
      g.translate(cx, 0.35, cz);
      put('lightPool', g.toNonIndexed());
    }
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
    const flat = k.startsWith('floor_') || k === 'outside' || k === 'lightPool';
    mesh.receiveShadow = shadows && k !== 'lightPool' && k !== 'screen';
    mesh.castShadow = shadows && !flat && k !== 'glass' && k !== 'screen' && k !== 'decal';
    if (k === 'lightPool') mesh.renderOrder = 1;
    if (k === 'glass') mesh.renderOrder = 5;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    meshes.push(mesh);
  }

  // doors: one instanced mesh per kind (sliding leaves)
  const leafGeo = new THREE.BoxGeometry(1, H - 8, 6);
  leafGeo.translate(0, (H - 8) / 2, 0);
  const kinds = {};
  for (const d of level.doors) (kinds[d.kind] = kinds[d.kind] || []).push(d);
  const doorViews = [];
  for (const [kind, list] of Object.entries(kinds)) {
    const im = new THREE.InstancedMesh(leafGeo, mats[`door_${kind}`] || mats.door_wood, list.length);
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
  const placeLeaf = (v, open) => {
    const d = v.def, off = open * d.width * 0.98;
    if (d.axis === 'x') { P.set(d.x - off, 4, d.y); Q.identity(); } else { P.set(d.x, 4, d.y - off); Q.setFromAxisAngle(UP, Math.PI / 2); }
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
      leafGeo.dispose();
      lockMesh.geometry.dispose();
      for (const c of [...group.children]) group.remove(c);
    },
  };
}
