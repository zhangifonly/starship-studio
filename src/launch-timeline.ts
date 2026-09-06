import { catchRailY, launchHeading, launchRailY, launchSite } from './launch-site-layout.ts';
import { EARTH_RADIUS, seaLevel } from './world-scale.ts';
import { landingSite, shipTouchdown } from './landing-site-layout.ts';
export { EARTH_RADIUS, seaLevel } from './world-scale.ts';

export const LAUNCH_DURATION = 166;
export type CameraMode = 'cinematic' | 'ship' | 'booster' | 'ground' | 'earth' | 'landing';
export const cameraModes: { id: CameraMode; name: string }[] = [
  { id: 'cinematic', name: '导演镜头' }, { id: 'ship', name: '跟随星舰' },
  { id: 'booster', name: '跟随助推器' }, { id: 'ground', name: '地面机位' }, { id: 'earth', name: '地球全景' },
  { id: 'landing', name: '海上平台' },
];
export const launchPhases = [
  { start: 0, name: '发射准备', short: '准备', focus: '整箭', propulsion: '就位支承 / 双臂解锁', description: '开场从整箭就位支承开始，双臂随后卸载并张开，底部发射台继续支承整箭。这是压缩的装配至发射示意，不对应真实倒计时。', narration: '星舰即将出发，一起观察两级火箭的飞行与返回。' },
  { start: 6, name: '发动机点火', short: '点火', focus: '整箭', propulsion: '助推器点火', description: '助推器发动机启动，尾焰与导流区域的烟汽逐渐增强，整箭暂时保持在发射台上。', narration: '猛禽发动机启动，推力建立，即将离塔。' },
  { start: 12, name: '起飞离塔', short: '离塔', focus: '整箭', propulsion: '助推器持续工作', description: '整箭竖直上升，逐渐远离发射塔。发动机将推进剂的化学能转化为推动火箭上升的推力。', narration: '火箭起飞。超级重型助推器承担初始爬升任务，把星舰带向更高、更快的飞行状态。' },
  { start: 24, name: '上升转弯', short: '上升', focus: '整箭', propulsion: '助推器持续工作', description: '火箭逐步倾转，在上升的同时建立水平方向的速度。地球曲率和大气边缘逐渐进入视野。', narration: '飞行方向逐渐转向。火箭不仅需要飞得高，还需要获得足够的水平速度。此处的时间与航程经过压缩。' },
  { start: 40, name: '热分离', short: '分离', focus: '两级', propulsion: '星舰点火 / 两级分离', description: '星舰先点火，通过级间区域排气，随后两级分离。它们从这里开始承担不同的任务。', narration: '星舰发动机先点火，随后两级分离。星舰继续加速，助推器则准备返回发射场。' },
  { start: 52, name: '助推器返航', short: '返航', focus: '助推器', propulsion: '返航点火', description: '镜头转向助推器。它翻转并进行返航点火，改变飞行方向。星舰在此期间继续飞行。', narration: '现在跟随助推器。它调整姿态并进行返航点火，改变速度方向，驶向发射场。与此同时，星舰仍在继续飞行。' },
  { start: 68, name: '下降制动', short: '制动', focus: '助推器', propulsion: '着陆点火', description: '助推器下降，栅格翼参与姿态控制。接近地面时，发动机再次点火，减小下降速度。', narration: '助推器接近发射场。栅格翼帮助控制姿态，着陆点火则逐步减小下降速度。' },
  { start: 82, name: '塔架捕获', short: '捕获', focus: '助推器', propulsion: '减速 / 关机', description: '助推器缓慢进入塔架机械臂之间，机械臂承接箭体。此处展示的是简化的捕获动作，不是实际控制算法。', narration: '助推器进入机械臂之间。速度降下来后，塔架承接箭体，发动机关机。这是助推器回收的关键一步。' },
  { start: 94, name: '星舰滑行', short: '滑行', focus: '星舰', propulsion: '主发动机关机', description: '镜头切回星舰，展示其在地球上方滑行。未模拟精确轨道，也不代表某次任务已经成功入轨。', narration: '镜头回到星舰。地球的云层和大气边缘在下方展开。星舰进入滑行阶段，并准备后续的再入过程。' },
  { start: 112, name: '大气再入', short: '再入', focus: '星舰', propulsion: '气动减速 / 姿态控制', description: '星舰以热防护面迎向来流，机体周围出现再入辉光。襟翼调节姿态，空气阻力逐渐消耗飞行能量。', narration: '星舰重新进入稠密大气。热防护面迎向来流，周围出现高温辉光。襟翼调整姿态，帮助星舰通过空气阻力减速。' },
  { start: 136, name: '翻转着陆', short: '翻转', focus: '星舰', propulsion: '重启减速 / 支架展开', description: '星舰翻转、重启发动机并展开概念着陆支架，对准海上平台。此处为新增概念流程，不是已验证的星舰回收方式。', narration: '接近海上平台，星舰重启发动机、翻转减速，并展开着陆支架。这是平台回收的概念演示，并非已验证的星舰飞行任务。' },
  { start: 154, name: '平台着陆', short: '着陆', focus: '星舰', propulsion: '甲板接触 / 关机', description: '四个支脚落在甲板中央标记内，发动机关机。本平台与支架均为概念模型，不能与猎鹰九号已验证的无人船回收混为一谈。', narration: '星舰落到平台中央，发动机关机。平台和着陆支架均为概念设计，不代表星舰已经完成过这种回收。' },
] as const;

export const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function phaseAt(time: number) { return launchPhases.reduce((index, phase, i) => time >= phase.start ? i : index, 0); }
export function formatLaunchTime(time: number) { return `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`; }
type Key = [time: number, x: number, altitude: number, angle: number];
const launchAltitude = launchSite.launchBaseY - seaLevel(launchSite.pad.x);
const catchAltitude = launchSite.catch.baseY - seaLevel(launchSite.catch.x);
const boosterKeys: Key[] = [[0, 0, launchAltitude, 0], [12, 0, launchAltitude, 0], [24, 0, 20, 0], [40, 22, 69, -.65], [44, 29, 90, -.67], [52, 37, 112, 1.7], [60, 23, 104, 2.5], [68, 10, 69, .3], [76, 1.3, 20, .04], [82, launchSite.catch.x, 9, 0], [89, launchSite.catch.x, catchAltitude, 0], [166, launchSite.catch.x, catchAltitude, 0]];
const releaseX = 29 + Math.sin(.67) * 7.35 + .05;
const releaseAltitude = 90 + Math.cos(.67) * 7.35 + .4 + seaLevel(29) - seaLevel(releaseX);
const touchdownAltitude = shipTouchdown.y - seaLevel(shipTouchdown.x);
const shipKeys: Key[] = [[44, releaseX, releaseAltitude, -.67], [52, 53, 127, -.9], [68, 100, 155, -1.2], [94, 175, 132, -1.45], [112, 240, 80, -1.55], [126, 279, 29, -1.58], [136, 292, 12, -1.58], [144, 297, 5, -.6], [154, shipTouchdown.x, touchdownAltitude, landingSite.angle], [166, shipTouchdown.x, touchdownAltitude, landingSite.angle]];
function sample(keys: Key[], time: number) {
  const next = keys.findIndex(key => key[0] > time);
  const a = keys[Math.max(0, next === -1 ? keys.length - 1 : next - 1)], b = keys[next === -1 ? keys.length - 1 : next];
  const f = a === b ? 0 : smooth((time - a[0]) / (b[0] - a[0]));
  const x = a[1] + (b[1] - a[1]) * f, altitude = a[2] + (b[2] - a[2]) * f;
  return { x, y: seaLevel(x) + altitude, z: 0, yaw: 0, altitude, angle: a[3] + (b[3] - a[3]) * f };
}

// The globe, vehicle and flight distances use different illustrative scales.
// Every state is sampled from the clock, never integrated from previous frames.
export function launchState(time: number) {
  const t = clamp(time, 0, LAUNCH_DURATION), booster = sample(boosterKeys, t);
  // Return to the catch corridor beside the mount, not onto the launch deck.
  booster.z = launchSite.pad.z + (launchSite.catch.z - launchSite.pad.z) * smooth((t - 68) / 12);
  booster.yaw = launchHeading * (1 - smooth((t - 52) / 16));
  const separation = smooth((t - 42) / 8);
  const attached = { x: booster.x + Math.sin(-booster.angle) * 7.35, y: booster.y + Math.cos(booster.angle) * 7.35, z: booster.z, yaw: booster.yaw, altitude: booster.altitude + 7.35, angle: booster.angle };
  const independent = sample(shipKeys, Math.max(44, t));
  independent.yaw = launchHeading * (1 - smooth((t - 44) / 8));
  const ship = t < 42 ? attached : t < 44 ? { ...attached, x: attached.x + smooth((t - 42) / 2) * .05, y: attached.y + smooth((t - 42) / 2) * .4 } : independent;
  const ascent = smooth((t - 6) / 2) * (1 - .9 * smooth((t - 40) / 3)) * (1 - smooth((t - 47) / 3));
  const boostback = smooth((t - 52) / 2) * (1 - smooth((t - 61) / 3)) * .55;
  const landing = smooth((t - 72) / 3) * (1 - smooth((t - 86) / 3)) * .42;
  const shipAscent = smooth((t - 40) / 1.2) * (1 - smooth((t - 89) / 3));
  const shipLanding = smooth((t - 138) / 2) * (1 - smooth((t - 153) / 2)) * .65;
  const focusShip = smooth((t - 91) / 5);
  const focusAltitude = t < 50 ? booster.altitude : booster.altitude * (1 - focusShip) + ship.altitude * focusShip;
  const retarget = smooth((t - 26) / 8);
  return {
    time: t, phase: phaseAt(t), separation, ship, booster, focusShip,
    boosterPower: Math.max(ascent, boostback, landing), shipPower: Math.max(shipAscent, shipLanding),
    darkness: smooth((focusAltitude - 25) / 65),
    smoke: Math.max(smooth((t - 6) / 3) * (1 - smooth((t - 18) / 8)), smooth((t - 78) / 5) * (1 - smooth((t - 89) / 5)) * .65),
    armOpening: smooth((t - 2) / 3) * (1 - smooth((t - 82) / 4)),
    armHeight: launchRailY - .18 * smooth((t - 1) / 1)
      + (launchSite.arms.parkedY - launchRailY + .18) * smooth((t - 5) / 2)
      + (catchRailY - launchSite.arms.parkedY) * smooth((t - 68) / 8),
    armTarget: { x: launchSite.pad.x + (launchSite.catch.x - launchSite.pad.x) * retarget,
      z: launchSite.pad.z + (launchSite.catch.z - launchSite.pad.z) * retarget, yaw: launchHeading * (1 - retarget) },
    heating: smooth((t - 112) / 5) * (1 - smooth((t - 132) / 5)),
    legsDeployment: smooth((t - 142) / 8),
    splash: smooth((t - 147) / 3) * (1 - smooth((t - 155) / 5)),
    captured: t >= 89, landed: t >= 155,
  };
}
