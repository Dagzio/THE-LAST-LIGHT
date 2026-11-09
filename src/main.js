// Game start (imported by boot.js after the preload): wires platform services, the runtime and the UI.
// No globals are created (except window.__game while the dev asset viewer flag is on).
import { DEBUG_ENABLED, DEBUG_MODELS } from './config/constants.js';
import { MUSIC_FILES, SFX_FILES, AUDIO_DIR } from './data/sounds.js';
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
import { OffscreenIndicators } from './ui/OffscreenIndicators.js';
import { initDebugOverlay } from './ui/DebugOverlay.js';

/** Gameplay facts → sounds. Repeated shots get a small cosmetic pitch variation (GDD §18). */
function wireCombatSounds(events) {
  let lastHitSoundAt = 0;
  // Shots and reloads: platform/WeaponAudio.js (recorded files + reload cues on the sim clock)
  events.on('hit', () => {
    const now = performance.now();
    if (now - lastHitSoundAt < 40) return; // avoid sound mush on multi-pellet hits
    lastHitSoundAt = now;
    Sfx.play('hit', 0.9 + Math.random() * 0.2);
  });
  events.on('kill', () => Sfx.play('kill', 0.9 + Math.random() * 0.2));
  events.on('dash', () => Sfx.play('dash'));
  events.on('beaconHit', () => Sfx.play('beaconHit', 0.9 + Math.random() * 0.2));
  events.on('turretShot', () => Sfx.play('turretShot', 0.92 + Math.random() * 0.16));
  events.on('frostPulse', () => Sfx.play('frostPulse'));
  events.on('mapDefeat', () => Sfx.play('defeat'));
  events.on('mapVictory', () => Sfx.play('victory'));
  events.on('flare', () => Sfx.play('flare'));
  events.on('flareReady', () => Sfx.play('flareReady'));
  events.on('levelUp', () => Sfx.play('levelUp'));
  events.on('coinReward', (a, reason) => { if (reason === 'earlyStart') Sfx.play('buy'); });
  events.on('grenadeThrow', () => Sfx.play('throw'));
  events.on('grenadeBlast', (type) => Sfx.play(type === 'frag' ? 'boom' : type === 'cryo' ? 'freeze' : 'fire'));
  events.on('crateSpawn', () => Sfx.play('crate'));
  let lastRicochetAt = 0;
  events.on('bulletBlocked', () => {
    const now = performance.now();
    if (now - lastRicochetAt < 60) return; // SMG bursts into a wall must not turn into noise
    lastRicochetAt = now;
    Sfx.play('hit', 1.6 + Math.random() * 0.3);
  });
  events.on('waveStart', () => Sfx.play('waveStart'));
  events.on('waveCleared', (i, reward, final) => { if (!final) Sfx.play('waveClear'); });
  events.on('playerHit', () => Sfx.play('playerHurt', 0.95 + Math.random() * 0.1));
  events.on('bossTelegraph', () => Sfx.play('bossWarn'));
  events.on('bossImpact', (kind) => Sfx.play(kind === 'slam' ? 'bossSlam' : 'bossTide'));
  events.on('bossSummon', () => Sfx.play('bossSlam', 0.7)); // D45: Fog Mother summon
  events.on('glob', () => Sfx.play('throw', 0.62 + Math.random() * 0.1)); // D45: Spitter
}

/** D45: light camera shake for heavy impacts (presentation only, on the game clock). */
function wireCameraShake(game) {
  const ev = game.events;
  const shake = (a, d) => { if (game.renderer3d) game.renderer3d.shake(a, d); };
  ev.on('grenadeBlast', (type) => shake(type === 'frag' ? 7 : 3, type === 'frag' ? 0.28 : 0.2));
  ev.on('bossImpact', (kind) => shake(kind === 'slam' ? 8 : 11, kind === 'slam' ? 0.3 : 0.42));
  ev.on('bossSummon', () => shake(5, 0.3));
  ev.on('playerHit', () => shake(3, 0.15));
}

/** @param {{loaded: Promise<void>, shownAt: number}} boot */
export function startGame(boot) {
  installBrowserHygiene();
  Music.init(MUSIC_FILES);
  Sfx.loadFiles(SFX_FILES, AUDIO_DIR); // recorded SFX (~120 KB) decode in the background; synth until then

  const game = new Game(document.getElementById('world'), document.getElementById('world3d'));
  const ui = new UIManager(game);
  new HUD(game);
  new TouchControls(game);
  new OffscreenIndicators(game);
  wireCombatSounds(game.events);
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
}
