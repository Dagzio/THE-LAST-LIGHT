// Shop overlay (Underlords shop style, PROJECT_AUDIT.md §6.6; 02_SPEC §12). Shown while the game is in SHOP_OPEN
// (and stays under the Settings popup when paused from the shop). Tabs: WEAPONS · UPGRADES (weapon) · KEEPER
// (player upgrades) · GRENADES (Phase 6) · DEFENSES (beacon repair + devices on build pads).
// The view only displays offers computed by the Economy/Game and calls Game commands — it never edits the profile.
// DOM is rebuilt on open / tab switch / after a purchase / on language change — never per frame.
import { STATES } from '../core/GameStateMachine.js';
import { T, onLanguageChange } from '../i18n/i18n.js';
import { WEAPONS } from '../data/weapons.js';
import { WEAPON_NODES, UPGRADE_NODES, NODE_NAME_OVERRIDES, PLAYER_UPGRADES, PLAYER_UPGRADE_ORDER } from '../data/upgrades.js';
import { DEFENSES } from '../data/defenses.js';
import { GRENADES, GRENADE_ORDER } from '../data/grenades.js';
import { levelProgress } from '../data/progression.js';
import { effectiveWeaponStats } from '../systems/Loadout.js';
import { MVP_WEAPON_IDS, REASON } from '../systems/Economy.js';
import { WAVE_PHASE } from '../systems/WaveSystem.js';
import { Sfx } from '../platform/Sfx.js';

const ICON = { // 24×24 stroke icons (white line style, see art-prompts/06_SHOP.md for the final art)
  weapon: '<path d="M3 8h13l2-2h3v4h-2l-1 1H11l-1 6H7l1-6H3z"/>',
  damage: '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  fireRate: '<path d="M4 6l6 6-6 6M11 6l6 6-6 6"/>',
  reload: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 3.5V8h-4.5"/>',
  magazine: '<path d="M8 3h8v18H8z"/><path d="M8 8h8M8 13h8"/>',
  critChance: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  reducedSpread: '<path d="M3 12h18M6 7l15 5-15 5"/>',
  extraPellet: '<circle cx="7" cy="8" r="2.5"/><circle cx="17" cy="8" r="2.5"/><circle cx="12" cy="16" r="2.5"/><path d="M19 15v6M16 18h6"/>',
  penetration: '<path d="M2 12h20M16 7l5 5-5 5"/><path d="M9 6v12"/>',
  vitality: '<path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z"/>',
  armor: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  mobility: '<path d="M5 18l5-12 4 8 3-4 3 8"/>',
  quick_dodge: '<path d="M5 5l7 7-7 7M12 5l7 7-7 7"/>',
  interact_range: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
  guard_turret: '<path d="M6 20h12l-2-6H8z"/><path d="M8 14V9h8v5M16 11h6"/>',
  frost_coil: '<path d="M12 2v20M3 7l18 10M21 7L3 17"/>',
  repair: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  g_frag: '<circle cx="11" cy="14" r="6.5"/><path d="M11 7.5V5h3l2-2M14 5l3 3"/>',
  g_cryo: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M7 9l10 6M17 9L7 15"/>',
  g_molotov: '<path d="M10 9h4v3l2 3v6H8v-6l2-3z"/><path d="M12 9V6M12 2c1.5 1.5 1.5 3 0 4-1.5-1-1.5-2.5 0-4z"/>',
};
const COIN = '<i class="coin-ico" aria-hidden="true"></i>';

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

const fitRange = document.createRange();
/** True when the element's text stays inside its content box (overflow into the padding does not count as fitting). */
function textFits(n) {
  const cs = getComputedStyle(n);
  fitRange.selectNodeContents(n);
  const room = n.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return fitRange.getBoundingClientRect().width <= room + 0.5 && n.scrollWidth <= n.clientWidth + 1;
}

function clockText(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class ShopView {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('popup-shop');
    this.grid = document.getElementById('shopGrid');
    this.sub = document.getElementById('shopSub');
    this.coins = document.getElementById('shopCoins');
    this.coinsBar = document.getElementById('shopCoinsBar'); // phones: the coins sit in the level row
    this.levelEl = document.getElementById('shopLevel');
    this.xpFill = document.getElementById('shopXpFill');
    this.timer = document.getElementById('shopTimer');
    this.tabs = [...this.root.querySelectorAll('[data-shop-tab]')];
    this.prevBtn = document.getElementById('shopPrev');
    this.nextBtn = document.getElementById('shopNext');
    this.tab = 'weapons';
    this.page = 0; // phones: page of the card row
    this.upgradeWeaponId = null; // weapon shown in the UPGRADES tab
    // Phone step (≤ 500 px high, base.css): one row of cards with page arrows, weapon picker card in UPGRADES
    this.phoneMQ = matchMedia('(max-height: 500px)');

    this.tabs.forEach((t) => t.addEventListener('click', () => {
      this.tab = t.dataset.shopTab;
      this.page = 0;
      if (this.tab === 'weaponUpgrades') this.upgradeWeaponId = game.economy.profile.equippedWeaponId; // equipped first
      this.refresh();
    }));
    this.prevBtn.addEventListener('click', () => this._turn(-1));
    this.nextBtn.addEventListener('click', () => this._turn(1));
    this.root.addEventListener('click', (e) => this._onClick(e));
    game.sm.onChange(() => this._syncVisible());
    game.events.on('profileChanged', () => { if (this.visible) this.refresh(); });
    onLanguageChange(() => { if (this.visible) this.refresh(); });
    this.phoneMQ.addEventListener('change', () => { if (this.visible) this.refresh(); });
    let raf = 0; // resize / rotation: re-fit tabs and pages (no DOM rebuild)
    window.addEventListener('resize', () => {
      if (!this.visible || raf) return;
      raf = requestAnimationFrame(() => { raf = 0; this._layout(); });
    });
  }

  get visible() { return this.root.classList.contains('show'); }

  _syncVisible() {
    const g = this.game;
    const show = g.sm.is(STATES.SHOP_OPEN) || (g.sm.is(STATES.PAUSED) && g.resumeState === STATES.SHOP_OPEN);
    if (show === this.visible) return;
    this.root.classList.toggle('show', show);
    if (show) {
      if (g.sm.is(STATES.SHOP_OPEN)) Sfx.play('open');
      this.upgradeWeaponId = g.economy.profile.equippedWeaponId;
      this.refresh();
    }
  }

  // ---------------- commands ----------------
  _onClick(e) {
    const b = e.target.closest('[data-shop-cmd]');
    if (!b || b.disabled) return;
    const [cmd, a, c] = b.dataset.shopCmd.split(':');
    const g = this.game;
    let r = null;
    if (cmd === 'buyWeapon') r = g.shopBuyWeapon(a);
    else if (cmd === 'equip') r = g.shopEquipWeapon(a);
    else if (cmd === 'upgrade') r = g.shopBuyWeaponUpgrade(a, c);
    else if (cmd === 'player') r = g.shopBuyPlayerUpgrade(a);
    else if (cmd === 'defense') r = g.shopBuyDefense(Number(a), c);
    else if (cmd === 'repair') r = g.shopRepairBeacon();
    else if (cmd === 'grenade') r = g.shopBuyGrenade(a);
    else if (cmd === 'pickWeapon') { this.upgradeWeaponId = a; this.refresh(); return; }
    if (!r) return;
    Sfx.play(r.ok ? (cmd === 'equip' ? 'click' : 'buy') : 'deny');
    this.refresh();
  }

  // ---------------- view ----------------
  refresh() {
    const g = this.game, eco = g.economy, p = eco.profile;
    this.tabs.forEach((t) => t.classList.toggle('active', t.dataset.shopTab === this.tab));
    this.coins.textContent = String(p.coins);
    this.coinsBar.textContent = String(p.coins);
    const lp = levelProgress(p.totalXp);
    this.levelEl.textContent = T('hud.level', { n: lp.level });
    this.xpFill.style.width = `${Math.min(100, (lp.into / lp.need) * 100)}%`;
    const run = g.run;
    if (run) {
      const ws = run.waves;
      this._setTimer(ws.phase === WAVE_PHASE.INTRO ? 'hud.getReady' : 'hud.nextWave', clockText(ws.timeLeft(g.clock.time)));
    }
    this.sub.replaceChildren();
    this.grid.replaceChildren();
    this.grid.dataset.tab = this.tab;
    if (this.tab === 'weapons') this._weapons();
    else if (this.tab === 'weaponUpgrades') this._weaponUpgrades();
    else if (this.tab === 'playerUpgrades') this._playerUpgrades();
    else if (this.tab === 'grenades') this._grenades();
    else this._defenses();
    this._layout();
  }

  /** "NEXT WAVE IN" may be cut with an ellipsis on a narrow phone / long language, the time itself never is. */
  _setTimer(key, clock) {
    const full = T(key, { t: clock });
    const i = full.lastIndexOf(clock);
    const label = el('span', 'shop-timer-label');
    label.dir = 'auto'; // Arabic: the colon stays on the reading side
    const time = el('b', 'shop-timer-time');
    label.textContent = i >= 0 ? full.slice(0, i).trimEnd() : full;
    time.textContent = i >= 0 ? full.slice(i) : '';
    this.timer.replaceChildren(label, time);
  }

  // ---------------- phone layout: tab labels fit, card pages ----------------
  _layout() {
    this._fitTabs();
    this._paginate();
    this._fitButtons();
  }

  /**
   * Phones: a long label on a narrow card (German "AUSGERÜSTET", "DIENSTPISTOLE", "FULL INTEGRITY" …) shrinks down to
   * 12 px instead of running into the padding / out of the card. Measures the text itself (overflow into the padding
   * does not change scrollWidth).
   */
  _fitButtons() {
    // every size: a single long word must not leave its card (desktop cards are narrow for German / Russian too)
    for (const n of this.grid.querySelectorAll('.shop-card:not(.off) .shop-buy, .shop-card:not(.off) .shop-card-name')) {
      n.style.fontSize = '';
      n.style.overflowWrap = '';
      let fs = parseFloat(getComputedStyle(n).fontSize);
      while (fs > 12 && !textFits(n)) { fs -= 1; n.style.fontSize = `${fs}px`; }
      if (!textFits(n)) n.style.overflowWrap = 'anywhere'; // last resort: break the word rather than leave the card
    }
  }

  /** Long languages: shrink all tab labels to one common size (never wrap, never cut; H5 one role = one size). */
  _fitTabs() {
    for (const t of this.tabs) t.style.fontSize = '';
    if (!this.phoneMQ.matches) return;
    let fs = parseFloat(getComputedStyle(this.tabs[0]).fontSize);
    const overflow = () => this.tabs.some((t) => !textFits(t));
    while (fs > 12 && overflow()) {
      fs -= 1;
      for (const t of this.tabs) t.style.fontSize = `${fs}px`;
    }
  }

  _perPage() {
    if (!this.phoneMQ.matches) return Infinity;
    return parseInt(getComputedStyle(this.grid).getPropertyValue('--per'), 10) || 3;
  }

  _paginate() {
    const cards = [...this.grid.querySelectorAll('.shop-card')];
    const per = this._perPage();
    const pages = per === Infinity ? 1 : Math.max(1, Math.ceil(cards.length / per));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    const from = per === Infinity ? 0 : this.page * per;
    cards.forEach((c, i) => c.classList.toggle('off', i < from || i >= from + per));
    const paged = pages > 1;
    this.prevBtn.classList.toggle('idle', !paged); // keeps its place, so cards keep one width on every tab
    this.nextBtn.classList.toggle('idle', !paged);
    this.prevBtn.disabled = !paged || this.page === 0;
    this.nextBtn.disabled = !paged || this.page >= pages - 1;
  }

  _turn(dir) {
    const before = this.page;
    this.page += dir;
    this._paginate();
    this._fitButtons();
    if (this.page !== before) Sfx.play('click');
  }

  /** GRENADES (Phase 6, D15): one at a time, cap 3 per type for this map; stock is lost on a new map / retry. */
  _grenades() {
    const g = this.game;
    for (const id of GRENADE_ORDER) {
      const G = GRENADES[id];
      const o = g.grenadeOffer(id);
      const body = `${this._pips(o.stock, o.cap)}<p class="shop-fx">${T(`fx.grenade.${id}`)}</p>`;
      const card = this._card(`g_${id}`, T(G.nameKey), body, o.reason === REASON.LEVEL ? 'locked' : '');
      this._footer(card, { cmd: `grenade:${id}`, price: o.price, enabled: o.canBuy, reason: o.canBuy ? null : o.reason, reasonParams: { n: o.requiredLevel } });
      this.grid.append(card);
    }
  }

  _card(icon, title, bodyHtml, extraCls = '') {
    const card = el('div', `shop-card ${extraCls}`);
    const head = el('div', 'shop-card-head');
    head.append(el('span', 'shop-card-ico', `<svg viewBox="0 0 24 24">${ICON[icon] || ICON.damage}</svg>`), el('span', 'shop-card-name'));
    head.lastChild.textContent = title;
    card.append(head, el('div', 'shop-card-body', bodyHtml));
    return card;
  }

  /** Footer: price button (or state label) + the reason if it cannot be bought. */
  _footer(card, { cmd, price, label, enabled, reason, reasonParams, done }) {
    const foot = el('div', 'shop-card-foot');
    const btn = el('button', `shop-buy${done ? ' done' : ''}`);
    btn.dataset.nosfx = '';
    if (cmd) btn.dataset.shopCmd = cmd;
    btn.disabled = !enabled;
    btn.innerHTML = price !== undefined && price !== null ? `${COIN}<b>${price}</b>` : '';
    if (label) btn.append(document.createTextNode(label));
    foot.append(btn);
    if (reason) { const r = el('span', 'shop-reason'); r.textContent = T(`shop.reason.${reason}`, reasonParams); foot.append(r); }
    card.append(foot);
    return card;
  }

  _pips(rank, max) {
    let s = '<span class="pips">';
    for (let i = 0; i < max; i++) s += `<i class="${i < rank ? 'on' : ''}"></i>`;
    return `${s}</span>`;
  }

  _weapons() {
    const eco = this.game.economy;
    for (const id of MVP_WEAPON_IDS) {
      const w = WEAPONS[id];
      const o = eco.weaponOffer(id);
      const s = effectiveWeaponStats(id, eco.weaponUpgrades(id));
      const body = `<dl class="shop-stats">
        <dt>${T('stat.damage')}</dt><dd>${Math.round(s.damage * s.weaponDamageMult * 10) / 10}${s.pelletsPerShot > 1 ? ` ×${s.pelletsPerShot}` : ''}</dd>
        <dt>${T('stat.rate')}</dt><dd>${(1 / s.fireInterval).toFixed(1)}</dd>
        <dt>${T('stat.magazine')}</dt><dd>${s.magazineSize}</dd>
        <dt>${T('stat.range')}</dt><dd>${Math.round(s.range)}</dd></dl>`;
      const card = this._card('weapon', T(w.nameKey), body, o.equipped ? 'equipped' : o.owned ? 'owned' : o.reason === REASON.LEVEL ? 'locked' : '');
      if (o.equipped) this._footer(card, { label: T('shop.equipped'), enabled: false, done: true });
      else if (o.owned) this._footer(card, { cmd: `equip:${id}`, label: T('shop.equip'), enabled: true });
      else this._footer(card, { cmd: `buyWeapon:${id}`, price: o.price, enabled: o.canBuy, reason: o.canBuy ? null : o.reason, reasonParams: { n: o.requiredLevel } });
      this.grid.append(card);
    }
  }

  _weaponUpgrades() {
    const eco = this.game.economy, p = eco.profile;
    if (!p.ownedWeapons.includes(this.upgradeWeaponId)) this.upgradeWeaponId = p.equippedWeaponId;
    // Phones: no chip row (it would push the cards off a low screen) — the first card of the row picks the weapon
    if (this.phoneMQ.matches) this.grid.append(this._weaponPicker(p.ownedWeapons));
    else for (const id of p.ownedWeapons) {
      const chip = el('button', `shop-chip${id === this.upgradeWeaponId ? ' active' : ''}`);
      chip.dataset.shopCmd = `pickWeapon:${id}`;
      chip.dataset.nosfx = '';
      chip.textContent = `${T(WEAPONS[id].nameKey)} · ${T('shop.weaponLevel', { n: eco.weaponLevel(id) })}`;
      this.sub.append(chip);
    }
    const wid = this.upgradeWeaponId;
    for (const nodeId of WEAPON_NODES[wid] || []) {
      const node = UPGRADE_NODES[nodeId];
      const o = eco.weaponUpgradeOffer(wid, nodeId);
      const nameKey = (NODE_NAME_OVERRIDES[wid] && NODE_NAME_OVERRIDES[wid][nodeId]) || node.nameKey;
      const v = node.perRank < 1 ? Math.round(node.perRank * 100) : node.perRank;
      const body = `${this._pips(o.rank, o.max)}<p class="shop-fx">${T(`fx.${nodeId}`, { v })}</p>`;
      const card = this._card(nodeId, T(nameKey), body, o.reason === REASON.MAX ? 'maxed' : '');
      if (o.reason === REASON.MAX) this._footer(card, { label: T('shop.max'), enabled: false, done: true });
      else this._footer(card, { cmd: `upgrade:${wid}:${nodeId}`, price: o.cost, enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
      this.grid.append(card);
    }
  }

  /** Phone UPGRADES: the selected weapon + its level; ◀ ▶ switch between owned weapons (only when there are several). */
  _weaponPicker(owned) {
    const eco = this.game.economy, wid = this.upgradeWeaponId, n = owned.length, i = owned.indexOf(wid);
    const card = this._card('weapon', T(WEAPONS[wid].nameKey), `<p class="shop-pick-lv">${T('shop.weaponLevel', { n: eco.weaponLevel(wid) })}</p>`, 'equipped shop-picker');
    if (n > 1) {
      const foot = el('div', 'shop-card-foot shop-pick-foot');
      const arrow = (dir) => {
        const b = el('button', 'shop-buy shop-pick-btn', `<svg class="ico" viewBox="0 0 24 24"><path d="${dir < 0 ? 'M15 4l-8 8 8 8' : 'M9 4l8 8-8 8'}"/></svg>`);
        b.dataset.shopCmd = `pickWeapon:${owned[(i + dir + n) % n]}`;
        b.dataset.nosfx = '';
        b.setAttribute('aria-label', T(dir < 0 ? 'aria.prevPage' : 'aria.nextPage'));
        return b;
      };
      foot.append(arrow(-1), arrow(1));
      card.append(foot);
    }
    return card;
  }

  _playerUpgrades() {
    const eco = this.game.economy;
    for (const id of PLAYER_UPGRADE_ORDER) {
      const u = PLAYER_UPGRADES[id];
      const o = eco.playerUpgradeOffer(id);
      const v = u.perRank < 1 ? Math.round(u.perRank * 100) : u.perRank;
      const body = `${this._pips(o.rank, o.max)}<p class="shop-fx">${T(`fx.${id}`, { v })}</p>`;
      const card = this._card(id, T(u.nameKey), body, o.reason === REASON.MAX ? 'maxed' : '');
      if (o.reason === REASON.MAX) this._footer(card, { label: T('shop.max'), enabled: false, done: true });
      else this._footer(card, { cmd: `player:${id}`, price: o.cost, enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
      this.grid.append(card);
    }
  }

  _defenses() {
    const g = this.game;
    const pads = g.run ? g.run.defenses.pads : [];
    // Beacon repair to full (D40): price grows with the damage
    if (g.run) {
      const b = g.run.beacon, o = g.repairOffer();
      const pct = Math.max(0, Math.min(100, (b.integrity / b.maxIntegrity) * 100));
      const body = `<i class="shop-integrity"><i style="width:${pct.toFixed(1)}%"></i></i>`
        + `<p class="shop-fx">${T('fx.repair', { n: Math.ceil(b.integrity), max: b.maxIntegrity })}</p>`;
      const card = this._card('repair', T('shop.beacon'), body, `shop-repair${o.reason === 'full' ? ' maxed' : ''}`);
      if (o.reason === 'full') this._footer(card, { label: T('shop.reason.full'), enabled: false, done: true });
      else this._footer(card, { cmd: 'repair', price: o.cost, enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
      this.grid.append(card);
    }
    this.grid.style.setProperty('--pads', String(Math.max(1, pads.length))); // desktop: one column per pad
    const padNames = g.run ? g.run.map.buildPads.map((p) => p.name) : [];
    pads.forEach((pad, i) => {
      const col = el('div', 'shop-pad');
      const title = el('h4', 'shop-pad-title');
      title.textContent = T(`shop.pad.${padNames[i] || (i === 0 ? 'west' : 'east')}`);
      col.append(title);
      for (const id of Object.keys(DEFENSES)) {
        const d = DEFENSES[id];
        if (d.inMvp === false) continue;
        // the pad tag is shown on phones only, where the pad columns become one paged row
        const body = `<p class="shop-pad-tag">${title.textContent}</p><p class="shop-fx">${T(`fx.${id}`)}</p>`;
        const card = this._card(id, T(`defense.${id}`), body, pad.device && pad.device.id === id ? 'equipped' : '');
        if (pad.device && pad.device.id === id) this._footer(card, { label: T('shop.installed'), enabled: false, done: true });
        else {
          const o = g.defenseOffer(i, id);
          this._footer(card, { cmd: `defense:${i}:${id}`, price: o.price, enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
        }
        col.append(card);
      }
      this.grid.append(col);
    });
  }
}
