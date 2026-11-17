'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Layers, Monitor, SlidersHorizontal, Smartphone, Sparkles, Tablet } from 'lucide-react';
import TopToolbar from './TopToolbar';
import PagesLayersPanel from './PagesLayersPanel';
import VisualCanvas from './VisualCanvas';
import StyleInspectorPanel from './StyleInspectorPanel';
import GradientCssPanel from './GradientCssPanel';
import ImportProjectModal from './ImportProjectModal';
import DraftsModal from './DraftsModal';
import CodeDrawer from './CodeDrawer';
import {
  applyElementPatchToSource,
  deleteElementInSource,
  duplicateElementInSource,
  moveElementSiblingInSource,
} from '@/lib/studio/source-editor';
import {
  clearAutosaveProgress,
  createDraftSnapshot,
  deleteDraftFromStorage,
  getAutosaveJsonSnapshot,
  getDraftsJsonSnapshot,
  parseAutosaveJson,
  parseDraftsJson,
  restoreProjectFromDraft,
  saveAutosaveProgress,
  saveDraftToStorage,
  subscribeDraftStorage,
} from '@/lib/studio/draft-storage';
import { createProjectFromFiles, STARTER_NEXTJS_FILES } from '@/lib/studio/sample-project';
import {
  CanvasInteractionMode,
  ElementSourcePatch,
  LayerTreeNode,
  StudioDraft,
  StudioElementSnapshot,
  ViewportPreset,
  VirtualProject,
} from '@/lib/studio/types';

export default function StudioWorkspace() {
  const [project, setProject] = useState<VirtualProject>(() =>
    createProjectFromFiles(STARTER_NEXTJS_FILES, 'Starter: Next.js App', 'verve-structural-site')
  );
  const [historyPast, setHistoryPast] = useState<Record<string, string>[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Record<string, string>[]>([]);

  const [activeRoute, setActiveRoute] = useState<string>('/');
  const [viewport, setViewport] = useState<ViewportPreset>('desktop');
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>('design');
  const [selected, setSelected] = useState<StudioElementSnapshot | null>(null);
  const [layerTree, setLayerTree] = useState<LayerTreeNode[]>([]);
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState(false);
  const [codeDrawerFile, setCodeDrawerFile] = useState<string>('app/page.tsx');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [justSavedDraft, setJustSavedDraft] = useState(false);
  const [compiledTailwindCss, setCompiledTailwindCss] = useState<string>('');
  const [desktopLeftOpen, setDesktopLeftOpen] = useState<boolean>(true);
  const [desktopRightOpen, setDesktopRightOpen] = useState<boolean>(true);
  const [desktopGradientOpen, setDesktopGradientOpen] = useState<boolean>(true);
  const [compactLeftOpen, setCompactLeftOpen] = useState<boolean>(false);
  const [compactRightOpen, setCompactRightOpen] = useState<boolean>(false);
  const [compactGradientOpen, setCompactGradientOpen] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const isCompactViewport = React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia('(max-width: 1023px)');
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.innerWidth < 1024,
    () => false
  );

  const isPhoneViewport = React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia('(max-width: 639px)');
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.innerWidth < 640,
    () => false
  );

  const showLeftPanel = isCompactViewport ? compactLeftOpen : desktopLeftOpen;
  const showRightPanel = isCompactViewport ? compactRightOpen : desktopRightOpen;
  const showGradientPanel = isCompactViewport ? compactGradientOpen : desktopGradientOpen;

  const handleToggleLeftPanel = useCallback(() => {
    if (isCompactViewport) {
      setCompactLeftOpen((v) => !v);
      setCompactRightOpen(false);
      setCompactGradientOpen(false);
    } else {
      setDesktopLeftOpen((v) => !v);
    }
  }, [isCompactViewport]);

  const handleToggleRightPanel = useCallback(() => {
    if (isCompactViewport) {
      setCompactRightOpen((v) => !v);
      setCompactLeftOpen(false);
      setCompactGradientOpen(false);
    } else {
      setDesktopRightOpen((v) => !v);
    }
  }, [isCompactViewport]);

  const handleToggleGradientPanel = useCallback(() => {
    if (isCompactViewport) {
      setCompactGradientOpen((v) => !v);
      setCompactLeftOpen(false);
      setCompactRightOpen(false);
    } else {
      setDesktopGradientOpen((v) => !v);
    }
  }, [isCompactViewport]);

  const activePage = useMemo(() => {
    return (
      project.pages.find((p) => p.route === activeRoute) ||
      project.pages[0] || { route: '/', title: 'Home', filePath: 'app/page.tsx' }
    );
  }, [project.pages, activeRoute]);

  // Compile real Tailwind CSS whenever project structure or CSS files change
  const cssSignature = useMemo(() => {
    const cssText = project.globalCssPaths.map((p) => project.files[p] || '').join('\n');
    const sourceText = Object.entries(project.files)
      .filter(([p]) => /\.(tsx|jsx|ts|js|html)$/i.test(p))
      .map(([, c]) => c)
      .join('\n');
    return { cssText, sourceText };
  }, [project.files, project.globalCssPaths]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/compile-css', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            css: cssSignature.cssText,
            sources: [cssSignature.sourceText],
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.css === 'string') {
          setCompiledTailwindCss(data.css);
        }
      } catch {
        // Keep previous compiled CSS on transient errors
      }
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cssSignature]);

  const commitFilesMutation = useCallback(
    (nextFiles: Record<string, string>, touchedFile?: string) => {
      setHistoryPast((prev) => [...prev.slice(-49), project.files]);
      setHistoryFuture([]);
      setProject((prev) => ({ ...prev, files: nextFiles }));
      if (touchedFile) {
        setCodeDrawerFile(touchedFile);
      }
    },
    [project.files]
  );

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [project.files, ...prev.slice(0, 49)]);
    setProject((prev) => ({ ...prev, files: previous }));
  }, [historyPast, project.files]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev.slice(-49), project.files]);
    setProject((prev) => ({ ...prev, files: next }));
  }, [historyFuture, project.files]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const handlePreviewStyles = useCallback(
    (studioId: string, styles: Record<string, string | null>) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'studio:preview-style', studioId, styles },
        '*'
      );
    },
    []
  );

  const handleCommitPatch = useCallback(
    (filePath: string, elementIndex: number, patch: ElementSourcePatch) => {
      const currentCode = project.files[filePath];
      if (!currentCode) return;
      const isHtml = /\.html?$/i.test(filePath);
      const updatedCode = applyElementPatchToSource(currentCode, elementIndex, isHtml, patch);
      if (updatedCode === currentCode) return;
      commitFilesMutation({ ...project.files, [filePath]: updatedCode }, filePath);
    },
    [project.files, commitFilesMutation]
  );

  const handleMoveSibling = useCallback(
    (filePath: string, elementIndex: number, targetIndex: number) => {
      const currentCode = project.files[filePath];
      if (!currentCode) return;
      const isHtml = /\.html?$/i.test(filePath);
      const updatedCode = moveElementSiblingInSource(currentCode, elementIndex, targetIndex, isHtml);
      if (updatedCode === currentCode) return;
      setSelected(null);
      commitFilesMutation({ ...project.files, [filePath]: updatedCode }, filePath);
    },
    [project.files, commitFilesMutation]
  );

  const handleDuplicate = useCallback(
    (filePath: string, elementIndex: number) => {
      const currentCode = project.files[filePath];
      if (!currentCode) return;
      const isHtml = /\.html?$/i.test(filePath);
      const updatedCode = duplicateElementInSource(currentCode, elementIndex, isHtml);
      if (updatedCode === currentCode) return;
      commitFilesMutation({ ...project.files, [filePath]: updatedCode }, filePath);
    },
    [project.files, commitFilesMutation]
  );

  const handleDelete = useCallback(
    (filePath: string, elementIndex: number) => {
      const currentCode = project.files[filePath];
      if (!currentCode) return;
      const isHtml = /\.html?$/i.test(filePath);
      const updatedCode = deleteElementInSource(currentCode, elementIndex, isHtml);
      if (updatedCode === currentCode) return;
      setSelected(null);
      commitFilesMutation({ ...project.files, [filePath]: updatedCode }, filePath);
    },
    [project.files, commitFilesMutation]
  );

  const handleSelectPage = useCallback(
    (route: string) => {
      const match =
        project.pages.find((p) => p.route === route) ||
        project.pages.find((p) => p.route === route.replace(/\.html?$/i, '')) ||
        project.pages.find((p) => `/${p.filePath}` === `/${route.replace(/^\/+/, '')}`);
      const targetPage = match || project.pages[0];
      if (!targetPage) return;
      setActiveRoute(targetPage.route);
      setSelected(null);
      setCodeDrawerFile(targetPage.filePath);
    },
    [project.pages]
  );

  const handleSelectLayer = useCallback((studioId: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:select-by-id', studioId },
      '*'
    );
  }, []);

  const handleLoadProject = useCallback(
    (files: Record<string, string>, label: string, name?: string) => {
      const nextProj = createProjectFromFiles(files, label, name);
      setProject(nextProj);
      setHistoryPast([]);
      setHistoryFuture([]);
      setSelected(null);
      const firstPage = nextProj.pages[0];
      if (firstPage) {
        setActiveRoute(firstPage.route);
        setCodeDrawerFile(firstPage.filePath);
      }
    },
    []
  );

  const handleExportZip = useCallback(async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const [path, content] of Object.entries(project.files)) {
      zip.file(path, content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'studio-project'}-modified.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [project]);

  const handleRevertFile = useCallback(
    (path: string) => {
      const orig = project.originalFiles[path];
      if (orig === undefined) return;
      commitFilesMutation({ ...project.files, [path]: orig }, path);
    },
    [project.files, project.originalFiles, commitFilesMutation]
  );

  const hasUnsavedEdits = useMemo(() => {
    return Object.keys(project.files).some(
      (p) => project.files[p] !== project.originalFiles[p]
    );
  }, [project.files, project.originalFiles]);

  const draftsJson = React.useSyncExternalStore(
    subscribeDraftStorage,
    getDraftsJsonSnapshot,
    () => '[]'
  );
  const autosaveJson = React.useSyncExternalStore(
    subscribeDraftStorage,
    getAutosaveJsonSnapshot,
    () => ''
  );

  const savedDrafts = useMemo(() => parseDraftsJson(draftsJson), [draftsJson]);
  const autosaveDraft = useMemo(() => parseAutosaveJson(autosaveJson), [autosaveJson]);

  useEffect(() => {
    if (!hasUnsavedEdits) return;
    const timer = setTimeout(() => {
      const snap = createDraftSnapshot({
        project,
        activeRoute: activePage.route,
        viewport,
        title: `${project.name} (${activePage.route})`,
      });
      saveAutosaveProgress(snap);
    }, 500);
    return () => clearTimeout(timer);
  }, [hasUnsavedEdits, project, activePage.route, viewport]);

  const handleSaveDraft = useCallback(
    (title?: string) => {
      const snapshot = createDraftSnapshot({
        project,
        activeRoute: activePage.route,
        viewport,
        title,
      });
      const result = saveDraftToStorage(snapshot);
      if (result.ok) {
        setJustSavedDraft(true);
        setTimeout(() => setJustSavedDraft(false), 1600);
      }
      return { ok: result.ok, error: result.error };
    },
    [project, activePage.route, viewport]
  );

  const handleQuickSaveDraft = useCallback(() => {
    const res = handleSaveDraft();
    if (!res.ok) {
      setIsDraftsOpen(true);
    }
  }, [handleSaveDraft]);

  const handleLoadDraft = useCallback((draft: StudioDraft) => {
    const restored = restoreProjectFromDraft(draft);
    setProject(restored);
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelected(null);
    setViewport(draft.viewport);
    const matchedPage =
      restored.pages.find((p) => p.route === draft.activeRoute) || restored.pages[0];
    if (matchedPage) {
      setActiveRoute(matchedPage.route);
      setCodeDrawerFile(matchedPage.filePath);
    }
  }, []);

  const handleDeleteDraft = useCallback((id: string) => {
    deleteDraftFromStorage(id);
  }, []);

  const handleClearAutosave = useCallback(() => {
    clearAutosaveProgress();
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <TopToolbar
        projectName={project.name}
        pages={project.pages}
        activeRoute={activePage.route}
        onSelectPage={handleSelectPage}
        viewport={viewport}
        onChangeViewport={setViewport}
        interactionMode={interactionMode}
        onChangeInteractionMode={setInteractionMode}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isCodeDrawerOpen={isCodeDrawerOpen}
        onToggleCodeDrawer={() => setIsCodeDrawerOpen((v) => !v)}
        onOpenImportModal={() => setIsImportOpen(true)}
        onExportZip={handleExportZip}
        hasUnsavedEdits={hasUnsavedEdits}
        showLeftPanel={showLeftPanel}
        onToggleLeftPanel={handleToggleLeftPanel}
        showRightPanel={showRightPanel}
        onToggleRightPanel={handleToggleRightPanel}
        showGradientPanel={showGradientPanel}
        onToggleGradientPanel={handleToggleGradientPanel}
        savedDraftsCount={savedDrafts.length}
        justSavedDraft={justSavedDraft}
        onQuickSaveDraft={handleQuickSaveDraft}
        onOpenDraftsModal={() => setIsDraftsOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left Panel: docked on >=1024px, slide-over drawer on tablet, bottom sheet on phone */}
        {showLeftPanel && (
          <div
            className={
              isCompactViewport
                ? isPhoneViewport
                  ? 'absolute inset-x-0 bottom-0 z-40 flex h-[72vh] max-h-[580px] rounded-t-2xl shadow-2xl overflow-hidden'
                  : 'absolute inset-y-0 left-0 z-40 flex shadow-xl'
                : 'hidden lg:flex h-full shrink-0'
            }
          >
            <PagesLayersPanel
              pages={project.pages}
              activeRoute={activePage.route}
              onSelectPage={(route) => {
                handleSelectPage(route);
                if (isCompactViewport) setCompactLeftOpen(false);
              }}
              layerTree={layerTree}
              selectedStudioId={selected?.studioId || null}
              onSelectLayer={(id) => {
                handleSelectLayer(id);
                if (isCompactViewport) setCompactLeftOpen(false);
              }}
              onClose={isCompactViewport ? () => setCompactLeftOpen(false) : undefined}
              isBottomSheet={isCompactViewport && isPhoneViewport}
            />
          </div>
        )}

        {/* Backdrop when compact drawer or bottom sheet is open */}
        {isCompactViewport && (showLeftPanel || showRightPanel || showGradientPanel) && (
          <button
            type="button"
            aria-label="Close panel drawer"
            onClick={() => {
              setCompactLeftOpen(false);
              setCompactRightOpen(false);
              setCompactGradientOpen(false);
            }}
            className="absolute inset-0 z-30 bg-slate-900/30"
          />
        )}

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <VisualCanvas
            project={project}
            activePage={activePage}
            compiledTailwindCss={compiledTailwindCss}
            viewport={viewport}
            interactionMode={interactionMode}
            selected={selected}
            onSelectElement={(snap) => {
              setSelected(snap);
              if (snap?.filePath) setCodeDrawerFile(snap.filePath);
            }}
            onUpdateLayerTree={setLayerTree}
            onNavigateRoute={handleSelectPage}
            onCommitPatch={handleCommitPatch}
            onMoveSibling={handleMoveSibling}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            iframeRef={iframeRef}
          />

          {/* Multi-Stop Gradient & CSS Panel (docked on desktop) */}
          {!isCompactViewport && showGradientPanel && (
            <GradientCssPanel
              selected={selected}
              onPreviewStyles={handlePreviewStyles}
              onCommitPatch={handleCommitPatch}
              onClose={() => setDesktopGradientOpen(false)}
            />
          )}

          <CodeDrawer
            isOpen={isCodeDrawerOpen}
            onClose={() => setIsCodeDrawerOpen(false)}
            files={project.files}
            originalFiles={project.originalFiles}
            activeFilePath={codeDrawerFile}
            onSelectFile={setCodeDrawerFile}
            onRevertFile={handleRevertFile}
          />
        </div>

        {/* Multi-Stop Gradient & CSS Panel (bottom sheet on mobile/compact screens) */}
        {isCompactViewport && showGradientPanel && (
          <div
            className={
              isPhoneViewport
                ? 'absolute inset-x-0 bottom-0 z-40 flex h-[74vh] max-h-[620px] rounded-t-2xl shadow-2xl overflow-hidden'
                : 'absolute inset-x-0 bottom-0 z-40 flex max-h-[340px] shadow-2xl overflow-hidden'
            }
          >
            <GradientCssPanel
              selected={selected}
              onPreviewStyles={handlePreviewStyles}
              onCommitPatch={handleCommitPatch}
              onClose={() => setCompactGradientOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Right Panel: docked on >=1024px, slide-over drawer on tablet, bottom sheet on phone */}
        {showRightPanel && (
          <div
            className={
              isCompactViewport
                ? isPhoneViewport
                  ? 'absolute inset-x-0 bottom-0 z-40 flex h-[74vh] max-h-[620px] rounded-t-2xl shadow-2xl overflow-hidden'
                  : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'
                : 'hidden lg:flex h-full shrink-0'
            }
          >
            <StyleInspectorPanel
              selected={selected}
              onPreviewStyles={handlePreviewStyles}
              onCommitPatch={handleCommitPatch}
              onMoveSibling={handleMoveSibling}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onClose={isCompactViewport ? () => setCompactRightOpen(false) : undefined}
              isBottomSheet={isCompactViewport && isPhoneViewport}
            />
          </div>
        )}
      </div>

      {/* Thumb-friendly Bottom Control Dock on mobile & split-pane viewports (<1024px) */}
      <nav
        aria-label="Mobile studio controls"
        className="flex lg:hidden shrink-0 items-center justify-between gap-1 border-t border-slate-200 bg-white px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          onClick={handleToggleLeftPanel}
          aria-label="Toggle layers panel"
          aria-pressed={showLeftPanel}
          className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-xs font-medium whitespace-nowrap transition-colors ${
            showLeftPanel
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Layers</span>
        </button>

        <div
          className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
          role="group"
          aria-label="Mobile viewport preset"
        >
          <button
            type="button"
            aria-label="Desktop viewport"
            aria-pressed={viewport === 'desktop'}
            onClick={() => setViewport('desktop')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              viewport === 'desktop'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Tablet viewport"
            aria-pressed={viewport === 'tablet'}
            onClick={() => setViewport('tablet')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              viewport === 'tablet'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tablet className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Mobile viewport"
            aria-pressed={viewport === 'mobile'}
            onClick={() => setViewport('mobile')}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              viewport === 'mobile'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleGradientPanel}
            aria-pressed={showGradientPanel}
            aria-label="Toggle 3-stop and 4-stop gradient CSS panel"
            className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-xs font-medium whitespace-nowrap transition-colors ${
              showGradientPanel
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>CSS</span>
          </button>

          <button
            type="button"
            onClick={handleToggleRightPanel}
            aria-pressed={showRightPanel}
            className={`inline-flex h-9 max-w-[116px] items-center gap-1 rounded-lg px-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              selected && !showRightPanel
                ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700'
                : showRightPanel
                ? 'border border-blue-600 bg-blue-50 text-blue-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{selected ? `Style <${selected.tagName}>` : 'Style'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCodeDrawerOpen((v) => !v)}
            aria-pressed={isCodeDrawerOpen}
            aria-label="Toggle live code drawer"
            className={`relative inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-xs font-medium whitespace-nowrap transition-colors ${
              isCodeDrawerOpen
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Code2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">
              Code{hasUnsavedEdits ? ' *' : ''}
            </span>
            {hasUnsavedEdits && (
              <span
                aria-hidden="true"
                className="sm:hidden absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-600"
              />
            )}
          </button>
        </div>
      </nav>

      <ImportProjectModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onLoadProject={handleLoadProject}
      />

      <DraftsModal
        isOpen={isDraftsOpen}
        onClose={() => setIsDraftsOpen(false)}
        currentProjectName={project.name}
        currentRoute={activePage.route}
        hasUnsavedEdits={hasUnsavedEdits}
        drafts={savedDrafts}
        autosaveDraft={autosaveDraft}
        onSaveDraft={(title) => handleSaveDraft(title)}
        onLoadDraft={handleLoadDraft}
        onDeleteDraft={handleDeleteDraft}
        onClearAutosave={handleClearAutosave}
      />
    </div>
  );
}
