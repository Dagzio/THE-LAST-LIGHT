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
};
