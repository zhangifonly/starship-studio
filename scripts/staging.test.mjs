import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ascentPose } from '../src/ascent-state.ts';
import { ASCENT_SHIP_Y, stagingCameraAvailable } from '../src/ascent-layout.ts';
import { shipPositionAt, boosterPositionAt, stagingGapAt, shipGuide, boosterGuide, guidePosition, STARBASE, overviewHash, parseOverviewHash } from '../src/flight5-timeline.ts';
import { geoToLocal, geodeticToEcef } from '../src/mission-geo.ts';

test('upper stage ignites while still attached and B12 retains its three central engines', () => {
  assert.equal(ascentPose(159).shipPower, 0);
  const p = ascentPose(159.8); assert.equal(p.outerPower, 0); assert.equal(p.shipPower, 1); assert.equal(p.gap, 0); assert.equal(p.ventPower, 1);
  assert.ok(ascentPose(162).shipPower > .99); assert.ok(ascentPose(162).ventPower > 0);
});
test('global stage roots match the rendered assembly and opening gap in metres', () => {
  let previous = -1;
  for (let t = 159; t <= 165; t += .01) {
    const p = ascentPose(t), a = geoToLocal(boosterPositionAt(t), STARBASE), b = geoToLocal(shipPositionAt(t), STARBASE);
    const delta = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).applyQuaternion(p.quaternion.clone().invert());
    assert.ok(Math.abs(delta.x) < 1e-5 && Math.abs(delta.z) < 1e-5);
    assert.ok(Math.abs(delta.y - ASCENT_SHIP_Y - p.gap) < 1e-5);
    assert.ok(p.gap >= previous); previous = p.gap;
  }
  assert.equal(stagingGapAt(160), 0); assert.equal(stagingGapAt(165) * 10, 37.5);
});
test('both trajectories remain position-continuous at separation and both bridge ends', () => {
  for (const position of [boosterPositionAt, shipPositionAt]) for (const t of [160, 165, 223]) {
    const a = geodeticToEcef(position(t - .0001)), b = geodeticToEcef(position(t + .0001));
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 2);
  }
});
test('bridge joins preserve velocity and later geography stays unchanged', () => {
  const vector = p => { const e = geodeticToEcef(p); return new THREE.Vector3(e.x, e.y, e.z); };
  for (const [position, guide] of [[boosterPositionAt, boosterGuide], [shipPositionAt, shipGuide]]) {
    for (const t of [165, 223]) {
      const now = vector(position(t)), before = now.clone().sub(vector(position(t - .001))).multiplyScalar(1000), after = vector(position(t + .001)).sub(now).multiplyScalar(1000);
      assert.ok(before.distanceTo(after) < 2, `velocity discontinuity at ${t}`);
    }
    for (const t of [223, 240, 280, 300, 379]) assert.deepEqual(position(t), guidePosition(guide, t));
    for (let t = 160; t <= 223; t += .1) { const p = position(t); assert.ok(p.altitudeM > 60000 && p.altitudeM < 110000); }
  }
});
test('separation state is deterministic and the hot-stage ring remains attached to B12', () => {
  const first = ascentPose(162.5); ascentPose(165); ascentPose(0); assert.deepEqual(ascentPose(162.5), first);
  assert.ok(first.gap > 0); assert.equal(first.outerPower, 0);
  assert.equal(stagingCameraAvailable(152.9), false); assert.equal(stagingCameraAvailable(153), true); assert.equal(stagingCameraAvailable(165), false);
  assert.deepEqual(parseOverviewHash(overviewHash(28, 'staging')), { time: 28, camera: 'staging' });
});
