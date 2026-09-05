import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpRight, Box, ChevronRight, CircleDot, Crosshair, Expand, Eye, FileText, Layers3, Maximize, Minus, Orbit, Plus, RotateCcw, Rocket, ScanLine, Search, SlidersHorizontal, X } from 'lucide-react';
import RocketScene, { type SceneHandle } from './RocketScene';
import LaunchView from './LaunchView';
import EngineView from './EngineView';
import { parts, sourceUrl, type PartId, type VehicleMode } from './parts';

const referencesAvailable = Boolean(import.meta.env.REFERENCE_ASSETS_AVAILABLE);
const referencePdf = referencesAvailable ? '/references/faa-starship-reentry-2023.pdf#page=39' : 'https://www.faa.gov/media/27236#page=39';

function Tool({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={`tool ${active ? 'active' : ''}`} aria-label={label} title={label} aria-pressed={active} onClick={onClick}>{children}<span className="tooltip">{label}</span></button>;
}

export default function App() {
  const [experience, setExperience] = useState<'structure' | 'launch'>(() => location.hash === '#launch' ? 'launch' : 'structure');
  const [mode, setMode] = useState<VehicleMode>('stack');
  const [selected, setSelected] = useState<PartId | null>(null);
  const [explode, setExplode] = useState(0);
  const [isolated, setIsolated] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [labels, setLabels] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [ready, setReady] = useState(false);
  const [engineOpen, setEngineOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [detailTab, setDetailTab] = useState<'overview' | 'principle'>('overview');
  const [mobilePanel, setMobilePanel] = useState<'parts' | 'detail' | null>(null);
  const [view, setView] = useState('perspective');
  const [notice, setNotice] = useState('');
  const scene = useRef<SceneHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const sourceDialog = useRef<HTMLDialogElement>(null);
  const part = parts.find(p => p.id === selected);
  useEffect(() => {
    const sync = () => setExperience(location.hash === '#launch' ? 'launch' : 'structure');
    window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, []);
  const filtered = parts.filter(p => (mode === 'stack' || p.stage === mode) && `${p.name} ${p.english}`.toLowerCase().includes(query.toLowerCase()));
  function select(id: PartId) { setSelected(id); setDetailTab('overview'); setMobilePanel('detail'); }
  function changeMode(next: VehicleMode) { setMode(next); setIsolated(false); setSelected(null); setExplode(0); setQuery(''); setView('perspective'); setMobilePanel(null); scene.current?.reset(); }
  function reset() { setExplode(0); setIsolated(false); setCutaway(false); setRotate(false); setView('perspective'); scene.current?.reset(); }
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else setNotice('当前浏览器不支持全屏'); }
    catch { setNotice('当前浏览器未能进入全屏'); }
  }
  return <main className={`studio${experience === 'launch' ? ' launch-experience' : ''}`} ref={root}>
    <header className="app-header">
      <a className="brand" href="/" aria-label="星舰工作室首页"><Orbit size={24} strokeWidth={1.4}/><span>星舰<span className="brand-sub">工作室</span></span></a>
      <nav className="experience-tabs" aria-label="工作室模式"><a href="#structure" aria-current={experience === 'structure' ? 'page' : undefined}><Layers3 size={15}/>结构探索</a><a href="#launch" aria-current={experience === 'launch' ? 'page' : undefined}><Rocket size={15}/>发射演示</a></nav>
      <button className="source-button" onClick={() => sourceDialog.current?.showModal()}><FileText size={15}/><span>参考图纸</span><ArrowUpRight size={13}/></button>
    </header>

    {experience === 'launch' ? <LaunchView onFullscreen={fullscreen}/> : engineOpen ? <EngineView onClose={()=>setEngineOpen(false)}/> : <><div className="workspace">
      <aside className={`catalog ${mobilePanel === 'parts' ? 'mobile-open' : ''}`} aria-label="部件目录">
        <div className="catalog-intro"><div className="eyebrow">SpaceX / 运载火箭研究</div><h1>星舰</h1><div className="vehicle-subtitle">星舰 · 超级重型运载系统</div><span className="version-badge"><span/> 第三代（V3）构型参考</span><button className="mobile-close tool" aria-label="关闭部件目录" onClick={() => setMobilePanel(null)}><X size={18}/></button></div>
        <div className="catalog-heading"><span>系统部件</span><span className="mono">{String(filtered.length).padStart(2, '0')}</span></div>
        <label className="search-field"><Search size={14}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索部件" aria-label="搜索部件"/>{query && <button aria-label="清除搜索" onClick={() => setQuery('')}><X size={13}/></button>}</label>
        <div className="parts-list">
          {(['ship', 'booster'] as const).map(stage => {
            const stageParts = filtered.filter(p => p.stage === stage);
            return stageParts.length > 0 && <section className="part-section" key={stage}><h2><span className={`stage-dot ${stage}`}/>{stage === 'ship' ? '星舰' : '超级重型'}<small>{stage === 'ship' ? '上面级' : '助推器'}</small></h2>
              {stageParts.map(p => <button className={`part-row ${selected === p.id ? 'selected' : ''}`} key={p.id} onClick={() => select(p.id)} aria-pressed={selected === p.id} data-testid={`part-${p.id}`}><span className="part-number">{String(parts.indexOf(p) + 1).padStart(2, '0')}</span><span>{p.name}</span><ChevronRight size={13}/></button>)}
            </section>;
          })}
          {filtered.length === 0 && <p className="empty-state">没有匹配的部件</p>}
        </div>
        <div className="catalog-footer"><span className="tiny-cross">+</span><div>得克萨斯州 · 星港基地<span className="mono">北纬 25.997° / 西经 97.157°</span></div><span className="tiny-cross">+</span></div>
      </aside>

      <section className="viewport" aria-label="星舰三维工作区">
        <div className="viewport-top"><div className="mode-switch" role="group" aria-label="火箭级段">{([['stack', '整箭'], ['ship', '星舰'], ['booster', '助推器']] as const).map(([id, label]) => <button key={id} aria-pressed={mode === id} className={mode === id ? 'active' : ''} onClick={() => changeMode(id)}>{id === 'stack' && <Layers3 size={13}/>} {label}</button>)}</div><span className="viewport-status"><span className="status-dot"/>{ready ? '三维就绪' : '正在加载'}</span></div>
        <div className="scene-area">
          <RocketScene ref={scene} mode={mode} selected={selected} explode={explode} isolated={isolated} cutaway={cutaway} labels={labels} rotate={rotate} onSelect={select} onReady={() => setReady(true)}/>
          <div className="scene-meta"><span className="cross-mark">+</span><span>{isolated ? '部件视图' : cutaway ? '内部剖面' : explode > 0 ? '拆解视图' : '组装视图'}</span><span className="scene-submeta">{mode === 'stack' ? '星舰 / 超级重型助推器' : mode === 'ship' ? '星舰' : '超级重型'}</span></div>
          <div className="dimension-label"><span>{isolated ? '部件' : mode === 'stack' ? '124 米' : mode === 'ship' ? '52 米' : '72 米'}</span><i/><span>{isolated ? '独立查看' : '标称高度'}</span></div>
          <div className="vertical-tools" aria-label="视角工具">
            <Tool label="放大" onClick={() => scene.current?.zoom(.8)}><Plus size={17}/></Tool>
            <Tool label="缩小" onClick={() => scene.current?.zoom(1.25)}><Minus size={17}/></Tool>
            <span className="tool-divider"/>
            <Tool label="重置视图" onClick={reset}><RotateCcw size={16}/></Tool>
            <Tool label="自动旋转" active={rotate} onClick={() => setRotate(!rotate)}><Orbit size={17}/></Tool>
            <Tool label="全屏" onClick={fullscreen}><Maximize size={16}/></Tool>
            <Tool label="导出图片" onClick={() => scene.current?.snapshot()}><ArrowDownToLine size={16}/></Tool>
          </div>
          <div className="view-selector"><Crosshair size={13}/><select aria-label="相机视角" value={view} onChange={e => { setView(e.target.value); setRotate(false); if (e.target.value === 'perspective') scene.current?.reset(); else scene.current?.view(e.target.value as 'front' | 'side' | 'bottom'); }}><option value="perspective">透视视图</option><option value="front">正视图</option><option value="side">侧视图</option><option value="bottom">发动机底视图</option></select></div>
          <div className="scene-coordinates"><span className="axis axis-y">Y</span><span className="axis axis-z">Z</span><span className="axis axis-x">X</span></div>
          {isolated && <button className="return-button" onClick={() => setIsolated(false)}><Layers3 size={14}/>返回整体</button>}
        </div>
        <div className="assembly-dock">
          <div className="assembly-title"><SlidersHorizontal size={14}/><span>结构拆解</span><output className="mono" data-testid="explosion-value">{explode}<small>%</small></output></div>
          <div className="explosion-controls"><Tool label="完整组装" active={explode === 0 && !isolated} onClick={() => { setExplode(0); setIsolated(false); }}><Box size={19}/></Tool><div className="range-wrap"><input type="range" aria-label="拆解程度" min="0" max="100" value={explode} onChange={e => { setExplode(Number(e.target.value)); setIsolated(false); }} style={{ '--progress': `${explode}%` } as React.CSSProperties}/><div className="range-labels"><span>组装</span><span>部件展开</span></div></div><Tool label="全部展开" active={explode === 100} onClick={() => { setExplode(100); setIsolated(false); }}><Expand size={19}/></Tool></div>
          <div className="display-options"><label className="toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/><span className="switch"/><Eye size={13}/><span>部件标注</span></label><label className="toggle"><input type="checkbox" checked={cutaway} onChange={e => setCutaway(e.target.checked)}/><span className="switch"/><ScanLine size={13}/><span>内部剖面</span></label><span className="dock-code mono">构型 / 003</span></div>
        </div>
      </section>

      <aside className={`inspector ${mobilePanel === 'detail' ? 'mobile-open' : ''}`} aria-label="部件详情">
        <div className="inspector-heading"><span>{part ? '部件详情' : '系统概览'}</span>{part ? <button className="tool" aria-label="关闭部件详情" onClick={() => { setSelected(null); setIsolated(false); setMobilePanel(null); }}><X size={16}/></button> : <span className="mono">概览</span>}</div>
        <div className="inspector-content" aria-live="polite">
          <div className="detail-icon">{part ? <Crosshair size={25} strokeWidth={1}/> : <Rocket size={25} strokeWidth={1}/>}</div>
          <div className="eyebrow">{part ? (part.stage === 'ship' ? '星舰上面级系统' : '超级重型助推器系统') : '完全可重复使用运载系统'}</div><h2>{part?.name ?? '星舰运载系统'}</h2>
          {part && <div className="detail-tabs" role="tablist" aria-label="部件说明"><button role="tab" aria-selected={detailTab === 'overview'} onClick={() => setDetailTab('overview')}>结构概览</button><button role="tab" aria-selected={detailTab === 'principle'} onClick={() => setDetailTab('principle')}>工作原理</button></div>}
          <p className="description">{part ? (detailTab === 'overview' ? part.description : part.principle) : '星舰与超级重型助推器组成两级运载系统，面向地球轨道、月球和火星任务，目标是实现完全、快速重复使用。'}</p>
          <dl className="specifications">{(part?.specs ?? [['整箭高度', '124 米'], ['箭体直径', '9 米'], ['复用载荷目标', '100 吨以上'], ['助推器发动机', '33 台猛禽发动机'], ['推进剂', '液氧 / 液态甲烷']]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {part && <button className={`isolate-button ${isolated ? 'active' : ''}`} onClick={() => setIsolated(!isolated)}>{isolated ? <Layers3 size={15}/> : <Crosshair size={15}/>} {isolated ? '返回整体' : '单独查看部件'}<ChevronRight size={14}/></button>}
          {(selected === 'ship-engines' || selected === 'booster-engines') && <button className="isolate-button" onClick={()=>{setEngineOpen(true);setMobilePanel(null);}}><Crosshair size={15}/>单台发动机精查<ChevronRight size={14}/></button>}
          <a className="text-link" href={sourceUrl} target="_blank" rel="noreferrer">SpaceX 官方资料<ArrowUpRight size={13}/></a>
        </div>
        <div className="reference-preview"><div className="section-caption"><FileText size={13}/>结构参考<span>01</span></div>{referencesAvailable ? <button className="drawing-preview" onClick={() => sourceDialog.current?.showModal()} aria-label="打开星舰结构参考图"><img src="/references/starship-internal-structure.jpg" alt="星舰内部结构图：发动机、液氧主箱、甲烷主箱、载荷区和头部贮箱"/><span>舱段与推进剂系统<Expand size={13}/></span></button> : <a className="text-link" href={referencePdf} target="_blank" rel="noreferrer"><FileText size={18}/>FAA 原始参考文件<ArrowUpRight size={13}/></a>}<p>公开结构图 · 早期构型参考</p></div>
        <div className="model-note"><CircleDot size={12}/><p>基于公开资料的独立结构示意。内部布局经过简化，非 SpaceX 官方工程模型。</p></div>
      </aside>
    </div>
    <nav className="mobile-nav" aria-label="移动端面板"><button aria-pressed={mobilePanel === 'parts'} onClick={() => setMobilePanel(mobilePanel === 'parts' ? null : 'parts')}><Layers3 size={17}/>部件目录</button><button aria-pressed={mobilePanel === 'detail'} onClick={() => setMobilePanel(mobilePanel === 'detail' ? null : 'detail')}><FileText size={17}/>{part ? '部件详情' : '系统概览'}</button></nav></>}
    <footer className="status-bar"><span><span className="status-dot"/> {experience === 'launch' ? '发射过程示意' : ready ? '模型已就绪' : '模型载入中'}</span><span>SpaceX 星舰<span className="footer-separator">/</span>独立工程研究</span><span>资料核对 · 2026.09</span></footer>
    {notice && <div className="toast" role="status">{notice}</div>}

    <dialog ref={sourceDialog} className="sources-dialog" onClick={e => { if (e.target === sourceDialog.current) sourceDialog.current.close(); }}>
      <div className="dialog-heading"><div><div className="eyebrow">参考资料库</div><h2>设计参考与资料来源</h2></div><button className="tool" aria-label="关闭参考资料" onClick={() => sourceDialog.current?.close()}><X size={20}/></button></div>
      {referencesAvailable && <figure className="reference-figure"><img src="/references/starship-internal-structure.jpg" alt="星舰内部结构参考图，展示燃料输送管、公共封头、液氧与甲烷主贮箱、载荷区及头部贮箱"/><figcaption>01 / 星舰内部结构图 · 美国联邦航空管理局（FAA） 公开文件第 39 页，图 2 · 2023 年早期构型</figcaption></figure>}
      <p className="reference-explanation">此图用于校准发动机、主贮箱、公共封头、载荷区与头部贮箱的相对关系。它不是 V3 制造图纸；当前模型的外形比例依据 SpaceX 现行官网，内部细节为示意。</p>
      <details className="diagram-glossary"><summary>原图标注中文对照</summary><dl>{[['Raptor Engines', '猛禽发动机'], ['Fuel Transfer Tube', '燃料输送管'], ['Common Dome', '公共封头'], ['Fuel Dome', '燃料舱封头'], ['Payload Region', '载荷区'], ['Fuel Header Tank', '燃料头部贮箱'], ['LOX Main Tank', '液氧主贮箱'], ['Fuel Main Tank', '燃料主贮箱'], ['LOX Header Feedline', '液氧头部贮箱供给管'], ['LOX Header Tank', '液氧头部贮箱'], ['Aft End', '尾段'], ['Nose', '头锥'], ['9m Diameter', '直径 9 米']].map(([term, translation]) => <div key={term}><dt>{term}</dt><dd>{translation}</dd></div>)}</dl></details>
      <div className="reference-links">
        <a href={sourceUrl} target="_blank" rel="noreferrer"><span className="source-index">01</span><div><strong>SpaceX · 星舰官方规格</strong><p>124 米 整箭 / 52 米 星舰 / 72 米 助推器 / 9 米 直径</p></div><ArrowUpRight size={18}/></a>
        <a href={referencePdf} target="_blank" rel="noreferrer"><span className="source-index">02</span><div><strong>美国联邦航空管理局 · 星舰结构原图</strong><p>原始 PDF，第 39 页图 2；含专有资料标记，不属于本项目开源授权</p></div><ArrowUpRight size={18}/></a>
        <a href="https://www.faa.gov/media/94346" target="_blank" rel="noreferrer"><span className="source-index">03</span><div><strong>美国联邦航空管理局 · 2025 年最终环境评估</strong><p>表 2：构型规格及未来扩展评估参数，非 V3 实物尺寸</p></div><ArrowUpRight size={18}/></a>
        <a href="https://en.wikipedia.org/wiki/SpaceX_Starship#Block_3" target="_blank" rel="noreferrer"><span className="source-index">04</span><div><strong>第三代（V3）· 公开构型资料</strong><p>三片栅格翼、一体式热分离区域与第三代猛禽发动机</p></div><ArrowUpRight size={18}/></a>
        <a href="/textures/README.md" target="_blank" rel="noreferrer"><span className="source-index">05</span><div><strong>NASA · 地球底图与云层素材</strong><p>Blue Marble 地表合成图；云层与反光贴图来源见素材记录</p></div><ArrowUpRight size={18}/></a>
        <a href="/narration/subtitles.srt" download><span className="source-index">06</span><div><strong>中文解说稿 · 段级字幕</strong><p>十二个飞行阶段，166 秒演示时间轴，SRT 字幕文件</p></div><ArrowDownToLine size={18}/></a>
      </div>
      <div className="reference-footnote">原图通过 维基共享资源 获取，已与 FAA 原始 PDF 核对。原页含 SpaceX 专有资料标记，不能据此认定为开放授权图纸。模型的瓦片数量、喷管内部、管路和壁厚为简化示意。</div>
    </dialog>
  </main>;
}
