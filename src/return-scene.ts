import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCaptureBooster } from './capture-model';
import { createLaunchSite } from './launch-site';
import { captureSite, captureState } from './mission-data';
import { captureClipAt, STARBASE, type flight5State } from './flight5-timeline';
import { ecefDirectionToEnu, enuBasis, geoToGlobe, geoToLocal, localToGeo, solarElevation, sunDirectionEcef } from './mission-geo';
import { GRID_FIN_AZIMUTHS } from './grid-fins';

export const groundObserver = new THREE.Vector3(30, 1.8, 100);
type State = ReturnType<typeof flight5State>;

// Local east/up/south in 10 m units. The scene is a rendering of the global
// state, not a second trajectory or a second playback clock.
export function createReturnScene(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .05, 30000);
  const earthCamera = new THREE.PerspectiveCamera(34, 1, .00002, 150);
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(room, .04); scene.environment = env.texture;
  const sky = new THREE.Color('#adc6cd');
  const fog = new THREE.Fog(sky, 65, 260); scene.fog = fog;
  const earthFog = new THREE.Fog(sky, .00065, .0026);
  const light = new THREE.DirectionalLight('#ffead0', 3.0), ambient = new THREE.HemisphereLight('#e7f1f3', '#666959', 2.3); scene.add(light, light.target, ambient);
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.camera.left = light.shadow.camera.bottom = -25; light.shadow.camera.right = light.shadow.camera.top = 25; light.shadow.camera.far = 200; light.shadow.normalBias = .02;
  const steel = new THREE.MeshStandardMaterial({ color: '#9ba4a5', metalness: .7, roughness: .5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#46555a', metalness: .6, roughness: .6 });
  const white = new THREE.MeshStandardMaterial({ color: '#ced4cf', roughness: .8 });
  const site = createLaunchSite(steel, dark, white, captureSite); scene.add(site.root);
  site.root.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true; });
  const booster = createCaptureBooster(); booster.pinHighlights.visible = false; scene.add(booster.root);
  const terrain = new THREE.Group(); scene.add(terrain);
  function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 1 })); mesh.position.set(x, y, z); mesh.receiveShadow = true; terrain.add(mesh);
  }
  box(55, .2, 45, -8, -.18, -12, '#a5aaa0');
  box(180, .15, 200, -45, -.31, -38, '#727e61');
  box(600, .12, 600, 0, -.43, 0, '#819fa5');
  const plume = new THREE.Group(); booster.root.add(plume); plume.position.y = .2;
  const flameMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, power: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float time; uniform float power; varying vec2 vUv;
      void main(){float y=vUv.y;float waves=sin(y*75.-time*32.+sin(vUv.x*44.))*0.08;
      float fade=smoothstep(0.,.16,y)*(.7+waves);vec3 color=mix(vec3(1.,.28,.06),vec3(.7,.85,1.),pow(y,2.));
      gl_FragColor=vec4(color,fade*power*.55);}`,
  });
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.CylinderGeometry(.075, .17, 4.1, 24, 16, true), flameMaterial);
    const a = i * Math.PI * 2 / 3; flame.position.set(Math.sin(a) * .086, -2.05, Math.cos(a) * .086); plume.add(flame);
  }
  const target = new THREE.Vector3();
  function update(state: State, mode: 'return' | 'ground' | 'fins', aspect: number, zoom: number) {
    const pose = captureState(captureClipAt(state.seconds)), local = geoToLocal(state.booster, STARBASE);
    booster.root.position.set(local.x, local.y, local.z);
    const up = ecefDirectionToEnu(enuBasis(state.booster).up, STARBASE);
    // The final approach uses the capture site's tangent frame exactly, so
    // geodetic vertical does not rotate the support pins away from the rails.
    booster.root.quaternion.identity();
    if (state.seconds < 390) booster.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(up.x, up.z, -up.y).normalize());
    booster.root.rotateZ(state.seconds >= 390 ? pose.angle : -.055);
    const finAngles = booster.updateGridFins(state.seconds);
    site.update(pose);
    plume.visible = state.seconds >= 390 && pose.power > 0;
    plume.scale.y = 1 + .035 * Math.sin(pose.time * 43);
    flameMaterial.uniforms.time.value = pose.time; flameMaterial.uniforms.power.value = pose.power * 2;
    target.copy(booster.root.position).add(new THREE.Vector3(0, 3.5, 0));
    if (mode === 'fins') target.set(0, 6.7, 0).applyQuaternion(booster.root.quaternion).add(booster.root.position);
    const sunlight = ecefDirectionToEnu(sunDirectionEcef(state.date), STARBASE);
    light.target.position.copy(target); light.position.copy(target).add(new THREE.Vector3(sunlight.x, sunlight.z, -sunlight.y).multiplyScalar(100));
    camera.aspect = aspect; camera.up.set(0, 1, 0);
    if (mode === 'ground') {
      camera.position.copy(groundObserver);
      const distance = camera.position.distanceTo(target);
      camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(6.2 * Math.max(1, .8 / aspect) * zoom / distance)), .04, 42);
    } else {
      camera.fov = 34;
      const offset = mode === 'fins' ? new THREE.Vector3(3, 2.8, 4).applyQuaternion(booster.root.quaternion) : new THREE.Vector3(10, 3, 22);
      camera.position.copy(target).add(offset.multiplyScalar(zoom * Math.max(1, .8 / aspect)));
    }
    camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    // Reproject the very same local camera into the global Earth pass.
    const observer = localToGeo(camera.position, STARBASE), globalPosition = geoToGlobe(observer);
    const globalTarget = geoToGlobe(localToGeo(target, STARBASE));
    const northUp = enuBasis(STARBASE).up;
    earthCamera.position.set(globalPosition.x, globalPosition.y, globalPosition.z);
    earthCamera.up.set(northUp.x, northUp.z, -northUp.y); earthCamera.lookAt(globalTarget.x, globalTarget.y, globalTarget.z);
    earthCamera.aspect = aspect; earthCamera.fov = camera.fov; earthCamera.updateProjectionMatrix();
    const elevation = solarElevation(state.date, STARBASE);
    sky.set('#adc6cd').lerp(new THREE.Color('#101c2e'), THREE.MathUtils.clamp((observer.altitudeM - 12000) / 60000, 0, 1));
    if (elevation < -6) sky.set('#101c2e');
    const range = camera.position.distanceTo(target);
    fog.color.copy(sky); fog.near = Math.max(65, range * .9); fog.far = Math.max(fog.near + 195, range * 1.8);
    earthFog.color.copy(sky); earthFog.near = .00065; earthFog.far = .0026 + Math.pow(Math.max(0, observer.altitudeM) / 12000, 2);
    terrain.visible = state.booster.altitudeM < 5000;
    site.root.visible = state.booster.altitudeM < 10000;
    const finCenters = GRID_FIN_AZIMUTHS.map(a => {
      const p = new THREE.Vector3(Math.sin(a) * .785, 6.75, Math.cos(a) * .785).applyQuaternion(booster.root.quaternion).add(booster.root.position).project(camera);
      return [(p.x + 1) / 2, (1 - p.y) / 2];
    });
    return { local, finAngles, finCenters, contact: state.seconds >= 390 && pose.contact, plume: plume.visible, fov: camera.fov, cameraPosition: camera.position.toArray(), sky, earthFog };
  }
  return { scene, camera, earthCamera, update, dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); if (o instanceof THREE.InstancedMesh) o.dispose(); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); booster.skin.dispose(); light.shadow.dispose(); env.dispose(); room.dispose(); pmrem.dispose();
  } };
}
