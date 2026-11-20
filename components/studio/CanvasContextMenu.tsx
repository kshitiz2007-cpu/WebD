'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpToLine,
  Clapperboard,
  ClipboardCopy,
  ClipboardPaste,
  Columns2,
  Component,
  Copy,
  GitBranch,
  Grid2x2,
  Grid3x3,
  PackagePlus,
  Rows3,
  Trash2,
  X,
} from 'lucide-react';
import { StudioElementSnapshot } from '@/lib/studio/types';
import { WrapContainerLayout } from '@/lib/studio/source-editor';
import {
  CopiedStyleClipboard,
  clampContextMenuPosition,
  suggestExtractedComponentName,
} from '@/lib/studio/workspace-actions';

interface CanvasContextMenuProps {
  isOpen: boolean;
  isTouchSheet: boolean;
  position: { x: number; y: number };
  target: StudioElementSnapshot | null;
  multiCount: number;
  copiedStyle: CopiedStyleClipboard | null;
  canExtractComponent: boolean;
  onClose: () => void;
  onCopyStyles: (target: StudioElementSnapshot) => void;
  onPasteStyles: (target: StudioElementSnapshot) => void;
  onWrapLayout: (target: StudioElementSnapshot, layout: WrapContainerLayout) => void;
  onReplaceWithReactUi: (target: StudioElementSnapshot) => void;
  onAddLogicRule: (target: StudioElementSnapshot) => void;
  onAnimateElement: (target: StudioElementSnapshot) => void;
  onExtractComponent: (target: StudioElementSnapshot, componentName: string) => void;
  onSelectParent?: (parentStudioId: string) => void;
  onDuplicate: (target: StudioElementSnapshot) => void;
  onDelete: (target: StudioElementSnapshot) => void;
}

const WRAP_OPTIONS: Array<{
  id: WrapContainerLayout;
  label: string;
  shortLabel: string;
  icon: typeof Columns2;
}> = [
  { id: 'row', label: 'Flex Row', shortLabel: 'Flex Row', icon: Columns2 },
  { id: 'col', label: 'Flex Column', shortLabel: 'Flex Col', icon: Rows3 },
  { id: 'grid-2', label: '2-Col Grid', shortLabel: '2-Col Grid', icon: Grid2x2 },
  { id: 'grid-3', label: '3-Col Grid', shortLabel: '3-Col Grid', icon: Grid3x3 },
];

export default function CanvasContextMenu({
  isOpen,
  isTouchSheet,
  position,
  target,
  multiCount,
  copiedStyle,
  canExtractComponent,
  onClose,
  onCopyStyles,
  onPasteStyles,
  onWrapLayout,
  onReplaceWithReactUi,
  onAddLogicRule,
  onAnimateElement,
  onExtractComponent,
  onSelectParent,
  onDuplicate,
  onDelete,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [extractMode, setExtractMode] = useState(false);
  const [extractName, setExtractName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const clampedPos = useMemo(() => {
    if (typeof window === 'undefined') return position;
    return clampContextMenuPosition({
      x: position.x,
      y: position.y,
      menuWidth: 276,
      menuHeight: 480,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      margin: 12,
    });
  }, [position]);

  if (!isOpen || !target) return null;

  const isMultiWrap = multiCount >= 2;
  const openExtractInline = () => {
    setExtractName(suggestExtractedComponentName(target.tagName, target.textContent));
    setExtractMode(true);
  };

  const handleConfirmExtract = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = extractName.trim();
    if (!cleaned) return;
    onExtractComponent(target, cleaned);
    setExtractMode(false);
    onClose();
  };

  const rowBaseClass = isTouchSheet
    ? 'flex w-full min-h-[44px] items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:pointer-events-none'
    : 'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:pointer-events-none';

  const content = (
    <>
      {/* Header */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-slate-100 ${
          isTouchSheet ? 'px-4 pb-3 pt-1' : 'px-3 py-2'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-blue-700">
              &lt;{target.tagName}&gt;
            </span>
            {isMultiWrap && (
              <span className="text-[11px] font-medium text-indigo-600">
                · {multiCount} selected
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-slate-500">
            {target.textContent?.trim()
              ? `"${target.textContent.trim().slice(0, 34)}"`
              : target.filePath}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close element actions menu"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div
        className={`overflow-y-auto ${
          isTouchSheet ? 'max-h-[68vh] space-y-3 px-3 py-3' : 'max-h-[75vh] space-y-1.5 p-1.5'
        }`}
      >
        {/* Styles: Copy / Paste */}
        <div className={isTouchSheet ? 'grid grid-cols-2 gap-2' : 'space-y-0.5'}>
          <button
            type="button"
            onClick={() => {
              onCopyStyles(target);
              onClose();
            }}
            className={
              isTouchSheet
                ? 'flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 active:bg-slate-100'
                : rowBaseClass
            }
          >
            <span className="flex items-center gap-2">
              <ClipboardCopy className="h-3.5 w-3.5 text-slate-500" />
              <span>Copy Styles</span>
            </span>
          </button>
          <button
            type="button"
            disabled={!copiedStyle}
            onClick={() => {
              onPasteStyles(target);
              onClose();
            }}
            className={
              isTouchSheet
                ? 'flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 active:bg-slate-100 disabled:opacity-40'
                : rowBaseClass
            }
          >
            <span className="flex items-center gap-2 min-w-0">
              <ClipboardPaste className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="truncate">Paste Styles</span>
            </span>
            {!isTouchSheet && copiedStyle && (
              <span className="font-mono text-[10px] text-slate-400">
                &lt;{copiedStyle.sourceTagName}&gt;
              </span>
            )}
          </button>
        </div>

        {/* Wrap in Flex / Grid */}
        <div className="border-t border-slate-100 pt-2">
          <div className="mb-1.5 px-2 text-[11px] font-medium text-slate-500">
            Wrap {isMultiWrap ? `${multiCount} items` : 'in Container'}
          </div>
          <div className="grid grid-cols-2 gap-1.5 px-1">
            {WRAP_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onWrapLayout(target, opt.id);
                    onClose();
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 transition-colors ${
                    isTouchSheet ? 'min-h-[44px] px-2.5 text-xs' : 'h-8 px-2 text-[11px]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span className="whitespace-nowrap">{opt.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio Power Actions */}
        <div className="space-y-0.5 border-t border-slate-100 pt-1.5">
          <button
            type="button"
            onClick={() => {
              onReplaceWithReactUi(target);
              onClose();
            }}
            className={rowBaseClass}
          >
            <span className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-indigo-600" />
              <span>Replace with React UI Block</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAddLogicRule(target);
              onClose();
            }}
            className={rowBaseClass}
          >
            <span className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-violet-600" />
              <span>Add Logic Rule</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAnimateElement(target);
              onClose();
            }}
            className={rowBaseClass}
          >
            <span className="flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-amber-600" />
              <span>Animate Element</span>
            </span>
          </button>

          {!extractMode ? (
            <button
              type="button"
              disabled={!canExtractComponent}
              onClick={openExtractInline}
              title={
                canExtractComponent
                  ? 'Extract this element into a reusable React component'
                  : 'Component extraction is available in React/TSX files'
              }
              className={rowBaseClass}
            >
              <span className="flex items-center gap-2">
                <Component className="h-4 w-4 text-emerald-600" />
                <span>Extract as Component</span>
              </span>
            </button>
          ) : (
            <form
              onSubmit={handleConfirmExtract}
              className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2 space-y-2"
            >
              <label
                htmlFor="context-extract-name"
                className="block text-[11px] font-semibold text-emerald-900"
              >
                New Component Name (PascalCase)
              </label>
              <input
                id="context-extract-name"
                type="text"
                autoFocus
                value={extractName}
                onChange={(e) => setExtractName(e.target.value)}
                placeholder="FeatureCard"
                className="h-9 w-full rounded-lg border border-emerald-300 bg-white px-2.5 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setExtractMode(false)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Extract
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Hierarchy & Edit Actions */}
        <div className="space-y-0.5 border-t border-slate-100 pt-1.5">
          {target.parentStudioId && onSelectParent && (
            <button
              type="button"
              onClick={() => {
                onSelectParent(target.parentStudioId!);
                onClose();
              }}
              className={rowBaseClass}
            >
              <span className="flex items-center gap-2">
                <ArrowUpToLine className="h-4 w-4 text-slate-500" />
                <span>Select Parent Container</span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onDuplicate(target);
              onClose();
            }}
            className={rowBaseClass}
          >
            <span className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Duplicate Element</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDelete(target);
              onClose();
            }}
            className={`${rowBaseClass} text-rose-700 hover:bg-rose-50 hover:text-rose-800`}
          >
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span>Delete Element</span>
            </span>
          </button>
        </div>
      </div>
    </>
  );

  if (isTouchSheet) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/45 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label="Canvas element actions"
        data-testid="canvas-context-menu"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={menuRef}
          className="w-full rounded-t-3xl border-t border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          <div className="mx-auto my-2.5 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label="Canvas element context menu"
        data-testid="canvas-context-menu"
        style={{ left: clampedPos.x, top: clampedPos.y }}
        className="fixed w-[276px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5"
      >
        {content}
      </div>
    </div>
  );
}
