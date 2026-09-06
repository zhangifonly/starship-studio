import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Camera, Captions, ExternalLink, FileText, Maximize, Minus, Pause, Play, Plus, RotateCcw, Share2, Volume2, VolumeX, X } from 'lucide-react';
import FlightGlobe, { type FlightGlobeHandle } from './FlightGlobe';
import { flight5State, formatMissionClock, isAscentCamera, isReturnCamera, isShipCamera, returnCameraAvailable, overviewCameras, overviewEventAt, overviewEvents, overviewHash, OVERVIEW_DURATION, parseOverviewHash, STARBASE, timelineSources, type OverviewCamera } from './flight5-timeline';
import { shipCameraAvailable, ship30Pose } from './ship30-state';
import { ascentCameraAvailable, stagingCameraAvailable } from './ascent-layout';
import { daylightLabel, solarElevation } from './mission-geo';
import { useNarration, type NarrationTrack, type Narrator } from './useNarration';
import manifest from './overview-audio.json';
import './mission.css';
import './overview.css';

const track: NarrationTrack = { starts: overviewEvents.map(e => e.start), audio: manifest.audio };
function OverviewEvidence({ index }: { index: number }) {
  const event = overviewEvents[index], source = timelineSources.find(s => s.id === event.source)!;
  return <div className="mission-panel-body overview-evidence-body">
    <div className="mission-panel-eyebrow">当前事件 / 证据与时间</div><h2>{event.name}</h2>
    <p className="overview-event-time">{event.timeLabel}</p><p>{event.timing}。</p>
    <a className="overview-source-link" href={source.url} target="_blank" rel="noreferrer">{source.name}<ExternalLink size={13}/></a>
    <dl className="mission-limits"><div><dt>时间基准</dt><dd>起点约为 12:25 UTC。T+ 为按公开时间表对齐的近似任务时间，不是逐帧实飞计时。200 秒播放时间分段压缩约 65 分钟任务。</dd></div><div><dt>航迹证据等级</dt><dd>示意控制点之间插值，连续遥测未获取。经纬度、峰值时刻与落点均非测量值；公开的约 69 km 分离高度、约 212 km 远地点不能推导完整轨迹。</dd></div><div><dt>地球与光照</dt><dd>WGS84 椭球，距离用米计算。日照依据近似任务时间和位置计算；NASA 地表与云图为合成素材，并非任务当天卫星影像。地理视角使用放大定位标记，B12 近景使用返回构型模型。</dd></div></dl>
    <dl className="mission-limits"><div><dt>B12 近景边界</dt><dd>抛环后使用四栅格翼返回构型。地面长焦的观察点和自动焦距为重建；场地朝向、地面与承接高度未经测绘。最后下降段与全球位置共用坐标，但只是将捕获片段近似对齐到任务时钟。完成后保留捕获状态，不表示之后一直悬挂不动。</dd></div></dl>
    <dl className="mission-limits"><div><dt>S30 近景边界</dt><dd>关机后展示第一代外观，四片襟翼、三台海平面与三台真空发动机。热盾分布、俯仰、襟翼偏转、受热发光与海浪为重建，不是遥测或流场计算；没有复原再入损伤。夜侧有展示补光，机位不是实拍摄影点。画面停在入水瞬间；飞后记录中的入水后约 16 秒火球与后续状态未重建。</dd></div></dl>
    <dl className="mission-limits"><div><dt>发射与热分离边界</dt><dd>展示 B12、热分离环和第一代 S30，至返航点火前切回区域视图。起点与发射台裙部支座共用坐标；S30 全球位置包含叠装偏移。助推器保留中心三机，上面级分离前点火，气流从级间环侧面泄出。环参考约 1.8 米高度；开孔、顶部热防护、点火秒数、间距与泄流形状为示意，非制造图纸、遥测或流场计算。双臂与脐带臂已避让；长焦未经实拍标定。B12 的四片栅格翼在上升时保持展开，不使用猎鹰 9 式折叠。</dd></div></dl>
    <dl className="mission-limits"><div><dt>栅格翼控制边界</dt><dd>四翼绕各自径向轴偏转；上升与高空滑行采用中立角，下降段展示差动纠偏，捕获前回到中立角。角度、时机与回中立动作均为教学示意，不是 B12 逐翼遥测，也没有参与气动力或闭环制导求解；周向布置仍未测绘。</dd></div></dl>
    <h3>任务来源</h3><ol className="mission-sources">{timelineSources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.name}<ExternalLink size={12}/></a><small>{s.date}</small><p>{s.scope}</p></li>)}</ol>
  </div>;
}

export default function FlightOverview({ onFullscreen }: { onFullscreen: () => void }) {
  const initial = useRef(parseOverviewHash(location.hash));
  const [time, setTime] = useState(initial.current.time), clock = useRef(initial.current.time);
  const [camera, setCamera] = useState<OverviewCamera>(initial.current.camera), [playing, setPlaying] = useState(false), [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [captions, setCaptions] = useState(true);
  const audioAvailable = Boolean(import.meta.env.OVERVIEW_AUDIO_AVAILABLE);
  const [narration, setNarration] = useState(audioAvailable), [voice, setVoice] = useState<Narrator>('yunxi'), [seekVersion, setSeekVersion] = useState(0);
  const [notice, setNotice] = useState(''), [shareUrl, setShareUrl] = useState('');
  const scene = useRef<FlightGlobeHandle>(null), evidence = useRef<HTMLDialogElement>(null), share = useRef<HTMLDialogElement>(null);
  const speech = useNarration(narration, playing, time, rate, seekVersion, voice, track);
  const index = overviewEventAt(time), event = overviewEvents[index], state = flight5State(time);
  const returnView = isReturnCamera(camera) && returnCameraAvailable(state.seconds);
  const shipView = isShipCamera(camera) && shipCameraAvailable(state.seconds), ascentView = isAscentCamera(camera) && ascentCameraAvailable(state.seconds), closeView = returnView || shipView || ascentView;
  const shipPose = ship30Pose(state.seconds);
  useEffect(() => {
    if (!playing || !ready || failed || (narration && speech.loading && !speech.failed)) return;
    let raf = 0, previous = performance.now();
    const tick = () => {
      const now = performance.now(), dt = Math.min(.1, (now - previous) / 1000); previous = now;
      if (!document.hidden) { clock.current = Math.min(OVERVIEW_DURATION, clock.current + dt * rate); setTime(clock.current); }
      if (clock.current >= OVERVIEW_DURATION) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    const visibility = () => { previous = performance.now(); };
    document.addEventListener('visibilitychange', visibility); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); };
  }, [playing, ready, failed, rate, narration, speech.loading, speech.failed]);
  useEffect(() => {
    const sync = () => { const next = parseOverviewHash(location.hash); clock.current = next.time; setTime(next.time); setCamera(next.camera); setPlaying(false); setSeekVersion(v => v + 1); scene.current?.reset(); };
    window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [notice]);
  function seek(value: number) { clock.current = Math.max(0, Math.min(OVERVIEW_DURATION, value)); setTime(clock.current); setPlaying(false); setSeekVersion(v => v + 1); }
  function toggle() { if (time >= OVERVIEW_DURATION) seek(0); setPlaying(p => !p); }
  async function shareMoment() {
    const url = new URL(location.href); url.hash = overviewHash(time, camera); history.replaceState(null, '', url); setShareUrl(url.href);
    try { await navigator.clipboard.writeText(url.href); setNotice('当前时刻链接已复制'); }
    catch { setPlaying(false); share.current?.showModal(); }
  }
  return <section className="mission-workspace overview-workspace" aria-label="Flight 5 全程航迹">
    <audio ref={speech.audio} hidden preload="auto" data-testid="overview-audio"/>
    <div className="mission-topbar"><div><div className="mission-panel-eyebrow">任务档案 / 005</div><h1>Flight 5 <span>全程航迹</span></h1></div><div className="mission-identity"><span><i/>历史事件 · 示意航迹</span><small>B12 + S30 / 2024.10.13</small></div><label className="mission-picker"><select aria-label="任务选择" value="overview" onChange={e => { location.hash = e.target.value === 'deployment' ? 'mission/deployment' : e.target.value === 'capture' ? 'mission/flight-5' : 'launch'; }}><option value="overview">Flight 5 · 全程航迹</option><option value="capture">Flight 5 · 捕获特写</option><option value="deployment">卫星部署 · 概念</option><option value="concept">综合流程 · 概念演示</option></select></label><button className="tool mission-evidence-button" aria-label="查看航迹资料" title="航迹资料" onClick={() => { setPlaying(false); evidence.current?.showModal(); }}><FileText size={18}/></button></div>
    <div className="mission-body"><div className="mission-viewer">
      <div className="mission-viewbar"><label><Camera size={14}/><select aria-label="航迹视角" value={camera} onChange={e => { setCamera(e.target.value as OverviewCamera); scene.current?.reset(); }}>{overviewCameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="mission-view-actions"><button className="tool" aria-label="分享航迹时刻" title="分享时刻" onClick={() => void shareMoment()}><Share2 size={17}/></button><button className="tool" aria-label="航迹全屏" title="全屏" onClick={onFullscreen}><Maximize size={17}/></button></div></div>
      <div className={`mission-stage overview-stage${closeView ? ' return-stage' : ''}`}>
        <FlightGlobe ref={scene} time={time} camera={camera} onReady={() => setReady(true)} onError={() => { setFailed(true); setPlaying(false); }}/>
        <div className="overview-clock"><small>任务时间 / 近似</small><output data-testid="overview-mission-time">T+{formatMissionClock(state.seconds)}</output><span>约 {state.date.toISOString().slice(11, 16)} UTC</span></div>
        <div className="overview-legend">{ascentView ? <><span>B12 + S30 / 第一代</span><span>{camera === 'staging' && stagingCameraAvailable(state.seconds) ? '分离环与点火' : camera === 'ascent-ground' ? '固定地面机位 · 自动焦距' : state.separated ? '热分离跟踪' : '组合体上升跟踪'}</span></> : shipView ? <><span>S30 / 第一代 · 四襟翼</span><span>{shipPose.phase}</span></> : returnView ? <><span>B12 / 四栅格翼</span><span>{camera === 'ground' ? '固定地面机位 · 自动焦距' : camera === 'fins' ? '径向转轴 · 四翼特写' : '返回近距跟踪'}</span></> : <><span><i className="ship-key"/>S30 上面级</span><span><i className="booster-key"/>B12 助推器</span></>}</div>
        <div className="overview-inset-label">{returnView ? 'S30 / 地球' : 'STARBASE'} <span>{returnView ? state.splashed ? '印度洋溅落' : '上面级任务' : state.caught ? 'B12 已捕获' : state.separated ? 'B12 返回中' : '两级上升'}</span></div>
        <div className="mission-scene-tools"><button className="tool" aria-label="航迹放大" title="放大" onClick={() => scene.current?.zoom(.85)}><Plus size={16}/></button><button className="tool" aria-label="航迹缩小" title="缩小" onClick={() => scene.current?.zoom(1.18)}><Minus size={16}/></button><button className="tool" aria-label="重置航迹视角" title="重置视角" onClick={() => scene.current?.reset()}><RotateCcw size={16}/></button></div>
        <span className="overview-render-note">{ascentView ? state.seconds >= 159 ? '热分离与泄流示意 · 非遥测' : '上升与尾焰重建 · 非遥测' : isAscentCamera(camera) ? '返航点火后 · 发射场区域' : shipView ? state.splashed ? '入水瞬间定格 · 后续未重建' : 'S30 姿态与受热重建 · 非遥测' : returnView ? camera === 'fins' ? '栅格翼控制示意 · 非遥测角度' : state.seconds > 426.6 ? '捕获状态保留 · 后续转运未重建' : 'B12 返回重建 · 非实拍机位' : isReturnCamera(camera) ? '抛环前 · 发射场区域' : isShipCamera(camera) ? '关机前 · 上面级区域' : '示意插值 · 非遥测'}</span>
      </div>
      <div className="overview-vehicle-strip"><div><span className="booster-key">B12</span><strong>{state.caught ? '塔架捕获完成' : state.separated ? '返回 Starbase' : '与 S30 组合飞行'}</strong><small>{daylightLabel(solarElevation(state.date, STARBASE))} · 发射场</small></div><div><span className="ship-key">S30</span><strong>{state.splashed ? '印度洋溅落' : state.separated ? '独立飞行' : '组合上升'}</strong><small>连续遥测未获取</small></div><a href="#mission/flight-5">捕获特写<ArrowRight size={14}/></a></div>
      <div className="mission-caption overview-caption"><div><span className="mission-panel-eyebrow">事件 {String(index + 1).padStart(2, '0')} / 10</span><h2 data-testid="overview-phase">{event.name}</h2></div><p>{captions ? event.text : event.vehicle}</p></div>
      <div className="mission-transport"><div className="mission-play-row"><button className="mission-play" disabled={!ready || failed} aria-label={playing ? '暂停全程复盘' : time >= OVERVIEW_DURATION ? '重播全程复盘' : '播放全程复盘'} title={playing ? '暂停' : '播放'} onClick={toggle}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button><div className="mission-time"><output>{formatMissionClock(time)}</output><small>/ 03:20</small></div><input type="range" aria-label="全程复盘进度" aria-valuetext={`${formatMissionClock(time)}，${event.name}，近似任务时间 ${formatMissionClock(state.seconds)}`} min="0" max={OVERVIEW_DURATION} step="0.1" value={time} onChange={e => seek(Number(e.target.value))} style={{ '--progress': `${time / OVERVIEW_DURATION * 100}%` } as CSSProperties}/><select aria-label="全程播放速度" value={rate} onChange={e => setRate(Number(e.target.value))}><option value="0.5">0.5 倍</option><option value="1">1 倍</option><option value="2">2 倍</option></select><button className="tool" aria-label="回到全程开头" title="回到开头" onClick={() => seek(0)}><RotateCcw size={16}/></button></div>
        <ol className="overview-events" aria-label="全程关键事件">{overviewEvents.map((e, i) => <li key={e.id}><button aria-label={`跳转${e.name}`} aria-current={index === i ? 'step' : undefined} onClick={() => seek(e.start)}><span>{String(i + 1).padStart(2, '0')}</span><strong>{e.name}</strong><small>{e.timeLabel}</small></button></li>)}</ol>
        <div className="mission-audio-row"><span>分段压缩 / 200 秒复盘</span><div><button className="tool" aria-label="全程中文解说" title={audioAvailable ? '中文解说' : '此部署未生成全程音频'} disabled={!audioAvailable} aria-pressed={narration} onClick={() => setNarration(v => !v)}>{narration ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button><select aria-label="全程解说音色" disabled={!audioAvailable} value={voice} onChange={e => setVoice(e.target.value as Narrator)}><option value="yunxi">云希 · 男声</option><option value="xiaoxiao">晓晓 · 女声</option></select><button className="tool" aria-label="全程解说字幕" title="字幕" aria-pressed={captions} onClick={() => setCaptions(v => !v)}><Captions size={18}/></button></div></div>
        <div className="mission-audio-status" role="status">{speech.failed ? '解说播放失败，字幕与三维仍可用。' : speech.loading ? '解说音频缓冲中…' : notice || (!audioAvailable ? '此部署未生成全程解说音频。' : '')}</div>
      </div>
    </div><aside className="mission-evidence" aria-label="全程任务证据"><div className="overview-evidence-heading"><FileText size={15}/>任务证据</div><OverviewEvidence index={index}/></aside></div>
    <dialog ref={evidence} className="mission-evidence-dialog"><div className="mission-dialog-heading"><strong>Flight 5 / 航迹资料</strong><button className="tool" aria-label="关闭航迹资料" onClick={() => evidence.current?.close()}><X size={19}/></button></div><OverviewEvidence index={index}/></dialog>
    <dialog ref={share} className="mission-share-dialog"><div className="mission-dialog-heading"><strong>当前航迹时刻</strong><button className="tool" aria-label="关闭航迹分享" onClick={() => share.current?.close()}><X size={19}/></button></div><input aria-label="航迹时刻链接" readOnly value={shareUrl} onFocus={e => e.target.select()}/></dialog>
  </section>;
}
