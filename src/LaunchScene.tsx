import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRocket } from './rocket-model';
import { parts } from './parts';
import { EARTH_RADIUS, launchState, smooth, type CameraMode } from './launch-timeline';
import { createEarthWorld } from './earth-world';

export type LaunchSceneHandle = { reset: () => void; zoom: (factor: number) => void };
type Props = { time: number; following: boolean; cameraMode: CameraMode; onReady: () => void; onError: () => void; onOrbit: () => void };

export default forwardRef<LaunchSceneHandle, Props>(function LaunchScene(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const api = useRef<LaunchSceneHandle | null>(null);
  const [error, setError] = useState(false);
  useImperativeHandle(ref, () => ({ reset: () => api.current?.reset(), zoom: f => api.current?.zoom(f) }), []);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }); }
    catch { setError(true); latest.current.onError(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.dataset.testid = 'launch-canvas'; renderer.domElement.setAttribute('aria-label', '星舰发射过程三维动画'); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const sky = new THREE.Color('#8cabb7'); scene.background = sky;
    const camera = new THREE.PerspectiveCamera(37, 1, .1, 12000);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.minDistance = 8; controls.maxDistance = 6000; controls.maxPolarAngle = Math.PI * .8;
    const orbit = () => latest.current.onOrbit(); controls.addEventListener('start', orbit);
    const pmrem = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment(); const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture;
    const ambient = new THREE.HemisphereLight('#e0edf1', '#3d4942', 2.3); scene.add(ambient);
    const sun = new THREE.DirectionalLight('#fff0d7', 3.5); sun.position.set(-20, 45, 25); scene.add(sun);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -24; sun.shadow.camera.right = sun.shadow.camera.top = 24; sun.shadow.camera.far = 110; sun.shadow.normalBias = .03; sun.shadow.bias = -.0001;
    const rim = new THREE.DirectionalLight('#b9d6ff', 2.1); rim.position.set(20, 12, -12); scene.add(rim);
    const rocket = createRocket(); const ship = new THREE.Group(); const booster = new THREE.Group(); scene.add(ship, booster);
    for (const part of parts) {
      const group = rocket.groups[part.id]; (part.stage === 'ship' ? ship : booster).add(group);
      if (part.stage === 'ship') group.position.y = -7.35;
    }
    for (const piece of rocket.pieces) if (piece.internal) piece.mesh.visible = false;
    for (const group of [ship, booster]) group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    const ground = new THREE.Group(); scene.add(ground);
    const concrete = new THREE.MeshStandardMaterial({ color: '#a4a89f', roughness: .88 });
    const steel = new THREE.MeshStandardMaterial({ color: '#666f6c', metalness: .65, roughness: .4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#303b39', metalness: .7, roughness: .45 });
    const white = new THREE.MeshStandardMaterial({ color: '#d6ded7', metalness: .35, roughness: .5 });
    function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
      const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m;
    }
    function beam(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius = .045) {
      const m = mesh(parent, new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6), steel);
      m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
    }
    // A simplified coastal launch site establishes scale without implying exact pad CAD.
    const world = createEarthWorld(scene, ok => {
      renderer.domElement.dataset.textures = ok ? 'ready' : 'failed';
      if (ok) latest.current.onReady(); else { setError(true); latest.current.onError(); }
    });
    mesh(ground, new THREE.BoxGeometry(28, .35, 35), concrete, -5, -.15, -6);
    const terrain = mesh(ground, new THREE.CircleGeometry(38, 64), new THREE.MeshStandardMaterial({ color: '#666f50', roughness: 1 }), -18, -.38, -10); terrain.rotation.x = -Math.PI / 2;
    mesh(ground, new THREE.BoxGeometry(4, .03, 55), dark, -11, .05, -20);
    mesh(ground, new THREE.CylinderGeometry(1.12, 1.15, .35, 48), dark, 0, 1.55, 0);
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2; mesh(ground, new THREE.CylinderGeometry(.13, .19, 1.5, 10), steel, Math.cos(angle), .72, Math.sin(angle));
    }
    mesh(ground, new THREE.BoxGeometry(4, .45, 7), concrete, 0, -.05, 0);
    const tower = new THREE.Group(); tower.position.set(-2.6, 0, -1.8); ground.add(tower);
    for (const x of [-.55, .55]) for (const z of [-.55, .55]) mesh(tower, new THREE.BoxGeometry(.14, 14.5, .14), steel, x, 7.25, z);
    for (let level = 0; level < 12; level++) {
      const y = level * 1.2;
      mesh(tower, new THREE.BoxGeometry(1.25, .08, 1.25), dark, 0, y, 0);
      for (const z of [-.55, .55]) beam(tower, new THREE.Vector3(-.55, y, z), new THREE.Vector3(.55, y + 1.2, z));
      for (const x of [-.55, .55]) beam(tower, new THREE.Vector3(x, y, -.55), new THREE.Vector3(x, y + 1.2, .55));
    }
    mesh(tower, new THREE.BoxGeometry(1.6, .28, 1.6), white, 0, 14.45, 0);
    const arms = new THREE.Group(); arms.position.set(.55, 8.85, .35); tower.add(arms);
    for (const z of [-.45, .55]) {
      mesh(arms, new THREE.BoxGeometry(2.2, .13, .13), steel, 1.05, 0, z);
      beam(arms, new THREE.Vector3(0, .5, z), new THREE.Vector3(2.1, 0, z), .04);
    }
    for (let i = 0; i < 5; i++) {
      mesh(ground, new THREE.CylinderGeometry(.75, .75, 3.6, 24), white, -8 - i % 2 * 2, 1.8, -9 - Math.floor(i / 2) * 2.3);
      const dome = mesh(ground, new THREE.SphereGeometry(.75, 20, 12), white, -8 - i % 2 * 2, 3.6, -9 - Math.floor(i / 2) * 2.3); dome.scale.y = .4;
    }
    mesh(ground, new THREE.BoxGeometry(6, 2, 3), white, -14, 1, -4);
    ground.traverse(o => { if (o instanceof THREE.Mesh) { o.receiveShadow = true; o.castShadow = o.geometry.type !== 'CircleGeometry'; } });
    const puffData = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const u = (x - 64) / 64, v = (y - 64) / 64, r = Math.hypot(u, v);
      const noise = .72 + Math.sin(u * 14 + Math.sin(v * 11)) * .12 + Math.cos(v * 23 + u * 19) * .08;
      const index = (y * 128 + x) * 4;
      puffData[index] = puffData[index + 1] = puffData[index + 2] = 220 + noise * 30;
      puffData[index + 3] = Math.max(0, Math.pow(Math.max(0, 1 - r), 1.7) * noise * 255);
    }
    const puffTexture = new THREE.DataTexture(puffData, 128, 128); puffTexture.needsUpdate = true; puffTexture.colorSpace = THREE.SRGBColorSpace;

    function plume(parent: THREE.Object3D, width: number, length: number) {
      const group = new THREE.Group(); parent.add(group);
      const outer = new THREE.MeshBasicMaterial({ color: '#ffbd73', transparent: true, opacity: .33, depthWrite: false, blending: THREE.AdditiveBlending });
      const core = new THREE.MeshBasicMaterial({ color: '#edf7ff', transparent: true, opacity: .92, depthWrite: false, blending: THREE.AdditiveBlending });
      const blue = new THREE.MeshBasicMaterial({ color: '#82b8ff', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
      mesh(group, new THREE.CylinderGeometry(width * .65, width * .14, length, 32, 1, true), outer, 0, -length / 2, 0);
      mesh(group, new THREE.CylinderGeometry(width * .34, .015, length * .87, 24, 1, true), core, 0, -length * .435, 0);
      mesh(group, new THREE.CylinderGeometry(width * .5, .025, length * .96, 24, 1, true), blue, 0, -length * .48, 0);
      for (let i = 0; i < 7; i++) {
        const diamond = mesh(group, new THREE.SphereGeometry(width * .22 * (1 - i * .08), 12, 8), core, 0, -.3 - i * length / 8, 0); diamond.scale.y = 1.8;
      }
      return group;
    }
    const boosterPlume = plume(booster, .8, 5.8); boosterPlume.position.y = .18;
    const shipPlume = plume(ship, .46, 4.0); shipPlume.position.y = .05;
    const engineGlow = new THREE.PointLight('#ffb979', 0, 12); booster.add(engineGlow); engineGlow.position.y = -.4;
    const ventMaterial = new THREE.MeshBasicMaterial({ color: '#ffd6a5', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const vent = mesh(booster, new THREE.CylinderGeometry(.7, .55, .25, 40, 1, true), ventMaterial, 0, 7.2, 0);
    const plasmaMaterial = new THREE.MeshBasicMaterial({ color: '#ff6d30', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const plasma = mesh(ship, new THREE.CapsuleGeometry(.61, 3.3, 12, 28), plasmaMaterial, 0, 2.2, .16); plasma.scale.z = 1.13;
    const plasmaCore = mesh(ship, new THREE.CapsuleGeometry(.5, 3.4, 12, 28), new THREE.MeshBasicMaterial({ color: '#ffd397', transparent: true, opacity: .15, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 2.2, .28);
    const plasmaLight = new THREE.PointLight('#ff7e37', 0, 12); ship.add(plasmaLight); plasmaLight.position.set(0, 2, 2);
    const sprayMaterial = new THREE.MeshBasicMaterial({ color: '#e2f1ef', map: puffTexture, transparent: true, opacity: 0, depthWrite: false });
    const spray = new THREE.InstancedMesh(new THREE.PlaneGeometry(.85, .85), sprayMaterial, 90); spray.frustumCulled = false; world.ocean.add(spray);
    const wakeMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { opacity: { value: 0 } }, vertexShader: 'varying vec2 p; void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'uniform float opacity; varying vec2 p; void main(){float r=length(p);float a=smoothstep(1.0,1.12,r)*(1.0-smoothstep(1.15,1.3,r));a*=.55+.45*sin(atan(p.y,p.x)*43.0);gl_FragColor=vec4(.8,.92,.91,a*opacity);}' });
    const wake = mesh(world.ocean, new THREE.RingGeometry(1, 1.3, 100), wakeMaterial, 0, .08, 0); wake.rotation.x = -Math.PI / 2;
    const markerMaterial = new THREE.MeshBasicMaterial({ color: '#d0ef9b', depthTest: false });
    const shipMarker = mesh(scene, new THREE.SphereGeometry(4, 16, 12), markerMaterial);
    const boosterMarker = mesh(scene, new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffc489', depthTest: false }));
    const paths = new THREE.Group(); scene.add(paths);
    for (const stage of ['ship', 'booster'] as const) {
      const points = Array.from({ length: 167 }, (_, t) => { const s = launchState(t)[stage]; return new THREE.Vector3(s.x, s.y + 2, 0); });
      paths.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: stage === 'ship' ? '#d0ef9b' : '#ffc489', dashSize: 4, gapSize: 3, transparent: true, opacity: .6, depthTest: false })).computeLineDistances());
    }
    const smokeMaterial = new THREE.MeshBasicMaterial({ color: '#d2d9d5', map: puffTexture, transparent: true, opacity: .7, depthWrite: false });
    const smoke = new THREE.InstancedMesh(new THREE.PlaneGeometry(4, 4), smokeMaterial, 70); smoke.frustumCulled = false; ground.add(smoke);
    const dummy = new THREE.Object3D();
    const starsGeometry = new THREE.BufferGeometry(); const starPositions = [];
    for (let i = 0; i < 750; i++) { const a = i * 2.39996; const y = 1 - 2 * (i + .5) / 750; const r = Math.sqrt(1 - y * y); starPositions.push(Math.cos(a) * r * 7000, y * 7000, Math.sin(a) * r * 7000); }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: '#dce9ed', size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0 }); scene.add(new THREE.Points(starsGeometry, starMaterial));
    let resetRequested = true, zoom = 1, disposed = false, frameId = 0;
    let width = 1, height = 1;
    const target = new THREE.Vector3(), desiredPosition = new THREE.Vector3(), offset = new THREE.Vector3();
    const normalSky = new THREE.Color('#8cabb7'), spaceSky = new THREE.Color('#080d17');
    const fog = new THREE.FogExp2(normalSky, .003); scene.fog = fog;
    const groundMaterials = new Set<THREE.Material>();
    ground.traverse(o => { if (o instanceof THREE.Mesh && o !== smoke) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.transparent = true; groundMaterials.add(m); }); });
    api.current = { reset() { resetRequested = true; zoom = 1; }, zoom(f) { zoom = THREE.MathUtils.clamp(zoom * f, .6, 2.2); if (!latest.current.following) camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); } };
    const observer = new ResizeObserver(() => {
      width = el.clientWidth; height = el.clientHeight; if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); resetRequested = true;
    }); observer.observe(el);
    const lost = (event: Event) => { event.preventDefault(); setError(true); latest.current.onError(); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    function frame() {
      if (disposed) return; frameId = requestAnimationFrame(frame); if (document.hidden) return;
      const p = latest.current, state = launchState(p.time), t = state.time;
      booster.position.set(state.booster.x, state.booster.y, 0); booster.rotation.z = state.booster.angle;
      ship.position.set(state.ship.x, state.ship.y, 0); ship.rotation.z = state.ship.angle;
      arms.rotation.y = -state.armRetraction * 1.15;
      arms.position.y = 8.85 + smooth((t - 68) / 10) * 2.4;
      const flutter = 1 + Math.sin(t * 39) * .025 + Math.sin(t * 63) * .018;
      boosterPlume.visible = state.boosterPower > .01; boosterPlume.scale.setScalar(Math.max(.001, state.boosterPower)); boosterPlume.scale.y *= flutter;
      shipPlume.visible = state.shipPower > .01;
      const clearance = THREE.MathUtils.lerp(.13, 1, state.separation);
      shipPlume.scale.set(state.shipPower, state.shipPower * clearance * flutter, state.shipPower);
      engineGlow.intensity = state.boosterPower * 14;
      ventMaterial.opacity = state.shipPower * (1 - smooth((t - 42) / 3)) * .8; vent.scale.x = vent.scale.z = 1 + .15 * Math.sin(t * 22);
      plasmaMaterial.opacity = state.heating * (.2 + Math.sin(t * 21) * .015); plasma.visible = plasmaCore.visible = state.heating > .001; plasmaLight.intensity = state.heating * 9;
      plasma.scale.x = 1 + state.heating * .13 * Math.sin(t * 7);
      world.update(t); world.waterMaterial.uniforms.opacity.value = smooth((t - 125) / 10);
      spray.visible = wake.visible = state.splash > .001; sprayMaterial.opacity = state.splash * .8; wakeMaterial.uniforms.opacity.value = state.splash * .32;
      const splashAge = Math.max(0, t - 154);
      dummy.quaternion.copy(world.ocean.quaternion).invert().multiply(camera.quaternion);
      for (let i = 0; i < 90; i++) {
        const a = i * 2.39996, age = (splashAge * .4 + i / 90) % 1, radius = .6 + age * 4;
        dummy.position.set(Math.cos(a) * radius, Math.sin(age * Math.PI) * (1.5 + i % 4 * .4), Math.sin(a) * radius);
        dummy.scale.setScalar(.5 + Math.sin(age * Math.PI)); dummy.updateMatrix(); spray.setMatrixAt(i, dummy.matrix);
      }
      spray.instanceMatrix.needsUpdate = true; wake.scale.setScalar(1 + splashAge * .6);
      smoke.visible = state.smoke > .005; smokeMaterial.opacity = state.smoke * .45;
      dummy.quaternion.copy(camera.quaternion);
      for (let i = 0; i < 70; i++) {
        const age = ((Math.max(0, t - 5) * .19 + i / 70) % 1), a = i * 2.39996;
        const radius = 1 + age * 9;
        dummy.position.set(Math.cos(a) * radius, .25 + Math.sin(age * Math.PI) * (1.3 + i % 3 * .3), Math.sin(a) * radius);
        const size = (.2 + Math.sin(age * Math.PI) * 1.45) * state.smoke;
        dummy.scale.set(size * 1.4, size * .7, size); dummy.updateMatrix(); smoke.setMatrixAt(i, dummy.matrix);
      }
      smoke.instanceMatrix.needsUpdate = true;
      const boosterTarget = new THREE.Vector3(state.booster.x - Math.sin(state.booster.angle) * 3.5, state.booster.y + Math.cos(state.booster.angle) * 3.5, 0);
      const shipTarget = new THREE.Vector3(state.ship.x - Math.sin(state.ship.angle) * 2.5, state.ship.y + Math.cos(state.ship.angle) * 2.5, 0);
      target.copy(boosterTarget);
      let distance = 26, altitude = state.booster.altitude, radialX = 0;
      if (p.cameraMode === 'ship' || (p.cameraMode === 'cinematic' && t >= 91)) {
        const mix = p.cameraMode === 'ship' ? 1 : state.focusShip;
        target.lerp(shipTarget, mix); distance = 26 - mix * 5 + Math.sin(mix * Math.PI) * 140;
        altitude = state.booster.altitude * (1 - mix) + state.ship.altitude * mix; radialX = state.ship.x / EARTH_RADIUS * mix;
      } else if (p.cameraMode === 'cinematic' && t < 52) {
        target.set(state.booster.x - Math.sin(state.booster.angle) * 6, state.booster.y + Math.cos(state.booster.angle) * 6, 0);
        const separating = smooth((t - 40) / 5), returning = smooth((t - 48) / 4);
        target.lerp(boosterTarget.clone().lerp(shipTarget, .5), separating).lerp(boosterTarget, returning);
        distance = 26 + separating * (1 - returning) * 12;
      }
      distance *= Math.max(1, .9 / camera.aspect) * zoom;
      const radialAngle = Math.asin(radialX);
      camera.up.set(radialX, Math.sqrt(1 - radialX * radialX), 0);
      offset.set(.48, .17 + smooth((altitude - 15) / 30) * .35, 1).normalize().multiplyScalar(distance).applyAxisAngle(new THREE.Vector3(0, 0, 1), -radialAngle);
      desiredPosition.copy(target).add(offset);
      if (p.cameraMode === 'ground') {
        camera.up.set(0, 1, 0); desiredPosition.set(19 * zoom, 6, 29 * zoom); altitude = 0;
        target.copy(t < 94 ? boosterTarget : shipTarget);
      }
      const globeView = p.cameraMode === 'earth';
      controls.minDistance = globeView ? EARTH_RADIUS + 40 : 8; controls.maxDistance = globeView ? 6000 : 400;
      if (globeView) {
        target.set(0, -EARTH_RADIUS, 0); camera.up.set(0, 1, 0);
        desiredPosition.copy(target).add(new THREE.Vector3(.25, 1.4, .65).normalize().multiplyScalar(2700 * Math.max(1, .95 / camera.aspect) * zoom)); altitude = 200;
      }
      const nearPlane = globeView ? 2 : .1;
      if (camera.near !== nearPlane) { camera.near = nearPlane; camera.updateProjectionMatrix(); }
      const darkness = globeView ? 1 : smooth((altitude - 25) / 65);
      sky.copy(normalSky).lerp(spaceSky, darkness); ambient.intensity = 1.55 - darkness * .65;
      fog.color.copy(sky); fog.density = globeView ? 0 : .0025 * (1 - darkness);
      starMaterial.opacity = darkness * .65;
      world.atmosphereMaterial.uniforms.strength.value = globeView ? 1 : smooth((altitude - 25) / 65);
      const groundOpacity = globeView ? 0 : 1 - smooth((altitude - 15) / 45);
      ground.visible = groundOpacity > .001; groundMaterials.forEach(m => { m.opacity = groundOpacity; });
      paths.visible = shipMarker.visible = boosterMarker.visible = globeView;
      shipMarker.position.copy(shipTarget); boosterMarker.position.copy(boosterTarget);
      if (p.following || resetRequested) { controls.target.copy(target); camera.position.copy(desiredPosition); controls.update(); }
      renderer.domElement.dataset.phase = String(state.phase); renderer.domElement.dataset.time = t.toFixed(2);
      renderer.domElement.dataset.separated = String(state.separation > .01);
      renderer.domElement.dataset.captured = String(state.captured); renderer.domElement.dataset.landed = String(state.landed);
      renderer.domElement.dataset.camera = p.cameraMode;
      resetRequested = false; renderer.render(scene, camera);
    }
    frameId = requestAnimationFrame(frame);
    return () => {
      disposed = true; cancelAnimationFrame(frameId); observer.disconnect(); controls.removeEventListener('start', orbit); controls.dispose(); api.current = null;
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); if (o instanceof THREE.InstancedMesh) o.dispose(); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); rocket.textures.forEach(t => t.dispose()); puffTexture.dispose(); sun.shadow.dispose(); world.dispose(); environment.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <><div className="canvas-host launch-canvas-host" ref={host}/>{error && <div className="scene-error" role="alert"><strong>发射视图暂时不可用</strong><p>请检查浏览器硬件加速设置。</p><button onClick={() => location.reload()}>重新加载</button></div>}</>;
});
