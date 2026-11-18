import {
  ComponentInsertPosition,
  ensureComponentImportInSource,
  formatComponentJsxTag,
  insertJsxSnippetIntoSource,
} from './component-editor';
import {
  addPackageDependencyToFiles,
  injectLibraryImportIntoSource,
} from './library-importer';
import { scanElements } from './source-editor';
import { EXTRA_REACT_UI_LIBRARY_ITEMS } from './react-ui-extra-catalog';

export type ReactUiCategory =
  | 'All'
  | 'Navigation'
  | 'Hero & Sections'
  | 'Cards & Stats'
  | 'Interactive & Data'
  | 'Buttons & Inputs'
  | 'Motion & Charts'
  | 'Forms'
  | 'Feedback'
  | 'Commerce'
  | 'Content'
  | 'Dashboard';

export const REACT_UI_CATEGORIES: ReactUiCategory[] = [
  'All',
  'Navigation',
  'Hero & Sections',
  'Cards & Stats',
  'Interactive & Data',
  'Buttons & Inputs',
  'Motion & Charts',
  'Forms',
  'Feedback',
  'Commerce',
  'Content',
  'Dashboard',
];

export interface ReactUiPackageRequirement {
  packageName: string;
  version: string;
  importMode: 'named' | 'default' | 'namespace';
  identifiers: string[];
}

export interface ReactUiLibraryEntry {
  id: string;
  componentName: string;
  title: string;
  category: Exclude<ReactUiCategory, 'All'>;
  description: string;
  tags: string[];
  packages: ReactUiPackageRequirement[];
  defaultProps: Record<string, string>;
  componentSource: string;
  inlineJsx: string;
}

export const REACT_UI_LIBRARY_ITEMS: ReactUiLibraryEntry[] = [
  {
    id: 'ui-navbar',
    componentName: 'UiNavbar',
    title: 'Responsive Top Navbar',
    category: 'Navigation',
    description: 'Clean sticky navigation bar with brand mark, links, and primary CTA button.',
    tags: ['navbar', 'header', 'menu', 'navigation'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Layers', 'ArrowRight'],
      },
    ],
    defaultProps: {
      brand: 'Atelier UI',
      ctaLabel: 'Get Started',
    },
    componentSource: `'use client';
import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';

export default function UiNavbar({
  brand = 'Atelier UI',
  ctaLabel = 'Get Started',
}: {
  brand?: string;
  ctaLabel?: string;
}) {
  return (
    <header className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Layers className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-900">{brand}</span>
        </div>
        <nav className="hidden items-center gap-6 text-xs font-medium text-slate-600 md:flex">
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          <a href="#docs" className="hover:text-slate-900">Docs</a>
        </nav>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
`,
    inlineJsx: `<header className="w-full border-b border-slate-200 bg-white/95 px-4 py-3 sm:px-6">
  <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
        <Layers className="h-4 w-4" />
      </span>
      <span className="text-sm font-bold tracking-tight text-slate-900">Atelier UI</span>
    </div>
    <nav className="hidden items-center gap-6 text-xs font-medium text-slate-600 md:flex">
      <a href="#features" className="hover:text-slate-900">Features</a>
      <a href="#pricing" className="hover:text-slate-900">Pricing</a>
      <a href="#docs" className="hover:text-slate-900">Docs</a>
    </nav>
    <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white">
      <span>Get Started</span>
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  </div>
</header>`,
  },
  {
    id: 'ui-sidebar-nav',
    componentName: 'UiSidebarNav',
    title: 'Sidebar Navigation Rail',
    category: 'Navigation',
    description: 'Interactive vertical sidebar menu with active state and status counters.',
    tags: ['sidebar', 'rail', 'dashboard', 'nav'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Home', 'BarChart3', 'FolderKanban', 'Settings'],
      },
    ],
    defaultProps: {
      workspaceName: 'Workspace',
    },
    componentSource: `'use client';
import React, { useState } from 'react';
import { Home, BarChart3, FolderKanban, Settings } from 'lucide-react';

export default function UiSidebarNav({
  workspaceName = 'Workspace',
}: {
  workspaceName?: string;
}) {
  const [active, setActive] = useState('Overview');
  const items = [
    { label: 'Overview', icon: Home, badge: '' },
    { label: 'Analytics', icon: BarChart3, badge: 'Live' },
    { label: 'Projects', icon: FolderKanban, badge: '12' },
    { label: 'Settings', icon: Settings, badge: '' },
  ];
  return (
    <aside className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
      <div className="mb-3 px-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
        {workspaceName}
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isCurrent = active === item.label;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setActive(item.label)}
              className={\`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors \${
                isCurrent ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }\`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </span>
              {item.badge && (
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
`,
    inlineJsx: `<aside className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
  <div className="mb-3 px-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">Workspace</div>
  <nav className="space-y-1">
    <a href="#overview" className="flex items-center gap-2 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-medium text-white">
      <Home className="h-3.5 w-3.5" />
      <span>Overview</span>
    </a>
    <a href="#analytics" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
      <BarChart3 className="h-3.5 w-3.5" />
      <span>Analytics</span>
    </a>
    <a href="#projects" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
      <FolderKanban className="h-3.5 w-3.5" />
      <span>Projects</span>
    </a>
  </nav>
</aside>`,
  },
  {
    id: 'ui-page-header',
    componentName: 'UiPageHeader',
    title: 'Page Header & Breadcrumb',
    category: 'Navigation',
    description: 'Structured top section header with breadcrumb path, title, and right-aligned action.',
    tags: ['header', 'breadcrumb', 'toolbar', 'title'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['ChevronRight', 'Plus'],
      },
    ],
    defaultProps: {
      title: 'Project Overview',
      subtitle: 'Monitor performance metrics and manage active deployments.',
      actionLabel: 'New Item',
    },
    componentSource: `'use client';
import React from 'react';
import { ChevronRight, Plus } from 'lucide-react';

export default function UiPageHeader({
  title = 'Project Overview',
  subtitle = 'Monitor performance metrics and manage active deployments.',
  actionLabel = 'New Item',
}: {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
      <div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <span>Workspace</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-700">{title}</span>
        </div>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>{actionLabel}</span>
      </button>
    </div>
  );
}
`,
    inlineJsx: `<div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
  <div>
    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
      <span>Workspace</span>
      <ChevronRight className="h-3 w-3" />
      <span className="text-slate-700">Overview</span>
    </div>
    <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Project Overview</h2>
    <p className="mt-0.5 text-xs text-slate-500">Monitor performance metrics and manage active deployments.</p>
  </div>
  <button type="button" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white">
    <Plus className="h-3.5 w-3.5" />
    <span>New Item</span>
  </button>
</div>`,
  },
  {
    id: 'ui-hero-banner',
    componentName: 'UiHeroBanner',
    title: 'Gradient Hero Banner',
    category: 'Hero & Sections',
    description: 'High-contrast dark gradient hero section with eyebrow pill, headline, and dual CTAs.',
    tags: ['hero', 'banner', 'landing', 'cta'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Sparkles', 'ArrowRight'],
      },
    ],
    defaultProps: {
      badge: 'Release v2.4',
      heading: 'Ship refined interfaces twice as fast',
      description: 'Compose production-ready layouts, customize tokens visually, and export clean React code.',
      primaryCta: 'Launch Studio',
    },
    componentSource: `'use client';
import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function UiHeroBanner({
  badge = 'Release v2.4',
  heading = 'Ship refined interfaces twice as fast',
  description = 'Compose production-ready layouts, customize tokens visually, and export clean React code.',
  primaryCta = 'Launch Studio',
}: {
  badge?: string;
  heading?: string;
  description?: string;
  primaryCta?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-8 text-white shadow-lg">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-200">
        <Sparkles className="h-3.5 w-3.5" />
        <span>{badge}</span>
      </span>
      <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 shadow-xs hover:bg-slate-100"
        >
          <span>{primaryCta}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/25 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
        >
          View Documentation
        </button>
      </div>
    </section>
  );
}
`,
    inlineJsx: `<section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-8 text-white shadow-lg">
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-200">
    <Sparkles className="h-3.5 w-3.5" />
    <span>Release v2.4</span>
  </span>
  <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white">Ship refined interfaces twice as fast</h1>
  <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200">Compose production-ready layouts, customize tokens visually, and export clean React code.</p>
  <div className="mt-6 flex flex-wrap items-center gap-3">
    <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-slate-900">
      <span>Launch Studio</span>
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
    <button type="button" className="rounded-lg border border-white/25 px-4 py-2.5 text-xs font-semibold text-white">
      View Documentation
    </button>
  </div>
</section>`,
  },
  {
    id: 'ui-feature-split',
    componentName: 'UiFeatureSplit',
    title: 'Split Feature Showcase',
    category: 'Hero & Sections',
    description: 'Two-column layout pairing checklist benefits with an elevated highlight panel.',
    tags: ['split', 'feature', 'checklist', 'section'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['CheckCircle2', 'ShieldCheck'],
      },
    ],
    defaultProps: {
      heading: 'Built for responsive precision',
      subtitle: 'Keep desktop and mobile spacing independent with predictable layout tokens.',
    },
    componentSource: `'use client';
import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function UiFeatureSplit({
  heading = 'Built for responsive precision',
  subtitle = 'Keep desktop and mobile spacing independent with predictable layout tokens.',
}: {
  heading?: string;
  subtitle?: string;
}) {
  return (
    <section className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-2">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{heading}</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{subtitle}</p>
        <ul className="mt-4 space-y-2 text-xs text-slate-700">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Responsive breakpoints isolated cleanly</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Direct React component props &amp; styling</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Zero runtime lock-in on export</span>
          </li>
        </ul>
      </div>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-6">
        <div className="flex items-center gap-2 text-indigo-700">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Verified Quality</span>
        </div>
        <p className="mt-3 text-2xl font-bold text-slate-900">100% Type-Safe JSX</p>
        <p className="mt-1 text-xs text-slate-600">
          Every inserted UI block edits cleanly in source and visual mode.
        </p>
      </div>
    </section>
  );
}
`,
    inlineJsx: `<section className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-2">
  <div>
    <h2 className="text-xl font-bold tracking-tight text-slate-900">Built for responsive precision</h2>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">Keep desktop and mobile spacing independent with predictable layout tokens.</p>
    <ul className="mt-4 space-y-2 text-xs text-slate-700">
      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Responsive breakpoints isolated cleanly</span></li>
      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Zero runtime lock-in on export</span></li>
    </ul>
  </div>
  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-6">
    <div className="flex items-center gap-2 text-indigo-700">
      <ShieldCheck className="h-5 w-5" />
      <span className="text-xs font-semibold uppercase tracking-wider">Verified Quality</span>
    </div>
    <p className="mt-3 text-2xl font-bold text-slate-900">100% Type-Safe JSX</p>
  </div>
</section>`,
  },
  {
    id: 'ui-cta-strip',
    componentName: 'UiCtaStrip',
    title: 'Call-to-Action Strip',
    category: 'Hero & Sections',
    description: 'Compact horizontal conversion strip ideal for bottom-of-page or mid-section prompts.',
    tags: ['cta', 'strip', 'banner', 'conversion'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['ArrowRight'],
      },
    ],
    defaultProps: {
      title: 'Ready to upgrade this workflow?',
      subtitle: 'Customize typography, spacing, and interactions directly on the canvas.',
      buttonText: 'Start Free',
    },
    componentSource: `'use client';
import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function UiCtaStrip({
  title = 'Ready to upgrade this workflow?',
  subtitle = 'Customize typography, spacing, and interactions directly on the canvas.',
  buttonText = 'Start Free',
}: {
  title?: string;
  subtitle?: string;
  buttonText?: string;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-6 sm:flex-row sm:items-center">
      <div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        <span>{buttonText}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
`,
    inlineJsx: `<div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-6 sm:flex-row sm:items-center">
  <div>
    <h3 className="text-base font-bold text-slate-900">Ready to upgrade this workflow?</h3>
    <p className="mt-1 text-xs text-slate-600">Customize typography, spacing, and interactions directly on the canvas.</p>
  </div>
  <button type="button" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">
    <span>Start Free</span>
    <ArrowRight className="h-3.5 w-3.5" />
  </button>
</div>`,
  },
  {
    id: 'ui-stats-grid',
    componentName: 'UiStatsGrid',
    title: 'KPI Metric Cards (3-Column)',
    category: 'Cards & Stats',
    description: 'Three-column responsive KPI grid with icons and delta indicators.',
    tags: ['stats', 'kpi', 'metrics', 'cards', 'dashboard'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['TrendingUp', 'Users', 'Zap'],
      },
    ],
    defaultProps: {
      primaryLabel: 'Monthly Revenue',
      primaryValue: '$48,920',
      primaryDelta: '+14.2% vs last month',
    },
    componentSource: `'use client';
import React from 'react';
import { TrendingUp, Users, Zap } from 'lucide-react';

export default function UiStatsGrid({
  primaryLabel = 'Monthly Revenue',
  primaryValue = '$48,920',
  primaryDelta = '+14.2% vs last month',
}: {
  primaryLabel?: string;
  primaryValue?: string;
  primaryDelta?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-medium">{primaryLabel}</span>
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{primaryValue}</p>
        <p className="mt-1 text-[11px] font-medium text-emerald-600">{primaryDelta}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-medium">Active Users</span>
          <Users className="h-4 w-4 text-indigo-600" />
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">12,480</p>
        <p className="mt-1 text-[11px] font-medium text-indigo-600">+6.8% weekly growth</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-medium">Avg Response</span>
          <Zap className="h-4 w-4 text-amber-500" />
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">24ms</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">99.98% uptime</p>
      </div>
    </div>
  );
}
`,
    inlineJsx: `<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex items-center justify-between text-slate-500">
      <span className="text-xs font-medium">Monthly Revenue</span>
      <TrendingUp className="h-4 w-4 text-emerald-600" />
    </div>
    <p className="mt-2 text-2xl font-bold text-slate-900">$48,920</p>
    <p className="mt-1 text-[11px] font-medium text-emerald-600">+14.2% vs last month</p>
  </div>
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex items-center justify-between text-slate-500">
      <span className="text-xs font-medium">Active Users</span>
      <Users className="h-4 w-4 text-indigo-600" />
    </div>
    <p className="mt-2 text-2xl font-bold text-slate-900">12,480</p>
    <p className="mt-1 text-[11px] font-medium text-indigo-600">+6.8% weekly growth</p>
  </div>
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex items-center justify-between text-slate-500">
      <span className="text-xs font-medium">Avg Response</span>
      <Zap className="h-4 w-4 text-amber-500" />
    </div>
    <p className="mt-2 text-2xl font-bold text-slate-900">24ms</p>
    <p className="mt-1 text-[11px] font-medium text-slate-500">99.98% uptime</p>
  </div>
</div>`,
  },
  {
    id: 'ui-feature-grid',
    componentName: 'UiFeatureGrid',
    title: 'Feature Card Grid (3-Up)',
    category: 'Cards & Stats',
    description: 'Three crisp icon-topped feature cards arranged in a responsive grid.',
    tags: ['features', 'cards', 'grid', 'icons'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Cpu', 'Palette', 'Globe'],
      },
    ],
    defaultProps: {
      firstTitle: 'Fast Compilation',
      firstCopy: 'Instant feedback loops while tweaking components visually.',
    },
    componentSource: `'use client';
import React from 'react';
import { Cpu, Palette, Globe } from 'lucide-react';

export default function UiFeatureGrid({
  firstTitle = 'Fast Compilation',
  firstCopy = 'Instant feedback loops while tweaking components visually.',
}: {
  firstTitle?: string;
  firstCopy?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Cpu className="h-4 w-4" />
        </span>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">{firstTitle}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{firstCopy}</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <Palette className="h-4 w-4" />
        </span>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">Design Tokens</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Fine-tune colors, shadows, borders, and typography seamlessly.
        </p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Globe className="h-4 w-4" />
        </span>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">Mobile Ready</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Adaptive flexbox and grid presets built for every viewport.
        </p>
      </article>
    </div>
  );
}
`,
    inlineJsx: `<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Cpu className="h-4 w-4" /></span>
    <h3 className="mt-3 text-sm font-semibold text-slate-900">Fast Compilation</h3>
    <p className="mt-1 text-xs text-slate-600">Instant feedback loops while tweaking components visually.</p>
  </article>
  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><Palette className="h-4 w-4" /></span>
    <h3 className="mt-3 text-sm font-semibold text-slate-900">Design Tokens</h3>
    <p className="mt-1 text-xs text-slate-600">Fine-tune colors, shadows, borders, and typography seamlessly.</p>
  </article>
  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Globe className="h-4 w-4" /></span>
    <h3 className="mt-3 text-sm font-semibold text-slate-900">Mobile Ready</h3>
    <p className="mt-1 text-xs text-slate-600">Adaptive flexbox and grid presets built for every viewport.</p>
  </article>
</div>`,
  },
  {
    id: 'ui-pricing-cards',
    componentName: 'UiPricingCards',
    title: 'Pricing Tier Comparison',
    category: 'Cards & Stats',
    description: 'Two-column Starter & Pro pricing layout with feature bullets and CTA buttons.',
    tags: ['pricing', 'plans', 'tiers', 'cards'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Check'],
      },
    ],
    defaultProps: {
      proTitle: 'Pro Workspace',
      proPrice: '$29',
    },
    componentSource: `'use client';
import React from 'react';
import { Check } from 'lucide-react';

export default function UiPricingCards({
  proTitle = 'Pro Workspace',
  proPrice = '$29',
}: {
  proTitle?: string;
  proPrice?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <span className="text-xs font-semibold text-slate-500">Starter</span>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            $0 <span className="text-xs font-normal text-slate-500">/ month</span>
          </p>
          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /><span>Up to 3 active projects</span></li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /><span>Standard UI blocks</span></li>
          </ul>
        </div>
        <button type="button" className="mt-6 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
          Choose Starter
        </button>
      </div>
      <div className="flex flex-col justify-between rounded-2xl border-2 border-indigo-600 bg-slate-900 p-6 text-white shadow-md">
        <div>
          <span className="rounded bg-indigo-500/25 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">
            Popular
          </span>
          <h3 className="mt-2 text-sm font-semibold">{proTitle}</h3>
          <p className="mt-1 text-3xl font-bold">
            {proPrice} <span className="text-xs font-normal text-slate-300">/ month</span>
          </p>
          <ul className="mt-4 space-y-2 text-xs text-slate-200">
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-sky-400" /><span>Unlimited pages &amp; components</span></li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-sky-400" /><span>Custom npm library imports</span></li>
          </ul>
        </div>
        <button type="button" className="mt-6 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
`,
    inlineJsx: `<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6">
    <div>
      <span className="text-xs font-semibold text-slate-500">Starter</span>
      <p className="mt-2 text-3xl font-bold text-slate-900">$0 <span className="text-xs font-normal text-slate-500">/ mo</span></p>
      <ul className="mt-4 space-y-2 text-xs text-slate-600">
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /><span>Up to 3 active projects</span></li>
      </ul>
    </div>
    <button type="button" className="mt-6 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-800">Choose Starter</button>
  </div>
  <div className="flex flex-col justify-between rounded-2xl border-2 border-indigo-600 bg-slate-900 p-6 text-white shadow-md">
    <div>
      <span className="rounded bg-indigo-500/25 px-2 py-0.5 text-[10px] font-semibold text-indigo-200">Popular</span>
      <h3 className="mt-2 text-sm font-semibold">Pro Workspace</h3>
      <p className="mt-1 text-3xl font-bold">$29 <span className="text-xs font-normal text-slate-300">/ mo</span></p>
      <ul className="mt-4 space-y-2 text-xs text-slate-200">
        <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-sky-400" /><span>Unlimited pages &amp; components</span></li>
      </ul>
    </div>
    <button type="button" className="mt-6 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white">Upgrade to Pro</button>
  </div>
</div>`,
  },
  {
    id: 'ui-testimonial-card',
    componentName: 'UiTestimonialCard',
    title: 'Customer Review Card',
    category: 'Cards & Stats',
    description: 'Elevated testimonial card with 5-star Lucide rating and author attribution.',
    tags: ['testimonial', 'review', 'quote', 'social-proof'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Star'],
      },
    ],
    defaultProps: {
      quote: 'Replacing legacy blocks with modular React UI saved our product team days of hand-coding.',
      author: 'Ananya Verma',
      role: 'Design Systems Lead',
    },
    componentSource: `'use client';
import React from 'react';
import { Star } from 'lucide-react';

export default function UiTestimonialCard({
  quote = 'Replacing legacy blocks with modular React UI saved our product team days of hand-coding.',
  author = 'Ananya Verma',
  role = 'Design Systems Lead',
}: {
  quote?: string;
  author?: string;
  role?: string;
}) {
  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-1 text-amber-400">
        <Star className="h-4 w-4 fill-current" />
        <Star className="h-4 w-4 fill-current" />
        <Star className="h-4 w-4 fill-current" />
        <Star className="h-4 w-4 fill-current" />
        <Star className="h-4 w-4 fill-current" />
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-slate-700">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
          {author.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-900">{author}</p>
          <p className="text-[11px] text-slate-500">{role}</p>
        </div>
      </figcaption>
    </figure>
  );
}
`,
    inlineJsx: `<figure className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
  <div className="flex items-center gap-1 text-amber-400">
    <Star className="h-4 w-4 fill-current" />
    <Star className="h-4 w-4 fill-current" />
    <Star className="h-4 w-4 fill-current" />
    <Star className="h-4 w-4 fill-current" />
    <Star className="h-4 w-4 fill-current" />
  </div>
  <blockquote className="mt-3 text-sm leading-relaxed text-slate-700">
    &ldquo;Replacing legacy blocks with modular React UI saved our product team days of hand-coding.&rdquo;
  </blockquote>
  <figcaption className="mt-4 flex items-center gap-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">AV</span>
    <div>
      <p className="text-xs font-semibold text-slate-900">Ananya Verma</p>
      <p className="text-[11px] text-slate-500">Design Systems Lead</p>
    </div>
  </figcaption>
</figure>`,
  },
  {
    id: 'ui-tabs-panel',
    componentName: 'UiTabsPanel',
    title: 'Interactive Tabs Switcher',
    category: 'Interactive & Data',
    description: 'Stateful React tabbed panel switching seamlessly between Overview, Metrics, and Activity.',
    tags: ['tabs', 'interactive', 'switcher', 'panel'],
    packages: [],
    defaultProps: {
      heading: 'Workspace Details',
    },
    componentSource: `'use client';
import React, { useState } from 'react';

export default function UiTabsPanel({
  heading = 'Workspace Details',
}: {
  heading?: string;
}) {
  const [tab, setTab] = useState<'overview' | 'metrics' | 'settings'>('overview');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {(['overview', 'metrics', 'settings'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={\`rounded-md px-2.5 py-1 font-medium capitalize transition-colors \${
                tab === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }\`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-4 text-xs leading-relaxed text-slate-600">
        {tab === 'overview' && 'All production services are healthy across 3 regions with automated backups enabled.'}
        {tab === 'metrics' && 'P95 latency: 32ms · Throughput: 4,210 req/min · Error budget remaining: 99.4%.'}
        {tab === 'settings' && 'Environment variables, webhook endpoints, and access policies are synchronized.'}
      </div>
    </div>
  );
}
`,
    inlineJsx: `<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
    <h3 className="text-sm font-semibold text-slate-900">Workspace Details</h3>
    <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
      <button type="button" className="rounded-md bg-white px-2.5 py-1 font-medium text-slate-900 shadow-xs">Overview</button>
      <button type="button" className="rounded-md px-2.5 py-1 font-medium text-slate-600">Metrics</button>
      <button type="button" className="rounded-md px-2.5 py-1 font-medium text-slate-600">Settings</button>
    </div>
  </div>
  <p className="pt-4 text-xs text-slate-600">All production services are healthy across 3 regions with automated backups enabled.</p>
</div>`,
  },
  {
    id: 'ui-faq-accordion',
    componentName: 'UiFaqAccordion',
    title: 'Interactive FAQ Accordion',
    category: 'Interactive & Data',
    description: 'Expandable React accordion list with chevron rotation for FAQs or help sections.',
    tags: ['accordion', 'faq', 'collapse', 'interactive'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['ChevronDown'],
      },
    ],
    defaultProps: {
      heading: 'Frequently Asked Questions',
    },
    componentSource: `'use client';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function UiFaqAccordion({
  heading = 'Frequently Asked Questions',
}: {
  heading?: string;
}) {
  const [openIdx, setOpenIdx] = useState<number>(0);
  const items = [
    {
      q: 'Can I edit these components visually after inserting?',
      a: 'Yes. Every element and prop stays editable directly on the canvas and in the Style Inspector.',
    },
    {
      q: 'Does replacing an element keep my surrounding layout?',
      a: 'Yes. The replacement component swaps cleanly into the exact DOM slot and imports automatically.',
    },
    {
      q: 'Can I combine external npm libraries with custom React blocks?',
      a: 'Yes. Packages like lucide-react, framer-motion, and recharts are imported into package.json automatically.',
    },
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="mb-3 text-sm font-bold text-slate-900">{heading}</h3>
      <div className="divide-y divide-slate-200">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={item.q} className="py-2.5">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-slate-800"
              >
                <span>{item.q}</span>
                <ChevronDown className={\`h-4 w-4 shrink-0 text-slate-400 transition-transform \${isOpen ? 'rotate-180' : ''}\`} />
              </button>
              {isOpen && <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
`,
    inlineJsx: `<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
  <h3 className="mb-3 text-sm font-bold text-slate-900">Frequently Asked Questions</h3>
  <div className="divide-y divide-slate-200">
    <div className="py-2.5">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
        <span>Can I edit these components visually after inserting?</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-xs text-slate-600">Yes. Every element stays editable directly on the canvas and Style Inspector.</p>
    </div>
  </div>
</section>`,
  },
  {
    id: 'ui-data-table',
    componentName: 'UiDataTable',
    title: 'Data Table with Status Pills',
    category: 'Interactive & Data',
    description: 'Clean responsive table with row hover states and semantic status badges.',
    tags: ['table', 'data', 'rows', 'list'],
    packages: [],
    defaultProps: {
      heading: 'Recent Activity',
    },
    componentSource: `'use client';
import React from 'react';

export default function UiDataTable({
  heading = 'Recent Activity',
}: {
  heading?: string;
}) {
  const rows = [
    { name: 'Landing Hero Redesign', owner: 'Kshitiz', status: 'Published', updated: '2m ago' },
    { name: 'Checkout Stepper UI', owner: 'Design Team', status: 'In Review', updated: '1h ago' },
    { name: 'Analytics KPI Grid', owner: 'Frontend', status: 'Published', updated: 'Yesterday' },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Module</th>
              <th className="px-4 py-2.5">Owner</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.name} className="hover:bg-slate-50/70">
                <td className="px-4 py-2.5 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.owner}</td>
                <td className="px-4 py-2.5">
                  <span className={\`rounded px-2 py-0.5 text-[10px] font-semibold \${
                    r.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }\`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-slate-500">{r.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`,
    inlineJsx: `<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
  <div className="border-b border-slate-200 px-4 py-3">
    <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
  </div>
  <table className="w-full text-left text-xs">
    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
      <tr><th className="px-4 py-2.5">Module</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Updated</th></tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      <tr><td className="px-4 py-2.5 font-medium text-slate-900">Landing Hero Redesign</td><td className="px-4 py-2.5"><span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Published</span></td><td className="px-4 py-2.5 text-right text-slate-500">2m ago</td></tr>
      <tr><td className="px-4 py-2.5 font-medium text-slate-900">Analytics KPI Grid</td><td className="px-4 py-2.5"><span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">In Review</span></td><td className="px-4 py-2.5 text-right text-slate-500">1h ago</td></tr>
    </tbody>
  </table>
</div>`,
  },
  {
    id: 'ui-alert-banner',
    componentName: 'UiAlertBanner',
    title: 'Dismissible Alert Banner',
    category: 'Interactive & Data',
    description: 'Informational status banner with icon, action link, and dismiss button.',
    tags: ['alert', 'banner', 'notice', 'toast'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Info', 'X'],
      },
    ],
    defaultProps: {
      title: 'System update scheduled',
      message: 'Zero-downtime deployment window starts tonight at 11:00 PM UTC.',
    },
    componentSource: `'use client';
import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

export default function UiAlertBanner({
  title = 'System update scheduled',
  message = 'Zero-downtime deployment window starts tonight at 11:00 PM UTC.',
}: {
  title?: string;
  message?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div className="text-xs">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sky-800">{message}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss alert"
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-sky-600 hover:bg-sky-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
`,
    inlineJsx: `<div className="flex items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
  <div className="flex items-start gap-2.5">
    <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
    <div className="text-xs">
      <p className="font-semibold">System update scheduled</p>
      <p className="mt-0.5 text-sky-800">Zero-downtime deployment window starts tonight at 11:00 PM UTC.</p>
    </div>
  </div>
</div>`,
  },
  {
    id: 'ui-button-group',
    componentName: 'UiButtonGroup',
    title: 'Action Button Group',
    category: 'Buttons & Inputs',
    description: 'Primary, secondary, and outline icon-paired buttons ready to drop or replace old buttons.',
    tags: ['button', 'cta', 'actions', 'icons'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Sparkles', 'Download', 'Share2'],
      },
    ],
    defaultProps: {
      primaryLabel: 'Publish Changes',
      secondaryLabel: 'Export',
    },
    componentSource: `'use client';
import React from 'react';
import { Sparkles, Download, Share2 } from 'lucide-react';

export default function UiButtonGroup({
  primaryLabel = 'Publish Changes',
  secondaryLabel = 'Export',
}: {
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{primaryLabel}</span>
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{secondaryLabel}</span>
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span>Share</span>
      </button>
    </div>
  );
}
`,
    inlineJsx: `<div className="flex flex-wrap items-center gap-2.5">
  <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs">
    <Sparkles className="h-3.5 w-3.5" />
    <span>Publish Changes</span>
  </button>
  <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700">
    <Download className="h-3.5 w-3.5" />
    <span>Export</span>
  </button>
</div>`,
  },
  {
    id: 'ui-search-bar',
    componentName: 'UiSearchBar',
    title: 'Search & Filter Input Bar',
    category: 'Buttons & Inputs',
    description: 'Interactive search input with filter chips for catalogs, docs, or dashboards.',
    tags: ['search', 'input', 'filter', 'form'],
    packages: [
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Search', 'SlidersHorizontal'],
      },
    ],
    defaultProps: {
      placeholder: 'Search components, pages, or orders...',
    },
    componentSource: `'use client';
import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

export default function UiSearchBar({
  placeholder = 'Search components, pages, or orders...',
}: {
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
        {['All', 'Active', 'Draft'].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setFilter(chip)}
            className={\`rounded-md px-2.5 py-1 text-[11px] font-medium \${
              filter === chip ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }\`}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
`,
    inlineJsx: `<div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="relative flex-1">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    <input type="text" placeholder="Search components, pages, or orders..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800" />
  </div>
  <div className="flex items-center gap-1.5">
    <span className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">All</span>
    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">Active</span>
  </div>
</div>`,
  },
  {
    id: 'ui-motion-card',
    componentName: 'UiMotionCard',
    title: 'Animated Reveal Card (Framer Motion)',
    category: 'Motion & Charts',
    description: 'Smooth entrance-animated card powered by framer-motion and lucide-react.',
    tags: ['framer-motion', 'animation', 'motion', 'card'],
    packages: [
      {
        packageName: 'framer-motion',
        version: '^12.0.0',
        importMode: 'named',
        identifiers: ['motion'],
      },
      {
        packageName: 'lucide-react',
        version: '^0.511.0',
        importMode: 'named',
        identifiers: ['Sparkles'],
      },
    ],
    defaultProps: {
      title: 'Motion Entrance Card',
      subtitle: 'Animated softly on mount using framer-motion primitives.',
    },
    componentSource: `'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function UiMotionCard({
  title = 'Motion Entrance Card',
  subtitle = 'Animated softly on mount using framer-motion primitives.',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/70 p-5 shadow-xs"
    >
      <div className="flex items-center gap-2 text-indigo-600">
        <Sparkles className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Framer Motion</span>
      </div>
      <h3 className="mt-2 text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
    </motion.div>
  );
}
`,
    inlineJsx: `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/70 p-5 shadow-xs">
  <div className="flex items-center gap-2 text-indigo-600">
    <Sparkles className="h-4 w-4" />
    <span className="text-[11px] font-semibold uppercase tracking-wider">Framer Motion</span>
  </div>
  <h3 className="mt-2 text-base font-bold text-slate-900">Motion Entrance Card</h3>
  <p className="mt-1 text-xs text-slate-600">Animated softly on mount using framer-motion primitives.</p>
</motion.div>`,
  },
  {
    id: 'ui-recharts-bar',
    componentName: 'UiBarChartCard',
    title: 'Analytics Bar Chart (Recharts)',
    category: 'Motion & Charts',
    description: 'Responsive weekly bar chart card importing Recharts chart primitives.',
    tags: ['recharts', 'chart', 'analytics', 'bar', 'graph'],
    packages: [
      {
        packageName: 'recharts',
        version: '^2.15.0',
        importMode: 'named',
        identifiers: ['ResponsiveContainer', 'BarChart', 'Bar', 'XAxis', 'Tooltip'],
      },
    ],
    defaultProps: {
      title: 'Weekly Traffic Overview',
      subtitle: 'Active sessions across the last 5 days',
    },
    componentSource: `'use client';
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

const SAMPLE_DATA = [
  { day: 'Mon', visits: 420 },
  { day: 'Tue', visits: 680 },
  { day: 'Wed', visits: 540 },
  { day: 'Thu', visits: 890 },
  { day: 'Fri', visits: 760 },
];

export default function UiBarChartCard({
  title = 'Weekly Traffic Overview',
  subtitle = 'Active sessions across the last 5 days',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={SAMPLE_DATA}>
            <XAxis dataKey="day" fontSize={11} stroke="#64748b" />
            <Tooltip />
            <Bar dataKey="visits" fill="#4f46e5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
`,
    inlineJsx: `<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
  <h3 className="text-sm font-semibold text-slate-900">Weekly Traffic Overview</h3>
  <p className="mt-0.5 text-xs text-slate-500">Active sessions across the last 5 days</p>
  <div className="mt-4 h-44 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={[{ day: 'Mon', visits: 420 }, { day: 'Tue', visits: 680 }, { day: 'Wed', visits: 540 }, { day: 'Thu', visits: 890 }]}>
        <XAxis dataKey="day" fontSize={11} stroke="#64748b" />
        <Tooltip />
        <Bar dataKey="visits" fill="#4f46e5" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>`,
  },
  ...EXTRA_REACT_UI_LIBRARY_ITEMS,
];

export function filterReactUiCatalog(
  items: ReactUiLibraryEntry[],
  query: string,
  category: ReactUiCategory
): ReactUiLibraryEntry[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== 'All' && item.category !== category) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.componentName.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)) ||
      item.packages.some((p) => p.packageName.toLowerCase().includes(q))
    );
  });
}

export function resolveUiComponentFilePath(
  files: Record<string, string>,
  targetFilePath: string,
  componentName: string
): string {
  const usesSrc =
    targetFilePath.startsWith('src/') ||
    Object.keys(files).some((p) => p.startsWith('src/components/'));
  const baseDir = usesSrc ? 'src/components/ui' : 'components/ui';
  return `${baseDir}/${componentName}.tsx`;
}

export function replaceElementWithSnippetInSource(params: {
  targetCode: string;
  elementIndex: number;
  jsxSnippet: string;
}): string | null {
  const { targetCode, elementIndex, jsxSnippet } = params;
  const elements = scanElements(targetCode, false);
  const el = elements[elementIndex];
  if (!el || el.closeEnd <= el.openStart) return null;
  return (
    targetCode.slice(0, el.openStart) + jsxSnippet + targetCode.slice(el.closeEnd)
  );
}

export interface ApplyUiLibraryParams {
  files: Record<string, string>;
  targetFilePath: string;
  targetElementIndex: number;
  entry: ReactUiLibraryEntry;
  action: 'replace' | 'insert';
  position?: ComponentInsertPosition;
  integrationMode: 'component' | 'inline';
  customProps?: Record<string, string>;
}

export interface ApplyUiLibraryResult {
  ok: boolean;
  error?: string;
  files: Record<string, string>;
  touchedFilePath: string;
  createdComponentPath?: string;
  installedPackages: string[];
}

export function applyUiLibraryToProject(
  params: ApplyUiLibraryParams
): ApplyUiLibraryResult {
  const {
    files,
    targetFilePath,
    targetElementIndex,
    entry,
    action,
    position = 'after',
    integrationMode,
    customProps,
  } = params;

  const targetCode = files[targetFilePath];
  if (!targetCode) {
    return {
      ok: false,
      error: `Target file "${targetFilePath}" not found.`,
      files,
      touchedFilePath: targetFilePath,
      installedPackages: [],
    };
  }
  if (/\.html?$/i.test(targetFilePath)) {
    return {
      ok: false,
      error: 'React UI library components require a .tsx or .jsx page/component file.',
      files,
      touchedFilePath: targetFilePath,
      installedPackages: [],
    };
  }

  let nextFiles = { ...files };
  const installedPackages: string[] = [];

  for (const pkg of entry.packages) {
    nextFiles = addPackageDependencyToFiles(nextFiles, pkg.packageName, pkg.version);
    installedPackages.push(pkg.packageName);
  }

  if (integrationMode === 'component') {
    const compFilePath = resolveUiComponentFilePath(
      nextFiles,
      targetFilePath,
      entry.componentName
    );
    if (compFilePath === targetFilePath) {
      return {
        ok: false,
        error: 'Cannot insert a component directly into its own definition file.',
        files,
        touchedFilePath: targetFilePath,
        installedPackages: [],
      };
    }

    if (!nextFiles[compFilePath]) {
      nextFiles[compFilePath] = entry.componentSource;
    }

    const effectiveProps: Record<string, string> = {};
    for (const [k, v] of Object.entries(customProps || {})) {
      if (v !== undefined && v !== '' && v !== entry.defaultProps[k]) {
        effectiveProps[k] = v;
      }
    }
    const jsxTag = formatComponentJsxTag(entry.componentName, effectiveProps);

    let updatedTarget =
      action === 'replace'
        ? replaceElementWithSnippetInSource({
            targetCode,
            elementIndex: targetElementIndex,
            jsxSnippet: jsxTag,
          })
        : insertJsxSnippetIntoSource({
            targetCode,
            targetElementIndex,
            position,
            jsxSnippet: jsxTag,
          });

    if (!updatedTarget) {
      return {
        ok: false,
        error:
          action === 'replace'
            ? 'Could not replace the selected element in this file.'
            : 'Could not insert at the chosen element location.',
        files,
        touchedFilePath: targetFilePath,
        installedPackages: [],
      };
    }

    updatedTarget = ensureComponentImportInSource({
      code: updatedTarget,
      componentName: entry.componentName,
      componentFilePath: compFilePath,
      componentCode: nextFiles[compFilePath],
    });

    nextFiles[targetFilePath] = updatedTarget;

    return {
      ok: true,
      files: nextFiles,
      touchedFilePath: targetFilePath,
      createdComponentPath: compFilePath,
      installedPackages,
    };
  }

  // Inline JSX mode: inject required package imports + insert/replace inline JSX
  let updatedInlineTarget =
    action === 'replace'
      ? replaceElementWithSnippetInSource({
          targetCode,
          elementIndex: targetElementIndex,
          jsxSnippet: entry.inlineJsx,
        })
      : insertJsxSnippetIntoSource({
          targetCode,
          targetElementIndex,
          position,
          jsxSnippet: entry.inlineJsx,
        });

  if (!updatedInlineTarget) {
    return {
      ok: false,
      error:
        action === 'replace'
          ? 'Could not replace the selected element in this file.'
          : 'Could not insert at the chosen element location.',
      files,
      touchedFilePath: targetFilePath,
      installedPackages: [],
    };
  }

  for (const pkg of entry.packages) {
    updatedInlineTarget = injectLibraryImportIntoSource(updatedInlineTarget, {
      packageName: pkg.packageName,
      importMode: pkg.importMode,
      identifiers: pkg.identifiers,
    });
  }

  nextFiles[targetFilePath] = updatedInlineTarget;

  return {
    ok: true,
    files: nextFiles,
    touchedFilePath: targetFilePath,
    installedPackages,
  };
}
