'use client';

import React, { useMemo, useState } from 'react';
import { BookmarkPlus, Check, Copy, Sparkles, X } from 'lucide-react';
import {
  buildGradientCss,
  generateElementGradientCss,
  GRADIENT_PRESETS,
  GradientCssFormat,
  isFullHexInput,
  isValidHexInput,
  normalizeHex,
  parseGradientCss,
  resizeGradientStops,
} from '@/lib/studio/gradient';
import {
  deleteCustomGradientPreset,
  getCustomGradientsSnapshot,
  getLastGradientSnapshot,
  parseCustomGradientPresetsJson,
  parseLastGradientJson,
  saveCustomGradientPreset,
  saveLastGradientConfig,
  subscribeGradientStorage,
} from '@/lib/studio/gradient-persistence';
import {
  ElementSourcePatch,
  GradientConfig,
  StudioElementSnapshot,
} from '@/lib/studio/types';

interface GradientCssPanelProps {
  selected: StudioElementSnapshot | null;
  onPreviewStyles: (studioId: string, styles: Record<string, string | null>) => void;
  onCommitPatch: (filePath: string, elementIndex: number, patch: ElementSourcePatch) => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

function buildSelectorHint(selected: StudioElementSnapshot | null): string {
  if (!selected) return '.selected-element';
  const rawClass = (selected.className || '')
    .split(/\s+/)
    .find((cls) => cls && !cls.includes(':') && !cls.includes('[') && /^[a-zA-Z_-][\w-]*$/.test(cls));
  return rawClass ? `${selected.tagName}.${rawClass}` : selected.tagName;
}

function deriveMultiStopConfig(
  selected: StudioElementSnapshot | null,
  persistedLast: GradientConfig | null
): GradientConfig {
  const fallback: GradientConfig =
    persistedLast && persistedLast.stops.length >= 2
      ? {
          type: persistedLast.type === 'radial' ? 'radial' : 'linear',
          angle: persistedLast.angle,
          stopCount: persistedLast.stopCount === 4 ? 4 : 3,
          stops:
            persistedLast.stopCount === 4 || persistedLast.stopCount === 3
              ? persistedLast.stops.slice(0, persistedLast.stopCount)
              : resizeGradientStops(persistedLast.stops, 3),
          target: persistedLast.target,
        }
      : {
          ...GRADIENT_PRESETS[0].config,
          target: 'background',
        };

  if (!selected) {
    return fallback;
  }

  const bgImg =
    selected.inlineStyles['background-image'] || selected.computedStyles.backgroundImage;
  const bgCol =
    selected.inlineStyles['background-color'] || selected.computedStyles.backgroundColor;
  const clip =
    selected.inlineStyles['-webkit-background-clip'] ||
    selected.inlineStyles['background-clip'] ||
    selected.computedStyles.backgroundClip;

  const parsed = parseGradientCss(bgImg, bgCol, selected.computedStyles.color, clip);
  if (parsed.type === 'solid') {
    // Keep the user's persisted gradient hex stops instead of discarding them back to defaults
    return {
      ...fallback,
      target: parsed.target,
    };
  }

  const stopCount: 3 | 4 = parsed.stopCount === 4 ? 4 : 3;
  return {
    type: parsed.type === 'radial' ? 'radial' : 'linear',
    angle: parsed.angle,
    stopCount,
    stops:
      parsed.stops.length === stopCount
        ? parsed.stops
        : resizeGradientStops(parsed.stops, stopCount),
    target: parsed.target,
  };
}

function toElementStyles(config: GradientConfig): Record<string, string | null> {
  const cssValue = buildGradientCss(config);
  if (config.target === 'text') {
    return {
      backgroundImage: cssValue,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    };
  }
  return {
    backgroundImage: cssValue,
    backgroundClip: null,
    WebkitBackgroundClip: null,
    WebkitTextFillColor: null,
  };
}

export default function GradientCssPanel({
  selected,
  onPreviewStyles,
  onCommitPatch,
  onClose,
  isBottomSheet = false,
}: GradientCssPanelProps) {
  const lastGradientJson = React.useSyncExternalStore(
    subscribeGradientStorage,
    getLastGradientSnapshot,
    () => ''
  );
  const customGradientsJson = React.useSyncExternalStore(
    subscribeGradientStorage,
    getCustomGradientsSnapshot,
    () => '[]'
  );

  const persistedLast = useMemo(
    () => parseLastGradientJson(lastGradientJson),
    [lastGradientJson]
  );
  const customPresets = useMemo(
    () => parseCustomGradientPresetsJson(customGradientsJson),
    [customGradientsJson]
  );

  const [config, setConfig] = useState<GradientConfig>(() =>
    deriveMultiStopConfig(selected, persistedLast)
  );
  const [hexDrafts, setHexDrafts] = useState<string[]>(() =>
    deriveMultiStopConfig(selected, persistedLast).stops.map((s) => s.color)
  );
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selected?.studioId ?? null);
  const [prevExternalCss, setPrevExternalCss] = useState<string>(
    selected?.inlineStyles['background-image'] || ''
  );
  const [prevPersistedJson, setPrevPersistedJson] = useState<string>(lastGradientJson);
  const [cssFormat, setCssFormat] = useState<GradientCssFormat>('rule');
  const [copied, setCopied] = useState(false);

  const currentSelectedId = selected?.studioId ?? null;
  const currentExternalCss = selected
    ? `${selected.inlineStyles['background-image'] || ''}|${selected.inlineStyles['background-clip'] || ''}`
    : '';

  if (
    currentSelectedId !== prevSelectedId ||
    currentExternalCss !== prevExternalCss ||
    (!selected && lastGradientJson !== prevPersistedJson)
  ) {
    const elementChanged = currentSelectedId !== prevSelectedId;
    setPrevSelectedId(currentSelectedId);
    setPrevExternalCss(currentExternalCss);
    setPrevPersistedJson(lastGradientJson);

    const derived = deriveMultiStopConfig(selected, persistedLast);
    const derivedCss = buildGradientCss(derived);
    const localCss = buildGradientCss(config);

    if (elementChanged || (!selected && lastGradientJson) || (selected?.inlineStyles['background-image'] && derivedCss !== localCss)) {
      setConfig(derived);
      setHexDrafts(derived.stops.map((s) => s.color));
    }
  }

  const updateAndApply = (next: GradientConfig, commit: boolean) => {
    setConfig(next);
    if (commit) {
      saveLastGradientConfig(next);
    }
    if (!selected) return;
    const styles = toElementStyles(next);
    if (commit) {
      onCommitPatch(selected.filePath, selected.elementIndex, { styles });
    } else {
      onPreviewStyles(selected.studioId, styles);
    }
  };

  const handleStopCount = (count: 3 | 4) => {
    const resized = resizeGradientStops(config.stops, count);
    setHexDrafts(resized.map((s) => s.color));
    updateAndApply({ ...config, stopCount: count, stops: resized }, true);
  };

  const handleStopColorPicker = (idx: number, hex: string, commit: boolean) => {
    const normalized = normalizeHex(hex, config.stops[idx]?.color || '#2563EB');
    const nextStops = config.stops.map((s, i) => (i === idx ? { ...s, color: normalized } : s));
    const nextDrafts = [...hexDrafts];
    nextDrafts[idx] = normalized;
    setHexDrafts(nextDrafts);
    updateAndApply({ ...config, stops: nextStops }, commit);
  };

  const handleStopHexInput = (idx: number, raw: string) => {
    const nextDrafts = [...hexDrafts];
    nextDrafts[idx] = raw;
    setHexDrafts(nextDrafts);
    if (isFullHexInput(raw)) {
      const normalized = normalizeHex(raw);
      const nextStops = config.stops.map((s, i) => (i === idx ? { ...s, color: normalized } : s));
      updateAndApply({ ...config, stops: nextStops }, true);
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
      updateAndApply({ ...config, stops: nextStops }, true);
    } else {
      const nextDrafts = [...hexDrafts];
      nextDrafts[idx] = config.stops[idx]?.color || '#2563EB';
      setHexDrafts(nextDrafts);
    }
  };

  const handleStopPosChange = (idx: number, rawPos: number) => {
    const pos = Math.max(0, Math.min(100, Math.round(rawPos || 0)));
    const nextStops = config.stops.map((s, i) => (i === idx ? { ...s, position: pos } : s));
    updateAndApply({ ...config, stops: nextStops }, true);
  };

  const activeStops = config.stops.slice(0, config.stopCount);
  const previewCss = buildGradientCss(config);
  const selectorHint = buildSelectorHint(selected);

  const generatedCss = useMemo(
    () =>
      generateElementGradientCss(config, {
        selector: selectorHint,
        format: cssFormat,
      }),
    [config, selectorHint, cssFormat]
  );

  const matchingPresets = useMemo(
    () => GRADIENT_PRESETS.filter((p) => p.config.stopCount === config.stopCount),
    [config.stopCount]
  );

  const handleCopyCss = async () => {
    try {
      await navigator.clipboard.writeText(generatedCss);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard permission denials in restricted headless frames
    }
  };

  return (
    <section
      aria-label="Multi-Stop Gradient & CSS Panel"
      className={`flex w-full flex-col bg-white ${
        isBottomSheet
          ? 'h-full rounded-t-2xl'
          : 'shrink-0 border-t border-slate-200 max-h-[304px]'
      }`}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          <h2 className="text-xs font-semibold text-slate-900 whitespace-nowrap">
            3-Stop &amp; 4-Stop Gradient CSS
          </h2>
          <span
            className={`truncate rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
              selected
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-200/70 text-slate-600'
            }`}
          >
            {selected ? `<${selected.tagName}>` : 'No element selected'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => saveCustomGradientPreset(config)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
          >
            <BookmarkPlus className="h-3 w-3" />
            <span>Save Swatch</span>
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => updateAndApply(config, true)}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span>{selected ? `Apply to <${selected.tagName}>` : 'Select Element to Apply'}</span>
          </button>
          <button
            type="button"
            aria-label="Close gradient CSS panel"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-y-auto p-2.5 sm:px-4 lg:grid-cols-12 studio-scroll">
        {/* Left: 3-Stop / 4-Stop Controls & Color Stops */}
        <div className="space-y-2 lg:col-span-7">
          {/* Controls Strip */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Stop Mode Selector */}
            <div
              className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Multi-stop gradient mode"
            >
              {([3, 4] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleStopCount(count)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    config.stopCount === count
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {count}-Stop
                </button>
              ))}
            </div>

            {/* Linear / Radial */}
            <div
              className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Gradient direction type"
            >
              {(['linear', 'radial'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateAndApply({ ...config, type: t }, true)}
                  className={`rounded px-2 py-1 text-[11px] font-medium capitalize whitespace-nowrap transition-colors ${
                    config.type === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Surface / Text Target */}
            <div
              className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
              role="group"
              aria-label="Gradient target property"
            >
              <button
                type="button"
                onClick={() => updateAndApply({ ...config, target: 'background' }, true)}
                className={`rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
                  config.target === 'background'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Surface
              </button>
              <button
                type="button"
                onClick={() => updateAndApply({ ...config, target: 'text' }, true)}
                className={`rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
                  config.target === 'text'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Text
              </button>
            </div>

            {/* Angle Controls */}
            {config.type === 'linear' && (
              <div className="flex items-center gap-1">
                {[90, 135, 180].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => updateAndApply({ ...config, angle: deg }, true)}
                    className={`rounded border px-1.5 py-1 font-mono text-[10px] tabular-nums ${
                      config.angle === deg
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
                <input
                  type="number"
                  aria-label="Gradient panel angle degrees"
                  min={0}
                  max={360}
                  value={config.angle}
                  onChange={(e) =>
                    updateAndApply({ ...config, angle: Number(e.target.value) || 0 }, true)
                  }
                  className="h-7 w-14 rounded border border-slate-200 px-1.5 text-right font-mono text-[11px] tabular-nums text-slate-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            )}
          </div>

          {/* Live Gradient Bar + Angle Slider */}
          <div className="flex items-center gap-2.5">
            <div
              className="h-6 flex-1 rounded-md border border-slate-200 shadow-inner"
              style={{ background: previewCss }}
              aria-label="Live gradient bar preview"
            />
            {config.type === 'linear' && (
              <input
                type="range"
                aria-label="Gradient panel angle slider"
                min={0}
                max={360}
                value={config.angle}
                onChange={(e) =>
                  updateAndApply({ ...config, angle: Number(e.target.value) }, false)
                }
                onPointerUp={(e) =>
                  updateAndApply(
                    { ...config, angle: Number((e.target as HTMLInputElement).value) },
                    true
                  )
                }
                className="h-2 sm:h-1.5 w-28 sm:w-32 shrink-0 cursor-pointer touch-none accent-blue-600"
              />
            )}
          </div>

          {/* Color Stop Grid (3 or 4 Stops) */}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {activeStops.map((stop, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/70 p-1"
              >
                <span className="w-4 shrink-0 text-center font-mono text-[10px] font-semibold tabular-nums text-slate-400">
                  {idx + 1}
                </span>
                <input
                  type="color"
                  aria-label={`Panel stop ${idx + 1} color`}
                  value={normalizeHex(stop.color, '#2563EB')}
                  onChange={(e) => handleStopColorPicker(idx, e.target.value, true)}
                  className="h-8 w-8 sm:h-6 sm:w-6 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                />
                <input
                  type="text"
                  aria-label={`Panel stop ${idx + 1} hex`}
                  value={hexDrafts[idx] ?? stop.color}
                  onChange={(e) => handleStopHexInput(idx, e.target.value)}
                  onBlur={() => commitStopHexDraft(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitStopHexDraft(idx);
                  }}
                  className="h-8 sm:h-6 min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 font-mono text-[11px] uppercase text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex items-center gap-0.5 shrink-0">
                  <input
                    type="number"
                    aria-label={`Panel stop ${idx + 1} percent`}
                    min={0}
                    max={100}
                    value={stop.position}
                    onChange={(e) => handleStopPosChange(idx, Number(e.target.value))}
                    className="h-8 sm:h-6 w-14 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-[11px] tabular-nums text-slate-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Saved Custom Swatches + Presets matching selected stop count */}
          <div className="space-y-1">
            {customPresets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-blue-600 whitespace-nowrap">
                  Saved:
                </span>
                {customPresets.map((preset) => {
                  const nextCfg: GradientConfig = {
                    ...preset.config,
                    target: config.target,
                    stopCount: preset.config.stopCount === 4 ? 4 : 3,
                    stops:
                      preset.config.stopCount >= 3
                        ? preset.config.stops
                        : resizeGradientStops(preset.config.stops, 3),
                  };
                  return (
                    <div
                      key={preset.id}
                      className="inline-flex items-center rounded border border-blue-200 bg-blue-50/40 px-1 py-0.5 text-[10px] font-medium text-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setHexDrafts(nextCfg.stops.map((s) => s.color));
                          updateAndApply(nextCfg, true);
                        }}
                        className="inline-flex items-center gap-1 hover:text-blue-700"
                      >
                        <span
                          className="h-3 w-4 rounded-xs border border-slate-200"
                          style={{ background: buildGradientCss(nextCfg) }}
                        />
                        <span className="max-w-[110px] truncate">{preset.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove saved preset ${preset.name}`}
                        onClick={() => deleteCustomGradientPreset(preset.id)}
                        className="ml-1 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                {config.stopCount}-Stop Presets:
              </span>
              {matchingPresets.map((preset) => {
                const nextCfg: GradientConfig = { ...preset.config, target: config.target };
                return (
                  <button
                    key={preset.name}
                    type="button"
                    title={preset.name}
                    onClick={() => {
                      setHexDrafts(nextCfg.stops.map((s) => s.color));
                      updateAndApply(nextCfg, true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50/40"
                  >
                    <span
                      className="h-3 w-5 rounded-xs border border-slate-200"
                      style={{ background: buildGradientCss(nextCfg) }}
                    />
                    <span>{preset.name.replace(/\s*\(\d-Stop\)/, '')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Generated CSS Output for Selected Element */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-950 p-2.5 text-slate-100 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2">
            <div
              className="flex items-center rounded border border-slate-800 bg-slate-900 p-0.5"
              role="group"
              aria-label="Generated CSS format"
            >
              {(
                [
                  { id: 'rule', label: 'CSS Rule' },
                  { id: 'declarations', label: 'Properties' },
                  { id: 'tailwind', label: 'Tailwind' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setCssFormat(fmt.id)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                    cssFormat === fmt.id
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyCss}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-800"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span>{copied ? 'Copied' : 'Copy CSS'}</span>
            </button>
          </div>

          <pre
            data-testid="gradient-generated-css"
            className="min-h-[84px] flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-900/90 p-2 font-mono text-[11px] leading-relaxed text-sky-200 studio-scroll"
          >
            <code>{generatedCss}</code>
          </pre>

          <p className="mt-1.5 truncate font-mono text-[10px] text-slate-400">
            Target selector: <span className="text-slate-200">{selectorHint}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
