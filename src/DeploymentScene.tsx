import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createDeploymentModel } from './deployment-model';
import { BAY_CENTER_Y, deploymentOrbitAt, deploymentState, type DeploymentCamera } from './deployment-state';

export type DeploymentSceneHandle = { reset: () => void; zoom: (factor: number) => void };
type Props = { time: number; camera: DeploymentCamera; satellite: number; onReady: () => void; onError: () => void };
export default forwardRef<DeploymentSceneHandle, Props>(function DeploymentScene(props, ref) {
  const host = useRef<HTMLDivElement>(null), current = useRef(props); current.current = props;
  const api = useRef<DeploymentSceneHandle | null>(null), [failed, setFailed] = useState(false);
  useImperativeHandle(ref, () => ({ reset: () => api.current?.reset(), zoom: f => api.current?.zoom(f) }), []);
  useEffect(() => {
    const el = host.current!; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); current.current.onError(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.domElement.dataset.testid = 'deployment-canvas'; renderer.domElement.setAttribute('aria-label', '星舰轨道卫星部署概念三维演示'); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), earthScene = new THREE.Scene(); earthScene.background = new THREE.Color('#03070b');
    const camera = new THREE.PerspectiveCamera(35, 1, .015, 500), earthCamera = new THREE.PerspectiveCamera(35, 1, .01, 40000);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(room, .04); scene.environment = env.texture;
    const model = createDeploymentModel(); model.root.rotation.z = -Math.PI / 2; scene.add(model.root);
    const sunlight = new THREE.Vector3(2, 4, 5).normalize();
    const light = new THREE.DirectionalLight('#fff4de', 3.2), fill = new THREE.HemisphereLight('#cbdfe6', '#53646e', 1.1);
    light.position.copy(sunlight).multiplyScalar(100); scene.add(light, fill);
    const planetMaterial = new THREE.MeshPhongMaterial({ shininess: 10, specular: '#233139' });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(6378.137, 160, 96), planetMaterial); globe.scale.y = 6356.752 / 6378.137; earthScene.add(globe);
    const cloudsMaterial = new THREE.MeshPhongMaterial({ transparent: true, opacity: .34, depthWrite: false, shininess: 0 });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(6387, 128, 80), cloudsMaterial); clouds.scale.y = 6356.752 / 6378.137; earthScene.add(clouds);
    const earthLight = new THREE.DirectionalLight('#fff5e7', 2.6); earthScene.add(earthLight, new THREE.AmbientLight('#c0d9e4', .3));
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(6430, 128, 80), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 n;varying vec3 eye;void main(){vec4 p=modelMatrix*vec4(position,1.);n=normalize(mat3(modelMatrix)*normal);eye=cameraPosition-p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
      fragmentShader: 'varying vec3 n;varying vec3 eye;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),5.);gl_FragColor=vec4(.16,.45,.72,rim*.35);}',
    })); atmosphere.scale.y = 6356.752 / 6378.137; earthScene.add(atmosphere);
    let disposed = false, dirty = true, ready = false, raf = 0, width = 0, height = 0, drawn = '', zoom = 1;
    const manager = new THREE.LoadingManager(); let assetFailed = false;
    manager.onError = () => { assetFailed = true; if (!disposed) { setFailed(true); current.current.onError(); } };
    manager.onLoad = () => { if (!disposed && !assetFailed) { ready = true; dirty = true; current.current.onReady(); } };
    const loader = new THREE.TextureLoader(manager), day = loader.load('/textures/earth-day.jpg'), cloudMap = loader.load('/textures/earth-clouds.png');
    day.colorSpace = cloudMap.colorSpace = THREE.SRGBColorSpace; day.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); planetMaterial.map = day; cloudsMaterial.map = cloudMap;
    api.current = { reset() { zoom = 1; dirty = true; }, zoom(f) { zoom = THREE.MathUtils.clamp(zoom * f, .65, 2); dirty = true; } };
    const resize = new ResizeObserver(() => { dirty = true; }); resize.observe(el);
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); current.current.onError(); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    const orientation = model.root.quaternion.clone();
    const target = new THREE.Vector3(), offset = new THREE.Vector3();
    function render() {
      if (disposed) return; raf = requestAnimationFrame(render); if (document.hidden || !ready) return;
      const p = current.current, w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
      if (w !== width || h !== height) { width = w; height = h; renderer.setSize(w, h, false); dirty = true; }
      const key = `${p.time}:${p.camera}:${p.satellite}`; if (!dirty && drawn === key) return;
      const state = deploymentState(p.time), orbit = deploymentOrbitAt(p.time); model.update(state);
      const selected = state.satellites[p.satellite];
      if (p.camera === 'bay') { target.set(0, BAY_CENTER_Y, .15).applyQuaternion(orientation); offset.set(.65, 1.15, 2.7); }
      else if (p.camera === 'satellite') { target.copy(selected.position).applyQuaternion(orientation); offset.set(4.2, 1.7, 2.2); }
      else {
        const spread = state.satellites[0].position.z;
        target.set(2.65, 0, Math.max(0, spread - .5) * .33);
        offset.set(3.8, 4.1, 9.2).multiplyScalar(1 + Math.max(0, spread - 2) * .09);
      }
      offset.multiplyScalar(zoom * Math.max(1, .9 / (w / h)));
      camera.position.copy(target).add(offset); camera.up.set(0, 1, 0); camera.aspect = w / h; camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      // Earth is rendered in kilometres, hardware in 10 m units, using the same view ray.
      earthCamera.position.copy(camera.position).multiplyScalar(.01).applyQuaternion(orbit.frame).add(orbit.position);
      const earthTarget = target.clone().multiplyScalar(.01).applyQuaternion(orbit.frame).add(orbit.position);
      earthCamera.up.set(0, 1, 0).applyQuaternion(orbit.frame); earthCamera.lookAt(earthTarget); earthCamera.aspect = camera.aspect; earthCamera.updateProjectionMatrix();
      globe.rotation.y = clouds.rotation.y = orbit.sidereal;
      // Fixed local exhibition lighting, not a reconstruction of a historical date's Sun.
      earthLight.position.copy(sunlight).applyQuaternion(orbit.frame).multiplyScalar(20000);
      renderer.autoClear = true; renderer.render(earthScene, earthCamera);
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true;
      const centers = state.satellites.map(s => { const v = s.position.clone().applyQuaternion(orientation).project(camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; });
      Object.assign(renderer.domElement.dataset, { ready: 'true', time: state.time.toFixed(2), camera: p.camera, satellite: String(p.satellite), door: state.door.toFixed(6), released: String(state.released), panels: JSON.stringify(state.satellites.map(s => s.panels)), positions: JSON.stringify(state.satellites.map(s => s.position.toArray())), centers: JSON.stringify(centers), orbit: JSON.stringify(orbit.position.toArray()), altitude: orbit.altitudeKm.toFixed(3), orbitKind: 'synthetic-sgp4', engines: 'off' });
      dirty = false; drawn = key;
    }
    raf = requestAnimationFrame(render);
    return () => {
      disposed = true; cancelAnimationFrame(raf); resize.disconnect(); api.current = null; renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      for (const s of [scene, earthScene]) s.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); day.dispose(); cloudMap.dispose(); env.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <><div className="canvas-host" ref={host}/>{failed && <div className="scene-error" role="alert"><strong>部署场景暂时不可用</strong><p>卫星部署资料仍可查看。</p><button onClick={() => location.reload()}>重新加载</button></div>}</>;
});
