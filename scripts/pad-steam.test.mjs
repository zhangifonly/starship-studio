import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPadSteam, padSteamState, STEAM_COUNT } from '../src/pad-steam.ts';

test('steam has finite single-shot birth, growth and fade without teleporting', () => {
  for (let i = 0; i < STEAM_COUNT; i++) {
    assert.equal(padSteamState(-1, i).opacity, 0);
    assert.equal(padSteamState(60, i).opacity, 0);
    assert.deepEqual(padSteamState(NaN, i), padSteamState(-1, i));
    for (let t = 0; t < 60; t += .1) {
      const a = padSteamState(t, i), b = padSteamState(t + .001, i);
      assert.ok(Object.values(a).every(Number.isFinite));
      assert.ok(a.opacity >= 0 && a.opacity <= .78);
      assert.ok(Math.abs(a.opacity - b.opacity) < .002);
      for (const k of ['x', 'y', 'z', 'width', 'height']) assert.ok(Math.abs(a[k] - b[k]) < .002);
    }
  }
});
test('cloud stays pad-relative, survives liftoff and restores exact matrices after seek or camera change', () => {
  const pad = { x: 8, z: -7 }, steam = createPadSteam(pad), camera = new THREE.PerspectiveCamera();
  camera.position.set(12, 8, 30); camera.lookAt(0, 4, 0);
  assert.equal(steam.update(-1, camera), 0); assert.equal(steam.mesh.visible, false);
  assert.ok(steam.update(12, camera) > 40);
  const matrix = new THREE.Matrix4(), center = new THREE.Vector3();
  let radius = 0;
  for (let i = 0; i < STEAM_COUNT; i++) {
    steam.mesh.getMatrixAt(i, matrix); center.setFromMatrixPosition(matrix);
    radius = Math.max(radius, Math.hypot(center.x - pad.x, center.z - pad.z));
  }
  assert.ok(radius < 7 && radius > 4);
  const matrices = Array.from(steam.mesh.instanceMatrix.array), data = Array.from(steam.mesh.geometry.attributes.steamData.array);
  assert.ok(steam.update(32, camera) > 0);
  assert.equal(steam.update(60, camera), 0);
  camera.position.set(0, 30, 0); camera.lookAt(0, 0, 0); steam.update(12, camera);
  camera.position.set(12, 8, 30); camera.lookAt(0, 4, 0); steam.update(12, camera);
  assert.deepEqual(Array.from(steam.mesh.instanceMatrix.array), matrices);
  assert.deepEqual(Array.from(steam.mesh.geometry.attributes.steamData.array), data);
  assert.equal(steam.mesh.material.depthWrite, false); assert.equal(steam.mesh.material.depthTest, true);
  steam.mesh.geometry.dispose(); steam.mesh.material.dispose(); steam.mesh.dispose();
});
