# 发射台与捕获对位

本场景仍是流程示意，不是某座发射塔或某次飞行的测绘复原。
局部箭体和设施采用每单位约 10 米的比例，地球与航程另用压缩比例。

## 位置关系

- 发射位与塔架捕获位分开，返回箭体不重新落在发射台上。
- 开孔发射台通过六处支承接到助推器底部承力环，中央留出排焰空间。
- 起飞阶段先竖直离台，清除塔架高度后再进入转弯段。
- 返回时先对准捕获通道；两根机械臂分别开合，托住箭体上部支点。
- 捕获支点在栅格翼下方，不以栅格翼本体承重。
- 支点下表面和机械臂承托面使用同一组几何参数；捕获后保持接触。

布局定义在 `src/launch-site-layout.ts`，设施建模在 `src/launch-site.ts`。
`launch-timeline.ts` 同时决定助推器三维位置、机械臂高度和开度。
所有动作直接从演示时间求值，暂停、倒放跳转不依赖上一帧状态。

## 参考与边界

- [Flight 5 返回照片（SpaceX，经 Wikimedia Commons）](https://commons.wikimedia.org/wiki/File:Starship_Booster_Return_on_Final_Approach_(54063904149).jpg)：核对塔架、双臂、发射台与下降箭体的位置关系。
- [Flight 5 飞行记录及来源](https://en.wikipedia.org/wiki/Starship_flight_test_5)：返回末段对准双臂并捕获的动作顺序。
- [Everyday Astronaut 的 Starbase 访谈](https://everydayastronaut.com/starbase-tour-and-interview-with-elon-musk/)：Super Heavy 的栅格翼上升时保持展开，不沿用 Falcon 9 的折叠方式。

参考照片展示的是早期助推器；本项目的 V3 外形、设施尺寸、具体偏移、
支点形状与控制曲线仍有简化，不应解释为 V3 的精确工程设计。

## 验证

`npm run test:timeline` 检查支承接触、排焰孔、离塔间隙、捕获支点对位、
轨迹连续性以及跳转复原。`npm run test:launch-site` 检查桌面与手机的
起飞及捕获画面、三个机位、像素非空、播放与手动旋转。
