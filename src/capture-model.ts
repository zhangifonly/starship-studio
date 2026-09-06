import * as THREE from 'three';
import { createCatchPins } from './launch-site';
import { captureSite } from './mission-data';

// B12 return exterior only. Internal Raptor geometry and surveyed dimensions
// are intentionally not implied by this photo-guided educational model.
export function createCaptureBooster() {
  const root = new THREE.Group(); root.name = 'Booster 12 / return';
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#bfc3c3'; ctx.fillRect(0, 0, 512, 1024);
  for (let y = 0; y < 1024; y++) {
    const tone = 192 + Math.sin(y * .7) * 2 + Math.sin(y * .031) * 3;
    ctx.fillStyle = `rgb(${tone},${tone + 3},${tone + 4})`; ctx.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 38; i++) { ctx.fillStyle = '#666e7030'; ctx.fillRect(0, i * 27, 512, 1); }
  const skin = new THREE.CanvasTexture(canvas); skin.colorSpace = THREE.SRGBColorSpace;
  const steel = new THREE.MeshStandardMaterial({ color: '#d9dedf', map: skin, metalness: .82, roughness: .38 });
  const edge = new THREE.MeshStandardMaterial({ color: '#768287', metalness: .8, roughness: .46 });
  const dark = new THREE.MeshStandardMaterial({ color: '#353f42', metalness: .68, roughness: .6 });
  const pinsMaterial = new THREE.MeshStandardMaterial({ color: '#c4c8c2', metalness: .7, roughness: .4 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  mesh(new THREE.CylinderGeometry(.45, .45, 6.3, 80, 1, true), steel, 0, 3.8);
  mesh(new THREE.CylinderGeometry(.45, .465, .5, 80, 1, true), dark, 0, .4);
  const dome = mesh(new THREE.SphereGeometry(.443, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 6.93); dome.scale.y = .3;
  for (const y of [.65, 6.94]) { const ring = mesh(new THREE.TorusGeometry(.45, .015, 8, 80), edge, 0, y); ring.rotation.x = Math.PI / 2; }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const rib = mesh(new THREE.BoxGeometry(.075, 1.35, .055), steel, Math.sin(a) * .46, 1.27, Math.cos(a) * .46); rib.rotation.y = a;
  }
  for (const a of [.2, 2.7]) mesh(new THREE.CylinderGeometry(.02, .02, 5.2, 8), edge, Math.sin(a) * .462, 3.6, Math.cos(a) * .462);
  const fins = new THREE.Group(); fins.name = 'four-grid-fins'; root.add(fins);
  const finGeometry = new THREE.BoxGeometry(1, 1, 1), finParts = new THREE.InstancedMesh(finGeometry, edge, 4 * 20);
  const dummy = new THREE.Object3D(), assembly = new THREE.Object3D(); let instance = 0;
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    assembly.position.set(Math.sin(angle) * .43, 6.75, Math.cos(angle) * .43); assembly.rotation.y = angle; assembly.updateMatrix();
    for (let j = 0; j < 10; j++) for (const cross of [false, true]) {
      dummy.position.set(cross ? 0 : -.28 + j * .56 / 9, 0, cross ? .04 + j * .63 / 9 : .355);
      dummy.scale.set(cross ? .59 : .014, .095, cross ? .014 : .66); dummy.updateMatrix();
      finParts.setMatrixAt(instance++, new THREE.Matrix4().multiplyMatrices(assembly.matrix, dummy.matrix));
    }
    mesh(new THREE.BoxGeometry(.18, .18, .17), dark, Math.sin(angle) * .46, 6.72, Math.cos(angle) * .46);
  }
  finParts.castShadow = true; finParts.receiveShadow = true; fins.add(finParts);
  const profile = [[.069, 0], [.066, .055], [.047, .135], [.022, .235], [.025, .27]].map(([r, y]) => new THREE.Vector2(r, y));
  const engines = new THREE.InstancedMesh(new THREE.LatheGeometry(profile, 24), new THREE.MeshStandardMaterial({ color: '#6d767d', metalness: .85, roughness: .38, side: THREE.DoubleSide }), 33);
  instance = 0;
  for (const [count, radius] of [[3, .086], [10, .229], [20, .364]]) for (let i = 0; i < count; i++) {
    dummy.position.set(Math.sin(i / count * Math.PI * 2) * radius, .18, Math.cos(i / count * Math.PI * 2) * radius);
    dummy.scale.setScalar(1); dummy.updateMatrix(); engines.setMatrixAt(instance++, dummy.matrix);
  }
  engines.castShadow = true; root.add(engines);
  const pins = createCatchPins(pinsMaterial, captureSite.catch); root.add(pins);
  const pinHighlights = new THREE.Group(); root.add(pinHighlights);
  const highlight = new THREE.MeshBasicMaterial({ color: '#aee3d2', transparent: true, opacity: .6, depthWrite: false });
  for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(.19, .125, .36), highlight, 0, captureSite.catch.pinBottom + .06, side * .6, pinHighlights);
  return { root, pins, pinHighlights, skin, fins, engines };
}
