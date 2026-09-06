import * as THREE from 'three';
import { eciToGeodetic, gstime, json2satrec, sgp4 } from 'satellite.js';

export const DEPLOYMENT_DURATION = 120;
export const deploymentCameras = [{ id: 'ship', name: '星舰伴飞' }, { id: 'bay', name: '货舱舱口' }, { id: 'satellite', name: '卫星跟随' }] as const;
export type DeploymentCamera = typeof deploymentCameras[number]['id'];
export const deploymentPhases = [
  { start: 0, name: '入轨与关机', text: '这里演示一项设定的轨道任务，不是第五次试飞。入轨后主机关机，飞船与舱内卫星仍一起高速绕地球飞行。' },
  { start: 16, name: '货舱开门', text: '确认姿态稳定后，侧向舱门打开，释放通道让出。舱门和内部送星机构是简化示意，不是制造图纸。' },
  { start: 32, name: '依次释放', text: '三颗示意卫星依次送到舱口，以很小的相对速度向外离开。每颗都继承了飞船的轨道速度，不是从静止开始飞行。' },
  { start: 72, name: '安全分离', text: '最后一颗卫星离开舱口后，飞船关门，双方继续拉开距离。真空中没有空气阻力把卫星留在原地，也不需要持续喷火。' },
  { start: 88, name: '太阳翼展开', text: '本演示在拉开距离后展开太阳翼，进入供电准备。真实卫星的展开方式与时机因型号而异，试飞中的质量模拟器不会这样工作。' },
  { start: 104, name: '独立飞行', text: '卫星继续独立飞行。实际任务还要完成姿态控制、通信检查和轨道调整；画面中的间距与展开时间不代表真实星链任务。' },
] as const;
export const deploymentSources = [
  { name: 'Jonathan’s Space Report 849 · Flight 10', url: 'https://planet4589.org/space/jsr/back/news.849.corr.txt', detail: '2025-08-26：Ship 37 释放 8 个星链质量模拟器；它们随后再入，并非投入运营的轨道卫星。' },
  { name: 'SpaceX · Flight 10 官方任务入口', url: 'https://www.spacex.com/launches/starship-flight-10', detail: '官方任务入口。本次正文为动态页面，事实核对使用上列飞后记录。' },
  { name: 'satellite.js · SGP4', url: 'https://github.com/shashwatak/satellite-js', detail: '用于传播明确虚构的轨道根数，不是跟踪真实星舰或卫星。局部分离与机械动作不由 SGP4 求解。' },
] as const;
export const clampDeploymentTime = (time: number) => Number.isFinite(time) ? Math.max(0, Math.min(DEPLOYMENT_DURATION, time)) : 0;
const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
export const deploymentPhaseAt = (time: number) => deploymentPhases.reduce((index, phase, i) => clampDeploymentTime(time) >= phase.start ? i : index, 0);
export const RELEASE_TIMES = [34, 46, 58] as const;
export const BAY_CENTER_Y = 3.49;
export function deploymentState(time: number) {
  const t = clampDeploymentTime(time);
  const satellites = RELEASE_TIMES.map((release, index) => {
    const age = Math.max(0, t - release);
    // 10 m local units: a brief guided push joins a constant 0.6 m/s separation.
    const offset = age < 2 ? .015 * age * age : .06 + .06 * (age - 2);
    const feed = index === 0 ? 1 : smooth((t - (release - 4)) / 3);
    return { index, released: t >= release, cleared: .02 + offset >= .65, position: new THREE.Vector3(0, BAY_CENTER_Y + index * .15 * (1 - feed), .02 + offset), panels: smooth((t - 88 - index * 2) / 6) };
  });
  return { time: t, phase: deploymentPhaseAt(t), door: smooth((t - 16) / 10) * (1 - smooth((t - 74) / 8)), satellites, released: satellites.filter(s => s.released).length, cleared: satellites.filter(s => s.cleared).length };
}

// Explicitly synthetic near-circular orbit. Do not export as a real satellite record.
export const DEMO_ORBIT = {
  OBJECT_NAME: 'DEMONSTRATION ONLY', OBJECT_ID: 'CONCEPT', EPOCH: '2026-01-01T12:00:00.000Z',
  MEAN_MOTION: 15.5, ECCENTRICITY: .0001, INCLINATION: 53, RA_OF_ASC_NODE: 20,
  ARG_OF_PERICENTER: 0, MEAN_ANOMALY: 25, NORAD_CAT_ID: 0, ELEMENT_SET_NO: 1,
  BSTAR: 0, MEAN_MOTION_DOT: 0, MEAN_MOTION_DDOT: 0,
} as const;
const satelliteRecord = json2satrec(DEMO_ORBIT);
const toThree = (v: { x: number; y: number; z: number }) => new THREE.Vector3(v.x, v.z, -v.y);
export function deploymentOrbitAt(time: number) {
  const t = clampDeploymentTime(time), result = sgp4(satelliteRecord, t / 60);
  if (!result) throw new Error('Demonstration orbit propagation failed');
  const position = toThree(result.position), velocity = toThree(result.velocity), radial = position.clone().normalize();
  const along = velocity.clone().addScaledVector(radial, -velocity.dot(radial)).normalize();
  const cross = new THREE.Vector3().crossVectors(along, radial).normalize();
  const frame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, radial, cross));
  const date = new Date(Date.parse(DEMO_ORBIT.EPOCH) + t * 1000), sidereal = gstime(date);
  const geo = eciToGeodetic(result.position, sidereal);
  return { position, velocity, frame, sidereal, date, altitudeKm: geo.height };
}
export function parseDeploymentHash(hash: string) {
  const query = new URLSearchParams(hash.split('?')[1] || ''), camera = query.get('camera'), satellite = Number(query.get('satellite') ?? 0);
  return { time: clampDeploymentTime(Number(query.get('t') || 0)), camera: deploymentCameras.some(c => c.id === camera) ? camera as DeploymentCamera : 'ship' as DeploymentCamera, satellite: Number.isInteger(satellite) && satellite >= 0 && satellite < 3 ? satellite : 0 };
}
export function deploymentHash(time: number, camera: DeploymentCamera, satellite: number) {
  return `#mission/deployment?t=${clampDeploymentTime(time).toFixed(1)}&camera=${camera}&satellite=${Math.max(0, Math.min(2, Math.floor(satellite)))}`;
}
