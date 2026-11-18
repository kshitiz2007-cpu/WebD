'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Blocks,
  Box,
  Check,
  Code2,
  CornerDownRight,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Replace,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ComponentInsertPosition,
  ComponentTemplatePreset,
  ProjectComponentInfo,
} from '@/lib/studio/component-editor';
import {
  COMMON_REACT_LIBRARIES,
  ReactLibraryCatalogEntry,
  isValidPackageName,
  scanExternalImportsInSource,
} from '@/lib/studio/library-importer';
import {
  REACT_UI_CATEGORIES,
  REACT_UI_LIBRARY_ITEMS,
  ReactUiCategory,
  ReactUiLibraryEntry,
  filterReactUiCatalog,
} from '@/lib/studio/react-ui-catalog';
import { ParsedElement, scanElements } from '@/lib/studio/source-editor';
import ReactUiThumbnail from './ReactUiThumbnail';

export interface SelectedTargetContext {
  filePath: string;
  elementIndex: number;
  tagName: string;
  textPreview?: string;
}

interface ReactLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: Record<string, string>;
  defaultTargetFile: string;
  selectedTarget?: SelectedTargetContext | null;
  projectComponents: ProjectComponentInfo[];
  dependencies: Record<string, string>;
  onApplyUiComponent: (params: {
    targetFilePath: string;
    targetElementIndex: number;
    entry: ReactUiLibraryEntry;
    action: 'replace' | 'insert';
    position?: ComponentInsertPosition;
    integrationMode: 'component' | 'inline';
    customProps?: Record<string, string>;
  }) => { ok: boolean; error?: string; createdComponentPath?: string };
  onApplyProjectComponent: (params: {
    targetFilePath: string;
    targetElementIndex: number;
    componentFilePath: string;
    action: 'replace' | 'insert';
    position?: ComponentInsertPosition;
    props?: Record<string, string>;
  }) => { ok: boolean; error?: string };
  onCreateComponent?: (name: string, preset: ComponentTemplatePreset) => void;
  onIsolateComponent?: (componentFilePath: string) => void;
  onImportLibrary: (params: {
    packageName: string;
    version?: string;
    importMode: 'named' | 'default' | 'namespace';
    identifiers: string[];
    targetFilePath: string;
    sampleJsx?: string;
    action?: 'replace' | 'insert';
    position?: ComponentInsertPosition;
    targetElementIndex?: number;
  }) => { ok: boolean; error?: string };
  onRemoveDependency: (packageName: string) => void;
}

function getElementSlotLabel(code: string, el: ParsedElement): string {
  if (el.selfClosing || el.closeStart <= el.openEnd) {
    return `#${el.index} <${el.tagName}>`;
  }
  const inner = code
    .slice(el.openEnd, Math.min(el.closeStart, el.openEnd + 160))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!inner) return `#${el.index} <${el.tagName}>`;
  const clipped = inner.length > 18 ? `${inner.slice(0, 18)}...` : inner;
  return `#${el.index} <${el.tagName}> "${clipped}"`;
}

export default function ReactLibraryModal(props: ReactLibraryModalProps) {
  if (!props.isOpen) return null;
  return <ReactLibraryModalInner {...props} />;
}

function ReactLibraryModalInner({
  onClose,
  files,
  defaultTargetFile,
  selectedTarget,
  projectComponents,
  dependencies,
  onApplyUiComponent,
  onApplyProjectComponent,
  onCreateComponent,
  onIsolateComponent,
  onImportLibrary,
  onRemoveDependency,
}: ReactLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<'ui' | 'project' | 'packages'>('ui');
  const [targetFile, setTargetFile] = useState(
    selectedTarget?.filePath && files[selectedTarget.filePath]
      ? selectedTarget.filePath
      : defaultTargetFile
  );
  const [targetElIndex, setTargetElIndex] = useState<number>(
    selectedTarget?.elementIndex ?? 0
  );

  // UI Library Catalog state
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<ReactUiCategory>('All');
  const [pickedUiId, setPickedUiId] = useState<string>(REACT_UI_LIBRARY_ITEMS[0].id);
  const [integrationMode, setIntegrationMode] = useState<'component' | 'inline'>('component');
  const [propOverridesById, setPropOverridesById] = useState<
    Record<string, Record<string, string>>
  >({});
  const [showCodePreview, setShowCodePreview] = useState(false);

  // Project Component Tab state
  const [pickedProjectCompPath, setPickedProjectCompPath] = useState<string>(
    projectComponents[0]?.filePath || ''
  );
  const [projectPropOverridesByPath, setProjectPropOverridesByPath] = useState<
    Record<string, Record<string, string>>
  >({});
  const [newCompName, setNewCompName] = useState('');
  const [newCompPreset, setNewCompPreset] = useState<ComponentTemplatePreset>('card');

  // npm Packages Tab state
  const [pkgName, setPkgName] = useState('');
  const [importMode, setImportMode] = useState<'named' | 'default' | 'namespace'>('named');
  const [identifiersText, setIdentifiersText] = useState('');
  const [pkgSearch, setPkgSearch] = useState('');

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sourceFiles = useMemo(
    () => Object.keys(files).filter((p) => /\.(tsx|jsx|ts|js)$/i.test(p)).sort(),
    [files]
  );

  const reactTargetFiles = useMemo(
    () => sourceFiles.filter((p) => /\.(tsx|jsx)$/i.test(p)),
    [sourceFiles]
  );

  const resolvedTargetFile = files[targetFile]
    ? targetFile
    : files[defaultTargetFile]
    ? defaultTargetFile
    : reactTargetFiles[0] || sourceFiles[0] || 'app/page.tsx';

  const resolvedFileCode = files[resolvedTargetFile] || '';

  const targetElements = useMemo(() => {
    const isHtml = /\.html?$/i.test(resolvedTargetFile);
    return scanElements(resolvedFileCode, isHtml).slice(0, 80);
  }, [resolvedFileCode, resolvedTargetFile]);

  const resolvedElementIndex = useMemo(() => {
    if (targetElements.some((el) => el.index === targetElIndex)) return targetElIndex;
    return targetElements[0]?.index ?? 0;
  }, [targetElements, targetElIndex]);

  const activeTargetElement = useMemo(
    () => targetElements.find((el) => el.index === resolvedElementIndex) || targetElements[0],
    [targetElements, resolvedElementIndex]
  );

  const filteredUiItems = useMemo(
    () => filterReactUiCatalog(REACT_UI_LIBRARY_ITEMS, searchQuery, category),
    [searchQuery, category]
  );

  const activeUiEntry = useMemo(
    () =>
      filteredUiItems.find((i) => i.id === pickedUiId) ||
      REACT_UI_LIBRARY_ITEMS.find((i) => i.id === pickedUiId) ||
      filteredUiItems[0] ||
      REACT_UI_LIBRARY_ITEMS[0],
    [filteredUiItems, pickedUiId]
  );

  const propDrafts = useMemo(
    () => ({
      ...activeUiEntry.defaultProps,
      ...(propOverridesById[activeUiEntry.id] || {}),
    }),
    [activeUiEntry, propOverridesById]
  );

  const insertableProjectComponents = useMemo(
    () => projectComponents.filter((c) => c.filePath !== resolvedTargetFile),
    [projectComponents, resolvedTargetFile]
  );

  const activeProjectComp = useMemo(
    () =>
      insertableProjectComponents.find((c) => c.filePath === pickedProjectCompPath) ||
      insertableProjectComponents[0] ||
      null,
    [insertableProjectComponents, pickedProjectCompPath]
  );

  const projectPropDrafts = useMemo(() => {
    if (!activeProjectComp) return {};
    const defaults: Record<string, string> = {};
    for (const p of activeProjectComp.props) {
      defaults[p.name] = p.defaultValue || '';
    }
    return {
      ...defaults,
      ...(projectPropOverridesByPath[activeProjectComp.filePath] || {}),
    };
  }, [activeProjectComp, projectPropOverridesByPath]);

  const currentFileImports = useMemo(
    () => scanExternalImportsInSource(resolvedFileCode),
    [resolvedFileCode]
  );

  const filteredPackages = useMemo(() => {
    const q = pkgSearch.trim().toLowerCase();
    if (!q) return COMMON_REACT_LIBRARIES;
    return COMMON_REACT_LIBRARIES.filter(
      (lib) =>
        lib.packageName.toLowerCase().includes(q) ||
        lib.description.toLowerCase().includes(q) ||
        lib.suggestedIdentifiers.some((id) => id.toLowerCase().includes(q))
    );
  }, [pkgSearch]);

  const targetTagLabel =
    selectedTarget &&
    selectedTarget.filePath === resolvedTargetFile &&
    selectedTarget.elementIndex === resolvedElementIndex
      ? `<${selectedTarget.tagName}>`
      : activeTargetElement
      ? `<${activeTargetElement.tagName}>`
      : 'root';

  const handleUiAction = (
    action: 'replace' | 'insert',
    position?: ComponentInsertPosition
  ) => {
    setErrorMsg(null);
    const res = onApplyUiComponent({
      targetFilePath: resolvedTargetFile,
      targetElementIndex: resolvedElementIndex,
      entry: activeUiEntry,
      action,
      position,
      integrationMode,
      customProps: propDrafts,
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not apply UI component.');
      return;
    }
    const modeLabel =
      integrationMode === 'component' ? `<${activeUiEntry.componentName} />` : activeUiEntry.title;
    setStatusNotice(
      action === 'replace'
        ? `Replaced ${targetTagLabel} with ${modeLabel} in ${resolvedTargetFile}`
        : `Inserted ${modeLabel} (${position || 'after'}) near ${targetTagLabel} in ${resolvedTargetFile}`
    );
  };

  const handleProjectCompAction = (
    action: 'replace' | 'insert',
    position?: ComponentInsertPosition
  ) => {
    if (!activeProjectComp) return;
    setErrorMsg(null);
    const res = onApplyProjectComponent({
      targetFilePath: resolvedTargetFile,
      targetElementIndex: resolvedElementIndex,
      componentFilePath: activeProjectComp.filePath,
      action,
      position,
      props: projectPropDrafts,
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not apply project component.');
      return;
    }
    setStatusNotice(
      action === 'replace'
        ? `Replaced ${targetTagLabel} with <${activeProjectComp.name} /> in ${resolvedTargetFile}`
        : `Inserted <${activeProjectComp.name} /> (${position || 'after'}) in ${resolvedTargetFile}`
    );
  };

  const handleCustomImport = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanPkg = pkgName.trim();
    if (!isValidPackageName(cleanPkg)) {
      setErrorMsg('Enter a valid npm package name (e.g. recharts, sonner, @tanstack/react-table).');
      return;
    }
    const rawIds = identifiersText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const fallbackId =
      cleanPkg
        .split('/')
        .pop()
        ?.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
        .replace(/[^a-zA-Z0-9]/g, '') || 'LibModule';

    const ids = rawIds.length > 0 ? rawIds : [fallbackId];
    const res = onImportLibrary({
      packageName: cleanPkg,
      importMode,
      identifiers: ids,
      targetFilePath: resolvedTargetFile,
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not import library.');
      return;
    }
    setStatusNotice(`Imported ${cleanPkg} into ${resolvedTargetFile}`);
    setPkgName('');
    setIdentifiersText('');
  };

  const handleCatalogImport = (
    entry: ReactLibraryCatalogEntry,
    action: 'import-only' | 'insert' | 'replace'
  ) => {
    setErrorMsg(null);
    const res = onImportLibrary({
      packageName: entry.packageName,
      version: entry.version,
      importMode: entry.defaultImportMode,
      identifiers: entry.suggestedIdentifiers,
      targetFilePath: resolvedTargetFile,
      sampleJsx: action === 'import-only' ? undefined : entry.sampleJsx,
      action: action === 'replace' ? 'replace' : 'insert',
      position: 'after',
      targetElementIndex: resolvedElementIndex,
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to import library.');
      return;
    }
    if (action === 'replace' && entry.sampleJsx) {
      setStatusNotice(`Imported ${entry.packageName} & replaced ${targetTagLabel} in ${resolvedTargetFile}`);
    } else if (action === 'insert' && entry.sampleJsx) {
      setStatusNotice(`Imported ${entry.packageName} & inserted block near ${targetTagLabel}`);
    } else {
      setStatusNotice(`Imported ${entry.packageName} into ${resolvedTargetFile}`);
    }
  };

  const depEntries = Object.entries(dependencies);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="React Library & UI Studio"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4 backdrop-blur-[1px]"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:items-center sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
              <Blocks className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900">
                React Library &amp; UI Studio
              </h2>
              <p className="line-clamp-2 text-[11px] text-slate-500">
                Choose React UI blocks, project components, or npm libraries to insert or replace directly in your code.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close React library modal"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target File & Target Element Placement Bar */}
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="lib-target-file" className="shrink-0 text-[11px] font-semibold text-slate-700">
                Target File:
              </label>
              <select
                id="lib-target-file"
                aria-label="Target file for library import"
                value={resolvedTargetFile}
                onChange={(e) => {
                  setTargetFile(e.target.value);
                  setTargetElIndex(0);
                }}
                className="h-8 min-w-0 flex-1 sm:flex-initial sm:max-w-[220px] rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-800"
              >
                {sourceFiles.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="lib-target-element" className="shrink-0 text-[11px] font-semibold text-slate-700 sm:ml-2">
                Target Slot:
              </label>
              <select
                id="lib-target-element"
                aria-label="Target element slot in file"
                value={resolvedElementIndex}
                onChange={(e) => setTargetElIndex(Number(e.target.value) || 0)}
                className="h-8 min-w-0 flex-1 sm:flex-initial sm:max-w-[230px] rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-800"
              >
                {targetElements.length === 0 ? (
                  <option value={0}>Root element</option>
                ) : (
                  targetElements.map((el) => (
                    <option key={el.index} value={el.index}>
                      {getElementSlotLabel(resolvedFileCode, el)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {selectedTarget && selectedTarget.filePath === resolvedTargetFile && (
            <span className="inline-flex items-center gap-1 self-start sm:self-auto rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
              Canvas Selection: &lt;{selectedTarget.tagName}&gt; (#{selectedTarget.elementIndex})
            </span>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 pt-2 sm:px-5">
          <div className="flex gap-3 sm:gap-5 overflow-x-auto" role="tablist" aria-label="React library sections">
            {[
              { id: 'ui' as const, label: `UI Blocks (${REACT_UI_LIBRARY_ITEMS.length})`, icon: Sparkles },
              { id: 'project' as const, label: `Your Components (${projectComponents.length})`, icon: Box },
              { id: 'packages' as const, label: `npm (${depEntries.length})`, icon: PackagePlus },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setErrorMsg(null);
                    setActiveTab(t.id);
                  }}
                  className={`inline-flex items-center gap-1.5 border-b-2 pb-2 text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status / Error Banner */}
        {(statusNotice || errorMsg) && (
          <div className="border-b border-slate-200 px-4 py-2 sm:px-5">
            {statusNotice && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span>{statusNotice}</span>
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
                >
                  Done &amp; View Canvas
                </button>
              </div>
            )}
            {errorMsg && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Categorized Visual React UI Blocks */}
        {activeTab === 'ui' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto studio-scroll lg:grid lg:grid-cols-[1.25fr_1fr] lg:overflow-hidden">
            {/* Left: Search, Categories & Visual Component Grid */}
            <div className="flex h-[270px] shrink-0 flex-col border-b border-slate-200 sm:h-[310px] lg:h-auto lg:min-h-0 lg:shrink lg:border-b-0 lg:border-r">
              <div className="space-y-2 border-b border-slate-100 p-3 sm:p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    aria-label="Search React UI components"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search navbar, hero, pricing, table, chart, tabs..."
                    className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {REACT_UI_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                        category === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 studio-scroll">
                {filteredUiItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                    No matching React UI components found. Try clearing your search filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredUiItems.map((item) => {
                      const isPicked = activeUiEntry.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPickedUiId(item.id)}
                          aria-pressed={isPicked}
                          className={`flex flex-col rounded-xl border p-2.5 text-left transition-all ${
                            isPicked
                              ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <ReactUiThumbnail id={item.id} compact />
                          <div className="mt-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                              {item.category}
                            </span>
                            {item.packages.map((pkg) => (
                              <span
                                key={pkg.packageName}
                                className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[9px] text-indigo-700"
                              >
                                {pkg.packageName}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Selected UI Component Preview, Props, Insert & Replace Controls */}
            <div className="flex shrink-0 flex-col bg-slate-50/60 p-4 space-y-4 lg:min-h-0 lg:shrink lg:overflow-y-auto studio-scroll">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                      {activeUiEntry.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{activeUiEntry.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCodePreview((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                      showCodePreview
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Code2 className="h-3 w-3" />
                    <span>{showCodePreview ? 'Visual' : 'JSX Code'}</span>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">{activeUiEntry.description}</p>
              </div>

              {showCodePreview ? (
                <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[10px] leading-relaxed text-slate-100 studio-scroll">
                  {integrationMode === 'component'
                    ? activeUiEntry.componentSource
                    : activeUiEntry.inlineJsx}
                </pre>
              ) : (
                <ReactUiThumbnail id={activeUiEntry.id} />
              )}

              {/* Integration Mode Toggle */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-slate-700">
                  Integration Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIntegrationMode('component')}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      integrationMode === 'component'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] font-semibold">Reusable Component</div>
                    <div className="font-mono text-[9px] opacity-75">
                      &lt;{activeUiEntry.componentName} /&gt;
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntegrationMode('inline')}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      integrationMode === 'inline'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] font-semibold">Inline JSX Code</div>
                    <div className="text-[9px] opacity-75">Embed markup directly</div>
                  </button>
                </div>
              </div>

              {/* Prop Customization (when component mode) */}
              {integrationMode === 'component' &&
                Object.keys(activeUiEntry.defaultProps).length > 0 && (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <span className="block text-[11px] font-semibold text-slate-700">
                      Customize Props Before Placing
                    </span>
                    {Object.entries(activeUiEntry.defaultProps).map(([propKey, defVal]) => (
                      <div key={propKey}>
                        <label
                          htmlFor={`ui-prop-${propKey}`}
                          className="mb-0.5 block font-mono text-[10px] text-slate-500"
                        >
                          {propKey}
                        </label>
                        <input
                          id={`ui-prop-${propKey}`}
                          type="text"
                          value={propDrafts[propKey] ?? defVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPropOverridesById((prev) => ({
                              ...prev,
                              [activeUiEntry.id]: {
                                ...(prev[activeUiEntry.id] || {}),
                                [propKey]: val,
                              },
                            }));
                          }}
                          className="h-7 w-full rounded border border-slate-200 px-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

              {/* Primary Replace & Insert Actions */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-800">
                    Place in {resolvedTargetFile}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Slot: {targetTagLabel}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleUiAction('replace')}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
                >
                  <Replace className="h-3.5 w-3.5" />
                  <span>Replace {targetTagLabel} with {activeUiEntry.componentName}</span>
                </button>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUiAction('insert', 'before')}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <ArrowUpToLine className="h-3 w-3" />
                    <span>Insert Before</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUiAction('insert', 'after')}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                    <span>Insert After</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUiAction('insert', 'inside-start')}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <CornerDownRight className="h-3 w-3" />
                    <span>Inside Top</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUiAction('insert', 'inside-end')}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <CornerDownRight className="h-3 w-3" />
                    <span>Inside End</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Existing Project React Components */}
        {activeTab === 'project' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 studio-scroll space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
              {/* Component List & New Component Creator */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-900">
                  Components in Your Project ({insertableProjectComponents.length})
                </h3>
                {insertableProjectComponents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
                    No separate component files found yet. Create a component below or insert one from the React UI Blocks tab.
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1 studio-scroll">
                    {insertableProjectComponents.map((comp) => {
                      const active = activeProjectComp?.filePath === comp.filePath;
                      return (
                        <div
                          key={comp.filePath}
                          className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition-colors ${
                            active
                              ? 'border-indigo-600 bg-indigo-50/40'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setPickedProjectCompPath(comp.filePath)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="font-mono text-xs font-semibold text-slate-900">
                              &lt;{comp.name} /&gt;
                            </div>
                            <div className="truncate font-mono text-[10px] text-slate-500">
                              {comp.filePath} · {comp.usageCount} usage{comp.usageCount === 1 ? '' : 's'}
                            </div>
                          </button>
                          {onIsolateComponent && (
                            <button
                              type="button"
                              onClick={() => {
                                onIsolateComponent(comp.filePath);
                                onClose();
                              }}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Design</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {onCreateComponent && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <h4 className="text-[11px] font-semibold text-slate-800">
                      Create New Reusable Component
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        aria-label="New project component name"
                        value={newCompName}
                        onChange={(e) => setNewCompName(e.target.value)}
                        placeholder="FeatureCard..."
                        className="h-8 min-w-[140px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                      />
                      <select
                        aria-label="New component starter preset"
                        value={newCompPreset}
                        onChange={(e) => setNewCompPreset(e.target.value as ComponentTemplatePreset)}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                      >
                        <option value="card">Card</option>
                        <option value="hero">Hero</option>
                        <option value="cta">CTA Strip</option>
                        <option value="stats">Stats Grid</option>
                      </select>
                      <button
                        type="button"
                        disabled={!newCompName.trim()}
                        onClick={() => {
                          if (!newCompName.trim()) return;
                          onCreateComponent(newCompName.trim(), newCompPreset);
                          setStatusNotice(`Created new ${newCompPreset} component "${newCompName.trim()}"`);
                          setNewCompName('');
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Project Component Props & Placement */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                {!activeProjectComp ? (
                  <p className="text-xs text-slate-500">
                    Select or create a component on the left to configure props, replace {targetTagLabel}, or insert into {resolvedTargetFile}.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-700">
                          &lt;{activeProjectComp.name} /&gt;
                        </span>
                        <p className="font-mono text-[10px] text-slate-500">
                          {activeProjectComp.filePath}
                        </p>
                      </div>
                      {onIsolateComponent && (
                        <button
                          type="button"
                          onClick={() => {
                            onIsolateComponent(activeProjectComp.filePath);
                            onClose();
                          }}
                          className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-50"
                        >
                          Edit Visually
                        </button>
                      )}
                    </div>

                    {activeProjectComp.props.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                        <span className="block text-[11px] font-semibold text-slate-700">
                          Component Props
                        </span>
                        {activeProjectComp.props.map((p) => (
                          <div key={p.name}>
                            <label className="mb-0.5 block font-mono text-[10px] text-slate-500">
                              {p.name}
                            </label>
                            <input
                              type="text"
                              value={projectPropDrafts[p.name] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const path = activeProjectComp.filePath;
                                setProjectPropOverridesByPath((prev) => ({
                                  ...prev,
                                  [path]: {
                                    ...(prev[path] || {}),
                                    [p.name]: val,
                                  },
                                }));
                              }}
                              className="h-7 w-full rounded border border-slate-200 px-2 text-xs text-slate-800"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleProjectCompAction('replace')}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Replace className="h-3.5 w-3.5" />
                      <span>Replace {targetTagLabel} with &lt;{activeProjectComp.name} /&gt;</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { pos: 'before', label: 'Insert Before' },
                          { pos: 'after', label: 'Insert After' },
                          { pos: 'inside-start', label: 'Inside Top' },
                          { pos: 'inside-end', label: 'Inside End' },
                        ] as Array<{ pos: ComponentInsertPosition; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.pos}
                          type="button"
                          onClick={() => handleProjectCompAction('insert', opt.pos)}
                          className="h-8 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: npm Packages & ESM */}
        {activeTab === 'packages' && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5 studio-scroll">
            {/* Custom Package Form */}
            <form onSubmit={handleCustomImport} className="space-y-3 rounded-xl border border-slate-200 p-3.5">
              <h3 className="text-xs font-semibold text-slate-900">
                Import Custom npm React Package
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_112px_1fr]">
                <div>
                  <label htmlFor="custom-pkg-name" className="mb-1 block text-[11px] text-slate-600">
                    Package Name
                  </label>
                  <input
                    id="custom-pkg-name"
                    type="text"
                    aria-label="Custom npm package name"
                    value={pkgName}
                    onChange={(e) => setPkgName(e.target.value)}
                    placeholder="e.g. recharts, sonner, date-fns"
                    className="h-8 w-full rounded-md border border-slate-200 px-2.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="custom-import-mode" className="mb-1 block text-[11px] text-slate-600">
                    Import Type
                  </label>
                  <select
                    id="custom-import-mode"
                    aria-label="Library import mode"
                    value={importMode}
                    onChange={(e) =>
                      setImportMode(e.target.value as 'named' | 'default' | 'namespace')
                    }
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                  >
                    <option value="named">{'{ Named }'}</option>
                    <option value="default">Default</option>
                    <option value="namespace">* as Ns</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="custom-import-ids" className="mb-1 block text-[11px] text-slate-600">
                    Imported Symbols
                  </label>
                  <input
                    id="custom-import-ids"
                    type="text"
                    aria-label="Imported symbols"
                    value={identifiersText}
                    onChange={(e) => setIdentifiersText(e.target.value)}
                    placeholder="e.g. BarChart, Bar"
                    className="h-8 w-full rounded-md border border-slate-200 px-2.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add &amp; Import Package</span>
                </button>
              </div>
            </form>

            {/* Popular React Ecosystem Libraries */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-900">
                  Popular React Libraries (Import, Insert, or Replace {targetTagLabel})
                </h3>
                <input
                  type="text"
                  aria-label="Filter npm packages"
                  value={pkgSearch}
                  onChange={(e) => setPkgSearch(e.target.value)}
                  placeholder="Filter packages..."
                  className="h-7 w-48 rounded-md border border-slate-200 px-2 text-[11px] text-slate-800"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredPackages.map((lib) => {
                  const isInPkg = Boolean(dependencies[lib.packageName]);
                  const isInFile = currentFileImports.some(
                    (imp) => imp.packageName === lib.packageName
                  );
                  return (
                    <div
                      key={lib.packageName}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {lib.packageName}
                          </span>
                          {(isInFile || isInPkg) && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              {isInFile ? 'In File' : 'Installed'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500">
                          {lib.description}
                        </p>
                        <p className="mt-1.5 truncate font-mono text-[10px] text-slate-400">
                          {lib.defaultImportMode === 'named'
                            ? `{ ${lib.suggestedIdentifiers.join(', ')} }`
                            : lib.suggestedIdentifiers[0]}
                        </p>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCatalogImport(lib, 'import-only')}
                          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <PackagePlus className="h-3 w-3 text-indigo-600" />
                          <span>Import</span>
                        </button>
                        {lib.sampleJsx && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCatalogImport(lib, 'insert')}
                              className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-indigo-600 px-2.5 text-[11px] font-semibold text-white hover:bg-indigo-700"
                            >
                              <Sparkles className="h-3 w-3" />
                              <span>Insert</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCatalogImport(lib, 'replace')}
                              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              <Replace className="h-3 w-3" />
                              <span>Replace</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Installed Dependencies & Current File Imports */}
            <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                  <Package className="h-3.5 w-3.5 text-slate-500" />
                  <span>package.json Dependencies ({depEntries.length})</span>
                </h4>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 studio-scroll">
                  {depEntries.length === 0 ? (
                    <p className="text-[11px] text-slate-400">No dependencies recorded.</p>
                  ) : (
                    depEntries.map(([name, ver]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-[11px]"
                      >
                        <span className="truncate font-mono text-slate-800">{name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[10px] text-slate-400">{ver}</span>
                          {name !== 'react' && name !== 'react-dom' && name !== 'next' && (
                            <button
                              type="button"
                              aria-label={`Remove ${name} dependency`}
                              onClick={() => onRemoveDependency(name)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold text-slate-700">
                  Imports in {resolvedTargetFile} ({currentFileImports.length})
                </h4>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 studio-scroll">
                  {currentFileImports.length === 0 ? (
                    <p className="text-[11px] text-slate-400">No external imports in this file.</p>
                  ) : (
                    currentFileImports.map((imp, idx) => (
                      <div
                        key={`${imp.packageName}-${idx}`}
                        className="truncate rounded bg-white px-2 py-1 font-mono text-[10px] text-slate-700"
                      >
                        <span className="text-indigo-700">{imp.specifiersText}</span> from{' '}
                        <span className="text-slate-900">&apos;{imp.packageName}&apos;</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
