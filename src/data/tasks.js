// D141 (STORY_DESIGN_D133.md §3): the story levels' sub-tasks — the defaults; a level's objective may override them.
export const TASKS = {
  search: {
    hold: 1.2,          // s of holding E (the touch button) at a spot with a white dot
    stillBelow: 12,     // units/s: moving faster than this breaks the search off (and a hit does)
    dotRange: 180,      // units (~6 m): the white dot shows within this distance of the hero
    resultFor: 1.4,     // s the "empty" / "found" note stays over the spot
  },
  hold: {
    waveWarn: 2,        // s: a wave's entry point is marked this long before it comes in
  },
  // D148 (Marseille): a scene's spot is looked at faster than a search (nothing to dig through)
  inspect: {
    hold: 0.9,
  },
  // D148: [ПРИКРЫТИЕ СВЕРХУ] — no new group in the last seconds (the crew is nearly done)
  defend: {
    lastWave: 10,
  },
};
