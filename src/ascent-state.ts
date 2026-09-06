import * as THREE from 'three';
import { ascentQuaternionAt, boosterPositionAt, shipPositionAt, stagingGapAt, STARBASE } from './flight5-timeline.ts';
import { geoToLocal } from './mission-geo.ts';
import { ascentSite } from './ascent-layout.ts';

export const ascentObserver = new THREE.Vector3(35, 2, 90);
export function ascentPose(seconds: number) {
  const t = Number.isFinite(seconds) ? Math.max(0, Math.min(165, seconds)) : 0;
  const local = geoToLocal(boosterPositionAt(t), STARBASE), shipLocal = geoToLocal(shipPositionAt(t), STARBASE);
  const quaternion = ascentQuaternionAt(t), gap = stagingGapAt(t), shipPower = THREE.MathUtils.smoothstep(t, 159, 159.8);
  return { seconds: t, local, shipLocal, quaternion, gap, shipPower, ventPower: shipPower * (1 - THREE.MathUtils.smoothstep(gap, .1, 1.8)), outerPower: 1 - THREE.MathUtils.smoothstep(t, 155, 159),
    armHeight: ascentSite.arms.parkedY, armOpening: 1, qdOpening: 1,
    armTarget: { x: ascentSite.pad.x, z: ascentSite.pad.z, yaw: 0 } };
}
