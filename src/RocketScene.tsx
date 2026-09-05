import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRocket } from './rocket-model';
import { createDetailedRaptor, engineComponents } from './raptor-model';
import { parts, type PartId, type VehicleMode } from './parts';

export type SceneHandle = { zoom: (factor: number) => void; reset: () => void; view: (view: 'front' | 'side' | 'bottom') => void; snapshot: () => void };
type Props = { mode: VehicleMode; selected: PartId | null; explode: number; isolated: boolean; cutaway: boolean; labels: boolean; rotate: boolean; onSelect: (id: PartId) => void; onReady: () => void; engine?: 'sea' | 'vacuum'; component?: number | null; componentOnly?: boolean; onComponent?: (index:number) => void };
const anchorPositions: Partial<Record<PartId, [number, number, number]>> = { nose: [.43, 11.7, 0], 'ship-tank': [.48, 9.45, 0], hotstage: [.5, 7.24, 0], 'booster-tank': [.48, 3.8, 0], 'booster-engines': [.4, .4, 0] };

export default forwardRef<SceneHandle, Props>(function RocketScene(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const api = useRef<SceneHandle | null>(null);
  const [error, setError] = useState(false);
  useImperativeHandle(ref, () => ({ zoom: n => api.current?.zoom(n), reset: () => api.current?.reset(), view: v => api.current?.view(v), snapshot: () => api.current?.snapshot() }), []);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor('#0b0e10'); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
    renderer.domElement.setAttribute('aria-label', '星舰三维模型'); renderer.domElement.dataset.testid = 'rocket-canvas';
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, .05, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 1; controls.maxDistance = 65;
    controls.maxPolarAngle = Math.PI * .97; controls.autoRotateSpeed = .6; controls.enablePan = true;
    const pmrem = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment(); const env = pmrem.fromScene(room, .04); scene.environment = env.texture;
    scene.add(new THREE.HemisphereLight('#eef2ed', '#343738', 2.0));
    for (const [color, intensity, x, y, z] of [['#ffffff', 3.8, -5, 14, 8], ['#aac8e6', 2.8, 6, 10, -4], ['#e2e0c8', 2, -4, 3, -3]] as const) {
      const light = new THREE.DirectionalLight(color, intensity); light.position.set(x, y, z); scene.add(light);
    }
    const rocket = props.engine ? createDetailedRaptor(props.engine === 'vacuum') : createRocket(); scene.add(rocket.root);
    const stage = new THREE.Group(); scene.add(stage);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.9, .13, 96), new THREE.MeshStandardMaterial({ color: '#22292b', metalness: .72, roughness: .42 })); platform.position.y = .01; stage.add(platform);
    for (const radius of [1.77, 2.25, 2.65]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius === 1.77 ? .013 : .006, 6, 128), new THREE.MeshBasicMaterial({ color: radius === 1.77 ? '#a5bf71' : '#313a3d' })); ring.rotation.x = Math.PI / 2; ring.position.y = -.04; stage.add(ring);
    }
    const grid = new THREE.GridHelper(22, 44, '#263033', '#192124'); grid.position.y = -.08; stage.add(grid);
    const marks: HTMLButtonElement[] = [];
    for (const [id, anchor] of Object.entries(props.engine ? {} : anchorPositions)) {
      const button = document.createElement('button'); button.className = 'model-label';
      button.textContent = parts.find(p => p.id === id)!.name; button.setAttribute('aria-label', `查看${button.textContent}`);
      button.addEventListener('click', () => latest.current.onSelect(id as PartId)); el.appendChild(button); marks.push(button);
      button.dataset.part = id; button.dataset.anchor = JSON.stringify(anchor);
    }
    let amount = latest.current.explode / 100;
    let frameId = 0, last = 0, needsFit = true, fitUntil = 0, disposed = false;
    const direction = new THREE.Vector3(7, 2.0, 12).normalize();
    const targetCamera = new THREE.Vector3(), targetLook = new THREE.Vector3();
    const bounds = new THREE.Box3();
    let width = 1, height = 1, previousKey = '';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function fit(immediate: boolean) {
      bounds.makeEmpty(); rocket.root.updateMatrixWorld(true);
      for (const piece of rocket.pieces) if (piece.mesh.visible && rocket.groups[piece.part].visible) bounds.expandByObject(piece.mesh);
      if (bounds.isEmpty()) return;
      const size = bounds.getSize(new THREE.Vector3()); bounds.getCenter(targetLook);
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const forward = direction.clone().normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
      const up = new THREE.Vector3().crossVectors(forward, right);
      const extent = (axis: THREE.Vector3) => (Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z) / 2;
      const distance = Math.max(extent(up) / tan, extent(right) / (tan * camera.aspect)) * 1.22 + extent(forward);
      targetCamera.copy(targetLook).addScaledVector(direction, Math.max(distance, 2.1));
      if (immediate) { controls.target.copy(targetLook); camera.position.copy(targetCamera); controls.update(); }
    }
    api.current = {
      zoom(factor) { fitUntil = 0; const v = camera.position.clone().sub(controls.target); v.setLength(THREE.MathUtils.clamp(v.length() * factor, 1, 65)); camera.position.copy(controls.target).add(v); },
      reset() { direction.set(7, 2, 12).normalize(); needsFit = true; },
      view(view) { fitUntil = 0; direction.set(...(view === 'front' ? [0, .08, 1] : view === 'side' ? [1, .08, 0] : [.02, -1, .04]) as [number, number, number]).normalize(); fit(true); },
      snapshot() { renderer.render(scene, camera); const link = document.createElement('a'); link.download = 'starship-studio.png'; link.href = renderer.domElement.toDataURL('image/png'); link.click(); },
    };
    const observer = new ResizeObserver(() => {
      width = el.clientWidth; height = el.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); needsFit = true;
    }); observer.observe(el);
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down: { x: number; y: number; id: number } | null = null;
    const pointers = new Set<number>();
    const onDown = (e: PointerEvent) => { pointers.add(e.pointerId); if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, id: e.pointerId }; else down = null; fitUntil = 0; };
    const onCancel = (e: PointerEvent) => { pointers.delete(e.pointerId); down = null; };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId); const tap = down; down = null;
      if (!tap || tap.id !== e.pointerId || Math.hypot(tap.x - e.clientX, tap.y - e.clientY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
      const targets = rocket.pieces.filter(p => p.mesh.visible && rocket.groups[p.part].visible).map(p => p.mesh);
      const hit = ray.intersectObjects(targets, true)[0];
      if (props.engine && hit?.object.userData.component !== undefined) latest.current.onComponent?.(hit.object.userData.component);
      else if (hit?.object.userData.part) latest.current.onSelect(hit.object.userData.part as PartId);
    };
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp); renderer.domElement.addEventListener('pointercancel', onCancel);
    const lost = (e: Event) => { e.preventDefault(); setError(true); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    const highlightMaterials = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
    let previousSelected: string | null = null;
    const projected = new THREE.Vector3();
    function frame(now: number) {
      if (disposed) return; frameId = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min((now - last) / 1000, .05); last = now;
      const p = latest.current;
      const key = [p.mode, p.isolated, p.isolated ? p.selected : '', p.explode, p.cutaway, p.componentOnly, p.componentOnly ? p.component : ''].join(':');
      if (key !== previousKey) { previousKey = key; fitUntil = now + 1000; }
      amount = reduced ? p.explode / 100 : THREE.MathUtils.damp(amount, p.explode / 100, 9, dt);
      for (const part of parts) rocket.groups[part.id].visible = (p.mode === 'stack' || p.mode === part.stage) && (!p.isolated || p.selected === part.id);
      for (const piece of rocket.pieces) {
        piece.mesh.position.copy(piece.home).addScaledVector(piece.offset, p.isolated ? 0 : amount);
        piece.mesh.visible = (!piece.internal || p.cutaway || amount > .1) && (!piece.shell || !p.cutaway);
        if (piece.part === 'shield' && p.cutaway && !p.isolated) piece.mesh.visible = false;
        if (p.engine) {
          piece.mesh.visible = !p.componentOnly || p.component == null || piece.mesh.userData.component === p.component;
          piece.mesh.traverse(o => { if (o !== piece.mesh) o.visible = !(p.cutaway && o.userData.section); });
        }
      }
      const selectedKey = p.engine ? p.component == null ? null : `component-${p.component}` : p.selected;
      if (selectedKey !== previousSelected) {
        for (const [mesh, material] of highlightMaterials) { (mesh.material as THREE.Material).dispose(); mesh.material = material; }
        highlightMaterials.clear();
        const selection = p.engine && p.component != null ? rocket.pieces[p.component].mesh : p.selected ? rocket.groups[p.selected] : null;
        if (selection) selection.traverse(o => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
            highlightMaterials.set(o, o.material); const clone = o.material.clone(); clone.emissive.set('#b9d883'); clone.emissiveIntensity = .1; o.material = clone;
          }
        }); previousSelected = selectedKey;
      }
      stage.visible = !p.engine && p.mode === 'stack' && !p.isolated && amount < .05;
      if (needsFit) { fit(true); needsFit = false; }
      else if (now < fitUntil) { fit(false); const alpha = reduced ? 1 : 1 - Math.exp(-8 * dt); camera.position.lerp(targetCamera, alpha); controls.target.lerp(targetLook, alpha); }
      controls.autoRotate = p.rotate && !reduced; controls.update();
      rocket.root.updateMatrixWorld(true);
      for (const button of marks) {
        const id = button.dataset.part as PartId; const piece = rocket.pieces.find(x => x.part === id)!;
        projected.fromArray(anchorPositions[id]!).addScaledVector(piece.offset, p.isolated ? 0 : amount).project(camera);
        const visible = p.labels && !p.isolated && rocket.groups[id].visible && projected.z < 1 && Math.abs(projected.x) < .8 && Math.abs(projected.y) < .86;
        button.hidden = !visible;
        button.style.transform = `translate(${(projected.x + 1) * width / 2 + 14}px,${(1 - projected.y) * height / 2}px)`;
        button.classList.toggle('chosen', p.selected === id);
      }
      renderer.render(scene, camera);
      if (p.engine) {
        renderer.domElement.dataset.engine = p.engine;
        renderer.domElement.dataset.components = String(engineComponents.length);
        renderer.domElement.dataset.visibleComponents = String(rocket.pieces.filter(piece => piece.mesh.visible).length);
        renderer.domElement.dataset.cutaway = String(p.cutaway);
      }
    }
    frameId = requestAnimationFrame(frame); latest.current.onReady();
    return () => {
      disposed = true; cancelAnimationFrame(frameId); observer.disconnect(); controls.dispose(); api.current = null;
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onCancel); renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); if (o instanceof THREE.InstancedMesh) o.dispose(); } });
      highlightMaterials.forEach(m => materials.add(m)); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); rocket.textures.forEach(t => t.dispose());
      env.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove(); marks.forEach(b => b.remove());
    };
  }, [props.engine]);
  return <><div ref={host} className="canvas-host" />{error && <div className="scene-error" role="alert"><strong>3D 视图暂时不可用</strong><p>请启用浏览器硬件加速后重新打开。</p><button onClick={() => location.reload()}>重新加载</button></div>}</>;
});
