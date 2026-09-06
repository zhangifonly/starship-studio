import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Camera, Captions, ExternalLink, FileText, Maximize, Minus, Pause, Play, Plus, RotateCcw, Satellite, Share2, Volume2, VolumeX, X } from 'lucide-react';
import DeploymentScene, { type DeploymentSceneHandle } from './DeploymentScene';
import { clampDeploymentTime, deploymentCameras, deploymentHash, deploymentPhaseAt, deploymentPhases, deploymentSources, deploymentState, DEPLOYMENT_DURATION, parseDeploymentHash, type DeploymentCamera } from './deployment-state';
import { useNarration, type NarrationTrack, type Narrator } from './useNarration';
import manifest from './deployment-audio.json';
import './mission.css';
import './overview.css';
import './deployment.css';

const track: NarrationTrack = { starts: deploymentPhases.map(p => p.start), audio: manifest.audio };
const stamp = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
function Evidence() {
  return <div className="mission-panel-body overview-evidence-body">
    <div className="mission-panel-eyebrow">卫星部署 / 概念任务</div><h2>到达太空，不等于入轨</h2>
    <p>轨道飞行依靠足够的横向速度。主机关机后，飞船和卫星仍在地球引力作用下一起运动；释放机构只提供很小的相对分离速度。</p>
    <dl className="mission-limits">
      <div><dt>已经发生的试验</dt><dd>2025 年 Flight 10 的 Ship 37 释放过 8 个星链质量模拟器。它们沿亚轨道轨迹飞行并再入，不是投入运营的通信卫星。Flight 5 没有这段部署任务。</dd></div>
      <div><dt>本演示的设定</dt><dd>约 400 公里高度的虚构近圆轨道，三颗通用平板卫星。52 米级货运星舰、滑动舱门、送星轨道和分节太阳翼均为独立概念模型，不代表某一代星链的实物机构。</dd></div>
      <div><dt>运动与时间</dt><dd>飞船轨道由 satellite.js 的 SGP4 传播器计算，输入是明确虚构的轨道根数。局部分离约 0.6 米/秒、120 秒时序、关门和展开动作是教学编排，不是飞行遥测或动力学验证。</dd></div>
      <div><dt>不省略的区别</dt><dd>质量模拟器不会展开供电太阳翼。真实卫星的展开、姿态建立、通信与升轨顺序依型号而异；本演示不重现 Flight 10 出舱时的磕碰，也不展示完整星座建设。</dd></div>
      <div><dt>地球与光照</dt><dd>沿用 NASA 地表和云层合成素材，不是当天实拍。局部模型与地球共用取景方向，采用展示补光；卫星的相对漂移为短时近似，没有逐颗解算分离后的完整轨道。</dd></div>
    </dl>
    <h3>参考来源</h3><ol className="mission-sources">{deploymentSources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}<ExternalLink size={12}/></a><p>{source.detail}</p></li>)}</ol>
  </div>;
}

export default function DeploymentView({ onFullscreen }: { onFullscreen: () => void }) {
  const initial = useRef(parseDeploymentHash(location.hash)), clock = useRef(initial.current.time);
  const [time, setTime] = useState(initial.current.time), [camera, setCamera] = useState<DeploymentCamera>(initial.current.camera), [satellite, setSatellite] = useState(initial.current.satellite);
  const [playing, setPlaying] = useState(false), [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [rate, setRate] = useState(1);
  const available = Boolean(import.meta.env.DEPLOYMENT_AUDIO_AVAILABLE);
  const [narration, setNarration] = useState(available), [voice, setVoice] = useState<Narrator>('yunxi'), [captions, setCaptions] = useState(true), [seekVersion, setSeekVersion] = useState(0);
  const [notice, setNotice] = useState(''), [shareUrl, setShareUrl] = useState('');
  const scene = useRef<DeploymentSceneHandle>(null), evidence = useRef<HTMLDialogElement>(null), share = useRef<HTMLDialogElement>(null);
  const speech = useNarration(narration, playing, time, rate, seekVersion, voice, track);
  const index = deploymentPhaseAt(time), phase = deploymentPhases[index], state = deploymentState(time);
  useEffect(() => {
    if (!playing || !ready || failed || (narration && speech.loading && !speech.failed)) return;
    let raf = 0, previous = performance.now();
    const tick = () => {
      const now = performance.now(), dt = Math.min(.1, (now - previous) / 1000); previous = now;
      if (!document.hidden) { clock.current = Math.min(DEPLOYMENT_DURATION, clock.current + dt * rate); setTime(clock.current); }
      if (clock.current >= DEPLOYMENT_DURATION) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    const visibility = () => { previous = performance.now(); };
    document.addEventListener('visibilitychange', visibility); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); };
  }, [playing, ready, failed, rate, narration, speech.loading, speech.failed]);
  useEffect(() => {
    const sync = () => { const next = parseDeploymentHash(location.hash); clock.current = next.time; setTime(next.time); setCamera(next.camera); setSatellite(next.satellite); setPlaying(false); setSeekVersion(v => v + 1); scene.current?.reset(); };
    window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [notice]);
  function seek(value: number) { clock.current = clampDeploymentTime(value); setTime(clock.current); setPlaying(false); setSeekVersion(v => v + 1); }
  function toggle() { if (time >= DEPLOYMENT_DURATION) seek(0); setPlaying(p => !p); }
  async function shareMoment() {
    const url = new URL(location.href); url.hash = deploymentHash(time, camera, satellite); history.replaceState(null, '', url); setShareUrl(url.href);
    try { await navigator.clipboard.writeText(url.href); setNotice('部署时刻链接已复制'); }
    catch { setPlaying(false); share.current?.showModal(); }
  }
  return <section className="mission-workspace deployment-workspace" aria-label="卫星部署概念演示">
    <audio ref={speech.audio} hidden preload="auto" data-testid="deployment-audio"/>
    <div className="mission-topbar"><div><div className="mission-panel-eyebrow">轨道任务 / 概念</div><h1>卫星部署 <span>轨道任务示意</span></h1></div><div className="mission-identity"><span><i/>独立概念 · 非历史复盘</span><small>货运星舰 / 三颗示意卫星</small></div><label className="mission-picker"><select aria-label="任务选择" value="deployment" onChange={e => { location.hash = e.target.value === 'overview' ? 'mission/flight-5/overview' : e.target.value === 'capture' ? 'mission/flight-5' : 'launch'; }}><option value="deployment">卫星部署 · 概念</option><option value="overview">Flight 5 · 全程航迹</option><option value="capture">Flight 5 · 捕获特写</option><option value="concept">综合流程 · 概念演示</option></select></label><button className="tool mission-evidence-button" aria-label="查看部署资料" title="部署资料" onClick={() => { setPlaying(false); evidence.current?.showModal(); }}><FileText size={18}/></button></div>
    <div className="mission-body"><div className="mission-viewer">
      <div className="mission-viewbar"><label><Camera size={14}/><select aria-label="部署视角" value={camera} onChange={e => { setCamera(e.target.value as DeploymentCamera); scene.current?.reset(); }}>{deploymentCameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="deployment-target"><Satellite size={14}/><select aria-label="跟随卫星" disabled={camera !== 'satellite'} value={satellite} onChange={e => { setSatellite(Number(e.target.value)); scene.current?.reset(); }}>{[0, 1, 2].map(i => <option value={i} key={i}>{`0${i + 1}`}</option>)}</select></label><div className="mission-view-actions"><button className="tool" aria-label="分享部署时刻" title="分享时刻" onClick={() => void shareMoment()}><Share2 size={17}/></button><button className="tool" aria-label="部署全屏" title="全屏" onClick={onFullscreen}><Maximize size={17}/></button></div></div>
      <div className="mission-stage deployment-stage return-stage">
        <DeploymentScene ref={scene} time={time} camera={camera} satellite={satellite} onReady={() => setReady(true)} onError={() => { setFailed(true); setPlaying(false); }}/>
        <div className="overview-clock"><small>轨道任务 · 概念</small><output>{stamp(time)}</output></div><div className="overview-legend"><span>主机关闭</span><span>出舱完成 {state.cleared} / 3</span></div>
        <div className="mission-scene-tools"><button className="tool" aria-label="部署放大" title="放大" onClick={() => scene.current?.zoom(.85)}><Plus size={16}/></button><button className="tool" aria-label="部署缩小" title="缩小" onClick={() => scene.current?.zoom(1.18)}><Minus size={16}/></button><button className="tool" aria-label="重置部署视角" title="重置视角" onClick={() => scene.current?.reset()}><RotateCcw size={16}/></button></div>
        <span className="overview-render-note">结构与释放时序为示意 · 非 Flight 5</span>
      </div>
      <div className="deployment-payloads">{state.satellites.map(s => <div key={s.index}><Satellite size={14}/><span>卫星 0{s.index + 1}</span><strong>{s.panels >= 1 ? '太阳翼展开' : s.panels > 0 ? '正在展开' : s.cleared ? '已释放' : s.released ? '出舱中' : '舱内待命'}</strong></div>)}</div>
      <div className="mission-caption deployment-caption"><div><span className="mission-panel-eyebrow">阶段 {index + 1} / 6</span><h2 data-testid="deployment-phase">{phase.name}</h2></div><p>{captions ? phase.text : '轨道卫星部署 · 教学示意'}</p></div>
      <div className="mission-transport"><div className="mission-play-row"><button className="mission-play" disabled={!ready || failed} aria-label={playing ? '暂停卫星部署' : time >= DEPLOYMENT_DURATION ? '重播卫星部署' : '播放卫星部署'} title={playing ? '暂停' : '播放'} onClick={toggle}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button><div className="mission-time"><output>{stamp(time)}</output><small>/ 02:00</small></div><input type="range" aria-label="卫星部署进度" aria-valuetext={`${stamp(time)}，${phase.name}`} min="0" max={DEPLOYMENT_DURATION} step="0.1" value={time} onChange={e => seek(Number(e.target.value))} style={{ '--progress': `${time / DEPLOYMENT_DURATION * 100}%` } as CSSProperties}/><select aria-label="部署播放速度" value={rate} onChange={e => setRate(Number(e.target.value))}><option value="0.5">0.5 倍</option><option value="1">1 倍</option><option value="2">2 倍</option></select><button className="tool" aria-label="回到部署开头" title="回到开头" onClick={() => seek(0)}><RotateCcw size={16}/></button></div>
        <ol className="overview-events deployment-events" aria-label="部署阶段">{deploymentPhases.map((p, i) => <li key={p.start}><button aria-label={`跳转${p.name}`} aria-current={index === i ? 'step' : undefined} onClick={() => seek(p.start)}><span>0{i + 1}</span><strong>{p.name}</strong><small>{stamp(p.start)}</small></button></li>)}</ol>
        <div className="mission-audio-row"><span>120 秒 / 示意时钟</span><div><button className="tool" aria-label="部署中文解说" title={available ? '中文解说' : '此部署未生成音频'} disabled={!available} aria-pressed={narration} onClick={() => setNarration(v => !v)}>{narration ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button><select aria-label="部署解说音色" disabled={!available} value={voice} onChange={e => setVoice(e.target.value as Narrator)}><option value="yunxi">云希 · 男声</option><option value="xiaoxiao">晓晓 · 女声</option></select><button className="tool" aria-label="部署解说字幕" title="字幕" aria-pressed={captions} onClick={() => setCaptions(v => !v)}><Captions size={18}/></button></div></div>
        <div className="mission-audio-status" role="status">{speech.failed ? '解说播放失败，字幕与三维仍可用。' : speech.loading ? '解说音频缓冲中…' : notice || (!available ? '此部署未生成卫星解说音频。' : '')}</div>
      </div>
    </div><aside className="mission-evidence" aria-label="卫星部署资料"><div className="overview-evidence-heading"><FileText size={15}/>原理与参考</div><Evidence/></aside></div>
    <dialog ref={evidence} className="mission-evidence-dialog"><div className="mission-dialog-heading"><strong>卫星部署 / 原理与参考</strong><button className="tool" aria-label="关闭部署资料" onClick={() => evidence.current?.close()}><X size={19}/></button></div><Evidence/></dialog>
    <dialog ref={share} className="mission-share-dialog"><div className="mission-dialog-heading"><strong>当前部署时刻</strong><button className="tool" aria-label="关闭部署分享" onClick={() => share.current?.close()}><X size={19}/></button></div><input aria-label="部署时刻链接" readOnly value={shareUrl} onFocus={e => e.target.select()}/></dialog>
  </section>;
}
