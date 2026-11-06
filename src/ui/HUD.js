// In-game HUD (Underlords layout, PROJECT_AUDIT.md §6.4): top centre — beacon Integrity, wave header (number +
// countdown / enemies left), boss bar; bottom-right — weapon block + player plate; bottom centre — START NEXT WAVE
// (intermission only); wave banners. DOM is written only when a value changes. Reads state only; the button calls
// the Game command through UIManager.
import { T, onLanguageChange } from '../i18n/i18n.js';
import { WAVE_PHASE } from '../systems/WaveSystem.js';

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
      bannerText: $('waveBannerText'),
    };
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
    game.sm.onChange(() => { if (!game.sm.inMap) this._hideBanner(); });
    this.el.banner.addEventListener('animationend', () => this._hideBanner());
    game.onFrame(() => this.update());
  }

  _resetCache() {
    this.cache = {
      hp: -1, maxHp: -1, ammo: -1, mag: -1, weaponId: '', reloading: null, reloadPct: -1, integrity: -1, hit: null, low: null,
      waveLabel: '', waveSub: '', nextWave: null, bossOn: null, bossPct: -1,
    };
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

    const showNext = phase === WAVE_PHASE.INTERMISSION && !run.over;
    if (showNext !== c.nextWave) { c.nextWave = showNext; for (const b of el.nextWave) b.classList.toggle('on', showNext); }

    // Boss bar
    if (bossOn !== c.bossOn) { c.bossOn = bossOn; el.boss.hidden = !bossOn; }
    if (bossOn) {
      const pct = Math.round((boss.hp / boss.maxHp) * 1000) / 10;
      if (pct !== c.bossPct) { c.bossPct = pct; el.bossFill.style.width = `${Math.max(0, pct)}%`; }
    }
  }
}
