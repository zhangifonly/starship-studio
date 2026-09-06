import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ship30Pose, ship30Attitude, shipCameraAvailable, SHIP30_HEIGHT, SHIP30_RADIUS } from '../src/ship30-state.ts';
import { createShip30 } from '../src/ship30-model.ts';
import { flight5State, overviewHash, parseOverviewHash, shipPositionAt } from '../src/flight5-timeline.ts';
import { localToGeo, geoToLocal } from '../src/mission-geo.ts';

test('S30 authored poses are bounded, seek-safe and continuous', () => {
  for (let t = 507; t <= 3940; t += .25) {
    const p = ship30Pose(t);
    for (const value of [p.pitch, p.heat, p.power, p.flap]) assert.ok(Number.isFinite(value));
    assert.ok(p.pitch >= 0 && p.pitch <= Math.PI / 2);
    for (const v of [p.heat, p.power, p.flap]) assert.ok(v >= 0 && v <= 1);
  }
  for (const t of [507, 2500, 2800, 2883, 3120, 3370, 3650, 3770, 3915, 3917, 3927, 3937, 3940]) {
    const a = ship30Pose(t - .0001), b = ship30Pose(t + .0001);
    for (const key of ['pitch', 'heat', 'power', 'flap']) assert.ok(Math.abs(a[key] - b[key]) < .001);
  }
  const first = ship30Pose(3200); ship30Pose(3940); ship30Pose(507); assert.deepEqual(ship30Pose(3200), first);
  assert.deepEqual(ship30Pose(Infinity), ship30Pose(0));
});
test('coast and atmospheric entry are unpowered, landing uses its own envelope', () => {
  assert.equal(shipCameraAvailable(506.9), false); assert.equal(shipCameraAvailable(507), true);
  for (const t of [507, 1400, 2883, 3200, 3770, 3915]) assert.equal(ship30Pose(t).power, 0);
  assert.ok(ship30Pose(3200).heat > .9); assert.equal(ship30Pose(3915).heat, 0);
  assert.ok(ship30Pose(3920).power > .9); assert.equal(ship30Pose(3940).power, 0);
  assert.equal(ship30Pose(3939.9).splash, false); assert.equal(ship30Pose(3940).splash, true);
  assert.deepEqual(ship30Pose(4000), ship30Pose(3940));
});
test('windward tiles face down/forward during entry; nose is up after flip', () => {
  for (const course of [{ x: 1, y: 0, z: 0 }, { x: .3, y: 0, z: -.8 }]) {
    for (const seconds of [507, 2883, 3200, 3800, 3915, 3920, 3940]) {
      const p = ship30Pose(seconds), q = ship30Attitude(p.pitch, course), forward = new THREE.Vector3(course.x, 0, course.z).normalize();
      const nose = new THREE.Vector3(0, 1, 0).applyQuaternion(q), shield = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      assert.ok(Math.abs(q.length() - 1) < 1e-12); assert.ok(Math.abs(nose.dot(shield)) < 1e-12);
      assert.ok(Math.abs(nose.y - Math.sin(p.pitch)) < 1e-12);
      assert.ok(Math.abs(shield.y + Math.cos(p.pitch)) < 1e-12);
      assert.ok(shield.dot(forward) >= -1e-12);
      if (seconds === 3940) assert.ok(nose.y > .99999);
    }
  }
});
test('S30 has first-generation dimensions, four flaps, windward tiles and six separate nozzles', () => {
  const model = createShip30(); model.root.updateMatrixWorld(true);
  assert.equal(SHIP30_HEIGHT, 5.03); assert.equal(SHIP30_RADIUS, .45);
  assert.equal(model.flaps.length, 4); assert.equal(model.flaps.filter(f => f.forward).length, 2);
  for (const flap of model.flaps) {
    assert.ok(flap.hinge.getObjectByName('flap-hexagonal-tiles').count > 100);
    if (flap.forward) assert.ok(Math.abs(flap.hinge.rotation.z) > .2);
  }
  assert.equal(model.engines.filter(e => e.vacuum).length, 3); assert.equal(model.engines.filter(e => !e.vacuum).length, 3);
  assert.ok(model.tiles.count > 5000 && model.tiles.count < 16000);
  const matrix = new THREE.Matrix4(), center = new THREE.Vector3();
  for (let i = 0; i < model.tiles.count; i++) { model.tiles.getMatrixAt(i, matrix); center.setFromMatrixPosition(matrix); assert.ok(center.z >= 0, 'tiles must stay on windward half'); }
  const box = new THREE.Box3().setFromObject(model.root); assert.ok(box.min.y >= -.001); assert.ok(Math.abs(box.max.y - SHIP30_HEIGHT) < .025);
  assert.equal(model.root.getObjectByName('landing-legs'), undefined);
});
test('floating origin round-trips at both sides of Earth and sharing preserves cameras', () => {
  for (const t of [120, 130, 140, 155, 170, 180]) {
    const state = flight5State(t), p = { x: -15, y: 2, z: 8 }, back = geoToLocal(localToGeo(p, state.ship), state.ship);
    for (const key of ['x', 'y', 'z']) assert.ok(Math.abs(back[key] - p[key]) < .00001);
  }
  for (const camera of ['ship-close', 'ship-heat']) assert.deepEqual(parseOverviewHash(overviewHash(146.3, camera)), { time: 146.3, camera });
});
test('terminal descent decelerates to the surface and stays continuous at both endpoints', () => {
  let previousHeight = 1500, previousStep = Infinity;
  for (let t = 3915.1; t <= 3940.01; t += .1) {
    const h = shipPositionAt(t).altitudeM, step = previousHeight - h;
    assert.ok(h >= 0 && h <= previousHeight); assert.ok(step <= previousStep + 1e-8);
    previousHeight = h; previousStep = step;
  }
  for (const t of [3915, 3940]) assert.ok(Math.abs(shipPositionAt(t - .0001).altitudeM - shipPositionAt(t + .0001).altitudeM) < .1);
  assert.equal(shipPositionAt(3940).altitudeM, 0); assert.deepEqual(shipPositionAt(4000), shipPositionAt(3940));
});
