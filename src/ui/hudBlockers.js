// D63: fixed HUD blocks that world-anchored labels (kiosk / crate prompts, device tags) must not slide under — their
// texts would mix with the HUD's and a tap could hit the wrong control. The block rects are measured after a resize,
// a language or state change and at most twice a second otherwise (the header grows with the boss bar, the repair
// button…) — never once per label per frame.
// the action buttons one by one: they sit outside their containers' boxes
const SELECTOR = '#screen-game .corner, #screen-game .hud-top, #screen-game .hud-player, #screen-game .touch-stick, '
  + '#screen-game .touch-actions, #screen-game .touch-actions button, #screen-game #hudActions button';
const MARGIN = 4;
let rects = null;
let measuredAt = 0;

/** Forget the measured blocks (resize, language or state change). */
export function invalidateHudBlockers() { rects = null; }

/** True if the screen box [l, t, r, b] (CSS px) comes within 4 px of a visible HUD block. */
export function coversHud(l, t, r, b) {
  const now = performance.now();
  if (!rects || now - measuredAt > 500) {
    measuredAt = now;
    rects = [];
    for (const n of document.querySelectorAll(SELECTOR)) {
      const k = n.getBoundingClientRect();
      if (k.width > 1 && k.height > 1) rects.push(k);
    }
  }
  for (const k of rects) if (l < k.right + MARGIN && r > k.left - MARGIN && t < k.bottom + MARGIN && b > k.top - MARGIN) return true;
  return false;
}
