// Shop overlay (Underlords shop style, PROJECT_AUDIT.md §6.6; 02_SPEC §12). Shown while the game is in SHOP_OPEN
// (and stays under the Settings popup when paused from the shop). Tabs: WEAPONS · UPGRADES (weapon) · KEEPER
// (heals + player upgrades, D52) · GRENADES (Phase 6) · DEFENSES (beacon repair + devices on build pads + their repair).
// The view only displays offers computed by the Economy/Game and calls Game commands — it never edits the profile.
// DOM is rebuilt on open / tab switch / after a purchase / on language change — never per frame.
import { STATES } from '../core/GameStateMachine.js';
import { T, onLanguageChange } from '../i18n/i18n.js';
import { WEAPONS } from '../data/weapons.js';
import { WEAPON_UPGRADE, WEAPON_NODES, UPGRADE_NODES, NODE_NAME_OVERRIDES, PLAYER_UPGRADES, PLAYER_UPGRADE_ORDER } from '../data/upgrades.js';
import { DEFENSES, MAX_DEVICE_LEVEL } from '../data/defenses.js';
import { GRENADES, GRENADE_ORDER } from '../data/grenades.js';
import { HEALS, HEAL_ORDER } from '../data/heals.js';
import { gunIcon, grenadeIcon } from '../data/icons.js';
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
  // D52
  regen: '<path d="M12 20s-7-4.6-7-9.8A4 4 0 0 1 12 8a4 4 0 0 1 7 2.2C19 15.4 12 20 12 20z"/><path d="M12 11v5M9.5 13.5h5"/>',
  vampirism: '<path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z"/><path d="M9 13l1.5 3 1.5-3 1.5 3 1.5-3"/>',
  crit: '<path d="M12 2l2.4 6.6L21 9l-5 4.6L17.5 21 12 17.3 6.5 21 8 13.6 3 9l6.6-.4z"/>',
  bandage: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M10.5 10.5h.01M13.5 13.5h.01M13.5 10.5h.01M10.5 13.5h.01"/>',
  medkit: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 10v7M8.5 13.5h7"/>',
  big_medkit: '<rect x="2" y="6" width="20" height="15" rx="2"/><path d="M8 6V3h8v3M12 9v9M7.5 13.5h9"/><path d="M5 9v9M19 9v9"/>',
  guard_turret: '<path d="M6 20h12l-2-6H8z"/><path d="M8 14V9h8v5M16 11h6"/>',
  frost_coil: '<path d="M12 2v20M3 7l18 10M21 7L3 17"/>',
  poison_turret: '<path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
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
    this.defensePad = 0;         // D51 desktop DEFENSES: the pad shown (chips above the cards)
    this.keeperView = 'heal';    // D52 desktop KEEPER: 'heal' | 'upgrades' (chips; phones show both in the paged row)
    // Phone step (≤ 500 px high, base.css): one row of cards with page arrows, weapon picker card in UPGRADES
    this.phoneMQ = matchMedia('(max-height: 500px)');

    this.sellArmed = null; // D63: the sale waiting for its confirmation (the SELL button's command), or null
    this.tabs.forEach((t) => t.addEventListener('click', () => {
      this.tab = t.dataset.shopTab;
      this.page = 0;
      this.sellArmed = null;
      if (this.tab === 'weaponUpgrades') this.upgradeWeaponId = game.economy.profile.equippedWeaponId; // equipped first
      if (this.tab === 'playerUpgrades') this.keeperView = this._hurt() ? 'heal' : 'upgrades'; // D52
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

  /** D52: the keeper is below full HP (the KEEPER tab opens on its heals then). */
  _hurt() { const p = this.game.run && this.game.run.player; return !!p && p.alive && p.hp < p.maxHp; }

  get visible() { return this.root.classList.contains('show'); }

  _syncVisible() {
    const g = this.game;
    const show = g.sm.is(STATES.SHOP_OPEN) || (g.sm.is(STATES.PAUSED) && g.resumeState === STATES.SHOP_OPEN);
    if (show === this.visible) return;
    this.root.classList.toggle('show', show);
    if (show) {
      if (g.sm.is(STATES.SHOP_OPEN)) Sfx.play(Sfx.duration('shopOpen') > 0 ? 'shopOpen' : 'open'); // recorded shop sound
      this.upgradeWeaponId = g.economy.profile.equippedWeaponId;
      this.sellArmed = null;
      this.refresh();
    }
  }

  // ---------------- commands ----------------
  _onClick(e) {
    // D63: the tag in a card's corner arms the sale (the card's button becomes SELL +coins); tapped again — cancels
    const arm = e.target.closest('[data-sell-arm]');
    if (arm) {
      this.sellArmed = this.sellArmed === arm.dataset.sellArm ? null : arm.dataset.sellArm;
      Sfx.play('click');
      this.refresh();
      return;
    }
    const b = e.target.closest('[data-shop-cmd]');
    if (!b || b.disabled) return;
    const [cmd, a, c] = b.dataset.shopCmd.split(':');
    const g = this.game;
    let r = null;
    this.sellArmed = null; // any other action cancels an armed sale
    if (cmd === 'sellW') r = g.shopSellWeapon(a);
    else if (cmd === 'sellD') r = g.shopSellDefense(Number(a), c);
    else if (cmd === 'buyWeapon') r = g.shopBuyWeapon(a);
    else if (cmd === 'equip') r = g.shopEquipWeapon(a);
    else if (cmd === 'upgrade') r = g.shopBuyWeaponUpgrade(a, c);
    else if (cmd === 'player') r = g.shopBuyPlayerUpgrade(a);
    else if (cmd === 'defense') r = g.shopBuyDefense(Number(a), c);
    else if (cmd === 'dupgrade') r = g.shopUpgradeDefense(Number(a));
    else if (cmd === 'repair') r = g.shopRepairBeacon();
    else if (cmd === 'drepair') r = g.shopRepairDevice(Number(a)); // D52
    else if (cmd === 'heal') r = g.shopHeal(a);                    // D52
    else if (cmd === 'grenade') r = g.shopBuyGrenade(a);
    else if (cmd === 'pickWeapon') { this.upgradeWeaponId = a; this.refresh(); return; }
    else if (cmd === 'pickKeeper') { this.keeperView = a; Sfx.play('click'); this.refresh(); return; }
    else if (cmd === 'pickPad') { this.defensePad = Number(a); Sfx.play('click'); this.refresh(); return; }
    if (!r) return;
    Sfx.play(r.ok ? (cmd === 'equip' || r.equip ? 'click' : 'buy') : 'deny');
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
      // D52 upgrade + wrench pair: on a phone both are icon + price (the word is hidden) — fit only when it is shown
      if (this.phoneMQ.matches && n.parentElement.classList.contains('shop-foot-row')) continue;
      n.style.overflowWrap = '';
      n.style.whiteSpace = '';
      n.style.lineHeight = '';
      n.style.textAlign = '';
      let fs = parseFloat(getComputedStyle(n).fontSize);
      while (fs > 12 && !textFits(n)) { fs -= 1; n.style.fontSize = `${fs}px`; }
      // D63: a two-word label ("FULL INTEGRITY") wraps between its words before any word is broken
      if (!textFits(n) && n.classList.contains('shop-buy')) { n.style.whiteSpace = 'normal'; n.style.lineHeight = '1.1'; n.style.textAlign = 'center'; }
      if (!textFits(n)) n.style.overflowWrap = 'anywhere'; // last resort: break the word rather than leave the card
    }
  }

  /** Long languages: shrink all tab labels to one common size (never wrap, never cut; H5 one role = one size). */
  _fitTabs() {
    for (const t of this.tabs) t.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(this.tabs[0]).fontSize);
    // D63: desktop step on a small tablet (1024 × 600): the tab row runs under the coins — shrink until it fits
    const row = this.tabs[0].parentElement;
    const overflow = this.phoneMQ.matches ? () => this.tabs.some((t) => !textFits(t)) : () => row.scrollWidth > row.clientWidth + 1;
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
    if (this.sellArmed) { this.sellArmed = null; this.page += dir; this.refresh(); if (this.page !== before) Sfx.play('click'); return; }
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
      const card = this._card(`img:${grenadeIcon(id)}`, T(G.nameKey), body, o.reason === REASON.LEVEL ? 'locked' : '');
      this._footer(card, { cmd: `grenade:${id}`, price: o.price, enabled: o.canBuy, reason: o.canBuy ? null : o.reason, reasonParams: { n: o.requiredLevel } });
      this.grid.append(card);
    }
  }

  _card(icon, title, bodyHtml, extraCls = '') {
    const card = el('div', `shop-card ${extraCls}`);
    const head = el('div', 'shop-card-head');
    // D52: 'img:<url>' — the user's weapon / grenade art instead of a line icon
    const ico = icon.startsWith('img:') ? `<img src="${icon.slice(4)}" alt="" draggable="false">` : `<svg viewBox="0 0 24 24">${ICON[icon] || ICON.damage}</svg>`;
    head.append(el('span', `shop-card-ico${icon.startsWith('img:') ? ' art' : ''}`, ico), el('span', 'shop-card-name'));
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
    const priced = price !== undefined && price !== null;
    btn.innerHTML = priced ? `${COIN}<b>${price}</b>` : '';
    if (label && priced) btn.prepend(document.createTextNode(label)); // "UPGRADE 🪙60": the action, then its price
    else if (label) btn.append(document.createTextNode(label));
    foot.append(btn);
    if (reason) { const r = el('span', 'shop-reason'); r.textContent = T(`shop.reason.${reason}`, reasonParams); foot.append(r); }
    card.append(foot);
    return card;
  }

  /**
   * D63: a sellable card gets a small price-tag button in its head corner. Armed (tapped once), the card's footer turns
   * into one red SELL +coins button — a second, deliberate tap sells (no accidental sale on a phone); the corner
   * button becomes × (keep it).
   */
  _sellable(card, sellCmd, refund) {
    const armed = this.sellArmed === sellCmd;
    const tag = el('button', 'shop-sell-tag', armed
      ? '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
      : '<svg class="ico" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-7 7z"/><circle cx="7.5" cy="8.5" r="1.6"/></svg>');
    tag.dataset.sellArm = sellCmd;
    tag.dataset.nosfx = '';
    tag.setAttribute('aria-label', T(armed ? 'aria.sellCancel' : 'aria.sell'));
    card.querySelector('.shop-card-head').append(tag);
    card.classList.add('sellable');
    if (!armed) return;
    card.classList.add('selling');
    const old = card.querySelector('.shop-card-foot');
    if (old) old.remove();
    this._footer(card, { cmd: sellCmd, label: T('shop.sell'), price: `+${refund}`, enabled: true });
    card.querySelector('.shop-card-foot .shop-buy').classList.add('shop-sell-go');
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
      const card = this._card(`img:${gunIcon(id)}`, T(w.nameKey), body, o.equipped ? 'equipped' : o.owned ? 'owned' : o.reason === REASON.LEVEL ? 'locked' : '');
      if (o.equipped) this._footer(card, { label: T('shop.equipped'), enabled: false, done: true });
      else if (o.owned) this._footer(card, { cmd: `equip:${id}`, label: T('shop.equip'), enabled: true });
      else this._footer(card, { cmd: `buyWeapon:${id}`, price: o.price, enabled: o.canBuy, reason: o.canBuy ? null : o.reason, reasonParams: { n: o.requiredLevel } });
      const so = eco.weaponSellOffer(id);
      if (so.canSell) this._sellable(card, `sellW:${id}`, so.refund);
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
      chip.textContent = `${T(WEAPONS[id].nameKey)} · ${T('shop.weaponLevel', { n: eco.weaponLevel(id), max: WEAPON_UPGRADE.maxWeaponLevel })}`;
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
    const card = this._card(`img:${gunIcon(wid)}`, T(WEAPONS[wid].nameKey), `<p class="shop-pick-lv">${T('shop.weaponLevel', { n: eco.weaponLevel(wid), max: WEAPON_UPGRADE.maxWeaponLevel })}</p>`, 'equipped shop-picker');
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
    const eco = this.game.economy, g = this.game;
    // D52: heals first (one-off, this map) — the keeper's HP bar on the card shows what they would fix.
    // Desktop: two chips (HEALING · UPGRADES) so the 11 cards never need scrolling; phones: one paged row.
    const p = g.run && g.run.player;
    const desk = !this.phoneMQ.matches;
    if (desk) {
      for (const [view, key] of [['heal', 'shop.chip.heal'], ['upgrades', 'shop.tab.weaponUpgrades']]) {
        const chip = el('button', `shop-chip${view === this.keeperView ? ' active' : ''}`);
        chip.dataset.shopCmd = `pickKeeper:${view}`;
        chip.dataset.nosfx = '';
        chip.textContent = T(key);
        this.sub.append(chip);
      }
    }
    if (!desk || this.keeperView === 'heal') for (const id of HEAL_ORDER) {
      const H = HEALS[id], o = g.healOffer(id);
      const pct = p ? Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100)) : 100;
      const body = `<i class="shop-integrity shop-hp"><i style="width:${pct.toFixed(1)}%"></i></i><p class="shop-fx">${T('fx.heal', { v: Math.round(H.pct * 100) })}</p>`;
      const card = this._card(id, T(H.nameKey), body, `shop-heal${o.reason === 'fullHp' ? ' maxed' : ''}`);
      if (o.reason === 'fullHp') this._footer(card, { label: T('shop.reason.fullHp'), enabled: false, done: true });
      else this._footer(card, { cmd: `heal:${id}`, price: o.price, enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
      this.grid.append(card);
    }
    if (!desk || this.keeperView === 'upgrades') for (const id of PLAYER_UPGRADE_ORDER) {
      const u = PLAYER_UPGRADES[id];
      const o = eco.playerUpgradeOffer(id);
      const v = u.fxValue ?? (u.perRank < 1 ? Math.round(u.perRank * 100) : u.perRank);
      const body = `${this._pips(o.rank, o.max)}<p class="shop-fx">${T(`fx.${id}`, { v })}</p>`;
      const card = this._card(id, T(u.nameKey), body, o.reason === REASON.MAX ? 'maxed' : '');
      if (o.reason === REASON.MAX) this._footer(card, { label: T('shop.max'), enabled: false, done: true });
      else this._footer(card, { cmd: `player:${id}`, price: o.cost, enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
      this.grid.append(card);
    }
  }

  /** D52: a small wrench + price beside the card's main button (only while the installed device is damaged). */
  _repairButton(card, padIndex) {
    const r = this.game.deviceRepairOffer(padIndex, false);
    if (r.reason === 'full') return;
    const foot = card.querySelector('.shop-card-foot');
    const main = foot && foot.querySelector('.shop-buy');
    if (!main) return;
    const row = el('div', 'shop-foot-row');
    const b = el('button', 'shop-buy shop-fix', `<svg class="ico" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>${COIN}<b>${r.cost}</b>`);
    b.dataset.shopCmd = `drepair:${padIndex}`;
    b.dataset.nosfx = '';
    b.disabled = !r.canBuy;
    b.setAttribute('aria-label', T('aria.repairDevice'));
    // narrow phone cards: the action word gives way to an up arrow, so the price on both buttons stays whole
    const word = [...main.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (word) {
      const span = el('span', 'buy-label');
      span.textContent = word.textContent;
      word.replaceWith(span);
      span.before(el('span', 'buy-up', '<svg class="ico" viewBox="0 0 24 24"><path d="M12 19V6M6 11l6-6 6 6"/></svg>'));
    }
    main.replaceWith(row);
    row.append(main, b);
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
    const padNames = g.run ? g.run.map.buildPads.map((p) => p.name) : [];
    // D51: three device types — on desktop one pad at a time (chips like the UPGRADES weapons: name · installed
    // level), its cards in one row; phones keep the paged row with the pad tag on every card
    const desk = !this.phoneMQ.matches;
    if (this.defensePad >= pads.length) this.defensePad = 0;
    if (desk) {
      pads.forEach((pad, i) => {
        const chip = el('button', `shop-chip${i === this.defensePad ? ' active' : ''}`);
        chip.dataset.shopCmd = `pickPad:${i}`;
        chip.dataset.nosfx = '';
        const name = T(`shop.pad.${padNames[i] || (i === 0 ? 'west' : 'east')}`);
        chip.textContent = pad.device ? `${name} · ${T(`defense.${pad.device.id}`)} ${T('hud.level', { n: pad.device.level })}` : name;
        this.sub.append(chip);
      });
    }
    this.grid.style.setProperty('--pads', '1');
    pads.forEach((pad, i) => {
      if (desk && i !== this.defensePad) return;
      const col = el('div', 'shop-pad');
      const title = el('h4', 'shop-pad-title');
      title.textContent = T(`shop.pad.${padNames[i] || (i === 0 ? 'west' : 'east')}`);
      col.append(title);
      for (const id of Object.keys(DEFENSES)) {
        const d = DEFENSES[id];
        if (d.inMvp === false) continue;
        // D50: bought on this pad → level pips; installed → UPGRADE (to MAX); in the pad's storage → free INSTALL.
        const o = g.defenseOffer(i, id);
        // the pad tag is shown on phones only, where the pad columns become one paged row
        const pips = o.level ? this._pips(o.level, MAX_DEVICE_LEVEL) : '';
        // D52: the installed device shows its HP (a thin bar on the pips line — no extra height on a phone)
        const dev = o.installed ? pad.device : null;
        const hpPct = dev ? Math.max(0, Math.min(100, (dev.hp / dev.maxHp) * 100)) : 0;
        const hpBar = dev ? `<i class="shop-dev-hp${dev.hp <= 0 ? ' broken' : ''}"><i style="width:${hpPct.toFixed(1)}%"></i></i>` : '';
        const fx = dev && dev.hp <= 0 ? `<b class="shop-broken">${T('shop.deviceBroken')}</b>` : T(`fx.${id}`);
        // phones: pips + pad tag on one line (the tag is hidden on desktop, the pips stay)
        const body = `<p class="shop-pad-line">${pips}${hpBar}<span class="shop-pad-tag">${title.textContent}</span></p><p class="shop-fx">${fx}</p>`;
        const maxed = o.installed && o.level >= MAX_DEVICE_LEVEL;
        const card = this._card(id, T(`defense.${id}`), body, o.installed ? `equipped${maxed ? ' maxed' : ''}` : o.owned ? 'owned' : '');
        if (o.installed) {
          const u = g.defenseUpgradeOffer(i);
          if (u.reason === REASON.MAX) this._footer(card, { label: T('shop.max'), enabled: false, done: true });
          else this._footer(card, { cmd: `dupgrade:${i}`, label: T('shop.upgrade'), price: u.price, enabled: u.canBuy, reason: u.canBuy ? null : u.reason });
          this._repairButton(card, i); // D52: wrench + price next to the main button while it is damaged
        } else if (o.owned) this._footer(card, { cmd: `defense:${i}:${id}`, label: T('shop.install'), enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
        else this._footer(card, { cmd: `defense:${i}:${id}`, price: o.price, enabled: o.canBuy, reason: o.canBuy ? null : o.reason });
        const so = g.defenseSellOffer(i, id);
        if (so.canSell) this._sellable(card, `sellD:${i}:${id}`, so.refund);
        col.append(card);
      }
      this.grid.append(col);
    });
  }
}
