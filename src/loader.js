// Boot preloader (H5 3D guide §7, pattern of the reference game sky-golf-3d): while the splash is up it downloads
// the engine (three.js is most of the bytes) with real byte progress, then the game modules are evaluated and the
// game reports "ready". TAP TO PLAY appears only after 100%. Files that fail do not stall the bar.

const CODE = [['lib/three.module.js', 80]];   // [url, share of the bar]
const W_GAME = 20;                            // game modules evaluated (½) + renderer created / UI built (1)

const S = { tasks: [], subs: new Set(), gameTask: null };
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

/** Starts the downloads; resolves when the code is in the cache. */
export function startPreload() {
  const code = Promise.all(CODE.map(([url, w]) => get(url, task(w))));
  S.gameTask = task(W_GAME);
  return code;
}
