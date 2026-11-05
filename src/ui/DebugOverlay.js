// Debug overlay (04_ARCH §14). Loaded only when DEBUG_ENABLED === true and ?debug=1 (H5: off in releases).
// Text is refreshed 4 times per second, not every frame.

export function initDebugOverlay(game) {
  const el = document.getElementById('debugOverlay');
  if (!el) return;
  el.hidden = false;
  let acc = 0;
  let frames = 0;
  let fps = 0;
  game.onFrame((frameDt) => {
    acc += frameDt;
    frames += 1;
    if (acc < 0.25) return;
    fps = Math.round(frames / acc);
    acc = 0;
    frames = 0;
    const vp = game.viewport;
    el.textContent = [
      `FPS ${fps}`,
      `state ${game.sm.state}`,
      `sim ${game.clock.time.toFixed(2)}s steps ${game.clock.stepCount}`,
      `quality ${game.quality} (${game.qualitySetting}) dpr ${vp.dpr.toFixed(2)}`,
      `css ${vp.cssWidth}x${vp.cssHeight} buffer ${vp.bufferWidth}x${vp.bufferHeight}`,
      `map ${game.mapId || '-'}`,
    ].join('\n');
  });
}
