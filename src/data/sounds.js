// Recorded sounds (user files in assets/audio/, 2026-11-09). Everything without a file stays synthesized
// (platform/SfxLibrary.js) — a file simply overrides the synth recipe of the same name when it is loaded.
//
// File fields: `file` (path from assets/audio/), `trim` — seconds of silence cut from the start (a shot must sound
// on the frame it is fired), `gain` — level matched to the synthesized set (measured: loudest 50 ms RMS).

export const AUDIO_DIR = 'assets/audio/';
const DIR = AUDIO_DIR;

/** Background music (H5: starts once on entering the main menu; the playlist is shuffled → random every time). */
export const MUSIC_FILES = [`${DIR}bg1.mp3`, `${DIR}bg2.mp3`];

/** One-shot SFX files: name → file. The name is the Sfx name (`click` replaces the synthesized UI tap). */
export const SFX_FILES = {
  click: { file: 'click.mp3', trim: 0.025, gain: 0.75 },
  'pistol.shot': { file: 'pistol/pistol-shot.mp3', trim: 0.028, gain: 1.0 },
  'pistol.reload1': { file: 'pistol/pistol-reload1.mp3', gain: 1.2 },
  'pistol.reload2': { file: 'pistol/pistol-reload2.mp3', gain: 0.8 },
  'pistol.reload3': { file: 'pistol/pistol-reload3.mp3', gain: 1.3 },
  'smg.shot': { file: 'smg/smg-shot.mp3', trim: 0.022, gain: 0.75 },
};

/**
 * Weapon sounds. A weapon without an entry (or without `shot` / `reload`) uses the synthesized fallback below.
 *
 * shot: `sfx` — the Sfx name; `pitch` / `vol` — random ± spread per shot (repeated shots must not sound identical);
 *       `voices` — max overlapping shots: the oldest fades out (fast weapons stay crisp instead of a wash).
 * reload: cues placed on the REAL reload timeline (base duration × upgrades × perks), so the sound always matches the
 *       reload ring and the moment the magazine refills:
 *       `hit` — where the key click is inside the file (s); `at` — where that click lands in the reload
 *       (0 = reload start, 1 = magazine full). A shorter reload (upgrades/perks) plays the cues closer together and up
 *       to `maxRate` faster (pitch stays natural); `refDuration` — the reload length the cues were laid out for.
 */
export const WEAPON_SOUNDS = {
  pistol: {
    shot: { sfx: 'pistol.shot', pitch: 0.04, vol: 0.08, voices: 2 },
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
    shot: { sfx: 'smg.shot', pitch: 0.035, vol: 0.1, voices: 3 },
  },
};

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
