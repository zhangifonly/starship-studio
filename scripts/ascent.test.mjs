import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ascentSite, ascentCameraAvailable, ASCENT_RING_BOTTOM, ASCENT_RING_TOP, ASCENT_SHIP_Y } from '../src/ascent-layout.ts';
import { ascentPose } from '../src/ascent-state.ts';
import { ascentPositionAt, boosterPositionAt, shipPositionAt, STARBASE, overviewHash, parseOverviewHash } from '../src/flight5-timeline.ts';
import { geoToLocal, geodeticToEcef } from '../src/mission-geo.ts';
import { captureSite } from '../src/mission-data.ts';
import { createLaunchSite } from '../src/launch-site.ts';

test('stack starts over the preserved support deck and S30 global origin includes its physical offset', () => {
  const p = geoToLocal(ascentPositionAt(0), STARBASE);
  assert.ok(Math.abs(p.x - ascentSite.pad.x) < 1e-6); assert.ok(Math.abs(p.z - ascentSite.pad.z) < 1e-6);
  assert.ok(Math.abs(p.y + .15 - captureSite.launchBaseY - captureSite.skirtSupportY) < 1e-6);
  for (let t = 0; t <= 160; t += .25) {
    const booster = geoToLocal(boosterPositionAt(t), STARBASE), ship = geoToLocal(shipPositionAt(t), STARBASE);
    const offset = new THREE.Vector3(ship.x - booster.x, ship.y - booster.y, ship.z - booster.z).applyQuaternion(ascentPose(t).quaternion.clone().invert());
    assert.ok(Math.abs(offset.x) < 1e-6 && Math.abs(offset.z) < 1e-6 && Math.abs(offset.y - ASCENT_SHIP_Y) < 1e-6);
  }
});
test('authored climb accelerates from rest and clears the tower before downrange travel', () => {
  const start = ascentPositionAt(0); let altitude = start.altitudeM;
  for (let t = 0; t <= 160; t += .1) {
    const p = ascentPositionAt(t); assert.ok(p.altitudeM >= altitude); altitude = p.altitudeM;
    if (t <= 20) { assert.ok(Math.abs(p.lat - start.lat) < 1e-9); assert.ok(Math.abs(p.lon - start.lon) < 1e-9); }
  }
  assert.ok((ascentPositionAt(.01).altitudeM - start.altitudeM) / .01 < .01);
  assert.ok(ascentPositionAt(20).altitudeM > ascentSite.tower.height * 10 + 100);
  assert.equal(ascentPositionAt(160).altitudeM, 69000);
});
test('new ascent joins unchanged separation endpoint continuously', () => {
  for (const position of [boosterPositionAt, shipPositionAt]) {
    const a = geodeticToEcef(position(159.9999)), b = geodeticToEcef(position(160.0001));
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1);
  }
  assert.deepEqual(ascentPositionAt(Infinity), ascentPositionAt(0));
  assert.deepEqual(ascentPositionAt(-3), ascentPositionAt(0));
});
test('attitude is vertical near the tower and deterministic through pitch-over', () => {
  for (let t = 0; t < 160; t += .25) {
    const p = ascentPose(t), up = new THREE.Vector3(0, 1, 0).applyQuaternion(p.quaternion);
    assert.ok(Number.isFinite(up.y)); assert.ok(Math.abs(p.quaternion.length() - 1) < 1e-10);
    if (t <= 20) assert.ok(up.y > .999999);
    assert.ok(up.y > .5); assert.equal(p.armOpening, 1); assert.equal(p.qdOpening, 1);
  }
  const original = ascentPose(60); ascentPose(159); assert.deepEqual(ascentPose(60), original);
  assert.ok(ascentPose(20.001).quaternion.angleTo(ascentPose(19.999).quaternion) < .002);
  assert.equal(ascentPose(155).outerPower, 1); assert.equal(ascentPose(159).outerPower, 0);
});
test('mount supports touch the skirt circumference and exhaust center stays open', () => {
  const material = new THREE.MeshBasicMaterial(), site = createLaunchSite(material, material, material, ascentSite);
  site.update(ascentPose(0)); site.root.updateMatrixWorld(true);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, p = new THREE.Vector3(ascentSite.pad.x + Math.sin(a) * .465, ascentSite.launchBaseY + .15, ascentSite.pad.z + Math.cos(a) * .465);
    const hit = new THREE.Raycaster(p.clone().add(new THREE.Vector3(0, .1, 0)), new THREE.Vector3(0, -1, 0)).intersectObjects(site.supports)[0];
    assert.ok(hit && Math.abs(hit.distance - .1) < 1e-6);
  }
  const ray = new THREE.Raycaster(new THREE.Vector3(ascentSite.pad.x, 4, ascentSite.pad.z), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(site.mount, true).length, 0);
});
test('open arm trusses and retracted umbilical clear the vertical launch column', () => {
  const material = new THREE.MeshBasicMaterial(), site = createLaunchSite(material, material, material, ascentSite);
  site.update(ascentPose(0)); site.root.updateMatrixWorld(true);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const root of [...site.arms.map(a => a.pivot), site.qd]) root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position, indices = mesh.geometry.index, count = indices ? indices.count : positions.count;
    for (let i = 0; i < count; i += 3) for (let edge = 0; edge < 3; edge++) {
      const ia = i + edge, ib = i + (edge + 1) % 3;
      a.fromBufferAttribute(positions, indices ? indices.getX(ia) : ia).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(positions, indices ? indices.getX(ib) : ib).applyMatrix4(mesh.matrixWorld);
      const dx = b.x - a.x, dz = b.z - a.z;
      const f = Math.max(0, Math.min(1, -((a.x - ascentSite.pad.x) * dx + (a.z - ascentSite.pad.z) * dz) / (dx * dx + dz * dz || 1)));
      assert.ok(Math.hypot(a.x + f * dx - ascentSite.pad.x, a.z + f * dz - ascentSite.pad.z) > .49);
    }
  });
});
test('hot-stage collar is 1.8 m tall and sits above the ascent thermal shield', () => {
  assert.ok(ASCENT_RING_BOTTOM < 7.07 && ASCENT_RING_TOP > 7.07);
  assert.ok(ASCENT_SHIP_Y > 6.945 + .05); assert.ok(Math.abs(ASCENT_SHIP_Y + .11 - ASCENT_RING_TOP) < .03);
  assert.ok(Math.abs(ASCENT_RING_TOP - ASCENT_RING_BOTTOM - .18) < 1e-8);
  assert.equal(ascentCameraAvailable(164.9), true); assert.equal(ascentCameraAvailable(165), false); assert.equal(ascentCameraAvailable(NaN), false);
  for (const camera of ['ascent', 'ascent-ground']) assert.deepEqual(parseOverviewHash(overviewHash(5.5, camera)), { time: 5.5, camera });
});
