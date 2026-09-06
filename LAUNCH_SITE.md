# 发射台与捕获对位

本场景仍是流程示意，不是某座发射塔或某次飞行的测绘复原。
局部箭体和设施采用每单位约 10 米的比例，地球与航程另用压缩比例。
六腿圆形发射台和塔架采用早期 Starbase Pad A 的形制作为参考，不声称是
当前 Pad B 或 V3 配套设施的精确复原。

## 位置关系

- 塔架转角面向作业区，双臂基座、发射位与外侧捕获位共用作业方向。
- 发射位与塔架捕获位分开，返回箭体在台外悬空捕获，不重新落在发射台上。
- 开孔发射台通过六处支承接到助推器底部承力环，中央留出排焰空间。
- 开场为整箭就位支承：双臂分别朝向发射位的两个上部支点，先卸载，再张开。
- 这段装配收尾与发射准备被压缩到开场，不是某次飞行倒计时的记录。
- 起飞阶段先竖直离台，清除塔架高度后再进入转弯段。
- 返回时先对准捕获通道；两根机械臂分别开合，托住箭体上部支点。
- 捕获支点在栅格翼下方，不以栅格翼本体承重。
- 支点下表面和机械臂承托面使用同一组几何参数；捕获后保持接触。
- 双臂为外侧箱形桁架，承托轨位于内侧上缘；桁架不得穿过箭体。
- 固定高度的独立脐带臂连接星舰下部，起飞前退开，不跟随捕获升降架移动。

布局定义在 `src/launch-site-layout.ts`，设施建模在 `src/launch-site.ts`。
`launch-timeline.ts` 同时决定助推器三维位置与轴向朝向、机械臂高度、开度和目标支点。
双臂分别计算铰链到支点的角度，不能用一个固定朝向代替发射位与捕获位。
所有动作直接从演示时间求值，暂停、倒放跳转不依赖上一帧状态。

## 参考与边界

- [Flight 5 返回照片（Steve Jurvetson，CC BY 2.0，经 Wikimedia Commons）](https://commons.wikimedia.org/wiki/File:Starship_Booster_Return_on_Final_Approach_(54063904149).jpg)：2024-10-13 返回末段，用于观察塔架、双臂、发射台与下降箭体的投影关系，不能由单张透视照片确定精确三维尺寸。
- [Flight 5 飞行记录及来源](https://en.wikipedia.org/wiki/Starship_flight_test_5)：返回末段对准双臂并捕获的动作顺序。
- [Everyday Astronaut 的 Starbase 访谈](https://everydayastronaut.com/starbase-tour-and-interview-with-elon-musk/)：Super Heavy 的栅格翼上升时保持展开，不沿用 Falcon 9 的折叠方式。
- [Starship full stack 现场照片](https://commons.wikimedia.org/wiki/File:Starship_full_stack.jpg)：核对六腿发射台、塔身转角、堆叠箭体、双臂桁架与独立脐带臂。
- [Tower + Booster 现场照片](https://commons.wikimedia.org/wiki/File:Tower_%2B_Booster.jpg)：核对捕获臂升降架与固定脐带臂不是同一机构。
- [Starbase 场区总平面图](https://commons.wikimedia.org/wiki/File:StarbaseLaunchSiteUSArmy2025.png)：仅核对 Pad 1/Pad 2 与塔架、台区的大体相邻关系。图中含规划覆盖层且注明不可按比例量测，不从中推导精确尺寸；含专有资料标记，不随项目分发。

参考照片展示的是早期助推器；本项目的 V3 外形、设施尺寸、具体偏移、
支点形状与控制曲线仍有简化，不应解释为 V3 的精确工程设计。
当前作业中心线、塔身旋转角、臂长和捕获位距离是为了表达上述关系选择的
近似场景参数，不是从照片测出的实测坐标。

## 验证

`npm run test:timeline` 检查支承接触、排焰孔、离塔间隙、捕获支点对位、
轨迹连续性以及跳转复原。`npm run test:launch-site` 检查桌面与手机的
起飞及捕获画面、三个机位、像素非空、播放与手动旋转。
`npm run test:launch-site -- --grip` 另检查发射场俯视、初始承托、开臂、
脐带臂退开和捕获状态，桌面与手机均生成截图。三维几何测试同时扫描
桁架三角边与箭体圆柱包络的间隙，避免只验证细承托轨却漏掉粗桁架。

## 海上平台概念着陆

末段新增独立海上平台：船体、甲板靶标、安全线、护栏、防撞护舷、设备舱、
航行灯与天线。平台和四支脚均为概念设计，不是星舰已验证的回收构型。

`src/landing-site-layout.ts` 共用海面切平面、甲板高度与支脚底面参数；
`src/landing-platform.ts` 创建平台及支架。142–150 秒展开支架，154 秒
四个支脚接触甲板，随后保持位置；尾焰在甲板处裁切，水雾位于船体外围。
平台不模拟波浪引起的升沉。海上平台机位可独立查看，导演镜头在末段抬高
以同时呈现星舰与甲板。末两段字幕与两种音色的解说同步更新。

时间轴测试对四支脚分别做甲板射线求交，并扫描下降段防止穿透。
`npm run test:platform` 检查桌面 Chromium、手机尺寸 Chromium/WebKit 的
平台机位、接近与着陆画面、跳转复原、画布像素和末段音频衔接。
