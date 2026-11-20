'use client';
import React,{useEffect,useState} from 'react';
type Props={selectionKey:string; onPreview:(styles:Record<string,string|null>)=>void; onCommit:(styles:Record<string,string|null>)=>void; currentBackground?:string; currentText?:string};
type Token={name:string;color:string};
const TOKEN_KEY='webd_studio_global_color_tokens_v1';
const presets=[
{name:'Soft Glass',styles:{backgroundColor:'rgba(255,255,255,0.72)',backdropFilter:'blur(14px)',border:'1px solid rgba(255,255,255,0.4)',boxShadow:'0 8px 30px rgba(15,23,42,0.12)',borderRadius:'18px'}},
{name:'Neon',styles:{backgroundColor:'#101827',color:'#E5F4FF',border:'1px solid #36D6FF',boxShadow:'0 0 18px rgba(54,214,255,.38)',borderRadius:'12px'}},
{name:'Premium Dark',styles:{backgroundColor:'#171717',color:'#F5F0E8',border:'1px solid #3B3B3B',boxShadow:'0 14px 32px rgba(0,0,0,.32)',borderRadius:'16px'}},
{name:'Clean',styles:{backgroundColor:'#FFFFFF',color:'#111827',border:'1px solid #E5E7EB',boxShadow:'0 4px 14px rgba(15,23,42,.06)',borderRadius:'12px'}},
{name:'Warm Editorial',styles:{backgroundColor:'#F5EFE5',color:'#30251B',border:'1px solid #D9C8B1',boxShadow:'0 8px 24px rgba(70,45,20,.12)',borderRadius:'4px'}},
{name:'Bold',styles:{backgroundColor:'#FACC15',color:'#18181B',border:'2px solid #18181B',boxShadow:'5px 5px 0 #18181B',borderRadius:'0px'}}
];
export default function DesignTokensPresets({selectionKey,onPreview,onCommit,currentBackground,currentText}:Props){
 const [tokens,setTokens]=useState<Token[]>([]);
 const [name,setName]=useState('Brand color');const [color,setColor]=useState('#6366F1');
 useEffect(()=>{try{const raw=localStorage.getItem(TOKEN_KEY);setTokens(raw?JSON.parse(raw):[])}catch{setTokens([])}},[]);
 const persist=(next:Token[])=>{setTokens(next);try{localStorage.setItem(TOKEN_KEY,JSON.stringify(next))}catch{}};
 const save=()=>{if(!/^#[0-9a-f]{6}$/i.test(color))return;const token={name:name.trim()||color,color:color.toUpperCase()};persist([token,...tokens.filter(t=>t.color.toUpperCase()!==token.color)].slice(0,24));};
 const applyColor=(c:string,kind:'background'|'text'|'border')=>{const style=kind==='background'?{backgroundColor:c}:kind==='text'?{color:c}:{borderColor:c};onCommit(style)};
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
 <header className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-800">Global Color Tokens</h3><span className="text-[10px] text-slate-400">Saved palette</span></header>
 <div className="flex gap-1.5"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Token name" className="h-8 min-w-0 flex-1 rounded border px-2 text-xs"/><input type="color" value={color} onChange={e=>setColor(e.target.value)} className="h-8 w-9 rounded border p-0.5"/><button type="button" onClick={save} className="rounded bg-indigo-600 px-2 text-[11px] font-semibold text-white">Save</button></div>
 <div className="flex flex-wrap gap-1.5">{tokens.map(t=><div key={t.color} className="group flex items-center gap-1 rounded border border-slate-200 p-1"><button title={t.name+' · apply background'} onClick={()=>applyColor(t.color,'background')} className="h-6 w-6 rounded border" style={{background:t.color}}/><button onClick={()=>applyColor(t.color,'text')} title="Apply text color" className="text-[10px] font-bold text-slate-700">T</button><button onClick={()=>applyColor(t.color,'border')} title="Apply border color" className="text-[10px] font-semibold text-slate-700">B</button><span className="max-w-20 truncate text-[9px] text-slate-500">{t.name}</span><button onClick={()=>persist(tokens.filter(x=>x.color!==t.color))} aria-label={'Remove '+t.name} className="text-xs text-slate-400 hover:text-rose-600">×</button></div>)}</div>
 {tokens.length===0&&<p className="text-[10px] text-slate-400">Save HEX colors here to reuse across elements. Click swatch for background, T for text, B for border.</p>}
 <div className="border-t pt-3"><h4 className="mb-2 text-[11px] font-semibold text-slate-700">Quick Style Presets</h4><div className="grid grid-cols-2 gap-1.5">{presets.map(p=><button key={p.name} type="button" onClick={()=>onCommit(p.styles)} className="rounded-lg border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold hover:border-indigo-300 hover:bg-indigo-50" style={{backgroundColor:p.styles.backgroundColor,color:p.styles.color,borderColor:p.styles.borderColor}}>{p.name}<span className="mt-1 block text-[9px] font-normal opacity-70">Apply style</span></button>)}</div></div>
 </section>;
}
