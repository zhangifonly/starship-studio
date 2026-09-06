import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createShip30 } from './ship30-model';
import { ship30Pose } from './ship30-state';
import { ship30FlightFrame } from './ship30-flight';
import { type flight5State } from './flight5-timeline';
import { ecefDirectionToEnu, enuBasis, geoToGlobe, localToGeo, solarElevation, sunDirectionEcef } from './mission-geo';

type State = ReturnType<typeof flight5State>;
export function createShip30Scene(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(33, 1, .04, 30000);
  const earthCamera = new THREE.PerspectiveCamera(33, 1, .00001, 150);
  const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(room, .04); scene.environment = env.texture;
  const sky = new THREE.Color('#080d14'), earthFog = new THREE.Fog(sky, .00065, 1);
  const light = new THREE.DirectionalLight('#fff0d9', 2.8), fill = new THREE.DirectionalLight('#a3beca', .6);
  const ambient = new THREE.HemisphereLight('#b6cedb', '#333a40', .8); scene.add(light, light.target, fill, fill.target, ambient);
  const ship = createShip30(); scene.add(ship.root);
  const plasmaMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, heat: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float time;uniform float heat;varying vec2 vUv;
      void main(){float edge=pow(abs(vUv.x-.5)*2.,3.);float bands=.65+.35*sin(vUv.y*68.-time*14.+sin(vUv.x*33.));
      float ends=smoothstep(0.,.13,vUv.y)*(1.-smoothstep(.94,1.,vUv.y));
      vec3 color=mix(vec3(1.,.14,.025),vec3(1.,.62,.24),edge);
      gl_FragColor=vec4(color,heat*ends*(.012+.48*edge)*bands);}`,
  });
  const plasmaProfile = [[.59, .08], [.62, .5], [.62, 3.4], [.5, 4.2], [.27, 4.8], [.025, 5.14]].map(([r, y]) => new THREE.Vector2(r, y));
  const plasma = new THREE.Mesh(new THREE.LatheGeometry(plasmaProfile, 64, -Math.PI / 2, Math.PI), plasmaMaterial); ship.root.add(plasma);
  const sparksGeometry = new THREE.BufferGeometry(), sparksPositions = new Float32Array(120 * 6);
  sparksGeometry.setAttribute('position', new THREE.BufferAttribute(sparksPositions, 3));
  const sparksMaterial = new THREE.LineBasicMaterial({ color: '#ff793e', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.LineSegments(sparksGeometry, sparksMaterial); sparks.frustumCulled = false; ship.root.add(sparks);
  const glow = new THREE.PointLight('#ff5e20', 0, 12); glow.position.set(0, 2.6, 1.2); ship.root.add(glow);
  const plumeMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, power: { value: 0 }, seaY: { value: -100000 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv;varying vec3 world;void main(){vUv=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader: `uniform float time;uniform float power;uniform float seaY;varying vec2 vUv;varying vec3 world;
      void main(){if(world.y<seaY)discard;float fade=smoothstep(0.,.18,vUv.y)*(.6+.12*sin(vUv.y*72.-time*36.));
      gl_FragColor=vec4(mix(vec3(1.,.22,.025),vec3(.73,.84,1.),vUv.y*vUv.y),fade*power*.7);}`,
  });
  const plumes = new THREE.Group(); plumes.name = 'sea-level-landing-plumes'; ship.root.add(plumes);
  for (const engine of ship.engines.filter(e => !e.vacuum)) {
    const flame = new THREE.Mesh(new THREE.CylinderGeometry(.06, .19, 3.8, 24, 12, true), plumeMaterial);
    flame.position.copy(engine.position).add(new THREE.Vector3(0, -1.9, 0)); plumes.add(flame);
  }
  const ascentMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, power: { value: 0 } },
    vertexShader: 'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float time;uniform float power;varying vec2 p;
      void main(){float end=smoothstep(0.,.32,p.y);float waves=.72+.1*sin(p.y*46.-time*24.);
      vec3 color=mix(vec3(.46,.59,.92),vec3(.84,.9,1.),p.y);
      gl_FragColor=vec4(color,end*waves*power*.32);}`,
  });
  const ascentPlumes = new THREE.Group(); ascentPlumes.name = 'six-engine-ascent-plumes'; ship.root.add(ascentPlumes);
  for (const engine of ship.engines) {
    const length = engine.vacuum ? 5.5 : 4;
    const flame = new THREE.Mesh(new THREE.CylinderGeometry(engine.vacuum ? .135 : .065, engine.vacuum ? .85 : .48, length, 24, 16, true), ascentMaterial);
    flame.position.copy(engine.position).add(new THREE.Vector3(0, -length / 2, 0)); ascentPlumes.add(flame);
  }
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0 }, night: { value: 1 }, sky: { value: sky } }, transparent: true,
    vertexShader: 'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}',
    fragmentShader: `uniform float time;uniform float opacity;uniform float night;uniform vec3 sky;varying vec3 world;
      void main(){vec3 view=normalize(cameraPosition-world);vec2 p=world.xz;
      vec3 n=normalize(vec3(.12*cos(p.x*1.7+p.y*.43+time*.8)+.04*cos(p.y*4.-time),1.,.09*cos(p.y*2.2-time*.65)));
      float f=.06+.75*pow(1.-max(0.,dot(n,view)),4.);float ripple=.5+.5*sin(p.x*3.+p.y*2.+time);
      vec3 base=mix(vec3(.035,.115,.14),vec3(.022,.055,.07),night);
      vec3 color=mix(base,sky,f)+vec3(.06,.09,.10)*pow(max(0.,dot(reflect(-view,n),normalize(vec3(-.5,.5,1.)))),80.)*(1.-night*.7);
      color+=vec3(.009,.019,.022)*ripple;color=mix(color,sky,smoothstep(100.,700.,length(cameraPosition-world)));
      gl_FragColor=vec4(color,opacity);}`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), waterMaterial); water.rotation.x = -Math.PI / 2; scene.add(water);
  const contactMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 p;void main(){float a=atan(p.y,p.x);float r=length(p)+.035*sin(a*13.)+.03*sin(a*23.);float foam=smoothstep(.12,.22,r)*(1.-smoothstep(.4,.9,r));gl_FragColor=vec4(.55,.68,.71,foam*.65);}',
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), contactMaterial); contact.rotation.x = -Math.PI / 2; scene.add(contact);
  const target = new THREE.Vector3(), course = new THREE.Vector3();
  function update(state: State, mode: 'ship-close' | 'ship-heat', aspect: number, zoom: number) {
    const pose = ship30Pose(state.seconds), origin = state.ship;
    // Rebase at the very same global vehicle datum every frame. Geometry and
    // camera stay near zero even on the opposite side of Earth from Starbase.
    const flight = ship30FlightFrame(state.seconds, origin); course.copy(flight.course);
    ship.root.quaternion.copy(flight.quaternion);
    for (const flap of ship.flaps) flap.hinge.rotation.y = flap.side * pose.flap * (flap.forward ? .8 : 1);
    plasma.visible = sparks.visible = pose.heat > .001; plasmaMaterial.uniforms.time.value = pose.seconds; plasmaMaterial.uniforms.heat.value = pose.heat;
    ship.tileMaterial.emissive.set('#b9340b'); ship.tileMaterial.emissiveIntensity = pose.heat * .015; glow.intensity = pose.heat * .7;
    for (let i = 0; i < 120; i++) {
      const age = ((pose.seconds * .7 + i * .61803398875) % 1), y = .3 + ((i * 29) % 101) / 101 * 4.8;
      const x = (i % 2 ? 1 : -1) * (.43 + ((i * 7) % 13) / 60), trail = age * 2.2;
      sparksPositions.set([x, y - trail, .47 - trail * .45, x * 1.01, y - trail - .16, .47 - trail * .45 - .08], i * 6);
    }
    sparksGeometry.attributes.position.needsUpdate = true; sparksMaterial.opacity = pose.heat * .08;
    plumes.visible = pose.power > .001; plumeMaterial.uniforms.time.value = pose.seconds; plumeMaterial.uniforms.power.value = pose.power;
    ascentPlumes.visible = pose.ascentPower > .001; ascentMaterial.uniforms.time.value = pose.seconds; ascentMaterial.uniforms.power.value = pose.ascentPower;
    plumeMaterial.uniforms.seaY.value = -origin.altitudeM / 10;
    target.set(0, 2.5 - 2.5 * pose.ascentPower, 0).applyQuaternion(ship.root.quaternion);
    const offset = mode === 'ship-heat'
      ? new THREE.Vector3(3.5, .3, 12).applyQuaternion(ship.root.quaternion)
      : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), course).multiplyScalar(10).addScaledVector(course, -5).add(new THREE.Vector3(0, 4, 0));
    offset.multiplyScalar(zoom * Math.max(1, (.95 + .15 * pose.ascentPower) / aspect) * (1 + .65 * pose.ascentPower));
    camera.position.copy(target).add(offset); camera.position.y = Math.max(-origin.altitudeM / 10 + 1.5, camera.position.y);
    camera.up.set(0, 1, 0); camera.aspect = aspect; camera.lookAt(target); camera.updateProjectionMatrix();
    const observer = localToGeo(camera.position, origin), globalPosition = geoToGlobe(observer), globalTarget = geoToGlobe(localToGeo(target, origin)), basis = enuBasis(origin);
    earthCamera.position.set(globalPosition.x, globalPosition.y, globalPosition.z); earthCamera.up.set(basis.up.x, basis.up.z, -basis.up.y);
    earthCamera.aspect = aspect; earthCamera.fov = camera.fov; earthCamera.lookAt(globalTarget.x, globalTarget.y, globalTarget.z); earthCamera.updateProjectionMatrix();
    const sunlight = ecefDirectionToEnu(sunDirectionEcef(state.date), origin), elevation = solarElevation(state.date, origin);
    light.position.set(sunlight.x, sunlight.z, -sunlight.y).multiplyScalar(100); light.target.position.copy(target);
    fill.position.copy(camera.position); fill.target.position.copy(target);
    const night = THREE.MathUtils.smoothstep(-elevation, 0, 12);
    sky.set('#abc6cd').lerp(new THREE.Color('#07121a'), night).lerp(new THREE.Color('#05090f'), THREE.MathUtils.smoothstep(observer.altitudeM, 12000, 70000));
    earthFog.color.copy(sky); earthFog.far = .0026 + Math.pow(Math.max(0, observer.altitudeM) / 12000, 2);
    water.position.y = -origin.altitudeM / 10; waterMaterial.uniforms.time.value = pose.seconds; waterMaterial.uniforms.night.value = night;
    waterMaterial.uniforms.opacity.value = 1 - THREE.MathUtils.smoothstep(origin.altitudeM, 3000, 16000); water.visible = origin.altitudeM < 16000;
    contact.visible = pose.splash; contact.position.set(0, water.position.y + .005, 0);
    camera.updateMatrixWorld(true);
    const envelope = [-5.5 * pose.ascentPower, 5.03].flatMap(y => [-.95, .95].flatMap(x => [-.85, .85].map(z => {
      const p = new THREE.Vector3(x, y, z).applyQuaternion(ship.root.quaternion).project(camera); return [(p.x + 1) / 2, (1 - p.y) / 2];
    })));
    return { sky, earthFog, pose, envelope, course: course.toArray(), quaternion: ship.root.quaternion.toArray(), local: ship.root.position.toArray(), cameraPosition: camera.position.toArray(), tileCount: ship.tiles.count, engineCount: ship.engines.length };
  }
  return { scene, camera, earthCamera, update, dispose() {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); if (o instanceof THREE.InstancedMesh) o.dispose(); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); env.dispose(); room.dispose(); pmrem.dispose();
  } };
}
