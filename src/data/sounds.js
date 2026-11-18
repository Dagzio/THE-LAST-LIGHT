// Recorded sounds (user files in assets/audio/, 2026-11-09). Everything without a file stays synthesized
// (platform/SfxLibrary.js) — a file simply overrides the synth recipe of the same name when it is loaded.
//
// File fields: `file` (path from assets/audio/), `trim` — seconds of silence cut from the start (a shot must sound
// on the frame it is fired), `gain` — 1 for every file (user decision 2026-11-11: the user sets the volume in the files
// themselves — the game plays them at exactly that level, no own boost / cut).

export const AUDIO_DIR = 'assets/audio/';
const DIR = AUDIO_DIR;

/**
 * D87 (user request): no synthesized sounds in the game any more — only recorded files play, except these recipes:
 * the grenade toss and the evidence pickup (key card, drive, intel, the copy — and the medkit since D87). A sound
 * without a loaded file and not listed here stays silent (victory and the crates are files).
 */
export const SYNTH_KEEP = ['throw', 'levelUp'];

/**
 * Background music (H5: starts once on entering the main menu and never stops — menus, levels, results; the playlist
 * is shuffled → a random track first, then the other, never the same twice in a row). D82: only the user's two tracks
 * (the old bass bed under them is gone); the first track is decoded under the splash, so the menu opens with music.
 */
export const MUSIC_FILES = [`${DIR}bg1.mp3`, `${DIR}bg2.mp3`];

/**
 * One-shot SFX files: name → file. The name is the Sfx name — a file named like a synth recipe replaces it
 * (`click`, `buy`, `kill`, `flare`, `defeat`, `victory`, `boom`). Played at the file's own level (gain 1); long tails are
 * kept, the voice limits in the callers keep them from piling up.
 */
export const SFX_FILES = {
  click: { file: 'click.mp3', trim: 0.025, gain: 1 },
  buy: { file: 'buy.mp3', trim: 0.045, gain: 1 },
  defeat: { file: 'game-over.mp3', trim: 0.07, gain: 1 },
  victory: { file: 'game-win.mp3', trim: 0.05, gain: 1 },
  boom: { file: 'grenade.mp3', trim: 0.015, gain: 1 },            // frag grenade blast
  // D82 (user files): three enemy deaths — played on the kill only (a hit on an enemy makes no sound of its own)
  kill1: { file: 'enemies/enemy-killed1.mp3', trim: 0.05, gain: 1 },  // onsets measured: 0.061 / 0.063 / 0.032 s
  kill2: { file: 'enemies/enemy-killed2.mp3', trim: 0.05, gain: 1 },
  kill3: { file: 'enemies/enemy-killed3.mp3', trim: 0.02, gain: 1 },
  // D52 new files
  ricochet: { file: 'bullet.mp3', trim: 0.04, gain: 1 },               // a bullet stopped by a rock / wall / pad
  radio: { file: 'radio.mp3', gain: 1 },                               // D88 (user file): a dialogue opens
  // keeper (user files, player/): D56 footsteps — one whole walking loop (FOOTSTEPS below); hurt — 2 takes (D53)
  steps: { file: 'player/steps.mp3', gain: 1 },
  steps1: { file: 'player/steps1.mp3', gain: 1 },                     // D89 (user file): the training ground's steps
  steps3: { file: 'player/steps3.mp3', gain: 1 },                     // D93 (user file): steps on the office carpet
  // D93 (user files): the takedown's blows — the kick, then the hand (StealthDirector `takedownBlow`); the leading
  // silence trimmed so the hit sounds on the clip's contact frame
  legPunch: { file: 'player/leg-punch.mp3', trim: 0.12, gain: 1 },
  handPunch: { file: 'player/hand-punch.mp3', trim: 0.11, gain: 1 },
  playerHurt1: { file: 'player/player-hitted1.mp3', gain: 1 },
  playerHurt2: { file: 'player/player-hitted2.mp3', trim: 0.025, gain: 1 },
  // D53 replacements of synthesized sounds: CC0 packs (sfx/CREDITS.txt), mixed / levelled into the file (gain 1)
  deny: { file: 'sfx/deny.mp3', gain: 1 },
  stamp: { file: 'sfx/stamp.mp3', gain: 1 },             // results journal stamp
  crateOpen: { file: 'sfx/crate-open.mp3', trim: 0.06, gain: 1 }, // D56 user file: the crate is opened
  'assault_rifle.shot': { file: 'rifle/rifle_shot.mp3', gain: 1 },
  'assault_rifle.reload1': { file: 'rifle/rifle_reload1.mp3', trim: 0.015, gain: 1 },
  'assault_rifle.reload2': { file: 'rifle/rifle_reload2.mp3', trim: 0.015, gain: 1 },
  'assault_rifle.reload3': { file: 'rifle/rifle_reload3.mp3', trim: 0.015, gain: 1 },
  'pistol.shot': { file: 'pistol/pistol-shot.mp3', trim: 0.044, gain: 1 },
  'pistol.reload1': { file: 'pistol/pistol-reload1.mp3', gain: 1 },
  'pistol.reload2': { file: 'pistol/pistol-reload2.mp3', gain: 1 },
  'pistol.reload3': { file: 'pistol/pistol-reload3.mp3', gain: 1 },
  'smg.shot': { file: 'smg/smg-shot.mp3', trim: 0.062, gain: 1 },
  'smg.reload1': { file: 'smg/smg-reload1.mp3', gain: 1 },
  'smg.reload2': { file: 'smg/smg-reload2.mp3', gain: 1 },
  'smg.reload3': { file: 'smg/smg-reload3.mp3', gain: 1 },
};

/**
 * Keeper footsteps (D56, user decision): the whole `steps` file loops only while he walks and stops at once when he
 * stops (or dashes, dies, the game pauses). Playback speed follows his speed: rate = speed / base speed (upgrades,
 * perks, salt pools), clamped to minRate…maxRate. D59: rate = speed / refSpeed — the recording's tempo fits a walk at
 * 112 (the D56 speed), so the slower keeper (95) steps slower too.
 */
// D87 (user request: the steps follow the animation): rate = steps per second of the hero's legs clips (2 per gait
// cycle, renderer) / the recording's own pace (stepsPerSec: onsets measured every 0.505 s); refSpeed — the fallback
export const FOOTSTEPS = { sfx: 'steps', minSpeed: 8, minRate: 0.5, maxRate: 2.0, refSpeed: 112, stepsPerSec: 1.98 };
/** D89 (user request): a level's own steps recording (level.footsteps) — the training ground (outdoor ground) uses
 * steps1, the office keeps `steps`. stepsPerSec — that recording's own pace. */
// steps1: 4.15 s, 8 steps (onsets measured in the browser, D89) → 1.93 per second
// D90 (user: the steps follow his speed): its steps are uneven (0.3–0.8 s apart) — looped, they never matched the
// legs. So each foot put down by the animation (render3d/humans.js footfalls) plays ONE step cut from the recording:
// slices [start, length] (s) measured on its loudness (browser decode), one at random, never the same twice.
// D93 (user: every sound in exact step): every recording is cut into steps — each foot put down by the animation plays
// one slice [start, length] (s, measured on the loudness in the browser), at random, never the same twice in a row.
// The recording follows the floor under him: the office's hard floors `steps`, its carpets (the open-plan carpet, the
// rugs) `steps3`, the training ground `steps1`. The volume follows his stance (FOOTSTEP_GAIN).
export const STEP_SETS = {
  hard: { sfx: 'steps', gain: 1, slices: [[0.05, 0.42], [0.57, 0.42], [1.08, 0.42], [1.58, 0.42], [2.11, 0.42], [2.58, 0.42], [3.09, 0.3]] },
  // D97 (user: the carpet steps were barely heard): its recording peaks 3.5× lower than `steps` (0.027 vs 0.094,
  // measured) — levelled to the hard floor's
  carpet: { sfx: 'steps3', gain: 3.5, slices: [[0.06, 0.32], [0.55, 0.3], [0.86, 0.3], [1.17, 0.32], [1.58, 0.34]] },
  outdoor: { sfx: 'steps1', gain: 0.9, slices: [[0.09, 0.4], [0.58, 0.4], [1.38, 0.32], [2.02, 0.4], [2.6, 0.42], [3.26, 0.42], [3.78, 0.36]] },
};
/** The floors (data/levels zones `floor`) that sound like carpet; rugs (props) too. */
export const CARPET_FLOORS = new Set(['carpet']);
export const CARPET_PROPS = new Set(['rug_large', 'rug_small']);
/** D93 (user): crouched (or in cover) — quiet; walking upright in stealth — softer; running / the normal pace — full. */
export const FOOTSTEP_GAIN = { crouch: 0.42, walk: 0.72, run: 1 };
/** The keeper is hurt (D53): one of the user's two takes at random (synth 'playerHurt' while they load). */
export const PLAYER_HURT_SFX = ['playerHurt1', 'playerHurt2'];

/** D82: an enemy killed — one of these at random (never the same twice in a row). */
export const ENEMY_KILL_SFX = ['kill1', 'kill2', 'kill3'];

/**
 * Weapon sounds. A weapon without an entry (or without `shot` / `reload`) uses the synthesized fallback below.
 *
 * shot: `sfx` — the Sfx name; `pitch` — random ± pitch spread per shot (repeated shots must not sound identical);
 *       `vol` — random volume dip per shot (0 since D52: the file level as is);
 *       `voices` — max overlapping shots: the oldest fades out (fast weapons stay crisp instead of a wash).
 * reload: cues placed on the REAL reload timeline (base duration × upgrades × perks), so the sound always matches the
 *       reload ring and the moment the magazine refills:
 *       `hit` — where the key click is inside the file (s); `at` — where that click lands in the reload
 *       (0 = reload start, 1 = magazine full). A shorter reload (upgrades/perks) plays the cues closer together and up
 *       to `maxRate` faster (pitch stays natural); `refDuration` — the reload length the cues were laid out for.
 *       `cut` — the clip fades out when the next cue starts (a long clip that must not run past the reload).
 */
export const WEAPON_SOUNDS = {
  pistol: {
    shot: { sfx: 'pistol.shot', pitch: 0.04, vol: 0, voices: 2 },
    reload: {
      refDuration: 1.25,
      maxRate: 1.12,
      cues: [
        { sfx: 'pistol.reload1', hit: 0.42, at: 0.28 }, // magazine released
        { sfx: 'pistol.reload2', hit: 0.20, at: 0.62 }, // new magazine seated
        { sfx: 'pistol.reload3', hit: 0.38, at: 1.0 },  // slide released = ready to fire
      ],
    },
  },
  smg: {
    shot: { sfx: 'smg.shot', pitch: 0.035, vol: 0, voices: 3 },
    reload: {
      refDuration: 1.8,
      maxRate: 1.12,
      cues: [
        { sfx: 'smg.reload1', hit: 0.29, at: 0.22 }, // magazine out
        { sfx: 'smg.reload2', hit: 0.36, at: 0.62 }, // new magazine in
        { sfx: 'smg.reload3', hit: 0.04, at: 1.0 },  // bolt released = ready
      ],
    },
  },
  // D52: assault rifle files (rifle/ folder): shot + three reload cues — magazine out, magazine in, bolt = ready
  assault_rifle: {
    shot: { sfx: 'assault_rifle.shot', pitch: 0.035, vol: 0, voices: 3 },
    reload: {
      refDuration: 1.65,
      maxRate: 1.12,
      cues: [
        { sfx: 'assault_rifle.reload1', hit: 0.01, at: 0.2 },  // magazine out
        { sfx: 'assault_rifle.reload2', hit: 0.15, at: 0.62 }, // new magazine in
        { sfx: 'assault_rifle.reload3', hit: 0.01, at: 1.0 },  // bolt released = ready to fire
      ],
    },
  },
};

// D88: the hero's M4A1 — the assault rifle files
WEAPON_SOUNDS.rifle = WEAPON_SOUNDS.assault_rifle;

// D85: the silenced pistol — the pistol's own shot, higher and much quieter (a "pfft"), the same reload
WEAPON_SOUNDS.pistol_sd = { shot: { sfx: 'pistol.shot', pitch: 0.04, vol: 0, voices: 2, rate: 1.55, gain: 0.32 }, reload: WEAPON_SOUNDS.pistol.reload };

/** Fallback for weapons without own files (user decision 2026-11-09: synthesized, as before). */
export const DEFAULT_WEAPON_SOUNDS = {
  shot: { sfx: 'shot', pitch: 0.08, vol: 0, voices: 3 },
  reload: {
    refDuration: 0, // never sped up
    maxRate: 1,
    cues: [
      { sfx: 'reload', hit: 0, at: 0 },    // magazine out (two clicks)
      { sfx: 'reloadEnd', hit: 0, at: 1 }, // slide racked — exactly when the magazine is full
    ],
  },
};

export function weaponSounds(weaponId) {
  const w = WEAPON_SOUNDS[weaponId] || {};
  return { shot: w.shot || DEFAULT_WEAPON_SOUNDS.shot, reload: w.reload || DEFAULT_WEAPON_SOUNDS.reload };
}
