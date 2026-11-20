'use client';
import React,{useEffect,useState} from 'react';

type Props={selectionKey:string; onCommit:(styles:Record<string,string|null>)=>void; onPreview:(styles:Record<string,string|null>)=>void};
type LogicConfig={trigger:string;action:string;target:string;condition:string;value:string;enabled:boolean};
const logicDefaults:LogicConfig={trigger:'click',action:'toggle',target:'',condition:'always',value:'',enabled:false};
const animations=[{name:'Fade In',key:'fade-in',css:'opacity 0.01'},{name:'Slide Up',key:'slide-up',css:'translateY(24px)'},{name:'Zoom In',key:'zoom-in',css:'scale(0.92)'},{name:'Float',key:'float',css:'translateY(-8px)'},{name:'Pulse',key:'pulse',css:'scale(1.04)'},{name:'None',key:'none',css:''}];
export default function ProStudioToolkit({selectionKey,onCommit,onPreview}:Props){
 const [tab,setTab]=useState<'canvas'|'logic'|'motion'>('canvas');
 const [layout,setLayout]=useState({width:'auto',height:'auto',minWidth:'',maxWidth:'',minHeight:'',maxHeight:'',display:'block',position:'static',top:'',right:'',bottom:'',left:'',zIndex:'auto',gap:'0px',padding:'0px',margin:'0px',alignItems:'stretch',justifyContent:'start',flexDirection:'column',gridColumns:'1'});
 const [logic,setLogic]=useState<LogicConfig>(logicDefaults);
 const [motion,setMotion]=useState({preset:'None',duration:500,delay:0,easing:'ease',loop:false});
 const key='webd_pro_studio_logic_v1:'+selectionKey;
 useEffect(()=>{try{const raw=localStorage.getItem(key);setLogic(raw?{...logicDefaults,...JSON.parse(raw)}:logicDefaults)}catch{setLogic(logicDefaults)}},[key]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(logic))}catch{}},[logic,key]);
 const applyLayout=()=>onCommit({width:layout.width,height:layout.height,minWidth:layout.minWidth||null,maxWidth:layout.maxWidth||null,minHeight:layout.minHeight||null,maxHeight:layout.maxHeight||null,display:layout.display,position:layout.position,top:layout.top||null,right:layout.right||null,bottom:layout.bottom||null,left:layout.left||null,zIndex:layout.zIndex,gap:layout.gap,padding:layout.padding,margin:layout.margin,alignItems:layout.alignItems,justifyContent:layout.justifyContent,flexDirection:layout.display==='flex'?layout.flexDirection:null,gridTemplateColumns:layout.display==='grid'?layout.gridColumns+'fr':null});
 const fields=(obj:any,set:(v:any)=>void,keys:string[])=>keys.map(k=><label key={k} className="text-[11px] text-slate-600 capitalize">{k.replace(/([A-Z])/g,' $1')}<input value={obj[k]??''} onChange={e=>set({...obj,[k]:e.target.value})} className="mt-1 h-8 w-full rounded border bg-white px-2 text-xs" /></label>);
 return <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
 <header className="flex items-center justify-between"><div><h3 className="text-xs font-bold text-slate-800">Pro Studio Toolkit</h3><p className="text-[10px] text-slate-500">Advanced visual controls</p></div></header>
 <div className="grid grid-cols-3 rounded-lg border bg-slate-100 p-0.5" role="tablist">{(['canvas','logic','motion'] as const).map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)} className={`rounded-md py-1.5 text-[11px] capitalize ${tab===t?'bg-white font-semibold shadow-sm text-slate-900':'text-slate-500'}`}>{t==='canvas'?'Layout':t==='logic'?'Logic':'Motion'}</button>)}</div>
 {tab==='canvas'&&<div className="space-y-3">
 <div className="grid grid-cols-2 gap-2">{fields(layout,setLayout,['width','height','minWidth','maxWidth','minHeight','maxHeight'])}</div>
 <div className="grid grid-cols-2 gap-2">
 {(['display','position','flexDirection','alignItems','justifyContent'] as const).map(k=><label key={k} className="text-[11px] text-slate-600 capitalize">{k.replace(/([A-Z])/g,' $1')}<select value={layout[k]} onChange={e=>setLayout({...layout,[k]:e.target.value})} className="mt-1 h-8 w-full rounded border bg-white px-1 text-xs">{(k==='display'?['block','flex','grid','inline-flex','inline-block','none']:k==='position'?['static','relative','absolute','fixed','sticky']:k==='flexDirection'?['row','row-reverse','column','column-reverse']:k==='alignItems'?['stretch','start','center','end','baseline']:['start','center','end','stretch','space-between','space-around']).map(v=><option key={v}>{v}</option>)}</select></label>)}
 </div>
 {layout.display==='grid'&&<label className="text-[11px] text-slate-600">Grid columns<input type="range" min="1" max="12" value={Number(layout.gridColumns)||1} onChange={e=>setLayout({...layout,gridColumns:e.target.value})} className="w-full"/><span>{layout.gridColumns} columns</span></label>}
 <div className="grid grid-cols-2 gap-2">{fields(layout,setLayout,['gap','padding','margin','top','right','bottom','left','zIndex'])}</div>
 <button onClick={applyLayout} className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white">Apply layout properties</button>
 <p className="text-[10px] text-slate-500">Units accepted: px, %, rem, vw, vh, auto. Use flex/grid to create flow-based layouts.</p>
 </div>}
 {tab==='logic'&&<div className="space-y-3">
 <div className="rounded-lg border bg-white p-3 text-center"><strong className="text-xs">Trigger</strong><select value={logic.trigger} onChange={e=>setLogic({...logic,trigger:e.target.value})} className="mt-1 h-8 w-full rounded border px-2 text-xs">{['click','double-click','hover','mouse-enter','mouse-leave','page-load','scroll-into-view','input-change','form-submit'].map(v=><option key={v}>{v}</option>)}</select></div>
 <div className="text-center text-slate-400">↓</div>
 <div className="rounded-lg border bg-white p-3"><strong className="text-xs">Condition</strong><select value={logic.condition} onChange={e=>setLogic({...logic,condition:e.target.value})} className="mt-1 h-8 w-full rounded border px-2 text-xs">{['always','equals','not-equals','contains','greater-than','less-than','is-empty','is-visible'].map(v=><option key={v}>{v}</option>)}</select><input value={logic.value} onChange={e=>setLogic({...logic,value:e.target.value})} placeholder="Condition value (optional)" className="mt-1 h-8 w-full rounded border px-2 text-xs"/></div>
 <div className="text-center text-slate-400">↓</div>
 <div className="rounded-lg border bg-white p-3"><strong className="text-xs">Action</strong><select value={logic.action} onChange={e=>setLogic({...logic,action:e.target.value})} className="mt-1 h-8 w-full rounded border px-2 text-xs">{['toggle','show','hide','navigate','open-url','open-modal','close-modal','change-text','change-image','scroll-to','set-variable','notification','submit-form','play-animation'].map(v=><option key={v}>{v}</option>)}</select><input value={logic.target} onChange={e=>setLogic({...logic,target:e.target.value})} placeholder="Target selector / route / value" className="mt-1 h-8 w-full rounded border px-2 text-xs"/></div>
 <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={logic.enabled} onChange={e=>setLogic({...logic,enabled:e.target.checked})}/> Enable this interaction rule</label>
 <button onClick={()=>{try{localStorage.setItem(key,JSON.stringify(logic));alert('Logic configuration saved locally for this element. Runtime execution/export integration is not yet connected.')}catch{alert('Could not save this configuration')}}} className="w-full rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white">Save Logic Configuration</button>
 <p className="text-[10px] text-amber-700">This is a persisted GUI rule builder. The configured rule is saved in this editor, but it does not yet execute in the exported site.</p>
 </div>}
 {tab==='motion'&&<div className="space-y-3">
 <label className="text-[11px] text-slate-600">Animation preset<select value={motion.preset} onChange={e=>setMotion({...motion,preset:e.target.value})} className="mt-1 h-8 w-full rounded border bg-white px-2 text-xs">{animations.map(a=><option key={a.name}>{a.name}</option>)}</select></label>
 <div className="grid grid-cols-2 gap-2"><label className="text-[11px] text-slate-600">Duration ({motion.duration}ms)<input type="range" min="100" max="3000" step="50" value={motion.duration} onChange={e=>setMotion({...motion,duration:Number(e.target.value})} className="w-full"/></label><label className="text-[11px] text-slate-600">Delay ({motion.delay}ms)<input type="range" min="0" max="2000" step="50" value={motion.delay} onChange={e=>setMotion({...motion,delay:Number(e.target.value})} className="w-full"/></label></div>
 <label className="text-[11px] text-slate-600">Easing<select value={motion.easing} onChange={e=>setMotion({...motion,easing:e.target.value})} className="mt-1 h-8 w-full rounded border bg-white px-2 text-xs">{['ease','linear','ease-in','ease-out','ease-in-out','cubic-bezier(0.2,0.8,0.2,1)'].map(v=><option key={v}>{v}</option>)}</select></label>
 <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={motion.loop} onChange={e=>setMotion({...motion,loop:e.target.checked})}/> Loop animation</label>
 <div className="flex gap-2"><button onClick={()=>onPreview({transition:`all ${motion.duration}ms ${motion.easing} ${motion.delay}ms`})} className="flex-1 rounded border bg-white py-2 text-xs">Preview transition</button><button onClick={()=>onCommit({transition:`all ${motion.duration}ms ${motion.easing} ${motion.delay}ms`})} className="flex-1 rounded bg-blue-600 py-2 text-xs font-semibold text-white">Apply transition</button></div>
 <p className="text-[10px] text-slate-500">Transition settings are applied to the selected element. Preset keyframe animations and timeline editing will require the next animation-engine integration.</p>
 </div>}
 </section>;
}
