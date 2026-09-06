// Shared scene coordinates (1 unit = 10 m locally), not surveyed Starbase CAD.
export const launchSite = {
  pad: { x: 0, z: 0, deckTop: 1.75, deckBottom: 1.4, radius: 1.12, opening: .53 },
  tower: { x: -3.6, z: 0, halfWidth: .8, height: 14.5, yaw: Math.PI / 4 },
  launchBaseY: 1.8,
  skirtSupportY: .567,
  catch: { x: 1.9, z: 0, baseY: 4.2, pinBottom: 6.5, pinHeight: .12, pinReach: .76, pinRoot: .42 },
  arms: { parkedY: 5.8, carriageX: .9, pivotHalfGap: .88, halfGap: .62, width: .2, thickness: .16, length: 4.95, openAngle: .36 },
  qd: { x: -2.72, z: -.66, y: 9.55, tipX: -.43, tipZ: -.13, retractAngle: .95 },
} as const;

export const catchRailY = launchSite.catch.baseY + launchSite.catch.pinBottom - launchSite.arms.thickness / 2;
export const launchRailY = launchSite.launchBaseY + launchSite.catch.pinBottom - launchSite.arms.thickness / 2;
export const launchHeading = -Math.atan2(launchSite.pad.z - launchSite.tower.z, launchSite.pad.x - launchSite.tower.x - launchSite.arms.carriageX);
