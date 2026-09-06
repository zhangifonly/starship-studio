import { launchSite } from './launch-site-layout.ts';

export const CAPTURE_DURATION = 35;
export type MissionCamera = 'site' | 'tracking' | 'overhead';
export const missionCameras: { id: MissionCamera; name: string }[] = [
  { id: 'site', name: '塔架全景' }, { id: 'tracking', name: '助推器跟踪' }, { id: 'overhead', name: '捕获走廊俯视' },
];
export const missionSources = [
  { id: 'report', name: 'Spaceflight Now · 捕获回顾', date: '2024-11-01', type: '新闻报道', url: 'https://spaceflightnow.com/2024/11/01/starship-booster-catch-brings-nasa-spacex-closer-to-artemis-3-moon-landing/', scope: '首次塔架捕获的结果与任务背景。' },
  { id: 'photo', name: 'Steve Jurvetson · 返回末段', date: '2024-10-13', type: '现场照片', url: 'https://commons.wikimedia.org/wiki/File:Starship_Booster_Return_on_Final_Approach_(54063904149).jpg', scope: '返回构型、塔架与箭体的可见关系；不是测绘图，也不是捕获后的照片。' },
  { id: 'record', name: 'Flight 5 · 任务记录', date: '核对于 2026-09-06', type: '二级资料', url: 'https://en.wikipedia.org/wiki/Starship_flight_test_5', scope: 'B12 / S30、热分离环抛离与任务顺序。该页捕获时间存在秒级差异，本片段不采用其精确时间。' },
] as const;

export const flight5 = {
  id: 'flight-5', name: 'Flight 5', date: '2024.10.13', vehicle: 'Booster 12', pad: 'Starbase · Pad A',
  outcome: '首次塔架捕获成功', type: '历史任务',
  facts: [
    { label: '飞行器', value: 'B12 / S30', source: 'record' },
    { label: '返回构型', value: '四片栅格翼 / 热分离环已抛离', source: 'record' },
    { label: '助推器结果', value: '塔架双臂捕获', source: 'report' },
    { label: '上面级结果', value: '印度洋溅落，未使用平台', source: 'record' },
  ],
};

export const capturePhases = [
  { start: 0, end: 8, name: '返回末段', focus: '发动机减速', text: '助推器返回发射场，发动机减小下降速度。返回构型已不带热分离环。', narration: '这是第五次试飞的助推器返回末段。热分离环已经抛离，发动机正在减速。' },
  { start: 8, end: 16, name: '对准走廊', focus: '水平位置收敛', text: '助推器向双臂之间的捕获走廊靠拢。水平移动和姿态变化为视觉重建，不是公开遥测。', narration: '助推器调整水平位置，对准机械臂之间的走廊。四片栅格翼仍然展开。' },
  { start: 16, end: 23, name: '双臂承接', focus: '承力销与支承面', text: '双臂收拢，承力销下降到支承面。承力点位于箭体上部，不是让栅格翼直接压在机械臂上。', narration: '观察箭体上部的承力销。机械臂承接支点，不是夹紧箭体。' },
  { start: 23, end: 28, name: '接触与关机', focus: '支承关系建立', text: '重建片段在此建立接触约束，并收去主尾焰。接触时刻与关机间隔不是实测控制数据。', narration: '承力销接触支承面，主发动机关机。' },
  { start: 28, end: 35, name: '捕获后支承', focus: '发动机悬空', text: '捕获后助推器保持悬空，发动机不落到发射台。后续下降转运和检查不在这个片段内。', narration: '捕获完成，发动机仍然悬空。后续转运和检查不在这个片段内。' },
] as const;

// Local geometry is expressed in 10 m units. These are authored photo-guided
// proportions, not surveyed coordinates; they must never become telemetry.
export const captureSite = {
  ...launchSite,
  pad: { ...launchSite.pad, x: -.35, z: -1.4 },
  catch: { ...launchSite.catch, x: 1.1, z: .35, baseY: 6.25, pinBottom: 6.5 },
  arms: { ...launchSite.arms, length: 4.95 },
  qd: { ...launchSite.qd, y: 8.15 },
};
const clamp = (t: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(t) ? t : lo));
const smooth = (t: number) => { const a = clamp(t, 0, 1); return a * a * (3 - 2 * a); };
export const capturePhaseAt = (time: number) => capturePhases.reduce((result, phase, i) => time >= phase.start ? i : result, 0);
export const captureRailY = captureSite.catch.baseY + captureSite.catch.pinBottom - captureSite.arms.thickness / 2;

export function captureState(time: number) {
  const t = clamp(time, 0, CAPTURE_DURATION), settle = smooth((t - 21) / 2);
  // Monotone approach with nonzero descent through phase boundaries. No
  // integration or previous-frame state: rewind reproduces the same pose.
  const descent = Math.pow(Math.max(0, 1 - t / 23), 2.3);
  const x = captureSite.catch.x + 1.8 * (1 - smooth(t / 21));
  const z = captureSite.catch.z + .6 * (1 - smooth(t / 19));
  return {
    time: t, phase: capturePhaseAt(t), x, z,
    y: captureSite.catch.baseY + 10.8 * descent,
    angle: -.055 * (1 - smooth(t / 18)),
    armHeight: captureRailY, armOpening: 1 - smooth((t - 15) / 6), qdOpening: 1,
    armTarget: { x: captureSite.catch.x, z: captureSite.catch.z, yaw: 0 },
    power: t >= 24 ? 0 : (.5 - .25 * smooth(t / 19)) * (1 - smooth((t - 23) / 1)),
    contact: t >= 23, captured: t >= 24, settle,
  };
}

export function parseMissionHash(hash: string) {
  const query = new URLSearchParams(hash.split('?')[1] || '');
  const camera = query.get('camera');
  return { time: clamp(Number(query.get('t') || 0), 0, CAPTURE_DURATION), camera: missionCameras.some(c => c.id === camera) ? camera as MissionCamera : 'site' as MissionCamera, dual: query.get('dual') !== '0' };
}
export function missionHash(time: number, camera: MissionCamera, dual: boolean) {
  return `#mission/flight-5?t=${clamp(time, 0, CAPTURE_DURATION).toFixed(1)}&camera=${camera}&dual=${dual ? 1 : 0}`;
}
export function formatCaptureTime(t: number) { return `00:${Math.floor(clamp(t, 0, CAPTURE_DURATION)).toString().padStart(2, '0')}`; }
