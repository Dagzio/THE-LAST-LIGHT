// Game start (imported by boot.js after the preload): wires platform services, the runtime and the UI.
// No globals are created (except window.__game while the dev viewer or the test cheats are on — never in a release).
import { DEBUG_ENABLED, DEBUG_MODELS, CHEATS } from './config/constants.js';
import { MUSIC_FILES, SFX_FILES, AUDIO_DIR, ENEMY_KILL_SFX, FOOTSTEPS, STEP_SETS, CARPET_FLOORS, CARPET_PROPS, FOOTSTEP_GAIN, PLAYER_HURT_SFX } from './data/sounds.js';
import { propBox } from './data/props.js';
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
import { LoadingView } from './ui/LoadingView.js';
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
  // D93 (user: every sound in exact step): one step per foot the animation puts down (render3d/humans.js footfalls) —
  // a slice of the recording of the floor under him (data/sounds.js STEP_SETS: hard / carpet / outdoor), as loud as
  // his stance allows (FOOTSTEP_GAIN). Nothing while he stops, rolls, dies or the game is not running.
  const steps = { level: null, rugs: [], feet: undefined, last: {} };
  game.onFrame(() => {
    const run = game.run, p = run && run.player;
    if (!run) return;
    if (run.level !== steps.level) {
      steps.level = run.level; steps.feet = undefined;
      steps.rugs = run.level.props.filter((q) => CARPET_PROPS.has(q.type)).map(propBox);
    }
    const hero = game.renderer3d && game.renderer3d.hero;
    const n = hero ? hero.footfalls : 0;
    const speed = Math.hypot(p.vx, p.vy);
    const walking = game.sm.is(STATES.RUNNING) && p.alive && !p.dodging && !p.takedown && speed > FOOTSTEPS.minSpeed;
    if (walking && steps.feet !== undefined && n !== steps.feet) {
      const set = STEP_SETS[stepSetAt(run, p, steps.rugs)];
      const last = steps.last[set.sfx];
      let i = Math.floor(Math.random() * set.slices.length);
      if (i === last) i = (i + 1) % set.slices.length;
      steps.last[set.sfx] = i;
      const [at, len] = set.slices[i];
      const stance = p.cover || p.stance === 'crouch' || p.crouched ? 'crouch' : run.controller.speedProfile && p.moveMode === 'walk' ? 'walk' : 'run';
      Sfx.play(set.sfx, 0.96 + Math.random() * 0.08, { offset: at, dur: len, gain: set.gain * FOOTSTEP_GAIN[stance], voices: 2 });
    }
    steps.feet = n;
  });
  // D93 (user files): the takedown's two blows on the clip's contact frames
  events.on('takedownBlow', (kind) => Sfx.play(kind === 'kick' ? 'legPunch' : 'handPunch', 0.97 + Math.random() * 0.06, { voices: 1 }));
}

/** D93: which step recording the floor under him asks for (the level's own set, else carpet / hard). */
function stepSetAt(run, p, rugs) {
  if (run.level.footsteps && STEP_SETS[run.level.footsteps]) return run.level.footsteps;
  for (const r of rugs) if (p.x >= r[0] && p.x <= r[2] && p.y >= r[1] && p.y <= r[3]) return 'carpet';
  const zid = run.levelWorld.zoneAt(p.x, p.y), z = zid && run.level.zones.find((q) => q.id === zid);
  return z && CARPET_FLOORS.has(z.floor) ? 'carpet' : 'hard';
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
  new LoadingView(game); // D93: the level's loading screen
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
  if (DEBUG_MODELS || CHEATS) window.__game = game; // the dev viewer / the test builds read the live game (never in a release)
  if (DEBUG_MODELS) import('./dev/debug-models.js').then((m) => m.initModelViewer()).catch((e) => console.error(e));

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
