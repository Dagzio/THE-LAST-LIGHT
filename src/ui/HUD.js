// In-game HUD (Underlords layout, PROJECT_AUDIT.md §6.4): bottom-right player plate (name, HP) with the
// weapon block above it (name, ammo, reload bar). DOM is written only when a value changes.
import { T, onLanguageChange } from '../i18n/i18n.js';

export class HUD {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.el = {
      hp: document.getElementById('hudHp'),
      hpFill: document.getElementById('hudHpFill'),
      ammo: document.getElementById('hudAmmo'),
      mag: document.getElementById('hudMag'),
      weaponName: document.getElementById('hudWeaponName'),
      weapon: document.getElementById('hudWeapon'),
      reloadFill: document.getElementById('hudReloadFill'),
    };
    this.cache = { hp: -1, maxHp: -1, ammo: -1, mag: -1, weaponId: '', reloading: null, reloadPct: -1 };
    onLanguageChange(() => { this.cache.weaponId = ''; });
    game.onFrame(() => this.update());
  }

  update() {
    const run = this.game.run;
    if (!run || !this.game.sm.inMap) return;
    const c = this.cache, el = this.el, p = run.player, w = run.weapon;

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
      const pct = Math.round(w.reloadProgress(this.game.clock.time) * 100);
      if (pct !== c.reloadPct) { c.reloadPct = pct; el.reloadFill.style.width = `${pct}%`; }
    }
  }
}
