'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  ClipboardCopy,
  ClipboardPaste,
  Code2,
  Columns2,
  Component,
  Copy,
  Download,
  FileCode2,
  FolderUp,
  GitBranch,
  History,
  Images,
  Layers,
  LayoutGrid,
  LayoutPanelTop,
  Monitor,
  PackagePlus,
  Palette,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import {
  COMMAND_CATEGORY_LABELS,
  CommandCategory,
  StudioCommandItem,
  filterAndRankCommands,
} from '@/lib/studio/command-palette';

interface CommandPaletteModalProps {
  isOpen: boolean;
  items: StudioCommandItem[];
  selectedLabel?: string | null;
  onExecuteCommand: (commandId: string) => void;
  onClose: () => void;
}

const CATEGORIES: Array<CommandCategory | 'all'> = [
  'all',
  'tools',
  'blocks',
  'element',
  'pages',
  'canvas',
];

function CommandIcon({ iconKey }: { iconKey: StudioCommandItem['iconKey'] }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (iconKey) {
    case 'sparkles':
      return <Sparkles className={`${cls} text-fuchsia-600`} />;
    case 'images':
      return <Images className={`${cls} text-violet-600`} />;
    case 'logic':
      return <GitBranch className={`${cls} text-violet-600`} />;
    case 'motion':
      return <Clapperboard className={`${cls} text-indigo-600`} />;
    case 'layout':
      return <LayoutGrid className={`${cls} text-indigo-600`} />;
    case 'align':
      return <Wand2 className={`${cls} text-indigo-600`} />;
    case 'library':
      return <PackagePlus className={`${cls} text-indigo-600`} />;
    case 'palette':
      return <Palette className={`${cls} text-blue-600`} />;
    case 'gradient':
      return <Sparkles className={`${cls} text-blue-600`} />;
    case 'code':
      return <Code2 className={`${cls} text-slate-700`} />;
    case 'layers':
      return <Layers className={`${cls} text-slate-700`} />;
    case 'inspector':
      return <SlidersHorizontal className={`${cls} text-slate-700`} />;
    case 'export':
      return <Download className={`${cls} text-blue-600`} />;
    case 'import':
      return <FolderUp className={`${cls} text-slate-700`} />;
    case 'save':
      return <Save className={`${cls} text-emerald-600`} />;
    case 'drafts':
      return <History className={`${cls} text-slate-700`} />;
    case 'page':
      return <FileCode2 className={`${cls} text-blue-600`} />;
    case 'component':
      return <Component className={`${cls} text-emerald-600`} />;
    case 'copy':
      return <ClipboardCopy className={`${cls} text-slate-600`} />;
    case 'paste':
      return <ClipboardPaste className={`${cls} text-blue-600`} />;
    case 'wrap':
      return <Columns2 className={`${cls} text-blue-600`} />;
    case 'duplicate':
      return <Copy className={`${cls} text-slate-600`} />;
    case 'delete':
      return <Trash2 className={`${cls} text-rose-600`} />;
    case 'undo':
      return <Undo2 className={`${cls} text-slate-600`} />;
    case 'redo':
      return <Redo2 className={`${cls} text-slate-600`} />;
    case 'play':
      return <Play className={`${cls} text-emerald-600`} />;
    case 'viewport':
      return <Monitor className={`${cls} text-slate-600`} />;
    case 'replay':
      return <RotateCcw className={`${cls} text-indigo-600`} />;
    case 'block':
    default:
      return <LayoutPanelTop className={`${cls} text-indigo-600`} />;
  }
}

export default function CommandPaletteModal({
  isOpen,
  items,
  selectedLabel,
  onExecuteCommand,
  onClose,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommandCategory | 'all'>('all');
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pointerActiveRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const filtered = useMemo(
    () => filterAndRankCommands(items, query, activeCategory),
    [items, query, activeCategory]
  );

  const safeIndex = filtered.length > 0 ? Math.min(highlightedIdx, filtered.length - 1) : 0;

  useEffect(() => {
    if (!isOpen) return;
    pointerActiveRef.current = false;
    lastPointerRef.current = null;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const activeEl = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, safeIndex]);

  const handleClose = () => {
    pointerActiveRef.current = false;
    lastPointerRef.current = null;
    setQuery('');
    setActiveCategory('all');
    setHighlightedIdx(0);
    onClose();
  };

  const executeItem = (item: StudioCommandItem) => {
    if (item.disabled) return;
    handleClose();
    if (item.onExecute) {
      item.onExecute();
    } else {
      onExecuteCommand(item.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      pointerActiveRef.current = false;
      if (filtered.length > 0) {
        setHighlightedIdx((prev) => (prev + 1) % filtered.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      pointerActiveRef.current = false;
      if (filtered.length > 0) {
        setHighlightedIdx((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
      return;
    }
    if (e.key === 'Enter' && filtered[safeIndex]) {
      e.preventDefault();
      executeItem(filtered[safeIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 backdrop-blur-[2px] sm:items-start sm:p-4 sm:pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Quick command palette"
      data-testid="studio-command-palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[76vh] sm:max-w-xl sm:rounded-2xl">
        {/* Mobile grabber */}
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />

        {/* Search Input Header */}
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <label htmlFor="studio-command-input" className="sr-only">
            Search commands, tools, blocks, and pages
          </label>
          <input
            ref={inputRef}
            id="studio-command-input"
            type="text"
            value={query}
            onChange={(e) => {
              pointerActiveRef.current = false;
              setQuery(e.target.value);
              setHighlightedIdx(0);
            }}
            placeholder="Jump to tool, layout block, page, or element action…"
            className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                pointerActiveRef.current = false;
                setQuery('');
                setHighlightedIdx(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close command palette"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category Filter Tabs (Touch-friendly horizontal scroll) */}
        <div
          className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/70 px-3 py-2"
          role="tablist"
          aria-label="Command categories"
        >
          {CATEGORIES.map((cat) => {
            const count =
              cat === 'all'
                ? items.length
                : items.filter((item) => item.category === cat).length;
            if (cat === 'element' && count === 0) return null;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  pointerActiveRef.current = false;
                  setActiveCategory(cat);
                  setHighlightedIdx(0);
                }}
                className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{COMMAND_CATEGORY_LABELS[cat]}</span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="min-h-[220px] flex-1 overflow-y-auto p-2"
          role="listbox"
          aria-label="Available commands"
          onMouseMove={(e) => {
            const prev = lastPointerRef.current;
            if (!prev) {
              lastPointerRef.current = { x: e.clientX, y: e.clientY };
              return;
            }
            if (Math.hypot(e.clientX - prev.x, e.clientY - prev.y) >= 3) {
              pointerActiveRef.current = true;
              lastPointerRef.current = { x: e.clientX, y: e.clientY };
            }
          }}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No matching commands for &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try searching for Motion, Logic, Global CSS, Section, Flex, or a page name.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((item, idx) => {
                const isActive = idx === safeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={item.disabled}
                    onMouseMove={() => {
                      if (pointerActiveRef.current && highlightedIdx !== idx) {
                        setHighlightedIdx(idx);
                      }
                    }}
                    onClick={() => executeItem(item)}
                    className={`flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors disabled:opacity-45 ${
                      isActive
                        ? 'bg-blue-50 text-slate-900 ring-1 ring-blue-200'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        isActive
                          ? 'border-blue-200 bg-white'
                          : 'border-slate-200/80 bg-slate-50'
                      }`}
                    >
                      <CommandIcon iconKey={item.iconKey} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {item.label}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          · {COMMAND_CATEGORY_LABELS[item.category]}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{item.description}</p>
                    </div>
                    {item.shortcut && (
                      <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <span className="truncate">
            {selectedLabel ? `Target: ${selectedLabel}` : 'Tap any command or press Enter'}
          </span>
          <span className="hidden sm:inline font-mono text-[10px] text-slate-400">
            ↑↓ navigate · ↵ run · Esc close
          </span>
        </div>
      </div>
    </div>
  );
}
