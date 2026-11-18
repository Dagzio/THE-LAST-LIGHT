// In-level HUD (KILL LIST D78, Underlords layout kept): top centre — the current objective; bottom-right — action bar
// (dash, grenade), weapon block (tap = next weapon), HP plate with the carried key items; an arrow at the screen edge
// towards an off-screen objective; "E · OPEN" above the crate in reach; event banners and the phone-call card
// (briefing / the level's turn). DOM is written only when a value changes. Reads state only; buttons call Game
// commands through UIManager.
import { T, onLanguageChange } from '../i18n/i18n.js';
import { STATES } from '../core/GameStateMachine.js';
import { gunIcon } from '../data/icons.js';
import { HERO_WEAPONS } from '../data/weapons.js';
import { coversHud, invalidateHudBlockers } from './hudBlockers.js';

const BANNER_CLASS = 'show';
const CALL_SECONDS = 7;     // s a phone-call card stays (game clock: a pause freezes it)
const PT = { x: 0, y: 0 };
const HERO_PT = { x: 0, y: 0 };
const OBJ = { x: 0, y: 0 };
const OBJ2 = { x: 0, y: 0 };

/** D91: the HUD things a control's tag must not cover. */
const TAG_OBSTACLES = '.ring-btn, .hud-objective, .stealth-hud, .hud-plate, .hud-weapon, .act-btn, .neon-btn, .touch-stick, .kiosk-prompt';

/** D90: the HUD element of each control lit up by the training ground: [keyboard, touch] selectors. */
const TUT_UI = {
  interact: ['#cratePrompt', '#interactBtn'],
  fire: [null, '#touchFireZone'], // D93: touch — the right half of the screen is the trigger
  weapon: ['#hudWeapon', '#hudWeapon'],
  reload: ['#hudWeapon', '[data-touch-action="reload"]'],
  cover: ['#coverPrompt', '#coverBtn'],
  takedown: ['#ctxPrompt', '#interactBtn'],
  grenade: ['#hudGrenade', '#grenadeBtn'],
  dash: ['.hud-actions .act-dash', '[data-touch-action="dash"]'],
};

export class HUD {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hp: $('hudHp'), hpFill: $('hudHpFill'), ammo: $('hudAmmo'), mag: $('hudMag'), weaponName: $('hudWeaponName'),
      gun: $('hudGun'), weapon: $('hudWeapon'), reloadFill: $('hudReloadFill'), slots: $('hudSlots'),
      objKicker: $('hudObjKicker'), objText: $('hudObjText'), objective: $('hudObjective'), levelName: $('hudLevelName'),
      items: $('hudItems'),
      banner: $('waveBanner'), bannerText: $('waveBannerText'), screen: $('screen-game'),
      call: $('introCard'), callKicker: $('introKicker'), callTitle: $('introTitle'), callText: $('introText'),
      crate: $('cratePrompt'), crateText: $('cratePromptText'), arrow: $('objArrow'), arrow2: $('objArrow2'), interactBtn: $('interactBtn'),
      coverPrompt: $('coverPrompt'), coverBtn: $('coverBtn'),
      // D85 stealth
      stealth: $('stealthHud'), alertLabel: $('alertLabel'), vis: $('visLabel'), visText: $('visText'),
      ctx: $('ctxPrompt'), ctxKey: $('ctxKey'), ctxText: $('ctxText'),
      gBtns: [[$('grenadeBtn'), $('grenadeBtnCount')], [$('hudGrenade'), $('hudGrenadeCount')]].filter((b) => b[0]),
    };
    this.labelSize = new Map();
    const dirty = () => { invalidateHudBlockers(); this.labelSize.clear(); };
    window.addEventListener('resize', dirty);
    onLanguageChange(dirty);
    game.sm.onChange(dirty);
    this._resetCache();
    this.banner = null;
    this.call = null;     // { kicker, title, text keys } on screen
    this.callUntil = 0;
    onLanguageChange(() => {
      this._resetCache();
      if (this.banner) this.el.bannerText.textContent = T(this.banner.key, this.banner.params);
      if (this.call) this._fillCall(this.call);
    });
    const ev = game.events;
    // D88: the handler's calls are dialogues now (ui/DialogueView.js); the call card stays unused
    // D85: the modes' events
    ev.on('alarm', () => this._showBanner('banner.alarm'));
    ev.on('bodyFound', () => this._showBanner('banner.bodyFound'));
    ev.on('radioCheck', () => this._showBanner('banner.radioCheck'));     // D87
    ev.on('witness', () => this._showBanner('banner.witness'));
    ev.on('copyDone', () => this._showBanner('banner.copyDone'));
    ev.on('targetHit', () => this._showBanner('banner.hit')); // D88 the training ground
    ev.on('ambush', () => this._showBanner('banner.contact'));
    ev.on('tutorialHint', (key) => this._showBanner(key)); // D89: "rounds won't do — sneak up" / "use a grenade"
    ev.on('threatLevel', (n) => { if (n > 1) this._showBanner('banner.threat', { n }); });
    ev.on('survivalSpawn', () => { if (game.run && game.run.mode && game.run.mode.spawnLog.length === 1) this._showBanner('banner.contact'); });
    ev.on('pickupSpawned', (pk) => { if (pk.def.kind === 'crate') this._showBanner('banner.supplies'); });
    ev.on('pickup', (kind) => {
      if (kind === 'keycard') this._showBanner('banner.keycard');
      else if (kind === 'drive') this._showBanner('banner.drive');
      else if (kind === 'medkit') this._showBanner('banner.medkit');
      else if (kind === 'intel' && game.run) this._showBanner('banner.intel', { n: game.run.intel, total: game.run.level.pickups.filter((p) => p.kind === 'intel').length });
    });
    ev.on('crateOpened', (item, count) => {
      const key = { smg: 'banner.smg', rifle: 'banner.rifle', grenades: 'banner.grenades' }[item];
      if (key) this._showBanner(key, { n: count });
    });
    // D88: rounds taken (a body, a box), the gun empty with nothing to switch to
    ev.on('ammoPickup', (type, n) => this._showBanner('banner.ammo', { n }));
    ev.on('noAmmo', () => this._showBanner('banner.noAmmo'));
    ev.on('doorUnlocked', (id) => { if (id !== 'exit') this._showBanner('banner.doorOpen'); });
    game.sm.onChange(() => { if (!game.sm.inMap) { this._hideBanner(); this._hideCall(); } });
    this.el.banner.addEventListener('animationend', () => this._hideBanner());
    game.onFrame(() => this.update());
    // desktop action bar: buttons with data-hold-action act like their key while pressed (DASH = Space)
    for (const btn of document.querySelectorAll('#hudActions [data-hold-action]')) {
      const action = btn.dataset.holdAction;
      const up = () => { btn.classList.remove('pressed'); game.input.setSourceAction('hud', action, false); };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!game.sm.is(STATES.RUNNING)) return;
        btn.classList.add('pressed');
        game.input.setSourceAction('hud', action, true);
      });
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
  }

  _resetCache() {
    for (const el of this._tutEls || []) { el.classList.remove('tut-focus'); const tag = el.querySelector(':scope > .tut-tag'); if (tag) tag.remove(); if (el.dataset.tutPos) { el.style.position = ''; delete el.dataset.tutPos; } } // D90
    this._tutEls = [];
    this.cache = {
      hp: -1, maxHp: -1, ammo: -1, mag: -1, weaponId: '', reloading: null, reloadPct: -1, hurt: null, lowAmmo: null,
      hitFlash: null, lastHitAt: null, objKey: '', objIdx: -1, levelKey: '', items: '', slots: '', gKey: '', dashPct: -1,
      dashCooling: false, crateOn: null, cx: -1, cy: -1, arrowOn: null, ax: -1, ay: -1, aa: -1, interact: null,
      coverOn: null, kx: -1, ky: -1, coverBtn: '', crateLabel: '', tutKey: '',
      alert: -1, vis: '', ctxKey: '', cxx: -1, cxy: -1, crouch: null, survKey: '',
    };
  }

  _showBanner(key, params = null) {
    const el = this.el.banner;
    this.banner = { key, params };
    this.el.bannerText.textContent = T(key, params);
    el.classList.remove(BANNER_CLASS);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(BANNER_CLASS);
  }

  _hideBanner() { this.banner = null; this.el.banner.classList.remove(BANNER_CLASS); }

  _fillCall(c) {
    this.el.callKicker.textContent = T(c.kicker);
    this.el.callTitle.textContent = T(c.title);
    this.el.callText.textContent = T(c.text);
  }

  _showCall(c) {
    this.call = c;
    this.callUntil = this.game.clock.time + CALL_SECONDS;
    this._fillCall(c);
    this.callPlaced = false; // placed under the objective header on the next HUD frame (its text is filled by then)
  }

  _placeCall() {
    this.callPlaced = true;
    if (this.game.touchMode) this.el.call.style.top = '';
    else {
      const top = document.querySelector('#screen-game .hud-objective');
      this.el.call.style.top = `${Math.round((top ? top.getBoundingClientRect().bottom : 90) + 12)}px`;
    }
    this.el.call.classList.add('show');
  }

  _hideCall() { this.call = null; this.el.call.classList.remove('show'); }

  /** Would a label (centred on x, its top at y + dy × its height) cover a HUD block / leave the screen? */
  _underHud(el, x, y, dy) {
    let size = this.labelSize.get(el);
    if (!size || !size.w) { size = { w: el.offsetWidth, h: el.offsetHeight }; this.labelSize.set(el, size); }
    if (!size.w) return false;
    const t = y + dy * size.h, l = x - size.w / 2, r = x + size.w / 2, r3 = this.game.renderer3d;
    if (t < 0 || l < 0 || r > r3.viewW || t + size.h > r3.viewH) return true;
    return coversHud(l, t, r, t + size.h);
  }

  /** "E · OPEN" above the crate in reach (a button: tap opens it). */
  _crateLabel(run, running) {
    const c = this.cache, el = this.el.crate, r3 = this.game.renderer3d, it = run.interactTarget;
    let on = running && !!it && !!r3;
    if (on) {
      r3.projectToScreen(it.def.x, it.def.y, 40, PT);
      on = !this._underHud(el, PT.x, PT.y, -1);
    }
    if (on !== c.crateOn) { c.crateOn = on; el.classList.toggle('on', on); el.classList.toggle('near', on); }
    if (!on) return;
    // D88: what the crate holds ("TAKE SMG", "TAKE M4A1", the medkit…) — else OPEN
    const label = it.def.label || 'hud.open';
    if (label !== c.crateLabel) { c.crateLabel = label; if (this.el.crateText) this.el.crateText.textContent = T(label); this.labelSize.delete(el); }
    const x = Math.round(PT.x), y = Math.round(PT.y);
    if (x !== c.cx || y !== c.cy) { c.cx = x; c.cy = y; el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
  }

  /** D85 stealth: the alert scale, the visibility eye, "F · TAKEDOWN" / "E · COPY" over the target, the crouch toggle. */
  _stealthHud(run, running) {
    const c = this.cache, el = this.el, m = run.mode, p = run.player, r3 = this.game.renderer3d;
    if (run.modeId === 'stealth') { // (D88: the tutorial uses only the context label and the crouch button)
      if (m.level !== c.alert) {
        c.alert = m.level;
        el.stealth.dataset.level = String(m.level);
        el.alertLabel.textContent = T(['alert.calm', 'alert.suspicious', 'alert.search', 'alert.alarm'][m.level]);
      }
      const v = m.heroVisibility, vis = v < 0.38 ? 'hidden' : v < 0.7 ? 'dim' : 'lit';
      if (vis !== c.vis) { c.vis = vis; el.vis.dataset.vis = vis; el.visText.textContent = T(`vis.${vis}`); }
    }
    // the context label over the target
    let key = '', x = 0, y = 0, h = 66;
    const it = run.interactTarget;
    if (running && m.takedownTarget && !this.game.touchMode) { key = 'takedown'; x = r3._lx(m.takedownTarget); y = r3._ly(m.takedownTarget); }
    else if (running && it && it.def.kind === 'terminal') { key = m.copying ? `copy:${Math.floor(run.copyProgress * 100)}` : 'copy'; x = it.def.x; y = it.def.y; h = 40; }
    if (key !== c.ctxKey) {
      c.ctxKey = key;
      el.ctx.classList.toggle('on', !!key);
      el.ctx.classList.toggle('near', !!key);
      el.ctx.classList.toggle('takedown', key === 'takedown');
      if (key === 'takedown') { el.ctxKey.textContent = 'F'; el.ctxText.textContent = T('hud.takedown'); }
      else if (key) { el.ctxKey.textContent = 'E'; el.ctxText.textContent = m.copying ? T('hud.copying', { p: Math.floor(run.copyProgress * 100) }) : T('hud.copy'); }
    }
    if (key && r3) {
      r3.projectToScreen(x, y, h, PT);
      const rx = Math.round(PT.x), ry = Math.round(PT.y);
      if (rx !== c.cxx || ry !== c.cxy) { c.cxx = rx; c.cxy = ry; el.ctx.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -100%)`; }
    }
  }

  /** D83: "Q · COVER" over the hero while an object to hide behind is in reach (a button: click takes cover). */
  _coverLabel(run, want) {
    const c = this.cache, el = this.el.coverPrompt, r3 = this.game.renderer3d, p = run.player;
    if (!el) return;
    let on = want && !!r3;
    if (on) {
      r3.projectToScreen(r3._lx(p), r3._ly(p), 66, PT);
      on = !this._underHud(el, PT.x, PT.y, -1);
    }
    if (on !== c.coverOn) { c.coverOn = on; el.classList.toggle('on', on); el.classList.toggle('near', on); }
    if (!on) return;
    const x = Math.round(PT.x), y = Math.round(PT.y);
    if (x !== c.kx || y !== c.ky) { c.kx = x; c.ky = y; el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
  }

  /**
   * D90 (user: every control shown as the lesson needs it): the HUD controls of the lesson glow, with a tag — the PC key
   * (the keyboard) or "TAP" (touch). The touch / PC element of each control (only the visible one shows).
   */
  _tutFocus(ui) {
    const c = this.cache, touch = !!this.game.touchMode, key = ui ? `${touch}|${Object.entries(ui).join(';')}` : '';
    if (key === c.tutFocusKey) return;
    c.tutFocusKey = key;
    // D93: the slot of the gun the lesson wants pulses too (touch: tap that very button)
    this._tutSlot = ui && ui.weapon && touch ? +ui.weapon : 0;
    c.slots = '';
    for (const el of this._tutEls || []) { el.classList.remove('tut-focus'); const tag = el.querySelector(':scope > .tut-tag'); if (tag) tag.remove(); if (el.dataset.tutPos) { el.style.position = ''; delete el.dataset.tutPos; } }
    this._tutEls = [];
    if (!ui) return;
    for (const [ctl, k] of Object.entries(ui)) {
      const sel = TUT_UI[ctl] && TUT_UI[ctl][touch ? 1 : 0];
      const el = sel && document.querySelector(sel);
      if (!el) continue;
      el.classList.add('tut-focus');
      if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.dataset.tutPos = '1'; } // (the tag's anchor)
      const tag = document.createElement('span');
      tag.className = 'tut-tag';
      tag.textContent = touch ? T('tut.tap') : k.startsWith('key.') ? T(k) : k;
      el.append(tag);
      this._tutEls.push(el);
    }
  }

  /**
   * D91 (mobile: readable): the objective never ends in "…" — its font shrinks to fit (down to 12 px), then it may
   * take a second line.
   */
  _fitObjective() {
    const t = this.el.objText;
    this.cache.objW = innerWidth;
    t.style.fontSize = ''; t.classList.remove('wrap');
    let fs = parseFloat(getComputedStyle(t).fontSize);
    while (fs > 12 && t.scrollWidth > t.clientWidth + 1) { fs -= 0.5; t.style.fontSize = `${fs}px`; }
    if (t.scrollWidth > t.clientWidth + 1) t.classList.add('wrap');
  }

  /**
   * D91 (mobile: nothing overlaps): each lit control's tag goes above it — or to its left / right / below, the first
   * side where it stays on the screen and covers no other HUD control (the buttons beside it, the HP plate).
   */
  _placeTags() {
    const W = innerWidth, H = innerHeight, sides = ['', 'at-left', 'at-right', 'at-below'];
    const obst = [];
    for (const o of document.querySelectorAll(TAG_OBSTACLES)) {
      const r = o.getBoundingClientRect();
      if (r.width > 1 && r.height > 1 && o.offsetParent !== null && getComputedStyle(o).visibility !== 'hidden') obst.push({ o, r });
    }
    for (const el of this._tutEls) {
      const tag = el.querySelector(':scope > .tut-tag');
      if (!tag) continue;
      for (const side of sides) {
        tag.classList.remove('at-left', 'at-right', 'at-below');
        if (side) tag.classList.add(side);
        if (el.classList.contains('kiosk-prompt')) break; // over a world prompt: always above it
        const r = tag.getBoundingClientRect();
        const inside = r.left >= 2 && r.top >= 2 && r.right <= W - 2 && r.bottom <= H - 2;
        const hits = obst.some(({ o, r: q }) => o !== el && !o.contains(el) && !el.contains(o)
          && Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1);
        if (inside && !hits) break;
      }
    }
  }

  /**
   * An arrow pointing at the objective while it is off screen. D91 (mobile: nothing overlaps): it circles the hero (an
   * ellipse round him, clear of the top HUD and the screen edges) instead of sitting on the screen edge — there it went
   * under the objective plate / the corner buttons, or right over the target at the edge.
   */
  _objectiveArrow(run, running) {
    const r3 = this.game.renderer3d;
    const t = running && r3 ? run.objectiveTarget(OBJ) : null;
    const a = this._arrow(run, this.el.arrow, t, 'main', 1);
    // D92 (user): a second, smaller pointer at a supply the level shows (the office's SMG crate) — inside the main one
    const t2 = running && r3 && run.pointerTarget ? run.pointerTarget(OBJ2) : null;
    this._arrow(run, this.el.arrow2, t2, 'alt', a !== null && t2 && Math.abs(Math.atan2(Math.sin(a - this._angOf(run, t2)), Math.cos(a - this._angOf(run, t2)))) < 0.6 ? 0.62 : 1);
  }

  _angOf(run, t) {
    const r3 = this.game.renderer3d, p = run.player;
    r3.projectToScreen(t.x, t.y, 30, PT); r3.projectToScreen(p.x, p.y, 30, HERO_PT);
    return Math.atan2(PT.y - HERO_PT.y, PT.x - HERO_PT.x);
  }

  /** One off-screen arrow round the hero towards t (null hides it); k scales its ellipse. → its angle, or null. */
  _arrow(run, el, t, key, k) {
    if (!el) return null;
    const c = this.cache.arrows || (this.cache.arrows = {}), st = c[key] || (c[key] = { on: null, x: -1, y: -1, a: -1 });
    const r3 = this.game.renderer3d;
    let on = false, x = 0, y = 0, ang = 0;
    if (t) {
      r3.projectToScreen(t.x, t.y, 30, PT);
      const W = r3.viewW, H = r3.viewH;
      const inside = PT.x > 12 && PT.x < W - 12 && PT.y > 12 && PT.y < H - 12; // D91: on the screen at all → no arrow
      if (!inside) {
        const p = run.player, now = performance.now();
        r3.projectToScreen(p.x, p.y, 30, HERO_PT);
        if (now >= (this._bandAt || 0)) { // the top HUD band (objective plate, corner buttons), measured now and then
          this._bandAt = now + 250;
          let b = 0;
          for (const q of document.querySelectorAll('#hudObjective, #screen-game .corner .ring-btn, #stealthHud, #waveBanner.show .stamp')) { const r = q.getBoundingClientRect(); if (r.height > 1) b = Math.max(b, r.bottom); }
          this._band = b;
        }
        ang = Math.atan2(PT.y - HERO_PT.y, PT.x - HERO_PT.x);
        const s = Math.sin(ang), up = s < 0;
        const rx = Math.min(W * 0.28, 230) * k;
        const ry = Math.max(40, Math.min(H * 0.3, up ? HERO_PT.y - (this._band || 0) - 28 : H - 28 - HERO_PT.y)) * k;
        x = HERO_PT.x + Math.cos(ang) * rx; y = HERO_PT.y + s * ry;
        on = true;
      }
    }
    if (on !== st.on) { st.on = on; el.classList.toggle('on', on); }
    if (!on) return null;
    const rx = Math.round(x), ry = Math.round(y), ra = Math.round(ang * 100) / 100;
    if (rx !== st.x || ry !== st.y || ra !== st.a) {
      st.x = rx; st.y = ry; st.a = ra;
      el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) rotate(${ra}rad)`;
    }
    return ang;
  }

  update() {
    const run = this.game.run;
    if (!run || !this.game.sm.inMap) return;
    const c = this.cache, el = this.el, p = run.player, w = run.weapon;
    const time = this.game.clock.time;
    const running = this.game.sm.is(STATES.RUNNING);

    const hp = Math.ceil(p.hp);
    if (hp !== c.hp || p.maxHp !== c.maxHp) {
      c.hp = hp; c.maxHp = p.maxHp;
      el.hp.textContent = String(hp);
      el.hpFill.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
    }
    if (w.weaponId !== c.weaponId) {
      c.weaponId = w.weaponId;
      el.weaponName.textContent = T(w.stats.nameKey);
      el.gun.src = gunIcon(w.weaponId);
    }
    if (w.ammo !== c.ammo) { c.ammo = w.ammo; el.ammo.textContent = String(w.ammo); }
    // D87: a gun with counted rounds shows the reserve after the slash (else the magazine size, as before)
    const mag = Number.isFinite(w.reserve) ? w.reserve : w.stats.magazineSize;
    if (mag !== c.mag) { c.mag = mag; el.mag.textContent = String(mag); }
    // D85: the first slot is the mode's pistol; D88: three slots (pistol, SMG, M4A1) — the M4A1 slot only once seen
    const slotIds = [run.slotWeapon(0) || HERO_WEAPONS[0], HERO_WEAPONS[1], HERO_WEAPONS[2]].filter((id, i) => i < 2 || run.inventory.includes(id));
    const slots = slotIds.map((id, i) => (run.inventory.includes(id) ? (id === w.weaponId ? `[${i + 1}]` : String(i + 1)) : '')).join(' ') + `|${this._tutSlot || 0}`;
    if (slots !== c.slots) {
      c.slots = slots;
      el.slots.replaceChildren(...slotIds.map((id, i) => {
        const s = document.createElement('i');
        s.textContent = String(i + 1);
        s.dataset.weapon = id; // D91: a tap on a slot takes that weapon (UIManager)
        s.className = `slot${run.inventory.includes(id) ? '' : ' none'}${id === w.weaponId ? ' on' : ''}${this._tutSlot === i + 1 && id !== w.weaponId ? ' tut-slot' : ''}`; // D93
        return s;
      }));
      el.weapon.classList.toggle('multi', run.inventory.length > 1);
    }
    const hurt = p.alive && p.hp / p.maxHp <= 0.3;
    if (hurt !== c.hurt) { c.hurt = hurt; el.screen.classList.toggle('keeper-hurt', hurt); }
    const hitFlash = p.alive && time - p.lastHitAt < 0.5;
    if (hitFlash && p.lastHitAt !== c.lastHitAt) { el.screen.classList.remove('keeper-hit'); void el.screen.offsetWidth; el.screen.classList.add('keeper-hit'); c.hitFlash = true; }
    else if (hitFlash !== c.hitFlash) { c.hitFlash = hitFlash; el.screen.classList.toggle('keeper-hit', hitFlash); }
    c.lastHitAt = p.lastHitAt;
    const lowAmmo = !w.reloading && w.ammo <= Math.max(1, Math.ceil(w.stats.magazineSize * 0.25));
    if (lowAmmo !== c.lowAmmo) { c.lowAmmo = lowAmmo; el.weapon.classList.toggle('low-ammo', lowAmmo); }
    if (w.reloading !== c.reloading) { c.reloading = w.reloading; el.weapon.classList.toggle('reloading', w.reloading); }
    if (w.reloading) {
      const pct = Math.round(w.reloadProgress(time) * 100);
      if (pct !== c.reloadPct) { c.reloadPct = pct; el.reloadFill.style.width = `${pct}%`; }
    }

    // D85 survival: the header is the threat level + the clock and kills (written once per second)
    if (run.modeId === 'survival') {
      const tt = Math.floor(run.stats.time);
      const key = `${run.mode.threat}|${tt}|${run.stats.kills}`;
      if (key !== c.survKey) {
        c.survKey = key; c.objKey = ''; c.objIdx = -1;
        el.objKicker.textContent = T('hud.survive', { n: run.mode.threat });
        el.objText.textContent = T('hud.survTime', { t: `${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`, k: run.stats.kills });
      }
    }
    // D85 stealth: the alert scale, the visibility eye, the context label (takedown / copy), the crouch button
    if ((run.modeId === 'stealth' || run.modeId === 'tutorial') && run.mode) this._stealthHud(run, running);
    // objective + level name
    const o = run.objective;
    const objKey = o ? o.textKey : '';
    if (run.modeId === 'tutorial') {
      // D88: the lesson — "TRAINING 3/17", its text with the progress, the PC keys as chips
      const m = run.mode, key = `${m.index}|${o ? o.n : ''}|${!!this.game.touchMode}`;
      if (key !== c.tutKey) {
        const fresh = !c.tutKey.startsWith(`${m.index}|`);
        c.tutKey = key;
        el.objKicker.textContent = T('hud.tutorial', { n: Math.min(m.index + 1, m.steps.length), total: m.steps.length });
        const tk = o && this.game.touchMode && o.touchKey ? o.touchKey : o && o.textKey; // D93: the phone's own text
        el.objText.replaceChildren(document.createTextNode(o ? T(tk, { n: o.n, of: o.of }) : ''));
        if (o && !this.game.touchMode) for (const k of o.keys) { const b = document.createElement('kbd'); b.className = 'obj-key'; b.textContent = k.startsWith('key.') ? T(k) : k; el.objText.append(' ', b); }
        this._fitObjective();
        if (fresh) { el.objective.classList.remove('pop'); void el.objective.offsetWidth; el.objective.classList.add('pop'); invalidateHudBlockers(); }
      }
      this._tutFocus(m.uiFocus);
      const now = performance.now();
      if (this._tutEls.length && now >= (this._tagAt || 0)) { this._tagAt = now + 300; this._placeTags(); } // D91
    } else if (run.modeId !== 'survival' && (objKey !== c.objKey || run.objectiveIndex !== c.objIdx)) {
      c.objKey = objKey; c.objIdx = run.objectiveIndex;
      el.objKicker.textContent = T('hud.objective', { n: Math.min(run.objectiveIndex + 1, run.level.objectives.length), total: run.level.objectives.length });
      el.objText.textContent = o ? T(o.textKey) : '';
      this._fitObjective();
      el.objective.classList.remove('pop'); void el.objective.offsetWidth; el.objective.classList.add('pop');
      invalidateHudBlockers();
    }
    if (innerWidth !== c.objW) this._fitObjective(); // D91: a resize / turn refits the objective
    const levelKey = run.level.nameKey;
    if (levelKey !== c.levelKey) { c.levelKey = levelKey; el.levelName.textContent = T(levelKey); }
    const items = `${run.has.keycard ? 'k' : ''}${run.has.drive ? 'd' : ''}`;
    if (items !== c.items) {
      c.items = items;
      el.items.replaceChildren(...[...items].map((k) => { const i = document.createElement('i'); i.className = k === 'k' ? 'item-keycard' : 'item-drive'; return i; }));
    }

    // grenade buttons: count, armed glow, dim when empty
    const gs = run.grenades, armed = run.grenadeArmed;
    const gKey = `${gs.stock.frag},${armed}`;
    if (gKey !== c.gKey) {
      c.gKey = gKey;
      for (const [btn, cnt] of el.gBtns) {
        cnt.textContent = String(gs.stock.frag | 0);
        btn.classList.toggle('empty', gs.total() === 0);
        btn.classList.toggle('armed', !!armed);
      }
    }
    // dash cooldown ring
    const cdLeft = p.dodgeReadyAt - time;
    const cooling = p.alive && cdLeft > 0 && p.dodgeCooldown > 0;
    const dashPct = cooling ? Math.round((1 - cdLeft / p.dodgeCooldown) * 100) : 100;
    if (dashPct !== c.dashPct) { c.dashPct = dashPct; el.screen.style.setProperty('--dash', String(dashPct)); }
    if (cooling !== c.dashCooling) {
      if (c.dashCooling && !cooling) { el.screen.classList.remove('dash-ready-pop'); void el.screen.offsetWidth; el.screen.classList.add('dash-ready-pop'); }
      c.dashCooling = cooling;
      el.screen.classList.toggle('dash-cooling', cooling);
    }
    // touch interact button: while a crate / the terminal is in reach (D85: or an enemy to take down)
    const canInteract = running && (run.canInteract || !!(run.mode && run.mode.takedownTarget));
    if (canInteract !== c.interact) { c.interact = canInteract; if (el.interactBtn) el.interactBtn.classList.toggle('on', canInteract); }

    // D83 cover: touch — the button (shown next to cover, lit in cover); PC — "Q · COVER" over the hero
    const offer = running ? run.coverOffer : null;
    const btnKey = offer || '';
    if (btnKey !== c.coverBtn && el.coverBtn) { c.coverBtn = btnKey; el.coverBtn.classList.toggle('on', !!offer); el.coverBtn.classList.toggle('active', offer === 'leave'); }
    this._coverLabel(run, offer === 'take' && !this.game.touchMode && !run.interactTarget);

    this._crateLabel(run, running);
    this._objectiveArrow(run, running && !run.over);
    if (this.call && !this.callPlaced) this._placeCall();
    if (this.call && time >= this.callUntil) this._hideCall();
  }
}
