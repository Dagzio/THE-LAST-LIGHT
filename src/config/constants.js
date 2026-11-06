// Global, non-balance constants of the runtime. Balance numbers live in src/data.

/** H5 standard: debug tools only in a disabled state in the project. Set true locally to see the debug overlay. */
export const DEBUG_ENABLED = false;

/** Dev 3D asset viewer (H5 3D guide: asset-viewer-3d.md). TRUE while the user works with models — MUST be false in a release. */
export const DEBUG_MODELS = true;

export const BUILD_VERSION = '0.5.1-collisions';

/** Prefix for every localStorage key of the game (H5 §9). */
export const STORAGE_PREFIX = 'tll.';

/** Logical world size (CSS-independent). The whole arena always fits on screen (fit + extended surround). */
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

/** Fixed simulation step and frame-delta clamp (04_ARCH §5). */
export const FIXED_STEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.1;

/** Splash: delay before TAP TO PLAY becomes active (H5 §1, vanilla.md §2). UI timing, not gameplay. */
export const SPLASH_TAP_DELAY_MS = 1500;

/** Music playlist (files provided by the user later, assets/audio/music/). Empty = no music, system still ready. */
export const MUSIC_TRACKS = [];
