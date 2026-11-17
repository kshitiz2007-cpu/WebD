'use client';

import React, { useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Clock,
  FolderOpen,
  History,
  Trash2,
  X,
} from 'lucide-react';
import { StudioDraft } from '@/lib/studio/types';

interface DraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectName: string;
  currentRoute: string;
  hasUnsavedEdits: boolean;
  drafts: StudioDraft[];
  autosaveDraft: StudioDraft | null;
  onSaveDraft: (title: string) => { ok: boolean; error?: string };
  onLoadDraft: (draft: StudioDraft) => void;
  onDeleteDraft: (id: string) => void;
  onClearAutosave: () => void;
}

function formatSavedTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Recently';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

export default function DraftsModal({
  isOpen,
  onClose,
  currentProjectName,
  currentRoute,
  hasUnsavedEdits,
  drafts,
  autosaveDraft,
  onSaveDraft,
  onLoadDraft,
  onDeleteDraft,
  onClearAutosave,
}: DraftsModalProps) {
  const [titleInput, setTitleInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const chosenTitle =
      titleInput.trim() || `${currentProjectName} (${currentRoute})`;
    const result = onSaveDraft(chosenTitle);
    if (!result.ok) {
      setError(result.error || 'Could not save draft.');
      return;
    }
    setTitleInput('');
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drafts-modal-title"
    >
      <div className="flex w-full max-w-lg max-h-[90dvh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <h2 id="drafts-modal-title" className="text-sm font-semibold text-slate-900">
              Saved Drafts &amp; Progress
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close drafts dialog"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 studio-scroll">
          {/* Save Current Progress Form */}
          <form
            onSubmit={handleSaveSubmit}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="draft-title-input"
                className="text-xs font-semibold text-slate-800"
              >
                Save Current Progress
              </label>
              <span className="font-mono text-[10px] text-slate-500">
                {currentProjectName} · {currentRoute}
                {hasUnsavedEdits ? ' · Modified' : ''}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="draft-title-input"
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder={`${currentProjectName} (${currentRoute})`}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {savedNotice ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    <span>Save Draft</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                {error}
              </p>
            )}
          </form>

          {/* Latest Auto-Saved Progress */}
          {autosaveDraft && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                    <p className="text-xs font-semibold text-slate-900">
                      Auto-Saved Session Progress
                    </p>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-600">
                    {autosaveDraft.projectName} · {autosaveDraft.activeRoute} ·{' '}
                    {autosaveDraft.modifiedFileCount} modified ·{' '}
                    {formatSavedTime(autosaveDraft.savedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadDraft(autosaveDraft);
                      onClose();
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Clear auto-saved session"
                    onClick={onClearAutosave}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Earlier Saved Drafts List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Earlier Saved Drafts
              </h3>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">
                {drafts.length}
              </span>
            </div>

            {drafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
                <Clock className="mx-auto mb-2 h-5 w-5 text-slate-400" />
                <p className="text-xs font-medium text-slate-600">
                  No saved drafts yet
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Save a draft above or tap Save in the toolbar to restore progress anytime.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {draft.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                        {draft.projectName} · {draft.activeRoute} · {draft.viewport} ·{' '}
                        {draft.modifiedFileCount} file
                        {draft.modifiedFileCount === 1 ? '' : 's'} edited ·{' '}
                        {formatSavedTime(draft.savedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadDraft(draft);
                          onClose();
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>Load</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete draft ${draft.title}`}
                        onClick={() => onDeleteDraft(draft.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
