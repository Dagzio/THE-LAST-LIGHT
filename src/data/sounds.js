// Recorded sounds (user files in assets/audio/, 2026-11-09). Everything without a file stays synthesized
// (platform/SfxLibrary.js) — a file simply overrides the synth recipe of the same name when it is loaded.
//
// File fields: `file` (path from assets/audio/), `trim` — seconds of silence cut from the start (a shot must sound
// on the frame it is fired), `gain` — 1 for every file (user decision 2026-11-11: the user sets the volume in the files
// themselves — the game plays them at exactly that level, no own boost / cut).

export const AUDIO_DIR = 'assets/audio/';
const DIR = AUDIO_DIR;

/** Background music (H5: starts once on entering the main menu; the playlist is shuffled → random every time). */
export const MUSIC_FILES = [`${DIR}bg1.mp3`, `${DIR}bg2.mp3`];

/**
 * Music bed (2026-11-09): a low bass loop under the music (its level is set in the file itself), all the time the music plays (same Music
 * switch, same pause / mute rules). loopStart / loopEnd skip the encoder silence at the file edges (no gap).
 */
export const MUSIC_BED = { file: `${DIR}bg-bass.mp3`, gain: 1, loopStart: 0.058, loopEnd: 13.776 };

/**
 * One-shot SFX files: name → file. The name is the Sfx name — a file named like a synth recipe replaces it
 * (`click`, `buy`, `kill`, `flare`, `defeat`, `victory`, `boom`). Played at the file's own level (gain 1); long tails are
 * kept, the voice limits in the callers keep them from piling up.
 */
export const SFX_FILES = {
  click: { file: 'click.mp3', trim: 0.025, gain: 1 },
  buy: { file: 'buy.mp3', trim: 0.045, gain: 1 },
  shopOpen: { file: 'shop-open.mp3', trim: 0.13, gain: 1 },
  flare: { file: 'flash-cast.mp3', trim: 0.1, gain: 1 },          // Emergency Flare
  defeat: { file: 'game-over.mp3', trim: 0.07, gain: 1 },
  victory: { file: 'game-win.mp3', trim: 0.05, gain: 1 },
  boom: { file: 'grenade.mp3', trim: 0.015, gain: 1 },            // frag grenade blast
  // D52: the user replaced the hit / kill files — re-measured (punch −23.5 / −22.9 / −25.4 / −33.8 dB)
  enemyHit1: { file: 'enemies/enemy-hit1.mp3', trim: 0.06, gain: 1 },
  enemyHit2: { file: 'enemies/enemy-hit2.mp3', trim: 0.08, gain: 1 },
  enemyHit3: { file: 'enemies/enemy-hit3.mp3', trim: 0.02, gain: 1 },
  kill: { file: 'enemies/enemy-killed1.mp3', trim: 0.03, gain: 1 },
  // D52 new files
  ricochet: { file: 'bullet.mp3', trim: 0.04, gain: 1 },               // a bullet stopped by a rock / wall / pad
  turretShot: { file: 'turret/turret_shot.mp3', trim: 0.035, gain: 1 },  // every turret (D53: one sound for all)
  turretHit: { file: 'turret/turret_hitted.mp3', trim: 0.02, gain: 1 },    // a device takes damage (D52 health)
  turretBroken: { file: 'turret/turret_killed.mp3', trim: 0.05, gain: 1 }, // a device breaks (0 HP)
  // keeper (user files, player/): D56 footsteps — one whole walking loop (FOOTSTEPS below); hurt — 2 takes (D53)
  steps: { file: 'player/steps.mp3', gain: 1 },
  playerHurt1: { file: 'player/player-hitted1.mp3', gain: 1 },
  playerHurt2: { file: 'player/player-hitted2.mp3', trim: 0.025, gain: 1 },
  // D53 replacements of synthesized sounds: CC0 packs (sfx/CREDITS.txt), mixed / levelled into the file (gain 1)
  beaconHit: { file: 'sfx/beacon-hit.mp3', gain: 1 }, // D57: the user's request — the recorded beacon hit is back
  freeze: { file: 'sfx/cryo-blast.mp3', gain: 1 },       // Cryo grenade
  fire: { file: 'sfx/molotov.mp3', gain: 1 },            // Molotov: bottle breaks + flames
  molotovFire: { file: 'grenades/molotov.mp3', trim: 0.2, gain: 1 }, // D62 user file: the fire crackle while it burns
  bossWarn: { file: 'sfx/boss-warn.mp3', gain: 1 },      // a boss telegraphs an attack (roar)
  bossSlam: { file: 'sfx/boss-slam.mp3', gain: 1 },
  bossTide: { file: 'sfx/boss-tide.mp3', gain: 1 },
  flareReady: { file: 'sfx/flare-ready.mp3', gain: 1 },
  deny: { file: 'sfx/deny.mp3', gain: 1 },
  stamp: { file: 'sfx/stamp.mp3', gain: 1 },             // results journal stamp
  crateOpen: { file: 'sfx/crate-open.mp3', trim: 0.06, gain: 1 }, // D56 user file: the crate is opened
  spitterAttack: { file: 'enemies/spitter-attack.mp3', gain: 1 },     // Spitter lobs a glob
  'assault_rifle.shot': { file: 'rifle/rifle_shot.mp3', gain: 1 },
  'assault_rifle.reload1': { file: 'rifle/rifle_reload1.mp3', trim: 0.015, gain: 1 },
  'assault_rifle.reload2': { file: 'rifle/rifle_reload2.mp3', trim: 0.015, gain: 1 },
  'assault_rifle.reload3': { file: 'rifle/rifle_reload3.mp3', trim: 0.015, gain: 1 },
  waveStart1: { file: 'enemies/wave-start1.mp3', trim: 0.05, gain: 1 }, // START NEXT WAVE pressed
  waveStart2: { file: 'enemies/wave-start2.mp3', trim: 0.05, gain: 1 }, // the first enemy of the wave is out
  bossKillPlayer: { file: 'enemies/boss-kill-player.mp3', trim: 0.02, gain: 1 },
  'pistol.shot': { file: 'pistol/pistol-shot.mp3', trim: 0.044, gain: 1 },
  'pistol.reload1': { file: 'pistol/pistol-reload1.mp3', gain: 1 },
  'pistol.reload2': { file: 'pistol/pistol-reload2.mp3', gain: 1 },
  'pistol.reload3': { file: 'pistol/pistol-reload3.mp3', gain: 1 },
  'smg.shot': { file: 'smg/smg-shot.mp3', trim: 0.062, gain: 1 },
  'smg.reload1': { file: 'smg/smg-reload1.mp3', gain: 1 },
  'smg.reload2': { file: 'smg/smg-reload2.mp3', gain: 1 },
  'smg.reload3': { file: 'smg/smg-reload3.mp3', gain: 1 },
  'shotgun.shot': { file: 'shotgun/shotgun-shot.mp3', trim: 0.044, gain: 1 },
  'shotgun.reload1': { file: 'shotgun/shotgun-reload1.mp3', gain: 1 },
  'shotgun.reload2': { file: 'shotgun/shotgun-reload2.mp3', gain: 1 },
};

/**
 * Keeper footsteps (D56, user decision): the whole `steps` file loops only while he walks and stops at once when he
 * stops (or dashes, dies, the game pauses). Playback speed follows his speed: rate = speed / base speed (upgrades,
 * perks, salt pools), clamped to minRate…maxRate. D59: rate = speed / refSpeed — the recording's tempo fits a walk at
 * 112 (the D56 speed), so the slower keeper (95) steps slower too.
 */
export const FOOTSTEPS = { sfx: 'steps', minSpeed: 8, minRate: 0.6, maxRate: 1.6, refSpeed: 112 };
/** The keeper is hurt (D53): one of the user's two takes at random (synth 'playerHurt' while they load). */
export const PLAYER_HURT_SFX = ['playerHurt1', 'playerHurt2'];

/** Hit on an enemy: one of these at random (never the same twice in a row). */
export const ENEMY_HIT_SFX = ['enemyHit1', 'enemyHit2', 'enemyHit3'];

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
  shotgun: {
    shot: { sfx: 'shotgun.shot', pitch: 0.03, vol: 0, voices: 2 },
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
