'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  Package,
  PackagePlus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  COMMON_REACT_LIBRARIES,
  ReactLibraryCatalogEntry,
  isValidPackageName,
  scanExternalImportsInSource,
} from '@/lib/studio/library-importer';

interface ReactLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: Record<string, string>;
  defaultTargetFile: string;
  dependencies: Record<string, string>;
  onImportLibrary: (params: {
    packageName: string;
    version?: string;
    importMode: 'named' | 'default' | 'namespace';
    identifiers: string[];
    targetFilePath: string;
    sampleJsx?: string;
  }) => { ok: boolean; error?: string };
  onRemoveDependency: (packageName: string) => void;
}

export default function ReactLibraryModal({
  isOpen,
  onClose,
  files,
  defaultTargetFile,
  dependencies,
  onImportLibrary,
  onRemoveDependency,
}: ReactLibraryModalProps) {
  const [targetFile, setTargetFile] = useState(defaultTargetFile);
  const [pkgName, setPkgName] = useState('');
  const [importMode, setImportMode] = useState<'named' | 'default' | 'namespace'>('named');
  const [identifiersText, setIdentifiersText] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sourceFiles = useMemo(
    () => Object.keys(files).filter((p) => /\.(tsx|jsx|ts|js)$/i.test(p)).sort(),
    [files]
  );

  const resolvedTargetFile = files[targetFile]
    ? targetFile
    : files[defaultTargetFile]
    ? defaultTargetFile
    : sourceFiles[0] || 'app/page.tsx';

  const currentFileImports = useMemo(
    () => scanExternalImportsInSource(files[resolvedTargetFile] || ''),
    [files, resolvedTargetFile]
  );

  if (!isOpen) return null;

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

  const handleCatalogImport = (entry: ReactLibraryCatalogEntry, withSnippet: boolean) => {
    setErrorMsg(null);
    const res = onImportLibrary({
      packageName: entry.packageName,
      version: entry.version,
      importMode: entry.defaultImportMode,
      identifiers: entry.suggestedIdentifiers,
      targetFilePath: resolvedTargetFile,
      sampleJsx: withSnippet ? entry.sampleJsx : undefined,
    });
    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to import library.');
      return;
    }
    setStatusNotice(
      withSnippet && entry.sampleJsx
        ? `Imported ${entry.packageName} & inserted starter element into ${resolvedTargetFile}`
        : `Imported ${entry.packageName} into ${resolvedTargetFile}`
    );
  };

  const depEntries = Object.entries(dependencies);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import React Library"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Import React Library
              </h2>
              <p className="text-[11px] text-slate-500">
                Add npm React packages to package.json, inject imports, and load ESM bundles in live preview.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close React library modal"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 studio-scroll">
          {/* Target File Selector */}
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label
                htmlFor="lib-target-file"
                className="block text-xs font-semibold text-slate-800"
              >
                Target Component / Page File
              </label>
              <p className="text-[11px] text-slate-500">
                Import statement will be added cleanly to this file.
              </p>
            </div>
            <select
              id="lib-target-file"
              aria-label="Target file for library import"
              value={resolvedTargetFile}
              onChange={(e) => setTargetFile(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-800"
            >
              {sourceFiles.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </div>

          {statusNotice && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{statusNotice}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

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
            <h3 className="text-xs font-semibold text-slate-900">
              Popular React Libraries (One-Click Import)
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {COMMON_REACT_LIBRARIES.map((lib) => {
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

                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCatalogImport(lib, false)}
                        className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <PackagePlus className="h-3 w-3 text-indigo-600" />
                        <span>Import</span>
                      </button>
                      {lib.sampleJsx && (
                        <button
                          type="button"
                          onClick={() => handleCatalogImport(lib, true)}
                          className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-indigo-600 px-2.5 text-[11px] font-semibold text-white hover:bg-indigo-700"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Import + Add</span>
                        </button>
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
      </div>
    </div>
  );
}
