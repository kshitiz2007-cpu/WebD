'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Clapperboard,
  Code2,
  Download,
  FolderUp,
  GitBranch,
  History,
  Images,
  Layers,
  LayoutGrid,
  Monitor,
  MousePointer2,
  PackagePlus,
  Palette,
  Play,
  Plus,
  Redo2,
  Save,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  Wand2,
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
  onOpenTypographyEffects: () => void;
  onOpenLayoutBuilder: () => void;
  onOpenLibraryModal: () => void;
  onOpenCommandPalette: () => void;
  onExportZip: () => void;
  hasUnsavedEdits: boolean;
  showLeftPanel: boolean;
  onToggleLeftPanel: () => void;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
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
  savedDraftsCount: number;
  justSavedDraft: boolean;
  onQuickSaveDraft: () => void;
  onOpenDraftsModal: () => void;
}

type OpenMenuId = 'insert' | 'studio' | 'project' | null;

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
  onOpenTypographyEffects,
  onOpenLayoutBuilder,
  onOpenLibraryModal,
  onOpenCommandPalette,
  onExportZip,
  hasUnsavedEdits,
  showLeftPanel,
  onToggleLeftPanel,
  showRightPanel,
  onToggleRightPanel,
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
  savedDraftsCount,
  justSavedDraft,
  onQuickSaveDraft,
  onOpenDraftsModal,
}: TopToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenuId>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menusRef.current && !menusRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  const activeStudioCount = [
    showSmartAligner,
    showGradientPanel,
    showGlobalStylesPanel,
    showLogicPanel,
    showMotionPanel,
  ].filter(Boolean).length;

  const runMenuAction = (fn: () => void) => {
    setOpenMenu(null);
    fn();
  };

  return (
    <header className="w-full shrink-0 border-b border-slate-200 bg-white z-30">
      <div className="flex h-12 items-center justify-between gap-2 px-2.5 sm:px-3 lg:gap-3 lg:px-4">
        {/* Left Zone: Panel Toggle + Brand + Page Selector */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label="Toggle pages and layers panel"
            aria-pressed={showLeftPanel}
            onClick={onToggleLeftPanel}
            className={`hidden lg:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-700 transition-colors ${
              showLeftPanel
                ? 'border-slate-300 bg-slate-100 text-slate-900'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>

          <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Atelier
          </span>

          <span className="hidden 2xl:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="hidden 2xl:inline max-w-[130px] truncate text-xs font-medium text-slate-500">
            {projectName}
          </span>

          <label htmlFor="studio-page-select" className="sr-only">
            Active page
          </label>
          <select
            id="studio-page-select"
            value={activeRoute}
            onChange={(e) => onSelectPage(e.target.value)}
            className="h-9 sm:h-8 min-w-0 max-w-[136px] sm:max-w-[175px] rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
          >
            {pages.map((p) => (
              <option key={p.filePath} value={p.route}>
                {p.title} ({p.route})
              </option>
            ))}
          </select>
        </div>

        {/* Center Zone: Mode + Viewport + Undo/Redo + Quick Command Palette */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            role="group"
            aria-label="Canvas mode"
          >
            <button
              type="button"
              onClick={() => onChangeInteractionMode('design')}
              aria-label="Design mode"
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors ${
                interactionMode === 'design'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Design</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeInteractionMode('interact')}
              aria-label="Preview mode"
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors ${
                interactionMode === 'interact'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
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

          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              aria-label="Undo change"
              disabled={!canUndo}
              onClick={onUndo}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Redo change"
              disabled={!canRedo}
              onClick={onRedo}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Quick Command Palette Trigger (Ctrl/Cmd + K) */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Open quick command palette"
            title="Quick Command Palette (Ctrl/⌘ + K)"
            className="inline-flex h-9 sm:h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 transition-colors"
          >
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden xl:inline">Search commands…</span>
            <span className="hidden sm:inline xl:hidden">Commands</span>
            <kbd className="hidden md:inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Zone: Clean Grouped Dropdown Menus + Code + Primary Export */}
        <div ref={menusRef} className="flex items-center gap-1.5 shrink-0">
          {/* Insert Grouped Menu (Desktop/Laptop) */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              aria-expanded={openMenu === 'insert'}
              aria-haspopup="menu"
              onClick={() => setOpenMenu((m) => (m === 'insert' ? null : 'insert'))}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                openMenu === 'insert'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Plus className="h-3.5 w-3.5 text-blue-600" />
              <span>Insert</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {openMenu === 'insert' && (
              <div
                role="menu"
                aria-label="Insert blocks and assets"
                className="absolute right-0 top-10 z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runMenuAction(onOpenLayoutBuilder)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                >
                  <LayoutGrid className="h-4 w-4 shrink-0 text-indigo-600" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">Layout Blocks</div>
                    <div className="text-[11px] text-slate-500">Sections, grids, copy &amp; CTA</div>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runMenuAction(onOpenLibraryModal)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                >
                  <PackagePlus className="h-4 w-4 shrink-0 text-indigo-600" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">React Lib UI</div>
                    <div className="text-[11px] text-slate-500">Insert or replace UI blocks</div>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runMenuAction(onOpenMediaLibrary)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                >
                  <Images className="h-4 w-4 shrink-0 text-violet-600" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">Media Library</div>
                    <div className="text-[11px] text-slate-500">Clean /assets images &amp; video</div>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runMenuAction(onOpenTypographyEffects)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-600" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">Type FX &amp; Fonts</div>
                    <div className="text-[11px] text-slate-500">Google Fonts &amp; text motion</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Studio Panels Grouped Menu (Desktop/Laptop) */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              aria-expanded={openMenu === 'studio'}
              aria-haspopup="menu"
              onClick={() => setOpenMenu((m) => (m === 'studio' ? null : 'studio'))}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                openMenu === 'studio' || activeStudioCount > 0
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Studio</span>
              {activeStudioCount > 0 && (
                <span className="font-mono text-[10px] font-bold tabular-nums">
                  ({activeStudioCount})
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {openMenu === 'studio' && (
              <div
                role="menu"
                aria-label="Design and studio tools"
                className="absolute right-0 top-10 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5"
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showSmartAligner}
                  onClick={() => runMenuAction(onToggleSmartAligner)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    showSmartAligner ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Wand2 className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span>
                      <span className="block text-xs font-semibold">Smart Align</span>
                      <span className="block text-[11px] text-slate-500">Auto-align mobile &amp; desktop</span>
                    </span>
                  </span>
                  {showSmartAligner && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showMotionPanel}
                  onClick={() => runMenuAction(onToggleMotionPanel)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    showMotionPanel ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Clapperboard className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span>
                      <span className="block text-xs font-semibold">Motion Studio</span>
                      <span className="block text-[11px] text-slate-500">Scroll-reveal, hover &amp; ambient</span>
                    </span>
                  </span>
                  {showMotionPanel && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showLogicPanel}
                  onClick={() => runMenuAction(onToggleLogicPanel)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    showLogicPanel ? 'bg-violet-50 text-violet-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <GitBranch className="h-4 w-4 shrink-0 text-violet-600" />
                    <span>
                      <span className="block text-xs font-semibold">Logic Builder</span>
                      <span className="block text-[11px] text-slate-500">Interactive rules &amp; flows</span>
                    </span>
                  </span>
                  {showLogicPanel && <Check className="h-3.5 w-3.5 text-violet-600" />}
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showGradientPanel}
                  onClick={() => runMenuAction(onToggleGradientPanel)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    showGradientPanel ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      <span className="block text-xs font-semibold">Gradient CSS</span>
                      <span className="block text-[11px] text-slate-500">3-stop &amp; 4-stop gradient bar</span>
                    </span>
                  </span>
                  {showGradientPanel && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showGlobalStylesPanel}
                  onClick={() => runMenuAction(onToggleGlobalStylesPanel)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    showGlobalStylesPanel ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Palette className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      <span className="block text-xs font-semibold">Global CSS</span>
                      <span className="block text-[11px] text-slate-500">Design tokens &amp; stylesheets</span>
                    </span>
                  </span>
                  {showGlobalStylesPanel && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </button>
              </div>
            )}
          </div>

          {/* Project Grouped Menu: Save, Drafts, Import (Desktop/Tablet) */}
          <div className="relative hidden md:block">
            <button
              type="button"
              aria-expanded={openMenu === 'project'}
              aria-haspopup="menu"
              onClick={() => setOpenMenu((m) => (m === 'project' ? null : 'project'))}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                justSavedDraft
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : openMenu === 'project'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {justSavedDraft ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              <span>{justSavedDraft ? 'Saved' : 'Project'}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {openMenu === 'project' && (
              <div
                role="menu"
                aria-label="Project file actions"
                className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runMenuAction(onQuickSaveDraft)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Save className="h-4 w-4 text-emerald-600" />
                  <span>Save Draft Snapshot</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runMenuAction(onOpenDraftsModal)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2.5">
                    <History className="h-4 w-4 text-slate-500" />
                    <span>Saved Drafts</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                    {savedDraftsCount}
                  </span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runMenuAction(onOpenImportModal)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FolderUp className="h-4 w-4 text-blue-600" />
                  <span>Import ZIP / GitHub Repo</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCodeDrawer}
            aria-pressed={isCodeDrawerOpen}
            className={`hidden lg:inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
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
            className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 xl:px-3 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>

          <button
            type="button"
            aria-label="Toggle design inspector panel"
            aria-pressed={showRightPanel}
            onClick={onToggleRightPanel}
            className={`hidden lg:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-700 transition-colors ${
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
