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
import { CrateSystem } from '../systems/CrateSystem.js';
import { GRENADE_RULES } from '../data/grenades.js';
import { CRATE, PERKS } from '../data/perks.js';

const MAX_ENEMIES = 80; // hard cap of live entities (performance guard; waves stay far below it)
const AIM = { x: 0, y: 0 }; // reused

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

    this.controller = new PlayerController(events, { w: map.width, h: map.height });
    this.weapons = new WeaponSystem(this.projectiles, this.rng, events);
    this.projectileSystem = new ProjectileSystem(this.projectiles, this.rng, events, (id) => this._statsFor(id));
    this.light = new LightSystem();
    this.ai = new EnemyAISystem(events);
    this.bossSystem = new BossSystem(events);
    this.defenses = new DefenseSystem(map.buildPads, this.projectiles, this.rng, events);
    this.flare = new FlareSystem(events); // charge is temporary: a new run starts at 0
    // Temporary map data (MapRunState): grenade stock, crate + perks — gone with this run (retry / new map).
    this.temporaryPerks = [];
    this.crateChoices = null;          // perk ids offered by the open crate
    this.grenades = new GrenadeSystem(this.rng, events);
    this.crates = new CrateSystem(map, new SeededRandom((runSeed ^ 0x2545f491) >>> 0), events);
    this.grenadePreview = { active: false, x: 0, y: 0 }; // aim landing point (presentation: circle + dotted arc)
    this._gWasDown = false;
    this._gTarget = { x: 0, y: 0 };
    this.lastTime = 0;
    this.waves = new WaveSystem(getWaves(map.id) || [], map.spawnPoints, this.rng, events,
      (id, x, y, time) => this._spawnEnemy(id, x, y, time));
    // D45: enemy types scaled for this map (HP / damage × enemyMult, rewards × rewardMult), built once per type.
    this.enemyTypes = new Map();
    // Spitter globs in flight: { x0, y0, x1, y1, t0, t1, damage } — damage on landing, on the game clock
    this.globs = [];
    this.ai.map = map;
    this.controller.map = map;
    this.ai.onRanged = (e, beacon, time) => this._launchGlob(e, beacon, time);
    this.bossSystem.summonFn = (points, enemyId, time) => this._summon(points, enemyId, time);

    this._unsub = [
      events.on('kill', (e) => this._onKill(e)),
      events.on('hit', (x, y, amount) => {
        this.stats.damageDealt += amount;
        this.particles.burst(x, y, 6, 160, 0.22, 2, '#ffb8a0');
      }),
      events.on('shot', (x, y, angle) => {
        this.stats.shotsFired += 1;
        this.particles.cone(x, y, angle, 0.7, 5, 260, 0.12, 2.2, '#ffd27a');
      }),
      events.on('turretShot', (x, y, angle) => this.particles.cone(x, y, angle, 0.6, 3, 220, 0.1, 2, '#ffe0a0')),
      events.on('beaconHit', (x, y, amount) => {
        this.stats.beaconDamageTaken += amount;
        this.particles.burst(x, y, 8, 140, 0.35, 2.5, '#ff9a60');
      }),
      events.on('playerHit', (x, y, amount) => {
        this.stats.damageTaken += amount;
        this.particles.burst(x, y, 10, 170, 0.3, 2.5, '#ff4a3a');
      }),
      events.on('bossImpact', (kind, x, y, r) => this.particles.burst(x, y, kind === 'slam' ? 22 : 30, r * 2.2, 0.45, 3, '#b48cff')),
      events.on('frostPulse', (x, y) => this.particles.burst(x, y, 14, 210, 0.45, 2.5, '#9fd8ff')),
      events.on('bulletBlocked', (x, y) => this.particles.burst(x, y, 5, 130, 0.18, 2, '#c9c3b5')), // stone chips
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
    const prev = this.weaponStats;
    this.weaponStats = ws;
    if (initial || ws.id !== prev.id) this.weapon.equip(ws);
    else { this.weapon.stats = ws; this.weapon.ammo = Math.min(this.weapon.ammo, ws.magazineSize); }
    let speed = loadout.player.speedMult, taken = loadout.player.damageTakenMult, beam = 0;
    for (const id of this.temporaryPerks) {
      const k = PERKS[id];
      if (!k) continue;
      if (k.speedMult) speed *= k.speedMult;
      if (k.damageTakenMult) taken *= k.damageTakenMult;
      if (k.beamDeg) beam += k.beamDeg;
    }
    const m = loadout.player, p = this.player;
    const gained = m.maxHp - p.maxHp;
    p.maxHp = m.maxHp;
    if (gained > 0 && !initial) p.hp += gained;
    p.hp = Math.min(p.hp, p.maxHp);
    p.damageTakenMult = taken;
    this.controller.speedMult = speed;
    this.controller.dodgeCooldownMult = m.dodgeCooldownMult;
    this.interactMult = m.interactMult;
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

  // ---------------- grenades: hold G / drag the touch button to aim, release to throw (D41) ----------------
  _forward(out) {
    const p = this.player;
    out.x = p.x + Math.cos(p.aimAngle) * GRENADE_RULES.tapThrowRange;
    out.y = p.y + Math.sin(p.aimAngle) * GRENADE_RULES.tapThrowRange;
    return out;
  }

  _grenadeInput(input, time) {
    const g = this.grenades, p = this.player, pv = this.grenadePreview;
    if (input.consumePressed('grenade1')) g.select('frag');
    if (input.consumePressed('grenade2')) g.select('cryo');
    if (input.consumePressed('grenade3')) g.select('molotov');
    const down = input.isDown('throwGrenade');
    const quickTap = input.consumePressed('throwGrenade') && !down && !this._gWasDown; // pressed + released in one step
    const ga = input.grenadeAim;
    pv.active = false;
    if (ga && ga.active) {
      pv.active = true;
      GrenadeSystem.landing(p.x, p.y, p.x + ga.ox, p.y + ga.oy, pv);
    } else if (down || quickTap) {
      pv.active = true;
      const a = input.getAimWorld ? input.getAimWorld(AIM) : null;
      if (a) GrenadeSystem.landing(p.x, p.y, a.x, a.y, pv); else this._forward(pv);
    }
    if (pv.active) { this._gTarget.x = pv.x; this._gTarget.y = pv.y; }
    if ((this._gWasDown && !down) || quickTap) g.throw(p, this._gTarget.x, this._gTarget.y, time);
    this._gWasDown = down;
    if (ga && ga.released) {
      ga.released = false;
      if (ga.tap) this._forward(this._gTarget);
      else GrenadeSystem.landing(p.x, p.y, p.x + ga.ox, p.y + ga.oy, this._gTarget);
      ga.tap = false;
      g.throw(p, this._gTarget.x, this._gTarget.y, time);
    }
    pv.active = pv.active && g.total() > 0 && p.alive;
  }

  /** Leaving RUNNING (pause, shop, crate): an aim in progress is dropped, never thrown on resume. */
  cancelGrenadeAim() { this._gWasDown = false; this.grenadePreview.active = false; }

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
    let t = this.enemyTypes.get(enemyId);
    if (t === undefined) {
      t = scaledEnemyType(getEnemyType(enemyId), this.map.enemyMult || 1, this.map.rewardMult || 1);
      this.enemyTypes.set(enemyId, t);
    }
    return t;
  }

  /** Spitter attack: a glob flies from the spitter to the beacon edge; it lands after distance / globSpeed. */
  _launchGlob(e, beacon, time) {
    const dx = beacon.x - e.x, dy = beacon.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const x1 = beacon.x - (dx / d) * beacon.radius * 0.6, y1 = beacon.y - (dy / d) * beacon.radius * 0.6;
    const t1 = time + Math.max(0.3, (d - beacon.radius) / e.type.ranged.globSpeed);
    this.globs.push({ x0: e.x, y0: e.y, x1, y1, t0: time, t1, damage: e.type.beaconDamage });
    this.events.emit('glob', e.x, e.y);
  }

  _updateGlobs(time) {
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const g = this.globs[i];
      if (time < g.t1) continue;
      this.globs.splice(i, 1);
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
    this.particles.burst(e.x, e.y, e.type.boss ? 40 : 16, e.type.boss ? 320 : 190, 0.5, 3, '#7a2333');
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
    this.controller.update(p, input, dt, time);
    this.weapons.update(this.weapon, p, input.isDown('fire'), input.consumePressed('reload'), time);
    if (input.consumePressed('flare')) this.useFlare(time);
    this._grenadeInput(input, time);
    this.light.update(this.beacon, this.enemies, time);
    if (this.ai.update(this.enemies, this.beacon, dt, time, p)) this._setDefeat('beacon');
    if (this.bossSystem.update(p, this.beacon, time)) this._setDefeat('beacon');
    this.defenses.update(this.enemies, time);
    this.projectileSystem.update(this.enemies, dt, time);
    this.grenades.update(this.enemies, time);
    this._updateGlobs(time);
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
