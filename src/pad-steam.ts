import * as THREE from 'three';

export const STEAM_COUNT = 128;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

// Seconds since ignition, 10 m local units. Authored condensation cloud, not CFD.
// Each puff has one birth and dies once: no looping particles or frame history.
export function padSteamState(seconds: number, index: number) {
  const t = Number.isFinite(seconds) ? seconds : -1;
  const birth = index * .2, age = Math.max(0, t - birth), life = 22 + index % 5;
  const angle = index * 2.3999632297;
  const radius = .55 + age * (.32 + index % 7 * .025);
  const strength = 1 - .75 * smooth(12, 26, birth);
  return {
    x: Math.cos(angle) * radius + age * .035,
    y: 1.0 + age * (.075 + index % 4 * .012),
    z: Math.sin(angle) * radius,
    width: 1.5 + age * .19,
    height: 1.3 + age * .105,
    opacity: t < birth ? 0 : .78 * strength * smooth(0, 1.3, age) * (1 - smooth(life * .5, life, age)),
    seed: index * 1.731,
  };
}

export function createPadSteam(pad: { x: number; z: number }) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const data = new Float32Array(STEAM_COUNT * 2);
  const attributes = new THREE.InstancedBufferAttribute(data, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('steamData', attributes);
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true,
    uniforms: { time: { value: 0 }, inverseView: { value: new THREE.Matrix4() } },
    vertexShader: `attribute vec2 steamData;varying vec2 p;varying vec2 cloud;varying float groundHeight;
      uniform mat4 inverseView;
      void main(){p=uv*2.-1.;cloud=steamData;
        if(cloud.x<=.002){groundHeight=0.;gl_Position=vec4(2.,2.,2.,1.);return;}
        vec4 v=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        v.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
        groundHeight=(inverseView*v).y;gl_Position=projectionMatrix*v;}`,
    fragmentShader: `uniform float time;varying vec2 p;varying vec2 cloud;varying float groundHeight;
      float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 v){vec2 i=floor(v),f=fract(v);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){vec2 q=p*2.7+cloud.y;float n=.65*noise(q+vec2(time*.055,-time*.08))+.35*noise(q*2.6);
        float edge=1.-smoothstep(.48,.98,length(p)+.18*(n-.5));
        float a=edge*(.55+.45*n)*cloud.x*smoothstep(.07,.3,groundHeight);
        if(a<.002)discard;
        float shade=.82+.15*n+.03*p.y;gl_FragColor=vec4(vec3(shade),a);}`,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, STEAM_COUNT);
  mesh.name = 'launch-pad-white-steam'; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // The concept scene fades its terrain using transparent materials. Draw after
  // that terrain, while retaining its depth so clouds cannot show through it.
  mesh.renderOrder = 10;
  const dummy = new THREE.Object3D(), position = new THREE.Vector3();
  function update(seconds: number, camera: THREE.Camera) {
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= 52) { mesh.visible = false; return 0; }
    camera.updateMatrixWorld(true); material.uniforms.inverseView.value.copy(camera.matrixWorld);
    material.uniforms.time.value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const puffs = Array.from({ length: STEAM_COUNT }, (_, i) => {
      const puff = padSteamState(seconds, i);
      position.set(pad.x + puff.x, puff.y, pad.z + puff.z).applyMatrix4(camera.matrixWorldInverse);
      return { ...puff, depth: position.z };
    }).sort((a, b) => a.depth - b.depth);
    let active = 0;
    puffs.forEach((p, i) => {
      dummy.position.set(pad.x + p.x, p.y, pad.z + p.z); dummy.scale.set(p.width, p.height, 1); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); data[i * 2] = p.opacity; data[i * 2 + 1] = p.seed;
      if (p.opacity > .002) active++;
    });
    mesh.visible = active > 0; mesh.instanceMatrix.needsUpdate = attributes.needsUpdate = true;
    return active;
  }
  return { mesh, update };
}
