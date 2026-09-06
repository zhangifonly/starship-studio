import test from 'node:test';
import assert from 'node:assert/strict';
import { launchState, launchPhases, phaseAt, LAUNCH_DURATION, seaLevel } from '../src/launch-timeline.ts';
import * as THREE from 'three';
import { createCatchPins, createLaunchSite } from '../src/launch-site.ts';
import { launchSite } from '../src/launch-site-layout.ts';

test('timeline stays finite and bounded through every stage', () => {
  for (let t = 0; t <= LAUNCH_DURATION; t += .1) {
    const state = launchState(t);
    for (const body of [state.ship, state.booster]) for (const value of Object.values(body)) assert.ok(Number.isFinite(value));
    for (const name of ['boosterPower', 'shipPower', 'heating', 'splash', 'separation']) assert.ok(state[name] >= 0 && state[name] <= 1);
  }
  assert.deepEqual(launchState(-100), launchState(0));
  assert.deepEqual(launchState(999), launchState(LAUNCH_DURATION));
});
test('all phase boundaries select the expected stage', () => {
  launchPhases.forEach((phase, index) => { assert.equal(phaseAt(phase.start), index); if (index) assert.equal(phaseAt(phase.start - .001), index - 1); });
});
test('ship separation is position-continuous and reversible', () => {
  for (const t of [42, 44, 52, 94, 112, 136, 154]) {
    const before = launchState(t - .0001).ship, after = launchState(t + .0001).ship;
    assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < .01, `discontinuity at ${t}`);
  }
  const initial = launchState(0);
  launchState(166); launchState(112); launchState(89);
  assert.deepEqual(launchState(0), initial);
  assert.equal(initial.captured, false); assert.equal(initial.landed, false);
});
test('booster is captured and shut down; ship touches the sea and shuts down', () => {
  const caught = launchState(90), landed = launchState(166);
  assert.equal(caught.captured, true); assert.equal(caught.boosterPower, 0);
  assert.equal(caught.booster.x, 0); assert.equal(caught.booster.angle, 0);
  assert.equal(landed.landed, true); assert.equal(landed.shipPower, 0);
  assert.ok(Math.abs(landed.ship.y - seaLevel(landed.ship.x)) < .1);
  assert.ok(launchState(120).heating > .5);
  assert.equal(landed.heating, 0);
});

const material = new THREE.MeshBasicMaterial();
const site = createLaunchSite(material, material, material);
const pins = createCatchPins(material);
const bounds = object => new THREE.Box3().setFromObject(object);
test('launch mount supports the skirt and leaves an open exhaust path', () => {
  site.update(launchState(0)); site.root.updateMatrixWorld(true);
  const seated = launchState(0).booster;
  for (const support of site.supports) {
    assert.ok(Math.abs(bounds(support).max.y - seated.y - launchSite.skirtSupportY) < 1e-6);
  }
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 4, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObjects(site.mount.children, true).length, 0, 'solid deck blocks engine exhaust');
  ray.ray.origin.x = .8;
  assert.ok(ray.intersectObject(site.deck).length > 0, 'mount annulus is missing');
});
test('liftoff is vertical until the whole booster clears the tower', () => {
  for (let t = 0; t <= 24; t += .05) {
    const { booster } = launchState(t);
    assert.equal(booster.x, launchSite.pad.x); assert.equal(booster.z, launchSite.pad.z);
    assert.equal(booster.angle, 0);
    if (t <= 12) assert.ok(Math.abs(booster.y - launchSite.launchBaseY) < 1e-9);
    site.update(launchState(t)); site.root.updateMatrixWorld(true);
    for (const { rail } of site.arms) {
      const start = rail.localToWorld(new THREE.Vector3(-launchSite.arms.length / 2, 0, 0));
      const end = rail.localToWorld(new THREE.Vector3(launchSite.arms.length / 2, 0, 0));
      const center = new THREE.Vector3(booster.x, start.y, booster.z);
      const closest = new THREE.Line3(start, end).closestPointToPoint(center, true, new THREE.Vector3());
      assert.ok(closest.distanceTo(center) > .49 + launchSite.arms.width / 2, 'parked rail intersects the launch column');
    }
  }
  assert.ok(launchState(24).booster.y > launchSite.tower.height);
});
test('return corridor clears the mount and each catch pin seats on its own rail', () => {
  for (const t of [82, 84, 86, 88, 89, 90, 166]) {
    const state = launchState(t), { booster } = state;
    site.update(state); site.root.updateMatrixWorld(true);
    pins.position.set(booster.x, booster.y, booster.z); pins.rotation.set(0, booster.yaw, booster.angle, 'ZYX'); pins.updateMatrixWorld(true);
    assert.equal(booster.z, launchSite.catch.z);
    assert.ok(Math.hypot(booster.x - launchSite.pad.x, booster.z - launchSite.pad.z) > launchSite.pad.radius + .49);
    for (let i = 0; i < 2; i++) {
      const pin = bounds(pins.children[i]), rail = bounds(site.arms[i].rail);
      assert.ok(pin.min.y >= rail.max.y - 1e-6, `pin passes through its rail at ${t}`);
      if (t >= 89) {
        assert.ok(Math.abs(pin.min.y - rail.max.y) < 1e-6, 'pin is floating above its rail');
        assert.ok(Math.min(pin.max.x, rail.max.x) > Math.max(pin.min.x, rail.min.x));
        assert.ok(Math.min(pin.max.z, rail.max.z) > Math.max(pin.min.z, rail.min.z));
        assert.ok(rail.max.z < booster.z - .49 || rail.min.z > booster.z + .49, 'rail intersects booster shell');
      }
    }
  }
});
test('catch hardware closes independently, continuously and reversibly', () => {
  site.update(launchState(82));
  assert.ok(site.arms[0].pivot.rotation.y > 0 && site.arms[1].pivot.rotation.y < 0);
  site.update(launchState(86));
  assert.ok(Math.abs(site.arms[0].pivot.rotation.y) < 1e-9); assert.ok(Math.abs(site.arms[1].pivot.rotation.y) < 1e-9);
  for (const t of [1, 2, 5, 7, 12, 24, 26, 34, 44, 52, 68, 76, 80, 82, 86, 89]) {
    const before = launchState(t - .0001), after = launchState(t + .0001);
    assert.ok(Math.hypot(before.booster.x - after.booster.x, before.booster.y - after.booster.y, before.booster.z - after.booster.z) < .01);
    assert.ok(Math.abs(before.armHeight - after.armHeight) < .01);
    assert.ok(Math.abs(before.armOpening - after.armOpening) < .01);
    assert.ok(Math.abs(before.booster.yaw - after.booster.yaw) < .01);
    assert.ok(Math.abs(before.ship.yaw - after.ship.yaw) < .01);
  }
  site.update(launchState(0)); site.root.updateMatrixWorld(true);
  const start = site.arms.map(({ rail }) => rail.matrixWorld.toArray());
  for (const t of [89, 68, 166, 12, 0]) { site.update(launchState(t)); site.root.updateMatrixWorld(true); }
  assert.deepEqual(site.arms.map(({ rail }) => rail.matrixWorld.toArray()), start);
});

test('both pins have real rail contact at initial setup and after capture', () => {
  for (const t of [0, 1, 89, 166]) {
    const state = launchState(t), b = state.booster;
    site.update(state); site.root.updateMatrixWorld(true);
    pins.position.set(b.x, b.y, b.z); pins.rotation.set(0, b.yaw, b.angle, 'ZYX'); pins.updateMatrixWorld(true);
    assert.equal(state.armOpening, 0);
    for (let i = 0; i < 2; i++) {
      let hits = 0;
      for (const x of [-.06, 0, .06]) for (const z of [-.1, 0, .1]) {
        const point = pins.children[i].localToWorld(new THREE.Vector3(x, -launchSite.catch.pinHeight / 2, z));
        const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, .1, 0)), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(site.arms[i].rail)[0];
        if (hit && Math.abs(hit.point.y - point.y) < 1e-6) hits++;
      }
      assert.ok(hits >= 3, `pin ${i} has no bearing area at ${t}: ${hits}`);
    }
  }
});
test('initial supports unload before opening and release before ignition', () => {
  assert.equal(launchState(0).armOpening, 0);
  assert.ok(launchState(2).armHeight < launchState(0).armHeight - .15);
  assert.equal(launchState(2).armOpening, 0);
  assert.equal(launchState(5).armOpening, 1);
  assert.equal(launchState(5).boosterPower, 0);
  assert.equal(launchState(12).armOpening, 1);
});
