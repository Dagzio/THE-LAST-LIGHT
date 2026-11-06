// Debug overlay (04_ARCH §14, Phase 2 §12). Loaded only when DEBUG_ENABLED === true (H5: off in releases).
// Text is refreshed 4 times per second, not every frame.

export function initDebugOverlay(game) {
  const el = document.getElementById('debugOverlay');
  if (!el) return;
  el.hidden = false;
  let acc = 0;
  let frames = 0;
  game.onFrame((frameDt) => {
    acc += frameDt;
    frames += 1;
    if (acc < 0.25) return;
    const fps = Math.round(frames / acc);
    acc = 0;
    frames = 0;
    const vp = game.viewport;
    const lines = [
      `FPS ${fps}  frame ${(game.loop.frameDt * 1000).toFixed(1)}ms  upd ${game.loop.updateMs.toFixed(2)}ms  rnd ${game.loop.renderMs.toFixed(2)}ms`,
      `state ${game.sm.state}  sim ${game.clock.time.toFixed(2)}s`,
      `quality ${game.quality} (${game.qualitySetting}) dpr ${vp.dpr.toFixed(2)} buffer ${vp.bufferWidth}x${vp.bufferHeight}`,
    ];
    if (game.renderer3d && game.sm.inMap) {
      const i = game.renderer3d.info();
      lines.push(`3D draw calls ${i.calls}  triangles ${i.triangles}  pixelRatio ${i.pixelRatio.toFixed(2)}`);
    }
    const run = game.run;
    if (run) {
      const p = run.player, w = run.weapon, b = run.beacon;
      const alive = run.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
      lines.push(
        `map ${run.mapId}  seed ${run.runSeed}`,
        `HP ${Math.ceil(p.hp)}/${p.maxHp}  dodge ${p.dodging ? 'ON' : Math.max(0, p.dodgeReadyAt - game.clock.time).toFixed(1) + 's'}`,
        `ammo ${w.ammo}/${w.stats.magazineSize}  reload ${w.reloading ? (w.reloadProgress(game.clock.time) * 100).toFixed(0) + '%' : '-'}`,
        `beacon ${Math.ceil(b.integrity)}/${b.maxIntegrity}  beam ${run.light.angle.toFixed(2)}rad  devices ${run.defenses.pads.map((d) => (d.device ? d.device.id : '-')).join(',')}`,
        `enemies ${alive}/${run.enemies.length}  projectiles ${run.projectiles.activeCount}  particles ${run.particles.activeCount}`,
        `kills ${run.stats.kills}  shots ${run.stats.shotsFired}  rewards ${run.rewards.coins}c ${run.rewards.xp}xp`,
        `wave ${run.waves.waveNumber}/${run.waves.total} ${run.waves.phase}  left ${run.waves.remaining(run.enemies)}  t ${run.waves.timeLeft(game.clock.time).toFixed(1)}s`
          + (run.boss ? `  boss ${Math.ceil(run.boss.hp)}/${run.boss.maxHp} ${run.bossSystem.attack ? run.bossSystem.attack.kind : '-'}` : ''),
      );
    }
    el.textContent = lines.join('\n');
  });
}
