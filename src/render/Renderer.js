// Canvas 2D renderer. Reads state only — never mutates game state (rule 12).
// Static layers are cached in offscreen canvases and rebuilt only when the viewport buffer,
// the map or the quality preset changes; the per-frame work is a few drawImage calls.
import { WORLD_WIDTH as W, WORLD_HEIGHT as H } from '../config/constants.js';
import {
  makeCanvas, makeGlowSprite, makeBeamSprite, drawBackdropStatic, drawArenaGround, BACKDROP_LANTERN,
} from './ProceduralArt.js';
import { createSprites } from './Sprites.js';
import { ENEMY_FX } from '../data/balance.js';

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

export class Renderer {
  /** @param {HTMLCanvasElement} canvas @param {import('../platform/Viewport.js').Viewport} viewport */
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.layers = { backdrop: null, arena: null };
    this.layerKeys = { backdrop: '', arena: '' };
    this.rect = { x: 0, y: 0, w: W, h: H };
    // Sprites are created once and reused by every frame.
    this.sprites = {
      beam: makeBeamSprite(760, 120),
      lanternGlow: makeGlowSprite(90, 'rgba(255,200,120,0.9)'),
      fog: makeGlowSprite(220, 'rgba(150,170,200,0.10)'),
    };
    this.entitySprites = createSprites();
  }

  _layer(name, key, draw) {
    if (this.layerKeys[name] === key && this.layers[name]) return this.layers[name];
    const vp = this.viewport;
    const c = this.layers[name] && this.layers[name].width === vp.bufferWidth && this.layers[name].height === vp.bufferHeight
      ? this.layers[name] : makeCanvas(vp.bufferWidth, vp.bufferHeight);
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    vp.applyWorldTransform(g);
    draw(g, vp.visibleWorldRect(this.rect));
    this.layers[name] = c;
    this.layerKeys[name] = key;
    return c;
  }

  /**
   * @param {{scene:'backdrop'|'arena', realTime:number, simTime:number, quality:string,
   *          mapSeed?:number, probe?:{x:number,y:number}|null}} view
   */
  render(view) {
    const vp = this.viewport;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (view.scene === 'arena') this._renderArena(g, view);
    else this._renderBackdrop(g, view);
  }

  _renderBackdrop(g, view) {
    const vp = this.viewport;
    const layer = this._layer('backdrop', `${vp.version}`, drawBackdropStatic);
    g.drawImage(layer, 0, 0);
    vp.applyWorldTransform(g);
    const t = view.realTime;
    const rect = vp.visibleWorldRect(this.rect);

    // Drifting fog (decorative, real time — menus are not part of the simulation).
    const fogCount = view.quality === 'low' ? 2 : 4;
    const fog = this.sprites.fog;
    for (let i = 0; i < fogCount; i++) {
      const speed = 8 + i * 5;
      const span = rect.w + fog.width;
      const fx = rect.x - fog.width + ((t * speed + i * 410) % span);
      const fy = 330 + i * 60;
      g.drawImage(fog, fx, fy - fog.height / 2, fog.width * 1.6, fog.height);
    }

    // Lighthouse beam sweeping around the vertical axis (side view): two opposite beams.
    const { x: lx, y: ly } = BACKDROP_LANTERN;
    const phase = t * (Math.PI * 2 / 14); // 14 s per revolution, as the beacon in the GDD
    const beam = this.sprites.beam;
    g.save();
    g.translate(lx, ly);
    g.globalCompositeOperation = 'lighter';
    for (const side of [1, -1]) {
      const sx = Math.cos(phase) * side;
      if (Math.abs(sx) < 0.02) continue;
      g.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(phase) * side * 0.5 + 0.5);
      g.save();
      g.scale(sx, 1);
      g.drawImage(beam, 0, -beam.height / 2);
      g.restore();
    }
    g.globalAlpha = 0.8 + 0.2 * Math.sin(t * 3.1);
    const glow = this.sprites.lanternGlow;
    g.drawImage(glow, -glow.width / 2, -glow.height / 2);
    g.restore();
  }

  _renderArena(g, view) {
    const vp = this.viewport;
    const seed = view.mapSeed || 1;
    const layer = this._layer('arena', `${vp.version}|${seed}`, (lg, rect) => drawArenaGround(lg, rect, seed));
    g.drawImage(layer, 0, 0);
    vp.applyWorldTransform(g);

    // Fog wisps driven by SIMULATION time: they freeze when the game is paused (H5 §5).
    const t = view.simTime;
    const fog = this.sprites.fog;
    const fogCount = view.quality === 'low' ? 2 : 3;
    for (let i = 0; i < fogCount; i++) {
      const fx = -fog.width + ((t * (10 + i * 4) + i * 520) % (W + fog.width * 2));
      const fy = 140 + i * 210;
      g.drawImage(fog, fx, fy - fog.height / 2, fog.width * 1.8, fog.height);
    }

    if (view.run) this._renderRun(g, view.run, t, view.quality);
  }

  /** Entities of the current map run. Reads state only. Order: enemies → projectiles → player → fx → bars. */
  _renderRun(g, run, t, quality) {
    const S = this.entitySprites;
    const player = run.player;

    // Enemies (with death fade and hit flash).
    for (const e of run.enemies) {
      const dead = !e.alive;
      const fade = dead ? Math.max(0, 1 - (t - e.deathAt) / ENEMY_FX.deathFade) : 1;
      if (fade <= 0) continue;
      const face = Math.atan2(player.y - e.y, player.x - e.x);
      const flash = !dead && t - e.lastHitAt < ENEMY_FX.hitFlash;
      g.globalAlpha = fade;
      this._drawRotated(g, flash ? S.gruntFlash : S.grunt, e.x, e.y, face, dead ? 1 + (1 - fade) * 0.25 : 1);
    }
    g.globalAlpha = 1;

    // Target marker (gameplay signal: who the gun is shooting at).
    const target = run.target;
    if (target && target.alive) this._drawTargetMarker(g, target, t);

    // Projectiles.
    const bullet = S.bullet;
    for (const p of run.projectiles.items) {
      if (p.active) this._drawRotated(g, bullet, p.x, p.y, p.angle, 1);
    }

    // Player: dodge ghosts (decorative, off on LOW), i-frame flicker, muzzle flash.
    if (player.alive) {
      const aim = player.aimAngle;
      if (player.dodging && quality !== 'low') {
        for (let k = 1; k <= 2; k++) {
          g.globalAlpha = 0.22 / k;
          this._drawRotated(g, S.player, player.x - player.vx * 0.025 * k, player.y - player.vy * 0.025 * k, aim, 1);
        }
      }
      g.globalAlpha = player.isInvulnerable(t) && Math.floor(t * 30) % 2 === 0 ? 0.55 : 1;
      this._drawRotated(g, S.player, player.x, player.y, aim, 1);
      g.globalAlpha = 1;
      if (t - run.weapon.lastShotAt < 0.06) {
        const mx = player.x + Math.cos(aim) * 30, my = player.y + Math.sin(aim) * 30;
        this._drawRotated(g, S.muzzle, mx, my, aim, 1);
      }
      // Reload arc above the player.
      if (run.weapon.reloading) {
        const prog = run.weapon.reloadProgress(t);
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.beginPath(); g.arc(player.x, player.y - 34, 9, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#ffd27a';
        g.beginPath(); g.arc(player.x, player.y - 34, 9, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke();
      }
    }

    // Particles (decorative).
    for (const p of run.particles.items) {
      if (!p.active) continue;
      g.globalAlpha = p.life / p.maxLife;
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;

    // Enemy health bars (only when damaged).
    for (const e of run.enemies) {
      if (!e.alive || e.hp >= e.maxHp) continue;
      const w = 34, h = 4, x = e.x - w / 2, y = e.y - e.radius - 12;
      g.fillStyle = 'rgba(0,0,0,0.65)';
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = '#d2453a';
      g.fillRect(x, y, w * (e.hp / e.maxHp), h);
    }
  }

  _drawRotated(g, img, x, y, angle, scale) {
    const c = Math.cos(angle) * scale, s = Math.sin(angle) * scale;
    g.save();
    g.transform(c, s, -s, c, x, y);
    g.drawImage(img, -img.width / 2, -img.height / 2);
    g.restore();
  }

  _drawTargetMarker(g, e, t) {
    const r = e.radius + 8 + Math.sin(t * 8) * 1.5;
    const k = 7;
    g.strokeStyle = 'rgba(255,200,120,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    for (const [sx, sy] of CORNERS) {
      const cx = e.x + sx * r, cy = e.y + sy * r;
      g.moveTo(cx - sx * k, cy); g.lineTo(cx, cy); g.lineTo(cx, cy - sy * k);
    }
    g.stroke();
  }

  /** Small preview of a map for the map-select card (drawn once into its own canvas). */
  static drawMapThumb(canvas, seed) {
    const g = canvas.getContext('2d');
    const s = Math.min(canvas.width / W, canvas.height / H);
    g.setTransform(s, 0, 0, s, (canvas.width - W * s) / 2, (canvas.height - H * s) / 2);
    drawArenaGround(g, { x: -W, y: -H, w: W * 3, h: H * 3 }, seed);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
