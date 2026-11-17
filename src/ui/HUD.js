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
const OBJ = { x: 0, y: 0 };

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
      crate: $('cratePrompt'), arrow: $('objArrow'), interactBtn: $('interactBtn'),
      coverPrompt: $('coverPrompt'), coverBtn: $('coverBtn'),
      // D85 stealth
      stealth: $('stealthHud'), alertLabel: $('alertLabel'), vis: $('visLabel'), visText: $('visText'),
      ctx: $('ctxPrompt'), ctxKey: $('ctxKey'), ctxText: $('ctxText'), crouchBtn: $('crouchBtn'),
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
    const call = (text) => ({ kicker: 'call.incoming', title: 'call.handler', text });
    const brief = (k) => { const b = game.run && game.run.level.briefing; return b && b[k]; };
    ev.on('mapStarted', () => { const k = brief('start'); if (k) this._showCall(call(k)); });
    // D85: the modes' events
    ev.on('alarm', () => this._showBanner('banner.alarm'));
    ev.on('bodyFound', () => this._showBanner('banner.bodyFound'));
    ev.on('radioCheck', () => this._showBanner('banner.radioCheck'));     // D87
    ev.on('witness', () => this._showBanner('banner.witness'));
    ev.on('coverEdge', () => this._showBanner('banner.coverEdge'));
    ev.on('copyDone', () => { this._showBanner('banner.copyDone'); const k = brief('turn'); if (k) this._showCall(call(k)); });
    ev.on('threatLevel', (n) => { if (n > 1) this._showBanner('banner.threat', { n }); });
    ev.on('survivalSpawn', () => { if (game.run && game.run.mode && game.run.mode.spawnLog.length === 1) this._showBanner('banner.contact'); });
    ev.on('pickupSpawned', (pk) => { if (pk.def.kind === 'crate') this._showBanner('banner.supplies'); });
    ev.on('pickup', (kind) => {
      if (kind === 'keycard') this._showBanner('banner.keycard');
      else if (kind === 'drive') this._showBanner('banner.drive');
      else if (kind === 'medkit') this._showBanner('banner.medkit');
      else if (kind === 'intel' && game.run) this._showBanner('banner.intel', { n: game.run.intel, total: game.run.level.pickups.filter((p) => p.kind === 'intel').length });
    });
    ev.on('crateOpened', (item, count) => this._showBanner(item === 'smg' ? 'banner.smg' : 'banner.grenades', { n: count }));
    ev.on('doorUnlocked', (id) => { if (id !== 'exit') this._showBanner('banner.doorOpen'); });
    ev.on('reinforcements', () => { if (game.run && game.run.modeId === 'mission') { const k = brief('turn'); if (k) this._showCall(call(k)); } });
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
    this.cache = {
      hp: -1, maxHp: -1, ammo: -1, mag: -1, weaponId: '', reloading: null, reloadPct: -1, hurt: null, lowAmmo: null,
      hitFlash: null, lastHitAt: null, objKey: '', objIdx: -1, levelKey: '', items: '', slots: '', gKey: '', dashPct: -1,
      dashCooling: false, crateOn: null, cx: -1, cy: -1, arrowOn: null, ax: -1, ay: -1, aa: -1, interact: null,
      coverOn: null, kx: -1, ky: -1, coverBtn: '',
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
    const x = Math.round(PT.x), y = Math.round(PT.y);
    if (x !== c.cx || y !== c.cy) { c.cx = x; c.cy = y; el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
  }

  /** D85 stealth: the alert scale, the visibility eye, "F · TAKEDOWN" / "E · COPY" over the target, the crouch toggle. */
  _stealthHud(run, running) {
    const c = this.cache, el = this.el, m = run.mode, p = run.player, r3 = this.game.renderer3d;
    if (m.level !== c.alert) {
      c.alert = m.level;
      el.stealth.dataset.level = String(m.level);
      el.alertLabel.textContent = T(['alert.calm', 'alert.suspicious', 'alert.search', 'alert.alarm'][m.level]);
    }
    const v = m.heroVisibility, vis = v < 0.38 ? 'hidden' : v < 0.7 ? 'dim' : 'lit';
    if (vis !== c.vis) { c.vis = vis; el.vis.dataset.vis = vis; el.visText.textContent = T(`vis.${vis}`); }
    const crouch = p.stance === 'crouch';
    if (crouch !== c.crouch && el.crouchBtn) { c.crouch = crouch; el.crouchBtn.classList.toggle('on', crouch); }
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

  /** An arrow at the screen edge pointing at the objective while it is off screen. */
  _objectiveArrow(run, running) {
    const c = this.cache, el = this.el.arrow, r3 = this.game.renderer3d;
    const t = running && r3 ? run.objectiveTarget(OBJ) : null;
    let on = false, x = 0, y = 0, ang = 0;
    if (t) {
      r3.projectToScreen(t.x, t.y, 30, PT);
      const W = r3.viewW, H = r3.viewH, m = 46;
      const inside = PT.x > m && PT.x < W - m && PT.y > m + 40 && PT.y < H - m;
      if (!inside) {
        const cx = W / 2, cy = H / 2, dx = PT.x - cx, dy = PT.y - cy;
        ang = Math.atan2(dy, dx);
        const k = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(dx)), (H / 2 - m) / Math.max(1e-6, Math.abs(dy)));
        x = cx + dx * k; y = cy + dy * k;
        on = true;
      }
    }
    if (on !== c.arrowOn) { c.arrowOn = on; el.classList.toggle('on', on); }
    if (!on) return;
    const rx = Math.round(x), ry = Math.round(y), ra = Math.round(ang * 100) / 100;
    if (rx !== c.ax || ry !== c.ay || ra !== c.aa) {
      c.ax = rx; c.ay = ry; c.aa = ra;
      el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) rotate(${ra}rad)`;
    }
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
    const slotIds = [run.inventory[0] || HERO_WEAPONS[0], HERO_WEAPONS[1]]; // D85: the first slot is the mode's start gun
    const slots = slotIds.map((id, i) => (run.inventory.includes(id) ? (id === w.weaponId ? `[${i + 1}]` : String(i + 1)) : '')).join(' ');
    if (slots !== c.slots) {
      c.slots = slots;
      el.slots.replaceChildren(...slotIds.map((id, i) => {
        const s = document.createElement('i');
        s.textContent = String(i + 1);
        s.className = `slot${run.inventory.includes(id) ? '' : ' none'}${id === w.weaponId ? ' on' : ''}`;
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
    if (run.modeId === 'stealth' && run.mode) this._stealthHud(run, running);
    // objective + level name
    const o = run.objective;
    const objKey = o ? o.textKey : '';
    if (run.modeId !== 'survival' && (objKey !== c.objKey || run.objectiveIndex !== c.objIdx)) {
      c.objKey = objKey; c.objIdx = run.objectiveIndex;
      el.objKicker.textContent = T('hud.objective', { n: Math.min(run.objectiveIndex + 1, run.level.objectives.length), total: run.level.objectives.length });
      el.objText.textContent = o ? T(o.textKey) : '';
      el.objective.classList.remove('pop'); void el.objective.offsetWidth; el.objective.classList.add('pop');
      invalidateHudBlockers();
    }
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
