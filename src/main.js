// Entry point: wires platform services, the game runtime and the UI. No globals are created.
import { DEBUG_ENABLED, MUSIC_TRACKS } from './config/constants.js';
import { installBrowserHygiene } from './platform/BrowserHygiene.js';
import { initAudioLifecycle } from './platform/AudioLifecycle.js';
import { initOrientationGuard } from './platform/OrientationGuard.js';
import { Music } from './platform/Music.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { initDebugOverlay } from './ui/DebugOverlay.js';

function boot() {
  installBrowserHygiene();
  Music.init(MUSIC_TRACKS);

  const game = new Game(document.getElementById('world'));
  const ui = new UIManager(game);

  // Hidden tab / lost focus / wrong orientation → real pause (same path as the pause button).
  initAudioLifecycle({ onSuspend: () => ui.autoPause() });
  initOrientationGuard({ onBlock: () => ui.autoPause() });

  if (DEBUG_ENABLED) initDebugOverlay(game); // H5: off in the project (constant false)

  game.start();
  ui.runSplash();
}

boot();
