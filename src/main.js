// Entry point: wires platform services, the game runtime and the UI. No globals are created.
import { DEBUG_ENABLED, MUSIC_TRACKS } from './config/constants.js';
import { installBrowserHygiene } from './platform/BrowserHygiene.js';
import { initAudioLifecycle } from './platform/AudioLifecycle.js';
import { initOrientationGuard } from './platform/OrientationGuard.js';
import { Music } from './platform/Music.js';
import { Sfx } from './platform/Sfx.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { HUD } from './ui/HUD.js';
import { TouchControls } from './ui/TouchControls.js';
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
}

function boot() {
  installBrowserHygiene();
  Music.init(MUSIC_TRACKS);

  const game = new Game(document.getElementById('world'));
  const ui = new UIManager(game);
  new HUD(game);
  new TouchControls(game);
  wireCombatSounds(game.events);

  // Hidden tab / lost focus / wrong orientation → real pause (same path as the pause button).
  initAudioLifecycle({ onSuspend: () => ui.autoPause() });
  initOrientationGuard({ onBlock: () => ui.autoPause() });

  if (DEBUG_ENABLED) initDebugOverlay(game); // H5: off in the project (constant false)

  game.start();
  ui.runSplash();
}

boot();
