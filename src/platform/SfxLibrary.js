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
  // Frost Coil round (D50): short glassy zap with a cold hiss.
  frostShot: () => {
    let lp = 0;
    return render(0.16, (t) => {
      lp += (noise() - lp) * 0.35;
      const zap = Math.sin(2 * Math.PI * (2400 - 6000 * t) * t) * Math.exp(-t * 40) * 0.16;
      return zap + lp * 0.18 * Math.exp(-t * 28);
    });
  },
  // Poison Turret round (D51): a wet, low "spit" with a short bubbling tail.
  poisonShot: () => {
    let lp = 0;
    return render(0.2, (t) => {
      lp += (noise() - lp) * 0.22;
      const blob = Math.sin(2 * Math.PI * (300 - 700 * t) * t) * Math.exp(-t * 26) * 0.2;
      const bubble = Math.sin(2 * Math.PI * 90 * t) * Math.sin(2 * Math.PI * 23 * t) * Math.exp(-t * 14) * 0.08;
      return blob + bubble + lp * 0.16 * Math.exp(-t * 30);
    });
  },
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
  // Wave start: low fog horn.
  waveStart: () => render(1.3, (t) => {
    const env = Math.min(1, t * 5) * Math.exp(-t * 1.6);
    return (Math.sin(2 * Math.PI * 82 * t) * 0.4 + Math.sin(2 * Math.PI * 123 * t) * 0.22 + Math.sin(2 * Math.PI * 164 * t) * 0.1) * env;
  }),
  // Wave cleared: two warm bell tones.
  waveClear: () => render(1.1, (t) => {
    const a = Math.sin(2 * Math.PI * 523 * t) * Math.exp(-t * 3.5);
    const t2 = t - 0.16;
    const b = t2 > 0 ? Math.sin(2 * Math.PI * 784 * t2) * Math.exp(-t2 * 3.5) : 0;
    return (a + b) * 0.18 * Math.min(1, t * 60);
  }),
  // Keeper hurt: short dull hit + breath of noise.
  playerHurt: () => render(0.22, (t) => (Math.sin(2 * Math.PI * (180 - 300 * t) * t) * 0.45 + noise() * 0.18) * Math.exp(-t * 18)),
  // Boss telegraph: rising dark hum.
  bossWarn: () => render(1.0, (t) => {
    const f = 60 + 90 * t;
    return (Math.sin(2 * Math.PI * f * t) * 0.3 + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.12) * Math.min(1, t * 3) * Math.exp(-Math.max(0, t - 0.8) * 12);
  }),
  // Boss slam: heavy boom.
  bossSlam: () => {
    let lp = 0;
    return render(0.7, (t) => {
      lp += (noise() - lp) * 0.06;
      return (Math.sin(2 * Math.PI * (55 - 30 * t) * t) * 0.7 + lp * 0.8) * Math.exp(-t * 6);
    });
  },
  // Dark tide: long low whoosh.
  bossTide: () => {
    let lp = 0;
    return render(0.9, (t) => {
      lp += (noise() - lp) * 0.05;
      return (lp * 1.1 + Math.sin(2 * Math.PI * 70 * t) * 0.25) * Math.sin(Math.PI * Math.min(1, t / 0.9));
    });
  },
  // Victory: rising major chord.
  victory: () => render(2.0, (t) => {
    let s = 0;
    const notes = [[392, 0], [494, 0.15], [587, 0.3], [784, 0.45]];
    for (const [f, d] of notes) { const u = t - d; if (u > 0) s += Math.sin(2 * Math.PI * f * u) * Math.exp(-u * 1.8) * Math.min(1, u * 40); }
    return s * 0.11;
  }),
  // Emergency Flare: bright rising whoosh + high bell.
  flare: () => {
    let lp = 0;
    return render(1.2, (t) => {
      lp += (noise() - lp) * 0.25;
      const whoosh = lp * Math.sin(Math.PI * Math.min(1, t / 0.6)) * 0.35 * (t < 0.6 ? 1 : 0);
      const bell = (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1320 * t)) * Math.exp(-t * 3) * 0.14;
      const boom = Math.sin(2 * Math.PI * (90 - 40 * t) * t) * Math.exp(-t * 6) * 0.3;
      return whoosh + bell + boom;
    });
  },
  // Flare charged: short soft double chime.
  flareReady: () => render(0.5, (t) => {
    const a = Math.sin(2 * Math.PI * 988 * t) * Math.exp(-t * 9);
    const t2 = t - 0.09;
    const b = t2 > 0 ? Math.sin(2 * Math.PI * 1319 * t2) * Math.exp(-t2 * 9) : 0;
    return (a + b) * 0.13;
  }),
  // Purchase: two bright coin clinks.
  buy: () => render(0.4, (t) => {
    const c = (u, f) => (u > 0 ? (Math.sin(2 * Math.PI * f * u) + 0.4 * Math.sin(2 * Math.PI * f * 2.7 * u)) * Math.exp(-u * 18) : 0);
    return (c(t, 2100) + c(t - 0.07, 2600)) * 0.16;
  }),
  // Purchase refused / shop not reachable: short low buzz.
  deny: () => render(0.18, (t) => (Math.sign(Math.sin(2 * Math.PI * 140 * t)) * 0.12 + Math.sin(2 * Math.PI * 95 * t) * 0.1) * Math.exp(-t * 14)),
  // Player Level up: rising four-note arpeggio.
  levelUp: () => render(1.1, (t) => {
    let s = 0;
    for (const [f, d] of [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.27]]) {
      const u = t - d;
      if (u > 0) s += Math.sin(2 * Math.PI * f * u) * Math.exp(-u * 4) * Math.min(1, u * 60);
    }
    return s * 0.1;
  }),
  // Grenade throw: short airy whoosh.
  throw: () => {
    let lp = 0;
    return render(0.3, (t) => { lp += (noise() - lp) * 0.2; return lp * Math.sin(Math.PI * (t / 0.3)) * 0.5; });
  },
  // Frag blast: sharp crack + low boom.
  boom: () => {
    let lp = 0;
    return render(0.9, (t) => {
      lp += (noise() - lp) * 0.09;
      return (noise() * 0.6 * Math.exp(-t * 30) + lp * 0.9 * Math.exp(-t * 4) + Math.sin(2 * Math.PI * (60 - 25 * t) * t) * 0.5 * Math.exp(-t * 5)) * 0.8;
    });
  },
  // Cryo: icy crack + glassy shimmer.
  freeze: () => render(0.7, (t) => (noise() * 0.35 * Math.exp(-t * 25)
    + (Math.sin(2 * Math.PI * 1760 * t) + Math.sin(2 * Math.PI * 2350 * t)) * 0.07 * Math.exp(-t * 5))),
  // Molotov: glass break + fire whoosh.
  fire: () => {
    let lp = 0;
    return render(0.9, (t) => {
      lp += (noise() - lp) * 0.15;
      const glass = (Math.sin(2 * Math.PI * 3100 * t) * 0.15 + noise() * 0.2) * Math.exp(-t * 35);
      return glass + lp * 0.55 * Math.min(1, t * 8) * Math.exp(-t * 2.2);
    });
  },
  // Crate appears: sparkling three-note chime.
  crate: () => render(0.8, (t) => {
    let s = 0;
    for (const [f, d] of [[1175, 0], [1568, 0.08], [1976, 0.16]]) { const u = t - d; if (u > 0) s += Math.sin(2 * Math.PI * f * u) * Math.exp(-u * 7); }
    return s * 0.09;
  }),
  // Perk chosen: warm rising swell.
  perk: () => render(0.8, (t) => (Math.sin(2 * Math.PI * (440 + 330 * t) * t) * 0.18 + Math.sin(2 * Math.PI * 880 * t) * 0.06) * Math.min(1, t * 20) * Math.exp(-t * 3.5)),
  // Results stamp landing on paper: dull thud + paper slap.
  stamp: () => render(0.3, (t) => (Math.sin(2 * Math.PI * (95 - 70 * t) * t) * 0.55 + noise() * 0.3 * Math.exp(-t * 40)) * Math.exp(-t * 14)),
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
