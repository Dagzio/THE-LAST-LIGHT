// Synthesized sound effects (decision D10: SFX are generated in code, no files).
// Each entry renders PCM into an AudioBuffer once. AudioBuffers are context-independent,
// so they survive the iPhone audio rebuild (vanilla.md §6 rule 1) without re-synthesis.

const SAMPLE_RATE = 44100;

function render(duration, gen) {
  const length = Math.ceil(duration * SAMPLE_RATE);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) data[i] = gen(i / SAMPLE_RATE, i);
  return data;
}

// Cosmetic noise only (never gameplay) — Math.random is acceptable here.
const noise = () => Math.random() * 2 - 1;

/** name → () => Float32Array (mono PCM at SAMPLE_RATE) */
const RECIPES = {
  // UI tap: short wooden tick with a soft metallic tail.
  click: () => render(0.08, (t) => {
    const env = Math.exp(-t * 70);
    const tone = Math.sin(2 * Math.PI * (950 - 2600 * t) * t);
    return (tone * 0.32 + noise() * 0.08 * Math.exp(-t * 180)) * env;
  }),
  // TAP TO PLAY: low swell + rising bell, like a lamp being lit.
  start: () => render(0.9, (t) => {
    const swell = Math.sin(2 * Math.PI * 110 * t) * Math.min(1, t * 6) * Math.exp(-t * 3.2) * 0.22;
    const bell = (Math.sin(2 * Math.PI * 660 * t) + 0.5 * Math.sin(2 * Math.PI * 990 * t))
      * Math.exp(-t * 4.5) * Math.min(1, t * 40) * 0.16;
    return swell + bell;
  }),
  // Popup open: soft paper/cloth whoosh.
  open: () => {
    let lp = 0;
    return render(0.16, (t) => {
      lp += (noise() - lp) * 0.18; // simple low-pass
      return lp * Math.sin(Math.PI * Math.min(1, t / 0.16)) * 0.35;
    });
  },
};

export const SFX_NAMES = Object.keys(RECIPES);

/**
 * Builds an AudioBuffer for `name`. Uses the AudioBuffer constructor when available
 * (context-free); otherwise falls back to `ctx.createBuffer` (older Safari).
 */
export function buildSfxBuffer(name, ctx) {
  const recipe = RECIPES[name];
  if (!recipe) return null;
  const pcm = recipe();
  let buf = null;
  try {
    buf = new AudioBuffer({ length: pcm.length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 });
  } catch (e) {
    try { buf = ctx ? ctx.createBuffer(1, pcm.length, SAMPLE_RATE) : null; } catch (e2) { buf = null; }
  }
  if (!buf) return null;
  buf.getChannelData(0).set(pcm);
  return buf;
}
