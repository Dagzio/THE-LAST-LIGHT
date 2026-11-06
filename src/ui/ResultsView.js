// Results (Phase 7, D42): the keeper's journal page instead of Underlords' newspaper. Shown on MAP_DEFEAT /
// MAP_VICTORY; after the last map of the campaign it is the Congrats page (D19 — no "next map"). Lines count up one
// after another, then the VICTORY / DEFEAT stamp lands; tapping the page finishes the animation at once.
// Presentation only: it reads Game.resultSummary() — opening it again never grants anything.
import { T, onLanguageChange } from '../i18n/i18n.js';
import { Sfx } from '../platform/Sfx.js';

const LINE_MS = 520;   // count-up time of one line
const GAP_MS = 170;    // pause before the next line
const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);

export class ResultsView {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      journal: $('journal'), kicker: $('jKicker'), title: $('resultTitle'), sub: $('jSub'), lines: $('jLines'),
      stamp: $('jStamp'), retry: $('resultRetry'), cont: $('resultContinue'),
    };
    this.raf = 0;
    this.items = [];
    this.summary = null;
    this.el.journal.addEventListener('click', () => this._finish());
    onLanguageChange(() => { if (this.summary) this._render(this.summary, false); });
  }

  /** Called when the map is over. */
  show() {
    const s = this.game.resultSummary();
    if (!s) return;
    this.summary = s;
    this._render(s, true);
  }

  hide() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.summary = null;
  }

  _render(s, animate) {
    cancelAnimationFrame(this.raf);
    const el = this.el;
    const congrats = s.last;
    el.journal.classList.toggle('won', s.won);
    el.journal.classList.toggle('congrats', congrats);
    el.kicker.textContent = T('result.kicker', { map: T(s.mapNameKey) });
    el.title.textContent = congrats ? T('congrats.title')
      : s.won ? T('victory.title') : T(s.reason === 'player' ? 'defeat.player' : 'defeat.beacon');
    el.sub.textContent = congrats ? T('congrats.text') : s.won ? T('result.wonText') : T('result.lostText');
    el.stamp.textContent = T(congrats ? 'result.campaign' : s.won ? 'result.victory' : 'result.defeat');

    // lines: [labelKey, target, format]
    const rows = [
      ['result.waves', s.waves, (v) => `${v}/${s.wavesTotal}`],
      ['result.kills', s.kills, (v) => String(v)],
      ['result.coins', s.coins, (v) => `+${v}`],
      ['result.xp', s.xp, (v) => `+${v}`],
    ];
    if (congrats) {
      rows.push(null); // divider: campaign totals
      rows.push(['result.mapsCleared', s.campaign.mapsCleared, (v) => `${v}/${s.campaign.mapsTotal}`]);
      rows.push(['result.totalKills', s.campaign.totalKills, (v) => String(v)]);
      rows.push(['result.level', s.campaign.level, (v) => String(v)]);
    }
    el.lines.replaceChildren();
    this.items = [];
    for (const row of rows) {
      const li = document.createElement('li');
      if (!row) { li.className = 'journal-divider'; el.lines.append(li); continue; }
      const [key, target, fmt] = row;
      li.innerHTML = '<span class="jl-label"></span><span class="jl-dots"></span><b class="jl-value"></b>';
      li.querySelector('.jl-label').textContent = T(key);
      const value = li.querySelector('.jl-value');
      value.textContent = fmt(animate ? 0 : target);
      el.lines.append(li);
      this.items.push({ li, value, target: Math.max(0, target | 0), fmt });
    }

    // buttons: defeat → RETRY; victory → CONTINUE (if a next map exists) + PLAY AGAIN; Congrats → PLAY AGAIN
    el.retry.textContent = T(s.won ? 'victory.again' : 'defeat.retry');
    el.cont.hidden = !s.won || congrats;

    if (!animate) { this._showAll(); return; }
    el.journal.classList.remove('stamped');
    for (const it of this.items) it.li.classList.remove('in');
    const t0 = performance.now() + 250;
    let doneLines = 0;
    const tick = (now) => {
      let allDone = true;
      this.items.forEach((it, i) => {
        const start = t0 + i * (LINE_MS + GAP_MS);
        if (now < start) { allDone = false; return; }
        it.li.classList.add('in');
        const k = Math.min(1, (now - start) / LINE_MS);
        it.value.textContent = it.fmt(Math.round(it.target * easeOut(k)));
        if (k < 1) allDone = false;
        else if (!it.done) { it.done = true; doneLines++; Sfx.play('click', 1.2 + doneLines * 0.06); }
      });
      if (allDone) { this._stamp(); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  _showAll() {
    for (const it of this.items) { it.done = true; it.li.classList.add('in'); it.value.textContent = it.fmt(it.target); }
    this.el.journal.classList.add('stamped');
  }

  _stamp() {
    this.raf = 0;
    if (this.el.journal.classList.contains('stamped')) return;
    this.el.journal.classList.add('stamped');
    Sfx.play('stamp');
  }

  /** Tap on the page: skip the count-up. */
  _finish() {
    if (!this.summary || this.el.journal.classList.contains('stamped')) return;
    cancelAnimationFrame(this.raf);
    this._showAll();
    Sfx.play('stamp');
  }
}
