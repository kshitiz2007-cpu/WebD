'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, Layers, X } from 'lucide-react';
import { LayerTreeNode, ProjectPage } from '@/lib/studio/types';

interface PagesLayersPanelProps {
  pages: ProjectPage[];
  activeRoute: string;
  onSelectPage: (route: string) => void;
  layerTree: LayerTreeNode[];
  selectedStudioId: string | null;
  onSelectLayer: (studioId: string) => void;
  onClose?: () => void;
  isBottomSheet?: boolean;
}

export default function PagesLayersPanel({
  pages,
  activeRoute,
  onSelectPage,
  layerTree,
  selectedStudioId,
  onSelectLayer,
  onClose,
  isBottomSheet = false,
}: PagesLayersPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderLayerNode = (node: LayerTreeNode, depth = 0, idx = 0) => {
    const isSelected = node.studioId === selectedStudioId;
    const hasChildren = node.children.length > 0;
    const isCollapsed = Boolean(collapsed[node.studioId]);

    return (
      <div key={`${node.studioId}-${depth}-${idx}`}>
        <div
          className={`flex items-center gap-1 rounded-md pr-2 text-xs transition-colors ${
            isSelected
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isCollapsed ? `Expand ${node.tagName}` : `Collapse ${node.tagName}`}
              onClick={() => toggleCollapse(node.studioId)}
              className="flex h-6 w-4 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700"
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="inline-block w-4 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => onSelectLayer(node.studioId)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
          >
            <span className="truncate">{node.label}</span>
          </button>
        </div>

        {hasChildren && !isCollapsed && (
          <div>{node.children.map((child, childIdx) => renderLayerNode(child, depth + 1, childIdx))}</div>
        )}
      </div>
    );
  };

  return (
    <aside
      aria-label="Pages and Layers"
      className={`flex h-full flex-col bg-white ${
        isBottomSheet
          ? 'w-full rounded-t-2xl'
          : 'w-[252px] shrink-0 border-r border-slate-200'
      }`}
    >
      {isBottomSheet && (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="text-xs font-semibold text-slate-900">Pages &amp; Layers</span>
          {onClose && (
            <button
              type="button"
              aria-label="Close pages and layers panel"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Pages Section */}
      <div className="border-b border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <FileCode2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Pages</span>
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-slate-400">
            {pages.length}
          </span>
        </div>

        <nav aria-label="Project pages" className="max-h-44 space-y-0.5 overflow-y-auto studio-scroll">
          {pages.map((page) => {
            const active = page.route === activeRoute;
            return (
              <button
                key={page.filePath}
                type="button"
                onClick={() => onSelectPage(page.route)}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                  active
                    ? 'bg-slate-900 font-medium text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{page.title}</span>
                <span
                  className={`ml-2 shrink-0 font-mono text-[10px] ${
                    active ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {page.route}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Layers Section */}
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>Page Layers</span>
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto studio-scroll">
          {layerTree.length === 0 ? (
            <p className="px-2 py-4 text-xs text-slate-400">
              Loading page elements...
            </p>
          ) : (
            <div className="space-y-0.5">
              {layerTree.map((node, idx) => renderLayerNode(node, 0, idx))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
