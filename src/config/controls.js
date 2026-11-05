// Keyboard bindings → abstract actions (02_SPEC §3). Game code reads actions, never keys.
// No pause/close key: the H5 standard forbids keyboard pause (PROJECT_AUDIT.md C1).
// 'flare' is reserved for Phase 4b (Emergency Flare).

export const KEY_BINDINGS = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  dash: ['Space'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  throwGrenade: ['KeyG'],
  flare: ['KeyQ'],
  grenade1: ['Digit1', 'Numpad1'],
  grenade2: ['Digit2', 'Numpad2'],
  grenade3: ['Digit3', 'Numpad3'],
};

export const ACTIONS = Object.keys(KEY_BINDINGS);
