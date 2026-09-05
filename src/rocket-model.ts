import * as THREE from 'three';
import { parts, type PartId } from './parts';

export type Piece = { mesh: THREE.Object3D; part: PartId; home: THREE.Vector3; offset: THREE.Vector3; internal: boolean; shell: boolean };
export type RocketModel = { root: THREE.Group; pieces: Piece[]; groups: Record<PartId, THREE.Group>; textures: THREE.Texture[] };

// World units are 10 m. V3 external envelope: approximately 124.4 m by 9 m.
// Detailed shell thicknesses, piping, and tank divisions are illustrative.
export function createRocket(): RocketModel {
  const root = new THREE.Group();
  const pieces: Piece[] = [];
  const groups = {} as Record<PartId, THREE.Group>;
  for (const part of parts) { const g = new THREE.Group(); g.name = part.id; root.add(g); groups[part.id] = g; }
  const steel = new THREE.MeshStandardMaterial({ color: '#b9bfc1', metalness: .88, roughness: .28 });
  const seam = new THREE.MeshStandardMaterial({ color: '#626969', metalness: .9, roughness: .4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202628', metalness: .68, roughness: .48 });
  const nozzle = new THREE.MeshStandardMaterial({ color: '#737b80', metalness: .9, roughness: .35, side: THREE.DoubleSide });
  const copper = new THREE.MeshStandardMaterial({ color: '#af8562', metalness: .85, roughness: .3 });
  const oxygen = new THREE.MeshStandardMaterial({ color: '#6398a0', metalness: .48, roughness: .3 });
  const methane = new THREE.MeshStandardMaterial({ color: '#939c69', metalness: .5, roughness: .3 });
  const textures: THREE.Texture[] = [];
  const tileCanvas = document.createElement('canvas'); tileCanvas.width = 512; tileCanvas.height = 512;
  const ctx = tileCanvas.getContext('2d')!;
  ctx.fillStyle = '#343a3c'; ctx.fillRect(0, 0, 512, 512);
  for (let row = -1; row < 19; row++) for (let col = -1; col < 16; col++) {
    const x = col * 36 + (row % 2) * 18; const y = row * 31.2;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * 19.9, y + Math.sin(a) * 19.9); }
    ctx.closePath(); const tone = 22 + ((row * 7 + col * 3 + 200) % 9);
    ctx.fillStyle = `rgb(${tone},${tone + 3},${tone + 5})`; ctx.fill(); ctx.strokeStyle = '#404548'; ctx.lineWidth = .9; ctx.stroke();
  }
  const tileTexture = new THREE.CanvasTexture(tileCanvas); tileTexture.colorSpace = THREE.SRGBColorSpace;
  tileTexture.wrapS = tileTexture.wrapT = THREE.RepeatWrapping; tileTexture.repeat.set(2, 5); textures.push(tileTexture);
  const tiles = new THREE.MeshStandardMaterial({ map: tileTexture, bumpMap: tileTexture, bumpScale: .009, metalness: .12, roughness: .8, side: THREE.DoubleSide });
  const spreads: Record<PartId, [number, number, number]> = {
    nose: [0, 3.1, 0], flaps: [1.7, 1.7, 0], shield: [-1.8, 1, .25], 'ship-tank': [0, 1.9, 0],
    'ship-engines': [1.5, .7, 0], hotstage: [0, .7, 0], gridfins: [-1.9, .3, 0],
    'booster-tank': [0, 0, 0], 'booster-engines': [0, -1.9, 0],
  };
  function add(part: PartId, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, position: [number, number, number], extra: { shell?: boolean; internal?: boolean; offset?: [number, number, number] } = {}) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.userData.part = part;
    mesh.castShadow = true; mesh.receiveShadow = true; groups[part].add(mesh);
    pieces.push({ mesh, part, home: mesh.position.clone(), offset: new THREE.Vector3(...(extra.offset ?? spreads[part])), shell: extra.shell ?? false, internal: extra.internal ?? false });
    return mesh;
  }
  function ring(part: PartId, y: number, radius = .451, tube = .006, material = seam) {
    const mesh = add(part, new THREE.TorusGeometry(radius, tube, 6, 72), material, [0, y, 0]); mesh.rotation.x = Math.PI / 2; return mesh;
  }
  function shell(part: PartId, bottom: number, top: number) {
    // Separate longitudinal shell halves let section mode expose the tank geometry.
    for (let i = 0; i < 2; i++) add(part, new THREE.CylinderGeometry(.45, .45, top - bottom, 64, 1, true, i * Math.PI, Math.PI), steel, [0, (top + bottom) / 2, 0], { shell: i === 0 });
    for (let y = bottom; y <= top; y += .18) ring(part, y);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      const m = add(part, new THREE.BoxGeometry(.007, top - bottom, .009), seam, [Math.sin(a) * .451, (top + bottom) / 2, Math.cos(a) * .451]); m.rotation.y = a;
    }
  }
  function tank(part: PartId, bottom: number, top: number, material: THREE.MeshStandardMaterial) {
    add(part, new THREE.CylinderGeometry(.414, .414, top - bottom - .3, 48), material, [0, (bottom + top) / 2, 0], { internal: true });
    for (const y of [bottom + .15, top - .15]) {
      const dome = add(part, new THREE.SphereGeometry(.414, 40, 20), material, [0, y, 0], { internal: true }); dome.scale.y = .45;
    }
  }
  shell('booster-tank', .58, 7.04);
  tank('booster-tank', .72, 4.7, oxygen); tank('booster-tank', 4.75, 6.92, methane);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const rib = add('booster-tank', new THREE.BoxGeometry(.055, 1.0, .04), steel, [Math.sin(a) * .47, 1.1, Math.cos(a) * .47]); rib.rotation.y = a;
  }
  for (const a of [.4, 3.6]) add('booster-tank', new THREE.CylinderGeometry(.025, .025, 5.9, 12), steel, [Math.sin(a) * .47, 3.8, Math.cos(a) * .47]);
  ring('booster-tank', .59, .457, .023, steel); ring('booster-tank', 7.03, .455, .016, steel);
  for (const y of [7.065, 7.115, 7.32, 7.37]) ring('hotstage', y, .452, .018, steel);
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI * 2 / 48;
    const strut = add('hotstage', new THREE.BoxGeometry(.018, .28, .022), steel, [Math.sin(a) * .447, 7.21, Math.cos(a) * .447]); strut.rotation.y = a;
  }
  add('hotstage', new THREE.CylinderGeometry(.43, .43, .03, 64), dark, [0, 7.07, 0]);
  shell('ship-tank', 7.38, 10.63);
  tank('ship-tank', 7.93, 9.48, oxygen); tank('ship-tank', 9.52, 10.55, methane);
  add('ship-tank', new THREE.CylinderGeometry(.036, .036, 1.85, 12), copper, [0, 8.67, 0], { internal: true });
  add('ship-tank', new THREE.CylinderGeometry(.025, .025, 3.62, 12), oxygen, [.36, 9.55, .06], { internal: true });
  shell('nose', 10.63, 10.95);
  const nosePoints: THREE.Vector2[] = [];
  for (let i = 0; i <= 32; i++) { const t = i / 32; nosePoints.push(new THREE.Vector2(.45 * Math.pow(Math.cos(t * Math.PI / 2), .9), 10.95 + t * 1.49)); }
  for (let half = 0; half < 2; half++) add('nose', new THREE.LatheGeometry(nosePoints, 48, half * Math.PI, Math.PI), steel, [0, 0, 0], { shell: half === 0 });
  const header = add('nose', new THREE.SphereGeometry(.16, 28, 20), oxygen, [0, 11.82, 0], { internal: true }); header.scale.y = 1.25;
  add('nose', new THREE.SphereGeometry(.12, 24, 16), methane, [0, 11.44, 0], { internal: true });
  add('nose', new THREE.CylinderGeometry(.025, .025, .9, 12), oxygen, [.28, 11.08, 0], { internal: true });
  for (let y = 11.02; y < 12.32; y += .18) {
    const t = (y - 10.95) / 1.49; ring('nose', y, .45 * Math.pow(Math.cos(t * Math.PI / 2), .9), .0035);
  }
  // The windward TPS is a half shell; its hexagons are texture detail, not a tile count.
  add('shield', new THREE.CylinderGeometry(.458, .458, 3.55, 64, 1, true, .3, Math.PI), tiles, [0, 9.175, 0]);
  add('shield', new THREE.LatheGeometry(nosePoints.map(p => new THREE.Vector2(p.x + .007, p.y)), 64, .3, Math.PI), tiles, [0, 0, 0]);
  for (const [y, height, width] of [[11.25, .53, .33], [8.15, .85, .5]]) {
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(width, -.13); shape.lineTo(width, height * .4); shape.lineTo(.05, height); shape.closePath();
      const fin = add('flaps', new THREE.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true, bevelSize: .012, bevelThickness: .009, bevelSegments: 1, steps: 1 }), tiles, [side * .395, y, .1], { offset: [side * 1.65, 1.8, .1] });
      fin.scale.x = side; fin.rotation.y = side * -.28;
      const hinge = add('flaps', new THREE.CylinderGeometry(.036, .036, height, 12), steel, [side * .405, y + height / 2, .09], { offset: [side * 1.65, 1.8, .1] }); hinge.rotation.z = -.04 * side;
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + i * Math.PI * 2 / 3;
    const assembly = new THREE.Group(); assembly.position.set(Math.sin(a) * .43, 6.82, Math.cos(a) * .43); assembly.rotation.y = a;
    const gridMaterial = steel;
    for (let j = 0; j <= 7; j++) {
      for (const horizontal of [true, false]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? .46 : .013, .09, horizontal ? .013 : .63), gridMaterial);
        bar.position.set(horizontal ? 0 : -.23 + j * .46 / 7, 0, horizontal ? .08 + j * .63 / 7 : .395); bar.userData.part = 'gridfins'; assembly.add(bar);
      }
    }
    groups.gridfins.add(assembly); pieces.push({ mesh: assembly, part: 'gridfins', home: assembly.position.clone(), offset: new THREE.Vector3(Math.sin(a) * 1.5, .5, Math.cos(a) * 1.5), internal: false, shell: false });
  }
  function engine(part: PartId, x: number, y: number, z: number, vacuum: boolean, index: number) {
    const radius = vacuum ? .145 : .071;
    const length = vacuum ? .37 : .27;
    const profile = [[radius, 0], [radius * .91, length * .18], [radius * .56, length * .48], [radius * .29, length * .78], [radius * .32, length]].map(([r, h]) => new THREE.Vector2(r, h));
    const offset: [number, number, number] = part === 'booster-engines' ? [x * 4.2, -1.7 - (index < 3 ? .4 : 0), z * 4.2] : [x * 4, .55, z * 4];
    add(part, new THREE.LatheGeometry(profile, 24), nozzle, [x, y, z], { offset });
    add(part, new THREE.CylinderGeometry(radius * .33, radius * .29, .07, 16), copper, [x, y + length, z], { offset });
    add(part, new THREE.CylinderGeometry(radius * .38, radius * .38, .10, 12), dark, [x, y + length + .085, z], { offset });
    // Recess the throat instead of covering the nozzle exit with a flat disk.
    add(part, new THREE.CylinderGeometry(radius * .24, radius * .24, .005, 24), dark, [x, y + length * .92, z], { offset });
    for (const side of [-1, 1]) {
      add(part, new THREE.SphereGeometry(.018, 12, 8), side < 0 ? methane : oxygen, [x + side * .036, y + length + .073, z], { offset });
      const points = [[side * .035,.115,0],[side * .05,.075,.008],[side * .045,.018,.028],[side * .015,-.018,.02]].map(([dx,dy,dz]) => new THREE.Vector3(dx,dy,dz));
      add(part, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, .005, 6, false), steel, [x,y+length,z], { offset });
    }
    for (let j = 0; j < 5; j++) {
      const h = length * (j / 6); const r = radius * (1 - j * .12);
      const m = add(part, new THREE.TorusGeometry(r, .003, 4, 24), seam, [x, y + h, z], { offset }); m.rotation.x = Math.PI / 2;
    }
    add(part, new THREE.CylinderGeometry(.009, .009, .15, 8), steel, [x + radius * .5, y + length + .02, z], { offset });
  }
  let index = 0;
  for (const [count, radius] of [[3, .086], [10, .229], [20, .364]]) for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2; engine('booster-engines', Math.sin(a) * radius, .18, Math.cos(a) * radius, false, index++);
  }
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    engine('ship-engines', Math.sin(a) * .113, 7.48, Math.cos(a) * .113, false, i);
    engine('ship-engines', Math.sin(a + Math.PI / 3) * .275, 7.39, Math.cos(a + Math.PI / 3) * .275, true, i + 3);
  }
  ring('ship-engines', 7.88, .421, .022, dark);
  ring('booster-engines', .59, .421, .022, dark);

  return { root, groups, pieces, textures };
}
