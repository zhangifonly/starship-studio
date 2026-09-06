import * as THREE from 'three';

// Retain the existing photo-guided placement; these azimuths are not surveyed B12 dimensions.
export const GRID_FIN_AZIMUTHS = [1, 3, 5, 7].map(n => n * Math.PI / 4);
export const GRID_FIN_LIMIT = THREE.MathUtils.degToRad(18);

// Authored control cues in mission seconds/degrees, not telemetry or an aerodynamic solver.
// Quiet through ascent/coast; alternate corrections on descent; settle before rail contact.
const cues = [
  [300, 0, 0, 0], [326, 8, -4, 1], [350, -7, 6, -1.5],
  [370, 6, -3, .6], [390, -4, 2, .3], [400, 2, -1, -.2],
  [408, -.8, .4, 0], [412, 0, 0, 0],
] as const;

export function gridFinAnglesAt(seconds: number): number[] {
  if (!Number.isFinite(seconds) || seconds <= cues[0][0] || seconds >= cues.at(-1)![0]) return [0, 0, 0, 0];
  const index = cues.findIndex(cue => cue[0] > seconds), a = cues[index - 1], b = cues[index];
  const t = (seconds - a[0]) / (b[0] - a[0]), s = t * t * (3 - 2 * t);
  const pitch = THREE.MathUtils.lerp(a[1], b[1], s), yaw = THREE.MathUtils.lerp(a[2], b[2], s), roll = THREE.MathUtils.lerp(a[3], b[3], s);
  return GRID_FIN_AZIMUTHS.map(angle => THREE.MathUtils.clamp(THREE.MathUtils.degToRad(pitch * Math.cos(angle) + yaw * Math.sin(angle) + roll), -GRID_FIN_LIMIT, GRID_FIN_LIMIT));
}

export function createGridFins(edge: THREE.Material, dark: THREE.Material) {
  const root = new THREE.Group(); root.name = 'four-grid-fins';
  const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edge, 80);
  parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parts.castShadow = parts.receiveShadow = true; root.add(parts);
  const bar = new THREE.Object3D(), assembly = new THREE.Object3D(), matrix = new THREE.Matrix4();
  const bars: THREE.Matrix4[] = [];
  for (let j = 0; j < 10; j++) for (const cross of [false, true]) {
    bar.position.set(cross ? 0 : -.28 + j * .56 / 9, 0, cross ? .04 + j * .63 / 9 : .355);
    bar.scale.set(cross ? .59 : .014, .095, cross ? .014 : .66); bar.updateMatrix(); bars.push(bar.matrix.clone());
  }
  const bearing = new THREE.BoxGeometry(.18, .18, .17), shaft = new THREE.CylinderGeometry(.037, .037, .18, 12);
  for (const angle of GRID_FIN_AZIMUTHS) {
    const housing = new THREE.Mesh(bearing, dark);
    housing.position.set(Math.sin(angle) * .46, 6.72, Math.cos(angle) * .46);
    housing.castShadow = housing.receiveShadow = true; root.add(housing);
    const axle = new THREE.Mesh(shaft, edge);
    axle.position.set(Math.sin(angle) * .50, 6.75, Math.cos(angle) * .50);
    axle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)));
    axle.castShadow = axle.receiveShadow = true; root.add(axle);
  }
  let angles: number[] = [];
  function update(seconds: number) {
    const next = gridFinAnglesAt(seconds);
    if (next.every((angle, i) => angle === angles[i])) return angles;
    GRID_FIN_AZIMUTHS.forEach((azimuth, i) => {
      assembly.position.set(Math.sin(azimuth) * .43, 6.75, Math.cos(azimuth) * .43);
      // Local Z is the radial actuator shaft: rotate the grid, never fold its span against the hull.
      assembly.rotation.set(0, azimuth, next[i], 'XYZ'); assembly.updateMatrix();
      bars.forEach((local, j) => parts.setMatrixAt(i * 20 + j, matrix.multiplyMatrices(assembly.matrix, local)));
    });
    parts.instanceMatrix.needsUpdate = true;
    parts.computeBoundingSphere();
    angles = next; return angles;
  }
  update(0);
  return { root, parts, update };
}
