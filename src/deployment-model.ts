import * as THREE from 'three';
import { BAY_CENTER_Y, type deploymentState } from './deployment-state.ts';

// Independent cargo concept, not a retrofit of the historical S30 model.
export function createDeploymentModel() {
  const root = new THREE.Group(), vehicle = new THREE.Group(); root.add(vehicle);
  const steel = new THREE.MeshStandardMaterial({ color: '#c5cdd0', metalness: .82, roughness: .35, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: '#78858b', metalness: .8, roughness: .4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#232c2e', metalness: .1, roughness: .85 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c8af64', metalness: .72, roughness: .5 });
  const ceramic = new THREE.MeshStandardMaterial({ color: '#dce3df', metalness: .15, roughness: .65 });
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  const radiusAt = (y: number) => y < 3.8 ? .45 : .45 * Math.sqrt(Math.max(0, 1 - ((y - 3.8) / 1.4) ** 2));
  for (const [from, to] of [[.16, 3.34], [3.64, 5.2]]) {
    const profile = Array.from({ length: 45 }, (_, i) => { const y = from + (to - from) * i / 44; return new THREE.Vector2(radiusAt(y), y); });
    mesh(new THREE.LatheGeometry(profile, 80), steel, vehicle);
  }
  mesh(new THREE.CylinderGeometry(.45, .45, .30, 64, 1, true, .95, Math.PI * 2 - 1.9), steel, vehicle, 0, BAY_CENTER_Y);
  const shieldProfile = Array.from({ length: 65 }, (_, i) => { const y = .2 + i * 4.98 / 64; return new THREE.Vector2(radiusAt(y) + .005, y); });
  mesh(new THREE.LatheGeometry(shieldProfile, 48, Math.PI / 2, Math.PI), dark, vehicle);
  for (let y = .4; y < 5.15; y += .185) {
    if (y > 3.32 && y < 3.66) continue;
    const ring = mesh(new THREE.TorusGeometry(radiusAt(y) + .001, .0025, 5, 64), edge, vehicle, 0, y); ring.rotation.x = Math.PI / 2;
  }
  const door = mesh(new THREE.CylinderGeometry(.458, .458, .30, 32, 1, true, -.95, 1.9), steel, vehicle, 0, BAY_CENTER_Y); door.name = 'sliding-payload-door';
  for (const x of [-.369, .369]) mesh(new THREE.BoxGeometry(.022, .69, .024), edge, vehicle, x, BAY_CENTER_Y - .15, .274);
  for (const y of [3.33, 3.65]) mesh(new THREE.BoxGeometry(.75, .025, .035), edge, vehicle, 0, y, .275);
  mesh(new THREE.CylinderGeometry(.435, .435, .025, 48), dark, vehicle, 0, 3.22);
  for (const x of [-.31, .31]) {
    mesh(new THREE.BoxGeometry(.025, .75, .035), edge, vehicle, x, 3.65, -.20);
    mesh(new THREE.BoxGeometry(.025, .035, .62), gold, vehicle, x, 3.425, .05);
  }
  const bayLight = new THREE.PointLight('#e6f3ff', .3, 1.8, 2); bayLight.position.set(0, 3.9, .10); vehicle.add(bayLight);
  for (const forward of [false, true]) for (const side of [-1, 1]) {
    const shape = new THREE.Shape(), width = forward ? .32 : .58, height = forward ? .75 : 1.2;
    shape.moveTo(0, 0); shape.lineTo(width, .12); shape.lineTo(width * .85, height * .65); shape.lineTo(0, height); shape.closePath();
    const flap = mesh(new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: false }), dark, vehicle, side * (forward ? .33 : .44), forward ? 4.0 : .36, -.02); flap.scale.x = side;
  }
  for (const vacuum of [false, true]) for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + (vacuum ? Math.PI / 3 : 0), radius = vacuum ? .14 : .07;
    const bell = [[radius, 0], [radius * .9, .07], [radius * .4, .25], [radius * .25, .32]].map(([r, y]) => new THREE.Vector2(r, y));
    mesh(new THREE.LatheGeometry(bell, 28), steel, vehicle, Math.sin(a) * (vacuum ? .28 : .11), 0, Math.cos(a) * (vacuum ? .28 : .11));
  }
  const solar = new THREE.MeshStandardMaterial({ color: '#183d56', metalness: .6, roughness: .35, side: THREE.DoubleSide });
  const gridMaterial = new THREE.LineBasicMaterial({ color: '#6c92a0', transparent: true, opacity: .7 });
  const satellites = Array.from({ length: 3 }, (_, index) => {
    const body = new THREE.Group(); body.name = `concept-satellite-${index + 1}`; root.add(body);
    mesh(new THREE.BoxGeometry(.54, .065, .32), gold, body);
    mesh(new THREE.BoxGeometry(.52, .014, .31), ceramic, body, 0, -.039);
    for (const x of [-.18, 0, .18]) { const dish = mesh(new THREE.CylinderGeometry(.065, .065, .009, 24), ceramic, body, x, -.053, 0); dish.rotation.x = Math.PI; }
    const hinges: { hinge: THREE.Group; side: number; segment: number }[] = [];
    for (const side of [-1, 1]) {
      let parent: THREE.Object3D = body;
      for (let segment = 0; segment < 3; segment++) {
        const hinge = new THREE.Group(); hinge.position.set(side * (segment === 0 ? .27 : .26), segment === 0 ? .055 : segment === 1 ? -.012 : .012, 0); parent.add(hinge);
        mesh(new THREE.BoxGeometry(.26, .006, .29), solar, hinge, side * .13, 0, 0);
        const lines: THREE.Vector3[] = [];
        for (let i = 0; i <= 6; i++) lines.push(new THREE.Vector3(side * i * .26 / 6, .004, -.145), new THREE.Vector3(side * i * .26 / 6, .004, .145));
        for (let i = 0; i <= 6; i++) lines.push(new THREE.Vector3(0, .004, -.145 + i * .29 / 6), new THREE.Vector3(side * .26, .004, -.145 + i * .29 / 6));
        hinge.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), gridMaterial));
        hinges.push({ hinge, side, segment }); parent = hinge;
      }
    }
    return { body, hinges };
  });
  function update(state: ReturnType<typeof deploymentState>) {
    door.position.y = BAY_CENTER_Y - state.door * .36; bayLight.intensity = .3 * state.door;
    state.satellites.forEach((s, i) => {
      satellites[i].body.position.copy(s.position);
      satellites[i].hinges.forEach(({ hinge, side, segment }) => {
        hinge.rotation.z = side * (segment === 1 ? -1 : 1) * (1 - s.panels) * Math.PI;
      });
    });
  }
  return { root, vehicle, satellites, door, update };
}
