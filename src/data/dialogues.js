// D88 (user request): the dialogues — short exchanges over the radio between the handler and the hero during a job:
// the handler tells, the hero confirms or asks, the handler answers. Art: NEW/dialogue (the frame, two portraits →
// assets/ui/dialogue by tools/build-training-assets.py). Every line is a locale key (src/i18n/locales.js, all 10
// languages). A dialogue plays once per run; the game waits while it is open (ui/DialogueView.js).

/** The speakers: name (locale key), portrait, the side the portrait stands on. */
export const SPEAKERS = {
  handler: { nameKey: 'dlg.name.handler', portrait: 'assets/ui/dialogue/handler.webp', side: 'left' },
  hero: { nameKey: 'dlg.name.hero', portrait: 'assets/ui/dialogue/hero.webp', side: 'right' },
  // D148: Director Vance (the user's NEW/dialogue/Wance.png); the port's dispatcher — no portrait (the name only)
  vance: { nameKey: 'dlg.name.vance', portrait: 'assets/ui/dialogue/vance.webp', side: 'left' },
  dispatcher: { nameKey: 'dlg.name.dispatcher', portrait: null, side: 'left' },
};

const H = (key) => ['handler', key], K = (key) => ['hero', key];
const V = (key) => ['vance', key], D = (key) => ['dispatcher', key]; // D148

/** id → lines [speaker, locale key]. */
export const DIALOGUES = {
  // ---- D110 (user: a story chain): the recruitment call before the training ground, the briefing before the office.
  // D128: every dialogue plays once per player (read or skipped — the profile keeps it) until the progress is reset.
  // D129 (user: all the lines rewritten — the desktop's dialogs.txt, tools/export-dialogs.mjs)
  'story.recruit': [H('dlg.sr.1'), K('dlg.sr.2'), H('dlg.sr.3'), K('dlg.sr.4'), H('dlg.sr.5'), K('dlg.sr.6'), H('dlg.sr.7'), K('dlg.sr.8')],
  'story.office': [H('dlg.so.1'), K('dlg.so.2'), H('dlg.so.3')],
  // ---- office · mission (story.office + office.start play as one conversation)
  'office.start': [K('dlg.os.1'), H('dlg.os.2'), H('dlg.os.park'), H('dlg.os.3'), H('dlg.os.4')], // D145: + the way in
  'office.keycard': [K('dlg.ok.1'), H('dlg.ok.2')],
  'office.drive': [H('dlg.od.1'), K('dlg.od.2')],
  'office.search': [H('dlg.osr.1')],
  'office.alarm': [H('dlg.oal.1')],    // D146: spotted, the alarm rings — where to cut it
  'office.alarmOff': [H('dlg.oal.2')], // D146: cut                            // D143 (user): in the security room — where to look
  'office.download': [K('dlg.odl.1'), H('dlg.odl.2'), K('dlg.odl.3')], // D143 (user): the download started
  // ---- D148: Marseille level 2 — the safe flat (STORY_DESIGN_D133.md §6)
  'flat.start': [K('dlg.fs.1'), H('dlg.fs.2')],
  'flat.moro': [K('dlg.fm.1'), H('dlg.fm.2')],           // [СЦЕНА] the body
  'flat.laptop': [K('dlg.fl.1'), K('dlg.fl.2'), H('dlg.fl.3')], // [СЦЕНА] the drive: a file on Kane himself
  'flat.call': [V('dlg.fc.1'), K('dlg.fc.2'), V('dlg.fc.3'), H('dlg.fc.4')], // [ЗВОНОК] Vance; Lyra on the second line
  'flat.stash': [K('dlg.fst.1'), H('dlg.fst.2')],         // the stash taken — the cleaners are in the stairwell
  'flat.street': [H('dlg.fsr.1')],                        // the stairwell clear — the police at the front door
  'flat.heli': [H('dlg.fh.1'), H('dlg.fh.2')],            // on the roofs — the helicopter, their leader
  'flat.order': [K('dlg.fo.1'), H('dlg.fo.2'), K('dlg.fo.3')], // the liquidation order (the level's key moment)
  // ---- D148: Marseille level 3 — the container terminal
  'term.start': [H('dlg.ts.1'), H('dlg.ts.2'), K('dlg.ts.3')],
  'term.alarm': [H('dlg.tal.1')],
  'term.alarmOff': [H('dlg.tal.2')],
  'term.talk': [K('dlg.tt.1'), D('dlg.tt.2'), K('dlg.tt.3'), D('dlg.tt.4'), H('dlg.tt.5')], // [ДОПРОС]
  'term.sniper': [H('dlg.tsn.1')],
  'term.cover': [H('dlg.tc.1')],
  'term.board': [H('dlg.tb.1'), K('dlg.tb.2'), H('dlg.tb.3')], // the gangway down — Lyra's line (the key moment)
  // ---- office · stealth
  'stealth.start': [H('dlg.ss.1'), K('dlg.ss.2'), H('dlg.ss.3'), H('dlg.ss.4'), K('dlg.ss.5')],
  'stealth.keycard': [K('dlg.sk.1'), H('dlg.sk.2')],
  'stealth.copy': [H('dlg.sc.1'), K('dlg.sc.2')],
  // ---- office · survival
  'survival.start': [H('dlg.sv.1'), K('dlg.sv.2')],
  // ---- the training ground (one per lesson that needs words; data/tutorial.js)
  'tut.start': [H('dlg.t.start.1'), K('dlg.t.start.2'), H('dlg.t.start.3')],
  'tut.range': [H('dlg.t.range.1')],
  'tut.switch': [H('dlg.t.switch.1')],
  'tut.rifle': [H('dlg.t.rifle.1')], // D143 (user): after the SMG's six — the M4A1's turn
  'tut.reload': [H('dlg.t.reload.1')],
  'tut.cover': [H('dlg.t.cover.1')],
  'tut.loot': [H('dlg.t.loot.1')],
  'tut.stealth': [H('dlg.t.stealth.1'), K('dlg.t.stealth.2')],
  'tut.spotted': [H('dlg.t.spotted.1')], // (not played anywhere now)
  'tut.grenade': [H('dlg.t.grenade.1')],
  'tut.roll': [H('dlg.t.roll.1'), K('dlg.t.roll.2'), H('dlg.t.roll.3')],
  'tut.ambush': [H('dlg.t.ambush.1'), K('dlg.t.ambush.2'), H('dlg.t.ambush.3')], // (D128: .3 — the wounds heal in cover)
  'tut.wounded': [H('dlg.t.wounded.1')], // D130: badly hurt in the ambush — into cover to heal
  // D93: the phone's variants ('<id>.touch', DialogueView picks it on touch): the lesson's lines + the controls in Lira's
  // words (D129: the phone hears the same lesson lines, then its own)
  'tut.start.touch': [H('dlg.t.start.1'), K('dlg.t.start.2'), H('dlg.t.start.3'), H('dlg.tt.move')],
  'tut.range.touch': [H('dlg.t.range.1'), H('dlg.tt.aim')],
  'tut.switch.touch': [H('dlg.t.switch.1'), H('dlg.tt.switch')],
  'tut.cover.touch': [H('dlg.t.cover.1'), H('dlg.tt.cover'), H('dlg.tt.peek')],
  'tut.stealth.touch': [H('dlg.t.stealth.1'), K('dlg.t.stealth.2'), H('dlg.tt.stealth')],
  'tut.grenade.touch': [H('dlg.t.grenade.1'), H('dlg.tt.grenade')],
  'tut.roll.touch': [H('dlg.t.roll.1'), K('dlg.t.roll.2'), H('dlg.t.roll.3'), H('dlg.tt.roll')],
};

/**
 * Which dialogue a level / mode plays on which event of the run (not the tutorial — its lessons ask for theirs):
 * start (the level began), keycard / drive (picked up), copy (ORPHEUS copied). A list plays its dialogues in order.
 */
export const LEVEL_DIALOGUES = {
  training: { tutorial: { start: ['story.recruit'] } }, // D110: the lessons' own dialogues queue after it
  office: {
    mission: { start: ['story.office', 'office.start'], keycard: 'office.keycard', drive: 'office.drive' },
    stealth: { start: 'stealth.start', keycard: 'stealth.keycard', copy: 'stealth.copy' },
    survival: { start: 'survival.start' },
  },
  // D148: by the run's events (the start, a story item / fact picked up)
  flat: { mission: { start: 'flat.start', stash: 'flat.stash', order: 'flat.order' } },
  terminal: { mission: { start: 'term.start', gangway: 'term.board' } },
};

/** Letters per second of the typed text (fast — the user asked for a quick typewriter). */
export const DIALOGUE_CPS = 55;
