// Runtime of one map attempt: entities + systems, created fresh on every map start / retry.
// Holds only temporary data (MapRunState side); the permanent PlayerProfile arrives in Phase 5.
// Update order: player → weapon → light → enemy AI (beacon attacks) → defenses → projectiles → cleanup →
// test harness → particles. Defeat (beacon fallen) is reported exactly once.
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Beacon } from '../entities/Beacon.js';
import { ProjectilePool } from '../entities/ProjectilePool.js';
import { PlayerController } from '../systems/PlayerController.js';
import { WeaponSystem, WeaponState } from '../systems/WeaponSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { LightSystem } from '../systems/LightSystem.js';
import { EnemyAISystem } from '../systems/EnemyAISystem.js';
import { DefenseSystem } from '../systems/DefenseSystem.js';
import { SeededRandom } from './SeededRandom.js';
import { Particles } from '../render/Particles.js';
import { getWeapon } from '../data/weapons.js';
import { getDefense } from '../data/defenses.js';
import { getEnemyType } from '../data/enemies.js';
import { CAPS, ENEMY_FX } from '../data/balance.js';
import { TEST_ARENA } from '../data/testArena.js';

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
    this.stats = { kills: 0, damageDealt: 0, shotsFired: 0, beaconDamageTaken: 0 };
    this.defeat = null; // 'beacon' | 'player' — set once

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
    this.defenses = new DefenseSystem(map.buildPads, this.projectiles, this.rng, events);

    this._unsub = [
      events.on('kill', (e) => {
        this.stats.kills += 1;
        this.particles.burst(e.x, e.y, 16, 190, 0.5, 3, '#7a2333');
      }),
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
      events.on('frostPulse', (x, y) => this.particles.burst(x, y, 14, 210, 0.45, 2.5, '#9fd8ff')),
    ];

    // TEST HARNESS (until waves / shop): devices through the real placement command; Grunts from the edges.
    for (const d of TEST_ARENA.devices) this.defenses.place(d.padIndex, d.defenseId, 0);
    this.testNextSpawnAt = TEST_ARENA.spawn.firstDelay;
    this.testSpawnIndex = 0;
  }

  _statsFor(id) {
    if (id === this.weaponStats.id) return this.weaponStats;
    return getWeapon(id) || getDefense(id);
  }

  _spawnTestEnemy() {
    const cfg = TEST_ARENA.spawn;
    let alive = 0;
    for (const e of this.enemies) if (e.alive) alive++;
    if (alive >= cfg.maxAlive) return;
    const group = this.map.spawnPoints[cfg.groups[this.testSpawnIndex % cfg.groups.length]];
    const point = group[Math.floor(this.rng.next() * group.length)];
    this.testSpawnIndex++;
    const type = getEnemyType(cfg.enemyId);
    if (type) this.enemies.push(new Enemy(type, point.x, point.y));
  }

  /** @param {import('../platform/InputManager.js').InputManager} input */
  update(input, dt, time) {
    if (this.defeat) return; // the world stops on defeat
    const p = this.player;
    this.controller.update(p, input, dt, time);
    this.weapons.update(this.weapon, p, input.isDown('fire'), input.consumePressed('reload'), time);
    this.light.update(this.beacon, this.enemies, time);
    if (this.ai.update(this.enemies, this.beacon, dt, time)) this._setDefeat('beacon');
    this.defenses.update(this.enemies, time);
    this.projectileSystem.update(this.enemies, dt, time);
    if (!p.alive) this._setDefeat('player'); // player damage arrives in Phase 4 (contact / boss attacks)

    // Remove dead bodies after their fade (removal never grants anything).
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && time - e.deathAt >= ENEMY_FX.deathFade) this.enemies.splice(i, 1);
    }

    if (time >= this.testNextSpawnAt) {
      this.testNextSpawnAt = time + TEST_ARENA.spawn.interval;
      this._spawnTestEnemy();
    }

    this.particles.update(dt);
  }

  _setDefeat(reason) {
    if (this.defeat) return;
    this.defeat = reason;
    this.events.emit('mapDefeat', reason);
  }

  dispose() {
    for (const u of this._unsub) u();
    this._unsub = [];
    this.projectiles.clear();
    this.particles.clear();
    this.defenses.clear();
  }
}
