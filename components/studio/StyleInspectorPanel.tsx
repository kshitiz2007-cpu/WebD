'use client';

import React, { useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Move,
  Palette,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import GradientEditor from './GradientEditor';
import { normalizeHex, parseGradientCss } from '@/lib/studio/gradient';
import {
  getLastGradientSnapshot,
  parseLastGradientJson,
  subscribeGradientStorage,
} from '@/lib/studio/gradient-persistence';
import { ElementSourcePatch, GradientConfig, StudioElementSnapshot } from '@/lib/studio/types';

interface StyleInspectorPanelProps {
  selected: StudioElementSnapshot | null;
  onPreviewStyles: (studioId: string, styles: Record<string, string | null>) => void;
  onCommitPatch: (filePath: string, elementIndex: number, patch: ElementSourcePatch) => void;
  onMoveSibling: (filePath: string, elementIndex: number, targetIndex: number) => void;
  onDuplicate: (filePath: string, elementIndex: number) => void;
  onDelete: (filePath: string, elementIndex: number) => void;
  onClose?: () => void;
  isBottomSheet?: boolean;
}

function parsePxNumber(val?: string): string {
  if (!val) return '';
  if (val === 'auto') return 'auto';
  const m = val.match(/^-?\d+(?:\.\d+)?/);
  return m ? String(Math.round(parseFloat(m[0]))) : '';
}

function parseTranslateOffsets(transformVal?: string): { x: number; y: number } {
  if (!transformVal || transformVal === 'none') return { x: 0, y: 0 };
  const tMatch = transformVal.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/);
  if (tMatch) {
    return { x: Math.round(parseFloat(tMatch[1])), y: Math.round(parseFloat(tMatch[2])) };
  }
  const mMatch = transformVal.match(/^matrix\(([^)]+)\)$/);
  if (mMatch) {
    const parts = mMatch[1].split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 6 && Number.isFinite(parts[4]) && Number.isFinite(parts[5])) {
      return { x: Math.round(parts[4]), y: Math.round(parts[5]) };
    }
  }
  return { x: 0, y: 0 };
}

export default function StyleInspectorPanel({
  selected,
  onPreviewStyles,
  onCommitPatch,
  onMoveSibling,
  onDuplicate,
  onDelete,
  onClose,
  isBottomSheet = false,
}: StyleInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<'style' | 'layout' | 'type'>('style');
  const [textDraft, setTextDraft] = useState(selected?.textContent || '');
  const [textColorHex, setTextColorHex] = useState('#0F172A');
  const [borderColorHex, setBorderColorHex] = useState('#E2E8F0');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [prevSelectedKey, setPrevSelectedKey] = useState<string | null>(null);

  const selectedSyncKey = selected
    ? `${selected.studioId}|${selected.textContent}|${selected.computedStyles.color}|${selected.computedStyles.borderColor}|${selected.inlineStyles.transform || selected.computedStyles.transform}`
    : null;

  if (selectedSyncKey !== prevSelectedKey) {
    setPrevSelectedKey(selectedSyncKey);
    if (selected) {
      setTextDraft(selected.textContent || '');
      setTextColorHex(normalizeHex(selected.computedStyles.color || '#0F172A', '#0F172A'));
      setBorderColorHex(normalizeHex(selected.computedStyles.borderColor || '#E2E8F0', '#E2E8F0'));
      const offsets = parseTranslateOffsets(
        selected.inlineStyles.transform || selected.computedStyles.transform
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
  const radius = parsePxNumber(ins['border-radius'] || cs.borderRadius) || '0';
  const fontSize = parsePxNumber(ins['font-size'] || cs.fontSize) || '16';
  const fontWeight = cs.fontWeight || '400';
  const textAlign = cs.textAlign || 'left';
  const opacity = Math.round(parseFloat(cs.opacity || '1') * 100);
  const borderWidth = parsePxNumber(ins['border-width'] || cs.borderWidth) || '0';

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
            {selected.canReorderSiblings && (
              <>
                <button
                  type="button"
                  aria-label="Move element earlier"
                  disabled={selected.siblingIndex <= 0}
                  onClick={() =>
                    onMoveSibling(selected.filePath, selected.elementIndex, selected.siblingIndex - 1)
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
                    onMoveSibling(selected.filePath, selected.elementIndex, selected.siblingIndex + 1)
                  }
                  className="rounded border border-slate-200 p-1.5 sm:p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </>
            )}
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
          className="mt-2.5 grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
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
        </div>
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

            {/* Border & Radius & Shadow */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold text-slate-700">Border &amp; Elevation</h3>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="inspector-radius" className="text-[11px] text-slate-600">
                    Corner Radius
                  </label>
                  <span className="font-mono text-[11px] tabular-nums text-slate-700">
                    {radius}px
                  </span>
                </div>
                <input
                  id="inspector-radius"
                  type="range"
                  min={0}
                  max={48}
                  value={Number(radius) || 0}
                  onChange={(e) =>
                    onPreviewStyles(selected.studioId, { borderRadius: `${e.target.value}px` })
                  }
                  onPointerUp={(e) =>
                    commitStyles({ borderRadius: `${(e.target as HTMLInputElement).value}px` })
                  }
                  className="h-2 sm:h-1.5 w-full cursor-pointer touch-none accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="inspector-border-width" className="mb-1 block text-[11px] text-slate-600">
                    Border Width
                  </label>
                  <input
                    id="inspector-border-width"
                    type="number"
                    min={0}
                    max={12}
                    defaultValue={Number(borderWidth) || 0}
                    key={`bw-${selected.studioId}-${borderWidth}`}
                    onChange={(e) => {
                      const w = `${Math.max(0, Number(e.target.value) || 0)}px`;
                      commitStyles({
                        borderWidth: w,
                        borderStyle: w === '0px' ? 'none' : 'solid',
                        borderColor: borderColorHex,
                      });
                    }}
                    className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="inspector-border-hex" className="mb-1 block text-[11px] text-slate-600">
                    Border Hex
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      aria-label="Border color picker"
                      value={borderColorHex}
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

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="inspector-opacity" className="text-[11px] text-slate-600">
                    Opacity
                  </label>
                  <span className="font-mono text-[11px] tabular-nums text-slate-700">
                    {opacity}%
                  </span>
                </div>
                <input
                  id="inspector-opacity"
                  type="range"
                  min={10}
                  max={100}
                  value={opacity}
                  onChange={(e) =>
                    onPreviewStyles(selected.studioId, {
                      opacity: String(Number(e.target.value) / 100),
                    })
                  }
                  onPointerUp={(e) =>
                    commitStyles({
                      opacity: String(Number((e.target as HTMLInputElement).value) / 100),
                    })
                  }
                  className="h-2 sm:h-1.5 w-full cursor-pointer touch-none accent-blue-600"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-[11px] text-slate-600">Shadow Preset</span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: 'None', val: 'none' },
                    { label: 'Soft', val: '0 2px 8px rgba(15,23,42,0.08)' },
                    { label: 'Card', val: '0 10px 25px -5px rgba(15,23,42,0.12)' },
                    { label: 'Deep', val: '0 20px 45px -10px rgba(15,23,42,0.25)' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => commitStyles({ boxShadow: preset.val })}
                      className="rounded border border-slate-200 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'layout' && (
          <>
            {/* Size Inputs */}
            <section className="space-y-2.5 border-b border-slate-100 pb-4">
              <h3 className="text-[11px] font-semibold text-slate-700">Dimensions</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="inspector-width" className="mb-1 block text-[11px] text-slate-600">
                    Width (px)
                  </label>
                  <input
                    id="inspector-width"
                    type="text"
                    defaultValue={currentWidth}
                    key={`w-${selected.studioId}-${currentWidth}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v) return;
                      commitStyles({ width: /^\d+$/.test(v) ? `${v}px` : v });
                    }}
                    className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="inspector-height" className="mb-1 block text-[11px] text-slate-600">
                    Height (px)
                  </label>
                  <input
                    id="inspector-height"
                    type="text"
                    defaultValue={currentHeight}
                    key={`h-${selected.studioId}-${currentHeight}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v) return;
                      commitStyles({ height: /^\d+$/.test(v) ? `${v}px` : v });
                    }}
                    className="h-8 w-full rounded-md border border-slate-200 px-2 font-mono text-xs tabular-nums text-slate-800"
                  />
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

            {/* Flex / Grid & Position Offset */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold text-slate-700">Container &amp; Drag Offset</h3>
              <div className="grid grid-cols-3 gap-1">
                {(['block', 'flex', 'grid'] as const).map((disp) => (
                  <button
                    key={disp}
                    type="button"
                    onClick={() => commitStyles({ display: disp })}
                    className={`rounded border py-1 text-[11px] font-medium capitalize ${
                      cs.display === disp
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {disp}
                  </button>
                ))}
              </div>

              {(cs.display === 'flex' || cs.display === 'grid') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">Gap (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={96}
                      defaultValue={parsePxNumber(cs.gap) || '16'}
                      key={`gap-${selected.studioId}-${cs.gap}`}
                      onChange={(e) => commitStyles({ gap: `${Number(e.target.value) || 0}px` })}
                      className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-xs tabular-nums"
                    />
                  </div>
                  {cs.display === 'flex' && (
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-600">Direction</label>
                      <select
                        value={cs.flexDirection === 'column' ? 'column' : 'row'}
                        onChange={(e) => commitStyles({ flexDirection: e.target.value })}
                        className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs"
                      >
                        <option value="row">Row</option>
                        <option value="column">Column</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">Offset X (px)</label>
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
                  <label className="mb-1 block text-[11px] text-slate-600">Offset Y (px)</label>
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
        )}

        {activeTab === 'type' && (
          <section className="space-y-3.5">
            <h3 className="text-[11px] font-semibold text-slate-700">Typography</h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="inspector-font-size" className="mb-1 block text-[11px] text-slate-600">
                  Size (px)
                </label>
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
          </section>
        )}
      </div>
    </aside>
  );
}
