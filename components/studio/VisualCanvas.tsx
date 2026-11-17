'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Move,
  Trash2,
} from 'lucide-react';
import { buildPreviewDocument } from '@/lib/studio/preview-runner';
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
  onSelectElement: (snapshot: StudioElementSnapshot) => void;
  onUpdateLayerTree: (tree: LayerTreeNode[]) => void;
  onNavigateRoute: (route: string) => void;
  onCommitPatch: (filePath: string, elementIndex: number, patch: ElementSourcePatch) => void;
  onMoveSibling: (filePath: string, elementIndex: number, targetIndex: number) => void;
  onDuplicate: (filePath: string, elementIndex: number) => void;
  onDelete: (filePath: string, elementIndex: number) => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
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
  };
}

export default function VisualCanvas({
  project,
  activePage,
  compiledTailwindCss,
  viewport,
  interactionMode,
  selected,
  onSelectElement,
  onUpdateLayerTree,
  onNavigateRoute,
  onCommitPatch,
  onMoveSibling,
  onDuplicate,
  onDelete,
  iframeRef,
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

  const bundle = useMemo(() => {
    if (!mounted) {
      return {
        html: '<!doctype html><html><body style="margin:0;background:#ffffff"></body></html>',
        compileErrors: [] as string[],
      };
    }
    void lucideVersion;
    return buildPreviewDocument(
      project,
      activePage,
      compiledTailwindCss,
      interactionMode,
      selected?.studioId || null
    );
  }, [mounted, lucideVersion, project, activePage, compiledTailwindCss, interactionMode, selected?.studioId]);

  // Listen to designer bridge messages from iframe
  useEffect(() => {
    const handleMessage = (ev: MessageEvent) => {
      const msg = ev.data || {};
      if (msg.type === 'studio:tree') {
        onUpdateLayerTree(msg.tree || []);
      } else if (msg.type === 'studio:hover') {
        if (!msg.studioId) setHoverInfo(null);
        else setHoverInfo({ studioId: msg.studioId, tagName: msg.tagName, rect: msg.rect });
      } else if (msg.type === 'studio:select') {
        setHoverInfo(null);
        if (msg.element) {
          setRectOverride({ studioId: msg.element.studioId, rect: msg.element.rect });
          onSelectElement(msg.element);
        }
      } else if (msg.type === 'studio:selected-rect') {
        if (selected && msg.studioId === selected.studioId) {
          setRectOverride({ studioId: msg.studioId, rect: msg.rect });
        }
      } else if (msg.type === 'studio:inline-text') {
        const sep = typeof msg.studioId === 'string' ? msg.studioId.lastIndexOf('::') : -1;
        if (sep !== -1) {
          const filePath = msg.studioId.slice(0, sep);
          const elementIndex = Number(msg.studioId.slice(sep + 2));
          onCommitPatch(filePath, elementIndex, { textContent: msg.textContent });
        }
      } else if (msg.type === 'studio:navigate') {
        if (typeof msg.route === 'string') {
          onNavigateRoute(msg.route);
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
  }, [onUpdateLayerTree, onSelectElement, onCommitPatch, onNavigateRoute, selected]);

  // Sync mode switches without full rebuild
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'studio:set-mode', mode: interactionMode },
      '*'
    );
  }, [interactionMode, iframeRef]);

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
    const initW = Math.max(24, Math.round(liveRect.width));
    const initH = Math.max(20, Math.round(liveRect.height));
    let finalW = initW;
    let finalH = initH;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const patchStyles: Record<string, string> = {};

      if (dir.includes('e')) {
        finalW = Math.max(24, Math.round(initW + dx));
        patchStyles.width = `${finalW}px`;
      } else if (dir.includes('w')) {
        finalW = Math.max(24, Math.round(initW - dx));
        patchStyles.width = `${finalW}px`;
      }
      if (dir.includes('s')) {
        finalH = Math.max(20, Math.round(initH + dy));
        patchStyles.height = `${finalH}px`;
      } else if (dir.includes('n')) {
        finalH = Math.max(20, Math.round(initH - dy));
        patchStyles.height = `${finalH}px`;
      }

      iframeRef.current?.contentWindow?.postMessage(
        { type: 'studio:preview-style', studioId: selected.studioId, styles: patchStyles },
        '*'
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const committed: Record<string, string> = {};
      if (dir.includes('e') || dir.includes('w')) committed.width = `${finalW}px`;
      if (dir.includes('s') || dir.includes('n')) committed.height = `${finalH}px`;
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

    const onMove = (ev: PointerEvent) => {
      const frame = iframeRef.current;
      if (!frame) return;
      const fr = frame.getBoundingClientRect();
      const ix = (ev.clientX - fr.left) / scale;
      const iy = (ev.clientY - fr.top) / scale;
      frame.contentWindow?.postMessage(
        { type: 'studio:drag-probe', studioId: selected.studioId, x: ix, y: iy },
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
      if (targetIdx !== null && targetIdx !== selected.siblingIndex) {
        onMoveSibling(selected.filePath, selected.elementIndex, targetIdx);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const startOffsetDrag = (e: React.PointerEvent) => {
    if (!selected) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const existingTransform = selected.inlineStyles.transform || selected.computedStyles.transform || '';
    const match = existingTransform.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/);
    const baseX = match ? parseFloat(match[1]) : 0;
    const baseY = match ? parseFloat(match[2]) : 0;
    let nextX = Math.round(baseX);
    let nextY = Math.round(baseY);

    const onMove = (ev: PointerEvent) => {
      nextX = Math.round(baseX + (ev.clientX - startX) / scale);
      nextY = Math.round(baseY + (ev.clientY - startY) / scale);
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'studio:preview-style',
          studioId: selected.studioId,
          styles: { transform: `translate(${nextX}px, ${nextY}px)` },
        },
        '*'
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
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
      {/* Compile Error Banner if uploaded project has syntax issue */}
      {bundle.compileErrors.length > 0 && (
        <div className="mb-3 w-full max-w-4xl rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
          <strong className="font-semibold">Notice compiling module:</strong> {bundle.compileErrors[0]}
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
            srcDoc={bundle.html}
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

              {selected.canReorderSiblings && (
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
                      onMoveSibling(selected.filePath, selected.elementIndex, selected.siblingIndex - 1)
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
                      onMoveSibling(selected.filePath, selected.elementIndex, selected.siblingIndex + 1)
                    }
                    className="rounded p-1.5 sm:p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-35"
                  >
                    <ArrowDown className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </button>
                </>
              )}

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
