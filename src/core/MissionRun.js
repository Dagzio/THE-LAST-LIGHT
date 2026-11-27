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
import { WEAPONS, getWeapon, HERO_WEAPONS, AMMO_DROPS } from '../data/weapons.js';
import { StealthDirector } from '../systems/StealthDirector.js';
import { SurvivalDirector } from '../systems/SurvivalDirector.js';
import { TutorialDirector } from '../systems/TutorialDirector.js';
import { MissionTakedown } from '../systems/MissionTakedown.js';
import { HUMAN_TYPES } from '../data/humans.js';
import { CAPS } from '../data/balance.js';
import { FACING, INTERACT, COVER, muzzleOf, barrelOffsetAngle } from '../data/player.js';

const AIM = { x: 0, y: 0 };
const BODY_FADE = 30; // s a dead body stays (presentation; bodies never block anything)
/** D132: no controls (the hero stands; the world goes on) — the moments after a failure that keep the run stepping. */
const IDLE_INPUT = {
  getMove(o) { o.x = 0; o.y = 0; return o; }, isDown() { return false; }, consumePressed() { return false; }, peekPressed() { return false; },
  getAimWorld() { return null; }, getLastAimWorld() { return null; }, analogActive() { return false; },
};
/** D88: slot of a hero gun (0 pistols, 1 SMG, 2 M4A1). */
const slotOf = (id) => (WEAPONS[id] && WEAPONS[id].gun === 'pistol' ? 0 : Math.max(0, HERO_WEAPONS.indexOf(id)));

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
    this.liveUntil = -Infinity; // D132: game time until which a finished run still steps (no controls)
    this.restartPoint = null;   // D141: a story level's restart point (MissionTasks: the current objective's start)
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
    this.controller.gunOf = () => this.weapon && this.weapon.stats.gun; // D126: the pistol rolls over the shoulder only
    this.weapons = new WeaponSystem(this.projectiles, this.rng, events);
    this.weapons.world = this.world;
    this.projectileSystem = new ProjectileSystem(this.projectiles, this.rng, events, (id) => this._statsFor(id));
    this.projectileSystem.world = this.world;
    this.projectileSystem.player = this.player;
    this.grenades = new GrenadeSystem(this.rng, events);
    this.grenades.world = this.world;
    this.grenadePreview = { active: false, x: 0, y: 0, way: { pts: [], dt: [], bounces: 0 } }; // D116: way — its bounces
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
    this.mode = this.modeId === 'stealth' ? new StealthDirector(this) : this.modeId === 'survival' ? new SurvivalDirector(this)
      : this.modeId === 'tutorial' ? new TutorialDirector(this) // D88: the training ground's lessons
      : new MissionTakedown(this); // D118: the story mission — only the silent takedown of an unaware guard

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
  switchWeapon(id = null, dir = 1) {
    if (this.over || !this.player.alive || this.player.takedown) return false;
    const inv = this.inventory;
    const next = id || inv[(inv.indexOf(this.weapon.weaponId) + (dir < 0 ? inv.length - 1 : 1)) % inv.length];
    const w = this.weaponStates[next];
    if (!w || w === this.weapon) return false;
    if (this.weapon.reloading) this.weapon.reloading = false; // the next reload starts over
    this.weapon = w;
    this.weaponStats = w.stats;
    w.nextShotAt = Math.max(w.nextShotAt, this.lastTime + 0.25); // a moment to bring it up
    this.events.emit('weaponSwitch', next);
    return true;
  }

  /** D88: the weapon of slot n (0: the pistol the mode gives, 1: SMG, 2: M4A1) if carried — keys 1 / 2 / 3. */
  slotWeapon(n) {
    const id = n === 0 ? this.inventory.find((w) => WEAPONS[w] && WEAPONS[w].gun === 'pistol') : HERO_WEAPONS[n];
    return id && this.inventory.includes(id) ? id : null;
  }

  /** D88: a gun is added (a crate, the training ground's chests); carried already — its reserve is topped up instead. */
  giveWeapon(id, equip = true) {
    const W = WEAPONS[id];
    if (!W) return false;
    if (this.inventory.includes(id)) {
      const w = this.weaponStates[id];
      w.reserve = Math.min(W.reserveMax ?? Infinity, w.reserve + (W.reserve || W.magazineSize));
      this.events.emit('ammoPickup', W.ammo, W.reserve || W.magazineSize, id);
      return true;
    }
    this.inventory.push(id);
    this.inventory.sort((a, b) => slotOf(a) - slotOf(b)); // slot order: pistol, SMG, M4A1
    this.weaponStates[id] = new WeaponState(W);
    if (equip) this.switchWeapon(id);
    return true;
  }

  /**
   * D88: rounds of a class (from a body / a box) into the carried gun that takes them — the one in the hands first —
   * up to its reserveMax. → how many were taken (0: no such gun, or full).
   */
  giveAmmo(type, n) {
    const fits = (w) => w && w.stats.ammo === type;
    const w = fits(this.weapon) ? this.weapon : this.inventory.map((id) => this.weaponStates[id]).find(fits);
    if (!w || !(n > 0)) return 0;
    const take = Math.max(0, Math.min(n, (w.stats.reserveMax ?? Infinity) - w.reserve));
    if (take > 0) { w.reserve += take; this.events.emit('ammoPickup', type, take, w.weaponId); }
    return take;
  }

  /** D128: could a round of this class be taken now (a carried gun for it, not full)? */
  canTakeAmmo(type) {
    return this.inventory.some((id) => { const w = this.weaponStates[id]; return w && w.stats.ammo === type && w.reserve < (w.stats.reserveMax ?? Infinity); });
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
      // D116: the preview follows the real way (bounces off the walls); the ring where it comes to rest
      const way = GrenadeSystem.path(this.world, p.x, p.y, a.x, a.y, pv.way);
      pv.x = way.pts[way.pts.length - 2]; pv.y = way.pts[way.pts.length - 1];
      pv.active = true;
      this._gTarget.x = a.x; this._gTarget.y = a.y;
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
    // D110: standing up to fire over it (p.rise) he is exposed too
    p.crouched = !!p.cover && p.cover.kind === 'low' && p.alive && !p.dodging && !p.rise && time >= p.exposedUntil;
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
    // D95 (user: back in cover he first stood facing the wall, then turned): in cover the aim pose lasts only while he
    // fires / leans out / aims a grenade — then at once the cover pose (back to the wall / kneeling)
    // D110: standing up from low cover to fire he already turns to the aim
    const firing = p.cover ? shooting || !!p.peek || !!(p.rise && p.rise.up) || this.grenadePreview.active : time < p.faceAimUntil;
    const cover = p.cover && !firing ? p.cover : null; // D83: in cover he keeps facing it while moving along it
    p.aimPose = false;
    if (p.dodging) p.bodyAngle = Math.atan2(p.dodgeDirY, p.dodgeDirX);
    // D101 (user video: the peek looked awful): leaning out of the corner he turns from his back-to-the-wall facing to
    // the aim as he leans (by the lean k), always through the OPEN side of the corner (never through the wall), and
    // holds the gun up in the plain aim pose once mostly out — the shots then leave along the barrel
    else if (p.peek && p.cover) {
      const n = Math.atan2(p.cover.ny, p.cover.nx), pk = p.peek;
      const d = Math.hypot(p.aimX - p.x, p.aimY - p.y);
      const aimA = p.hasAim ? p.aimAngle - barrelOffsetAngle(muzzleOf(this.weapon.stats.gun), d) : n;
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      const open = Math.atan2(p.cover.nx * pk.side, -p.cover.ny * pk.side), sgn = Math.sign(wrap(open - n)) || 1;
      let delta = wrap(aimA - n);
      if (Math.sign(delta) !== sgn && Math.abs(delta) > 0.05) delta += sgn * 2 * Math.PI;
      const k = pk.k * pk.k * (3 - 2 * pk.k);
      p.bodyAngle = n + delta * k;
      p.aimPose = p.hasAim && pk.k > 0.15; // (the gun up through the turn)
    }
    else if (cover) p.bodyAngle = Math.atan2(cover.ny, cover.nx); // D90 (user): back to it, low cover too (turns to fire)
    else if (firing || (mouse && (!moving || FACING.alwaysAimMouse))) {
      const d = Math.hypot(p.aimX - p.x, p.aimY - p.y);
      p.bodyAngle = p.aimAngle - (p.hasAim ? barrelOffsetAngle(muzzleOf(this.weapon.stats.gun), d) : 0);
      p.aimPose = true;
    } else if (moving) p.bodyAngle = Math.atan2(p.facingY, p.facingX);
    // D93 (mobile aim assist): no target locked — the gun points where he faces; a target locked — he keeps it aimed
    if (this.autoFire && !this.autoAim.target && !this.grenadeArmed && time >= p.faceAimUntil) p.aimAngle = p.bodyAngle;
  }

  /** True while the hero holds the gun up at the aim — the renderer's aim pose. */
  get heroAiming() { return this.player.alive && this.player.aimPose; }

  // ---------------- pickups, crates, objectives ----------------
  _pickup(pk, time) {
    const d = pk.def;
    if (d.kind === 'medkit') return false; // D128: no medkits (the wounds heal by themselves) — never on a level now
    if (d.kind === 'keycard') this.has.keycard = true;
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
    const d = pk.def, count = pk.count || 1; // D85: the survival director fills its crates
    let item = pk.item;
    if (item === 'smg' || item === 'rifle') {
      if (this.inventory.includes(item)) item = 'ammo-' + item; // D88: carried already → its reserve is topped up
      this.giveWeapon(pk.item);
    } else if (item === 'grenades') {
      this.grenades.add('frag', count);
    } else if (item === 'ammo') {
      // D88: a box of rounds — a magazine's worth for every carried gun (count = magazines)
      for (const id of this.inventory) { const w = this.weaponStates[id]; this.giveAmmo(w.stats.ammo, w.stats.magazineSize * count); }
    }
    this.events.emit('crateOpened', item, count, d.id);
    // D112 (user): a crate picked up is gone at once (not on the training ground: its chests stay and refill)
    if (!this.level.manualCrates) pk.taken = true;
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
      // D90: a crate that never runs out (the training ground's table / chests) can be opened again after a moment
      if (pk.def.refill > 0 && pk.openedAt >= 0 && time - pk.openedAt >= pk.def.refill) pk.openedAt = -1;
      const d = Math.hypot(p.x - pk.def.x, p.y - pk.def.y);
      if (pk.def.kind === 'crate') {
        if (pk.openedAt < 0 && d <= INTERACT.radius + p.radius && d < bestD) { best = pk; bestD = d; }
      } else if (pk.def.kind === 'terminal' || pk.def.kind === 'search' || pk.def.kind === 'activate') {
        // D85 stealth: the copy is held at the terminal (the stealth director advances it) — not a walk-over pickup;
        // D141: a search spot is held the same way, a computer to start is pressed (MissionTasks). D143 (user: searched
        // through a wall): those only from their own room
        if (pk.def.kind !== 'terminal' && this.levelWorld.zoneAt(p.x, p.y) !== this.levelWorld.zoneAt(pk.def.x, pk.def.y)) continue;
        if ((pk.def.kind !== 'terminal' || !this.has.copy) && d <= INTERACT.radius + p.radius && d < bestD) { best = pk; bestD = d; }
      } else if (d <= INTERACT.pickupRadius + p.radius) this._pickup(pk, time);
    }
    this.interactTarget = best;
    // D110 (user): crates (weapons, rounds, grenades, medkits) open by themselves once he is in reach — not on the training
    // ground (its lessons teach E / the button; level.manualCrates)
    if (best && best.def.kind === 'crate' && !this.level.manualCrates && !this.over) this.interact(time);
    // D85: what a dead enemy carried (the supervisor's key card) is taken by walking over his body; D88: his rounds too
    for (const e of this.enemies) {
      if (e.alive || (!e.carries && !(e.ammoDrop > 0))) continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) > INTERACT.pickupRadius + p.radius + 6) continue;
      if (e.ammoDrop > 0) e.ammoDrop -= this.giveAmmo(e.ammoType, e.ammoDrop); // what does not fit stays on him
      if (!e.carries) continue;
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

  /**
   * D141: a story fact reached by a sub-task (the key card found in a search, the drive filled by the download) — as if
   * picked up: the HUD item, the dialogue, the level's turn. Once.
   */
  give(fact, time = this.lastTime) {
    if (!(fact in this.has) || this.has[fact]) return false;
    this.has[fact] = true;
    this.events.emit('pickup', fact, `task_${fact}`);
    if (fact === 'drive') this._onDrive(time);
    return true;
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

  get objective() {
    if (this.mode && 'objective' in this.mode) return this.mode.objective; // D88: the tutorial's lesson
    return this.level.objectives[this.objectiveIndex] || null;
  }

  /** World point of the current objective (HUD arrow / marker), or null. */
  /**
   * D92 (user: the office's SMG crate easy to find): the level's `pointers` — supplies lit up (a frame + a chevron) and
   * pointed at by a second arrow until they are opened. Mission mode only. → boxes { x, y, w, d }.
   */
  pointers() {
    const out = this._ptrs || (this._ptrs = []);
    out.length = 0;
    if (this.modeId !== 'mission' || !this.level.pointers) return out;
    for (const ptr of this.level.pointers) {
      const pk = this.pickups.find((x) => x.def.id === ptr.pickup);
      if (pk && !pk.taken && pk.openedAt < 0) out.push({ x: pk.def.x, y: pk.def.y, w: ptr.w || 46, d: ptr.d || 26 });
    }
    return out;
  }

  /** D92: the nearest pointed supply (the second HUD arrow), or null. */
  pointerTarget(out = {}) {
    const list = this.pointers(), p = this.player;
    let best = null, bd = Infinity;
    for (const b of list) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; best = b; } }
    if (!best) return null;
    out.x = best.x; out.y = best.y;
    return out;
  }

  objectiveTarget(out = {}) {
    if (this.mode && this.mode.objectiveTarget) return this.mode.objectiveTarget(out); // D85: survival — supplies
    const o = this.objective;
    if (!o) return null;
    if (this.mode && this.mode.taskTarget) { const t = this.mode.taskTarget(out); if (t !== undefined) return t; } // D143: sub-tasks
    if (o.target === 'exit') { out.x = this.level.exit.x; out.y = this.level.exit.y; return out; }
    if (Array.isArray(o.target)) { out.x = o.target[0]; out.y = o.target[1]; return out; } // D141: a point (a room, a terminal)
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
    if (this.modeId === 'tutorial') { // D88: the lessons complete themselves; the last one is the way out
      const r = this.level.exit && this.level.exit.rect, p = this.player;
      if (o.id === 'exit' && r && p.x >= r[0] && p.x <= r[2] && p.y >= r[1] && p.y <= r[3]) this._setVictory();
      return;
    }
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
    // D88: the rounds he leaves (by the class of his gun), rolled once with the run's seeded RNG
    const type = e.gun && e.gun.stats.drops, R = type && AMMO_DROPS[type];
    if (R && !e.noDrop) { e.ammoType = type; e.ammoDrop = R[0] + Math.floor(this.rng.next() * (R[1] - R[0] + 1)); }
    this.particles.burst(e.x, e.y, 10, 120, 0.4, 2.6, '#7a1414');
  }

  get over() { return !!this.defeat || this.victory; }

  /** Living enemies left. */
  get enemiesLeft() { let n = 0; for (const e of this.enemies) if (e.alive) n++; return n; }

  // ---------------- step ----------------
  /** @param {import('../platform/InputManager.js').InputManager} input */
  update(input, dt, time) {
    // D132 (user: the stealth lesson's failure — the world goes on a moment while the failure screen fades in): over,
    // the run still steps until liveUntil, without the hero's controls (Game keeps it stepping meanwhile)
    if (this.over) {
      if (!(time < this.liveUntil)) return;
      input = IDLE_INPUT;
    }
    this.lastTime = time;
    this.stats.time += dt;
    const p = this.player;
    p.prevX = p.x; p.prevY = p.y;
    for (let i = 0; i < this.enemies.length; i++) { const e = this.enemies[i]; e.prevX = e.x; e.prevY = e.y; }
    if (this.mode && this.mode.preUpdate) this.mode.preUpdate(input, dt, time); // D85: stance, takedown, copy (stealth)
    this.controller.update(p, input, dt, time);
    p.regenerate(dt, time); // D128: the wounds heal once he takes no damage for a while (no medkits)

    if (input.consumePressed('switchWeapon')) this.switchWeapon();
    if (input.consumePressed('switchWeaponPrev')) this.switchWeapon(null, -1);
    // D88: 1 / 2 / 3 — the pistol / SMG / M4A1 slots (a slot not carried does nothing)
    for (let n = 0; n < 3; n++) if (input.consumePressed(`weapon${n + 1}`)) { const id = this.slotWeapon(n); if (id) this.switchWeapon(id); }
    if (input.consumePressed('interact')) this.interact(time);

    // D93 (user): the mobile version no longer fires by itself — the aim locks onto the nearest target in reach (aim
    // assist, `autoFire` = the touch flag), the trigger is the player's (a tap / hold on the screen, TouchControls)
    const fire = input.isDown('fire') || (this.autoFire && !!input.peekPressed && input.peekPressed('fire')); // (a quick tap: one shot)
    // D89: a mode may give other things to aim at (the training ground's range: the targets)
    const aimAt = (this.mode && this.mode.aimTargets) || this.enemies;
    // D107 (user): in cover the aim still locks — in high cover only a target he can really fire at from there
    const coverOk = p.cover && p.cover.kind === 'high' ? this._coverOk || (this._coverOk = (e) => this.controller.canFireAt(this.player, e.x, e.y)) : null;
    if (this.autoFire && !this.grenadeArmed && p.alive) this.autoAim.update(p, aimAt, this.weapon.stats.range, this._peekFrom(p), coverOk);
    else this.autoAim.reset();
    const trigger = fire && !this.holdFire && !this.grenadeArmed && !p.dodging && !p.takedown; // D82: no shots mid-roll
    // D87: behind high cover — only leaning out of its corner (else the trigger does nothing; a hint says so)
    // D106 (user: holding fire through a reload in cover he walked in place): while the gun reloads (or is empty) in cover
    // the trigger does not lean him out / turn him to aim — he reloads in the cover pose
    const canShoot = !this.weapon.reloading && (this.weapon.ammo > 0 || this.weapon.reserve > 0);
    if (!canShoot && p.peek) p.peek.until = 0; // (a reload: back to the wall at once — the reload plays there)
    if (!canShoot && p.rise) p.rise.until = 0; // D110: …behind low cover he sits back down to reload
    const shooting = this.controller.peekGate(p, trigger && (canShoot || !p.cover), true, dt, time);
    this._outOfAmmo(trigger, time);
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

  /**
   * D89: the mobile auto fire behind HIGH cover at its corner looks from the leaned-out spot (else the wall hides every
   * enemy, nothing is fired and he never leans out); null when not there (or already leaning out).
   */
  _peekFrom(p) {
    if (!p.cover || p.cover.kind !== 'high' || p.peek) return null;
    const side = this.controller.coverEdge(p);
    if (!side) return null;
    const o = this._peekSpot || (this._peekSpot = { x: 0, y: 0 });
    o.x = p.x - p.cover.ny * side * COVER.peekOut;
    o.y = p.y + p.cover.nx * side * COVER.peekOut;
    return o;
  }

  /**
   * D88: the gun in the hands is empty (no rounds in it, none in reserve) and the trigger is pulled — the next carried
   * gun with rounds is taken; with none left, "no ammo" (an event, not more often than once a second).
   */
  _outOfAmmo(trigger, time) {
    const w = this.weapon;
    if (!trigger || w.reloading || w.ammo > 0 || w.reserve > 0) return;
    const inv = this.inventory, i = inv.indexOf(w.weaponId);
    for (let k = 1; k < inv.length; k++) {
      const o = this.weaponStates[inv[(i + k) % inv.length]];
      if (o.ammo > 0 || o.reserve > 0) { this.switchWeapon(o.weaponId); return; }
    }
    if (time >= (this._dryAt || 0)) { this._dryAt = time + 1; this.events.emit('noAmmo'); }
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

