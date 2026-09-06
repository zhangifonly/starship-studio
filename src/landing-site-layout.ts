import { EARTH_RADIUS, seaLevel } from './world-scale.ts';

// Concept platform and landing supports, not a flown Starship configuration.
export const landingSite = {
  x: 298, y: seaLevel(298) + .03, angle: -Math.asin(298 / EARTH_RADIUS),
  width: 6.2, length: 10.4, deckY: .42, hullBottom: -.22,
  footBottom: -.28, footThickness: .08, footRadius: 1.12,
} as const;

export function landingSitePoint(x: number, y: number, z = 0) {
  const c = Math.cos(landingSite.angle), s = Math.sin(landingSite.angle);
  return { x: landingSite.x + c * x - s * y, y: landingSite.y + s * x + c * y, z };
}
export const shipTouchdown = landingSitePoint(0, landingSite.deckY - landingSite.footBottom);
