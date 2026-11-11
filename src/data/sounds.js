// Recorded sounds (user files in assets/audio/, 2026-11-09). Everything without a file stays synthesized
// (platform/SfxLibrary.js) — a file simply overrides the synth recipe of the same name when it is loaded.
//
// File fields: `file` (path from assets/audio/), `trim` — seconds of silence cut from the start (a shot must sound
// on the frame it is fired), `gain` — level matched to the synthesized set (measured: loudest 50 ms RMS).

export const AUDIO_DIR = 'assets/audio/';
const DIR = AUDIO_DIR;

/** Background music (H5: starts once on entering the main menu; the playlist is shuffled → random every time). */
export const MUSIC_FILES = [`${DIR}bg1.mp3`, `${DIR}bg2.mp3`];

/**
 * Music bed (2026-11-09): a low bass loop under the music, quieter than it, all the time the music plays (same Music
 * switch, same pause / mute rules). loopStart / loopEnd skip the encoder silence at the file edges (no gap).
 */
export const MUSIC_BED = { file: `${DIR}bg-bass.mp3`, gain: 0.55, loopStart: 0.058, loopEnd: 13.776 };

/**
 * One-shot SFX files: name → file. The name is the Sfx name — a file named like a synth recipe replaces it
 * (`click`, `buy`, `kill`, `flare`, `defeat`, `victory`, `boom`). Gains: measured loudness (loudest 50 ms RMS)
 * matched to the rest of the set; long tails are kept, the voice limits in the callers keep them from piling up.
 */
export const SFX_FILES = {
  click: { file: 'click.mp3', trim: 0.025, gain: 0.75 },
  buy: { file: 'buy.mp3', trim: 0.045, gain: 1.0 },
  shopOpen: { file: 'shop-open.mp3', trim: 0.13, gain: 0.9 },
  flare: { file: 'flash-cast.mp3', trim: 0.1, gain: 1.4 },          // Emergency Flare
  defeat: { file: 'game-over.mp3', trim: 0.07, gain: 1.8 },
  victory: { file: 'game-win.mp3', trim: 0.05, gain: 1.9 },
  boom: { file: 'grenade.mp3', trim: 0.015, gain: 1.2 },            // frag grenade blast
  // D52: the user replaced the hit / kill files — re-measured (punch −23.5 / −22.9 / −25.4 / −33.8 dB)
  enemyHit1: { file: 'enemies/enemy-hit1.mp3', trim: 0.06, gain: 1.25 },
  enemyHit2: { file: 'enemies/enemy-hit2.mp3', trim: 0.08, gain: 1.15 },
  enemyHit3: { file: 'enemies/enemy-hit3.mp3', trim: 0.02, gain: 1.5 },
  kill: { file: 'enemies/enemy-killed1.mp3', trim: 0.03, gain: 3.2 },
  // D52 new files
  ricochet: { file: 'bullet.mp3', trim: 0.04, gain: 2.0 },               // a bullet stopped by a rock / wall / pad
  turretShot: { file: 'turret_shot.mp3', trim: 0.035, gain: 0.55 },     // Guard Turret (frost / poison keep their synth)
  spitterAttack: { file: 'enemies/spitter-attack.mp3', gain: 2.2 },     // Spitter lobs a glob
  'assault_rifle.shot': { file: 'rifle/rifle_shot.mp3', gain: 3.6 },
  'assault_rifle.reload1': { file: 'rifle/rifle_reload1.mp3', trim: 0.015, gain: 2.0 },
  'assault_rifle.reload2': { file: 'rifle/rifle_reload2.mp3', trim: 0.015, gain: 2.5 },
  'assault_rifle.reload3': { file: 'rifle/rifle_reload3.mp3', trim: 0.015, gain: 2.6 },
  waveStart1: { file: 'enemies/wave-start1.mp3', trim: 0.05, gain: 1.0 }, // START NEXT WAVE pressed
  waveStart2: { file: 'enemies/wave-start2.mp3', trim: 0.05, gain: 0.75 }, // the first enemy of the wave is out
  bossKillPlayer: { file: 'enemies/boss-kill-player.mp3', trim: 0.02, gain: 0.6 },
  'pistol.shot': { file: 'pistol/pistol-shot.mp3', trim: 0.044, gain: 1.0 },
  'pistol.reload1': { file: 'pistol/pistol-reload1.mp3', gain: 1.2 },
  'pistol.reload2': { file: 'pistol/pistol-reload2.mp3', gain: 0.8 },
  'pistol.reload3': { file: 'pistol/pistol-reload3.mp3', gain: 1.3 },
  'smg.shot': { file: 'smg/smg-shot.mp3', trim: 0.062, gain: 0.5 },
  'smg.reload1': { file: 'smg/smg-reload1.mp3', gain: 0.8 },
  'smg.reload2': { file: 'smg/smg-reload2.mp3', gain: 0.6 },
  'smg.reload3': { file: 'smg/smg-reload3.mp3', gain: 1.4 },
  'shotgun.shot': { file: 'shotgun/shotgun-shot.mp3', trim: 0.044, gain: 1.0 },
  'shotgun.reload1': { file: 'shotgun/shotgun-reload1.mp3', gain: 0.9 },
  'shotgun.reload2': { file: 'shotgun/shotgun-reload2.mp3', gain: 0.9 },
};

/** Hit on an enemy: one of these at random (never the same twice in a row). */
export const ENEMY_HIT_SFX = ['enemyHit1', 'enemyHit2', 'enemyHit3'];

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
 *       `cut` — the clip fades out when the next cue starts (a long clip that must not run past the reload).
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
    shot: { sfx: 'assault_rifle.shot', pitch: 0.035, vol: 0.08, voices: 3 },
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
  shotgun: {
    shot: { sfx: 'shotgun.shot', pitch: 0.03, vol: 0.06, voices: 2 },
    reload: {
      refDuration: 2.1,
      maxRate: 1.1,
      cues: [
        // shells go in one by one — the clip (3.1 s) is longer than the reload, so it fades out when the pump starts
        { sfx: 'shotgun.reload1', hit: 0.03, at: 0, cut: true },
        { sfx: 'shotgun.reload2', hit: 0.47, at: 1.0 }, // pump forward = ready to fire
      ],
    },
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
