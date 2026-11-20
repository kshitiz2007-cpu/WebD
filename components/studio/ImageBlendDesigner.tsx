'use client';

import React, { useEffect, useState } from 'react';

type Props = {
  selectionKey: string;
  onPreview: (styles: Record<string, string | null>) => void;
  onCommit: (styles: Record<string, string | null>) => void;
};
type SavedState = { image:string; overlay:string; overlayOpacity:number; blend:string; size:string; imageOpacity:number; softness:number; x:number; y:number };
const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'soft-light', 'hard-light'] as const;
const rgba = (hex: string, alpha: number) => { const h=hex.replace('#',''); const n=Number.parseInt(h,16); return Number.isFinite(n) ? `rgba(${(n>>16)&255}, ${(n>>8)&255}, ${n&255}, ${Math.max(0,Math.min(1,alpha))})` : 'rgba(0,0,0,0)'; };
const storageKey=(key:string)=>`webd_image_blend_saved_v1:${key}`;
const initial:SavedState={image:'',overlay:'#000000',overlayOpacity:35,blend:'overlay',size:'cover',imageOpacity:100,softness:0,x:50,y:50};

export default function ImageBlendDesigner({selectionKey,onPreview,onCommit}:Props){
 const [state,setState]=useState<SavedState>(initial);
 const [loadedFor,setLoadedFor]=useState('');
 const [dragStart,setDragStart]=useState<{px:number;py:number;x:number;y:number}|null>(null);
 useEffect(()=>{
   let saved:SavedState=initial;
   try { const raw=localStorage.getItem(storageKey(selectionKey)); if(raw) saved={...initial,...JSON.parse(raw)}; } catch {}
   setState(saved); setLoadedFor(selectionKey);
 },[selectionKey]);
 useEffect(()=>{ if(loadedFor!==selectionKey) return; try{localStorage.setItem(storageKey(selectionKey),JSON.stringify(state));}catch{} },[state,loadedFor,selectionKey]);
 const patch=(next:Partial<SavedState>)=>setState(s=>({...s,...next}));
 const stylesFor=():Record<string,string|null>=>({
   backgroundImage:state.image ? `linear-gradient(${rgba(state.overlay,state.overlayOpacity/100)}, ${rgba(state.overlay,state.overlayOpacity/100)}), url("${state.image}")` : null,
   backgroundBlendMode:state.image?state.blend:null,
   backgroundSize:state.image?state.size:null,
   backgroundPosition:state.image?`${state.x}% ${state.y}%`:null,
   backgroundRepeat:state.image?'no-repeat':null,
   opacity:state.image?String(state.imageOpacity/100):null,
   filter:state.image&&state.softness>0?`blur(${state.softness}px)`:null
 });
 const upload=(file?:File)=>{ if(!file||!file.type.startsWith('image/'))return; if(file.size>8*1024*1024){alert('Image max size is 8 MB. Please compress it before uploading.');return;} const reader=new FileReader(); reader.onload=()=>patch({image:String(reader.result||'')}); reader.readAsDataURL(file); };
 const previewStyle:React.CSSProperties={backgroundImage:state.image? `linear-gradient(${rgba(state.overlay,state.overlayOpacity/100)}, ${rgba(state.overlay,state.overlayOpacity/100)}), url("${state.image}")`:undefined,backgroundBlendMode:state.blend as React.CSSProperties['backgroundBlendMode'],backgroundSize:state.size,backgroundPosition:`${state.x}% ${state.y}%`,backgroundRepeat:'no-repeat',opacity:state.imageOpacity/100,filter:state.softness? `blur(${state.softness}px)`:undefined};
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
  <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-800">Image &amp; Blend Designer</h3><span className="text-[10px] text-slate-500">Drag preview to reposition</span></div>
  {state.image ? <div className="flex items-center gap-2 rounded-lg border bg-white p-2"><div className="h-10 w-10 shrink-0 rounded bg-cover bg-center" style={{backgroundImage:  state.image.startsWith('data:')? `url("${state.image}")`:`url("${state.image}")`}}/><div className="min-w-0 flex-1 text-[11px] font-medium text-slate-700">Image saved for this element<div className="text-[10px] font-normal text-slate-500">Reopen editor anytime to adjust</div></div><button type="button" onClick={()=>document.getElementById('blend-upload')?.click()} className="rounded border px-2 py-1 text-xs">Edit / Replace</button><button type="button" onClick={()=>{patch({image:''});onCommit({backgroundImage:null,backgroundBlendMode:null,backgroundSize:null,backgroundPosition:null,backgroundRepeat:null,opacity:null,filter:null});}} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600">Remove</button></div>:<label className="block text-[10px] font-medium text-slate-600">Upload image (8 MB max) or paste URL</label>}
  <input id="blend-upload" type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0])} className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white"/>
  <input value={state.image.startsWith('data:')?'Uploaded image':state.image} onChange={e=>patch({image:e.target.value})} placeholder="Or paste image URL" className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"/>
  <div className="grid grid-cols-2 gap-2">
   <label className="space-y-1 text-[10px] text-slate-600">Blend mode<select value={state.blend} onChange={e=>patch({blend:e.target.value})} className="h-8 w-full rounded border bg-white px-1.5 text-xs">{blendModes.map(m=><option key={m}>{m}</option>)}</select></label>
   <label className="space-y-1 text-[10px] text-slate-600">Sizing<select value={state.size} onChange={e=>patch({size:e.target.value})} className="h-8 w-full rounded border bg-white px-1.5 text-xs">{['cover','contain','100% 100%','auto'].map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="space-y-1 text-[10px] text-slate-600">Overlay color<div className="flex h-8 items-center gap-1 rounded border bg-white px-1"><input type="color" value={state.overlay} onChange={e=>patch({overlay:e.target.value})} className="h-6 w-7 p-0"/><span className="font-mono">{state.overlay}</span></div></label>
   <label className="space-y-1 text-[10px] text-slate-600">Overlay strength ({state.overlayOpacity}%)<input type="range" min="0" max="100" value={state.overlayOpacity} onChange={e=>patch({overlayOpacity:Number(e.target.value)})} className="w-full accent-blue-600"/></label>
  </div>
  <label className="block space-y-1 text-[10px] text-slate-600">Image opacity ({state.imageOpacity}%)<input type="range" min="10" max="100" value={state.imageOpacity} onChange={e=>patch({imageOpacity:Number(e.target.value)})} className="w-full accent-blue-600"/></label>
  <label className="block space-y-1 text-[10px] text-slate-600">Image zoom ({state.size})<input type="range" min="20" max="200" value={state.size.match(/^\d+%/) ? Number(state.size.replace('%','')):100} onChange={e=>patch({size:  `${e.target.value}% ${e.target.value}%`})} className="w-full accent-blue-600"/></label>
  <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-600">Horizontal position ({state.x}%)<input type="range" min="0" max="100" value={state.x} onChange={e=>patch({x:Number(e.target.value)})} className="w-full accent-blue-600"/></label><label className="text-[10px] text-slate-600">Vertical position ({state.y}%)<input type="range" min="0" max="100" value={state.y} onChange={e=>patch({y:Number(e.target.value)})} className="w-full accent-blue-600"/></label></div>
  <label className="block space-y-1 text-[10px] text-slate-600">Blur ({state.softness}px)<input type="range" min="0" max="12" value={state.softness} onChange={e=>patch({softness:Number(e.target.value)})} className="w-full accent-blue-600"/></label>
  <div onPointerDown={e=>{if(!state.image)return;setDragStart({px:e.clientX,py:e.clientY,x:state.x,y:state.y});e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!dragStart)return;patch({x:Math.max(0,Math.min(100,dragStart.x+(e.clientX-dragStart.px)/2)),y:Math.max(0,Math.min(100,dragStart.y+(e.clientY-dragStart.py)/2))});}} onPointerUp={()=>setDragStart(null)} onPointerCancel={()=>setDragStart(null)} className="h-32 touch-none cursor-move overflow-hidden rounded-lg border border-slate-300 bg-slate-200" style={previewStyle}/>
  <div className="flex gap-2"><button type="button" disabled={!state.image} onClick={()=>onPreview(stylesFor())} className="flex-1 rounded-md border bg-white py-2 text-xs font-semibold disabled:opacity-40">Preview</button><button type="button" disabled={!state.image} onClick={()=>onCommit(stylesFor())} className="flex-1 rounded-md bg-blue-600 py-2 text-xs font-semibold text-white disabled:opacity-40">Apply Image</button><button type="button" onClick={()=>{patch(initial);onCommit({backgroundImage:null,backgroundBlendMode:null,backgroundSize:null,backgroundPosition:null,backgroundRepeat:null,opacity:null,filter:null});}} className="rounded-md border bg-white px-2 py-2 text-xs">Clear</button></div>
  <p className="text-[10px] leading-relaxed text-slate-500">Image and blend settings are automatically saved on this element. Close and reopen this panel without re-uploading.</p>
 </section>;
}
