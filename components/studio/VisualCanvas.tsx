'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BoxSelect,
  ChevronRight,
  Columns2,
  Component,
  Copy,
  Grid3x3,
  GripVertical,
  Magnet,
  Move,
  PackagePlus,
  Plus,
  Ruler,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import MultiAlignBar from './MultiAlignBar';
import SplitMobileTwin from './SplitMobileTwin';
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
import {
  MultiAlignAction,
  NUDGE_GRID_STEPS,
  clampZoomScale,
  computeNudgeOffsets,
  computeRedlineMeasurements,
  parseBoxSpacingPx,
  stepZoomScale,
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
}: VisualCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [lucideVersion, setLucideVersion] = useState(0);
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
  const [gridOverlay, setGridOverlay] = useState<'off' | '12col' | '8px' | 'both'>('off');
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [nudgeStep, setNudgeStep] = useState<number>(8);
  const [nudgeHud, setNudgeHud] = useState<{ x: number; y: number } | null>(null);
  const [paddingScrubHud, setPaddingScrubHud] = useState<{ side: string; px: number } | null>(null);
  const [marqueeMode, setMarqueeMode] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<ElementRect | null>(null);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [splitView, setSplitView] = useState(false);

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

  const scale = zoomMode === 'fit' ? fitScale : clampZoomScale(zoomMode);
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
  });
  const callbacksRef = useRef({
    onUpdateLayerTree,
    onSelectElement,
    onUpdateMultiSelected,
    onCommitPatch,
    onNavigateRoute,
    onClearPendingSelect,
  });

  useEffect(() => {
    if (bootedDocKeyRef.current !== docKey) {
      bootedDocKeyRef.current = docKey;
      readyDocKeyRef.current = null;
    }
    docKeyRef.current = docKey;
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
    };
    callbacksRef.current = {
      onUpdateLayerTree,
      onSelectElement,
      onUpdateMultiSelected,
      onCommitPatch,
      onNavigateRoute,
      onClearPendingSelect,
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
            if (latest.bootedProject && latest.bootedProject !== latest.project) {
              if (latest.isHtmlPage && latest.htmlPayload) {
                win.postMessage(
                  {
                    type: 'studio:hot-update-html',
                    bodyHtml: latest.htmlPayload.bodyHtml,
                    userCss: latest.htmlPayload.userCss,
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
    const next = stepZoomScale(cur, e.deltaY < 0 ? 'in' : 'out');
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

  const startPaddingScrub = (
    side: 'top' | 'right' | 'bottom' | 'left',
    initPx: number,
    e: React.PointerEvent
  ) => {
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const propMap = {
      top: 'paddingTop',
      right: 'paddingRight',
      bottom: 'paddingBottom',
      left: 'paddingLeft',
    } as const;
    const startX = e.clientX;
    const startY = e.clientY;
    let latestPx = initPx;
    let didMove = false;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (!didMove && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 3) return;
      didMove = true;
      const delta =
        side === 'top' ? dy : side === 'bottom' ? -dy : side === 'left' ? dx : -dx;
      latestPx = Math.max(0, Math.round(initPx + delta));
      setPaddingScrubHud({ side, px: latestPx });
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'studio:preview-style',
          studioId: selected.studioId,
          styles: { [propMap[side]]: `${latestPx}px` },
        },
        '*'
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setPaddingScrubHud(null);
      if (!didMove) return;
      onCommitPatch(selected.filePath, selected.elementIndex, {
        styles: { [propMap[side]]: `${latestPx}px` },
      });
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

  const boxSpacing = useMemo(
    () => (selected ? parseBoxSpacingPx(selected.computedStyles) : null),
    [selected]
  );

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

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Specs / Redline Measurements Toggle */}
          <button
            type="button"
            onClick={() => setSpecsMode((v) => !v)}
            aria-pressed={showSpecs}
            title="Show redline distance measurements, margin/padding boxes, and direct padding handles (or hold Alt)"
            aria-label="Toggle spacing specs and redlines"
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              showSpecs
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Ruler className="h-3 w-3" />
            <span>Specs</span>
          </button>

          {/* Layout Grid Overlay Selector */}
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]">
            <Grid3x3 className="mr-1 h-3 w-3 text-slate-500" />
            <select
              aria-label="Canvas layout grid overlay"
              value={gridOverlay}
              onChange={(e) =>
                setGridOverlay(e.target.value as 'off' | '12col' | '8px' | 'both')
              }
              className="bg-transparent py-0.5 text-[11px] font-medium text-slate-700 focus:outline-none"
            >
              <option value="off">Grid: Off</option>
              <option value="12col">12-Col</option>
              <option value="8px">8px Grid</option>
              <option value="both">12-Col + 8px</option>
            </select>
          </div>

          {/* Marquee Multi-Select Toggle */}
          <button
            type="button"
            onClick={() => setMarqueeMode((v) => !v)}
            aria-pressed={marqueeMode}
            title="Drag a selection box across multiple elements (or Shift+Click elements)"
            aria-label="Toggle marquee multi-select"
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              marqueeMode
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <BoxSelect className="h-3 w-3" />
            <span className="hidden sm:inline">Marquee</span>
          </button>

          {/* Zoom Controls */}
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 text-[11px]">
            <button
              type="button"
              aria-label="Zoom out canvas"
              onClick={() => setZoomMode(stepZoomScale(scale, 'out'))}
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
              onClick={() => setZoomMode(stepZoomScale(scale, 'in'))}
              className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          {/* Desktop + Mobile Split View Toggle */}
          <button
            type="button"
            onClick={() => setSplitView((v) => !v)}
            aria-pressed={splitView}
            title="Show live Mobile 390px mirror beside Desktop canvas"
            aria-label="Toggle side-by-side mobile split view"
            className={`hidden lg:inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
              splitView
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Columns2 className="h-3 w-3" />
            <span>Split</span>
          </button>

          {onToggleSmartAligner && (
            <button
              type="button"
              onClick={onToggleSmartAligner}
              aria-pressed={showSmartAligner}
              aria-label="Toggle Smart Aligner for mobile and desktop"
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                showSmartAligner
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Wand2 className="h-3 w-3 text-indigo-600" />
              <span>Smart Align</span>
            </button>
          )}
          {onOpenLibraryModal && (
            <button
              type="button"
              onClick={onOpenLibraryModal}
              aria-label="Open React Lib UI"
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-indigo-700 hover:bg-indigo-100"
            >
              <PackagePlus className="h-3 w-3 text-indigo-600" />
              <span>React Lib UI</span>
            </button>
          )}
          {onToggleSnap && (
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                onClick={onToggleSnap}
                aria-pressed={snapEnabled}
                aria-label="Toggle alignment guides and snapping"
                className={`inline-flex items-center gap-1 rounded-l-md px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  snapEnabled
                    ? 'bg-rose-50 text-rose-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Magnet className="h-3 w-3" />
                <span>Snap {snapEnabled ? 'On' : 'Off'}</span>
              </button>
              <select
                aria-label="Shift-Arrow nudge step"
                title="Shift + Arrow key nudge step"
                value={nudgeStep}
                onChange={(e) => setNudgeStep(Number(e.target.value))}
                className="border-l border-slate-200 bg-transparent px-1 py-1 font-mono text-[10px] font-medium text-slate-600 focus:outline-none"
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
          <iframe
            ref={iframeRef}
            title={`Visual preview of ${activePage.route}`}
            data-testid="studio-preview-iframe"
            srcDoc={docHtml}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0 bg-white"
          />

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
        {interactionMode === 'design' && hoverInfo && (
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
        {interactionMode === 'design' && selected && liveRect && (
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
            {/* Floating Action Toolbar (stays unscaled & clamped inside viewport) */}
            <div
              className="pointer-events-auto absolute flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-700 bg-slate-900 px-1.5 py-1 text-white shadow-lg"
              style={{
                top: selTop < 44 ? selHeight + 10 : -40,
                left: Math.max(-selLeft + 4, Math.min(0, scaledFrameWidth - selLeft - 248)),
              }}
            >
              <span className="px-1 font-mono text-[11px] font-semibold text-sky-300">
                {selected.tagName}
              </span>
              <span className="hidden sm:inline font-mono text-[10px] tabular-nums text-slate-300">
                {Math.round(liveRect.width)}×{Math.round(liveRect.height)}
              </span>

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
                      className="rounded p-1.5 sm:p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-35"
                    >
                      <ArrowUp className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
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
                      className="rounded p-1.5 sm:p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-35"
                    >
                      <ArrowDown className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
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
                  className="rounded p-1.5 sm:p-1 text-indigo-300 hover:bg-slate-700"
                >
                  <PackagePlus className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
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
            </div>

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

            {/* Phase 1: Visual Margin (amber) & Padding (emerald) Box Overlays + Direct Drag Ticks */}
            {showSpecs && boxSpacing && (
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

                {/* Direct On-Canvas Padding Drag Ticks (offset from n/w resize handles) */}
                <button
                  type="button"
                  title={`Drag top padding (${boxSpacing.padding.top}px)`}
                  aria-label="Drag top padding"
                  onPointerDown={(e) => startPaddingScrub('top', boxSpacing.padding.top, e)}
                  className="pointer-events-auto touch-none absolute left-[26%] -translate-x-1/2 cursor-ns-resize rounded-full bg-emerald-600 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white shadow-xs"
                  style={{ top: Math.min(selHeight - 16, Math.max(8, Math.round(boxSpacing.padding.top * scale * 0.5))) }}
                >
                  {boxSpacing.padding.top}
                </button>
                <button
                  type="button"
                  title={`Drag left padding (${boxSpacing.padding.left}px)`}
                  aria-label="Drag left padding"
                  onPointerDown={(e) => startPaddingScrub('left', boxSpacing.padding.left, e)}
                  className="pointer-events-auto touch-none absolute top-[74%] -translate-y-1/2 cursor-ew-resize rounded-full bg-emerald-600 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white shadow-xs"
                  style={{ left: Math.min(selWidth - 22, Math.max(8, Math.round(boxSpacing.padding.left * scale * 0.5))) }}
                >
                  {boxSpacing.padding.left}
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

        {/* Floating Keyboard Nudge / Padding Scrub Live Feedback Pill */}
        {(nudgeHud || paddingScrubHud) && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-md bg-slate-900/95 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-white shadow-lg">
            {paddingScrubHud
              ? `padding-${paddingScrubHud.side}: ${paddingScrubHud.px}px`
              : nudgeHud
                ? `Offset X: ${nudgeHud.x}px · Y: ${nudgeHud.y}px`
                : ''}
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
