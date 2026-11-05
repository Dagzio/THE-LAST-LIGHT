// "Rotate your phone" blocker for a landscape game (H5 §13, 03-LAYOUT-LANDSCAPE, vanilla.md §8 variant A):
// shown when the device is a touch device AND innerHeight > innerWidth. Never on desktop.
// The CSS shows the blocker only through the body class set here — one condition, one place (PITFALLS 48).
import { duck, unduck } from './AudioLifecycle.js';
import { Sfx } from './Sfx.js';

/** @param {{onBlock?: () => void}} hooks onBlock — the game must pause while blocked. */
export function initOrientationGuard({ onBlock } = {}) {
  const touch = matchMedia('(hover: none) and (pointer: coarse)');
  const isBlocked = () => touch.matches && innerHeight > innerWidth;

  function checkRotate() {
    const blocked = isBlocked();
    document.body.classList.toggle('rotate-blocked', blocked);
    // Music: volume only (never suspend for orientation, vanilla.md §6 rule 3). SFX: muted by flag.
    if (blocked) { duck('orientation'); Sfx.setMuted('orientation', true); if (onBlock) onBlock(); }
    else { unduck('orientation'); Sfx.setMuted('orientation', false); }
  }

  let t = 0;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(checkRotate, 100); });
  addEventListener('orientationchange', checkRotate);
  checkRotate();
  return { get blocked() { return isBlocked(); } };
}
