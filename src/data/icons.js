// UI icons from the user's art (D52, assets/ui/guns — 128 px WebP made from the 512 px PNG sources).
const DIR = 'assets/ui/guns/';
const GUN_FILES = { pistol: 'pistol', smg: 'smg' };
const GRENADE_FILES = { frag: 'frag_grenade' };

/** Weapon icon (HUD weapon block, shop weapon cards). */
export const gunIcon = (weaponId) => `${DIR}${GUN_FILES[weaponId] || 'pistol'}.webp`;
/** Grenade icon (shop grenade cards; the HUD slots use the same files from CSS). */
export const grenadeIcon = (type) => `${DIR}${GRENADE_FILES[type] || 'frag_grenade'}.webp`;

/** Warms the image cache at start, so the first weapon swap shows the art at once. */
export function preloadIcons() {
  for (const id of Object.keys(GUN_FILES)) new Image().src = gunIcon(id);
  for (const t of Object.keys(GRENADE_FILES)) new Image().src = grenadeIcon(t);
}
