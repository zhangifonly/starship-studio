export type PartId = 'nose' | 'flaps' | 'shield' | 'ship-tank' | 'ship-engines' | 'hotstage' | 'gridfins' | 'booster-tank' | 'booster-engines';
export type VehicleMode = 'stack' | 'ship' | 'booster';
export type Part = {
  id: PartId; name: string; english: string; stage: 'ship' | 'booster';
  description: string; principle: string; specs: [string, string][];
};

export const parts: Part[] = [
  { id: 'nose', name: '头锥与载荷舱', english: 'PAYLOAD SECTION', stage: 'ship',
    description: '星舰最前端的流线型舱段。头锥降低穿越大气层时的阻力，内部空间可根据任务配置载荷设备。',
    principle: '尖拱外形让气流逐渐绕过箭体。载荷区与下方推进剂贮箱隔开；不同任务的舱门、载荷和内部布置会有所变化。',
    specs: [['所属级段', '星舰 / 上面级'], ['外部结构', '不锈钢壳体'], ['模型内容', '头锥 + 载荷段']] },
  { id: 'flaps', name: '前后气动翼面', english: 'AERODYNAMIC FLAPS', stage: 'ship',
    description: '两片前翼与两片后翼协同控制星舰再入时的姿态，适应横向迎风的下降过程。',
    principle: '通过改变翼面角度调节气动力和力矩，保持再入姿态。翼面控制与着陆阶段的发动机推力控制共同完成飞行姿态转换。',
    specs: [['示意数量', '2 前翼 / 2 后翼'], ['主要作用', '再入姿态控制'], ['防护', '迎风面热防护']] },
  { id: 'shield', name: '陶瓷隔热层', english: 'THERMAL PROTECTION', stage: 'ship',
    description: '深色隔热瓦覆盖星舰的主要迎风面，在高速再入时保护不锈钢结构。',
    principle: '隔热材料减缓热量向箭体传递。瓦片分块安装以适应温度变化和维护需要；这里的瓦片排列是可视化示意。',
    specs: [['覆盖区域', '主要迎风面'], ['外观', '六边形陶瓷瓦'], ['图示精度', '排列与数量示意']] },
  { id: 'ship-tank', name: '星舰推进剂舱', english: 'SHIP PROPELLANT TANKS', stage: 'ship',
    description: '不锈钢箭体内的液氧和液态甲烷贮箱，为星舰发动机提供推进剂。',
    principle: '低温推进剂储存在分隔的贮箱中，经输送管路进入发动机。剖面模式展示贮箱位置关系，内部尺寸与设备布局经过简化。',
    specs: [['燃料', '液态甲烷 / CH₄'], ['氧化剂', '液氧 / LOX'], ['模型内容', '分舱与封头示意']] },
  { id: 'ship-engines', name: '星舰猛禽发动机', english: 'SHIP RAPTOR ARRAY', stage: 'ship',
    description: '星舰尾部组合布置海平面型和真空型猛禽发动机。真空型使用更大的喷管，适合太空环境。',
    principle: '猛禽采用全流量分级燃烧循环。燃料与氧化剂驱动涡轮后进入主燃烧室，燃气经喷管膨胀产生推力。图示采用 3 + 3 发动机布局，不代表所有未来构型。',
    specs: [['图示布局', '3 海平面 + 3 真空'], ['推进剂', '液氧 / 液态甲烷'], ['内部结构', '简化示意']] },
  { id: 'hotstage', name: '热分离段', english: 'HOT-STAGING SECTION', stage: 'booster',
    description: '位于星舰与助推器之间，为热分离提供排气通道。V3 将该区域与助推器前端结构集成。',
    principle: '上面级在两级完全分离之前点火，燃气通过级间开口排出。V3 使用一体式排气级间结构；拆解视图为便于观察将它分组展示，不表示实际可以拆卸。',
    specs: [['位置', '两级之间'], ['方式', '热分离'], ['V3 特征', '一体式排气级间段']] },
  { id: 'gridfins', name: '栅格翼', english: 'BOOSTER GRID FINS', stage: 'booster',
    description: '助推器顶部附近的栅格状控制面，用于返回大气层后的方向和姿态调整。',
    principle: '气流穿过格栅，翼面偏转产生控制力矩。栅格翼与发动机配合，让助推器在返回阶段调整轨迹。模型数量与细节仅代表所示构型。',
    specs: [['V3 构型', '3 片栅格翼'], ['工作阶段', '大气层内返回'], ['结构', '金属栅格翼']] },
  { id: 'booster-tank', name: '超级重型助推器', english: 'SUPER HEAVY STRUCTURE', stage: 'booster',
    description: '超级重型助推器是星舰系统的第一级。不锈钢筒体容纳低温推进剂，并承受整箭起飞时的载荷。',
    principle: '助推器在飞行初段提供主要推力，分离后执行返回与回收。舱体的环向焊缝、加强构件和管路在模型中独立呈现。',
    specs: [['所属级段', '超级重型 / 第一级'], ['箭体材料', '不锈钢'], ['设计目标', '完全快速复用']] },
  { id: 'booster-engines', name: '助推器发动机阵列', english: 'BOOSTER RAPTOR ARRAY', stage: 'booster',
    description: '密集的猛禽发动机阵列位于助推器底部。多台发动机共同提供起飞推力。',
    principle: '外圈与中心区域的发动机构成同心阵列，部分发动机具备推力矢量控制能力。此模型展示 33 台布局，喷管和管路经过简化。',
    specs: [['图示数量', '33 台'], ['发动机', '猛禽发动机'], ['推进剂', '液氧 / 液态甲烷']] },
];

export const sourceUrl = 'https://www.spacex.com/vehicles/starship/';
