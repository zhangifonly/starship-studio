import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Camera, Captions, Check, Crosshair, ExternalLink, FileText, Maximize, Minus, Pause, Play, Plus, RotateCcw, Share2, SplitSquareHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import MissionScene, { type MissionSceneHandle } from './MissionScene';
import { CAPTURE_DURATION, capturePhases, capturePhaseAt, captureState, flight5, formatCaptureTime, missionCameras, missionHash, missionSources, parseMissionHash, type MissionCamera } from './mission-data';
import { useNarration, type NarrationTrack, type Narrator } from './useNarration';
import audioManifest from './capture-audio.json';
import './mission.css';

const track: NarrationTrack = { starts: capturePhases.map(p => p.start), audio: audioManifest.audio };

function Evidence({ onPhoto }: { onPhoto: () => void }) {
  const [tab, setTab] = useState<'record' | 'sources' | 'limits'>('record');
  const idPrefix = useId();
  return <>
    <div className="mission-panel-tabs" role="tablist" aria-label="任务资料分类">{([['record', '任务记录'], ['sources', '参考证据'], ['limits', '重建边界']] as const).map(([id, label], index) => <button key={id} role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`${idPrefix}-${id}`} onClick={() => setTab(id)} onKeyDown={e => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (index + (e.key === 'ArrowRight' ? 1 : 2)) % 3; setTab((['record', 'sources', 'limits'] as const)[next]); (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus(); } }}>{label}</button>)}</div>
    <div className="mission-panel-body" role="tabpanel" id={`${idPrefix}-${tab}`} aria-label={tab === 'record' ? '任务记录' : tab === 'sources' ? '参考证据' : '重建边界'}>
      {tab === 'record' ? <>
        <div className="mission-panel-eyebrow">2024.10.13 / 得克萨斯州</div><h2>第一次，返回塔架</h2>
        <p>Flight 5 首次实现超级重型助推器塔架捕获。B12 返回发射场，S30 继续飞行并在印度洋溅落。</p>
        <dl className="mission-facts">{flight5.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}<a aria-label={`${fact.label}的资料来源`} href={missionSources.find(s => s.id === fact.source)!.url} target="_blank" rel="noreferrer"><ArrowUpRight size={13}/></a></dd></div>)}</dl>
        <figure className="mission-photo"><button onClick={onPhoto} aria-label="查看返回末段参考照片"><img src="/missions/flight5-approach.jpg" alt="2024 年 10 月 13 日，B12 在点火下降中接近塔架，双臂位于箭体下方"/><Maximize size={16}/></button><figcaption>返回末段，尚未捕获<br/>Steve Jurvetson · CC BY 2.0</figcaption></figure>
      </> : tab === 'sources' ? <>
        <div className="mission-panel-eyebrow">可追溯的观察依据</div><h2>资料与证据</h2>
        <ol className="mission-sources">{missionSources.map((source, i) => <li key={source.id}><span className="mono">0{i + 1} / {source.type}</span><a href={source.url} target="_blank" rel="noreferrer">{source.name}<ExternalLink size={13}/></a><small>{source.date}</small><p>{source.scope}</p></li>)}</ol>
        <p className="mission-license">参考照片经缩小处理，未裁剪、未调色。<a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">查看 CC BY 2.0 许可</a></p>
      </> : <>
        <div className="mission-panel-eyebrow">事实不等于模型参数</div><h2>哪些是重建？</h2>
        <dl className="mission-limits"><div><dt>已记录的任务事实</dt><dd>任务日期、B12 / S30、助推器首次塔架捕获，以及上面级的溅落结局。</dd></div><div><dt>照片引导的外观</dt><dd>返回箭体、四片栅格翼和早期塔架。焊缝、承力销与发动机细节为简化外观，非制造 CAD。栅格翼保持展开；各翼独立偏转和捕获前回到中立角为教学示意，不是实飞角度记录。</dd></div><div><dt>未测量的空间参数</dt><dd>捕获高度、塔台间距、臂长和机位是近似重建。参考照片有透视，不能据其直接测绘。</dd></div><div><dt>独立片段时钟</dt><dd>00:00 至 00:35 是重建动画时间，不是实际发射后的 T+ 时间。轨迹、收臂速度与关机间隔不是遥测。</dd></div><div><dt>此处不展示</dt><dd>上面级平台着陆、V3 硬件、后续转运，以及未经验证的“实时”高度或速度仪表。</dd></div></dl>
      </>}
    </div>
  </>;
}

export default function MissionView({ onFullscreen }: { onFullscreen: () => void }) {
  const initial = useRef(parseMissionHash(location.hash));
  const [time, setTime] = useState(initial.current.time), clock = useRef(initial.current.time);
  const [camera, setCamera] = useState<MissionCamera>(initial.current.camera), [dual, setDual] = useState(initial.current.dual);
  const [playing, setPlaying] = useState(false), [rate, setRate] = useState(1), [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [highlights, setHighlights] = useState(false), [captions, setCaptions] = useState(true), [following, setFollowing] = useState(true);
  const audioAvailable = Boolean(import.meta.env.CAPTURE_AUDIO_AVAILABLE);
  const [narration, setNarration] = useState(audioAvailable), [voice, setVoice] = useState<Narrator>('yunxi'), [seekVersion, setSeekVersion] = useState(0);
  const [notice, setNotice] = useState(''), [shareUrl, setShareUrl] = useState('');
  const scene = useRef<MissionSceneHandle>(null), photo = useRef<HTMLDialogElement>(null), evidence = useRef<HTMLDialogElement>(null), share = useRef<HTMLDialogElement>(null);
  const phaseIndex = capturePhaseAt(time), phase = capturePhases[phaseIndex], state = captureState(time);
  const speech = useNarration(narration, playing, time, rate, seekVersion, voice, track);
  useEffect(() => {
    if (!playing || !ready || failed || (narration && speech.loading && !speech.failed)) return;
    let raf = 0, previous = performance.now();
    const tick = () => {
      const now = performance.now(), dt = Math.min(.1, (now - previous) / 1000); previous = now;
      if (!document.hidden) { clock.current = Math.min(CAPTURE_DURATION, clock.current + dt * rate); setTime(clock.current); }
      if (clock.current >= CAPTURE_DURATION) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    const visibility = () => { previous = performance.now(); };
    document.addEventListener('visibilitychange', visibility); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); };
  }, [playing, ready, failed, rate, narration, speech.loading, speech.failed]);
  useEffect(() => {
    const sync = () => {
      const restored = parseMissionHash(location.hash); clock.current = restored.time; setTime(restored.time); setCamera(restored.camera); setDual(restored.dual); setPlaying(false); setSeekVersion(v => v + 1); scene.current?.reset();
    };
    window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [notice]);
  function seek(t: number) { clock.current = Math.max(0, Math.min(CAPTURE_DURATION, t)); setTime(clock.current); setPlaying(false); setSeekVersion(v => v + 1); }
  function toggle() { if (time >= CAPTURE_DURATION) seek(0); setPlaying(p => !p); }
  async function shareMoment() {
    const url = new URL(location.href); url.hash = missionHash(time, camera, dual);
    history.replaceState(null, '', url); setShareUrl(url.href);
    try { await navigator.clipboard.writeText(url.href); setNotice('当前时刻链接已复制'); }
    catch { setPlaying(false); share.current?.showModal(); }
  }
  function showPhoto() { setPlaying(false); photo.current?.showModal(); }
  return <section className="mission-workspace" aria-label="历史任务复盘">
    <audio ref={speech.audio} hidden preload="auto" data-testid="mission-audio"/>
    <div className="mission-topbar"><div><div className="mission-panel-eyebrow">任务档案 / 005</div><h1>Flight 5 <span>捕获复盘</span></h1></div><div className="mission-identity"><span><i/>历史任务 · 三维重建</span><small>Booster 12 / Pad A / 2024.10.13</small></div><label className="mission-picker"><select aria-label="任务选择" value="flight-5" onChange={e => { if (e.target.value === 'concept') location.hash = 'launch'; if (e.target.value === 'overview') location.hash = 'mission/flight-5/overview'; }}><option value="flight-5">Flight 5 · 历史捕获</option><option value="overview">Flight 5 · 全程航迹</option><option value="concept">综合流程 · 概念演示</option></select></label><button className="tool mission-evidence-button" aria-label="查看任务资料" title="任务资料" onClick={() => { setPlaying(false); evidence.current?.showModal(); }}><FileText size={18}/></button></div>
    <div className="mission-body"><div className="mission-viewer">
      <div className="mission-viewbar"><label><Camera size={14}/><select aria-label="任务主视角" value={camera} onChange={e => { setCamera(e.target.value as MissionCamera); setFollowing(true); scene.current?.reset(); }}>{missionCameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="mission-view-actions"><button className="tool" aria-label="双机位" title="双机位" aria-pressed={dual} onClick={() => setDual(v => !v)}><SplitSquareHorizontal size={17}/></button><button className="tool" aria-label="突出承力点" title="突出承力点" aria-pressed={highlights} onClick={() => setHighlights(v => !v)}><Crosshair size={17}/></button><button className="tool" aria-label="分享当前任务时刻" title="分享当前时刻" onClick={() => void shareMoment()}><Share2 size={16}/></button><button className="tool" aria-label="任务视图全屏" title="全屏" onClick={onFullscreen}><Maximize size={16}/></button></div></div>
      <div className={`mission-stage${dual ? ' dual' : ''}`}>
        <MissionScene ref={scene} time={time} camera={camera} dual={dual} highlights={highlights} onReady={() => setReady(true)} onError={() => { setFailed(true); setPlaying(false); }} onOrbit={() => setFollowing(false)}/>
        <div className="mission-camera-label"><span className="mono">A</span>{missionCameras.find(c => c.id === camera)?.name}{!following && <small>自由观察</small>}</div>
        {dual && <><div className="mission-split-line"/><div className="mission-detail-label"><span className="mono">B</span>承力点观察<small>{state.contact ? '接触已建立' : '接触前'}</small></div></>}
        <div className="mission-scene-tools"><button className="tool" aria-label="任务视图放大" title="放大" onClick={() => scene.current?.zoom(.85)}><Plus size={16}/></button><button className="tool" aria-label="任务视图缩小" title="缩小" onClick={() => scene.current?.zoom(1.18)}><Minus size={16}/></button><button className="tool" aria-label="重置任务视角" title="重置视角" onClick={() => { setFollowing(true); scene.current?.reset(); }}><RotateCcw size={16}/></button></div>
        <span className="mission-render-note">视觉重建 · 非实测轨迹</span>
      </div>
      <div className="mission-caption"><div><span className="mission-panel-eyebrow">片段 {String(phaseIndex + 1).padStart(2, '0')} / 05</span><h2 data-testid="mission-phase">{phase.name}</h2></div><p>{captions ? phase.narration : phase.focus}</p></div>
      <div className="mission-transport"><div className="mission-play-row"><button className="mission-play" disabled={!ready || failed} aria-label={playing ? '暂停任务复盘' : time >= CAPTURE_DURATION ? '重播任务复盘' : '播放任务复盘'} title={playing ? '暂停' : '播放'} onClick={toggle}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button><div className="mission-time"><output data-testid="mission-time">{formatCaptureTime(time)}</output><small>/ 00:35</small></div><input type="range" aria-label="捕获片段进度" aria-valuetext={`${formatCaptureTime(time)}，${phase.name}，重建片段时钟`} min="0" max={CAPTURE_DURATION} step="0.1" value={time} onChange={e => seek(Number(e.target.value))} style={{ '--progress': `${time / CAPTURE_DURATION * 100}%` } as CSSProperties}/><select aria-label="任务播放速度" value={rate} onChange={e => setRate(Number(e.target.value))}><option value="0.5">0.5 倍</option><option value="1">1 倍</option><option value="2">2 倍</option></select><button className="tool" aria-label="从头播放任务片段" title="回到片段开头" onClick={() => seek(0)}><RotateCcw size={16}/></button></div>
        <ol className="mission-events" aria-label="捕获关键事件">{capturePhases.map((item, i) => <li key={item.start}><button aria-label={`复盘${item.name}`} aria-current={phaseIndex === i ? 'step' : undefined} onClick={() => seek(item.start)}><span>{i < phaseIndex ? <Check size={12}/> : `0${i + 1}`}</span><strong>{item.name}</strong><small>{formatCaptureTime(item.start)}</small></button></li>)}</ol>
        <div className="mission-audio-row"><span>重建片段时钟</span><div><button className="tool" aria-label="任务中文解说" title={audioAvailable ? '中文解说' : '此部署未生成任务音频'} aria-pressed={narration} disabled={!audioAvailable} onClick={() => setNarration(v => !v)}>{narration ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button><select aria-label="任务解说音色" value={voice} disabled={!audioAvailable} onChange={e => setVoice(e.target.value as Narrator)}><option value="yunxi">云希 · 男声</option><option value="xiaoxiao">晓晓 · 女声</option></select><button className="tool" aria-label="任务解说字幕" title="解说字幕" aria-pressed={captions} onClick={() => setCaptions(v => !v)}><Captions size={18}/></button></div></div>
        <div className="mission-audio-status" role="status">{speech.failed ? '解说播放失败，字幕与三维仍可用。' : speech.loading ? '解说音频缓冲中…' : notice || (!audioAvailable ? '此部署未生成解说音频。' : '')}</div>
      </div>
    </div><aside className="mission-evidence" aria-label="任务证据"><Evidence onPhoto={showPhoto}/></aside></div>
    <dialog ref={evidence} className="mission-evidence-dialog" onClick={e => { if (e.target === evidence.current) evidence.current.close(); }}><div className="mission-dialog-heading"><strong>Flight 5 / 任务资料</strong><button className="tool" aria-label="关闭任务资料" onClick={() => evidence.current?.close()}><X size={19}/></button></div><Evidence onPhoto={showPhoto}/></dialog>
    <dialog ref={photo} className="mission-photo-dialog" onClick={e => { if (e.target === photo.current) photo.current.close(); }}><div className="mission-dialog-heading"><strong>返回末段 · 2024.10.13</strong><button className="tool" aria-label="关闭参考照片" onClick={() => photo.current?.close()}><X size={19}/></button></div><img src="/missions/flight5-approach.jpg" alt="Steve Jurvetson 拍摄的 Flight 5 返回末段完整参考照片"/><p>Steve Jurvetson · <a href={missionSources[1].url} target="_blank" rel="noreferrer">原始来源</a> · <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">CC BY 2.0</a> · 缩小，未裁剪</p></dialog>
    <dialog ref={share} className="mission-share-dialog"><div className="mission-dialog-heading"><strong>当前任务时刻</strong><button className="tool" aria-label="关闭分享链接" onClick={() => share.current?.close()}><X size={19}/></button></div><input aria-label="任务时刻链接" readOnly value={shareUrl} onFocus={e => e.target.select()}/></dialog>
  </section>;
}
