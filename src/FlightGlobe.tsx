import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { boosterGuide, boosterPositionAt, flight5State, isAscentCamera, isReturnCamera, isShipCamera, returnCameraAvailable, shipGuide, shipPositionAt, STARBASE, type OverviewCamera } from './flight5-timeline';
import { geoToGlobe, sunDirectionEcef, WGS84_A, WGS84_B, METERS_PER_GLOBE_UNIT, type GeoPoint, type XYZ } from './mission-geo';
import { createReturnScene } from './return-scene';
import { createShip30Scene } from './ship30-scene';
import { shipCameraAvailable } from './ship30-state';
import { createAscentScene } from './ascent-scene';
import { ascentCameraAvailable } from './ascent-layout';

export type FlightGlobeHandle = { reset: () => void; zoom: (factor: number) => void };
type Props = { time: number; camera: OverviewCamera; onReady: () => void; onError: () => void };
const vector = (p: XYZ) => new THREE.Vector3(p.x, p.y, p.z);
const position = (p: GeoPoint) => vector(geoToGlobe(p));
const A = WGS84_A / METERS_PER_GLOBE_UNIT, B = WGS84_B / METERS_PER_GLOBE_UNIT;

export default forwardRef<FlightGlobeHandle, Props>(function FlightGlobe(props, ref) {
  const host = useRef<HTMLDivElement>(null), current = useRef(props); current.current = props;
  const api = useRef<FlightGlobeHandle | null>(null), shipLabel = useRef<HTMLSpanElement>(null), boosterLabel = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false), [textureFailed, setTextureFailed] = useState(false);
  useImperativeHandle(ref, () => ({ reset: () => api.current?.reset(), zoom: f => api.current?.zoom(f) }), []);
  useEffect(() => {
    const el = host.current!; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
    catch { setFailed(true); current.current.onError(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.dataset.testid = 'flight-globe'; renderer.domElement.setAttribute('aria-label', 'Flight 5 地球与两级示意航迹'); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#080d10');
    let nearScene: ReturnType<typeof createReturnScene> | undefined;
    let shipScene: ReturnType<typeof createShip30Scene> | undefined;
    let ascentScene: ReturnType<typeof createAscentScene> | undefined;
    const camera = new THREE.PerspectiveCamera(36, 1, .002, 150), inset = new THREE.PerspectiveCamera(34, 1, .002, 150);
    const surfaceMaterial = new THREE.MeshPhongMaterial({ color: '#ffffff', shininess: 14, specular: '#17272a' });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(A, 160, 96), surfaceMaterial); globe.scale.y = B / A; scene.add(globe);
    let disposed = false, dirty = true, ready = false;
    const manager = new THREE.LoadingManager(); manager.onLoad = () => { if (!disposed) { ready = true; dirty = true; current.current.onReady(); } };
    manager.onError = () => { if (!disposed) setTextureFailed(true); };
    const loader = new THREE.TextureLoader(manager);
    const day = loader.load('/textures/earth-day.jpg', () => { dirty = true; }); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); surfaceMaterial.map = day;
    const cloudsMap = loader.load('/textures/earth-clouds.png', () => { dirty = true; }); cloudsMap.colorSpace = THREE.SRGBColorSpace;
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(A + .009, 128, 80), new THREE.MeshPhongMaterial({ map: cloudsMap, transparent: true, opacity: .32, depthWrite: false, shininess: 0 })); clouds.scale.y = B / A; scene.add(clouds);
    scene.add(new THREE.AmbientLight('#b6cbd1', .20));
    const sun = new THREE.DirectionalLight('#fff5e7', 2.5); scene.add(sun);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(A + .065, 128, 80), new THREE.ShaderMaterial({
      uniforms: { sun: { value: new THREE.Vector3(1, 0, 0) } }, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 n; varying vec3 eye; varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.); world=p.xyz; n=normalize(mat3(modelMatrix)*normal); eye=cameraPosition-p.xyz; gl_Position=projectionMatrix*viewMatrix*p;}',
      fragmentShader: 'uniform vec3 sun; varying vec3 n; varying vec3 eye; varying vec3 world; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),5.); float lit=smoothstep(-.2,.5,dot(normalize(world),sun));gl_FragColor=vec4(.18,.48,.8,rim*lit*.45);}',
    })); atmosphere.scale.y = B / A; scene.add(atmosphere);
    function path(points: typeof shipGuide, color: string) {
      const positions: THREE.Vector3[] = [];
      for (let t = 0; t <= 3940; t += 5) positions.push(position(points === boosterGuide ? boosterPositionAt(t) : shipPositionAt(t)));
      const geometry = new THREE.BufferGeometry().setFromPoints(positions);
      const future = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color, dashSize: .035, gapSize: .025, transparent: true, opacity: .38 })); future.computeLineDistances(); scene.add(future);
      const pastGeometry = geometry.clone(), past = new THREE.Line(pastGeometry, new THREE.LineBasicMaterial({ color })); scene.add(past);
      return { past, future };
    }
    const shipPath = path(shipGuide, '#b3e6de'), boosterPath = path(boosterGuide, '#e5ba78');
    const markerGeometry = new THREE.SphereGeometry(1, 16, 12);
    const ship = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: '#d6fff6' })); scene.add(ship);
    const booster = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: '#f5c47b' })); scene.add(booster);
    const launch = new THREE.Mesh(new THREE.RingGeometry(.012, .022, 32), new THREE.MeshBasicMaterial({ color: '#efca89', side: THREE.DoubleSide })); launch.position.copy(position({ ...STARBASE, altitudeM: 1200 })); launch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), launch.position.clone().normalize()); scene.add(launch);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.enablePan = false; controls.minDistance = A + .15; controls.maxDistance = 60;
    let follow = true, zoom = 1, lastCamera = current.current.camera, width = 0, height = 0, raf = 0, drawn = '';
    const changed = () => { dirty = true; }, orbit = () => { follow = false; dirty = true; };
    controls.addEventListener('change', changed); controls.addEventListener('start', orbit);
    api.current = { reset() { follow = true; zoom = 1; dirty = true; }, zoom(f) { zoom = THREE.MathUtils.clamp(zoom * f, .8, 1.8); if (!follow && !isReturnCamera(current.current.camera) && !isShipCamera(current.current.camera) && !isAscentCamera(current.current.camera)) { camera.position.sub(controls.target).multiplyScalar(f).add(controls.target); controls.update(); } dirty = true; } };
    const resize = new ResizeObserver(changed); resize.observe(el);
    const lost = (e: Event) => { e.preventDefault(); setFailed(true); current.current.onError(); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    const ray = new THREE.Ray(), unitSphere = new THREE.Sphere(new THREE.Vector3(), 1), hit = new THREE.Vector3();
    function label(element: HTMLSpanElement | null, point: THREE.Vector3, visible: boolean, mask: { left: number; top: number; width: number; height: number }) {
      if (!element) return;
      const from = camera.position.clone().divide(new THREE.Vector3(A, B, A)), to = point.clone().divide(new THREE.Vector3(A, B, A));
      ray.set(from, to.clone().sub(from).normalize());
      const blocked = ray.intersectSphere(unitSphere, hit) && hit.distanceTo(from) < to.distanceTo(from) - .0005;
      const p = point.clone().project(camera);
      const x = (p.x + 1) * width / 2 + 10, y = (1 - p.y) * height / 2 - 11;
      const overlapsInset = x - 10 < mask.left + mask.width && x + 80 > mask.left && y < mask.top + mask.height && y + 22 > mask.top;
      const show = visible && !blocked && !overlapsInset && p.z < 1 && p.z > -1 && Math.abs(p.x) < .83 && Math.abs(p.y) < .76;
      element.hidden = !show; element.style.transform = `translate(${x}px, ${y}px)`;
    }
    function markerSizes(view: THREE.Camera) { ship.scale.setScalar(ship.position.distanceTo(view.position) * .005); booster.scale.setScalar(booster.position.distanceTo(view.position) * .005); }
    function render() {
      if (disposed) return; raf = requestAnimationFrame(render); if (document.hidden) return;
      const p = current.current, w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
      if (w !== width || h !== height) { width = w; height = h; renderer.setSize(w, h, false); dirty = true; }
      const key = `${p.time}:${p.camera}`; if (key === drawn && !dirty) return;
      if (lastCamera !== p.camera) { follow = true; zoom = 1; lastCamera = p.camera; }
      const state = flight5State(p.time), sunlight = sunDirectionEcef(state.date);
      const returnView = isReturnCamera(p.camera) && returnCameraAvailable(state.seconds);
      const shipView = isShipCamera(p.camera) && shipCameraAvailable(state.seconds);
      const ascentView = isAscentCamera(p.camera) && ascentCameraAvailable(state.seconds);
      const closeView = returnView || shipView || ascentView;
      controls.enabled = !closeView;
      sun.position.set(sunlight.x, sunlight.z, -sunlight.y).multiplyScalar(40); (atmosphere.material as THREE.ShaderMaterial).uniforms.sun.value.copy(sun.position).normalize();
      ship.position.copy(position(state.ship)); booster.position.copy(position(state.booster)); booster.visible = state.separated;
      shipPath.past.geometry.setDrawRange(0, Math.floor(state.seconds / 5) + 1); boosterPath.past.geometry.setDrawRange(0, Math.floor(Math.min(414, state.seconds) / 5) + 1);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      controls.minDistance = p.camera === 'global' ? A + .15 : .3;
      controls.maxDistance = p.camera === 'global' ? 60 : 12;
      controls.maxPolarAngle = Math.PI;
      if (follow) {
        const focus = p.camera === 'booster' || isReturnCamera(p.camera) || isAscentCamera(p.camera) ? STARBASE : state.ship;
        camera.up.set(0, 1, 0);
        if (p.camera === 'global') {
          controls.target.set(0, 0, 0);
          const longitude = THREE.MathUtils.lerp(-40, 55, state.seconds / 3940);
          camera.position.copy(position({ lat: 10, lon: longitude, altitudeM: 0 }).normalize().multiplyScalar(A * 3.5 * Math.max(1, .85 / camera.aspect) * zoom));
        } else {
          const target = position({ ...focus, altitudeM: 0 });
          const normal = target.clone().normalize(), east = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
          const distance = p.camera === 'booster' ? 1.2 : 2.5;
          camera.position.copy(target).add(normal.multiplyScalar(distance * zoom * Math.max(1, .8 / camera.aspect))).add(east.multiplyScalar(-distance * .4));
          controls.target.copy(target);
        }
        controls.update();
      }
      if (p.camera !== 'global') {
        const normal = controls.target.clone().normalize();
        const heightAboveTangent = camera.position.clone().sub(controls.target).dot(normal);
        if (heightAboveTangent < .15) { camera.position.addScaledVector(normal, .15 - heightAboveTangent); camera.lookAt(controls.target); }
      }
      markerSizes(camera); renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.clear();
      if (!closeView) renderer.render(scene, camera);
      let nearData: ReturnType<ReturnType<typeof createReturnScene>['update']> | undefined;
      let shipData: ReturnType<ReturnType<typeof createShip30Scene>['update']> | undefined;
      let ascentData: ReturnType<ReturnType<typeof createAscentScene>['update']> | undefined;
      if (closeView) {
        if (ascentView) { ascentScene ??= createAscentScene(renderer); ascentData = ascentScene.update(state, p.camera === 'ascent-ground' ? 'ascent-ground' : 'ascent', w / h, zoom); }
        else if (shipView) { shipScene ??= createShip30Scene(renderer); shipData = shipScene.update(state, p.camera === 'ship-heat' ? 'ship-heat' : 'ship-close', w / h, zoom); }
        else { nearScene ??= createReturnScene(renderer); nearData = nearScene.update(state, p.camera === 'ground' ? 'ground' : 'return', w / h, zoom); }
        const activeScene = ascentView ? ascentScene! : shipView ? shipScene! : nearScene!, activeData = ascentData ?? shipData ?? nearData!;
        const hidden: THREE.Object3D[] = [ship, booster, launch, shipPath.past, shipPath.future, boosterPath.past, boosterPath.future];
        if (!shipView || state.ship.altitudeM < 16000) hidden.push(clouds);
        if (!shipView || state.ship.altitudeM < 80000) hidden.push(atmosphere);
        const visibility = hidden.map(o => o.visible); hidden.forEach(o => { o.visible = false; });
        const atmosphereScale = atmosphere.scale.clone();
        if (shipView) atmosphere.scale.multiplyScalar((A + .012) / (A + .065));
        scene.background = activeData.sky; scene.fog = activeData.earthFog;
        renderer.render(scene, activeScene.earthCamera);
        atmosphere.scale.copy(atmosphereScale);
        scene.background = new THREE.Color('#080d10'); scene.fog = null; hidden.forEach((o, i) => { o.visible = visibility[i]; });
        renderer.autoClear = false; renderer.clearDepth(); renderer.render(activeScene.scene, activeScene.camera); renderer.autoClear = true;
      }
      const iw = Math.min(190, Math.floor(w * .32)), ih = Math.min(145, Math.floor(h * .30));
      const insetTop = w < 620 ? 58 : h - ih - 12;
      const insetMask = { left: w - iw - 12, top: insetTop, width: iw, height: ih };
      if (shipLabel.current) shipLabel.current.textContent = state.separated ? 'S30' : 'B12 + S30';
      label(shipLabel.current, ship.position, true, insetMask); label(boosterLabel.current, booster.position, state.separated, insetMask);
      if (closeView) { if (shipLabel.current) shipLabel.current.hidden = true; if (boosterLabel.current) boosterLabel.current.hidden = true; }
      // A regional second camera keeps B12 visible when S30 passes beyond its horizon.
      const anchor = position(STARBASE), up = anchor.clone().normalize();
      inset.position.copy(anchor).add(up.multiplyScalar(1.4)); inset.up.set(0, 1, 0); inset.lookAt(anchor); inset.aspect = iw / ih; inset.updateProjectionMatrix();
      if (returnView) { inset.position.copy(position({ ...state.ship, altitudeM: 0 }).normalize().multiplyScalar(A * 3.6)); inset.lookAt(0, 0, 0); }
      markerSizes(inset); renderer.setScissorTest(true); renderer.setScissor(w - iw - 12, h - insetTop - ih, iw, ih); renderer.setViewport(w - iw - 12, h - insetTop - ih, iw, ih); renderer.clear(); renderer.render(scene, inset); renderer.setScissorTest(false);
      Object.assign(renderer.domElement.dataset, { ready: String(ready), time: p.time.toFixed(2), missionTime: state.seconds.toFixed(2), camera: p.camera, separated: String(state.separated), caught: String(state.caught), splashed: String(state.splashed), positionKind: state.positionKind, sun: sun.position.toArray().map(v => v.toFixed(5)).join(','), ship: ship.position.toArray().join(','), booster: booster.position.toArray().join(','), cameraDistance: camera.position.distanceTo(controls.target).toFixed(4) });
      Object.assign(renderer.domElement.dataset, { near: String(closeView), localBooster: nearData ? JSON.stringify(nearData.local) : '', nearContact: String(nearData?.contact ?? false), nearPlume: String(nearData?.plume ?? false), nearFov: nearData?.fov.toFixed(5) ?? '', nearCamera: nearData?.cameraPosition.join(',') ?? '' });
      Object.assign(renderer.domElement.dataset, { shipNear: String(shipView), shipPitch: shipData?.pose.pitch.toFixed(6) ?? '', shipHeat: shipData?.pose.heat.toFixed(6) ?? '', shipPower: shipData?.pose.power.toFixed(6) ?? '', shipSplash: String(shipData?.pose.splash ?? false), shipLocal: shipData?.local.join(',') ?? '', shipQuaternion: shipData?.quaternion.join(',') ?? '', shipCourse: shipData?.course.join(',') ?? '', shipTiles: String(shipData?.tileCount ?? 0), shipEngines: String(shipData?.engineCount ?? 0), shipCameraPosition: shipData?.cameraPosition.join(',') ?? '' });
      Object.assign(renderer.domElement.dataset, { ascentNear: String(ascentView), ascentLocal: ascentData ? JSON.stringify(ascentData.local) : '', ascentQuaternion: ascentData?.quaternion.join(',') ?? '', ascentCamera: ascentData?.cameraPosition.join(',') ?? '', ascentFov: String(ascentData?.fov ?? ''), ascentEngines: String(ascentData?.engines ?? 0), ascentRing: String(ascentData?.ring ?? false), ascentNose: ascentData?.nose.join(',') ?? '' });
      dirty = false; drawn = key;
    }
    raf = requestAnimationFrame(render);
    return () => {
      disposed = true; cancelAnimationFrame(raf); resize.disconnect(); controls.dispose(); api.current = null; renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); nearScene?.dispose(); shipScene?.dispose(); ascentScene?.dispose(); day.dispose(); cloudsMap.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <><div ref={host} className="canvas-host"/><span ref={shipLabel} hidden className="globe-marker-label">S30</span><span ref={boosterLabel} hidden className="globe-marker-label booster">B12</span>{textureFailed && <span className="globe-asset-warning" role="status">地球底图加载失败</span>}{failed && <div className="scene-error" role="alert"><strong>三维场景暂时不可用</strong><p>事件记录仍可查看。</p><button onClick={() => location.reload()}>重新加载</button></div>}</>;
});
