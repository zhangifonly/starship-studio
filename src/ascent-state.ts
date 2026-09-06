import * as THREE from 'three';
import { ascentPositionAt, STARBASE } from './flight5-timeline.ts';
import { geoToLocal } from './mission-geo.ts';
import { ascentSite } from './ascent-layout.ts';

export const ascentObserver = new THREE.Vector3(35, 2, 90);
export function ascentPose(seconds: number) {
  const t = Number.isFinite(seconds) ? Math.max(0, Math.min(160, seconds)) : 0;
  const local = geoToLocal(ascentPositionAt(t), STARBASE);
  const before = geoToLocal(ascentPositionAt(Math.max(0, t - .1)), STARBASE);
  const after = geoToLocal(ascentPositionAt(Math.min(160, t + .1)), STARBASE);
  const direction = new THREE.Vector3(after.x - before.x, after.y - before.y, after.z - before.z).normalize();
  const quaternion = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction), THREE.MathUtils.smoothstep(t, 20, 23));
  return { seconds: t, local, quaternion, outerPower: 1 - THREE.MathUtils.smoothstep(t, 155, 159),
    armHeight: ascentSite.arms.parkedY, armOpening: 1, qdOpening: 1,
    armTarget: { x: ascentSite.pad.x, z: ascentSite.pad.z, yaw: 0 } };
}
