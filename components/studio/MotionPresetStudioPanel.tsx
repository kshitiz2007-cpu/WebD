'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Check, FileJson, Gauge, Layers3, Play, RotateCcw, Save, Sparkles, ToggleLeft, ToggleRight, Upload, X } from 'lucide-react';
import {
  DEFAULT_MOTION_PRESET,
  MOTION_PRESET_FILE,
  parseMotionPreset,
  serializeMotionPreset,
  type MotionPreset,
  type MotionPresetRule,
} from '@/lib/studio/motion-presets';

type Props = {
  preset: MotionPreset;
  onChange: (preset: MotionPreset) => void;
  onApply: (preset: MotionPreset) => void;
  onClose: () => void;
  isBottomSheet?: boolean;
};

const buttonClass = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';

export default function MotionPresetStudioPanel({ preset, onChange, onApply, onClose, isBottomSheet = false }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [activeRuleId, setActiveRuleId] = useState(preset.rules[0]?.id || '');
  const [draft, setDraft] = useState<MotionPreset>(preset);
  const activeRule = draft.rules.find((rule) => rule.id === activeRuleId) || draft.rules[0];
  const enabledCount = useMemo(() => draft.rules.filter((rule) => rule.enabled).length, [draft.rules]);

  const replaceRule = (patch: Partial<MotionPresetRule>) => {
    if (!activeRule) return;
    setDraft((current) => ({ ...current, rules: current.rules.map((rule) => rule.id === activeRule.id ? { ...rule, ...patch, config: { ...rule.config, ...(patch.config || {}) } } : rule) }));
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 512 * 1024) throw new Error('Preset file must be smaller than 512 KB.');
      const parsed = parseMotionPreset(await file.text());
      setDraft(parsed); onChange(parsed); setActiveRuleId(parsed.rules[0]?.id || '');
      setError(''); setNotice(`Imported “${parsed.name}” — preview it before applying.`); setPreview(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to import this preset.');
      setNotice('');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const exportPreset = () => {
    const blob = new Blob([serializeMotionPreset(draft)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'webd-motion'}.motion.json`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const apply = () => { onChange(draft); onApply(draft); setPreview(false); setNotice('Preset applied to project CSS.'); setError(''); };
  const updateConfig = (key: keyof MotionPresetRule['config'], value: unknown) => {
    if (!activeRule) return;
    replaceRule({ config: { ...activeRule.config, [key]: value } });
  };

  return (
    <aside className={`flex h-full w-[min(440px,94vw)] shrink-0 flex-col overflow-hidden border-l border-slate-700 bg-[#15191f] text-slate-100 shadow-2xl ${isBottomSheet ? 'w-full rounded-t-2xl border-x' : ''}`}>
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2"><span className="rounded-lg bg-violet-500/15 p-2 text-violet-300"><Sparkles size={17}/></span><div><h2 className="text-sm font-bold">Motion Preset Studio</h2><p className="text-[10px] text-slate-400">Project-wide motion system</p></div></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close"><X size={17}/></button>
      </div>
      <div className="studio-scroll flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-3">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold"><Layers3 size={15} className="text-violet-300"/> Active preset</div><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">{enabledCount}/{draft.rules.length} rules on</span></div>
          <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value.slice(0,100) }))} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400" aria-label="Preset name"/>
          <textarea value={draft.description || ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value.slice(0,500) }))} rows={2} placeholder="Describe this motion system…" className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 outline-none focus:border-violet-400"/>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className={buttonClass} onClick={() => fileInput.current?.click()}><Upload size={14}/> Import JSON</button>
            <button type="button" className={buttonClass} onClick={exportPreset}><ArrowDownToLine size={14}/> Export preset</button>
          </div>
          <input ref={fileInput} type="file" accept=".json,.motion.json,application/json" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])}/>
          <p className="mt-2 text-[10px] text-slate-500">Expected format: {MOTION_PRESET_FILE} · schema v1</p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between"><h3 className="text-xs font-bold">Global controls</h3><button type="button" onClick={() => setDraft(DEFAULT_MOTION_PRESET)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"><RotateCcw size={12}/> Reset defaults</button></div>
          <label className="flex items-center justify-between text-xs"><span>Enable project preset</span><input type="checkbox" checked={draft.settings.enabled} onChange={(event) => setDraft((current) => ({ ...current, settings: { ...current.settings, enabled: event.target.checked } }))} className="accent-violet-400"/></label>
          <label className="flex items-center justify-between text-xs"><span>Respect reduced motion</span><input type="checkbox" checked={draft.settings.respectReducedMotion} onChange={(event) => setDraft((current) => ({ ...current, settings: { ...current.settings, respectReducedMotion: event.target.checked } }))} className="accent-violet-400"/></label>
          <label className="block text-xs"><span className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1"><Gauge size={13}/> Motion intensity</span><strong>{draft.settings.intensity.toFixed(2)}×</strong></span><input type="range" min="0" max="2" step="0.05" value={draft.settings.intensity} onChange={(event) => setDraft((current) => ({ ...current, settings: { ...current.settings, intensity: Number(event.target.value) } }))} className="w-full accent-violet-400"/></label>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-xs font-bold">Animation rules</h3><span className="text-[10px] text-slate-500">Choose a rule to edit</span></div>
          <div className="space-y-1.5">{draft.rules.map((rule) => <button type="button" key={rule.id} onClick={() => setActiveRuleId(rule.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left ${activeRule?.id === rule.id ? 'border-violet-400/60 bg-violet-500/10' : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800'}`}><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{rule.name}</span><span className="text-[10px] text-slate-500">{rule.target} · {rule.config.reveal !== 'none' ? rule.config.reveal : rule.config.hover !== 'none' ? rule.config.hover : rule.config.loop}</span></span><span className={`rounded-full p-1 ${rule.enabled ? 'text-emerald-300' : 'text-slate-600'}`}>{rule.enabled ? <ToggleRight size={19}/> : <ToggleLeft size={19}/>}</span></button>)}</div>
        </section>

        {activeRule && <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between"><h3 className="text-xs font-bold">Edit rule</h3><label className="flex items-center gap-2 text-[10px] text-slate-400">Enabled<input type="checkbox" checked={activeRule.enabled} onChange={(event) => replaceRule({ enabled: event.target.checked })} className="accent-violet-400"/></label></div>
          <label className="block text-xs text-slate-400">Rule name<input value={activeRule.name} onChange={(event) => replaceRule({ name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"/></label>
          <label className="block text-xs text-slate-400">Target selector<select value={activeRule.target} onChange={(event) => replaceRule({ target: event.target.value as MotionPresetRule['target'] })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white">{['h1','h2','h3','p','a','button','.card','img','section','*'].map((target) => <option key={target} value={target}>{target}</option>)}</select></label>
          <label className="block text-xs text-slate-400">Scroll reveal<select value={activeRule.config.reveal} onChange={(event) => updateConfig('reveal', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white">{['none','fade-up','fade-down','fade-left','fade-right','zoom-in','zoom-out','blur-up','flip-up'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="block text-xs text-slate-400">Hover interaction<select value={activeRule.config.hover} onChange={(event) => updateConfig('hover', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white">{['none','lift','scale-pop','glow-ring','press-tap','tilt-soft','border-shimmer'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="block text-xs text-slate-400">Ambient loop<select value={activeRule.config.loop} onChange={(event) => updateConfig('loop', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white">{['none','float','pulse-soft','glow-pulse','wave'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="block text-xs text-slate-400">Easing<select value={activeRule.config.easing} onChange={(event) => updateConfig('easing', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white">{['smooth','spring','snappy','linear'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">Duration · {activeRule.config.duration.toFixed(2)}s<input type="range" min=".15" max="3" step=".05" value={activeRule.config.duration} onChange={(event) => updateConfig('duration', Number(event.target.value))} className="mt-2 w-full accent-violet-400"/></label><label className="text-xs text-slate-400">Delay · {activeRule.config.delay.toFixed(2)}s<input type="range" min="0" max="2.5" step=".05" value={activeRule.config.delay} onChange={(event) => updateConfig('delay', Number(event.target.value))} className="mt-2 w-full accent-violet-400"/></label></div>
          <label className="flex items-center justify-between text-xs text-slate-400">Stagger children<input type="checkbox" checked={activeRule.config.staggerChildren} onChange={(event) => updateConfig('staggerChildren', event.target.checked)} className="accent-violet-400"/></label>
        </section>}

        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between text-xs"><span className="font-semibold">Preview on canvas</span><button type="button" onClick={() => setPreview((value) => !value)} className={`${buttonClass} py-1.5`}><Play size={12}/>{preview ? 'Preview enabled' : 'Preview mode'}</button></div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Preview mode is a draft state; apply commits the generated rules to the project.</p>
        </section>
        {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-300">{notice}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-700 bg-[#11151a] p-3">
        <button type="button" onClick={() => { setDraft(preset); setPreview(false); setNotice('Changes reverted.'); setError(''); }} className={buttonClass}><RotateCcw size={13}/> Revert</button>
        <button type="button" onClick={apply} disabled={!draft.rules.length} className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 disabled:opacity-40"><Check size={14}/> Apply to project</button>
      </div>
    </aside>
  );
}
