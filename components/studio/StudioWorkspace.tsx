'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Layers, Search, SlidersHorizontal, Wrench } from 'lucide-react';
import LogicPanel from './LogicPanel';
import AnimationStudioPanel from './AnimationStudioPanel';
import ExportProductionModal from './ExportProductionModal';
import CanvasContextMenu from './CanvasContextMenu';
import CommandPaletteModal from './CommandPaletteModal';
import MobileToolsSheet from './MobileToolsSheet';
import BrandRemixerPanel from './BrandRemixerPanel';
import HistoryTimelinePanel, { type HistoryTimelineEntry } from './HistoryTimelinePanel';
import QaAuditPanel from './QaAuditPanel';
import RepeaterEditorPanel from './RepeaterEditorPanel';
import MultiDeviceWallModal from './MultiDeviceWallModal';
import {
  type BrandRemixConfig,
  DEFAULT_BRAND_REMIX_CONFIG,
  applyBrandRemixToGlobalCss,
  stripBrandRemixFromGlobalCss,
} from '@/lib/studio/brand-remixer';
import {
  type QaAuditIssue,
  type QaRawNodeMetric,
  analyzeDomMetricsForQa,
} from '@/lib/studio/qa-audit';
import {
  type RepeaterGroup,
  addRepeaterItemFromLast,
  detectRepeaterGroups,
  duplicateRepeaterItem,
  findRepeaterForElement,
  moveRepeaterItem,
  removeRepeaterItem,
  updateRepeaterSlotText,
} from '@/lib/studio/repeater-detector';
import { buildPreviewDocument } from '@/lib/studio/preview-runner';
import { normalizeLogicRules, type VisualLogicRule } from '@/lib/studio/logic-engine';
import {
  ElementAnimationConfig,
  buildAnimationClassesAndStyles,
  countAnimatedElementsInFiles,
  mergeMotionCssIntoGlobalCss,
} from '@/lib/studio/animation-studio';
import {
  isVirtualMediaDataUrlFile,
  registerMediaAssetInProjectFiles,
} from '@/lib/studio/media-pipeline';
import MotionPresetStudioPanel from './MotionPresetStudioPanel';
import { DEFAULT_MOTION_PRESET, MOTION_PRESET_FILE, applyMotionPresetToFiles, normalizeMotionPreset, type MotionPreset } from '@/lib/studio/motion-presets';
import { StudioCommandItem } from '@/lib/studio/command-palette';
import {
  CopiedStyleClipboard,
  buildCopiedStylePayload,
  buildPasteStylePatch,
  suggestExtractedComponentName,
} from '@/lib/studio/workspace-actions';
import TopToolbar from './TopToolbar';
import AndroidIDEPanel from './AndroidIDEPanel';
import PagesLayersPanel from './PagesLayersPanel';
import VisualCanvas from './VisualCanvas';
import StyleInspectorPanel from './StyleInspectorPanel';
import GradientCssPanel from './GradientCssPanel';
import GlobalStylesPanel from './GlobalStylesPanel';
import ImportProjectModal from './ImportProjectModal';
import DraftsModal from './DraftsModal';
import ReactLibraryModal from './ReactLibraryModal';
import LayoutBuilderPanel, { LAYOUT_BLOCKS } from './LayoutBuilderPanel';
import SmartAlignerPanel from './SmartAlignerPanel';
import CodeDrawer from './CodeDrawer';
import MediaLibraryModal from './MediaLibraryModal';
import TypographyEffectsModal, { type TextMotionPreset } from './TypographyEffectsModal';
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
  parseNpmInstallCommand,
  removePackageDependencyFromFiles,
  scanExternalImportsInSource,
  isValidPackageName,
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
import { scanProjectStructure } from '@/lib/studio/project-scanner';
import { createPageFile, type PageTemplatePreset } from '@/lib/studio/page-generator';
import { createSharedSiteKit } from '@/lib/studio/site-kit';
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
  const [isAndroidIdeOpen, setIsAndroidIdeOpen] = useState(false);
  const [historyPast, setHistoryPast] = useState<Record<string, string>[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Record<string, string>[]>([]);
  const [historyTimeline, setHistoryTimeline] = useState<HistoryTimelineEntry[]>(() => [
    {
      id: 'cp-initial',
      label: 'Initial Project',
      timestamp: 'Start',
      files: STARTER_NEXTJS_FILES,
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

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
  const [isMotionPanelOpen, setIsMotionPanelOpen] = useState(false);
  const [isMotionPresetPanelOpen, setIsMotionPresetPanelOpen] = useState(false);
  const [motionPreset, setMotionPreset] = useState<MotionPreset>(() => {
    try {
      const saved = STARTER_NEXTJS_FILES[MOTION_PRESET_FILE];
      return saved ? normalizeMotionPreset(JSON.parse(saved)) : DEFAULT_MOTION_PRESET;
    } catch {
      return DEFAULT_MOTION_PRESET;
    }
  });
  const [isBrandRemixerOpen, setIsBrandRemixerOpen] = useState(false);
  const [brandRemixConfig, setBrandRemixConfig] = useState<BrandRemixConfig>(
    DEFAULT_BRAND_REMIX_CONFIG
  );
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isQaPanelOpen, setIsQaPanelOpen] = useState(false);
  const [qaIssues, setQaIssues] = useState<QaAuditIssue[]>([]);
  const [isQaScanning, setIsQaScanning] = useState(false);
  const [isRepeaterOpen, setIsRepeaterOpen] = useState(false);
  const [activeRepeaterGroupIdx, setActiveRepeaterGroupIdx] = useState(0);
  const [isMultiDeviceWallOpen, setIsMultiDeviceWallOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [codeDrawerFile, setCodeDrawerFile] = useState<string>('app/page.tsx');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [isTypographyEffectsOpen, setIsTypographyEffectsOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [justSavedDraft, setJustSavedDraft] = useState(false);
  const [compiledTailwindCss, setCompiledTailwindCss] = useState<string>('');
  const [desktopLeftOpen, setDesktopLeftOpen] = useState<boolean>(true);
  const [desktopRightOpen, setDesktopRightOpen] = useState<boolean>(true);
  const [desktopGradientOpen, setDesktopGradientOpen] = useState<boolean>(false);
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
  const [isLayoutBuilderOpen, setIsLayoutBuilderOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<CopiedStyleClipboard | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    target: StudioElementSnapshot;
    x: number;
    y: number;
    trigger: 'contextmenu' | 'longpress' | 'button';
  } | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const qaScanTimeoutRef = useRef<number | null>(null);
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

  const closeTransientOverlayPanels = useCallback(() => {
    setIsLogicPanelOpen(false);
    setIsMotionPanelOpen(false);
    setIsMotionPresetPanelOpen(false);
    setIsBrandRemixerOpen(false);
    setIsHistoryPanelOpen(false);
    setIsQaPanelOpen(false);
    setIsRepeaterOpen(false);
    setCompactLeftOpen(false);
    setCompactRightOpen(false);
    setCompactGradientOpen(false);
    setCompactGlobalStylesOpen(false);
    setCompactSmartAlignerOpen(false);
    if (!isCompactViewport) {
      setDesktopGradientOpen(false);
      setDesktopGlobalStylesOpen(false);
      setDesktopSmartAlignerOpen(false);
    }
  }, [isCompactViewport]);

  const handleToggleLeftPanel = useCallback(() => {
    if (isCompactViewport) {
      const next = !compactLeftOpen;
      closeTransientOverlayPanels();
      setCompactLeftOpen(next);
    } else {
      setDesktopLeftOpen((v) => !v);
    }
  }, [isCompactViewport, compactLeftOpen, closeTransientOverlayPanels]);

  const handleToggleRightPanel = useCallback(() => {
    if (isCompactViewport) {
      const next = !compactRightOpen;
      closeTransientOverlayPanels();
      setCompactRightOpen(next);
    } else {
      setDesktopRightOpen((v) => !v);
    }
  }, [isCompactViewport, compactRightOpen, closeTransientOverlayPanels]);

  const handleToggleGradientPanel = useCallback(() => {
    if (isCompactViewport) {
      const next = !compactGradientOpen;
      closeTransientOverlayPanels();
      setCompactGradientOpen(next);
    } else {
      const next = !desktopGradientOpen;
      closeTransientOverlayPanels();
      setDesktopGradientOpen(next);
    }
  }, [isCompactViewport, compactGradientOpen, desktopGradientOpen, closeTransientOverlayPanels]);

  const handleToggleGlobalStylesPanel = useCallback(() => {
    if (isCompactViewport) {
      const next = !compactGlobalStylesOpen;
      closeTransientOverlayPanels();
      setCompactGlobalStylesOpen(next);
    } else {
      const next = !desktopGlobalStylesOpen;
      closeTransientOverlayPanels();
      setDesktopGlobalStylesOpen(next);
    }
  }, [isCompactViewport, compactGlobalStylesOpen, desktopGlobalStylesOpen, closeTransientOverlayPanels]);

  const handleToggleSmartAligner = useCallback(() => {
    if (isCompactViewport) {
      const next = !compactSmartAlignerOpen;
      closeTransientOverlayPanels();
      setCompactSmartAlignerOpen(next);
    } else {
      const next = !desktopSmartAlignerOpen;
      closeTransientOverlayPanels();
      setDesktopSmartAlignerOpen(next);
    }
  }, [isCompactViewport, compactSmartAlignerOpen, desktopSmartAlignerOpen, closeTransientOverlayPanels]);

  const handleToggleBrandRemixer = useCallback(() => {
    const next = !isBrandRemixerOpen;
    closeTransientOverlayPanels();
    setIsBrandRemixerOpen(next);
  }, [isBrandRemixerOpen, closeTransientOverlayPanels]);

  const handleToggleHistoryPanel = useCallback(() => {
    const next = !isHistoryPanelOpen;
    closeTransientOverlayPanels();
    setIsHistoryPanelOpen(next);
  }, [isHistoryPanelOpen, closeTransientOverlayPanels]);

  const handleToggleQaPanel = useCallback(() => {
    const next = !isQaPanelOpen;
    closeTransientOverlayPanels();
    setIsQaPanelOpen(next);
  }, [isQaPanelOpen, closeTransientOverlayPanels]);

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
      return normalizeLogicRules(JSON.parse(raw));
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
      .filter(([p, c]) => /\.(tsx|jsx|ts|js|html)$/i.test(p) && !isVirtualMediaDataUrlFile(p, c))
      .map(([, c]) => c)
      .join('\n');
    return { cssText, sourceText };
  }, [project.files, project.globalCssPaths]);

  const animatedSummary = useMemo(
    () => countAnimatedElementsInFiles(project.files),
    [project.files]
  );

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
    (nextFiles: Record<string, string>, touchedFile?: string, actionLabel?: string) => {
      setHistoryPast((prev) => [...prev.slice(-49), project.files]);
      setHistoryFuture([]);
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const fallbackLabel = touchedFile
        ? `Edited ${touchedFile.split('/').pop()}`
        : 'Updated Project';
      const entry: HistoryTimelineEntry = {
        id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: actionLabel || fallbackLabel,
        timestamp,
        files: nextFiles,
      };
      setHistoryTimeline((prev) => {
        const base = prev.slice(0, historyIndex + 1);
        const next = [...base, entry].slice(-50);
        setHistoryIndex(next.length - 1);
        return next;
      });
      const scanned = scanProjectStructure(nextFiles);
      setProject((prev) => ({
        ...prev,
        files: nextFiles,
        pages: scanned.pages,
        framework: scanned.framework,
        globalCssPaths: scanned.globalCssPaths,
      }));
      if (touchedFile) {
        setCodeDrawerFile(touchedFile);
      }
    },
    [project.files, historyIndex]
  );

  const handleInstallPageDependency = useCallback((command: string): { ok: boolean; error?: string } => {
    const parsed = parseNpmInstallCommand(command);
    if (!parsed) return { ok: false, error: 'Use a single package command, e.g. npm install package-name or npm i package-name.' };
    if (packageDependencies[parsed.packageName]) return { ok: true };
    const nextFiles = addPackageDependencyToFiles(project.files, parsed.packageName, parsed.version);
    commitFilesMutation(nextFiles, activePage.filePath);
    preloadExternalLibrary(parsed.packageName);
    return { ok: true };
  }, [packageDependencies, project.files, commitFilesMutation, activePage.filePath, preloadExternalLibrary]);

  const logicTargets = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    const visit = (nodes: LayerTreeNode[]) => nodes.forEach((node) => {
      items.push({ id: node.studioId, label: node.label || node.tagName });
      visit(node.children || []);
    });
    visit(layerTree);
    return items;
  }, [layerTree]);

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
    setHistoryIndex((idx) => Math.max(0, idx - 1));
    const scanned = scanProjectStructure(previous);
    setProject((prev) => ({
      ...prev,
      files: previous,
      pages: scanned.pages,
      framework: scanned.framework,
      globalCssPaths: scanned.globalCssPaths,
    }));
  }, [historyPast, project.files]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev.slice(-49), project.files]);
    setHistoryIndex((idx) => Math.min(Math.max(0, historyTimeline.length - 1), idx + 1));
    const scanned = scanProjectStructure(next);
    setProject((prev) => ({
      ...prev,
      files: next,
      pages: scanned.pages,
      framework: scanned.framework,
      globalCssPaths: scanned.globalCssPaths,
    }));
  }, [historyFuture, project.files, historyTimeline.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setContextMenuState(null);
        setIsCommandPaletteOpen((open) => !open);
        return;
      }
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

  const showToastFeedback = useCallback((message: string) => {
    setActionToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setActionToast(null);
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (qaScanTimeoutRef.current) window.clearTimeout(qaScanTimeoutRef.current);
    };
  }, []);

  const handlePreviewStyles = useCallback(
    (studioId: string, styles: Record<string, string | null>) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'studio:preview-style', studioId, styles },
        '*'
      );
    },
    []
  );

  const handleCommitBatchPatches = useCallback(
    (filePath: string, updates: Array<{ elementIndex: number; patch: ElementSourcePatch }>) => {
      const currentCode = project.files[filePath];
      if (!currentCode || updates.length === 0) return;
      const isHtml = /\.html?$/i.test(filePath);
      const effectiveBp = resolveEffectiveBreakpoint(alignBreakpointScope, viewport);
      const scopedUpdates = updates.map((item) => ({
        ...item,
        patch: scopeElementPatchToBreakpoint({
          code: currentCode,
          elementIndex: item.elementIndex,
          isHtml,
          patch: item.patch,
          breakpoint: effectiveBp,
        }),
      }));
      const updatedCode = applyBatchElementPatches(currentCode, isHtml, scopedUpdates);
      if (updatedCode !== currentCode) commitFilesMutation({ ...project.files, [filePath]: updatedCode }, filePath);
    },
    [project.files, alignBreakpointScope, viewport, commitFilesMutation]
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

  const handleApplyFont = useCallback((family: string) => {
    if (!selected) return;
    const cssPath = project.globalCssPaths[0] || Object.keys(project.files).find((path) => /\.css$/i.test(path));
    if (!cssPath) return;
    const css = project.files[cssPath] || '';
    const safeFamily = family.trim().replace(/[<>;{}]/g, '');
    const googleFamily = encodeURIComponent(safeFamily).replace(/%20/g, '+');
    const importRule = `@import url('https://fonts.googleapis.com/css2?family=${googleFamily}:wght@400;500;600;700;800&display=swap');`;
    const nextCss = css.includes(importRule) ? css : `${importRule}\n${css}`;
    const source = project.files[selected.filePath];
    if (!source) return;
    const isHtml = /\.html?$/i.test(selected.filePath);
    const updatedSource = applyElementPatchToSource(source, selected.elementIndex, isHtml, {
      styles: { fontFamily: `'${safeFamily}', sans-serif` },
    });
    commitFilesMutation({ ...project.files, [cssPath]: nextCss, [selected.filePath]: updatedSource }, selected.filePath);
    setIsTypographyEffectsOpen(false);
  }, [selected, project.files, project.globalCssPaths, commitFilesMutation]);

  const handleApplyTextMotion = useCallback((preset: TextMotionPreset, duration: number, delay: number) => {
    if (!selected) return;
    const cssPath = project.globalCssPaths[0] || Object.keys(project.files).find((path) => /\.css$/i.test(path));
    if (!cssPath) return;
    const css = project.files[cssPath] || '';
    const keyframes: Record<Exclude<TextMotionPreset, 'none'>, string> = {
      'fade-up': '@keyframes webd-text-fade-up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}',
      'fade-in': '@keyframes webd-text-fade-in{from{opacity:0}to{opacity:1}}',
      'slide-left': '@keyframes webd-text-slide-left{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}',
      'slide-right': '@keyframes webd-text-slide-right{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}',
      pop: '@keyframes webd-text-pop{0%{opacity:0;transform:scale(.82)}75%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}',
      float: '@keyframes webd-text-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
      glow: '@keyframes webd-text-glow{0%,100%{filter:drop-shadow(0 0 0 transparent)}50%{filter:drop-shadow(0 0 9px currentColor)}}',
      wave: '@keyframes webd-text-wave{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-3px) rotate(-1deg)}75%{transform:translateY(3px) rotate(1deg)}}',
    };
    const updatedCss = preset === 'none' ? css : Object.values(keyframes).reduce((value, rule) => value.includes(rule) ? value : `${value}\n${rule}`, css);
    const source = project.files[selected.filePath];
    if (!source) return;
    const isHtml = /\.html?$/i.test(selected.filePath);
    const animation = preset === 'none' ? null : `webd-text-${preset} ${duration}s ease ${delay}s ${preset === 'float' || preset === 'glow' || preset === 'wave' ? 'infinite' : 'both'}`;
    const updatedSource = applyElementPatchToSource(source, selected.elementIndex, isHtml, {
      styles: { animation, willChange: preset === 'none' ? null : 'transform, opacity' },
    });
    commitFilesMutation({ ...project.files, [cssPath]: updatedCss, [selected.filePath]: updatedSource }, selected.filePath);
    setIsTypographyEffectsOpen(false);
  }, [selected, project.files, project.globalCssPaths, commitFilesMutation]);

  const handleReplayAnimations = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:replay-animations' },
      '*'
    );
  }, []);

    const handleApplyMotionPreset = useCallback((preset: MotionPreset) => {
    try {
      const nextFiles = applyMotionPresetToFiles(project.files, preset);
      commitFilesMutation({ ...nextFiles, [MOTION_PRESET_FILE]: JSON.stringify(preset, null, 2) }, Object.keys(nextFiles).find((path) => /\.css$/i.test(path)), 'Applied Motion Preset');
      setMotionPreset(preset);
      window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: 'studio:replay-animations' }, '*'), 140);
      showToastFeedback(`Applied "${preset.name}" to project`);
    } catch (error) {
      showToastFeedback(error instanceof Error ? error.message : 'Could not apply motion preset');
    }
  }, [project.files, commitFilesMutation, showToastFeedback]);

const handleApplyElementAnimation = useCallback(
    (config: ElementAnimationConfig) => {
      if (!selected) return;
      const source = project.files[selected.filePath];
      if (!source) return;
      const isHtml = /\.html?$/i.test(selected.filePath);
      const { className, styles, hasAnimation } = buildAnimationClassesAndStyles(
        selected.className,
        config
      );
      const updatedSource = applyElementPatchToSource(
        source,
        selected.elementIndex,
        isHtml,
        { className, styles }
      );
      const nextFiles: Record<string, string> = {
        ...project.files,
        [selected.filePath]: updatedSource,
      };
      if (hasAnimation || config.customCss) {
        const cssPath =
          project.globalCssPaths.find((p) => Boolean(project.files[p])) ||
          Object.keys(project.files).find((p) => /\.css$/i.test(p));
        if (cssPath) {
          const baseCss = mergeMotionCssIntoGlobalCss(project.files[cssPath] || '');
          const customStart = '/* WEBD_CUSTOM_KEYFRAMES_START */';
          const customEnd = '/* WEBD_CUSTOM_KEYFRAMES_END */';
          const oldStart = baseCss.indexOf(customStart);
          const oldEnd = baseCss.indexOf(customEnd);
          const withoutOld = oldStart >= 0 && oldEnd > oldStart
            ? baseCss.slice(0, oldStart) + baseCss.slice(oldEnd + customEnd.length)
            : baseCss;
          const customBlock = config.customCss ? `\n\n${customStart}\n${config.customCss}\n${customEnd}\n` : ''; 
          nextFiles[cssPath] = withoutOld + customBlock;
        }
      }
      setPendingSelectStudioId(selected.studioId);
      commitFilesMutation(nextFiles, selected.filePath);
      if (hasAnimation || config.customCss) {
        window.setTimeout(() => {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'studio:replay-animations' },
            '*'
          );
        }, 120);
      }
    },
    [selected, project.files, project.globalCssPaths, commitFilesMutation]
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

  const handleInsertLayoutBlock = useCallback((snippet: string, targetStudioId?: string | null) => {
    const parsedTarget = typeof targetStudioId === 'string' && targetStudioId.includes('::')
      ? (() => {
          const splitAt = targetStudioId.lastIndexOf('::');
          const index = Number(targetStudioId.slice(splitAt + 2));
          return Number.isFinite(index) ? { filePath: targetStudioId.slice(0, splitAt), elementIndex: index } : null;
        })()
      : null;
    const filePath = parsedTarget?.filePath || selected?.filePath || canvasTargetPage.filePath;
    const targetCode = project.files[filePath];
    if (!targetCode) return;
    const targetElementIndex = parsedTarget?.elementIndex ??
      (selected?.filePath === filePath ? selected.elementIndex : 0);
    const isHtml = /\.html?$/i.test(filePath);
    const compatibleSnippet = isHtml ? snippet.replace(/\bclassName=/g, 'class=') : snippet;
    const updated = insertJsxSnippetIntoSource({
      targetCode,
      targetElementIndex,
      position: 'after',
      jsxSnippet: compatibleSnippet,
    });
    if (!updated || updated === targetCode) return;
    setSelected(null);
    setMultiSelected([]);
    commitFilesMutation({ ...project.files, [filePath]: updated }, filePath);
  }, [project.files, selected, canvasTargetPage.filePath, commitFilesMutation]);

  useEffect(() => {
    const handleLayoutDrop = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data || {};
      if (message.type !== 'studio:layout-drop' || typeof message.snippet !== 'string') return;
      handleInsertLayoutBlock(message.snippet, typeof message.studioId === 'string' ? message.studioId : null);
      setIsLayoutBuilderOpen(false);
    };
    window.addEventListener('message', handleLayoutDrop);
    return () => window.removeEventListener('message', handleLayoutDrop);
  }, [handleInsertLayoutBlock]);

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

  const handleCreatePage = useCallback(
    (title: string, slug: string, template: PageTemplatePreset, customTemplateCode?: string, customTemplateCss?: string): { ok: boolean; error?: string } => {
      try {
        const generated = createPageFile({
          framework: project.framework,
          title,
          slug,
          template,
          customTemplateCode,
          customTemplateCss,
          files: project.files,
        });
        if (project.pages.some((page) => page.route === generated.route)) {
          return { ok: false, error: `The URL ${generated.route} already exists. Choose a different URL path.` };
        }
        const nextFiles = { ...project.files, [generated.filePath]: generated.code };
        if (generated.cssFilePath && generated.cssCode !== undefined) nextFiles[generated.cssFilePath] = generated.cssCode;
        commitFilesMutation(nextFiles, generated.filePath);
        setIsolatedComponentPath(null);
        setActiveRoute(generated.route);
        setSelected(null);
        setMultiSelected([]);
        setLockedIds([]);
        setHiddenIds([]);
        setPseudoState('default');
        setInteractionMode('design');
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Could not generate this page. Check the pasted code and try again.',
        };
      }
    },
    [project.framework, project.files, project.pages, commitFilesMutation]
  );

  const handleDeletePage = useCallback((route: string): boolean => {
    const page = project.pages.find((item) => item.route === route);
    if (!page || page.route === '/' || project.pages.length <= 1) return false;

    const nextFiles = { ...project.files };
    const pageSource = nextFiles[page.filePath] || '';
    delete nextFiles[page.filePath];

    // Remove a page-specific stylesheet only when this page explicitly references it.
    const cssPath = page.filePath.replace(/\.(tsx|ts|jsx|js|html?)$/i, '.css');
    const cssName = cssPath.split('/').pop() || '';
    if (cssName && nextFiles[cssPath] && pageSource.includes(cssName)) {
      delete nextFiles[cssPath];
    }

    const remainingPages = project.pages.filter((item) => item.route !== route);
    const fallbackPage = remainingPages.find((item) => item.route === '/') || remainingPages[0];
    if (!fallbackPage) return false;

    commitFilesMutation(nextFiles);
    if (activeRoute === route) {
      setActiveRoute(fallbackPage.route);
      setCodeDrawerFile(fallbackPage.filePath);
      setSelected(null);
      setMultiSelected([]);
      setLockedIds([]);
      setHiddenIds([]);
      setPseudoState('default');
      setIsolatedComponentPath(null);
    }
    if (lastPageTarget?.route === route) setLastPageTarget(null);
    return true;
  }, [project.pages, project.files, activeRoute, commitFilesMutation, lastPageTarget]);

  const handleCreateSiteKit = useCallback((): boolean => {
    try {
      const result = createSharedSiteKit({
        framework: project.framework,
        files: project.files,
        pages: project.pages,
      });
      commitFilesMutation(result.files, result.componentPaths[0]);
      setIsolatedComponentPath(null);
      setSelected(null);
      setMultiSelected([]);
      setCodeDrawerFile(result.componentPaths[0]);
      return true;
    } catch (error) {
      console.error('Unable to generate shared site kit:', error);
      return false;
    }
  }, [project.framework, project.files, project.pages, commitFilesMutation]);

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

  const handleRemoveComponent = useCallback((componentFilePath: string) => {
    const component = projectComponents.find((item) => item.filePath === componentFilePath);
    if (!component || !project.files[componentFilePath]) return;

    const nextFiles = { ...project.files };
    const componentNames = projectComponents.map((item) => item.name);
    for (const [filePath, source] of Object.entries(nextFiles)) {
      if (filePath === componentFilePath || !/\\.(tsx|jsx)$/i.test(filePath)) continue;
      const matching = scanElements(source, false)
        .filter((element) => element.tagName === component.name)
        .sort((a, b) => b.openStart - a.openStart);
      let updated = source;
      for (const element of matching) {
        updated = updated.slice(0, element.openStart) + updated.slice(element.closeEnd);
      }

      // Remove imports that point at the deleted component file.
      const importPattern = /^\s*import\s+[^;\n]+?\s+from\s+(['"])([^'"]+)\1\s*;?\s*$/gm;
      updated = updated.replace(importPattern, (statement, _quote: string, specifier: string) => {
        const normalized = specifier.replace(/\.(tsx|jsx)$/i, '').replace(/\/$/, '');
        const baseName = componentFilePath.replace(/\.(tsx|jsx)$/i, '');
        const relativeTarget = filePath.split('/').slice(0, -1).reduce((path, part) => {
          if (part === '..') return path.split('/').slice(0, -1).join('/');
          if (part === '.') return path;
          return path ? path + '/' + part : part;
        }, '');
        const resolved = normalized.startsWith('@/') ? normalized.slice(2) : normalized.startsWith('.') ? (relativeTarget ? relativeTarget + '/' : '') + normalized : '';
        const cleanResolved = resolved.replace(/\/\.\//g, '').replace(/\/\//g, '/');
        const cleanBase = baseName.replace(/^src\//, '');
        return cleanResolved === cleanBase || cleanResolved === baseName ? '' : statement;
      });
      nextFiles[filePath] = updated;
    }

    delete nextFiles[componentFilePath];
    if (isolatedComponentPath === componentFilePath) {
      setIsolatedComponentPath(null);
      setSelected(null);
      setMultiSelected([]);
    }
    commitFilesMutation(nextFiles, activePage.filePath);
  }, [project.files, projectComponents, isolatedComponentPath, commitFilesMutation, activePage.filePath]);

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
      componentLibraryName?: string;
      componentExportName?: string;
      componentSource?: string;
      componentCss?: string;
      dependencyPackages?: Array<{ packageName: string; version: string }>;
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
        componentLibraryName,
        componentExportName,
        componentSource,
        componentCss,
        dependencyPackages = [],
      } = params;

      if (componentSource && componentLibraryName) {
        if (!/^[A-Z][A-Za-z0-9]*$/.test(componentLibraryName)) {
          return { ok: false, error: 'Invalid component name. Use PascalCase.' };
        }
        if (!/(?:\bexport\s+default\b|\bexport\s*\{[\s\S]*?\})/.test(componentSource) || !/<[A-Za-z][^>]*>/.test(componentSource)) {
          return { ok: false, error: 'Component source must include an exported React component.' };
        }
        let nextFiles = { ...project.files };
        const detectedDependencies = new Map<string, string>();
        for (const dependency of dependencyPackages) {
          if (!isValidPackageName(dependency.packageName)) {
            return { ok: false, error: `Invalid npm dependency: ${dependency.packageName}` };
          }
          detectedDependencies.set(dependency.packageName, dependency.version);
        }
        const importPattern = /(?:from\s*|import\s*)['"]([^'"]+)['"]/g;
        let importMatch: RegExpExecArray | null;
        while ((importMatch = importPattern.exec(componentSource)) !== null) {
          const specifier = importMatch[1];
          if (specifier.startsWith('.') || specifier.startsWith('@/') || specifier === 'react' || specifier === 'react-dom') continue;
          const segments = specifier.split('/');
          const packageName = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
          if (isValidPackageName(packageName) && !detectedDependencies.has(packageName)) {
            detectedDependencies.set(packageName, 'latest');
          }
        }
        for (const [packageName, packageVersion] of detectedDependencies) {
          nextFiles = addPackageDependencyToFiles(nextFiles, packageName, packageVersion);
        }
        const componentFolder = Object.keys(nextFiles).some((p) => p.startsWith('components/'))
          ? 'components'
          : Object.keys(nextFiles).some((p) => p.startsWith('src/components/'))
          ? 'src/components'
          : 'components';
        let componentName = componentLibraryName;
        let componentPath = componentFolder + '/' + componentName + '.tsx';
        let suffix = 2;
        while (nextFiles[componentPath]) {
          componentName = componentLibraryName + suffix++;
          componentPath = componentFolder + '/' + componentName + '.tsx';
        }
        let sourceToSave = componentSource;
        if (componentCss?.trim()) {
          const cssImportPattern = /import\s+['"]((?:\.\.?\/)[^'"]+\.css)['"];?/g;
          const cssImports = [...componentSource.matchAll(cssImportPattern)];
          if (cssImports.length === 0) {
            const cssImport = "import './" + componentName + ".css';";
            const clientDirective = sourceToSave.match(/^(['"]use client['"];?\s*)/);
            sourceToSave = clientDirective
              ? sourceToSave.replace(clientDirective[0], clientDirective[0] + cssImport + '\n')
              : cssImport + '\n' + sourceToSave;
            nextFiles[componentFolder + '/' + componentName + '.css'] = componentCss.trim() + '\n';
          } else {
            for (const cssMatch of cssImports) {
              const relativePath = cssMatch[1].replace(/^\.\//, '');
              nextFiles[componentFolder + '/' + relativePath] = componentCss.trim() + '\n';
            }
          }
        }
        nextFiles[componentPath] = sourceToSave.endsWith('\n') ? sourceToSave : sourceToSave + '\n';
        setSelected(null);
        commitFilesMutation(nextFiles, componentPath);
        for (const packageName of detectedDependencies.keys()) preloadExternalLibrary(packageName);
        return { ok: true };
      }

      if (componentLibraryName && componentExportName) {
        if (!/^[A-Z][A-Za-z0-9]*$/.test(componentLibraryName)) {
          return { ok: false, error: 'Invalid component name.' };
        }
        const exportIsDefault = componentExportName === 'default';
        if (!exportIsDefault && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(componentExportName)) {
          return { ok: false, error: 'Invalid package export name.' };
        }
        const primitiveName = exportIsDefault
          ? identifiers[0]
          : `Npm${componentLibraryName}Primitive`;
        const componentFolder = Object.keys(project.files).some((p) => p.startsWith('components/'))
          ? 'components'
          : Object.keys(project.files).some((p) => p.startsWith('src/components/'))
          ? 'src/components'
          : 'components';
        let componentName = componentLibraryName;
        let componentPath = `${componentFolder}/${componentName}.tsx`;
        let suffix = 2;
        while (project.files[componentPath]) {
          componentName = `${componentLibraryName}${suffix++}`;
          componentPath = `${componentFolder}/${componentName}.tsx`;
        }
        const packageImport = exportIsDefault
          ? `import ${primitiveName} from '${packageName}';`
          : `import { ${componentExportName} as ${primitiveName} } from '${packageName}';`;
        const componentSource = `import type { ComponentProps } from 'react';
${packageImport}

export default function ${componentName}(props: ComponentProps<typeof ${primitiveName}>) {
  return <${primitiveName} {...props} />;
}
`;
        const nextFiles = {
          ...addPackageDependencyToFiles(project.files, packageName, version),
          [componentPath]: componentSource,
        };
        setSelected(null);
        commitFilesMutation(nextFiles, componentPath);
        preloadExternalLibrary(packageName);
        return { ok: true };
      }

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


  const handleInstallTypographyNpmPackage = useCallback((params: {
    command: string;
    kind: 'font' | 'motion';
    fontFamily?: string;
    cssImport?: string;
    componentName?: string;
    componentExport?: string;
  }) => {
    const parsed = parseNpmInstallCommand(params.command);
    if (!parsed) return { ok: false, error: 'Enter one valid npm install command.' };
    if (params.kind === 'font') {
      const family = (params.fontFamily || '').trim().replace(/[<>;{}"']/g, '');
      const cssImport = (params.cssImport || '').trim();
      if (!family) return { ok: false, error: 'Enter the font family name.' };
      if (!cssImport || !cssImport.startsWith(parsed.packageName) || /["'\\\\;]/.test(cssImport) || cssImport.includes('..')) {
        return { ok: false, error: 'CSS entry must be a valid path inside the installed font package, e.g. @fontsource/roboto/400.css.' };
      }
      const cssPath = project.globalCssPaths[0] || Object.keys(project.files).find((path) => /\\.css$/i.test(path));
      if (!cssPath) return { ok: false, error: 'This project has no CSS file to register the font. Add a global CSS file first.' };
      const currentCss = project.files[cssPath] || '';
      const importRule = `@import '${cssImport}';`;
      const nextCss = currentCss.includes(importRule) ? currentCss : `${importRule}\n${currentCss}`;
      let nextFiles = addPackageDependencyToFiles(project.files, parsed.packageName, parsed.version);
      nextFiles[cssPath] = nextCss;
      if (selected) {
        const source = nextFiles[selected.filePath];
        if (source) {
          const isHtml = /\\.html?$/i.test(selected.filePath);
          nextFiles[selected.filePath] = applyElementPatchToSource(source, selected.elementIndex, isHtml, {
            styles: { fontFamily: `'${family}', sans-serif` },
          });
        }
      }
      commitFilesMutation(nextFiles, selected?.filePath || cssPath);
      return { ok: true };
    }

    const componentName = (params.componentName || '').trim();
    const componentExport = (params.componentExport || 'default').trim() || 'default';
    if (componentName) {
      return handleImportReactLibrary({
        packageName: parsed.packageName,
        version: parsed.version,
        importMode: componentExport === 'default' ? 'default' : 'named',
        identifiers: [componentExport === 'default' ? componentName + 'Primitive' : componentExport],
        targetFilePath: selected?.filePath || activePage.filePath,
        componentLibraryName: componentName,
        componentExportName: componentExport,
      });
    }

    const nextFiles = addPackageDependencyToFiles(project.files, parsed.packageName, parsed.version);
    commitFilesMutation(nextFiles, 'package.json');
    preloadExternalLibrary(parsed.packageName);
    return { ok: true };
  }, [project.files, project.globalCssPaths, selected, activePage.filePath, commitFilesMutation, preloadExternalLibrary, handleImportReactLibrary]);

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
      setHistoryTimeline([
        {
          id: `cp-load-${Date.now()}`,
          label: `Loaded ${nextProj.name}`,
          timestamp: 'Start',
          files: nextProj.files,
        },
      ]);
      setHistoryIndex(0);
      setBrandRemixConfig(DEFAULT_BRAND_REMIX_CONFIG);
      setIsCompareOpen(false);
      setQaIssues([]);
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

  const handleInsertMediaAsset = useCallback(
    (asset: { name: string; type: string; dataUrl: string }, mode: 'normal' | 'cutout' | 'background' = 'normal') => {
      if (!selected) return;
      const registered = registerMediaAssetInProjectFiles(
        project.files,
        project.framework,
        asset
      );
      const cleanSrc = registered.publicUrl;
      const mediaKind = asset.type.startsWith('video/')
        ? 'video'
        : asset.type.startsWith('audio/')
        ? 'audio'
        : 'image';
      const selectedTag = selected.tagName.toLowerCase();
      const matchingTag = mediaKind === 'image' ? selectedTag === 'img' : selectedTag === mediaKind;
      const currentSource = registered.nextFiles[selected.filePath];
      if (!currentSource) return;
      const isHtml = /\.html?$/i.test(selected.filePath);

      if (mode === 'background' && (mediaKind === 'image' || mediaKind === 'video')) {
        const backgroundStyles = { position: 'relative', isolation: 'isolate', overflow: 'hidden', minHeight: '320px' };
        const parentPatched = applyElementPatchToSource(currentSource, selected.elementIndex, isHtml, { styles: backgroundStyles });
        if (mediaKind === 'image') {
          const updated = applyElementPatchToSource(parentPatched, selected.elementIndex, isHtml, {
            styles: { backgroundImage: `url("${cleanSrc}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' },
          });
          commitFilesMutation({ ...registered.nextFiles, [selected.filePath]: updated }, selected.filePath);
          return;
        }
        const videoSnippet = isHtml
          ? `<video src="${cleanSrc}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;"></video>`
          : `<video src="${cleanSrc}" autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' }} />`;
        const updated = insertJsxSnippetIntoSource({ targetCode: parentPatched, targetElementIndex: selected.elementIndex, position: 'inside-start', jsxSnippet: videoSnippet });
        if (!updated || updated === parentPatched) return;
        commitFilesMutation({ ...registered.nextFiles, [selected.filePath]: updated }, selected.filePath);
        return;
      }

      if (matchingTag || (mediaKind === 'image' && selected.src)) {
        const updatedCode = applyElementPatchToSource(
          currentSource,
          selected.elementIndex,
          isHtml,
          { src: cleanSrc }
        );
        commitFilesMutation(
          { ...registered.nextFiles, [selected.filePath]: updatedCode },
          selected.filePath
        );
        return;
      }

      const safeAlt = asset.name.replace(/["<>]/g, '').replace(/\.[^.]+$/, '');
      let workingSource = currentSource;
      let targetIndex = selected.elementIndex;

      if (mode === 'cutout' && mediaKind === 'image') {
        const sourceElements = scanElements(workingSource, isHtml);
        const parentIndex = sourceElements[selected.elementIndex]?.parentIndex ?? -1;
        if (parentIndex >= 0) {
          workingSource = applyElementPatchToSource(workingSource, parentIndex, isHtml, {
            styles: {
              position: 'relative',
              isolation: 'isolate',
              minHeight: 'clamp(420px, 58vw, 640px)',
              overflow: 'visible',
            },
          });
        }
        const snippet = isHtml
          ? `<img src="${cleanSrc}" alt="${safeAlt}" style="position:absolute;left:4%;bottom:0;width:min(44%,520px);height:92%;max-width:none;object-fit:contain;object-position:center bottom;z-index:2;filter:drop-shadow(0 22px 34px rgba(0,0,0,.38));background:transparent;border:0;border-radius:0;" />`
          : `<img src="${cleanSrc}" alt="${safeAlt}" style={{ position: 'absolute', left: '4%', bottom: 0, width: 'min(44%, 520px)', height: '92%', maxWidth: 'none', objectFit: 'contain', objectPosition: 'center bottom', zIndex: 2, filter: 'drop-shadow(0 22px 34px rgba(0,0,0,.38))', background: 'transparent', border: 0, borderRadius: 0 }} />`;
        const updated = insertJsxSnippetIntoSource({
          targetCode: workingSource,
          targetElementIndex: targetIndex,
          position: 'after',
          jsxSnippet: isHtml ? snippet.replace(/\bclassName=/g, 'class=') : snippet,
        });
        if (!updated || updated === workingSource) return;
        setSelected(null);
        setMultiSelected([]);
        commitFilesMutation(
          { ...registered.nextFiles, [selected.filePath]: updated },
          selected.filePath
        );
        return;
      }

      const snippet =
        mediaKind === 'video'
          ? isHtml
            ? `<video src="${cleanSrc}" controls playsinline style="max-width:100%;height:auto;"></video>`
            : `<video src="${cleanSrc}" controls playsInline style={{ maxWidth: '100%', height: 'auto' }} />`
          : mediaKind === 'audio'
          ? isHtml
            ? `<audio src="${cleanSrc}" controls style="max-width:100%;"></audio>`
            : `<audio src="${cleanSrc}" controls style={{ maxWidth: '100%' }} />`
          : isHtml
          ? `<img src="${cleanSrc}" alt="${safeAlt}" style="max-width:100%;height:auto;object-fit:contain;" />`
          : `<img src="${cleanSrc}" alt="${safeAlt}" style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} />`;

      const updated = insertJsxSnippetIntoSource({
        targetCode: workingSource,
        targetElementIndex: targetIndex,
        position: 'after',
        jsxSnippet: isHtml ? snippet.replace(/\bclassName=/g, 'class=') : snippet,
      });
      if (!updated || updated === workingSource) return;
      setSelected(null);
      setMultiSelected([]);
      commitFilesMutation(
        { ...registered.nextFiles, [selected.filePath]: updated },
        selected.filePath
      );
    },
    [selected, project.files, project.framework, commitFilesMutation]
  );

  const handleOpenExportModal = useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

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
    setHistoryTimeline([
      {
        id: `cp-draft-${Date.now()}`,
        label: `Restored Draft: ${draft.title}`,
        timestamp: 'Restored',
        files: restored.files,
      },
    ]);
    setHistoryIndex(0);
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

  const handleCopyElementStyles = useCallback(
    (target: StudioElementSnapshot) => {
      const payload = buildCopiedStylePayload(target);
      setCopiedStyle(payload);
      showToastFeedback(`Copied styles from <${target.tagName}>`);
    },
    [showToastFeedback]
  );

  const handlePasteElementStyles = useCallback(
    (target: StudioElementSnapshot) => {
      if (!copiedStyle) return;
      const patch = buildPasteStylePatch(copiedStyle, target.inlineStyles);
      if (!patch.className && !patch.styles) {
        showToastFeedback('No reusable styles to paste');
        return;
      }
      handleCommitPatch(target.filePath, target.elementIndex, patch);
      showToastFeedback(`Pasted styles onto <${target.tagName}>`);
    },
    [copiedStyle, handleCommitPatch, showToastFeedback]
  );

  const handleWrapTargetElement = useCallback(
    (target: StudioElementSnapshot, layout: WrapContainerLayout) => {
      const canUseMulti =
        multiSelected.length >= 2 &&
        multiSelected.some((m) => m.studioId === target.studioId) &&
        Boolean(multiSelected[0].parentStudioId) &&
        multiSelected.every(
          (m) =>
            m.filePath === multiSelected[0].filePath &&
            m.parentStudioId === multiSelected[0].parentStudioId
        );

      if (canUseMulti) {
        handleWrapMultiSelected(layout);
        showToastFeedback(`Wrapped ${multiSelected.length} elements in ${layout}`);
        return;
      }

      const code = project.files[target.filePath];
      if (!code) return;
      const isHtml = /\.html?$/i.test(target.filePath);
      const updated = wrapElementsInContainer(code, isHtml, [target.elementIndex], layout);
      if (updated === code) {
        showToastFeedback('Select an inner element to wrap in a container');
        return;
      }
      setSelected(null);
      setMultiSelected([]);
      commitFilesMutation({ ...project.files, [target.filePath]: updated }, target.filePath);
      showToastFeedback(`Wrapped <${target.tagName}> in ${layout}`);
    },
    [multiSelected, handleWrapMultiSelected, project.files, commitFilesMutation, showToastFeedback]
  );

  const handleOpenLogicForTarget = useCallback(
    (target?: StudioElementSnapshot | null) => {
      if (target) setSelected(target);
      closeTransientOverlayPanels();
      setIsLogicPanelOpen(true);
    },
    [closeTransientOverlayPanels]
  );

  const handleOpenMotionForTarget = useCallback(
    (target?: StudioElementSnapshot | null) => {
      if (target) setSelected(target);
      closeTransientOverlayPanels();
      setIsMotionPanelOpen(true);
    },
    [closeTransientOverlayPanels]
  );

  const handleContextMenuElement = useCallback(
    (payload: {
      element: StudioElementSnapshot;
      x: number;
      y: number;
      trigger: 'contextmenu' | 'longpress' | 'button';
    }) => {
      setContextMenuState({
        target: payload.element,
        x: payload.x,
        y: payload.y,
        trigger: payload.trigger,
      });
    },
    []
  );

  // ---- 1-Tap Brand Remixer ----
  const handleApplyBrandRemix = useCallback(
    (nextConfig: BrandRemixConfig, actionLabel: string) => {
      const cssPath =
        project.globalCssPaths.find((p) => Boolean(project.files[p])) ||
        Object.keys(project.files).find((p) => /\.css$/i.test(p)) ||
        (project.framework === 'nextjs-app'
          ? 'app/globals.css'
          : project.framework === 'react-vite'
          ? 'src/index.css'
          : 'styles.css');
      const currentCss = project.files[cssPath] || '';
      const nextCss = applyBrandRemixToGlobalCss(currentCss, nextConfig);
      setBrandRemixConfig(nextConfig);
      commitFilesMutation({ ...project.files, [cssPath]: nextCss }, cssPath, actionLabel);
      showToastFeedback(actionLabel);
    },
    [project.globalCssPaths, project.files, project.framework, commitFilesMutation, showToastFeedback]
  );

  const handleResetBrandRemix = useCallback(() => {
    const cssPath =
      project.globalCssPaths.find((p) => Boolean(project.files[p])) ||
      Object.keys(project.files).find((p) => /\.css$/i.test(p));
    setBrandRemixConfig(DEFAULT_BRAND_REMIX_CONFIG);
    if (!cssPath || !project.files[cssPath]) {
      showToastFeedback('Reset brand theme defaults');
      return;
    }
    const stripped = stripBrandRemixFromGlobalCss(project.files[cssPath]);
    commitFilesMutation(
      { ...project.files, [cssPath]: stripped },
      cssPath,
      'Reset Brand Remix'
    );
    showToastFeedback('Cleared Brand Remix overrides');
  }, [project.globalCssPaths, project.files, commitFilesMutation, showToastFeedback]);

  // ---- Visual History Timeline & Before/After Diff ----
  const handleJumpToHistoryIndex = useCallback(
    (targetIdx: number) => {
      const clamped = Math.max(0, Math.min(historyTimeline.length - 1, targetIdx));
      const targetEntry = historyTimeline[clamped];
      if (!targetEntry) return;
      const pastEntries = historyTimeline.slice(0, clamped).map((e) => e.files);
      const futureEntries = historyTimeline.slice(clamped + 1).map((e) => e.files);
      setHistoryPast(pastEntries);
      setHistoryFuture(futureEntries);
      setHistoryIndex(clamped);
      const scanned = scanProjectStructure(targetEntry.files);
      setProject((prev) => ({
        ...prev,
        files: targetEntry.files,
        pages: scanned.pages,
        framework: scanned.framework,
        globalCssPaths: scanned.globalCssPaths,
      }));
      showToastFeedback(`Restored checkpoint: ${targetEntry.label}`);
    },
    [historyTimeline, showToastFeedback]
  );

  const handleResetToOriginal = useCallback(() => {
    setBrandRemixConfig(DEFAULT_BRAND_REMIX_CONFIG);
    commitFilesMutation(
      { ...project.originalFiles },
      activePage.filePath,
      'Reset to Original Design'
    );
    showToastFeedback('Restored original project state');
  }, [project.originalFiles, activePage.filePath, commitFilesMutation, showToastFeedback]);

  const [originalCompiledCss, setOriginalCompiledCss] = useState<string | null>(null);

  useEffect(() => {
    if (!isCompareOpen) return;
    const controller = new AbortController();
    const origCssText = project.globalCssPaths
      .map((p) => project.originalFiles[p] || '')
      .join('\n');
    const origSourceText = Object.entries(project.originalFiles)
      .filter(([p, c]) => /\.(tsx|jsx|ts|js|html)$/i.test(p) && !isVirtualMediaDataUrlFile(p, c))
      .map(([, c]) => c)
      .join('\n');

    (async () => {
      try {
        const res = await fetch('/api/compile-css', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            css: origCssText,
            sources: [origSourceText],
          }),
        });
        const parsed = await safeReadJsonResponse<{ css?: string }>(res);
        if (!controller.signal.aborted && parsed.ok && typeof parsed.data.css === 'string') {
          setOriginalCompiledCss(parsed.data.css);
        }
      } catch {
        // Ignore abort or transient compile errors
      }
    })();

    return () => controller.abort();
  }, [isCompareOpen, project.originalFiles, project.globalCssPaths]);

  const beforeSrcDoc = useMemo(() => {
    if (!isCompareOpen) return null;
    const origProject: VirtualProject = {
      ...project,
      files: project.originalFiles,
    };
    return buildPreviewDocument(
      origProject,
      canvasTargetPage,
      originalCompiledCss ?? compiledTailwindCss,
      'interact',
      null,
      { isolateComponent: Boolean(activeIsolatedPath) }
    ).html;
  }, [
    isCompareOpen,
    project,
    canvasTargetPage,
    originalCompiledCss,
    compiledTailwindCss,
    activeIsolatedPath,
  ]);

  const wallSrcDoc = useMemo(() => {
    if (!isMultiDeviceWallOpen) return '';
    return buildPreviewDocument(
      project,
      canvasTargetPage,
      compiledTailwindCss,
      'interact',
      null,
      { isolateComponent: Boolean(activeIsolatedPath) }
    ).html;
  }, [isMultiDeviceWallOpen, project, canvasTargetPage, compiledTailwindCss, activeIsolatedPath]);

  // ---- Live QA Audit & 1-Click Auto-Fix ----
  const handleTriggerQaScan = useCallback(() => {
    setIsQaScanning(true);
    iframeRef.current?.contentWindow?.postMessage({ type: 'studio:run-qa-scan' }, '*');
    if (qaScanTimeoutRef.current) window.clearTimeout(qaScanTimeoutRef.current);
    qaScanTimeoutRef.current = window.setTimeout(() => {
      setIsQaScanning(false);
    }, 1500);
  }, []);

  useEffect(() => {
    if (!isQaPanelOpen) return;
    const t = window.setTimeout(() => {
      handleTriggerQaScan();
    }, 120);
    return () => window.clearTimeout(t);
  }, [isQaPanelOpen, viewport, canvasTargetPage.filePath, handleTriggerQaScan]);

  const handleReceiveQaMetrics = useCallback(
    (nodes: QaRawNodeMetric[], vpWidth: number) => {
      if (qaScanTimeoutRef.current) {
        window.clearTimeout(qaScanTimeoutRef.current);
        qaScanTimeoutRef.current = null;
      }
      const nextIssues = analyzeDomMetricsForQa(nodes, vpWidth);
      setQaIssues(nextIssues);
      setIsQaScanning(false);
    },
    []
  );

  const handleFocusQaIssue = useCallback((issue: QaAuditIssue) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:select-by-id', studioId: issue.studioId, scroll: true },
      '*'
    );
  }, []);

  const handleAutoFixQaIssue = useCallback(
    (issue: QaAuditIssue) => {
      const code = project.files[issue.filePath];
      if (!code) return;
      const isHtml = /\.html?$/i.test(issue.filePath);
      const updated = applyElementPatchToSource(
        code,
        issue.elementIndex,
        isHtml,
        issue.autoFixPatch
      );
      if (updated === code) return;
      commitFilesMutation(
        { ...project.files, [issue.filePath]: updated },
        issue.filePath,
        `QA Fix: ${issue.title}`
      );
      showToastFeedback(`Auto-fixed: ${issue.title}`);
      window.setTimeout(() => {
        handleTriggerQaScan();
      }, 650);
    },
    [project.files, commitFilesMutation, showToastFeedback, handleTriggerQaScan]
  );

  const handleAutoFixAllQaIssues = useCallback(() => {
    if (qaIssues.length === 0) return;
    const byFile = new Map<string, Array<{ elementIndex: number; patch: ElementSourcePatch }>>();
    for (const issue of qaIssues) {
      if (!project.files[issue.filePath]) continue;
      const list = byFile.get(issue.filePath) || [];
      list.push({ elementIndex: issue.elementIndex, patch: issue.autoFixPatch });
      byFile.set(issue.filePath, list);
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
    commitFilesMutation(
      nextFiles,
      firstTouched,
      `QA Auto-Fix All (${qaIssues.length})`
    );
    showToastFeedback(`Applied ${qaIssues.length} QA auto-fixes`);
    window.setTimeout(() => {
      handleTriggerQaScan();
    }, 700);
  }, [qaIssues, project.files, commitFilesMutation, showToastFeedback, handleTriggerQaScan]);

  // ---- Smart Card / Grid Repeater Editor ----
  const repeaterGroups = useMemo<RepeaterGroup[]>(() => {
    const code = project.files[canvasTargetPage.filePath] || '';
    if (!code) return [];
    return detectRepeaterGroups(code, canvasTargetPage.filePath);
  }, [project.files, canvasTargetPage.filePath]);

  const selectedRepeaterGroup = useMemo<RepeaterGroup | null>(() => {
    if (!selected) return null;
    const code = project.files[selected.filePath] || '';
    if (!code) return null;
    return findRepeaterForElement(code, selected.filePath, selected.elementIndex);
  }, [selected, project.files]);

  const handleOpenRepeaterForSelection = useCallback(() => {
    if (selectedRepeaterGroup) {
      const idx = repeaterGroups.findIndex(
        (g) =>
          g.filePath === selectedRepeaterGroup.filePath &&
          g.containerElementIndex === selectedRepeaterGroup.containerElementIndex
      );
      if (idx >= 0) setActiveRepeaterGroupIdx(idx);
    }
    closeTransientOverlayPanels();
    setIsRepeaterOpen(true);
  }, [selectedRepeaterGroup, repeaterGroups, closeTransientOverlayPanels]);

  const handleRepeaterAdd = useCallback(
    (group: RepeaterGroup) => {
      const code = project.files[group.filePath];
      if (!code) return;
      const updated = addRepeaterItemFromLast(code, group.filePath, group);
      if (updated === code) return;
      commitFilesMutation(
        { ...project.files, [group.filePath]: updated },
        group.filePath,
        `Added Card in ${group.containerLabel}`
      );
      showToastFeedback('Added new card to repeater grid');
    },
    [project.files, commitFilesMutation, showToastFeedback]
  );

  const handleRepeaterDuplicate = useCallback(
    (group: RepeaterGroup, itemElementIndex: number) => {
      const code = project.files[group.filePath];
      if (!code) return;
      const updated = duplicateRepeaterItem(code, group.filePath, itemElementIndex);
      if (updated === code) return;
      commitFilesMutation(
        { ...project.files, [group.filePath]: updated },
        group.filePath,
        'Duplicated Repeater Card'
      );
      showToastFeedback('Duplicated card item');
    },
    [project.files, commitFilesMutation, showToastFeedback]
  );

  const handleRepeaterRemove = useCallback(
    (group: RepeaterGroup, itemElementIndex: number) => {
      const code = project.files[group.filePath];
      if (!code) return;
      const updated = removeRepeaterItem(code, group.filePath, itemElementIndex);
      if (updated === code) return;
      setSelected(null);
      setMultiSelected([]);
      commitFilesMutation(
        { ...project.files, [group.filePath]: updated },
        group.filePath,
        'Removed Repeater Card'
      );
      showToastFeedback('Removed card item');
    },
    [project.files, commitFilesMutation, showToastFeedback]
  );

  const handleRepeaterMove = useCallback(
    (group: RepeaterGroup, itemElementIndex: number, targetIndex: number) => {
      const code = project.files[group.filePath];
      if (!code) return;
      const updated = moveRepeaterItem(code, group.filePath, itemElementIndex, targetIndex);
      if (updated === code) return;
      commitFilesMutation(
        { ...project.files, [group.filePath]: updated },
        group.filePath,
        'Reordered Repeater Card'
      );
    },
    [project.files, commitFilesMutation]
  );

  const handleRepeaterUpdateSlot = useCallback(
    (group: RepeaterGroup, slotElementIndex: number, nextText: string) => {
      const code = project.files[group.filePath];
      if (!code) return;
      const updated = updateRepeaterSlotText(code, group.filePath, slotElementIndex, nextText);
      if (updated === code) return;
      commitFilesMutation(
        { ...project.files, [group.filePath]: updated },
        group.filePath,
        'Updated Card Copy'
      );
    },
    [project.files, commitFilesMutation]
  );

  const commandPaletteItems = useMemo<StudioCommandItem[]>(() => {
    const items: StudioCommandItem[] = [];

    const quickInsertItems: Array<{ label: string; description: string; keywords: string[]; iconKey: StudioCommandItem['iconKey']; snippet: string }> = [
      { label: 'Insert Heading', description: 'Add a heading text element', keywords: ['text', 'title', 'heading', 'h1'], iconKey: 'block', snippet: '<h2 className="text-2xl font-bold">Your Heading</h2>' },
      { label: 'Insert Paragraph', description: 'Add a paragraph text block', keywords: ['text', 'paragraph', 'p', 'copy'], iconKey: 'block', snippet: '<p className="text-sm leading-6 text-slate-600">Write your text here.</p>' },
      { label: 'Insert Name Input', description: 'Add a name input bar', keywords: ['name', 'input', 'field', 'form', 'text'], iconKey: 'block', snippet: '<input type="text" name="name" placeholder="Enter your name" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" />' },
      { label: 'Insert Email Input', description: 'Add an email input bar', keywords: ['email', 'input', 'field', 'form'], iconKey: 'block', snippet: '<input type="email" name="email" placeholder="Enter your email" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" />' },
      { label: 'Insert Password Input', description: 'Add a password input bar', keywords: ['password', 'input', 'field', 'form', 'login'], iconKey: 'block', snippet: '<input type="password" name="password" placeholder="Enter password" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" />' },
      { label: 'Insert Phone Input', description: 'Add a phone input bar', keywords: ['phone', 'mobile', 'number', 'input', 'field'], iconKey: 'block', snippet: '<input type="tel" name="phone" placeholder="Enter phone number" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" />' },
      { label: 'Insert Textarea', description: 'Add a multiline text input', keywords: ['textarea', 'message', 'input', 'form'], iconKey: 'block', snippet: '<textarea name="message" placeholder="Write your message..." rows={4} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" />' },
      { label: 'Insert Button', description: 'Add a styled button', keywords: ['button', 'click', 'submit', 'cta'], iconKey: 'block', snippet: '<button type="button" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Click Me</button>' },
      { label: 'Insert Checkbox', description: 'Add a checkbox with label', keywords: ['checkbox', 'check', 'form', 'toggle'], iconKey: 'block', snippet: '<label className="flex items-center gap-2 text-sm"><input type="checkbox" /> Accept terms</label>' },
      { label: 'Insert Navbar', description: 'Add a simple navigation bar', keywords: ['navbar', 'navigation', 'header', 'menu', 'bar'], iconKey: 'layout', snippet: '<nav className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-5 py-4"><strong>Brand</strong><div className="flex gap-4 text-sm"><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></div></nav>' },
      { label: 'Insert Container', description: 'Add a bordered content container', keywords: ['container', 'box', 'section', 'card', 'layout'], iconKey: 'layout', snippet: '<section className="rounded-xl border border-slate-200 p-6"><h3 className="text-lg font-semibold">Section title</h3><p className="mt-2 text-sm text-slate-600">Content goes here.</p></section>' },
      { label: 'Insert Divider', description: 'Add a horizontal divider line', keywords: ['divider', 'line', 'hr', 'separator'], iconKey: 'block', snippet: '<hr className="my-4 border-slate-200" />' },
      { label: 'Insert Select Dropdown', description: 'Add a select dropdown', keywords: ['select', 'dropdown', 'option', 'form'], iconKey: 'block', snippet: '<select name="choice" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm"><option value="">Choose an option</option><option value="one">Option 1</option><option value="two">Option 2</option></select>' },
    ];
    items.push(...quickInsertItems.map((quick) => ({
      id: `quick:${quick.label}`,
      label: quick.label,
      description: quick.description,
      category: 'blocks' as const,
      keywords: ['quick insert', 'insert', ...quick.keywords],
      iconKey: quick.iconKey,
      onExecute: () => {
        handleInsertLayoutBlock(quick.snippet);
        showToastFeedback(`${quick.label.replace('Insert ', '')} inserted`);
      },
    })));

    if (selected) {
      const target = selected;
      const canExtract = /\.(tsx|jsx)$/i.test(target.filePath);
      items.push(
        {
          id: 'el:copy-styles',
          label: `Copy Styles from <${target.tagName}>`,
          description: 'Copy Tailwind classes and inline visual styles',
          category: 'element',
          keywords: ['copy', 'styles', 'css', 'class', 'clipboard'],
          iconKey: 'copy',
        },
        {
          id: 'el:paste-styles',
          label: `Paste Styles onto <${target.tagName}>`,
          description: copiedStyle
            ? `Apply copied styles from <${copiedStyle.sourceTagName}>`
            : 'Copy styles from an element first',
          category: 'element',
          keywords: ['paste', 'styles', 'apply', 'css'],
          disabled: !copiedStyle,
          iconKey: 'paste',
        },
        {
          id: 'el:wrap-row',
          label: `Wrap <${target.tagName}> in Flex Row`,
          description: 'Wrap selection inside a responsive horizontal flex container',
          category: 'element',
          keywords: ['wrap', 'flex', 'row', 'container', 'horizontal'],
          iconKey: 'wrap',
        },
        {
          id: 'el:wrap-col',
          label: `Wrap <${target.tagName}> in Flex Column`,
          description: 'Wrap selection inside a vertical flex stack',
          category: 'element',
          keywords: ['wrap', 'flex', 'column', 'stack', 'vertical'],
          iconKey: 'wrap',
        },
        {
          id: 'el:wrap-grid-2',
          label: `Wrap <${target.tagName}> in 2-Col Grid`,
          description: 'Wrap selection inside a 2-column CSS grid container',
          category: 'element',
          keywords: ['wrap', 'grid', '2', 'columns'],
          iconKey: 'wrap',
        },
        {
          id: 'el:wrap-grid-3',
          label: `Wrap <${target.tagName}> in 3-Col Grid`,
          description: 'Wrap selection inside a 3-column CSS grid container',
          category: 'element',
          keywords: ['wrap', 'grid', '3', 'columns'],
          iconKey: 'wrap',
        },
        {
          id: 'el:replace-react-ui',
          label: `Replace <${target.tagName}> with React UI Block`,
          description: 'Open React Lib UI to replace or insert around selection',
          category: 'element',
          keywords: ['replace', 'react', 'ui', 'library', 'component', 'swap'],
          iconKey: 'library',
        },
        {
          id: 'el:add-logic',
          label: `Add Logic Rule to <${target.tagName}>`,
          description: 'Attach click, input, condition, or navigation logic',
          category: 'element',
          keywords: ['logic', 'rule', 'flow', 'click', 'interaction'],
          iconKey: 'logic',
        },
        {
          id: 'el:animate',
          label: `Animate <${target.tagName}> in Motion Studio`,
          description: 'Add scroll-reveal, hover, or ambient animations',
          category: 'element',
          keywords: ['animate', 'motion', 'scroll', 'reveal', 'hover'],
          iconKey: 'motion',
        },
        {
          id: 'el:extract-component',
          label: `Extract <${target.tagName}> as Reusable Component`,
          description: canExtract
            ? 'Create a new reusable TSX component from this element'
            : 'Available for React TSX/JSX files',
          category: 'element',
          keywords: ['extract', 'component', 'refactor', 'reusable'],
          disabled: !canExtract,
          iconKey: 'component',
        },
        {
          id: 'el:duplicate',
          label: `Duplicate <${target.tagName}>`,
          description: 'Clone selected element immediately after itself',
          category: 'element',
          keywords: ['duplicate', 'clone', 'copy'],
          iconKey: 'duplicate',
        },
        {
          id: 'el:delete',
          label: `Delete <${target.tagName}>`,
          description: 'Remove selected element from source code',
          category: 'element',
          keywords: ['delete', 'remove', 'trash'],
          iconKey: 'delete',
        }
      );
    }

    items.push(
      {
        id: 'tool:layout-blocks',
        label: 'Open Layout Blocks Builder',
        description: 'Drag or tap responsive sections, grids, headings & buttons',
        category: 'tools',
        keywords: ['layout', 'blocks', 'insert', 'section', 'grid'],
        iconKey: 'layout',
      },
      {
        id: 'tool:react-lib-ui',
        label: 'Open React Lib UI Catalog',
        description: 'Choose, insert, or replace UI blocks and npm React libraries',
        category: 'tools',
        keywords: ['react', 'lib', 'ui', 'catalog', 'components', 'npm'],
        iconKey: 'library',
      },
      {
        id: 'tool:motion-studio',
        label: 'Motion Studio (Scroll & Micro-Interactions)',
        description: 'Configure scroll-reveal entrances, hover effects & ambient loops',
        category: 'tools',
        keywords: ['motion', 'animation', 'scroll', 'reveal', 'hover', 'stagger'],
        iconKey: 'motion',
      },
      {
        id: 'tool:logic-builder',
        label: 'Logic Builder & Flow View',
        description: 'Connect clicks, inputs, state, conditions & navigation flows',
        category: 'tools',
        keywords: ['logic', 'flow', 'rules', 'state', 'interactive'],
        iconKey: 'logic',
      },
      {
        id: 'tool:smart-align',
        label: 'Smart Align (Mobile & Desktop)',
        description: 'Auto-align containers, cards, widths & spacing cleanly',
        category: 'tools',
        keywords: ['smart', 'align', 'responsive', 'spacing', 'cleanup'],
        iconKey: 'align',
      },
      {
        id: 'tool:global-css',
        label: 'Global CSS & Design Tokens',
        description: 'Edit CSS variables, colors, radii & project stylesheets',
        category: 'tools',
        keywords: ['global', 'css', 'tokens', 'variables', 'theme', 'styles'],
        iconKey: 'palette',
      },
      {
        id: 'tool:gradient-css',
        label: 'Gradient CSS Editor (3-Stop & 4-Stop)',
        description: 'Design multi-stop linear/radial gradients and text fills',
        category: 'tools',
        keywords: ['gradient', 'css', 'colors', 'stops', 'background'],
        iconKey: 'gradient',
      },
      {
        id: 'tool:media-library',
        label: 'Media Asset Library',
        description: 'Upload and insert images/videos with clean /assets paths',
        category: 'tools',
        keywords: ['media', 'image', 'video', 'assets', 'upload'],
        iconKey: 'images',
      },
      {
        id: 'tool:type-fx',
        label: 'Type FX & Google Fonts',
        description: 'Import Google Fonts and apply kinetic typography presets',
        category: 'tools',
        keywords: ['type', 'fx', 'fonts', 'typography', 'google'],
        iconKey: 'sparkles',
      },
      {
        id: 'tool:code-editor',
        label: 'Toggle Live Monaco Code Editor',
        description: 'Inspect and edit source files with live preview sync',
        category: 'tools',
        keywords: ['code', 'monaco', 'source', 'editor', 'tsx', 'html'],
        iconKey: 'code',
      },
      {
        id: 'tool:style-inspector',
        label: 'Toggle Style Inspector Panel',
        description: 'Fine-tune fill, layout, typography, borders & shadows',
        category: 'tools',
        keywords: ['inspector', 'style', 'properties', 'panel'],
        iconKey: 'inspector',
      },
      {
        id: 'tool:pages-layers',
        label: 'Toggle Pages & Layers Panel',
        description: 'Browse pages, reusable components, and DOM layer tree',
        category: 'tools',
        keywords: ['pages', 'layers', 'tree', 'components', 'sidebar'],
        iconKey: 'layers',
      },
      {
        id: 'tool:export-production',
        label: 'Export Production ZIP',
        description: 'Compile logic runtime, motion CSS & binary /assets into ZIP',
        category: 'tools',
        keywords: ['export', 'zip', 'production', 'download', 'compile'],
        iconKey: 'export',
      },
      {
        id: 'tool:import-project',
        label: 'Import ZIP or GitHub Repository',
        description: 'Load an existing Next.js, React, or HTML project into studio',
        category: 'tools',
        keywords: ['import', 'zip', 'github', 'repo', 'load'],
        iconKey: 'import',
      },
      {
        id: 'tool:save-draft',
        label: 'Save Draft Snapshot',
        description: 'Save current project state to browser drafts',
        category: 'tools',
        keywords: ['save', 'draft', 'snapshot', 'checkpoint'],
        iconKey: 'save',
      },
      {
        id: 'tool:brand-remixer',
        label: '1-Tap Brand Remixer (Palettes, Fonts & Mood)',
        description: 'Swap curated palettes, font pairings, radius scale & shadow depth',
        category: 'tools',
        keywords: ['brand', 'remixer', 'theme', 'palette', 'fonts', 'dark', 'radius'],
        iconKey: 'sparkles',
      },
      {
        id: 'tool:repeater-editor',
        label: 'Smart Card / Grid Repeater Editor',
        description: 'Add, duplicate, reorder, delete & bulk-edit card grid items',
        category: 'tools',
        keywords: ['repeater', 'cards', 'grid', 'list', 'items', 'bulk'],
        iconKey: 'layers',
      },
      {
        id: 'tool:qa-audit',
        label: 'Live QA Audit & 1-Click Auto-Fix',
        description: 'Detect contrast, touch target & overflow issues with on-canvas pins',
        category: 'tools',
        keywords: ['qa', 'audit', 'contrast', 'wcag', 'overflow', 'fix', 'accessibility'],
        iconKey: 'inspector',
      },
      {
        id: 'tool:history-timeline',
        label: 'Visual History Timeline & Diff',
        description: 'Jump between labeled checkpoints or compare Before / After',
        category: 'tools',
        keywords: ['history', 'timeline', 'checkpoints', 'diff', 'before', 'after'],
        iconKey: 'drafts',
      },
      {
        id: 'tool:open-drafts',
        label: `Open Saved Drafts (${savedDrafts.length})`,
        description: 'Restore a saved snapshot or autosaved session',
        category: 'tools',
        keywords: ['drafts', 'history', 'restore', 'versions'],
        iconKey: 'drafts',
      }
    );

    for (const block of LAYOUT_BLOCKS) {
      items.push({
        id: `block:${block.id}`,
        label: `Insert ${block.label} Block`,
        description: block.description,
        category: 'blocks',
        keywords: ['insert', 'add', 'block', 'layout', block.id, block.label.toLowerCase()],
        iconKey: 'block',
      });
    }

    items.push(
      {
        id: 'canvas:design-mode',
        label: 'Switch to Design Mode',
        description: 'Select, resize, drag, right-click and restyle elements',
        category: 'canvas',
        keywords: ['design', 'edit', 'mode'],
        iconKey: 'inspector',
      },
      {
        id: 'canvas:preview-mode',
        label: 'Switch to Interactive Preview Mode',
        description: 'Test clicks, forms, routes, logic rules & animations live',
        category: 'canvas',
        keywords: ['preview', 'interact', 'play', 'test'],
        iconKey: 'play',
      },
      {
        id: 'canvas:vp-desktop',
        label: 'Viewport: Desktop (1280px)',
        description: 'Preview canvas at standard desktop width',
        category: 'canvas',
        keywords: ['viewport', 'desktop', '1280', 'screen'],
        iconKey: 'viewport',
      },
      {
        id: 'canvas:vp-tablet',
        label: 'Viewport: Tablet (768px)',
        description: 'Preview canvas at tablet width',
        category: 'canvas',
        keywords: ['viewport', 'tablet', '768', 'ipad'],
        iconKey: 'viewport',
      },
      {
        id: 'canvas:vp-mobile',
        label: 'Viewport: Mobile (390px)',
        description: 'Preview canvas at smartphone width',
        category: 'canvas',
        keywords: ['viewport', 'mobile', '390', 'phone'],
        iconKey: 'viewport',
      },
      {
        id: 'canvas:before-after',
        label: 'Toggle Before / After Split Slider',
        description: 'Drag vertical divider comparing original design vs current page',
        category: 'canvas',
        keywords: ['compare', 'before', 'after', 'split', 'diff', 'slider'],
        iconKey: 'layout',
      },
      {
        id: 'canvas:multi-device-wall',
        label: 'Open Multi-Device Preview Wall (3-Up)',
        description: 'Inspect Desktop (1280px), Tablet (768px) & Mobile (390px) side by side',
        category: 'canvas',
        keywords: ['multi', 'device', 'wall', 'responsive', 'desktop', 'tablet', 'mobile'],
        iconKey: 'viewport',
      },
      {
        id: 'canvas:replay-motion',
        label: 'Replay Canvas Animations',
        description: 'Re-trigger scroll-reveal entrance animations on stage',
        category: 'canvas',
        keywords: ['replay', 'animations', 'motion', 'preview'],
        iconKey: 'replay',
      },
      {
        id: 'canvas:undo',
        label: 'Undo Last Change',
        description: 'Revert the previous studio edit',
        category: 'canvas',
        shortcut: '⌘Z',
        disabled: historyPast.length === 0,
        keywords: ['undo', 'revert', 'back'],
        iconKey: 'undo',
      },
      {
        id: 'canvas:redo',
        label: 'Redo Change',
        description: 'Re-apply the last undone edit',
        category: 'canvas',
        shortcut: '⇧⌘Z',
        disabled: historyFuture.length === 0,
        keywords: ['redo', 'forward'],
        iconKey: 'redo',
      }
    );

    for (const page of project.pages) {
      items.push({
        id: `page:${page.route}`,
        label: `Go to Page: ${page.title}`,
        description: `${page.route} · ${page.filePath}`,
        category: 'pages',
        keywords: ['page', 'route', 'open', 'navigate', page.title.toLowerCase(), page.route],
        iconKey: 'page',
      });
    }

    for (const comp of projectComponents) {
      items.push({
        id: `comp:${comp.filePath}`,
        label: `Isolate Component: <${comp.name} />`,
        description: comp.filePath,
        category: 'pages',
        keywords: ['component', 'isolate', comp.name.toLowerCase(), comp.filePath],
        iconKey: 'component',
      });
    }

    return items;
  }, [
    selected,
    copiedStyle,
    savedDrafts.length,
    historyPast.length,
    historyFuture.length,
    project.pages,
    projectComponents,
    handleInsertLayoutBlock,
    showToastFeedback,
  ]);

  const handleExecuteCommand = useCallback(
    (commandId: string) => {
      if (commandId.startsWith('block:')) {
        const blockId = commandId.slice('block:'.length);
        const block = LAYOUT_BLOCKS.find((b) => b.id === blockId);
        if (block) {
          handleInsertLayoutBlock(block.snippet);
          showToastFeedback(`Inserted ${block.label} block`);
        }
        return;
      }
      if (commandId.startsWith('page:')) {
        handleSelectPage(commandId.slice('page:'.length));
        return;
      }
      if (commandId.startsWith('comp:')) {
        handleSelectComponent(commandId.slice('comp:'.length));
        return;
      }

      switch (commandId) {
        case 'el:copy-styles':
          if (selected) handleCopyElementStyles(selected);
          break;
        case 'el:paste-styles':
          if (selected) handlePasteElementStyles(selected);
          break;
        case 'el:wrap-row':
          if (selected) handleWrapTargetElement(selected, 'row');
          break;
        case 'el:wrap-col':
          if (selected) handleWrapTargetElement(selected, 'col');
          break;
        case 'el:wrap-grid-2':
          if (selected) handleWrapTargetElement(selected, 'grid-2');
          break;
        case 'el:wrap-grid-3':
          if (selected) handleWrapTargetElement(selected, 'grid-3');
          break;
        case 'el:replace-react-ui':
          setIsLibraryModalOpen(true);
          break;
        case 'el:add-logic':
          if (selected) handleOpenLogicForTarget(selected);
          break;
        case 'el:animate':
          if (selected) handleOpenMotionForTarget(selected);
          break;
        case 'el:extract-component':
          if (selected) {
            const suggested = suggestExtractedComponentName(selected.tagName, selected.textContent);
            handleExtractComponent(selected.filePath, selected.elementIndex, suggested);
            showToastFeedback(`Extracted <${suggested} /> component`);
          }
          break;
        case 'el:duplicate':
          if (selected) handleDuplicate(selected.filePath, selected.elementIndex);
          break;
        case 'el:delete':
          if (selected) handleDelete(selected.filePath, selected.elementIndex);
          break;
        case 'tool:layout-blocks':
          setIsLayoutBuilderOpen((v) => !v);
          break;
        case 'tool:react-lib-ui':
          setIsLibraryModalOpen(true);
          break;
        case 'tool:motion-studio':
          setIsLogicPanelOpen(false);
          setIsMotionPanelOpen((v) => !v);
          break;
        case 'tool:logic-builder':
          setIsMotionPanelOpen(false);
          setIsLogicPanelOpen((v) => !v);
          break;
        case 'tool:smart-align':
          handleToggleSmartAligner();
          break;
        case 'tool:global-css':
          handleToggleGlobalStylesPanel();
          break;
        case 'tool:gradient-css':
          handleToggleGradientPanel();
          break;
        case 'tool:media-library':
          setIsMediaLibraryOpen(true);
          break;
        case 'tool:type-fx':
          setIsTypographyEffectsOpen(true);
          break;
        case 'tool:code-editor':
          setIsCodeDrawerOpen((v) => !v);
          break;
        case 'tool:style-inspector':
          handleToggleRightPanel();
          break;
        case 'tool:pages-layers':
          handleToggleLeftPanel();
          break;
        case 'tool:export-production':
          handleOpenExportModal();
          break;
        case 'tool:import-project':
          setIsImportOpen(true);
          break;
        case 'tool:save-draft':
          handleQuickSaveDraft();
          break;
        case 'tool:brand-remixer':
          handleToggleBrandRemixer();
          break;
        case 'tool:repeater-editor':
          handleOpenRepeaterForSelection();
          break;
        case 'tool:qa-audit':
          handleToggleQaPanel();
          break;
        case 'tool:history-timeline':
          handleToggleHistoryPanel();
          break;
        case 'tool:open-drafts':
          setIsDraftsOpen(true);
          break;
        case 'canvas:design-mode':
          setInteractionMode('design');
          break;
        case 'canvas:preview-mode':
          setInteractionMode('interact');
          break;
        case 'canvas:vp-desktop':
          setViewport('desktop');
          break;
        case 'canvas:vp-tablet':
          setViewport('tablet');
          break;
        case 'canvas:vp-mobile':
          setViewport('mobile');
          break;
        case 'canvas:before-after':
          setIsCompareOpen((v) => !v);
          break;
        case 'canvas:multi-device-wall':
          setIsMultiDeviceWallOpen(true);
          break;
        case 'canvas:replay-motion':
          handleReplayAnimations();
          break;
        case 'canvas:undo':
          handleUndo();
          break;
        case 'canvas:redo':
          handleRedo();
          break;
      }
    },
    [
      selected,
      handleInsertLayoutBlock,
      showToastFeedback,
      handleSelectPage,
      handleSelectComponent,
      handleCopyElementStyles,
      handlePasteElementStyles,
      handleWrapTargetElement,
      handleOpenLogicForTarget,
      handleOpenMotionForTarget,
      handleExtractComponent,
      handleDuplicate,
      handleDelete,
      handleToggleSmartAligner,
      handleToggleGlobalStylesPanel,
      handleToggleGradientPanel,
      handleToggleRightPanel,
      handleToggleLeftPanel,
      handleOpenExportModal,
      handleQuickSaveDraft,
      handleToggleBrandRemixer,
      handleOpenRepeaterForSelection,
      handleToggleQaPanel,
      handleToggleHistoryPanel,
      handleReplayAnimations,
      handleUndo,
      handleRedo,
    ]
  );

  return (
    <div className="webd-editor-shell flex h-dvh w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
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
        onOpenMediaLibrary={() => setIsMediaLibraryOpen(true)}
        onOpenTypographyEffects={() => setIsTypographyEffectsOpen(true)}
        onOpenLayoutBuilder={() => setIsLayoutBuilderOpen((v) => !v)}
        onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onExportZip={handleOpenExportModal}
        hasUnsavedEdits={hasUnsavedEdits}
        showLeftPanel={showLeftPanel}
        onToggleLeftPanel={handleToggleLeftPanel}
        showRightPanel={showRightPanel}
        onToggleRightPanel={handleToggleRightPanel}
        showSmartAligner={showSmartAligner}
        onToggleSmartAligner={handleToggleSmartAligner}
        showGradientPanel={showGradientPanel}
        onToggleGradientPanel={handleToggleGradientPanel}
        showGlobalStylesPanel={showGlobalStylesPanel}
        onToggleGlobalStylesPanel={handleToggleGlobalStylesPanel}
        showLogicPanel={isLogicPanelOpen}
        onToggleLogicPanel={() => {
          const next = !isLogicPanelOpen;
          closeTransientOverlayPanels();
          setIsLogicPanelOpen(next);
        }}
        showMotionPanel={isMotionPanelOpen}
        showMotionPresetPanel={isMotionPresetPanelOpen}
        onToggleMotionPresetPanel={() => { const next = !isMotionPresetPanelOpen; closeTransientOverlayPanels(); setIsMotionPresetPanelOpen(next); }}
          const next = !isMotionPresetPanelOpen;
          closeTransientOverlayPanels();
          setIsMotionPresetPanelOpen(next);
        }}

        onToggleMotionPanel={() => {
          const next = !isMotionPanelOpen;
          closeTransientOverlayPanels();
          setIsMotionPanelOpen(next);
        }}
        showBrandRemixer={isBrandRemixerOpen}
        onToggleBrandRemixer={handleToggleBrandRemixer}
        showHistoryPanel={isHistoryPanelOpen}
        onToggleHistoryPanel={handleToggleHistoryPanel}
        showQaPanel={isQaPanelOpen}
        onToggleQaPanel={handleToggleQaPanel}
        showRepeaterPanel={isRepeaterOpen}
        onToggleRepeaterPanel={handleOpenRepeaterForSelection}
        onOpenMultiDeviceWall={() => setIsMultiDeviceWallOpen(true)}
        savedDraftsCount={savedDrafts.length}
        justSavedDraft={justSavedDraft}
        onQuickSaveDraft={handleQuickSaveDraft}
        onOpenDraftsModal={() => setIsDraftsOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isAndroidIdeOpen && <AndroidIDEPanel onExitAndroid={() => setIsAndroidIdeOpen(false)} />}
        {!isAndroidIdeOpen && <div className="absolute left-3 top-2 z-[60] flex overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <button type="button" onClick={() => setIsAndroidIdeOpen(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Code2 size={14}/> Web IDE</button>
          <button type="button" onClick={() => setIsAndroidIdeOpen(true)} className="flex items-center gap-1.5 border-l border-slate-200 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white"><Layers size={14}/> Android IDE</button>
        </div>}
        {/* Left Panel: docked on >=1024px, slide-over drawer on tablet, bottom sheet on phone */}
        {showLeftPanel && (
          <div
            className={
              (isCompactViewport
                ? isPhoneViewport
                  ? 'absolute inset-x-0 bottom-0 z-40 flex h-[72vh] max-h-[580px] rounded-t-2xl shadow-2xl overflow-hidden'
                  : 'absolute inset-y-0 left-0 z-40 flex shadow-xl'
                : 'hidden lg:flex h-full shrink-0') + ' webd-editor-left-dock'
            }
          >
            <PagesLayersPanel
              pages={project.pages}
              activeRoute={activePage.route}
              onSelectPage={(route) => {
                handleSelectPage(route);
                if (isCompactViewport) setCompactLeftOpen(false);
              }}
              isHtmlProject={project.framework === 'html'}
              onCreatePage={(title, slug, template, customTemplateCode, customTemplateCss) => {
                const created = handleCreatePage(title, slug, template, customTemplateCode, customTemplateCss);
                if (created && isCompactViewport) setCompactLeftOpen(false);
                return created;
              }}
              onDeletePage={(route) => {
                const deleted = handleDeletePage(route);
                if (deleted && isCompactViewport) setCompactLeftOpen(false);
                return deleted;
              }}
              onCreateSiteKit={() => handleCreateSiteKit()}
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
              onInsertSnippet={(snippet) => {
                handleInsertLayoutBlock(snippet);
                showToastFeedback('Component inserted into current page');
              }}
              onInsertComponentOnPage={(compPath) => {
                handleInsertComponentOnPage(compPath);
                if (isCompactViewport) setCompactLeftOpen(false);
              }}
              onRemoveComponent={(compPath) => handleRemoveComponent(compPath)}
              installedLibCount={Object.keys(packageDependencies).length}
              installedDependencies={packageDependencies}
              onInstallNpmCommand={handleInstallPageDependency}
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
            isLogicPanelOpen ||
            isMotionPanelOpen ||
            isMotionPresetPanelOpen ||
            isBrandRemixerOpen ||
            isHistoryPanelOpen ||
            isQaPanelOpen ||
            isRepeaterOpen) && (
            <button
              type="button"
              aria-label="Close panel drawer"
              onClick={closeTransientOverlayPanels}
              className="absolute inset-0 z-30 bg-slate-900/30"
            />
          )}

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {isLayoutBuilderOpen && (
            <LayoutBuilderPanel
              onClose={() => setIsLayoutBuilderOpen(false)}
              onInsert={(snippet) => {
                handleInsertLayoutBlock(snippet);
                setIsLayoutBuilderOpen(false);
              }}
            />
          )}
          <VisualCanvas
            project={project}
            logicRules={logicRules}
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
            onOpenLayoutBuilder={() => setIsLayoutBuilderOpen((v) => !v)}
            externalLibVersion={externalLibVersion}
            showSmartAligner={showSmartAligner}
            onToggleSmartAligner={handleToggleSmartAligner}
            onOpenMotionStudio={() => handleOpenMotionForTarget(selected)}
            onReplayAnimations={handleReplayAnimations}
            onContextMenuElement={handleContextMenuElement}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            showBeforeAfter={isCompareOpen}
            beforeSrcDoc={beforeSrcDoc}
            onToggleBeforeAfter={() => setIsCompareOpen((v) => !v)}
            showQaOverlay={isQaPanelOpen}
            qaIssues={qaIssues}
            onToggleQaOverlay={handleToggleQaPanel}
            onReceiveQaMetrics={handleReceiveQaMetrics}
            onFocusQaIssue={handleFocusQaIssue}
            onOpenMultiDeviceWall={() => setIsMultiDeviceWallOpen(true)}
            selectedRepeaterCount={selectedRepeaterGroup?.items.length || 0}
            onOpenRepeaterEditor={handleOpenRepeaterForSelection}
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
                availableTargets={logicTargets}
                onChange={handleLogicRulesChange}
                onClose={() => setIsLogicPanelOpen(false)}
              />
            </div>
          )}

          {/* Scroll & Micro-Interaction Motion Studio (docked on desktop) */}
          {!isCompactViewport && isMotionPanelOpen && (
            <div className="absolute inset-y-0 right-0 z-40 flex shadow-xl">
              <AnimationStudioPanel
                selected={selected}
                animatedSummary={animatedSummary}
                onApplyAnimation={handleApplyElementAnimation}
                onReplayAnimations={handleReplayAnimations}
                onClose={() => setIsMotionPanelOpen(false)}
              />
            </div>
          )}

          {/* Project-wide Motion Preset Manager */}
          {!isCompactViewport && isMotionPresetPanelOpen && (
            <div className="absolute inset-y-0 right-0 z-40 flex shadow-xl">
              <MotionPresetStudioPanel preset={motionPreset} onChange={setMotionPreset} onApply={handleApplyMotionPreset} onClose={() => setIsMotionPresetPanelOpen(false)} />
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

          {/* 1-Tap Brand Remixer (docked on desktop) */}
          {!isCompactViewport && isBrandRemixerOpen && (
            <div className="absolute inset-y-0 right-0 z-40 flex shadow-xl">
              <BrandRemixerPanel
                config={brandRemixConfig}
                onApplyConfig={handleApplyBrandRemix}
                onResetRemix={handleResetBrandRemix}
                onClose={() => setIsBrandRemixerOpen(false)}
              />
            </div>
          )}

          {/* Visual History Timeline & Diff (docked on desktop) */}
          {!isCompactViewport && isHistoryPanelOpen && (
            <div className="absolute inset-y-0 right-0 z-40 flex shadow-xl">
              <HistoryTimelinePanel
                entries={historyTimeline}
                currentIndex={historyIndex}
                isCompareOpen={isCompareOpen}
                onToggleCompare={() => setIsCompareOpen((v) => !v)}
                onJumpToIndex={handleJumpToHistoryIndex}
                onResetToOriginal={handleResetToOriginal}
                onClose={() => setIsHistoryPanelOpen(false)}
              />
            </div>
          )}

          {/* Live QA Audit Overlay Panel (docked on desktop) */}
          {!isCompactViewport && isQaPanelOpen && (
            <div className="absolute inset-y-0 right-0 z-40 flex shadow-xl">
              <QaAuditPanel
                issues={qaIssues}
                isScanning={isQaScanning}
                onRescan={handleTriggerQaScan}
                onFocusIssue={handleFocusQaIssue}
                onAutoFixIssue={handleAutoFixQaIssue}
                onAutoFixAll={handleAutoFixAllQaIssues}
                onClose={() => setIsQaPanelOpen(false)}
              />
            </div>
          )}

          {/* Smart Card / Grid Repeater Editor (docked on desktop) */}
          {!isCompactViewport && isRepeaterOpen && (
            <div className="absolute inset-y-0 right-0 z-40 flex shadow-xl">
              <RepeaterEditorPanel
                groups={repeaterGroups}
                activeGroupIndex={activeRepeaterGroupIdx}
                onSelectGroupIndex={setActiveRepeaterGroupIdx}
                onAddItem={handleRepeaterAdd}
                onDuplicateItem={handleRepeaterDuplicate}
                onRemoveItem={handleRepeaterRemove}
                onMoveItem={handleRepeaterMove}
                onUpdateSlotText={handleRepeaterUpdateSlot}
                onClose={() => setIsRepeaterOpen(false)}
              />
            </div>
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
              availableTargets={logicTargets}
              onChange={handleLogicRulesChange}
              onClose={() => setIsLogicPanelOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Scroll & Micro-Interaction Motion Studio (bottom sheet / drawer on compact screens) */}
        {isCompactViewport && isMotionPanelOpen && (
          <div className={isPhoneViewport ? 'absolute inset-x-0 bottom-0 z-40 flex h-[74vh] max-h-[620px] rounded-t-2xl shadow-2xl overflow-hidden' : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'}>
            <AnimationStudioPanel
              selected={selected}
              animatedSummary={animatedSummary}
              onApplyAnimation={handleApplyElementAnimation}
              onReplayAnimations={handleReplayAnimations}
              onClose={() => setIsMotionPanelOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Project-wide Motion Preset Manager — mobile */}
        {isCompactViewport && isMotionPresetPanelOpen && (
          <div className={isPhoneViewport ? 'absolute inset-x-0 bottom-0 z-50 flex h-[84vh] max-h-[760px] overflow-hidden rounded-t-2xl shadow-2xl' : 'absolute inset-y-0 right-0 z-50 flex shadow-2xl'}>
            <MotionPresetStudioPanel preset={motionPreset} onChange={setMotionPreset} onApply={handleApplyMotionPreset} onClose={() => setIsMotionPresetPanelOpen(false)} isBottomSheet={isPhoneViewport} />
          </div>
        )}

        {/* 1-Tap Brand Remixer (bottom sheet / drawer on compact screens) */}
        {isCompactViewport && isBrandRemixerOpen && (
          <div className={isPhoneViewport ? 'absolute inset-x-0 bottom-0 z-40 flex h-[76vh] max-h-[640px] rounded-t-2xl shadow-2xl overflow-hidden' : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'}>
            <BrandRemixerPanel
              config={brandRemixConfig}
              onApplyConfig={handleApplyBrandRemix}
              onResetRemix={handleResetBrandRemix}
              onClose={() => setIsBrandRemixerOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Visual History Timeline & Diff (bottom sheet / drawer on compact screens) */}
        {isCompactViewport && isHistoryPanelOpen && (
          <div className={isPhoneViewport ? 'absolute inset-x-0 bottom-0 z-40 flex h-[74vh] max-h-[620px] rounded-t-2xl shadow-2xl overflow-hidden' : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'}>
            <HistoryTimelinePanel
              entries={historyTimeline}
              currentIndex={historyIndex}
              isCompareOpen={isCompareOpen}
              onToggleCompare={() => setIsCompareOpen((v) => !v)}
              onJumpToIndex={handleJumpToHistoryIndex}
              onResetToOriginal={handleResetToOriginal}
              onClose={() => setIsHistoryPanelOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Live QA Audit Overlay Panel (bottom sheet / drawer on compact screens) */}
        {isCompactViewport && isQaPanelOpen && (
          <div className={isPhoneViewport ? 'absolute inset-x-0 bottom-0 z-40 flex h-[76vh] max-h-[640px] rounded-t-2xl shadow-2xl overflow-hidden' : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'}>
            <QaAuditPanel
              issues={qaIssues}
              isScanning={isQaScanning}
              onRescan={handleTriggerQaScan}
              onFocusIssue={(issue) => {
                handleFocusQaIssue(issue);
                if (isPhoneViewport) setIsQaPanelOpen(false);
              }}
              onAutoFixIssue={handleAutoFixQaIssue}
              onAutoFixAll={handleAutoFixAllQaIssues}
              onClose={() => setIsQaPanelOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Smart Card / Grid Repeater Editor (bottom sheet / drawer on compact screens) */}
        {isCompactViewport && isRepeaterOpen && (
          <div className={isPhoneViewport ? 'absolute inset-x-0 bottom-0 z-40 flex h-[76vh] max-h-[640px] rounded-t-2xl shadow-2xl overflow-hidden' : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'}>
            <RepeaterEditorPanel
              groups={repeaterGroups}
              activeGroupIndex={activeRepeaterGroupIdx}
              onSelectGroupIndex={setActiveRepeaterGroupIdx}
              onAddItem={handleRepeaterAdd}
              onDuplicateItem={handleRepeaterDuplicate}
              onRemoveItem={handleRepeaterRemove}
              onMoveItem={handleRepeaterMove}
              onUpdateSlotText={handleRepeaterUpdateSlot}
              onClose={() => setIsRepeaterOpen(false)}
              isBottomSheet={isPhoneViewport}
            />
          </div>
        )}

        {/* Right Panel: docked on >=1024px, slide-over drawer on tablet, bottom sheet on phone */}
        {showRightPanel && (
          <div
            className={
              (isCompactViewport
                ? isPhoneViewport
                  ? 'absolute inset-x-0 bottom-0 z-40 flex h-[74vh] max-h-[620px] rounded-t-2xl shadow-2xl overflow-hidden'
                  : 'absolute inset-y-0 right-0 z-40 flex shadow-xl'
                : 'hidden lg:flex h-full shrink-0') + ' webd-editor-right-dock'
            }
          >
            <StyleInspectorPanel
              selected={selected}
              onPreviewStyles={handlePreviewStyles}
              onCommitPatch={handleCommitPatch}
              onCommitBatchPatches={handleCommitBatchPatches}
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

      {/* Ergonomic Thumb-Zone Bottom Control Dock on mobile & tablet viewports (<1024px) */}
      <nav
        aria-label="Mobile studio controls"
        className="grid lg:hidden shrink-0 grid-cols-5 items-center gap-1 border-t border-slate-200 bg-white px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          onClick={handleToggleLeftPanel}
          aria-pressed={showLeftPanel}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors ${
            showLeftPanel
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 active:bg-slate-100'
          }`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span>Layers</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileToolsOpen(true)}
          aria-pressed={isMobileToolsOpen}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors ${
            isMobileToolsOpen ||
            showSmartAligner ||
            showGradientPanel ||
            showGlobalStylesPanel ||
            isLogicPanelOpen ||
            isMotionPanelOpen ||
            isBrandRemixerOpen ||
            isHistoryPanelOpen ||
            isQaPanelOpen ||
            isRepeaterOpen
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 active:bg-slate-100'
          }`}
        >
          <Wrench className="h-4 w-4 shrink-0" />
          <span>Tools</span>
        </button>

        <button
          type="button"
          onClick={() => setIsCommandPaletteOpen(true)}
          className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl bg-slate-100 text-[10px] font-semibold text-slate-800 active:bg-slate-200"
        >
          <Search className="h-4 w-4 shrink-0 text-blue-600" />
          <span>Commands</span>
        </button>

        <button
          type="button"
          onClick={handleToggleRightPanel}
          aria-pressed={showRightPanel}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition-colors ${
            selected && !showRightPanel
              ? 'bg-blue-600 text-white shadow-xs'
              : showRightPanel
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 active:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="max-w-full truncate">
            {selected ? `<${selected.tagName}>` : 'Style'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsCodeDrawerOpen((v) => !v)}
          aria-pressed={isCodeDrawerOpen}
          className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors ${
            isCodeDrawerOpen
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 active:bg-slate-100'
          }`}
        >
          <Code2 className="h-4 w-4 shrink-0" />
          <span>Code{hasUnsavedEdits ? '*' : ''}</span>
        </button>
      </nav>

      <TypographyEffectsModal
        open={isTypographyEffectsOpen}
        hasSelection={Boolean(selected)}
        onClose={() => setIsTypographyEffectsOpen(false)}
        onApplyFont={handleApplyFont}
        onApplyMotion={handleApplyTextMotion}
        onInstallNpmPackage={handleInstallTypographyNpmPackage}
      />

      <MediaLibraryModal
        open={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
        onInsert={handleInsertMediaAsset}
        hasSelection={Boolean(selected)}
      />

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

      <ExportProductionModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        project={project}
        logicRules={logicRules}
      />

      <CanvasContextMenu
        isOpen={Boolean(contextMenuState)}
        isTouchSheet={isPhoneViewport || contextMenuState?.trigger === 'longpress'}
        position={contextMenuState ? { x: contextMenuState.x, y: contextMenuState.y } : { x: 0, y: 0 }}
        target={contextMenuState?.target || null}
        multiCount={multiSelected.length}
        copiedStyle={copiedStyle}
        canExtractComponent={Boolean(
          contextMenuState && /\.(tsx|jsx)$/i.test(contextMenuState.target.filePath)
        )}
        onClose={() => setContextMenuState(null)}
        onCopyStyles={handleCopyElementStyles}
        onPasteStyles={handlePasteElementStyles}
        onWrapLayout={handleWrapTargetElement}
        onReplaceWithReactUi={(target) => {
          setSelected(target);
          setIsLibraryModalOpen(true);
        }}
        onAddLogicRule={handleOpenLogicForTarget}
        onAnimateElement={handleOpenMotionForTarget}
        onExtractComponent={(target, name) => {
          handleExtractComponent(target.filePath, target.elementIndex, name);
          showToastFeedback(`Extracted <${name} /> component`);
        }}
        onSelectParent={(parentStudioId) => handleSelectLayer(parentStudioId)}
        onDuplicate={(target) => handleDuplicate(target.filePath, target.elementIndex)}
        onDelete={(target) => handleDelete(target.filePath, target.elementIndex)}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        items={commandPaletteItems}
        selectedLabel={selected ? `<${selected.tagName}> in ${selected.filePath}` : null}
        onExecuteCommand={handleExecuteCommand}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      <MobileToolsSheet
        isOpen={isMobileToolsOpen}
        onClose={() => setIsMobileToolsOpen(false)}
        viewport={viewport}
        onChangeViewport={setViewport}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        justSavedDraft={justSavedDraft}
        savedDraftsCount={savedDrafts.length}
        onQuickSaveDraft={handleQuickSaveDraft}
        onOpenDraftsModal={() => setIsDraftsOpen(true)}
        onOpenImportModal={() => setIsImportOpen(true)}
        onOpenLayoutBuilder={() => setIsLayoutBuilderOpen(true)}
        onOpenLibraryModal={() => setIsLibraryModalOpen(true)}
        onOpenMediaLibrary={() => setIsMediaLibraryOpen(true)}
        onOpenTypographyEffects={() => setIsTypographyEffectsOpen(true)}
        showSmartAligner={showSmartAligner}
        onToggleSmartAligner={handleToggleSmartAligner}
        showGradientPanel={showGradientPanel}
        onToggleGradientPanel={handleToggleGradientPanel}
        showGlobalStylesPanel={showGlobalStylesPanel}
        onToggleGlobalStylesPanel={handleToggleGlobalStylesPanel}
        showLogicPanel={isLogicPanelOpen}
        onToggleLogicPanel={() => handleOpenLogicForTarget(selected)}
        showMotionPanel={isMotionPanelOpen}
        onToggleMotionPanel={() => handleOpenMotionForTarget(selected)}
        showBrandRemixer={isBrandRemixerOpen}
        onToggleBrandRemixer={handleToggleBrandRemixer}
        showHistoryPanel={isHistoryPanelOpen}
        onToggleHistoryPanel={handleToggleHistoryPanel}
        showQaPanel={isQaPanelOpen}
        onToggleQaPanel={handleToggleQaPanel}
        showRepeaterPanel={isRepeaterOpen}
        onToggleRepeaterPanel={handleOpenRepeaterForSelection}
        onOpenMultiDeviceWall={() => setIsMultiDeviceWallOpen(true)}
        onReplayAnimations={handleReplayAnimations}
      />

      <MultiDeviceWallModal
        isOpen={isMultiDeviceWallOpen}
        pageTitle={canvasTargetPage.title}
        pageRoute={canvasTargetPage.route}
        srcDoc={wallSrcDoc}
        onClose={() => setIsMultiDeviceWallOpen(false)}
      />

      {actionToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="studio-action-toast"
          className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-xl lg:bottom-6"
        >
          {actionToast}
        </div>
      )}
    </div>
  );
}
