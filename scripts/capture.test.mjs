import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAPTURE_DURATION, capturePhases, capturePhaseAt, captureState, captureSite, parseMissionHash, missionHash, missionSources, flight5 } from '../src/mission-data.ts';
import { createLaunchSite, createCatchPins } from '../src/launch-site.ts';
import { readFileSync } from 'node:fs';

test('capture sequence is bounded, monotone and continuous', () => {
  let previous = captureState(0);
  for (let t = 0; t <= CAPTURE_DURATION; t += .01) {
    const state = captureState(t);
    for (const key of ['time', 'x', 'y', 'z', 'angle', 'power', 'armHeight', 'armOpening']) assert.ok(Number.isFinite(state[key]));
    assert.ok(state.y <= previous.y + 1e-9);
    assert.ok(Math.abs(state.y - previous.y) < .02);
    assert.ok(state.power >= 0 && state.power <= 1);
    assert.ok(state.y >= captureSite.catch.baseY);
    previous = state;
  }
  assert.deepEqual(captureState(-4), captureState(0));
  assert.deepEqual(captureState(NaN), captureState(0));
  assert.deepEqual(captureState(999), captureState(CAPTURE_DURATION));
});
test('all five phases cover the whole clip without gaps', () => {
  assert.equal(capturePhases[0].start, 0);
  assert.equal(capturePhases.at(-1).end, CAPTURE_DURATION);
  capturePhases.forEach((p, i) => {
    assert.equal(capturePhaseAt(p.start), i);
    assert.ok(p.end > p.start);
    if (i) { assert.equal(capturePhases[i - 1].end, p.start); assert.equal(capturePhaseAt(p.start - .001), i - 1); }
  });
});
test('reference IDs exist and historical mission is not the concept flight', () => {
  for (const fact of flight5.facts) assert.ok(missionSources.some(s => s.id === fact.source));
  assert.equal(flight5.vehicle, 'Booster 12');
  assert.ok(flight5.facts.find(f => f.label === '上面级结果').value.includes('未使用平台'));
  for (const source of missionSources) assert.equal(new URL(source.url).protocol, 'https:');
});
test('shared moment restores time, camera and dual mode; invalid inputs fall back', () => {
  for (const camera of ['site', 'tracking', 'overhead']) for (const dual of [false, true]) {
    assert.deepEqual(parseMissionHash(missionHash(24.3, camera, dual)), { time: 24.3, camera, dual });
  }
  assert.deepEqual(parseMissionHash('#mission/flight-5?t=abc&camera=bad'), { time: 0, camera: 'site', dual: true });
  assert.equal(parseMissionHash('#mission/flight-5?t=999').time, CAPTURE_DURATION);
});
const material = new THREE.MeshBasicMaterial();
const site = createLaunchSite(material, material, material, captureSite), pins = createCatchPins(material, captureSite.catch);
test('both catch pins have bearing area and remain suspended after capture', () => {
  for (const t of [23, 24, 28, 35]) {
    const state = captureState(t); site.update(state); site.root.updateMatrixWorld(true);
    pins.position.set(state.x, state.y, state.z); pins.rotation.z = state.angle; pins.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      let contacts = 0;
      for (const x of [-.06, 0, .06]) for (const z of [-.1, 0, .1]) {
        const point = pins.children[i].localToWorld(new THREE.Vector3(x, -captureSite.catch.pinHeight / 2, z));
        const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, .1, 0)), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(site.arms[i].rail)[0];
        if (hit && Math.abs(hit.point.y - point.y) < 1e-6) contacts++;
      }
      assert.ok(contacts >= 3, `pin ${i} at ${t}: ${contacts} bearing samples`);
    }
    assert.ok(state.y > captureSite.pad.deckTop + 1, 'engines must remain off the deck');
    assert.ok(Math.hypot(state.x - captureSite.pad.x, state.z - captureSite.pad.z) > captureSite.pad.radius + .46);
  }
});
test('capture never penetrates rails and returns exactly to the initial state', () => {
  for (let t = 16; t <= 35; t += .1) {
    const s = captureState(t); site.update(s); site.root.updateMatrixWorld(true);
    pins.position.set(s.x, s.y, s.z); pins.rotation.z = s.angle; pins.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const pinBox = new THREE.Box3().setFromObject(pins.children[i]), railBox = new THREE.Box3().setFromObject(site.arms[i].rail);
      assert.ok(pinBox.min.y >= railBox.max.y - 1e-6);
    }
  }
  const first = captureState(0); captureState(35); captureState(17); assert.deepEqual(captureState(0), first);
  assert.equal(captureState(23).contact, true); assert.equal(captureState(24).power, 0);
});
test('full arm trusses clear the tilted booster hull throughout approach', () => {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), body = new THREE.Object3D();
  for (let t = 0; t <= CAPTURE_DURATION; t += .25) {
    const s = captureState(t); site.update(s); site.root.updateMatrixWorld(true);
    body.position.set(s.x, s.y, s.z); body.rotation.z = s.angle; body.updateMatrixWorld(true);
    const inverse = body.matrixWorld.clone().invert();
    for (const { pivot } of site.arms) pivot.traverse(mesh => {
      if (!mesh.isMesh) return;
      const positions = mesh.geometry.attributes.position, indices = mesh.geometry.index, count = indices ? indices.count : positions.count;
      for (let i = 0; i < count; i += 3) for (let edge = 0; edge < 3; edge++) {
        const ia = i + edge, ib = i + (edge + 1) % 3;
        a.fromBufferAttribute(positions, indices ? indices.getX(ia) : ia).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        b.fromBufferAttribute(positions, indices ? indices.getX(ib) : ib).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        const dy = b.y - a.y; let from = 0, to = 1;
        if (Math.abs(dy) < 1e-8) { if (a.y < .65 || a.y > 6.95) continue; }
        else { const p = (.65 - a.y) / dy, q = (6.95 - a.y) / dy; from = Math.max(0, Math.min(p, q)); to = Math.min(1, Math.max(p, q)); if (from > to) continue; }
        const dx = b.x - a.x, dz = b.z - a.z;
        const closest = Math.max(from, Math.min(to, -(a.x * dx + a.z * dz) / (dx * dx + dz * dz || 1)));
        assert.ok(Math.hypot(a.x + closest * dx, a.z + closest * dz) >= .46, `truss penetrates hull at ${t}`);
      }
    });
  }
});
test('both narration voices fit all phases and match the script', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/capture-audio.json', import.meta.url), 'utf8'));
  for (const voice of ['yunxi', 'xiaoxiao']) {
    assert.equal(manifest.audio[voice].length, capturePhases.length);
    manifest.audio[voice].forEach((cue, i) => {
      assert.equal(cue.text, capturePhases[i].narration);
      assert.ok(cue.duration > 0 && cue.duration <= capturePhases[i].end - capturePhases[i].start - .2);
    });
  }
});
