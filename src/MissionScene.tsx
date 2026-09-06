import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createLaunchSite } from './launch-site';
import { createCaptureBooster } from './capture-model';
import { captureSite, captureState, type MissionCamera } from './mission-data';

export type MissionSceneHandle = { reset: () => void; zoom: (factor: number) => void };
type Props = { time: number; camera: MissionCamera; dual: boolean; highlights: boolean; onReady: () => void; onError: () => void; onOrbit: () => void };

export default forwardRef<MissionSceneHandle, Props>(function MissionScene(props, ref) {
  const host = useRef<HTMLDivElement>(null), current = useRef(props); current.current = props;
  const api = useRef<MissionSceneHandle | null>(null);
  const [failed, setFailed] = useState(false);
  useImperativeHandle(ref, () => ({ reset: () => api.current?.reset(), zoom: f => api.current?.zoom(f) }), []);
  useEffect(() => {
    const el = host.current!; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); current.current.onError(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.dataset.testid = 'mission-canvas'; renderer.domElement.setAttribute('aria-label', 'Flight 5 助推器捕获三维重建'); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#b4c8ce'); scene.fog = new THREE.Fog('#b4c8ce', 65, 260);
    const main = new THREE.PerspectiveCamera(34, 1, .1, 500), close = new THREE.PerspectiveCamera(31, 1, .04, 160);
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), env = pmrem.fromScene(room, .04); scene.environment = env.texture;
    scene.add(new THREE.HemisphereLight('#e2f0f1', '#666653', 2));
    const sun = new THREE.DirectionalLight('#ffebd0', 3.4); sun.position.set(-18, 30, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -20; sun.shadow.camera.right = sun.shadow.camera.top = 25; sun.shadow.camera.far = 100; sun.shadow.normalBias = .02; scene.add(sun);
    const fill = new THREE.DirectionalLight('#bfd9e3', 1.3); fill.position.set(12, 13, -10); scene.add(fill);
    const steel = new THREE.MeshStandardMaterial({ color: '#8d989b', metalness: .7, roughness: .48 });
    const dark = new THREE.MeshStandardMaterial({ color: '#4c5a60', metalness: .65, roughness: .56 });
    const white = new THREE.MeshStandardMaterial({ color: '#d0d7d3', roughness: .75 });
    const site = createLaunchSite(steel, dark, white, captureSite); scene.add(site.root);
    const booster = createCaptureBooster(); scene.add(booster.root);
    function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
      const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.receiveShadow = true; scene.add(object); return object;
    }
    mesh(new THREE.BoxGeometry(55, .2, 45), new THREE.MeshStandardMaterial({ color: '#a5aaa0', roughness: 1 }), -8, -.18, -12);
    mesh(new THREE.BoxGeometry(180, .15, 200), new THREE.MeshStandardMaterial({ color: '#727e61', roughness: 1 }), -45, -.31, -38);
    mesh(new THREE.BoxGeometry(600, .12, 600), new THREE.MeshStandardMaterial({ color: '#819fa5', metalness: .25, roughness: .48 }), 0, -.43, 0);
    for (let i = 0; i < 5; i++) {
      mesh(new THREE.CylinderGeometry(.66, .66, 2.7, 20), white, -9 - i * 1.7, 1.25, -11);
      const dome = mesh(new THREE.SphereGeometry(.66, 16, 12), white, -9 - i * 1.7, 2.6, -11); dome.scale.y = .35;
    }
    const plumeMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, power: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float time; uniform float power; varying vec2 vUv;
        void main(){float y=vUv.y;float waves=sin(y*75.-time*32.+sin(vUv.x*44.))*0.08;
        float fade=smoothstep(0.,.16,y)*(.7+waves);vec3 color=mix(vec3(1.,.28,.06),vec3(.7,.85,1.),pow(y,2.));
        gl_FragColor=vec4(color,fade*power*.55);}`,
    });
    const plume = new THREE.Group(); booster.root.add(plume); plume.position.y = .2;
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(new THREE.CylinderGeometry(.075, .17, 4.1, 24, 16, true), plumeMaterial);
      const a = i * Math.PI * 2 / 3; flame.position.set(Math.sin(a) * .086, -2.05, Math.cos(a) * .086); plume.add(flame);
    }
    site.root.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    const controls = new OrbitControls(main, renderer.domElement); controls.enableDamping = false; controls.minDistance = 4; controls.maxDistance = 110; controls.maxPolarAngle = Math.PI * .78;
    let follow = true, zoom = 1, previousCamera = current.current.camera, raf = 0, disposed = false, width = 0, height = 0;
    let dirty = true, drawn = '';
    const orbit = () => { follow = false; dirty = true; current.current.onOrbit(); };
    const changed = () => { dirty = true; };
    controls.addEventListener('start', orbit); controls.addEventListener('change', changed);
    api.current = { reset() { follow = true; zoom = 1; dirty = true; }, zoom(f) { zoom = THREE.MathUtils.clamp(zoom * f, .6, 2); if (!follow) { main.position.sub(controls.target).multiplyScalar(f).add(controls.target); } dirty = true; } };
    const resize = new ResizeObserver(() => { dirty = true; }); resize.observe(el);
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); current.current.onError(); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    function render() {
      if (disposed) return; raf = requestAnimationFrame(render); if (document.hidden) return;
      const p = current.current, w = el.clientWidth, h = el.clientHeight;
      if (w < 1 || h < 1) return;
      if (w !== width || h !== height) { width = w; height = h; renderer.setSize(w, h, false); dirty = true; }
      const key = `${p.time}:${p.camera}:${p.dual}:${p.highlights}`;
      if (key === drawn && !dirty) return;
      if (p.camera !== previousCamera) { follow = true; zoom = 1; previousCamera = p.camera; }
      const state = captureState(p.time); booster.root.position.set(state.x, state.y, state.z); booster.root.rotation.z = state.angle;
      booster.pinHighlights.visible = p.highlights; site.update(state);
      plume.visible = state.power > 0; plume.scale.y = 1 + .035 * Math.sin(state.time * 43); plumeMaterial.uniforms.time.value = state.time; plumeMaterial.uniforms.power.value = state.power * 2;
      const portrait = w < 620;
      const mainW = p.dual && !portrait ? Math.floor(w * .64) : w;
      const mainH = p.dual && portrait ? Math.floor(h * .66) : h;
      main.aspect = mainW / mainH; main.updateProjectionMatrix(); main.up.set(0, 1, 0);
      if (follow) {
        const top = Math.max(15.2, state.y + 7.6);
        const target = new THREE.Vector3(-.8, top / 2, 0);
        let offset = new THREE.Vector3(.28, .12, 1).normalize().multiplyScalar(top * .65 / Math.tan(17 * Math.PI / 180));
        if (p.camera === 'tracking') { target.set(state.x, state.y + 3.5, state.z); offset.set(9, 2.7, 20); }
        if (p.camera === 'overhead') { target.set(-.6, 6.5, .1); offset.set(.01, 31, .02); main.up.set(0, 0, -1); }
        const framing = Math.max(1, .85 / main.aspect); main.position.copy(target).add(offset.multiplyScalar(zoom * framing)); controls.target.copy(target); controls.update();
      }
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.clear(); renderer.setScissorTest(true);
      renderer.setViewport(0, h - mainH, mainW, mainH); renderer.setScissor(0, h - mainH, mainW, mainH); renderer.render(scene, main);
      if (p.dual) {
        const detailW = portrait ? w : w - mainW, detailH = portrait ? h - mainH : h;
        close.aspect = detailW / detailH; close.updateProjectionMatrix();
        const target = new THREE.Vector3(state.x, state.y + captureSite.catch.pinBottom, state.z);
        close.position.copy(target).add(new THREE.Vector3(3.2, .7, 3.6).multiplyScalar(portrait ? .58 : Math.max(1, .75 / close.aspect)));
        close.lookAt(target);
        renderer.setViewport(portrait ? 0 : mainW, 0, detailW, detailH); renderer.setScissor(portrait ? 0 : mainW, 0, detailW, detailH); renderer.render(scene, close);
      }
      renderer.setScissorTest(false);
      Object.assign(renderer.domElement.dataset, { ready: 'true', time: state.time.toFixed(2), contact: String(state.contact), captured: String(state.captured), camera: p.camera, dual: String(p.dual), gridfins: String((booster.fins.children[0] as THREE.InstancedMesh).count / 20), hotstage: 'absent', engines: String(booster.engines.count) });
      drawn = key; dirty = false;
    }
    raf = requestAnimationFrame(render); current.current.onReady();
    return () => {
      disposed = true; cancelAnimationFrame(raf); resize.disconnect(); api.current = null; controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); if (object instanceof THREE.InstancedMesh) object.dispose(); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); booster.skin.dispose(); sun.shadow.dispose(); env.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <><div className="canvas-host" ref={host}/>{failed && <div className="scene-error" role="alert"><strong>三维场景暂时不可用</strong><p>任务资料仍可查看。</p><button onClick={() => location.reload()}>重新加载</button></div>}</>;
});
