import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCaptureBooster } from './capture-model';
import { createShip30 } from './ship30-model';
import { createLaunchSite } from './launch-site';
import { ascentSite, stagingCameraAvailable, ASCENT_SHIP_Y, ASCENT_RING_BOTTOM, ASCENT_RING_TOP } from './ascent-layout';
import { ascentObserver, ascentPose } from './ascent-state';
import { STARBASE, type flight5State } from './flight5-timeline';
import { ecefDirectionToEnu, enuBasis, geoToGlobe, localToGeo, sunDirectionEcef } from './mission-geo';

export function createAscentScene(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .05, 40000);
  const earthCamera = new THREE.PerspectiveCamera(34, 1, .00001, 150);
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(room, .04); scene.environment = env.texture;
  const sky = new THREE.Color('#adc6cd'), fog = new THREE.Fog(sky, 90, 300), earthFog = new THREE.Fog(sky, .0009, .003); scene.fog = fog;
  const light = new THREE.DirectionalLight('#ffe5c0', 3), ambient = new THREE.HemisphereLight('#dae9ed', '#595f55', 2); scene.add(light, light.target, ambient);
  const steel = new THREE.MeshStandardMaterial({ color: '#9ba4a5', metalness: .7, roughness: .5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#46555a', metalness: .6, roughness: .6 });
  const white = new THREE.MeshStandardMaterial({ color: '#ced4cf', roughness: .8 });
  const site = createLaunchSite(steel, dark, white, ascentSite); scene.add(site.root);
  const stack = new THREE.Group(); scene.add(stack);
  const booster = createCaptureBooster(); booster.pinHighlights.visible = false; stack.add(booster.root);
  booster.dome.position.y = 6.8;
  const ship = createShip30(); ship.root.position.y = ASCENT_SHIP_Y; stack.add(ship.root);
  const ring = new THREE.Group(); ring.name = 'attached-hot-stage-ring'; stack.add(ring);
  for (const y of [ASCENT_RING_BOTTOM, ASCENT_RING_TOP]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.456, .456, .045, 80, 1, true), steel); rim.position.y = y; ring.add(rim);
  }
  const vents = new THREE.InstancedMesh(new THREE.BoxGeometry(.032, ASCENT_RING_TOP - ASCENT_RING_BOTTOM, .025), steel, 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24; dummy.position.set(Math.sin(a) * .45, (ASCENT_RING_TOP + ASCENT_RING_BOTTOM) / 2, Math.cos(a) * .45);
    dummy.rotation.set(0, a, 0); dummy.updateMatrix(); vents.setMatrixAt(i, dummy.matrix);
  }
  ring.add(vents);
  const shield = new THREE.Mesh(new THREE.CircleGeometry(.444, 64), dark); shield.rotation.x = -Math.PI / 2; shield.position.y = 6.945; ring.add(shield);
  const terrain = new THREE.Group(); scene.add(terrain);
  for (const [w, d, x, y, z, color] of [[600, 600, 0, -.3, 0, '#819fa5'], [180, 200, -45, -.2, -38, '#727e61'], [55, 45, -8, -.1, -12, '#a5aaa0']] as const) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, .1, d), new THREE.MeshStandardMaterial({ color, roughness: 1 })); mesh.position.set(x, y, z); terrain.add(mesh);
  }
  const plumeMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, power: { value: 1 } },
    vertexShader: 'varying vec2 p;varying vec3 world;void main(){p=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader: `uniform float time;uniform float power;varying vec2 p;varying vec3 world;
      void main(){if(world.y<0.)discard;float wave=.8+.15*sin(p.y*65.-time*30.+sin(p.x*19.));
      float alpha=smoothstep(0.,.25,p.y)*wave*power*.36;
      vec3 color=mix(vec3(1.,.31,.075),vec3(.75,.87,1.),smoothstep(.4,1.,p.y));gl_FragColor=vec4(color,alpha);}`,
  });
  const outerMaterial = plumeMaterial.clone(), flames: { mesh: THREE.Mesh; outer: boolean }[] = [];
  const flameGeometry = new THREE.CylinderGeometry(.06, .12, 1, 16, 16, true), matrix = new THREE.Matrix4();
  for (let i = 0; i < 33; i++) {
    booster.engines.getMatrixAt(i, matrix);
    const flame = new THREE.Mesh(flameGeometry, i < 3 ? plumeMaterial : outerMaterial); flame.position.setFromMatrixPosition(matrix); stack.add(flame);
    flames.push({ mesh: flame, outer: i >= 3 });
  }
  const shipPlumeMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, power: { value: 0 }, boosterInverse: { value: new THREE.Matrix4() } },
    vertexShader: 'varying vec2 p;varying vec3 world;void main(){p=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader: `uniform float time;uniform float power;uniform mat4 boosterInverse;varying vec2 p;varying vec3 world;
      void main(){vec3 b=(boosterInverse*vec4(world,1.)).xyz;if(b.y<6.96&&length(b.xz)<.48)discard;
      float alpha=smoothstep(0.,.24,p.y)*(.75+.12*sin(p.y*52.-time*28.))*power*.38;
      gl_FragColor=vec4(mix(vec3(1.,.35,.13),vec3(.75,.86,1.),smoothstep(.25,1.,p.y)),alpha);}`,
  });
  const shipPlumes = new THREE.Group(); shipPlumes.name = 'hot-stage-six-engine-plumes'; ship.root.add(shipPlumes);
  for (const engine of ship.engines) {
    const length = engine.vacuum ? 5.5 : 4;
    const flame = new THREE.Mesh(new THREE.CylinderGeometry(engine.vacuum ? .135 : .065, engine.vacuum ? .6 : .3, length, 24, 16, true), shipPlumeMaterial);
    flame.position.copy(engine.position).add(new THREE.Vector3(0, -length / 2, 0)); shipPlumes.add(flame);
  }
  const ventMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { power: { value: 0 }, time: { value: 0 } },
    vertexShader: 'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float power;uniform float time;varying vec2 p;void main(){float a=sin(p.y*3.14159)*(.7+.12*sin(p.y*34.-time*33.));gl_FragColor=vec4(1.,.7,.42,a*power*.4);}',
  });
  const ventJets = new THREE.Group(); ventJets.name = 'radial-interstage-exhaust'; stack.add(ventJets);
  const jetGeometry = new THREE.CylinderGeometry(.18, .03, .9, 12, 8, true);
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, direction = new THREE.Vector3(Math.sin(a), .08, Math.cos(a)).normalize();
    const jet = new THREE.Mesh(jetGeometry, ventMaterial); jet.position.copy(direction).multiplyScalar(.89); jet.position.y += 7.015;
    jet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); ventJets.add(jet);
  }
  const interstageLight = new THREE.PointLight('#ffb06a', 0, 3); interstageLight.position.y = 7.05; stack.add(interstageLight);
  const vaporMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { opacity: { value: .3 }, time: { value: 0 } },
    vertexShader: `varying vec2 p;void main(){p=uv*2.-1.;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      center.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*center;}`,
    fragmentShader: `uniform float opacity;uniform float time;varying vec2 p;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){float n=.55*noise(p*3.+time*.1)+.3*noise(p*7.-time*.13)+.15*noise(p*16.);
      float a=pow(max(0.,1.-dot(p,p)),2.)*smoothstep(.15,.75,n);gl_FragColor=vec4(mix(vec3(.55,.63,.65),vec3(.91,.94,.94),n),a*opacity);}`,
  });
  const vapor = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), vaporMaterial, 36); vapor.frustumCulled = false; scene.add(vapor);
  const target = new THREE.Vector3();
  function update(state: ReturnType<typeof flight5State>, mode: 'ascent' | 'ascent-ground' | 'staging', aspect: number, zoom: number) {
    const pose = ascentPose(state.seconds), t = pose.seconds;
    const finAngles = booster.updateGridFins(t);
    stack.position.set(pose.local.x, pose.local.y, pose.local.z); stack.quaternion.copy(pose.quaternion); site.update(pose);
    ship.root.position.set(pose.shipLocal.x, pose.shipLocal.y, pose.shipLocal.z).sub(stack.position).applyQuaternion(stack.quaternion.clone().invert());
    stack.updateMatrixWorld(true);
    shipPlumes.visible = pose.shipPower > 0; shipPlumeMaterial.uniforms.time.value = t; shipPlumeMaterial.uniforms.power.value = pose.shipPower;
    shipPlumeMaterial.uniforms.boosterInverse.value.copy(stack.matrixWorld).invert();
    ventJets.visible = pose.ventPower > 0; ventMaterial.uniforms.time.value = t; ventMaterial.uniforms.power.value = pose.ventPower; interstageLight.intensity = pose.ventPower * 2.5;
    const expansion = 1 + THREE.MathUtils.smoothstep(state.booster.altitudeM, 1000, 60000) * 3;
    const length = 7 + THREE.MathUtils.smoothstep(state.booster.altitudeM, 1000, 60000) * 9;
    plumeMaterial.uniforms.time.value = outerMaterial.uniforms.time.value = t;
    outerMaterial.uniforms.power.value = pose.outerPower;
    for (const { mesh, outer } of flames) { mesh.visible = !outer || t < 159; mesh.position.y = .18 - length / 2; mesh.scale.set(expansion, length, expansion); }
    vapor.visible = t < 22; vaporMaterial.uniforms.opacity.value = .5 * (1 - THREE.MathUtils.smoothstep(t, 8, 22)); vaporMaterial.uniforms.time.value = t;
    for (let i = 0; i < 36; i++) {
      const a = i * 2.399963, distance = 1 + (i % 9) * .35 + t * .35;
      dummy.position.set(ascentSite.pad.x + Math.cos(a) * distance, .2 + (i % 4) * .22, ascentSite.pad.z + Math.sin(a) * distance);
      dummy.rotation.set(0, a, 0); dummy.scale.set(2.3 + t * .1, .9 + (i % 5) * .24, 1); dummy.updateMatrix(); vapor.setMatrixAt(i, dummy.matrix);
    }
    vapor.instanceMatrix.needsUpdate = true;
    const detail = mode === 'staging' && stagingCameraAvailable(t);
    target.set(0, (detail ? 7.04 : 5.5) + pose.gap / 2, 0).applyQuaternion(stack.quaternion).add(stack.position);
    camera.aspect = aspect; camera.up.set(0, 1, 0);
    if (mode === 'ascent-ground') {
      camera.position.copy(ascentObserver);
      camera.lookAt(target); camera.updateMatrixWorld(true);
      // Fit the projected envelope, including plume, instead of assuming the
      // full 120 m stack is broadside to a fixed ground observer.
      let tangent = 0;
      for (const x of [-1.3, 1.3]) for (const y of [-length, ASCENT_SHIP_Y + 5.03 + pose.gap]) for (const z of [-1.3, 1.3]) {
        const p = new THREE.Vector3(x, y, z).applyQuaternion(stack.quaternion).add(stack.position).applyMatrix4(camera.matrixWorldInverse);
        tangent = Math.max(tangent, Math.abs(p.y) / -p.z, Math.abs(p.x) / (-p.z * aspect));
      }
      camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(tangent * 1.55 * zoom)), .002, 48);
    } else if (detail) {
      camera.fov = 34; camera.position.copy(target).add(new THREE.Vector3(3, .6, 5).applyQuaternion(stack.quaternion).multiplyScalar((1 + pose.gap * .1) * zoom * Math.max(1, .95 / aspect)));
    } else {
      camera.fov = 34; camera.position.copy(target).add(new THREE.Vector3(18, 5, 34).multiplyScalar((1 + pose.gap * .05) * zoom * Math.max(1, .95 / aspect)));
    }
    const range = camera.position.distanceTo(target);
    camera.near = Math.max(.05, range - 50); camera.far = Math.max(1000, range + 500);
    camera.lookAt(target); camera.setViewOffset(aspect * 1000, 1000, aspect * 1000 * .12, 0, aspect * 1000, 1000); camera.updateProjectionMatrix();
    const observer = localToGeo(camera.position, STARBASE), globalPosition = geoToGlobe(observer), globalTarget = geoToGlobe(localToGeo(target, STARBASE)), basis = enuBasis(STARBASE);
    earthCamera.position.set(globalPosition.x, globalPosition.y, globalPosition.z); earthCamera.up.set(basis.up.x, basis.up.z, -basis.up.y);
    earthCamera.aspect = aspect; earthCamera.fov = camera.fov; earthCamera.lookAt(globalTarget.x, globalTarget.y, globalTarget.z); earthCamera.setViewOffset(aspect * 1000, 1000, aspect * 1000 * .12, 0, aspect * 1000, 1000); earthCamera.updateProjectionMatrix();
    const sun = ecefDirectionToEnu(sunDirectionEcef(state.date), STARBASE);
    light.target.position.copy(target); light.position.copy(target).add(new THREE.Vector3(sun.x, sun.z, -sun.y).multiplyScalar(100));
    sky.set('#adc6cd').lerp(new THREE.Color('#09131e'), THREE.MathUtils.smoothstep(observer.altitudeM, 12000, 70000));
    fog.color.copy(sky); fog.near = Math.max(45, range * .9); fog.far = Math.max(fog.near + 95, range * 1.8);
    earthFog.color.copy(sky); earthFog.far = .003 + Math.pow(Math.max(0, observer.altitudeM) / 12000, 2);
    site.root.visible = terrain.visible = state.booster.altitudeM < 6000;
    camera.updateMatrixWorld(true);
    const nose = new THREE.Vector3(0, ASCENT_SHIP_Y + 5.03 + pose.gap, 0).applyQuaternion(stack.quaternion).add(stack.position).project(camera);
    const collar = new THREE.Vector3(0, 7.04, 0).applyQuaternion(stack.quaternion).add(stack.position).project(camera);
    return { sky, earthFog, finAngles, local: pose.local, shipLocal: pose.shipLocal, gap: pose.gap, shipPower: pose.shipPower, ventPower: pose.ventPower, detail, collar: [(collar.x + 1) / 2, (1 - collar.y) / 2], quaternion: stack.quaternion.toArray(), cameraPosition: camera.position.toArray(), nose: [(nose.x + 1) / 2, (1 - nose.y) / 2], fov: camera.fov, engines: t < 159 ? 33 : 3, ring: true };
  }
  return { scene, camera, earthCamera, update, dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); if (o instanceof THREE.InstancedMesh) o.dispose(); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); booster.skin.dispose(); env.dispose(); room.dispose(); pmrem.dispose();
  } };
}
