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
import { getEnemyType } from '../data/enemies.js';
import { getWaves } from '../data/waves.js';
import { CAPS, ENEMY_FX } from '../data/balance.js';
import { KIOSK } from '../data/kiosk.js';
import { defaultLoadout } from '../systems/Loadout.js';

const MAX_ENEMIES = 80; // hard cap of live entities (performance guard; waves stay far below it)

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
    this.waves = new WaveSystem(getWaves(map.id) || [], map.spawnPoints, this.rng, events,
      (id, x, y, time) => this._spawnEnemy(id, x, y, time));

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
      events.on('waveCleared', (index, reward, final) => this._onWaveCleared(index, reward, final)),
    ];

    this.applyLoadout(loadout, true);
    this.player.hp = this.player.maxHp;
    this.kiosk = placeKiosk(map, runSeed); // new spot every run (D39); its own RNG keeps combat RNG unchanged
    this.waves.start(0);
  }

  /**
   * Applies permanent progression (map start, and after shop purchases between waves).
   * A changed weapon is re-equipped with a full magazine; VITALITY adds its HP right away.
   */
  applyLoadout(loadout, initial = false) {
    const ws = loadout.weaponStats;
    const changed = initial || ws.id !== this.weaponStats.id || JSON.stringify(ws) !== JSON.stringify(this.weaponStats);
    this.weaponStats = ws;
    if (changed && !initial) this.weapon.equip(ws);
    const m = loadout.player, p = this.player;
    const gained = m.maxHp - p.maxHp;
    p.maxHp = m.maxHp;
    if (gained > 0 && !initial) p.hp += gained;
    p.hp = Math.min(p.hp, p.maxHp);
    p.damageTakenMult = m.damageTakenMult;
    this.controller.speedMult = m.speedMult;
    this.controller.dodgeCooldownMult = m.dodgeCooldownMult;
    this.interactMult = m.interactMult;
  }

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

  _spawnEnemy(enemyId, x, y, time) {
    const type = getEnemyType(enemyId);
    if (!type || this.enemies.length >= MAX_ENEMIES) return null;
    const cx = Math.min(this.map.width - type.radius, Math.max(type.radius, x));
    const cy = Math.min(this.map.height - type.radius, Math.max(type.radius, y));
    const e = new Enemy(type, cx, cy);
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
    const r = e.type.reward;
    if (r) { this.rewards.coins += r.coins | 0; this.rewards.xp += r.xp | 0; }
    this.flare.addKill(e);
    this.events.emit('killReward', r, e); // → Economy (profile coins + XP), exactly once per enemy
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

  /** START NEXT WAVE (HUD button): only during the intro / intermission, ignored otherwise. */
  startNextWave(time) {
    if (this.over) return false;
    return this.waves.startNextWave(time);
  }

  /** Emergency Flare (Q / flare button): only during an active wave at full charge; ignored otherwise. */
  useFlare(time) {
    if (this.over) return false;
    return this.flare.activate(this.enemies, this.beacon, time, this.waves.phase === WAVE_PHASE.ACTIVE);
  }

  /** @param {import('../platform/InputManager.js').InputManager} input */
  update(input, dt, time) {
    if (this.over) return; // the world stops on defeat / victory
    const p = this.player;
    this.controller.update(p, input, dt, time);
    this.weapons.update(this.weapon, p, input.isDown('fire'), input.consumePressed('reload'), time);
    if (input.consumePressed('flare')) this.useFlare(time);
    this.light.update(this.beacon, this.enemies, time);
    if (this.ai.update(this.enemies, this.beacon, dt, time, p)) this._setDefeat('beacon');
    if (this.bossSystem.update(p, this.beacon, time)) this._setDefeat('beacon');
    this.defenses.update(this.enemies, time);
    this.projectileSystem.update(this.enemies, dt, time);
    if (!p.alive) this._setDefeat('player');
    if (!this.defeat) this.waves.update(this.enemies, time);

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
  const ok = (x, y) => {
    if (x < 60 || y < 60 || x > map.width - 60 || y > map.height - 60) return false;
    for (const pad of map.buildPads) if (Math.hypot(x - pad.x, y - pad.y) < KIOSK.minDistFromPads) return false;
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
