// D88 (user request): the dialogues — short exchanges over the radio between the handler and the hero during a job:
// the handler tells, the hero confirms or asks, the handler answers. Art: NEW/dialogue (the frame, two portraits →
// assets/ui/dialogue by tools/build-training-assets.py). Every line is a locale key (src/i18n/locales.js, all 10
// languages). A dialogue plays once per run; the game waits while it is open (ui/DialogueView.js).

/** The speakers: name (locale key), portrait, the side the portrait stands on. */
export const SPEAKERS = {
  handler: { nameKey: 'dlg.name.handler', portrait: 'assets/ui/dialogue/handler.webp', side: 'left' },
  hero: { nameKey: 'dlg.name.hero', portrait: 'assets/ui/dialogue/hero.webp', side: 'right' },
};

const H = (key) => ['handler', key], K = (key) => ['hero', key];

/** id → lines [speaker, locale key]. */
export const DIALOGUES = {
  // ---- office · mission
  'office.start': [H('dlg.os.1'), K('dlg.os.2'), H('dlg.os.3'), K('dlg.os.4'), H('dlg.os.5'), K('dlg.os.6')], // D92: + the SMG / medkits
  'office.keycard': [K('dlg.ok.1'), H('dlg.ok.2')],
  'office.drive': [H('dlg.od.1'), K('dlg.od.2'), H('dlg.od.3')],
  // ---- office · stealth
  'stealth.start': [H('dlg.ss.1'), K('dlg.ss.2'), H('dlg.ss.3'), K('dlg.ss.4'), H('dlg.ss.5')],
  'stealth.keycard': [K('dlg.sk.1'), H('dlg.sk.2')],
  'stealth.copy': [H('dlg.sc.1'), K('dlg.sc.2')],
  // ---- office · survival
  'survival.start': [H('dlg.sv.1'), K('dlg.sv.2'), H('dlg.sv.3'), K('dlg.sv.4')],
  // ---- the training ground (one per lesson that needs words; data/tutorial.js)
  'tut.start': [H('dlg.t.start.1'), K('dlg.t.start.2'), H('dlg.t.start.3')],
  'tut.range': [H('dlg.t.range.1'), K('dlg.t.range.2'), H('dlg.t.range.3')],
  'tut.switch': [H('dlg.t.switch.1')],
  'tut.reload': [H('dlg.t.reload.1'), K('dlg.t.reload.2'), H('dlg.t.reload.3')],
  'tut.cover': [H('dlg.t.cover.1'), K('dlg.t.cover.2'), H('dlg.t.cover.3')],
  'tut.peek': [H('dlg.t.peek.1')],
  'tut.loot': [H('dlg.t.loot.1')],
  'tut.stealth': [H('dlg.t.stealth.1'), K('dlg.t.stealth.2'), H('dlg.t.stealth.3')],
  'tut.spotted': [H('dlg.t.spotted.1')],
  'tut.grenade': [H('dlg.t.grenade.1')],
  'tut.roll': [H('dlg.t.roll.1'), K('dlg.t.roll.2'), H('dlg.t.roll.3')],
  'tut.ambush': [H('dlg.t.ambush.1'), K('dlg.t.ambush.2'), H('dlg.t.ambush.3')],
  'tut.medkit': [H('dlg.t.medkit.1')],
  'tut.end': [H('dlg.t.end.1'), K('dlg.t.end.2')],
  // D93: the phone's variants ('<id>.touch', DialogueView picks it on touch): the controls explained in Lira's words
  'tut.start.touch': [H('dlg.t.start.1'), K('dlg.t.start.2'), H('dlg.t.start.3'), H('dlg.tt.move')],
  'tut.range.touch': [H('dlg.t.range.1'), K('dlg.t.range.2'), H('dlg.t.range.3'), H('dlg.tt.aim')],
  'tut.switch.touch': [H('dlg.tt.switch')],
  'tut.cover.touch': [H('dlg.t.cover.1'), K('dlg.t.cover.2'), H('dlg.t.cover.3'), H('dlg.tt.cover')],
  'tut.peek.touch': [H('dlg.tt.peek')],
  'tut.stealth.touch': [H('dlg.t.stealth.1'), K('dlg.t.stealth.2'), H('dlg.t.stealth.3'), H('dlg.tt.stealth')],
  'tut.grenade.touch': [H('dlg.t.grenade.1'), H('dlg.tt.grenade')],
  'tut.roll.touch': [H('dlg.t.roll.1'), K('dlg.t.roll.2'), H('dlg.t.roll.3'), H('dlg.tt.roll')],
};

/**
 * Which dialogue a level / mode plays on which event of the run (not the tutorial — its lessons ask for theirs):
 * start (the level began), keycard / drive (picked up), copy (ORPHEUS copied).
 */
export const LEVEL_DIALOGUES = {
  office: {
    mission: { start: 'office.start', keycard: 'office.keycard', drive: 'office.drive' },
    stealth: { start: 'stealth.start', keycard: 'stealth.keycard', copy: 'stealth.copy' },
    survival: { start: 'survival.start' },
  },
};

/** Letters per second of the typed text (fast — the user asked for a quick typewriter). */
export const DIALOGUE_CPS = 55;
