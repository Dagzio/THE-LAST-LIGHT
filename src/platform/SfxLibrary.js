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
  // Pistol shot: sharp crack + short low thump (pitch varied per shot by playbackRate).
  shot: () => {
    let lp = 0;
    return render(0.22, (t) => {
      lp += (noise() - lp) * 0.5;
      const crack = lp * Math.exp(-t * 38) * 0.5;
      const thump = Math.sin(2 * Math.PI * (140 - 260 * t) * t) * Math.exp(-t * 22) * 0.45;
      return crack + thump;
    });
  },
  // Bullet hits flesh: dull tick.
  hit: () => render(0.07, (t) => (Math.sin(2 * Math.PI * 320 * t) * 0.3 + noise() * 0.15) * Math.exp(-t * 60)),
  // Enemy dies: wet low crunch.
  kill: () => {
    let lp = 0;
    return render(0.35, (t) => {
      lp += (noise() - lp) * 0.12;
      return (lp * 0.9 + Math.sin(2 * Math.PI * (90 - 120 * t) * t) * 0.35) * Math.exp(-t * 9);
    });
  },
  // Reload start: magazine out — two mechanical clicks.
  reload: () => render(0.32, (t) => {
    const c1 = t < 0.04 ? Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 120) : 0;
    const t2 = t - 0.2;
    const c2 = t2 > 0 && t2 < 0.05 ? Math.sin(2 * Math.PI * 1400 * t2) * Math.exp(-t2 * 100) : 0;
    return (c1 + c2) * 0.35 + noise() * 0.02 * Math.exp(-t * 20);
  }),
  // Reload done: slide racked.
  reloadEnd: () => render(0.14, (t) => (Math.sin(2 * Math.PI * 900 * t) * 0.3 + noise() * 0.18) * Math.exp(-t * 45)),
  // Dash: fast cloth whoosh.
  dash: () => {
    let lp = 0;
    return render(0.25, (t) => {
      lp += (noise() - lp) * 0.08;
      return lp * Math.sin(Math.PI * (t / 0.25)) * 0.9;
    });
  },
  // Claws on the beacon stone: dull heavy knock + grit.
  beaconHit: () => render(0.3, (t) => (Math.sin(2 * Math.PI * (70 - 60 * t) * t) * 0.6 + noise() * 0.25 * Math.exp(-t * 30)) * Math.exp(-t * 12)),
  // Guard turret: short metallic pop.
  turretShot: () => render(0.12, (t) => (Math.sin(2 * Math.PI * 520 * t) * 0.25 + noise() * 0.35) * Math.exp(-t * 55)),
  // Frost coil pulse: icy chime + airy hiss.
  frostPulse: () => {
    let lp = 0;
    return render(0.6, (t) => {
      lp += (noise() - lp) * 0.3;
      const chime = (Math.sin(2 * Math.PI * 1320 * t) + 0.6 * Math.sin(2 * Math.PI * 1980 * t)) * Math.exp(-t * 7) * 0.12;
      return chime + lp * 0.12 * Math.exp(-t * 5);
    });
  },
  // Defeat: low falling drone.
  defeat: () => render(1.6, (t) => (Math.sin(2 * Math.PI * (130 - 50 * t) * t) * 0.35 + Math.sin(2 * Math.PI * (97 - 40 * t) * t) * 0.25)
    * Math.min(1, t * 8) * Math.exp(-t * 1.6)),
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
