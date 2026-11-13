// Boot preloader (H5 3D guide §7, pattern of the reference game sky-golf-3d): while the splash is up it downloads
// the engine (three.js is most of the bytes) with real byte progress, then the game modules are evaluated and the
// game reports "ready". TAP TO PLAY appears only after 100%. Files that fail do not stall the bar.

// D77 (user decision): the splash also waits for the warm-up — sounds, every map preview, the menu scene and the
// adaptive resolution measured on it — so the main menu runs smoothly at once (a longer bar is fine).
const CODE = [['lib/three.module.js', 50]];   // [url, share of the bar]
const W_GAME = 10;                            // game modules evaluated (½) + renderer created / UI built (1)
const W_WARM = 40;                            // warm-up (main.js warmUp → warmProgress)

const S = { tasks: [], subs: new Set(), gameTask: null, warmTask: null };
S.loaded = new Promise((resolve) => { S.finish = resolve; });

export const loaded = S.loaded;
export const onProgress = (fn) => S.subs.add(fn);

function task(w) {
  const t = { w, p: 0 };
  S.tasks.push(t);
  return t;
}

function set(t, p) {
  if (p <= t.p) return;
  t.p = Math.min(1, p);
  let sum = 0, done = 0;
  for (const x of S.tasks) { sum += x.w; done += x.w * x.p; }
  const prog = done / sum;
  S.subs.forEach((fn) => fn(prog));
  if (S.tasks.every((x) => x.p >= 1)) S.finish();
}

// fetch with byte progress (puts the file in the HTTP cache; the module import then reuses it)
async function get(url, t) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const len = (!res.headers.get('content-encoding') && Number(res.headers.get('content-length'))) || 0;
    if (len && res.body) {
      const reader = res.body.getReader();
      for (let got = 0; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.byteLength;
        set(t, Math.min(0.99, got / len));
      }
    } else await res.arrayBuffer();
  } catch (e) { /* the game import fetches it itself */ } finally { set(t, 1); }
}

export const gameStarted = () => S.gameTask && set(S.gameTask, 0.5);
export const gameReady = () => S.gameTask && set(S.gameTask, 1);
/** D77: warm-up progress 0…1 (1 = done; the bar reaches 100 % and TAP TO PLAY may appear). */
export const warmProgress = (p) => S.warmTask && set(S.warmTask, p);

/** Starts the downloads; resolves when the code is in the cache. */
export function startPreload() {
  const code = Promise.all(CODE.map(([url, w]) => get(url, task(w))));
  S.gameTask = task(W_GAME);
  S.warmTask = task(W_WARM);
  return code;
}
