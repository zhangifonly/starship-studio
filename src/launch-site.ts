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
  tower.rotation.y = layout.yaw;
  for (const x of [-layout.halfWidth, layout.halfWidth]) for (const z of [-layout.halfWidth, layout.halfWidth]) box(tower, [.14, layout.height, .14], [x, layout.height / 2, z]);
  for (let level = 0; level < 12; level++) {
    const y = level * 1.2;
    box(tower, [1.8, .08, 1.8], [0, y, 0], dark);
    for (const z of [-layout.halfWidth, layout.halfWidth]) beam(tower, [-layout.halfWidth, y, z], [layout.halfWidth, y + 1.2, z]);
    for (const x of [-layout.halfWidth, layout.halfWidth]) beam(tower, [x, y, -layout.halfWidth], [x, y + 1.2, layout.halfWidth]);
  }
  // Open crown and corner-facing carriage follow the Pad A visual reference.
  for (const z of [-.9, .9]) box(tower, [1.9, .12, .12], [0, 14.45, z]);
  for (const x of [-.9, .9]) box(tower, [.12, .12, 1.9], [x, 14.45, 0]);
  const carriage = new THREE.Group(); carriage.position.set(layout.x + spec.carriageX, spec.parkedY, layout.z); root.add(carriage);
  box(carriage, [.35, 1.3, 2.0], [0, -.5, 0], dark);
  for (const side of [-1, 1]) {
    beam(carriage, [-.65, -.9, side * .9], [.15, -.9, side * .88], .1);
    beam(carriage, [-.65, -.9, side * .9], [.15, .08, side * .88], .08);
  }
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.z = side * spec.pivotHalfGap; carriage.add(pivot);
    const rail = box(pivot, [spec.length, spec.thickness, spec.width], [spec.length / 2, 0, 0]);
    // Box trusses sit outside/below the inner bearing rails, not inside the catch gap.
    for (const z of [0, side * .38]) {
      box(pivot, [spec.length, .1, .1], [spec.length / 2, -.84, z], dark);
      if (z) box(pivot, [spec.length, .12, .12], [spec.length / 2, -.02, z]);
      for (let i = 0; i < 6; i++) {
        const x = i * spec.length / 6, next = (i + 1) * spec.length / 6;
        beam(pivot, [x, -.12, z], [next, -.8, z], .045);
        beam(pivot, [next, -.8, z], [next, -.12, z], .04);
      }
    }
    for (let i = 0; i <= 6; i++) beam(pivot, [i * spec.length / 6, -.8, 0], [i * spec.length / 6, -.8, side * .38], .04);
    beam(pivot, [0, -1.7, side * .15], [spec.length * .55, -.85, side * .15], .09);
    return { pivot, rail, side };
  });
  const qdSpec = launchSite.qd, qd = new THREE.Group(); qd.position.set(qdSpec.x, qdSpec.y, qdSpec.z); root.add(qd);
  const qdLength = Math.hypot(qdSpec.tipX - qdSpec.x, qdSpec.tipZ - qdSpec.z);
  const qdHeading = -Math.atan2(qdSpec.tipZ - qdSpec.z, qdSpec.tipX - qdSpec.x);
  for (const z of [-.18, .18]) {
    box(qd, [qdLength, .09, .09], [qdLength / 2, 0, z], dark);
    beam(qd, [0, -.65, z], [qdLength, -.08, z], .065);
    for (let i = 0; i < 4; i++) beam(qd, [i * qdLength / 4, 0, z], [(i + 1) * qdLength / 4, -.5 * (1 - i / 4), z], .04);
    beam(qd, [.1, .13, z], [qdLength - .2, .13, z], .07);
  }
  const qdHead = box(qd, [.16, .35, .38], [qdLength - .08, .1, 0], white);
  function update(state: { armHeight: number; armOpening: number; qdOpening: number; armTarget: { x: number; z: number; yaw: number } }) {
    carriage.position.y = state.armHeight;
    qd.rotation.y = qdHeading + state.qdOpening * qdSpec.retractAngle;
    // Aim each hinge at its bearing point, not at a fixed global direction.
    for (const { pivot, side } of arms) {
      const x = state.armTarget.x + side * spec.halfGap * Math.sin(state.armTarget.yaw);
      const z = state.armTarget.z + side * spec.halfGap * Math.cos(state.armTarget.yaw);
      const heading = -Math.atan2(z - carriage.position.z - pivot.position.z, x - carriage.position.x);
      pivot.rotation.y = heading - side * spec.openAngle * state.armOpening;
    }
  }
  return { root, tower, mount, deck, supports, carriage, arms, qd, qdHead, update };
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
