// Results (Phase 7, D42; KILL LIST D78): the case-file page. Shown on MAP_DEFEAT / MAP_VICTORY (level over); after
// the last level of the campaign it has no CONTINUE. Lines count up one after another, then the stamp lands;
// tapping the page finishes the animation at once.
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
      panel: $('resultPanel'), failTitle: $('failTitle'), failReason: $('failReason'), failRetry: $('failRetry'),
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
    clearTimeout(this.sfxT);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.summary = null;
  }

  _render(s, animate) {
    cancelAnimationFrame(this.raf);
    const el = this.el;
    const congrats = s.last;
    // D116 (user): a defeat is a whole screen — "FAILED", a line, the reason (survival keeps its tablet: its records);
    // a stealth lesson failed on the training ground restarts the lesson only (its checkpoint)
    const failed = !s.won && s.modeId !== 'survival';
    el.panel.classList.toggle('failed', failed);
    if (failed) {
      el.failTitle.textContent = T('fail.title');
      el.failTitle.dataset.text = el.failTitle.textContent;
      // D118 (user): no line under a plain defeat ("the floor is still theirs" removed)
      el.failReason.textContent = s.checkpoint ? T('fail.tutDetected') : s.reason === 'detected' ? T('result.detectedText') : '';
      el.failRetry.textContent = T(s.checkpoint ? 'fail.retryTask' : 'defeat.retry');
      if (animate) {
        el.panel.classList.remove('fail-in'); void el.panel.offsetWidth; el.panel.classList.add('fail-in');
        // D117: the stamp sounds as the title lands (the screen comes in 2.15 s after the failure, the title 0.3 s later)
        clearTimeout(this.sfxT);
        this.sfxT = setTimeout(() => { if (this.summary) Sfx.play('stamp'); }, 2650);
      }
    }
    el.journal.classList.toggle('won', s.won);
    el.journal.classList.toggle('congrats', congrats);
    el.kicker.textContent = T('result.kicker', { map: T(s.mapNameKey) });
    const clock = (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    const acc = s.shots > 0 ? Math.round((Math.min(s.hits, s.shots) / s.shots) * 100) : 0;
    const num = (v) => String(v);
    let rows;
    if (s.modeId === 'survival') {
      // D85 survival: how long, how many, the threat reached, the records
      el.title.textContent = T('result.survivalOver');
      el.sub.textContent = T('result.survivalText');
      el.stamp.textContent = T(s.newRecord ? 'result.newRecord' : 'result.defeat');
      rows = [
        ['result.survived', Math.round(s.time), clock],
        ['result.kills', s.kills, num],
        ['result.threat', s.threat, num],
        ['result.accuracy', acc, (v) => `${v}%`],
        ['result.best', Math.round(s.best), clock],
        ['result.bestKills', s.bestKills, num],
      ];
    } else if (s.modeId === 'stealth') {
      // D85 stealth: medals (Ghost / No kills / Fast), intel, takedowns
      const md = s.medals || {}, n = (md.ghost ? 1 : 0) + (md.noKills ? 1 : 0) + (md.fast ? 1 : 0);
      el.title.textContent = s.won ? T('victory.title') : T(s.reason === 'detected' ? 'defeat.detected' : 'defeat.player');
      el.sub.textContent = s.won ? T('result.stealthWon') : (s.reason === 'detected' ? T('result.detectedText') : '');
      el.stamp.textContent = T(s.won ? (n === 3 ? 'result.rankGhost' : 'result.victory') : 'result.defeat');
      rows = [
        ['result.time', Math.round(s.time), clock],
        ['result.medals', n, (v) => `${v}/3`],
        ['result.intel', s.intel, (v) => `${v}/${s.intelTotal}`],
        ['result.takedowns', s.takedowns, num],
        ['result.kills', s.kills, num],
      ];
      if (s.won && s.best > 0) rows.push(['result.best', Math.round(s.best), clock]);
    } else {
      el.title.textContent = s.won ? T('victory.title') : T('defeat.player');
      el.sub.textContent = s.won ? T(congrats ? 'congrats.text' : 'result.wonText') : '';
      el.stamp.textContent = T(s.won ? 'result.victory' : 'result.defeat');
      // lines: [labelKey, target, format] — KILL LIST (D78): time, kills, accuracy, damage taken (+ best time on a win)
      rows = [
        ['result.time', Math.round(s.time), clock],
        ['result.kills', s.kills, num],
        ['result.accuracy', acc, (v) => `${v}%`],
        ['result.damage', s.damageTaken, num],
      ];
      if (s.won && s.best > 0) rows.push(['result.best', Math.round(s.best), clock]);
    }
    // D110: the tablet's glitch layers repeat the title / status text (CSS attr(data-text))
    el.title.dataset.text = el.title.textContent;
    el.stamp.dataset.text = el.stamp.textContent;
    el.lines.replaceChildren();
    this.items = [];
    // D110: the tablet boots again with a glitch on every new result
    if (animate) { el.journal.classList.remove('boot'); void el.journal.offsetWidth; el.journal.classList.add('boot'); }
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

    // buttons: defeat → RETRY; victory → CONTINUE (if a next level exists) + PLAY AGAIN; the last level → PLAY AGAIN
    el.retry.textContent = T(s.won ? 'victory.again' : 'defeat.retry');
    el.cont.hidden = !s.won || congrats;

    if (!animate || failed) { this._showAll(); return; } // (a defeat shows no tablet: nothing to count up)
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
