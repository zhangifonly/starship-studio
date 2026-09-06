import * as THREE from 'three';
import { landingSite } from './landing-site-layout.ts';

export function createLandingPlatform() {
  const root = new THREE.Group(); root.name = 'concept-landing-platform';
  const hull = new THREE.MeshStandardMaterial({ color: '#263237', metalness: .55, roughness: .66 });
  const steel = new THREE.MeshStandardMaterial({ color: '#b1bab9', metalness: .65, roughness: .42 });
  const white = new THREE.MeshStandardMaterial({ color: '#e1e6df', roughness: .7 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#dfbe4d', roughness: .72 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#121b1e', roughness: .94 });
  const red = new THREE.MeshStandardMaterial({ color: '#a24b43', roughness: .8 });
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; root.add(m); return m;
  }
  function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  const { width, length, deckY, hullBottom } = landingSite;
  const w = width / 2, l = length / 2, corner = .48;
  const outline = new THREE.Shape();
  [[-w + corner, -l], [w - corner, -l], [w, -l + corner], [w, l - corner], [w - corner, l], [-w + corner, l], [-w, l - corner], [-w, -l + corner]].forEach(([x, z], i) => i ? outline.lineTo(x, z) : outline.moveTo(x, z)); outline.closePath();
  const body = mesh(new THREE.ExtrudeGeometry(outline, { depth: deckY - hullBottom - .004, bevelEnabled: false }), hull, 0, hullBottom, 0); body.rotation.x = -Math.PI / 2;
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < 128 * 128; i++) {
    const value = 166 + (i * 13 + Math.floor(i / 128) * 31) % 17;
    pixels.set([value, value + 2, value + 3, 255], i * 4);
  }
  const texture = new THREE.DataTexture(pixels, 128, 128); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 5); texture.needsUpdate = true;
  const deck = mesh(new THREE.ShapeGeometry(outline), new THREE.MeshStandardMaterial({ color: '#535c60', map: texture, roughness: .86, metalness: .25 }), 0, deckY, 0); deck.rotation.x = -Math.PI / 2;
  for (const radius of [1.9, 2.06]) {
    const ring = mesh(new THREE.RingGeometry(radius, radius + .045, 96), white, 0, deckY + .008, 0); ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
  }
  for (const side of [-1, 1]) {
    box(.065, .012, .65, white, 0, deckY + .01, side * .75);
    box(.65, .012, .065, white, side * .75, deckY + .01, 0);
    box(.065, .012, length - 1.2, yellow, side * (w - .32), deckY + .01, 0);
    box(width - 1.2, .012, .065, yellow, 0, deckY + .01, side * (l - .32));
    box(.025, .08, length - 1.1, red, side * (w + .008), .025, 0);
    for (let z = -l + .8; z < l - .6; z += .6) {
      box(.025, .22, .025, steel, side * (w - .1), deckY + .11, z);
    }
    box(.025, .025, length - 1.4, steel, side * (w - .1), deckY + .23, 0);
    for (const z of [-3.8, -1.9, 0, 1.9, 3.8]) {
      const fender = mesh(new THREE.CylinderGeometry(.11, .11, .35, 12), rubber, side * (w + .06), .13, z); fender.rotation.z = Math.PI / 2;
    }
    for (const z of [-l + .85, l - .85]) {
      box(1.1, .68, .95, white, side * 1.9, deckY + .34, z);
      box(1.15, .05, 1.0, steel, side * 1.9, deckY + .71, z);
      for (let j = 0; j < 5; j++) box(.8, .025, .015, rubber, side * 1.9, deckY + .2 + j * .07, z + Math.sign(z) * .481);
      mesh(new THREE.CylinderGeometry(.025, .035, .85, 8), steel, side * 2.68, deckY + .425, z);
      mesh(new THREE.SphereGeometry(.055, 12, 8), new THREE.MeshStandardMaterial({ color: side > 0 ? '#65bda9' : '#df7264', emissive: side > 0 ? '#237b63' : '#8c3029', emissiveIntensity: .65 }), side * 2.68, deckY + .87, z);
      const thruster = mesh(new THREE.CylinderGeometry(.22, .22, .3, 16), hull, side * 2.4, -.24, z); thruster.rotation.x = Math.PI / 2;
    }
  }
  // Two compact antenna masts stay outside the landing and exhaust corridor.
  for (const x of [-2.45, 2.45]) {
    mesh(new THREE.CylinderGeometry(.018, .035, 1.5, 8), steel, x, deckY + .75, -4.6);
    box(.38, .035, .035, white, x, deckY + 1.3, -4.6);
  }
  return { root, deck, body, texture };
}

export function createLandingLegs() {
  const root = new THREE.Group(); root.name = 'concept-landing-legs';
  const steel = new THREE.MeshStandardMaterial({ color: '#b7c3c4', metalness: .8, roughness: .32 });
  const dark = new THREE.MeshStandardMaterial({ color: '#40494d', metalness: .5, roughness: .62 });
  const feet: THREE.Mesh[] = [];
  const legs = Array.from({ length: 4 }, (_, i) => {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const beams = [.045, .023].map(radius => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), steel); root.add(m); return m;
    });
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.3, landingSite.footThickness, .3), dark); root.add(foot); feet.push(foot);
    return { angle, beams, foot };
  });
  const up = new THREE.Vector3(0, 1, 0), from = new THREE.Vector3(), to = new THREE.Vector3(), direction = new THREE.Vector3();
  function update(deployment: number) {
    const f = THREE.MathUtils.clamp(deployment, 0, 1); root.visible = f > .001;
    for (const { angle, beams, foot } of legs) {
      const radius = THREE.MathUtils.lerp(.5, landingSite.footRadius, f);
      const y = THREE.MathUtils.lerp(1.65, landingSite.footBottom + landingSite.footThickness / 2, f);
      to.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius); foot.position.copy(to);
      beams.forEach((beam, i) => {
        from.set(Math.cos(angle) * .41, i ? .3 : .94, Math.sin(angle) * .41);
        direction.copy(to).sub(from); beam.position.copy(from).add(to).multiplyScalar(.5);
        beam.scale.y = direction.length(); beam.quaternion.setFromUnitVectors(up, direction.normalize());
      });
    }
  }
  root.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; }); update(0);
  return { root, feet, update };
}
