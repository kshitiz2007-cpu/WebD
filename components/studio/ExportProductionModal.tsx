'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clapperboard,
  Code2,
  Copy,
  Download,
  FileCode2,
  FolderArchive,
  GitBranch,
  Image as ImageIcon,
  Layers,
  X,
} from 'lucide-react';
import {
  ProductionExportOptions,
  compileProjectForProductionExport,
} from '@/lib/studio/export-compiler';
import type { VisualLogicRule } from '@/lib/studio/logic-engine';
import type { VirtualProject } from '@/lib/studio/types';

interface ExportProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: VirtualProject;
  logicRules: VisualLogicRule[];
}

type ExportTab = 'overview' | 'code' | 'manifest';

function formatKilobytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ExportProductionModal({
  isOpen,
  onClose,
  project,
  logicRules,
}: ExportProductionModalProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>('overview');
  const [options, setOptions] = useState<ProductionExportOptions>({
    compileLogic: true,
    includeScrollRevealRuntime: true,
    extractInlineBase64Media: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);
  const [copiedRuntime, setCopiedRuntime] = useState(false);

  const compiled = useMemo(() => {
    if (!isOpen) return null;
    return compileProjectForProductionExport(project, logicRules, options);
  }, [isOpen, project, logicRules, options]);

  if (!isOpen || !compiled) return null;

  const { report } = compiled;
  const totalFilesCount =
    Object.keys(compiled.textFiles).length + Object.keys(compiled.binaryFiles).length;

  const handleCopyRuntime = async () => {
    try {
      await navigator.clipboard.writeText(compiled.runtimePreviewCode);
      setCopiedRuntime(true);
      setTimeout(() => setCopiedRuntime(false), 1800);
    } catch {
      // Ignore clipboard failure in restricted iframes
    }
  };

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      for (const [path, content] of Object.entries(compiled.textFiles)) {
        zip.file(path, content);
      }
      for (const [path, bytes] of Object.entries(compiled.binaryFiles)) {
        zip.file(path, bytes, { binary: true });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (project.name || 'atelier-app')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      a.download = `${safeName || 'atelier-app'}-production.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setJustDownloaded(true);
      setTimeout(() => setJustDownloaded(false), 2200);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export Production Build"
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <FolderArchive className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">
                Production Export Engine
              </h2>
              <p className="truncate text-xs text-slate-500">
                Standalone runtime for visual logic, scroll animations &amp; clean{' '}
                <code className="font-mono text-[11px] text-slate-700">
                  {project.framework === 'html' ? 'assets/' : 'public/assets/'}
                </code>{' '}
                media
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Production export views"
          className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Overview</span>
            <span className="hidden sm:inline">Overview &amp; Pipeline</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'code'}
            onClick={() => setActiveTab('code')}
            className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'code'
                ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Code</span>
            <span className="hidden sm:inline">Compiled Code</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'manifest'}
            onClick={() => setActiveTab('manifest')}
            className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'manifest'
                ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Files ({totalFilesCount})</span>
            <span className="hidden sm:inline">File Manifest ({totalFilesCount})</span>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                      Compiled Logic
                    </span>
                    <GitBranch className="h-4 w-4 text-violet-600" />
                  </div>
                  <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {report.compiledRulesCount}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {report.wiredElementCount} element{report.wiredElementCount === 1 ? '' : 's'} stamped with{' '}
                    <code className="font-mono text-[10px]">data-webd-id</code>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Clean Media Assets
                    </span>
                    <ImageIcon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {report.mediaAssetCount}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {report.extractedInlineMediaCount > 0
                      ? `${report.extractedInlineMediaCount} inline base64 extracted (${formatKilobytes(report.bytesSavedFromInlineMedia)} cleaner)`
                      : 'Exported as binary files in assets folder'}
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                      Motion &amp; Reveal
                    </span>
                    <Clapperboard className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {report.animatedElementCount}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    CSS keyframes + zero-dependency IntersectionObserver
                  </p>
                </div>
              </div>

              {/* Pipeline Options */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Production Compiler Pipeline
                </h3>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 hover:bg-slate-50/80">
                  <input
                    type="checkbox"
                    checked={options.compileLogic}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, compileLogic: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">
                      Logic-to-{project.framework === 'html' ? 'JS' : 'React'} Production Compiler
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">
                      Generates{' '}
                      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-800">
                        {compiled.runtimePreviewPath}
                      </code>{' '}
                      with state persistence (<code className="font-mono text-[10px]">localStorage</code>), event delegation, conditions, flows, and route navigation, then auto-mounts it so your exported app stays 100% interactive outside the editor.
                    </span>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 hover:bg-slate-50/80">
                  <input
                    type="checkbox"
                    checked={options.includeScrollRevealRuntime}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        includeScrollRevealRuntime: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">
                      Bundle Scroll-Reveal &amp; Motion Studio Styles
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">
                      Includes the <code className="font-mono text-[10px]">IntersectionObserver</code> reveal observer, staggered children timings, hover micro-interactions, and <code className="font-mono text-[10px]">prefers-reduced-motion</code> fallbacks.
                    </span>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 hover:bg-slate-50/80">
                  <input
                    type="checkbox"
                    checked={options.extractInlineBase64Media}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        extractInlineBase64Media: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">
                      Clean Media Assets Pipeline
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">
                      Writes Media Library uploads as real binary files inside{' '}
                      <code className="font-mono text-[10px]">
                        {project.framework === 'html' ? 'assets/' : 'public/assets/'}
                      </code>{' '}
                      and automatically extracts any remaining inline base64 strings from JSX/HTML/CSS into clean file paths.
                    </span>
                  </div>
                </label>
              </div>

              {/* Status Banner */}
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <span className="font-semibold text-slate-900">
                    Ready for standalone deployment:
                  </span>{' '}
                  {report.generatedFiles.length > 0
                    ? `Will generate ${report.generatedFiles.join(', ')} and update ${report.modifiedFiles.length} source file(s).`
                    : 'No extra runtime files required yet—add Logic rules or Scroll-Reveal animations to auto-generate the production runtime.'}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-900">
                    {compiled.runtimePreviewPath}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Zero external dependencies · auto-wired during ZIP export
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyRuntime}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copiedRuntime ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
                <code>{compiled.runtimePreviewCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'manifest' && (
            <div className="space-y-4">
              {report.generatedFiles.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Generated Production Runtime ({report.generatedFiles.length})
                  </h3>
                  <ul className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 font-mono text-xs text-emerald-950">
                    {report.generatedFiles.map((path) => (
                      <li key={path} className="flex items-center justify-between gap-2">
                        <span className="truncate">+ {path}</span>
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          NEW
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.modifiedFiles.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                    Wired &amp; Cleaned Source Files ({report.modifiedFiles.length})
                  </h3>
                  <ul className="space-y-1 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 font-mono text-xs text-blue-950">
                    {report.modifiedFiles.map((path) => (
                      <li key={path} className="flex items-center justify-between gap-2">
                        <span className="truncate">~ {path}</span>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                          UPDATED
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                  Clean Binary Media Assets ({report.binaryFiles.length})
                </h3>
                {report.binaryFiles.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                    No binary media files yet. Upload images or videos via Media Library and insert them to automatically populate{' '}
                    <code className="font-mono text-[11px]">
                      {project.framework === 'html' ? 'assets/' : 'public/assets/'}
                    </code>
                    .
                  </p>
                ) : (
                  <ul className="space-y-1 rounded-xl border border-violet-200 bg-violet-50/40 p-2.5 font-mono text-xs text-violet-950">
                    {report.binaryFiles.map((path) => (
                      <li key={path} className="flex items-center justify-between gap-2">
                        <span className="truncate">{path}</span>
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                          {formatKilobytes(compiled.binaryFiles[path]?.byteLength || 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  All Project Source Files ({Object.keys(compiled.textFiles).length})
                </h3>
                <ul className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700">
                  {Object.keys(compiled.textFiles)
                    .sort()
                    .map((path) => (
                      <li key={path} className="truncate">
                        {path}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <span className="text-xs text-slate-500">
            {totalFilesCount} total file{totalFilesCount === 1 ? '' : 's'} ready for ZIP
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadZip}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              {justDownloaded ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Production ZIP Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>{isExporting ? 'Building ZIP...' : 'Download Production ZIP'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
