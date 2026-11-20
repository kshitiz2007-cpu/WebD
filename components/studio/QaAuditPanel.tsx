'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { QaAuditIssue, computeQaScore } from '@/lib/studio/qa-audit';

interface QaAuditPanelProps {
  issues: QaAuditIssue[];
  isScanning: boolean;
  onRescan: () => void;
  onFocusIssue: (issue: QaAuditIssue) => void;
  onAutoFixIssue: (issue: QaAuditIssue) => void;
  onAutoFixAll: () => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

export default function QaAuditPanel({
  issues,
  isScanning,
  onRescan,
  onFocusIssue,
  onAutoFixIssue,
  onAutoFixAll,
  onClose,
  isBottomSheet = false,
}: QaAuditPanelProps) {
  const score = computeQaScore(issues);
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;
  const lowCount = issues.filter((i) => i.severity === 'low').length;

  return (
    <aside
      aria-label="Live QA Audit Overlay"
      data-testid="qa-audit-panel"
      className={`flex h-full flex-col bg-white ${
        isBottomSheet
          ? 'w-full rounded-t-2xl border-t border-slate-200'
          : 'w-[340px] border-l border-slate-200'
      }`}
    >
      {isBottomSheet && (
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
      )}

      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900">Live QA Audit</h2>
            <p className="truncate text-[11px] text-slate-500">
              Contrast, touch targets &amp; mobile overflow
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QA Audit"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Health Summary */}
      <div className="border-b border-slate-100 bg-slate-50/80 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Page Readiness Score</div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${
                  score >= 88
                    ? 'text-emerald-600'
                    : score >= 65
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {score}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 border border-rose-200">
              {highCount} High
            </span>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700 border border-amber-200">
              {mediumCount} Med
            </span>
            {lowCount > 0 && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                {lowCount} Low
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRescan}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Re-scan</span>
          </button>
          {issues.length > 0 && (
            <button
              type="button"
              onClick={onAutoFixAll}
              className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Auto-Fix All ({issues.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Issue List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div className="mt-2 text-sm font-bold text-emerald-900">
              All Checks Passed
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              Zero contrast failures, tiny touch targets, or horizontal overflow detected on this viewport.
            </p>
          </div>
        ) : (
          issues.map((issue, idx) => (
            <div
              key={issue.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-colors hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onFocusIssue(issue)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold text-white ${
                      issue.severity === 'high'
                        ? 'bg-rose-600'
                        : issue.severity === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-slate-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-slate-900">
                        {issue.title}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                      {issue.detail}
                    </p>
                  </div>
                </button>
                <AlertTriangle
                  className={`h-3.5 w-3.5 shrink-0 ${
                    issue.severity === 'high' ? 'text-rose-500' : 'text-amber-500'
                  }`}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <span className="truncate font-mono text-[10px] text-slate-400">
                  &lt;{issue.tagName}&gt; {issue.label}
                </span>
                <button
                  type="button"
                  onClick={() => onAutoFixIssue(issue)}
                  className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Wand2 className="h-3 w-3" />
                  <span>{issue.fixLabel}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
