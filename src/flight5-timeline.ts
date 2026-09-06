import * as THREE from 'three';
import { geoToLocal, interpolateGeo, localToGeo, type GeoPoint } from './mission-geo.ts';
import { captureState } from './mission-data.ts';
import { ascentSite, ASCENT_SHIP_Y } from './ascent-layout.ts';

export const FLIGHT5_EPOCH = '2024-10-13T12:25:00Z';
export const OVERVIEW_DURATION = 200;
export const STARBASE: GeoPoint = { lat: 25.997, lon: -97.155, altitudeM: 0 };
export type OverviewCamera = 'global' | 'ship' | 'booster' | 'return' | 'ground' | 'fins' | 'ship-close' | 'ship-heat' | 'ascent' | 'ascent-ground' | 'staging';
export const overviewCameras: { id: OverviewCamera; name: string }[] = [{ id: 'global', name: '地球总览' }, { id: 'ship', name: '上面级区域' }, { id: 'booster', name: '发射场区域' }, { id: 'return', name: 'B12 返回近景' }, { id: 'ground', name: 'B12 地面长焦' }, { id: 'ship-close', name: 'S30 伴飞近景' }, { id: 'ship-heat', name: 'S30 热盾视角' }];
export const isReturnCamera = (camera: OverviewCamera) => camera === 'return' || camera === 'ground' || camera === 'fins';
overviewCameras.splice(5, 0, { id: 'fins', name: 'B12 栅格翼特写' });
export const isShipCamera = (camera: OverviewCamera) => camera === 'ship-close' || camera === 'ship-heat';
export const isAscentCamera = (camera: OverviewCamera) => camera === 'ascent' || camera === 'ascent-ground' || camera === 'staging';
overviewCameras.push({ id: 'ascent', name: '上升与热分离' }, { id: 'ascent-ground', name: '发射地面长焦' }, { id: 'staging', name: '分离环观察' });
export const captureClipAt = (seconds: number) => Math.max(0, Math.min(35, (seconds - 390) * 23 / 24));
export const returnCameraAvailable = (seconds: number) => seconds >= 223;
export const timelineSources = [
  { id: 'grid-fins', name: 'Everyday Astronaut · Starbase 访谈', date: '2021 年访谈；核对于 2026-09-06', url: 'https://everydayastronaut.com/starbase-tour-and-interview-with-elon-musk/', scope: 'Super Heavy 栅格翼不折叠的设计理由与转动控制。早期设计访谈，不用于推定 B12 精确周向布置或逐翼偏转角度。' },
  { id: 'hot-stage', name: 'Super Heavy 热分离构型记录', date: '核对于 2026-09-06', url: 'https://en.wikipedia.org/wiki/SpaceX_Super_Heavy#Interstage', scope: '二级资料：早期约 1.8 m 通风级间段、助推器保留中心三机、上面级分离前点火、顶部防护与返航后抛环。不是逐台发动机遥测或排气流场数据。' },
  { id: 'jsr838', name: 'Jonathan’s Space Report 838', date: '2024-10-25', url: 'https://planet4589.org/space/jsr/back/news.838.txt', scope: '飞后记录：约 69 km 分离、助推器捕获、约 212 km 远地点与约 65 分钟后溅落。正文与表格的远地点有 1 km 差异。' },
  { id: 'schedule', name: 'Flight 5 公开事件表', date: '核对于 2026-09-06', url: 'https://en.wikipedia.org/wiki/Starship_flight_test_5#Flight_timeline', scope: '二级资料中的 SpaceX 计划时间表，不视为实飞秒级遥测。动画据此安排事件；捕获精确秒数存在资料差异。' },
  { id: 'catch-report', name: 'Spaceflight Now 捕获回顾', date: '2024-11-01', url: 'https://spaceflightnow.com/2024/11/01/starship-booster-catch-brings-nasa-spacex-closer-to-artemis-3-moon-landing/', scope: '首次捕获的飞后确认；助推器约七分钟返回发射场。' },
  { id: 'ship-design', name: 'Starship 构型记录', date: '核对于 2026-09-06', url: 'https://en.wikipedia.org/wiki/SpaceX_Starship_(spacecraft)#Design', scope: '二级资料：第一代约 50.3 m、四襟翼、三台海平面与三台真空发动机。后续代际已改前襟翼，不能直接替代 S30。尺寸和热瓦分布只作外形参考。' },
] as const;

export const overviewEvents = [
  { id: 'liftoff', start: 0, missionSeconds: 0, name: '起飞', vehicle: 'B12 + S30', timeLabel: '约 T+00:00', source: 'jsr838', timing: '发射时刻公开到分钟', text: '2024 年 10 月 13 日，B12 与 S30 从 Starbase 起飞。全程航迹为示意插值，不是连续遥测。' },
  { id: 'staging', start: 20, missionSeconds: 160, name: '热分离', vehicle: '两级分离', timeLabel: '约 T+02:40', source: 'jsr838', timing: '顺序已确认；秒数按公开计划对齐', text: '上面级点火并与助推器分离。飞后记录给出的分离高度约为 69 公里；此处没有实测经纬度。' },
  { id: 'boostback', start: 40, missionSeconds: 165, name: '返航点火', vehicle: 'B12 返回', timeLabel: '约 T+02:45', source: 'jsr838', timing: '顺序已确认；秒数按公开计划对齐', text: '助推器执行返航点火，上面级继续向东飞行。两级从这里走向不同的任务终点。' },
  { id: 'ring', start: 60, missionSeconds: 223, name: '抛离分离环', vehicle: 'B12 返回构型', timeLabel: '约 T+03:43', source: 'schedule', timing: '二级记录；秒数按公开计划对齐', text: '返航点火后，助推器抛离热分离环。返回构型保留四片栅格翼；它们协助控制下降姿态。' },
  { id: 'landing-burn', start: 80, missionSeconds: 390, name: '着陆点火', vehicle: 'B12 末段下降', timeLabel: '约 T+06:30', source: 'jsr838', timing: '顺序已确认；秒数按公开计划对齐', text: '助推器重新点火减速，接近发射塔。双臂将承接箭体上部的承力销，发动机不会落在发射台上。' },
  { id: 'catch', start: 100, missionSeconds: 414, name: '首次塔架捕获', vehicle: 'B12 已返回', timeLabel: '约 T+07 分钟', source: 'catch-report', timing: '约七分钟已确认；414 秒仅为动画对齐点', text: '塔架双臂成功承接 B12。助推器返回发射场，上面级仍在飞行；这不是两级同时回收。' },
  { id: 'coast', start: 120, missionSeconds: 507, name: '关机与滑行', vehicle: 'S30 亚轨道飞行', timeLabel: '约 T+08:27', source: 'jsr838', timing: '轨道性质已确认；关机秒数按公开计划对齐', text: '上面级进入亚轨道滑行，飞后记录给出的远地点约为 212 公里。它没有完成一次绕地球的完整飞行。' },
  { id: 'entry', start: 140, missionSeconds: 2883, name: '再入大气层', vehicle: 'S30 返回', timeLabel: '约 T+48:03', source: 'jsr838', timing: '再入已确认；秒数按公开计划对齐', text: '上面级在印度洋方向再入大气层。昼夜来自任务时间的太阳方位计算，云层不是当日气象记录。' },
  { id: 'flip', start: 160, missionSeconds: 3915, name: '翻转与减速', vehicle: 'S30 末段', timeLabel: '约 T+65:15', source: 'jsr838', timing: '受控着陆点火已确认；秒数按公开计划对齐', text: '上面级在海面上方完成末段减速。终点只表示印度洋的大致区域，不是已核实的落点坐标。' },
  { id: 'splash', start: 180, missionSeconds: 3940, name: '印度洋溅落', vehicle: 'S30 任务结束', timeLabel: '约 T+65 分钟', source: 'jsr838', timing: '约 65 分钟已确认；3940 秒为计划对齐点', text: 'S30 在印度洋溅落，没有使用海上着陆平台。B12 的塔架捕获与 S30 的溅落，共同构成这次任务的结局。' },
] as const;

export const clampOverviewTime = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(OVERVIEW_DURATION, value)) : 0;
export function overviewEventAt(time: number) { return overviewEvents.reduce((index, event, i) => clampOverviewTime(time) >= event.start ? i : index, 0); }
export function missionSecondsAt(playbackSeconds: number) {
  const time = clampOverviewTime(playbackSeconds), index = overviewEventAt(time), a = overviewEvents[index], b = overviewEvents[index + 1];
  return b ? a.missionSeconds + (b.missionSeconds - a.missionSeconds) * ((time - a.start) / (b.start - a.start)) : a.missionSeconds;
}
export function missionDate(seconds: number) { return new Date(Date.parse(FLIGHT5_EPOCH) + seconds * 1000); }
export function formatMissionClock(seconds: number) { const t = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }

type ControlPoint = GeoPoint & { t: number; kind: 'authored' };
const point = (t: number, lat: number, lon: number, altitudeM: number): ControlPoint => ({ t, lat, lon, altitudeM, kind: 'authored' });
// Every coordinate is authored. Published scalar heights do NOT establish an
// observed position/time sample. Do not export these as telemetry or a TLE.
const approach = localToGeo(captureState(0), STARBASE), supported = localToGeo(captureState(35), STARBASE);
export const boosterGuide: readonly ControlPoint[] = [point(0, STARBASE.lat, STARBASE.lon, 0), point(160, 26, -96.45, 69000), point(223, 26.04, -96.2, 95000), point(300, 26.03, -96.7, 56000), point(380, 25.998, -97.15, 1200), point(390, approach.lat, approach.lon, approach.altitudeM), point(414, supported.lat, supported.lon, supported.altitudeM), point(3940, supported.lat, supported.lon, supported.altitudeM)];
export const shipGuide: readonly ControlPoint[] = [point(0, STARBASE.lat, STARBASE.lon, 0), point(160, 26, -96.45, 69000), point(507, 24, -80, 150000), point(1400, 10, -28, 212000), point(2200, -10, 28, 180000), point(2883, -23, 67, 95000), point(3500, -25, 92, 40000), point(3915, -24, 100, 1500), point(3940, -24, 100, 0)];
export function guidePosition(points: readonly ControlPoint[], seconds: number): GeoPoint {
  const t = Number.isFinite(seconds) ? Math.max(points[0].t, Math.min(points.at(-1)!.t, seconds)) : points[0].t;
  const index = points.findIndex(p => p.t > t);
  if (index === -1) { const p = points.at(-1)!; return { lat: p.lat, lon: p.lon, altitudeM: p.altitudeM }; }
  const a = points[Math.max(0, index - 1)], b = points[index];
  return interpolateGeo(a, b, (t - a.t) / (b.t - a.t));
}
export function flight5State(time: number) {
  const seconds = missionSecondsAt(time);
  return { seconds, date: missionDate(seconds), separated: seconds >= 160, caught: seconds >= 414, splashed: seconds >= 3940, booster: boosterPositionAt(seconds), ship: shipPositionAt(seconds), positionKind: 'authored-interpolation' as const, measuredTelemetry: null };
}
export function shipPositionAt(seconds: number): GeoPoint {
  if (!Number.isFinite(seconds) || seconds < 160) {
    const base = localVector(ascentPositionAt(seconds));
    return localToGeo(base.add(new THREE.Vector3(0, ASCENT_SHIP_Y, 0).applyQuaternion(ascentQuaternionAt(seconds))), STARBASE);
  }
  if (seconds < 223) return stagingPositionAt(seconds, 'ship');
  const point = guidePosition(shipGuide, seconds);
  if (seconds < 3915 || !Number.isFinite(seconds)) return point;
  // A decelerating terminal descent is authored for the same two guide
  // endpoints. It is not an inferred velocity or a solved powered trajectory.
  const f = Math.max(0, Math.min(1, (seconds - 3915) / 25));
  return { ...point, altitudeM: 1500 * (1 - f) ** 2 };
}
export function boosterPositionAt(seconds: number): GeoPoint {
  if (!Number.isFinite(seconds) || seconds < 160) return ascentPositionAt(seconds);
  if (seconds < 223) return stagingPositionAt(seconds, 'booster');
  return seconds >= 390 ? localToGeo(captureState(captureClipAt(seconds)), STARBASE) : guidePosition(boosterGuide, seconds);
}
export function ascentPositionAt(seconds: number): GeoPoint {
  const t = Number.isFinite(seconds) ? Math.max(0, Math.min(160, seconds)) : 0;
  const start = localToGeo({ x: ascentSite.pad.x, y: ascentSite.launchBaseY, z: ascentSite.pad.z }, STARBASE);
  // Authored acceleration, not a dynamics solution or inferred telemetry.
  // No downrange travel until clear of the tower; retain the 160 s endpoint.
  const horizontal = Math.max(0, (t - 20) / 140) ** 2;
  const point = interpolateGeo(start, shipGuide[1], horizontal);
  return { ...point, altitudeM: start.altitudeM + (69000 - start.altitudeM) * (t / 160) ** 2.5 };
}
const localVector = (point: GeoPoint) => { const p = geoToLocal(point, STARBASE); return new THREE.Vector3(p.x, p.y, p.z); };
export function ascentQuaternionAt(seconds: number) {
  const t = Number.isFinite(seconds) ? Math.max(0, Math.min(160, seconds)) : 0;
  const before = localVector(ascentPositionAt(Math.max(0, t - .1)));
  const after = localVector(ascentPositionAt(Math.min(160, t + .1)));
  return new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), after.sub(before).normalize()), THREE.MathUtils.smoothstep(t, 20, 23));
}
export const stagingGapAt = (seconds: number) => .15 * Math.max(0, Math.min(5, seconds - 160)) ** 2;
function stagingPositionAt(seconds: number, vehicle: 'ship' | 'booster'): GeoPoint {
  const t = Math.max(160, Math.min(223, seconds)), dt = t - 160;
  const start = localVector(ascentPositionAt(160)), velocity = start.clone().sub(localVector(ascentPositionAt(159.999))).multiplyScalar(1000);
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(ascentQuaternionAt(160));
  const initial = (elapsed: number) => start.clone().addScaledVector(velocity, elapsed).addScaledVector(axis, vehicle === 'ship' ? ASCENT_SHIP_Y + .15 * elapsed ** 2 : 0);
  if (t <= 165) return localToGeo(initial(dt), STARBASE);
  // A Hermite-equivalent Bezier bridge joins the short separation reconstruction
  // to the existing authored geography. It is not an acceleration solution.
  const guide = vehicle === 'ship' ? shipGuide : boosterGuide;
  const a = initial(5), b = localVector(guidePosition(guide, 223));
  const va = velocity.clone().addScaledVector(axis, vehicle === 'ship' ? 1.5 : 0);
  const vb = localVector(guidePosition(guide, 223.01)).sub(b).multiplyScalar(100);
  const curve = new THREE.CubicBezierCurve3(a, a.clone().addScaledVector(va, 58 / 3), b.clone().addScaledVector(vb, -58 / 3), b);
  return localToGeo(curve.getPoint((t - 165) / 58), STARBASE);
}
export function parseOverviewHash(hash: string) {
  const q = new URLSearchParams(hash.split('?')[1] || ''), c = q.get('camera');
  return { time: clampOverviewTime(Number(q.get('t') || 0)), camera: overviewCameras.some(v => v.id === c) ? c as OverviewCamera : 'global' as OverviewCamera };
}
export function overviewHash(time: number, camera: OverviewCamera) { return `#mission/flight-5/overview?t=${clampOverviewTime(time).toFixed(1)}&camera=${camera}`; }
