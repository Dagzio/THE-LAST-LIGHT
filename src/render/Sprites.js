// Procedural top-down sprites (placeholder art, decision D9). Drawn once into offscreen canvases,
// facing +X; the renderer rotates them. Final art replaces these through the asset manifest
// (prompts: art-prompts/02_PLAYER_COMBAT.md).
import { makeCanvas } from './ProceduralArt.js';

function sprite(size, draw) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  draw(g);
  return c;
}

/** White silhouette of a sprite (hit flash). */
function flashOf(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,240,230,0.92)';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** The keeper: long coat, wide-brim hat, pistol arm forward, amber lantern on the belt. */
function drawPlayer(g) {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.ellipse(2, 3, 22, 18, 0, 0, Math.PI * 2); g.fill();
  // coat tails (behind)
  g.fillStyle = '#1f2633';
  g.beginPath(); g.ellipse(-8, 0, 15, 17, 0, 0, Math.PI * 2); g.fill();
  // shoulders
  g.fillStyle = '#334055';
  g.beginPath(); g.ellipse(0, 0, 13, 19, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,190,110,0.55)'; // amber rim light
  g.lineWidth = 1.5;
  g.stroke();
  // pistol arm
  g.fillStyle = '#2a3343';
  g.fillRect(2, 5, 17, 6);
  g.fillStyle = '#9aa3ad';
  g.fillRect(17, 6, 12, 4);
  g.fillStyle = '#5c6570';
  g.fillRect(17, 9, 4, 4);
  // off-hand
  g.fillStyle = '#2a3343';
  g.fillRect(0, -11, 10, 5);
  // hat brim + crown
  g.fillStyle = '#2b1f17';
  g.beginPath(); g.arc(1, 0, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3d2d21';
  g.beginPath(); g.arc(1, 0, 7, 0, Math.PI * 2); g.fill();
  // lantern on the belt
  g.fillStyle = '#ffcf7a';
  g.beginPath(); g.arc(-9, 13, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,190,110,0.35)';
  g.beginPath(); g.arc(-9, 13, 7, 0, Math.PI * 2); g.fill();
}

/** Grunt: hunched fog creature — wide humped back, spine ridges, claws forward, ember eyes. */
function drawGrunt(g) {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.ellipse(2, 3, 21, 17, 0, 0, Math.PI * 2); g.fill();
  // claws
  g.fillStyle = '#2a0e14';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(8, s * 9); g.lineTo(24, s * 13); g.lineTo(21, s * 7); g.lineTo(25, s * 4); g.lineTo(9, s * 3);
    g.closePath(); g.fill();
  }
  // body
  g.fillStyle = '#5a1c26';
  g.beginPath(); g.ellipse(-2, 0, 17, 15, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6e2531';
  g.beginPath(); g.ellipse(2, 0, 11, 11, 0, 0, Math.PI * 2); g.fill();
  // spine ridges
  g.fillStyle = '#2a0e14';
  for (let i = 0; i < 4; i++) {
    const x = -14 + i * 6;
    g.beginPath(); g.moveTo(x, -3); g.lineTo(x - 5, 0); g.lineTo(x, 3); g.closePath(); g.fill();
  }
  // eyes
  g.fillStyle = '#ff7a5a';
  g.beginPath(); g.arc(10, -4, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(10, 4, 2, 0, Math.PI * 2); g.fill();
}

function drawBullet(g) {
  const grad = g.createLinearGradient(-12, 0, 6, 0);
  grad.addColorStop(0, 'rgba(255,170,80,0)');
  grad.addColorStop(0.7, 'rgba(255,200,120,0.9)');
  grad.addColorStop(1, 'rgba(255,245,220,1)');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(-3, 0, 10, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff6e0';
  g.beginPath(); g.arc(5, 0, 2, 0, Math.PI * 2); g.fill();
}

function drawMuzzle(g) {
  g.fillStyle = 'rgba(255,220,140,0.95)';
  g.beginPath();
  g.moveTo(-2, 0); g.lineTo(6, -6); g.lineTo(9, -2); g.lineTo(16, 0); g.lineTo(9, 2); g.lineTo(6, 6);
  g.closePath(); g.fill();
  g.fillStyle = '#fffaf0';
  g.beginPath(); g.arc(2, 0, 3, 0, Math.PI * 2); g.fill();
}

export function createSprites() {
  const player = sprite(72, drawPlayer);
  const grunt = sprite(64, drawGrunt);
  return {
    player,
    grunt,
    gruntFlash: flashOf(grunt),
    bullet: sprite(28, drawBullet),
    muzzle: sprite(36, drawMuzzle),
  };
}
