import * as THREE from 'three';
import { launchSite } from './launch-site-layout.ts';

export function createLaunchSite(steel: THREE.Material, dark: THREE.Material, white: THREE.Material) {
  const root = new THREE.Group();
  function box(parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], material = steel) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material); m.position.set(...at); parent.add(m); return m;
  }
  function beam(parent: THREE.Object3D, a: [number, number, number], b: [number, number, number], radius = .045) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 6), steel);
    m.position.copy(from).add(to).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize()); parent.add(m);
  }
  const { pad, tower: layout, arms: spec } = launchSite;
  const mount = new THREE.Group(); mount.position.set(pad.x, 0, pad.z); root.add(mount);
  const ring = new THREE.Shape(); ring.absarc(0, 0, pad.radius, 0, Math.PI * 2, false);
  const opening = new THREE.Path(); opening.absarc(0, 0, pad.opening, 0, Math.PI * 2, true); ring.holes.push(opening);
  const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: pad.deckTop - pad.deckBottom, bevelEnabled: false, curveSegments: 48 }), dark);
  deck.rotation.x = -Math.PI / 2; deck.position.y = pad.deckBottom; mount.add(deck);
  const supports: THREE.Mesh[] = [];
  const supportTop = launchSite.launchBaseY + launchSite.skirtSupportY;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, support = new THREE.Group(); support.rotation.y = a; mount.add(support);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.13, .19, pad.deckBottom, 10), steel);
    leg.position.set(0, pad.deckBottom / 2, .96); support.add(leg);
    box(support, [.18, supportTop - pad.deckTop - .12, .18], [0, (supportTop - .12 + pad.deckTop) / 2, .91]);
    supports.push(box(support, [.16, .12, .59], [0, supportTop - .06, .675]));
    beam(support, [0, pad.deckTop, .94], [0, supportTop - .12, .46], .05);
  }
  const tower = new THREE.Group(); tower.position.set(layout.x, 0, layout.z); root.add(tower);
  for (const x of [-layout.halfWidth, layout.halfWidth]) for (const z of [-layout.halfWidth, layout.halfWidth]) box(tower, [.14, layout.height, .14], [x, layout.height / 2, z]);
  for (let level = 0; level < 12; level++) {
    const y = level * 1.2;
    box(tower, [1.25, .08, 1.25], [0, y, 0], dark);
    for (const z of [-.55, .55]) beam(tower, [-.55, y, z], [.55, y + 1.2, z]);
    for (const x of [-.55, .55]) beam(tower, [x, y, -.55], [x, y + 1.2, .55]);
  }
  box(tower, [1.6, .28, 1.6], [0, 14.45, 0], white);
  const carriage = new THREE.Group(); carriage.position.set(layout.halfWidth, spec.parkedY, 0); tower.add(carriage);
  box(carriage, [.28, 1.2, 1.6], [0, -.45, 0], dark);
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.z = side * spec.halfGap; carriage.add(pivot);
    const rail = box(pivot, [spec.length, spec.thickness, spec.width], [spec.length / 2, 0, 0]);
    // Bracing stays below the bearing rail, clear of the descending catch pins.
    beam(pivot, [0, -.85, 0], [spec.length, -.08, 0], .06);
    for (let i = 0; i < 5; i++) beam(pivot, [i * spec.length / 5, -.08, 0], [(i + 1) * spec.length / 5, -.85 * (1 - (i + 1) / 5), 0], .035);
    return { pivot, rail, side };
  });
  function update(state: { armHeight: number; armOpening: number; armTarget: { x: number; z: number; yaw: number } }) {
    carriage.position.y = state.armHeight;
    // Aim each hinge at its bearing point, not at a fixed global direction.
    for (const { pivot, side } of arms) {
      const x = state.armTarget.x + side * spec.halfGap * Math.sin(state.armTarget.yaw);
      const z = state.armTarget.z + side * spec.halfGap * Math.cos(state.armTarget.yaw);
      const heading = -Math.atan2(z - layout.z - pivot.position.z, x - layout.x - carriage.position.x);
      pivot.rotation.y = heading - side * spec.openAngle * state.armOpening;
    }
  }
  return { root, tower, mount, deck, supports, carriage, arms, update };
}

export function createCatchPins(material: THREE.Material) {
  const root = new THREE.Group(), spec = launchSite.catch;
  for (const side of [-1, 1]) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(.18, spec.pinHeight, spec.pinReach - spec.pinRoot), material);
    pin.castShadow = pin.receiveShadow = true;
    pin.position.set(0, spec.pinBottom + spec.pinHeight / 2, side * (spec.pinReach + spec.pinRoot) / 2); root.add(pin);
  }
  return root;
}
