// Procedural placeholder art (decision D9). Everything here is drawn once into cached layers/sprites;
// final art will replace it through the asset manifest (prompts in /art-prompts).
// Palette (05_CONTENT §1): cold dark blues/greys/muted green, amber beacon light.
import { WORLD_WIDTH as W, WORLD_HEIGHT as H } from '../config/constants.js';
import { SeededRandom } from '../core/SeededRandom.js';

export const PALETTE = {
  night0: '#070a12',
  night1: '#0f1626',
  night2: '#1c2a3e',
  sea0: '#0a141b',
  sea1: '#10222b',
  rock: '#05070b',
  ash0: '#1d1f24',
  ash1: '#26292f',
  ash2: '#30343b',
  moss: '#2b3a32',
  amber: '#ffb347',
  amberHot: '#ffe2a8',
};

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Soft radial glow sprite (used for beacon glow, fog blobs, probe light). */
export function makeGlowSprite(radius, color, alpha = 1) {
  const c = makeCanvas(radius * 2, radius * 2);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(0, 0, radius * 2, radius * 2);
  return c;
}

/** Horizontal light beam sprite: origin at the left-middle, fades to the right. */
export function makeBeamSprite(length, halfWidth) {
  const c = makeCanvas(length, halfWidth * 2);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, length, 0);
  grad.addColorStop(0, 'rgba(255,214,140,0.55)');
  grad.addColorStop(0.35, 'rgba(255,190,110,0.22)');
  grad.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, halfWidth - 6);
  g.lineTo(length, 0);
  g.lineTo(length, halfWidth * 2);
  g.lineTo(0, halfWidth + 6);
  g.closePath();
  g.fill();
  return c;
}

/**
 * Static part of the menu backdrop (side view of the coast at night) drawn in world coords.
 * `rect` is the visible world rectangle (extended surround included).
 */
export function drawBackdropStatic(g, rect) {
  const { x, y, w, h } = rect;
  const horizon = 452;

  const sky = g.createLinearGradient(0, y, 0, horizon);
  sky.addColorStop(0, PALETTE.night0);
  sky.addColorStop(0.65, PALETTE.night1);
  sky.addColorStop(1, PALETTE.night2);
  g.fillStyle = sky;
  g.fillRect(x, y, w, horizon - y);

  // Distant stars (cosmetic RNG, deterministic layout).
  const rng = new SeededRandom(91);
  g.fillStyle = 'rgba(200,215,255,0.55)';
  for (let i = 0; i < 90; i++) {
    const sx = x + rng.next() * w;
    const sy = y + rng.next() * (horizon - y) * 0.6;
    const r = rng.next() < 0.85 ? 0.8 : 1.4;
    g.fillRect(sx, sy, r, r);
  }

  // Sea.
  const sea = g.createLinearGradient(0, horizon, 0, y + h);
  sea.addColorStop(0, PALETTE.sea1);
  sea.addColorStop(1, PALETTE.sea0);
  g.fillStyle = sea;
  g.fillRect(x, horizon, w, y + h - horizon);
  g.strokeStyle = 'rgba(120,150,170,0.08)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    const wy = horizon + 6 + i * i * 0.18;
    if (wy > y + h) break;
    const len = 30 + rng.next() * 120;
    const wx = x + rng.next() * w;
    g.beginPath();
    g.moveTo(wx, wy);
    g.lineTo(wx + len, wy);
    g.stroke();
  }

  // Far cliffs on the left.
  g.fillStyle = '#0a0f18';
  g.beginPath();
  g.moveTo(x, horizon + 8);
  g.lineTo(x, 300);
  g.lineTo(120, 318); g.lineTo(220, 360); g.lineTo(300, 352); g.lineTo(390, 410); g.lineTo(470, horizon + 4);
  g.closePath();
  g.fill();

  // Lighthouse rock (right).
  g.fillStyle = PALETTE.rock;
  g.beginPath();
  g.moveTo(840, y + h); g.lineTo(860, 520); g.lineTo(930, 470); g.lineTo(1060, 462);
  g.lineTo(1150, 498); g.lineTo(1230, 560); g.lineTo(x + w, 600); g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();

  // Lighthouse tower (tapered), slate with two faded bands.
  const cx = 1010, base = 470, top = 232;
  g.fillStyle = '#1a2130';
  g.beginPath();
  g.moveTo(cx - 34, base); g.lineTo(cx - 20, top); g.lineTo(cx + 20, top); g.lineTo(cx + 34, base);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(120,40,40,0.35)';
  for (const [a, b] of [[300, 330], [380, 410]]) {
    const wa = 20 + ((a - top) / (base - top)) * 14;
    const wb = 20 + ((b - top) / (base - top)) * 14;
    g.beginPath();
    g.moveTo(cx - wa, a); g.lineTo(cx + wa, a); g.lineTo(cx + wb, b); g.lineTo(cx - wb, b);
    g.closePath();
    g.fill();
  }
  // Gallery + lantern room + roof.
  g.fillStyle = '#0d1119';
  g.fillRect(cx - 30, top - 6, 60, 8);
  g.fillStyle = 'rgba(255,190,100,0.85)';
  g.fillRect(cx - 15, top - 34, 30, 28);
  g.fillStyle = '#0d1119';
  g.fillRect(cx - 15, top - 34, 3, 28);
  g.fillRect(cx + 12, top - 34, 3, 28);
  g.beginPath();
  g.moveTo(cx - 20, top - 34); g.lineTo(cx, top - 56); g.lineTo(cx + 20, top - 34);
  g.closePath();
  g.fill();

  // Foreground left rocks (frame for the menu list).
  g.fillStyle = '#04060a';
  g.beginPath();
  g.moveTo(x, y + h); g.lineTo(x, 560); g.lineTo(80, 590); g.lineTo(170, 640); g.lineTo(260, 690); g.lineTo(330, y + h);
  g.closePath();
  g.fill();
}

/** Lantern position of the backdrop lighthouse (world units). */
export const BACKDROP_LANTERN = { x: 1010, y: 212 };

/**
 * Top-down Ashen Coast ground (test arena for Phase 1). No gameplay objects here.
 * `rect` = visible world rect; outside 0..W×0..H is the decorative surround.
 */
export function drawArenaGround(g, rect, seed = 7331) {
  const rng = new SeededRandom(seed);
  const { x, y, w, h } = rect;

  // Surround: wet dark rocks and shallow water.
  g.fillStyle = '#0b1117';
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(40,70,85,0.18)';
  for (let i = 0; i < 160; i++) {
    const px = x + rng.next() * w;
    const py = y + rng.next() * h;
    if (px > -20 && px < W + 20 && py > -20 && py < H + 20) continue;
    g.beginPath();
    g.ellipse(px, py, 10 + rng.next() * 40, 6 + rng.next() * 18, rng.next() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  // Arena ash ground.
  const ground = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.7);
  ground.addColorStop(0, PALETTE.ash2);
  ground.addColorStop(0.6, PALETTE.ash1);
  ground.addColorStop(1, PALETTE.ash0);
  g.fillStyle = ground;
  g.fillRect(0, 0, W, H);

  // Ash speckles and pebbles.
  for (let i = 0; i < 2200; i++) {
    const px = rng.next() * W, py = rng.next() * H;
    const v = 30 + Math.floor(rng.next() * 40);
    g.fillStyle = `rgba(${v},${v + 4},${v + 10},0.5)`;
    g.fillRect(px, py, 1.5, 1.5);
  }
  for (let i = 0; i < 70; i++) {
    const px = rng.next() * W, py = rng.next() * H;
    g.fillStyle = rng.next() < 0.5 ? '#1a1c20' : '#363a41';
    g.beginPath();
    g.ellipse(px, py, 3 + rng.next() * 7, 2 + rng.next() * 5, rng.next() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // Moss patches.
  for (let i = 0; i < 26; i++) {
    const px = rng.next() * W, py = rng.next() * H;
    g.fillStyle = 'rgba(43,58,50,0.35)';
    g.beginPath();
    g.ellipse(px, py, 18 + rng.next() * 50, 10 + rng.next() * 26, rng.next() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }

  // Old stone plaza in the center (pure decoration, no gameplay meaning in Phase 1).
  g.save();
  g.translate(W / 2, H / 2);
  g.strokeStyle = 'rgba(150,160,175,0.10)';
  g.lineWidth = 3;
  for (const r of [70, 120, 175]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(ang) * 70, Math.sin(ang) * 70);
    g.lineTo(Math.cos(ang) * 175, Math.sin(ang) * 175);
    g.stroke();
  }
  g.restore();

  // Arena border: low broken stone edge.
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 10;
  g.strokeRect(5, 5, W - 10, H - 10);
  g.strokeStyle = 'rgba(140,150,165,0.10)';
  g.lineWidth = 2;
  g.strokeRect(10, 10, W - 20, H - 20);

  // Vignette inside the arena.
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
}
