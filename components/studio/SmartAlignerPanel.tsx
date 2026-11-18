'use client';

import React, { useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Columns2,
  Columns3,
  LayoutGrid,
  Monitor,
  RotateCcw,
  Rows3,
  Smartphone,
  Sparkles,
  StretchVertical,
  Tablet,
  Wand2,
  WrapText,
  X,
} from 'lucide-react';
import {
  AlignBreakpointScope,
  AutoAlignMode,
  BlockRedesignPattern,
  HorizontalAlign,
  ResponsiveDiagnosticReport,
  SpacingDensity,
  VerticalAlign,
  WidthPreset,
  resolveEffectiveBreakpoint,
  scanResponsiveIssues,
} from '@/lib/studio/smart-aligner';
import { StudioElementSnapshot, ViewportPreset } from '@/lib/studio/types';

interface SmartAlignerPanelProps {
  selected: StudioElementSnapshot | null;
  activeFilePath: string;
  activeFileCode: string;
  viewport: ViewportPreset;
  onChangeViewport: (vp: ViewportPreset) => void;
  breakpointScope: AlignBreakpointScope;
  onChangeBreakpointScope: (scope: AlignBreakpointScope) => void;
  onAutoAlign: (mode: AutoAlignMode, scopeElementIndex?: number) => {
    changesCount: number;
    summary: string[];
  };
  onAlignElement: (opts: {
    filePath: string;
    elementIndex: number;
    horizontal?: HorizontalAlign;
    vertical?: VerticalAlign;
  }) => void;
  onRedesignBlock: (
    filePath: string,
    elementIndex: number,
    pattern: BlockRedesignPattern
  ) => void;
  onApplyWidthAndSpacing: (
    filePath: string,
    elementIndex: number,
    opts: { widthPreset?: WidthPreset; density?: SpacingDensity }
  ) => void;
  onResetManualOffsets: (filePath: string, elementIndex: number) => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

const SCOPE_OPTIONS: Array<{ id: AlignBreakpointScope; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: 'Follows active preview viewport' },
  { id: 'mobile', label: 'Mobile', hint: 'Mobile base + preserves Desktop lg:' },
  { id: 'tablet', label: 'Tablet', hint: 'Edits md: classes (768px+)' },
  { id: 'desktop', label: 'Desktop', hint: 'Edits lg: classes (1024px+)' },
  { id: 'all', label: 'All Sizes', hint: 'Applies across all viewports' },
];

const REDESIGN_PRESETS: Array<{
  id: BlockRedesignPattern;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'stack', label: 'Stack', desc: 'flex-col', icon: Rows3 },
  { id: 'split-2', label: '2-Col Split', desc: '1→2 col', icon: Columns2 },
  { id: 'grid-3', label: '3-Col Cards', desc: '1→2→3 col', icon: Columns3 },
  { id: 'wrap-row', label: 'Wrap Row', desc: 'flex-wrap', icon: WrapText },
  { id: 'center-hero', label: 'Center Hero', desc: 'mx-auto', icon: AlignCenter },
  { id: 'space-bar', label: 'Top/Bot Bar', desc: 'col→between', icon: AlignHorizontalSpaceBetween },
  { id: 'card-polish', label: 'Card Frame', desc: 'border+pad', icon: LayoutGrid },
];

export default function SmartAlignerPanel({
  selected,
  activeFilePath,
  activeFileCode,
  viewport,
  onChangeViewport,
  breakpointScope,
  onChangeBreakpointScope,
  onAutoAlign,
  onAlignElement,
  onRedesignBlock,
  onApplyWidthAndSpacing,
  onResetManualOffsets,
  onClose,
  isBottomSheet = false,
}: SmartAlignerPanelProps) {
  const [lastAutoResult, setLastAutoResult] = useState<{
    changesCount: number;
    summary: string[];
  } | null>(null);

  const effectiveBp = resolveEffectiveBreakpoint(breakpointScope, viewport);
  const isHtml = /\.html?$/i.test(activeFilePath);

  const diagnostics: ResponsiveDiagnosticReport = useMemo(
    () => scanResponsiveIssues(activeFileCode, isHtml),
    [activeFileCode, isHtml]
  );

  const targetFilePath = selected?.filePath || activeFilePath;
  const targetElementIndex = selected?.elementIndex ?? 0;
  const targetLabel = selected ? `<${selected.tagName}>` : 'Root container';

  const runAuto = (mode: AutoAlignMode, onlySelectedBlock = false) => {
    const res = onAutoAlign(
      mode,
      onlySelectedBlock && selected ? selected.elementIndex : undefined
    );
    setLastAutoResult(res);
  };

  return (
    <section
      aria-label="Smart Aligner"
      className={`flex flex-col bg-white ${
        isBottomSheet
          ? 'h-full w-full rounded-t-2xl'
          : 'shrink-0 border-t border-slate-200 max-h-[340px]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Wand2 className="h-4 w-4 shrink-0 text-indigo-600" />
          <h2 className="text-xs font-semibold text-slate-900 whitespace-nowrap">
            Smart Aligner
          </h2>
          <span className="hidden sm:inline text-xs text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="truncate font-mono text-[11px] text-slate-500">
            {targetLabel} · {effectiveBp}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Preview Viewport Switch inside Smart Aligner */}
          <div
            className="flex items-center rounded-md border border-slate-200 bg-white p-0.5"
            role="group"
            aria-label="Preview viewport for alignment check"
          >
            {(
              [
                { id: 'desktop', icon: Monitor, label: 'Desktop' },
                { id: 'tablet', icon: Tablet, label: 'Tablet' },
                { id: 'mobile', icon: Smartphone, label: 'Mobile' },
              ] as Array<{
                id: ViewportPreset;
                icon: React.ComponentType<{ className?: string }>;
                label: string;
              }>
            ).map((vp) => {
              const Icon = vp.icon;
              return (
                <button
                  key={vp.id}
                  type="button"
                  aria-label={`Preview ${vp.label} viewport`}
                  aria-pressed={viewport === vp.id}
                  onClick={() => onChangeViewport(vp.id)}
                  className={`inline-flex h-7 sm:h-6 items-center gap-1 rounded px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${
                    viewport === vp.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden md:inline">{vp.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Close Smart Aligner"
            onClick={onClose}
            className="inline-flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 studio-scroll">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[248px_1fr_1fr]">
          {/* Column 1: Breakpoint Scope & Auto-Align */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-700">
                  Target Breakpoint
                </span>
                <span className="font-mono text-[10px] text-indigo-600">
                  {effectiveBp === 'mobile'
                    ? 'base + lg:keep'
                    : effectiveBp === 'tablet'
                    ? 'md:*'
                    : effectiveBp === 'desktop'
                    ? 'lg:*'
                    : 'all widths'}
                </span>
              </div>
              <div
                className="grid grid-cols-5 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                role="group"
                aria-label="Target responsive breakpoint"
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.hint}
                    aria-pressed={breakpointScope === opt.id}
                    onClick={() => onChangeBreakpointScope(opt.id)}
                    className={`h-8 sm:h-7 rounded-md px-1 text-[10px] font-medium whitespace-nowrap transition-colors ${
                      breakpointScope === opt.id
                        ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-800">
                  Auto-Align &amp; Responsive Fix
                </span>
                <span className="font-mono tabular-nums text-[10px] text-slate-500">
                  {diagnostics.issues.length} detected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => runAuto('responsive-all', false)}
                  className="inline-flex h-9 sm:h-8 w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Auto-Align Page (Mobile + Desktop)</span>
                </button>

                {selected && (
                  <button
                    type="button"
                    onClick={() => runAuto('responsive-all', true)}
                    className="inline-flex h-9 sm:h-8 w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-50 whitespace-nowrap"
                  >
                    <Wand2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Auto-Align Selected &lt;{selected.tagName}&gt;</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => runAuto('mobile-first', Boolean(selected))}
                  className="h-8 sm:h-7 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  Mobile Fit
                </button>
                <button
                  type="button"
                  onClick={() => runAuto('desktop-balance', Boolean(selected))}
                  className="h-8 sm:h-7 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  Desktop Fit
                </button>
                <button
                  type="button"
                  onClick={() => runAuto('center-focus', Boolean(selected))}
                  className="h-8 sm:h-7 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  Center All
                </button>
              </div>

              {lastAutoResult && (
                <p
                  role="status"
                  className="text-[11px] leading-snug text-slate-600"
                >
                  {lastAutoResult.changesCount > 0
                    ? `Aligned ${lastAutoResult.changesCount} block(s): ${lastAutoResult.summary[0] || 'responsive classes updated'}.`
                    : 'Blocks are already aligned for mobile & desktop.'}
                </p>
              )}
            </div>
          </div>

          {/* Column 2: Manual Horizontal & Vertical Alignment + Size/Spacing */}
          <div className="space-y-3">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-700">
                Manual Alignment ({targetLabel} · {effectiveBp})
              </span>

              <div className="space-y-2">
                <div>
                  <span className="mb-1 block text-[10px] text-slate-500">Horizontal</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'left', label: 'Left', icon: AlignHorizontalJustifyStart },
                        { id: 'center', label: 'Center', icon: AlignHorizontalJustifyCenter },
                        { id: 'right', label: 'Right', icon: AlignHorizontalJustifyEnd },
                        { id: 'between', label: 'Between', icon: AlignHorizontalSpaceBetween },
                      ] as Array<{
                        id: HorizontalAlign;
                        label: string;
                        icon: React.ComponentType<{ className?: string }>;
                      }>
                    ).map((h) => {
                      const Icon = h.icon;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          aria-label={`Align horizontal ${h.label.toLowerCase()}`}
                          onClick={() =>
                            onAlignElement({
                              filePath: targetFilePath,
                              elementIndex: targetElementIndex,
                              horizontal: h.id,
                            })
                          }
                          className="inline-flex h-9 sm:h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 whitespace-nowrap"
                        >
                          <Icon className="h-3 w-3 shrink-0" />
                          <span>{h.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-[10px] text-slate-500">Vertical</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'top', label: 'Top', icon: AlignVerticalJustifyStart },
                        { id: 'middle', label: 'Middle', icon: AlignVerticalJustifyCenter },
                        { id: 'bottom', label: 'Bottom', icon: AlignVerticalJustifyEnd },
                        { id: 'stretch', label: 'Stretch', icon: StretchVertical },
                      ] as Array<{
                        id: VerticalAlign;
                        label: string;
                        icon: React.ComponentType<{ className?: string }>;
                      }>
                    ).map((v) => {
                      const Icon = v.icon;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          aria-label={`Align vertical ${v.label.toLowerCase()}`}
                          onClick={() =>
                            onAlignElement({
                              filePath: targetFilePath,
                              elementIndex: targetElementIndex,
                              vertical: v.id,
                            })
                          }
                          className="inline-flex h-9 sm:h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 whitespace-nowrap"
                        >
                          <Icon className="h-3 w-3 shrink-0" />
                          <span>{v.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="mb-1 block text-[10px] font-medium text-slate-500">
                  Container Width
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {(['full', 'compact', 'wide'] as WidthPreset[]).map((wp) => (
                    <button
                      key={wp}
                      type="button"
                      onClick={() =>
                        onApplyWidthAndSpacing(targetFilePath, targetElementIndex, {
                          widthPreset: wp,
                        })
                      }
                      className="h-8 sm:h-7 rounded border border-slate-200 bg-white px-2 text-[11px] font-medium capitalize text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 whitespace-nowrap"
                    >
                      {wp}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-medium text-slate-500">
                  Spacing Density
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {(['tight', 'normal', 'airy'] as SpacingDensity[]).map((den) => (
                    <button
                      key={den}
                      type="button"
                      onClick={() =>
                        onApplyWidthAndSpacing(targetFilePath, targetElementIndex, {
                          density: den,
                        })
                      }
                      className="h-8 sm:h-7 rounded border border-slate-200 bg-white px-2 text-[11px] font-medium capitalize text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 whitespace-nowrap"
                    >
                      {den}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Block & Component Redesign Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700">
                Redesign Block Layout
              </span>
              <button
                type="button"
                onClick={() => onResetManualOffsets(targetFilePath, targetElementIndex)}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear Offsets</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {REDESIGN_PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.desc}
                    onClick={() =>
                      onRedesignBlock(targetFilePath, targetElementIndex, preset.id)
                    }
                    className="flex h-9 sm:h-8 items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-left hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                      <span className="truncate text-[11px] font-medium text-slate-800">
                        {preset.label}
                      </span>
                    </span>
                    <span className="hidden 2xl:inline shrink-0 font-mono text-[9px] text-slate-400">
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
              <span>Quick Text Align:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'left', icon: AlignLeft, label: 'Text left' },
                    { id: 'center', icon: AlignCenter, label: 'Text center' },
                    { id: 'right', icon: AlignRight, label: 'Text right' },
                  ] as Array<{
                    id: HorizontalAlign;
                    icon: React.ComponentType<{ className?: string }>;
                    label: string;
                  }>
                ).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={t.label}
                      onClick={() =>
                        onAlignElement({
                          filePath: targetFilePath,
                          elementIndex: targetElementIndex,
                          horizontal: t.id,
                        })
                      }
                      className="inline-flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
