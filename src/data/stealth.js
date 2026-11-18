// D85 STEALTH (MODES_DESIGN_D85.md §3): every number of the stealth rules. NEW GAME.docx: visible view cones and
// patrols; walking and cover make no noise (running and shots do); the alert scale calm → suspicion → search → alarm,
// the first two roll back when the hero hides; silent takedowns from behind; the "Ghost" bonus.

export const STEALTH = {
  // the hero
  // units/s. D88 (user: "on PC I could not sneak up on anyone"): the hero SNEAKS (crouched, quiet, low) by default —
  // Shift stands him up and runs (fast, heard, seen), C toggles an upright walk; crouch 40 → 52 (a fast sneak)
  speeds: { walk: 62, run: 95, crouch: 52 },
  runNoise: { radius: 150, every: 0.35 },           // a running hero is heard this far, a ring every 0.35 s
  noise: { roll: 180, takedown: 60, silenced: 140 }, // units
  // detection (per enemy suspicion 0…1; the per-tick rate, §3.4)
  rate: 2.0,                 // /s at full strength (thug: × 0.6 / reaction). D87: 1.6 → 2.0 (harder, user)
  noticeAt: 0.2,             // stops and turns towards the hero
  investigateAt: 0.35,       // walks to the spot (suspicion ≥ this)
  decayAfter: 1.5,           // s without seeing before suspicion falls…
  decay: 0.25,               // …per second
  // an upright moving hero this close is felt at any angle (crouched: never). D87: 46 / 0.5 → 72 / 1.1 — walking up
  // behind a guard turns him round; a takedown needs a crouched approach
  // D88: 72 → 56 (a sneaking hero is never felt; the takedown reach is 56)
  feel: { dist: 56, rate: 1.1 },
  light: { dark: 0.05, lit: 0.25 }, // luminance: below dark — the shadows (range ×0.5), above lit — full range
  stance: { crouch: 0.55, stand: 1 },
  motion: { still: 0.6, walk: 1, run: 1.35, stillBelow: 8, runAbove: 70 },
  peripheral: { from: 0.6, mult: 0.5 },             // beyond 0.6 of the half cone the fill is halved
  busy: { range: 0.6, fov: 0.75 },                  // an enemy going through the files sees less
  investigate: { speedMult: 1.3, fillMult: 1.5, searchTime: 6 },
  search: { duration: 60, rangeMult: 1.15, fillMult: 1.25 }, // the global SEARCH level (a body found, a loud shot)
  hearing: { quiet: 0.5, loud: 0.8 },               // suspicion set by a noise heard
  bodies: { every: 0.3, rangeMult: 0.8, darkMult: 0.5 },
  // D87 (user: "I can just kill everyone"): killing has a price —
  //  - a guard who SEES a takedown / a kill (the victim in his cone, in his light-adjusted range) raises the alarm;
  //  - a body found while the search is already on (a second body) raises the alarm;
  //  - a wounded guard (a silenced round that did not kill) raises the alarm;
  //  - radio check-ins: every `every` s the guards miss one of the dead (dead for ≥ `after` s, not found yet) and the
  //    nearest living guard is sent to his post — the body will be found.
  witness: { every: 0.2, rangeMult: 0.9 },
  secondBodyAlarm: true,
  radio: { every: 35, after: 25 },
  // takedown (from the rear arc, silent)
  // (the clip "Stealth Assassination" — D87 the user's new take, 0…3.0 s — is played over `duration`; the strike at
  // killAt: the clip's 1.9 s → 1.9 / 3.0 × 2.4 ≈ 1.52 s. A guard who sees the struggle raises the alarm (witness))
  // D88: reach 44 → 56, rear arc 140° → 160° (easier to start); the victim is held where he stood (no body push)
  // D93: kickAt / punchAt — clip times (s) of the two blows (the right foot's / hand's speed peak, measured): their sounds
  // D98 (user): the takedown plays 1.7× faster — duration 2.4 → 1.41 s, the kill 1.52 → 0.89 s (the blows' sounds follow
  // the clip time by themselves), the step-in 0.2 → 0.12 s
  takedown: { reach: 56, rearArcDeg: 160, duration: 1.41, killAt: 0.894, snap: 0.12, behind: 24, clipFrom: 0, clipTo: 3.0, kickAt: 0.34, punchAt: 1.9 },
  // D88: a guard who spots the hero (or is wounded, or sees a kill) needs `radio` s to raise the alarm — downed before
  // that, there is no alarm (a red bar over him shows the call)
  spotted: { radio: 2.0 },
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
