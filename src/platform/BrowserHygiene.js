// Game ≠ web page (H5 §14, vanilla.md §11): no context menu, no drag, no zoom of any kind.
let installed = false;

export function installBrowserHygiene() {
  if (installed) return;
  installed = true;
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault()); // no browser drag of images/elements
  // Scale is always 100%: Ctrl/⌘ + wheel, Ctrl/⌘ + + − = 0, pinch (iOS Safari ignores user-scalable).
  window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', '_'].includes(e.key)) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && ['NumpadAdd', 'NumpadSubtract', 'Numpad0'].includes(e.code)) e.preventDefault();
  });
  ['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));
  document.querySelectorAll('img').forEach((img) => img.setAttribute('draggable', 'false'));
}
