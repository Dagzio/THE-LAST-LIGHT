// D85 STEALTH (MODES_DESIGN_D85.md §3): every number of the stealth rules. NEW GAME.docx: visible view cones and
// patrols; walking and cover make no noise (running and shots do); the alert scale calm → suspicion → search → alarm,
// the first two roll back when the hero hides; silent takedowns from behind; the "Ghost" bonus.

export const STEALTH = {
  // the hero
  speeds: { walk: 62, run: 95, crouch: 40 },        // units/s (walk is the default; Shift — run; C — crouch)
  runNoise: { radius: 150, every: 0.35 },           // a running hero is heard this far, a ring every 0.35 s
  noise: { roll: 180, takedown: 60, silenced: 140 }, // units
  // detection (per enemy suspicion 0…1; the per-tick rate, §3.4)
  rate: 1.6,                 // /s at full strength (thug: × 0.6 / reaction)
  noticeAt: 0.2,             // stops and turns towards the hero
  investigateAt: 0.35,       // walks to the spot (suspicion ≥ this)
  decayAfter: 1.5,           // s without seeing before suspicion falls…
  decay: 0.25,               // …per second
  feel: { dist: 46, rate: 0.5 }, // an upright moving hero this close is felt at any angle (crouched: never)
  light: { dark: 0.05, lit: 0.25 }, // luminance: below dark — the shadows (range ×0.5), above lit — full range
  stance: { crouch: 0.55, stand: 1 },
  motion: { still: 0.6, walk: 1, run: 1.35, stillBelow: 8, runAbove: 70 },
  peripheral: { from: 0.6, mult: 0.5 },             // beyond 0.6 of the half cone the fill is halved
  busy: { range: 0.6, fov: 0.75 },                  // an enemy going through the files sees less
  investigate: { speedMult: 1.3, fillMult: 1.5, searchTime: 6 },
  search: { duration: 60, rangeMult: 1.15, fillMult: 1.25 }, // the global SEARCH level (a body found, a loud shot)
  hearing: { quiet: 0.5, loud: 0.8 },               // suspicion set by a noise heard
  bodies: { every: 0.3, rangeMult: 0.8, darkMult: 0.5 },
  // takedown (from the rear arc, silent)
  // (the clip "Stealth Assassination" 0.5…3.6 s of the trimmed take is played over `duration`; the strike at killAt)
  takedown: { reach: 44, rearArcDeg: 140, duration: 2.0, killAt: 0.9, snap: 0.15, behind: 24, clipFrom: 0.5, clipTo: 3.6 },
  // the copy at the server terminal
  copy: { hold: 6, reach: 46 },
  // D85 (user: "complete it unseen"): the alarm fails the job (one flag: 'combat' — it goes on as a firefight)
  onAlarm: 'fail',
  failDelay: 1.5,
  medals: { parTime: 420 },
};

/** Alert levels (HUD scale). */
export const ALERT = Object.freeze({ CALM: 0, SUSPICION: 1, SEARCH: 2, ALARM: 3 });
export const ALERT_KEYS = ['alert.calm', 'alert.suspicious', 'alert.search', 'alert.alarm'];
