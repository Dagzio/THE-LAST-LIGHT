// D88 (user request): the lessons of the training ground (data/levels/training.js), in order. Each lesson:
//   id      — what completes it (systems/TutorialDirector.js checks it);
//   textKey — the HUD objective ({n} / {of} — its progress), keys — the PC keys shown next to it ('key.*' — a locale
//             key: the mouse button / Space have names per language);
//   dialogue — played when the lesson starts (data/dialogues.js), target — where the objective marker points;
//   need    — how many (hits, kills), weapon — the gun the hits must come from;
//   opens   — the gate unlocked when it is done;
//   hl      — D90 (user: light up the objects themselves, not an area): what is highlighted — a pickup's prop
//             (`unless` — the gun already carried), the range targets, a prop at [x, y], a rect ([x0, y0, x1, y1] or a
//             level field), the living enemies of a tag, the bodies of tags still holding rounds;
//   ui      — D90 (user: show every control as it is needed): the HUD controls lit up (PC: the key on them, touch: the
//             button) — interact, weapon, reload, cover, takedown, crouch, grenade, dash; fire — touch only (the
//             right half of the screen is the trigger, D93);
//   touchKey — D93: the objective's text on a phone (the buttons / the stick / the tap, no PC keys).
export const TUTORIAL = {
  hitsNear: 18,          // units: a round stopped this close to a target is a hit on it
  spottedReset: 2.5,     // s: a stealth-yard guard who saw the hero calms down after this (no alarm in the lessons)
  minHp: 1,              // D89: the hero's HP never drops below this here (the ambush hurts, never kills)
  hintEvery: 2.5,        // s between two "rounds won't do" hints
  steps: [
    { id: 'arm', touchKey: 'tut.tobj.arm', textKey: 'tut.obj.arm', keys: ['E'], dialogue: 'tut.start', target: [395, 1330], need: 2, opens: 'gA',
      hl: [{ pickup: 'chest_smg', unless: 'smg' }, { pickup: 'chest_rifle', unless: 'rifle' }], ui: { interact: 'E' } },
    { id: 'hits', weapon: 'pistol', touchKey: 'tut.tobj.pistol', textKey: 'tut.obj.pistol', keys: ['1', 'key.lmb'], dialogue: 'tut.range', target: [325, 760], need: 3,
      hl: [{ targets: true }], ui: { weapon: '1', fire: 'key.lmb' } },
    { id: 'hits', weapon: 'smg', touchKey: 'tut.tobj.smg', textKey: 'tut.obj.smg', keys: ['2'], dialogue: 'tut.switch', target: [475, 770], need: 5,
      hl: [{ targets: true }], ui: { weapon: '2', fire: 'key.lmb' } },
    { id: 'hits', weapon: 'rifle', touchKey: 'tut.tobj.rifle', textKey: 'tut.obj.rifle', keys: ['3'], target: [535, 760], need: 5,
      hl: [{ targets: true }], ui: { weapon: '3', fire: 'key.lmb' } },
    { id: 'reload', touchKey: 'tut.tobj.reload', textKey: 'tut.obj.reload', keys: ['R'], dialogue: 'tut.reload', ui: { reload: 'R' } },
    { id: 'ammo', touchKey: 'tut.tobj.ammo', textKey: 'tut.obj.ammo', keys: ['E'], target: [560, 990], opens: 'gB', hl: [{ pickup: 'ammo_table' }], ui: { interact: 'E' } },
    { id: 'coverLow', touchKey: 'tut.tobj.coverLow', textKey: 'tut.obj.coverLow', keys: ['Q'], dialogue: 'tut.cover', target: [280, 460], hl: [{ prop: [280, 440] }], ui: { cover: 'Q' } },
    { id: 'kill', tag: 'cover1', touchKey: 'tut.tobj.coverShoot', textKey: 'tut.obj.coverShoot', keys: ['key.lmb'], target: [290, 325], hl: [{ tag: 'cover1' }], ui: { fire: 'key.lmb' } },
    { id: 'kill', tag: 'cover2', touchKey: 'tut.tobj.peek', textKey: 'tut.obj.peek', keys: ['Q', 'key.lmb'], dialogue: 'tut.peek', target: [610, 450],
      hl: [{ rect: [540, 422, 680, 438] }, { tag: 'cover2' }], ui: { cover: 'Q', fire: 'key.lmb' } },
    { id: 'loot', textKey: 'tut.obj.loot', dialogue: 'tut.loot', target: [460, 310], opens: 'gC', hl: [{ bodies: ['cover1', 'cover2'] }] },
    { id: 'takedown', touchKey: 'tut.tobj.stealth', textKey: 'tut.obj.stealth', keys: ['F'], dialogue: 'tut.stealth', target: [1250, 530], opens: 'gD',
      hl: [{ tag: 'stealth' }], ui: { takedown: 'F', crouch: 'C' } },
    { id: 'grenades', touchKey: 'tut.tobj.grenadeTake', textKey: 'tut.obj.grenadeTake', keys: ['E'], dialogue: 'tut.grenade', target: [1800, 490], hl: [{ pickup: 'grenade_chest' }], ui: { interact: 'E' } },
    { id: 'kill', tag: 'grenade', touchKey: 'tut.tobj.grenadeThrow', textKey: 'tut.obj.grenadeThrow', keys: ['G', 'key.lmb'], target: [2120, 300], opens: 'gE', hl: [{ tag: 'grenade' }], ui: { grenade: 'G' } },
    { id: 'roll', touchKey: 'tut.tobj.roll', textKey: 'tut.obj.roll', keys: ['key.space'], dialogue: 'tut.roll', target: [1990, 890], opens: 'gF', hl: [{ rect: [1930, 872, 2050, 908] }, { arrow: [1990, 815, 1990, 965] }], ui: { dash: 'key.space' } },
    { id: 'kill', tag: 'ambush', touchKey: 'tut.tobj.ambush', textKey: 'tut.obj.ambush', dialogue: 'tut.ambush', target: [1990, 1420], opens: 'gG', ambush: true, hl: [{ tag: 'ambush' }], ui: { fire: 'key.lmb' } },
    { id: 'medkit', touchKey: 'tut.tobj.medkit', textKey: 'tut.obj.medkit', keys: ['E'], dialogue: 'tut.medkit', target: [1150, 1330], opens: 'gH', hl: [{ pickup: 'medkit_case' }], ui: { interact: 'E' } },
    { id: 'exit', textKey: 'tut.obj.exit', dialogue: 'tut.end', target: [1200, 1745], hl: [{ rect: 'exit' }] },
  ],};
