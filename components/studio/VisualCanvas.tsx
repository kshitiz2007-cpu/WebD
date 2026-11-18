'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Component,
  Copy,
  GripVertical,
  Magnet,
  Move,
  PackagePlus,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
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
  pendingSelectStudioId?: string | null;
  onClearPendingSelect?: () => void;
  onSelectElement: (snapshot: StudioElementSnapshot) => void;
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
  const scale = useMemo(() => {
    const gutter = stageWidth < 640 ? 20 : 48;
    const usable = Math.max(280, stageWidth - gutter);
    return Math.min(1, Number((usable / targetWidth).toFixed(4)));
  }, [stageWidth, targetWidth]);

  const frameHeight = Math.max(540, Math.round((stageHeight - 40) / scale));

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
          callbacksRef.current.onSelectElement(msg.element);
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

  // Sync mode switches without full rebuild
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:set-mode', mode: interactionMode },
      '*'
    );
  }, [interactionMode, iframeRef]);

  // Refresh selected element snapshot after viewport width changes without scrolling
  useEffect(() => {
    const studioId = selected?.studioId;
    if (!studioId) return;
    const timer = window.setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'studio:select-by-id', studioId, scroll: false },
        '*'
      );
    }, 90);
    return () => window.clearTimeout(timer);
  }, [viewport, selected?.studioId, iframeRef]);

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

  return (
    <main
      ref={stageRef}
      aria-label="Visual design canvas"
      className="studio-canvas-grid relative flex min-w-0 flex-1 flex-col items-center overflow-auto px-2.5 pt-3 pb-20 lg:p-5"
    >
      {/* Canvas HUD Strip: Isolated Component Banner & Snap Guides Toggle */}
      <div className="mb-2 flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
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
        ) : (
          <div />
        )}

        <div className="flex flex-wrap items-center gap-1.5">
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
              aria-label="Import React library"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
            >
              <PackagePlus className="h-3 w-3 text-indigo-600" />
              <span>React Libs</span>
            </button>
          )}
          {onToggleSnap && (
            <button
              type="button"
              onClick={onToggleSnap}
              aria-pressed={snapEnabled}
              aria-label="Toggle alignment guides and snapping"
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                snapEnabled
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              <Magnet className="h-3 w-3" />
              <span>Snap {snapEnabled ? 'On' : 'Off'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Compile Error Banner if uploaded project has syntax issue */}
      {activeCompileErrors.length > 0 && (
        <div className="mb-3 w-full max-w-4xl rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
          <strong className="font-semibold">Notice compiling module:</strong> {activeCompileErrors[0]}
        </div>
      )}

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
        </div>

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
          </div>
        )}
      </div>
    </main>
  );
}
