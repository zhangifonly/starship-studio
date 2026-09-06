import * as THREE from 'three';
import { SHIP30_HEIGHT, SHIP30_RADIUS, ship30RadiusAt } from './ship30-state.ts';

// First-generation exterior proportions, not manufacturing CAD. The engine
// exit plane is y=0; the tiled/windward side is +Z. No recovery legs or payloads.
export function createShip30() {
  const root = new THREE.Group(); root.name = 'S30 / Block 1';
  const steel = new THREE.MeshStandardMaterial({ color: '#b9c1c3', metalness: .84, roughness: .38 });
  const seams = new THREE.MeshStandardMaterial({ color: '#687477', metalness: .75, roughness: .48 });
  const tileMaterial = new THREE.MeshStandardMaterial({ color: '#303536', metalness: .05, roughness: .92 });
  const backing = new THREE.MeshStandardMaterial({ color: '#11191b', roughness: .95 });
  const nozzle = new THREE.MeshStandardMaterial({ color: '#8d9295', metalness: .82, roughness: .38, side: THREE.DoubleSide });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const profile = Array.from({ length: 74 }, (_, i) => { const y = .18 + (SHIP30_HEIGHT - .18) * i / 73; return new THREE.Vector2(ship30RadiusAt(y), y); });
  const shell = add(new THREE.LatheGeometry(profile, 96), steel); shell.name = 'stainless-shell';
  const shield = add(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p.x + .004, p.y)), 64, -Math.PI / 2, Math.PI), backing); shield.name = 'windward-shield';
  for (let y = .32; y < 4.92; y += .185) {
    const ring = add(new THREE.TorusGeometry(ship30RadiusAt(y) + .001, .0025, 5, 72), seams); ring.position.y = y; ring.rotation.x = Math.PI / 2;
  }
  const instances: THREE.Matrix4[] = [], dummy = new THREE.Object3D();
  const tileRadius = .016, rowStep = tileRadius * 1.5, columnStep = tileRadius * Math.sqrt(3);
  for (let row = 0, y = .24; y < 4.97; y += rowStep, row++) {
    const radius = ship30RadiusAt(y), columns = Math.max(1, Math.floor(Math.PI * radius / columnStep));
    for (let column = 0; column < columns; column++) {
      const a = -Math.PI / 2 + Math.PI * (column + .5 + (row % 2) * .35) / columns;
      if (a > Math.PI / 2 - .01) continue;
      const slope = (ship30RadiusAt(y + .001) - ship30RadiusAt(y - .001)) / .002;
      dummy.position.set(Math.sin(a) * (radius + .006), y, Math.cos(a) * (radius + .006));
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(a), -slope, Math.cos(a)).normalize());
      dummy.scale.set(1, 1, 1); dummy.updateMatrix(); instances.push(dummy.matrix.clone());
    }
  }
  const tileGeometry = new THREE.CylinderGeometry(tileRadius * .95, tileRadius * .95, .006, 6);
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, instances.length);
  tiles.name = 'hexagonal-tiles'; tiles.castShadow = tiles.receiveShadow = true;
  instances.forEach((matrix, i) => { tiles.setMatrixAt(i, matrix); tiles.setColorAt(i, new THREE.Color().setScalar(.67 + ((i * 17) % 13) / 70)); }); root.add(tiles);
  const flaps: { hinge: THREE.Group; side: number; forward: boolean }[] = [];
  for (const forward of [false, true]) for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.name = `${forward ? 'forward' : 'aft'}-flap-${side}`;
    hinge.position.set(side * (forward ? ship30RadiusAt(3.62) : .435), forward ? 3.62 : .48, 0);
    hinge.rotation.z = forward ? side * .24 : 0; root.add(hinge);
    const shape = new THREE.Shape(); const width = forward ? .42 : .69, height = forward ? .85 : 1.38;
    shape.moveTo(0, 0); shape.lineTo(width, .08); shape.lineTo(width * .93, height * .53); shape.lineTo(.04, height); shape.closePath();
    const panel = add(new THREE.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true, bevelSize: .012, bevelThickness: .009, bevelSegments: 1 }), tileMaterial, hinge);
    panel.scale.x = side; panel.position.z = -.022;
    const contour = shape.getPoints(), triangles = THREE.ShapeUtils.triangulateShape(contour, []).map(indices => new THREE.Triangle(...indices.map(i => new THREE.Vector3(contour[i].x, contour[i].y, 0)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
    const flapMatrices: THREE.Matrix4[] = [];
    for (let row = 0, y = .03; y < height; y += rowStep, row++) for (let x = .02 + row % 2 * columnStep / 2; x < width; x += columnStep) {
      const inside = Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return new THREE.Vector3(x + Math.sin(a) * tileRadius, y + Math.cos(a) * tileRadius, 0); }).every(p => triangles.some(t => t.containsPoint(p)));
      if (!inside) continue;
      dummy.position.set(x, y, .033); dummy.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); dummy.updateMatrix(); flapMatrices.push(dummy.matrix.clone());
    }
    const flapTiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, flapMatrices.length); flapTiles.name = 'flap-hexagonal-tiles'; flapTiles.scale.x = side;
    flapMatrices.forEach((matrix, i) => { flapTiles.setMatrixAt(i, matrix); flapTiles.setColorAt(i, new THREE.Color().setScalar(.67 + ((i * 17) % 13) / 70)); }); hinge.add(flapTiles);
    const cover = add(new THREE.CylinderGeometry(.048, .048, height, 16), seams, hinge); cover.position.y = height / 2;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), new THREE.LineBasicMaterial({ color: '#748084' })); edges.scale.x = side; edges.position.z = -.022; hinge.add(edges);
    flaps.push({ hinge, side, forward });
  }
  const engines: { mesh: THREE.Mesh; vacuum: boolean; position: THREE.Vector3 }[] = [];
  for (const vacuum of [false, true]) for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + (vacuum ? Math.PI / 3 : 0), ring = vacuum ? .278 : .11;
    const radius = vacuum ? .144 : .071, height = vacuum ? .39 : .28, y = vacuum ? .03 : 0;
    const points = [[radius, 0], [radius * .91, height * .18], [radius * .57, height * .48], [radius * .27, height * .84], [radius * .29, height]].map(([r, h]) => new THREE.Vector2(r, h));
    const bell = add(new THREE.LatheGeometry(points, 32), nozzle); bell.name = vacuum ? 'RVac' : 'Raptor-sea-level'; bell.position.set(Math.sin(a) * ring, y, Math.cos(a) * ring);
    const throat = add(new THREE.CylinderGeometry(radius * .24, radius * .24, .008, 20), backing, bell); throat.position.y = height * .94;
    engines.push({ mesh: bell, vacuum, position: bell.position.clone() });
  }
  const skirt = add(new THREE.CylinderGeometry(SHIP30_RADIUS, SHIP30_RADIUS, .19, 96, 1, true), seams); skirt.position.y = .205;
  const fireShield = add(new THREE.CircleGeometry(.425, 64), backing); fireShield.rotation.x = Math.PI / 2; fireShield.position.y = .44;
  return { root, flaps, engines, tiles, tileMaterial };
}
