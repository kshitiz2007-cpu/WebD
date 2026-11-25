'use client';

import React, { useState } from 'react';
import {
  Clapperboard,
  Layers,
  MousePointerClick,
  Play,
  Repeat,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  AMBIENT_LOOP_PRESETS,
  AnimationEasing,
  DEFAULT_ANIMATION_CONFIG,
  EASING_CURVES,
  ElementAnimationConfig,
  HOVER_INTERACTION_PRESETS,
  SCROLL_REVEAL_PRESETS,
  parseAnimationConfigFromElement,
} from '@/lib/studio/animation-studio';
import type { StudioElementSnapshot } from '@/lib/studio/types';

interface AnimationStudioPanelProps {
  selected: StudioElementSnapshot | null;
  animatedSummary: {
    revealCount: number;
    hoverCount: number;
    loopCount: number;
    total: number;
  };
  onApplyAnimation: (config: ElementAnimationConfig) => void;
  onReplayAnimations: () => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

export default function AnimationStudioPanel({
  selected,
  animatedSummary,
  onApplyAnimation,
  onReplayAnimations,
  onClose,
  isBottomSheet = false,
}: AnimationStudioPanelProps) {
  const selectedSyncKey = selected
    ? `${selected.studioId}::${selected.className}::${selected.inlineStyles['--webd-anim-duration'] || ''}::${selected.inlineStyles['--webd-anim-delay'] || ''}::${selected.inlineStyles['--webd-anim-ease'] || ''}::${selected.inlineStyles['--webd-stagger-step'] || ''}`
    : 'none';

  const [lastSyncKey, setLastSyncKey] = useState<string>(selectedSyncKey);
  const [motionTargetKey, setMotionTargetKey] = useState(selectedSyncKey);
  type MotionFrame = { id: string; at: number; x: number; y: number; scale: number; rotate: number };
  const [keyframes, setKeyframes] = useState<MotionFrame[]>([]);
  const [frame, setFrame] = useState<MotionFrame>({id:'draft',at:100,x:0,y:0,scale:1,rotate:0});
  const [timelineDuration, setTimelineDuration] = useState(1.2);
  const [timelineRepeat, setTimelineRepeat] = useState('1');
  const [heroMotionBundle, setHeroMotionBundle] = useState(false);
  const addFrame = () => setKeyframes(current => [...current.filter(k=>k.at!==frame.at),{...frame,id:`frame-${frame.at}-${Date.now()}`}].sort((a,b)=>a.at-b.at));
  const loadHeroPreset = () => {
    setHeroMotionBundle(true);
    setKeyframes([
      { id: 'hero-0', at: 0, x: 0, y: 35, scale: 0.94, rotate: 0 },
      { id: 'hero-25', at: 25, x: 0, y: 15, scale: 0.97, rotate: 0 },
      { id: 'hero-50', at: 50, x: 0, y: 4, scale: 0.99, rotate: 0 },
      { id: 'hero-100', at: 100, x: 0, y: 0, scale: 1, rotate: 0 },
    ]);
    setFrame({ id: 'hero-100', at: 100, x: 0, y: 0, scale: 1, rotate: 0 });
    setTimelineDuration(1.4);
    setTimelineRepeat('1');
    setDraft(prev => ({ ...prev, reveal: 'none', hover: 'none', loop: 'none', duration: 0.9, delay: 0, easing: 'smooth', staggerChildren: false, once: true }));
  };
  const timelineCss = () => {
    if (keyframes.length < 2) return null;
    const name = `webd-custom-motion-${(selected?.studioId || 'target').replace(/[^a-zA-Z0-9_-]/g,'')}`;
    const stops = keyframes.slice().sort((a,b)=>a.at-b.at).map(k=>`  ${k.at}% { transform: translate(${k.x}px, ${k.y}px) scale(${k.scale}) rotate(${k.rotate}deg); }`).join('\n');
    const repeat = timelineRepeat==='infinite'?'infinite':timelineRepeat;
    const parentAnimation = `${name} ${timelineDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${repeat} forwards`;
    const bundleCss = heroMotionBundle ? `
@keyframes ${name}-bg-zoom { from { background-size: 100% 100%; } to { background-size: 112% 112%; } }
@keyframes ${name}-heading { from { opacity: 0; transform: translateY(24px); filter: blur(5px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
@keyframes ${name}-copy { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ${name}-action { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.${name} { background-position: center; background-repeat: no-repeat; animation: ${parentAnimation}, ${name}-bg-zoom ${Math.max(6, timelineDuration * 5)}s ease-out 1 forwards; }
.${name} h1, .${name} h2, .${name} h3 { animation: ${name}-heading .85s cubic-bezier(.22,1,.36,1) .22s both; }
.${name} p { animation: ${name}-copy .7s cubic-bezier(.22,1,.36,1) .42s both; }
.${name} a, .${name} button { animation: ${name}-action .65s cubic-bezier(.22,1,.36,1) .6s both; transition: transform .2s ease, box-shadow .2s ease; }
.${name} a:hover, .${name} button:hover { transform: translateY(-2px) scale(1.025); box-shadow: 0 10px 28px rgba(20, 50, 100, .18); }
.${name} a:nth-of-type(2), .${name} button:nth-of-type(2) { animation-delay: .76s; }
` : `.${name} { animation: ${parentAnimation; }`;
    const reducedMotion = heroMotionBundle ? `@media (prefers-reduced-motion: reduce) { .${name}, .${name} h1, .${name} h2, .${name} h3, .${name} p, .${name} a, .${name} button { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; } }` : '';
    return {name,css:`@keyframes ${name} {\n${stops}\n}\n${bundleCss}\n${reducedMotion}`};
  };
  const previewTimeline = () => {
    const result=timelineCss(); if(!result||!selected)return;
    let style=document.getElementById('webd-motion-timeline-preview') as HTMLStyleElement|null;
    if(!style){style=document.createElement('style');style.id='webd-motion-timeline-preview';document.head.appendChild(style);}
    style.textContent=result.css;
    const el=document.querySelector(`[data-studio-id="${CSS.escape(selected.studioId)}"]`) as HTMLElement|null;
    if(el){el.classList.remove(result.name);void el.offsetWidth;el.classList.add(result.name);}
  };
  const applyTimeline = () => {
    const result = timelineCss();
    if (!result || !selected) return;
    const styleId = 'webd-motion-timeline-preview';
    const previewStyle = document.getElementById(styleId);
    if (previewStyle) previewStyle.remove();
    onApplyAnimation({ ...draft, reveal: 'none', hover: 'none', loop: 'none', duration: timelineDuration, easing: 'smooth', customCss: result.css, customClass: result.name } as ElementAnimationConfig);
  };
  const [draft, setDraft] = useState<ElementAnimationConfig>(() =>
    selected
      ? parseAnimationConfigFromElement(selected.className, selected.inlineStyles)
      : { ...DEFAULT_ANIMATION_CONFIG }
  );

  if (selectedSyncKey !== motionTargetKey) {
    setMotionTargetKey(selectedSyncKey);
    setKeyframes([]);
    setHeroMotionBundle(false);
    setFrame({ id: 'draft', at: 100, x: 0, y: 0, scale: 1, rotate: 0 });
  }

  if (selectedSyncKey !== lastSyncKey) {
    setLastSyncKey(selectedSyncKey);
    setDraft(
      selected
        ? parseAnimationConfigFromElement(selected.className, selected.inlineStyles)
        : { ...DEFAULT_ANIMATION_CONFIG }
    );
  }

  const hasDraftMotion =
    draft.reveal !== 'none' || draft.hover !== 'none' || draft.loop !== 'none';

  const handleClear = () => {
    const cleared: ElementAnimationConfig = { ...DEFAULT_ANIMATION_CONFIG };
    setDraft(cleared);
    onApplyAnimation(cleared);
  };

  return (
    <aside
      aria-label="Scroll and Micro-Interaction Animation Studio"
      className={`flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl ${
        isBottomSheet ? 'rounded-t-2xl' : 'w-80 sm:w-[360px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Clapperboard className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold text-slate-900">
                Motion Studio
              </h2>
              {animatedSummary.total > 0 && (
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                  {animatedSummary.total}
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-slate-500">
              Scroll-reveal, hover &amp; ambient physics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReplayAnimations}
            aria-label="Replay animations on canvas"
            title="Replay all scroll & entrance animations"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Replay</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close motion studio"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {/* Selected Target Card */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Target Element
            </span>
            {selected && (
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700 border border-slate-200">
                &lt;{selected.tagName}&gt;
              </span>
            )}
          </div>
          {selected ? (
            <div className="space-y-1">
              <p className="truncate text-xs font-semibold text-slate-900">
                {selected.label || selected.textContent || `<${selected.tagName}>`}
              </p>
              <p className="truncate font-mono text-[10px] text-slate-500">
                {selected.filePath}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Click any card, heading, image, or button on the canvas to attach scroll-reveal or hover animations.
            </p>
          )}
        </section>


        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <div><h3 className="text-xs font-semibold text-slate-900">Keyframe Timeline</h3><p className="text-[10px] text-slate-500">Framer-style transform animation</p></div>
            <span className="rounded bg-white px-2 py-1 font-mono text-[10px] text-indigo-700">{keyframes.length} frames</span>
          </div>
          <button type="button" disabled={!selected} onClick={loadHeroPreset} className="w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-[11px] font-semibold text-indigo-700 disabled:opacity-40">Load Hero Motion Bundle <span className="font-normal text-indigo-500">· background + heading + copy + CTA</span></button>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-medium text-slate-600">X · {frame.x}px<input type="range" min={-240} max={240} value={frame.x} onChange={e=>setFrame(v=>({...v,x:Number(e.target.value)}))} className="w-full accent-indigo-600"/></label>
            <label className="text-[10px] font-medium text-slate-600">Y · {frame.y}px<input type="range" min={-240} max={240} value={frame.y} onChange={e=>setFrame(v=>({...v,y:Number(e.target.value)}))} className="w-full accent-indigo-600"/></label>
            <label className="text-[10px] font-medium text-slate-600">Scale · {frame.scale.toFixed(2)}×<input type="range" min={0.25} max={2} step={0.05} value={frame.scale} onChange={e=>setFrame(v=>({...v,scale:Number(e.target.value)}))} className="w-full accent-indigo-600"/></label>
            <label className="text-[10px] font-medium text-slate-600">Rotate · {frame.rotate}°<input type="range" min={-180} max={180} value={frame.rotate} onChange={e=>setFrame(v=>({...v,rotate:Number(e.target.value)}))} className="w-full accent-indigo-600"/></label>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-[10px] font-semibold text-slate-600">Position<select value={frame.at} onChange={e=>setFrame(v=>({...v,at:Number(e.target.value)}))} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value={0}>Start · 0%</option><option value={25}>25%</option><option value={50}>Middle · 50%</option><option value={75}>75%</option><option value={100}>End · 100%</option></select></label>
            <button type="button" disabled={!selected} onClick={addFrame} className="h-8 rounded-md bg-indigo-600 px-3 text-[11px] font-semibold text-white disabled:opacity-40">Add frame</button>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Timeline</span><button type="button" onClick={()=>setKeyframes([])} disabled={!keyframes.length} className="text-[10px] font-semibold text-rose-600 disabled:opacity-40">Clear</button></div>
            <div className="relative h-9 rounded bg-slate-100"><div className="absolute inset-x-2 top-1/2 h-px bg-slate-300"/>{[0,25,50,75,100].map(p=><span key={p} className="absolute top-0 h-full border-l border-slate-300" style={{left:`calc(8px + (100% - 16px) * ${p/100})`}}/>)}{keyframes.map(k=><button key={k.id} type="button" title={`${k.at}%`} onClick={()=>setFrame(k)} className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm border-2 border-white bg-indigo-600 shadow" style={{left:`calc(8px + (100% - 16px) * ${k.at/100})`}}/>)}</div>
            {keyframes.length===0?<p className="text-[10px] text-slate-400">Add at least two keyframes to create a sequence.</p>:<div className="flex flex-wrap gap-1">{keyframes.slice().sort((a,b)=>a.at-b.at).map(k=><button key={k.id} type="button" onClick={()=>setFrame(k)} className="rounded border border-slate-200 px-2 py-1 text-[9px] font-mono text-slate-600">{k.at}% · {k.x},{k.y}</button>)}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-semibold text-slate-600">Duration (s)<input type="number" min={0.1} max={20} step={0.1} value={timelineDuration} onChange={e=>setTimelineDuration(Math.max(0.1,Math.min(20,Number(e.target.value)||1)))} className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs"/></label>
            <label className="text-[10px] font-semibold text-slate-600">Repeat<select value={timelineRepeat} onChange={e=>setTimelineRepeat(e.target.value)} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="1">Once</option><option value="2">2 times</option><option value="3">3 times</option><option value="infinite">Loop</option></select></label>
          </div>
          <div className="flex gap-2"><button type="button" disabled={!selected||keyframes.length<2} onClick={previewTimeline} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"><Play className="h-3 w-3"/>Preview</button><button type="button" disabled={!selected||keyframes.length<2} onClick={applyTimeline} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-700 disabled:opacity-40">Apply CSS</button></div>
        </section>

        {/* 1. Scroll-Reveal Presets */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Scroll-Reveal Entrance</span>
            </h3>
            <span className="text-[10px] font-medium text-slate-400">
              IntersectionObserver
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {SCROLL_REVEAL_PRESETS.map((preset) => {
              const active = draft.reveal === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!selected}
                  onClick={() => setDraft((prev) => ({ ...prev, reveal: preset.id }))}
                  title={preset.hint}
                  aria-pressed={active}
                  className={`rounded-lg border px-2 py-2 text-left transition-colors disabled:opacity-45 ${
                    active
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block truncate text-[11px] font-semibold">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                    {preset.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Timing & Stagger Controls */}
          {draft.reveal !== 'none' && (
            <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <label
                      htmlFor="motion-duration-range"
                      className="font-medium text-slate-700"
                    >
                      Duration
                    </label>
                    <span className="font-mono text-[10px] font-semibold tabular-nums text-indigo-700">
                      {draft.duration.toFixed(2)}s
                    </span>
                  </div>
                  <input
                    id="motion-duration-range"
                    type="range"
                    min={0.15}
                    max={2}
                    step={0.05}
                    value={draft.duration}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        duration: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <label
                      htmlFor="motion-delay-range"
                      className="font-medium text-slate-700"
                    >
                      Delay
                    </label>
                    <span className="font-mono text-[10px] font-semibold tabular-nums text-indigo-700">
                      {draft.delay.toFixed(2)}s
                    </span>
                  </div>
                  <input
                    id="motion-delay-range"
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={draft.delay}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        delay: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="motion-easing-select"
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Easing Curve
                  </label>
                  <select
                    id="motion-easing-select"
                    value={draft.easing}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        easing: e.target.value as AnimationEasing,
                      }))
                    }
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    {(Object.entries(EASING_CURVES) as Array<
                      [AnimationEasing, { label: string; css: string }]
                    >).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Trigger Mode
                  </span>
                  <div className="grid grid-cols-2 rounded-md border border-slate-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, once: true }))}
                      className={`rounded py-1 text-[11px] font-semibold transition-colors ${
                        draft.once
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Once
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, once: false }))}
                      className={`rounded py-1 text-[11px] font-semibold transition-colors ${
                        !draft.once
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Repeat
                    </button>
                  </div>
                </div>
              </div>

              {/* Stagger Children Toggle */}
              <div className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-2">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Stagger direct children</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.staggerChildren}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        staggerChildren: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
                {draft.staggerChildren && (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <label
                        htmlFor="motion-stagger-range"
                        className="text-slate-600"
                      >
                        Step interval
                      </label>
                      <span className="font-mono text-[10px] font-semibold tabular-nums text-indigo-700">
                        {draft.staggerStepMs}ms
                      </span>
                    </div>
                    <input
                      id="motion-stagger-range"
                      type="range"
                      min={40}
                      max={220}
                      step={10}
                      value={draft.staggerStepMs}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          staggerStepMs: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-indigo-600"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 2. Hover & Tap Micro-Interactions */}
        <section className="space-y-2.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <MousePointerClick className="h-3.5 w-3.5 text-emerald-600" />
            <span>Hover &amp; Tap Micro-Interaction</span>
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {HOVER_INTERACTION_PRESETS.map((preset) => {
              const active = draft.hover === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!selected}
                  onClick={() => setDraft((prev) => ({ ...prev, hover: preset.id }))}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-45 ${
                    active
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block truncate text-[11px] font-semibold">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                    {preset.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Continuous Ambient Loops */}
        <section className="space-y-2.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Repeat className="h-3.5 w-3.5 text-violet-600" />
            <span>Continuous Ambient Loop</span>
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {AMBIENT_LOOP_PRESETS.map((preset) => {
              const active = draft.loop === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!selected}
                  onClick={() => setDraft((prev) => ({ ...prev, loop: preset.id }))}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-45 ${
                    active
                      ? 'border-violet-600 bg-violet-50 text-violet-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block truncate text-[11px] font-semibold">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                    {preset.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <button
          type="button"
          disabled={!selected}
          onClick={() => onApplyAnimation(draft)}
          className="inline-flex flex-1 h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Play className="h-3.5 w-3.5" />
          <span>Apply &amp; Preview</span>
        </button>
        <button
          type="button"
          disabled={!selected || !hasDraftMotion}
          onClick={handleClear}
          aria-label="Clear animations from selected element"
          title="Remove all animations from selected element"
          className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear</span>
        </button>
      </div>
    </aside>
  );
}
