'use client';

import React from 'react';
import {
  Check,
  Clapperboard,
  Clock,
  FolderUp,
  GitBranch,
  History,
  Images,
  Layers3,
  LayoutGrid,
  Monitor,
  MonitorSmartphone,
  PackagePlus,
  Palette,
  Redo2,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import { ViewportPreset } from '@/lib/studio/types';

interface MobileToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  viewport: ViewportPreset;
  onChangeViewport: (vp: ViewportPreset) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  justSavedDraft: boolean;
  savedDraftsCount: number;
  onQuickSaveDraft: () => void;
  onOpenDraftsModal: () => void;
  onOpenImportModal: () => void;
  onOpenLayoutBuilder: () => void;
  onOpenLibraryModal: () => void;
  onOpenMediaLibrary: () => void;
  onOpenTypographyEffects: () => void;
  showSmartAligner: boolean;
  onToggleSmartAligner: () => void;
  showGradientPanel: boolean;
  onToggleGradientPanel: () => void;
  showGlobalStylesPanel: boolean;
  onToggleGlobalStylesPanel: () => void;
  showLogicPanel: boolean;
  onToggleLogicPanel: () => void;
  showMotionPanel: boolean;
  onToggleMotionPanel: () => void;
  showBrandRemixer?: boolean;
  onToggleBrandRemixer?: () => void;
  showHistoryPanel?: boolean;
  onToggleHistoryPanel?: () => void;
  showQaPanel?: boolean;
  onToggleQaPanel?: () => void;
  showRepeaterPanel?: boolean;
  onToggleRepeaterPanel?: () => void;
  onOpenMultiDeviceWall?: () => void;
  onReplayAnimations: () => void;
}

export default function MobileToolsSheet({
  isOpen,
  onClose,
  viewport,
  onChangeViewport,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  justSavedDraft,
  savedDraftsCount,
  onQuickSaveDraft,
  onOpenDraftsModal,
  onOpenImportModal,
  onOpenLayoutBuilder,
  onOpenLibraryModal,
  onOpenMediaLibrary,
  onOpenTypographyEffects,
  showSmartAligner,
  onToggleSmartAligner,
  showGradientPanel,
  onToggleGradientPanel,
  showGlobalStylesPanel,
  onToggleGlobalStylesPanel,
  showLogicPanel,
  onToggleLogicPanel,
  showMotionPanel,
  onToggleMotionPanel,
  showBrandRemixer = false,
  onToggleBrandRemixer,
  showHistoryPanel = false,
  onToggleHistoryPanel,
  showQaPanel = false,
  onToggleQaPanel,
  showRepeaterPanel = false,
  onToggleRepeaterPanel,
  onOpenMultiDeviceWall,
  onReplayAnimations,
}: MobileToolsSheetProps) {
  if (!isOpen) return null;

  const runAndClose = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/45 backdrop-blur-[2px] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Studio tools and viewport menu"
      data-testid="mobile-tools-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[82vh] w-full overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl flex flex-col">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Studio Tools</h2>
            <p className="text-[11px] text-slate-500">Insert blocks, design panels &amp; viewport</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close studio tools sheet"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* Viewport + Undo/Redo */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">Viewport &amp; History</div>
            <div className="flex items-center gap-2">
              <div
                className="grid flex-1 grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"
                role="group"
                aria-label="Responsive viewport preset"
              >
                {(
                  [
                    { id: 'desktop', label: 'Desktop', icon: Monitor },
                    { id: 'tablet', label: 'Tablet', icon: Tablet },
                    { id: 'mobile', label: 'Mobile', icon: Smartphone },
                  ] as const
                ).map((vp) => {
                  const Icon = vp.icon;
                  const active = viewport === vp.id;
                  return (
                    <button
                      key={vp.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChangeViewport(vp.id)}
                      className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{vp.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                aria-label="Undo change"
                disabled={!canUndo}
                onClick={onUndo}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Redo change"
                disabled={!canRedo}
                onClick={onRedo}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Insert & Assets */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">Insert &amp; Assets</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => runAndClose(onOpenLayoutBuilder)}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-800 active:bg-slate-50"
              >
                <LayoutGrid className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>Layout Blocks</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onOpenLibraryModal)}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 text-left text-xs font-semibold text-indigo-800 active:bg-indigo-100"
              >
                <PackagePlus className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>React Lib UI</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onOpenMediaLibrary)}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-800 active:bg-slate-50"
              >
                <Images className="h-4 w-4 shrink-0 text-violet-600" />
                <span>Media Library</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onOpenTypographyEffects)}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-800 active:bg-slate-50"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-600" />
                <span>Type FX &amp; Fonts</span>
              </button>
            </div>
          </div>

          {/* Design, Motion & Logic */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">Design, Motion &amp; Logic</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => runAndClose(onToggleSmartAligner)}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                  showSmartAligner
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <Wand2 className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>Smart Align</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onToggleMotionPanel)}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                  showMotionPanel
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <Clapperboard className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>Motion Studio</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onToggleLogicPanel)}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                  showLogicPanel
                    ? 'border-violet-500 bg-violet-50 text-violet-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <GitBranch className="h-4 w-4 shrink-0 text-violet-600" />
                <span>Logic Builder</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onToggleGlobalStylesPanel)}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                  showGlobalStylesPanel
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <Palette className="h-4 w-4 shrink-0 text-blue-600" />
                <span>Global CSS</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onToggleGradientPanel)}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                  showGradientPanel
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
                <span>Gradient CSS</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onReplayAnimations)}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-800"
              >
                <RotateCcw className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>Replay Motion</span>
              </button>
              {onToggleBrandRemixer && (
                <button
                  type="button"
                  onClick={() => runAndClose(onToggleBrandRemixer)}
                  className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                    showBrandRemixer
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span>Brand Remixer</span>
                </button>
              )}
              {onToggleRepeaterPanel && (
                <button
                  type="button"
                  onClick={() => runAndClose(onToggleRepeaterPanel)}
                  className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                    showRepeaterPanel
                      ? 'border-violet-500 bg-violet-50 text-violet-800'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <Layers3 className="h-4 w-4 shrink-0 text-violet-600" />
                  <span>Card Repeater</span>
                </button>
              )}
              {onToggleQaPanel && (
                <button
                  type="button"
                  onClick={() => runAndClose(onToggleQaPanel)}
                  className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                    showQaPanel
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Live QA Audit</span>
                </button>
              )}
              {onToggleHistoryPanel && (
                <button
                  type="button"
                  onClick={() => runAndClose(onToggleHistoryPanel)}
                  className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold ${
                    showHistoryPanel
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0 text-blue-600" />
                  <span>History &amp; Diff</span>
                </button>
              )}
              {onOpenMultiDeviceWall && (
                <button
                  type="button"
                  onClick={() => runAndClose(onOpenMultiDeviceWall)}
                  className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800"
                >
                  <MonitorSmartphone className="h-4 w-4 shrink-0 text-blue-600" />
                  <span>Multi-Device Preview Wall (3-Up)</span>
                </button>
              )}
            </div>
          </div>

          {/* Project & Files */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">Project &amp; Drafts</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => runAndClose(onQuickSaveDraft)}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold ${
                  justSavedDraft
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                {justSavedDraft ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                <span>{justSavedDraft ? 'Saved' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onOpenDraftsModal)}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
              >
                <History className="h-3.5 w-3.5" />
                <span>Drafts ({savedDraftsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onOpenImportModal)}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
              >
                <FolderUp className="h-3.5 w-3.5" />
                <span>Import</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
