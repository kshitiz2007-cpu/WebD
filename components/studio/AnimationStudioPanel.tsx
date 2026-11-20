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
  const [draft, setDraft] = useState<ElementAnimationConfig>(() =>
    selected
      ? parseAnimationConfigFromElement(selected.className, selected.inlineStyles)
      : { ...DEFAULT_ANIMATION_CONFIG }
  );

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
