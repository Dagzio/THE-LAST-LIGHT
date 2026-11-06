// Runtime of one map attempt: entities + systems, created fresh on every map start / retry.
// Holds only temporary data (MapRunState side); the permanent PlayerProfile arrives in Phase 5.
// Update order: player → targeting → weapon → projectiles → enemy cleanup → test harness → particles.
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { ProjectilePool } from '../entities/ProjectilePool.js';
import { PlayerController } from '../systems/PlayerController.js';
import { TargetingSystem } from '../systems/TargetingSystem.js';
import { WeaponSystem, WeaponState } from '../systems/WeaponSystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { SeededRandom } from './SeededRandom.js';
import { Particles } from '../render/Particles.js';
import { getWeapon } from '../data/weapons.js';
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
    this.stats = { kills: 0, damageDealt: 0, shotsFired: 0 };

    this.player = new Player(map.playerSpawn.x, map.playerSpawn.y);
    this.enemies = [];
    this.projectiles = new ProjectilePool(CAPS.projectiles);
    this.particles = new Particles(CAPS.particles);

    // Equipped weapon — Phase 2: always the starting pistol (profile/shop arrive in Phase 5).
    this.weaponStats = getWeapon('pistol');
    this.weapon = new WeaponState(this.weaponStats);

    this.controller = new PlayerController(events);
    this.targeting = new TargetingSystem();
    this.weapons = new WeaponSystem(this.projectiles, this.rng, events);
    this.projectileSystem = new ProjectileSystem(this.projectiles, this.rng, events, (id) => this._statsFor(id));

    this._unsub = [
      events.on('kill', () => { this.stats.kills += 1; }),
      events.on('hit', (x, y, amount) => { this.stats.damageDealt += amount; }),
      events.on('shot', (x, y, angle) => {
        this.stats.shotsFired += 1;
        this.particles.cone(x, y, angle, 0.7, 5, 260, 0.12, 2.2, '#ffd27a');
      }),
      events.on('hit', (x, y) => this.particles.burst(x, y, 6, 160, 0.22, 2, '#ffb8a0')),
      events.on('kill', (e) => this.particles.burst(e.x, e.y, 16, 190, 0.5, 3, '#7a2333')),
    ];

    // PHASE 2 TEST HARNESS: static Grunts, respawned after all die. Replaced by waves in Phase 4.
    this.testRespawnAt = -1;
    this._spawnTestDummies();
  }

  _statsFor(id) { return id === this.weaponStats.id ? this.weaponStats : getWeapon(id); }

  _spawnTestDummies() {
    for (const d of TEST_ARENA.dummies) {
      const type = getEnemyType(d.enemyId);
      if (type) this.enemies.push(new Enemy(type, d.x, d.y));
    }
  }

  /** @param {import('../platform/InputManager.js').InputManager} input */
  update(input, dt, time) {
    const p = this.player;
    this.controller.update(p, input, dt, time);
    const target = this.targeting.update(p, this.enemies, this.weapon.stats.range, time);
    this.weapons.update(this.weapon, p, target, input.consumePressed('reload'), time);
    this.projectileSystem.update(this.enemies, dt, time);

    // Remove dead bodies after their fade (removal never grants anything).
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && time - e.deathAt >= ENEMY_FX.deathFade) this.enemies.splice(i, 1);
    }

    // Test harness respawn.
    let anyAlive = false;
    for (const e of this.enemies) if (e.alive) { anyAlive = true; break; }
    if (!anyAlive) {
      if (this.testRespawnAt < 0) this.testRespawnAt = time + TEST_ARENA.respawnDelay;
      else if (time >= this.testRespawnAt && this.enemies.length === 0) { this.testRespawnAt = -1; this._spawnTestDummies(); }
    }

    this.particles.update(dt);
  }

  get target() { return this.targeting.target; }

  dispose() {
    for (const u of this._unsub) u();
    this._unsub = [];
    this.projectiles.clear();
    this.particles.clear();
  }
}
