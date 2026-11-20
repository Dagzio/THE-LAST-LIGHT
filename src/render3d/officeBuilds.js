// D119 (user: remodel the round table, the security console, the planter, the coffee counter, the armchair and the
// water cooler — they looked poor; joined properly, as the conference table): each one built from real low-poly parts
// (boxes, cylinders, discs) whose faces show the matching PARTS of the object's own pictures in the office atlas
// (data/propViews.js) — the seat cushion from the top picture's seat, an arm's front from the front picture's arm, the
// bottle round its cylinder… Parts meet at their edges (no planes crossing in the air), the pictures keep the look.
// Region of a picture: [view, fx0, fy0, fx1, fy1] — a part of that view (fractions; fy from its top).
// Geometry: in the prop's own frame (front → +z), y up, units; the caller (render3d/propViews.js) places it and merges
// it into the office atlas mesh (one draw call, the baked lights, the shadows).
import * as THREE from '../../lib/three.module.js';

/** uv rect [u0, v0 (bottom), u1, v1 (top)] of a region in the atlas. */
function uvOf(ctx, reg) {
  const { item, A } = ctx;
  const [view, fx0, fy0, fx1, fy1] = reg;
  const r = item[view] || item.front;
  const [rx, ry, rw, rh] = r;
  return [(rx + 0.5 + fx0 * (rw - 1)) / A.width, 1 - (ry + 0.5 + fy1 * (rh - 1)) / A.height, (rx + 0.5 + fx1 * (rw - 1)) / A.width, 1 - (ry + 0.5 + fy0 * (rh - 1)) / A.height];
}

/** A quad w × h facing +z (centre at the origin) showing a region. */
function quad(ctx, reg, w, h) {
  const g = new THREE.PlaneGeometry(w, h).toNonIndexed();
  const [u0, v0, u1, v1] = uvOf(ctx, reg);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  return g;
}

/**
 * A box w × h × d standing at (x, y0, z), turned `yaw` about its centre — faces { top, bottom, front, back, left,
 * right } (regions; `side` for both sides, `all` for any face not given; a face set to null is left out).
 */
function box(ctx, out, x, y0, z, w, h, d, f, yaw = 0) {
  const face = (k) => (k in f ? f[k] : (k === 'left' || k === 'right') && f.side ? f.side : f.all || null);
  const put = (g) => { g.translate(0, 0, 0); if (yaw) g.rotateY(yaw); g.translate(x, y0, z); out.push(g); };
  let r;
  if ((r = face('top'))) { const g = quad(ctx, r, w, d); g.rotateX(-Math.PI / 2); g.translate(0, h, 0); put(g); }
  if ((r = face('bottom'))) { const g = quad(ctx, r, w, d); g.rotateX(Math.PI / 2); put(g); }
  if ((r = face('front'))) { const g = quad(ctx, r, w, h); g.translate(0, h / 2, d / 2); put(g); }
  if ((r = face('back'))) { const g = quad(ctx, r, w, h); g.rotateY(Math.PI); g.translate(0, h / 2, -d / 2); put(g); }
  if ((r = face('left'))) { const g = quad(ctx, r, d, h); g.rotateY(-Math.PI / 2); g.translate(-w / 2, h / 2, 0); put(g); }
  if ((r = face('right'))) { const g = quad(ctx, r, d, h); g.rotateY(Math.PI / 2); g.translate(w / 2, h / 2, 0); put(g); }
}

/**
 * A cylinder (radius r, height h) standing at (x, y0, z): its side shows `side` projected as the front picture sees a
 * round thing (u = (sin θ + 1) / 2 — the front half exact, the back half mirrored); `top` — a cap, planar.
 */
function cyl(ctx, out, x, y0, z, r, h, side, top = null, seg = 18, r1 = r) {
  if (side) {
    const g = new THREE.CylinderGeometry(r1, r, h, seg, 1, true).toNonIndexed();
    const [u0, v0, u1, v1] = uvOf(ctx, side);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), rr = py > 0 ? r1 : r;
      const k = Math.min(1, Math.max(0, (px / rr + 1) / 2));
      uv.setXY(i, u0 + (u1 - u0) * k, py > 0 ? v1 : v0);
    }
    g.translate(x, y0 + h / 2, z);
    out.push(g);
  }
  if (top) out.push(disc(ctx, x, y0 + h, z, r1, top, seg));
}

/** A flat disc of radius r at height y (facing up), its picture planar from `reg` (the region's square). */
function disc(ctx, x, y, z, r, reg, seg = 28) {
  const g = new THREE.CircleGeometry(r, seg).toNonIndexed();
  g.rotateX(-Math.PI / 2);
  const [u0, v0, u1, v1] = uvOf(ctx, reg);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, u0 + (u1 - u0) * (p.getX(i) / r + 1) / 2, v0 + (v1 - v0) * (1 - (p.getZ(i) / r + 1) / 2));
  g.translate(x, y, z);
  return g;
}

/** A quad standing up (w × h, bottom at y0), turned `yaw` — foliage bands. */
function plane(ctx, out, x, y0, z, w, h, reg, yaw = 0) {
  const g = quad(ctx, reg, w, h);
  g.translate(0, h / 2, 0);
  if (yaw) g.rotateY(yaw);
  g.translate(x, y0, z);
  out.push(g);
}

// ---------------------------------------------------------------------------------------------------------------------
// The six objects. W × D — the prop's footprint (data/props.js), H — its drawn height (catalogue proportions).
export const OFFICE_BUILDS = {
  /** Round meeting table: a wooden disc with its edge band, a steel column, a cross foot. */
  roundTable(ctx, out, W, D, H) {
    const R = Math.min(W, D) / 2, T = 1.3, wood = ['front', 0.02, 0.0, 0.98, 0.045], steel = ['front', 0.45, 0.3, 0.55, 0.6];
    out.push(disc(ctx, 0, H, 0, R, ['top', 0, 0, 1, 1], 36));
    cyl(ctx, out, 0, H - T, 0, R, T, wood, null, 36);
    out.push(disc(ctx, 0, H - T, 0, R * 0.98, ['top', 0.2, 0.2, 0.8, 0.8], 24)); // (its underside, flipped below)
    out[out.length - 1].rotateX(Math.PI).translate(0, 2 * (H - T), 0);
    cyl(ctx, out, 0, 1.2, 0, R * 0.075, H - T - 1.2, steel, null, 12);
    cyl(ctx, out, 0, H - T - 1.6, 0, R * 0.2, 1.6, steel, null, 14, R * 0.12); // the plate under the top
    for (const a of [Math.PI / 4, -Math.PI / 4]) box(ctx, out, 0, 0, 0, R * 1.5, 1.2, 2.2, { all: steel, bottom: null }, a);
  },

  /** Water cooler: the white cabinet (its front with the taps), the blue bottle on top, its cap. */
  waterCooler(ctx, out, W, D, H) {
    const bw = W * 0.86, bd = D * 0.86, by0 = H * 0.03, bh = H * 0.66;
    box(ctx, out, 0, by0, 0, bw, bh, bd, {
      front: ['front', 0.07, 0.31, 0.93, 0.97], back: ['back', 0.07, 0.31, 0.93, 0.97],
      left: ['left', 0.07, 0.31, 0.93, 0.97], right: ['right', 0.07, 0.31, 0.93, 0.97], top: ['top', 0.03, 0.03, 0.97, 0.97],
    });
    box(ctx, out, 0, 0, 0, bw * 0.9, by0, bd * 0.9, { all: ['front', 0.3, 0.975, 0.7, 0.99], top: null, bottom: null }); // the plinth
    cyl(ctx, out, 0, by0 + bh, 0, W * 0.34, H - by0 - bh, ['front', 0.15, 0.0, 0.85, 0.3], ['top', 0.13, 0.13, 0.87, 0.87], 20, W * 0.3);
  },

  /** Coffee counter: the cabinet (its doors), the counter top slab, the espresso machine at the back, two cup stacks. */
  coffeeCounter(ctx, out, W, D, H) {
    const cabH = H * 0.52, slab = H * 0.075, y = cabH + slab;
    box(ctx, out, 0, 0, 0, W * 0.97, cabH, D * 0.94, {
      front: ['front', 0.02, 0.47, 0.98, 0.995], back: ['back', 0.02, 0.47, 0.98, 0.995],
      left: ['left', 0.03, 0.47, 0.97, 0.995], right: ['right', 0.03, 0.47, 0.97, 0.995], top: null,
    });
    box(ctx, out, 0, cabH, 0, W, slab, D, {
      // the counter's own surface (a clean part of the top picture — its machine and cups are real parts now)
      top: ['top', 0.7, 0.76, 0.98, 0.97], front: ['front', 0, 0.40, 1, 0.47], back: ['back', 0, 0.40, 1, 0.47],
      left: ['left', 0, 0.40, 1, 0.47], right: ['right', 0, 0.40, 1, 0.47],
    });
    // the machine: front view x 0 … 0.5, height 0 … 0.40; side view (depth) 0.02 … 0.6 (the back half)
    const mw = W * 0.47, mh = H * 0.34, md = D * 0.58; // (the picture's solid part: above the drip gap)
    box(ctx, out, -W * 0.25, y, -D * 0.2, mw, mh, md, {
      front: ['front', 0.03, 0.0, 0.49, 0.34], back: ['back', 0.51, 0.0, 0.97, 0.34],
      left: ['left', 0.02, 0.0, 0.6, 0.34], right: ['right', 0.4, 0.0, 0.98, 0.34], top: ['top', 0.05, 0.05, 0.65, 0.6],
    });
    // the paper cups: two stacks (front view x 0.70 … 0.89)
    cyl(ctx, out, W * 0.25, y, D * 0.05, W * 0.05, H * 0.32, ['front', 0.70, 0.08, 0.80, 0.40], ['top', 0.73, 0.18, 0.86, 0.36], 12);
    cyl(ctx, out, W * 0.34, y, -D * 0.12, W * 0.05, H * 0.26, ['front', 0.79, 0.14, 0.89, 0.40], ['top', 0.80, 0.42, 0.93, 0.6], 12);
  },

  /** Long planter: a concrete trough, the leaves above it (the front band along, two turned for volume, the crown top). */
  planter(ctx, out, W, D, H) {
    const th = H * 0.58, tw = W * 0.88, td = D * 0.9;
    box(ctx, out, 0, 0, 0, tw, th, td, {
      front: ['front', 0.06, 0.42, 0.94, 1], back: ['back', 0.06, 0.42, 0.94, 1],
      left: ['left', 0.24, 0.5, 0.85, 1], right: ['right', 0.15, 0.5, 0.76, 1],
      top: ['top', 0, 0, 1, 1], // (the leaves seen from above fill the trough to its rim)
    });
    const lh = H - th + H * 0.08, ly = th - H * 0.08;
    plane(ctx, out, 0, ly, 0, W, lh, ['front', 0, 0, 1, 0.46]);
    plane(ctx, out, -W * 0.02, ly, -td * 0.2, W * 0.96, lh * 0.9, ['back', 0, 0.04, 1, 0.46], 0.06);
    plane(ctx, out, W * 0.02, ly, td * 0.2, W * 0.96, lh * 0.85, ['front', 0, 0.06, 1, 0.46], -0.05);
    const g = quad(ctx, ['top', 0, 0, 1, 1], W, D * 1.4); g.rotateX(-Math.PI / 2); g.translate(0, th + (H - th) * 0.55, 0); out.push(g);
  },

  /** Lounge armchair: two arms, the seat block, the back, the cushion, a steel rail and legs. */
  armchair(ctx, out, W, D, H) {
    const aw = W * 0.16, legH = H * 0.27, armTop = H * 0.82, seatTop = H * 0.58, backD = D * 0.3;
    const leather = ['top', 0.42, 0.55, 0.58, 0.7], steel = ['front', 0.04, 0.69, 0.96, 0.715];
    for (const sx of [-1, 1]) { // the arms
      const outer = sx < 0 ? ['left', 0.02, 0.22, 0.98, 0.76] : ['right', 0.02, 0.22, 0.98, 0.76];
      box(ctx, out, sx * (W / 2 - aw / 2), legH, 0, aw, armTop - legH, D * 0.98, {
        top: sx < 0 ? ['top', 0.0, 0.0, 0.17, 1] : ['top', 0.83, 0.0, 1.0, 1],
        front: sx < 0 ? ['front', 0.0, 0.18, 0.16, 0.69] : ['front', 0.84, 0.18, 1.0, 0.69],
        back: sx < 0 ? ['back', 0.84, 0.18, 1.0, 0.69] : ['back', 0.0, 0.18, 0.16, 0.69],
        left: sx < 0 ? outer : leather, right: sx < 0 ? leather : outer,
      });
    }
    const iw = W - 2 * aw;
    // the seat block (its front: the cushion's front) and the back rest
    box(ctx, out, 0, legH, backD / 2 * 0.2, iw, seatTop - legH, D * 0.98 - backD * 0.2, {
      top: ['top', 0.17, 0.28, 0.83, 1], front: ['front', 0.16, 0.42, 0.84, 0.69], left: leather, right: leather, back: null,
    });
    box(ctx, out, 0, legH, -D * 0.49 + backD / 2, iw, H - legH, backD, {
      top: ['top', 0.17, 0.0, 0.83, 0.28], front: ['front', 0.16, 0.0, 0.84, 0.42], back: ['back', 0.16, 0.0, 0.84, 0.69],
      left: leather, right: leather,
    });
    // the steel rail round the base and four legs
    box(ctx, out, 0, legH - 1, 0, W * 0.97, 1, D * 0.95, { all: steel, top: null });
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(ctx, out, lx * (W / 2 - 1.2), 0, lz * (D / 2 - 1.4), 1.3, legH - 1, 1.3, { all: steel, top: null, bottom: null });
  },

  /** Security console: two drawer pedestals, a modesty panel, the desk top (its outline), four monitors on an arc. */
  console(ctx, out, W, D, H) {
    const deskY = H * 0.53, slab = H * 0.09, top = deskY + slab;
    const cab = ['front', 0.05, 0.55, 0.15, 0.62];
    for (const sx of [-1, 1]) {
      const pw = W * 0.19, x = sx * (W / 2 - pw / 2 - W * 0.01);
      box(ctx, out, x, 0, -D * 0.08, pw, deskY, D * 0.62, {
        front: sx < 0 ? ['front', 0.01, 0.47, 0.2, 1] : ['front', 0.8, 0.47, 0.99, 1],
        back: sx < 0 ? ['back', 0.8, 0.47, 0.99, 1] : ['back', 0.01, 0.47, 0.2, 1],
        left: sx < 0 ? ['front', 0.02, 0.5, 0.18, 1] : cab, right: sx < 0 ? cab : ['front', 0.82, 0.5, 0.98, 1], top: null,
      });
    }
    box(ctx, out, 0, H * 0.18, -D * 0.33, W * 0.6, deskY - H * 0.18, 1.6, { front: ['back', 0.2, 0.5, 0.8, 0.8], back: ['back', 0.2, 0.5, 0.8, 0.8], top: null, bottom: null });
    // the desk top: its own outline (the curved front), the edge band from the side pictures, the top picture on it
    if (ctx.outline) for (const loop of ctx.outline) out.push(ctx.outlineWalls(loop, W, D, H, ctx.item, ctx.A, top, Math.min(1, 0.02 * Math.min(W, D)), deskY));
    const tq = quad(ctx, ['top', 0, 0, 1, 1], W, D); tq.rotateX(-Math.PI / 2); tq.translate(0, top, 0); out.push(tq);
    // four monitors on a gentle arc at the back, each on a short stand
    const n = 4, mw = W * 0.205, mh = H * 0.27, gap = W * 0.008;
    for (let i = 0; i < n; i++) {
      const k = i - (n - 1) / 2, x = k * (mw + gap) * 0.98, yaw = -k * 0.16, z = -D * 0.3 + Math.abs(k) * D * 0.07;
      const f0 = 0.07 + i * 0.215, f1 = f0 + 0.2;
      box(ctx, out, x, top + H * 0.05, z, mw, mh, 1.4, { front: ['front', f0, 0.02, f1, 0.3], back: ['back', 1 - f1, 0.02, 1 - f0, 0.3], top: cab, side: cab, bottom: cab }, yaw);
      box(ctx, out, x, top, z, mw * 0.08, H * 0.05, 1, { all: cab, top: null, bottom: null }, yaw);
    }
  },
};
