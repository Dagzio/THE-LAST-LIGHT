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
import { WEAPONS, getWeapon } from '../data/weapons.js';
import { StealthDirector } from '../systems/StealthDirector.js';
import { SurvivalDirector } from '../systems/SurvivalDirector.js';
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
    // D85: a mode may start with another loadout (stealth: the silenced pistol)
    this.modeId = level.modeId || 'mission';
    const L = level.loadout || { weapons: ['pistol'], grenades: {} };
    this.inventory = [...L.weapons];
    this.weaponStates = {};
    for (const id of L.weapons) this.weaponStates[id] = new WeaponState(WEAPONS[id]);
    this.weapon = this.weaponStates[this.inventory[0]];
    this.weaponStats = this.weapon.stats;
    this.bodyFade = level.bodyFade ?? BODY_FADE;

    this.controller = new PlayerController(events, { w: level.width, h: level.height });
    this.controller.world = this.world;
    this.controller.rng = this.rng; // D83: which roll clip
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

    // pickups / crates / objectives (D85: dormant pickups wait for the survival director; item / count per crate)
    this.pickups = level.pickups.map((def) => ({ def, taken: !!def.dormant, openedAt: -1, item: def.item ?? null, count: def.count || 1, until: Infinity }));
    this.has = { keycard: false, drive: false, copy: false };
    this.intel = 0;
    this.copyProgress = 0;
    this.objectiveIndex = 0;
    this.interactTarget = null;  // the crate in reach (E / touch button)
    for (const [t, n] of Object.entries(L.grenades || {})) this.grenades.add(t, n);
    // D85: the mode's director (stealth / survival rules); the mission has none
    this.mode = this.modeId === 'stealth' ? new StealthDirector(this) : this.modeId === 'survival' ? new SurvivalDirector(this) : null;

    this._unsub = [
      events.on('shot', (x, y, angle, weaponId) => {
        this.stats.shotsFired += 1;
        this.particles.cone(x, y, angle, 0.6, 4, 240, 0.1, 2, '#ffd27a');
        const p = this.player;
        this.particles.cone(p.x, p.y, angle + Math.PI / 2, 0.5, 1, 110, 0.45, 2, '#c99a3e'); // a brass casing
        const W = getWeapon(weaponId), noise = (W && W.noise) || 500;
        if (this.ai.stealth) this.noise(x, y, noise, noise > 300 ? 'loud' : 'quiet'); // D85
        else this.ai.hear(this.enemies, x, y, noise, this.lastTime);
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
        if (this.ai.stealth) this.noise(x, y, 700, 'loud');
        else this.ai.hear(this.enemies, x, y, 700, this.lastTime);
      }),
      events.on('spotted', () => { this.stats.spotted = true; }),
    ];
  }

  /** D85: a noise of the hero / the fight (stealth): the enemies around hear it; the renderer draws the ring. */
  noise(x, y, radius, kind = 'quiet') {
    this.events.emit('noise', x, y, radius, kind);
    if (this.ai.stealth) this.ai.hearStealth(this.enemies, x, y, radius, kind, this.lastTime);
  }

  // ---------------- spawning ----------------
  /** @param {object} s spawn data  @param {boolean} hunting  @param {object|null} typeOverride / weaponOverride (survival scaling) */
  _spawnEnemy(s, hunting = false, typeOverride = null, weaponOverride = null) {
    const type = typeOverride || HUMAN_TYPES[s.type];
    if (!type) return null;
    const e = new Human(type, weaponOverride || WEAPONS[type.weapon], s);
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

  /** D82 / D83: kneeling behind low cover he is shielded — except while firing over it and a moment after. */
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
    if (p.takedown) { p.bodyAngle = p.takedown.face; p.aimPose = false; return; } // D85: facing the victim's back
    if (shooting || this.grenadePreview.active) p.faceAimUntil = time + FACING.aimHold;
    const moving = p.dodging || Math.hypot(p.vx, p.vy) > 1;
    const mouse = p.hasAim && !this.autoFire;
    const firing = time < p.faceAimUntil;
    const cover = p.cover && !firing ? p.cover : null; // D83: in cover he keeps facing it while moving along it
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
    else if (d.kind === 'intel') this.intel += 1; // D85 stealth: hidden intel (optional)
    pk.taken = true;
    this.events.emit('pickup', d.kind, d.id);
    if (d.kind === 'drive') this._onDrive(time);
    return true;
  }

  /** Opens the crate in reach (E / the touch button): its item goes to the hero once. */
  interact(time = this.lastTime) {
    const pk = this.interactTarget;
    if (!pk || pk.openedAt >= 0 || this.over || !this.player.alive || pk.def.kind !== 'crate') return false;
    pk.openedAt = time;
    const d = pk.def, item = pk.item, count = pk.count || 1; // D85: the survival director fills its crates
    if (item === 'smg' && !this.inventory.includes('smg')) {
      this.inventory.push('smg');
      this.weaponStates.smg = new WeaponState(WEAPONS.smg);
      this.switchWeapon('smg');
    } else if (item === 'grenades') {
      this.grenades.add('frag', count);
    }
    this.events.emit('crateOpened', item, count, d.id);
    this.interactTarget = null;
    return true;
  }

  /** D83: take the cover offered here / leave the current one. */
  toggleCover(time = this.lastTime) {
    if (this.over || !this.player.alive) return false;
    return this.controller.toggleCover(this.player, time);
  }

  /** D83: what the cover button / Q label shows: 'take' (an object to hide behind is here), 'leave' (in cover), or null. */
  get coverOffer() {
    const p = this.player;
    if (this.over || !p.alive || p.dodging) return null;
    return p.cover ? 'leave' : p.coverHere ? 'take' : null;
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
      } else if (pk.def.kind === 'terminal') {
        // D85 stealth: the copy is held at the terminal (the stealth director advances it) — not a walk-over pickup
        if (!this.has.copy && d <= INTERACT.radius + p.radius && d < bestD) { best = pk; bestD = d; }
      } else if (d <= INTERACT.pickupRadius + p.radius) this._pickup(pk, time);
    }
    this.interactTarget = best;
    // D85: what a dead enemy carried (the supervisor's key card) is taken by walking over his body
    for (const e of this.enemies) {
      if (e.alive || !e.carries) continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) > INTERACT.pickupRadius + p.radius + 6) continue;
      if (e.carries === 'keycard') this.has.keycard = true;
      this.events.emit('pickup', e.carries, `loot_${e.id}`);
      e.carries = null;
    }
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
    if (R && (R.after || 'drive') === 'drive') this.callReinforcements();
  }

  /** The reinforcements of the level come in hunting the hero — once (mission: the drive; D85 stealth: the alarm). */
  callReinforcements() {
    const R = this.level.reinforcements;
    if (!R || this.reinforced) return false;
    this.reinforced = true;
    for (const s of R.enemies) this._spawnEnemy(s, true);
    this.events.emit('reinforcements', R.enemies.length);
    return true;
  }

  get objective() { return this.level.objectives[this.objectiveIndex] || null; }

  /** World point of the current objective (HUD arrow / marker), or null. */
  objectiveTarget(out = {}) {
    if (this.mode && this.mode.objectiveTarget) return this.mode.objectiveTarget(out); // D85: survival — supplies
    const o = this.objective;
    if (!o) return null;
    if (o.target === 'exit') { out.x = this.level.exit.x; out.y = this.level.exit.y; return out; }
    // D85: a key card still carried by a living enemy — the marker follows him
    if (o.target === 'keycard') {
      const c = this.enemies.find((e) => e.alive && e.carries === 'keycard');
      if (c) { out.x = c.x; out.y = c.y; return out; }
    }
    const pk = this.pickups.find((k) => k.def.id === o.target);
    if (!pk) return null;
    out.x = pk.def.x; out.y = pk.def.y;
    return out;
  }

  _updateObjectives() {
    const o = this.objective;
    if (!o) return;
    const key = o.done || o.target;
    const done = key === 'keycard' ? this.has.keycard : key === 'drive' ? this.has.drive : key === 'copy' ? this.has.copy : false;
    if (done) {
      this.objectiveIndex += 1;
      this.events.emit('objective', this.objectiveIndex, this.objective);
    }
    // the exit counts once every objective before it is done (mission: after the drive)
    if (o.target === 'exit' && this.level.exit) {
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
    if (this.mode && this.mode.preUpdate) this.mode.preUpdate(input, dt, time); // D85: stance, takedown, copy (stealth)
    this.controller.update(p, input, dt, time);

    if (input.consumePressed('switchWeapon')) this.switchWeapon();
    if (input.consumePressed('weapon1')) this.switchWeapon(this.inventory[0]);
    if (input.consumePressed('weapon2') && this.inventory[1]) this.switchWeapon(this.inventory[1]);
    if (input.consumePressed('interact')) this.interact(time);

    const autoFire = this.autoFire && (!this.mode || this.mode.autoFireAllowed !== false); // D85: never breaks stealth
    let fire = autoFire ? false : (this.autoFire ? false : input.isDown('fire'));
    if (autoFire && !this.holdFire && !this.grenadeArmed) fire = !!this.autoAim.update(p, this.enemies, this.weapon.stats.range);
    else this.autoAim.reset();
    const trigger = fire && !this.holdFire && !this.grenadeArmed && !p.dodging && !p.takedown; // D82: no shots mid-roll
    // D87: behind high cover — only leaning out of its corner (else the trigger does nothing; a hint for manual fire)
    const shooting = this.controller.peekGate(p, trigger, !autoFire, dt, time);
    this.weapons.update(this.weapon, p, shooting, input.consumePressed('reload'), time);
    this._grenadeInput(input, time);
    this._updateCover(p, shooting, time);
    this._updateFacing(p, shooting || !!p.peek, time); // leaning out he already faces the aim

    this.levelWorld.updateDoors(this._bodies(), time, dt);
    this.ai.update(this.enemies, p, dt, time);
    if (this.mode) this.mode.update(dt, time); // D85: the mode's rules (detection level / alarm, spawns, supplies)
    this.projectileSystem.update(this.enemies, dt, time);
    this.grenades.update(this.enemies, time);
    this._updatePickups(time);
    this._updateObjectives();
    if (!p.alive) this._setDefeat('player');

    for (let i = this.enemies.length - 1; i >= 0; i--) { // bodies vanish after a long while (never during a fight)
      const e = this.enemies[i];
      if (!e.alive && time - e.deathAt > this.bodyFade) this.enemies.splice(i, 1);
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
    if (this.mode && this.mode.dispose) this.mode.dispose(); // D87: the director's own event subscriptions
    this.projectiles.clear();
    this.particles.clear();
    this.grenades.clear();
    this.enemies.length = 0;
  }
}

