// Rotating beacon light (02_SPEC §7): a mathematical sector test (dot product vs cos(half angle)), no raycasts.
// Illuminated lasts `illuminatedLinger` after leaving the beam — the renderer uses the SAME beamAngle()/params,
// so the visible sector always matches the detection.
import { BEACON } from '../data/beacon.js';

const TAU = Math.PI * 2;

/** Beam direction (radians, world x/y plane) at game time `time`. */
export function beamAngle(time, light = BEACON.light) {
  return light.startAngle + ((time % light.rotationPeriod) / light.rotationPeriod) * TAU;
}

/** Pure sector test: is the point (x, y) inside the beam? */
export function inBeam(bx, by, x, y, angle, halfAngle, range) {
  const dx = x - bx, dy = y - by;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) return false;
  if (d2 < 1e-6) return true;
  const d = Math.sqrt(d2);
  return (dx * Math.cos(angle) + dy * Math.sin(angle)) / d >= Math.cos(halfAngle);
}

export class LightSystem {
  constructor(light = BEACON.light) {
    this.light = light;
    this.extraWidthDeg = 0;    // temporary perk BEACON_FOCUS (+10°, Phase 6)
    this.angle = light.startAngle;
  }

  get halfAngle() { return (((this.light.sectorDeg + this.extraWidthDeg) * Math.PI) / 180) / 2; }

  /** @param {import('../entities/Beacon.js').Beacon} beacon */
  update(beacon, enemies, time) {
    this.angle = beamAngle(time, this.light);
    const half = this.halfAngle, range = this.light.range, linger = this.light.illuminatedLinger;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) { e.illuminated = false; continue; }
      // max(): a longer Illuminated from the Emergency Flare is never shortened by the beam
      if (inBeam(beacon.x, beacon.y, e.x, e.y, this.angle, half, range)) e.illuminatedUntil = Math.max(e.illuminatedUntil, time + linger);
      e.illuminated = time < e.illuminatedUntil;
    }
  }
}
