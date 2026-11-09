// In-game HUD (Underlords layout, PROJECT_AUDIT.md §6.4): top centre — beacon Integrity, wave header (number +
// countdown / enemies left), boss bar; bottom-right — flare charge ring + weapon block + player plate; bottom centre — START NEXT WAVE
// (intermission only); wave banners. DOM is written only when a value changes. Reads state only; the button calls
// the Game command through UIManager.
import { T, onLanguageChange } from '../i18n/i18n.js';
import { WAVE_PHASE } from '../systems/WaveSystem.js';
import { levelProgress } from '../data/progression.js';
import { STATES } from '../core/GameStateMachine.js';
import { INTROS, INTRO_SECONDS } from '../data/intros.js';
import { WAVE_TIMING } from '../data/waves.js';

const KIOSK_LABEL_HEIGHT = 74; // world height above the kiosk where its label sits

// Intro card glyphs (24×24 stroke, same line style as the shop icons)
const INTRO_ICONS = {
  spit: '<circle cx="9" cy="14" r="5"/><path d="M14 11c3-3 6-2 7 1M18 6l1.5-1.5M20 9.5l2-.5"/>',
  shell: '<path d="M3 15c0-5 4-9 9-9s9 4 9 9z"/><path d="M8 15c0-3 2-6 4-7M16 15c0-3-2-6-4-7M3 15h18v2H3z"/>',
  boss: '<path d="M12 3l2 4 4-2-1 5 4 2-4 2 1 5-4-2-2 4-2-4-4 2 1-5-4-2 4-2-1-5 4 2z"/>',
  sides: '<path d="M12 4v6M4 12h6M14 12h6M12 14v6"/><circle cx="12" cy="12" r="2"/>',
  tree: '<path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><path d="M12 16v5"/>',
  pool: '<ellipse cx="12" cy="14" rx="9" ry="5"/><path d="M7 13c2-1 3 1 5 0s3-1 5 0"/>',
  pad: '<circle cx="12" cy="7" r="3"/><circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/>',
};

const BANNER_CLASS = 'show';

function clockText(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class HUD {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hp: $('hudHp'),
      hpFill: $('hudHpFill'),
      ammo: $('hudAmmo'),
      mag: $('hudMag'),
      weaponName: $('hudWeaponName'),
      weapon: $('hudWeapon'),
      reloadFill: $('hudReloadFill'),
      beacon: $('hudBeacon'),
      beaconFill: $('hudBeaconFill'),
      beaconVal: $('hudBeaconVal'),
      wave: $('hudWave'),
      waveLabel: $('hudWaveLabel'),
      waveSub: $('hudWaveSub'),
      boss: $('hudBoss'),
      bossFill: $('hudBossFill'),
      bossName: $('hudBossName'),
      repair: $('hudRepair'),
      repairCost: $('hudRepairCost'),
      intro: $('introCard'),
      introIco: $('introIco'),
      introKicker: $('introKicker'),
      introTitle: $('introTitle'),
      introText: $('introText'),
      nextWave: [...document.querySelectorAll('.next-wave-btn')], // desktop (bottom) + touch (top) variants
      banner: $('waveBanner'),
      screen: $('screen-game'),   // carries --flare (0–100) and .flare-full / .flare-ready for both flare buttons
      bannerText: $('waveBannerText'),
      shop: $('hudShop'),
      coins: $('hudCoins'),
      lv: $('hudLv'),
      xpFill: $('hudXpFill'),
      kiosk: $('kioskPrompt'),
      crate: $('cratePrompt'),
      crateTimer: $('crateTimer'),
      gslots: [...document.querySelectorAll('#grenadeSlots .gslot')],
      gBtn: $('grenadeBtn'),
      gBtnIco: $('grenadeBtnIco'),
      gBtnCount: $('grenadeBtnCount'),
    };
    this.pt = { x: 0, y: 0 };
    // START NEXT WAVE shows its early-start bonus (D46), from the data
    for (const b of document.querySelectorAll('.wave-bonus b')) b.textContent = `+${WAVE_TIMING.earlyStartBonus}`;
    // Bottom edge of the top HUD block, measured only when it can change (layout reads stay rare).
    this.hudTopDirty = true;
    this.hudTopBottom = 0;
    this.labelH = 24;
    const dirty = () => { this.hudTopDirty = true; };
    window.addEventListener('resize', dirty);
    onLanguageChange(dirty);
    game.sm.onChange(dirty);
    this.cache = {};
    this._resetCache();
    this.banner = null; // { key, params } of the banner on screen (re-translated on language change)
    onLanguageChange(() => {
      this._resetCache();
      if (this.banner) this.el.bannerText.textContent = T(this.banner.key, this.banner.params);
      if (this.introId) this._fillIntro(this.introId);
    });
    game.events.on('waveStart', (index, total, final) => {
      this._showBanner(final ? 'banner.finalWave' : 'banner.wave', { n: index + 1 });
    });
    // One-time intro cards (D45): a new enemy on its first appearance, the map's feature on its first start
    this.introId = null;
    this.introUntil = 0;
    this.introQueue = [];
    game.events.on('enemySpawn', (e) => this._intro(e.typeId));
    game.events.on('mapStarted', (mapId) => this._intro(mapId));
    game.sm.onChange(() => { if (!game.sm.inMap) { this.introQueue = []; this._hideIntro(); } });
    game.events.on('waveCleared', (index, reward, final) => { if (!final) this._showBanner('banner.waveCleared', null); });
    game.events.on('levelUp', (level) => { if (game.sm.inMap) this._showBanner('banner.levelUp', { n: level }); });
    game.events.on('crateSpawn', () => this._showBanner('banner.crate', null));
    // Early wave start bonus (D40): "+25" floats up from the coin badge
    const pop = document.getElementById('coinPop');
    const popCoins = (amount) => {
      if (!pop) return;
      pop.textContent = `+${amount}`;
      pop.classList.remove('show');
      void pop.offsetWidth;
      pop.classList.add('show');
    };
    game.events.on('coinReward', (amount, reason) => { if (reason === 'earlyStart') popCoins(amount); });
    game.events.on('cheatCoins', popCoins); // test cheat (CHEATS): tap on the coin balance
    pop.addEventListener('animationend', () => pop.classList.remove('show'));
    game.sm.onChange(() => { if (!game.sm.inMap) this._hideBanner(); });
    this.el.banner.addEventListener('animationend', () => this._hideBanner());
    game.onFrame(() => this.update());
  }

  _resetCache() {
    this.cache = {
      hp: -1, maxHp: -1, ammo: -1, mag: -1, weaponId: '', reloading: null, reloadPct: -1, integrity: -1, hit: null, low: null,
      waveLabel: '', waveSub: '', nextWave: null, bossOn: null, bossPct: -1, flarePct: -1, flareFull: null, flareReady: null, dashPct: -1, dashCooling: false,
      coins: -1, lv: '', xpPct: -1, canShop: null, kioskOn: null, kioskNear: null, kx: -1, ky: -1,
      gKey: '', crateOn: null, crateNear: null, crateSec: -1, cx: -1, cy: -1,
    };
  }

  /** "E · SHOP" above the kiosk while shopping is possible this phase; highlighted when the keeper is in reach. */
  _kioskLabel(run, running) {
    const c = this.cache, el = this.el.kiosk, r3 = this.game.renderer3d;
    let on = running && run.betweenWaves && !!r3;
    let below = false;
    if (on) {
      const W = r3.viewW, H = r3.viewH;
      r3.projectToScreen(run.kiosk.x, run.kiosk.y, KIOSK_LABEL_HEIGHT, this.pt);
      // Under the wave header (beacon bar / timer / START button)? → put the label under the kiosk instead.
      if (this.hudTopDirty) {
        const top = document.querySelector('#screen-game .hud-top');
        this.hudTopBottom = top ? top.getBoundingClientRect().bottom : 0;
        this.labelH = el.offsetHeight || 24;
        this.hudTopDirty = false;
      }
      if (this.pt.y - this.labelH < this.hudTopBottom + 6) { r3.projectToScreen(run.kiosk.x, run.kiosk.y, 0, this.pt); below = true; }
      on = this.pt.x > 0 && this.pt.x < W && this.pt.y > 0 && this.pt.y < H;
    }
    if (on !== c.kioskOn) { c.kioskOn = on; el.classList.toggle('on', on); }
    if (!on) return;
    const near = run.playerAtKiosk;
    if (near !== c.kioskNear) { c.kioskNear = near; el.classList.toggle('near', near); }
    const x = Math.round(this.pt.x), y = Math.round(this.pt.y);
    if (x !== c.kx || y !== c.ky || below !== c.kBelow) {
      c.kx = x; c.ky = y; c.kBelow = below;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${below ? '30%' : '-100%'})`;
    }
  }

  /** "E · OPEN 0:24" above the crate while it exists; highlighted in reach (tap opens on touch). */
  _crateLabel(run, running, time) {
    const c = this.cache, el = this.el.crate, r3 = this.game.renderer3d, cr = run.crates.crate;
    let on = running && !!cr && !!r3;
    if (on) {
      r3.projectToScreen(cr.x, cr.y, 56, this.pt);
      const W = r3.viewW, H = r3.viewH;
      on = this.pt.x > 0 && this.pt.x < W && this.pt.y > 0 && this.pt.y < H;
    }
    if (on !== c.crateOn) { c.crateOn = on; el.classList.toggle('on', on); }
    if (!on) return;
    const near = run.canOpenCrate;
    if (near !== c.crateNear) { c.crateNear = near; el.classList.toggle('near', near); }
    const sec = Math.ceil(run.crates.timeLeft(time));
    if (sec !== c.crateSec) { c.crateSec = sec; this.el.crateTimer.textContent = `0:${String(sec).padStart(2, '0')}`; }
    const x = Math.round(this.pt.x), y = Math.round(this.pt.y);
    if (x !== c.cx || y !== c.cy) { c.cx = x; c.cy = y; el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
  }

  _showBanner(key, params) {
    const el = this.el.banner;
    this.banner = { key, params };
    this.el.bannerText.textContent = T(key, params);
    el.classList.remove(BANNER_CLASS);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(BANNER_CLASS);
  }

  _hideBanner() {
    this.banner = null;
    this.el.banner.classList.remove(BANNER_CLASS);
  }

  /** Queues the intro card `id` if it exists and was never shown on this profile. */
  _intro(id) {
    const p = this.game.economy.profile;
    if (!INTROS[id] || !Array.isArray(p.intros) || p.intros.includes(id) || this.introId === id || this.introQueue.includes(id)) return;
    this.introQueue.push(id);
  }

  _fillIntro(id) {
    const I = INTROS[id];
    this.el.introKicker.textContent = T(`intro.kind.${I.kind}`);
    this.el.introTitle.textContent = T(I.titleKey);
    this.el.introText.textContent = T(I.textKey);
    this.el.introIco.innerHTML = `<svg viewBox="0 0 24 24">${INTRO_ICONS[I.icon] || ''}</svg>`;
  }

  /** Shows queued cards one by one while the map runs (game clock: pause / shop / tutorial freeze them). */
  _updateIntro(time, running) {
    if (this.introId && time >= this.introUntil) this._hideIntro();
    if (this.introId || !running || !this.introQueue.length || this.game.tutorial.active) return;
    const id = this.introQueue.shift();
    this.introId = id;
    this.introUntil = time + INTRO_SECONDS;
    this._fillIntro(id);
    const top = document.querySelector('#screen-game .hud-top'); // under the wave header (one layout read per card)
    this.el.intro.style.top = `${Math.round((top ? top.getBoundingClientRect().bottom : 120) + 10)}px`;
    this.el.intro.classList.add('show');
    this.game.economy.markIntroSeen(id); // stored on show: it never repeats, even after a retry
  }

  _hideIntro() {
    this.introId = null;
    this.el.intro.classList.remove('show');
  }

  update() {
    const run = this.game.run;
    if (!run || !this.game.sm.inMap) return;
    const c = this.cache, el = this.el, p = run.player, w = run.weapon;
    const time = this.game.clock.time;

    const hp = Math.ceil(p.hp);
    if (hp !== c.hp || p.maxHp !== c.maxHp) {
      c.hp = hp; c.maxHp = p.maxHp;
      el.hp.textContent = String(hp);
      el.hpFill.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
    }
    if (w.weaponId !== c.weaponId) {
      c.weaponId = w.weaponId;
      el.weaponName.textContent = T(w.stats.nameKey);
    }
    if (w.ammo !== c.ammo) { c.ammo = w.ammo; el.ammo.textContent = String(w.ammo); }
    if (w.stats.magazineSize !== c.mag) { c.mag = w.stats.magazineSize; el.mag.textContent = String(c.mag); }
    if (w.reloading !== c.reloading) {
      c.reloading = w.reloading;
      el.weapon.classList.toggle('reloading', w.reloading);
      el.weapon.classList.toggle('empty', false);
    }
    if (w.reloading) {
      const pct = Math.round(w.reloadProgress(time) * 100);
      if (pct !== c.reloadPct) { c.reloadPct = pct; el.reloadFill.style.width = `${pct}%`; }
    }

    // Beacon Integrity
    const b = run.beacon;
    const integ = Math.ceil(b.integrity);
    if (integ !== c.integrity) {
      c.integrity = integ;
      el.beaconVal.textContent = String(integ);
      el.beaconFill.style.width = `${Math.max(0, Math.min(100, (b.integrity / b.maxIntegrity) * 100))}%`;
    }
    const hit = time - b.lastHitAt < 0.35;
    if (hit !== c.hit) { c.hit = hit; el.beacon.classList.toggle('hit', hit); }
    const low = b.integrity / b.maxIntegrity <= 0.3;
    if (low !== c.low) { c.low = low; el.beacon.classList.toggle('low', low); }
    // D46: wrench repair button next to the bar while the beacon is damaged; dimmed when the coins are short
    const ro = this.game.hudRepairOffer();
    const repairOn = !run.over && ro.cost > 0;
    if (repairOn !== c.repairOn) { c.repairOn = repairOn; el.repair.hidden = !repairOn; this.hudTopDirty = true; }
    if (repairOn) {
      if (ro.cost !== c.repairCost) { c.repairCost = ro.cost; el.repairCost.textContent = String(ro.cost); }
      const can = ro.canBuy;
      if (can !== c.repairCan) { c.repairCan = can; el.repair.classList.toggle('poor', !can); }
    }

    // Wave header
    const ws = run.waves;
    const phase = ws.phase;
    const label = T('hud.wave', { n: ws.waveNumber, total: ws.total });
    if (label !== c.waveLabel) { c.waveLabel = label; el.waveLabel.textContent = label; }
    let sub = '';
    const boss = run.boss;
    const bossOn = !!boss && (boss.alive || time - boss.deathAt < 0.6);
    if (phase === WAVE_PHASE.INTRO) sub = T('hud.getReady', { t: clockText(ws.timeLeft(time)) });
    else if (phase === WAVE_PHASE.INTERMISSION) sub = T('hud.nextWave', { t: clockText(ws.timeLeft(time)) });
    else if (phase === WAVE_PHASE.ACTIVE && !bossOn) sub = T('hud.enemiesLeft', { n: ws.remaining(run.enemies) });
    if (sub !== c.waveSub) { c.waveSub = sub; el.waveSub.textContent = sub; el.waveSub.hidden = !sub; }

    const showNext = (phase === WAVE_PHASE.INTERMISSION || phase === WAVE_PHASE.INTRO) && !run.over; // prep too (D39)
    if (showNext !== c.nextWave) { c.nextWave = showNext; for (const b of el.nextWave) b.classList.toggle('on', showNext); this.hudTopDirty = true; }

    // Profile: coins badge, Player Level + XP bar
    const prof = this.game.economy.profile;
    if (prof.coins !== c.coins) { c.coins = prof.coins; el.coins.textContent = String(prof.coins); }
    const lp = levelProgress(prof.totalXp);
    const lv = T('hud.level', { n: lp.level });
    if (lv !== c.lv) { c.lv = lv; el.lv.textContent = lv; }
    const xpPct = Math.round((lp.into / lp.need) * 100);
    if (xpPct !== c.xpPct) { c.xpPct = xpPct; el.xpFill.style.width = `${xpPct}%`; }

    // Shop button glows only when the shop can open; kiosk label between waves
    const running = this.game.sm.is(STATES.RUNNING);
    const canShop = running && run.canShop;
    if (canShop !== c.canShop) { c.canShop = canShop; el.shop.classList.toggle('can-shop', canShop); }
    this._kioskLabel(run, running);
    this._crateLabel(run, running, time);
    this._updateIntro(time, running);

    // Grenade slots (counts, selected) + the touch grenade button (selected type icon + count)
    const gs = run.grenades;
    const gKey = `${gs.stock.frag},${gs.stock.cryo},${gs.stock.molotov},${gs.selected}`;
    if (gKey !== c.gKey) {
      c.gKey = gKey;
      for (const slot of el.gslots) {
        const t = slot.dataset.type, n = gs.stock[t];
        slot.querySelector('b').textContent = String(n);
        slot.classList.toggle('empty', n === 0);
        slot.classList.toggle('sel', gs.selected === t && n > 0);
      }
      el.gBtnIco.className = `gico gico-${gs.selected}`;
      el.gBtnCount.textContent = String(gs.stock[gs.selected]);
      el.gBtn.classList.toggle('empty', gs.total() === 0);
    }

    // Emergency Flare charge ring
    const fl = run.flare;
    const flarePct = Math.round(fl.fraction * 100);
    if (flarePct !== c.flarePct) { c.flarePct = flarePct; el.screen.style.setProperty('--flare', String(flarePct)); }
    if (fl.ready !== c.flareFull) { c.flareFull = fl.ready; el.screen.classList.toggle('flare-full', fl.ready); }
    const flareReady = fl.ready && phase === WAVE_PHASE.ACTIVE && !run.over;
    if (flareReady !== c.flareReady) { c.flareReady = flareReady; el.screen.classList.toggle('flare-ready', flareReady); }

    // DASH cooldown (touch button): dims + a progress ring; a short pop when it is ready again
    const pl = run.player;
    const cdLeft = pl.dodgeReadyAt - time;
    const cooling = pl.alive && cdLeft > 0 && pl.dodgeCooldown > 0;
    const dashPct = cooling ? Math.round((1 - cdLeft / pl.dodgeCooldown) * 100) : 100;
    if (dashPct !== c.dashPct) { c.dashPct = dashPct; el.screen.style.setProperty('--dash', String(dashPct)); }
    if (cooling !== c.dashCooling) {
      if (c.dashCooling && !cooling) { // just recharged
        el.screen.classList.remove('dash-ready-pop');
        void el.screen.offsetWidth;
        el.screen.classList.add('dash-ready-pop');
      }
      c.dashCooling = cooling;
      el.screen.classList.toggle('dash-cooling', cooling);
    }

    // Boss bar
    if (bossOn !== c.bossOn) {
      c.bossOn = bossOn;
      el.boss.hidden = !bossOn;
      if (bossOn) el.bossName.textContent = T(boss.type.nameKey); // Gloam Warden / Fog Mother (reset on language change)
    }
    if (bossOn) {
      const pct = Math.round((boss.hp / boss.maxHp) * 1000) / 10;
      if (pct !== c.bossPct) { c.bossPct = pct; el.bossFill.style.width = `${Math.max(0, pct)}%`; }
    }
  }
}
