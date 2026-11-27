// Keyboard bindings → abstract actions (02_SPEC §3). Game code reads actions, never keys.
// No pause/close key: the H5 standard forbids keyboard pause (PROJECT_AUDIT.md C1).
// KILL LIST (D78): E opens a crate, G arms a grenade (the next shot throws it), 1 / 2 change the weapon.
// D83 (user request): Q = take / leave cover (it no longer changes the weapon: 1 / 2 and the HUD weapon block do).

export const KEY_BINDINGS = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  dash: ['Space'],
  interact: ['KeyE'],
  reload: ['KeyR'],
  throwGrenade: ['KeyG'],
  switchWeapon: [],
  cover: ['KeyQ'],
  // D85 stealth: Shift — run (walking is silent), C — crouch, F — takedown from behind
  run: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC'],
  takedown: ['KeyF'],
  weapon1: ['Digit1', 'Numpad1'],
  weapon2: ['Digit2', 'Numpad2'],
  weapon3: ['Digit3', 'Numpad3'], // D88: the M4A1
  weapon4: ['Digit4', 'Numpad4'], // D148: the sniper rifle (level 3)
};

export const ACTIONS = Object.keys(KEY_BINDINGS);
