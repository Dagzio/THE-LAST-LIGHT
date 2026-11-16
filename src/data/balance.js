// Cross-system tuning values (04_ARCH §9, 02_SPEC §5–6). KILL LIST (D78): only what the mission systems use.

export const DAMAGE = {
  minDamage: 1,                // clamp
  illuminatedBonus: 0,         // no light beam in KILL LIST
  // where a bullet lands relative to the target's facing: the sides take × sideMult (D52), the back × backMult only
  // for types with rearArmor / boss
  directional: { frontCos: 0.5, backCos: -0.5, sideMult: 0.85, backMult: 0.65 },
};

export const PROJECTILES = {
  radius: 3,
  rangeSlack: 1.1,             // a bullet flies up to range × slack, then disappears
  maxHitsCap: 4,               // hard cap of distinct targets per bullet (1 + penetration)
};

export const CAPS = {
  projectiles: 200,            // hero + enemy rounds; the oldest is recycled only if the pool is full
  particles: 240,              // decorative; scaled by the quality preset
};
