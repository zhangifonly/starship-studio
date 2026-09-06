import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGridFins, gridFinAnglesAt, GRID_FIN_AZIMUTHS, GRID_FIN_LIMIT } from '../src/grid-fins.ts';
import { captureState, captureSite } from '../src/mission-data.ts';
import { captureClipAt, overviewHash, parseOverviewHash, isReturnCamera } from '../src/flight5-timeline.ts';
import { createLaunchSite } from '../src/launch-site.ts';

test('fins stay neutral on ascent/coast and settle before capture', () => {
  for (const t of [NaN, Infinity, -1, 0, 155, 160, 223, 300, 412, 414, 3940]) assert.deepEqual(gridFinAnglesAt(t), [0, 0, 0, 0]);
  const angles = gridFinAnglesAt(350);
  assert.equal(new Set(angles).size, 4);
  assert.ok(angles.some(a => a > .05) && angles.some(a => a < -.05));
});

test('control cues are bounded, continuous and seek independent', () => {
  let previous = gridFinAnglesAt(0);
  for (let t = 0; t < 430; t += .01) {
    const angles = gridFinAnglesAt(t);
    angles.forEach((a, i) => {
      assert.ok(Number.isFinite(a) && Math.abs(a) <= GRID_FIN_LIMIT);
      assert.ok(Math.abs(a - previous[i]) < .001);
    });
    previous = angles;
  }
  for (const t of [300, 326, 350, 370, 390, 400, 408, 412]) {
    const a = gridFinAnglesAt(t - .001), b = gridFinAnglesAt(t), c = gridFinAnglesAt(t + .001);
    b.forEach((value, i) => assert.ok(Math.abs(c[i] - 2 * value + a[i]) < 1e-6));
  }
  const initial = gridFinAnglesAt(350); gridFinAnglesAt(414); gridFinAnglesAt(390);
  assert.deepEqual(gridFinAnglesAt(350), initial);
});

test('instanced geometry rotates independently around radial shafts, never folds', () => {
  const material = new THREE.MeshBasicMaterial(), fins = createGridFins(material, material);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), normal = new THREE.Vector3();
  assert.equal(fins.parts.count, 80);
  for (const t of [0, 326, 350, 390, 408, 414]) {
    const angles = fins.update(t);
    for (let i = 0; i < 4; i++) {
      const azimuth = GRID_FIN_AZIMUTHS[i], radial = new THREE.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth));
      const hinge = radial.clone().multiplyScalar(.43); hinge.y = 6.75;
      for (let j = 0; j < 20; j++) {
        fins.parts.getMatrixAt(i * 20 + j, matrix);
        position.setFromMatrixPosition(matrix).sub(hinge);
        const expectedSpan = j % 2 ? .04 + Math.floor(j / 2) * .63 / 9 : .355;
        assert.ok(Math.abs(position.dot(radial) - expectedSpan) < 1e-6, `fold at ${t}/${i}/${j}`);
        normal.set(0, 1, 0).transformDirection(matrix);
        assert.ok(Math.abs(normal.dot(radial)) < 1e-6);
        assert.ok(Math.abs(normal.y - Math.cos(angles[i])) < 1e-6);
      }
    }
  }
});

test('moving mesh rewinds exactly and neutral geometry preserves existing placement', () => {
  const material = new THREE.MeshBasicMaterial(), fins = createGridFins(material, material);
  const neutral = fins.parts.instanceMatrix.array.slice();
  fins.update(350); const turning = fins.parts.instanceMatrix.array.slice();
  assert.notDeepEqual(turning, neutral);
  fins.update(414); assert.deepEqual(fins.parts.instanceMatrix.array, neutral);
  fins.update(350); assert.deepEqual(fins.parts.instanceMatrix.array, turning);
  const matrix = new THREE.Matrix4(), bar = new THREE.Object3D(), assembly = new THREE.Object3D();
  fins.update(0);
  GRID_FIN_AZIMUTHS.forEach((azimuth, i) => {
    assembly.position.set(Math.sin(azimuth) * .43, 6.75, Math.cos(azimuth) * .43); assembly.rotation.y = azimuth; assembly.updateMatrix();
    for (let j = 0; j < 20; j++) {
      const cross = j % 2, index = Math.floor(j / 2);
      bar.position.set(cross ? 0 : -.28 + index * .56 / 9, 0, cross ? .04 + index * .63 / 9 : .355);
      bar.scale.set(cross ? .59 : .014, .095, cross ? .014 : .66); bar.updateMatrix();
      const expected = new THREE.Matrix4().multiplyMatrices(assembly.matrix, bar.matrix);
      fins.parts.getMatrixAt(i * 20 + j, matrix);
      matrix.elements.forEach((n, k) => assert.ok(Math.abs(n - expected.elements[k]) < 1e-6));
    }
  });
});

test('grid bars stay outside hull and clear catch arms throughout final approach', () => {
  const material = new THREE.MeshBasicMaterial(), fins = createGridFins(material, material);
  const site = createLaunchSite(material, material, material, captureSite), booster = new THREE.Object3D();
  const matrix = new THREE.Matrix4(), world = new THREE.Matrix4(), point = new THREE.Vector3();
  const box = new THREE.Box3(new THREE.Vector3(-.5, -.5, -.5), new THREE.Vector3(.5, .5, .5));
  for (let t = 0; t <= 35; t += .25) {
    const state = captureState(t); site.update(state); site.root.updateMatrixWorld(true);
    booster.position.set(state.x, state.y, state.z); booster.rotation.z = state.angle; booster.updateMatrixWorld(true);
    fins.update(390 + t * 24 / 23);
    const armBoxes = [];
    site.arms.forEach(({ pivot }) => pivot.traverse(mesh => { if (mesh.isMesh) armBoxes.push(new THREE.Box3().setFromObject(mesh)); }));
    for (let i = 0; i < 80; i++) {
      fins.parts.getMatrixAt(i, matrix);
      for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
        point.set(x, y, z).applyMatrix4(matrix);
        assert.ok(Math.hypot(point.x, point.z) > .45);
      }
      world.multiplyMatrices(booster.matrixWorld, matrix);
      const finBox = box.clone().applyMatrix4(world);
      armBoxes.forEach(arm => assert.ok(!finBox.intersectsBox(arm), `fin/arm overlap ${t}/${i}`));
    }
  }
});

test('overview and standalone capture use identical fin poses at matching times', () => {
  assert.equal(isReturnCamera('fins'), true);
  assert.deepEqual(parseOverviewHash(overviewHash(75, 'fins')), { time: 75, camera: 'fins' });
  for (let seconds = 390; seconds <= 426; seconds += .1) {
    const clipTime = captureClipAt(seconds);
    const a = gridFinAnglesAt(seconds), b = gridFinAnglesAt(390 + clipTime * 24 / 23);
    a.forEach((angle, i) => assert.ok(Math.abs(angle - b[i]) < 1e-10));
  }
});
