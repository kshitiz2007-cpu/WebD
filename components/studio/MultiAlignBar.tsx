'use client';

import React from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Columns2,
  MoveHorizontal,
  MoveVertical,
  Rows3,
  X,
} from 'lucide-react';
import { MultiAlignAction } from '@/lib/studio/visual-refinement';
import { WrapContainerLayout } from '@/lib/studio/source-editor';

interface MultiAlignBarProps {
  count: number;
  canWrapInContainer: boolean;
  onAlignAction: (action: MultiAlignAction) => void;
  onWrapContainer: (layout: WrapContainerLayout) => void;
  onClear: () => void;
}

export default function MultiAlignBar({
  count,
  canWrapInContainer,
  onAlignAction,
  onWrapContainer,
  onClear,
}: MultiAlignBarProps) {
  if (count < 2) return null;

  const btnCls =
    'inline-flex h-7 w-7 items-center justify-center rounded text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors';

  return (
    <div
      data-testid="studio-multi-align-bar"
      role="toolbar"
      aria-label="Multi-element alignment and distribution"
      className="mb-2 flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white shadow-lg"
    >
      <span className="mr-1 rounded bg-indigo-600/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-white">
        {count} selected
      </span>

      <div className="flex items-center gap-0.5 border-r border-slate-700 pr-1.5">
        <button
          type="button"
          title="Align left edges"
          aria-label="Multi-align left edges"
          onClick={() => onAlignAction('left')}
          className={btnCls}
        >
          <AlignStartVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Align horizontal centers"
          aria-label="Multi-align horizontal centers"
          onClick={() => onAlignAction('center')}
          className={btnCls}
        >
          <AlignCenterVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Align right edges"
          aria-label="Multi-align right edges"
          onClick={() => onAlignAction('right')}
          className={btnCls}
        >
          <AlignEndVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-700 pr-1.5">
        <button
          type="button"
          title="Align top edges"
          aria-label="Multi-align top edges"
          onClick={() => onAlignAction('top')}
          className={btnCls}
        >
          <AlignStartHorizontal className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Align vertical middles"
          aria-label="Multi-align vertical middles"
          onClick={() => onAlignAction('middle')}
          className={btnCls}
        >
          <AlignCenterHorizontal className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Align bottom edges"
          aria-label="Multi-align bottom edges"
          onClick={() => onAlignAction('bottom')}
          className={btnCls}
        >
          <AlignEndHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-700 pr-1.5">
        <button
          type="button"
          disabled={count < 3}
          title={count < 3 ? 'Select 3+ elements to distribute horizontally' : 'Distribute horizontal spacing equally'}
          aria-label="Distribute horizontally"
          onClick={() => onAlignAction('distribute-h')}
          className={btnCls}
        >
          <AlignHorizontalSpaceAround className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={count < 3}
          title={count < 3 ? 'Select 3+ elements to distribute vertically' : 'Distribute vertical spacing equally'}
          aria-label="Distribute vertically"
          onClick={() => onAlignAction('distribute-v')}
          className={btnCls}
        >
          <AlignVerticalSpaceAround className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-700 pr-1.5">
        <button
          type="button"
          title="Match width to first selected element"
          aria-label="Match width"
          onClick={() => onAlignAction('match-width')}
          className={btnCls}
        >
          <MoveHorizontal className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Match height to first selected element"
          aria-label="Match height"
          onClick={() => onAlignAction('match-height')}
          className={btnCls}
        >
          <MoveVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {canWrapInContainer && (
        <div className="flex items-center gap-1 border-r border-slate-700 pr-1.5">
          <button
            type="button"
            title="Wrap selected siblings in Flex Row"
            aria-label="Wrap in Flex Row"
            onClick={() => onWrapContainer('row')}
            className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-sky-300 hover:bg-slate-700 hover:text-white whitespace-nowrap"
          >
            <Rows3 className="h-3 w-3" />
            <span>Flex Row</span>
          </button>
          <button
            type="button"
            title="Wrap selected siblings in 2-Column Grid"
            aria-label="Wrap in 2-Column Grid"
            onClick={() => onWrapContainer('grid-2')}
            className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-sky-300 hover:bg-slate-700 hover:text-white whitespace-nowrap"
          >
            <Columns2 className="h-3 w-3" />
            <span>2-Col Grid</span>
          </button>
        </div>
      )}

      <button
        type="button"
        title="Clear multi-selection"
        aria-label="Clear multi-selection"
        onClick={onClear}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
