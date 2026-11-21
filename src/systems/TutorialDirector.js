// D88 (user request): the TUTORIAL director — the lessons of the training ground (data/tutorial.js) one by one: which
// lesson is on, its progress, its gate. The stealth yard borrows the stealth rules (StealthDirector: the sneak, the
// takedown); D116: a guard who fully spots the hero fails the lesson — the retry starts at its checkpoint (the yard's
// gate). Dummies stand and never shoot; only the ambush yard shoots back (and then the medkit makes sense). Pure
// simulation, game clock only.
import { TUTORIAL } from '../data/tutorial.js';
import { STEALTH } from '../data/stealth.js';
import { StealthDirector } from './StealthDirector.js';
import { PROP_TYPES, propBox } from '../data/props.js';

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
    run.ai.noBodies = true;                     // D95 (user): no "body found" (no search) in the lessons
    // D95 (user): an enemy never leaves his own yard (never follows the hero through a gate back to the yard before)
    this.homes = new Map();
    for (const e of run.enemies) {
      const zid = run.levelWorld.zoneAt(e.x, e.y), z = zid && run.level.zones.find((q) => q.id === zid);
      if (z) this.homes.set(e, z.rect);
    }
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
    return s ? { id: s.id, textKey: s.textKey, touchKey: s.touchKey || null, n: Math.min(this.count, s.need || 0), of: s.need || 0, keys: s.keys || [] } : null;
  }

  objectiveTarget(out) {
    const s = this.step;
    if (!s || !s.target) return null;
    // D90: the off-screen arrow points at the nearest object lit up (else the lesson's spot)
    const hl = this.highlights(), p = this.run.player;
    let best = null, bd = Infinity;
    for (const h of hl) { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d < bd) { bd = d; best = h; } }
    out.x = best ? best.x : s.target[0]; out.y = best ? best.y : s.target[1];
    return out;
  }

  /**
   * D90 (user: light up the objects themselves): what the lesson on is about, as drawn highlights — boxes
   * { x, y, w, d } (props, rects) and rings { x, y, r } (targets, enemies, bodies). Recomputed per call (cheap: a few).
   */
  highlights() {
    const out = this._hl || (this._hl = []);
    out.length = 0;
    const s = this.step, run = this.run, L = run.level;
    if (!s || !s.hl) return out;
    for (const h of s.hl) {
      if (h.pickup) {
        if (h.unless && run.inventory.includes(h.unless)) continue;
        const pk = L.pickups.find((x) => x.id === h.pickup);
        if (pk) out.push(this._propBox(pk.x, pk.y));
      } else if (h.targets) {
        this.targets.forEach((t, i) => { if (!this.hitTargets.has(i)) out.push({ x: t.x, y: t.y, r: 13 }); }); // D92: not the hit ones
      } else if (h.prop) {
        out.push(this._propBox(h.prop[0], h.prop[1]));
      } else if (h.rect) {
        const r = typeof h.rect === 'string' ? (h.rect === 'exit' ? L.exit && L.exit.rect : L[h.rect]) : h.rect;
        if (r) out.push({ x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, w: r[2] - r[0], d: r[3] - r[1] });
      } else if (h.tag) {
        for (const e of run.enemies) if (e.alive && e.tag === h.tag) out.push({ x: e.x, y: e.y, r: 22, e });
      } else if (h.arrow) { // D92 (user): the way to roll — an arrow drawn on the ground (from the gate across the mats)
        const [x0, y0, x1, y1] = h.arrow;
        out.push({ arrow: h.arrow, x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
      } else if (h.bodies) {
        for (const e of run.enemies) if (!e.alive && e.ammoDrop > 0 && h.bodies.includes(e.tag)) out.push({ x: e.x, y: e.y, r: 20, e });
      }
    }
    return out;
  }

  /** The footprint of the prop standing at (x, y) as a highlight box (a small square when none is there). */
  _propBox(x, y) {
    const cache = this._boxes || (this._boxes = new Map()), key = `${x},${y}`;
    let b = cache.get(key);
    if (!b) {
      let best = null, bd = 30;
      for (const p of this.run.level.props) {
        const t = PROP_TYPES[p.type];
        if (!t || t.decor || t.flat || t.wall) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = p; }
      }
      const r = best ? propBox(best) : [x - 15, y - 15, x + 15, y + 15];
      b = { x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, w: r[2] - r[0], d: r[3] - r[1] };
      cache.set(key, b);
    }
    return b;
  }

  /** D90: the HUD controls this lesson lights up: { control: PC key } (HUD.js), or null. */
  get uiFocus() { const s = this.step; return s && s.ui ? s.ui : null; }

  /** D89: the mobile version's auto aim (it fires at enemies only) takes the range targets during the shooting lessons. */
  get aimTargets() {
    const s = this.step;
    if (!s || s.id !== 'hits') return null;
    if (this.run.weapon.weaponId !== s.weapon) return NO_TARGETS; // the wrong gun: no rounds wasted (switch first)
    // D92: only the targets not hit yet in this lesson
    return this._aim || (this._aim = this.targets.filter((t, i) => !this.hitTargets.has(i)).map((t) => ({ x: t.x, y: t.y + 4, radius: 6, alive: true })));
  }

  // the stealth director's flags the HUD reads
  get heroVisibility() { return this.stealth.heroVisibility; }

  _next(i) {
    // D126 (user: a yard's briefing as the hero walks OUT of the yard before, not into the next one): the yard of the
    // lesson just done — its next lesson's briefing plays once he leaves it (or is in the new lesson's own yard)
    const prev = this.steps[this.index];
    this.prevYard = prev && prev.target ? this.run.levelWorld.zoneAt(prev.target[0], prev.target[1]) : null;
    this.index = i;
    this.count = 0;
    this.hitTargets = new Set(); // D92: the targets hit in this lesson
    this._aim = null;
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
      // D116 (user): both guards of the yard taken down — then the gate opens
      const group = run.enemies.filter((e) => e.tag === 'stealth');
      this.count = group.filter((e) => !e.alive).length;
      if (group.length && this.count >= group.length) this._done();
    } else if (s.id === 'grenades') {
      if ((run.grenades.stock.frag | 0) > 0) this._done();
    }
  }

  _onImpact(x, y) {
    const s = this.step;
    if (!s || s.id !== 'hits' || this.run.weapon.weaponId !== s.weapon) return;
    const r = TUTORIAL.hitsNear;
    const i = this.targets.findIndex((t) => Math.abs(t.x - x) <= r && Math.abs(t.y - y) <= r);
    // D92 (user): each gun hits different targets — a target already hit in this lesson no longer counts (nor glows)
    if (i < 0 || this.hitTargets.has(i)) return;
    this.hitTargets.add(i);
    this._aim = null;
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

  /** D110: is the hero inside the yard of the lesson's spot (a spot outside every yard — the exit — counts as anywhere)? */
  _inLessonYard(s, p) {
    if (!s || !s.target) return true;
    const W = this.run.levelWorld, yard = W.zoneAt(s.target[0], s.target[1]);
    return !yard || W.zoneAt(p.x, p.y) === yard;
  }

  /** D126: has the hero walked out of the yard of the lesson before (into a path / another yard)? */
  _leftPrevYard(p) {
    if (!this.prevYard) return false;
    const z = this.run.levelWorld.zoneAt(p.x, p.y);
    return !!z && z !== this.prevYard;
  }

  /** D126: every enemy of the step's afterDeaths tags dead for TUTORIAL.fallTime s (their fall played out). */
  _fallsOver(s, time) {
    if (!s || !s.afterDeaths) return true;
    for (const e of this.run.enemies) {
      if (!s.afterDeaths.includes(e.tag)) continue;
      if (e.alive || !(time - (e.deathAt ?? -Infinity) >= TUTORIAL.fallTime)) return false;
    }
    return true;
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
    // D95: each enemy kept inside his yard (the gate gaps are on the yard's edge — he stops at them)
    for (const [e, r] of this.homes) {
      if (!e.alive) continue;
      const m = e.radius + 2;
      e.x = Math.min(r[2] - m, Math.max(r[0] + m, e.x));
      e.y = Math.min(r[3] - m, Math.max(r[1] + m, e.y));
    }
    this._check();
    const s = this.step;
    // D108: a lesson's dialogue waits for the takedown in progress to end (it froze the takedown clip mid-blow).
    // D110 (user: the roll briefing started in the grenade yard): a lesson held in another yard is briefed once the hero
    // walks in through its gate — the yard's own lessons follow one another at once
    // D126 (user): …or once he has walked out of the yard of the lesson before (its gate behind him); a briefing that
    // follows a fall (afterDeaths) waits until the death clip has played out
    if (this.pendingDialogue && !p.takedown && (this._inLessonYard(s, p) || this._leftPrevYard(p)) && this._fallsOver(s, time)) {
      const id = this.pendingDialogue; this.pendingDialogue = null; run.events.emit('dialogue', id);
    }
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
    // D116 (user): the stealth yard — a guard who fully spots the hero fails the lesson (a defeat screen); the retry
    // starts this lesson again from its gate (applyCheckpoint). (D88–D115: he only said so and calmed down.)
    if (s && s.id === 'takedown') {
      for (const e of run.enemies) {
        if (!e.alive || e.tag !== 'stealth' || e.ai.mode !== 'combat') continue;
        run.events.emit('tutorialSpotted', e);
        run.checkpoint = 'stealth';
        run._setDefeat('detected');
        break;
      }
    }
  }

  /**
   * D116: a run started again at a lesson's checkpoint — 'stealth': before the stealth yard's gate (the path from the
   * cover yard), the lessons before it done (their gates open, the armory's guns carried, the cover yard's dummies gone).
   */
  applyCheckpoint(id) {
    const cp = TUTORIAL.checkpoints[id];
    const i = cp ? this.steps.findIndex((s) => s.id === cp.step) : -1;
    if (i < 0) return false;
    const run = this.run, p = run.player;
    for (const w of cp.weapons) if (!run.inventory.includes(w)) run.giveWeapon(w, false);
    run.switchWeapon(cp.weapons[cp.weapons.length - 1]);
    for (const s of this.steps.slice(0, i)) {
      const d = s.opens && run.doors.find((x) => x.id === s.opens);
      if (d) d.locked = false;
    }
    for (let k = run.enemies.length - 1; k >= 0; k--) if (cp.clear.includes(run.enemies[k].tag)) run.enemies.splice(k, 1);
    for (const pk of run.pickups) if (cp.taken.includes(pk.def.id)) pk.taken = true;
    p.x = p.prevX = cp.at[0]; p.y = p.prevY = cp.at[1];
    p.aimAngle = p.bodyAngle = cp.at[2] || 0;
    p.facingX = Math.cos(p.aimAngle); p.facingY = Math.sin(p.aimAngle);
    this._next(i);
    this.pendingDialogue = null; // (the lesson's briefing was heard already)
    run.checkpoint = id;
    return true;
  }
}
