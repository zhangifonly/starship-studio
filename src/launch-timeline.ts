export const LAUNCH_DURATION = 166;
export const EARTH_RADIUS = 700;
export type CameraMode = 'cinematic' | 'ship' | 'booster' | 'ground' | 'earth';
export const cameraModes: { id: CameraMode; name: string }[] = [
  { id: 'cinematic', name: '导演镜头' }, { id: 'ship', name: '跟随星舰' },
  { id: 'booster', name: '跟随助推器' }, { id: 'ground', name: '地面机位' }, { id: 'earth', name: '地球全景' },
];
export const launchPhases = [
  { start: 0, name: '发射准备', short: '准备', focus: '整箭', propulsion: '发动机未点火', description: '星舰与超级重型助推器完成发射前准备。此次演示综合展示飞行和回收流程，不对应某一次真实任务。', narration: '星舰即将出发，一起观察两级火箭的飞行与返回。' },
  { start: 6, name: '发动机点火', short: '点火', focus: '整箭', propulsion: '助推器点火', description: '助推器发动机启动，尾焰与导流区域的烟汽逐渐增强，整箭暂时保持在发射台上。', narration: '猛禽发动机启动，推力建立，即将离塔。' },
  { start: 12, name: '起飞离塔', short: '离塔', focus: '整箭', propulsion: '助推器持续工作', description: '整箭竖直上升，逐渐远离发射塔。发动机将推进剂的化学能转化为推动火箭上升的推力。', narration: '火箭起飞。超级重型助推器承担初始爬升任务，把星舰带向更高、更快的飞行状态。' },
  { start: 24, name: '上升转弯', short: '上升', focus: '整箭', propulsion: '助推器持续工作', description: '火箭逐步倾转，在上升的同时建立水平方向的速度。地球曲率和大气边缘逐渐进入视野。', narration: '飞行方向逐渐转向。火箭不仅需要飞得高，还需要获得足够的水平速度。此处的时间与航程经过压缩。' },
  { start: 40, name: '热分离', short: '分离', focus: '两级', propulsion: '星舰点火 / 两级分离', description: '星舰先点火，通过级间区域排气，随后两级分离。它们从这里开始承担不同的任务。', narration: '星舰发动机先点火，随后两级分离。星舰继续加速，助推器则准备返回发射场。' },
  { start: 52, name: '助推器返航', short: '返航', focus: '助推器', propulsion: '返航点火', description: '镜头转向助推器。它翻转并进行返航点火，改变飞行方向。星舰在此期间继续飞行。', narration: '现在跟随助推器。它调整姿态并进行返航点火，改变速度方向，驶向发射场。与此同时，星舰仍在继续飞行。' },
  { start: 68, name: '下降制动', short: '制动', focus: '助推器', propulsion: '着陆点火', description: '助推器下降，栅格翼参与姿态控制。接近地面时，发动机再次点火，减小下降速度。', narration: '助推器接近发射场。栅格翼帮助控制姿态，着陆点火则逐步减小下降速度。' },
  { start: 82, name: '塔架捕获', short: '捕获', focus: '助推器', propulsion: '减速 / 关机', description: '助推器缓慢进入塔架机械臂之间，机械臂承接箭体。此处展示的是简化的捕获动作，不是实际控制算法。', narration: '助推器进入机械臂之间。速度降下来后，塔架承接箭体，发动机关机。这是助推器回收的关键一步。' },
  { start: 94, name: '星舰滑行', short: '滑行', focus: '星舰', propulsion: '主发动机关机', description: '镜头切回星舰，展示其在地球上方滑行。未模拟精确轨道，也不代表某次任务已经成功入轨。', narration: '镜头回到星舰。地球的云层和大气边缘在下方展开。星舰进入滑行阶段，并准备后续的再入过程。' },
  { start: 112, name: '大气再入', short: '再入', focus: '星舰', propulsion: '气动减速 / 姿态控制', description: '星舰以热防护面迎向来流，机体周围出现再入辉光。襟翼调节姿态，空气阻力逐渐消耗飞行能量。', narration: '星舰重新进入稠密大气。热防护面迎向来流，周围出现高温辉光。襟翼调整姿态，帮助星舰通过空气阻力减速。' },
  { start: 136, name: '翻转着陆', short: '翻转', focus: '星舰', propulsion: '发动机重启 / 着陆减速', description: '星舰从腹部朝下的下降姿态转向竖直，发动机重启并减速，准备受控海面着陆。', narration: '接近海面时，星舰重启发动机并翻转至接近竖直的姿态。推力进一步减小下降速度，准备接触水面。' },
  { start: 154, name: '海面着陆', short: '着陆', focus: '星舰', propulsion: '接触海面 / 关机', description: '星舰完成示意性的受控海面着陆。海面着陆不等于打捞复用，本演示不把星舰塔架回收表现为已验证能力。', narration: '星舰接触海面，发动机关机。本次流程演示结束。海面着陆不等于打捞后复用，也不同于助推器的塔架捕获。' },
] as const;

export const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function phaseAt(time: number) { return launchPhases.reduce((index, phase, i) => time >= phase.start ? i : index, 0); }
export function formatLaunchTime(time: number) { return `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`; }
export const seaLevel = (x: number) => Math.sqrt(EARTH_RADIUS ** 2 - x ** 2) - EARTH_RADIUS - .4;
type Key = [time: number, x: number, altitude: number, angle: number];
const boosterKeys: Key[] = [[0, 0, 2.2, 0], [12, 0, 2.2, 0], [24, 1.8, 20, -.12], [40, 22, 69, -.65], [44, 29, 90, -.67], [52, 37, 112, 1.7], [60, 23, 104, 2.5], [68, 10, 69, .3], [76, 1.3, 20, .04], [82, 0, 9, 0], [89, 0, 4.6, 0], [166, 0, 4.6, 0]];
const releaseX = 29 + Math.sin(.67) * 7.35 + .05;
const releaseAltitude = 90 + Math.cos(.67) * 7.35 + .4 + seaLevel(29) - seaLevel(releaseX);
const shipKeys: Key[] = [[44, releaseX, releaseAltitude, -.67], [52, 53, 127, -.9], [68, 100, 155, -1.2], [94, 175, 132, -1.45], [112, 240, 80, -1.55], [126, 279, 29, -1.58], [136, 292, 12, -1.58], [144, 297, 5, -.6], [154, 298, .05, -.44], [166, 298, .05, -.44]];
function sample(keys: Key[], time: number) {
  const next = keys.findIndex(key => key[0] > time);
  const a = keys[Math.max(0, next === -1 ? keys.length - 1 : next - 1)], b = keys[next === -1 ? keys.length - 1 : next];
  const f = a === b ? 0 : smooth((time - a[0]) / (b[0] - a[0]));
  const x = a[1] + (b[1] - a[1]) * f, altitude = a[2] + (b[2] - a[2]) * f;
  return { x, y: seaLevel(x) + altitude, altitude, angle: a[3] + (b[3] - a[3]) * f };
}

// The globe, vehicle and flight distances use different illustrative scales.
// Every state is sampled from the clock, never integrated from previous frames.
export function launchState(time: number) {
  const t = clamp(time, 0, LAUNCH_DURATION), booster = sample(boosterKeys, t);
  const separation = smooth((t - 42) / 8);
  const attached = { x: booster.x + Math.sin(-booster.angle) * 7.35, y: booster.y + Math.cos(booster.angle) * 7.35, altitude: booster.altitude + 7.35, angle: booster.angle };
  const independent = sample(shipKeys, Math.max(44, t));
  const ship = t < 42 ? attached : t < 44 ? { ...attached, x: attached.x + smooth((t - 42) / 2) * .05, y: attached.y + smooth((t - 42) / 2) * .4 } : independent;
  const ascent = smooth((t - 6) / 2) * (1 - .9 * smooth((t - 40) / 3)) * (1 - smooth((t - 47) / 3));
  const boostback = smooth((t - 52) / 2) * (1 - smooth((t - 61) / 3)) * .55;
  const landing = smooth((t - 72) / 3) * (1 - smooth((t - 86) / 3)) * .42;
  const shipAscent = smooth((t - 40) / 1.2) * (1 - smooth((t - 89) / 3));
  const shipLanding = smooth((t - 138) / 2) * (1 - smooth((t - 153) / 2)) * .65;
  const focusShip = smooth((t - 91) / 5);
  const focusAltitude = t < 50 ? booster.altitude : booster.altitude * (1 - focusShip) + ship.altitude * focusShip;
  return {
    time: t, phase: phaseAt(t), separation, ship, booster, focusShip,
    boosterPower: Math.max(ascent, boostback, landing), shipPower: Math.max(shipAscent, shipLanding),
    darkness: smooth((focusAltitude - 25) / 65),
    smoke: Math.max(smooth((t - 6) / 3) * (1 - smooth((t - 18) / 8)), smooth((t - 78) / 5) * (1 - smooth((t - 89) / 5)) * .65),
    armRetraction: smooth((t - 3) / 5) * (1 - smooth((t - 80) / 8)),
    heating: smooth((t - 112) / 5) * (1 - smooth((t - 132) / 5)),
    splash: smooth((t - 153.5) / 1) * (1 - smooth((t - 159) / 6)),
    captured: t >= 89, landed: t >= 155,
  };
}
