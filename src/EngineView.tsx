import { useRef, useState, type CSSProperties } from 'react';
import { ArrowDownToLine, ArrowLeft, Crosshair, Minus, Orbit, Plus, RotateCcw, ScanLine } from 'lucide-react';
import RocketScene, { type SceneHandle } from './RocketScene';
import { engineComponents } from './raptor-model';

export default function EngineView({ onClose }: { onClose: () => void }) {
  const scene = useRef<SceneHandle>(null);
  const [variant, setVariant] = useState<'sea'|'vacuum'>('sea');
  const [component, setComponent] = useState<number|null>(null);
  const [only, setOnly] = useState(false);
  const [explode, setExplode] = useState(0);
  const [cutaway, setCutaway] = useState(false);
  const [rotate, setRotate] = useState(false);
  const selected = component === null ? null : engineComponents[component];
  return <section className="engine-workspace" aria-label="猛禽发动机精查">
    <header className="engine-heading"><button className="source-button" onClick={onClose}><ArrowLeft size={16}/>返回箭体</button><h1>猛禽发动机</h1><div className="mode-switch" role="group" aria-label="发动机构型"><button aria-pressed={variant==='sea'} className={variant==='sea'?'active':''} onClick={()=>setVariant('sea')}>海平面型</button><button aria-pressed={variant==='vacuum'} className={variant==='vacuum'?'active':''} onClick={()=>setVariant('vacuum')}>真空型</button></div></header>
    <div className="engine-body">
      <div className="engine-stage">
        <RocketScene ref={scene} mode="stack" selected={null} isolated={false} explode={explode} cutaway={cutaway} labels={false} rotate={rotate} onSelect={()=>{}} onReady={()=>{}} engine={variant} component={component} componentOnly={only} onComponent={setComponent}/>
        <span className="engine-caption">{only && selected ? selected.name : '全流量分级燃烧 · 结构示意'}</span>
        <div className="vertical-tools" aria-label="发动机视角工具">
          <button className="tool" title="放大" aria-label="发动机放大" onClick={()=>scene.current?.zoom(.8)}><Plus size={17}/></button>
          <button className="tool" title="缩小" aria-label="发动机缩小" onClick={()=>scene.current?.zoom(1.25)}><Minus size={17}/></button>
          <button className="tool" title="重置视角" aria-label="重置发动机视角" onClick={()=>scene.current?.reset()}><RotateCcw size={17}/></button>
          <button className="tool" title="自动旋转" aria-label="发动机自动旋转" aria-pressed={rotate} onClick={()=>setRotate(v=>!v)}><Orbit size={17}/></button>
          <button className="tool" title="导出图片" aria-label="导出发动机图片" onClick={()=>scene.current?.snapshot()}><ArrowDownToLine size={17}/></button>
        </div>
        <label className="view-selector"><Crosshair size={14}/><select aria-label="发动机观察视角" onChange={e=>e.target.value==='perspective'?scene.current?.reset():scene.current?.view(e.target.value as 'front'|'side'|'bottom')}><option value="perspective">透视视图</option><option value="front">正视图</option><option value="side">侧视图</option><option value="bottom">喷管内部</option></select></label>
      </div>
      <aside className="engine-inspector" aria-label="发动机组件">
        <div className="eyebrow">组件 / 08</div>
        <div className="engine-parts">{engineComponents.map((item,index)=><button key={item.name} aria-pressed={component===index} onClick={()=>setComponent(index)}><i style={{background:item.color}}/><span>{item.name}</span><small>{String(index+1).padStart(2,'0')}</small></button>)}</div>
        <div className="engine-description"><h2>{selected?.name ?? '双路推进系统'}</h2><p>{selected?.description ?? '液氧与甲烷分别经涡轮泵、预燃室进入主燃烧室，燃气通过喷管膨胀做功。'}</p></div>
        <label className="toggle"><input type="checkbox" checked={only} disabled={component===null} onChange={e=>setOnly(e.target.checked)}/><span className="switch"/>仅显示选中组件</label>
        <p className="engine-disclaimer">公开外观与循环原理重建，非 Raptor 3 实物复刻。泵内叶片、孔数、尺寸和外显管路均为示意。</p>
        <a className="text-link" href="https://en.wikipedia.org/wiki/SpaceX_Raptor" target="_blank" rel="noreferrer">猛禽外观与循环参考</a>
      </aside>
    </div>
    <footer className="engine-dock"><label>组件展开 <output>{explode}%</output><input aria-label="发动机拆解程度" type="range" min="0" max="100" value={explode} style={{'--progress':`${explode}%`} as CSSProperties} onChange={e=>setExplode(Number(e.target.value))}/></label><label className="toggle"><input type="checkbox" checked={cutaway} onChange={e=>setCutaway(e.target.checked)}/><span className="switch"/><ScanLine size={15}/>内部剖面</label></footer>
  </section>;
}
