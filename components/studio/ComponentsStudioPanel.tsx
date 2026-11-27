'use client';

import React, { useMemo, useState } from 'react';
import { BookmarkPlus, Blocks, Check, Search, Sparkles, Trash2 } from 'lucide-react';

type Snippet = { id: string; name: string; category: string; description: string; code: string; custom?: boolean };

const BUILT_INS: Snippet[] = [
  { id: 'sidebar', name: 'Dashboard Sidebar', category: 'Navigation', description: 'Vertical dashboard menu', code: '<aside className="w-64 shrink-0 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white"><div className="mb-7 text-lg font-bold">Workspace</div><nav className="space-y-2"><a href="#" className="block rounded-lg bg-indigo-600 px-3 py-2.5 text-sm text-white">Overview</a><a href="#" className="block rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10">Projects</a><a href="#" className="block rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10">Files</a><a href="#" className="block rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10">Settings</a></nav></aside>' },
  { id: 'topnav', name: 'Top Navbar', category: 'Navigation', description: 'Brand, links and action', code: '<header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><a href="#" className="text-lg font-bold text-slate-900">Your Brand</a><nav className="flex flex-wrap gap-4 text-sm text-slate-600"><a href="#">Home</a><a href="#">Projects</a><a href="#">About</a></nav><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Get started</button></header>' },
  { id: 'bottomnav', name: 'Bottom Navbar', category: 'Navigation', description: 'Mobile bottom navigation', code: '<nav className="mx-auto flex max-w-md items-center justify-around rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-lg"><a href="#" className="flex flex-col items-center gap-1 px-3 text-xs font-semibold text-indigo-600"><span className="text-xl">⌂</span>Home</a><a href="#" className="flex flex-col items-center gap-1 px-3 text-xs text-slate-500"><span className="text-xl">▦</span>Projects</a><a href="#" className="flex flex-col items-center gap-1 px-3 text-xs text-slate-500"><span className="text-xl">＋</span>Create</a><a href="#" className="flex flex-col items-center gap-1 px-3 text-xs text-slate-500"><span className="text-xl">◉</span>Profile</a></nav>' },
  { id: 'kpi', name: 'KPI Cards', category: 'Dashboard', description: 'Responsive metrics cards', code: '<section className="grid grid-cols-1 gap-4 sm:grid-cols-3"><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total projects</p><p className="mt-2 text-3xl font-bold text-slate-900">128</p><p className="mt-2 text-xs font-semibold text-emerald-600">+12.5% this month</p></article><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">In progress</p><p className="mt-2 text-3xl font-bold text-slate-900">24</p><p className="mt-2 text-xs font-semibold text-emerald-600">+4.2% this month</p></article><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Completed</p><p className="mt-2 text-3xl font-bold text-slate-900">96</p><p className="mt-2 text-xs font-semibold text-emerald-600">+8.1% this month</p></article></section>' },
  { id: 'tabs', name: 'Content Tabs', category: 'Layout', description: 'Tab-style section header', code: '<section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"><button className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">Overview</button><button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">Activity</button><button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">Settings</button></div><div className="pt-5"><h3 className="text-lg font-semibold text-slate-900">Overview</h3><p className="mt-1 text-sm text-slate-500">Your section content starts here.</p></div></section>' },
  { id: 'cta', name: 'Call to Action', category: 'UI', description: 'Message and primary button', code: '<section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-indigo-600 p-6 text-white"><div><h3 className="text-xl font-bold">Ready to get started?</h3><p className="mt-1 text-sm text-indigo-100">Add your message and action here.</p></div><button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700">Continue</button></section>' },
  { id: 'card', name: 'Feature Card', category: 'UI', description: 'Icon, heading and description card', code: '<article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-xl text-indigo-600">✦</div><h3 className="text-base font-semibold text-slate-900">Feature title</h3><p className="mt-1 text-sm leading-6 text-slate-600">Describe your feature, product, or service with this flexible card.</p><a href="#" className="mt-4 inline-block text-sm font-semibold text-indigo-600">Learn more →</a></article>' },
  { id: 'footer', name: 'Simple Footer', category: 'Layout', description: 'Brand and footer links', code: '<footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-5 text-sm text-slate-500"><span>© 2026 Your Brand</span><nav className="flex gap-4"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></nav></footer>' },
];

const STORAGE_KEY = 'webd-component-studio-library-v1';

function loadSaved(): Snippet[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.code === 'string') : [];
  } catch { return []; }
}

export default function ComponentsStudioPanel({ onInsertSnippet }: { onInsertSnippet: (snippet: string) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [saved, setSaved] = useState<Snippet[]>(loadSaved);
  const [saveName, setSaveName] = useState('');
  const [saveCode, setSaveCode] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [notice, setNotice] = useState('');
  const categories = ['All', 'Navigation', 'Dashboard', 'Layout', 'UI', 'Saved'];
  const entries = useMemo(() => {
    const source = filter === 'Saved' ? saved : [...BUILT_INS, ...saved];
    return source.filter((item) => (filter === 'All' || filter === 'Saved' || item.category === filter) && (!query.trim() || (item.name + ' ' + item.description + ' ' + item.category).toLowerCase().includes(query.toLowerCase())));
  }, [filter, query, saved]);
  const persist = (next: Snippet[]) => {
    setSaved(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setNotice('Storage limit reached; this save may not persist.'); }
  };
  return (
    <section aria-label="Component Studio" className="space-y-3 border-t border-slate-200 pt-3">
      <div className="flex items-center gap-2"><Blocks className="h-4 w-4 text-indigo-600"/><h3 className="text-xs font-bold text-slate-900">Component Studio</h3><span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">Reusable</span></div>
      <p className="text-[10px] leading-4 text-slate-500">Tap Insert to place JSX into the current page. Saved snippets stay in this browser across projects.</p>
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Find sidebar, navbar, cards…" aria-label="Search component templates" className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-indigo-400"/></div>
      <div className="flex flex-wrap gap-1">{categories.map((c)=><button key={c} type="button" onClick={()=>setFilter(c)} className={'rounded-full border px-2 py-1 text-[9px] font-semibold '+(filter===c?'border-indigo-600 bg-indigo-600 text-white':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{c}</button>)}</div>
      <div className="grid grid-cols-2 gap-2">{entries.map((item)=><article key={item.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"><div className="mb-2 flex h-14 items-center justify-center rounded-md bg-gradient-to-br from-indigo-50 to-slate-100 text-2xl text-indigo-600">{item.category==='Navigation'?'☷':item.category==='Dashboard'?'▥':item.category==='Layout'?'▤':'✦'}</div><p className="truncate text-[10px] font-bold text-slate-900">{item.name}</p><p className="mt-0.5 min-h-7 text-[9px] leading-3 text-slate-500">{item.description}</p><button type="button" onClick={()=>{onInsertSnippet(item.code);setNotice(item.name+' inserted into current page');}} className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-700"><Sparkles className="h-3 w-3"/>Insert</button>{item.custom && <button type="button" onClick={()=>persist(saved.filter(s=>s.id!==item.id))} className="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[9px] text-rose-600 hover:bg-rose-50"><Trash2 className="h-3 w-3"/>Remove</button>}</article>)}</div>
      {entries.length===0 && <p className="rounded-md border border-dashed p-3 text-center text-[10px] text-slate-500">No matching components found.</p>}
      <button type="button" onClick={()=>setShowSave(v=>!v)} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-indigo-300 bg-indigo-50 px-2.5 py-2 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"><BookmarkPlus className="h-3.5 w-3.5"/>Save your own snippet</button>
      {showSave && <form onSubmit={(event)=>{event.preventDefault();const name=saveName.trim();const code=saveCode.trim();if(!name||!code){setNotice('Add a name and JSX snippet first.');return;}persist([...saved,{id:'saved-'+Date.now(),name,category:'Saved',description:'Personal reusable JSX snippet',code,custom:true}]);setSaveName('');setSaveCode('');setShowSave(false);setFilter('Saved');setNotice(name+' saved to My Library');}} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2"><input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Component name" className="h-8 w-full rounded border px-2 text-xs"/><textarea value={saveCode} onChange={e=>setSaveCode(e.target.value)} rows={5} placeholder="Paste JSX snippet" className="w-full resize-y rounded border p-2 font-mono text-[10px]"/><button type="submit" className="flex h-8 w-full items-center justify-center gap-1 rounded bg-indigo-600 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5"/>Save component</button></form>}
      {notice && <p role="status" className="rounded-md bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-800">{notice}</p>}
    </section>
  );
}
