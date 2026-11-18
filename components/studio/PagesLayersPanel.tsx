'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Component,
  FileCode2,
  Layers,
  PackagePlus,
  Plus,
  X,
} from 'lucide-react';
import {
  ComponentTemplatePreset,
  ProjectComponentInfo,
} from '@/lib/studio/component-editor';
import { LayerTreeNode, ProjectPage } from '@/lib/studio/types';

interface PagesLayersPanelProps {
  pages: ProjectPage[];
  activeRoute: string;
  onSelectPage: (route: string) => void;
  components?: ProjectComponentInfo[];
  isolatedComponentPath?: string | null;
  onSelectComponent?: (filePath: string) => void;
  onCreateComponent?: (name: string, preset?: ComponentTemplatePreset) => void;
  onInsertComponentOnPage?: (componentFilePath: string) => void;
  installedLibCount?: number;
  onOpenLibraryModal?: () => void;
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
  components = [],
  isolatedComponentPath = null,
  onSelectComponent,
  onCreateComponent,
  onInsertComponentOnPage,
  installedLibCount = 0,
  onOpenLibraryModal,
  layerTree,
  selectedStudioId,
  onSelectLayer,
  onClose,
  isBottomSheet = false,
}: PagesLayersPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [topSectionTab, setTopSectionTab] = useState<'pages' | 'components'>('pages');
  const [newCompName, setNewCompName] = useState('');
  const [compPreset, setCompPreset] = useState<ComponentTemplatePreset>('card');

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
          <span className="text-xs font-semibold text-slate-900">Pages, Components &amp; Layers</span>
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

      {/* Pages / Components Switcher */}
      <div className="border-b border-slate-200 p-3">
        <div
          className="mb-2 grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-0.5"
          role="tablist"
          aria-label="Pages or Components"
        >
          <button
            type="button"
            role="tab"
            aria-selected={topSectionTab === 'pages'}
            onClick={() => setTopSectionTab('pages')}
            className={`inline-flex items-center justify-center gap-1 rounded py-1 text-[11px] font-semibold transition-colors ${
              topSectionTab === 'pages'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="h-3 w-3" />
            <span>Pages ({pages.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={topSectionTab === 'components'}
            onClick={() => setTopSectionTab('components')}
            className={`inline-flex items-center justify-center gap-1 rounded py-1 text-[11px] font-semibold transition-colors ${
              topSectionTab === 'components'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Component className="h-3 w-3" />
            <span>Components ({components.length})</span>
          </button>
        </div>

        {topSectionTab === 'pages' ? (
          <nav aria-label="Project pages" className="max-h-44 space-y-0.5 overflow-y-auto studio-scroll">
            {pages.map((page) => {
              const active = !isolatedComponentPath && page.route === activeRoute;
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
        ) : (
          <div className="space-y-2">
            {onCreateComponent && (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    aria-label="New component name"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCompName.trim()) {
                        onCreateComponent(newCompName.trim(), compPreset);
                        setNewCompName('');
                      }
                    }}
                    placeholder="FeatureCard..."
                    className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                  <select
                    aria-label="Component starter template"
                    value={compPreset}
                    onChange={(e) => setCompPreset(e.target.value as ComponentTemplatePreset)}
                    className="h-7 rounded border border-slate-200 bg-white px-1 text-[10px] font-medium text-slate-700"
                  >
                    <option value="card">Card</option>
                    <option value="hero">Hero</option>
                    <option value="cta">CTA</option>
                    <option value="stats">Stats</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Create component"
                    disabled={!newCompName.trim()}
                    onClick={() => {
                      if (!newCompName.trim()) return;
                      onCreateComponent(newCompName.trim(), compPreset);
                      setNewCompName('');
                    }}
                    className="inline-flex h-7 items-center gap-0.5 rounded bg-indigo-600 px-2 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                    <span>New</span>
                  </button>
                </div>
              </div>
            )}

            <nav aria-label="Project components" className="max-h-36 space-y-0.5 overflow-y-auto studio-scroll">
              {components.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-slate-400">
                  No standalone components yet. Create one above or extract from a page element.
                </p>
              ) : (
                components.map((comp) => {
                  const active = isolatedComponentPath === comp.filePath;
                  return (
                    <div
                      key={comp.filePath}
                      className={`flex items-center justify-between gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectComponent?.(comp.filePath)}
                        title={`Design or redesign <${comp.name} />`}
                        className="flex min-w-0 flex-1 items-center justify-between gap-1.5 py-0.5 text-left"
                      >
                        <span className="truncate font-medium">{comp.name}</span>
                        <span
                          className={`shrink-0 font-mono text-[10px] ${
                            active ? 'text-indigo-100' : 'text-slate-400'
                          }`}
                        >
                          {comp.usageCount}×
                        </span>
                      </button>
                      {onInsertComponentOnPage && (
                        <button
                          type="button"
                          aria-label={`Insert ${comp.name} onto page`}
                          title={`Insert <${comp.name} /> onto page`}
                          onClick={() => onInsertComponentOnPage(comp.filePath)}
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            active
                              ? 'bg-white/20 text-white hover:bg-white/30'
                              : 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                          }`}
                        >
                          Insert
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </nav>

            {onOpenLibraryModal && (
              <button
                type="button"
                onClick={onOpenLibraryModal}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span className="flex items-center gap-1.5">
                  <PackagePlus className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Import React Library</span>
                </span>
                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 border border-slate-200">
                  {installedLibCount}
                </span>
              </button>
            )}
          </div>
        )}
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
