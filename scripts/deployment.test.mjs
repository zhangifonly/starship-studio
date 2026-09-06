import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { deploymentState, deploymentOrbitAt, deploymentPhaseAt, deploymentPhases, deploymentHash, parseDeploymentHash, deploymentSources, RELEASE_TIMES, DEPLOYMENT_DURATION } from '../src/deployment-state.ts';
import { createDeploymentModel } from '../src/deployment-model.ts';

test('deployment is a bounded six-phase concept separate from historical Flight 5', () => {
  assert.equal(deploymentPhases.length, 6);
  deploymentPhases.forEach((phase, i) => assert.equal(deploymentPhaseAt(phase.start), i));
  assert.deepEqual(deploymentState(NaN), deploymentState(0));
  assert.deepEqual(deploymentState(-1), deploymentState(0));
  assert.deepEqual(deploymentState(1000), deploymentState(DEPLOYMENT_DURATION));
  for (const source of deploymentSources) assert.equal(new URL(source.url).protocol, 'https:');
  assert.match(deploymentSources[0].detail, /质量模拟器/);
});
test('release counts, feed, drift and door motions are continuous and seek-safe', () => {
  let previous = deploymentState(0);
  for (let t = 0; t <= 120; t += .01) {
    const state = deploymentState(t);
    assert.ok(state.door >= 0 && state.door <= 1);
    state.satellites.forEach((s, i) => {
      assert.ok(s.position.toArray().every(Number.isFinite));
      assert.ok(s.position.distanceTo(previous.satellites[i].position) < .003);
      assert.ok(s.position.z >= previous.satellites[i].position.z);
      if (s.released && s.position.z < .65) assert.equal(state.door, 1);
    });
    previous = state;
  }
  RELEASE_TIMES.forEach((t, i) => { assert.equal(deploymentState(t - .01).released, i); assert.equal(deploymentState(t).released, i + 1); });
  RELEASE_TIMES.forEach((t, i) => {
    assert.equal(deploymentState(t).satellites[i].cleared, false);
    assert.equal(deploymentState(t + 11).satellites[i].cleared, false);
    assert.equal(deploymentState(t + 12).satellites[i].cleared, true);
  });
  assert.equal(deploymentState(72).cleared, 3);
  const first = deploymentState(41); deploymentState(120); deploymentState(0); assert.deepEqual(deploymentState(41), first);
});
test('small separation impulse joins constant relative drift without stopping orbital motion', () => {
  for (const t of RELEASE_TIMES) {
    const i = RELEASE_TIMES.indexOf(t), sample = dt => deploymentState(t + dt).satellites[i].position;
    assert.ok(sample(.001).distanceTo(sample(0)) < 1e-6);
    const left = sample(2).clone().sub(sample(1.999)).multiplyScalar(1000), right = sample(2.001).clone().sub(sample(2)).multiplyScalar(1000);
    assert.ok(left.distanceTo(right) < .00002);
    assert.ok(Math.abs(right.z * 10 - .6) < 1e-6);
  }
});
test('synthetic SGP4 orbit and local reference frame remain finite and deterministic', () => {
  for (const t of [0, 16, 34, 60, 88, 120]) {
    const orbit = deploymentOrbitAt(t);
    assert.ok(orbit.altitudeKm > 380 && orbit.altitudeKm < 450);
    assert.ok(orbit.velocity.length() > 7 && orbit.velocity.length() < 8);
    assert.ok(Math.abs(orbit.frame.length() - 1) < 1e-9);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(orbit.frame);
    assert.ok(up.distanceTo(orbit.position.clone().normalize()) < 1e-9);
  }
  const start = deploymentOrbitAt(40); deploymentOrbitAt(120); deploymentOrbitAt(0);
  assert.deepEqual(deploymentOrbitAt(40), start);
  assert.ok(deploymentOrbitAt(60).position.distanceTo(deploymentOrbitAt(0).position) > 400);
});
test('payload boxes clear the actual hull and shutter throughout loading and release', () => {
  const model = createDeploymentModel(), ray = new THREE.Raycaster(), direction = new THREE.Vector3();
  for (let t = 0; t <= 84; t += .5) {
    model.update(deploymentState(t)); model.root.updateMatrixWorld(true);
    const door = new THREE.Box3().setFromObject(model.door);
    for (const s of model.satellites) {
      const box = new THREE.Box3().setFromObject(s.body), center = box.getCenter(new THREE.Vector3());
      assert.ok(!box.intersectsBox(door), `door collision at ${t}`);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        direction.set(x, y, z).sub(center); ray.set(center, direction.clone().normalize()); ray.far = direction.length() - 1e-5;
        assert.equal(ray.intersectObject(model.vehicle, true).length, 0, `hull or rack collision at ${t}`);
      }
    }
  }
});
test('panels unfold by fixed-size joints only after clearance, and satellite envelopes do not overlap', () => {
  const model = createDeploymentModel();
  for (let t = 0; t <= 120; t += .5) {
    const state = deploymentState(t); model.update(state); model.root.updateMatrixWorld(true);
    state.satellites.forEach((s, i) => {
      if (s.panels > 0) assert.ok(s.released && s.position.z > 1.7);
      model.satellites[i].hinges.forEach(({ hinge }) => assert.deepEqual(hinge.scale.toArray(), [1, 1, 1]));
    });
    const boxes = model.satellites.map(s => new THREE.Box3().setFromObject(s.body));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(!boxes[i].intersectsBox(boxes[j]), `payload overlap at ${t}`);
  }
  assert.deepEqual(deploymentState(120).satellites.map(s => s.panels), [1, 1, 1]);
});
test('shared moments restore camera and target and reject malformed inputs', () => {
  for (const camera of ['ship', 'bay', 'satellite']) for (const satellite of [0, 1, 2]) assert.deepEqual(parseDeploymentHash(deploymentHash(41.2, camera, satellite)), { time: 41.2, camera, satellite });
  assert.deepEqual(parseDeploymentHash('#mission/deployment?t=NaN&camera=bad&satellite=-1'), { time: 0, camera: 'ship', satellite: 0 });
});
test('both narration voices match the six-stage script and fit without speeding up', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/deployment-audio.json', import.meta.url), 'utf8'));
  for (const voice of ['yunxi', 'xiaoxiao']) {
    assert.equal(manifest.audio[voice].length, 6);
    manifest.audio[voice].forEach((cue, i) => {
      assert.equal(cue.text, deploymentPhases[i].text);
      assert.ok(cue.duration > 0 && cue.duration <= (deploymentPhases[i + 1]?.start ?? 120) - deploymentPhases[i].start - .2);
    });
  }
});
