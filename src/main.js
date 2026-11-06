// Game start (imported by boot.js after the preload): wires platform services, the runtime and the UI.
// No globals are created (except window.__game while the dev asset viewer flag is on).
import { DEBUG_ENABLED, DEBUG_MODELS, MUSIC_TRACKS } from './config/constants.js';
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
  events.on('shot', () => Sfx.play('shot', 0.92 + Math.random() * 0.16));
  events.on('hit', () => {
    const now = performance.now();
    if (now - lastHitSoundAt < 40) return; // avoid sound mush on multi-pellet hits
    lastHitSoundAt = now;
    Sfx.play('hit', 0.9 + Math.random() * 0.2);
  });
  events.on('kill', () => Sfx.play('kill', 0.9 + Math.random() * 0.2));
  events.on('reloadStart', () => Sfx.play('reload'));
  events.on('reloadEnd', () => Sfx.play('reloadEnd'));
  events.on('dash', () => Sfx.play('dash'));
  events.on('beaconHit', () => Sfx.play('beaconHit', 0.9 + Math.random() * 0.2));
  events.on('turretShot', () => Sfx.play('turretShot', 0.92 + Math.random() * 0.16));
  events.on('frostPulse', () => Sfx.play('frostPulse'));
  events.on('mapDefeat', () => Sfx.play('defeat'));
  events.on('mapVictory', () => Sfx.play('victory'));
  events.on('flare', () => Sfx.play('flare'));
  events.on('flareReady', () => Sfx.play('flareReady'));
  events.on('levelUp', () => Sfx.play('levelUp'));
  events.on('waveStart', () => Sfx.play('waveStart'));
  events.on('waveCleared', (i, reward, final) => { if (!final) Sfx.play('waveClear'); });
  events.on('playerHit', () => Sfx.play('playerHurt', 0.95 + Math.random() * 0.1));
  events.on('bossTelegraph', () => Sfx.play('bossWarn'));
  events.on('bossImpact', (kind) => Sfx.play(kind === 'slam' ? 'bossSlam' : 'bossTide'));
}

/** @param {{loaded: Promise<void>, shownAt: number}} boot */
export function startGame(boot) {
  installBrowserHygiene();
  Music.init(MUSIC_TRACKS);

  const game = new Game(document.getElementById('world'), document.getElementById('world3d'));
  const ui = new UIManager(game);
  new HUD(game);
  new TouchControls(game);
  new OffscreenIndicators(game);
  wireCombatSounds(game.events);

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
