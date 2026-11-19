'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ImagePlus, Search, Trash2, Upload, X, Film, Music2, FileImage, FolderOpen, Check } from 'lucide-react';

type MediaAsset = {
  id: string;
  name: string;
  type: string;
  size: number;
  folder: string;
  dataUrl: string;
  createdAt: number;
};

const DB_NAME = 'webd-media-library';
const STORE_NAME = 'assets';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED = 'image/*,video/*,audio/*,.svg';

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Browser storage is unavailable.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('folder', 'folder');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open media storage.'));
  });
}

async function readAssets(): Promise<MediaAsset[]> {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as MediaAsset[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

async function saveAsset(asset: MediaAsset): Promise<void> {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeAsset(id: string): Promise<void> {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file.'));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryModal({
  open,
  onClose,
  onInsert,
  hasSelection,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (asset: { name: string; type: string; dataUrl: string }, mode?: 'normal' | 'cutout') => void;
  hasSelection: boolean;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('All assets');
  const [newFolder, setNewFolder] = useState('General');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try { setAssets(await readAssets()); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load media library.'); }
  };

  useEffect(() => {
    if (open) { void refresh(); setNotice(''); }
  }, [open]);

  const folders = useMemo(() => ['All assets', ...Array.from(new Set(assets.map((a) => a.folder || 'General'))).sort()], [assets]);
  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesFolder = folder === 'All assets' || asset.folder === folder;
    const matchesQuery = `${asset.name} ${asset.folder} ${asset.type}`.toLowerCase().includes(query.toLowerCase());
    return matchesFolder && matchesQuery;
  }), [assets, folder, query]);
  const selected = assets.find((asset) => asset.id === selectedId) || null;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setNotice('');
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} is larger than 20 MB. Please compress it first.`);
        if (!(file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.svg'))) {
          throw new Error(`${file.name} is not a supported media file.`);
        }
        const dataUrl = await fileToDataUrl(file);
        const asset: MediaAsset = {
          id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          type: file.type || (file.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream'),
          size: file.size,
          folder: newFolder.trim() || 'General',
          dataUrl,
          createdAt: Date.now(),
        };
        await saveAsset(asset);
        setSelectedId(asset.id);
      }
      await refresh();
      setNotice(`${files.length} asset(s) added to your library.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (asset: MediaAsset) => {
    if (!window.confirm(`Delete ${asset.name} from this browser's media library?`)) return;
    await removeAsset(asset.id);
    if (selectedId === asset.id) setSelectedId(null);
    await refresh();
  };

  const handleCopy = async (asset: MediaAsset) => {
    try {
      await navigator.clipboard.writeText(asset.dataUrl);
      setNotice('Data URL copied. It can be pasted into an image URL field.');
    } catch {
      setNotice('Clipboard access unavailable in this browser.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Media asset library">
      <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-violet-100 p-2 text-violet-700"><FolderOpen className="h-4 w-4" /></div>
            <div><h2 className="text-sm font-semibold text-slate-900">Media Asset Library</h2><p className="text-[11px] text-slate-500">{assets.length} assets · saved in this browser</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close media library" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]">
          <main className="flex min-h-0 flex-col border-b border-slate-200 md:border-b-0 md:border-r">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
              <div className="relative min-w-[150px] flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assets..." className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-violet-400" /></div>
              <select value={folder} onChange={(e) => setFolder(e.target.value)} className="h-9 max-w-[150px] rounded-lg border border-slate-200 bg-white px-2 text-xs">{folders.map((name) => <option key={name}>{name}</option>)}</select>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"><Upload className="h-3.5 w-3.5" />{busy ? 'Uploading…' : 'Upload'}</button>
              <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {filtered.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center"><ImagePlus className="h-8 w-8 text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-600">No assets here yet</p><p className="mt-1 text-[11px] text-slate-400">Upload images, transparent PNGs, SVG, video or audio.</p></div> :
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{filtered.map((asset) => <button key={asset.id} type="button" onClick={() => setSelectedId(asset.id)} className={`group overflow-hidden rounded-xl border text-left transition ${selectedId === asset.id ? 'border-violet-500 ring-2 ring-violet-100' : 'border-slate-200 hover:border-violet-300'}`}>
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
                    {asset.type.startsWith('image/') ? <img src={asset.dataUrl} alt={asset.name} className="h-full w-full object-contain" /> : asset.type.startsWith('video/') ? <Film className="h-8 w-8 text-slate-400" /> : <Music2 className="h-8 w-8 text-slate-400" />}
                  </div><div className="p-2"><p className="truncate text-[11px] font-semibold text-slate-700">{asset.name}</p><p className="truncate text-[10px] text-slate-400">{asset.folder} · {formatSize(asset.size)}</p></div>
                </button>)}</div>}
            </div>
          </main>

          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
            <div><label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Upload folder</label><input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="e.g. Chef photos" className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-violet-400" /></div>
            {selected ? <>
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {selected.type.startsWith('image/') ? <img src={selected.dataUrl} alt={selected.name} className="h-full w-full object-contain" /> : selected.type.startsWith('video/') ? <video src={selected.dataUrl} controls className="max-h-full max-w-full" /> : selected.type.startsWith('audio/') ? <div className="w-full p-3"><Music2 className="mx-auto mb-3 h-8 w-8 text-slate-400" /><audio src={selected.dataUrl} controls className="w-full" /></div> : <FileImage className="h-10 w-10 text-slate-400" />}
              </div>
              <div><p className="break-all text-xs font-semibold text-slate-800">{selected.name}</p><p className="mt-1 text-[10px] text-slate-500">{selected.type} · {formatSize(selected.size)}</p><p className="text-[10px] text-slate-500">Folder: {selected.folder}</p></div>
              <button type="button" onClick={() => void handleCopy(selected)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"><Copy className="h-3.5 w-3.5" />Copy data URL</button>
              <button type="button" onClick={() => void handleDelete(selected)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Delete asset</button>
              <button type="button" disabled={!hasSelection} onClick={() => { onInsert({ name: selected.name, type: selected.type, dataUrl: selected.dataUrl }, 'normal'); onClose(); }} className="mt-auto flex h-10 items-center justify-center gap-1.5 rounded-lg bg-violet-600 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-3.5 w-3.5" />{selected.type.startsWith('image/') ? 'Insert image' : selected.type.startsWith('video/') ? 'Insert video' : 'Insert audio'}</button>
              {selected.type.startsWith('image/') && <button type="button" disabled={!hasSelection} onClick={() => { onInsert({ name: selected.name, type: selected.type, dataUrl: selected.dataUrl }, 'cutout'); onClose(); }} className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"><ImagePlus className="h-3.5 w-3.5" />Insert as floating cutout</button>}
              {!hasSelection && <p className="text-[10px] leading-4 text-slate-500">Select an element on the canvas first. Choose a matching media element to replace its source, or another element to insert this asset after it.</p>}
            </> : <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400"><FileImage className="h-8 w-8" /><p className="mt-2 text-xs">Select an asset to preview</p></div>}
            {notice && <p className="rounded-lg bg-slate-100 p-2 text-[10px] leading-4 text-slate-600">{notice}</p>}
            <p className="text-[10px] leading-4 text-slate-400">Files up to 20 MB. Assets remain on this browser/device; they are not automatically synced to another device or uploaded to a server.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
