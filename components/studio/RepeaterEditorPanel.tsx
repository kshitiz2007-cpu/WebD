'use client';

import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Layers3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { RepeaterGroup } from '@/lib/studio/repeater-detector';

interface RepeaterEditorPanelProps {
  groups: RepeaterGroup[];
  activeGroupIndex: number;
  onSelectGroupIndex: (index: number) => void;
  onAddItem: (group: RepeaterGroup) => void;
  onDuplicateItem: (group: RepeaterGroup, itemElementIndex: number) => void;
  onRemoveItem: (group: RepeaterGroup, itemElementIndex: number) => void;
  onMoveItem: (group: RepeaterGroup, itemElementIndex: number, targetIndex: number) => void;
  onUpdateSlotText: (
    group: RepeaterGroup,
    slotElementIndex: number,
    nextText: string
  ) => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

export default function RepeaterEditorPanel({
  groups,
  activeGroupIndex,
  onSelectGroupIndex,
  onAddItem,
  onDuplicateItem,
  onRemoveItem,
  onMoveItem,
  onUpdateSlotText,
  onClose,
  isBottomSheet = false,
}: RepeaterEditorPanelProps) {
  const safeGroupIdx =
    groups.length > 0 ? Math.min(Math.max(0, activeGroupIndex), groups.length - 1) : 0;
  const activeGroup = groups[safeGroupIdx] || null;
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});

  const commitSlot = (slotKey: string, slotElementIndex: number, fallbackText: string) => {
    if (!activeGroup) return;
    const raw = draftTexts[slotKey];
    if (raw === undefined || raw === fallbackText) return;
    onUpdateSlotText(activeGroup, slotElementIndex, raw);
    setDraftTexts((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  return (
    <aside
      aria-label="Smart Card and Grid Repeater Editor"
      data-testid="repeater-editor-panel"
      className={`flex h-full flex-col bg-white ${
        isBottomSheet
          ? 'w-full rounded-t-2xl border-t border-slate-200'
          : 'w-[350px] border-l border-slate-200'
      }`}
    >
      {isBottomSheet && (
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
      )}

      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Layers3 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900">Card &amp; Grid Repeater</h2>
            <p className="truncate text-[11px] text-slate-500">
              Add, reorder &amp; bulk-edit repeating cards
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Repeater Editor"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Detected Group Selector */}
      {groups.length > 0 && (
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {groups.map((grp, idx) => {
              const active = idx === safeGroupIdx;
              return (
                <button
                  key={`${grp.filePath}:${grp.containerElementIndex}`}
                  type="button"
                  onClick={() => onSelectGroupIndex(idx)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'border-violet-600 bg-violet-600 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {grp.containerLabel}
                </button>
              );
            })}
          </div>
          {activeGroup && (
            <button
              type="button"
              onClick={() => onAddItem(activeGroup)}
              className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Card / Item</span>
            </button>
          )}
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {!activeGroup ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <Layers3 className="h-7 w-7 text-slate-400" />
            <div className="mt-2 text-xs font-semibold text-slate-700">
              No repeating card grids detected on this page
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Insert a 2-Column or 3-Column Feature/Pricing grid from Layout Blocks or React Lib UI to manage items here.
            </p>
          </div>
        ) : (
          activeGroup.items.map((item, idx) => (
            <div
              key={`${activeGroup.filePath}:${item.elementIndex}`}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-50 font-mono text-[10px] font-bold text-violet-700">
                    {idx + 1}
                  </span>
                  <span className="truncate text-xs font-bold text-slate-900">
                    {item.title}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`Move item ${idx + 1} up`}
                    disabled={idx === 0}
                    onClick={() => onMoveItem(activeGroup, item.elementIndex, idx - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move item ${idx + 1} down`}
                    disabled={idx >= activeGroup.items.length - 1}
                    onClick={() => onMoveItem(activeGroup, item.elementIndex, idx + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicate item ${idx + 1}`}
                    onClick={() => onDuplicateItem(activeGroup, item.elementIndex)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete item ${idx + 1}`}
                    disabled={activeGroup.items.length <= 1}
                    onClick={() => onRemoveItem(activeGroup, item.elementIndex)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-35"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {item.slots.map((slot) => {
                  const slotKey = `${activeGroup.filePath}:${slot.elementIndex}`;
                  const value = draftTexts[slotKey] ?? slot.text;
                  return (
                    <div key={slotKey} className="space-y-1">
                      <label
                        htmlFor={`repeater-slot-${slot.elementIndex}`}
                        className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                      >
                        <span>{slot.role}</span>
                        <span className="font-mono lowercase">&lt;{slot.tagName}&gt;</span>
                      </label>
                      <input
                        id={`repeater-slot-${slot.elementIndex}`}
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setDraftTexts((prev) => ({ ...prev, [slotKey]: e.target.value }))
                        }
                        onBlur={() => commitSlot(slotKey, slot.elementIndex, slot.text)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 focus:border-violet-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
