// Game start (imported by boot.js after the preload): wires platform services, the runtime and the UI.
// No globals are created (except window.__game while the dev asset viewer flag is on).
import { DEBUG_ENABLED, DEBUG_MODELS } from './config/constants.js';
import { MUSIC_FILES, MUSIC_BED, SFX_FILES, AUDIO_DIR, ENEMY_HIT_SFX } from './data/sounds.js';
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
import { DeviceTags } from './ui/DeviceTags.js';
import { preloadIcons } from './data/icons.js';
import { initDebugOverlay } from './ui/DebugOverlay.js';

/** Gameplay facts → sounds. Repeated shots get a small cosmetic pitch variation (GDD §18). */
function wireCombatSounds(events, game) {
  let lastHitSoundAt = 0, lastHitIdx = -1;
  // Shots and reloads: platform/WeaponAudio.js (recorded files + reload cues on the sim clock)
  events.on('hit', () => {
    const now = performance.now();
    if (now - lastHitSoundAt < 70) return; // avoid sound mush on multi-pellet hits (the recorded hits have tails)
    lastHitSoundAt = now;
    // one of the recorded hits, never the same twice in a row (synth fallback while they load)
    let i = Math.floor(Math.random() * ENEMY_HIT_SFX.length);
    if (i === lastHitIdx) i = (i + 1) % ENEMY_HIT_SFX.length;
    lastHitIdx = i;
    const name = ENEMY_HIT_SFX[i];
    if (Sfx.duration(name) > 0) Sfx.play(name, 0.95 + Math.random() * 0.1, { voices: 1 });
    else Sfx.play('hit', 0.9 + Math.random() * 0.2);
  });
  let lastKillSoundAt = 0;
  events.on('kill', () => { // a shotgun blast / grenade kills several at once: one crunch, not a stack of them
    const now = performance.now();
    if (now - lastKillSoundAt < 30) return;
    lastKillSoundAt = now;
    Sfx.play('kill', 0.92 + Math.random() * 0.16, { voices: 3 });
  });
  events.on('dash', () => Sfx.play('dash'));
  events.on('beaconHit', () => Sfx.play('beaconHit', 0.9 + Math.random() * 0.2));
  // Turrets (D50): one sound per volley (a double barrel fires two rounds in the same step); Frost Coil — icy zap
  let lastTurretSound = 0;
  events.on('turretShot', (x, y, a, id) => {
    const now = performance.now();
    if (now - lastTurretSound < 30) return;
    lastTurretSound = now;
    Sfx.play(id === 'frost_coil' ? 'frostShot' : id === 'poison_turret' ? 'poisonShot' : 'turretShot', 0.92 + Math.random() * 0.16, { voices: 2 });
  });
  // Killed by a boss (user decision 2026-11-09): its own sting first, the defeat jingle right after it
  let lastHitBy = '';
  events.on('playerHit', (x, y, amount, by) => { lastHitBy = by || ''; });
  events.on('mapDefeat', (reason) => {
    const byBoss = reason === 'player' && BOSS_HITS.has(lastHitBy) && Sfx.duration('bossKillPlayer') > 0;
    if (!byBoss) { Sfx.play('defeat'); return; }
    Sfx.play('bossKillPlayer');
    setTimeout(() => Sfx.play('defeat'), 1500); // presentation only (the results screen is already up)
  });
  events.on('mapVictory', () => Sfx.play('victory'));
  events.on('flare', () => Sfx.play('flare'));
  events.on('flareReady', () => Sfx.play('flareReady'));
  events.on('levelUp', () => Sfx.play('levelUp'));
  events.on('grenadeThrow', () => Sfx.play('throw'));
  events.on('grenadeBlast', (type) => Sfx.play(type === 'frag' ? 'boom' : type === 'cryo' ? 'freeze' : 'fire'));
  events.on('crateSpawn', () => Sfx.play('crate'));
  let lastRicochetAt = 0;
  events.on('bulletBlocked', () => {
    const now = performance.now();
    if (now - lastRicochetAt < 60) return; // SMG bursts into a wall must not turn into noise
    lastRicochetAt = now;
    if (Sfx.duration('ricochet') > 0) Sfx.play('ricochet', 0.92 + Math.random() * 0.16, { voices: 2 }); // D52 file
    else Sfx.play('hit', 1.6 + Math.random() * 0.3);
  });
  // D52 device health: a hit clanks (throttled — several enemies can hit at once), a breaking device bangs
  let lastDeviceHitAt = 0;
  events.on('deviceHit', () => {
    const now = performance.now();
    if (now - lastDeviceHitAt < 120) return;
    lastDeviceHitAt = now;
    Sfx.play('beaconHit', 1.35 + Math.random() * 0.15);
  });
  events.on('deviceBroken', () => Sfx.play('boom', 1.35));
  // Wave start (user decision 2026-11-09): START NEXT WAVE pressed → wave-start1 at once; wave-start2 when the first
  // enemy of the wave is out AND wave-start1 has finished. Timer ran out (no press) → only wave-start2 on the first
  // enemy. Timed on the game clock (a pause does not let it fire early). Synth fog horn if the files are missing.
  const wave = { pending: false, spawned: false, until: 0 };
  events.on('waveStart', () => {
    if (Sfx.duration('waveStart2') <= 0) { Sfx.play('waveStart'); return; }
    wave.pending = true; wave.spawned = false; wave.until = 0;
  });
  events.on('earlyStart', () => {
    if (Sfx.duration('waveStart1') <= 0) return;
    Sfx.play('waveStart1');
    wave.until = game.clock.time + Sfx.duration('waveStart1') - 0.15;
  });
  events.on('enemySpawn', () => { if (wave.pending) wave.spawned = true; });
  events.on('mapDefeat', () => { wave.pending = false; });
  events.on('waveCleared', (i, reward, final) => { if (!final) Sfx.play('waveClear'); });
  events.on('playerHit', () => Sfx.play('playerHurt', 0.95 + Math.random() * 0.1));
  events.on('bossTelegraph', () => Sfx.play('bossWarn'));
  events.on('bossImpact', (kind) => Sfx.play(kind === 'slam' ? 'bossSlam' : 'bossTide'));
  events.on('bossSummon', () => Sfx.play('bossSlam', 0.7)); // D45: Fog Mother summon
  events.on('glob', () => { // D45: Spitter (D52: its own recorded spit)
    if (Sfx.duration('spitterAttack') > 0) Sfx.play('spitterAttack', 0.94 + Math.random() * 0.12, { voices: 2 });
    else Sfx.play('throw', 0.62 + Math.random() * 0.1);
  });
  return (time) => { // called after every simulation step
    if (wave.pending && wave.spawned && time >= wave.until) { wave.pending = false; Sfx.play('waveStart2'); }
  };
}

const BOSS_HITS = new Set(['slam', 'tide', 'gloam_warden', 'fog_mother']);

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
  Music.init(MUSIC_FILES, MUSIC_BED);
  Sfx.loadFiles(SFX_FILES, AUDIO_DIR); // recorded SFX (~120 KB) decode in the background; synth until then
  Sfx.prewarm(); // synthesize the rest in idle time (no first-use hitch in a fight)

  const game = new Game(document.getElementById('world'), document.getElementById('world3d'));
  const ui = new UIManager(game);
  new HUD(game);
  new TouchControls(game);
  new OffscreenIndicators(game);
  new DeviceTags(game); // D52
  preloadIcons();
  const waveSoundStep = wireCombatSounds(game.events, game);
  const weaponAudio = new WeaponAudio(game.events);
  game.onSimStep = (run, time) => { weaponAudio.update(run, time); waveSoundStep(time); };
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
