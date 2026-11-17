// D88 (user request): the TUTORIAL director — the lessons of the training ground (data/tutorial.js) one by one: which
// lesson is on, its progress, its gate. The stealth yard borrows the stealth rules (StealthDirector: the sneak, the
// takedown) — but nothing there fails the run: a guard who saw the hero calms down after a moment. Dummies stand and
// never shoot; only the ambush yard shoots back (and then the medkit makes sense). Pure simulation, game clock only.
import { TUTORIAL } from '../data/tutorial.js';
import { STEALTH } from '../data/stealth.js';
import { StealthDirector } from './StealthDirector.js';

const NO_TARGETS = [];

export class TutorialDirector {
  /** @param {import('../core/MissionRun.js').MissionRun} run */
  constructor(run) {
    this.run = run;
    this.stealth = new StealthDirector(run);  // its rules run only inside the stealth yard (preUpdate)
    this.stealth.dispose();                    // …without its alarm rules (witness, second body, radio calls)
    run.controller.speedProfile = null;        // …elsewhere the normal speeds
    run.player.sneak = false;
    run.player.stance = 'stand';
    run.player.minHp = TUTORIAL.minHp;          // D89: the lessons never end in a defeat
    this.steps = TUTORIAL.steps;
    this.hintAt = -Infinity;
    this.index = -1;
    this.count = 0;               // progress of the lesson (hits, ...)
    this.inStealth = false;
    this.ambushOn = false;
    this.spottedSaid = false;
    this.targets = run.level.props.filter((p) => p.target);
    this.takedownTarget = null;
    this.copying = false;
    this._unsub = [
      run.events.on('bulletBlocked', (x, y) => this._onImpact(x, y)),
      run.events.on('reloadEnd', () => { if (this.step && this.step.id === 'reload') this._done(); }),
      run.events.on('ammoPickup', () => { if (this.step && this.step.id === 'loot') this._done(); }),
      run.events.on('crateOpened', (item) => this._onCrate(item)),
      run.events.on('bulletProofHit', (e, time) => this._onBulletProof(e, time)),
    ];
    this._next(0);
  }

  dispose() { for (const u of this._unsub) u(); this._unsub = []; this.stealth.dispose(); }

  get step() { return this.steps[this.index] || null; }

  /** The HUD objective of the lesson on: { textKey, n, of, keys }. */
  get objective() {
    const s = this.step;
    return s ? { id: s.id, textKey: s.textKey, n: Math.min(this.count, s.need || 0), of: s.need || 0, keys: s.keys || [] } : null;
  }

  objectiveTarget(out) {
    const s = this.step;
    if (!s || !s.target) return null;
    out.x = s.target[0]; out.y = s.target[1];
    return out;
  }

  /** D89: the mobile version's auto aim (it fires at enemies only) takes the range targets during the shooting lessons. */
  get aimTargets() {
    const s = this.step;
    if (!s || s.id !== 'hits') return null;
    if (this.run.weapon.weaponId !== s.weapon) return NO_TARGETS; // the wrong gun: no rounds wasted (switch first)
    return this._aim || (this._aim = this.targets.map((t) => ({ x: t.x, y: t.y + 4, radius: 6, alive: true })));
  }

  // the stealth director's flags the HUD reads
  get autoFireAllowed() { return !this.inStealth; }
  get heroVisibility() { return this.stealth.heroVisibility; }

  _next(i) {
    this.index = i;
    this.count = 0;
    const s = this.step;
    if (!s) return;
    // progress already made counts (both guns taken before, a target already down)
    this._check();
    // D89: the cover yard's dummies take rounds only during their own lesson (not felled early from another yard)
    for (const e of this.run.enemies) if (e.tag === 'cover1' || e.tag === 'cover2') e.bulletProof = !(s.id === 'kill' && s.tag === e.tag);
    // D89: the reload lesson needs a magazine that is not full (rounds go back to the reserve — nothing is lost)
    if (s.id === 'reload') {
      const w = this.run.weapon;
      if (w && !w.reloading && w.ammo >= w.stats.magazineSize) { const k = Math.ceil(w.stats.magazineSize / 3); w.ammo -= k; w.reserve += k; }
    }
    this.run.events.emit('tutorialStep', i, s);
    // asked for on the next step (the first one: once the level is on screen, after the run has started)
    if (s.dialogue) this.pendingDialogue = s.dialogue;
  }

  _done() {
    const s = this.step;
    if (!s) return;
    if (s.opens) {
      const d = this.run.doors.find((x) => x.id === s.opens);
      if (d && d.locked) { d.locked = false; this.run.events.emit('doorUnlocked', d.id); }
    }
    this.run.events.emit('tutorialDone', this.index, s);
    this._next(this.index + 1);
  }

  /** Conditions that are a state (not an event): checked every step. */
  _check() {
    const s = this.step, run = this.run;
    if (!s) return;
    if (s.id === 'arm') {
      this.count = (run.inventory.includes('smg') ? 1 : 0) + (run.inventory.includes('rifle') ? 1 : 0);
      if (this.count >= s.need) this._done();
    } else if (s.id === 'coverLow') {
      if (run.player.cover && run.player.cover.kind === 'low') this._done();
    } else if (s.id === 'kill') {
      const group = run.enemies.filter((e) => e.tag === s.tag);
      if (group.length && group.every((e) => !e.alive)) this._done();
    } else if (s.id === 'loot') {
      // nothing left to take (every body emptied, or no gun for those rounds) — the lesson is over anyway
      if (!run.enemies.some((e) => !e.alive && e.ammoDrop > 0 && (e.tag === 'cover1' || e.tag === 'cover2'))) this._done();
    } else if (s.id === 'takedown') {
      if ((run.stats.takedowns | 0) >= 1) this._done();
    } else if (s.id === 'grenades') {
      if ((run.grenades.stock.frag | 0) > 0) this._done();
    }
  }

  _onImpact(x, y) {
    const s = this.step;
    if (!s || s.id !== 'hits' || this.run.weapon.weaponId !== s.weapon) return;
    const r = TUTORIAL.hitsNear;
    if (!this.targets.some((t) => Math.abs(t.x - x) <= r && Math.abs(t.y - y) <= r)) return;
    this.count += 1;
    this.run.events.emit('targetHit', x, y);
    if (this.count >= s.need) this._done();
  }

  _onCrate(item) {
    const s = this.step;
    if (!s) return;
    if ((s.id === 'ammo' && item === 'ammo') || (s.id === 'medkit' && item === 'medkit')) this._done();
  }

  /** D89: a round stopped on a lesson's bullet-proof target — the hint says what this lesson wants (throttled). */
  _onBulletProof(e, time) {
    if (time - this.hintAt < TUTORIAL.hintEvery) return;
    this.hintAt = time;
    this.run.events.emit('tutorialHint', e.tag === 'grenade' ? 'banner.useGrenade' : e.tag === 'stealth' ? 'banner.useTakedown' : 'banner.notYet');
  }

  _onMat(p) {
    const m = this.run.level.rollMat;
    return !!m && p.x >= m[0] && p.x <= m[2] && p.y >= m[1] && p.y <= m[3];
  }

  preUpdate(input, dt, time) {
    const run = this.run, p = run.player;
    // the stealth yard: the stealth rules (sneak by default, the takedown); elsewhere the normal movement
    const inStealth = run.levelWorld.zoneAt(p.x, p.y) === 'stealth';
    if (inStealth !== this.inStealth) {
      this.inStealth = inStealth;
      run.controller.speedProfile = inStealth ? STEALTH.speeds : null;
      p.sneak = inStealth;
      if (!inStealth) { p.stance = 'stand'; p.moveMode = 'walk'; }
    }
    if (inStealth || p.takedown) {
      this.stealth.preUpdate(input, dt, time);
      this.takedownTarget = this.stealth.takedownTarget;
    } else {
      this.takedownTarget = null;
      input.consumePressed('takedown'); input.consumePressed('crouch');
    }
  }

  update(dt, time) {
    const run = this.run, p = run.player;
    this._check();
    const s = this.step;
    if (this.pendingDialogue) { const id = this.pendingDialogue; this.pendingDialogue = null; run.events.emit('dialogue', id); }
    // the roll lesson: a roll that started or is passing over the mats
    if (s && s.id === 'roll' && p.dodging && this._onMat(p)) this._done();
    // D89: the grenade lesson never runs dry — out of grenades with dummies standing, the instructor hands one more
    const gr = run.grenades;
    if (s && s.id === 'kill' && s.tag === 'grenade' && gr && !(gr.stock.frag > 0) && !gr.flying.length
      && run.enemies.some((e) => e.tag === 'grenade' && e.alive)) {
      gr.stock.frag = 1;
      run.events.emit('tutorialHint', 'banner.grenadeRefill');
    }
    // the ambush yard: they open fire once the hero walks in
    if (s && s.ambush && !this.ambushOn && run.levelWorld.zoneAt(p.x, p.y) === 'ambush') {
      this.ambushOn = true;
      for (const e of run.enemies) {
        if (e.tag !== 'ambush' || !e.alive) continue;
        e.dummy = false; e.harmless = false; e.bulletProof = false; // D89: dormant until the hero walks in
        const ai = e.ai;
        ai.mode = 'combat'; ai.aware = true; ai.suspicion = 1; ai.lastSeenX = p.x; ai.lastSeenY = p.y; ai.lastSeenAt = time; ai.reactAt = time + 0.8;
      }
      run.events.emit('ambush');
    }
    // the stealth yard: a guard who saw the hero says so, then calms down (no alarm in the lessons)
    for (const e of run.enemies) {
      if (!e.alive || e.tag !== 'stealth') continue;
      const ai = e.ai;
      if (ai.mode !== 'combat') { ai.calmAt = NaN; continue; }
      if (!Number.isFinite(ai.calmAt)) {
        ai.calmAt = time + TUTORIAL.spottedReset;
        run.events.emit('tutorialSpotted', e);
        if (!this.spottedSaid) { this.spottedSaid = true; run.events.emit('dialogue', 'tut.spotted'); }
      } else if (time >= ai.calmAt) {
        ai.mode = 'return'; ai.suspicion = 0; ai.aware = false; ai.investigate = false; ai.radioAt = NaN; ai.routeGoalX = NaN; ai.calmAt = NaN;
      }
    }
  }
}
