// Runtime of one map attempt: entities + systems, created fresh on every map start / retry.
// Holds only temporary data (MapRunState side); the permanent PlayerProfile arrives in Phase 5 — until then kill and
// wave rewards are accumulated here (`rewards`) exactly once each and are not yet spent or saved.
// Update order: player → weapon → light → enemy AI (beacon attacks, contact) → boss attacks → defenses →
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
import { SeededRandom } from './SeededRandom.js';
import { Particles } from '../render/Particles.js';
import { getWeapon } from '../data/weapons.js';
import { getDefense } from '../data/defenses.js';
import { getEnemyType } from '../data/enemies.js';
import { getWaves } from '../data/waves.js';
import { CAPS, ENEMY_FX } from '../data/balance.js';
import { TEST_ARENA } from '../data/testArena.js';

const MAX_ENEMIES = 80; // hard cap of live entities (performance guard; waves stay far below it)

export class MapRun {
  /**
   * @param {object} map entry of data/maps.js
   * @param {number} runSeed
   * @param {import('./GameEvents.js').GameEvents} events
   */
  constructor(map, runSeed, events) {
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

    // Equipped weapon — still the starting pistol (profile/shop arrive in Phase 5).
    this.weaponStats = getWeapon('pistol');
    this.weapon = new WeaponState(this.weaponStats);

    this.controller = new PlayerController(events, { w: map.width, h: map.height });
    this.weapons = new WeaponSystem(this.projectiles, this.rng, events);
    this.projectileSystem = new ProjectileSystem(this.projectiles, this.rng, events, (id) => this._statsFor(id));
    this.light = new LightSystem();
    this.ai = new EnemyAISystem(events);
    this.bossSystem = new BossSystem(events);
    this.defenses = new DefenseSystem(map.buildPads, this.projectiles, this.rng, events);
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

    // TEST HARNESS until the shop (D36): devices through the real placement command.
    for (const d of TEST_ARENA.devices) this.defenses.place(d.padIndex, d.defenseId, 0);
    this.waves.start(0);
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
    this.particles.burst(e.x, e.y, e.type.boss ? 40 : 16, e.type.boss ? 320 : 190, 0.5, 3, '#7a2333');
  }

  /** Wave bonus once per wave (WaveSystem reports each clear once); the final clear wins the map. */
  _onWaveCleared(index, reward, final) {
    if (this.over) return;
    this.stats.wavesCleared += 1;
    this.rewards.coins += reward;
    if (final) this._setVictory();
  }

  /** START NEXT WAVE (HUD button): only during the intro / intermission, ignored otherwise. */
  startNextWave(time) {
    if (this.over) return false;
    return this.waves.startNextWave(time);
  }

  /** @param {import('../platform/InputManager.js').InputManager} input */
  update(input, dt, time) {
    if (this.over) return; // the world stops on defeat / victory
    const p = this.player;
    this.controller.update(p, input, dt, time);
    this.weapons.update(this.weapon, p, input.isDown('fire'), input.consumePressed('reload'), time);
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
    this.events.emit('mapVictory', this.mapId);
  }

  get wavePhase() { return this.waves.phase; }

  dispose() {
    for (const u of this._unsub) u();
    this._unsub = [];
    this.projectiles.clear();
    this.particles.clear();
    this.defenses.clear();
  }
}

export { WAVE_PHASE };
