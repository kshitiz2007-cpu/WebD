'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy, RotateCcw, X } from 'lucide-react';

interface CodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: Record<string, string>;
  originalFiles: Record<string, string>;
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onRevertFile: (path: string) => void;
}

export default function CodeDrawer({
  isOpen,
  onClose,
  files,
  originalFiles,
  activeFilePath,
  onSelectFile,
  onRevertFile,
}: CodeDrawerProps) {
  const [copied, setCopied] = useState(false);

  const modifiedPaths = useMemo(() => {
    return Object.keys(files).filter((p) => files[p] !== originalFiles[p]);
  }, [files, originalFiles]);

  if (!isOpen) return null;

  const code = files[activeFilePath] || '';
  const orig = originalFiles[activeFilePath] || '';
  const isModified = code !== orig;

  const origLines = orig.split('\n');
  const currentLines = code.split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <section
      aria-label="Synced source code preview"
      className="flex h-56 sm:h-64 w-full shrink-0 flex-col border-t border-slate-200 bg-slate-950 text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <span className="hidden xs:inline sm:inline text-xs font-semibold text-slate-200 whitespace-nowrap">
            Live Synced Source
          </span>

          <label htmlFor="code-drawer-file" className="sr-only">
            Source file
          </label>
          <select
            id="code-drawer-file"
            value={activeFilePath}
            onChange={(e) => onSelectFile(e.target.value)}
            className="h-8 sm:h-7 min-w-0 max-w-[180px] sm:max-w-[260px] flex-1 rounded border border-slate-700 bg-slate-800 px-2 font-mono text-[11px] text-slate-200"
          >
            {Object.keys(files)
              .filter((p) => /\.(tsx|jsx|ts|js|html|css)$/i.test(p))
              .map((p) => (
                <option key={p} value={p}>
                  {p} {files[p] !== originalFiles[p] ? '(modified)' : ''}
                </option>
              ))}
          </select>

          {modifiedPaths.length > 0 && (
            <span className="hidden sm:inline font-mono text-[11px] text-sky-400 whitespace-nowrap">
              {modifiedPaths.length} file{modifiedPaths.length > 1 ? 's' : ''} updated
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isModified && (
            <button
              type="button"
              onClick={() => onRevertFile(activeFilePath)}
              className="inline-flex h-8 sm:h-auto items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 sm:px-2 sm:py-1 text-[11px] text-slate-300 hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              <span>Revert</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-8 sm:h-auto items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 sm:px-2 sm:py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            aria-label="Close code drawer"
            onClick={onClose}
            className="inline-flex h-8 w-8 sm:h-auto sm:w-auto items-center justify-center rounded p-1.5 sm:p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-5 studio-scroll">
        {currentLines.map((line, idx) => {
          const changed = origLines[idx] !== line;
          return (
            <div
              key={idx}
              className={`flex gap-3 px-2 ${
                changed ? 'bg-blue-950/60 text-sky-200' : 'text-slate-300'
              }`}
            >
              <span className="w-8 shrink-0 select-none text-right tabular-nums text-slate-600">
                {idx + 1}
              </span>
              <span className="whitespace-pre">{line || ' '}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
