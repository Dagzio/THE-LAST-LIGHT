// KILL LIST (D78): runtime of one level attempt — created fresh on every start / retry, holds only temporary data
// (the permanent profile is core/Progress.js). Update order: hero → weapon → grenades input → doors → enemy AI →
// bullets → grenades → pickups / objectives → result. The result (defeat or victory) is decided exactly once.
import { Player } from '../entities/Player.js';
import { Human } from '../entities/Human.js';
import { ProjectilePool } from '../entities/ProjectilePool.js';
import { PlayerController } from '../systems/PlayerController.js';
import { WeaponSystem, WeaponState } from '../systems/WeaponSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { HumanAISystem } from '../systems/HumanAISystem.js';
import { GrenadeSystem } from '../systems/GrenadeSystem.js';
import { AutoAim } from '../systems/AutoAim.js';
import { SeededRandom } from './SeededRandom.js';
import { LevelWorld, DOOR } from './LevelWorld.js';
import { Particles } from '../render/Particles.js';
import { WEAPONS, HERO_WEAPONS, getWeapon } from '../data/weapons.js';
import { HUMAN_TYPES } from '../data/humans.js';
import { CAPS } from '../data/balance.js';
import { FACING, INTERACT, COVER, muzzleOf, barrelOffsetAngle } from '../data/player.js';

const AIM = { x: 0, y: 0 };
const BODY_FADE = 30; // s a dead body stays (presentation; bodies never block anything)

export class MissionRun {
  /**
   * @param {object} level data/levels/*.js
   * @param {number} runSeed
   * @param {import('./GameEvents.js').GameEvents} events
   */
  constructor(level, runSeed, events) {
    this.level = level;
    this.map = level;          // UI / renderer contract (name, size)
    this.mapId = level.id;
    this.runSeed = runSeed;
    this.events = events;
    this.rng = new SeededRandom(runSeed);
    this.stats = { kills: 0, shotsFired: 0, hits: 0, damageTaken: 0, time: 0, spotted: false };
    this.defeat = null;
    this.victory = false;
    this.lastTime = 0;

    this.levelWorld = new LevelWorld(level);
    this.world = this.levelWorld.world;
    this.doors = this.levelWorld.doors;

    const sp = level.playerSpawn;
    this.player = new Player(sp.x, sp.y);
    this.player.aimAngle = this.player.bodyAngle = sp.angle || 0;
    this.player.facingX = Math.cos(this.player.aimAngle);
    this.player.facingY = Math.sin(this.player.aimAngle);
    this.projectiles = new ProjectilePool(CAPS.projectiles);
    this.particles = new Particles(CAPS.particles);

    // weapons: the pistol at start (user decision); the SMG from a crate. Each keeps its own magazine.
    this.inventory = ['pistol'];
    this.weaponStates = { pistol: new WeaponState(WEAPONS.pistol) };
    this.weapon = this.weaponStates.pistol;
    this.weaponStats = this.weapon.stats;

    this.controller = new PlayerController(events, { w: level.width, h: level.height });
    this.controller.world = this.world;
    this.weapons = new WeaponSystem(this.projectiles, this.rng, events);
    this.weapons.world = this.world;
    this.projectileSystem = new ProjectileSystem(this.projectiles, this.rng, events, (id) => this._statsFor(id));
    this.projectileSystem.world = this.world;
    this.projectileSystem.player = this.player;
    this.grenades = new GrenadeSystem(this.rng, events);
    this.grenades.world = this.world;
    this.grenadePreview = { active: false, x: 0, y: 0 };
    this._gTarget = { x: 0, y: 0 };
    this.grenadeArmed = null;
    this._gWaitUp = false;
    this._gFire = false;
    this.holdFire = false;
    this.autoFire = false;
    this.autoAim = new AutoAim();
    this.autoAim.world = this.world;

    this.enemies = [];
    this.ai = new HumanAISystem(events, new SeededRandom((runSeed ^ 0x51ed270b) >>> 0), this.projectiles, this.levelWorld);
    for (const s of level.enemies) this._spawnEnemy(s);
    this.reinforced = false;

    // pickups / crates / objectives
    this.pickups = level.pickups.map((def) => ({ def, taken: false, openedAt: -1 }));
    this.has = { keycard: false, drive: false };
    this.objectiveIndex = 0;
    this.interactTarget = null;  // the crate in reach (E / touch button)

    this._unsub = [
      events.on('shot', (x, y, angle, weaponId) => {
        this.stats.shotsFired += 1;
        this.particles.cone(x, y, angle, 0.6, 4, 240, 0.1, 2, '#ffd27a');
        const p = this.player;
        this.particles.cone(p.x, p.y, angle + Math.PI / 2, 0.5, 1, 110, 0.45, 2, '#c99a3e'); // a brass casing
        const W = getWeapon(weaponId);
        this.ai.hear(this.enemies, x, y, (W && W.noise) || 500, this.lastTime);
      }),
      events.on('enemyShot', (x, y, angle) => this.particles.cone(x, y, angle, 0.6, 3, 220, 0.1, 2, '#ffcf70')),
      events.on('hit', (x, y, amount, crit, target) => {
        this.stats.hits += 1;
        this.particles.burst(x, y, 5, 150, 0.25, 2.2, '#8a1c1c');
        this.particles.burst(x, y, 2, 260, 0.1, 2.4, '#ffe2c4', 8);
        if (target && target.ai) this.ai.onHit(target, this.player, this.lastTime);
      }),
      events.on('kill', (e) => this._onKill(e)),
      events.on('playerHit', (x, y, amount) => {
        this.stats.damageTaken += amount;
        this.particles.burst(x, y, 7, 150, 0.28, 2.4, '#b3261e');
      }),
      events.on('bulletBlocked', (x, y) => this.particles.burst(x, y, 4, 120, 0.16, 1.8, '#d7d2c8')),
      events.on('grenadeBlast', (type, x, y, r) => {
        this.particles.burst(x, y, 26, r * 2.4, 0.5, 3, '#ffb070');
        this.ai.hear(this.enemies, x, y, 700, this.lastTime);
      }),
      events.on('spotted', () => { this.stats.spotted = true; }),
    ];
  }

  // ---------------- spawning ----------------
  _spawnEnemy(s, hunting = false) {
    const type = HUMAN_TYPES[s.type];
    if (!type) return null;
    const e = new Human(type, WEAPONS[type.weapon], s);
    this.world.pushOut(e);
    this.enemies.push(e);
    if (hunting) this.ai.alert(e, this.player.x, this.player.y, this.lastTime);
    this.events.emit('enemySpawn', e);
    return e;
  }

  _statsFor(id) { return this.weaponStates[id] ? this.weaponStates[id].stats : getWeapon(id); }

  // ---------------- weapons ----------------
  /** Equip a carried weapon (1 / 2 / Q / the HUD weapon block). Each weapon keeps its magazine; a reload is dropped. */
  switchWeapon(id = null) {
    if (this.over || !this.player.alive) return false;
    const inv = this.inventory;
    const next = id || inv[(inv.indexOf(this.weapon.weaponId) + 1) % inv.length];
    const w = this.weaponStates[next];
    if (!w || w === this.weapon) return false;
    if (this.weapon.reloading) this.weapon.reloading = false; // the next reload starts over
    this.weapon = w;
    this.weaponStats = w.stats;
    w.nextShotAt = Math.max(w.nextShotAt, this.lastTime + 0.25); // a moment to bring it up
    this.events.emit('weaponSwitch', next);
    return true;
  }

  get equippedWeaponId() { return this.weapon.weaponId; }

  // ---------------- grenades: G / the button arms one; the next fire press aims it, the release throws ----------------
  armGrenade(type = 'frag') {
    const g = this.grenades;
    if (this.grenadeArmed === type) { this.grenadeArmed = null; return true; } // a second press puts it away
    if (!(type in g.stock) || !(g.stock[type] > 0) || !this.player.alive) return false;
    g.select(type);
    this.grenadeArmed = type;
    this._gWaitUp = true;
    this._gFire = false;
    return true;
  }

  _grenadeInput(input, time) {
    const g = this.grenades, p = this.player, pv = this.grenadePreview;
    if (input.consumePressed('throwGrenade')) this.armGrenade('frag');
    if (this.grenadeArmed && !(g.stock[this.grenadeArmed] > 0)) this.grenadeArmed = null;
    pv.active = false;
    const armed = this.grenadeArmed;
    const edge = !!(input.consumePressed && input.consumePressed('fire')) && !this.holdFire;
    if (!armed || !p.alive) { this._gFire = false; return; }
    const fire = input.isDown('fire') && !this.holdFire;
    let a = input.getAimWorld ? input.getAimWorld(AIM) : null;
    if (!a && edge && !fire && input.getLastAimWorld) a = input.getLastAimWorld(AIM);
    if (a) {
      GrenadeSystem.landing(p.x, p.y, a.x, a.y, pv);
      pv.active = true;
      this._gTarget.x = pv.x; this._gTarget.y = pv.y;
    }
    if (edge) { this._gWaitUp = false; this._gFire = true; }
    if (this._gWaitUp) { if (!fire) this._gWaitUp = false; return; }
    if (fire) { this._gFire = true; return; }
    if (this._gFire) {
      this._gFire = false;
      if (!a) pv.active = false;
      g.select(armed);
      if (g.throw(p, this._gTarget.x, this._gTarget.y, time)) this.grenadeArmed = null;
    }
  }

  cancelGrenadeAim() { this._gFire = false; this._gWaitUp = true; this.holdFire = false; this.grenadePreview.active = false; }

  /** D82: behind low cover he crouches — except while shooting and a moment after (he stands up to fire). */
  _updateCover(p, shooting, time) {
    if (shooting && p.cover && p.cover.kind === 'low') p.exposedUntil = time + COVER.popUp;
    p.crouched = !!p.cover && p.cover.kind === 'low' && p.alive && !p.dodging && time >= p.exposedUntil;
  }

  /**
   * D76 facing (kept): the body faces the movement; while shooting / aiming (and a moment after) and standing with a
   * mouse it faces the aim — then the arms hold the gun up at it (aimPose) and the body turns so that the BARREL line
   * goes through the aim point (D82: the gun is beside the body's centre). In cover, not shooting: crouched he faces
   * the low object (looks over it), pressed against high cover he has his back to it.
   */
  _updateFacing(p, shooting, time) {
    if (!p.alive) { p.aimPose = false; return; }
    if (shooting || this.grenadePreview.active) p.faceAimUntil = time + FACING.aimHold;
    const moving = p.dodging || Math.hypot(p.vx, p.vy) > 1;
    const mouse = p.hasAim && !this.autoFire;
    const firing = time < p.faceAimUntil;
    const cover = p.cover && !firing && !moving ? p.cover : null;
    p.aimPose = false;
    if (p.dodging) p.bodyAngle = Math.atan2(p.dodgeDirY, p.dodgeDirX);
    else if (cover) p.bodyAngle = cover.kind === 'low' ? Math.atan2(-cover.ny, -cover.nx) : Math.atan2(cover.ny, cover.nx);
    else if (firing || (mouse && (!moving || FACING.alwaysAimMouse))) {
      const d = Math.hypot(p.aimX - p.x, p.aimY - p.y);
      p.bodyAngle = p.aimAngle - (p.hasAim ? barrelOffsetAngle(muzzleOf(this.weapon.stats.gun), d) : 0);
      p.aimPose = true;
    } else if (moving) p.bodyAngle = Math.atan2(p.facingY, p.facingX);
    if (this.autoFire && !this.autoAim.target && !this.grenadeArmed && time >= p.faceAimUntil) p.aimAngle = p.bodyAngle;
  }

  /** True while the hero holds the gun up at the aim — the renderer's aim pose. */
  get heroAiming() { return this.player.alive && this.player.aimPose; }

  // ---------------- pickups, crates, objectives ----------------
  _pickup(pk, time) {
    const d = pk.def, p = this.player;
    if (d.kind === 'medkit') {
      if (p.hp >= p.maxHp) return false; // stays for later
      p.hp = Math.min(p.maxHp, p.hp + INTERACT.medkitHeal);
    } else if (d.kind === 'keycard') this.has.keycard = true;
    else if (d.kind === 'drive') this.has.drive = true;
    pk.taken = true;
    this.events.emit('pickup', d.kind, d.id);
    if (d.kind === 'drive') this._onDrive(time);
    return true;
  }

  /** Opens the crate in reach (E / the touch button): its item goes to the hero once. */
  interact(time = this.lastTime) {
    const pk = this.interactTarget;
    if (!pk || pk.openedAt >= 0 || this.over || !this.player.alive) return false;
    pk.openedAt = time;
    const d = pk.def;
    if (d.item === 'smg' && !this.inventory.includes('smg')) {
      this.inventory.push('smg');
      this.weaponStates.smg = new WeaponState(WEAPONS.smg);
      this.switchWeapon('smg');
    } else if (d.item === 'grenades') {
      this.grenades.add('frag', d.count || 1);
    }
    this.events.emit('crateOpened', d.item, d.count || 1, d.id);
    this.interactTarget = null;
    return true;
  }

  get canInteract() { return !!this.interactTarget && !this.over && this.player.alive; }

  _updatePickups(time) {
    const p = this.player;
    if (!p.alive) { this.interactTarget = null; return; }
    let best = null, bestD = Infinity;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const d = Math.hypot(p.x - pk.def.x, p.y - pk.def.y);
      if (pk.def.kind === 'crate') {
        if (pk.openedAt < 0 && d <= INTERACT.radius + p.radius && d < bestD) { best = pk; bestD = d; }
      } else if (d <= INTERACT.pickupRadius + p.radius) this._pickup(pk, time);
    }
    this.interactTarget = best;
    // the hero with the key card unlocks a key-card door from close by
    if (this.has.keycard) {
      for (const dr of this.doors) {
        if (!dr.locked || dr.def.lock !== 'keycard') continue;
        if (Math.hypot(p.x - dr.def.x, p.y - dr.def.y) <= DOOR.unlockDist + dr.def.width / 2) {
          dr.locked = false;
          this.events.emit('doorUnlocked', dr.id);
        }
      }
    }
  }

  /** The level's turn: the drive is taken — the exit opens and the reinforcements come in hunting the hero. */
  _onDrive() {
    for (const dr of this.doors) if (dr.def.lock === 'drive' && dr.locked) { dr.locked = false; this.events.emit('doorUnlocked', dr.id); }
    const R = this.level.reinforcements;
    if (R && !this.reinforced) {
      this.reinforced = true;
      for (const s of R.enemies) this._spawnEnemy(s, true);
      this.events.emit('reinforcements', R.enemies.length);
    }
  }

  get objective() { return this.level.objectives[this.objectiveIndex] || null; }

  /** World point of the current objective (HUD arrow / marker), or null. */
  objectiveTarget(out = {}) {
    const o = this.objective;
    if (!o) return null;
    if (o.target === 'exit') { out.x = this.level.exit.x; out.y = this.level.exit.y; return out; }
    const pk = this.pickups.find((k) => k.def.id === o.target);
    if (!pk) return null;
    out.x = pk.def.x; out.y = pk.def.y;
    return out;
  }

  _updateObjectives() {
    const o = this.objective;
    if (!o) return;
    const done = o.target === 'keycard' ? this.has.keycard : o.target === 'drive' ? this.has.drive : false;
    if (done) {
      this.objectiveIndex += 1;
      this.events.emit('objective', this.objectiveIndex, this.objective);
    }
    if (o.target === 'exit' && this.has.drive) {
      const r = this.level.exit.rect, p = this.player;
      if (p.x >= r[0] && p.x <= r[2] && p.y >= r[1] && p.y <= r[3]) this._setVictory();
    }
  }

  _onKill(e) {
    if (!e || e.reported) return;
    e.reported = true;
    this.stats.kills += 1;
    this.particles.burst(e.x, e.y, 10, 120, 0.4, 2.6, '#7a1414');
  }

  get over() { return !!this.defeat || this.victory; }

  /** Living enemies left. */
  get enemiesLeft() { let n = 0; for (const e of this.enemies) if (e.alive) n++; return n; }

  // ---------------- step ----------------
  /** @param {import('../platform/InputManager.js').InputManager} input */
  update(input, dt, time) {
    if (this.over) return;
    this.lastTime = time;
    this.stats.time += dt;
    const p = this.player;
    p.prevX = p.x; p.prevY = p.y;
    for (let i = 0; i < this.enemies.length; i++) { const e = this.enemies[i]; e.prevX = e.x; e.prevY = e.y; }
    this.controller.update(p, input, dt, time);

    if (input.consumePressed('switchWeapon')) this.switchWeapon();
    if (input.consumePressed('weapon1')) this.switchWeapon(HERO_WEAPONS[0]);
    if (input.consumePressed('weapon2') && this.inventory.includes(HERO_WEAPONS[1])) this.switchWeapon(HERO_WEAPONS[1]);
    if (input.consumePressed('interact')) this.interact(time);

    let fire = this.autoFire ? false : input.isDown('fire');
    if (this.autoFire && !this.holdFire && !this.grenadeArmed) fire = !!this.autoAim.update(p, this.enemies, this.weapon.stats.range);
    else this.autoAim.reset();
    const shooting = fire && !this.holdFire && !this.grenadeArmed && !p.dodging; // D82: no shots mid-roll
    this.weapons.update(this.weapon, p, shooting, input.consumePressed('reload'), time);
    this._grenadeInput(input, time);
    this._updateCover(p, shooting, time);
    this._updateFacing(p, shooting, time);

    this.levelWorld.updateDoors(this._bodies(), time, dt);
    this.ai.update(this.enemies, p, dt, time);
    this.projectileSystem.update(this.enemies, dt, time);
    this.grenades.update(this.enemies, time);
    this._updatePickups(time);
    this._updateObjectives();
    if (!p.alive) this._setDefeat('player');

    for (let i = this.enemies.length - 1; i >= 0; i--) { // bodies vanish after a long while (never during a fight)
      const e = this.enemies[i];
      if (!e.alive && time - e.deathAt > BODY_FADE) this.enemies.splice(i, 1);
    }
    this.particles.update(dt);
  }

  _bodies() {
    const b = this._bodyList || (this._bodyList = []);
    b.length = 0;
    b.push(this.player);
    for (const e of this.enemies) if (e.alive) b.push(e);
    return b;
  }

  _setDefeat(reason) {
    if (this.over) return;
    this.defeat = reason;
    this.events.emit('mapDefeat', reason);
  }

  _setVictory() {
    if (this.over) return;
    this.victory = true;
    this.events.emit('mapVictory', this.mapId);
  }

  dispose() {
    for (const u of this._unsub) u();
    this._unsub = [];
    this.projectiles.clear();
    this.particles.clear();
    this.grenades.clear();
    this.enemies.length = 0;
  }
}

