// Visual themes of the campaign maps (presentation only — never read by the simulation). One entry per map theme:
// ground painting (systems/MapPainter-style CPU canvas), surround water / rock, fog, sky and moon light.
// Colours are sRGB hex strings. Every map keeps the same night mood; each theme shifts its palette and props.

export const THEMES = {
  // Map 1 — the original look (unchanged)
  ash: {
    ground: ['#3a3e46', '#2f3239', '#23262c'],
    speckle: { base: 34, range: 46, tint: [0, 3, 8], count: 14000 },
    patches: [
      { color: [52, 70, 58], alpha: [0.18, 0.2], count: 70, rx: [20, 70], ry: [12, 34] },  // moss
      { color: [16, 20, 26], alpha: [0.35, 0], count: 40, rx: [30, 80], ry: [20, 40] },     // wet dark
    ],
    cracks: { color: 'rgba(14,16,20,0.55)', count: 90 },
    plaza: 'stone',
    path: 'rgba(78,74,66,0.22)',
    shore: '#0d151c',
    sky: '#070a12', fog: [1100, 2300],
    hemi: ['#9aaad0', '#22252c', 1.7], moon: ['#c8d6ff', 2.1],
    preview: '#2f3239',
  },
  // Map 2 — Drowned Pier: wet sand, boardwalk planks, sea to the south
  pier: {
    ground: ['#3d3a35', '#33312d', '#26252a'],
    speckle: { base: 40, range: 40, tint: [4, 2, 0], count: 12000 },
    patches: [
      { color: [22, 34, 40], alpha: [0.35, 0.15], count: 46, rx: [24, 70], ry: [14, 36] },  // tide pools
      { color: [70, 66, 52], alpha: [0.16, 0.12], count: 50, rx: [20, 60], ry: [10, 26] },  // dry sand
    ],
    cracks: { color: 'rgba(20,18,16,0.4)', count: 40 },
    plaza: 'deck',
    path: 'rgba(92,80,62,0.24)',
    shore: '#0b1820',
    sky: '#060b12', fog: [1000, 2200],
    hemi: ['#9db4d4', '#24221f', 1.75], moon: ['#cfdcff', 2.0],
    preview: '#33312d',
  },
  // Map 3 — Pine Hollow: dark needle floor, green fog
  forest: {
    ground: ['#2c352d', '#252c26', '#1b211d'],
    speckle: { base: 26, range: 34, tint: [4, 10, 2], count: 15000 },
    patches: [
      { color: [58, 46, 32], alpha: [0.22, 0.16], count: 60, rx: [18, 60], ry: [12, 30] },  // needle beds
      { color: [44, 74, 46], alpha: [0.2, 0.16], count: 70, rx: [16, 54], ry: [10, 28] },   // moss
    ],
    cracks: { color: 'rgba(30,24,18,0.45)', count: 60 },
    plaza: 'stone',
    path: 'rgba(72,60,44,0.26)',
    shore: '#0c1410',
    sky: '#060c09', fog: [850, 2000],
    hemi: ['#9cc0a8', '#1d241e', 1.65], moon: ['#cde8d6', 1.9],
    preview: '#252c26',
  },
  // Map 4 — Salt Marsh: muddy olive ground, pale salt crust, still water pools
  marsh: {
    ground: ['#3a3a2c', '#303126', '#24261f'],
    speckle: { base: 40, range: 40, tint: [6, 6, 0], count: 13000 },
    patches: [
      { color: [150, 150, 128], alpha: [0.12, 0.1], count: 60, rx: [16, 52], ry: [10, 24] }, // salt crust
      { color: [56, 66, 38], alpha: [0.22, 0.16], count: 56, rx: [20, 60], ry: [12, 30] },   // reeds mud
    ],
    cracks: { color: 'rgba(170,168,150,0.18)', count: 110 },
    plaza: 'stone',
    path: 'rgba(86,84,64,0.24)',
    shore: '#11160f',
    sky: '#080a07', fog: [950, 2200],
    hemi: ['#b6bf9c', '#25261c', 1.65], moon: ['#e2e6c8', 1.9],
    pool: { fill: 'rgba(28,44,40,0.82)', rim: 'rgba(150,160,130,0.35)', shine: 'rgba(140,180,170,0.16)' },
    preview: '#303126',
  },
  // Map 5 — Frost Ridge: snow and blue ice
  ice: {
    ground: ['#5b6676', '#4a5462', '#38404c'],
    speckle: { base: 120, range: 70, tint: [6, 10, 18], count: 12000 },
    patches: [
      { color: [150, 190, 220], alpha: [0.18, 0.14], count: 50, rx: [24, 80], ry: [14, 36] }, // blue ice
      { color: [210, 220, 232], alpha: [0.16, 0.12], count: 70, rx: [20, 70], ry: [10, 28] }, // drifts
    ],
    cracks: { color: 'rgba(30,46,64,0.45)', count: 70 },
    plaza: 'stone',
    path: 'rgba(40,52,68,0.24)',
    shore: '#101a26',
    sky: '#070b14', fog: [1000, 2300],
    hemi: ['#b8cdf0', '#2a3340', 1.5], moon: ['#dbe7ff', 1.9],
    preview: '#4a5462',
  },
  // Map 6 — The Black Lighthouse: basalt and embers under a red sky
  black: {
    ground: ['#2c2526', '#231e20', '#181416'],
    speckle: { base: 26, range: 30, tint: [8, 0, 0], count: 14000 },
    patches: [
      { color: [90, 26, 20], alpha: [0.18, 0.14], count: 46, rx: [16, 50], ry: [10, 24] },   // ember glow
      { color: [10, 8, 10], alpha: [0.35, 0.1], count: 60, rx: [24, 80], ry: [14, 36] },     // soot
    ],
    cracks: { color: 'rgba(120,44,28,0.22)', count: 80 },
    plaza: 'stone',
    path: 'rgba(70,52,48,0.24)',
    shore: '#140b0c',
    sky: '#0d0607', fog: [950, 2200],
    hemi: ['#c8a0a0', '#241a1a', 1.6], moon: ['#ffd4c4', 1.8],
    preview: '#231e20',
  },
};

export const getTheme = (id) => THEMES[id] || THEMES.ash;
