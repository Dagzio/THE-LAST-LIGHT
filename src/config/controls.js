// Keyboard bindings → abstract actions (02_SPEC §3). Game code reads actions, never keys.
// No pause/close key: the H5 standard forbids keyboard pause (PROJECT_AUDIT.md C1).
// KILL LIST (D78): E opens a crate, G arms a grenade (the next shot throws it), Q / 1 / 2 change the weapon.

export const KEY_BINDINGS = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  dash: ['Space'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  throwGrenade: ['KeyG'],
  switchWeapon: ['KeyQ'],
  weapon1: ['Digit1', 'Numpad1'],
  weapon2: ['Digit2', 'Numpad2'],
};

export const ACTIONS = Object.keys(KEY_BINDINGS);
