'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Component,
  Eye,
  EyeOff,
  FileCode2,
  Layers,
  Lock,
  PackagePlus,
  Plus,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  ComponentTemplatePreset,
  ProjectComponentInfo,
} from '@/lib/studio/component-editor';
import { LayerTreeNode, ProjectPage } from '@/lib/studio/types';
import type { PageTemplatePreset } from '@/lib/studio/page-generator';


const REACT_HOOK_NAMES = ['useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer', 'useContext', 'useId', 'useTransition', 'useDeferredValue', 'useSyncExternalStore'];
const BUILTIN_IMPORTS = new Set(['react', 'react-dom', 'next', 'next/link', 'next/image', 'next/navigation', 'next/headers', 'next/font/google']);

function inspectCustomReactSource(source: string, installed: Record<string, string>) {
  const imports = [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)];
  const importedPackages = new Set<string>();
  for (const match of imports) {
    const specifier = match[1];
    if (!specifier || specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('~/')) continue;
    const parts = specifier.split('/');
    const packageName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    if (!BUILTIN_IMPORTS.has(specifier) && !BUILTIN_IMPORTS.has(packageName)) importedPackages.add(packageName);
  }
  const reactImport = source.match(/import\s+(?:\{([^}]+)\}|React(?:\s*,\s*\{([^}]+)\})?)\s+from\s+['"]react['"]/);
  const importedHooks = new Set((reactImport?.[1] || reactImport?.[2] || '').split(',').map((part) => part.trim().split(/\s+as\s+/).pop() || '').filter(Boolean));
  const usedHooks = REACT_HOOK_NAMES.filter((hook) => new RegExp('\\b' + hook + '\\b').test(source) && !new RegExp('React\\.' + hook + '\\b').test(source));
  return { missingPackages: [...importedPackages].filter((name) => !installed[name]), missingHooks: usedHooks.filter((hook) => !importedHooks.has(hook)) };
}

interface PagesLayersPanelProps {
  pages: ProjectPage[];
  activeRoute: string;
  onSelectPage: (route: string) => void;
  onCreatePage?: (title: string, slug: string, template: PageTemplatePreset, customTemplateCode?: string, customTemplateCss?: string) => boolean | { ok: boolean; error?: string };
  onDeletePage?: (route: string) => boolean;
  installedDependencies?: Record<string, string>;
  onInstallNpmCommand?: (command: string) => boolean | { ok: boolean; error?: string };
  isHtmlProject?: boolean;
  onCreateSiteKit?: () => boolean;
  components?: ProjectComponentInfo[];
  isolatedComponentPath?: string | null;
  onSelectComponent?: (filePath: string) => void;
  onCreateComponent?: (name: string, preset?: ComponentTemplatePreset) => void;
  onInsertComponentOnPage?: (componentFilePath: string) => void;
  onRemoveComponent?: (componentFilePath: string) => void;
  installedLibCount?: number;
  onOpenLibraryModal?: () => void;
  layerTree: LayerTreeNode[];
  selectedStudioId: string | null;
  multiSelectedIds?: string[];
  lockedIds?: string[];
  hiddenIds?: string[];
  onToggleLockLayer?: (studioId: string) => void;
  onToggleHideLayer?: (studioId: string) => void;
  onSelectLayer: (studioId: string) => void;
  onClose?: () => void;
  isBottomSheet?: boolean;
}

export default function PagesLayersPanel({
  pages,
  activeRoute,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  installedDependencies = {},
  onInstallNpmCommand,
  isHtmlProject = false,
  onCreateSiteKit,
  components = [],
  isolatedComponentPath = null,
  onSelectComponent,
  onCreateComponent,
  onInsertComponentOnPage,
  onRemoveComponent,
  installedLibCount = 0,
  onOpenLibraryModal,
  layerTree,
  selectedStudioId,
  multiSelectedIds = [],
  lockedIds = [],
  hiddenIds = [],
  onToggleLockLayer,
  onToggleHideLayer,
  onSelectLayer,
  onClose,
  isBottomSheet = false,
}: PagesLayersPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [topSectionTab, setTopSectionTab] = useState<'pages' | 'components'>('pages');
  const [newCompName, setNewCompName] = useState('');
  const [compPreset, setCompPreset] = useState<ComponentTemplatePreset>('card');
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('New Page');
  const [newPageSlug, setNewPageSlug] = useState('new-page');
  const [pageTemplate, setPageTemplate] = useState<PageTemplatePreset>('landing');
  const [customTemplateCss, setCustomTemplateCss] = useState('');
  const [customTemplateCssName, setCustomTemplateCssName] = useState('');
  const [dependencyCommand, setDependencyCommand] = useState('');
  const [dependencyMessage, setDependencyMessage] = useState('');
  const [customTemplateCode, setCustomTemplateCode] = useState(isHtmlProject
    ? '<main class="mx-auto max-w-6xl px-6 py-16"><h1>{{TITLE}}</h1><p>Build your custom page layout here.</p></main>'
    : '<main className="mx-auto max-w-6xl px-6 py-16"><h1 className="text-4xl font-bold">{{TITLE}}</h1><p className="mt-4 text-slate-600">Build your custom page layout here.</p></main>');
  const dependencyReport = !isHtmlProject && pageTemplate === 'custom' ? inspectCustomReactSource(customTemplateCode, installedDependencies) : { missingPackages: [], missingHooks: [] };
  const [pageError, setPageError] = useState('');
  const [siteKitError, setSiteKitError] = useState('');
  const [siteKitApplied, setSiteKitApplied] = useState(false);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderLayerNode = (node: LayerTreeNode, depth = 0, idx = 0) => {
    const isSelected = node.studioId === selectedStudioId || multiSelectedIds.includes(node.studioId);
    const hasChildren = node.children.length > 0;
    const isCollapsed = Boolean(collapsed[node.studioId]);
    const isLocked = lockedIds.includes(node.studioId);
    const isHidden = hiddenIds.includes(node.studioId);

    return (
      <div key={`${node.studioId}-${depth}-${idx}`}>
        <div
          className={`group flex items-center gap-1 rounded-md pr-1.5 text-xs transition-colors ${
            isSelected
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-slate-700 hover:bg-slate-100'
          } ${isHidden ? 'opacity-50' : ''}`}
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
            disabled={isLocked || isHidden}
            onClick={() => onSelectLayer(node.studioId)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left disabled:cursor-not-allowed"
          >
            <span className="truncate">{node.label}</span>
          </button>

          {(onToggleLockLayer || onToggleHideLayer) && (
            <div
              className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
                isLocked || isHidden ? 'opacity-100' : 'opacity-55 group-hover:opacity-100 focus-within:opacity-100'
              }`}
            >
              {onToggleLockLayer && (
                <button
                  type="button"
                  title={isLocked ? `Unlock ${node.label}` : `Lock ${node.label}`}
                  aria-label={isLocked ? `Unlock layer ${node.label}` : `Lock layer ${node.label}`}
                  aria-pressed={isLocked}
                  onClick={() => onToggleLockLayer(node.studioId)}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded ${
                    isLocked
                      ? 'bg-amber-100 text-amber-700'
                      : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                >
                  {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              )}
              {onToggleHideLayer && (
                <button
                  type="button"
                  title={isHidden ? `Show ${node.label}` : `Hide ${node.label}`}
                  aria-label={isHidden ? `Show layer ${node.label}` : `Hide layer ${node.label}`}
                  aria-pressed={isHidden}
                  onClick={() => onToggleHideLayer(node.studioId)}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded ${
                    isHidden
                      ? 'bg-slate-200 text-slate-700'
                      : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                >
                  {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              )}
            </div>
          )}
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
          <div className="space-y-2">
            {onCreatePage && (
              <div className="space-y-2">
                <button type="button" onClick={() => { setShowNewPage((value) => !value); setPageError(''); }} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-indigo-300 bg-indigo-50 px-2.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                  <Plus className="h-3.5 w-3.5" />Create visual page
                </button>
                {showNewPage && (
                  <form className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5" onSubmit={(event) => {
                    event.preventDefault();
                    setPageError('');
                    const result = onCreatePage(newPageTitle, newPageSlug, pageTemplate, pageTemplate === 'custom' ? customTemplateCode : undefined, pageTemplate === 'custom' ? customTemplateCss : undefined);
                    const created = typeof result === 'boolean' ? result : result.ok;
                    if (created) {
                      setShowNewPage(false);
                      setPageError('');
                      setNewPageTitle('New Page');
                      setNewPageSlug('new-page');
                      setPageTemplate('landing');
                      setCustomTemplateCss('');
                      setCustomTemplateCssName('');
                    } else {
                      setPageError(typeof result === 'boolean'
                        ? 'Could not create the page. Check that the URL is unique and the pasted code is valid.'
                        : (result.error || 'Could not create the page. Check the pasted code and URL path.'));
                    }
                  }}>
                    <label className="block text-[10px] font-semibold text-slate-600">Page name
                      <input value={newPageTitle} onChange={(event) => {
                        const value = event.target.value; setNewPageTitle(value);
                        setNewPageSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                      }} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-slate-800 outline-none focus:border-indigo-500" placeholder="About us" required />
                    </label>
                    <label className="block text-[10px] font-semibold text-slate-600">URL path
                      <div className="mt-1 flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs"><span className="text-slate-400">/</span><input value={newPageSlug} onChange={(event) => setNewPageSlug(event.target.value)} className="min-w-0 flex-1 bg-transparent pl-0.5 text-slate-800 outline-none" placeholder="about" /></div>
                    </label>
                    <label className="block text-[10px] font-semibold text-slate-600">Start from
                      <select value={pageTemplate} onChange={(event) => setPageTemplate(event.target.value as PageTemplatePreset)} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-slate-800">
                        <option value="landing">Landing page</option><option value="blank">Blank canvas</option><option value="about">About page</option><option value="contact">Contact page</option><option value="pricing">Pricing page</option><option value="custom">Custom template (paste code)</option>
                      </select>
                    </label>
                    {pageTemplate === 'custom' && (
                      <label className="block text-[10px] font-semibold text-slate-600">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span>Custom {isHtmlProject ? 'HTML' : 'React / TSX'} layout code</span>
                          <button type="submit" className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm hover:bg-indigo-700">
                            Create from code
                          </button>
                        </div>
                        <textarea
                          value={customTemplateCode}
                          onChange={(event) => setCustomTemplateCode(event.target.value)}
                          rows={7}
                          spellCheck={false}
                          className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-slate-950 p-2.5 font-mono text-[10px] leading-5 text-slate-100 outline-none focus:border-indigo-500"
                          placeholder={isHtmlProject ? '<main>...</main>' : '<main className="...">...</main>'}
                          required
                        />
                        <span className="mt-1 block text-[10px] font-normal leading-4 text-slate-500">
                          {isHtmlProject
                            ? 'Paste a complete HTML document or fragment. Fragments get a basic document wrapper. Click “Create from code” to generate and open the page.'
                            : 'Paste a complete React page component or JSX layout fragment. A fragment is wrapped automatically. Click “Create from code” to generate and open the page.'}
                          {' '}Optional placeholders: {'{{TITLE}}'} and {'{{SLUG}}'}.
                        </span>
                      </label>
                    )}
                    {pageTemplate === 'custom' && !isHtmlProject && (
                      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-amber-950">Code dependency &amp; hook check</span>
                          <span className="text-[10px] text-amber-800">{dependencyReport.missingPackages.length + dependencyReport.missingHooks.length} missing</span>
                        </div>
                        {dependencyReport.missingPackages.length === 0 && dependencyReport.missingHooks.length === 0 ? (
                          <p className="text-[10px] leading-4 text-emerald-700">No missing npm imports or common React hooks detected in the pasted code.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {dependencyReport.missingPackages.map((name) => (
                              <div key={name} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5 text-[10px]">
                                <span className="font-mono font-semibold text-rose-700">{name}</span>
                                <button type="button" onClick={() => setDependencyCommand('npm install ' + name)} className="font-semibold text-indigo-700 underline">Use install command</button>
                              </div>
                            ))}
                            {dependencyReport.missingHooks.length > 0 && (
                              <div className="rounded bg-white p-2 text-[10px] leading-4 text-amber-900">
                                <strong>Missing React hook imports:</strong> {dependencyReport.missingHooks.join(', ')}
                                <p className="mt-1 text-slate-600">These are built into React; no npm install is needed. Add this to the top of your code:</p>
                                <code className="mt-1 block break-all rounded bg-slate-100 p-1">{"import { " + dependencyReport.missingHooks.join(', ') + " } from 'react';"}</code>
                                <button type="button" onClick={() => setCustomTemplateCode((code) => "import { " + dependencyReport.missingHooks.join(', ') + " } from 'react';\n" + code)} className="mt-1 font-semibold text-indigo-700 underline">Add hook imports to code</button>
                              </div>
                            )}
                          </div>
                        )}
                        {onInstallNpmCommand && (
                          <div className="space-y-1.5 border-t border-amber-200 pt-2">
                            <label className="block text-[10px] font-semibold text-slate-700">Install / add missing dependency with npm command</label>
                            <div className="flex gap-1.5">
                              <input value={dependencyCommand} onChange={(event) => { setDependencyCommand(event.target.value); setDependencyMessage(''); }} placeholder="npm install package-name" className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 font-mono text-[10px] text-slate-800" />
                              <button type="button" onClick={() => {
                                const result = onInstallNpmCommand(dependencyCommand);
                                const ok = typeof result === 'boolean' ? result : result.ok;
                                setDependencyMessage(ok ? 'Dependency added to project package.json.' : (typeof result === 'boolean' ? 'Invalid npm command. Use one package: npm install package-name.' : (result.error || 'Could not add dependency.')));
                                if (ok) setDependencyCommand('');
                              }} className="shrink-0 rounded-md bg-indigo-600 px-2.5 text-[10px] font-semibold text-white">Add</button>
                            </div>
                            {dependencyMessage && <p role="status" className="text-[10px] text-slate-700">{dependencyMessage}</p>}
                            <p className="text-[9px] leading-4 text-slate-500">Checks static imports in your TSX and compares package names with package.json. Runtime-only or dynamic imports may need manual review.</p>
                          </div>
                        )}
                      </div>
                    )}
                    {pageTemplate === 'custom' && !isHtmlProject && (
                      <label className="block text-[10px] font-semibold text-slate-600">
                        Optional CSS file (.css)
                        <input
                          type="file"
                          accept=".css,text/css"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              setCustomTemplateCss('');
                              setCustomTemplateCssName('');
                              return;
                            }
                            if (!file.name.toLowerCase().endsWith('.css')) {
                              setPageError('Please choose a .css file.');
                              event.target.value = '';
                              return;
                            }
                            try {
                              const css = await file.text();
                              setCustomTemplateCss(css);
                              setCustomTemplateCssName(file.name);
                              setPageError('');
                            } catch {
                              setPageError('Could not read the CSS file. Try selecting it again.');
                            }
                          }}
                          className="mt-1 block w-full rounded-md border border-slate-200 bg-white p-2 text-[10px] font-normal text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-indigo-700"
                        />
                        {customTemplateCssName && <span className="mt-1 block font-normal text-emerald-700">Loaded: {customTemplateCssName}</span>}
                        <span className="mt-1 block font-normal text-slate-500">WebD saves it beside the new .tsx page and adds the stylesheet import automatically.</span>
                      </label>
                    )}
                    {pageError && <p role="alert" className="text-[10px] text-rose-600">{pageError}</p>}
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setShowNewPage(false)} className="h-8 flex-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-600">Cancel</button>
                      <button type="submit" className="h-8 flex-1 rounded-md bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700">Create page</button>
                    </div>
                    <p className="text-[10px] leading-4 text-slate-400">Creates a real page file. Visual edits stay synced to source code.</p>
                  </form>
                )}
              </div>
            )}
            {onCreateSiteKit && (
              <div className="space-y-1.5 rounded-lg border border-violet-200 bg-violet-50 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-900">
                  <Layers className="h-3.5 w-3.5" /> Shared site design
                </div>
                <p className="text-[10px] leading-4 text-violet-800/80">Add a reusable header, footer and layout. React pages share editable components; HTML pages receive matching shared markup.</p>
                <button type="button" onClick={() => {
                  const created = onCreateSiteKit();
                  setSiteKitApplied(created);
                  setSiteKitError(created ? '' : 'Could not apply the site kit. Check for existing custom SiteLayout files.');
                }} className="w-full rounded-md bg-violet-600 px-2.5 py-2 text-[11px] font-semibold text-white hover:bg-violet-700">
                  Generate shared site kit
                </button>
                {siteKitApplied && <p role="status" className="text-[10px] leading-4 text-emerald-700">Shared site layout applied. Edit SiteHeader or SiteFooter in Components to update connected React pages.</p>}
                {siteKitError && <p role="alert" className="text-[10px] text-rose-600">{siteKitError}</p>}
              </div>
            )}
            <nav aria-label="Project pages" className="max-h-44 space-y-0.5 overflow-y-auto studio-scroll">
              {pages.map((page) => {
                const active = !isolatedComponentPath && page.route === activeRoute;
                const canDelete = Boolean(onDeletePage && page.route !== '/' && pages.length > 1);
                return (
                  <div key={page.filePath} className={`group flex items-center gap-1 rounded-md pr-1 transition-colors ${
                    active ? 'bg-slate-900' : 'hover:bg-slate-100'
                  }`}>
                    <button
                      type="button"
                      onClick={() => onSelectPage(page.route)}
                      className={`flex min-w-0 flex-1 items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        active ? 'font-medium text-white' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{page.title}</span>
                      <span className={`ml-2 shrink-0 font-mono text-[10px] ${
                        active ? 'text-slate-300' : 'text-slate-400'
                      }`}>
                        {page.route}
                      </span>
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        aria-label={`Delete page ${page.title}`}
                        title={`Delete ${page.title}`}
                        onClick={() => {
                          if (window.confirm(`Delete the "${page.title}" page? This removes its page file from the project.`)) {
                            onDeletePage?.(page.route);
                          }
                        }}
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
                          active ? 'text-slate-300 hover:bg-rose-500 hover:text-white' : 'text-slate-400 hover:bg-rose-100 hover:text-rose-600'
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
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
                      {onRemoveComponent && (
                        <button
                          type="button"
                          aria-label={`Remove ${comp.name} component`}
                          title={`Remove ${comp.name} from project and remove its page instances`}
                          onClick={() => {
                            const confirmed = window.confirm(
                              comp.usageCount > 0
                                ? `Remove ${comp.name} from the project? This will also remove its ${comp.usageCount} JSX instance(s) from project files.`
                                : `Remove ${comp.name} from the project?`
                            );
                            if (confirmed) onRemoveComponent(comp.filePath);
                          }}
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                            active ? 'text-white/80 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
