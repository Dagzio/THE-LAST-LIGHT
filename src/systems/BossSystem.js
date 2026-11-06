// Gloam Warden attacks (D35, 02_SPEC §9): two readable patterns, each telegraphed on the ground before damage.
// GLOAM SLAM — circle under the keeper; DARK TIDE — ring around the boss rolling out to its radius (also hits the
// beacon when it is inside). One attack at a time; the boss stands still while casting. Damage resolves once per
// attack, on the game clock (pause freezes telegraphs). No complex state machine: idle → casting → idle.
import { GLOAM_WARDEN } from '../data/boss.js';

export class BossSystem {
  /** @param {import('../core/GameEvents.js').GameEvents} events */
  constructor(events) {
    this.events = events;
    this.boss = null;
    this.attack = null;      // { kind, x, y, radius, startedAt, hitsAt } while telegraphing
    this.lastImpact = null;  // { kind, x, y, radius, at } — presentation of the last impact
    this.nextSlamAt = 0;
    this.nextTideAt = 0;
  }

  /** Registers the boss when it spawns. */
  setBoss(boss, time) {
    this.boss = boss;
    this.attack = null;
    this.lastImpact = null;
    this.nextSlamAt = time + GLOAM_WARDEN.slam.firstDelay;
    this.nextTideAt = time + GLOAM_WARDEN.tide.firstDelay;
  }

  /**
   * @returns {boolean} true exactly once — when the tide destroyed the beacon this step
   */
  update(player, beacon, time) {
    const b = this.boss;
    if (!b) return false;
    if (!b.alive) { // a dead boss cancels its telegraph
      if (this.attack) { this.attack = null; b.casting = false; }
      return false;
    }
    if (this.attack) {
      if (time < this.attack.hitsAt) return false;
      return this._resolve(player, beacon, time);
    }
    const S = GLOAM_WARDEN.slam, Tc = GLOAM_WARDEN.tide;
    if (time >= this.nextTideAt) {
      this._begin('tide', b.x, b.y, Tc.radius, Tc.telegraph, time);
    } else if (time >= this.nextSlamAt && player.alive && Math.hypot(player.x - b.x, player.y - b.y) <= S.triggerRange) {
      this._begin('slam', player.x, player.y, S.radius, S.telegraph, time);
    }
    return false;
  }

  _begin(kind, x, y, radius, telegraph, time) {
    this.attack = { kind, x, y, radius, startedAt: time, hitsAt: time + telegraph };
    this.boss.casting = true;
    this.boss.faceAngle = kind === 'slam' ? Math.atan2(y - this.boss.y, x - this.boss.x) : this.boss.faceAngle;
    this.events.emit('bossTelegraph', kind, x, y, radius);
  }

  _resolve(player, beacon, time) {
    const a = this.attack;
    this.attack = null;
    this.boss.casting = false;
    this.boss.lastAttackAt = time;
    this.lastImpact = { kind: a.kind, x: a.x, y: a.y, radius: a.radius, at: time };
    let fell = false;
    const inside = (x, y, r) => Math.hypot(x - a.x, y - a.y) <= a.radius + r;
    if (a.kind === 'slam') {
      const S = GLOAM_WARDEN.slam;
      this.nextSlamAt = time + S.interval;
      if (player.alive && inside(player.x, player.y, player.radius)) {
        const applied = player.applyDamage(S.damage, time);
        if (applied > 0) this.events.emit('playerHit', player.x, player.y, applied, 'slam');
      }
    } else {
      const Tc = GLOAM_WARDEN.tide;
      this.nextTideAt = time + Tc.interval;
      this.nextSlamAt = Math.max(this.nextSlamAt, time + 1.0); // a short breather after the tide
      if (player.alive && inside(player.x, player.y, player.radius)) {
        const applied = player.applyDamage(Tc.playerDamage, time);
        if (applied > 0) this.events.emit('playerHit', player.x, player.y, applied, 'tide');
      }
      if (!beacon.destroyed && inside(beacon.x, beacon.y, beacon.radius)) {
        if (beacon.applyDamage(Tc.beaconDamage, time)) fell = true;
        this.events.emit('beaconHit', beacon.x, beacon.y, Tc.beaconDamage);
      }
    }
    this.events.emit('bossImpact', a.kind, a.x, a.y, a.radius);
    return fell;
  }

  /** 0..1 telegraph progress of the current attack (presentation). */
  progress(time) {
    const a = this.attack;
    if (!a) return 0;
    return Math.min(1, Math.max(0, (time - a.startedAt) / Math.max(1e-6, a.hitsAt - a.startedAt)));
  }
}
