import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Camera, Captions, Check, ChevronRight, Crosshair, Maximize, Minus, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import LaunchScene, { type LaunchSceneHandle } from './LaunchScene';
import { cameraModes, formatLaunchTime, LAUNCH_DURATION, launchPhases, phaseAt, type CameraMode } from './launch-timeline';
import { useNarration, type Narrator } from './useNarration';

export default function LaunchView({ onFullscreen }: { onFullscreen: () => void }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [following, setFollowing] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('cinematic');
  const audioAvailable = Boolean(import.meta.env.NARRATION_AUDIO_AVAILABLE);
  const [narration, setNarration] = useState(audioAvailable);
  const [voice, setVoice] = useState<Narrator>('yunxi');
  const [captions, setCaptions] = useState(false);
  const [seekVersion, setSeekVersion] = useState(0);
  const phaseList = useRef<HTMLOListElement>(null);
  const scene = useRef<LaunchSceneHandle>(null);
  const clock = useRef(0);
  const phaseIndex = phaseAt(time), phase = launchPhases[phaseIndex];
  const speech = useNarration(narration, playing, time, rate, seekVersion, voice);
  useEffect(() => { phaseList.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [phaseIndex]);
  useEffect(() => {
    if (!playing || !ready || failed || (narration && speech.loading && !speech.failed)) return;
    let id = 0, previous = performance.now();
    const frame = () => {
      // A queued rAF timestamp can precede the effect that started playback.
      const now = performance.now();
      const dt = (now - previous) / 1000; previous = now;
      if (!document.hidden) { clock.current = Math.min(LAUNCH_DURATION, clock.current + dt * rate); setTime(clock.current); }
      if (clock.current >= LAUNCH_DURATION) { setPlaying(false); return; }
      id = requestAnimationFrame(frame);
    };
    const visibility = () => { previous = performance.now(); };
    document.addEventListener('visibilitychange', visibility);
    id = requestAnimationFrame(frame); return () => { cancelAnimationFrame(id); document.removeEventListener('visibilitychange', visibility); };
  }, [playing, rate, ready, failed, narration, speech.loading, speech.failed]);
  function seek(next: number) {
    const value = Math.min(LAUNCH_DURATION, Math.max(0, next)); clock.current = value; setTime(value); setPlaying(false); setFollowing(true); setSeekVersion(v => v + 1);
  }
  function togglePlay() {
    if (time >= LAUNCH_DURATION) { clock.current = 0; setTime(0); setFollowing(true); setSeekVersion(v => v + 1); }
    setPlaying(p => !p);
  }
  function resetCamera() { setFollowing(true); scene.current?.reset(); }
  return <section className="launch-workspace" aria-label="发射演示">
    <audio ref={speech.audio} preload="auto" data-testid="narration-audio" hidden/>
    <aside className="launch-sidebar" aria-label="发射阶段">
      <div className="launch-intro"><div className="eyebrow">星舰 / 完整飞行流程</div><h1>从发射到返回</h1><p>助推器捕获 · 海上平台概念着陆</p><span className="version-badge"><span/> 十二个飞行阶段</span></div>
      <ol ref={phaseList} className="launch-phases">{launchPhases.map((item, i) => <li key={item.start}><button aria-current={phaseIndex === i ? 'step' : undefined} className={phaseIndex === i ? 'current' : i < phaseIndex ? 'complete' : ''} onClick={() => seek(item.start)} aria-label={`跳转到${item.name}`}><span className="phase-step">{i < phaseIndex ? <Check size={12}/> : String(i + 1).padStart(2, '0')}</span><span className="phase-name">{item.name}<small>{formatLaunchTime(item.start)} · {item.focus}</small></span><ChevronRight size={13}/></button></li>)}</ol>
      <div className="launch-phase-detail" aria-live="polite"><div className="eyebrow">当前阶段 · {String(phaseIndex + 1).padStart(2, '0')}</div><h2>{phase.name}</h2><p>{phase.description}</p><dl><div><dt>观察重点</dt><dd>{phase.focus}</dd></div><div><dt>推进状态</dt><dd>{phase.propulsion}</dd></div></dl></div>
      <p className="launch-disclaimer">流程重建，非某次真实任务。时间、航程与地球比例经压缩；星舰平台着陆及支架为未验证的概念设计。</p>
    </aside>
    <div className="launch-main">
      <div className="launch-scene-area">
        <LaunchScene ref={scene} time={time} following={following} cameraMode={cameraMode} onReady={() => setReady(true)} onError={() => { setFailed(true); setPlaying(false); }} onOrbit={() => setFollowing(false)}/>
        <div className="launch-scene-heading"><span className="launch-badge"><span className="status-dot"/>{failed ? '三维不可用' : !ready ? '正在加载' : playing ? '演示播放中' : time === LAUNCH_DURATION ? '演示结束' : '演示已暂停'}</span><span className="launch-scene-clock" data-testid="launch-time">{formatLaunchTime(time)}<small> / {formatLaunchTime(LAUNCH_DURATION)}</small></span></div>
        <label className="launch-camera"><Camera size={14}/><select aria-label="发射视角" value={cameraMode} onChange={e => { setCameraMode(e.target.value as CameraMode); setFollowing(true); scene.current?.reset(); }}>{cameraModes.map(mode => <option key={mode.id} value={mode.id}>{mode.name}</option>)}</select></label>
        <div className={`launch-stage-caption${captions ? ' with-narration' : ''}`}><span>第 {phaseIndex + 1} 阶段 / {launchPhases.length} · {phase.focus}</span><h2 data-testid="launch-phase-title">{phase.name}</h2><p>{captions ? phase.narration : phase.propulsion}</p></div>
        <div className="vertical-tools launch-tools" aria-label="发射视角工具">
          <button className="tool" aria-label="发射视图放大" title="放大" onClick={() => scene.current?.zoom(.85)}><Plus size={17}/><span className="tooltip">放大</span></button>
          <button className="tool" aria-label="发射视图缩小" title="缩小" onClick={() => scene.current?.zoom(1.18)}><Minus size={17}/><span className="tooltip">缩小</span></button>
          <span className="tool-divider"/>
          <button className="tool" aria-label="重置发射视角" title="重置视角" onClick={resetCamera}><Crosshair size={17}/><span className="tooltip">重置视角</span></button>
          <button className="tool" aria-label="发射视图全屏" title="全屏" onClick={onFullscreen}><Maximize size={17}/><span className="tooltip">全屏</span></button>
        </div>
        {cameraMode === 'earth' && <div className="launch-map-key"><span>星舰轨迹</span><span>助推器轨迹</span></div>}
        <span className="launch-scene-note">综合流程示意 · 非真实遥测</span>
      </div>
      <div className="launch-controls" aria-label="发射播放控制">
        <div className="launch-playback-row">
          <button className="launch-play" disabled={!ready || failed} aria-label={playing ? '暂停发射演示' : time === LAUNCH_DURATION ? '重播发射演示' : '播放发射演示'} title={playing ? '暂停' : time === LAUNCH_DURATION ? '重播' : '播放'} onClick={togglePlay}>{playing ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}</button>
          <div className="launch-seek-controls"><button className="tool" aria-label="上一发射阶段" title="上一阶段" disabled={phaseIndex === 0} onClick={() => seek(launchPhases[Math.max(0, phaseIndex - 1)].start)}><SkipBack size={16}/></button><button className="tool" aria-label="下一发射阶段" title="下一阶段" disabled={phaseIndex === launchPhases.length - 1} onClick={() => seek(launchPhases[Math.min(launchPhases.length - 1, phaseIndex + 1)].start)}><SkipForward size={16}/></button></div>
          <div className="launch-scrubber"><input type="range" min="0" max={LAUNCH_DURATION} step="0.1" value={time} aria-label="发射演示进度" aria-valuetext={`${formatLaunchTime(time)}，${phase.name}`} onChange={e => seek(Number(e.target.value))} style={{ '--progress': `${time / LAUNCH_DURATION * 100}%` } as CSSProperties}/><div className="launch-ticks" aria-hidden="true">{launchPhases.filter((_, i) => [0, 4, 7, 9, 11].includes(i)).map(p => <span key={p.start} style={{ left: `${p.start / LAUNCH_DURATION * 100}%` }}>{p.short}</span>)}</div></div>
          <button className="tool" aria-label="从头开始发射演示" title="从头开始" onClick={() => { seek(0); scene.current?.reset(); }}><RotateCcw size={17}/></button>
        </div>
        <div className="launch-options"><label className="toggle"><input type="checkbox" checked={following} onChange={e => setFollowing(e.target.checked)}/><span className="switch"/><span>跟随镜头</span></label><label className="launch-speed"><span>播放速度</span><select value={rate} onChange={e => setRate(Number(e.target.value))} aria-label="发射演示播放速度"><option value="0.5">0.5 倍</option><option value="1">1 倍</option><option value="2">2 倍</option></select></label><div className="launch-audio"><button className="tool" aria-label="中文语音解说" aria-pressed={narration} disabled={!audioAvailable} title={audioAvailable ? '中文语音解说' : '此部署尚未生成解说音频'} onClick={() => setNarration(v => !v)}>{narration ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button><select className="narrator-select" aria-label="解说音色" value={voice} disabled={!audioAvailable} onChange={e => setVoice(e.target.value as Narrator)}><option value="yunxi">云希 · 男声</option><option value="xiaoxiao">晓晓 · 女声</option></select><button className="tool" aria-label="解说字幕" aria-pressed={captions} title="解说字幕" onClick={() => setCaptions(v => !v)}><Captions size={18}/></button></div><span className="launch-duration">流程重建 · 02:46</span></div>
        <div className="launch-speech-status" role="status" aria-atomic="true">
          <span>{speech.failed ? '解说音频未能播放，字幕仍可用。' : speech.loading ? '解说音频缓冲中…' : ''}</span>
          {speech.failed && <button onClick={() => setNarration(false)}>关闭解说</button>}
        </div>
      </div>
    </div>
  </section>;
}
