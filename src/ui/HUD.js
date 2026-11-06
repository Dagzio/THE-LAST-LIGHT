// In-game HUD (Underlords layout, PROJECT_AUDIT.md §6.4): top centre — beacon Integrity, wave header (number +
// countdown / enemies left), boss bar; bottom-right — flare charge ring + weapon block + player plate; bottom centre — START NEXT WAVE
// (intermission only); wave banners. DOM is written only when a value changes. Reads state only; the button calls
// the Game command through UIManager.
import { T, onLanguageChange } from '../i18n/i18n.js';
import { WAVE_PHASE } from '../systems/WaveSystem.js';
import { levelProgress } from '../data/progression.js';
import { STATES } from '../core/GameStateMachine.js';

const KIOSK_LABEL_HEIGHT = 74; // world height above the kiosk where its label sits

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
    });
    game.events.on('waveStart', (index, total, boss) => {
      this._showBanner(boss ? 'banner.finalWave' : 'banner.wave', { n: index + 1 });
    });
    game.events.on('waveCleared', (index, reward, final) => { if (!final) this._showBanner('banner.waveCleared', null); });
    game.events.on('levelUp', (level) => { if (game.sm.inMap) this._showBanner('banner.levelUp', { n: level }); });
    game.events.on('crateSpawn', () => this._showBanner('banner.crate', null));
    // Early wave start bonus (D40): "+25" floats up from the coin badge
    const pop = document.getElementById('coinPop');
    game.events.on('coinReward', (amount, reason) => {
      if (reason !== 'earlyStart' || !pop) return;
      pop.textContent = `+${amount}`;
      pop.classList.remove('show');
      void pop.offsetWidth;
      pop.classList.add('show');
    });
    pop.addEventListener('animationend', () => pop.classList.remove('show'));
    game.sm.onChange(() => { if (!game.sm.inMap) this._hideBanner(); });
    this.el.banner.addEventListener('animationend', () => this._hideBanner());
    game.onFrame(() => this.update());
  }

  _resetCache() {
    this.cache = {
      hp: -1, maxHp: -1, ammo: -1, mag: -1, weaponId: '', reloading: null, reloadPct: -1, integrity: -1, hit: null, low: null,
      waveLabel: '', waveSub: '', nextWave: null, bossOn: null, bossPct: -1, flarePct: -1, flareFull: null, flareReady: null,
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
      const W = r3.canvas.clientWidth, H = r3.canvas.clientHeight;
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
      const W = r3.canvas.clientWidth, H = r3.canvas.clientHeight;
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

    // Boss bar
    if (bossOn !== c.bossOn) { c.bossOn = bossOn; el.boss.hidden = !bossOn; }
    if (bossOn) {
      const pct = Math.round((boss.hp / boss.maxHp) * 1000) / 10;
      if (pct !== c.bossPct) { c.bossPct = pct; el.bossFill.style.width = `${Math.max(0, pct)}%`; }
    }
  }
}
