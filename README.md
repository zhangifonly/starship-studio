# 星舰工作室 / Starship Studio

中文交互式星舰、超级重型助推器与猛禽发动机三维探索工具。
使用 React、TypeScript、Vite、Three.js 和 Lucide 构建。

[在线体验](https://spacex.whaty.org/) · [发射演示](https://spacex.whaty.org/#launch) · [MIT 许可证](LICENSE)

## 本地运行

需要 Node.js 22.13+ 和 npm，不需要数据库或 API 密钥。

```sh
git clone https://github.com/zhangifonly/starship-studio.git
cd starship-studio
npm ci
npm run dev
```

打开 http://127.0.0.1:3016/ 。若端口被占用，可用
`npm run dev -- --port 3017`。生产构建执行 `npm run build`，将 `dist/`
部署到支持静态文件的服务器；路由使用 URL hash，无需应用后端。

## 当前功能

- 整箭、星舰、助推器视图，九组系统部件选择与独立查看。
- 连续拆解、内部剖面、触摸旋转、缩放、视角切换和 PNG 导出。
- 猛禽单台精查：八组组件，喷管、燃烧室、喷注器、双泵、预燃室、管路与推力架。
- 海平面型与真空喷管示意，泵轴和叶轮等内部剖面。
- 十二阶段、166 秒飞行流程，包含助推器捕获及星舰海上平台概念着陆。
- 七种发射视角（含海上平台、发射场俯视）、进度拖动、暂停续播、倍速、中文解说与字幕。
- 海上平台船体、甲板标线、护栏、设备舱与概念着陆支架。
- NASA 地球底图、云层、大气、海面及程序化推进效果。
- 桌面与移动端界面。

## 中文解说

音频齐全时，解说默认开启，点击播放演示即同步出声；打开页面本身不会
自动播放。默认云希男声，可切换晓晓女声。暂停、跳转、倍速和切换音色
均与演示时钟同步。

开源仓库包含讲稿、音频清单与 Edge TTS 生成器，不分发授权未核实的
生成 MP3。干净克隆仍可观看三维演示和字幕，语音按钮暂不可用。
生成前请核对微软服务适用条款；生成需要联网，播放只访问本站静态文件。

```sh
python3 -m venv .venv-tts
# Windows 使用 .venv-tts/Scripts 下的对应命令
.venv-tts/bin/pip install -r scripts/tts-requirements.txt
npm run narration:plan
.venv-tts/bin/python scripts/generate-narration.py
```

生成后重启开发服务器或重新构建，自动启用默认有声解说。
详见 [NARRATION.md](NARRATION.md)。

## 验证

```sh
npm run test:timeline
npm run build
npx playwright install chromium webkit
# 以下命令需要另一个终端保持开发服务器运行
npm run test:browser
npm run test:engine
npm run test:launch
# 生成音频后运行
npm run test:narration
npm run test:platform
```

浏览器测试检查实际画面像素、交互、移动端布局与音频播放状态。
结果保存到被忽略的 `artifacts/`。设置 `STARSHIP_TEST_URL` 可测试其他地址。
GitHub Actions 自动运行类型/构建和时间轴检查，不调用在线 TTS 服务。

## 授权与边界

本项目原创代码、程序化模型和讲稿使用 **MIT** 许可证，允许使用、修改和
再分发，需保留许可证。第三方素材保留原授权，见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

FAA 原图带 SpaceX 专有资料标记，不随仓库分发；公开版本通过原始来源
链接提供参考。NASA / Three.js 地球素材保留出处与通知。
本项目仅受 [Model X Studio](https://github.com/ashemag/model-x-studio)
交互概念启发，不包含其源码或 Tesla / BlendKit 模型。

这是独立科普可视化，不是 SpaceX 官方产品，也不是开放制造 CAD。
V3 构型、猛禽内部结构、孔数、尺寸与管路包含示意性重建。飞行时间、
轨迹与地球比例经过压缩，尚非真实遥测或物理仿真；起飞运动、尾焰烟汽
和近地尺度的真实感仍有改进空间。海上平台与着陆支架为未验证的概念设计，
不代表星舰已完成此类回收，也不能与猎鹰九号无人船回收混为一谈。
完整来源和限制见 [REFERENCES.md](REFERENCES.md)。

欢迎通过 Issue 报告问题，或提交范围明确、附验证方法的 Pull Request。
请勿提交密钥、服务器配置、未经授权的模型或参考图纸。
