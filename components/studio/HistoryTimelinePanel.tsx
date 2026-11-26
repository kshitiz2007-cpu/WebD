'use client';

import React from 'react';
import { Clock, Columns2, RotateCcw, Undo2, X } from 'lucide-react';

export interface HistoryTimelineEntry {
  id: string;
  label: string;
  timestamp: string;
  files: Record<string, string>;
}

interface HistoryTimelinePanelProps {
  entries: HistoryTimelineEntry[];
  currentIndex: number;
  isCompareOpen: boolean;
  onToggleCompare: () => void;
  onJumpToIndex: (index: number) => void;
  onResetToOriginal: () => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

export default function HistoryTimelinePanel({
  entries,
  currentIndex,
  isCompareOpen,
  onToggleCompare,
  onJumpToIndex,
  onResetToOriginal,
  onClose,
  isBottomSheet = false,
}: HistoryTimelinePanelProps) {
  return (
    <aside
      aria-label="Visual History Timeline"
      data-testid="history-timeline-panel"
      className={`flex h-full flex-col bg-white ${
        isBottomSheet
          ? 'w-full rounded-t-2xl border-t border-slate-200'
          : 'w-[320px] border-l border-slate-200'
      }`}
    >
      {isBottomSheet && (
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
      )}

      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900">History &amp; Diff</h2>
            <p className="truncate text-[11px] text-slate-500">
              {entries.length} recorded {entries.length === 1 ? 'checkpoint' : 'checkpoints'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close History Timeline"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Before / After Split Toggle */}
      <div className="border-b border-slate-100 bg-slate-50/70 p-3 space-y-2">
        <button
          type="button"
          onClick={onToggleCompare}
          aria-pressed={isCompareOpen}
          className={`flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
            isCompareOpen
              ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Columns2 className="h-4 w-4" />
          <span>{isCompareOpen ? 'Exit Before / After Slider' : 'Compare Before / After Slider'}</span>
        </button>
        <p className="text-[11px] text-slate-500">
          Drag the live split divider on the canvas to compare your original design against current edits.
        </p>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {[...entries]
          .map((entry, idx) => ({ entry, idx }))
          .reverse()
          .map(({ entry, idx }) => {
            const isCurrent = idx === currentIndex;
            const isFuture = idx > currentIndex;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onJumpToIndex(idx)}
                className={`flex min-h-[46px] w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/70 text-slate-900 ring-1 ring-blue-200'
                    : isFuture
                    ? 'border-dashed border-slate-200 bg-slate-50/60 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                    : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    isCurrent
                      ? 'bg-blue-600 ring-4 ring-blue-100'
                      : isFuture
                      ? 'bg-slate-300'
                      : 'bg-slate-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">
                      {entry.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{entry.timestamp}</span>
                    {isCurrent && (
                      <span className="font-semibold text-blue-600">Current</span>
                    )}
                    {isFuture && <span>Redo step</span>}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
        <button
          type="button"
          disabled={currentIndex <= 0}
          onClick={() => onJumpToIndex(Math.max(0, currentIndex - 1))}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
          <span>Step Back</span>
        </button>
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={onResetToOriginal}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Original</span>
        </button>
      </div>
    </aside>
  );
}
