// Runtime of one map attempt: entities + systems, created fresh on every map start / retry.
// Holds only temporary data (MapRunState side); the permanent PlayerProfile arrives in Phase 5 — until then kill and
// wave rewards are accumulated here (`rewards`) exactly once each and are not yet spent or saved.
// Update order: player → weapon → flare → light → enemy AI (beacon attacks, contact) → boss attacks → defenses →
// projectiles → defeat checks → waves (spawns / clear / victory) → cleanup → particles.
// The result (defeat or victory) is decided exactly once; the world stops after it.
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Beacon } from '../entities/Beacon.js';
import { ProjectilePool } from '../entities/ProjectilePool.js';
import { PlayerController } from '../systems/PlayerController.js';
import { WeaponSystem, WeaponState } from '../systems/WeaponSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { LightSystem } from '../systems/LightSystem.js';
import { EnemyAISystem } from '../systems/EnemyAISystem.js';
import { BossSystem } from '../systems/BossSystem.js';
import { DefenseSystem } from '../systems/DefenseSystem.js';
import { WaveSystem, WAVE_PHASE } from '../systems/WaveSystem.js';
import { FlareSystem } from '../systems/FlareSystem.js';
import { SeededRandom } from './SeededRandom.js';
import { Particles } from '../render/Particles.js';
import { getWeapon } from '../data/weapons.js';
import { getDefense } from '../data/defenses.js';
import { getEnemyType, scaledEnemyType } from '../data/enemies.js';
import { getWaves } from '../data/waves.js';
import { CAPS, ENEMY_FX } from '../data/balance.js';
import { KIOSK } from '../data/kiosk.js';
import { WAVE_TIMING } from '../data/waves.js';
import { BEACON } from '../data/beacon.js';
import { defaultLoadout } from '../systems/Loadout.js';
import { buildCollisionWorld } from '../systems/Collision.js';
import { mapColliders } from '../systems/Props.js';
import { GrenadeSystem } from '../systems/GrenadeSystem.js';
import { PoisonSystem } from '../systems/PoisonSystem.js';
import { CrateSystem } from '../systems/CrateSystem.js';
import { GRENADE_RULES } from '../data/grenades.js';
import { AutoAim } from '../systems/AutoAim.js';
import { CRATE, PERKS } from '../data/perks.js';

const MAX_ENEMIES = 80; // hard cap of live entities (performance guard; waves stay far below it)
const AIM = { x: 0, y: 0 }; // reused
const TURRET_SPARK = { frost_coil: '#bfe9ff', poison_turret: '#8dff5a' }; // muzzle sparks per device

/** Weapon stats with the temporary crate perks of this run on top (never stored in the profile). */
function withPerks(ws, perks) {
  const s = { ...ws, temporaryDamageMult: 1, knockback: 0 };
  for (const id of perks) {
    const k = PERKS[id];
    if (!k) continue;
    if (k.damageMult) s.temporaryDamageMult *= k.damageMult;
    if (k.reloadMult) s.reloadDuration *= k.reloadMult;
    if (k.magazineMult) s.magazineSize = Math.ceil(s.magazineSize * k.magazineMult - 1e-9);
    if (k.fireRateMult) s.fireInterval /= k.fireRateMult;
    if (k.penetration) s.penetrationCount += k.penetration;
    if (k.knockback) s.knockback += k.knockback;
    if (k.critBonus) s.critChance = (s.critChance || 0) + k.critBonus; // KEEN_EYE (D51)
  }
  return s;
}

export class MapRun {
  /**
   * @param {object} map entry of data/maps.js
   * @param {number} runSeed
   * @param {import('./GameEvents.js').GameEvents} events
   * @param {{weaponStats:object, player:object}} [loadout] permanent progression (Economy.loadout())
   */
  constructor(map, runSeed, events, loadout = defaultLoadout()) {
    this.map = map;
    this.mapId = map.id;
    this.runSeed = runSeed;
    this.events = events;
    this.rng = new SeededRandom(runSeed);
    this.stats = { kills: 0, damageDealt: 0, shotsFired: 0, beaconDamageTaken: 0, damageTaken: 0, wavesCleared: 0 };
    this.rewards = { coins: 0, xp: 0 }; // earned in this run, granted to the profile from Phase 5
    this.defeat = null;   // 'beacon' | 'player' — set once
    this.victory = false; // set once

    this.player = new Player(map.playerSpawn.x, map.playerSpawn.y);
    this.beacon = new Beacon(map.beacon.x, map.beacon.y);
    this.enemies = [];
    this.projectiles = new ProjectilePool(CAPS.projectiles);
    this.particles = new Particles(CAPS.particles);

    // Equipped weapon + keeper modifiers from the profile (applyLoadout also runs after shop purchases).
    this.weaponStats = loadout.weaponStats;
    this.weapon = new WeaponState(this.weaponStats);
    this.interactMult = 1;
    this.lifesteal = 0; // D52 VAMPIRISM share (applyLoadout)

    this.controller = new PlayerController(events, { w: map.width, h: map.height });
    this.weapons = new WeaponSystem(this.projectiles, this.rng, events);
    this.projectileSystem = new ProjectileSystem(this.projectiles, this.rng, events, (id) => this._statsFor(id));
    this.projectileSystem.onKeeperHit = (amount) => { // D52 VAMPIRISM: a share of the keeper's bullet damage heals him
      const p = this.player;
      if (this.lifesteal > 0 && p.alive && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + amount * this.lifesteal);
    };
    this.light = new LightSystem();
    this.ai = new EnemyAISystem(events);
    this.bossSystem = new BossSystem(events);
    this.defenses = new DefenseSystem(map.buildPads, this.projectiles, this.rng, events);
    this.flare = new FlareSystem(events); // charge is temporary: a new run starts at 0
    // Temporary map data (MapRunState): grenade stock, crate + perks — gone with this run (retry / new map).
    this.temporaryPerks = [];
    this.crateChoices = null;          // perk ids offered by the open crate
    this.grenades = new GrenadeSystem(this.rng, events);
    this.poison = new PoisonSystem(events, this.rng); // D51: Poison Turret damage over time
    this.crates = new CrateSystem(map, new SeededRandom((runSeed ^ 0x2545f491) >>> 0), events);
    this.grenadePreview = { active: false, x: 0, y: 0 }; // aim landing point (presentation: circle + dotted arc)
    this._gTarget = { x: 0, y: 0 };
    // D61: a grenade picked in the wheel is ARMED for the next shot: the next fire press aims it (landing circle +
    // arc), the release throws it. _gWaitUp — fire was already held when it was armed (wait for a fresh press).
    this.grenadeArmed = null;
    this._gWaitUp = false;
    this._gFire = false;
    this.holdFire = false; // D61: the grenade wheel is open (no shooting)
    // D74: the mobile version fires by itself at the nearest enemy in range (Game sets autoFire on touch devices)
    this.autoFire = false;
    this.autoAim = new AutoAim();
    this.lastTime = 0;
    this.waves = new WaveSystem(getWaves(map.id) || [], map.spawnPoints, this.rng, events,
      (id, x, y, time) => this._spawnEnemy(id, x, y, time));
    // D45/D52: enemy types scaled for this map (HP × enemyHpMult, boss HP also × bossHpMult, damage × enemyDamageMult,
    // rewards × rewardMult), built once per type.
    this.enemyTypes = new Map();
    // Spitter globs in flight: { x0, y0, x1, y1, t0, t1, damage } — damage on landing, on the game clock
    this.globs = [];
    this.ai.map = map;
    this.controller.map = map;
    this.ai.onRanged = (e, target, time, device) => this._launchGlob(e, target, time, device);
    this.ai.onSpit = (e, x, y, time) => this._spitAtKeeper(e, x, y, time); // D62
    this.ai.defenses = this.defenses;       // D52: enemies may turn on devices
    this.bossSystem.defenses = this.defenses;
    this.bossSystem.summonFn = (points, enemyId, time) => this._summon(points, enemyId, time);

    this._unsub = [
      events.on('kill', (e) => this._onKill(e)),
      events.on('hit', (x, y, amount) => {
        this.stats.damageDealt += amount;
        this.particles.burst(x, y, 6, 160, 0.22, 2, '#ffb8a0');
        this.particles.burst(x, y, 2, 300, 0.12, 2.6, '#fff1cf', 10); // D45: a short white impact spark
      }),
      events.on('shot', (x, y, angle) => {
        this.stats.shotsFired += 1;
        this.particles.cone(x, y, angle, 0.7, 5, 260, 0.12, 2.2, '#ffd27a');
        // D45: a brass casing kicked out to the right of the gun (decorative; the quality preset limits particles)
        const p = this.player;
        this.particles.cone(p.x, p.y, angle + Math.PI / 2, 0.5, 1, 110, 0.45, 2.2, '#c99a3e');
      }),
      events.on('turretShot', (x, y, angle, id) => this.particles.cone(x, y, angle, 0.6, 2, 220, 0.1, 2, TURRET_SPARK[id] || '#ffe0a0')),
      events.on('poisonTick', (x, y, amount) => { // D51: a small green puff per poison tick
        this.stats.damageDealt += amount;
        this.particles.burst(x, y, 2, 70, 0.35, 2.2, '#8dff5a', 3);
      }),
      events.on('beaconHit', (x, y, amount) => {
        this.stats.beaconDamageTaken += amount;
        this.particles.burst(x, y, 8, 140, 0.35, 2.5, '#ff9a60');
      }),
      events.on('playerHit', (x, y, amount) => {
        this.stats.damageTaken += amount;
        this.particles.burst(x, y, 10, 170, 0.3, 2.5, '#ff4a3a');
      }),
      events.on('bossImpact', (kind, x, y, r) => this.particles.burst(x, y, kind === 'slam' ? 22 : 30, r * 2.2, 0.45, 3, '#b48cff')),
      events.on('bulletBlocked', (x, y) => this.particles.burst(x, y, 5, 130, 0.18, 2, '#c9c3b5')), // stone chips
      events.on('deviceHit', (x, y) => this.particles.burst(x, y, 6, 140, 0.25, 2.2, '#ffcf8a')), // D52: sparks
      events.on('deviceBroken', (i) => { const p = this.defenses.pads[i]; if (p) this.particles.burst(p.x, p.y, 24, 200, 0.6, 3, '#8a8f99'); }),
      events.on('waveCleared', (index, reward, final) => this._onWaveCleared(index, reward, final)),
      events.on('waveStart', (index) => this.crates.onWaveStart(index, this.lastTime)),
      events.on('grenadeBlast', (type, x, y, r) => {
        const color = type === 'frag' ? '#ffb070' : type === 'cryo' ? '#a8e4ff' : '#ff7a2a';
        this.particles.burst(x, y, 26, r * 2.4, 0.5, 3, color);
      }),
    ];

    this.applyLoadout(loadout, true);
    this.player.hp = this.player.maxHp;
    this.kiosk = placeKiosk(map, runSeed); // new spot every run (D39); its own RNG keeps combat RNG unchanged
    // Static obstacles (D40): beacon, pads, kiosk, decor — for the keeper, enemies, bullets and turret sight.
    this.world = buildCollisionWorld(map, this.kiosk);
    this.controller.world = this.world;
    this.ai.world = this.world;
    this.projectileSystem.world = this.world;
    this.defenses.world = this.world;
    this.autoAim.world = this.world;
    this.crates.world = this.world;
    this.world.pushOut(this.player);
    this.waves.start(0);
  }

  /**
   * Applies permanent progression (map start, after shop purchases) with the run's temporary perks on top.
   * Another weapon is equipped with a full magazine; the same weapon keeps its ammo; VITALITY adds HP right away.
   */
  applyLoadout(loadout, initial = false) {
    this.baseLoadout = loadout;
    const ws = withPerks(loadout.weaponStats, this.temporaryPerks);
    if (loadout.player.critBonus > 0) ws.critChance = (ws.critChance || 0) + loadout.player.critBonus; // D52 CRIT
    const prev = this.weaponStats;
    this.weaponStats = ws;
    if (initial || ws.id !== prev.id) this.weapon.equip(ws);
    else { this.weapon.stats = ws; this.weapon.ammo = Math.min(this.weapon.ammo, ws.magazineSize); }
    let speed = loadout.player.speedMult, taken = loadout.player.damageTakenMult, beam = 0;
    let dodge = 1, hpBonus = 0, hpRegen = loadout.player.hpRegen || 0, deviceRate = 1, beaconTaken = 1, beaconRegen = 0, flareCharge = 1;
    for (const id of this.temporaryPerks) {
      const k = PERKS[id];
      if (!k) continue;
      if (k.speedMult) speed *= k.speedMult;
      if (k.damageTakenMult) taken *= k.damageTakenMult;
      if (k.beamDeg) beam += k.beamDeg;
      // D51 perks
      if (k.dodgeCooldownMult) dodge *= k.dodgeCooldownMult;
      if (k.maxHpBonus) hpBonus += k.maxHpBonus;
      if (k.hpRegen) hpRegen += k.hpRegen;
      if (k.deviceFireRateMult) deviceRate *= k.deviceFireRateMult;
      if (k.beaconDamageMult) beaconTaken *= k.beaconDamageMult;
      if (k.beaconRegen) beaconRegen += k.beaconRegen;
      if (k.flareChargeMult) flareCharge *= k.flareChargeMult;
    }
    const m = loadout.player, p = this.player;
    const maxHp = m.maxHp + hpBonus;
    const gained = maxHp - p.maxHp;
    p.maxHp = maxHp;
    if (gained > 0 && !initial) p.hp += gained;
    p.hp = Math.min(p.hp, p.maxHp);
    p.damageTakenMult = taken;
    this.controller.speedMult = speed;
    this.controller.dodgeCooldownMult = m.dodgeCooldownMult * dodge;
    this.hpRegen = hpRegen;
    this.beaconRegen = beaconRegen;
    this.defenses.fireRateMult = deviceRate;
    this.beacon.damageTakenMult = beaconTaken;
    this.flare.chargeMult = flareCharge;
    this.interactMult = m.interactMult;
    this.lifesteal = m.lifesteal || 0;
    this.light.extraWidthDeg = beam;
  }

  // ---------------- crate & temporary perks (02_SPEC §14) ----------------
  get canOpenCrate() {
    const c = this.crates.crate, p = this.player;
    return !!c && !this.over && p.alive && Math.hypot(p.x - c.x, p.y - c.y) <= CRATE.interactRadius * this.interactMult + p.radius;
  }

  _perkOffered(perk) {
    if (this.temporaryPerks.includes(perk.id)) return false;
    if (perk.repair && this.beacon.integrity >= this.beacon.maxIntegrity) return false; // nothing to repair
    return true;
  }

  /** Opens the crate in reach: rolls the offered perks (seeded). The crate is gone afterwards. */
  openCrate(time) {
    if (!this.canOpenCrate || this.crateChoices) return null;
    const choices = this.crates.open(time, (perk) => this._perkOffered(perk));
    this.crateChoices = choices && choices.length ? choices : null;
    if (this.crateChoices) this.events.emit('crateOpened'); // D56: its sound
    return this.crateChoices;
  }

  /** Applies ONE of the offered perks, once; it lasts until the end of this map. */
  choosePerk(id) {
    if (!this.crateChoices || !this.crateChoices.includes(id)) return false;
    this.crateChoices = null;
    this.temporaryPerks.push(id);
    const k = PERKS[id];
    if (k.repair) this.beacon.repair(k.repair);
    this.applyLoadout(this.baseLoadout);
    this.events.emit('perkChosen', id);
    return true;
  }

  // ---------------- grenades (D61): pick in the wheel → armed; the next shot aims, its release throws ----------------
  _forward(out) {
    const p = this.player;
    out.x = p.x + Math.cos(p.aimAngle) * GRENADE_RULES.tapThrowRange;
    out.y = p.y + Math.sin(p.aimAngle) * GRENADE_RULES.tapThrowRange;
    return out;
  }

  /** Arms a type in stock for the next shot (the wheel, keys 1 / 2 / 3). */
  armGrenade(type) {
    const g = this.grenades;
    if (!(type in g.stock) || !(g.stock[type] > 0) || !this.player.alive) return false;
    g.select(type);
    this.grenadeArmed = type;
    this._gWaitUp = true; // a shot already held does not count: the next press aims
    this._gFire = false;
    return true;
  }

  _grenadeInput(input, time) {
    const g = this.grenades, p = this.player, pv = this.grenadePreview;
    if (input.consumePressed('grenade1')) this.armGrenade('frag');
    if (input.consumePressed('grenade2')) this.armGrenade('cryo');
    if (input.consumePressed('grenade3')) this.armGrenade('molotov');
    if (this.grenadeArmed && !(g.stock[this.grenadeArmed] > 0)) this.grenadeArmed = null;
    pv.active = false;
    const armed = this.grenadeArmed;
    // the press edge counts too: a quick tap (down + up between two steps) must still throw
    const edge = !!(input.consumePressed && input.consumePressed('fire')) && !this.holdFire;
    if (!armed || !p.alive) { this._gFire = false; return; }
    const fire = input.isDown('fire') && !this.holdFire;
    let a = input.getAimWorld ? input.getAimWorld(AIM) : null; // mouse: always; touch: while the finger is down
    if (!a && edge && !fire && input.getLastAimWorld) a = input.getLastAimWorld(AIM); // the tap's point
    if (a) {
      GrenadeSystem.landing(p.x, p.y, a.x, a.y, pv);
      pv.active = true;
      this._gTarget.x = pv.x; this._gTarget.y = pv.y;
    }
    if (edge) { this._gWaitUp = false; this._gFire = true; } // a fresh press after arming
    if (this._gWaitUp) { if (!fire) this._gWaitUp = false; return; }
    if (fire) { this._gFire = true; return; }
    if (this._gFire) { // the shot released: throw the armed grenade at the aimed point
      this._gFire = false;
      if (!a) pv.active = false;
      g.select(armed);
      if (g.throw(p, this._gTarget.x, this._gTarget.y, time)) this.grenadeArmed = null;
    }
  }

  /** Leaving RUNNING (pause, shop, crate): an aim in progress is dropped, never thrown on resume (it stays armed). */
  cancelGrenadeAim() { this._gFire = false; this._gWaitUp = true; this.holdFire = false; this.grenadePreview.active = false; }

  /** Radius in which the keeper can open the shop (base × INTERACT RANGE). */
  get interactRadius() { return KIOSK.interactRadius * this.interactMult; }

  get playerAtKiosk() {
    const p = this.player, k = this.kiosk;
    return p.alive && Math.hypot(p.x - k.x, p.y - k.y) <= this.interactRadius + p.radius;
  }

  /** Shop availability (02_SPEC §12): preparation / intermission only, inside the kiosk radius. */
  get canShop() {
    const ph = this.waves.phase;
    return !this.over && (ph === WAVE_PHASE.INTRO || ph === WAVE_PHASE.INTERMISSION) && this.playerAtKiosk;
  }

  /** Between waves (prep / intermission): the only time shop purchases are allowed. */
  get betweenWaves() {
    const ph = this.waves.phase;
    return !this.over && (ph === WAVE_PHASE.INTRO || ph === WAVE_PHASE.INTERMISSION);
  }

  get over() { return !!this.defeat || this.victory; }

  /** The boss of the final wave (null before it spawns). */
  get boss() { return this.bossSystem.boss; }

  _statsFor(id) {
    if (id === this.weaponStats.id) return this.weaponStats;
    return getWeapon(id) || getDefense(id);
  }

  _typeFor(enemyId) {
    // D60: the current wave's power (extra waves of maps 2–6: +20 % HP and damage per wave; never the boss itself)
    const w = this.waves && this.waves.waves[this.waves.waveIndex];
    const base = getEnemyType(enemyId);
    const pw = base && !base.boss && w && w.power > 0 ? w.power : 1;
    const key = pw === 1 ? enemyId : `${enemyId}@${pw}`;
    let t = this.enemyTypes.get(key);
    if (t === undefined) {
      const m = this.map;
      t = scaledEnemyType(base, (m.enemyHpMult || 1) * pw, m.rewardMult || 1, (m.enemyDamageMult || 1) * pw, m.bossHpMult || 1);
      this.enemyTypes.set(key, t);
    }
    return t;
  }

  /**
   * Spitter attack: a glob flies from the spitter to the beacon edge (or to a device, D52); it lands after
   * distance / globSpeed.
   */
  _launchGlob(e, target, time, device = null) {
    const r = device ? 20 : target.radius;
    const dx = target.x - e.x, dy = target.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const x1 = target.x - (dx / d) * r * 0.6, y1 = target.y - (dy / d) * r * 0.6;
    const t1 = time + Math.max(0.3, (d - r) / e.type.ranged.globSpeed);
    this.globs.push({ x0: e.x, y0: e.y, x1, y1, t0: time, t1, damage: e.type.beaconDamage, device });
    this.events.emit('glob', e.x, e.y);
  }

  /** D62: a spit at the spot where the keeper stood — a straight, low flight; hits him only if he is on its way. */
  _spitAtKeeper(e, x, y, time) {
    const R = e.type.ranged, K = R.keeper;
    const d = Math.hypot(x - e.x, y - e.y) || 1;
    const base = e.type.beaconDamage;
    this.globs.push({
      keeper: true, x0: e.x, y0: e.y, x1: x, y1: y, t0: time, t1: time + Math.max(0.15, d / R.globSpeed), r: R.globRadius,
      damage: Math.max(1, Math.round(base * K.hitMult)), poison: Math.max(1, Math.round(base * K.poisonMult)),
      poisonTime: K.poisonTime, poisonEvery: K.poisonEvery,
    });
    this.events.emit('glob', e.x, e.y);
  }

  /** D62: poison on the keeper — a tick every poisonEvery s until it wears off (through the hit invulnerability). */
  _updatePoison(time) {
    const p = this.player;
    if (!p.alive || !(p.poisonUntil > 0)) return;
    while (p.poisonNextAt > 0 && time >= p.poisonNextAt && p.poisonNextAt <= p.poisonUntil + 1e-6) {
      const at = p.poisonNextAt;
      p.poisonNextAt += p.poisonEvery;
      const applied = p.applyDamage(p.poisonDamage, time, 0, true);
      if (applied > 0) this.events.emit('playerHit', p.x, p.y, applied, 'poison');
      if (!p.alive) break;
      if (at <= 0) break;
    }
    if (time > p.poisonUntil) { p.poisonUntil = 0; p.poisonNextAt = 0; }
  }

  _updateGlobs(time) {
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const g = this.globs[i];
      if (g.keeper) { // D62 spit: in flight it hits the keeper on its way; at the end it splats on the ground
        const k = Math.min(1, Math.max(0, (time - g.t0) / (g.t1 - g.t0)));
        const gx = g.x0 + (g.x1 - g.x0) * k, gy = g.y0 + (g.y1 - g.y0) * k, p = this.player;
        if (p.alive && Math.hypot(p.x - gx, p.y - gy) <= p.radius + g.r) {
          this.globs.splice(i, 1);
          const applied = p.applyDamage(g.damage, time);
          if (applied > 0) this.events.emit('playerHit', p.x, p.y, applied, 'spitter');
          p.poisonDamage = g.poison; p.poisonEvery = g.poisonEvery;
          if (!(p.poisonUntil > time)) p.poisonNextAt = time + g.poisonEvery; // a new spit renews it, never stacks
          p.poisonUntil = time + g.poisonTime;
          this.particles.burst(gx, gy, 12, 150, 0.35, 2.5, '#9be86a');
          continue;
        }
        if (time >= g.t1) { this.globs.splice(i, 1); this.particles.burst(g.x1, g.y1, 8, 110, 0.3, 2.2, '#7fbf55'); }
        continue;
      }
      if (time < g.t1) continue;
      this.globs.splice(i, 1);
      if (g.device) { // D52: a glob at a device hurts it only if it is still installed and working
        const pad = this.defenses.pads[g.device.padIndex];
        if (pad && pad.device === g.device) this.defenses.damage(g.device, g.damage, time);
        this.particles.burst(g.x1, g.y1, 10, 150, 0.35, 2.5, '#9be86a');
        continue;
      }
      const b = this.beacon;
      if (b.destroyed) continue;
      if (b.applyDamage(g.damage, time)) this._setDefeat('beacon');
      this.events.emit('beaconHit', g.x1, g.y1, g.damage);
      this.particles.burst(g.x1, g.y1, 10, 150, 0.35, 2.5, '#9be86a');
    }
  }

  /** Fog Mother summon: enemies rise from the marked circles (respecting the add cap; no reward for them). */
  _summon(points, enemyId, time) {
    let adds = 0;
    for (const e of this.enemies) if (e.alive && !e.type.boss) adds++;
    for (const p of points) {
      if (adds >= WAVE_TIMING.maxAliveAdds) break;
      const e = this._spawnEnemy(enemyId, p.x, p.y, time);
      if (e) { e.noReward = true; adds++; }
    }
  }

  _spawnEnemy(enemyId, x, y, time) {
    const type = this._typeFor(enemyId);
    if (!type || this.enemies.length >= MAX_ENEMIES) return null;
    const cx = Math.min(this.map.width - type.radius, Math.max(type.radius, x));
    const cy = Math.min(this.map.height - type.radius, Math.max(type.radius, y));
    const e = new Enemy(type, cx, cy);
    if (this.world) this.world.pushOut(e); // never spawn inside a rock
    this.enemies.push(e);
    if (type.boss) this.bossSystem.setBoss(e, time);
    this.events.emit('enemySpawn', e);
    return e;
  }

  /** Kill reward: exactly once per enemy, on its transition to DEAD (removal never grants anything). */
  _onKill(e) {
    if (!e || e.rewarded) return;
    e.rewarded = true;
    this.stats.kills += 1;
    const r = e.noReward ? null : e.type.reward; // summoned adds give nothing (the boss fight cannot be farmed)
    if (r) { this.rewards.coins += r.coins | 0; this.rewards.xp += r.xp | 0; }
    this.flare.addKill(e);
    if (r) this.events.emit('killReward', r, e); // → Economy (profile coins + XP), exactly once per enemy
    // D45 death: a dark burst, ash that drifts out slowly and a few embers
    const big = e.type.boss ? 2.5 : e.radius / 17;
    this.particles.burst(e.x, e.y, Math.round(10 * big), 190 * big, 0.45, 3, '#7a2333');
    this.particles.burst(e.x, e.y, Math.round(10 * big), 70 * big, 0.9, 3.2, '#4d4855', 2);
    this.particles.burst(e.x, e.y, Math.round(4 * big), 230 * big, 0.35, 2.2, '#ff9a4a', 6);
  }

  /** Wave bonus once per wave (WaveSystem reports each clear once); the final clear wins the map. */
  _onWaveCleared(index, reward, final) {
    if (this.over) return;
    this.stats.wavesCleared += 1;
    this.rewards.coins += reward;
    this.events.emit('coinReward', reward, 'wave'); // → Economy, once per wave
    if (final) this._setVictory();
  }

  /**
   * START NEXT WAVE (HUD / shop button): only during the intro / intermission, ignored otherwise.
   * An early start pays a one-off coin bonus (D40) — once per wave, because the break ends with it.
   */
  startNextWave(time) {
    this.lastTime = time;
    if (this.over || !this.waves.startNextWave(time)) return false;
    this.events.emit('earlyStart'); // presentation: the "called the wave" sound (after this wave's 'waveStart')
    const bonus = WAVE_TIMING.earlyStartBonus | 0;
    if (bonus > 0) {
      this.rewards.coins += bonus;
      this.events.emit('coinReward', bonus, 'earlyStart');
    }
    return true;
  }

  /** Beacon repair price (D40): proportional to the damage; a full repair from 1% costs `fullFromOnePercent`. */
  beaconRepairCost() {
    const b = this.beacon;
    const missing = Math.max(0, b.maxIntegrity - b.integrity);
    if (missing <= 0 || b.destroyed) return 0;
    const cost = (BEACON.repair.fullFromOnePercent * missing) / (b.maxIntegrity * 0.99);
    return Math.max(1, Math.round(cost));
  }

  /** D52: full repair price of the device on a pad (0 = none / undamaged). */
  deviceRepairCost(padIndex) { return this.over ? 0 : this.defenses.repairCost(padIndex); }

  /** Emergency Flare (Q / flare button): only during an active wave at full charge; ignored otherwise. */
  useFlare(time) {
    if (this.over) return false;
    return this.flare.activate(this.enemies, this.beacon, time, this.waves.phase === WAVE_PHASE.ACTIVE);
  }

  /** @param {import('../platform/InputManager.js').InputManager} input */
  update(input, dt, time) {
    if (this.over) return; // the world stops on defeat / victory
    this.lastTime = time;
    const p = this.player;
    // Positions before this step: the renderer interpolates between them (smooth motion between fixed steps)
    p.prevX = p.x; p.prevY = p.y;
    for (let i = 0; i < this.enemies.length; i++) { const e = this.enemies[i]; e.prevX = e.x; e.prevY = e.y; }
    this.controller.update(p, input, dt, time);
    // D51 perks: keeper / beacon regeneration (continuous, on the game clock)
    if (this.hpRegen > 0 && p.alive && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + this.hpRegen * dt);
    if (this.beaconRegen > 0) this.beacon.repair(this.beaconRegen * dt);
    // D61: no shooting while the grenade wheel is open or a grenade is armed (that shot throws it)
    // D74: a finger aiming by hand wins; otherwise (touch) the gun aims and fires at the nearest reachable enemy
    let fire = input.isDown('fire');
    if (!fire && this.autoFire && !this.holdFire && !this.grenadeArmed) fire = !!this.autoAim.update(p, this.enemies, this.weapon.stats.range);
    else this.autoAim.reset();
    this.weapons.update(this.weapon, p, fire && !this.holdFire && !this.grenadeArmed, input.consumePressed('reload'), time);
    if (input.consumePressed('flare')) this.useFlare(time);
    this._grenadeInput(input, time);
    this.light.update(this.beacon, this.enemies, time);
    if (this.ai.update(this.enemies, this.beacon, dt, time, p)) this._setDefeat('beacon');
    if (this.bossSystem.update(p, this.beacon, time)) this._setDefeat('beacon');
    this.defenses.update(this.enemies, time);
    this.projectileSystem.update(this.enemies, dt, time);
    this.grenades.update(this.enemies, time);
    this.poison.update(this.enemies, time);
    this._updateGlobs(time);
    this._updatePoison(time); // D62
    if (!p.alive) this._setDefeat('player');
    if (!this.defeat) this.waves.update(this.enemies, time);
    this.crates.update(p, this.kiosk, time);

    // Remove dead bodies after their fade (removal never grants anything).
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && time - e.deathAt >= ENEMY_FX.deathFade) this.enemies.splice(i, 1);
    }
    this.particles.update(dt);
  }

  _setDefeat(reason) {
    if (this.over) return;
    this.defeat = reason;
    this.events.emit('mapDefeat', reason);
  }

  _setVictory() {
    if (this.over) return;
    this.victory = true;
    this.rewards.coins += this.map.completionReward | 0;
    this.events.emit('coinReward', this.map.completionReward | 0, 'map'); // → Economy, once per map run
    this.events.emit('mapVictory', this.mapId);
  }

  get wavePhase() { return this.waves.phase; }

  /** Id of the weapon used in this run. */
  get equippedWeaponId() { return this.weaponStats.id; }

  dispose() {
    for (const u of this._unsub) u();
    this._unsub = [];
    this.projectiles.clear();
    this.particles.clear();
    this.defenses.clear();
    this.grenades.clear();      // temporary map data is gone with the run (02_SPEC §13–14)
    this.crates.clear();
    this.globs.length = 0;
    this.temporaryPerks.length = 0;
    this.crateChoices = null;
  }
}

export { WAVE_PHASE };

/**
 * Random kiosk spot for this run (D39): ≤ maxDistFromBeacon from the beacon, clear of the beacon, the build pads and
 * the keeper's spawn. Deterministic for a run seed. Falls back to a fixed safe spot if no sample fits.
 */
export function placeKiosk(map, runSeed) {
  const rng = new SeededRandom((runSeed ^ 0x6b5f1a3d) >>> 0);
  const b = map.beacon;
  const decor = mapColliders(map); // maps 2–6 may have decor inside the kiosk ring (forest groves)
  const ok = (x, y) => {
    if (x < 60 || y < 60 || x > map.width - 60 || y > map.height - 60) return false;
    for (const pad of map.buildPads) if (Math.hypot(x - pad.x, y - pad.y) < KIOSK.minDistFromPads) return false;
    for (const c of decor) if (Math.hypot(x - c.x, y - c.y) < c.r + KIOSK.radius + 20) return false;
    if (map.slowZones && map.slowZones.some((z) => Math.hypot(x - z.x, y - z.y) < z.r + KIOSK.radius + 30)) return false;
    return Math.hypot(x - map.playerSpawn.x, y - map.playerSpawn.y) >= KIOSK.minDistFromSpawn;
  };
  for (let i = 0; i < KIOSK.placementTries; i++) {
    const a = rng.next() * Math.PI * 2;
    // sqrt → uniform over the ring area, not crowded at the inner edge
    const r2min = KIOSK.minDistFromBeacon ** 2, r2max = KIOSK.maxDistFromBeacon ** 2;
    const d = Math.sqrt(r2min + rng.next() * (r2max - r2min));
    const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
    if (ok(x, y)) return { x, y };
  }
  return { x: b.x - 260, y: b.y + 200 };
}
