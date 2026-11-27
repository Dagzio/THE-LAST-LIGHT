// D88 (user request): the dialogue window — the speaker's portrait, the user's frame with the name, the text typed
// letter by letter (fast), NEXT (finishes the line, then the next one) and SKIP (closes the whole dialogue). The radio
// sound plays when a dialogue opens. The game waits while it is open (Game.dialogueOpen: no simulation step); every
// dialogue plays once per run; one asked for while another is open waits its turn. Reads the run, never changes it.
import { T, onLanguageChange } from '../i18n/i18n.js';
import { DIALOGUES, SPEAKERS, LEVEL_DIALOGUES, DIALOGUE_CPS } from '../data/dialogues.js';
import { Sfx } from '../platform/Sfx.js';

export class DialogueView {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = { root: $('dialogue'), portrait: $('dlgPortrait'), name: $('dlgName'), text: $('dlgText'), next: $('dlgNext'), skip: $('dlgSkip') };
    this.queue = [];
    this.played = new Set();
    this.lines = null;      // the open dialogue
    this.index = 0;
    this.shown = 0;         // letters typed so far
    this.full = '';
    this.run = null;
    if (!this.el.root) return;
    for (const s of Object.values(SPEAKERS)) if (s.portrait) new Image().src = s.portrait; // warm the cache
    this.el.next.addEventListener('click', (e) => { e.stopPropagation(); Sfx.play('click'); this.next(); });
    this.el.skip.addEventListener('click', (e) => { e.stopPropagation(); Sfx.play('click'); this.close(); });
    // the frame itself: a tap anywhere on it works like NEXT
    this.el.root.querySelector('.dlg-box').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget || e.target.closest('.dlg-text, .dlg-frame, .dlg-name')) this.next(); });
    window.addEventListener('keydown', (e) => {
      if (!this.lines || !game.sm.is('RUNNING')) return;
      // (registered before the game's input: the key never reaches the hero — no roll / no crate after the dialogue)
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.next(); }
    });
    onLanguageChange(() => { if (this.lines) this._showLine(true); });
    const ev = game.events;
    ev.on('mapStarted', () => { this._reset(); this._levelEvent('start'); });
    ev.on('pickup', (kind) => this._levelEvent(kind));
    ev.on('copyDone', () => this._levelEvent('copy'));
    ev.on('dialogue', (id) => this.open(id));
    ev.on('mapDefeat', () => this._reset());
    ev.on('mapVictory', () => this._reset());
    game.sm.onChange(() => { if (!game.sm.inMap) this._reset(); });
    game.onFrame((dt) => this._type(dt));
  }

  _reset() {
    this.queue.length = 0;
    this.played.clear();
    this._hide();
  }

  _levelEvent(kind) {
    const run = this.game.run;
    if (!run) return;
    const set = (LEVEL_DIALOGUES[run.mapId] || {})[run.modeId];
    if (!set || !set[kind]) return;
    // D110: a list plays in order. D120 (user: the office's story call and its briefing felt like two dialogues — SKIP
    // skipped only the first): a list is ONE conversation (its lines joined). D128: every dialogue plays once ever
    // (read or skipped — the profile keeps it), the story ones too
    this.openMany([].concat(set[kind]));
  }

  /** Opens a dialogue by id (once per run); another one open → it waits. */
  open(id) { return this.openMany([id]); }

  /** D120: several dialogues as one conversation (their lines in order; SKIP closes all of it). */
  openMany(ids) {
    const lines = [], took = [];
    for (let id of ids) {
      if (!DIALOGUES[id] || this.played.has(id)) continue;
      // D128 (user): a dialogue read or skipped once (any run before) never plays again
      if (this.game.isDialogueSeen && this.game.isDialogueSeen(id)) continue;
      this.played.add(id);
      took.push(id);
      if (this.game.touchMode && DIALOGUES[`${id}.touch`]) id = `${id}.touch`; // D93: the phone's own variant
      this.played.add(id);
      lines.push(...DIALOGUES[id]);
    }
    if (!lines.length) return false;
    lines.ids = took; // (marked seen once this conversation is closed — read to the end or skipped)
    if (this.lines) { this.queue.push(lines); return true; }
    this._start(lines);
    return true;
  }

  _start(lines) {
    this.lines = lines;
    this.index = 0;
    this.game.dialogueOpen = true;
    this.game.input.releaseAll(); // nothing held / queued goes on while the game waits
    Sfx.play('radio', 1, { voices: 1 });
    this.el.root.hidden = false;
    document.body.classList.add('dlg-open'); // the HUD's bottom blocks / touch buttons step aside meanwhile
    this._showLine(false);
  }

  _showLine(keepTyped) {
    const [who, key] = this.lines[this.index];
    const sp = SPEAKERS[who] || SPEAKERS.handler;
    const right = sp.side === 'right';
    this.el.root.classList.toggle('right', right);
    // D148: a speaker without a portrait (the dispatcher) — its place kept empty, only the name on the plate
    this.el.portrait.classList.toggle('none', !sp.portrait);
    if (sp.portrait && this.el.portrait.getAttribute('src') !== sp.portrait) {
      this.el.portrait.src = sp.portrait;
      this.el.portrait.style.animation = 'none'; void this.el.portrait.offsetWidth; this.el.portrait.style.animation = '';
    }
    this.el.name.textContent = T(sp.nameKey);
    this.full = T(key);
    if (!keepTyped) this.shown = 0;
    this._paint();
    this._fit();
  }

  /** D91 (small phones): the whole line fits its box — the font shrinks (down to 12 px) when the line is long. */
  _fit() {
    const box = this.el.text, line = this.lineEl;
    if (!line) return;
    box.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(box).fontSize);
    while (fs - 0.5 >= 12 && line.offsetHeight > box.clientHeight - 3) { fs -= 0.5; box.style.fontSize = `${fs}px`; }
  }

  /**
   * D90: the text is centred — the whole line is laid out at once, the letters not typed yet hidden (so the typed ones
   * never move as the line grows).
   */
  _paint() {
    const n = Math.floor(this.shown);
    if (!this.lineEl) {
      this.lineEl = document.createElement('span');
      this.typedEl = document.createTextNode('');
      this.restEl = document.createElement('span');
      this.restEl.className = 'dlg-rest';
      this.lineEl.append(this.typedEl, this.restEl);
      this.el.text.replaceChildren(this.lineEl);
    }
    this.typedEl.data = this.full.slice(0, n);
    this.restEl.textContent = this.full.slice(n);
  }

  /** Typewriter (real frame time: the game clock stands still meanwhile). */
  _type(dt) {
    if (!this.lines || this.shown >= this.full.length) return;
    if (!this.game.sm.is('RUNNING')) return; // paused: the typing waits too
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.full.length, this.shown + Math.max(0, dt) * DIALOGUE_CPS);
    if (Math.floor(this.shown) !== before) this._paint();
  }

  /** NEXT: the line still typing → shown whole; else the next line, or the end. */
  next() {
    if (!this.lines) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; this._paint(); return; }
    this.index += 1;
    if (this.index >= this.lines.length) { this.close(); return; }
    this._showLine(false);
  }

  /** SKIP (or the last line read): the dialogue closes; a waiting one opens. */
  close() {
    if (!this.lines) return;
    if (this.lines.ids && this.game.markDialoguesSeen) this.game.markDialoguesSeen(this.lines.ids); // D128
    this._hide();
    const next = this.queue.shift();
    if (next) this._start(next);
  }

  _hide() {
    this.lines = null;
    this.game.dialogueOpen = false;
    this.game.input.releaseAll(); // the Space / E of the dialogue never reaches the hero
    if (this.game.renderer3d) this.game.renderer3d.pausedDrawn = false;
    if (this.el.root) this.el.root.hidden = true;
    document.body.classList.remove('dlg-open');
  }
}
