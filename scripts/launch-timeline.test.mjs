import test from 'node:test';
import assert from 'node:assert/strict';
import { launchState, launchPhases, phaseAt, LAUNCH_DURATION, seaLevel } from '../src/launch-timeline.ts';

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
