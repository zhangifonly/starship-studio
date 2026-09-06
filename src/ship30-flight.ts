import * as THREE from 'three';
import { ascentQuaternionAt, guidePosition, shipGuide, STARBASE } from './flight5-timeline.ts';
import { ecefDirectionToEnu, enuBasis, geoToLocal, type GeoPoint } from './mission-geo.ts';
import { ship30Attitude, ship30Pose } from './ship30-state.ts';

// An authored attitude bridge, not guidance solved from the schematic trajectory.
// Preserve the existing coast/entry pose exactly from 507 s onward.
export function ship30FlightFrame(seconds: number, origin: GeoPoint) {
  const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const sample = Math.min(3850, Math.max(567, t));
  const before = geoToLocal(guidePosition(shipGuide, sample - 60), origin), after = geoToLocal(guidePosition(shipGuide, sample + 60), origin);
  const course = new THREE.Vector3(after.x - before.x, 0, after.z - before.z).normalize();
  const coast = ship30Attitude(ship30Pose(t).pitch, course);
  if (t >= 507) return { course, quaternion: coast };
  const basis = enuBasis(STARBASE), initial = ascentQuaternionAt(160);
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map(axis => {
    axis.applyQuaternion(initial);
    const ecef = { x: axis.x * basis.east.x + axis.y * basis.up.x - axis.z * basis.north.x,
      y: axis.x * basis.east.y + axis.y * basis.up.y - axis.z * basis.north.y,
      z: axis.x * basis.east.z + axis.y * basis.up.z - axis.z * basis.north.z };
    const local = ecefDirectionToEnu(ecef, origin); return new THREE.Vector3(local.x, local.z, -local.y);
  });
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(axes[0], axes[1], axes[2]));
  quaternion.slerp(coast, THREE.MathUtils.smoothstep(t, 165, 507));
  return { course, quaternion };
}
