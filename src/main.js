// Game start (imported by boot.js after the preload): wires platform services, the runtime and the UI.
// No globals are created (except window.__game while the dev asset viewer flag is on).
import { DEBUG_ENABLED, DEBUG_MODELS } from './config/constants.js';
import { MUSIC_FILES, SFX_FILES, AUDIO_DIR, ENEMY_KILL_SFX, FOOTSTEPS, footstepsOf, PLAYER_HURT_SFX } from './data/sounds.js';
import { PLAYER } from './data/player.js';
import { STATES } from './core/GameStateMachine.js';
import { WeaponAudio } from './platform/WeaponAudio.js';
import { installBrowserHygiene } from './platform/BrowserHygiene.js';
import { initAudioLifecycle } from './platform/AudioLifecycle.js';
import { initOrientationGuard } from './platform/OrientationGuard.js';
import { Music } from './platform/Music.js';
import { Sfx } from './platform/Sfx.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { HUD } from './ui/HUD.js';
import { DialogueView } from './ui/DialogueView.js';
import { TouchControls } from './ui/TouchControls.js';
import { preloadIcons } from './data/icons.js';
import { initDebugOverlay } from './ui/DebugOverlay.js';

const ENEMY_SHOT_SFX = { enemy_pistol: 'pistol.shot', enemy_rifle: 'assault_rifle.shot', enemy_heavy: 'assault_rifle.shot' };

/** Gameplay facts → sounds. Repeated sounds get a small cosmetic pitch variation. */
function wireCombatSounds(events, game) {
  const throttle = (ms) => { let last = 0; return () => { const now = performance.now(); if (now - last < ms) return false; last = now; return true; }; };
  const killOk = throttle(30), ricOk = throttle(60), enemyShotOk = throttle(45);
  // D82 (user request): no sound on a hit; a kill plays one of the user's three death sounds (never the same twice)
  let lastKillIdx = -1;
  events.on('kill', () => {
    if (!killOk()) return;
    let i = Math.floor(Math.random() * ENEMY_KILL_SFX.length);
    if (i === lastKillIdx) i = (i + 1) % ENEMY_KILL_SFX.length;
    lastKillIdx = i;
    Sfx.play(ENEMY_KILL_SFX[i], 0.96 + Math.random() * 0.08, { voices: 3 });
  });
  // enemy shots: the gun's recorded shot, quieter with distance from the hero
  events.on('enemyShot', (x, y, a, weaponId) => {
    const p = game.run && game.run.player;
    if (!p || !enemyShotOk()) return;
    const d = Math.hypot(x - p.x, y - p.y);
    const gain = Math.max(0.12, Math.min(0.75, 1 - d / 900));
    Sfx.play(ENEMY_SHOT_SFX[weaponId] || 'pistol.shot', 0.9 + Math.random() * 0.12, { gain, voices: 3 });
  });
  // D87 (user request): no synthesized sounds (Sfx plays only files + data/sounds.js SYNTH_KEEP); the roll, the alarm
  // horn, the takedown thud and the re-pitched UI cues (spotted, suspicion, body found, weapon switch, door) are gone
  events.on('mapDefeat', () => Sfx.play('defeat'));
  events.on('mapVictory', () => Sfx.play('victory'));
  events.on('grenadeThrow', () => Sfx.play('throw'));
  events.on('grenadeBlast', () => Sfx.play('boom'));
  events.on('crateOpened', () => Sfx.play('crateOpen'));
  events.on('pickup', () => Sfx.play('levelUp')); // D87: the medkit too — the evidence pickup sound
  events.on('copyDone', () => Sfx.play('levelUp'));
  // D88: rounds taken — the magazine-seated click of the pistol reload (a recorded file); an empty gun — the deny file
  events.on('ammoPickup', () => Sfx.play('pistol.reload2', 1.05, { voices: 1 }));
  events.on('noAmmo', () => Sfx.play('deny', 1, { voices: 1 }));
  events.on('bulletBlocked', () => { if (ricOk()) Sfx.play('ricochet', 0.92 + Math.random() * 0.16, { voices: 2, gain: 0.6 }); });
  events.on('playerHit', () => {
    Sfx.play(PLAYER_HURT_SFX[Math.floor(Math.random() * PLAYER_HURT_SFX.length)], 0.96 + Math.random() * 0.08, { voices: 1 });
  });
  // footsteps: the recorded loop while the hero walks, at his speed; off when he stops, rolls, dies or the game is not running
  // D89: the level picks its recording (data/sounds.js footstepsOf)
  const steps = { h: null, level: null, fs: FOOTSTEPS };
  game.onFrame(() => {
    const run = game.run, p = run && run.player;
    if (run && run.level !== steps.level) { steps.level = run.level; steps.fs = footstepsOf(run.level); if (steps.h) { steps.h.stop(); steps.h = null; } }
    const FS = steps.fs;
    const speed = p ? Math.hypot(p.vx, p.vy) : 0;
    const walking = !!p && game.sm.is(STATES.RUNNING) && p.alive && !p.dodging && speed > FS.minSpeed;
    if (!walking) { if (steps.h) { steps.h.stop(); steps.h = null; } return; }
    // D87: the pace of the legs animation (2 steps per gait cycle) against the recording's own pace
    const hero = game.renderer3d && game.renderer3d.hero;
    const pace = hero && hero.gaitHz > 0 ? (2 * hero.gaitHz) / FS.stepsPerSec : speed / (FS.refSpeed || PLAYER.moveSpeed);
    const rate = Math.min(FS.maxRate, Math.max(FS.minRate, pace));
    if (!steps.h || steps.h.done) steps.h = Sfx.loop(FS.sfx, rate);
    else steps.h.rate(rate);
  });
}

/** Light camera shake for heavy impacts (presentation only, on the game clock). */
function wireCameraShake(game) {
  const ev = game.events;
  const shake = (a, d) => { if (game.renderer3d) game.renderer3d.shake(a, d); };
  ev.on('grenadeBlast', () => shake(7, 0.3));
  ev.on('playerHit', () => shake(2.5, 0.12));
  ev.on('noise', (x, y, r) => { if (game.renderer3d) game.renderer3d.noise(x, y, r); }); // D85 stealth: noise rings
}

/** @param {{loaded: Promise<void>, shownAt: number}} boot */
export function startGame(boot) {
  installBrowserHygiene();
  Music.init(MUSIC_FILES);

  const game = new Game(document.getElementById('world'), document.getElementById('world3d'));
  const ui = new UIManager(game);
  new HUD(game);
  new DialogueView(game); // D88 (before game.start: its keys come before the game's input)
  new TouchControls(game);
  preloadIcons();
  wireCombatSounds(game.events, game);
  const weaponAudio = new WeaponAudio(game.events);
  game.onSimStep = (run, time) => weaponAudio.update(run, time);
  wireCameraShake(game);

  // Hidden tab / lost focus / wrong orientation → real pause (same path as the pause button).
  initAudioLifecycle({ onSuspend: () => ui.autoPause() });
  initOrientationGuard({ onBlock: () => ui.autoPause() });

  if (DEBUG_ENABLED) initDebugOverlay(game); // H5: off in the project (constant false)
  if (DEBUG_MODELS) {
    window.__game = game; // dev asset viewer reads the live renderer through it
    import('./dev/debug-models.js').then((m) => m.initModelViewer()).catch((e) => console.error(e));
  }

  game.start();
  ui.runSplash(boot);
  warmUp(game, ui, boot.warmProgress || (() => {}));
}

/**
 * D77 (kept): what the main menu would otherwise do in its first seconds runs under the splash, on the loading bar —
 * the recorded sounds, the characters / textures, the level preview, the menu scene with one frame-rate window
 * measured on it. Steps that cannot run (no WebGL) are skipped; a stalled step never blocks TAP TO PLAY.
 */
// D82: the last step is the first music track (the menu is a still picture since D81 — no frame-rate window on it)
const WARM = { sounds: 0.25, assets: 0.35, previews: 0.15, music: 0.25, maxSeconds: 30 };
async function warmUp(game, ui, progress) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await Sfx.loadFiles(SFX_FILES, AUDIO_DIR);
    progress(WARM.sounds * 0.4);
    await Sfx.prewarm((k) => progress(WARM.sounds * (0.4 + 0.6 * k)));
    progress(WARM.sounds);
    const r3 = game.renderer3d;
    if (r3) {
      await Promise.race([r3.assetsReady, sleep(WARM.maxSeconds * 1000)]);
      progress(WARM.sounds + WARM.assets);
      await ui._prerenderThumbs((k) => progress(WARM.sounds + WARM.assets + WARM.previews * k));
    }
    progress(WARM.sounds + WARM.assets + WARM.previews);
    await Promise.race([Music.preload(), sleep(8000)]);
  } catch (e) {
    console.error('Warm-up step failed (the game still starts)', e);
  }
  progress(1);
}
