'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  BoxSelect,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Columns2,
  Component,
  Copy,
  Eye,
  Grid3x3,
  GripVertical,
  Italic,
  Layers3,
  LayoutGrid,
  Magnet,
  MonitorSmartphone,
  MoreHorizontal,
  Move,
  PackagePlus,
  Plus,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Trash2,
  Type,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import MultiAlignBar from './MultiAlignBar';
import { clampCanvasZoom, stepCanvasZoom } from '@/lib/studio/canvas-engine';
import SplitMobileTwin from './SplitMobileTwin';
import VectorPenOverlay from './VectorPenOverlay';
import {
  AlignmentGuide,
  SnapCandidate,
  computeDragSnap,
  computeResizeSnap,
} from '@/lib/studio/alignment-snapping';
import { ComponentInsertPosition } from '@/lib/studio/component-editor';
import {
  buildResizeContainmentStyles,
  parseElementTranslateOffsets,
} from '@/lib/studio/layout-constraints';
import {
  buildPreviewDocument,
  compileHtmlBodyPayload,
  compileReactPreviewPayload,
} from '@/lib/studio/preview-runner';
import { WrapContainerLayout } from '@/lib/studio/source-editor';
import type { VisualLogicRule } from '@/lib/studio/logic-engine';
import {
  SpacingKind,
  SpacingSide,
  computeSpacingDragResult,
  parseComputedBoxSpacing,
} from '@/lib/studio/spacing-handles';
import type { QaAuditIssue, QaRawNodeMetric } from '@/lib/studio/qa-audit';
import {
  MultiAlignAction,
  NUDGE_GRID_STEPS,
  computeNudgeOffsets,
  computeRedlineMeasurements,
} from '@/lib/studio/visual-refinement';
import {
  CanvasInteractionMode,
  ElementRect,
  ElementSourcePatch,
  LayerTreeNode,
  ProjectPage,
  StudioElementSnapshot,
  ViewportPreset,
  VirtualProject,
} from '@/lib/studio/types';

interface VisualCanvasProps {
  project: VirtualProject;
  logicRules?: VisualLogicRule[];
  activePage: ProjectPage;
  compiledTailwindCss: string;
  viewport: ViewportPreset;
  interactionMode: CanvasInteractionMode;
  selected: StudioElementSnapshot | null;
  multiSelected?: StudioElementSnapshot[];
  onUpdateMultiSelected?: (items: StudioElementSnapshot[]) => void;
  onMultiAlignAction?: (action: MultiAlignAction) => void;
  onWrapMultiSelected?: (layout: WrapContainerLayout) => void;
  lockedIds?: string[];
  hiddenIds?: string[];
  pseudoState?: 'default' | 'hover' | 'focus';
  pendingSelectStudioId?: string | null;
  onClearPendingSelect?: () => void;
  onSelectElement: (snapshot: StudioElementSnapshot, shiftKey?: boolean, preserveMulti?: boolean) => void;
  onUpdateLayerTree: (tree: LayerTreeNode[]) => void;
  onNavigateRoute: (route: string) => void;
  onCommitPatch: (filePath: string, elementIndex: number, patch: ElementSourcePatch) => void;
  onMoveSibling: (filePath: string, elementIndex: number, targetIndex: number) => void;
  onDuplicate: (filePath: string, elementIndex: number) => void;
  onDelete: (filePath: string, elementIndex: number) => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  isIsolatedComponent?: boolean;
  onExitComponentIsolation?: () => void;
  onInsertIsolatedComponent?: (position: ComponentInsertPosition) => void;
  isolatedTargetLabel?: string | null;
  onOpenLibraryModal?: () => void;
  externalLibVersion?: number;
  showSmartAligner?: boolean;
  onToggleSmartAligner?: () => void;
  onOpenLayoutBuilder?: () => void;
  onOpenMotionStudio?: () => void;
  onReplayAnimations?: () => void;
  onContextMenuElement?: (payload: {
    element: StudioElementSnapshot;
    x: number;
    y: number;
    trigger: 'contextmenu' | 'longpress' | 'button';
  }) => void;
  onOpenCommandPalette?: () => void;
  showBeforeAfter?: boolean;
  beforeSrcDoc?: string | null;
  onToggleBeforeAfter?: () => void;
  showQaOverlay?: boolean;
  qaIssues?: QaAuditIssue[];
  onToggleQaOverlay?: () => void;
  onReceiveQaMetrics?: (nodes: QaRawNodeMetric[], viewportWidth: number) => void;
  onFocusQaIssue?: (issue: QaAuditIssue) => void;
  onOpenMultiDeviceWall?: () => void;
  selectedRepeaterCount?: number;
  onOpenRepeaterEditor?: () => void;
}

function parseStudioTarget(id: string): { filePath: string; elementIndex: number } | null {
  const sep = id.lastIndexOf('::');
  if (sep === -1) return null;
  const elementIndex = Number(id.slice(sep + 2));
  if (!Number.isFinite(elementIndex)) return null;
  return { filePath: id.slice(0, sep), elementIndex };
}

const VIEWPORT_WIDTHS: Record<ViewportPreset, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
};

type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// Register shared React runtime once at module load so srcDoc iframes always find it
if (typeof window !== 'undefined') {
  const win = window as unknown as Record<string, Record<string, unknown>>;
  win.__STUDIO_RUNTIME__ = {
    React,
    ReactDOMClient,
    LucideIcons: win.__STUDIO_RUNTIME__?.LucideIcons || {},
    ExternalLibs: win.__STUDIO_RUNTIME__?.ExternalLibs || {},
  };
}

export default function VisualCanvas({
  project,
  logicRules = [],
  activePage,
  compiledTailwindCss,
  viewport,
  interactionMode,
  selected,
  multiSelected = [],
  onUpdateMultiSelected,
  onMultiAlignAction,
  onWrapMultiSelected,
  lockedIds = [],
  hiddenIds = [],
  pseudoState = 'default',
  pendingSelectStudioId = null,
  onClearPendingSelect,
  onSelectElement,
  onUpdateLayerTree,
  onNavigateRoute,
  onCommitPatch,
  onMoveSibling,
  onDuplicate,
  onDelete,
  iframeRef,
  snapEnabled = true,
  onToggleSnap,
  isIsolatedComponent = false,
  onExitComponentIsolation,
  onInsertIsolatedComponent,
  isolatedTargetLabel = null,
  onOpenLibraryModal,
  externalLibVersion = 0,
  showSmartAligner = false,
  onToggleSmartAligner,
  onOpenLayoutBuilder,
  onOpenMotionStudio,
  onReplayAnimations,
  onContextMenuElement,
  onOpenCommandPalette,
  showBeforeAfter = false,
  beforeSrcDoc = null,
  onToggleBeforeAfter,
  showQaOverlay = false,
  qaIssues = [],
  onToggleQaOverlay,
  onReceiveQaMetrics,
  onFocusQaIssue,
  onOpenMultiDeviceWall,
  selectedRepeaterCount = 0,
  onOpenRepeaterEditor,
}: VisualCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [lucideVersion, setLucideVersion] = useState(0);
  const [touchDiagnostic, setTouchDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [stageWidth, setStageWidth] = useState(900);
  const [stageHeight, setStageHeight] = useState(760);
  const [hoverInfo, setHoverInfo] = useState<{
    studioId: string;
    tagName: string;
    rect: ElementRect;
  } | null>(null);
  const [rectOverride, setRectOverride] = useState<{ studioId: string; rect: ElementRect } | null>(
    null
  );
  const [dropIndicator, setDropIndicator] = useState<{
    targetIndex: number;
    rect: ElementRect | null;
  } | null>(null);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  const [isolationInsertPos, setIsolationInsertPos] =
    useState<ComponentInsertPosition>('after');
  const dropTargetIdxRef = useRef<number | null>(null);

  // Phase 1, 2 & 3 Visual Refinement States
  const [specsMode, setSpecsMode] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  const [spacingHandlesEnabled, setSpacingHandlesEnabled] = useState(true);
  const [gridOverlay, setGridOverlay] = useState<'off' | '12col' | '8px' | 'both'>('off');
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [nudgeStep, setNudgeStep] = useState<number>(8);
  const [nudgeHud, setNudgeHud] = useState<{ x: number; y: number } | null>(null);
  const [spacingDragHud, setSpacingDragHud] = useState<{
    kind: SpacingKind;
    label: string;
    hint: string;
  } | null>(null);
  const [inlineEditing, setInlineEditing] = useState<StudioElementSnapshot | null>(null);
  const [beforeAfterPct, setBeforeAfterPct] = useState<number>(50);
  const [marqueeMode, setMarqueeMode] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<ElementRect | null>(null);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [viewMenuOpen]);

  const nudgeTimerRef = useRef<number | null>(null);
  const nudgePendingRef = useRef<{
    studioId: string;
    filePath: string;
    elementIndex: number;
    x: number;
    y: number;
  } | null>(null);

  const showSpecs = specsMode || altPressed;

  const liveRect =
    selected && rectOverride?.studioId === selected.studioId
      ? rectOverride.rect
      : selected?.rect ?? null;

  useEffect(() => {
    let active = true;
    const win = window as unknown as Record<string, Record<string, unknown>>;
    win.__STUDIO_RUNTIME__ = {
      React,
      ReactDOMClient,
      LucideIcons: win.__STUDIO_RUNTIME__?.LucideIcons || {},
      ExternalLibs: win.__STUDIO_RUNTIME__?.ExternalLibs || {},
    };

    import('lucide-react')
      .then((mod) => {
        if (!active) return;
        win.__STUDIO_RUNTIME__.LucideIcons = mod;
        setLucideVersion((v) => v + 1);
      })
      .catch(() => {
        // Fallback icon stub in preview-runner remains active
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStageWidth(entry.contentRect.width);
        setStageHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const targetWidth = VIEWPORT_WIDTHS[viewport];
  const fitScale = useMemo(() => {
    const gutter = stageWidth < 640 ? 20 : 48;
    const splitAllowance = splitView && stageWidth >= 820 ? 248 : 0;
    const usable = Math.max(260, stageWidth - gutter - splitAllowance);
    return Math.min(1, Number((usable / targetWidth).toFixed(4)));
  }, [stageWidth, targetWidth, splitView]);

  const scale = zoomMode === 'fit' ? fitScale : clampCanvasZoom(zoomMode);
  const frameHeight = Math.max(540, Math.round((stageHeight - 72) / Math.min(1, fitScale)));

  const docKey = mounted
    ? `${project.framework}:${activePage.filePath}:${isIsolatedComponent ? 1 : 0}`
    : 'ssr';
  const isHtmlPage =
    project.framework === 'html' || /\.html?$/i.test(activePage.filePath);

  const [prevDocKey, setPrevDocKey] = useState<string>('ssr');
  const [docHtml, setDocHtml] = useState<string>(
    '<!doctype html><html><body style="margin:0;background:#ffffff"></body></html>'
  );
  const [bootedSnapshot, setBootedSnapshot] = useState<{
    project: VirtualProject | null;
    css: string;
  }>({ project: null, css: '' });

  if (mounted && docKey !== prevDocKey) {
    setPrevDocKey(docKey);
    const built = buildPreviewDocument(
      project,
      activePage,
      compiledTailwindCss,
      interactionMode,
      null,
      { isolateComponent: isIsolatedComponent }
    );
    setDocHtml(built.html);
    setBootedSnapshot({ project, css: compiledTailwindCss });
  }

  const reactPayload = useMemo(() => {
    if (!mounted || isHtmlPage) return null;
    return compileReactPreviewPayload(project, activePage, {
      isolateComponent: isIsolatedComponent,
    });
  }, [mounted, isHtmlPage, project, activePage, isIsolatedComponent]);

  const htmlPayload = useMemo(() => {
    if (!mounted || !isHtmlPage) return null;
    return compileHtmlBodyPayload(project, activePage);
  }, [mounted, isHtmlPage, project, activePage]);

  const activeCompileErrors = reactPayload?.compileErrors || [];

  const readyDocKeyRef = useRef<string | null>(null);
  const bootedDocKeyRef = useRef<string>('ssr');
  const docKeyRef = useRef<string>(docKey);
  const selectedIdRef = useRef<string | null>(selected?.studioId || null);
  const latestStateRef = useRef({
    project,
    bootedProject: bootedSnapshot.project,
    bootedCss: bootedSnapshot.css,
    isHtmlPage,
    reactPayload,
    htmlPayload,
    compiledTailwindCss,
    interactionMode,
    pendingSelectStudioId,
    logicRules,
  });
  const scaleRef = useRef<number>(scale);
  const callbacksRef = useRef({
    onUpdateLayerTree,
    onSelectElement,
    onUpdateMultiSelected,
    onCommitPatch,
    onNavigateRoute,
    onClearPendingSelect,
    onContextMenuElement,
    onOpenCommandPalette,
    onReceiveQaMetrics,
  });

  useEffect(() => {
    if (bootedDocKeyRef.current !== docKey) {
      bootedDocKeyRef.current = docKey;
      readyDocKeyRef.current = null;
    }
    docKeyRef.current = docKey;
    scaleRef.current = scale;
    selectedIdRef.current = selected?.studioId || null;
    latestStateRef.current = {
      project,
      bootedProject: bootedSnapshot.project,
      bootedCss: bootedSnapshot.css,
      isHtmlPage,
      reactPayload,
      htmlPayload,
      compiledTailwindCss,
      interactionMode,
      pendingSelectStudioId,
      logicRules,
    };
    callbacksRef.current = {
      onUpdateLayerTree,
      onSelectElement,
      onUpdateMultiSelected,
      onCommitPatch,
      onNavigateRoute,
      onClearPendingSelect,
      onContextMenuElement,
      onOpenCommandPalette,
      onReceiveQaMetrics,
    };
  });

  // Apply project source/content mutations in-place without reloading the iframe
  useEffect(() => {
    if (!mounted) return;
    if (readyDocKeyRef.current !== docKey) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    if (isHtmlPage && htmlPayload) {
      win.postMessage(
        {
          type: 'studio:hot-update-html',
          bodyHtml: htmlPayload.bodyHtml,
          userCss: htmlPayload.userCss,
          assetMap: htmlPayload.assetMap,
          tailwindCss: latestStateRef.current.compiledTailwindCss,
          selectStudioId: pendingSelectStudioId || null,
        },
        '*'
      );
    } else if (reactPayload) {
      win.postMessage(
        {
          type: 'studio:hot-update',
          payload: reactPayload,
          tailwindCss: latestStateRef.current.compiledTailwindCss,
          selectStudioId: pendingSelectStudioId || null,
        },
        '*'
      );
    }
    if (pendingSelectStudioId) {
      callbacksRef.current.onClearPendingSelect?.();
    }
  }, [mounted, docKey, isHtmlPage, reactPayload, htmlPayload, pendingSelectStudioId, iframeRef]);

  // Keep visual logic rules synchronized with the preview runtime.
  useEffect(() => {
    if (!mounted || readyDocKeyRef.current !== docKey) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:set-logic-rules', rules: logicRules },
      '*'
    );
  }, [mounted, docKey, logicRules, iframeRef]);

  // Apply compiled Tailwind CSS updates in-place without reloading or resetting React state
  useEffect(() => {
    if (!mounted) return;
    if (readyDocKeyRef.current !== docKey) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:update-css', tailwindCss: compiledTailwindCss },
      '*'
    );
  }, [mounted, docKey, compiledTailwindCss, iframeRef]);

  // Refresh Lucide / dynamically imported external libraries in-place
  useEffect(() => {
    if (!mounted) return;
    if (readyDocKeyRef.current !== docKey) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'studio:refresh-runtime' }, '*');
  }, [mounted, docKey, lucideVersion, externalLibVersion, iframeRef]);

  // Listen to designer bridge messages from iframe (bound once)
  useEffect(() => {
    const handleMessage = (ev: MessageEvent) => {
      const msg = ev.data || {};
      if (msg.type === 'studio:tree') {
        if (readyDocKeyRef.current !== docKeyRef.current) {
          readyDocKeyRef.current = docKeyRef.current;
          const win = iframeRef.current?.contentWindow;
          const latest = latestStateRef.current;
          if (win) {
            win.postMessage({ type: 'studio:set-mode', mode: latest.interactionMode }, '*');
            win.postMessage({ type: 'studio:set-logic-rules', rules: latest.logicRules || [] }, '*');
            if (latest.bootedProject && latest.bootedProject !== latest.project) {
              if (latest.isHtmlPage && latest.htmlPayload) {
                win.postMessage(
                  {
                    type: 'studio:hot-update-html',
                    bodyHtml: latest.htmlPayload.bodyHtml,
                    userCss: latest.htmlPayload.userCss,
                    assetMap: latest.htmlPayload.assetMap,
                    tailwindCss: latest.compiledTailwindCss,
                    selectStudioId: latest.pendingSelectStudioId || null,
                  },
                  '*'
                );
              } else if (latest.reactPayload) {
                win.postMessage(
                  {
                    type: 'studio:hot-update',
                    payload: latest.reactPayload,
                    tailwindCss: latest.compiledTailwindCss,
                    selectStudioId: latest.pendingSelectStudioId || null,
                  },
                  '*'
                );
              }
              if (latest.pendingSelectStudioId) {
                callbacksRef.current.onClearPendingSelect?.();
              }
            } else if (latest.bootedCss !== latest.compiledTailwindCss) {
              win.postMessage(
                { type: 'studio:update-css', tailwindCss: latest.compiledTailwindCss },
                '*'
              );
            }
          }
        }
        callbacksRef.current.onUpdateLayerTree(msg.tree || []);
      } else if (msg.type === 'studio:hover') {
        if (!msg.studioId) setHoverInfo(null);
        else setHoverInfo({ studioId: msg.studioId, tagName: msg.tagName, rect: msg.rect });
      } else if (msg.type === 'studio:touch-diagnostic') {
        setTouchDiagnostic(msg.detail || {});
      } else if (msg.type === 'studio:select') {
        setHoverInfo(null);
        if (msg.element) {
          setRectOverride({ studioId: msg.element.studioId, rect: msg.element.rect });
          callbacksRef.current.onSelectElement(
            msg.element,
            Boolean(msg.shiftKey),
            Boolean(msg.preserveMulti)
          );
        }
      } else if (msg.type === 'studio:marquee-result' || msg.type === 'studio:multi-rects') {
        if (Array.isArray(msg.elements)) {
          callbacksRef.current.onUpdateMultiSelected?.(msg.elements);
        }
      } else if (msg.type === 'studio:selected-rect') {
        if (selectedIdRef.current && msg.studioId === selectedIdRef.current) {
          setRectOverride({ studioId: msg.studioId, rect: msg.rect });
        }
      } else if (msg.type === 'studio:inline-text') {
        const parsed = typeof msg.studioId === 'string' ? parseStudioTarget(msg.studioId) : null;
        if (parsed) {
          callbacksRef.current.onCommitPatch(parsed.filePath, parsed.elementIndex, {
            textContent: msg.textContent,
          });
        }
      } else if (msg.type === 'studio:navigate') {
        if (typeof msg.route === 'string') {
          callbacksRef.current.onNavigateRoute(msg.route);
        }
      } else if (msg.type === 'studio:drop-target') {
        dropTargetIdxRef.current = msg.targetIndex;
        setDropIndicator({
          targetIndex: msg.targetIndex,
          rect: msg.indicatorRect || null,
        });
      } else if (msg.type === 'studio:context-menu' && msg.element) {
        setHoverInfo(null);
        setRectOverride({ studioId: msg.element.studioId, rect: msg.element.rect });
        callbacksRef.current.onSelectElement(msg.element, false, true);
        const frame = iframeRef.current;
        const fr = frame ? frame.getBoundingClientRect() : { left: 0, top: 0 };
        const curScale = scaleRef.current || 1;
        const absX = fr.left + (Number(msg.clientX) || 0) * curScale;
        const absY = fr.top + (Number(msg.clientY) || 0) * curScale;
        callbacksRef.current.onContextMenuElement?.({
          element: msg.element,
          x: absX,
          y: absY,
          trigger: msg.trigger === 'longpress' ? 'longpress' : 'contextmenu',
        });
      } else if (msg.type === 'studio:open-command-palette') {
        callbacksRef.current.onOpenCommandPalette?.();
      } else if (msg.type === 'studio:inline-edit-state') {
        if (msg.active && msg.element) {
          setInlineEditing(msg.element);
          setRectOverride({ studioId: msg.element.studioId, rect: msg.element.rect });
          callbacksRef.current.onSelectElement(msg.element, false, true);
        } else {
          setInlineEditing(null);
        }
      } else if (msg.type === 'studio:qa-metrics' && Array.isArray(msg.nodes)) {
        callbacksRef.current.onReceiveQaMetrics?.(
          msg.nodes as QaRawNodeMetric[],
          Number(msg.viewportWidth) || 1280
        );
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeRef]);

  // Sync locked & hidden layers to iframe without source mutation
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:set-layer-locks', lockedIds, hiddenIds },
      '*'
    );
  }, [lockedIds, hiddenIds, docKey, iframeRef]);

  // Sync pseudo-state preview (:hover / :focus) to iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:set-pseudo-state', studioId: selected?.studioId || null, pseudo: pseudoState },
      '*'
    );
  }, [pseudoState, selected?.studioId, docKey, iframeRef]);

  // Sync mode switches without full rebuild
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:set-mode', mode: interactionMode },
      '*'
    );
  }, [interactionMode, iframeRef]);

  // Refresh selected element snapshot only when viewport preset changes without scrolling
  const prevViewportRef = useRef<ViewportPreset>(viewport);
  useEffect(() => {
    if (prevViewportRef.current === viewport) return;
    prevViewportRef.current = viewport;
    const studioId = selectedIdRef.current;
    if (!studioId) return;
    const timer = window.setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'studio:select-by-id', studioId, scroll: false, preserveMulti: true },
        '*'
      );
    }, 90);
    return () => window.clearTimeout(timer);
  }, [viewport, iframeRef]);

  // Alt-key live redlines, Space-pan, and Arrow-key 1px/step micro-nudge
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return Boolean(
        el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable ||
          el.closest?.('.monaco-editor')
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltPressed(true);
      }
      if (e.code === 'Space' && !isTypingTarget(e.target)) {
        setSpacePanActive(true);
      }
      if (
        interactionMode === 'design' &&
        selected &&
        !isTypingTarget(e.target) &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault();
        const curPending = nudgePendingRef.current;
        const base =
          curPending && curPending.studioId === selected.studioId
            ? { x: curPending.x, y: curPending.y }
            : parseElementTranslateOffsets(selected.inlineStyles, selected.computedStyles);

        const step = e.shiftKey ? nudgeStep : 1;
        const nudged = computeNudgeOffsets({
          baseX: base.x,
          baseY: base.y,
          key: e.key,
          step,
        });

        nudgePendingRef.current = {
          studioId: selected.studioId,
          filePath: selected.filePath,
          elementIndex: selected.elementIndex,
          x: nudged.nextX,
          y: nudged.nextY,
        };
        setNudgeHud({ x: nudged.nextX, y: nudged.nextY });

        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'studio:preview-style',
            studioId: selected.studioId,
            styles: { translate: `${nudged.nextX}px ${nudged.nextY}px`, transform: 'none' },
          },
          '*'
        );

        if (nudgeTimerRef.current) window.clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = window.setTimeout(() => {
          const pending = nudgePendingRef.current;
          nudgePendingRef.current = null;
          setNudgeHud(null);
          if (pending) {
            onCommitPatch(pending.filePath, pending.elementIndex, {
              styles: { transform: `translate(${pending.x}px, ${pending.y}px)` },
            });
          }
        }, 260);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPressed(false);
      if (e.code === 'Space') setSpacePanActive(false);
    };

    const onBlur = () => {
      setAltPressed(false);
      setSpacePanActive(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [interactionMode, selected, nudgeStep, iframeRef, onCommitPatch]);

  // Ctrl/Cmd + Wheel zoom on stage
  const handleStageWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const cur = scale;
    const next = stepCanvasZoom(cur, e.deltaY < 0 ? 'in' : 'out');
    setZoomMode(next);
  };

  // Space+Drag canvas panning
  const startStagePan = (e: React.PointerEvent<HTMLElement>) => {
    if (!spacePanActive) return;
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initLeft = stage.scrollLeft;
    const initTop = stage.scrollTop;

    const onMove = (ev: PointerEvent) => {
      stage.scrollLeft = initLeft - (ev.clientX - startX);
      stage.scrollTop = initTop - (ev.clientY - startY);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const getSnapCandidates = (snap: StudioElementSnapshot): SnapCandidate[] => {
    const out: SnapCandidate[] = [];
    if (snap.siblingRects) {
      for (const r of snap.siblingRects) out.push({ ...r, kind: 'sibling' });
    }
    if (snap.parentRect) {
      out.push({ ...snap.parentRect, kind: 'parent' });
    }
    out.push({
      x: 0,
      y: 0,
      width: snap.viewportSize?.width || targetWidth,
      height: snap.viewportSize?.height || frameHeight,
      kind: 'viewport',
    });
    return out;
  };

  const startResize = (dir: ResizeHandleDir, e: React.PointerEvent) => {
    if (!selected || !liveRect) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const initRect = { ...liveRect };
    const initW = Math.max(24, Math.round(liveRect.width));
    const initH = Math.max(20, Math.round(liveRect.height));
    let finalW = initW;
    let finalH = initH;
    let didMove = false;
    const candidates = snapEnabled ? getSnapCandidates(selected) : [];

    const onMove = (ev: PointerEvent) => {
      if (!didMove && Math.abs(ev.clientX - startX) <= 2 && Math.abs(ev.clientY - startY) <= 2) {
        return;
      }
      didMove = true;
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const snapped = computeResizeSnap({
        initRect,
        dir,
        rawDx: dx,
        rawDy: dy,
        candidates,
        threshold: snapEnabled ? 6 : -1,
      });

      const patchStyles = buildResizeContainmentStyles({
        width: dir.includes('e') || dir.includes('w') ? `${(finalW = snapped.width)}px` : undefined,
        height: dir.includes('s') || dir.includes('n') ? `${(finalH = snapped.height)}px` : undefined,
        inlineStyles: selected.inlineStyles,
        computedStyles: selected.computedStyles,
        currentRect: initRect,
      });
      setActiveGuides(snapped.guides);

      iframeRef.current?.contentWindow?.postMessage(
        { type: 'studio:preview-style', studioId: selected.studioId, styles: patchStyles },
        '*'
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setActiveGuides([]);
      if (!didMove) return;
      const committed = buildResizeContainmentStyles({
        width: dir.includes('e') || dir.includes('w') ? `${finalW}px` : undefined,
        height: dir.includes('s') || dir.includes('n') ? `${finalH}px` : undefined,
        inlineStyles: selected.inlineStyles,
        computedStyles: selected.computedStyles,
        currentRect: initRect,
      });
      onCommitPatch(selected.filePath, selected.elementIndex, { styles: committed });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startReorderDrag = (e: React.PointerEvent) => {
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
    dropTargetIdxRef.current = null;
    const startX = e.clientX;
    const startY = e.clientY;
    let didMove = false;
    const dragStudioId = selected.instanceStudioId || selected.studioId;
    const reorderTarget = parseStudioTarget(dragStudioId) || {
      filePath: selected.filePath,
      elementIndex: selected.elementIndex,
    };

    const onMove = (ev: PointerEvent) => {
      if (!didMove && Math.hypot(ev.clientX - startX, ev.clientY - startY) <= 3) {
        return;
      }
      didMove = true;
      const frame = iframeRef.current;
      if (!frame) return;
      const fr = frame.getBoundingClientRect();
      const ix = (ev.clientX - fr.left) / scale;
      const iy = (ev.clientY - fr.top) / scale;
      frame.contentWindow?.postMessage(
        { type: 'studio:drag-probe', studioId: dragStudioId, x: ix, y: iy },
        '*'
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const targetIdx = dropTargetIdxRef.current;
      setDropIndicator(null);
      dropTargetIdxRef.current = null;
      if (didMove && targetIdx !== null && targetIdx !== selected.siblingIndex) {
        onMoveSibling(reorderTarget.filePath, reorderTarget.elementIndex, targetIdx);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startOffsetDrag = (e: React.PointerEvent) => {
    if (!selected || !liveRect) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const { x: baseX, y: baseY } = parseElementTranslateOffsets(
      selected.inlineStyles,
      selected.computedStyles
    );
    const originRect: ElementRect = {
      x: liveRect.x - baseX,
      y: liveRect.y - baseY,
      width: liveRect.width,
      height: liveRect.height,
    };
    const candidates = snapEnabled ? getSnapCandidates(selected) : [];
    let nextX = Math.round(baseX);
    let nextY = Math.round(baseY);
    let didMove = false;

    const onMove = (ev: PointerEvent) => {
      if (!didMove && Math.abs(ev.clientX - startX) <= 2 && Math.abs(ev.clientY - startY) <= 2) {
        return;
      }
      didMove = true;
      const rawX = Math.round(baseX + (ev.clientX - startX) / scale);
      const rawY = Math.round(baseY + (ev.clientY - startY) / scale);
      const snapped = computeDragSnap({
        originRect,
        rawOffsetX: rawX,
        rawOffsetY: rawY,
        candidates,
        threshold: snapEnabled ? 6 : -1,
      });
      nextX = snapped.snappedX;
      nextY = snapped.snappedY;
      setActiveGuides(snapped.guides);

      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'studio:preview-style',
          studioId: selected.studioId,
          styles: { translate: `${nextX}px ${nextY}px`, transform: 'none' },
        },
        '*'
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setActiveGuides([]);
      if (!didMove) return;
      onCommitPatch(selected.filePath, selected.elementIndex, {
        styles: { transform: `translate(${nextX}px, ${nextY}px)` },
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startSpacingDrag = (
    kind: SpacingKind,
    side: SpacingSide,
    e: React.PointerEvent
  ) => {
    if (!selected || !boxSpacing) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const initialValues = kind === 'padding' ? boxSpacing.padding : boxSpacing.margin;
    const startX = e.clientX;
    const startY = e.clientY;
    let latestPatch: Record<string, string> | null = null;
    let didMove = false;

    const onMove = (ev: PointerEvent) => {
      if (!didMove && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 3) return;
      didMove = true;
      const symmetricMode = ev.altKey ? 'all' : ev.shiftKey ? 'axis' : 'single';
      const result = computeSpacingDragResult({
        kind,
        side,
        initialValues,
        deltaX: ev.clientX - startX,
        deltaY: ev.clientY - startY,
        scale,
        symmetricMode,
        snapStep: 4,
      });
      latestPatch = result.stylePatch;
      setSpacingDragHud({
        kind,
        label: result.badgeLabel,
        hint:
          symmetricMode === 'all'
            ? 'All 4 sides (Alt)'
            : symmetricMode === 'axis'
            ? 'Symmetric axis (Shift)'
            : 'Hold Shift for axis · Alt for all',
      });
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'studio:preview-style',
          studioId: selected.studioId,
          styles: result.stylePatch,
        },
        '*'
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setSpacingDragHud(null);
      if (!didMove || !latestPatch) return;
      onCommitPatch(selected.filePath, selected.elementIndex, {
        styles: latestPatch,
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startBeforeAfterDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const parent = e.currentTarget.parentElement;
    if (!parent) return;
    e.preventDefault();
    e.stopPropagation();
    const bounds = parent.getBoundingClientRect();
    const updateFromClientX = (clientX: number) => {
      const pct = ((clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
      setBeforeAfterPct(Math.max(4, Math.min(96, Math.round(pct))));
    };
    updateFromClientX(e.clientX);
    const onMove = (ev: PointerEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startMarqueeDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!marqueeMode || interactionMode !== 'design') return;
    const frame = iframeRef.current;
    if (!frame) return;
    e.preventDefault();
    e.stopPropagation();
    const fr = frame.getBoundingClientRect();
    const startX = (e.clientX - fr.left) / scale;
    const startY = (e.clientY - fr.top) / scale;
    let curRect: ElementRect = { x: startX, y: startY, width: 0, height: 0 };
    setMarqueeBox(curRect);

    const onMove = (ev: PointerEvent) => {
      const curX = (ev.clientX - fr.left) / scale;
      const curY = (ev.clientY - fr.top) / scale;
      curRect = {
        x: Math.min(startX, curX),
        y: Math.min(startY, curY),
        width: Math.abs(curX - startX),
        height: Math.abs(curY - startY),
      };
      setMarqueeBox(curRect);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setMarqueeBox(null);
      setMarqueeMode(false);
      if (curRect.width >= 8 && curRect.height >= 8) {
        frame.contentWindow?.postMessage(
          { type: 'studio:query-marquee', rect: curRect },
          '*'
        );
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handles: Array<{ dir: ResizeHandleDir; style: React.CSSProperties; cursor: string }> = [
    { dir: 'nw', style: { top: -8, left: -8 }, cursor: 'nwse-resize' },
    { dir: 'n', style: { top: -8, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { dir: 'ne', style: { top: -8, right: -8 }, cursor: 'nesw-resize' },
    { dir: 'e', style: { top: '50%', right: -8, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
    { dir: 'se', style: { bottom: -8, right: -8 }, cursor: 'nwse-resize' },
    { dir: 's', style: { bottom: -8, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { dir: 'sw', style: { bottom: -8, left: -8 }, cursor: 'nesw-resize' },
    { dir: 'w', style: { top: '50%', left: -8, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  ];

  const scaledFrameWidth = Math.round(targetWidth * scale);
  const scaledFrameHeight = Math.round(frameHeight * scale);
  const selLeft = liveRect ? liveRect.x * scale : 0;
  const selTop = liveRect ? liveRect.y * scale : 0;
  const selWidth = liveRect ? liveRect.width * scale : 0;
  const selHeight = liveRect ? liveRect.height * scale : 0;

  const boxSpacing = selected ? parseComputedBoxSpacing(selected.computedStyles) : null;

  const redlineTargetRect = useMemo(() => {
    if (!showSpecs || !selected || !liveRect) return null;
    if (hoverInfo && hoverInfo.studioId !== selected.studioId) return hoverInfo.rect;
    return selected.parentRect || null;
  }, [showSpecs, selected, liveRect, hoverInfo]);

  const redlineSegments = useMemo(() => {
    if (!showSpecs || !liveRect || !redlineTargetRect) return [];
    return computeRedlineMeasurements(liveRect, redlineTargetRect);
  }, [showSpecs, liveRect, redlineTargetRect]);

  const canWrapMultiSelected = useMemo(() => {
    if (multiSelected.length < 2) return false;
    const fp = multiSelected[0].filePath;
    const psid = multiSelected[0].parentStudioId;
    return Boolean(
      psid && multiSelected.every((item) => item.filePath === fp && item.parentStudioId === psid)
    );
  }, [multiSelected]);

  return (
    <main
      ref={stageRef}
      aria-label="Visual design canvas"
      onWheel={handleStageWheel}
      onPointerDown={startStagePan}
      className={`studio-canvas-grid relative flex min-w-0 flex-1 flex-col items-stretch overflow-auto px-2.5 pt-0 pb-20 lg:px-5 lg:pb-5 ${
        spacePanActive ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* Sticky Canvas HUD Strip + Multi-Align Bar */}
      <div className="sticky top-0 left-0 z-30 -mx-2.5 mb-2 flex flex-col items-center bg-slate-100/85 px-2.5 pt-2.5 pb-1.5 backdrop-blur-xs lg:-mx-5 lg:px-5">
      <div className="flex w-full max-w-6xl flex-wrap items-center justify-between gap-2">
        {isIsolatedComponent ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-900">
            <Component className="h-3.5 w-3.5 text-indigo-600" />
            <span className="font-medium">
              Component Isolation: <code className="font-mono text-[11px]">{activePage.filePath}</code>
            </span>
            {onInsertIsolatedComponent && (
              <div className="flex items-center gap-1 rounded border border-indigo-200 bg-white p-0.5">
                <select
                  aria-label="Isolated component page insert position"
                  value={isolationInsertPos}
                  onChange={(e) =>
                    setIsolationInsertPos(e.target.value as ComponentInsertPosition)
                  }
                  className="h-6 rounded bg-transparent px-1.5 text-[11px] font-medium text-slate-700 focus:outline-none"
                >
                  <option value="before">Before {isolatedTargetLabel || 'target'}</option>
                  <option value="inside-start">Inside top of {isolatedTargetLabel || 'page'}</option>
                  <option value="inside-end">Inside end of {isolatedTargetLabel || 'page'}</option>
                  <option value="after">After {isolatedTargetLabel || 'target'}</option>
                </select>
                <button
                  type="button"
                  onClick={() => onInsertIsolatedComponent(isolationInsertPos)}
                  className="inline-flex h-6 items-center gap-1 rounded bg-indigo-600 px-2 text-[11px] font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-3 w-3" />
                  <span>Insert on Page</span>
                </button>
              </div>
            )}
            {onExitComponentIsolation && (
              <button
                type="button"
                onClick={onExitComponentIsolation}
                className="inline-flex items-center gap-1 rounded border border-indigo-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Back to Page</span>
              </button>
            )}
          </div>
        ) : selected?.ancestry && selected.ancestry.length > 0 ? (
          <nav
            aria-label="Selected element ancestry"
            data-testid="studio-ancestry-breadcrumbs"
            className="flex max-w-full flex-wrap items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-xs"
          >
            {selected.ancestry.slice(-5).map((crumb, idx, arr) => {
              const isCurrent = crumb.studioId === selected.studioId;
              return (
                <React.Fragment key={`${crumb.studioId}-${idx}`}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
                  <button
                    type="button"
                    onClick={() =>
                      iframeRef.current?.contentWindow?.postMessage(
                        { type: 'studio:select-by-id', studioId: crumb.studioId, scroll: false },
                        '*'
                      )
                    }
                    title={`Select ${crumb.label}`}
                    className={`rounded px-1 py-0.5 font-mono transition-colors whitespace-nowrap ${
                      isCurrent
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {crumb.tagName}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Compact Zoom Control */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
            <button
              type="button"
              aria-label="Zoom out canvas"
              onClick={() => setZoomMode(stepCanvasZoom(scale, 'out'))}
              className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <select
              aria-label="Canvas zoom level"
              value={zoomMode === 'fit' ? 'fit' : String(zoomMode)}
              onChange={(e) =>
                setZoomMode(e.target.value === 'fit' ? 'fit' : Number(e.target.value))
              }
              className="bg-transparent px-1 font-mono text-[11px] font-medium tabular-nums text-slate-700 focus:outline-none"
            >
              <option value="fit">Fit ({Math.round(fitScale * 100)}%)</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
            </select>
            <button
              type="button"
              aria-label="Zoom in canvas"
              onClick={() => setZoomMode(stepCanvasZoom(scale, 'in'))}
              className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          {/* Quick Canvas Layout & Library Actions (Desktop/Tablet) */}
          {onOpenLayoutBuilder && (
            <button
              type="button"
              onClick={onOpenLayoutBuilder}
              aria-label="Open layout blocks"
              className="hidden sm:inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
            >
              <LayoutGrid className="h-3 w-3 text-indigo-600" />
              <span>Blocks</span>
            </button>
          )}
          {onOpenLibraryModal && (
            <button
              type="button"
              onClick={onOpenLibraryModal}
              aria-label="Open React Lib UI"
              className="hidden md:inline-flex h-7 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 text-[11px] font-semibold whitespace-nowrap text-indigo-700 hover:bg-indigo-100"
            >
              <PackagePlus className="h-3 w-3 text-indigo-600" />
              <span>React UI</span>
            </button>
          )}
          {onToggleSmartAligner && (
            <button
              type="button"
              onClick={onToggleSmartAligner}
              aria-pressed={showSmartAligner}
              aria-label="Toggle Smart Aligner for mobile and desktop"
              className={`hidden md:inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${
                showSmartAligner
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Wand2 className="h-3 w-3 text-indigo-600" />
              <span>Align</span>
            </button>
          )}
          {onReplayAnimations && (
            <button
              type="button"
              onClick={onReplayAnimations}
              title="Replay scroll-reveal & entrance animations on canvas"
              aria-label="Replay canvas animations"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3 text-indigo-600" />
              <span className="hidden sm:inline">Replay</span>
            </button>
          )}

          {/* Grouped Canvas View Menu (Specs, Grid, Marquee, Split, Snap & Nudge) */}
          <div ref={viewMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={viewMenuOpen}
              aria-haspopup="menu"
              aria-label="Canvas view and snapping options"
              onClick={() => setViewMenuOpen((v) => !v)}
              className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${
                viewMenuOpen ||
                showSpecs ||
                gridOverlay !== 'off' ||
                marqueeMode ||
                splitView ||
                showBeforeAfter ||
                showQaOverlay
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>View</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {viewMenuOpen && (
              <div
                role="menu"
                aria-label="Canvas view options"
                className="absolute right-0 top-9 z-50 w-64 space-y-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5"
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={spacingHandlesEnabled}
                  onClick={() => setSpacingHandlesEnabled((v) => !v)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    spacingHandlesEnabled
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Ruler className="h-3.5 w-3.5" />
                    <span>Padding &amp; Margin Handles</span>
                  </span>
                  <span className="font-mono text-[10px]">
                    {spacingHandlesEnabled ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showSpecs}
                  onClick={() => setSpecsMode((v) => !v)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    showSpecs ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Ruler className="h-3.5 w-3.5" />
                    <span>Redline Specs (Alt)</span>
                  </span>
                  <span className="font-mono text-[10px]">{showSpecs ? 'On' : 'Off'}</span>
                </button>

                {onOpenMultiDeviceWall && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setViewMenuOpen(false);
                      onOpenMultiDeviceWall();
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2">
                      <MonitorSmartphone className="h-3.5 w-3.5 text-blue-600" />
                      <span>Multi-Device Wall (3-Up)</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">Open</span>
                  </button>
                )}

                {onToggleBeforeAfter && (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showBeforeAfter}
                    onClick={() => {
                      setViewMenuOpen(false);
                      onToggleBeforeAfter();
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      showBeforeAfter
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Columns2 className="h-3.5 w-3.5" />
                      <span>Before / After Diff Slider</span>
                    </span>
                    <span className="font-mono text-[10px]">
                      {showBeforeAfter ? 'On' : 'Off'}
                    </span>
                  </button>
                )}

                {onToggleQaOverlay && (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showQaOverlay}
                    onClick={() => {
                      setViewMenuOpen(false);
                      onToggleQaOverlay();
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      showQaOverlay
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Live QA Audit Pins</span>
                    </span>
                    <span className="font-mono text-[10px]">
                      {showQaOverlay ? `${qaIssues.length}` : 'Off'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={marqueeMode}
                  onClick={() => {
                    setMarqueeMode((v) => !v);
                    setViewMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    marqueeMode ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BoxSelect className="h-3.5 w-3.5" />
                    <span>Marquee Multi-Select</span>
                  </span>
                  <span className="font-mono text-[10px]">{marqueeMode ? 'On' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={splitView}
                  onClick={() => setSplitView((v) => !v)}
                  className={`hidden lg:flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    splitView ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Columns2 className="h-3.5 w-3.5" />
                    <span>Mobile Split Mirror</span>
                  </span>
                  <span className="font-mono text-[10px]">{splitView ? 'On' : 'Off'}</span>
                </button>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <Grid3x3 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Grid</span>
                  </span>
                  <select
                    aria-label="Canvas layout grid overlay"
                    value={gridOverlay}
                    onChange={(e) =>
                      setGridOverlay(e.target.value as 'off' | '12col' | '8px' | 'both')
                    }
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="off">Off</option>
                    <option value="12col">12-Col</option>
                    <option value="8px">8px</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                {onToggleSnap && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={onToggleSnap}
                      aria-pressed={snapEnabled}
                      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                        snapEnabled ? 'bg-rose-50 text-rose-700' : 'text-slate-600'
                      }`}
                    >
                      <Magnet className="h-3.5 w-3.5" />
                      <span>Snap {snapEnabled ? 'On' : 'Off'}</span>
                    </button>
                    <select
                      aria-label="Shift-Arrow nudge step"
                      value={nudgeStep}
                      onChange={(e) => setNudgeStep(Number(e.target.value))}
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 focus:outline-none"
                    >
                      {NUDGE_GRID_STEPS.map((st) => (
                        <option key={st} value={st}>
                          {st}px
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Select Alignment & Distribution Bar */}
      {onMultiAlignAction && onWrapMultiSelected && onUpdateMultiSelected && (
        <MultiAlignBar
          count={multiSelected.length}
          canWrapInContainer={canWrapMultiSelected}
          onAlignAction={onMultiAlignAction}
          onWrapContainer={onWrapMultiSelected}
          onClear={() => onUpdateMultiSelected([])}
        />
      )}
      </div>

      {/* Compile Error Banner if uploaded project has syntax issue */}
      {activeCompileErrors.length > 0 && (
        <div className="mx-auto mb-3 w-full max-w-4xl rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
          <strong className="font-semibold">Notice compiling module:</strong> {activeCompileErrors[0]}
        </div>
      )}

      {/* Stage Artboards Container (supports Split Desktop + Mobile Mirror) */}
      <div className="mx-auto flex w-fit items-start gap-4">
      {/* Viewport Frame Wrapper */}
      <div
        className="relative shrink-0"
        style={{
          width: scaledFrameWidth,
          height: scaledFrameHeight,
        }}
      >
        <div
          className="relative origin-top-left overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg"
          style={{
            width: targetWidth,
            height: frameHeight,
            transform: `scale(${scale})`,
          }}
        >
          {touchDiagnostic && (
            <div className="absolute left-1 top-1 z-[100] max-w-[95%] rounded bg-black/90 px-2 py-1 font-mono text-[10px] leading-tight text-white pointer-events-none" data-testid="studio-touch-diagnostic">
              <div className="font-bold">TOUCH DEBUG · {String(touchDiagnostic.stage || '')}</div>
              <div>{String(touchDiagnostic.eventType || '')} · mode={String(touchDiagnostic.mode || '')} · target={String(touchDiagnostic.targetTag || '')}</div>
              <div>id={String(touchDiagnostic.studioId || touchDiagnostic.targetId || 'none')} · xy={String(touchDiagnostic.x ?? '?')},{String(touchDiagnostic.y ?? '?')}</div>
              <div>{String(touchDiagnostic.extra || touchDiagnostic.error || '')}</div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title={`Visual preview of ${activePage.route}`}
            data-testid="studio-preview-iframe"
            srcDoc={docHtml}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0 bg-white"
          />

          {/* Interactive Vector Pen / Node Editor overlay */}
          <VectorPenOverlay width={targetWidth} height={frameHeight} />

          {/* Before / After Live Comparison Overlay (Original vs Edited) */}
          {showBeforeAfter && beforeSrcDoc && (
            <div
              data-testid="studio-before-after-overlay"
              className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
            >
              <div
                className="h-full overflow-hidden border-r-2 border-blue-600"
                style={{ width: `${beforeAfterPct}%` }}
              >
                <iframe
                  title="Original page before edits"
                  srcDoc={beforeSrcDoc}
                  sandbox="allow-scripts allow-same-origin"
                  className="pointer-events-none h-full border-0 bg-white"
                  style={{ width: targetWidth, maxWidth: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Phase 2: Toggleable 12-Column & 8px Baseline Grid Overlays */}
          {(gridOverlay === '8px' || gridOverlay === 'both') && (
            <div
              data-testid="studio-grid-8px"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(37,99,235,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.08) 1px, transparent 1px)',
                backgroundSize: '8px 8px',
              }}
            />
          )}
          {(gridOverlay === '12col' || gridOverlay === 'both') && (
            <div
              data-testid="studio-grid-12col"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 mx-auto grid max-w-[1200px] grid-cols-12 gap-4 px-6"
            >
              {Array.from({ length: 12 }).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className="h-full border-x border-rose-400/20 bg-rose-500/[0.05]"
                />
              ))}
            </div>
          )}
        </div>

        {/* Unscaled Draggable Before / After Split Handle + Badges */}
        {showBeforeAfter && beforeSrcDoc && (
          <div className="pointer-events-none absolute inset-0 z-40">
            <span className="absolute left-3 top-3 rounded-md bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
              Before (Original)
            </span>
            <span className="absolute right-3 top-3 rounded-md bg-blue-600/95 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
              After (Current · {beforeAfterPct}%)
            </span>
            <div
              role="slider"
              aria-label="Before and after comparison divider"
              aria-valuemin={4}
              aria-valuemax={96}
              aria-valuenow={beforeAfterPct}
              tabIndex={0}
              onPointerDown={startBeforeAfterDrag}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setBeforeAfterPct((p) => Math.max(4, p - 5));
                if (e.key === 'ArrowRight') setBeforeAfterPct((p) => Math.min(96, p + 5));
              }}
              className="pointer-events-auto touch-none absolute inset-y-0 w-8 -translate-x-1/2 cursor-ew-resize flex items-center justify-center"
              style={{ left: `${beforeAfterPct}%` }}
            >
              <div className="h-full w-0.5 bg-blue-600 shadow-sm" />
              <div className="absolute flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600 shadow-lg">
                <Columns2 className="h-4 w-4" />
              </div>
            </div>
          </div>
        )}

        {/* Live QA Audit On-Canvas Numbered Pin Badges */}
        {showQaOverlay && qaIssues.length > 0 && !showBeforeAfter && (
          <div className="pointer-events-none absolute inset-0 z-30">
            {qaIssues.map((issue, idx) => {
              const pinLeft = Math.max(6, Math.min(scaledFrameWidth - 26, issue.rect.x * scale));
              const pinTop = Math.max(6, Math.min(scaledFrameHeight - 26, issue.rect.y * scale));
              return (
                <button
                  key={issue.id}
                  type="button"
                  data-testid="qa-canvas-pin"
                  title={`${issue.title} — ${issue.detail}`}
                  aria-label={`QA issue ${idx + 1}: ${issue.title}`}
                  onClick={() => onFocusQaIssue?.(issue)}
                  style={{ left: pinLeft, top: pinTop }}
                  className={`pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white font-mono text-[10px] font-bold text-white shadow-md transition-transform hover:scale-110 ${
                    issue.severity === 'high'
                      ? 'bg-rose-600'
                      : issue.severity === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-slate-600'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Marquee Drag Overlay */}
        {marqueeMode && interactionMode === 'design' && (
          <div
            data-testid="studio-marquee-overlay"
            onPointerDown={startMarqueeDrag}
            className="absolute inset-0 z-40 cursor-crosshair bg-indigo-500/[0.03]"
          >
            {marqueeBox && (
              <div
                className="pointer-events-none absolute border border-indigo-600 bg-indigo-500/15"
                style={{
                  left: marqueeBox.x * scale,
                  top: marqueeBox.y * scale,
                  width: marqueeBox.width * scale,
                  height: marqueeBox.height * scale,
                }}
              />
            )}
          </div>
        )}

        {/* Unscaled Hover Outline Overlay so border and label stay sharp at any zoom */}
        {interactionMode === 'design' && !showBeforeAfter && hoverInfo && (
          <div
            className="pointer-events-none absolute border border-dashed border-blue-500 bg-blue-500/5"
            style={{
              left: hoverInfo.rect.x * scale,
              top: hoverInfo.rect.y * scale,
              width: hoverInfo.rect.width * scale,
              height: hoverInfo.rect.height * scale,
            }}
          >
            <span className="absolute -top-5 left-0 rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
              {hoverInfo.tagName}
            </span>
          </div>
        )}

        {/* Drag-Reorder Insertion Line */}
        {dropIndicator?.rect && (
          <div
            className="pointer-events-none absolute z-30 rounded-full bg-blue-600 shadow-sm"
            style={{
              left: dropIndicator.rect.x * scale,
              top: dropIndicator.rect.y * scale,
              width: Math.max(3, dropIndicator.rect.width * scale),
              height: Math.max(3, dropIndicator.rect.height * scale),
            }}
          />
        )}

        {/* Smart Alignment & Center/Edge Snap Guides */}
        {activeGuides.map((g, i) => (
          <div
            key={`${g.orientation}-${g.position}-${i}`}
            data-testid="studio-alignment-guide"
            className="pointer-events-none absolute z-30"
            style={
              g.orientation === 'vertical'
                ? {
                    left: Math.round(g.position * scale),
                    top: Math.round(g.start * scale),
                    width: 1,
                    height: Math.max(8, Math.round((g.end - g.start) * scale)),
                    backgroundColor: g.kind === 'center' ? '#8B5CF6' : '#F43F5E',
                  }
                : {
                    left: Math.round(g.start * scale),
                    top: Math.round(g.position * scale),
                    width: Math.max(8, Math.round((g.end - g.start) * scale)),
                    height: 1,
                    backgroundColor: g.kind === 'center' ? '#8B5CF6' : '#F43F5E',
                  }
            }
          />
        ))}

        {/* Unscaled Selection Box + 8 Touch-Friendly Resize Handles + Floating Action Toolbar */}
        {interactionMode === 'design' && !showBeforeAfter && selected && liveRect && (
          <div
            data-testid="studio-selection-box"
            className="pointer-events-none absolute z-20 border-2 border-blue-600"
            style={{
              left: selLeft,
              top: selTop,
              width: selWidth,
              height: selHeight,
            }}
          >
            {/* Inline Text Formatting Mini-Bar OR Standard Floating Action Toolbar */}
            {inlineEditing && inlineEditing.studioId === selected.studioId ? (
              <div
                data-testid="studio-inline-text-bar"
                onMouseDown={(e) => e.preventDefault()}
                className="pointer-events-auto absolute flex items-center gap-0.5 rounded-lg border border-blue-500 bg-slate-900 px-1.5 py-1 text-white shadow-xl"
                style={{
                  top: selTop < 48 ? selHeight + 10 : -44,
                  left: Math.max(-selLeft + 4, Math.min(0, scaledFrameWidth - selLeft - 240)),
                }}
              >
                <span className="px-1.5 text-[10px] font-semibold text-sky-300">Editing</span>
                <button
                  type="button"
                  aria-label="Toggle bold text"
                  onClick={() => {
                    const isBold =
                      Number(selected.computedStyles?.fontWeight) >= 700 ||
                      selected.inlineStyles?.fontWeight === '700';
                    onCommitPatch(selected.filePath, selected.elementIndex, {
                      styles: { fontWeight: isBold ? '400' : '700' },
                    });
                  }}
                  className="rounded p-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Toggle italic text"
                  onClick={() => {
                    const isItalic = selected.computedStyles?.fontStyle === 'italic';
                    onCommitPatch(selected.filePath, selected.elementIndex, {
                      styles: { fontStyle: isItalic ? 'normal' : 'italic' },
                    });
                  }}
                  className="rounded p-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Align text left"
                  onClick={() =>
                    onCommitPatch(selected.filePath, selected.elementIndex, {
                      styles: { textAlign: 'left' },
                    })
                  }
                  className="rounded p-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Align text center"
                  onClick={() =>
                    onCommitPatch(selected.filePath, selected.elementIndex, {
                      styles: { textAlign: 'center' },
                    })
                  }
                  className="rounded p-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Align text right"
                  onClick={() =>
                    onCommitPatch(selected.filePath, selected.elementIndex, {
                      styles: { textAlign: 'right' },
                    })
                  }
                  className="rounded p-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Finish text editing"
                  onClick={() =>
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: 'studio:finish-inline-text-edit', commit: true },
                      '*'
                    )
                  }
                  className="ml-1 inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                >
                  <Check className="h-3 w-3" />
                  <span>Done</span>
                </button>
                <button
                  type="button"
                  aria-label="Cancel text editing"
                  onClick={() =>
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: 'studio:finish-inline-text-edit', commit: false },
                      '*'
                    )
                  }
                  className="rounded p-1 text-slate-300 hover:bg-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
            <div
              className="pointer-events-auto absolute flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-700 bg-slate-900 px-1.5 py-1 text-white shadow-lg"
              style={{
                top: selTop < 58 ? selHeight + 20 : -52,
                left: Math.max(-selLeft + 4, Math.min(0, scaledFrameWidth - selLeft - 220)),
              }}
            >
              <span className="px-1 font-mono text-[11px] font-semibold text-sky-300">
                {selected.tagName}
              </span>
              <span className="hidden sm:inline font-mono text-[10px] tabular-nums text-slate-300">
                {Math.round(liveRect.width)}×{Math.round(liveRect.height)}
              </span>

              {selected.isTextEditable && (
                <button
                  type="button"
                  title="Edit text directly on canvas (or double-click / double-tap)"
                  aria-label="Edit text inline"
                  onClick={() =>
                    iframeRef.current?.contentWindow?.postMessage(
                      { type: 'studio:start-inline-text-edit', studioId: selected.studioId },
                      '*'
                    )
                  }
                  className="rounded p-1.5 sm:p-1 text-sky-300 hover:bg-slate-700"
                >
                  <Type className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                </button>
              )}

              {selectedRepeaterCount > 0 && onOpenRepeaterEditor && (
                <button
                  type="button"
                  title="Add, reorder, or edit repeating cards in this grid"
                  onClick={onOpenRepeaterEditor}
                  className="hidden sm:inline-flex items-center gap-1 rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-500"
                >
                  <Layers3 className="h-3 w-3" />
                  <span>Cards ({selectedRepeaterCount})</span>
                </button>
              )}

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
                      title="Drag to reorder in layout"
                      aria-label="Drag to reorder element"
                      onPointerDown={startReorderDrag}
                      className="touch-none cursor-grab rounded p-1.5 sm:p-1 text-slate-200 hover:bg-slate-700 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move up in container"
                      disabled={selected.siblingIndex <= 0}
                      onClick={() =>
                        onMoveSibling(
                          reorderTarget.filePath,
                          reorderTarget.elementIndex,
                          selected.siblingIndex - 1
                        )
                      }
                      className="hidden sm:inline-flex rounded p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-35"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down in container"
                      disabled={selected.siblingIndex >= selected.siblingCount - 1}
                      onClick={() =>
                        onMoveSibling(
                          reorderTarget.filePath,
                          reorderTarget.elementIndex,
                          selected.siblingIndex + 1
                        )
                      }
                      className="hidden sm:inline-flex rounded p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-35"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </>
                );
              })()}

              <button
                type="button"
                title="Drag to reposition offset"
                aria-label="Drag to reposition element"
                onPointerDown={startOffsetDrag}
                className="touch-none cursor-move rounded p-1.5 sm:p-1 text-slate-200 hover:bg-slate-700"
              >
                <Move className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
              {onOpenLibraryModal && (
                <button
                  type="button"
                  title="Replace or insert from React Lib UI"
                  aria-label="Replace or insert with React Lib UI"
                  onClick={onOpenLibraryModal}
                  className="hidden sm:inline-flex rounded p-1 text-indigo-300 hover:bg-slate-700"
                >
                  <PackagePlus className="h-3 w-3" />
                </button>
              )}
              {onOpenMotionStudio && (
                <button
                  type="button"
                  title="Animate selected element in Motion Studio"
                  aria-label="Animate selected element"
                  onClick={onOpenMotionStudio}
                  className="hidden sm:inline-flex rounded p-1 text-amber-300 hover:bg-slate-700"
                >
                  <Clapperboard className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                aria-label="Duplicate selected element"
                onClick={() => onDuplicate(selected.filePath, selected.elementIndex)}
                className="rounded p-1.5 sm:p-1 text-slate-200 hover:bg-slate-700"
              >
                <Copy className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
              <button
                type="button"
                aria-label="Delete selected element"
                onClick={() => onDelete(selected.filePath, selected.elementIndex)}
                className="rounded p-1.5 sm:p-1 text-rose-300 hover:bg-rose-900/60"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
              {onContextMenuElement && (
                <button
                  type="button"
                  title="More element actions (Copy/Paste Styles, Wrap, Logic, Extract)"
                  aria-label="Open element actions menu"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onContextMenuElement({
                      element: selected,
                      x: rect.left,
                      y: rect.bottom + 6,
                      trigger: 'button',
                    });
                  }}
                  className="inline-flex items-center gap-0.5 rounded bg-blue-600 px-1.5 py-1.5 sm:py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  <span className="sm:hidden">More</span>
                </button>
              )}
            </div>
            )}

            {/* 8 Touch-Friendly Resize Handles */}
            {handles.map((h) => (
              <button
                key={h.dir}
                type="button"
                aria-label={`Resize ${h.dir}`}
                onPointerDown={(e) => startResize(h.dir, e)}
                className="pointer-events-auto touch-none absolute flex h-4 w-4 items-center justify-center rounded-full"
                style={{ ...h.style, cursor: h.cursor }}
              >
                <span className="h-2.5 w-2.5 rounded-xs border border-blue-600 bg-white shadow-xs" />
              </button>
            ))}

            {/* Visual Margin (orange) & Padding (green) Overlay Bands when Specs or Spacing Drag is active */}
            {(showSpecs || spacingDragHud) && boxSpacing && (
              <>
                {boxSpacing.margin.top > 0 && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-amber-400/20 border-t border-dashed border-amber-500/70"
                    style={{
                      top: -boxSpacing.margin.top * scale,
                      height: boxSpacing.margin.top * scale,
                    }}
                  />
                )}
                {boxSpacing.margin.bottom > 0 && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 bg-amber-400/20 border-b border-dashed border-amber-500/70"
                    style={{
                      bottom: -boxSpacing.margin.bottom * scale,
                      height: boxSpacing.margin.bottom * scale,
                    }}
                  />
                )}
                {boxSpacing.margin.left > 0 && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 bg-amber-400/20 border-l border-dashed border-amber-500/70"
                    style={{
                      left: -boxSpacing.margin.left * scale,
                      width: boxSpacing.margin.left * scale,
                    }}
                  />
                )}
                {boxSpacing.margin.right > 0 && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 bg-amber-400/20 border-r border-dashed border-amber-500/70"
                    style={{
                      right: -boxSpacing.margin.right * scale,
                      width: boxSpacing.margin.right * scale,
                    }}
                  />
                )}

                {boxSpacing.padding.top > 0 && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 top-0 bg-emerald-400/20"
                    style={{ height: Math.min(selHeight / 2, boxSpacing.padding.top * scale) }}
                  />
                )}
                {boxSpacing.padding.bottom > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 bg-emerald-400/20"
                    style={{ height: Math.min(selHeight / 2, boxSpacing.padding.bottom * scale) }}
                  />
                )}
                {boxSpacing.padding.left > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 bg-emerald-400/20"
                    style={{ width: Math.min(selWidth / 2, boxSpacing.padding.left * scale) }}
                  />
                )}
                {boxSpacing.padding.right > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-0 right-0 top-0 bg-emerald-400/20"
                    style={{ width: Math.min(selWidth / 2, boxSpacing.padding.right * scale) }}
                  />
                )}
              </>
            )}

            {/* Direct On-Canvas Padding (Green, inner) & Margin (Orange, outer) Drag Handles */}
            {spacingHandlesEnabled && !inlineEditing && boxSpacing && selWidth >= 56 && selHeight >= 28 && (
              <>
                {/* Green Padding Drag Handles (inside edges, offset from blue resize handles) */}
                <button
                  type="button"
                  data-testid="spacing-handle-padding-top"
                  title={`Drag top padding (${boxSpacing.padding.top}px) — Shift: Y-axis, Alt: All`}
                  aria-label={`Drag top padding (${boxSpacing.padding.top}px)`}
                  onPointerDown={(e) => startSpacingDrag('padding', 'top', e)}
                  className="pointer-events-auto touch-none absolute left-[28%] top-0.5 -translate-x-1/2 cursor-ns-resize flex h-3 min-w-[26px] items-center justify-center rounded-full bg-emerald-600/90 px-1.5 text-[8px] font-mono font-bold text-white shadow-xs transition-transform hover:scale-110"
                >
                  {boxSpacing.padding.top > 0 ? (
                    boxSpacing.padding.top
                  ) : (
                    <span className="h-0.5 w-3 rounded-full bg-white/90" />
                  )}
                </button>
                <button
                  type="button"
                  data-testid="spacing-handle-padding-bottom"
                  title={`Drag bottom padding (${boxSpacing.padding.bottom}px) — Shift: Y-axis, Alt: All`}
                  aria-label={`Drag bottom padding (${boxSpacing.padding.bottom}px)`}
                  onPointerDown={(e) => startSpacingDrag('padding', 'bottom', e)}
                  className="pointer-events-auto touch-none absolute left-[28%] bottom-0.5 -translate-x-1/2 cursor-ns-resize flex h-3 min-w-[26px] items-center justify-center rounded-full bg-emerald-600/90 px-1.5 text-[8px] font-mono font-bold text-white shadow-xs transition-transform hover:scale-110"
                >
                  {boxSpacing.padding.bottom > 0 ? (
                    boxSpacing.padding.bottom
                  ) : (
                    <span className="h-0.5 w-3 rounded-full bg-white/90" />
                  )}
                </button>
                <button
                  type="button"
                  data-testid="spacing-handle-padding-left"
                  title={`Drag left padding (${boxSpacing.padding.left}px) — Shift: X-axis, Alt: All`}
                  aria-label={`Drag left padding (${boxSpacing.padding.left}px)`}
                  onPointerDown={(e) => startSpacingDrag('padding', 'left', e)}
                  className="pointer-events-auto touch-none absolute left-0.5 top-[28%] -translate-y-1/2 cursor-ew-resize flex h-6 w-3 items-center justify-center rounded-full bg-emerald-600/90 shadow-xs transition-transform hover:scale-110"
                >
                  <span className="h-3 w-0.5 rounded-full bg-white/90" />
                </button>
                <button
                  type="button"
                  data-testid="spacing-handle-padding-right"
                  title={`Drag right padding (${boxSpacing.padding.right}px) — Shift: X-axis, Alt: All`}
                  aria-label={`Drag right padding (${boxSpacing.padding.right}px)`}
                  onPointerDown={(e) => startSpacingDrag('padding', 'right', e)}
                  className="pointer-events-auto touch-none absolute right-0.5 top-[28%] -translate-y-1/2 cursor-ew-resize flex h-6 w-3 items-center justify-center rounded-full bg-emerald-600/90 shadow-xs transition-transform hover:scale-110"
                >
                  <span className="h-3 w-0.5 rounded-full bg-white/90" />
                </button>

                {/* Orange Margin Drag Handles (outside edges, offset from blue resize handles) */}
                <button
                  type="button"
                  data-testid="spacing-handle-margin-top"
                  title={`Drag top margin (${boxSpacing.margin.top}px) — Shift: Y-axis, Alt: All`}
                  aria-label={`Drag top margin (${boxSpacing.margin.top}px)`}
                  onPointerDown={(e) => startSpacingDrag('margin', 'top', e)}
                  className="pointer-events-auto touch-none absolute left-[72%] -top-3.5 -translate-x-1/2 cursor-ns-resize flex h-3 min-w-[26px] items-center justify-center rounded-full bg-amber-500/95 px-1.5 text-[8px] font-mono font-bold text-white shadow-xs transition-transform hover:scale-110"
                >
                  {boxSpacing.margin.top > 0 ? (
                    boxSpacing.margin.top
                  ) : (
                    <span className="h-0.5 w-3 rounded-full bg-white/90" />
                  )}
                </button>
                <button
                  type="button"
                  data-testid="spacing-handle-margin-bottom"
                  title={`Drag bottom margin (${boxSpacing.margin.bottom}px) — Shift: Y-axis, Alt: All`}
                  aria-label={`Drag bottom margin (${boxSpacing.margin.bottom}px)`}
                  onPointerDown={(e) => startSpacingDrag('margin', 'bottom', e)}
                  className="pointer-events-auto touch-none absolute left-[72%] -bottom-3.5 -translate-x-1/2 cursor-ns-resize flex h-3 min-w-[26px] items-center justify-center rounded-full bg-amber-500/95 px-1.5 text-[8px] font-mono font-bold text-white shadow-xs transition-transform hover:scale-110"
                >
                  {boxSpacing.margin.bottom > 0 ? (
                    boxSpacing.margin.bottom
                  ) : (
                    <span className="h-0.5 w-3 rounded-full bg-white/90" />
                  )}
                </button>
                <button
                  type="button"
                  data-testid="spacing-handle-margin-left"
                  title={`Drag left margin (${boxSpacing.margin.left}px) — Shift: X-axis, Alt: All`}
                  aria-label={`Drag left margin (${boxSpacing.margin.left}px)`}
                  onPointerDown={(e) => startSpacingDrag('margin', 'left', e)}
                  className="pointer-events-auto touch-none absolute -left-3.5 top-[72%] -translate-y-1/2 cursor-ew-resize flex h-6 w-3 items-center justify-center rounded-full bg-amber-500/95 shadow-xs transition-transform hover:scale-110"
                >
                  <span className="h-3 w-0.5 rounded-full bg-white/90" />
                </button>
                <button
                  type="button"
                  data-testid="spacing-handle-margin-right"
                  title={`Drag right margin (${boxSpacing.margin.right}px) — Shift: X-axis, Alt: All`}
                  aria-label={`Drag right margin (${boxSpacing.margin.right}px)`}
                  onPointerDown={(e) => startSpacingDrag('margin', 'right', e)}
                  className="pointer-events-auto touch-none absolute -right-3.5 top-[72%] -translate-y-1/2 cursor-ew-resize flex h-6 w-3 items-center justify-center rounded-full bg-amber-500/95 shadow-xs transition-transform hover:scale-110"
                >
                  <span className="h-3 w-0.5 rounded-full bg-white/90" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Phase 2: Multi-Select Bounding Outlines */}
        {interactionMode === 'design' &&
          multiSelected.length >= 2 &&
          multiSelected.map((item) => (
            <div
              key={item.studioId}
              className="pointer-events-none absolute z-20 border-2 border-dashed border-indigo-600 bg-indigo-500/[0.04]"
              style={{
                left: item.rect.x * scale,
                top: item.rect.y * scale,
                width: item.rect.width * scale,
                height: item.rect.height * scale,
              }}
            >
              <span className="absolute -top-4 left-0 rounded bg-indigo-600 px-1 font-mono text-[9px] font-semibold text-white">
                {item.tagName}
              </span>
            </div>
          ))}

        {/* Phase 1: Figma-style Redline Distance Lines */}
        {interactionMode === 'design' &&
          redlineSegments.map((seg) => {
            const x1 = seg.x1 * scale;
            const y1 = seg.y1 * scale;
            const x2 = seg.x2 * scale;
            const y2 = seg.y2 * scale;
            const isHoriz = seg.orientation === 'horizontal';
            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            const length = isHoriz ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const color = seg.kind === 'inset' ? '#6366F1' : '#F43F5E';

            return (
              <div
                key={seg.id}
                data-testid="studio-redline-segment"
                className="pointer-events-none absolute z-30"
              >
                <div
                  style={
                    isHoriz
                      ? {
                          position: 'absolute',
                          left,
                          top: y1,
                          width: Math.max(1, length),
                          height: 1,
                          backgroundColor: color,
                        }
                      : {
                          position: 'absolute',
                          left: x1,
                          top,
                          width: 1,
                          height: Math.max(1, length),
                          backgroundColor: color,
                        }
                  }
                />
                <span
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded px-1 py-0.5 font-mono text-[9px] font-semibold tabular-nums text-white shadow-xs"
                  style={{ left: midX, top: midY, backgroundColor: color }}
                >
                  {seg.label}
                </span>
              </div>
            );
          })}

        {/* Floating Keyboard Nudge / Padding-Margin Drag Live Feedback Pill */}
        {(nudgeHud || spacingDragHud) && (
          <div
            data-testid="studio-spacing-drag-hud"
            className={`pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold tabular-nums text-white shadow-lg ${
              spacingDragHud?.kind === 'padding'
                ? 'bg-emerald-700'
                : spacingDragHud?.kind === 'margin'
                ? 'bg-amber-600'
                : 'bg-slate-900/95'
            }`}
          >
            {spacingDragHud ? (
              <>
                <span>{spacingDragHud.label}</span>
                <span className="hidden sm:inline font-sans text-[10px] font-normal text-white/80">
                  · {spacingDragHud.hint}
                </span>
              </>
            ) : nudgeHud ? (
              `Offset X: ${nudgeHud.x}px · Y: ${nudgeHud.y}px`
            ) : (
              ''
            )}
          </div>
        )}
      </div>

      {/* Phase 3: Side-by-Side Live Mobile Twin Preview (Desktop Split Mode) */}
      {splitView && stageWidth >= 820 && (
        <SplitMobileTwin
          project={project}
          activePage={activePage}
          compiledTailwindCss={compiledTailwindCss}
          isIsolatedComponent={isIsolatedComponent}
          isHtmlPage={isHtmlPage}
          reactPayload={reactPayload}
          htmlPayload={htmlPayload}
          lucideVersion={lucideVersion}
          externalLibVersion={externalLibVersion}
          frameHeight={frameHeight}
          twinScale={0.56}
        />
      )}
      </div>
    </main>
  );
}
