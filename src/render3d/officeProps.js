// KILL LIST (D78): 3D furniture and equipment of the office location, built from code after the user's catalogue
// (NEW/Office/office sprites — 33 items: desks, workstation with monitors, chairs, conference table, armchair, coffee
// table, reception, monitors, PC, keyboard, drawers, filing cabinet, archive shelving, bookcase, printer, server racks,
// security console, glass partition, secure door, turnstiles, coffee machine, vending machine, boxes, trolley, plant,
// notice board, lights, overturned chair, papers, damaged monitor). The sprites are perspective art, not textures:
// the shapes here follow them, the surfaces use the user's office textures (oak / walnut) and a painted atlas.
//
// A PropBuilder collects parts per material in world space; OfficeScene merges each material into ONE mesh
// (a few draw calls for the whole floor). Prop frame: x along its width, z = its front (south at rot 0), y up,
// origin at the centre of the footprint on the floor. Units: game units (1 m ≈ 30).
import * as THREE from '../../lib/three.module.js';
import { TILE, tileUV } from './officeAtlas.js';

const M4 = new THREE.Matrix4(), M5 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1);
const P0 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class PropBuilder {
  constructor() {
    this.parts = new Map();   // material key → BufferGeometry[] (world space, non-indexed)
    this.base = new THREE.Matrix4();
  }

  /** Sets the prop transform for the following parts: position (x, y on the floor → X, Z) and quarter turns. */
  place(x, y, rot = 0, extraYaw = 0) {
    this.base.compose(P0.set(x, 0, y), Q.setFromAxisAngle(UP, -(rot * Math.PI) / 2 - extraYaw), SC);
    return this;
  }

  _push(mat, geo, local) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (geo !== g) geo.dispose();
    M5.multiplyMatrices(this.base, local);
    g.applyMatrix4(M5);
    let list = this.parts.get(mat);
    if (!list) { list = []; this.parts.set(mat, list); }
    list.push(g);
  }

  _local(x, y, z, rx = 0, ry = 0, rz = 0) {
    E.set(rx, ry, rz, 'YXZ');
    return M4.compose(V.set(x, y, z), Q.setFromEuler(E), SC);
  }

  /** Box w (x) × h (y) × d (z) whose BOTTOM centre is at (x, y, z). tile: world-uv tile size for textured materials. */
  box(mat, w, h, d, x, y, z, { rx = 0, ry = 0, rz = 0, tile = 0 } = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    if (tile > 0) worldUV(g, w, h, d, tile);
    this._push(mat, g, this._local(x, y, z, rx, ry, rz));
    return this;
  }

  /** Vertical cylinder, bottom centre at (x, y, z). */
  cyl(mat, rTop, rBottom, h, x, y, z, seg = 10, { rx = 0, rz = 0 } = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    g.translate(0, h / 2, 0);
    this._push(mat, g, this._local(x, y, z, rx, 0, rz));
    return this;
  }

  /** Flattened ball (plants, cushions). */
  blob(mat, r, sx, sy, sz, x, y, z, ry = 0) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(sx, sy, sz);
    this._push(mat, g, this._local(x, y, z, 0, ry, 0));
    return this;
  }

  /** A flat picture (atlas tile) w × h facing +z (front), centre at (x, y, z); tilt rx leans it back. */
  quad(mat, tile, w, h, x, y, z, { rx = 0, ry = 0 } = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    const [u0, v0, u1, v1] = tileUV(tile);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    this._push(mat, g, this._local(x, y, z, rx, ry, 0));
    return this;
  }

  /** A flat picture lying on the floor (papers, stains). */
  decal(mat, tile, w, d, x, z, y = 0.6, ry = 0) { return this.quad(mat, tile, w, d, x, y, z, { rx: -Math.PI / 2, ry }); }
}

/** Box uv in world units / tile per face (BoxGeometry face order +x −x +y −y +z −z, 4 vertices each). */
function worldUV(g, w, h, d, tile) {
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
}

// ---------------- the props ----------------
const LEG = 1.6;

function deskFrame(b, w, d, h, top = 'wood') {
  b.box(top, w, 2, d, 0, h - 2, 0, { tile: 60 });
  for (const sx of [-1, 1]) {           // sled legs (the catalogue desk: black square frame legs)
    b.box('metalDark', LEG, h - 2, LEG, sx * (w / 2 - 3), 0, -d / 2 + 3);
    b.box('metalDark', LEG, h - 2, LEG, sx * (w / 2 - 3), 0, d / 2 - 3);
    b.box('metalDark', LEG, LEG, d - 6, sx * (w / 2 - 3), 0.5, 0);
  }
  b.box('metalDark', w - 6, LEG, LEG, 0, h - 5, -d / 2 + 3);
}

function monitor(b, x, z, tile, w = 18, ry = 0, y = 23) {
  b.box('metalDark', 6, 1, 5, x, y, z, { ry });
  b.box('metalDark', 1.4, 7, 1.4, x, y + 1, z - 1, { ry });
  b.box('black', w, 11, 1.4, x, y + 6, z - 1.5, { ry });
  const c = Math.cos(ry), s = Math.sin(ry);
  b.quad('screen', tile, w - 1.4, 9.6, x + s * 0.8, y + 11.5, z - 1.5 + c * 0.8, { ry });
}

function swivelChair(b, color = 'leather') {
  for (let k = 0; k < 5; k++) b.box('metalDark', 1.4, 1.4, 9, 0, 1, 0, { ry: (k * Math.PI * 2) / 5 }).box('black', 2, 2, 2, Math.sin((k * Math.PI * 2) / 5) * 8, 0, Math.cos((k * Math.PI * 2) / 5) * 8);
  b.cyl('chrome', 1, 1, 10, 0, 2, 0, 6);
  b.box(color, 16, 3, 15, 0, 12, 1);
  b.box(color, 15, 16, 3, 0, 14, -7, { rx: -0.12 });
  b.box(color, 13, 4, 2.6, 0, 28, -8.4, { rx: -0.12 });
  for (const sx of [-1, 1]) b.box('black', 1.6, 5, 9, sx * 8.4, 15, 0);
}

function meetingChair(b) {
  for (const sx of [-1, 1]) {
    b.box('chrome', 1.2, 12, 1.2, sx * 6.5, 0, 6);
    b.box('chrome', 1.2, 1.2, 14, sx * 6.5, 0, 0);
    b.box('chrome', 1.2, 14, 1.2, sx * 6.5, 0, -6);
  }
  b.box('fabric', 14, 3, 13, 0, 11, 0.5);
  b.box('fabric', 14, 14, 2.6, 0, 12, -6.5, { rx: -0.1 });
}

const BUILD = {
  desk(b) { deskFrame(b, 60, 30, 23); },

  workstation(b) {
    deskFrame(b, 60, 30, 23);
    monitor(b, -9, -9, TILE.screenMap); monitor(b, 10, -9, TILE.screenCode, 18, -0.25);
    b.quad('decal', TILE.keyboard, 22, 7, 0, 23.2, 3, { rx: -Math.PI / 2 });
    b.box('black', 3, 1.2, 4.5, 15, 23, 3);                     // mouse
    b.box('black', 9, 20, 22, 22, 0, -2).quad('screen', TILE.serverFront, 1.2, 1.2, 22, 16, 9.1); // PC tower + LED
    b.box('metalDark', 14, 16, 22, -20, 0, 2);                  // drawer unit
    b.box('white', 9, 4, 6, 25, 23, -9);                        // document tray
  },

  exec_desk(b) {
    b.box('walnut', 76, 3, 36, 0, 21, 0, { tile: 70 });
    b.box('walnut', 3, 21, 34, -35, 0, 0, { tile: 70 }).box('walnut', 22, 21, 34, 26, 0, 0, { tile: 70 });
    b.box('walnut', 50, 14, 2, -9, 7, -16, { tile: 70 });
    monitor(b, -6, -10, TILE.screenMap, 22);
    b.box('chrome', 4, 9, 4, 28, 24, -10).box('lightstrip', 6, 2, 6, 28, 33, -10); // desk lamp
    b.decal('decal', TILE.papers, 18, 14, 14, 6, 24.2, 0.3);
  },

  chair(b) { swivelChair(b); },
  chair_meeting(b) { meetingChair(b); },

  conf_table(b) {
    b.box('walnut', 196, 3, 66, 0, 20, 0, { tile: 90 });
    b.cyl('walnut', 33, 33, 3, -98, 20, 0, 16).cyl('walnut', 33, 33, 3, 98, 20, 0, 16);
    b.box('metalDark', 120, 18, 12, 0, 2, 0).box('metalDark', 140, 2, 30, 0, 0, 0);
    b.blob('plant', 7, 1.4, 0.7, 1.4, 0, 27, 0).blob('plantLight', 5, 1.2, 0.8, 1.2, 4, 29, 3);
    b.decal('decal', TILE.papers, 18, 14, -40, 10, 23.2, 0.4).decal('decal', TILE.papers, 18, 14, 50, -12, 23.2, -0.6);
    b.box('black', 10, 1, 7, -70, 23, -14).box('black', 10, 1, 7, 64, 23, 16);
  },

  armchair(b) {
    b.box('leather', 30, 8, 26, 0, 3, 0);
    b.box('leather', 30, 14, 6, 0, 8, -10);
    for (const sx of [-1, 1]) b.box('leather', 5, 9, 24, sx * 12.5, 8, 0);
    b.box('cushion', 20, 3, 18, 0, 11, 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('chrome', 1.5, 3, 1.5, sx * 13, 0, sz * 11);
  },

  sofa(b) {
    b.box('leather', 76, 8, 28, 0, 3, 0);
    b.box('leather', 76, 15, 7, 0, 8, -10.5);
    for (const sx of [-1, 1]) b.box('leather', 6, 10, 28, sx * 35, 8, 0);
    for (const sx of [-1, 0, 1]) b.box('cushion', 21, 3, 19, sx * 22, 11, 2.5);
  },

  coffee_table(b) {
    b.cyl('stone', 16, 16, 2, 0, 12, 0, 18);
    b.cyl('metalDark', 15, 15, 1, 0, 1, 0, 18);
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + 0.6; b.box('metalDark', 1.2, 12, 1.2, Math.cos(a) * 13, 0, Math.sin(a) * 13); }
    b.box('white', 7, 1, 9, -4, 14, 2).cyl('black', 1.4, 1.4, 3, 6, 14, -3, 8);
    b.blob('plant', 3, 1, 1.2, 1, 2, 17, -5);
  },

  round_table(b) {
    b.cyl('white', 18, 18, 2, 0, 21, 0, 18);
    b.cyl('chrome', 1.6, 1.6, 21, 0, 0, 0, 8).cyl('metalDark', 9, 9, 1.2, 0, 0, 0, 14);
    b.cyl('white', 2, 1.6, 3, 5, 23, 4, 8);
  },

  reception(b) {
    // curved counter (catalogue 08): cream front panels, dark stone top, warm light strip
    const n = 9, R = 120, span = 1.25;
    for (let k = 0; k < n; k++) {
      const a = -span / 2 + (span * (k + 0.5)) / n;
      const x = Math.sin(a) * R, z = Math.cos(a) * R - R + 14;
      b.box('cream', (span * R) / n + 1.2, 30, 10, x, 0, z, { ry: a });
      b.box('stone', (span * R) / n + 1.6, 3, 18, x - Math.sin(a) * 3, 30, z - Math.cos(a) * 3, { ry: a });
      b.box('lightstrip', (span * R) / n + 0.6, 1.4, 0.6, x + Math.sin(a) * 5.4, 4, z + Math.cos(a) * 5.4, { ry: a });
    }
    b.box('walnut', 120, 22, 14, 0, 0, -14, { tile: 60 });
    monitor(b, -18, -14, TILE.screenCode, 18, 0, 22);
    b.blob('plant', 6, 1, 1.3, 1, 48, 38, -8).cyl('pot', 4, 3, 6, 48, 33, -8, 8);
    b.box('black', 8, 2, 10, 20, 33, -4);
  },

  filing_cabinet(b) {
    b.box('metal', 20, 42, 24, 0, 0, 0);
    for (let k = 0; k < 4; k++) { b.box('metalDark', 18, 0.8, 0.6, 0, 2 + k * 10, 12.1); b.box('chrome', 5, 1.2, 1, 0, 7 + k * 10, 12.4); }
  },

  archive_shelf(b) {
    for (const sx of [-1, 1]) b.box('metal', 2, 62, 18, sx * 34, 0, 0);
    for (let k = 0; k < 5; k++) b.box('metal', 68, 1.4, 18, 0, 1 + k * 15, 0);
    for (let k = 0; k < 4; k++) {
      const y = 2.4 + k * 15;
      b.box('cardboard', 18, 11, 14, -22, y, 0).box(k % 2 ? 'white' : 'cardboard', 16, 9, 14, 0, y, 0);
      for (let j = 0; j < 4; j++) b.box(j % 3 ? 'binder' : 'red', 3, 12, 13, 14 + j * 4, y, 0);
    }
  },

  bookcase(b) {
    b.box('walnut', 50, 56, 2, 0, 0, -6, { tile: 50 });
    for (const sx of [-1, 1]) b.box('walnut', 2, 56, 14, sx * 24, 0, 0, { tile: 50 });
    for (let k = 0; k < 4; k++) b.box('walnut', 48, 1.6, 14, 0, k * 14, 0, { tile: 50 });
    b.box('walnut', 50, 2, 14, 0, 54, 0, { tile: 50 });
    for (let k = 0; k < 3; k++) b.quad('decal', TILE.books, 44, 11, 0, 7.5 + k * 14, 5.5);
  },

  printer(b) {
    b.box('white', 28, 20, 24, 0, 0, 0);
    b.box('metal', 26, 3, 22, 0, 3, 0.6).box('metal', 26, 3, 22, 0, 9, 0.6);
    b.box('white', 26, 8, 20, 0, 20, -1);
    b.quad('decal', TILE.printerPanel, 14, 8, 4, 28.2, 6, { rx: -Math.PI / 2 + 0.5 });
    b.box('metalDark', 20, 1, 6, 0, 28, -7);
  },

  server_rack(b) {
    b.box('black', 24, 66, 30, 0, 0, 0);
    b.quad('screen', TILE.serverFront, 20, 60, 0, 34, 15.1);
    b.box('metalDark', 24, 2, 30, 0, 66, 0);
  },

  server_rack_open(b) {
    b.box('black', 24, 66, 30, 0, 0, 0);
    b.quad('screen', TILE.serverOpen, 20, 60, 0, 34, 15.1);
    b.box('glass', 1, 60, 22, 11, 3, 24, { ry: 1.2 }); // the door swung open
  },

  console(b) {
    b.box('metalDark', 120, 2.4, 36, 0, 21.6, 0);
    for (const sx of [-1, 1]) b.box('metalDark', 28, 22, 34, sx * 44, 0, 0);
    b.box('metal', 64, 22, 2, 0, 0, -16);
    for (const [x, ry] of [[-34, 0.25], [0, 0], [34, -0.25]]) {
      b.box('metalDark', 4, 10, 4, x, 24, -12);
      b.box('black', 32, 19, 1.6, x, 30, -13, { ry });
      b.quad('screen', TILE.cctv, 30, 17, x + Math.sin(ry) * 0.95, 39.5, -13 + Math.cos(ry) * 0.95, { ry });
    }
    b.quad('decal', TILE.keyboard, 24, 8, 0, 24.3, 4, { rx: -Math.PI / 2 });
    b.box('black', 10, 1, 7, 28, 24, 6).box('black', 8, 5, 6, -40, 24, 4); // phone, radio
  },

  terminal(b) {
    deskFrame(b, 50, 28, 23, 'metal');
    b.box('black', 22, 1.2, 15, 0, 23, 2);                     // laptop base
    b.box('black', 22, 14, 1, 0, 24, -5.5, { rx: -0.25 });
    b.quad('screen', TILE.screenCode, 20, 12, 0, 31.5, -4.8, { rx: -0.25 });
    b.box('metalDark', 30, 22, 26, 0, 0, -1);
  },

  turnstile(b) {
    b.box('chrome', 10, 30, 36, 0, 0, 0);
    b.box('black', 9, 1, 10, 0, 30, -8).quad('screen', TILE.exitSign, 6, 6, 0, 30.6, -8, { rx: -Math.PI / 2 });
    b.box('glass', 30, 14, 1.2, 20, 12, 0, { ry: Math.PI / 2 });
  },

  coffee_counter(b) {
    b.box('walnut', 52, 26, 24, 0, 0, 0, { tile: 50 });
    b.box('stone', 54, 2, 25, 0, 26, 0);
    b.box('black', 16, 16, 14, -10, 28, -3).box('chrome', 14, 3, 12, -10, 41, -3);
    b.box('chrome', 6, 2, 3, -10, 33, 4).cyl('white', 2, 1.6, 4, -10, 28, 5, 8);
    for (let k = 0; k < 3; k++) b.cyl('white', 2.2, 1.8, 6 + k * 3, 12, 28, -6 + k * 5, 8);
    for (const sx of [-1, 1]) b.box('metalDark', 0.8, 18, 0.6, sx * 3, 4, 12.2);
  },

  kitchen_counter(b) {
    b.box('white', 100, 26, 24, 0, 0, 0);
    b.box('stone', 102, 2, 25, 0, 26, 0);
    b.box('metal', 22, 1, 14, -20, 27.6, 0).cyl('chrome', 1, 1, 8, -20, 28, -8, 6);
    b.box('black', 22, 13, 14, 30, 28, -2).quad('decal', TILE.keyboard, 12, 8, 26, 34.5, 5.1);
    for (let k = -2; k <= 2; k++) b.box('metal', 0.8, 18, 0.6, k * 20, 4, 12.2);
  },

  vending(b) {
    b.box('black', 32, 60, 26, 0, 0, 0);
    b.quad('screen', TILE.vending, 28, 52, 0, 31, 13.1);
    b.box('metalDark', 32, 4, 26, 0, 60, 0);
  },

  fridge(b) {
    b.box('chrome', 26, 60, 26, 0, 0, 0);
    b.box('metalDark', 26, 0.8, 0.6, 0, 40, 13.1).box('metalDark', 1.4, 14, 1.2, -10, 44, 13.4).box('metalDark', 1.4, 18, 1.2, -10, 16, 13.4);
  },

  water_cooler(b) {
    b.box('white', 12, 26, 12, 0, 0, 0);
    b.cyl('glass', 6, 6, 12, 0, 26, 0, 12);
    b.box('chrome', 3, 2, 2, -2, 18, 6.5).box('red', 1.5, 1.5, 1, 2, 19, 6.4);
  },

  boxes(b) {
    b.box('cardboard', 16, 13, 14, -8, 0, 4).box('cardboard', 14, 12, 12, 9, 0, -3).box('cardboard', 12, 9, 11, -6, 13, 3, { ry: 0.3 });
    b.box('tape', 16.2, 0.4, 2.4, -8, 13, 4);
  },

  boxes_tall(b) {
    b.box('cardboard', 22, 14, 22, 0, 0, 0).box('cardboard', 20, 13, 20, 1, 14, -1, { ry: 0.2 }).box('cardboard', 16, 11, 16, -1, 27, 1, { ry: -0.15 });
  },

  trolley(b) {
    b.box('metal', 28, 2, 18, 0, 4, 0);
    b.box('chrome', 1.4, 24, 1.4, -13, 4, -8).box('chrome', 1.4, 24, 1.4, -13, 4, 8).box('chrome', 1.4, 1.4, 17, -13, 27, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('black', 2, 2, 2.5, sx * 11, 0, sz * 7, 8);
    b.box('cardboard', 14, 10, 12, 4, 6, 0);
  },

  plant(b) {
    b.cyl('pot', 7, 5.5, 13, 0, 0, 0, 10);
    b.cyl('soil', 6.6, 6.6, 0.6, 0, 12.6, 0, 10);
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4, rr = 3 + (k % 3) * 2;
      b.blob(k % 2 ? 'plant' : 'plantLight', 5.5, 1.7, 0.45, 0.8, Math.cos(a) * rr, 18 + (k % 4) * 6, Math.sin(a) * rr, a);
    }
    b.blob('plant', 4.5, 1, 1.5, 1, 0, 38, 0);
  },

  whiteboard(b) {
    b.quad('decal', TILE.whiteboard, 50, 32, 0, 30, 1.2);
    b.box('metal', 52, 34, 1.6, 0, 13, 0);
    for (const sx of [-1, 1]) { b.box('chrome', 1.4, 47, 1.4, sx * 26, 0, 0); b.box('chrome', 1.4, 1.4, 10, sx * 26, 0.5, 0); }
  },

  bin(b) { b.cyl('metalDark', 5, 4, 13, 0, 0, 0, 10); b.cyl('black', 4.6, 4.6, 0.5, 0, 12.6, 0, 10); },

  notice_board(b) { b.box('walnut', 52, 32, 1.4, 0, 18, -0.6, { tile: 50 }); b.quad('decal', TILE.notice, 48, 28, 0, 34, 0.3); },

  tv_wall(b) { b.box('black', 80, 46, 2, 0, 16, -0.4); b.quad('screen', TILE.tvDash, 76, 42, 0, 39, 0.7); },

  elevator(b) { b.box('metalDark', 64, 72, 1.4, 0, 0, -0.6); b.quad('decal', TILE.elevator, 58, 66, 0, 33, 0.3); },

  extinguisher(b) { b.cyl('red', 3, 3, 15, 0, 22, 0, 10); b.box('black', 2, 3, 2, 0, 37, 0); b.box('red', 10, 20, 1, 0, 20, -2.6); },

  exit_sign(b) { b.box('black', 26, 11, 1.6, 0, 70, -0.5); b.quad('screen', TILE.exitSign, 24, 9, 0, 75.5, 0.4); },

  papers(b) { b.decal('decal', TILE.papers, 40, 30, 0, 0, 0.5, 0.3); },

  overturned_chair(b) {
    // the catalogue's chair lying on its back
    b.box('leather', 16, 15, 3, 0, 0, -2, { rx: -Math.PI / 2 });
    b.box('leather', 16, 3, 13, 0, 0, 8, { rx: -0.3 });
    b.cyl('chrome', 1, 1, 12, 0, 8, 10, 6, { rx: Math.PI / 2 });
    for (let k = 0; k < 5; k++) b.box('metalDark', 1.4, 9, 1.4, 0, 8, 21, { rx: 0, rz: (k * Math.PI * 2) / 5 });
  },

  broken_monitor(b) {
    b.box('black', 22, 2, 14, 0, 0, 0, { ry: 0.3 });
    b.quad('screen', TILE.brokenScreen, 20, 12, 0, 2.2, 0, { rx: -Math.PI / 2, ry: 0.3 });
    b.box('metalDark', 8, 3, 6, 9, 0, -9);
  },

  stairs(b) {
    for (let k = 0; k < 6; k++) b.box('concrete', 120, 1 + k * 0.2, 11, 0, 0, -30 + k * 11.6, { tile: 40 });
    b.box('lightstrip', 120, 0.6, 1.2, 0, 0.8, -35);
  },
};

export const PROP_BUILDERS = BUILD;

/** Builds a placed prop into the builder. Unknown types are skipped (a warning, no crash). */
export function buildProp(b, p) {
  const fn = BUILD[p.type];
  if (!fn) { console.warn('office prop without a model', p.type); return; }
  b.place(p.x, p.y, p.rot | 0);
  fn(b);
}
