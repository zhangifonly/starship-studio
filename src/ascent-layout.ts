import { captureSite } from './mission-data.ts';

// Preserve the existing pad's support height. The B12 exterior skirt starts
// at y=.15, unlike the separate concept model's y=.567 datum.
export const ascentSite = {
  ...captureSite,
  launchBaseY: captureSite.launchBaseY + captureSite.skirtSupportY - .15,
  skirtSupportY: .15,
};
export const ASCENT_SHIP_Y = 7.01;
export const ASCENT_RING_BOTTOM = 6.96;
export const ASCENT_RING_TOP = 7.14;
export const ascentCameraAvailable = (seconds: number) => Number.isFinite(seconds) && seconds >= 0 && seconds < 165;
export const stagingCameraAvailable = (seconds: number) => Number.isFinite(seconds) && seconds >= 153 && seconds < 165;
