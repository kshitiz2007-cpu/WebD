'use client';

import React from 'react';
import {
  Check,
  Code2,
  Download,
  FolderUp,
  Images,
  History,
  Layers,
  Monitor,
  MousePointer2,
  Palette,
  GitBranch,
  Play,
  Redo2,
  Save,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
} from 'lucide-react';
import { CanvasInteractionMode, ProjectPage, ViewportPreset } from '@/lib/studio/types';

interface TopToolbarProps {
  projectName: string;
  pages: ProjectPage[];
  activeRoute: string;
  onSelectPage: (route: string) => void;
  viewport: ViewportPreset;
  onChangeViewport: (vp: ViewportPreset) => void;
  interactionMode: CanvasInteractionMode;
  onChangeInteractionMode: (mode: CanvasInteractionMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isCodeDrawerOpen: boolean;
  onToggleCodeDrawer: () => void;
  onOpenImportModal: () => void;
  onOpenMediaLibrary: () => void;
  onExportZip: () => void;
  hasUnsavedEdits: boolean;
  showLeftPanel: boolean;
  onToggleLeftPanel: () => void;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  showGradientPanel: boolean;
  onToggleGradientPanel: () => void;
  showGlobalStylesPanel: boolean;
  onToggleGlobalStylesPanel: () => void;
  showLogicPanel: boolean;
  onToggleLogicPanel: () => void;
  savedDraftsCount: number;
  justSavedDraft: boolean;
  onQuickSaveDraft: () => void;
  onOpenDraftsModal: () => void;
}

export default function TopToolbar({
  projectName,
  pages,
  activeRoute,
  onSelectPage,
  viewport,
  onChangeViewport,
  interactionMode,
  onChangeInteractionMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isCodeDrawerOpen,
  onToggleCodeDrawer,
  onOpenImportModal,
  onOpenMediaLibrary,
  onExportZip,
  hasUnsavedEdits,
  showLeftPanel,
  onToggleLeftPanel,
  showRightPanel,
  onToggleRightPanel,
  showGradientPanel,
  onToggleGradientPanel,
  showGlobalStylesPanel,
  onToggleGlobalStylesPanel,
  showLogicPanel,
  onToggleLogicPanel,
  savedDraftsCount,
  justSavedDraft,
  onQuickSaveDraft,
  onOpenDraftsModal,
}: TopToolbarProps) {
  return (
    <header className="w-full shrink-0 border-b border-slate-200 bg-white">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3 lg:flex-nowrap lg:gap-4 lg:px-4">
        {/* Left: Panel Toggle + Brand + Page selector */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label="Toggle pages and layers panel"
            aria-pressed={showLeftPanel}
            onClick={onToggleLeftPanel}
            className={`hidden lg:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-slate-700 transition-colors ${
              showLeftPanel
                ? 'border-slate-300 bg-slate-100 text-slate-900'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>

          <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            <span className="2xl:hidden">Atelier</span>
            <span className="hidden 2xl:inline">Atelier Studio</span>
          </span>
          <span className="hidden 2xl:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="hidden 2xl:inline max-w-[140px] truncate text-xs font-medium text-slate-600">
            {projectName}
          </span>

          <label htmlFor="studio-page-select" className="sr-only">
            Active page
          </label>
          <select
            id="studio-page-select"
            value={activeRoute}
            onChange={(e) => onSelectPage(e.target.value)}
            className="h-9 sm:h-8 min-w-0 max-w-[116px] sm:max-w-[165px] rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
          >
            {pages.map((p) => (
              <option key={p.filePath} value={p.route}>
                {p.title} ({p.route})
              </option>
            ))}
          </select>
        </div>

        {/* Center: Mode, Viewport (desktop), Undo/Redo */}
        <div className="order-3 flex w-full items-center justify-between gap-1.5 sm:order-none sm:w-auto sm:justify-start sm:gap-1.5 shrink-0">
          <div
            className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            role="group"
            aria-label="Canvas mode"
          >
            <button
              type="button"
              onClick={() => onChangeInteractionMode('design')}
              className={`inline-flex h-7 sm:h-auto items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                interactionMode === 'design'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
              <span>Design</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeInteractionMode('interact')}
              className={`inline-flex h-7 sm:h-auto items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                interactionMode === 'interact'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Play className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <div
            className="hidden lg:flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            role="group"
            aria-label="Responsive viewport"
          >
            <button
              type="button"
              aria-label="Desktop viewport"
              onClick={() => onChangeViewport('desktop')}
              className={`rounded-md p-1.5 transition-colors ${
                viewport === 'desktop'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Tablet viewport"
              onClick={() => onChangeViewport('tablet')}
              className={`rounded-md p-1.5 transition-colors ${
                viewport === 'tablet'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tablet className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Mobile viewport"
              onClick={() => onChangeViewport('mobile')}
              className={`rounded-md p-1.5 transition-colors ${
                viewport === 'mobile'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Undo change"
              disabled={!canUndo}
              onClick={onUndo}
              className="inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Redo change"
              disabled={!canRedo}
              onClick={onRedo}
              className="inline-flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onQuickSaveDraft}
              aria-label="Save draft progress"
              className={`inline-flex h-9 sm:h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium whitespace-nowrap transition-colors ${
                justSavedDraft
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {justSavedDraft ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Save className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{justSavedDraft ? 'Saved' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenDraftsModal}
              aria-label="Open saved drafts and load progress"
              className="inline-flex h-9 sm:h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">Drafts</span>
              {savedDraftsCount > 0 && (
                <span className="rounded bg-blue-50 px-1 py-0.2 font-mono text-[10px] font-semibold text-blue-700">
                  {savedDraftsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Import, Gradient CSS, Global CSS, Code Drawer, Export ZIP, Inspector Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenMediaLibrary}
            className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2 xl:px-2.5 text-xs font-medium text-violet-700 hover:bg-violet-100 whitespace-nowrap shrink-0"
            title="Open media asset library"
          >
            <Images className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">Media Library</span>
            <span className="2xl:hidden">Media</span>
          </button>

          <button
            type="button"
            onClick={onOpenImportModal}
            className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 xl:px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FolderUp className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">Import ZIP / Repo</span>
            <span className="2xl:hidden">Import</span>
          </button>

          <button
            type="button"
            onClick={onToggleGradientPanel}
            aria-pressed={showGradientPanel}
            className={`hidden lg:inline-flex h-8 items-center gap-1.5 rounded-md border px-2 xl:px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              showGradientPanel
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Gradient CSS</span>
            <span className="xl:hidden">Gradient</span>
          </button>

          <button
            type="button"
            onClick={onToggleGlobalStylesPanel}
            aria-pressed={showGlobalStylesPanel}
            className={`hidden lg:inline-flex h-8 items-center gap-1.5 rounded-md border px-2 xl:px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              showGlobalStylesPanel
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Global CSS</span>
          </button>

          <button
            type="button"
            onClick={onToggleLogicPanel}
            aria-pressed={showLogicPanel}
            className={`hidden lg:inline-flex h-8 items-center gap-1.5 rounded-md border px-2 xl:px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              showLogicPanel
                ? 'border-violet-600 bg-violet-50 text-violet-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Logic</span>
          </button>

          <button
            type="button"
            onClick={onToggleCodeDrawer}
            aria-pressed={isCodeDrawerOpen}
            className={`hidden lg:inline-flex h-8 items-center gap-1.5 rounded-md border px-2 xl:px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              isCodeDrawerOpen
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Code{hasUnsavedEdits ? ' *' : ''}</span>
          </button>

          <button
            type="button"
            onClick={onExportZip}
            className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 xl:px-3 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Export ZIP</span>
            <span className="xl:hidden">Export</span>
          </button>

          <button
            type="button"
            aria-label="Toggle design inspector panel"
            aria-pressed={showRightPanel}
            onClick={onToggleRightPanel}
            className={`hidden lg:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-slate-700 transition-colors ${
              showRightPanel
                ? 'border-slate-300 bg-slate-100 text-slate-900'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
