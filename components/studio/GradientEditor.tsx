'use client';

import React, { useMemo, useState } from 'react';
import { BookmarkPlus, X } from 'lucide-react';
import {
  buildGradientCss,
  GRADIENT_PRESETS,
  isFullHexInput,
  isValidHexInput,
  normalizeHex,
  resizeGradientStops,
} from '@/lib/studio/gradient';
import {
  deleteCustomGradientPreset,
  getCustomGradientsSnapshot,
  parseCustomGradientPresetsJson,
  saveCustomGradientPreset,
  saveLastGradientConfig,
  subscribeGradientStorage,
} from '@/lib/studio/gradient-persistence';
import { GradientConfig } from '@/lib/studio/types';

interface GradientEditorProps {
  selectionKey?: string;
  value: GradientConfig;
  onPreview: (config: GradientConfig, cssValue: string) => void;
  onCommit: (config: GradientConfig, cssValue: string) => void;
  onClearFill: () => void;
}

export default function GradientEditor({
  selectionKey = '',
  value,
  onPreview,
  onCommit,
  onClearFill,
}: GradientEditorProps) {
  const [config, setConfig] = useState<GradientConfig>(value);
  const [hexDrafts, setHexDrafts] = useState<string[]>(value.stops.map((s) => s.color));
  const incomingSignature = `${selectionKey}:${value.type}:${value.target}:${value.stopCount}:${buildGradientCss(value)}`;
  const [prevSignature, setPrevSignature] = useState<string>(incomingSignature);

  const customGradientsJson = React.useSyncExternalStore(
    subscribeGradientStorage,
    getCustomGradientsSnapshot,
    () => '[]'
  );
  const customPresets = useMemo(
    () => parseCustomGradientPresetsJson(customGradientsJson),
    [customGradientsJson]
  );

  if (prevSignature !== incomingSignature) {
    setPrevSignature(incomingSignature);
    const localCss = buildGradientCss(config);
    const incomingCss = buildGradientCss(value);
    const elementChanged = !prevSignature.startsWith(`${selectionKey}:`);
    // Only overwrite local drafts if the user switched elements or an external change altered the CSS
    if (elementChanged || incomingCss !== localCss || value.type !== config.type || value.target !== config.target) {
      setConfig(value);
      setHexDrafts(value.stops.map((s) => s.color));
    }
  }

  const applyUpdate = (next: GradientConfig, commit: boolean) => {
    setConfig(next);
    const css = buildGradientCss(next);
    if (commit && next.type !== 'solid') {
      saveLastGradientConfig(next);
    }
    if (commit) onCommit(next, css);
    else onPreview(next, css);
  };

  const handleTypeChange = (type: 'solid' | 'linear' | 'radial') => {
    const next: GradientConfig = { ...config, type };
    applyUpdate(next, true);
  };

  const handleStopCountChange = (stopCount: 2 | 3 | 4) => {
    const resized = resizeGradientStops(config.stops, stopCount);
    setHexDrafts(resized.map((s) => s.color));
    const next: GradientConfig = { ...config, stopCount, stops: resized };
    applyUpdate(next, true);
  };

  const handleTargetChange = (target: 'background' | 'text') => {
    const next: GradientConfig = { ...config, target };
    applyUpdate(next, true);
  };

  const handleStopColorPicker = (idx: number, hex: string, commit: boolean) => {
    const normalized = normalizeHex(hex, config.stops[idx]?.color || '#2563EB');
    const nextStops = config.stops.map((s, i) => (i === idx ? { ...s, color: normalized } : s));
    const nextDrafts = [...hexDrafts];
    nextDrafts[idx] = normalized;
    setHexDrafts(nextDrafts);
    applyUpdate({ ...config, stops: nextStops }, commit);
  };

  const handleStopHexInput = (idx: number, raw: string) => {
    const nextDrafts = [...hexDrafts];
    nextDrafts[idx] = raw;
    setHexDrafts(nextDrafts);
    if (isFullHexInput(raw)) {
      const normalized = normalizeHex(raw);
      const nextStops = config.stops.map((s, i) => (i === idx ? { ...s, color: normalized } : s));
      applyUpdate({ ...config, stops: nextStops }, true);
    }
  };

  const commitStopHexDraft = (idx: number) => {
    const raw = hexDrafts[idx] ?? '';
    if (isValidHexInput(raw)) {
      const normalized = normalizeHex(raw);
      const nextDrafts = [...hexDrafts];
      nextDrafts[idx] = normalized;
      setHexDrafts(nextDrafts);
      const nextStops = config.stops.map((s, i) => (i === idx ? { ...s, color: normalized } : s));
      applyUpdate({ ...config, stops: nextStops }, true);
    } else {
      const nextDrafts = [...hexDrafts];
      nextDrafts[idx] = config.stops[idx]?.color || '#2563EB';
      setHexDrafts(nextDrafts);
    }
  };

  const handleStopPosChange = (idx: number, rawPos: number, commit: boolean) => {
    const pos = Math.max(0, Math.min(100, Math.round(rawPos)));
    const nextStops = config.stops.map((s, i) => (i === idx ? { ...s, position: pos } : s));
    applyUpdate({ ...config, stops: nextStops }, commit);
  };

  const previewCss = buildGradientCss(config);
  const activeStops = config.stops.slice(0, config.stopCount);

  return (
    <div className="space-y-3">
      {/* Fill Type Segmented Control */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="grid flex-1 grid-cols-3 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
          role="group"
          aria-label="Fill type"
        >
          {(['solid', 'linear', 'radial'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`rounded-md py-1.5 sm:py-1 text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                config.type === t
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClearFill}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 sm:px-2 sm:py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
        >
          Clear
        </button>
      </div>

      {/* Apply Target (Background vs Text Gradient) */}
      <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
        <button
          type="button"
          onClick={() => handleTargetChange('background')}
          className={`rounded-md py-1.5 sm:py-1 text-[11px] font-medium whitespace-nowrap ${
            config.target === 'background'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Surface Fill
        </button>
        <button
          type="button"
          onClick={() => handleTargetChange('text')}
          className={`rounded-md py-1.5 sm:py-1 text-[11px] font-medium whitespace-nowrap ${
            config.target === 'text'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Text Fill
        </button>
      </div>

      {/* Solid Color Controls */}
      {config.type === 'solid' ? (
        <div className="flex items-center gap-2">
          <label htmlFor="solid-fill-picker" className="sr-only">
            Solid color picker
          </label>
          <input
            id="solid-fill-picker"
            type="color"
            value={normalizeHex(activeStops[0]?.color || '#FFFFFF', '#FFFFFF')}
            onChange={(e) => handleStopColorPicker(0, e.target.value, true)}
            className="h-9 w-10 sm:h-8 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
          />
          <label htmlFor="solid-fill-hex" className="sr-only">
            Solid hex color
          </label>
          <input
            id="solid-fill-hex"
            type="text"
            value={hexDrafts[0] ?? '#FFFFFF'}
            onChange={(e) => handleStopHexInput(0, e.target.value)}
            onBlur={() => commitStopHexDraft(0)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitStopHexDraft(0);
            }}
            placeholder="#FFFFFF"
            className="h-9 sm:h-8 flex-1 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs uppercase text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>
      ) : (
        <>
          {/* Live Gradient Bar Preview */}
          <div
            className="h-7 w-full rounded-md border border-slate-200 shadow-inner"
            style={{ background: previewCss }}
            aria-label="Gradient preview bar"
          />

          {/* Stop Count Selector (2, 3, 4 Stops) */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-600">Color Stops</span>
            <div
              className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Gradient stop count"
            >
              {([2, 3, 4] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleStopCountChange(count)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                    config.stopCount === count
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {count}-Stop
                </button>
              ))}
            </div>
          </div>

          {/* Angle Control for Linear Gradient */}
          {config.type === 'linear' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="gradient-angle-input" className="text-[11px] font-medium text-slate-600">
                  Angle
                </label>
                <div className="flex items-center gap-1">
                  {[90, 135, 180].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => applyUpdate({ ...config, angle: deg }, true)}
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                        config.angle === deg
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                  <input
                    id="gradient-angle-input"
                    type="number"
                    min={0}
                    max={360}
                    value={config.angle}
                    onChange={(e) =>
                      applyUpdate({ ...config, angle: Number(e.target.value) || 0 }, true)
                    }
                    className="h-6 w-14 rounded border border-slate-200 px-1.5 text-right font-mono text-[11px] tabular-nums text-slate-800"
                  />
                </div>
              </div>
              <input
                type="range"
                aria-label="Gradient angle slider"
                min={0}
                max={360}
                value={config.angle}
                onChange={(e) => applyUpdate({ ...config, angle: Number(e.target.value) }, false)}
                onPointerUp={(e) =>
                  applyUpdate({ ...config, angle: Number((e.target as HTMLInputElement).value) }, true)
                }
                className="h-2 sm:h-1.5 w-full cursor-pointer touch-none accent-blue-600"
              />
            </div>
          )}

          {/* Individual Stop Hex & Position Inputs */}
          <div className="space-y-2">
            {activeStops.map((stop, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/70 p-1.5"
              >
                <span className="w-4 shrink-0 text-center font-mono text-[10px] font-semibold tabular-nums text-slate-400">
                  {idx + 1}
                </span>
                <input
                  type="color"
                  aria-label={`Stop ${idx + 1} color`}
                  value={normalizeHex(stop.color, '#2563EB')}
                  onChange={(e) => handleStopColorPicker(idx, e.target.value, true)}
                  className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                />
                <input
                  type="text"
                  aria-label={`Stop ${idx + 1} hex`}
                  value={hexDrafts[idx] ?? stop.color}
                  onChange={(e) => handleStopHexInput(idx, e.target.value)}
                  onBlur={() => commitStopHexDraft(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitStopHexDraft(idx);
                  }}
                  placeholder="#000000"
                  className="h-9 sm:h-7 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 font-mono text-xs uppercase text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex items-center gap-0.5 shrink-0">
                  <input
                    type="number"
                    aria-label={`Stop ${idx + 1} position percent`}
                    min={0}
                    max={100}
                    value={stop.position}
                    onChange={(e) => handleStopPosChange(idx, Number(e.target.value), true)}
                    className="h-9 sm:h-7 w-14 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs sm:text-[11px] tabular-nums text-slate-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Saved Custom Hex Palettes */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-500">Saved Hex Swatches</p>
              <button
                type="button"
                onClick={() => saveCustomGradientPreset(config)}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
              >
                <BookmarkPlus className="h-3 w-3" />
                <span>Save Hexes</span>
              </button>
            </div>
            {customPresets.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {customPresets.map((preset) => {
                  const full: GradientConfig = { ...preset.config, target: config.target };
                  const bg = buildGradientCss(full);
                  return (
                    <div
                      key={preset.id}
                      className="group relative inline-flex items-center rounded border border-slate-200 bg-white p-0.5"
                    >
                      <button
                        type="button"
                        title={preset.name}
                        aria-label={`Apply saved ${preset.name}`}
                        onClick={() => {
                          setHexDrafts(full.stops.map((s) => s.color));
                          applyUpdate(full, true);
                        }}
                        className="h-5 w-8 rounded-xs"
                        style={{ background: bg }}
                      />
                      <button
                        type="button"
                        aria-label={`Delete saved ${preset.name}`}
                        onClick={() => deleteCustomGradientPreset(preset.id)}
                        className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Curated 3-Stop & 4-Stop Gradient Presets */}
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">Quick Palettes</p>
            <div className="grid grid-cols-6 gap-1.5">
              {GRADIENT_PRESETS.map((preset) => {
                const full: GradientConfig = { ...preset.config, target: config.target };
                const bg = buildGradientCss(full);
                return (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    aria-label={`Apply ${preset.name}`}
                    onClick={() => {
                      setHexDrafts(full.stops.map((s) => s.color));
                      applyUpdate(full, true);
                    }}
                    className="h-6 w-full rounded border border-slate-200 transition-transform hover:scale-105"
                    style={{ background: bg }}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
