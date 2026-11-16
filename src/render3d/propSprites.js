// D81: the office furniture drawn with the user's painted sprites (data/propSprites.js, atlas data/propAtlas.js).
// Every sprite is a card inside its prop's footprint (bottom on the floor along the camera-near edge, top above the far
// edge, leaning so the art keeps its proportions from the game camera). All cards of a level are ONE mesh (one draw
// call), sorted back to front (the camera always looks north), blended with soft edges and writing depth, so people
// pass behind and in front of the furniture correctly. Presentation only.
import * as THREE from '../../lib/three.module.js';
import { PROP_ATLAS } from '../data/propAtlas.js';
import { PROP_SPRITES } from '../data/propSprites.js';
import { PROP_TYPES, propBox } from '../data/props.js';
import { CAMERA } from '../config/camera.js';
import { lightAt } from './officeLights.js';

const TILT = (CAMERA.tilt * Math.PI) / 180;
const SIN = Math.sin(TILT), COS = Math.cos(TILT);   // screen height of 1 unit up / of 1 unit north
const LIFT = 0.6;                                   // above the floor, the contact shadows and the rugs
const WALL_MOUNT = 44;                              // centre height of wall-hung art

let texture = null;
/** The sprite atlas texture (loaded once). */
export function propAtlasTexture(aniso = 4) {
  if (!texture) {
    texture = new THREE.TextureLoader().load(PROP_ATLAS.file);
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  if (texture.anisotropy !== aniso) { texture.anisotropy = aniso; if (texture.image) texture.needsUpdate = true; }
  return texture;
}

/** Resolves when the atlas has loaded (or failed — a missing file must not block the game). */
export function preloadPropAtlas() {
  return new Promise((res) => {
    texture = new THREE.TextureLoader().load(PROP_ATLAS.file, () => res(), undefined, () => res());
    texture.colorSpace = THREE.SRGBColorSpace;
  });
}

/** True when the prop is drawn by a sprite (its 3D build then only casts the shadow). */
export const hasSprite = (p) => !!PROP_SPRITES[p.type];

/** The card corners of one prop: [bottom-left, bottom-right, top-right, top-left] (x, y, z) + sort depth, or null. */
function card(p) {
  const s = PROP_SPRITES[p.type], t = PROP_TYPES[p.type], rect = PROP_ATLAS.sprites[s && s.sprite];
  if (!s || !t || !rect || p.drawn === false) return null;
  const [x0, y0, x1, y1] = propBox(p);
  const cx = (x0 + x1) / 2, cz = (y0 + y1) / 2, hw = s.width / 2, aspect = rect[3] / rect[2];
  const rot = (p.rot | 0) & 3;
  const c = { rect, flip: !!s.iso && (rot === 3 || rot === 2), pts: null, depth: 0 };
  if (s.wall) {
    if (rot !== 0) return null; // only the south-facing side of a wall is ever seen by the camera
    const hh = (s.width * aspect) / 2, z = y1 + 0.5;
    c.pts = [[cx - hw, WALL_MOUNT - hh, z], [cx + hw, WALL_MOUNT - hh, z], [cx + hw, WALL_MOUNT + hh, z], [cx - hw, WALL_MOUNT + hh, z]];
    c.depth = z;
    return c;
  }
  if (s.flat) {
    // on the floor, turned with the prop; its depth is stretched so the art keeps its shape on screen
    const hd = (s.width * aspect) / COS / 2, a = (rot * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    const at = (dx, dz) => [cx + dx * ca - dz * sa, LIFT * 0.5, cz + dx * sa + dz * ca];
    c.pts = [at(-hw, hd), at(hw, hd), at(hw, -hd), at(-hw, -hd)];
    c.depth = cz;
    return c;
  }
  const zs = y1 + (s.front || 0);
  let zn = y0 - (s.back || 0);
  const screenH = s.width * aspect * (s.squash ?? 1);
  let top;
  if (screenH > (zs - zn) * COS) top = (screenH - (zs - zn) * COS) / SIN;
  else { top = LIFT; zn = zs - screenH / COS; }
  // D83: standing on something (plants on a planter): the whole card is raised, pulled a little towards the camera
  const el = p.elev || 0;
  c.pts = [[cx - hw, LIFT + el, zs], [cx + hw, LIFT + el, zs], [cx + hw, top + el, zn], [cx - hw, top + el, zn]];
  c.depth = zs + (el ? 0.5 : 0);
  return c;
}

const SPRITE_AMBIENT = 0.62;  // D83: the night office (sprites are pre-lit art; this darkens them like the room)…
const SPRITE_GAIN = 0.8;      // …and the lights near them bring them back up
const SPRITE_MAX = 1.12;
const LT = [0, 0, 0];

/** One geometry with the cards of every sprite prop of a level (back to front), or null when there are none. */
export function buildPropCards(level, lights = null) {
  const cards = level.props.map(card).filter(Boolean).sort((a, b) => a.depth - b.depth);
  if (!cards.length) return null;
  const W = PROP_ATLAS.width, H = PROP_ATLAS.height;
  const pos = new Float32Array(cards.length * 18), uv = new Float32Array(cards.length * 12), col = new Float32Array(cards.length * 18);
  let o = 0, u = 0;
  for (const c of cards) {
    const [rx, ry, rw, rh] = c.rect;
    // half a texel inside the rect (no bleeding of the neighbours)
    let u0 = (rx + 0.5) / W, u1 = (rx + rw - 0.5) / W;
    const vb = 1 - (ry + rh - 0.5) / H, vt = 1 - (ry + 0.5) / H;
    if (c.flip) [u0, u1] = [u1, u0];
    const uvs = [[u0, vb], [u1, vb], [u1, vt], [u0, vt]];
    // the light at each corner's floor point (lit art: the night ambient + the lamps / screens around it)
    const cc = c.pts.map((pt) => {
      if (!lights) return [0.9, 0.9, 0.9];
      lightAt(lights, pt[0], pt[2], LT);
      return LT.map((v) => Math.min(SPRITE_MAX, SPRITE_AMBIENT + v * SPRITE_GAIN));
    });
    for (const i of [0, 1, 2, 0, 2, 3]) {
      col.set(cc[i], o);
      pos.set(c.pts[i], o); o += 3;
      uv.set(uvs[i], u); u += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
