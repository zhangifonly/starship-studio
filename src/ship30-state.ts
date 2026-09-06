import * as THREE from 'three';
import type { XYZ } from './mission-geo.ts';

export const SHIP30_HEIGHT = 5.03;
export const SHIP30_RADIUS = .45;
export const shipCameraAvailable = (seconds: number) => seconds >= 507;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };

// Authored attitude/effect envelope, NOT measured pitch, heat flux or thrust.
// Pitch is above the local horizontal; +Z is the body's windward/tiled side.
export function ship30Pose(seconds: number) {
  const t = Number.isFinite(seconds) ? Math.max(0, Math.min(3940, seconds)) : 0;
  const entry = smooth((t - 2500) / 383), descent = smooth((t - 3650) / 265), flip = smooth((t - 3915) / 12);
  const pitch = ((12 + 28 * entry) * (1 - descent) * (1 - flip) + 90 * flip) * Math.PI / 180;
  const heat = smooth((t - 2800) / 320) * (1 - smooth((t - 3370) / 400));
  const power = smooth((t - 3915) / 2) * (1 - smooth((t - 3937) / 3));
  const flap = (.16 + .20 * entry + .25 * descent) * (1 - flip) + .16 * flip;
  return { seconds: t, pitch, heat, power, flap, splash: t >= 3940,
    phase: t >= 3940 ? '入水瞬间' : t >= 3915 ? '翻转减速' : t >= 3770 ? '腹部下降' : t >= 2800 ? '再入重建' : '亚轨道滑行' };
}

export function ship30Attitude(pitch: number, course: XYZ) {
  const forward = new THREE.Vector3(course.x, 0, course.z).normalize();
  if (forward.lengthSq() < .5) forward.set(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const nose = forward.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch));
  const windward = forward.clone().multiplyScalar(Math.sin(pitch)).addScaledVector(up, -Math.cos(pitch));
  const right = new THREE.Vector3().crossVectors(nose, windward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, nose, windward));
}

export function ship30RadiusAt(y: number) {
  if (y <= 3.38) return SHIP30_RADIUS;
  const t = clamp((y - 3.38) / (SHIP30_HEIGHT - 3.38));
  return SHIP30_RADIUS * Math.cos(t * Math.PI / 2);
}
