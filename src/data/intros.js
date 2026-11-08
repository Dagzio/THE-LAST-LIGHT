// One-time intro cards (D45): a new enemy the first time it appears, a map's feature the first time the map starts.
// Shown once per profile (profile.intros), never pause the game, never change gameplay.
// kind → kicker text; icon → glyph in the card (ui/HUD.js).

export const INTROS = {
  spitter: { kind: 'enemy', titleKey: 'enemy.spitter', textKey: 'intro.spitter', icon: 'spit' },
  husk: { kind: 'enemy', titleKey: 'enemy.husk', textKey: 'intro.husk', icon: 'shell' },
  fog_mother: { kind: 'boss', titleKey: 'boss.fog_mother', textKey: 'intro.fog_mother', icon: 'boss' },
  drowned_pier: { kind: 'map', titleKey: 'map.drowned_pier.name', textKey: 'feature.drowned_pier', icon: 'sides' },
  pine_hollow: { kind: 'map', titleKey: 'map.pine_hollow.name', textKey: 'feature.pine_hollow', icon: 'tree' },
  salt_marsh: { kind: 'map', titleKey: 'map.salt_marsh.name', textKey: 'feature.salt_marsh', icon: 'pool' },
  frost_ridge: { kind: 'map', titleKey: 'map.frost_ridge.name', textKey: 'feature.frost_ridge', icon: 'pad' },
  black_lighthouse: { kind: 'map', titleKey: 'map.black_lighthouse.name', textKey: 'feature.black_lighthouse', icon: 'sides' },
};

export const INTRO_IDS = Object.keys(INTROS);
export const INTRO_SECONDS = 6; // on screen (game clock: pause freezes it)
