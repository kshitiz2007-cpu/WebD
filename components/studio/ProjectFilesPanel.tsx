'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, File, FileCode2, FilePlus2, Folder, FolderOpen, FolderPlus, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { getProjectFileTree } from '@/lib/studio/file-manager';

interface Props {
  files: Record<string, string>;
  originalFiles: Record<string, string>;
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => { ok: boolean; error?: string };
  onCreateFolder: (path: string) => { ok: boolean; error?: string };
  onRenamePath: (oldPath: string, newPath: string, isFolder: boolean) => { ok: boolean; error?: string };
  onDeletePath: (path: string, isFolder: boolean) => boolean;
  onRefresh: () => void;
  onClose?: () => void;
  isBottomSheet?: boolean;
}

export default function ProjectFilesPanel({
  files, originalFiles, activeFilePath, onSelectFile, onCreateFile, onCreateFolder,
  onRenamePath, onDeletePath, onRefresh, onClose, isBottomSheet = false,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState<'file' | 'folder' | null>(null);
  const [newPath, setNewPath] = useState('');
  const tree = useMemo(() => getProjectFileTree(files), [files]);

  const create = () => {
    setError('');
    const result = showCreate === 'file' ? onCreateFile(newPath) : onCreateFolder(newPath);
    if (result.ok) {
      setNewPath('');
      setShowCreate(null);
    } else setError(result.error || 'Could not create this path.');
  };

  const renderNodes = (nodes: ReturnType<typeof getProjectFileTree>, depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const isOpen = expanded[node.path] ?? depth < 1;
      const matches = !query || node.path.toLowerCase().includes(query.toLowerCase()) || (node.kind === 'folder' && node.children.some((child) => child.path.toLowerCase().includes(query.toLowerCase())));
      if (!matches) return null;
      const changed = node.kind === 'file' && files[node.path] !== originalFiles[node.path];
      return (
        <React.Fragment key={node.path}>
          <div className={`group flex min-w-0 items-center gap-1 rounded-md pr-1 text-xs ${activeFilePath === node.path ? 'bg-sky-500/15 text-sky-200' : 'text-slate-300 hover:bg-slate-800'}`}>
            {node.kind === 'folder' ? (
              <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [node.path]: !isOpen }))} className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1.5 text-left">
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {isOpen ? <FolderOpen size={14} className="shrink-0 text-amber-300" /> : <Folder size={14} className="shrink-0 text-amber-300" />}
                <span className="truncate">{node.name}</span>
              </button>
            ) : (
              <button type="button" onClick={() => onSelectFile(node.path)} className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1.5 text-left" title={node.path}>
                <span className="w-[13px] shrink-0" />
                {node.name.endsWith('.tsx') || node.name.endsWith('.ts') || node.name.endsWith('.jsx') || node.name.endsWith('.js') ? <FileCode2 size={14} className="shrink-0 text-sky-300" /> : <File size={14} className="shrink-0 text-slate-400" />}
                <span className="truncate">{node.name}</span>
                {changed && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
              </button>
            )}
            <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
              <button type="button" title={node.kind === 'folder' ? 'Rename folder' : 'Rename file'} onClick={() => {
                const next = window.prompt('New path', node.path);
                if (next && next !== node.path) {
                  const result = onRenamePath(node.path, next, node.kind === 'folder');
                  if (!result.ok) window.alert(result.error || 'Rename failed.');
                }
              }} className="rounded p-1 hover:bg-slate-700"><Pencil size={12} /></button>
              <button type="button" title={node.kind === 'folder' ? 'Delete folder' : 'Delete file'} onClick={() => {
                const message = node.kind === 'folder' ? `Delete folder "${node.path}" and all its files?` : `Delete file "${node.path}"?`;
                if (window.confirm(message)) onDeletePath(node.path, node.kind === 'folder');
              }} className="rounded p-1 text-rose-300 hover:bg-rose-500/15"><Trash2 size={12} /></button>
            </div>
          </div>
          {node.kind === 'folder' && isOpen && <div className="ml-2 border-l border-slate-800 pl-1">{renderNodes(node.children, depth + 1)}</div>}
        </React.Fragment>
      );
    });

  const fileCount = Object.keys(files).length;
  const filteredTree = tree;

  return (
    <aside aria-label="Project files" className={`flex h-full flex-col bg-slate-950 text-slate-100 ${isBottomSheet ? 'w-full rounded-t-2xl' : 'w-[270px] shrink-0 border-r border-slate-800'}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold">Project Files</h2>
          <p className="text-[10px] text-slate-400">{fileCount} files · folders created from paths</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title="New file" onClick={() => { setShowCreate('file'); setError(''); setNewPath(''); }} className="rounded p-1.5 text-slate-300 hover:bg-slate-800"><FilePlus2 size={15} /></button>
          <button type="button" title="New folder" onClick={() => { setShowCreate('folder'); setError(''); setNewPath(''); }} className="rounded p-1.5 text-slate-300 hover:bg-slate-800"><FolderPlus size={15} /></button>
          <button type="button" title="Refresh file tree" onClick={onRefresh} className="rounded p-1.5 text-slate-300 hover:bg-slate-800"><RefreshCw size={14} /></button>
          {isBottomSheet && onClose && <button type="button" onClick={onClose} className="rounded p-1.5 text-slate-300 hover:bg-slate-800">×</button>}
        </div>
      </div>
      {showCreate && (
        <form onSubmit={(event) => { event.preventDefault(); create(); }} className="space-y-2 border-b border-slate-800 p-3">
          <p className="text-xs font-semibold">{showCreate === 'file' ? 'Create file' : 'Create folder'}</p>
          <input autoFocus value={newPath} onChange={(event) => setNewPath(event.target.value)} placeholder={showCreate === 'file' ? 'components/layout/AppShell.tsx' : 'components/layout'} className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 font-mono text-[11px] text-white outline-none focus:border-sky-500" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCreate(null)} className="flex-1 rounded border border-slate-700 py-1.5 text-[11px] text-slate-300">Cancel</button>
            <button type="submit" disabled={!newPath.trim()} className="flex-1 rounded bg-sky-600 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">Create</button>
          </div>
          {error && <p role="alert" className="text-[10px] text-rose-300">{error}</p>}
        </form>
      )}
      <div className="border-b border-slate-800 p-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter files..." aria-label="Filter project files" className="h-8 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white outline-none focus:border-sky-500" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredTree.length === 0 ? <p className="p-3 text-xs text-slate-500">No files yet.</p> : renderNodes(filteredTree)}
      </div>
    </aside>
  );
}
