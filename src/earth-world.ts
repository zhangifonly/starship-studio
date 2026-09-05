import * as THREE from 'three';
import { EARTH_RADIUS, seaLevel } from './launch-timeline';

export function createEarthWorld(scene: THREE.Scene, loaded: (ok: boolean) => void) {
  const manager = new THREE.LoadingManager();
  let failed = false, disposed = false;
  manager.onError = () => { failed = true; };
  manager.onLoad = () => { if (!disposed) loaded(!failed); };
  const loader = new THREE.TextureLoader(manager);
  const day = loader.load('/textures/earth-day.jpg'); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8;
  const cloudsMap = loader.load('/textures/earth-clouds.png'); cloudsMap.colorSpace = THREE.SRGBColorSpace;
  const specular = loader.load('/textures/earth-specular.jpg');
  const globe = new THREE.Group(); globe.position.y = -EARTH_RADIUS - .4; scene.add(globe);
  // Rotate the geographic launch-site tangent frame into local east/up/south.
  const lat = THREE.MathUtils.degToRad(25.997), lon = THREE.MathUtils.degToRad(-97.155);
  const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon));
  const up = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
  const south = new THREE.Vector3(Math.sin(lat) * Math.cos(lon), -Math.cos(lat), -Math.sin(lat) * Math.sin(lon));
  const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, south)).invert();
  const surface = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 128, 96), new THREE.MeshPhongMaterial({ map: day, specularMap: specular, specular: '#263844', shininess: 45, color: '#b3bfc7' }));
  surface.quaternion.copy(orientation); globe.add(surface);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS + 1.2, 128, 64), new THREE.MeshPhongMaterial({ map: cloudsMap, transparent: true, opacity: .6, depthWrite: false, shininess: 0 }));
  clouds.quaternion.copy(orientation); globe.add(clouds);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'uniform float strength; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),6.0); gl_FragColor=vec4(0.23,0.53,0.95,rim*strength*0.25); }',
  });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS + 3, 96, 64), atmosphereMaterial));

  const ocean = new THREE.Group(); ocean.position.set(298, seaLevel(298) + .03, 0); ocean.rotation.z = -Math.asin(298 / EARTH_RADIUS); scene.add(ocean);
  const waterMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, opacity: { value: 0 } },
    vertexShader: `uniform float time; varying vec3 vWorld; varying vec3 vLocal;
      void main(){ vec3 p=position; p.y+=sin(p.x*.4+time*.7)*.025+cos(p.z*.7-time*.5)*.018;
      vLocal=p; vec4 world=modelMatrix*vec4(p,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `uniform float opacity; uniform float time; varying vec3 vWorld; varying vec3 vLocal;
      void main(){ float dx=cos(vLocal.x*3.1+vLocal.z*.7+time*1.7)*.11+cos(vLocal.x*.8+time)*.025;
      float dz=sin(vLocal.z*4.3-vLocal.x*.5-time*1.2)*.085+sin(vLocal.z*.7-time*.5)*.018;
      vec3 n=normalize(vec3(.426,.905,0.0)-vec3(.905,-.426,0.0)*dx-vec3(0.0,0.0,1.0)*dz); vec3 eye=normalize(cameraPosition-vWorld);
      float fresnel=pow(1.0-abs(dot(n,eye)),3.0); float sun=pow(max(dot(reflect(-normalize(vec3(-.4,1.0,.5)),n),eye),0.0),80.0);
      vec3 col=mix(vec3(.025,.13,.17),vec3(.23,.43,.51),fresnel)+sun*vec3(.8,.84,.75);
      gl_FragColor=vec4(col,opacity*(1.0-smoothstep(65.0,95.0,length(vLocal.xz)))); }`,
  });
  const waterGeometry = new THREE.PlaneGeometry(200, 200, 180, 180); waterGeometry.rotateX(-Math.PI / 2);
  ocean.add(new THREE.Mesh(waterGeometry, waterMaterial));
  return { globe, ocean, waterMaterial, atmosphereMaterial, update(time: number) { waterMaterial.uniforms.time.value = time; }, dispose() { disposed = true; day.dispose(); cloudsMap.dispose(); specular.dispose(); } };
}
