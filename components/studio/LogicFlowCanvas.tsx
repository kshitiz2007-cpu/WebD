'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LogicAction, LogicTrigger, VisualFlowNode, VisualLogicRule } from '@/lib/studio/logic-engine';

type Choice<T extends string> = { value: T; label: string };
type Point = { x: number; y: number };
type Edge = { id: string; from: string; to: string; label?: string };
interface Props {
  rule: VisualLogicRule;
  triggers: Choice<LogicTrigger>[];
  actions: Choice<LogicAction>[];
  onChange: (patch: Partial<VisualLogicRule>) => void;
}
const W = 194, H = 122;
const defaults: Record<string, Point> = {
  trigger: { x: 30, y: 105 }, condition: { x: 300, y: 105 },
  yes: { x: 610, y: 24 }, no: { x: 610, y: 230 },
};
const defaultEdges: Edge[] = [
  { id: 'e-trigger-condition', from: 'trigger', to: 'condition' },
  { id: 'e-condition-yes', from: 'condition', to: 'yes', label: 'IF true' },
  { id: 'e-condition-no', from: 'condition', to: 'no', label: 'ELSE' },
];
const labels: Record<string, string> = {
  show:'Show element',hide:'Hide element',toggle:'Toggle element',setText:'Set text',
  setTextFromValue:'Copy event value',setValue:'Set control value',increment:'Increment',
  decrement:'Decrement',navigate:'Navigate',toast:'Show toast',setState:'Set global state',
  incrementState:'Increment state',addToArray:'Add to array',removeFromArray:'Remove from array',
  persistState:'Save state',loadState:'Load state',
};
const pathGet = (root: Record<string, unknown>, path: string) => path.split('.').filter(Boolean).reduce<unknown>((v,k) => v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined, root);
const sendToPreviewFrames = (message: Record<string, unknown>) => {\n  try { Array.from(window.frames).forEach((frame) => frame.postMessage(message, '*')); } catch {}\n};\nconst pathSet = (root: Record<string, unknown>, path: string, value: unknown) => {
  const keys = path.split('.').filter(Boolean); if (!keys.length) return root;
  const next = structuredClone(root);
  let cursor: Record<string, unknown> = next;
  keys.slice(0,-1).forEach((key) => { if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}; cursor = cursor[key] as Record<string, unknown>; });
  cursor[keys[keys.length-1]] = value; return next;
};

export default function LogicFlowCanvas({ rule, triggers, actions, onChange }: Props) {
  const [positions, setPositions] = useState<Record<string,Point>>(rule.flowLayout || defaults);
  const [edges, setEdges] = useState<Edge[]>(rule.flowEdges || defaultEdges);
  const flowNodes = rule.flowNodes || [];
  const [paletteDrag, setPaletteDrag] = useState<'action'|'condition'|null>(null);
  const [drag, setDrag] = useState<{id:string; x:number;y:number}|null>(null);
  const [connectFrom, setConnectFrom] = useState<string|null>(null);
  const [state, setState] = useState<Record<string,unknown>>({});
  const [stateError, setStateError] = useState('Waiting for preview state…');
  const [editPath, setEditPath] = useState('');
  const [editValue, setEditValue] = useState('');
  const [zoom, setZoom] = useState(1);
  const [autoArrange, setAutoArrange] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data?.type === 'studio:workflow-state' && event.data.state && typeof event.data.state === 'object') {
        setState(event.data.state as Record<string,unknown>); setStateError('');
      }
    };
    window.addEventListener('message', receive);
    sendToPreviewFrames({ type: 'studio:request-workflow-state' });
    return () => window.removeEventListener('message', receive);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag) return;
      const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
      const x = (event.clientX - rect.left) / zoom, y = (event.clientY - rect.top) / zoom;
      const next = { ...positions, [drag.id]: { x: Math.max(0,x-W/2), y: Math.max(0,y-H/2) } };
      setPositions(next); onChange({ flowLayout: next });
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); };
  }, [drag,positions,zoom,onChange]);

  const conditionLabel = useMemo(() => ({
    always:'Always',equals:'Equals',notEquals:'Does not equal',contains:'Contains',
    greaterThan:'Greater than',lessThan:'Less than',isEmpty:'Is empty',isNotEmpty:'Is not empty',
  }[rule.conditionOperator || 'always']),[rule.conditionOperator]);

  const saveEdges = (next: Edge[]) => { setEdges(next); onChange({ flowEdges: next }); };
  const connect = (to: string) => {
    if (!connectFrom || connectFrom === to) { setConnectFrom(null); return; }
    const validIds = new Set(['trigger','condition','yes','no',...flowNodes.map((node) => node.id)]);
    if (!validIds.has(connectFrom) || !validIds.has(to)) { setConnectFrom(null); return; }
    const id = `edge-${connectFrom}-${to}`;
    const sourceNode = flowNodes.find((node) => node.id === connectFrom);
    const label = connectFrom === 'condition' || sourceNode?.type === 'condition' ? 'true' : undefined;
    if (!edges.some((edge) => edge.from === connectFrom && edge.to === to)) saveEdges([...edges,{id,from:connectFrom,to,label}]);
    setConnectFrom(null);
  };
  const reset = () => { setPositions(defaults); saveEdges(defaultEdges); onChange({flowLayout:defaults,flowEdges:defaultEdges}); };
  const addFlowNode = (type: 'action'|'condition', x?: number, y?: number) => {
    const id = 'node-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
    const next: VisualFlowNode = type === 'action' ? {id,type,action:'setState',target:'app.value',value:'true',valueSource:'literal'} : {id,type,conditionOperator:'equals',conditionValue:'true'};
    const layout={...positions,[id]:{x:x??330,y:y??330}}; setPositions(layout); onChange({flowNodes:[...flowNodes,next],flowLayout:layout});
  };
  const updateFlowNode = (id:string, patch:Partial<VisualFlowNode>) => onChange({flowNodes:flowNodes.map((node)=>node.id===id?{...node,...patch}:node)});
  const removeFlowNode = (id:string) => { onChange({flowNodes:flowNodes.filter((node)=>node.id!==id)}); saveEdges(edges.filter((edge)=>edge.from!==id&&edge.to!==id)); };
  const edgePath = (edge: Edge) => {
    const a=positions[edge.from] || defaults[edge.from], b=positions[edge.to] || defaults[edge.to];
    if (!a || !b) return null;
    const x1=a.x+W, y1=a.y+H/2, x2=b.x, y2=b.y+H/2, mid=(x1+x2)/2;
    return { d:`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`, x:mid, y:(y1+y2)/2 };
  };
  const branch = (kind:'yes'|'no') => {
    const isYes=kind==='yes', action=isYes?rule.action:(rule.elseAction||'toast');
    return <div className="space-y-1.5" onPointerDown={(e)=>e.stopPropagation()}>
      <select aria-label={isYes?'IF action':'ELSE action'} value={action} onChange={(e)=>onChange(isYes?{action:e.target.value as LogicAction}:{elseAction:e.target.value as LogicAction})} className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700">
        {actions.map((a)=><option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
      <input aria-label={isYes?'IF target':'ELSE target'} value={isYes?rule.target:(rule.elseTarget||'')} onChange={(e)=>onChange(isYes?{target:e.target.value}:{elseTarget:e.target.value})} placeholder="Target / state key / route" className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[10px]" />
      <input aria-label={isYes?'IF value':'ELSE value'} value={isYes?rule.value:(rule.elseValue||'')} onChange={(e)=>onChange(isYes?{value:e.target.value}:{elseValue:e.target.value})} placeholder="Value (optional)" className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[10px]" />
      {!isYes && <button type="button" onClick={()=>onChange({elseAction:undefined,elseTarget:'',elseValue:''})} className="text-[10px] text-rose-600">Remove ELSE action</button>}
    </div>;
  };
  const node = (id:string,title:string,subtitle:string,tone:string,body?:React.ReactNode) => {
    const point=positions[id]||defaults[id];
    return <div key={id} onPointerDown={(e)=>{if((e.target as HTMLElement).closest('button,input,select'))return; e.preventDefault(); setDrag({id,x:e.clientX,y:e.clientY});}} style={{left:point.x,top:point.y,width:W,minHeight:H}} className={`absolute z-10 rounded-xl border bg-white shadow-xl ${tone} ${drag?.id===id?'ring-2 ring-blue-400':''}`}>
      <div className="flex items-center justify-between border-b border-current/10 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-wider">{title}</span><span className="text-[9px] opacity-60">DRAG</span></div>
      <div className="px-3 py-2"><div className="mb-2 text-xs font-semibold text-slate-900">{subtitle}</div>{body}</div>
      <button type="button" aria-label={`Connect from ${title}`} onClick={()=>setConnectFrom(id)} className={`absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white ${connectFrom===id?'bg-fuchsia-500 ring-2 ring-fuchsia-300':'bg-blue-500'}`} />
      <button type="button" aria-label={`Connect to ${title}`} onClick={()=>connect(id)} className={`absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white ${connectFrom?'bg-emerald-500 ring-2 ring-emerald-300':'bg-slate-400'}`} />
    </div>;
  };

  const flatState = (value: unknown, prefix=''): Array<{path:string;value:unknown}> => {
    if (value && typeof value==='object' && !Array.isArray(value)) return Object.entries(value as Record<string,unknown>).flatMap(([k,v])=>flatState(v,prefix?prefix+'.'+k:k));
    return [{path:prefix||'state',value}];
  };
  const applyStateEdit = () => {
    if(!editPath.trim()) return;
    let parsed:unknown=editValue; try{parsed=JSON.parse(editValue);}catch{}
    const next=pathSet(state,editPath.trim(),parsed); setState(next); setStateError('');
    sendToPreviewFrames({type:'studio:workflow-set-state',path:editPath.trim(),value:parsed});
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
      <span>{connectFrom? `Connecting from ${connectFrom}: click another node's left port`:'Drag nodes · connect Trigger → Condition and Condition → IF/ELSE using ports'}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={()=>setZoom(Math.max(.6,zoom-.1))} className="rounded border px-2 py-1">−</button><span>{Math.round(zoom*100)}%</span><button type="button" onClick={()=>setZoom(Math.min(1.4,zoom+.1))} className="rounded border px-2 py-1">+</button>
        <button type="button" onClick={reset} className="rounded border px-2 py-1 font-semibold">Auto layout</button>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><span className="text-[10px] font-semibold text-slate-600">NODE PALETTE</span><button draggable onDragStart={()=>setPaletteDrag("action")} onDragEnd={()=>setPaletteDrag(null)} onClick={()=>addFlowNode("action")} className="rounded-md border bg-white px-2 py-1 text-[10px] font-semibold">＋ Action node</button><button draggable onDragStart={()=>setPaletteDrag("condition")} onDragEnd={()=>setPaletteDrag(null)} onClick={()=>addFlowNode("condition")} className="rounded-md border bg-white px-2 py-1 text-[10px] font-semibold">＋ Condition node</button><span className="text-[9px] text-slate-500">Drag onto graph or click to add</span></div>
    <div className="overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-2">
      <div ref={canvasRef} className="relative" onDragOver={(e)=>{if(paletteDrag)e.preventDefault();}} onDrop={(e)=>{e.preventDefault();if(!paletteDrag)return;const rect=canvasRef.current?.getBoundingClientRect();addFlowNode(paletteDrag,Math.max(0,(e.clientX-(rect?.left||0))/zoom-90),Math.max(0,(e.clientY-(rect?.top||0))/zoom-55));setPaletteDrag(null);}} style={{width:1200*zoom,height:760*zoom}}>
        <div className="absolute left-0 top-0 origin-top-left" style={{width:1200,height:760,transform:`scale(${zoom})`}}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 760">
            {edges.map((edge)=>{const path=edgePath(edge);return path?<g key={edge.id}><path d={path.d} fill="none" stroke={edge.label==='ELSE'?'#fbbf24':edge.label==='IF true'?'#34d399':'#60a5fa'} strokeWidth="2.5"/><text x={path.x} y={path.y-8} fill="#cbd5e1" fontSize="10" textAnchor="middle">{edge.label||'flow'}</text></g>:null})}
          </svg>
          {node('trigger','01 · Trigger',triggers.find((t)=>t.value===rule.trigger)?.label||rule.trigger,'border-blue-400/60 text-blue-500',<div className="space-y-1"><select aria-label="Workflow trigger" value={rule.trigger} onChange={(e)=>onChange({trigger:e.target.value as LogicTrigger})} className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700">{triggers.map((t)=><option key={t.value} value={t.value}>{t.label}</option>)}</select><p className="truncate text-[9px] text-slate-500">{rule.componentLabel}</p></div>)}
          {node('condition','02 · Condition',conditionLabel,'border-violet-400/60 text-violet-500',<div className="space-y-1"><select aria-label="Condition operator" value={rule.conditionOperator||'always'} onChange={(e)=>onChange({conditionOperator:e.target.value as VisualLogicRule['conditionOperator']})} className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700"><option value="always">Always</option><option value="equals">Equals</option><option value="notEquals">Not equals</option><option value="contains">Contains</option><option value="greaterThan">Greater than</option><option value="lessThan">Less than</option><option value="isEmpty">Is empty</option><option value="isNotEmpty">Is not empty</option></select><input aria-label="Condition compare value" value={rule.conditionValue||''} onChange={(e)=>onChange({conditionValue:e.target.value})} placeholder="Compare value" className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-[10px]"/></div>)}
          {node('yes','03 · IF true',labels[rule.action]||rule.action,'border-emerald-400/60 text-emerald-600',branch('yes'))}
          {node('no','04 · ELSE',rule.elseAction?(labels[rule.elseAction]||rule.elseAction):'No ELSE action','border-amber-400/60 text-amber-600',branch('no'))}
          {flowNodes.map((item,index)=>node(item.id,String(index+5).padStart(2,'0')+' · '+item.type.toUpperCase(),item.label||(item.type==='action'?(labels[item.action||'toast']||item.action||'Action'):'Nested condition'),item.type==='action'?'border-cyan-400/60 text-cyan-600':'border-fuchsia-400/60 text-fuchsia-600',<div className="space-y-1.5" onPointerDown={(e)=>e.stopPropagation()}>{item.type==='action'?<><select aria-label="Action node type" value={item.action||'toast'} onChange={(e)=>updateFlowNode(item.id,{action:e.target.value as LogicAction})} className="w-full rounded border px-1 py-1 text-[10px]">{actions.map((a)=><option key={a.value} value={a.value}>{a.label}</option>)}</select><input aria-label="Action target" value={item.target||''} onChange={(e)=>updateFlowNode(item.id,{target:e.target.value})} placeholder="Target / state path" className="w-full rounded border px-1 py-1 text-[10px]"/><input aria-label="Action value" value={item.value||''} onChange={(e)=>updateFlowNode(item.id,{value:e.target.value})} placeholder="Value" className="w-full rounded border px-1 py-1 text-[10px]"/></>:<><select aria-label="Nested condition operator" value={item.conditionOperator||'always'} onChange={(e)=>updateFlowNode(item.id,{conditionOperator:e.target.value as VisualLogicRule['conditionOperator']})} className="w-full rounded border px-1 py-1 text-[10px]">{['always','equals','notEquals','contains','greaterThan','lessThan','isEmpty','isNotEmpty'].map((op)=><option key={op} value={op}>{op}</option>)}</select><input aria-label="Nested condition value" value={item.conditionValue||''} onChange={(e)=>updateFlowNode(item.id,{conditionValue:e.target.value})} placeholder="Compare value" className="w-full rounded border px-1 py-1 text-[10px]"/></>}<button type="button" onClick={()=>removeFlowNode(item.id)} className="text-[9px] text-rose-600">Remove node</button></div>))}
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={()=>{saveEdges(defaultEdges);setConnectFrom(null);}} className="rounded-md border px-2 py-1 text-[10px] font-semibold">Auto-connect defaults</button>
      <button type="button" onClick={()=>saveEdges([])} className="rounded-md border px-2 py-1 text-[10px] font-semibold">Clear all wires</button>
      <span className="text-[10px] text-slate-500">{edges.length} connection(s) · {flowNodes.length} custom node(s)</span>
    </div>
    {edges.length>0&&<div className="flex flex-wrap gap-1">{edges.map((edge)=><span key={edge.id} className="inline-flex items-center rounded-full bg-slate-100 text-[10px] text-slate-600"><button type="button" onClick={()=>saveEdges(edges.map((item)=>item.id===edge.id?{...item,label:item.label==='true'?'false':item.label==='false'?'': 'true'}:item))} className="px-2 py-1">{edge.from} → {edge.to} {edge.label||'next'} · branch</button><button type="button" aria-label="Remove connection" onClick={()=>saveEdges(edges.filter((item)=>item.id!==edge.id))} className="px-1 py-1 text-rose-600">×</button></span>)}</div>}
    <section className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between bg-slate-50 px-3 py-2"><span className="text-xs font-semibold text-slate-700">Live state inspector</span><button type="button" onClick={()=>sendToPreviewFrames({type:'studio:request-workflow-state'})} className="text-[10px] font-semibold text-blue-600">Refresh</button></div>
      <div className="space-y-2 p-3">
        {stateError&&<p className="text-[10px] text-slate-500">{stateError} Open Preview → Interact and trigger a rule.</p>}
        <div className="max-h-48 space-y-1 overflow-auto">{flatState(state).map(({path,value})=><div key={path} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1"><code className="min-w-0 truncate text-[10px] text-slate-600">{path}</code><span className="max-w-[55%] truncate text-[10px] text-slate-900">{typeof value==='string'?value:JSON.stringify(value)}</span></div>)}</div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1fr_auto]">
          <input value={editPath} onChange={(e)=>setEditPath(e.target.value)} placeholder="state key e.g. cart.items" className="min-w-0 rounded-md border px-2 py-1.5 text-[10px]"/>
          <input value={editValue} onChange={(e)=>setEditValue(e.target.value)} placeholder='JSON or text e.g. 3' className="min-w-0 rounded-md border px-2 py-1.5 text-[10px]"/>
          <button type="button" onClick={applyStateEdit} className="rounded-md bg-blue-600 px-3 py-1.5 text-[10px] font-semibold text-white">Apply value</button>
        </div>
        <p className="text-[9px] text-slate-500">Enter valid JSON for arrays, objects, numbers and booleans; otherwise the value is saved as text.</p>
      </div>
    </section>
  </div>;
}
