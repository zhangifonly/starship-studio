// Shared scene coordinates (1 unit = 10 m locally), not surveyed Starbase CAD.
export const launchSite = {
  pad: { x: 0, z: 0, deckTop: 1.75, deckBottom: 1.4, radius: 1.12, opening: .53 },
  tower: { x: -2.6, z: -2.2, halfWidth: .55, height: 14.5 },
  launchBaseY: 1.8,
  skirtSupportY: .567,
  catch: { x: 0, z: -2.2, baseY: 4.2, pinBottom: 6.5, pinHeight: .12, pinReach: .76, pinRoot: .42 },
  arms: { parkedY: 7.5, halfGap: .62, width: .2, thickness: .16, length: 4.1, openAngle: .32 },
} as const;

export const catchRailY = launchSite.catch.baseY + launchSite.catch.pinBottom - launchSite.arms.thickness / 2;
export const launchRailY = launchSite.launchBaseY + launchSite.catch.pinBottom - launchSite.arms.thickness / 2;
export const launchHeading = -Math.atan2(launchSite.pad.z - launchSite.tower.z, launchSite.pad.x - launchSite.tower.x - launchSite.tower.halfWidth);
