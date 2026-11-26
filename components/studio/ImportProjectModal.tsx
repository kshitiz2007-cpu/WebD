'use client';

import React, { useRef, useState } from 'react';
import { FileArchive, GitBranch, Layers, Loader2, Upload, X } from 'lucide-react';
import {
  importGitHubRepoFromBrowser,
  parseGitHubRepoUrl,
  safeReadJsonResponse,
} from '@/lib/studio/github-import';
import { normalizeProjectFiles } from '@/lib/studio/project-scanner';
import { STARTER_HTML_FILES, STARTER_NEXTJS_FILES } from '@/lib/studio/sample-project';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (files: Record<string, string>, label: string, name?: string) => void;
}

const ALLOWED_EXT = /\.(tsx|ts|jsx|js|mjs|cjs|css|scss|html|htm|json|svg|md|txt)$/i;
const IGNORED_DIRS = /(^|\/)(node_modules|\.next|\.git|dist|build|coverage)\//;

export default function ImportProjectModal({
  isOpen,
  onClose,
  onLoadProject,
}: ImportProjectModalProps) {
  const [tab, setTab] = useState<'zip' | 'github' | 'templates'>('zip');
  const [githubUrl, setGithubUrl] = useState(
    'https://github.com/kshitiz2007-cpu/Civil/tree/recovery/original-full-app'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processZipFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const [{ default: JSZip }, buf] = await Promise.all([
        import('jszip'),
        file.arrayBuffer(),
      ]);
      const zip = await JSZip.loadAsync(buf);
      const rawFiles: Record<string, string> = {};

      const entries = Object.values(zip.files);
      for (const entry of entries) {
        if (entry.dir) continue;
        if (IGNORED_DIRS.test(entry.name)) continue;
        if (!ALLOWED_EXT.test(entry.name)) continue;
        if (/package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/i.test(entry.name)) continue;
        const text = await entry.async('string');
        if (text.length <= 400_000) {
          rawFiles[entry.name] = text;
        }
      }

      const normalized = normalizeProjectFiles(rawFiles);
      if (Object.keys(normalized).length === 0) {
        throw new Error('No supported HTML, CSS, JS, JSX, or TSX files were found inside this ZIP.');
      }
      const cleanName = file.name.replace(/\.zip$/i, '');
      onLoadProject(normalized, `ZIP: ${file.name}`, cleanName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read ZIP archive.');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = githubUrl.trim();
    if (!trimmedUrl) {
      setError('Please enter a GitHub repository URL.');
      return;
    }
    if (!parseGitHubRepoUrl(trimmedUrl)) {
      setError('Please enter a valid GitHub repository URL (for example https://github.com/owner/repo).');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      let imported: { name: string; files: Record<string, string> } | null = null;
      let shouldFallbackToBrowser = false;
      let serverError: string | null = null;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 16_000);
        try {
          const res = await fetch('/api/import-github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: trimmedUrl }),
            signal: controller.signal,
          });
          const parsed = await safeReadJsonResponse<{
            name?: string;
            files?: Record<string, string>;
            error?: string;
          }>(res);
          if (parsed.ok && parsed.data?.files) {
            imported = {
              name: parsed.data.name || 'GitHub Project',
              files: parsed.data.files,
            };
          } else if (!parsed.ok) {
            serverError = parsed.error;
            if (parsed.isHtml || parsed.status >= 500 || parsed.status === 404) {
              shouldFallbackToBrowser = true;
            }
          }
        } finally {
          clearTimeout(timer);
        }
      } catch {
        shouldFallbackToBrowser = true;
      }

      if (!imported && shouldFallbackToBrowser) {
        const direct = await importGitHubRepoFromBrowser(trimmedUrl);
        imported = { name: direct.name, files: direct.files };
      } else if (!imported) {
        throw new Error(serverError || 'GitHub import failed.');
      }

      const normalized = normalizeProjectFiles(imported.files || {});
      if (Object.keys(normalized).length === 0) {
        throw new Error('No supported web source files found in this repository.');
      }
      onLoadProject(normalized, `GitHub: ${imported.name}`, imported.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import repository.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 id="import-modal-title" className="text-sm font-semibold text-slate-900">
            Load Project into Visual Designer
          </h2>
          <button
            type="button"
            aria-label="Close import modal"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="border-b border-slate-200 px-5 pt-3">
          <div className="flex gap-4" role="tablist">
            {[
              { id: 'zip' as const, label: 'Upload ZIP', icon: FileArchive },
              { id: 'github' as const, label: 'GitHub Repo URL', icon: GitBranch },
              { id: 'templates' as const, label: 'Starter Projects', icon: Layers },
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setError(null);
                    setTab(item.id);
                  }}
                  className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          {tab === 'zip' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                aria-label="Choose ZIP project file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processZipFile(f);
                }}
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) processZipFile(f);
                }}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  isDraggingOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 bg-slate-50/70'
                }`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-900">
                  Drop your project .zip file here
                </p>
                <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                  Supports Next.js App/Pages Router, Vite React, and multi-page HTML/CSS/Tailwind projects.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? 'Unpacking Archive...' : 'Browse ZIP File'}
                </button>
              </div>
            </div>
          )}

          {tab === 'github' && (
            <form onSubmit={handleGitHubImport} className="space-y-4">
              <div>
                <label
                  htmlFor="github-repo-url"
                  className="mb-1.5 block text-xs font-medium text-slate-700"
                >
                  Public GitHub Repository or Branch URL
                </label>
                <input
                  id="github-repo-url"
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo/tree/branch"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Downloads the repository archive, discovers all pages, and runs them directly in the visual editor.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setGithubUrl('https://github.com/kshitiz2007-cpu/Civil/tree/recovery/original-full-app')
                  }
                  className="text-[11px] font-medium text-blue-600 hover:underline"
                >
                  Use Civil App Example URL
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{loading ? 'Importing Repo...' : 'Import & Run Pages'}</span>
                </button>
              </div>
            </form>
          )}

          {tab === 'templates' && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onLoadProject(STARTER_NEXTJS_FILES, 'Starter: Next.js App', 'verve-structural-site');
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3.5 text-left hover:border-blue-500 hover:bg-blue-50/30"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Verve Structural (Next.js + Tailwind)
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    3 pages (Overview, Case Studies, Plans) with multi-stop gradients &amp; card grid.
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-600">Load</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onLoadProject(STARTER_HTML_FILES, 'Starter: Multi-Page HTML', 'monolith-html-site');
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3.5 text-left hover:border-blue-500 hover:bg-blue-50/30"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Monolith Studio (HTML + CSS)
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Clean 2-page static HTML/CSS site demonstrating direct markup &amp; style sync.
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-600">Load</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
