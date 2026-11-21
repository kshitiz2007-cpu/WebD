'use client';

import React, { useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Box,
  Component,
  Copy,
  Move,
  PackagePlus,
  Palette,
  Replace,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  X,
} from 'lucide-react';
import GradientEditor from './GradientEditor';
import BorderShadowGradientControls from './BorderShadowGradientControls';
import ImageBlendDesigner from './ImageBlendDesigner';
import DesignTokensPresets from './DesignTokensPresets';
import ProStudioToolkit from './ProStudioToolkit';
import { layoutContainerCss, layoutGapPreset, sizingModeCss, type LayoutAxis, type SizingMode } from '@/lib/studio/layout-engine';
import {
  SHADOW_PRESETS,
  boxShadowToElevationHint,
  clampBorderWidth,
  clampCornerRadius,
  clampElevationLevel,
  clampOpacityPercent,
  elevationLevelToBoxShadow,
  matchShadowPresetLabel,
} from '@/lib/studio/border-elevation';
import {
  ComponentInsertPosition,
  ComponentInstanceUsage,
  ProjectComponentInfo,
} from '@/lib/studio/component-editor';
import { ExternalImportEntry } from '@/lib/studio/library-importer';
import {
  HorizontalConstraint,
  PositionMode,
  VerticalConstraint,
  applyHorizontalConstraintPatch,
  applySizeConstraintMode,
  applyVerticalConstraintPatch,
  buildResizeContainmentStyles,
  detectConstraintState,
  parseElementTranslateOffsets,
  parseGridColumnCount,
} from '@/lib/studio/layout-constraints';
import { normalizeHex, parseGradientCss } from '@/lib/studio/gradient';
import {
  getLastGradientSnapshot,
  parseLastGradientJson,
  subscribeGradientStorage,
} from '@/lib/studio/gradient-persistence';
import {
  AlignBreakpointScope,
  AutoAlignMode,
  BlockRedesignPattern,
  HorizontalAlign,
  VerticalAlign,
  detectBreakpointSizeMode,
  resolveEffectiveBreakpoint,
} from '@/lib/studio/smart-aligner';
import {
  computeContrastReport,
  resolveEffectiveBgColor,
} from '@/lib/studio/visual-refinement';
import {
  ElementSourcePatch,
  GradientConfig,
  StudioElementSnapshot,
  ViewportPreset,
} from '@/lib/studio/types';

function ScrubLabel({
  htmlFor,
  label,
  value,
  min,
  max,
  step = 1,
  onScrubPreview,
  onScrubCommit,
}: {
  htmlFor?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onScrubPreview: (next: number) => void;
  onScrubCommit: (next: number) => void;
}) {
  const handlePointerDown = (e: React.PointerEvent<HTMLLabelElement>) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startVal = Number.isFinite(value) ? value : min;
    let latestVal = startVal;
    let dragged = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture unavailable
    }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!dragged && Math.abs(dx) < 3) return;
      dragged = true;
      const mult = ev.shiftKey ? 5 : 1;
      const raw = startVal + Math.round((dx / 3) * step * mult);
      latestVal = Math.min(max, Math.max(min, raw));
      onScrubPreview(latestVal);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (dragged) {
        onScrubCommit(latestVal);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <label
      htmlFor={htmlFor}
      title="Drag horizontally to scrub value (Shift for 5× step)"
      onPointerDown={handlePointerDown}
      className="inline-flex cursor-ew-resize select-none items-center gap-1 text-[11px] text-slate-600 underline decoration-dotted decoration-slate-300 underline-offset-2 hover:text-blue-700 hover:decoration-blue-400"
    >
      {label}
    </label>
  );
}

interface StyleInspectorPanelProps {
  selected: StudioElementSnapshot | null;
  onPreviewStyles: (studioId: string, styles: Record<string, string | null>) => void;
  onCommitPatch: (filePath: string, elementIndex: number, patch: ElementSourcePatch) => void;
  onCommitBatchPatches?: (filePath: string, updates: Array<{ elementIndex: number; patch: ElementSourcePatch }>) => void;
  onMoveSibling: (filePath: string, elementIndex: number, targetIndex: number) => void;
  onDuplicate: (filePath: string, elementIndex: number) => void;
  onDelete: (filePath: string, elementIndex: number) => void;
  onClose?: () => void;
  isBottomSheet?: boolean;
  activePageFilePath?: string;
  components?: ProjectComponentInfo[];
  componentUsages?: ComponentInstanceUsage[];
  onIsolateComponent?: (filePath: string) => void;
  onExtractComponent?: (filePath: string, elementIndex: number, componentName: string) => void;
  onPatchComponentProp?: (
    filePath: string,
    elementIndex: number,
    propName: string,
    propValue: string
  ) => void;
  onReplaceWithComponent?: (
    targetFilePath: string,
    elementIndex: number,
    componentFilePath: string
  ) => void;
  onInsertComponent?: (
    targetFilePath: string,
    elementIndex: number,
    position: ComponentInsertPosition,
    componentFilePath: string
  ) => void;
  onOpenLibraryModal?: () => void;
  fileExternalImports?: ExternalImportEntry[];
  dependenciesCount?: number;
  viewport?: ViewportPreset;
  alignBreakpointScope?: AlignBreakpointScope;
  onChangeAlignBreakpointScope?: (scope: AlignBreakpointScope) => void;
  onSmartAutoAlign?: (mode: AutoAlignMode, scopeElementIndex?: number) => void;
  onSmartAlignElement?: (opts: {
    filePath: string;
    elementIndex: number;
    horizontal?: HorizontalAlign;
    vertical?: VerticalAlign;
  }) => void;
  onSmartRedesignBlock?: (
    filePath: string,
    elementIndex: number,
    pattern: BlockRedesignPattern
  ) => void;
  onOpenSmartAligner?: () => void;
  pseudoState?: 'default' | 'hover' | 'focus';
  onChangePseudoState?: (studioId: string, pseudo: 'default' | 'hover' | 'focus') => void;
}

function parsePxNumber(val?: string): string {
  if (!val) return '';
  if (val === 'auto') return 'auto';
  const m = val.match(/^-?\d+(?:\.\d+)?/);
  return m ? String(Math.round(parseFloat(m[0]))) : '';
}

function parseStudioTarget(id: string): { filePath: string; elementIndex: number } | null {
  const sep = id.lastIndexOf('::');
  if (sep === -1) return null;
  const idx = Number(id.slice(sep + 2));
  if (!Number.isFinite(idx)) return null;
  return { filePath: id.slice(0, sep), elementIndex: idx };
}

export default function StyleInspectorPanel({
  selected,
  onPreviewStyles,
  onCommitPatch,
  onCommitBatchPatches,
  onMoveSibling,
  onDuplicate,
  onDelete,
  onClose,
  isBottomSheet = false,
  activePageFilePath,
  components = [],
  componentUsages = [],
  onIsolateComponent,
  onExtractComponent,
  onPatchComponentProp,
  onReplaceWithComponent,
  onInsertComponent,
  onOpenLibraryModal,
  fileExternalImports = [],
  dependenciesCount = 0,
  viewport = 'desktop',
  alignBreakpointScope = 'auto',
  onChangeAlignBreakpointScope,
  onSmartAutoAlign,
  onSmartAlignElement,
  onSmartRedesignBlock,
  onOpenSmartAligner,
  pseudoState = 'default',
  onChangePseudoState,
}: StyleInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<'style' | 'layout' | 'type' | 'comp' | 'fit' | 'pro'>('style');
  const [textDraft, setTextDraft] = useState(selected?.textContent || '');
  const [textColorHex, setTextColorHex] = useState('#0F172A');
  const [borderColorHex, setBorderColorHex] = useState('#E2E8F0');
  const [radiusDraft, setRadiusDraft] = useState('0');
  const [borderWidthDraft, setBorderWidthDraft] = useState('0');
  const [opacityDraft, setOpacityDraft] = useState('100');
  const [elevationDraft, setElevationDraft] = useState('0');
  const [shadowCssDraft, setShadowCssDraft] = useState('none');
  const [classDraft, setClassDraft] = useState('');
  const [hrefDraft, setHrefDraft] = useState('');
  const [srcDraft, setSrcDraft] = useState('');
  const [extractCompName, setExtractCompName] = useState('');
  const [targetCompPath, setTargetCompPath] = useState('');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [prevSelectedKey, setPrevSelectedKey] = useState<string | null>(null);
  const [fitWidthDraft, setFitWidthDraft] = useState('100%');
  const [fitHeightDraft, setFitHeightDraft] = useState('420px');

  const rawRadius = selected
    ? parsePxNumber(selected.inlineStyles['border-radius'] || selected.computedStyles.borderRadius) || '0'
    : '0';
  const rawBorderWidth = selected
    ? parsePxNumber(selected.inlineStyles['border-width'] || selected.computedStyles.borderWidth) || '0'
    : '0';
  const rawOpacity = selected
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(parseFloat(selected.inlineStyles.opacity || selected.computedStyles.opacity || '1') * 100)
        )
      )
    : 100;
  const rawBoxShadow = selected
    ? selected.inlineStyles['box-shadow'] || selected.computedStyles.boxShadow || 'none'
    : 'none';
  const rawElevation = boxShadowToElevationHint(rawBoxShadow);

  const selectedSyncKey = selected
    ? `${selected.studioId}|${selected.textContent}|${selected.className}|${selected.href || ''}|${selected.src || ''}|${selected.computedStyles.color}|${selected.computedStyles.borderColor}|${rawRadius}|${rawBorderWidth}|${rawOpacity}|${rawBoxShadow}|${selected.inlineStyles.translate || selected.computedStyles.translate || ''}|${selected.inlineStyles.transform || selected.computedStyles.transform || ''}`
    : null;

  if (selectedSyncKey !== prevSelectedKey) {
    setPrevSelectedKey(selectedSyncKey);
    if (selected) {
      setTextDraft(selected.textContent || '');
      setTextColorHex(normalizeHex(selected.computedStyles.color || '#0F172A', '#0F172A'));
      setBorderColorHex(normalizeHex(selected.computedStyles.borderColor || '#E2E8F0', '#E2E8F0'));
      setRadiusDraft(rawRadius);
      setBorderWidthDraft(rawBorderWidth);
      setOpacityDraft(String(rawOpacity));
      setElevationDraft(String(rawElevation));
      setShadowCssDraft(rawBoxShadow);
      setFitWidthDraft(selected.inlineStyles.width || '100%');
      setFitHeightDraft(selected.inlineStyles.height || (selected.className.toLowerCase().includes('circular-carousel') ? 'min(70vh, 620px)' : 'auto'));
      setClassDraft(selected.className || '');
      setHrefDraft(selected.href || '');
      setSrcDraft(selected.src || '');
      const offsets = parseElementTranslateOffsets(
        selected.inlineStyles,
        selected.computedStyles
      );
      setOffsetX(offsets.x);
      setOffsetY(offsets.y);
    }
  }

  const lastGradientJson = React.useSyncExternalStore(
    subscribeGradientStorage,
    getLastGradientSnapshot,
    () => ''
  );
  const persistedLast = useMemo(
    () => parseLastGradientJson(lastGradientJson),
    [lastGradientJson]
  );

  const gradientValue = useMemo(() => {
    if (!selected) {
      return persistedLast || parseGradientCss();
    }
    const bgImg =
      selected.inlineStyles['background-image'] ||
      selected.computedStyles.backgroundImage;
    const bgCol =
      selected.inlineStyles['background-color'] ||
      selected.computedStyles.backgroundColor;
    const clip =
      selected.inlineStyles['-webkit-background-clip'] ||
      selected.inlineStyles['background-clip'] ||
      selected.computedStyles.backgroundClip;
    const parsed = parseGradientCss(bgImg, bgCol, selected.computedStyles.color, clip);
    if (parsed.type === 'solid' && persistedLast && persistedLast.stops.length >= 2) {
      return {
        ...parsed,
        angle: persistedLast.angle,
        stopCount: persistedLast.stopCount,
        stops: persistedLast.stops,
      };
    }
    return parsed;
  }, [selected, persistedLast]);

  const textGradientValue = useMemo(() => {
    if (!selected) {
      return { ...(persistedLast || parseGradientCss()), target: 'text' as const };
    }
    const bgImg =
      selected.inlineStyles['background-image'] ||
      selected.computedStyles.backgroundImage;
    const clip =
      selected.inlineStyles['-webkit-background-clip'] ||
      selected.inlineStyles['background-clip'] ||
      selected.computedStyles.backgroundClip;
    if (clip === 'text' && bgImg && bgImg !== 'none') {
      return { ...parseGradientCss(bgImg, undefined, selected.computedStyles.color, 'text'), target: 'text' as const };
    }
    return { ...parseGradientCss(undefined, undefined, textColorHex, 'text'), target: 'text' as const };
  }, [selected, textColorHex, persistedLast]);

  if (!selected) {
    return (
      <aside
        aria-label="Design Inspector"
        className={`flex h-full flex-col items-center justify-center bg-white p-6 text-center ${
          isBottomSheet
            ? 'relative w-full rounded-t-2xl'
            : 'w-[312px] shrink-0 border-l border-slate-200'
        }`}
      >
        {isBottomSheet && onClose && (
          <button
            type="button"
            aria-label="Close design inspector"
            onClick={onClose}
            className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Select an Element</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Tap any section, card, heading, image, or button on the canvas to edit text, resize handles, drag layout, or apply 3-stop &amp; 4-stop gradients.
        </p>
      </aside>
    );
  }

  const commitStyles = (styles: Record<string, string | null>) => {
    onCommitPatch(selected.filePath, selected.elementIndex, { styles });
  };

  const handleGradientApply = (cfg: GradientConfig, cssValue: string, commit: boolean) => {
    let styles: Record<string, string | null>;
    if (cfg.target === 'text') {
      if (cfg.type === 'solid') {
        styles = {
          color: cssValue,
          backgroundImage: null,
          backgroundClip: null,
          WebkitBackgroundClip: null,
          WebkitTextFillColor: null,
        };
      } else {
        styles = {
          backgroundImage: cssValue,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        };
      }
    } else {
      if (cfg.type === 'solid') {
        styles = {
          backgroundColor: cssValue,
          backgroundImage: 'none',
          backgroundClip: null,
          WebkitBackgroundClip: null,
          WebkitTextFillColor: null,
        };
      } else {
        styles = {
          backgroundImage: cssValue,
          backgroundClip: null,
          WebkitBackgroundClip: null,
          WebkitTextFillColor: null,
        };
      }
    }

    if (commit) {
      commitStyles(styles);
    } else {
      onPreviewStyles(selected.studioId, styles);
    }
  };

  const cs = selected.computedStyles;
  const ins = selected.inlineStyles;

  const currentWidth = ins.width || parsePxNumber(cs.width);
  const currentHeight = ins.height || parsePxNumber(cs.height);
  const padTop = parsePxNumber(ins['padding-top'] || cs.paddingTop);
  const padRight = parsePxNumber(ins['padding-right'] || cs.paddingRight);
  const padBottom = parsePxNumber(ins['padding-bottom'] || cs.paddingBottom);
  const padLeft = parsePxNumber(ins['padding-left'] || cs.paddingLeft);
  const marTop = parsePxNumber(ins['margin-top'] || cs.marginTop);
  const marBottom = parsePxNumber(ins['margin-bottom'] || cs.marginBottom);
  const radius = rawRadius;
  const fontSize = parsePxNumber(ins['font-size'] || cs.fontSize) || '16';
  const fontWeight = cs.fontWeight || '400';
  const textAlign = cs.textAlign || 'left';
  const opacity = rawOpacity;
  const borderWidth = rawBorderWidth;
  const activeShadowPreset = matchShadowPresetLabel(ins['box-shadow'], cs.boxShadow);
  const sliderRadius = Math.min(48, clampCornerRadius(radiusDraft) ?? (Number(radius) || 0));
  const sliderOpacity = clampOpacityPercent(opacityDraft) ?? opacity;

  return (
    <aside
      aria-label="Design Inspector"
      className={`flex h-full flex-col bg-white ${
        isBottomSheet
          ? 'w-full rounded-t-2xl'
          : 'w-[312px] shrink-0 border-l border-slate-200'
      }`}
    >
      {/* Selected Element Header */}
      <div className="border-b border-slate-200 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-900">
              &lt;{selected.tagName}&gt;
            </p>
            <p className="truncate font-mono text-[10px] text-slate-400">
              {selected.filePath}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selected.canReorderSiblings && (() => {
              const reorderTarget =
                parseStudioTarget(selected.instanceStudioId || selected.studioId) || {
                  filePath: selected.filePath,
                  elementIndex: selected.elementIndex,
                };
              return (
                <>
                  <button
                    type="button"
                    aria-label="Move element earlier"
                    disabled={selected.siblingIndex <= 0}
                    onClick={() =>
                      onMoveSibling(
                        reorderTarget.filePath,
                        reorderTarget.elementIndex,
                        selected.siblingIndex - 1
                      )
                    }
                    className="rounded border border-slate-200 p-1.5 sm:p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move element later"
                    disabled={selected.siblingIndex >= selected.siblingCount - 1}
                    onClick={() =>
                      onMoveSibling(
                        reorderTarget.filePath,
                        reorderTarget.elementIndex,
                        selected.siblingIndex + 1
                      )
                    }
                    className="rounded border border-slate-200 p-1.5 sm:p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </>
              );
            })()}
            <button
              type="button"
              aria-label="Duplicate element"
              onClick={() => onDuplicate(selected.filePath, selected.elementIndex)}
              className="rounded border border-slate-200 p-1.5 sm:p-1 text-slate-600 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete element"
              onClick={() => onDelete(selected.filePath, selected.elementIndex)}
              className="rounded border border-slate-200 p-1.5 sm:p-1 text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {isBottomSheet && onClose && (
              <button
                type="button"
                aria-label="Close design inspector"
                onClick={onClose}
                className="ml-1 rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inspector Section Tabs */}
        <div
          className="mt-2.5 grid grid-cols-6 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
          role="tablist"
          aria-label="Inspector sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'style'}
            onClick={() => setActiveTab('style')}
            className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium whitespace-nowrap ${
              activeTab === 'style'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="h-3 w-3" />
            <span>Fill</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'layout'}
            onClick={() => setActiveTab('layout')}
            className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium whitespace-nowrap ${
              activeTab === 'layout'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Move className="h-3 w-3" />
            <span>Layout</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'type'}
            onClick={() => setActiveTab('type')}
            className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium whitespace-nowrap ${
              activeTab === 'type'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Type className="h-3 w-3" />
            <span>Text</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'fit'}
            onClick={() => setActiveTab('fit')}
            className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium whitespace-nowrap ${
              activeTab === 'fit'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>↔</span>
            <span>Fit</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'comp'}
            onClick={() => setActiveTab('comp')}
            className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium whitespace-nowrap ${
              activeTab === 'comp'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Component className="h-3 w-3" />
            <span>Comp</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'pro'} onClick={() => setActiveTab('pro')} className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium whitespace-nowrap ${activeTab === 'pro' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
            <Sparkles className="h-3 w-3" /><span>Pro</span>
          </button>
        </div>

        {/* Interactive Pseudo-State & WCAG Contrast Bar */}
        {(() => {
          const contrastBg = resolveEffectiveBgColor(selected.computedStyles, '#FFFFFF');
          const contrastReport = computeContrastReport(
            selected.computedStyles.color || textColorHex,
            contrastBg
          );
          return (
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
              {onChangePseudoState && (
                <div
                  className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
                  role="group"
                  aria-label="Preview element state"
                >
                  {(['default', 'hover', 'focus'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onChangePseudoState(selected.studioId, st)}
                      className={`rounded px-1.5 py-0.5 font-medium capitalize transition-colors ${
                        pseudoState === st
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st === 'default' ? 'Default' : `:${st}`}
                    </button>
                  ))}
                </div>
              )}

              <div
                title={`Text vs surface contrast ratio: ${contrastReport.ratioLabel} (${contrastReport.grade})`}
                className={`ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono font-semibold tabular-nums ${
                  contrastReport.passesAA
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : contrastReport.passesAALarge
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                <span>{contrastReport.grade}</span>
                <span>{contrastReport.ratioLabel}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3.5 studio-scroll">
        {/* Editable Text Content (always easily reachable when element has text) */}
        {selected.isTextEditable && (
          <section className="space-y-1.5 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <label htmlFor="inspector-text-content" className="text-[11px] font-semibold text-slate-700">
                Element Text
              </label>
              <button
                type="button"
                onClick={() =>
                  onCommitPatch(selected.filePath, selected.elementIndex, { textContent: textDraft })
                }
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                Apply Text
              </button>
            </div>
            <textarea
              id="inspector-text-content"
              rows={2}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={() => {
                if (textDraft !== selected.textContent) {
                  onCommitPatch(selected.filePath, selected.elementIndex, { textContent: textDraft });
                }
              }}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </section>
        )}

        {activeTab === 'style' && (
          <>
            <DesignTokensPresets key={selected.studioId + '-tokens'} selectionKey={selected.studioId} onPreview={(styles) => onPreviewStyles(selected.studioId, styles)} onCommit={commitStyles} />

            <section className="space-y-2 border-b border-slate-100 pb-4">
              <h3 className="text-[11px] font-semibold text-slate-700">
                Fill &amp; Multi-Stop Gradient
              </h3>
              <GradientEditor
                selectionKey={selected.studioId}
                value={gradientValue}
                onPreview={(cfg, css) => handleGradientApply(cfg, css, false)}
                onCommit={(cfg, css) => handleGradientApply(cfg, css, true)}
                onClearFill={() =>
                  commitStyles({
                    backgroundImage: null,
                    backgroundColor: null,
                    backgroundClip: null,
                    WebkitBackgroundClip: null,
                    WebkitTextFillColor: null,
                  })
                }
              />
            </section>

            <ImageBlendDesigner
              key={selected.studioId + '-image-blend'}
              selectionKey={selected.studioId}
              onPreview={(styles) => onPreviewStyles(selected.studioId, styles)}
              onCommit={commitStyles}
            />

            <BorderShadowGradientControls
              key={selected.studioId}
              selectionKey={selected.studioId}
              borderWidth={Number(borderWidthDraft) || 1}
              onPreview={(styles) => onPreviewStyles(selected.studioId, styles)}
              onCommit={commitStyles}
            />

            {/* Border & Radius & Shadow */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold text-slate-700">Border &amp; Elevation</h3>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <ScrubLabel
                    htmlFor="inspector-radius-input"
                    label="Corner Radius"
                    value={sliderRadius}
                    min={0}
                    max={200}
                    onScrubPreview={(val) => {
                      setRadiusDraft(String(val));
                      onPreviewStyles(selected.studioId, { borderRadius: `${val}px` });
                    }}
                    onScrubCommit={(val) => {
                      setRadiusDraft(String(val));
                      commitStyles({ borderRadius: `${val}px` });
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      id="inspector-radius-input"
                      type="number"
                      aria-label="Corner Radius px"
                      min={0}
                      max={200}
                      value={radiusDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setRadiusDraft(raw);
                        const parsed = clampCornerRadius(raw);
                        if (parsed !== null) {
                          commitStyles({ borderRadius: `${parsed}px` });
                        }
                      }}
                      onBlur={() => {
                        const parsed = clampCornerRadius(radiusDraft);
                        if (parsed === null) {
                          setRadiusDraft(radius);
                        } else {
                          setRadiusDraft(String(parsed));
                          commitStyles({ borderRadius: `${parsed}px` });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parsed = clampCornerRadius(radiusDraft);
                          if (parsed !== null) {
                            setRadiusDraft(String(parsed));
                            commitStyles({ borderRadius: `${parsed}px` });
                          }
                        }
                      }}
                      className="h-8 sm:h-7 w-16 rounded-md border border-slate-200 bg-white px-2 text-right font-mono text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] text-slate-400">px</span>
                  </div>
                </div>
                <input
                  id="inspector-radius"
                  aria-label="Corner Radius slider"
                  type="range"
                  min={0}
                  max={48}
                  value={sliderRadius}
                  onChange={(e) => {
                    setRadiusDraft(e.target.value);
                    onPreviewStyles(selected.studioId, { borderRadius: `${e.target.value}px` });
                  }}
                  onPointerUp={(e) =>
                    commitStyles({ borderRadius: `${(e.target as HTMLInputElement).value}px` })
                  }
                  onTouchEnd={(e) =>
                    commitStyles({ borderRadius: `${(e.target as HTMLInputElement).value}px` })
                  }
                  onKeyUp={(e) =>
                    commitStyles({ borderRadius: `${(e.target as HTMLInputElement).value}px` })
                  }
                  className="h-2 sm:h-1.5 w-full cursor-pointer touch-none accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1">
                    <ScrubLabel
                      htmlFor="inspector-border-width"
                      label="Border Width"
                      value={Number(borderWidthDraft) || 0}
                      min={0}
                      max={24}
                      onScrubPreview={(val) => {
                        setBorderWidthDraft(String(val));
                        onPreviewStyles(selected.studioId, {
                          borderWidth: `${val}px`,
                          borderStyle: val === 0 ? 'none' : 'solid',
                          borderColor: borderColorHex,
                        });
                      }}
                      onScrubCommit={(val) => {
                        setBorderWidthDraft(String(val));
                        commitStyles({
                          borderWidth: `${val}px`,
                          borderStyle: val === 0 ? 'none' : 'solid',
                          borderColor: borderColorHex,
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="inspector-border-width"
                      type="number"
                      aria-label="Border Width"
                      min={0}
                      max={24}
                      value={borderWidthDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setBorderWidthDraft(raw);
                        const parsed = clampBorderWidth(raw);
                        if (parsed !== null) {
                          const w = `${parsed}px`;
                          commitStyles({
                            borderWidth: w,
                            borderStyle: parsed === 0 ? 'none' : 'solid',
                            borderColor: borderColorHex,
                          });
                        }
                      }}
                      onBlur={() => {
                        const parsed = clampBorderWidth(borderWidthDraft);
                        if (parsed === null) {
                          setBorderWidthDraft(borderWidth);
                        } else {
                          setBorderWidthDraft(String(parsed));
                        }
                      }}
                      className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-right font-mono text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] text-slate-400">px</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="inspector-border-hex" className="mb-1 block text-[11px] text-slate-600">
                    Border Hex
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      aria-label="Border color picker"
                      value={normalizeHex(borderColorHex, '#E2E8F0')}
                      onChange={(e) => {
                        const hex = normalizeHex(e.target.value);
                        setBorderColorHex(hex);
                        commitStyles({ borderColor: hex, borderStyle: 'solid' });
                      }}
                      className="h-8 w-7 shrink-0 cursor-pointer rounded border border-slate-200 p-0.5"
                    />
                    <input
                      id="inspector-border-hex"
                      type="text"
                      value={borderColorHex}
                      onChange={(e) => {
                        setBorderColorHex(e.target.value);
                        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                          commitStyles({ borderColor: e.target.value.toUpperCase(), borderStyle: 'solid' });
                        }
                      }}
                      className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-1.5 font-mono text-[11px] uppercase text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <ScrubLabel
                    htmlFor="inspector-opacity-input"
                    label="Opacity"
                    value={sliderOpacity}
                    min={0}
                    max={100}
                    onScrubPreview={(val) => {
                      setOpacityDraft(String(val));
                      onPreviewStyles(selected.studioId, { opacity: String(val / 100) });
                    }}
                    onScrubCommit={(val) => {
                      setOpacityDraft(String(val));
                      commitStyles({ opacity: String(val / 100) });
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      id="inspector-opacity-input"
                      type="number"
                      aria-label="Opacity percent"
                      min={0}
                      max={100}
                      value={opacityDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setOpacityDraft(raw);
                        const parsed = clampOpacityPercent(raw);
                        if (parsed !== null) {
                          commitStyles({ opacity: String(parsed / 100) });
                        }
                      }}
                      onBlur={() => {
                        const parsed = clampOpacityPercent(opacityDraft);
                        if (parsed === null) {
                          setOpacityDraft(String(opacity));
                        } else {
                          setOpacityDraft(String(parsed));
                          commitStyles({ opacity: String(parsed / 100) });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parsed = clampOpacityPercent(opacityDraft);
                          if (parsed !== null) {
                            setOpacityDraft(String(parsed));
                            commitStyles({ opacity: String(parsed / 100) });
                          }
                        }
                      }}
                      className="h-8 sm:h-7 w-16 rounded-md border border-slate-200 bg-white px-2 text-right font-mono text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] text-slate-400">%</span>
                  </div>
                </div>
                <input
                  id="inspector-opacity"
                  aria-label="Opacity slider"
                  type="range"
                  min={0}
                  max={100}
                  value={sliderOpacity}
                  onChange={(e) => {
                    setOpacityDraft(e.target.value);
                    onPreviewStyles(selected.studioId, {
                      opacity: String(Number(e.target.value) / 100),
                    });
                  }}
                  onPointerUp={(e) =>
                    commitStyles({
                      opacity: String(Number((e.target as HTMLInputElement).value) / 100),
                    })
                  }
                  onTouchEnd={(e) =>
                    commitStyles({
                      opacity: String(Number((e.target as HTMLInputElement).value) / 100),
                    })
                  }
                  onKeyUp={(e) =>
                    commitStyles({
                      opacity: String(Number((e.target as HTMLInputElement).value) / 100),
                    })
                  }
                  className="h-2 sm:h-1.5 w-full cursor-pointer touch-none accent-blue-600"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-[11px] text-slate-600">Elevation &amp; Shadow</span>
                <div className="grid grid-cols-4 gap-1">
                  {SHADOW_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setShadowCssDraft(preset.val);
                        setElevationDraft(String(boxShadowToElevationHint(preset.val)));
                        commitStyles({ boxShadow: preset.val });
                      }}
                      className={`rounded border py-1 text-[11px] font-medium transition-colors ${
                        activeShadowPreset === preset.label
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-[84px_1fr] gap-2">
                  <div>
                    <label htmlFor="inspector-elevation-level" className="mb-1 block text-[10px] text-slate-500">
                      Level (0-24)
                    </label>
                    <input
                      id="inspector-elevation-level"
                      type="number"
                      aria-label="Elevation level"
                      min={0}
                      max={24}
                      value={elevationDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setElevationDraft(raw);
                        const lvl = clampElevationLevel(raw);
                        if (lvl !== null) {
                          const nextShadow = elevationLevelToBoxShadow(lvl);
                          setShadowCssDraft(nextShadow);
                          commitStyles({ boxShadow: nextShadow });
                        }
                      }}
                      onBlur={() => {
                        const lvl = clampElevationLevel(elevationDraft);
                        if (lvl === null) {
                          setElevationDraft(String(rawElevation));
                        } else {
                          setElevationDraft(String(lvl));
                        }
                      }}
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-right font-mono text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="inspector-shadow-css" className="mb-1 block text-[10px] text-slate-500">
                      Shadow CSS
                    </label>
                    <input
                      id="inspector-shadow-css"
                      type="text"
                      aria-label="Shadow CSS"
                      value={shadowCssDraft}
                      onChange={(e) => setShadowCssDraft(e.target.value)}
                      onBlur={() => {
                        const trimmed = shadowCssDraft.trim();
                        if (!trimmed) {
                          setShadowCssDraft(rawBoxShadow);
                          return;
                        }
                        commitStyles({ boxShadow: trimmed });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const trimmed = shadowCssDraft.trim();
                          if (trimmed) {
                            commitStyles({ boxShadow: trimmed });
                          }
                        }
                      }}
                      placeholder="0 10px 25px -5px rgba(15,23,42,0.12)"
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'layout' && (() => {
          const detectedConstraints = detectConstraintState(ins, cs);
          const posMode = (ins.position || cs.position || 'static') as PositionMode;
          const displayMode = ins.display || cs.display || 'block';
          const isFlex = displayMode === 'flex' || displayMode === 'inline-flex';
          const isGrid = displayMode === 'grid';
          const gridCols = parseGridColumnCount(ins['grid-template-columns'] || cs.gridTemplateColumns);

          const effectiveBp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
          const widthMode = detectBreakpointSizeMode(selected.className, ins.width, 'width', effectiveBp);
          const heightMode = detectBreakpointSizeMode(selected.className, ins.height, 'height', effectiveBp);

          const layoutGap = Number.parseInt(ins.gap || cs.gap || '8', 10) || 0;
          const layoutPadding = Number.parseInt(ins.padding || cs.padding || '0', 10) || 0;
          const layoutAxis: LayoutAxis = isGrid ? 'grid' : (ins.flexDirection || cs.flexDirection || 'column') === 'row' ? 'horizontal' : 'vertical';
          const layoutWrap = (ins.flexWrap || cs.flexWrap || 'nowrap') === 'wrap';
          const layoutAlign: 'start' | 'center' | 'end' | 'stretch' = (ins.alignItems || cs.alignItems || 'flex-start') === 'center' ? 'center' :
            (ins.alignItems || cs.alignItems || 'flex-start') === 'flex-end' ? 'end' :
            (ins.alignItems || cs.alignItems || 'flex-start') === 'stretch' ? 'stretch' : 'start';
          const applyAutoLayout = (axis: LayoutAxis, gap = layoutGap, padding = layoutPadding, wrap = layoutWrap, align = layoutAlign) => {
            commitStyles(layoutContainerCss({ axis, gap, padding, wrap, align }));
          };
          const applySizing = (axis: 'width' | 'height', mode: SizingMode) => commitStyles(sizingModeCss(mode, axis));
          return (
            <>
              <section className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Auto Layout Engine</h3>
                    <p className="text-[10px] text-slate-500">Apply layout rules directly to this element</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">New</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['horizontal', 'vertical', 'grid'] as LayoutAxis[]).map((axis) => (
                    <button key={axis} type="button" onClick={() => applyAutoLayout(axis)}
                      className={`rounded-md border px-2 py-1.5 text-[10px] font-medium capitalize ${layoutAxis === axis ? 'border-blue-500 bg-blue-100 text-blue-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {axis}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[10px] text-slate-500">Gap
                    <input type="number" min="0" max="128" value={layoutGap} onChange={(e) => applyAutoLayout(layoutAxis, layoutGapPreset(Number(e.target.value)), layoutPadding)}
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800" />
                  </label>
                  <label className="space-y-1 text-[10px] text-slate-500">Padding
                    <input type="number" min="0" max="128" value={layoutPadding} onChange={(e) => applyAutoLayout(layoutAxis, layoutGap, Math.max(0, Number(e.target.value)))}
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800" />
                  </label>
                </div>
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-2">
                  <span className="text-[11px] text-slate-700">Wrap children</span>
                  <button type="button" onClick={() => applyAutoLayout(layoutAxis, layoutGap, layoutPadding, !layoutWrap)}
                    className={`rounded px-2 py-1 text-[10px] ${layoutWrap ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{layoutWrap ? 'On' : 'Off'}</button>
                </div>
                <label className="block space-y-1 text-[10px] text-slate-500">Align items
                  <select value={layoutAlign} onChange={(e) => applyAutoLayout(layoutAxis, layoutGap, layoutPadding, layoutWrap, e.target.value as 'start' | 'center' | 'end' | 'stretch')}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800">
                    <option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="stretch">Stretch</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['width', 'height'] as const).map((axis) => (
                    <label key={axis} className="space-y-1 text-[10px] text-slate-500 capitalize">{axis} sizing
                      <select defaultValue="fixed" onChange={(e) => applySizing(axis, e.target.value as SizingMode)}
                        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800">
                        <option value="fixed">Fixed</option><option value="hug">Hug content</option><option value="fill">Fill container</option>
                      </select>
                    </label>
                  ))}
                </div>
              </section>
              {/* Smart Aligner Quick Section */}
              {(onSmartAutoAlign || onSmartAlignElement || onSmartRedesignBlock) && (
                <section className="space-y-2.5 border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                      <Wand2 className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Smart Aligner</span>
                    </h3>
                    {onOpenSmartAligner && (
                      <button
                        type="button"
                        onClick={onOpenSmartAligner}
                        className="text-[10px] font-semibold text-indigo-600 hover:underline"
                      >
                        Full Panel
                      </button>
                    )}
                  </div>

                  {onChangeAlignBreakpointScope && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Breakpoint Scope</span>
                        <span className="font-mono text-indigo-600">{effectiveBp}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-0.5 rounded-md border border-slate-200 bg-slate-100 p-0.5">
                        {(
                          [
                            { id: 'auto', label: 'Auto' },
                            { id: 'mobile', label: 'Mob' },
                            { id: 'tablet', label: 'Tab' },
                            { id: 'desktop', label: 'Desk' },
                            { id: 'all', label: 'All' },
                          ] as Array<{ id: AlignBreakpointScope; label: string }>
                        ).map((bp) => (
                          <button
                            key={bp.id}
                            type="button"
                            onClick={() => onChangeAlignBreakpointScope(bp.id)}
                            className={`h-6 rounded text-[10px] font-medium ${
                              alignBreakpointScope === bp.id
                                ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {bp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {onSmartAutoAlign && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSmartAutoAlign('responsive-all', selected.elementIndex)}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 text-[11px] font-semibold text-white hover:bg-indigo-700"
                      >
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span>Auto-Align Block</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSmartAutoAlign('responsive-all')}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        <span>Auto-Align Page</span>
                      </button>
                    </div>
                  )}

                  {onSmartAlignElement && (
                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          { id: 'left', label: 'Left' },
                          { id: 'center', label: 'Center' },
                          { id: 'right', label: 'Right' },
                          { id: 'between', label: 'Betw' },
                        ] as Array<{ id: HorizontalAlign; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          aria-label={`Smart align ${opt.id}`}
                          onClick={() =>
                            onSmartAlignElement({
                              filePath: selected.filePath,
                              elementIndex: selected.elementIndex,
                              horizontal: opt.id,
                            })
                          }
                          className="h-7 rounded border border-slate-200 bg-white text-[10px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {onSmartRedesignBlock && (
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'stack', label: 'Stack ↓' },
                          { id: 'split-2', label: '2-Col' },
                          { id: 'grid-3', label: '3-Col' },
                          { id: 'wrap-row', label: 'Wrap Row' },
                          { id: 'center-hero', label: 'Center Hero' },
                          { id: 'space-bar', label: 'Space Bar' },
                        ] as Array<{ id: BlockRedesignPattern; label: string }>
                      ).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            onSmartRedesignBlock(
                              selected.filePath,
                              selected.elementIndex,
                              preset.id
                            )
                          }
                          className="h-7 rounded border border-slate-200 bg-slate-50 px-1 text-[10px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Size & Responsive Sizing Modes */}
              <section className="space-y-2.5 border-b border-slate-100 pb-4">
                <h3 className="text-[11px] font-semibold text-slate-700">Dimensions &amp; Sizing</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="inspector-width" className="text-[11px] text-slate-600">
                        Width
                      </label>
                      <div className="flex items-center gap-0.5">
                        {(['fixed', 'fill', 'hug'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              const modePatch = applySizeConstraintMode('width', m, selected.rect.width);
                              if (m === 'hug') {
                                commitStyles(modePatch);
                              } else {
                                commitStyles(
                                  buildResizeContainmentStyles({
                                    width: modePatch.width || undefined,
                                    inlineStyles: selected.inlineStyles,
                                    computedStyles: selected.computedStyles,
                                    currentRect: selected.rect,
                                  })
                                );
                              }
                            }}
                            className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${
                              widthMode === m
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      id="inspector-width"
                      type="text"
                      defaultValue={currentWidth}
                      key={`w-${selected.studioId}-${currentWidth}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v) return;
                        const nextW = /^\d+$/.test(v) ? `${v}px` : v;
                        if (nextW === 'auto') {
                          commitStyles({ width: 'auto' });
                        } else {
                          commitStyles(
                            buildResizeContainmentStyles({
                              width: nextW,
                              inlineStyles: selected.inlineStyles,
                              computedStyles: selected.computedStyles,
                              currentRect: selected.rect,
                            })
                          );
                        }
                      }}
                      className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="inspector-height" className="text-[11px] text-slate-600">
                        Height
                      </label>
                      <div className="flex items-center gap-0.5">
                        {(['fixed', 'fill', 'hug'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              const modePatch = applySizeConstraintMode('height', m, selected.rect.height);
                              if (m === 'hug') {
                                commitStyles(modePatch);
                              } else {
                                commitStyles(
                                  buildResizeContainmentStyles({
                                    height: modePatch.height || undefined,
                                    inlineStyles: selected.inlineStyles,
                                    computedStyles: selected.computedStyles,
                                    currentRect: selected.rect,
                                  })
                                );
                              }
                            }}
                            className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${
                              heightMode === m
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      id="inspector-height"
                      type="text"
                      defaultValue={currentHeight}
                      key={`h-${selected.studioId}-${currentHeight}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v) return;
                        const nextH = /^\d+$/.test(v) ? `${v}px` : v;
                        if (nextH === 'auto') {
                          commitStyles({ height: 'auto' });
                        } else {
                          commitStyles(
                            buildResizeContainmentStyles({
                              height: nextH,
                              inlineStyles: selected.inlineStyles,
                              computedStyles: selected.computedStyles,
                              currentRect: selected.rect,
                            })
                          );
                        }
                      }}
                      className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                    />
                  </div>
                </div>
              </section>

              {/* Flexbox & Grid Controls */}
              <section className="space-y-2.5 border-b border-slate-100 pb-4">
                <h3 className="text-[11px] font-semibold text-slate-700">Flexbox &amp; Grid</h3>
                <div className="grid grid-cols-4 gap-1" role="group" aria-label="Display mode">
                  {(['block', 'flex', 'inline-flex', 'grid'] as const).map((disp) => (
                    <button
                      key={disp}
                      type="button"
                      onClick={() => commitStyles({ display: disp })}
                      className={`rounded border py-1 text-[10px] font-semibold capitalize ${
                        displayMode === disp
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {disp === 'inline-flex' ? 'Inl-Flex' : disp}
                    </button>
                  ))}
                </div>

                {isFlex && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label htmlFor="inspector-flex-dir" className="mb-0.5 block text-[10px] text-slate-500">
                          Direction
                        </label>
                        <select
                          id="inspector-flex-dir"
                          aria-label="Flex direction"
                          value={ins['flex-direction'] || cs.flexDirection || 'row'}
                          onChange={(e) => commitStyles({ flexDirection: e.target.value })}
                          className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px]"
                        >
                          <option value="row">Row →</option>
                          <option value="column">Column ↓</option>
                          <option value="row-reverse">Row Rev ←</option>
                          <option value="column-reverse">Col Rev ↑</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="inspector-flex-wrap" className="mb-0.5 block text-[10px] text-slate-500">
                          Wrap
                        </label>
                        <select
                          id="inspector-flex-wrap"
                          aria-label="Flex wrap"
                          value={ins['flex-wrap'] || cs.flexWrap || 'nowrap'}
                          onChange={(e) => commitStyles({ flexWrap: e.target.value })}
                          className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px]"
                        >
                          <option value="nowrap">No Wrap</option>
                          <option value="wrap">Wrap</option>
                          <option value="wrap-reverse">Wrap Rev</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label htmlFor="inspector-justify" className="mb-0.5 block text-[10px] text-slate-500">
                          Justify Content
                        </label>
                        <select
                          id="inspector-justify"
                          aria-label="Justify content"
                          value={ins['justify-content'] || cs.justifyContent || 'flex-start'}
                          onChange={(e) => commitStyles({ justifyContent: e.target.value })}
                          className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px]"
                        >
                          <option value="flex-start">Start</option>
                          <option value="center">Center</option>
                          <option value="flex-end">End</option>
                          <option value="space-between">Between</option>
                          <option value="space-around">Around</option>
                          <option value="space-evenly">Evenly</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="inspector-align-items" className="mb-0.5 block text-[10px] text-slate-500">
                          Align Items
                        </label>
                        <select
                          id="inspector-align-items"
                          aria-label="Align items"
                          value={ins['align-items'] || cs.alignItems || 'stretch'}
                          onChange={(e) => commitStyles({ alignItems: e.target.value })}
                          className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px]"
                        >
                          <option value="flex-start">Start</option>
                          <option value="center">Center</option>
                          <option value="flex-end">End</option>
                          <option value="stretch">Stretch</option>
                          <option value="baseline">Baseline</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {isGrid && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-medium text-slate-600">Grid Columns</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map((cols) => (
                          <button
                            key={cols}
                            type="button"
                            onClick={() =>
                              commitStyles({
                                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                              })
                            }
                            className={`h-6 w-6 rounded border font-mono text-[10px] font-semibold ${
                              gridCols === cols
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {cols}
                          </button>
                        ))}
                        <input
                          type="number"
                          aria-label="Grid columns count"
                          min={1}
                          max={12}
                          defaultValue={gridCols}
                          key={`gc-${selected.studioId}-${gridCols}`}
                          onChange={(e) => {
                            const n = Math.min(12, Math.max(1, Number(e.target.value) || 1));
                            commitStyles({
                              gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
                            });
                          }}
                          className="h-6 w-11 rounded border border-slate-200 bg-white px-1 text-right font-mono text-[11px] tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label htmlFor="inspector-grid-rows" className="mb-0.5 block text-[10px] text-slate-500">
                          Rows Template
                        </label>
                        <input
                          id="inspector-grid-rows"
                          type="text"
                          aria-label="Grid rows template"
                          defaultValue={ins['grid-template-rows'] || 'auto'}
                          key={`gr-${selected.studioId}-${ins['grid-template-rows'] || ''}`}
                          onBlur={(e) =>
                            commitStyles({ gridTemplateRows: e.target.value.trim() || null })
                          }
                          placeholder="auto"
                          className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label htmlFor="inspector-grid-align" className="mb-0.5 block text-[10px] text-slate-500">
                          Justify Items
                        </label>
                        <select
                          id="inspector-grid-align"
                          aria-label="Grid justify items"
                          value={ins['justify-items'] || cs.justifyItems || 'stretch'}
                          onChange={(e) => commitStyles({ justifyItems: e.target.value })}
                          className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px]"
                        >
                          <option value="stretch">Stretch</option>
                          <option value="start">Start</option>
                          <option value="center">Center</option>
                          <option value="end">End</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {(isFlex || isGrid) && (
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="mb-0.5 block text-[10px] text-slate-500">Gap (px)</label>
                      <input
                        type="number"
                        aria-label="Container gap"
                        min={0}
                        max={96}
                        defaultValue={parsePxNumber(ins.gap || cs.gap) || '16'}
                        key={`gap-${selected.studioId}-${ins.gap || cs.gap}`}
                        onChange={(e) =>
                          commitStyles({ gap: `${Math.max(0, Number(e.target.value) || 0)}px` })
                        }
                        className="h-7 w-full rounded border border-slate-200 px-1.5 font-mono text-[11px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-slate-500">Row Gap</label>
                      <input
                        type="number"
                        aria-label="Row gap"
                        min={0}
                        max={96}
                        defaultValue={parsePxNumber(ins['row-gap'] || cs.rowGap) || '16'}
                        key={`rgap-${selected.studioId}-${ins['row-gap'] || cs.rowGap}`}
                        onChange={(e) =>
                          commitStyles({ rowGap: `${Math.max(0, Number(e.target.value) || 0)}px` })
                        }
                        className="h-7 w-full rounded border border-slate-200 px-1.5 font-mono text-[11px] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-slate-500">Col Gap</label>
                      <input
                        type="number"
                        aria-label="Column gap"
                        min={0}
                        max={96}
                        defaultValue={parsePxNumber(ins['column-gap'] || cs.columnGap) || '16'}
                        key={`cgap-${selected.studioId}-${ins['column-gap'] || cs.columnGap}`}
                        onChange={(e) =>
                          commitStyles({ columnGap: `${Math.max(0, Number(e.target.value) || 0)}px` })
                        }
                        className="h-7 w-full rounded border border-slate-200 px-1.5 font-mono text-[11px] tabular-nums"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-500">Flex Grow</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(['0', '1'] as const).map((fg) => (
                        <button
                          key={fg}
                          type="button"
                          onClick={() => commitStyles({ flexGrow: fg })}
                          className={`h-7 rounded border font-mono text-[11px] ${
                            (ins['flex-grow'] || cs.flexGrow || '0') === fg
                              ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {fg === '0' ? 'Fixed (0)' : 'Grow (1)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="inspector-align-self" className="mb-0.5 block text-[10px] text-slate-500">
                      Align Self
                    </label>
                    <select
                      id="inspector-align-self"
                      aria-label="Align self"
                      value={ins['align-self'] || cs.alignSelf || 'auto'}
                      onChange={(e) => commitStyles({ alignSelf: e.target.value })}
                      className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-[11px]"
                    >
                      <option value="auto">Auto</option>
                      <option value="flex-start">Start</option>
                      <option value="center">Center</option>
                      <option value="flex-end">End</option>
                      <option value="stretch">Stretch</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Positioning & Constraints */}
              <section className="space-y-2.5 border-b border-slate-100 pb-4">
                <h3 className="text-[11px] font-semibold text-slate-700">
                  Positioning &amp; Constraints
                </h3>

                <div className="grid grid-cols-5 gap-1" role="group" aria-label="CSS position mode">
                  {(['static', 'relative', 'absolute', 'fixed', 'sticky'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => commitStyles({ position: mode })}
                      className={`rounded border py-1 text-[10px] font-medium capitalize ${
                        posMode === mode
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mode === 'absolute' ? 'Abs' : mode === 'relative' ? 'Rel' : mode}
                    </button>
                  ))}
                </div>

                {/* Constraints Pin Widget */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-600">
                      Edge &amp; Center Constraints
                    </span>
                    <span className="font-mono text-[10px] text-blue-600">
                      {detectedConstraints.horizontal} / {detectedConstraints.vertical}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_76px] items-center gap-2">
                    <div className="space-y-1.5">
                      <div>
                        <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                          Horizontal Pin
                        </span>
                        <div className="grid grid-cols-5 gap-0.5">
                          {(
                            [
                              { id: 'left', label: 'L' },
                              { id: 'center', label: 'C' },
                              { id: 'right', label: 'R' },
                              { id: 'left-right', label: 'L+R' },
                              { id: 'scale', label: '%' },
                            ] as Array<{ id: HorizontalConstraint; label: string }>
                          ).map((hc) => (
                            <button
                              key={hc.id}
                              type="button"
                              aria-label={`Horizontal constraint ${hc.id}`}
                              onClick={() =>
                                commitStyles(
                                  applyHorizontalConstraintPatch(
                                    hc.id,
                                    selected.rect,
                                    selected.parentRect ?? null,
                                    posMode
                                  )
                                )
                              }
                              className={`h-6 rounded border text-[10px] font-semibold ${
                                detectedConstraints.horizontal === hc.id
                                  ? 'border-blue-500 bg-blue-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {hc.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                          Vertical Pin
                        </span>
                        <div className="grid grid-cols-5 gap-0.5">
                          {(
                            [
                              { id: 'top', label: 'T' },
                              { id: 'center', label: 'C' },
                              { id: 'bottom', label: 'B' },
                              { id: 'top-bottom', label: 'T+B' },
                              { id: 'scale', label: '%' },
                            ] as Array<{ id: VerticalConstraint; label: string }>
                          ).map((vc) => (
                            <button
                              key={vc.id}
                              type="button"
                              aria-label={`Vertical constraint ${vc.id}`}
                              onClick={() =>
                                commitStyles(
                                  applyVerticalConstraintPatch(
                                    vc.id,
                                    selected.rect,
                                    selected.parentRect ?? null,
                                    posMode
                                  )
                                )
                              }
                              className={`h-6 rounded border text-[10px] font-semibold ${
                                detectedConstraints.vertical === vc.id
                                  ? 'border-blue-500 bg-blue-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {vc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Visual Constraint Box Indicator */}
                    <div
                      aria-hidden="true"
                      className="relative flex h-[72px] w-[72px] items-center justify-center rounded-md border border-slate-300 bg-white"
                    >
                      <div className="h-7 w-7 rounded border border-dashed border-slate-400 bg-blue-50" />
                      {/* Left line */}
                      <span
                        className={`absolute left-1 top-1/2 h-0.5 w-3.5 -translate-y-1/2 ${
                          detectedConstraints.horizontal === 'left' ||
                          detectedConstraints.horizontal === 'left-right'
                            ? 'bg-blue-600'
                            : 'bg-slate-200'
                        }`}
                      />
                      {/* Right line */}
                      <span
                        className={`absolute right-1 top-1/2 h-0.5 w-3.5 -translate-y-1/2 ${
                          detectedConstraints.horizontal === 'right' ||
                          detectedConstraints.horizontal === 'left-right'
                            ? 'bg-blue-600'
                            : 'bg-slate-200'
                        }`}
                      />
                      {/* Top line */}
                      <span
                        className={`absolute top-1 left-1/2 h-3.5 w-0.5 -translate-x-1/2 ${
                          detectedConstraints.vertical === 'top' ||
                          detectedConstraints.vertical === 'top-bottom'
                            ? 'bg-blue-600'
                            : 'bg-slate-200'
                        }`}
                      />
                      {/* Bottom line */}
                      <span
                        className={`absolute bottom-1 left-1/2 h-3.5 w-0.5 -translate-x-1/2 ${
                          detectedConstraints.vertical === 'bottom' ||
                          detectedConstraints.vertical === 'top-bottom'
                            ? 'bg-blue-600'
                            : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Inset Offsets + Z-Index + Overflow */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Top', key: 'top', val: ins.top || '' },
                    { label: 'Right', key: 'right', val: ins.right || '' },
                    { label: 'Bot', key: 'bottom', val: ins.bottom || '' },
                    { label: 'Left', key: 'left', val: ins.left || '' },
                  ].map((edge) => (
                    <div key={edge.key}>
                      <label className="mb-0.5 block text-[10px] text-slate-500">{edge.label}</label>
                      <input
                        type="text"
                        aria-label={`Position ${edge.key}`}
                        defaultValue={edge.val}
                        key={`pos-${edge.key}-${selected.studioId}-${edge.val}`}
                        placeholder="auto"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          commitStyles({
                            [edge.key]: !v ? null : /^-?\d+$/.test(v) ? `${v}px` : v,
                          });
                        }}
                        className="h-7 w-full rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-800"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="inspector-zindex" className="mb-0.5 block text-[10px] text-slate-500">
                      Z-Index
                    </label>
                    <input
                      id="inspector-zindex"
                      type="number"
                      aria-label="Z-Index"
                      defaultValue={ins['z-index'] || (cs.zIndex === 'auto' ? '0' : cs.zIndex)}
                      key={`zi-${selected.studioId}-${ins['z-index'] || cs.zIndex}`}
                      onChange={(e) =>
                        commitStyles({ zIndex: e.target.value === '' ? null : String(Number(e.target.value) || 0) })
                      }
                      className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="inspector-overflow" className="mb-0.5 block text-[10px] text-slate-500">
                      Overflow
                    </label>
                    <select
                      id="inspector-overflow"
                      aria-label="Overflow"
                      value={ins.overflow || cs.overflow || 'visible'}
                      onChange={(e) => commitStyles({ overflow: e.target.value })}
                      className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs"
                    >
                      <option value="visible">Visible</option>
                      <option value="hidden">Hidden</option>
                      <option value="auto">Auto</option>
                      <option value="scroll">Scroll</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Padding & Margin */}
              <section className="space-y-2.5 border-b border-slate-100 pb-4">
                <h3 className="text-[11px] font-semibold text-slate-700">Padding (px)</h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Top', key: 'paddingTop', val: padTop },
                    { label: 'Right', key: 'paddingRight', val: padRight },
                    { label: 'Bot', key: 'paddingBottom', val: padBottom },
                    { label: 'Left', key: 'paddingLeft', val: padLeft },
                  ].map((item) => (
                    <div key={item.key}>
                      <label className="mb-0.5 block text-[10px] text-slate-500">{item.label}</label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        defaultValue={item.val}
                        key={`${item.key}-${selected.studioId}-${item.val}`}
                        onChange={(e) =>
                          commitStyles({ [item.key]: `${Math.max(0, Number(e.target.value) || 0)}px` })
                        }
                        className="h-7 w-full rounded border border-slate-200 px-1.5 font-mono text-[11px] tabular-nums text-slate-800"
                      />
                    </div>
                  ))}
                </div>

                <h3 className="pt-1 text-[11px] font-semibold text-slate-700">Margin Y (px)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-500">Top</label>
                    <input
                      type="number"
                      defaultValue={marTop}
                      key={`mt-${selected.studioId}-${marTop}`}
                      onChange={(e) => commitStyles({ marginTop: `${Number(e.target.value) || 0}px` })}
                      className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-[11px] tabular-nums text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-500">Bottom</label>
                    <input
                      type="number"
                      defaultValue={marBottom}
                      key={`mb-${selected.studioId}-${marBottom}`}
                      onChange={(e) => commitStyles({ marginBottom: `${Number(e.target.value) || 0}px` })}
                      className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-[11px] tabular-nums text-slate-800"
                    />
                  </div>
                </div>
              </section>

              {/* Drag Transform Offset */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold text-slate-700">Drag Offset (Translate)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1">
                      <ScrubLabel
                        label="Offset X (px)"
                        value={offsetX}
                        min={-400}
                        max={400}
                        onScrubPreview={(nx) => {
                          setOffsetX(nx);
                          onPreviewStyles(selected.studioId, {
                            translate: `${nx}px ${offsetY}px`,
                            transform: 'none',
                          });
                        }}
                        onScrubCommit={(nx) => {
                          setOffsetX(nx);
                          commitStyles({ transform: `translate(${nx}px, ${offsetY}px)` });
                        }}
                      />
                    </div>
                    <input
                      type="number"
                      value={offsetX}
                      onChange={(e) => {
                        const nx = Number(e.target.value) || 0;
                        setOffsetX(nx);
                        commitStyles({ transform: `translate(${nx}px, ${offsetY}px)` });
                      }}
                      className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="mb-1">
                      <ScrubLabel
                        label="Offset Y (px)"
                        value={offsetY}
                        min={-400}
                        max={400}
                        onScrubPreview={(ny) => {
                          setOffsetY(ny);
                          onPreviewStyles(selected.studioId, {
                            translate: `${offsetX}px ${ny}px`,
                            transform: 'none',
                          });
                        }}
                        onScrubCommit={(ny) => {
                          setOffsetY(ny);
                          commitStyles({ transform: `translate(${offsetX}px, ${ny}px)` });
                        }}
                      />
                    </div>
                    <input
                      type="number"
                      value={offsetY}
                      onChange={(e) => {
                        const ny = Number(e.target.value) || 0;
                        setOffsetY(ny);
                        commitStyles({ transform: `translate(${offsetX}px, ${ny}px)` });
                      }}
                      className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>
              </section>
            </>
          );
        })()}

        {activeTab === 'type' && (
          <section className="space-y-3.5">
            <h3 className="text-[11px] font-semibold text-slate-700">Typography</h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1">
                  <ScrubLabel
                    htmlFor="inspector-font-size"
                    label="Size (px)"
                    value={Number(fontSize) || 16}
                    min={10}
                    max={120}
                    onScrubPreview={(val) =>
                      onPreviewStyles(selected.studioId, { fontSize: `${val}px` })
                    }
                    onScrubCommit={(val) => commitStyles({ fontSize: `${val}px` })}
                  />
                </div>
                <input
                  id="inspector-font-size"
                  type="number"
                  min={10}
                  max={120}
                  defaultValue={Number(fontSize) || 16}
                  key={`fs-${selected.studioId}-${fontSize}`}
                  onChange={(e) =>
                    commitStyles({ fontSize: `${Math.max(10, Number(e.target.value) || 16)}px` })
                  }
                  className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="inspector-font-weight" className="mb-1 block text-[11px] text-slate-600">
                  Weight
                </label>
                <select
                  id="inspector-font-weight"
                  value={fontWeight}
                  onChange={(e) => commitStyles({ fontWeight: e.target.value })}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                >
                  <option value="400">400 Regular</option>
                  <option value="500">500 Medium</option>
                  <option value="600">600 SemiBold</option>
                  <option value="700">700 Bold</option>
                  <option value="800">800 ExtraBold</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="inspector-text-hex" className="mb-1 block text-[11px] text-slate-600">
                Text Color Hex
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Text color picker"
                  value={textColorHex}
                  onChange={(e) => {
                    const hex = normalizeHex(e.target.value);
                    setTextColorHex(hex);
                    commitStyles({
                      color: hex,
                      WebkitTextFillColor: null,
                      WebkitBackgroundClip: null,
                      backgroundClip: null,
                    });
                  }}
                  className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-200 p-0.5"
                />
                <input
                  id="inspector-text-hex"
                  type="text"
                  value={textColorHex}
                  onChange={(e) => {
                    setTextColorHex(e.target.value);
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                      commitStyles({
                        color: e.target.value.toUpperCase(),
                        WebkitTextFillColor: null,
                        WebkitBackgroundClip: null,
                        backgroundClip: null,
                      });
                    }
                  }}
                  className="h-8 flex-1 rounded-md border border-slate-200 px-2.5 font-mono text-xs uppercase text-slate-800"
                />
              </div>
            </div>

            <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <div>
                <h4 className="text-[11px] font-semibold text-slate-700">Text Color Gradient</h4>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                  Apply solid HEX color or build a 2, 3 or 4-stop gradient using individual HEX values.
                </p>
              </div>
              <GradientEditor
                selectionKey={selected.studioId + ':text-color'}
                value={textGradientValue}
                onPreview={(cfg, css) => {
                  if (cfg.type === 'solid') setTextColorHex(cfg.stops[0]?.color || textColorHex);
                  handleGradientApply({ ...cfg, target: 'text' }, css, false);
                }}
                onCommit={(cfg, css) => {
                  if (cfg.type === 'solid') setTextColorHex(cfg.stops[0]?.color || textColorHex);
                  handleGradientApply({ ...cfg, target: 'text' }, css, true);
                }}
                onClearFill={() => {
                  commitStyles({
                    color: textColorHex,
                    backgroundImage: null,
                    backgroundClip: null,
                    WebkitBackgroundClip: null,
                    WebkitTextFillColor: null,
                  });
                }}
              />
            </section>

            <div>
              <span className="mb-1 block text-[11px] text-slate-600">Alignment</span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { val: 'left', icon: AlignLeft, label: 'Align left' },
                  { val: 'center', icon: AlignCenter, label: 'Align center' },
                  { val: 'right', icon: AlignRight, label: 'Align right' },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      aria-label={opt.label}
                      onClick={() => commitStyles({ textAlign: opt.val })}
                      className={`flex items-center justify-center rounded border py-1.5 ${
                        textAlign === opt.val
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">Line Height</label>
                <input
                  type="text"
                  defaultValue={cs.lineHeight || '1.5'}
                  key={`lh-${selected.studioId}-${cs.lineHeight}`}
                  onBlur={(e) => commitStyles({ lineHeight: e.target.value.trim() || null })}
                  className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">Letter Spacing</label>
                <input
                  type="text"
                  defaultValue={cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing}
                  key={`ls-${selected.studioId}-${cs.letterSpacing}`}
                  onBlur={(e) => commitStyles({ letterSpacing: e.target.value.trim() || null })}
                  className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                />
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[11px] text-slate-600">Optical Text Wrap</span>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { val: 'wrap', label: 'Wrap' },
                    { val: 'balance', label: 'Balance' },
                    { val: 'pretty', label: 'Pretty' },
                  ] as const
                ).map((opt) => {
                  const active = (selected.inlineStyles['text-wrap'] || cs.textWrap || 'wrap') === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => commitStyles({ textWrap: opt.val })}
                      className={`rounded border py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'fit' && (() => {
          const parentWidth = Math.round(selected.parentRect?.width || selected.viewportSize?.width || 0);
          const parentHeight = Math.round(selected.parentRect?.height || 0);
          const elementWidth = Math.round(selected.rect?.width || 0);
          const elementHeight = Math.round(selected.rect?.height || 0);
          const isCarousel = /circular-carousel/i.test(selected.className || '');
          const recommendedHeight = isCarousel ? 'min(70vh, 620px)' : parentHeight > 0 ? '100%' : 'auto';
          const applyFit = (width: string, height: string, minHeight: string, maxWidth: string) => {
            commitStyles({ width, height, minHeight: minHeight || null, maxWidth, boxSizing: 'border-box', flexShrink: '0' });
          };
          const fitButton = 'rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50';
          return (
            <section className="space-y-3 p-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Component Fit & Responsive Size</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Component ka size uske parent container ke actual dimensions ke comparison mein adjust karo. Changes saved source styles mein apply honge.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div><p className="text-[10px] text-slate-500">Parent width</p><p className="text-sm font-semibold tabular-nums text-slate-800">{parentWidth ? parentWidth + 'px' : 'Not measured'}</p></div>
                <div><p className="text-[10px] text-slate-500">Parent height</p><p className="text-sm font-semibold tabular-nums text-slate-800">{parentHeight ? parentHeight + 'px' : 'Auto / not set'}</p></div>
                <div><p className="text-[10px] text-slate-500">Component width</p><p className="text-xs font-medium tabular-nums text-slate-700">{elementWidth}px</p></div>
                <div><p className="text-[10px] text-slate-500">Component height</p><p className="text-xs font-medium tabular-nums text-slate-700">{elementHeight}px</p></div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-700">Suggested settings</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={fitButton} onClick={() => applyFit('100%', recommendedHeight, isCarousel ? '420px' : '0px', '100%')}>Recommended fit</button>
                  <button type="button" className={fitButton} onClick={() => applyFit('100%', 'auto', '0px', '100%')}>Fit parent width</button>
                  <button type="button" className={fitButton} onClick={() => applyFit('100%', parentHeight > 0 ? '100%' : '70vh', isCarousel ? '420px' : '280px', '100%')}>Fill container</button>
                  <button type="button" className={fitButton} onClick={() => applyFit('min(100%, 720px)', '420px', '320px', '100%')}>Centered / compact</button>
                </div>
                {isCarousel && <p className="rounded-md bg-emerald-50 px-2.5 py-2 text-[10px] leading-relaxed text-emerald-800">CircularCarousel detected: its original CSS uses height: 100%. The recommended preset adds a 420px minimum and responsive height.</p>}
                {parentHeight === 0 && <p className="rounded-md bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800">Parent height is currently auto. A child set to height: 100% may collapse; choose Recommended fit or set a custom height.</p>}
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 p-2.5">
                <p className="text-[11px] font-semibold text-slate-700">Custom dimensions</p>
                <label className="block space-y-1"><span className="text-[10px] text-slate-500">Width (px, %, vw, or CSS value)</span><input value={fitWidthDraft} onChange={(event) => setFitWidthDraft(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs" placeholder="100%" /></label>
                <label className="block space-y-1"><span className="text-[10px] text-slate-500">Height (px, %, vh, or CSS value)</span><input value={fitHeightDraft} onChange={(event) => setFitHeightDraft(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-2 text-xs" placeholder="420px" /></label>
                <button type="button" className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700" onClick={() => {
                  const validCssSize = (value: string) => /^(auto|0|\d+(?:\.\d+)?(?:px|%|vw|vh|rem|em)|min\(.+\)|max\(.+\)|clamp\(.+\))$/i.test(value.trim());
                  if (!validCssSize(fitWidthDraft) || !validCssSize(fitHeightDraft)) return;
                  applyFit(fitWidthDraft.trim(), fitHeightDraft.trim(), isCarousel ? '320px' : '0px', '100%');
                }}>Apply custom size</button>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">Tip: responsive width should usually be 100% with max-width 100%. Set a definite height only for visual components that need a stage, canvas, carousel or background area.</p>
            </section>
          );
        })()}

        {activeTab === 'comp' && (() => {
          const ownerComponent = components.find((c) => c.filePath === selected.filePath);
          const isReactFile = /\.(tsx|jsx)$/i.test(selected.filePath);
          const insertableComponents = components.filter(
            (c) => c.filePath !== selected.filePath
          );
          const pickedCompPath = insertableComponents.some(
            (c) => c.filePath === targetCompPath
          )
            ? targetCompPath
            : insertableComponents[0]?.filePath || '';

          return (
            <div className="space-y-4">
              {/* No-code layered visual composition presets */}
              <section className="space-y-2.5 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <div>
                    <h3 className="text-[11px] font-semibold text-slate-800">Visual Composition</h3>
                    <p className="text-[10px] text-slate-500">Apply ready-made layered effects to the selected element.</p>
                  </div>
                </div>
                {(() => {
                  const parent = selected.ancestry?.[selected.ancestry.length - 1];
                  const parentTarget = parent ? parseStudioTarget(parent.studioId) : null;
                  const isImage = selected.tagName.toLowerCase() === 'img' || Boolean(selected.src);
                  const applyPreset = (kind: 'cutout' | 'glass' | 'backdrop') => {
                    const updates: Array<{ elementIndex: number; patch: ElementSourcePatch }> = [];
                    const parentStyles: Record<string, string | null> = {
                      position: 'relative',
                      isolation: 'isolate',
                    };
                    let elementStyles: Record<string, string | null> = {};
                    if (kind === 'cutout') {
                      elementStyles = {
                        position: 'absolute',
                        left: '4%',
                        bottom: '0',
                        width: 'min(44%, 520px)',
                        height: '92%',
                        maxWidth: 'none',
                        objectFit: 'contain',
                        objectPosition: 'center bottom',
                        zIndex: '2',
                        filter: 'drop-shadow(0 22px 34px rgba(0,0,0,.38))',
                        background: 'transparent',
                        border: '0',
                        borderRadius: '0',
                      };
                      Object.assign(parentStyles, {
                        minHeight: 'clamp(420px, 58vw, 640px)',
                        overflow: 'visible',
                      });
                    } else if (kind === 'glass') {
                      elementStyles = {
                        position: 'absolute',
                        right: '4%',
                        top: '8%',
                        width: 'min(66%, 700px)',
                        minHeight: '72%',
                        boxSizing: 'border-box',
                        padding: 'clamp(22px, 4vw, 52px)',
                        border: '1px solid rgba(255,255,255,.18)',
                        borderRadius: '28px',
                        backgroundColor: 'rgba(25, 27, 31, .58)',
                        backdropFilter: 'blur(18px) saturate(135%)',
                        WebkitBackdropFilter: 'blur(18px) saturate(135%)',
                        boxShadow: '0 24px 70px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.12)',
                        color: '#f8fafc',
                        zIndex: '1',
                      };
                      Object.assign(parentStyles, {
                        minHeight: 'clamp(420px, 58vw, 640px)',
                        overflow: 'visible',
                      });
                    } else {
                      elementStyles = {
                        position: 'relative',
                        isolation: 'isolate',
                        overflow: 'hidden',
                        minHeight: 'clamp(420px, 58vw, 640px)',
                        padding: 'clamp(28px, 5vw, 64px)',
                        borderRadius: '30px',
                        backgroundColor: '#111214',
                        backgroundImage: 'radial-gradient(ellipse at 12% 18%, rgba(176,104,55,.28), transparent 34%), radial-gradient(ellipse at 88% 78%, rgba(65,83,103,.3), transparent 38%), linear-gradient(135deg, #17191c, #08090b)',
                      };
                    }
                    updates.push({ elementIndex: selected.elementIndex, patch: { styles: elementStyles } });
                    if (kind !== 'backdrop' && parentTarget && parentTarget.filePath === selected.filePath) {
                      updates.push({ elementIndex: parentTarget.elementIndex, patch: { styles: parentStyles } });
                    }
                    if (onCommitBatchPatches) onCommitBatchPatches(selected.filePath, updates);
                    else onCommitPatch(selected.filePath, selected.elementIndex, { styles: elementStyles });
                  };
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button type="button" disabled={!isImage} onClick={() => applyPreset('cutout')} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[10px] font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40">
                          <span className="block text-violet-600">01 · Image cutout</span>
                          <span className="mt-0.5 block font-normal text-slate-500">Float image over parent</span>
                        </button>
                        <button type="button" onClick={() => applyPreset('glass')} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[10px] font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50">
                          <span className="block text-violet-600">02 · Glass card</span>
                          <span className="mt-0.5 block font-normal text-slate-500">Blur, transparency & depth</span>
                        </button>
                        <button type="button" onClick={() => applyPreset('backdrop')} className="col-span-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[10px] font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50">
                          <span className="block text-violet-600">03 · Decorative backdrop</span>
                          <span className="mt-0.5 block font-normal text-slate-500">Layered ambient gradients and dark surface</span>
                        </button>
                      </div>
                      <p className="text-[10px] leading-4 text-slate-500">
                        Suggested order: select the section for Backdrop, select the text/card for Glass card, then select a transparent PNG/WebP chef image for Image cutout. Select a direct child of the section so WebD can position it relative to its parent.
                      </p>
                      {!parentTarget && <p className="text-[10px] text-amber-700">Parent layer could not be detected. The selected element preset will still apply; set its parent container to Position: Relative in Layout.</p>}
                    </>
                  );
                })()}
              </section>

              {/* Source Component Context */}
              <section className="space-y-2 border-b border-slate-100 pb-4">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                  <Box className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Component Source &amp; Isolation</span>
                </h3>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <p className="font-mono text-[11px] text-slate-700 truncate">{selected.filePath}</p>
                  {ownerComponent ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-indigo-700">
                        Shared &lt;{ownerComponent.name} /&gt; ({ownerComponent.usageCount}×)
                      </span>
                      {onIsolateComponent && (
                        <button
                          type="button"
                          onClick={() => onIsolateComponent(ownerComponent.filePath)}
                          className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                        >
                          Redesign
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Page-local element{activePageFilePath ? ` in ${activePageFilePath}` : ''}.
                    </p>
                  )}
                </div>

                {isReactFile && !ownerComponent && onExtractComponent && (
                  <div className="space-y-1.5 pt-1">
                    <label htmlFor="extract-comp-name" className="block text-[11px] text-slate-600">
                      Extract Selection to Component
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="extract-comp-name"
                        type="text"
                        aria-label="Extract component name"
                        value={extractCompName}
                        onChange={(e) => setExtractCompName(e.target.value)}
                        placeholder="HeroBanner..."
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={!extractCompName.trim()}
                        onClick={() => {
                          if (!extractCompName.trim()) return;
                          onExtractComponent(
                            selected.filePath,
                            selected.elementIndex,
                            extractCompName.trim()
                          );
                          setExtractCompName('');
                        }}
                        className="inline-flex h-8 items-center rounded-md bg-indigo-600 px-2.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                      >
                        Extract
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Replace Existing Element or Insert Component at Intended Location */}
              {isReactFile && (
                <section className="space-y-2.5 border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <Replace className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Replace or Insert Component</span>
                    </h3>
                    {pickedCompPath && onIsolateComponent && (
                      <button
                        type="button"
                        onClick={() => onIsolateComponent(pickedCompPath)}
                        className="text-[10px] font-semibold text-indigo-600 hover:underline"
                      >
                        Design Selected
                      </button>
                    )}
                  </div>

                  {insertableComponents.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      Create or extract a React component to insert or replace elements here.
                    </p>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="target-react-comp" className="sr-only">
                          Choose React component
                        </label>
                        <select
                          id="target-react-comp"
                          aria-label="Choose React component to insert or replace"
                          value={pickedCompPath}
                          onChange={(e) => setTargetCompPath(e.target.value)}
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800"
                        >
                          {insertableComponents.map((c) => (
                            <option key={c.filePath} value={c.filePath}>
                              &lt;{c.name} /&gt; ({c.filePath})
                            </option>
                          ))}
                        </select>
                      </div>

                      {onReplaceWithComponent && (
                        <button
                          type="button"
                          onClick={() =>
                            onReplaceWithComponent(
                              selected.filePath,
                              selected.elementIndex,
                              pickedCompPath
                            )
                          }
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          <Replace className="h-3.5 w-3.5" />
                          <span>Replace &lt;{selected.tagName}&gt; with Component</span>
                        </button>
                      )}

                      {onInsertComponent && (
                        <div className="space-y-1">
                          <span className="block text-[10px] font-medium text-slate-500">
                            Insert Component Relative to &lt;{selected.tagName}&gt;
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(
                              [
                                { pos: 'before', label: 'Before' },
                                { pos: 'after', label: 'After' },
                                { pos: 'inside-start', label: 'Inside Top' },
                                { pos: 'inside-end', label: 'Inside End' },
                              ] as Array<{ pos: ComponentInsertPosition; label: string }>
                            ).map((opt) => (
                              <button
                                key={opt.pos}
                                type="button"
                                aria-label={`Insert component ${opt.label.toLowerCase()}`}
                                onClick={() =>
                                  onInsertComponent(
                                    selected.filePath,
                                    selected.elementIndex,
                                    opt.pos,
                                    pickedCompPath
                                  )
                                }
                                className="h-7 rounded border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* React Libraries & UI Studio */}
              {onOpenLibraryModal && (
                <section className="space-y-2 border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <PackagePlus className="h-3.5 w-3.5 text-indigo-600" />
                      <span>React Lib UI &amp; Packages</span>
                    </h3>
                    <span className="font-mono text-[10px] text-slate-400">
                      {dependenciesCount} deps
                    </span>
                  </div>

                  {fileExternalImports.length > 0 && (
                    <div className="space-y-1">
                      {fileExternalImports.slice(0, 4).map((imp, idx) => (
                        <div
                          key={`${imp.packageName}-${idx}`}
                          className="truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-700"
                        >
                          {imp.packageName}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onOpenLibraryModal}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <PackagePlus className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Browse React Lib UI (Insert / Replace)</span>
                  </button>
                </section>
              )}

              {/* Page Component Instances & Props */}
              <section className="space-y-2 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold text-slate-700">
                    Component Props on Page
                  </h3>
                  <span className="font-mono text-[10px] text-slate-400">
                    {componentUsages.length}
                  </span>
                </div>

                {componentUsages.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No nested component instances detected on this file.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {componentUsages.map((usage) => {
                      const def = components.find((c) => c.name === usage.componentName);
                      const propKeys = Array.from(
                        new Set([
                          ...(def?.props.map((p) => p.name) || []),
                          ...Object.keys(usage.props),
                        ])
                      );
                      return (
                        <div
                          key={`${usage.componentName}-${usage.elementIndex}`}
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-semibold text-indigo-700">
                              &lt;{usage.componentName} /&gt;
                            </span>
                            {def && onIsolateComponent && (
                              <button
                                type="button"
                                onClick={() => onIsolateComponent(def.filePath)}
                                className="rounded border border-indigo-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
                              >
                                Edit Source
                              </button>
                            )}
                          </div>
                          {propKeys.map((propName) => {
                            const val =
                              usage.props[propName] ??
                              def?.props.find((p) => p.name === propName)?.defaultValue ??
                              '';
                            return (
                              <div key={propName} className="flex items-center gap-1.5">
                                <label className="w-16 shrink-0 truncate font-mono text-[10px] text-slate-600">
                                  {propName}
                                </label>
                                <input
                                  type="text"
                                  aria-label={`${usage.componentName} prop ${propName}`}
                                  defaultValue={val}
                                  key={`prop-${usage.elementIndex}-${propName}-${val}`}
                                  onBlur={(e) =>
                                    onPatchComponentProp?.(
                                      usage.filePath,
                                      usage.elementIndex,
                                      propName,
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      onPatchComponentProp?.(
                                        usage.filePath,
                                        usage.elementIndex,
                                        propName,
                                        (e.target as HTMLInputElement).value
                                      );
                                    }
                                  }}
                                  className="h-7 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-800"
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Direct Element Attributes */}
              <section className="space-y-2.5">
                <h3 className="text-[11px] font-semibold text-slate-700">Element Attributes</h3>
                <div>
                  <label htmlFor="inspector-class-name" className="mb-1 block text-[11px] text-slate-600">
                    Classes (Tailwind / CSS)
                  </label>
                  <textarea
                    id="inspector-class-name"
                    rows={2}
                    aria-label="Element className"
                    value={classDraft}
                    onChange={(e) => setClassDraft(e.target.value)}
                    onBlur={() => {
                      if (classDraft !== selected.className) {
                        onCommitPatch(selected.filePath, selected.elementIndex, {
                          className: classDraft,
                        });
                      }
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                {(selected.href !== undefined || selected.tagName === 'a') && (
                  <div>
                    <label htmlFor="inspector-href" className="mb-1 block text-[11px] text-slate-600">
                      Link Href
                    </label>
                    <input
                      id="inspector-href"
                      type="text"
                      value={hrefDraft}
                      onChange={(e) => setHrefDraft(e.target.value)}
                      onBlur={() =>
                        onCommitPatch(selected.filePath, selected.elementIndex, {
                          href: hrefDraft,
                        })
                      }
                      className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs text-slate-800"
                    />
                  </div>
                )}

                {(selected.src !== undefined || selected.tagName === 'img') && (
                  <div>
                    <label htmlFor="inspector-src" className="mb-1 block text-[11px] text-slate-600">
                      Image Src
                    </label>
                    <input
                      id="inspector-src"
                      type="text"
                      value={srcDraft}
                      onChange={(e) => setSrcDraft(e.target.value)}
                      onBlur={() =>
                        onCommitPatch(selected.filePath, selected.elementIndex, {
                          src: srcDraft,
                        })
                      }
                      className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs text-slate-800"
                    />
                  </div>
                )}
              </section>
            </div>
          );
        })()}
        {activeTab === 'pro' && <ProStudioToolkit selectionKey={selected.studioId} viewport={viewport} onCommit={commitStyles} onPreview={(styles) => onPreviewStyles(selected.studioId, styles)} onCommitResponsive={(styles) => onCommitPatch(selected.filePath, selected.elementIndex, { styles })} />}
      </div>
    </aside>
  );
}
