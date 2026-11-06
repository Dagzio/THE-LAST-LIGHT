// render-guard.js — WebGL robustness for three.js games on weak phones (copied without changes from the company H5
// guide engines/3d-reference/render/render-guard.js, proven on three.js r166). Rules: engines/3d-threejs.md §5.
//
//   import { cpuCanvas, overlayTextures, createRenderGuard } from './render-guard.js';
//   const guard = createRenderGuard(THREE, renderer, scene, camera, {
//     onRestored: () => { shadowDirty = true; pausedDrawn = false; course?.refreshOverlays(); },
//   });
//   // after a graphics preset is applied, a level / season is built, at boot before the first frame:
//   guard.warmUp();                       // returns a promise: boot → loadLevel().then(() => guard.ready()).then(firstFrame)
//   // in the frame loop, right after requestAnimationFrame(...):
//   if (guard.busy()) { last = now; return; }   // shaders still building or no context: keep the last frame, game waits
//
// What each piece prevents:
//  1. cpuCanvas — black textures: Chrome on Android keeps 2D canvases on the GPU; when it restarts its GPU process
//     (memory pressure) their pixels are gone and a cached CanvasTexture stays black for good.
//  2. overlayTextures — a translucent overlay (baked shading, decals) turning the whole ground black: a texture that
//     failed to upload samples as (0,0,0,1); with the alpha in a separate alphaMap a failure is transparent instead.
//  3. warmUp / busy — the white screen: a preset switch (shadows / bump maps on-off) or a new season rebuilds every
//     material's shader; compiled inside one frame that's seconds on a weak GPU and Chrome resets the GPU process.
//     compileAsync builds them in parallel (KHR_parallel_shader_compile) while no frame is drawn (max 4 s).
//  4. context loss — preventDefault so the browser may give the context back (three.js re-uploads textures and
//     geometry from their sources); no drawing while it's lost; not back within 3 s → reload on the Low preset
//     (at most once a minute, so a phone with WebGL blocked can't loop).

// a 2D canvas for texture painting that lives in main memory (survives a GPU-process restart)
export function cpuCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { canvas: c, g: c.getContext('2d', { willReadFrequently: true }) };
}

// colour + alpha DataTextures from a painted canvas (use as material.map + material.alphaMap, transparent: true).
// DataTexture rows run bottom-up, alphaMap reads the green channel. The canvas is released afterwards.
export function overlayTextures(THREE, canvas) {
  const W = canvas.width, H = canvas.height;
  const src = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const col = new Uint8Array(W * H * 4), al = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const s0 = y * W * 4, d0 = (H - 1 - y) * W * 4;
    for (let x = 0; x < W * 4; x += 4) {
      const s = s0 + x, d = d0 + x, a = src[s + 3];
      col[d] = src[s]; col[d + 1] = src[s + 1]; col[d + 2] = src[s + 2]; col[d + 3] = 255;
      al[d] = al[d + 1] = al[d + 2] = a; al[d + 3] = 255;
    }
  }
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, W, H);
    t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  canvas.width = canvas.height = 0;
  return { map: tex(col, true), alphaMap: tex(al, false) };
}

export function createRenderGuard(THREE, renderer, scene, camera, {
  onRestored = () => {},
  qualityKey = null,          // localStorage key of the graphics preset, e.g. 'mygame.quality' — set to 'low' before a reload
  reloadAfterMs = 3000,
  maxWarmMs = 4000,
} = {}) {
  const canvas = renderer.domElement;
  let warming = null, lost = 0;

  function warmUp() {
    if (lost) return Promise.resolve();
    let job;
    try { job = renderer.compileAsync(scene, camera); } catch { job = Promise.resolve(); }
    const w = warming = Promise.race([job, new Promise(r => setTimeout(r, maxWarmMs))]).catch(() => {}).then(() => {
      if (warming === w) warming = null;
    });
    return w;
  }

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    lost = performance.now();
    setTimeout(() => {
      if (!lost) return;
      let lastTry = 0;
      try { lastTry = +sessionStorage.getItem('glGuardReload') || 0; } catch {}
      if (Date.now() - lastTry < 60000) return;
      try {
        sessionStorage.setItem('glGuardReload', String(Date.now()));
        if (qualityKey) localStorage.setItem(qualityKey, 'low');
      } catch {}
      location.reload();
    }, reloadAfterMs);
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    lost = 0;
    onRestored();
    warmUp();
  }, false);

  return {
    warmUp,
    ready: () => warming || Promise.resolve(),
    busy: () => !!warming || !!lost,      // true → skip this frame (no render, no game step)
    lost: () => !!lost,
  };
}
