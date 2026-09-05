import * as THREE from 'three';
import { parts } from './parts';
import type { RocketModel } from './rocket-model';

export const engineComponents = [
  { name: '喷管与冷却通道', description: '钟形扩张段、喉部、出口加强环及再生冷却通道。真空型采用更大的扩张段。', color: '#aebbc1' },
  { name: '主燃烧室', description: '铜色内衬与承力外套分开显示；剖面展示燃烧室到喉部的连续流道。', color: '#c28b63' },
  { name: '喷注器与集流腔', description: '喷注面、分配腔、法兰与紧固件。喷注孔数量及排列为原理表达，不代表实物加工数据。', color: '#c2c9c9' },
  { name: '甲烷涡轮泵', description: '泵壳、轴系、叶轮、涡轮和连接法兰。剖面可观察叶轮与轴，不提供工程尺寸。', color: '#a6be83' },
  { name: '液氧涡轮泵', description: '独立的氧路泵与涡轮组件。泵壳和叶片形状为说明工作原理的重建。', color: '#71b8d1' },
  { name: '双预燃室', description: '富燃与富氧两路预燃室驱动各自的涡轮，气体随后进入主燃烧室。', color: '#c3aa78' },
  { name: '输送管路与阀组', description: '展示弯管、波纹接头、主阀和传感线路。Raptor 3 集成度更高，这里将流路外显用于理解。', color: '#81a9ac' },
  { name: '推力架与摆动机构', description: '承力支架、摆动连接环和作动器。仅对可摆动发动机作原理示意，不代表所有外圈或真空发动机安装方式。', color: '#bac0c4' },
] as const;

// Public exterior/cycle references, not manufacturing CAD or an exact Raptor 3 reconstruction.
export function createDetailedRaptor(vacuum: boolean): RocketModel {
  const root = new THREE.Group(), groups = {} as RocketModel['groups'];
  for (const part of parts) { groups[part.id] = new THREE.Group(); root.add(groups[part.id]); }
  const pieces: RocketModel['pieces'] = [];
  const offsets = [[0,-1.25,0],[0,-.3,0],[0,.65,0],[-1.8,.5,0],[1.8,.5,0],[0,1.6,-.6],[0,0,2],[0,2.3,0]];
  const assemblies = engineComponents.map((component, index) => {
    const group = new THREE.Group(); group.name = component.name; group.userData.component = index;
    groups['booster-engines'].add(group);
    pieces.push({ mesh: group, part: 'booster-engines', home: new THREE.Vector3(), offset: new THREE.Vector3(...offsets[index] as [number, number, number]), internal: false, shell: false });
    return group;
  });
  const metal = (color: string, roughness = .34) => new THREE.MeshStandardMaterial({ color, metalness: .78, roughness, side: THREE.DoubleSide });
  const silver = metal('#afb8bb'), dark = metal('#4b5357', .48), copper = metal('#b57e58');
  const fuel = metal('#9aab78'), oxygen = metal('#619aae'), brass = metal('#b0a07a');
  function mesh(index: number, geometry: THREE.BufferGeometry, material: THREE.Material, x=0, y=0, z=0, section=false) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.userData.component = index; m.userData.section = section;
    assemblies[index].add(m); return m;
  }
  function pipe(index: number, coords: number[][], radius: number, material: THREE.Material) {
    return mesh(index, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coords.map(p => new THREE.Vector3(...p as [number,number,number]))), 36, radius, 8, false), material);
  }
  function ring(index: number, radius: number, tube: number, y: number, material = silver, x=0, z=0) {
    const m = mesh(index, new THREE.TorusGeometry(radius,tube,8,64),material,x,y,z); m.rotation.x = Math.PI/2; return m;
  }
  function bolts(index: number, radius: number, y: number, count: number, x=0, z=0) {
    const batch = new THREE.InstancedMesh(new THREE.CylinderGeometry(.026,.026,.043,6),dark,count);
    const dummy = new THREE.Object3D();
    for(let i=0;i<count;i++) { const a=i/count*Math.PI*2; dummy.position.set(x+Math.cos(a)*radius,y,z+Math.sin(a)*radius); dummy.updateMatrix(); batch.setMatrixAt(i,dummy.matrix); }
    batch.userData.component=index; assemblies[index].add(batch);
  }
  function shell(index:number, profile:THREE.Vector2[], material:THREE.Material, x=0,y=0,z=0) {
    for(let half=0;half<2;half++) mesh(index,new THREE.LatheGeometry(profile,64,half*Math.PI,Math.PI),material,x,y,z,half===0);
  }
  const radius = vacuum ? 1.24 : .72;
  const profile:THREE.Vector2[]=[];
  for(let i=0;i<=40;i++) { const t=i/40; profile.push(new THREE.Vector2(.19+(radius-.19)*Math.pow(1-t,1.65),t*1.62)); }
  shell(0,profile,silver);
  shell(0,profile.map(p=>new THREE.Vector2(p.x-.017,p.y)),dark);
  ring(0,radius,.026,0); ring(0,.194,.025,1.62);
  for(let i=0;i<72;i++) {
    const a=i/72*Math.PI*2;
    const channel=pipe(0,profile.filter((_,j)=>j%4===0).map(p=>[Math.sin(a)*(p.x+.01),p.y,Math.cos(a)*(p.x+.01)]),.0065,copper);
    channel.userData.section=a<Math.PI;
  }
  for(const y of [.18,.53,.92]) { const t=y/1.62; ring(0,.19+(radius-.19)*Math.pow(1-t,1.65)+.012,.012,y,dark); }
  const chamber=[new THREE.Vector2(.19,1.62),new THREE.Vector2(.21,1.78),new THREE.Vector2(.31,1.99),new THREE.Vector2(.32,2.43)];
  shell(1,chamber,copper); shell(1,chamber.map(p=>new THREE.Vector2(p.x+.025,p.y)),silver);
  for(let i=0;i<36;i++){ const a=i/36*Math.PI*2; const tube=pipe(1,chamber.map(p=>[Math.sin(a)*(p.x+.014),p.y,Math.cos(a)*(p.x+.014)]),.009,copper); tube.userData.section=a<Math.PI; }
  for(const y of [2.05,2.4]) { ring(1,.355,.036,y); bolts(1,.355,y+.03,24); }
  mesh(2,new THREE.CylinderGeometry(.37,.37,.12,64),silver,0,2.53,0,true);
  mesh(2,new THREE.CylinderGeometry(.30,.30,.03,64),copper,0,2.465,0);
  for(const r of [.07,.14,.22,.275]) for(let i=0;i<Math.round(r*160);i++) {
    const a=i/Math.round(r*160)*Math.PI*2; const hole=mesh(2,new THREE.CylinderGeometry(.012,.012,.036,6),dark,Math.cos(a)*r,2.447,Math.sin(a)*r); hole.rotation.x=0;
  }
  ring(2,.37,.025,2.6); bolts(2,.37,2.63,24);
  for(const [index,x,mat] of [[3,-.56,fuel],[4,.56,oxygen]] as const) {
    const y=index===3?2.86:3.11;
    shell(index,[new THREE.Vector2(.15,-.3),new THREE.Vector2(.28,-.2),new THREE.Vector2(.28,.12),new THREE.Vector2(.19,.22)],mat,x,y,0);
    mesh(index,new THREE.CylinderGeometry(.04,.04,.64,16),silver,x,y,0);
    for(const dy of [-.1,.10]) {
      ring(index,.19,.035,y+dy,dark,x);
      for(let i=0;i<16;i++) { const a=i/16*Math.PI*2; const vane=mesh(index,new THREE.BoxGeometry(.025,.10,.14),silver,x+Math.cos(a)*.12,y+dy,Math.sin(a)*.12); vane.rotation.y=-a+.5; }
    }
    for(const dy of [-.22,.16]) { ring(index,.285,.021,y+dy,silver,x); bolts(index,.285,y+dy+.024,20,x); }
    pipe(index,[[x,y-.25,0],[x*1.45,y-.23,.05],[x*1.5,y+.25,.12],[x*1.4,y+.52,.1]],.08,mat);
  }
  for(const x of [-.35,.35]) {
    mesh(5,new THREE.CylinderGeometry(.13,.105,.49,24),brass,x,3.55,-.30);
    ring(5,.15,.022,3.33,silver,x,-.30); ring(5,.15,.022,3.78,silver,x,-.30); bolts(5,.15,3.80,12,x,-.30);
    pipe(5,[[x,3.34,-.30],[x*1.5,3.18,-.40],[x*1.6,2.93,-.17]],.055,dark);
    pipe(5,[[x,3.70,-.30],[x*.5,3.71,-.48],[x*.45,2.70,-.47],[x*.5,2.57,-.18]],.055,silver);
  }
  for(const side of [-1,1]) {
    const mat=side===1?oxygen:fuel;
    pipe(6,[[side*.80,3.55,.1],[side*.89,3.2,.25],[side*.82,2.65,.38],[side*.53,2.50,.45],[side*.23,2.61,.18]],.067,mat);
    pipe(6,[[side*.66,2.70,.15],[side*.71,2.24,.32],[side*.48,1.93,.32],[side*.22,1.85,.13]],.055,silver);
    const valve=mesh(6,new THREE.BoxGeometry(.22,.20,.20),dark,side*.85,2.92,.25);
    valve.rotation.z=side*.15;
    mesh(6,new THREE.CylinderGeometry(.07,.07,.15,16),brass,side*.85,3.07,.25);
    for(let j=0;j<7;j++) ring(6,.075,.011,3.2+j*.035,silver,side*.83,.19);
    for(let j=0;j<4;j++) pipe(6,[[side*(.30+j*.035),2.1,.28],[side*(.48+j*.03),2.35,.50],[side*(.50+j*.05),3.25,.4]],.008,j%2?dark:copper);
  }
  ring(7,.36,.07,3.98); const pivot=ring(7,.29,.055,3.98,dark); pivot.rotation.z=.22;
  for(const x of [-.57,.57]) {
    mesh(7,new THREE.BoxGeometry(.13,.15,.95),silver,x,4.12,0);
    pipe(7,[[x,4.1,-.3],[x*.8,3.9,-.33],[x*.7,3.52,-.28]],.055,silver);
    pipe(7,[[x,3.89,.32],[x*1.23,3.1,.46],[x*.75,2.1,.29]],.033,silver);
    pipe(7,[[x,3.8,.33],[x*1.17,3.27,.43]],.065,dark);
  }
  for(const z of [-.42,.42]) mesh(7,new THREE.BoxGeometry(1.24,.15,.12),silver,0,4.12,z);
  return {root,groups,pieces,textures:[]};
}
