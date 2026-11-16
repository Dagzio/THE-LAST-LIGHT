// KILL LIST (D78): a 1024 px atlas of small painted surfaces for the office props — monitor screens, CCTV, server
// fronts, vending machine, notice board, printer panel, exit sign, book spines, whiteboard, papers, broken screen,
// keyboard. Painted once at start in a CPU canvas (render-guard cpuCanvas: survives a GPU-process restart).
// Tile index → uv rect via tileUV(). Screens use it on an unlit material (they glow), the rest on a lit one.
import { cpuCanvas } from './render-guard.js';
import { SeededRandom } from '../core/SeededRandom.js';

export const TILE = {
  screenMap: 0, screenCode: 1, cctv: 2, serverFront: 3, serverOpen: 4, vending: 5, notice: 6, printerPanel: 7,
  tvDash: 8, elevator: 9, exitSign: 10, books: 11, whiteboard: 12, papers: 13, brokenScreen: 14, keyboard: 15,
  // D79
  window: 16, rugRed: 17, rugGrey: 18, lockers: 19, photo: 20, clock: 21, poster: 22, mug: 23,
};
const N = 4, ROWS = 6, S = 256;

/** uv rect [u0, v0, u1, v1] of a tile (three.js uv: v up; the canvas is uploaded with flipY). */
export function tileUV(i) {
  const cx = i % N, cy = Math.floor(i / N), iu = 2 / (N * S), iv = 2 / (ROWS * S);
  return [cx / N + iu, 1 - (cy + 1) / ROWS + iv, (cx + 1) / N - iu, 1 - cy / ROWS - iv];
}

export function paintOfficeAtlas() {
  const { canvas, g } = cpuCanvas(N * S, ROWS * S);
  const rng = new SeededRandom(9071);
  const r = () => rng.next();
  const at = (i, fn) => { g.save(); g.translate((i % N) * S, Math.floor(i / N) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(); g.restore(); };
  const fill = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // 0 world map dashboard
  at(TILE.screenMap, () => {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#0b2a4a'); gr.addColorStop(1, '#06182e'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = '#2d7fd0';
    for (let k = 0; k < 340; k++) { const x = 20 + r() * 216, y = 40 + r() * 150; if (Math.sin(x * 0.05) + Math.cos(y * 0.07) > 0.2) g.fillRect(x, y, 3, 3); }
    g.strokeStyle = '#59b8ff'; g.lineWidth = 2; g.strokeRect(8, 8, S - 16, S - 16);
    fill('#3fa0ff', 16, 206, 140, 8); fill('#1c4f80', 16, 222, 200, 6); fill('#ff5a4a', 200, 30, 10, 10);
  });
  // 1 code / charts
  at(TILE.screenCode, () => {
    fill('#08131f', 0, 0, S, S);
    for (let y = 16; y < S - 10; y += 12) { const w = 30 + r() * 150; fill(r() < 0.2 ? '#4fd1a5' : '#5aa9e6', 14 + (r() < 0.3 ? 16 : 0), y, w, 5); }
    g.strokeStyle = '#ffcf5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(140, 200);
    for (let x = 140; x < 240; x += 10) g.lineTo(x, 200 - r() * 60); g.stroke();
  });
  // 2 CCTV quad
  at(TILE.cctv, () => {
    fill('#111417', 0, 0, S, S);
    for (let q = 0; q < 4; q++) {
      const x = (q % 2) * 128 + 4, y = Math.floor(q / 2) * 128 + 4;
      const gr = g.createLinearGradient(x, y, x, y + 120); gr.addColorStop(0, '#5b6d7a'); gr.addColorStop(1, '#22303a');
      g.fillStyle = gr; g.fillRect(x, y, 120, 120);
      g.strokeStyle = 'rgba(200,220,235,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 20, y + 120); g.lineTo(x + 50, y + 40); g.lineTo(x + 70, y + 40); g.lineTo(x + 100, y + 120); g.stroke();
      fill('#ff3b30', x + 6, y + 6, 8, 8);
    }
  });
  // 3 server front: units with LEDs
  at(TILE.serverFront, () => {
    fill('#0d0f12', 0, 0, S, S);
    for (let y = 8; y < S - 8; y += 20) {
      fill('#1d2127', 10, y, S - 20, 16);
      for (let k = 0; k < 6; k++) fill(r() < 0.7 ? '#36e07a' : r() < 0.5 ? '#3aa0ff' : '#ffb02e', 18 + k * 9, y + 6, 4, 4);
      fill('#2b3038', 90, y + 4, 140, 8);
    }
  });
  // 4 server open: cables
  at(TILE.serverOpen, () => {
    fill('#0d0f12', 0, 0, S, S);
    for (let y = 10; y < S; y += 28) {
      fill('#1d2127', 10, y, S - 20, 22);
      for (let k = 0; k < 14; k++) { g.strokeStyle = k % 3 === 0 ? '#3a8bff' : '#e8b931'; g.lineWidth = 3; g.beginPath(); g.moveTo(20 + k * 16, y + 4); g.quadraticCurveTo(30 + k * 16, y + 30, 14 + k * 16, y + 22); g.stroke(); }
    }
  });
  // 5 vending machine front
  at(TILE.vending, () => {
    fill('#15171b', 0, 0, S, S);
    fill('#2a3440', 12, 12, 170, 232);
    const cols = ['#e8433a', '#f2b632', '#3fb1e8', '#5bd26a', '#e86bb0', '#f2f2f2'];
    for (let row = 0; row < 6; row++) for (let c = 0; c < 5; c++) { fill(cols[(row + c) % cols.length], 20 + c * 32, 22 + row * 36, 22, 26); fill('rgba(255,255,255,0.35)', 22 + c * 32, 24 + row * 36, 4, 22); }
    fill('#0c0e11', 192, 30, 52, 60); fill('#5ac8ff', 198, 38, 40, 14); for (let k = 0; k < 9; k++) fill('#9aa3ad', 198 + (k % 3) * 14, 60 + Math.floor(k / 3) * 10, 10, 6);
  });
  // 6 notice board: cork, papers, red strings
  at(TILE.notice, () => {
    fill('#7a4f2a', 0, 0, S, S); fill('#b98a57', 10, 10, S - 20, S - 20);
    for (let k = 0; k < 140; k++) fill('rgba(90,55,25,0.35)', r() * S, r() * S, 2, 2);
    const pts = [];
    for (let k = 0; k < 8; k++) { const x = 20 + r() * 180, y = 20 + r() * 180; pts.push([x + 22, y + 10]); fill(k % 3 ? '#f4f1e8' : '#d8e6f0', x, y, 44, 54); fill('#9aa0a6', x + 6, y + 14, 30, 3); fill('#9aa0a6', x + 6, y + 22, 26, 3); fill('#d23a2a', x + 19, y + 3, 6, 6); }
    g.strokeStyle = '#c0261c'; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  });
  // 7 printer top panel
  at(TILE.printerPanel, () => {
    fill('#d9dbde', 0, 0, S, S); fill('#b9bdc2', 0, 150, S, 106); fill('#26313d', 30, 40, 110, 70); fill('#4fb3ff', 38, 48, 94, 54);
    for (let k = 0; k < 8; k++) fill('#7d848c', 160 + (k % 4) * 20, 50 + Math.floor(k / 4) * 24, 14, 14);
  });
  // 8 TV dashboard
  at(TILE.tvDash, () => {
    fill('#0a1622', 0, 0, S, S);
    for (let k = 0; k < 7; k++) { const h = 30 + r() * 110; fill('#2f86d6', 20 + k * 22, 220 - h, 14, h); }
    g.strokeStyle = '#4fe0a0'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 90; x += 10) g.lineTo(170 + x * 0.8, 120 - Math.sin(x * 0.1) * 30 - r() * 20); g.stroke();
    fill('#ffb02e', 170, 160, 70, 10); fill('#5a6f86', 170, 180, 50, 8); fill('#5a6f86', 20, 20, 120, 10);
  });
  // 9 elevator doors
  at(TILE.elevator, () => {
    const gr = g.createLinearGradient(0, 0, S, 0); gr.addColorStop(0, '#9aa1a8'); gr.addColorStop(0.5, '#d2d6da'); gr.addColorStop(1, '#8d949b');
    g.fillStyle = gr; g.fillRect(0, 0, S, S); fill('#4a4f55', 126, 20, 4, S - 20); fill('#2c3035', 0, 0, S, 18);
    fill('#3ad06a', 112, 4, 32, 10);
  });
  // 10 exit sign
  at(TILE.exitSign, () => {
    fill('#0f7a3a', 0, 0, S, S); fill('#1fd36b', 8, 8, S - 16, S - 16);
    g.fillStyle = '#ffffff'; g.font = 'bold 120px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', S / 2, S / 2 + 6);
  });
  // 11 book spines
  at(TILE.books, () => {
    fill('#2a1c12', 0, 0, S, S);
    const cols = ['#2e5f8a', '#7a2b2b', '#e8e2d0', '#3f6b3a', '#c8a24a', '#1d1f24', '#5a4a7a'];
    for (let x = 4; x < S - 6;) { const w = 8 + Math.floor(r() * 12); fill(cols[Math.floor(r() * cols.length)], x, 12 + r() * 30, w - 2, S - 20); x += w; }
  });
  // 12 whiteboard
  at(TILE.whiteboard, () => {
    fill('#9aa0a6', 0, 0, S, S); fill('#f6f7f8', 8, 8, S - 16, S - 16);
    g.strokeStyle = '#2a6fd6'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, 60); g.lineTo(110, 60); g.lineTo(110, 120); g.lineTo(200, 120); g.stroke();
    g.strokeStyle = '#d23a2a'; g.beginPath(); g.arc(160, 70, 26, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 5; k++) fill('#3a3f46', 30, 160 + k * 14, 60 + r() * 120, 4);
    fill('#f2d04a', 200, 180, 36, 36);
  });
  // 13 papers
  at(TILE.papers, () => {
    fill('rgba(0,0,0,0)', 0, 0, S, S);
    for (let k = 0; k < 3; k++) {
      g.save(); g.translate(60 + k * 60, 80 + k * 40); g.rotate((r() - 0.5) * 1.2);
      fill('#f3f1ea', -50, -64, 100, 128); for (let l = 0; l < 10; l++) fill('#a9adb3', -40, -52 + l * 11, 60 + r() * 20, 3);
      g.restore();
    }
  });
  // 14 broken screen
  at(TILE.brokenScreen, () => {
    fill('#06080b', 0, 0, S, S);
    g.strokeStyle = 'rgba(220,235,255,0.8)'; g.lineWidth = 2;
    for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(150, 110); g.lineTo(150 + (r() - 0.5) * 300, 110 + (r() - 0.5) * 300); g.stroke(); }
    fill('#d23a2a', 170, 120, 40, 8);
  });
  // 15 keyboard
  at(TILE.keyboard, () => {
    fill('#15171a', 0, 0, S, S);
    for (let row = 0; row < 5; row++) for (let c = 0; c < 15; c++) fill('#2c3036', 8 + c * 16, 40 + row * 34, 13, 28);
  });

  // 16 night window: city lights through tinted glass, a frame
  at(TILE.window, () => {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#0d1a2e'); gr.addColorStop(0.6, '#16253c'); gr.addColorStop(1, '#25324a');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 9; k++) { // far towers
      const x = r() * S, w = 18 + r() * 40, h = 60 + r() * 150;
      fill('#0a121f', x, S - h, w, h);
      for (let yy = S - h + 6; yy < S - 4; yy += 9) for (let xx = x + 3; xx < x + w - 3; xx += 7) if (r() < 0.35) fill(r() < 0.7 ? '#f3c76a' : '#9fd0ff', xx, yy, 3, 4);
    }
    const sh = g.createLinearGradient(0, 0, S, S); sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(0.55, 'rgba(255,255,255,0.07)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(0, 0, S, S);
    fill('#3a4048', 0, 0, S, 8); fill('#3a4048', 0, S - 8, S, 8); fill('#3a4048', 0, 0, 6, S); fill('#3a4048', S - 6, 0, 6, S); fill('#3a4048', S / 2 - 3, 0, 6, S);
  });
  // 17 rug: deep red with a patterned border
  at(TILE.rugRed, () => {
    fill('#4a2422', 0, 0, S, S); fill('#2a1d22', 12, 12, S - 24, S - 24); fill('#573028', 24, 24, S - 48, S - 48);
    g.strokeStyle = '#9c8452'; g.lineWidth = 3; g.strokeRect(18, 18, S - 36, S - 36); g.strokeRect(34, 34, S - 68, S - 68);
    g.fillStyle = '#8e7a4e';
    for (let k = 0; k < 4; k++) { g.save(); g.translate(S / 2, S / 2); g.rotate(k * Math.PI / 2); g.beginPath(); g.moveTo(0, -60); g.lineTo(22, -20); g.lineTo(0, 0); g.lineTo(-22, -20); g.closePath(); g.fill(); g.restore(); }
    for (let k = 0; k < 600; k++) fill('rgba(0,0,0,0.12)', r() * S, r() * S, 2, 2);
  });
  // 18 rug: modern grey stripes
  at(TILE.rugGrey, () => {
    fill('#5d6168', 0, 0, S, S);
    for (let y = 0; y < S; y += 16) fill(y % 32 ? '#6a6e75' : '#50545a', 0, y, S, 8);
    fill('#3d4046', 0, 0, S, 10); fill('#3d4046', 0, S - 10, S, 10);
    for (let k = 0; k < 700; k++) fill('rgba(255,255,255,0.05)', r() * S, r() * S, 2, 2);
  });
  // 19 locker fronts
  at(TILE.lockers, () => {
    fill('#5b636d', 0, 0, S, S);
    for (let k = 0; k < 4; k++) {
      const x = k * 64;
      fill('#6f7883', x + 3, 3, 58, S - 6); fill('#4a525b', x + 3, S / 2 - 2, 58, 4);
      for (let v = 0; v < 5; v++) fill('#3c434b', x + 14, 18 + v * 8, 36, 3);
      fill('#c9ced4', x + 48, S / 2 - 30, 5, 18); fill('#c9ced4', x + 48, S / 2 + 14, 5, 18);
    }
  });
  // 20 framed photo
  at(TILE.photo, () => {
    fill('#1b1b1d', 0, 0, S, S); fill('#d9d4c8', 16, 16, S - 32, S - 32);
    const gr = g.createLinearGradient(0, 30, 0, S - 30); gr.addColorStop(0, '#7db0d8'); gr.addColorStop(1, '#d6a96a'); g.fillStyle = gr; g.fillRect(30, 30, S - 60, S - 60);
    fill('#3c5a3a', 30, S - 90, S - 60, 60); g.fillStyle = '#5b4a3a'; g.beginPath(); g.arc(120, 140, 22, 0, Math.PI * 2); g.fill();
  });
  // 21 clock face
  at(TILE.clock, () => {
    fill('rgba(0,0,0,0)', 0, 0, S, S);
    g.fillStyle = '#222'; g.beginPath(); g.arc(S / 2, S / 2, 124, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2f1ec'; g.beginPath(); g.arc(S / 2, S / 2, 112, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 6;
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * 92, S / 2 + Math.sin(a) * 92); g.lineTo(S / 2 + Math.cos(a) * 104, S / 2 + Math.sin(a) * 104); g.stroke(); }
    g.lineWidth = 8; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + 40, S / 2 - 40); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 - 10, S / 2 + 80); g.stroke();
    g.strokeStyle = '#c0261c'; g.lineWidth = 2; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 - 70, S / 2 - 30); g.stroke();
  });
  // 22 poster (company motto / map)
  at(TILE.poster, () => {
    fill('#101820', 0, 0, S, S); fill('#1c2c40', 12, 12, S - 24, S - 24);
    g.strokeStyle = '#4fa3ff'; g.lineWidth = 2; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(S / 2, S / 2 - 10, 20 + k * 10, 0, Math.PI * 2); g.stroke(); }
    fill('#e8eef5', 40, S - 70, S - 80, 14); fill('#7f93a8', 60, S - 48, S - 120, 8);
  });
  // 23 mug top (coffee)
  at(TILE.mug, () => {
    fill('rgba(0,0,0,0)', 0, 0, S, S);
    g.fillStyle = '#f2efe9'; g.beginPath(); g.arc(S / 2, S / 2, 120, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3b2416'; g.beginPath(); g.arc(S / 2, S / 2, 96, 0, Math.PI * 2); g.fill();
  });
  return canvas;
}
