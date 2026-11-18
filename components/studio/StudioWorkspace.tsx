'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, GitBranch, Layers, Monitor, Palette, SlidersHorizontal, Smartphone, Sparkles, Tablet } from 'lucide-react';
import LogicPanel, { type VisualLogicRule } from './LogicPanel';
import TopToolbar from './TopToolbar';
import PagesLayersPanel from './PagesLayersPanel';
import VisualCanvas from './VisualCanvas';
import StyleInspectorPanel from './StyleInspectorPanel';
import GradientCssPanel from './GradientCssPanel';
import GlobalStylesPanel from './GlobalStylesPanel';
import ImportProjectModal from './ImportProjectModal';
import DraftsModal from './DraftsModal';
import ReactLibraryModal from './ReactLibraryModal';
import SmartAlignerPanel from './SmartAlignerPanel';
import CodeDrawer from './CodeDrawer';
import {
  WrapContainerLayout,
  applyBatchElementPatches,
  applyElementPatchToSource,
  deleteElementInSource,
  duplicateElementInSource,
  moveElementSiblingInSource,
  readElementMeta,
  scanElements,
  wrapElementsInContainer,
} from '@/lib/studio/source-editor';
import { parseElementTranslateOffsets } from '@/lib/studio/layout-constraints';
import { safeReadJsonResponse } from '@/lib/studio/github-import';
import {
  MultiAlignAction,
  MultiSelectAlignItem,
  computeMultiAlignPatches,
} from '@/lib/studio/visual-refinement';
import {
  AlignBreakpointScope,
  AutoAlignMode,
  BlockRedesignPattern,
  HorizontalAlign,
  SpacingDensity,
  VerticalAlign,
  WidthPreset,
  alignElementClassName,
  applyWidthAndSpacingToClassName,
  autoAlignSourceCode,
  redesignBlockClassName,
  resolveEffectiveBreakpoint,
  scopeElementPatchToBreakpoint,
} from '@/lib/studio/smart-aligner';
import {
  ComponentInsertPosition,
  ComponentTemplatePreset,
  createComponentFileTemplate,
  extractSelectionToComponent,
  insertComponentIntoSource,
  insertJsxSnippetIntoSource,
  patchJsxPropInSource,
  replaceElementWithComponentInSource,
  scanComponentUsagesInFile,
  scanProjectComponents,
} from '@/lib/studio/component-editor';
import {
  addPackageDependencyToFiles,
  buildEsmShUrl,
  injectLibraryImportIntoSource,
  parsePackageDependencies,
  removePackageDependencyFromFiles,
  scanExternalImportsInSource,
} from '@/lib/studio/library-importer';
import {
  ReactUiLibraryEntry,
  applyUiLibraryToProject,
  replaceElementWithSnippetInSource,
} from '@/lib/studio/react-ui-catalog';
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
  const [multiSelected, setMultiSelected] = useState<StudioElementSnapshot[]>([]);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [pseudoState, setPseudoState] = useState<'default' | 'hover' | 'focus'>('default');
  const [layerTree, setLayerTree] = useState<LayerTreeNode[]>([]);
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState(false);
  const [isLogicPanelOpen, setIsLogicPanelOpen] = useState(false);
  const [codeDrawerFile, setCodeDrawerFile] = useState<string>('app/page.tsx');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [justSavedDraft, setJustSavedDraft] = useState(false);
  const [compiledTailwindCss, setCompiledTailwindCss] = useState<string>('');
  const [desktopLeftOpen, setDesktopLeftOpen] = useState<boolean>(true);
  const [desktopRightOpen, setDesktopRightOpen] = useState<boolean>(true);
  const [desktopGradientOpen, setDesktopGradientOpen] = useState<boolean>(true);
  const [desktopGlobalStylesOpen, setDesktopGlobalStylesOpen] = useState<boolean>(false);
  const [desktopSmartAlignerOpen, setDesktopSmartAlignerOpen] = useState<boolean>(false);
  const [compactLeftOpen, setCompactLeftOpen] = useState<boolean>(false);
  const [compactRightOpen, setCompactRightOpen] = useState<boolean>(false);
  const [compactGradientOpen, setCompactGradientOpen] = useState<boolean>(false);
  const [compactGlobalStylesOpen, setCompactGlobalStylesOpen] = useState<boolean>(false);
  const [compactSmartAlignerOpen, setCompactSmartAlignerOpen] = useState<boolean>(false);
  const [alignBreakpointScope, setAlignBreakpointScope] = useState<AlignBreakpointScope>('auto');
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [isolatedComponentPath, setIsolatedComponentPath] = useState<string | null>(null);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [externalLibVersion, setExternalLibVersion] = useState(0);
  const [pendingSelectStudioId, setPendingSelectStudioId] = useState<string | null>(null);
  const [lastPageTarget, setLastPageTarget] = useState<{
    route: string;
    filePath: string;
    elementIndex: number;
    label: string;
  } | null>(null);
  const requestedLibsRef = useRef<Set<string>>(new Set());
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
  const showGlobalStylesPanel = isCompactViewport ? compactGlobalStylesOpen : desktopGlobalStylesOpen;
  const showSmartAligner = isCompactViewport ? compactSmartAlignerOpen : desktopSmartAlignerOpen;

  const handleToggleLeftPanel = useCallback(() => {
    if (isCompactViewport) {
      setCompactLeftOpen((v) => !v);
      setCompactRightOpen(false);
      setCompactGradientOpen(false);
      setCompactGlobalStylesOpen(false);
      setCompactSmartAlignerOpen(false);
    } else {
      setDesktopLeftOpen((v) => !v);
    }
  }, [isCompactViewport]);

  const handleToggleRightPanel = useCallback(() => {
    if (isCompactViewport) {
      setCompactRightOpen((v) => !v);
      setCompactLeftOpen(false);
      setCompactGradientOpen(false);
      setCompactGlobalStylesOpen(false);
      setCompactSmartAlignerOpen(false);
    } else {
      setDesktopRightOpen((v) => !v);
    }
  }, [isCompactViewport]);

  const handleToggleGradientPanel = useCallback(() => {
    if (isCompactViewport) {
      setCompactGradientOpen((v) => !v);
      setCompactLeftOpen(false);
      setCompactRightOpen(false);
      setCompactGlobalStylesOpen(false);
      setCompactSmartAlignerOpen(false);
    } else {
      setDesktopGradientOpen((v) => {
        const next = !v;
        if (next) {
          setDesktopSmartAlignerOpen(false);
          setDesktopGlobalStylesOpen(false);
        }
        return next;
      });
    }
  }, [isCompactViewport]);

  const handleToggleGlobalStylesPanel = useCallback(() => {
    if (isCompactViewport) {
      setCompactGlobalStylesOpen((v) => !v);
      setCompactLeftOpen(false);
      setCompactRightOpen(false);
      setCompactGradientOpen(false);
      setCompactSmartAlignerOpen(false);
    } else {
      setDesktopGlobalStylesOpen((v) => {
        const next = !v;
        if (next) {
          setDesktopGradientOpen(false);
          setDesktopSmartAlignerOpen(false);
        }
        return next;
      });
    }
  }, [isCompactViewport]);

  const handleToggleSmartAligner = useCallback(() => {
    if (isCompactViewport) {
      setCompactSmartAlignerOpen((v) => !v);
      setCompactLeftOpen(false);
      setCompactRightOpen(false);
      setCompactGradientOpen(false);
      setCompactGlobalStylesOpen(false);
    } else {
      setDesktopSmartAlignerOpen((v) => {
        const next = !v;
        if (next) {
          setDesktopGradientOpen(false);
          setDesktopGlobalStylesOpen(false);
        }
        return next;
      });
    }
  }, [isCompactViewport]);

  const activePage = useMemo(() => {
    return (
      project.pages.find((p) => p.route === activeRoute) ||
      project.pages[0] || { route: '/', title: 'Home', filePath: 'app/page.tsx' }
    );
  }, [project.pages, activeRoute]);

  const projectComponents = useMemo(
    () => scanProjectComponents(project.files),
    [project.files]
  );

  const activeIsolatedPath =
    isolatedComponentPath && project.files[isolatedComponentPath]
      ? isolatedComponentPath
      : null;

  const canvasTargetPage = useMemo(() => {
    if (activeIsolatedPath) {
      const comp = projectComponents.find((c) => c.filePath === activeIsolatedPath);
      return {
        route: `component://${activeIsolatedPath}`,
        title: comp ? `<${comp.name} />` : activeIsolatedPath,
        filePath: activeIsolatedPath,
      };
    }
    return activePage;
  }, [activeIsolatedPath, projectComponents, activePage]);

  const componentUsages = useMemo(() => {
    const targetFile = selected?.filePath || canvasTargetPage.filePath;
    const code = project.files[targetFile];
    if (!code) return [];
    return scanComponentUsagesInFile(
      code,
      targetFile,
      projectComponents.map((c) => c.name)
    );
  }, [selected?.filePath, canvasTargetPage.filePath, project.files, projectComponents]);

  const logicRules = useMemo<VisualLogicRule[]>(() => {
    try {
      const raw = project.files['webd.logic.json'];
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [project.files]);

  const packageDependencies = useMemo(
    () => parsePackageDependencies(project.files),
    [project.files]
  );

  const selectedFileExternalImports = useMemo(() => {
    const targetFile = selected?.filePath || canvasTargetPage.filePath;
    return scanExternalImportsInSource(project.files[targetFile] || '');
  }, [selected?.filePath, canvasTargetPage.filePath, project.files]);

  const preloadExternalLibrary = useCallback((packageName: string) => {
    if (typeof window === 'undefined') return;
    const clean = packageName.trim();
    if (!clean || requestedLibsRef.current.has(clean)) return;
    requestedLibsRef.current.add(clean);

    const win = window as unknown as Record<string, Record<string, Record<string, unknown>>>;
    const rt = win.__STUDIO_RUNTIME__ || {};
    const cache = rt.ExternalLibs || {};
    if (cache[clean]) return;

    const esmUrl = buildEsmShUrl(clean);
    import(/* webpackIgnore: true */ esmUrl)
      .then((mod) => {
        const nextRt = win.__STUDIO_RUNTIME__ || {};
        nextRt.ExternalLibs = {
          ...(nextRt.ExternalLibs || {}),
          [clean]: mod,
        };
        win.__STUDIO_RUNTIME__ = nextRt;
        setExternalLibVersion((v) => v + 1);
      })
      .catch(() => {
        // Fallback shim or proxy in preview-runner stays active if CDN is unreachable
      });
  }, []);

  useEffect(() => {
    const onLibRequest = (ev: MessageEvent) => {
      const msg = ev.data || {};
      if (msg.type === 'studio:request-lib' && typeof msg.packageName === 'string') {
        preloadExternalLibrary(msg.packageName);
      }
    };
    window.addEventListener('message', onLibRequest);
    return () => window.removeEventListener('message', onLibRequest);
  }, [preloadExternalLibrary]);

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
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/compile-css', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            css: cssSignature.cssText,
            sources: [cssSignature.sourceText],
          }),
        });
        const parsed = await safeReadJsonResponse<{ css?: string }>(res);
        if (!parsed.ok) return;
        if (!controller.signal.aborted && typeof parsed.data.css === 'string') {
          setCompiledTailwindCss(parsed.data.css);
        }
      } catch {
        // Keep previous compiled CSS on abort or transient errors
      }
    }, 16);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [cssSignature]);

  const commitFilesMutation = useCallback(
    (nextFiles: Record<string, string>, touchedFile?: string) => {
      setHistoryPast((prev) => [...prev.slice(-49), project.files]);
      setHistoryFuture([]);
      const nextCssPaths = Object.keys(nextFiles)
        .filter((p) => /\.css$/i.test(p))
        .sort();
      setProject((prev) => ({
        ...prev,
        files: nextFiles,
        globalCssPaths: nextCssPaths,
      }));
      if (touchedFile) {
        setCodeDrawerFile(touchedFile);
      }
    },
    [project.files]
  );

  const handleLogicRulesChange = useCallback((nextRules: VisualLogicRule[]) => {
    commitFilesMutation({ ...project.files, 'webd.logic.json': JSON.stringify(nextRules, null, 2) });
  }, [project.files, commitFilesMutation]);

  const handleUpdateFileContent = useCallback(
    (filePath: string, content: string) => {
      if (project.files[filePath] === content) return;
      commitFilesMutation({ ...project.files, [filePath]: content }, filePath);
    },
    [project.files, commitFilesMutation]
  );

  const handleOpenInMonaco = useCallback((filePath: string) => {
    setDesktopGlobalStylesOpen(false);
    setDesktopGradientOpen(false);
    setDesktopSmartAlignerOpen(false);
    setCompactGlobalStylesOpen(false);
    setCodeDrawerFile(filePath);
    setIsCodeDrawerOpen(true);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [project.files, ...prev.slice(0, 49)]);
    const nextCssPaths = Object.keys(previous)
      .filter((p) => /\.css$/i.test(p))
      .sort();
    setProject((prev) => ({ ...prev, files: previous, globalCssPaths: nextCssPaths }));
  }, [historyPast, project.files]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev.slice(-49), project.files]);
    const nextCssPaths = Object.keys(next)
      .filter((p) => /\.css$/i.test(p))
      .sort();
    setProject((prev) => ({ ...prev, files: next, globalCssPaths: nextCssPaths }));
  }, [historyFuture, project.files]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.monaco-editor'))
      ) {
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
      const effectiveBp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
      const scopedPatch = scopeElementPatchToBreakpoint({
        code: currentCode,
        elementIndex,
        isHtml,
        patch,
        breakpoint: effectiveBp,
      });
      const updatedCode = applyElementPatchToSource(currentCode, elementIndex, isHtml, scopedPatch);
      if (updatedCode === currentCode) return;
      commitFilesMutation({ ...project.files, [filePath]: updatedCode }, filePath);
    },
    [project.files, alignBreakpointScope, viewport, commitFilesMutation]
  );

  const handleMoveSibling = useCallback(
    (filePath: string, elementIndex: number, targetIndex: number) => {
      const currentCode = project.files[filePath];
      if (!currentCode) return;
      const isHtml = /\.html?$/i.test(filePath);
      const elsBefore = scanElements(currentCode, isHtml);
      const elBefore = elsBefore[elementIndex];
      const updatedCode = moveElementSiblingInSource(currentCode, elementIndex, targetIndex, isHtml);
      if (updatedCode === currentCode) return;
      if (elBefore && elBefore.parentIndex >= 0) {
        const elsAfter = scanElements(updatedCode, isHtml);
        const parentAfter = elsAfter[elBefore.parentIndex];
        const movedNewIndex = parentAfter?.childIndices[targetIndex];
        if (movedNewIndex !== undefined) {
          setPendingSelectStudioId(`${filePath}::${movedNewIndex}`);
        }
      }
      commitFilesMutation({ ...project.files, [filePath]: updatedCode }, filePath);
    },
    [project.files, commitFilesMutation]
  );

  const handleClearPendingSelect = useCallback(() => {
    setPendingSelectStudioId(null);
  }, []);

  const handleSelectElement = useCallback(
    (snap: StudioElementSnapshot, shiftKey?: boolean, preserveMulti?: boolean) => {
      if (shiftKey) {
        setMultiSelected((prev) => {
          const baseList =
            prev.length > 0
              ? prev
              : selected && selected.studioId !== snap.studioId
              ? [selected]
              : [];
          const exists = baseList.some((item) => item.studioId === snap.studioId);
          return exists
            ? baseList.filter((item) => item.studioId !== snap.studioId)
            : [...baseList, snap];
        });
      } else if (!preserveMulti) {
        setMultiSelected([]);
      }
      setSelected((prev) => {
        if (prev?.studioId !== snap.studioId) {
          setPseudoState('default');
        }
        return snap;
      });
      if (snap?.filePath) setCodeDrawerFile(snap.filePath);
      if (snap && !activeIsolatedPath && snap.filePath === activePage.filePath) {
        setLastPageTarget({
          route: activePage.route,
          filePath: snap.filePath,
          elementIndex: snap.elementIndex,
          label: `<${snap.tagName}>`,
        });
      }
    },
    [activeIsolatedPath, activePage.filePath, activePage.route, selected]
  );

  const handleToggleLockLayer = useCallback((studioId: string) => {
    setLockedIds((prev) => {
      const nextLocked = prev.includes(studioId)
        ? prev.filter((id) => id !== studioId)
        : [...prev, studioId];
      if (nextLocked.includes(studioId)) {
        setSelected((cur) => (cur?.studioId === studioId ? null : cur));
        setMultiSelected((cur) => cur.filter((item) => item.studioId !== studioId));
      }
      return nextLocked;
    });
  }, []);

  const handleToggleHideLayer = useCallback((studioId: string) => {
    setHiddenIds((prev) => {
      const nextHidden = prev.includes(studioId)
        ? prev.filter((id) => id !== studioId)
        : [...prev, studioId];
      if (nextHidden.includes(studioId)) {
        setSelected((cur) => (cur?.studioId === studioId ? null : cur));
        setMultiSelected((cur) => cur.filter((item) => item.studioId !== studioId));
      }
      return nextHidden;
    });
  }, []);

  const handleChangePseudoState = useCallback(
    (studioId: string, nextPseudo: 'default' | 'hover' | 'focus') => {
      setPseudoState(nextPseudo);
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'studio:set-pseudo-state', studioId, pseudo: nextPseudo },
        '*'
      );
    },
    []
  );

  const handleMultiAlignAction = useCallback(
    (action: MultiAlignAction) => {
      if (multiSelected.length < 2) return;
      const items: MultiSelectAlignItem[] = multiSelected.map((item) => {
        const offsets = parseElementTranslateOffsets(item.inlineStyles, item.computedStyles);
        return {
          studioId: item.studioId,
          filePath: item.filePath,
          elementIndex: item.elementIndex,
          rect: item.rect,
          baseX: offsets.x,
          baseY: offsets.y,
        };
      });

      const results = computeMultiAlignPatches(items, action);
      if (results.length === 0) return;

      const byFile = new Map<string, Array<{ elementIndex: number; patch: ElementSourcePatch }>>();
      for (const res of results) {
        const code = project.files[res.filePath];
        if (!code) continue;
        const isHtml = /\.html?$/i.test(res.filePath);
        const effectiveBp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
        const scopedPatch = scopeElementPatchToBreakpoint({
          code,
          elementIndex: res.elementIndex,
          isHtml,
          patch: res.patch,
          breakpoint: effectiveBp,
        });
        const list = byFile.get(res.filePath) || [];
        list.push({ elementIndex: res.elementIndex, patch: scopedPatch });
        byFile.set(res.filePath, list);
      }

      const nextFiles = { ...project.files };
      let firstTouched: string | undefined;
      for (const [fp, updates] of byFile.entries()) {
        const code = project.files[fp];
        if (!code) continue;
        const isHtml = /\.html?$/i.test(fp);
        const updated = applyBatchElementPatches(code, isHtml, updates);
        if (updated !== code) {
          nextFiles[fp] = updated;
          if (!firstTouched) firstTouched = fp;
        }
      }

      if (!firstTouched) return;
      commitFilesMutation(nextFiles, firstTouched);
      const ids = multiSelected.map((m) => m.studioId);
      window.setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'studio:multi-rects-request', studioIds: ids },
          '*'
        );
      }, 90);
    },
    [multiSelected, project.files, alignBreakpointScope, viewport, commitFilesMutation]
  );

  const handleWrapMultiSelected = useCallback(
    (layout: WrapContainerLayout) => {
      if (multiSelected.length < 2) return;
      const targetFile = multiSelected[0].filePath;
      const parentStudioId = multiSelected[0].parentStudioId;
      if (
        !parentStudioId ||
        !multiSelected.every(
          (item) => item.filePath === targetFile && item.parentStudioId === parentStudioId
        )
      ) {
        return;
      }
      const code = project.files[targetFile];
      if (!code) return;
      const isHtml = /\.html?$/i.test(targetFile);
      const indices = multiSelected.map((item) => item.elementIndex);
      const updated = wrapElementsInContainer(code, isHtml, indices, layout);
      if (updated === code) return;
      setMultiSelected([]);
      setSelected(null);
      commitFilesMutation({ ...project.files, [targetFile]: updated }, targetFile);
    },
    [multiSelected, project.files, commitFilesMutation]
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
      setMultiSelected([]);
      setPseudoState('default');
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
      setIsolatedComponentPath(null);
      setActiveRoute(targetPage.route);
      setSelected(null);
      setMultiSelected([]);
      setLockedIds([]);
      setHiddenIds([]);
      setPseudoState('default');
      setCodeDrawerFile(targetPage.filePath);
    },
    [project.pages]
  );

  const handleSelectComponent = useCallback((filePath: string) => {
    setIsolatedComponentPath(filePath);
    setSelected(null);
    setMultiSelected([]);
    setPseudoState('default');
    setCodeDrawerFile(filePath);
  }, []);

  const handleExitComponentIsolation = useCallback(() => {
    setIsolatedComponentPath(null);
    setSelected(null);
    setMultiSelected([]);
    setPseudoState('default');
    setCodeDrawerFile(activePage.filePath);
  }, [activePage.filePath]);

  const handleCreateComponent = useCallback(
    (rawName: string, preset: ComponentTemplatePreset = 'card') => {
      const created = createComponentFileTemplate(rawName, preset);
      let targetPath = created.filePath;
      let counter = 2;
      while (project.files[targetPath]) {
        targetPath = `components/${created.componentName}${counter}.tsx`;
        counter += 1;
      }
      const nextCreated =
        targetPath === created.filePath
          ? created
          : createComponentFileTemplate(`${created.componentName}${counter - 1}`, preset);
      const nextFiles = { ...project.files, [targetPath]: nextCreated.code };
      commitFilesMutation(nextFiles, targetPath);
      setIsolatedComponentPath(targetPath);
      setSelected(null);
    },
    [project.files, commitFilesMutation]
  );

  const handleReplaceWithComponent = useCallback(
    (targetFilePath: string, elementIndex: number, componentFilePath: string) => {
      const targetCode = project.files[targetFilePath];
      const comp = projectComponents.find((c) => c.filePath === componentFilePath);
      if (!targetCode || !comp) return;
      const defaultProps: Record<string, string> = {};
      for (const p of comp.props) {
        if (p.defaultValue !== undefined) defaultProps[p.name] = p.defaultValue;
      }
      const updated = replaceElementWithComponentInSource({
        targetCode,
        targetFilePath,
        elementIndex,
        componentName: comp.name,
        componentFilePath: comp.filePath,
        componentCode: project.files[comp.filePath],
        props: defaultProps,
      });
      if (!updated || updated === targetCode) return;
      setSelected(null);
      commitFilesMutation({ ...project.files, [targetFilePath]: updated }, targetFilePath);
    },
    [project.files, projectComponents, commitFilesMutation]
  );

  const handleInsertComponent = useCallback(
    (
      targetFilePath: string,
      elementIndex: number,
      position: ComponentInsertPosition,
      componentFilePath: string
    ) => {
      const targetCode = project.files[targetFilePath];
      const comp = projectComponents.find((c) => c.filePath === componentFilePath);
      if (!targetCode || !comp) return;
      const updated = insertComponentIntoSource({
        targetCode,
        targetFilePath,
        targetElementIndex: elementIndex,
        position,
        componentName: comp.name,
        componentFilePath: comp.filePath,
        componentCode: project.files[comp.filePath],
      });
      if (!updated || updated === targetCode) return;
      setSelected(null);
      commitFilesMutation({ ...project.files, [targetFilePath]: updated }, targetFilePath);
    },
    [project.files, projectComponents, commitFilesMutation]
  );

  const handleInsertComponentOnPage = useCallback(
    (componentFilePath: string, explicitPosition?: ComponentInsertPosition) => {
      const targetFilePath = activePage.filePath;
      const targetCode = project.files[targetFilePath];
      const comp = projectComponents.find((c) => c.filePath === componentFilePath);
      if (!targetCode || !comp) return;

      const useCurrentSelection = selected && selected.filePath === targetFilePath;
      const useRememberedTarget =
        !useCurrentSelection &&
        lastPageTarget &&
        lastPageTarget.filePath === targetFilePath;

      const targetIndex = useCurrentSelection
        ? selected.elementIndex
        : useRememberedTarget
        ? lastPageTarget.elementIndex
        : 0;
      const pos: ComponentInsertPosition =
        explicitPosition ||
        (useCurrentSelection || useRememberedTarget ? 'after' : 'inside-end');

      const updated = insertComponentIntoSource({
        targetCode,
        targetFilePath,
        targetElementIndex: targetIndex,
        position: pos,
        componentName: comp.name,
        componentFilePath: comp.filePath,
        componentCode: project.files[comp.filePath],
      });
      if (!updated || updated === targetCode) return;

      setIsolatedComponentPath(null);
      setSelected(null);
      commitFilesMutation({ ...project.files, [targetFilePath]: updated }, targetFilePath);
    },
    [
      activePage.filePath,
      project.files,
      projectComponents,
      selected,
      lastPageTarget,
      commitFilesMutation,
    ]
  );

  const handleInsertIsolatedComponent = useCallback(
    (position: ComponentInsertPosition) => {
      if (!activeIsolatedPath) return;
      handleInsertComponentOnPage(activeIsolatedPath, position);
    },
    [activeIsolatedPath, handleInsertComponentOnPage]
  );

  const handleImportReactLibrary = useCallback(
    (params: {
      packageName: string;
      version?: string;
      importMode: 'named' | 'default' | 'namespace';
      identifiers: string[];
      targetFilePath: string;
      sampleJsx?: string;
      action?: 'replace' | 'insert';
      position?: ComponentInsertPosition;
      targetElementIndex?: number;
    }) => {
      const {
        packageName,
        version,
        importMode,
        identifiers,
        targetFilePath,
        sampleJsx,
        action = 'insert',
        position = 'inside-end',
        targetElementIndex,
      } = params;
      const currentTargetCode = project.files[targetFilePath];
      if (!currentTargetCode) {
        return { ok: false, error: 'Target source file not found.' };
      }

      let nextFiles = addPackageDependencyToFiles(project.files, packageName, version);
      let updatedSource = injectLibraryImportIntoSource(currentTargetCode, {
        packageName,
        importMode,
        identifiers,
      });

      if (sampleJsx && /\.(tsx|jsx)$/i.test(targetFilePath)) {
        const targetIdx =
          targetElementIndex !== undefined
            ? targetElementIndex
            : selected && selected.filePath === targetFilePath
            ? selected.elementIndex
            : 0;
        const withSnippet =
          action === 'replace'
            ? replaceElementWithSnippetInSource({
                targetCode: updatedSource,
                elementIndex: targetIdx,
                jsxSnippet: sampleJsx,
              })
            : insertJsxSnippetIntoSource({
                targetCode: updatedSource,
                targetElementIndex: targetIdx,
                position,
                jsxSnippet: sampleJsx,
              });
        if (withSnippet) {
          updatedSource = withSnippet;
        }
      }

      nextFiles = { ...nextFiles, [targetFilePath]: updatedSource };
      setSelected(null);
      commitFilesMutation(nextFiles, targetFilePath);
      preloadExternalLibrary(packageName);
      return { ok: true };
    },
    [project.files, selected, commitFilesMutation, preloadExternalLibrary]
  );

  const handleApplyUiComponent = useCallback(
    (params: {
      targetFilePath: string;
      targetElementIndex: number;
      entry: ReactUiLibraryEntry;
      action: 'replace' | 'insert';
      position?: ComponentInsertPosition;
      integrationMode: 'component' | 'inline';
      customProps?: Record<string, string>;
    }) => {
      const result = applyUiLibraryToProject({
        files: project.files,
        ...params,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setSelected(null);
      setMultiSelected([]);
      commitFilesMutation(result.files, result.touchedFilePath);
      for (const pkg of result.installedPackages) {
        preloadExternalLibrary(pkg);
      }
      return {
        ok: true,
        createdComponentPath: result.createdComponentPath,
      };
    },
    [project.files, commitFilesMutation, preloadExternalLibrary]
  );

  const handleApplyProjectComponent = useCallback(
    (params: {
      targetFilePath: string;
      targetElementIndex: number;
      componentFilePath: string;
      action: 'replace' | 'insert';
      position?: ComponentInsertPosition;
      props?: Record<string, string>;
    }) => {
      const targetCode = project.files[params.targetFilePath];
      const comp = projectComponents.find((c) => c.filePath === params.componentFilePath);
      if (!targetCode || !comp) {
        return { ok: false, error: 'Target file or component not found.' };
      }
      const updated =
        params.action === 'replace'
          ? replaceElementWithComponentInSource({
              targetCode,
              targetFilePath: params.targetFilePath,
              elementIndex: params.targetElementIndex,
              componentName: comp.name,
              componentFilePath: comp.filePath,
              componentCode: project.files[comp.filePath],
              props: params.props,
            })
          : insertComponentIntoSource({
              targetCode,
              targetFilePath: params.targetFilePath,
              targetElementIndex: params.targetElementIndex,
              position: params.position || 'after',
              componentName: comp.name,
              componentFilePath: comp.filePath,
              componentCode: project.files[comp.filePath],
              props: params.props,
            });
      if (!updated || updated === targetCode) {
        return {
          ok: false,
          error: 'Could not apply component to the selected element slot.',
        };
      }
      setSelected(null);
      setMultiSelected([]);
      commitFilesMutation({ ...project.files, [params.targetFilePath]: updated }, params.targetFilePath);
      return { ok: true };
    },
    [project.files, projectComponents, commitFilesMutation]
  );

  const handleRemoveDependency = useCallback(
    (packageName: string) => {
      const nextFiles = removePackageDependencyFromFiles(project.files, packageName);
      if (nextFiles === project.files) return;
      commitFilesMutation(nextFiles);
    },
    [project.files, commitFilesMutation]
  );

  const handleExtractComponent = useCallback(
    (filePath: string, elementIndex: number, componentName: string) => {
      const sourceCode = project.files[filePath];
      if (!sourceCode) return;
      let candidateName = componentName.trim();
      if (!candidateName) return;
      const baseCreated = createComponentFileTemplate(candidateName);
      let suffix = 2;
      while (
        project.files[`components/${candidateName}.tsx`] ||
        project.files[`src/components/${candidateName}.tsx`] ||
        (suffix === 2 && project.files[baseCreated.filePath])
      ) {
        candidateName = `${baseCreated.componentName}${suffix}`;
        suffix += 1;
      }
      const extracted = extractSelectionToComponent({
        pageCode: sourceCode,
        pagePath: filePath,
        elementIndex,
        rawComponentName: candidateName,
      });
      if (!extracted) return;
      const nextFiles = {
        ...project.files,
        [extracted.componentPath]: extracted.componentCode,
        [filePath]: extracted.updatedPageCode,
      };
      setSelected(null);
      commitFilesMutation(nextFiles, extracted.componentPath);
    },
    [project.files, commitFilesMutation]
  );

  const handlePatchComponentProp = useCallback(
    (filePath: string, elementIndex: number, propName: string, propValue: string) => {
      const currentCode = project.files[filePath];
      if (!currentCode) return;
      const updated = patchJsxPropInSource(currentCode, elementIndex, propName, propValue);
      if (updated === currentCode) return;
      commitFilesMutation({ ...project.files, [filePath]: updated }, filePath);
    },
    [project.files, commitFilesMutation]
  );

  const handleAutoAlign = useCallback(
    (mode: AutoAlignMode, scopeElementIndex?: number) => {
      const primaryFile =
        scopeElementIndex !== undefined && selected?.filePath
          ? selected.filePath
          : canvasTargetPage.filePath;
      const primaryCode = project.files[primaryFile];
      if (!primaryCode) return { changesCount: 0, summary: [] as string[] };

      const isHtml = /\.html?$/i.test(primaryFile);
      const effectiveBp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
      const nextFiles = { ...project.files };
      const primaryRes = autoAlignSourceCode({
        code: primaryCode,
        isHtml,
        mode,
        scopeElementIndex,
        breakpoint: effectiveBp,
      });

      let totalChanges = primaryRes.changesCount;
      const allSummaries = [...primaryRes.summary];
      if (primaryRes.updatedCode !== primaryCode) {
        nextFiles[primaryFile] = primaryRes.updatedCode;
      }

      // Also align components rendered on the page when running whole-page auto-align
      if (scopeElementIndex === undefined && !activeIsolatedPath && !isHtml) {
        const usedCompFiles = new Set<string>();
        for (const usage of componentUsages) {
          const def = projectComponents.find((c) => c.name === usage.componentName);
          if (def && def.filePath !== primaryFile) usedCompFiles.add(def.filePath);
        }
        for (const compPath of usedCompFiles) {
          const compCode = project.files[compPath];
          if (!compCode) continue;
          const compRes = autoAlignSourceCode({
            code: compCode,
            isHtml: false,
            mode,
            breakpoint: effectiveBp,
          });
          if (compRes.updatedCode !== compCode) {
            nextFiles[compPath] = compRes.updatedCode;
            totalChanges += compRes.changesCount;
            allSummaries.push(...compRes.summary);
          }
        }
      }

      if (totalChanges > 0) {
        commitFilesMutation(nextFiles, primaryFile);
      }
      return {
        changesCount: totalChanges,
        summary: Array.from(new Set(allSummaries)).slice(0, 6),
      };
    },
    [
      selected,
      canvasTargetPage.filePath,
      project.files,
      alignBreakpointScope,
      viewport,
      activeIsolatedPath,
      componentUsages,
      projectComponents,
      commitFilesMutation,
    ]
  );

  const handleSmartAlignElement = useCallback(
    (opts: {
      filePath: string;
      elementIndex: number;
      horizontal?: HorizontalAlign;
      vertical?: VerticalAlign;
    }) => {
      const code = project.files[opts.filePath];
      if (!code) return;
      const isHtml = /\.html?$/i.test(opts.filePath);
      const meta = readElementMeta(code, opts.elementIndex, isHtml);
      if (!meta || meta.isDynamicClassName) return;

      const bp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
      const res = alignElementClassName(meta.className, {
        tagName: meta.tagName,
        inlineStyles: meta.inlineStyles,
        breakpoint: bp,
        horizontal: opts.horizontal,
        vertical: opts.vertical,
        hasChildren: meta.childIndices.length > 0,
      });

      const updated = applyElementPatchToSource(code, opts.elementIndex, isHtml, {
        className: res.className,
        styles:
          Object.keys(res.clearInlineStyles).length > 0 ? res.clearInlineStyles : undefined,
      });
      if (updated === code) return;
      commitFilesMutation({ ...project.files, [opts.filePath]: updated }, opts.filePath);
    },
    [project.files, alignBreakpointScope, viewport, commitFilesMutation]
  );

  const handleRedesignBlock = useCallback(
    (filePath: string, elementIndex: number, pattern: BlockRedesignPattern) => {
      const code = project.files[filePath];
      if (!code) return;
      const isHtml = /\.html?$/i.test(filePath);
      const meta = readElementMeta(code, elementIndex, isHtml);
      if (!meta || meta.isDynamicClassName) return;

      const bp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
      const nextClassName = redesignBlockClassName(meta.className, pattern, bp);
      const clearStyles: Record<string, null> = {};
      if (meta.inlineStyles.display) clearStyles.display = null;
      if (meta.inlineStyles.flexDirection) clearStyles.flexDirection = null;
      if (meta.inlineStyles.gridTemplateColumns) clearStyles.gridTemplateColumns = null;
      if (meta.inlineStyles.transform) clearStyles.transform = null;

      const updated = applyElementPatchToSource(code, elementIndex, isHtml, {
        className: nextClassName,
        styles: Object.keys(clearStyles).length > 0 ? clearStyles : undefined,
      });
      if (updated === code) return;
      commitFilesMutation({ ...project.files, [filePath]: updated }, filePath);
    },
    [project.files, alignBreakpointScope, viewport, commitFilesMutation]
  );

  const handleApplyWidthAndSpacing = useCallback(
    (
      filePath: string,
      elementIndex: number,
      opts: { widthPreset?: WidthPreset; density?: SpacingDensity }
    ) => {
      const code = project.files[filePath];
      if (!code) return;
      const isHtml = /\.html?$/i.test(filePath);
      const meta = readElementMeta(code, elementIndex, isHtml);
      if (!meta || meta.isDynamicClassName) return;

      const bp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
      const nextClassName = applyWidthAndSpacingToClassName(meta.className, {
        breakpoint: bp,
        widthPreset: opts.widthPreset,
        density: opts.density,
      });

      const updated = applyElementPatchToSource(code, elementIndex, isHtml, {
        className: nextClassName,
        styles: opts.widthPreset ? { width: null, maxWidth: null } : undefined,
      });
      if (updated === code) return;
      commitFilesMutation({ ...project.files, [filePath]: updated }, filePath);
    },
    [project.files, alignBreakpointScope, viewport, commitFilesMutation]
  );

  const handleResetManualOffsets = useCallback(
    (filePath: string, elementIndex: number) => {
      const code = project.files[filePath];
      if (!code) return;
      const isHtml = /\.html?$/i.test(filePath);
      const updated = applyElementPatchToSource(code, elementIndex, isHtml, {
        styles: {
          transform: null,
          left: null,
          right: null,
          top: null,
          bottom: null,
          width: null,
        },
      });
      if (updated === code) return;
      commitFilesMutation({ ...project.files, [filePath]: updated }, filePath);
    },
    [project.files, commitFilesMutation]
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
      setIsolatedComponentPath(null);
      setSelected(null);
      setMultiSelected([]);
      setLockedIds([]);
      setHiddenIds([]);
      setPseudoState('default');
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
    setIsolatedComponentPath(null);
    setSelected(null);
    setMultiSelected([]);
    setLockedIds([]);
    setHiddenIds([]);
    setPseudoState('default');
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
        showGlobalStylesPanel={showGlobalStylesPanel}
        onToggleGlobalStylesPanel={handleToggleGlobalStylesPanel}
        showLogicPanel={isLogicPanelOpen}
        onToggleLogicPanel={() => setIsLogicPanelOpen((v) => !v)}
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
              components={projectComponents}
              isolatedComponentPath={activeIsolatedPath}
              onSelectComponent={(filePath) => {
                handleSelectComponent(filePath);
                if (isCompactViewport) setCompactLeftOpen(false);
              }}
              onCreateComponent={(name, preset) => {
                handleCreateComponent(name, preset);
                if (isCompactViewport) setCompactLeftOpen(false);
              }}
              onInsertComponentOnPage={(compPath) => {
                handleInsertComponentOnPage(compPath);
                if (isCompactViewport) setCompactLeftOpen(false);
              }}
              installedLibCount={Object.keys(packageDependencies).length}
              onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
              layerTree={layerTree}
              selectedStudioId={selected?.studioId || null}
              multiSelectedIds={multiSelected.map((m) => m.studioId)}
              lockedIds={lockedIds}
              hiddenIds={hiddenIds}
              onToggleLockLayer={handleToggleLockLayer}
              onToggleHideLayer={handleToggleHideLayer}
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
        {isCompactViewport &&
          (showLeftPanel ||
            showRightPanel ||
            showGradientPanel ||
            showGlobalStylesPanel ||
            showSmartAligner ||
            isLogicPanelOpen) && (
            <button
              type="button"
              aria-label="Close panel drawer"
              onClick={() => {
                setCompactLeftOpen(false);
                setCompactRightOpen(false);
                setCompactGradientOpen(false);
                setCompactGlobalStylesOpen(false);
                setCompactSmartAlignerOpen(false);
                setIsLogicPanelOpen(false);
              }}
              className="absolute inset-0 z-30 bg-slate-900/30"
            />
          )}

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <VisualCanvas
            project={project}
            activePage={canvasTargetPage}
            compiledTailwindCss={compiledTailwindCss}
            viewport={viewport}
            interactionMode={interactionMode}
            selected={selected}
            multiSelected={multiSelected}
            onUpdateMultiSelected={setMultiSelected}
            onMultiAlignAction={handleMultiAlignAction}
            onWrapMultiSelected={handleWrapMultiSelected}
            lockedIds={lockedIds}
            hiddenIds={hiddenIds}
            pseudoState={pseudoState}
            pendingSelectStudioId={pendingSelectStudioId}
            onClearPendingSelect={handleClearPendingSelect}
            onSelectElement={handleSelectElement}
            onUpdateLayerTree={setLayerTree}
            onNavigateRoute={handleSelectPage}
            onCommitPatch={handleCommitPatch}
            onMoveSibling={handleMoveSibling}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            iframeRef={iframeRef}
            snapEnabled={snapEnabled}
            onToggleSnap={() => setSnapEnabled((v) => !v)}
            isIsolatedComponent={Boolean(activeIsolatedPath)}
            onExitComponentIsolation={handleExitComponentIsolation}
            onInsertIsolatedComponent={handleInsertIsolatedComponent}
            isolatedTargetLabel={
              lastPageTarget && lastPageTarget.filePath === activePage.filePath
                ? lastPageTarget.label
                : null
            }
            onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
            externalLibVersion={externalLibVersion}
            showSmartAligner={showSmartAligner}
            onToggleSmartAligner={handleToggleSmartAligner}
          />

          {/* Smart Aligner Panel (docked on desktop) */}
          {!isCompactViewport && showSmartAligner && (
            <SmartAlignerPanel
              selected={selected}
              activeFilePath={canvasTargetPage.filePath}
              activeFileCode={project.files[canvasTargetPage.filePath] || ''}
              viewport={viewport}
              onChangeViewport={setViewport}
              breakpointScope={alignBreakpointScope}
              onChangeBreakpointScope={setAlignBreakpointScope}
              onAutoAlign={handleAutoAlign}
              onAlignElement={handleSmartAlignElement}
              onRedesignBlock={handleRedesignBlock}
              onApplyWidthAndSpacing={handleApplyWidthAndSpacing}
              onResetManualOffsets={handleResetManualOffsets}
              onClose={() => setDesktopSmartAlignerOpen(false)}
            />
          )}

          {/* Multi-Stop Gradient & CSS Panel (docked on desktop) */}
          {!isCompactViewport && showGradientPanel && (
            <GradientCssPanel
              selected={selected}
              onPreviewStyles={handlePreviewStyles}
              onCommitPatch={handleCommitPatch}
              onClose={() => setDesktopGradientOpen(false)}
            />
          )}

          {/* Visual Logic Builder (docked on desktop) */}
          {!isCompactViewport && isLogicPanelOpen && (
            <div className="absolute inset-y-0 right-0 z-40 flex shadow-xl">
              <LogicPanel
                selected={selected}
                rules={logicRules}
                onChange={handleLogicRulesChange}
                onClose={() => setIsLogicPanelOpen(false)}
              />
            </div>
          )}

          {/* Global Styles Manager (docked on desktop) */}
          {!isCompactViewport && showGlobalStylesPanel && (
            <GlobalStylesPanel
              files={project.files}
              globalCssPaths={project.globalCssPaths}
              framework={project.framework}
              onUpdateCssFile={handleUpdateFileContent}
              onOpenInMonaco={handleOpenInMonaco}
              onClose={() => setDesktopGlobalStylesOpen(false)}
            />
          )}

          <CodeDrawer
            isOpen={isCodeDrawerOpen}
            onClose={() => setIsCodeDrawerOpen(false)}
            files={project.files}
            originalFiles={project.originalFiles}
            activeFilePath={codeDrawerFile}
            onSelectFile={setCodeDrawerFile}
            onUpdateFile={handleUpdateFileContent}
            onRevertFile={handleRevertFile}
          />
        </div>

        {/* Smart Aligner Panel (bottom sheet on mobile/compact screens) */}
        {isCompactViewport && showSmartAligner && (
          <div
            className={
              isPhoneViewport
                ? 'absolute inset-x-0 bottom-0 z-40 flex h-[74vh] max-h-[620px] rounded-t-2xl shadow-2xl overflow-hidden'
                : 'absolute inset-x-0 bottom-0 z-40 flex max-h-[360px] shadow-2xl overflow-hidden'
            }
          >
            <SmartAlignerPanel
              selected={selected}
              activeFilePath={canvasTargetPage.filePath}
              activeFileCode={project.files[canvasTargetPage.filePath] || ''}
              viewport={viewport}
              onChangeViewport={setViewport}
              breakpointScope={alignBreakpointScope}
              onChangeBreakpointScope={setAlignBreakpointScope}
              onAutoAlign={handleAutoAlign}
              onAlignElement={handleSmartAlignElement}
              onRedesignBlock={handleRedesignBlock}
              onApplyWidthAndSpacing={handleApplyWidthAndSpacing}
              onResetManualOffsets={handleResetManualOffsets}
              onClose={() => setCompactSmartAlignerOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

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

        {/* Global Styles Manager (bottom sheet on mobile/compact screens) */}
        {isCompactViewport && showGlobalStylesPanel && (
          <div
            className={
              isPhoneViewport
                ? 'absolute inset-x-0 bottom-0 z-40 flex h-[76vh] max-h-[640px] rounded-t-2xl shadow-2xl overflow-hidden'
                : 'absolute inset-x-0 bottom-0 z-40 flex max-h-[360px] shadow-2xl overflow-hidden'
            }
          >
            <GlobalStylesPanel
              files={project.files}
              globalCssPaths={project.globalCssPaths}
              framework={project.framework}
              onUpdateCssFile={handleUpdateFileContent}
              onOpenInMonaco={(path) => {
                setCompactGlobalStylesOpen(false);
                handleOpenInMonaco(path);
              }}
              onClose={() => setCompactGlobalStylesOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Visual Logic Builder (bottom sheet / drawer on compact screens) */}
        {isCompactViewport && isLogicPanelOpen && (
          <div className={isPhoneViewport ? 'absolute inset-x-0 bottom-0 z-40 flex h-[74vh] max-h-[620px] rounded-t-2xl shadow-2xl overflow-hidden' : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'}>
            <LogicPanel
              selected={selected}
              rules={logicRules}
              onChange={handleLogicRulesChange}
              onClose={() => setIsLogicPanelOpen(false)}
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
              activePageFilePath={activePage.filePath}
              components={projectComponents}
              componentUsages={componentUsages}
              onIsolateComponent={handleSelectComponent}
              onExtractComponent={handleExtractComponent}
              onPatchComponentProp={handlePatchComponentProp}
              onReplaceWithComponent={handleReplaceWithComponent}
              onInsertComponent={handleInsertComponent}
              onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
              fileExternalImports={selectedFileExternalImports}
              dependenciesCount={Object.keys(packageDependencies).length}
              viewport={viewport}
              alignBreakpointScope={alignBreakpointScope}
              onChangeAlignBreakpointScope={setAlignBreakpointScope}
              onSmartAutoAlign={handleAutoAlign}
              onSmartAlignElement={handleSmartAlignElement}
              onSmartRedesignBlock={handleRedesignBlock}
              pseudoState={pseudoState}
              onChangePseudoState={handleChangePseudoState}
              onOpenSmartAligner={() => {
                if (isCompactViewport) {
                  setCompactRightOpen(false);
                  setCompactGlobalStylesOpen(false);
                  setCompactSmartAlignerOpen(true);
                } else {
                  setDesktopGradientOpen(false);
                  setDesktopGlobalStylesOpen(false);
                  setDesktopSmartAlignerOpen(true);
                }
              }}
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
            onClick={() => setIsLogicPanelOpen((v) => !v)}
            aria-pressed={isLogicPanelOpen}
            aria-label="Toggle logic builder"
            className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-xs font-medium whitespace-nowrap transition-colors ${isLogicPanelOpen ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <GitBranch className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Logic</span>
          </button>
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
            <span className="hidden sm:inline">CSS</span>
          </button>

          <button
            type="button"
            onClick={handleToggleGlobalStylesPanel}
            aria-pressed={showGlobalStylesPanel}
            aria-label="Toggle global styles manager"
            className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2 text-xs font-medium whitespace-nowrap transition-colors ${
              showGlobalStylesPanel
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Palette className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Global</span>
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

      <ReactLibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        files={project.files}
        defaultTargetFile={selected?.filePath || canvasTargetPage.filePath}
        selectedTarget={
          selected
            ? {
                filePath: selected.filePath,
                elementIndex: selected.elementIndex,
                tagName: selected.tagName,
                textPreview: selected.textContent,
              }
            : null
        }
        projectComponents={projectComponents}
        dependencies={packageDependencies}
        onApplyUiComponent={handleApplyUiComponent}
        onApplyProjectComponent={handleApplyProjectComponent}
        onCreateComponent={handleCreateComponent}
        onIsolateComponent={(compPath) => {
          setIsolatedComponentPath(compPath);
          setSelected(null);
        }}
        onImportLibrary={handleImportReactLibrary}
        onRemoveDependency={handleRemoveDependency}
      />
    </div>
  );
}
