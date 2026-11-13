// Top-down 3D camera (user decision: almost vertical with a slight tilt, follows the player, the map is not
// visible at once; visible area like the reference screenshot ≈ 750 units wide).

export const CAMERA = {
  fov: 30,               // vertical field of view, degrees (narrow → little perspective distortion)
  tilt: 15,              // degrees from the vertical: the camera sits a bit "south" and looks slightly north
  minViewWidth: 750,     // world units always visible horizontally (16:9 → 750 × 422)
  minViewHeight: 422,    // world units always visible vertically (wider screens see more to the sides)
  followHalfLife: 0.1,   // s — smoothing of the follow (0 = rigid)
  edgeMargin: 90,        // how far past the map edge the camera may show (the decorative shore)
  near: 20,
  far: 5000,
};

/** D74 (user decision): the mobile version sees the hero closer (≈ 1.28×) — phones are small and wide (20:9 saw
 *  937 × 422 units with the desktop numbers). The same camera otherwise. */
export const CAMERA_TOUCH = { ...CAMERA, minViewWidth: 586, minViewHeight: 330 };
