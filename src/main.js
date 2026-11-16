// Game start (imported by boot.js after the preload): wires platform services, the runtime and the UI.
// No globals are created (except window.__game while the dev asset viewer flag is on).
import { DEBUG_ENABLED, DEBUG_MODELS } from './config/constants.js';
import { MUSIC_FILES, MUSIC_BED, SFX_FILES, AUDIO_DIR, ENEMY_HIT_SFX, FOOTSTEPS, PLAYER_HURT_SFX } from './data/sounds.js';
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
import { TouchControls } from './ui/TouchControls.js';
import { preloadIcons } from './data/icons.js';
import { initDebugOverlay } from './ui/DebugOverlay.js';

const ENEMY_SHOT_SFX = { enemy_pistol: 'pistol.shot', enemy_rifle: 'assault_rifle.shot', enemy_heavy: 'assault_rifle.shot' };

/** Gameplay facts → sounds. Repeated sounds get a small cosmetic pitch variation. */
function wireCombatSounds(events, game) {
  const throttle = (ms) => { let last = 0; return () => { const now = performance.now(); if (now - last < ms) return false; last = now; return true; }; };
  const hitOk = throttle(70), killOk = throttle(30), ricOk = throttle(60), enemyShotOk = throttle(45);
  let lastHitIdx = -1;
  events.on('hit', () => {
    if (!hitOk()) return;
    let i = Math.floor(Math.random() * ENEMY_HIT_SFX.length);
    if (i === lastHitIdx) i = (i + 1) % ENEMY_HIT_SFX.length;
    lastHitIdx = i;
    const name = ENEMY_HIT_SFX[i];
    if (Sfx.duration(name) > 0) Sfx.play(name, 0.95 + Math.random() * 0.1, { voices: 1 });
    else Sfx.play('hit', 0.9 + Math.random() * 0.2);
  });
  events.on('kill', () => { if (killOk()) Sfx.play('kill', 0.92 + Math.random() * 0.16, { voices: 3 }); });
  // enemy shots: the gun's recorded shot, quieter with distance from the hero
  events.on('enemyShot', (x, y, a, weaponId) => {
    const p = game.run && game.run.player;
    if (!p || !enemyShotOk()) return;
    const d = Math.hypot(x - p.x, y - p.y);
    const gain = Math.max(0.12, Math.min(0.75, 1 - d / 900));
    Sfx.play(ENEMY_SHOT_SFX[weaponId] || 'pistol.shot', 0.9 + Math.random() * 0.12, { gain, voices: 3 });
  });
  events.on('dash', () => Sfx.play('dash'));
  events.on('mapDefeat', () => Sfx.play('defeat'));
  events.on('mapVictory', () => Sfx.play('victory'));
  events.on('grenadeThrow', () => Sfx.play('throw'));
  events.on('grenadeBlast', () => Sfx.play('boom'));
  events.on('crateOpened', () => Sfx.play('crateOpen'));
  events.on('pickup', (kind) => Sfx.play(kind === 'medkit' ? 'buy' : 'levelUp'));
  events.on('doorUnlocked', () => Sfx.play('buy', 0.8));
  events.on('reinforcements', () => Sfx.play('waveStart')); // synthesized horn: the alarm of the turn
  events.on('spotted', () => Sfx.play('deny', 1.3, { voices: 1 }));
  events.on('weaponSwitch', () => Sfx.play('click', 0.8));
  events.on('bulletBlocked', () => {
    if (!ricOk()) return;
    if (Sfx.duration('ricochet') > 0) Sfx.play('ricochet', 0.92 + Math.random() * 0.16, { voices: 2, gain: 0.6 });
    else Sfx.play('hit', 1.6 + Math.random() * 0.3);
  });
  events.on('playerHit', () => {
    const name = PLAYER_HURT_SFX[Math.floor(Math.random() * PLAYER_HURT_SFX.length)];
    Sfx.play(Sfx.duration(name) > 0 ? name : 'playerHurt', 0.96 + Math.random() * 0.08, { voices: 1 });
  });
  // footsteps: the recorded loop while the hero walks, at his speed; off when he stops, rolls, dies or the game is not running
  const steps = { h: null };
  game.onFrame(() => {
    const run = game.run, p = run && run.player;
    const speed = p ? Math.hypot(p.vx, p.vy) : 0;
    const walking = !!p && game.sm.is(STATES.RUNNING) && p.alive && !p.dodging && speed > FOOTSTEPS.minSpeed;
    if (!walking) { if (steps.h) { steps.h.stop(); steps.h = null; } return; }
    const rate = Math.min(FOOTSTEPS.maxRate, Math.max(FOOTSTEPS.minRate, speed / (FOOTSTEPS.refSpeed || PLAYER.moveSpeed)));
    if (!steps.h || steps.h.done) steps.h = Sfx.loop(FOOTSTEPS.sfx, rate);
    else steps.h.rate(rate);
  });
}

/** Light camera shake for heavy impacts (presentation only, on the game clock). */
function wireCameraShake(game) {
  const ev = game.events;
  const shake = (a, d) => { if (game.renderer3d) game.renderer3d.shake(a, d); };
  ev.on('grenadeBlast', () => shake(7, 0.3));
  ev.on('playerHit', () => shake(2.5, 0.12));
}

/** @param {{loaded: Promise<void>, shownAt: number}} boot */
export function startGame(boot) {
  installBrowserHygiene();
  Music.init(MUSIC_FILES, MUSIC_BED);

  const game = new Game(document.getElementById('world'), document.getElementById('world3d'));
  const ui = new UIManager(game);
  game.menuBusy = () => !!ui.prerendering || Sfx.busy;
  new HUD(game);
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
const WARM = { sounds: 0.25, assets: 0.35, previews: 0.15, menu: 0.25, maxSeconds: 30, tuneSeconds: 4 };
async function warmUp(game, ui, progress) {
  const t0 = performance.now();
  const late = () => (performance.now() - t0) / 1000 > WARM.maxSeconds;
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
      progress(WARM.sounds + WARM.assets + WARM.previews);
      const w0 = r3.adaptWindows || 0, s0 = performance.now();
      while (!late() && (performance.now() - s0) / 1000 < WARM.tuneSeconds && !((r3.adaptWindows || 0) > w0)) {
        const k = Math.min(1, (performance.now() - s0) / 1000 / 2.6);
        progress(WARM.sounds + WARM.assets + WARM.previews + WARM.menu * 0.95 * k);
        await sleep(100);
      }
    }
  } catch (e) {
    console.error('Warm-up step failed (the game still starts)', e);
  }
  progress(1);
}
