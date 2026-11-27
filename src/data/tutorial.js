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
  minHp: 1,              // D89: the hero's HP never drops below this here (the ambush hurts, never kills)
  hintEvery: 2.5,        // s between two "rounds won't do" hints
  // D132 (user: the stealth lesson's failure): the failure screen starts fading in `delay` s after he is spotted (its
  // fade: `fadeIn` s — styles/game.css failPanelIn + .fail-late); the world goes on until the fade is `stopAt` done
  failScreen: { delay: 1.0, fadeIn: 1.95, stopAt: 0.8 },
  fallTime: 2.7,         // D126: s a death clip plays (the longest, 2.63) — a briefing waiting for a fall waits this long
  targetsDown: 1.0,      // D143: s after the last target of a range lesson is hit (its fall + a moment lying) — then the briefing
  steps: [
    { id: 'arm', touchKey: 'tut.tobj.arm', textKey: 'tut.obj.arm', keys: ['E'], dialogue: 'tut.start', target: [395, 1330], need: 2, opens: 'gA',
      hl: [{ pickup: 'chest_smg', unless: 'smg' }, { pickup: 'chest_rifle', unless: 'rifle' }], ui: { interact: 'E' } },
    { id: 'hits', weapon: 'pistol', touchKey: 'tut.tobj.pistol', textKey: 'tut.obj.pistol', keys: ['1', 'key.lmb'], dialogue: 'tut.range', target: [325, 760], need: 3,
      hl: [{ targets: true }], ui: { weapon: '1', fire: 'key.lmb' } }, // D108: the TAP-to-fire hint only here (its first lesson)
    { id: 'hits', weapon: 'smg', touchKey: 'tut.tobj.smg', textKey: 'tut.obj.smg', keys: ['2'], dialogue: 'tut.switch', target: [475, 770], need: 6, // D126 (user): 6 shots for the SMG / rifle
      hl: [{ targets: true }], ui: { weapon: '2' } },
    { id: 'hits', weapon: 'rifle', touchKey: 'tut.tobj.rifle', textKey: 'tut.obj.rifle', keys: ['3'], dialogue: 'tut.rifle', target: [535, 760], need: 6, // D143 (user)
      hl: [{ targets: true }], ui: { weapon: '3' } },
    { id: 'reload', touchKey: 'tut.tobj.reload', textKey: 'tut.obj.reload', keys: ['R'], dialogue: 'tut.reload', ui: { reload: 'R' } },
    { id: 'ammo', touchKey: 'tut.tobj.ammo', textKey: 'tut.obj.ammo', keys: ['E'], target: [560, 990], opens: 'gB', hl: [{ pickup: 'ammo_table' }], ui: { interact: 'E' } },
    { id: 'coverLow', touchKey: 'tut.tobj.coverLow', textKey: 'tut.obj.coverLow', keys: ['Q'], dialogue: 'tut.cover', target: [280, 460], hl: [{ prop: [280, 440] }], ui: { cover: 'Q' } },
    { id: 'kill', tag: 'cover1', touchKey: 'tut.tobj.coverShoot', textKey: 'tut.obj.coverShoot', keys: ['key.lmb'], target: [290, 325], hl: [{ tag: 'cover1' }] },
    { id: 'kill', tag: 'cover2', touchKey: 'tut.tobj.peek', textKey: 'tut.obj.peek', keys: ['Q', 'key.lmb'], target: [610, 450], // D126 (user): no briefing here — the wall's corner is in tut.cover
      hl: [{ rect: [540, 422, 680, 438] }, { tag: 'cover2' }], ui: { cover: 'Q' }, opens: 'gC',
      // D132 (user: collecting the rounds is no lesson any more — the gate opens with the second dummy down): an aside —
      // "well done, take their rounds if you need them" — once his fall has played out (afterDeaths, TUTORIAL.fallTime)
      aside: { dialogue: 'tut.loot', afterDeaths: ['cover2'] } },
    // D116 (user): both guards (they patrol in opposite directions); fully spotted — the lesson fails (its checkpoint)
    { id: 'takedown', touchKey: 'tut.tobj.stealth', textKey: 'tut.obj.stealth', keys: ['F'], dialogue: 'tut.stealth', target: [1250, 540], opens: 'gD', need: 2,
      hl: [{ tag: 'stealth' }], ui: { takedown: 'F' } }, // D107: no crouch button (he sneaks by himself here)
    { id: 'grenades', touchKey: 'tut.tobj.grenadeTake', textKey: 'tut.obj.grenadeTake', keys: ['E'], dialogue: 'tut.grenade', target: [1970, 430], hl: [{ pickup: 'grenade_chest' }], ui: { interact: 'E' } },
    { id: 'kill', tag: 'grenade', touchKey: 'tut.tobj.grenadeThrow', textKey: 'tut.obj.grenadeThrow', keys: ['G', 'key.lmb'], target: [1970, 240], opens: 'gE', hl: [{ tag: 'grenade' }], ui: { grenade: 'G' } },
    // D116 (user): the way to roll runs ALONG the mats (west → east), not across them
    { id: 'roll', touchKey: 'tut.tobj.roll', textKey: 'tut.obj.roll', keys: ['key.space'], dialogue: 'tut.roll', target: [1990, 890], opens: 'gF', hl: [{ rect: [1930, 872, 2050, 908] }, { arrow: [1928, 890, 2052, 890] }], ui: { dash: 'key.space' } },
    // D130 (user: the ambush wounds him first — then he heals in the first cover; no separate "behind the crates" step):
    // 'wounded' — the fight until his health drops to woundAt (or they are all down); 'recover' — "you're badly hurt,
    // get into cover" (the jersey barrier by the gate lit, the cover control), done once the wounds have healed; then the
    // fight goes on; all down — the yard's south gate opens
    { id: 'wounded', tag: 'ambush', woundAt: 0.35, touchKey: 'tut.tobj.ambush', textKey: 'tut.obj.ambush', dialogue: 'tut.ambush', target: [1990, 1420], ambush: true, hl: [{ tag: 'ambush' }] },
    { id: 'recover', touchKey: 'tut.tobj.recover', textKey: 'tut.obj.recover', keys: ['Q'], dialogue: 'tut.wounded', target: [1990, 1320], hl: [{ prop: [1990, 1320] }], ui: { cover: 'Q' } },
    { id: 'kill', tag: 'ambush', touchKey: 'tut.tobj.ambush', textKey: 'tut.obj.ambush', target: [1990, 1420], opens: 'gG', hl: [{ tag: 'ambush' }] },
    { id: 'exit', textKey: 'tut.obj.exit', target: [1990, 1745], hl: [{ rect: 'exit' }] },
  ],
  // D116 (user): where a failed lesson starts again (systems/TutorialDirector.js applyCheckpoint): its step, the hero's
  // spot [x, y, facing], the guns he carries by then, the enemies of the yards behind him (gone), pickups already taken
  checkpoints: {
    stealth: { step: 'takedown', at: [850, 340, 0], weapons: ['smg', 'rifle'], clear: ['cover1', 'cover2'], taken: [] },
  },
};
