'use client';

import React from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Cpu,
  Info,
  Layers,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';

interface ReactUiThumbnailProps {
  id: string;
  compact?: boolean;
}

export default function ReactUiThumbnail({ id, compact = false }: ReactUiThumbnailProps) {
  const heightCls = compact ? 'h-24' : 'h-36';

  switch (id) {
    case 'ui-navbar':
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5`}>
          <div className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-900 text-white">
                <Layers className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-bold text-slate-900">Atelier UI</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[9px] text-slate-400">
              <span>Features</span>
              <span>Pricing</span>
              <span>Docs</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[9px] font-semibold text-white">
              Start <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      );

    case 'ui-sidebar-nav':
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5`}>
          <div className="w-36 space-y-1 rounded-md border border-slate-200 bg-white p-2 shadow-2xs">
            <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Workspace</div>
            <div className="rounded bg-slate-900 px-2 py-1 text-[9px] font-medium text-white">Overview</div>
            <div className="flex items-center justify-between rounded px-2 py-1 text-[9px] text-slate-600">
              <span>Analytics</span>
              <span className="rounded bg-indigo-100 px-1 text-[8px] text-indigo-700">Live</span>
            </div>
            <div className="rounded px-2 py-1 text-[9px] text-slate-600">Projects</div>
          </div>
        </div>
      );

    case 'ui-page-header':
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5`}>
          <div className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-2xs">
            <div>
              <div className="text-[8px] text-slate-400">Workspace › Overview</div>
              <div className="text-[11px] font-bold text-slate-900">Project Overview</div>
              <div className="text-[9px] text-slate-500">Monitor performance metrics</div>
            </div>
            <span className="rounded bg-indigo-600 px-2 py-1 text-[9px] font-semibold text-white">
              + New
            </span>
          </div>
        </div>
      );

    case 'ui-hero-banner':
      return (
        <div className={`flex ${heightCls} w-full flex-col justify-center rounded-lg bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-3 text-white`}>
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-semibold text-sky-200">
            <Sparkles className="h-2.5 w-2.5" /> Release v2.4
          </span>
          <div className="mt-1.5 text-xs font-bold leading-tight">Ship refined interfaces faster</div>
          <div className="mt-2 flex gap-1.5">
            <span className="rounded bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-900">
              Launch Studio
            </span>
            <span className="rounded border border-white/30 px-2 py-0.5 text-[9px] text-white">
              Docs
            </span>
          </div>
        </div>
      );

    case 'ui-feature-split':
      return (
        <div className={`grid ${heightCls} w-full grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-2.5`}>
          <div className="flex flex-col justify-center space-y-1">
            <div className="text-[10px] font-bold text-slate-900">Responsive precision</div>
            <div className="flex items-center gap-1 text-[8px] text-slate-600">
              <Check className="h-2.5 w-2.5 text-emerald-600" /> Breakpoint isolation
            </div>
            <div className="flex items-center gap-1 text-[8px] text-slate-600">
              <Check className="h-2.5 w-2.5 text-emerald-600" /> Type-safe JSX
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-indigo-100 bg-indigo-50 p-2">
            <div className="text-[8px] font-semibold uppercase text-indigo-700">Verified</div>
            <div className="text-xs font-bold text-slate-900">100% JSX</div>
          </div>
        </div>
      );

    case 'ui-cta-strip':
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5`}>
          <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
            <div>
              <div className="text-[10px] font-bold text-slate-900">Ready to upgrade?</div>
              <div className="text-[8px] text-slate-600">Customize directly on canvas</div>
            </div>
            <span className="shrink-0 rounded bg-indigo-600 px-2 py-1 text-[9px] font-semibold text-white">
              Start Free
            </span>
          </div>
        </div>
      );

    case 'ui-stats-grid':
      return (
        <div className={`grid ${heightCls} w-full grid-cols-3 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2`}>
          {[
            { k: 'Revenue', v: '$48.9k', c: 'text-emerald-600' },
            { k: 'Users', v: '12.4k', c: 'text-indigo-600' },
            { k: 'Latency', v: '24ms', c: 'text-amber-600' },
          ].map((s) => (
            <div key={s.k} className="rounded-md border border-slate-200 bg-white p-2 shadow-2xs">
              <div className="flex items-center justify-between text-[8px] text-slate-400">
                <span>{s.k}</span>
                <TrendingUp className={`h-2.5 w-2.5 ${s.c}`} />
              </div>
              <div className="mt-1 text-[11px] font-bold text-slate-900">{s.v}</div>
            </div>
          ))}
        </div>
      );

    case 'ui-feature-grid':
      return (
        <div className={`grid ${heightCls} w-full grid-cols-3 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2`}>
          {['Compile', 'Tokens', 'Mobile'].map((label) => (
            <div key={label} className="rounded-md border border-slate-200 bg-white p-2 shadow-2xs">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-indigo-50 text-indigo-600">
                <Cpu className="h-2.5 w-2.5" />
              </span>
              <div className="mt-1 text-[9px] font-semibold text-slate-900">{label}</div>
              <div className="mt-0.5 h-1.5 w-10 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      );

    case 'ui-pricing-cards':
      return (
        <div className={`grid ${heightCls} w-full grid-cols-2 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2`}>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <div className="text-[8px] text-slate-500">Starter</div>
            <div className="text-xs font-bold text-slate-900">$0</div>
            <div className="mt-1.5 rounded border border-slate-200 py-0.5 text-center text-[8px] text-slate-700">
              Free
            </div>
          </div>
          <div className="rounded-md border border-indigo-500 bg-slate-900 p-2 text-white">
            <div className="text-[8px] text-indigo-300">Pro</div>
            <div className="text-xs font-bold">$29</div>
            <div className="mt-1.5 rounded bg-indigo-600 py-0.5 text-center text-[8px] font-semibold">
              Upgrade
            </div>
          </div>
        </div>
      );

    case 'ui-testimonial-card':
      return (
        <div className={`flex ${heightCls} w-full flex-col justify-center rounded-lg border border-slate-200 bg-white p-3`}>
          <div className="flex gap-0.5 text-amber-400">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-2.5 w-2.5 fill-current" />
            ))}
          </div>
          <div className="mt-1.5 text-[10px] italic text-slate-700">
            &ldquo;Modular React UI saved days of work.&rdquo;
          </div>
          <div className="mt-1.5 text-[9px] font-semibold text-slate-900">Ananya Verma</div>
        </div>
      );

    case 'ui-tabs-panel':
      return (
        <div className={`flex ${heightCls} w-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-2.5`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="text-[10px] font-semibold text-slate-800">Details</span>
            <div className="flex gap-1 rounded bg-slate-100 p-0.5 text-[8px]">
              <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-slate-900 shadow-2xs">
                Overview
              </span>
              <span className="px-1.5 py-0.5 text-slate-500">Metrics</span>
            </div>
          </div>
          <div className="space-y-1 py-1">
            <div className="h-2 w-full rounded bg-slate-100" />
            <div className="h-2 w-3/4 rounded bg-slate-100" />
          </div>
        </div>
      );

    case 'ui-faq-accordion':
      return (
        <div className={`flex ${heightCls} w-full flex-col justify-center space-y-1.5 rounded-lg border border-slate-200 bg-white p-2.5`}>
          <div className="rounded border border-slate-200 px-2 py-1">
            <div className="flex items-center justify-between text-[9px] font-semibold text-slate-800">
              <span>Editable visually?</span>
              <ChevronDown className="h-3 w-3 rotate-180 text-slate-400" />
            </div>
            <div className="mt-0.5 text-[8px] text-slate-500">Yes, directly on canvas.</div>
          </div>
          <div className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 text-[9px] text-slate-600">
            <span>Works with custom libs?</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </div>
        </div>
      );

    case 'ui-data-table':
      return (
        <div className={`flex ${heightCls} w-full flex-col justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-2`}>
          <div className="grid grid-cols-3 rounded bg-slate-50 px-2 py-1 text-[8px] font-semibold uppercase text-slate-400">
            <span>Module</span>
            <span>Status</span>
            <span className="text-right">Time</span>
          </div>
          <div className="grid grid-cols-3 items-center border-b border-slate-100 px-2 py-1 text-[9px]">
            <span className="font-medium text-slate-800">Hero</span>
            <span className="w-fit rounded bg-emerald-50 px-1 text-[8px] text-emerald-700">Live</span>
            <span className="text-right text-slate-400">2m</span>
          </div>
          <div className="grid grid-cols-3 items-center px-2 py-1 text-[9px]">
            <span className="font-medium text-slate-800">Checkout</span>
            <span className="w-fit rounded bg-amber-50 px-1 text-[8px] text-amber-700">Review</span>
            <span className="text-right text-slate-400">1h</span>
          </div>
        </div>
      );

    case 'ui-alert-banner':
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5`}>
          <div className="flex w-full items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
            <div>
              <div className="text-[10px] font-semibold">System update scheduled</div>
              <div className="text-[8px] text-sky-700">Dismissible notification banner</div>
            </div>
          </div>
        </div>
      );

    case 'ui-button-group':
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5`}>
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[9px] font-semibold text-white">
            <Sparkles className="h-2.5 w-2.5" /> Publish
          </span>
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-semibold text-slate-700">
            Export
          </span>
          <span className="rounded-md bg-slate-200/70 px-2 py-1.5 text-[9px] font-medium text-slate-700">
            Share
          </span>
        </div>
      );

    case 'ui-search-bar':
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2.5`}>
          <div className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
              <Search className="h-3 w-3" />
              <span>Search components...</span>
            </div>
            <div className="flex gap-1 text-[8px]">
              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">All</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">Active</span>
            </div>
          </div>
        </div>
      );

    case 'ui-motion-card':
      return (
        <div className={`flex ${heightCls} w-full flex-col justify-center rounded-lg border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-3`}>
          <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider text-indigo-600">
            <Sparkles className="h-2.5 w-2.5" /> Framer Motion
          </div>
          <div className="mt-1 text-xs font-bold text-slate-900">Animated Reveal Card</div>
          <div className="mt-0.5 text-[9px] text-slate-600">Smooth mount entrance</div>
        </div>
      );

    case 'ui-recharts-bar':
      return (
        <div className={`flex ${heightCls} w-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-2.5`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-900">Weekly Traffic</span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-700">
              Recharts
            </span>
          </div>
          <div className="flex h-14 items-end gap-1.5 px-2 pt-2">
            {[45, 72, 58, 95, 80].map((pct, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-indigo-600/85"
                style={{ height: `${pct}%` }}
              />
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className={`flex ${heightCls} w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400`}>
          UI Preview
        </div>
      );
  }
}
