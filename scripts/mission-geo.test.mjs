import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLaunchSite, createCatchPins } from '../src/launch-site.ts';
import { geodeticToEcef, ecefToGeodetic, enuBasis, enuToEcef, ecefToGlobe, geoToGlobe, geoToLocal, localToGeo, interpolateGeo, sunDirectionEcef, solarElevation, WGS84_A, WGS84_B, daylightLabel, METERS_PER_LOCAL_UNIT } from '../src/mission-geo.ts';
import { overviewEvents, overviewEventAt, missionSecondsAt, missionDate, guidePosition, flight5State, boosterPositionAt, captureClipAt, returnCameraAvailable, shipGuide, boosterGuide, STARBASE, timelineSources, parseOverviewHash, overviewHash, OVERVIEW_DURATION } from '../src/flight5-timeline.ts';
import { captureSite, captureState } from '../src/mission-data.ts';
const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

test('WGS84 reference axes and Earth texture convention', () => {
  const greenwich = geodeticToEcef({ lat: 0, lon: 0, altitudeM: 0 }); near(greenwich.x, WGS84_A); near(greenwich.y, 0); near(greenwich.z, 0);
  const north = geodeticToEcef({ lat: 90, lon: 0, altitudeM: 0 }); near(north.z, WGS84_B);
  const east = geoToGlobe({ lat: 0, lon: 90, altitudeM: 0 }); near(east.z, -WGS84_A / 1e6); near(east.x, 0); near(east.y, 0);
  assert.equal(METERS_PER_LOCAL_UNIT, 10);
});
test('geodetic round trips across dateline, poles and orbital heights', () => {
  for (const lat of [-90, -70, -24, 0, 25.997, 70, 90]) for (const lon of [-179, -97.155, 0, 100, 179]) for (const altitudeM of [0, 1500, 69000, 212000]) {
    const back = ecefToGeodetic(geodeticToEcef({ lat, lon, altitudeM })); near(back.lat, lat); if (Math.abs(lat) < 90) near(back.lon, lon); near(back.altitudeM, altitudeM, .001);
  }
});
test('ENU is orthonormal and local offsets remain metres', () => {
  const b = enuBasis(STARBASE), origin = geodeticToEcef(STARBASE);
  for (const v of Object.values(b)) near(dot(v, v), 1);
  near(dot(b.east, b.north), 0); near(dot(b.up, b.east), 0); near(dot(b.up, b.north), 0);
  const p = enuToEcef({ x: 10, y: 20, z: 30 }, STARBASE), delta = { x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z };
  near(dot(delta, b.east), 10); near(dot(delta, b.north), 20); near(dot(delta, b.up), 30);
  const world = ecefToGlobe(delta); near(Math.hypot(world.x, world.y, world.z), Math.sqrt(1400) / 1e6);
});
test('solar direction agrees with local elevations and actual morning/evening sides', () => {
  const date = missionDate(0), sun = sunDirectionEcef(date); near(dot(sun, sun), 1);
  for (const p of [STARBASE, { lat: -24, lon: 100, altitudeM: 0 }, { lat: 0, lon: 0, altitudeM: 0 }]) near(dot(sun, enuBasis(p).up), Math.sin(solarElevation(date, p) * Math.PI / 180));
  assert.ok(solarElevation(date, STARBASE) > -6 && solarElevation(date, STARBASE) < 3);
  assert.ok(solarElevation(missionDate(3940), { lat: -24, lon: 100, altitudeM: 0 }) < -6);
  assert.equal(daylightLabel(-3), '曙暮光'); assert.equal(daylightLabel(10), '日照'); assert.equal(daylightLabel(-20), '夜间');
});
test('timeline uses separate deterministic playback and approximate mission clocks', () => {
  for (const [i, event] of overviewEvents.entries()) { assert.equal(overviewEventAt(event.start), i); assert.equal(missionSecondsAt(event.start), event.missionSeconds); assert.ok(timelineSources.some(s => s.id === event.source)); }
  let previous = -1;
  for (let t = 0; t <= OVERVIEW_DURATION; t += .2) { const seconds = missionSecondsAt(t); assert.ok(seconds >= previous); previous = seconds; }
  assert.equal(missionSecondsAt(200), 3940); assert.equal(missionSecondsAt(NaN), 0);
  assert.equal(missionDate(414).toISOString(), '2024-10-13T12:31:54.000Z');
});
test('all coordinate guides are authored, never measured samples', () => {
  for (const p of [...shipGuide, ...boosterGuide]) assert.equal(p.kind, 'authored');
  const state = flight5State(150); assert.equal(state.positionKind, 'authored-interpolation'); assert.equal(state.measuredTelemetry, null);
  const a = { lat: 0, lon: 179, altitudeM: 0 }, b = { lat: 0, lon: -179, altitudeM: 10 }; const middle = interpolateGeo(a, b, .5); near(Math.abs(middle.lon), 180); near(middle.altitudeM, 5);
});
test('both stages share their pre-separation position and return stays at Starbase', () => {
  for (let t = 0; t <= 160; t += 2) assert.deepEqual(guidePosition(shipGuide, t), guidePosition(boosterGuide, t));
  assert.equal(flight5State(19.9).separated, false); assert.equal(flight5State(20).separated, true);
  const state = flight5State(100); assert.equal(state.caught, true); assert.ok(Math.abs(state.booster.lat - STARBASE.lat) < .001); assert.ok(Math.abs(state.booster.lon - STARBASE.lon) < .001); assert.ok(state.booster.altitudeM > 60);
  assert.equal(flight5State(180).splashed, true);
});
test('position interpolation has no jumps at guide boundaries', () => {
  for (const guide of [shipGuide, boosterGuide]) for (const p of guide) {
    const before = geodeticToEcef(guidePosition(guide, p.t - .001)), after = geodeticToEcef(guidePosition(guide, p.t + .001));
    assert.ok(Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z) < 30);
  }
});
test('sharing handles malformed values and preserves overview namespace', () => {
  assert.deepEqual(parseOverviewHash(overviewHash(88.8, 'ship')), { time: 88.8, camera: 'ship' });
  assert.deepEqual(parseOverviewHash('#mission/flight-5/overview?t=Infinity&camera=garbage'), { time: 0, camera: 'global' });
  assert.equal(parseOverviewHash('#mission/flight-5/overview?t=999').time, 200);
  assert.ok(overviewHash(0, 'booster').startsWith('#mission/flight-5/overview?'));
});
test('narration has two complete voices and fits every playback chapter', () => {
  const manifest = JSON.parse(readFileSync('src/overview-audio.json', 'utf8'));
  assert.deepEqual(Object.keys(manifest.audio), ['yunxi', 'xiaoxiao']);
  for (const cues of Object.values(manifest.audio)) { assert.equal(cues.length, 10); cues.forEach((cue, i) => { assert.equal(cue.text, overviewEvents[i].text); assert.ok(cue.duration > 1 && cue.duration < 19.8); assert.ok(cue.src.startsWith('/narration/')); }); }
});
test('global and capture-local positions agree to submillimetre precision', () => {
  for (let seconds = 390; seconds <= 430; seconds += .1) {
    const actual = geoToLocal(boosterPositionAt(seconds), STARBASE), expected = captureState(captureClipAt(seconds));
    for (const key of ['x', 'y', 'z']) near(actual[key], expected[key], .00001);
  }
  for (const p of [{ x: 30, y: 1.8, z: 100 }, { x: 9000, y: 10000, z: -1000 }]) {
    const result = geoToLocal(localToGeo(p, STARBASE), STARBASE);
    for (const key of ['x', 'y', 'z']) near(result[key], p[key], .00001);
  }
});
test('capture clock and geographic approach join without teleporting', () => {
  near(captureClipAt(414), 23); assert.equal(returnCameraAvailable(222.9), false); assert.equal(returnCameraAvailable(223), true);
  for (const seconds of [380, 390, 414, 426.6]) {
    const a = geodeticToEcef(boosterPositionAt(seconds - .0001)), b = geodeticToEcef(boosterPositionAt(seconds + .0001));
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1);
  }
  for (const camera of ['return', 'ground']) assert.deepEqual(parseOverviewHash(overviewHash(91.2, camera)), { time: 91.2, camera });
});
test('converted global endpoint still seats both physical pin meshes on the rails', () => {
  const material = new THREE.MeshBasicMaterial(), site = createLaunchSite(material, material, material, captureSite), pins = createCatchPins(material, captureSite.catch);
  for (const seconds of [414, 415, 426.6, 507, 3940]) {
    const pose = captureState(captureClipAt(seconds)), local = geoToLocal(boosterPositionAt(seconds), STARBASE);
    site.update(pose); site.root.updateMatrixWorld(true);
    pins.position.set(local.x, local.y, local.z); pins.rotation.z = pose.angle; pins.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      let contacts = 0;
      for (const x of [-.06, 0, .06]) for (const z of [-.1, 0, .1]) {
        const point = pins.children[i].localToWorld(new THREE.Vector3(x, -captureSite.catch.pinHeight / 2, z));
        const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, .1, 0)), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(site.arms[i].rail)[0];
        if (hit && Math.abs(hit.point.y - point.y) < 1e-6) contacts++;
      }
      assert.ok(contacts >= 3, `pin ${i} at ${seconds}: ${contacts} bearing samples`);
    }
  }
});
