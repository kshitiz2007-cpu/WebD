'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Check,
  Code2,
  Copy,
  FolderTree,
  Maximize2,
  Minimize2,
  Moon,
  RotateCcw,
  Save,
  Sun,
  Wand2,
  WrapText,
  X,
} from 'lucide-react';

const MonacoCodeEditor = dynamic(() => import('./MonacoCodeEditorClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-950 font-mono text-xs text-slate-400">
      Loading Monaco Editor...
    </div>
  ),
});

interface CodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: Record<string, string>;
  originalFiles: Record<string, string>;
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onUpdateFile: (path: string, content: string) => void;
  onRevertFile: (path: string) => void;
  onOpenProjectFiles?: () => void;
}

export default function CodeDrawer({
  isOpen,
  onClose,
  files,
  originalFiles,
  activeFilePath,
  onSelectFile,
  onUpdateFile,
  onRevertFile,
  onOpenProjectFiles,
}: CodeDrawerProps) {
  const code = files[activeFilePath] ?? '';
  const orig = originalFiles[activeFilePath] ?? '';

  const [draftCode, setDraftCode] = useState<string>(code);
  const [prevFilePath, setPrevFilePath] = useState<string>(activeFilePath);
  const [prevExternalCode, setPrevExternalCode] = useState<string>(code);
  const [lastCommittedCode, setLastCommittedCode] = useState<string>(code);

  const [liveSync, setLiveSync] = useState(true);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs'>('vs-dark');
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatFnRef = useRef<(() => void) | null>(null);
  const onUpdateFileRef = useRef(onUpdateFile);

  useEffect(() => {
    onUpdateFileRef.current = onUpdateFile;
  }, [onUpdateFile]);

  // Sync draftCode cleanly on file switch or external visual/undo mutations
  if (activeFilePath !== prevFilePath) {
    setPrevFilePath(activeFilePath);
    setPrevExternalCode(code);
    setLastCommittedCode(code);
    setDraftCode(code);
  } else if (code !== prevExternalCode) {
    setPrevExternalCode(code);
    if (code !== lastCommittedCode) {
      setLastCommittedCode(code);
      setDraftCode(code);
    }
  }

  const hasPendingDraft = draftCode !== code;

  // Debounced live sync from Monaco edits back to Studio project state & Visual Canvas
  useEffect(() => {
    if (!isOpen || !liveSync || !hasPendingDraft) return;
    const targetPath = activeFilePath;
    const nextContent = draftCode;
    const timer = setTimeout(() => {
      onUpdateFileRef.current(targetPath, nextContent);
    }, 280);
    return () => clearTimeout(timer);
  }, [isOpen, liveSync, hasPendingDraft, activeFilePath, draftCode]);

  const editablePaths = useMemo(() => {
    return Object.keys(files)
      .filter((p) => /\.(tsx|jsx|ts|js|html|htm|css|json|md)$/i.test(p))
      .sort((a, b) => {
        const score = (p: string) => {
          if (p.endsWith('.css')) return 0;
          if (/^(src\/)?app\/page\.(tsx|jsx)$/.test(p) || p === 'index.html') return 1;
          if (p === 'package.json') return 3;
          return 2;
        };
        const diff = score(a) - score(b);
        return diff !== 0 ? diff : a.localeCompare(b);
      });
  }, [files]);

  const modifiedPaths = useMemo(() => {
    return Object.keys(files).filter((p) => files[p] !== originalFiles[p]);
  }, [files, originalFiles]);

  const handleApplyNow = useCallback(() => {
    if (draftCode === code) return;
    setLastCommittedCode(draftCode);
    onUpdateFileRef.current(activeFilePath, draftCode);
  }, [draftCode, code, activeFilePath]);

  const handleEditorChange = useCallback((nextVal: string) => {
    setDraftCode(nextVal);
  }, []);

  const handleRegisterFormat = useCallback((fn: (() => void) | null) => {
    formatFnRef.current = fn;
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  if (!isOpen) return null;

  const isModified = code !== orig;

  return (
    <section
      aria-label="Monaco code editor drawer"
      className={`flex w-full shrink-0 flex-col border-t border-slate-200 bg-slate-950 text-slate-100 ${
        isExpanded ? 'h-[48vh] min-h-[340px]' : 'h-64 sm:h-72'
      }`}
    >
      {/* Editor Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            title={hasPendingDraft ? 'Draft changes pending sync' : 'Synced to canvas'}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-100 whitespace-nowrap"
          >
            <Code2 className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden 2xl:inline">Monaco Editor</span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                hasPendingDraft ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </span>

          <label htmlFor="code-drawer-file" className="sr-only">
            Source file
          </label>
          <select
            id="code-drawer-file"
            value={activeFilePath}
            onChange={(e) => onSelectFile(e.target.value)}
            className="h-7 min-w-[110px] max-w-[210px] flex-1 rounded border border-slate-700 bg-slate-800 px-2 font-mono text-[11px] text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {editablePaths.map((p) => (
              <option key={p} value={p}>
                {p} {files[p] !== originalFiles[p] ? '(modified)' : ''}
              </option>
            ))}
          </select>

          {onOpenProjectFiles && (
            <button type="button" onClick={onOpenProjectFiles} title="Open full project file explorer" className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-[11px] text-slate-300 hover:bg-slate-800">
              <FolderTree className="h-3.5 w-3.5" /><span className="hidden sm:inline">Files</span>
            </button>
          )}
          <span
            className={`hidden 2xl:inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap ${
              hasPendingDraft
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {hasPendingDraft ? 'Draft…' : 'Synced'}
          </span>

          {modifiedPaths.length > 0 && (
            <span className="hidden 2xl:inline shrink-0 font-mono text-[10px] text-sky-400 whitespace-nowrap">
              {modifiedPaths.length} modified
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setLiveSync((v) => !v)}
            aria-pressed={liveSync}
            title="Automatically apply code changes to the visual canvas as you type"
            className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${
              liveSync
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Live{liveSync ? ': On' : ': Off'}</span>
          </button>

          {hasPendingDraft && (
            <button
              type="button"
              onClick={handleApplyNow}
              className="inline-flex h-7 items-center gap-1 rounded bg-sky-600 px-2.5 text-[11px] font-semibold text-white hover:bg-sky-500 whitespace-nowrap"
            >
              <Save className="h-3 w-3" />
              <span>Apply</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => formatFnRef.current?.()}
            title="Format document"
            className="hidden sm:inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            <Wand2 className="h-3 w-3" />
            <span>Format</span>
          </button>

          <button
            type="button"
            aria-label="Toggle word wrap"
            aria-pressed={wordWrap === 'on'}
            onClick={() => setWordWrap((w) => (w === 'on' ? 'off' : 'on'))}
            title="Toggle word wrap"
            className={`hidden sm:inline-flex h-7 w-7 items-center justify-center rounded border ${
              wordWrap === 'on'
                ? 'border-slate-600 bg-slate-800 text-slate-100'
                : 'border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            aria-label={editorTheme === 'vs-dark' ? 'Switch editor to light theme' : 'Switch editor to dark theme'}
            onClick={() => setEditorTheme((t) => (t === 'vs-dark' ? 'vs' : 'vs-dark'))}
            title="Toggle editor theme"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {editorTheme === 'vs-dark' ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            aria-label={isExpanded ? 'Collapse code editor height' : 'Expand code editor height'}
            onClick={() => setIsExpanded((v) => !v)}
            title={isExpanded ? 'Compact height' : 'Expand height'}
            className="hidden sm:inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          {isModified && (
            <button
              type="button"
              onClick={() => onRevertFile(activeFilePath)}
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-[11px] text-slate-300 hover:bg-slate-800 whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Revert</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-[11px] text-slate-300 hover:bg-slate-800 whitespace-nowrap"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            aria-label="Close code drawer"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Monaco Editor Surface */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <MonacoCodeEditor
          filePath={activeFilePath}
          value={draftCode}
          theme={editorTheme}
          wordWrap={wordWrap}
          onChange={handleEditorChange}
          onSaveShortcut={handleApplyNow}
          onRegisterFormat={handleRegisterFormat}
        />
      </div>
    </section>
  );
}
