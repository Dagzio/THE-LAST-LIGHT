// Boss attacks (D35, 02_SPEC §9; Fog Mother D45). Readable patterns, each telegraphed on the ground before damage:
// SLAM — circle under the keeper; TIDE — ring around the boss rolling out to its radius (also hits the beacon when it
// is inside); SUMMON (Fog Mother) — marked circles around the boss, an enemy rises from each when the telegraph ends.
// One attack at a time; the boss stands still while casting. Damage resolves once per attack, on the game clock
// (pause freezes telegraphs). Numbers come from data/boss.js × the map's enemyDamageMult × attackMult (boss.type.damageMult).
// No complex state machine: idle → casting → idle.
import { getBossPattern } from '../data/boss.js';

export class BossSystem {
  /** @param {import('../core/GameEvents.js').GameEvents} events */
  constructor(events) {
    this.events = events;
    this.boss = null;
    this.pattern = null;
    this.attack = null;      // { kind, x, y, radius, startedAt, hitsAt, points? } while telegraphing
    this.lastImpact = null;  // { kind, x, y, radius, at } — presentation of the last impact
    this.nextSlamAt = 0;
    this.nextTideAt = 0;
    this.nextSummonAt = Infinity;
    /** @type {(points:Array<{x:number,y:number}>, enemyId:string, time:number)=>void} set by the map run */
    this.summonFn = null;
    /** @type {import('./DefenseSystem.js').DefenseSystem|null} D52: slam / tide also damage devices in the area */
    this.defenses = null;
  }

  /** Registers the boss when it spawns. */
  setBoss(boss, time) {
    const P = getBossPattern(boss.typeId);
    this.boss = boss;
    this.pattern = P;
    this.attack = null;
    this.lastImpact = null;
    this.nextSlamAt = time + P.slam.firstDelay;
    this.nextTideAt = time + P.tide.firstDelay;
    this.nextSummonAt = P.summon ? time + P.summon.firstDelay : Infinity;
  }

  get damageMult() { return (this.boss && this.boss.type.damageMult) || 1; }

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
    const P = this.pattern, S = P.slam, Tc = P.tide, Sm = P.summon;
    if (time >= this.nextTideAt) {
      this._begin('tide', b.x, b.y, Tc.radius, Tc.telegraph, time);
    } else if (Sm && time >= this.nextSummonAt) {
      const points = [];
      for (let i = 0; i < Sm.count; i++) {
        const a = b.faceAngle + Math.PI + ((i - (Sm.count - 1) / 2) * Math.PI) / Sm.count; // a fan behind her
        points.push({ x: b.x + Math.cos(a) * Sm.distance, y: b.y + Math.sin(a) * Sm.distance });
      }
      this._begin('summon', b.x, b.y, Sm.markRadius, Sm.telegraph, time);
      this.attack.points = points;
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
    const a = this.attack, P = this.pattern, k = this.damageMult;
    this.attack = null;
    this.boss.casting = false;
    this.boss.lastAttackAt = time;
    this.lastImpact = { kind: a.kind, x: a.x, y: a.y, radius: a.radius, at: time };
    let fell = false;
    const inside = (x, y, r) => Math.hypot(x - a.x, y - a.y) <= a.radius + r;
    if (a.kind !== 'summon' && this.defenses) { // D52: devices inside the impact take the beacon-level damage
      const dmg = Math.round((a.kind === 'slam' ? P.slam.damage : P.tide.beaconDamage) * k);
      for (const pad of this.defenses.pads) {
        const d = pad.device;
        if (d && d.hp > 0 && inside(d.x, d.y, 24)) this.defenses.damage(d, dmg, time);
      }
    }
    if (a.kind === 'slam') {
      this.nextSlamAt = time + P.slam.interval;
      if (player.alive && inside(player.x, player.y, player.radius)) {
        const applied = player.applyDamage(Math.round(P.slam.damage * k), time);
        if (applied > 0) this.events.emit('playerHit', player.x, player.y, applied, 'slam');
      }
    } else if (a.kind === 'summon') {
      this.nextSummonAt = time + P.summon.interval;
      this.nextSlamAt = Math.max(this.nextSlamAt, time + 1.0);
      this.lastImpact = null; // the risen enemies are the impact
      if (this.summonFn) this.summonFn(a.points, P.summon.enemyId, time);
      this.events.emit('bossSummon', a.points);
      return false;
    } else {
      const Tc = P.tide;
      this.nextTideAt = time + Tc.interval;
      this.nextSlamAt = Math.max(this.nextSlamAt, time + 1.0); // a short breather after the tide
      if (player.alive && inside(player.x, player.y, player.radius)) {
        const applied = player.applyDamage(Math.round(Tc.playerDamage * k), time);
        if (applied > 0) this.events.emit('playerHit', player.x, player.y, applied, 'tide');
      }
      if (!beacon.destroyed && inside(beacon.x, beacon.y, beacon.radius)) {
        const dmg = Math.round(Tc.beaconDamage * k);
        if (beacon.applyDamage(dmg, time)) fell = true;
        this.events.emit('beaconHit', beacon.x, beacon.y, dmg);
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
