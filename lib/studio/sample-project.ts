import { VirtualProject } from './types';
import { scanProjectStructure } from './project-scanner';

export const BLANK_NEXTJS_FILES: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'blank-nextjs-app',
      version: '0.1.0',
      private: true,
      dependencies: {
        next: '^15.4.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        'lucide-react': '^0.500.0',
      },
    },
    null,
    2
  ),
  'app/globals.css': `@import "tailwindcss";

:root {
  color-scheme: light;
}

html, body {
  min-height: 100%;
}

body {
  margin: 0;
  background: #ffffff;
  color: #111827;
}
`,
  'app/layout.tsx': `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blank Project',
  description: 'A clean project canvas',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  'app/page.tsx': `export default function HomePage() {
  return (
    <main className="min-h-screen">
    </main>
  );
}
`,
};

export const STARTER_NEXTJS_FILES: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'verve-structural-site',
      version: '0.1.0',
      private: true,
      dependencies: {
        next: '^15.4.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        'lucide-react': '^0.500.0',
      },
    },
    null,
    2
  ),
  'app/globals.css': `@import "tailwindcss";

body {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  background-color: #f8fafc;
  color: #0f172a;
}
`,
  'components/Navbar.tsx': `'use client';
import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function Navbar({ active = '/' }: { active?: string }) {
  return (
    <header className="w-full border-b border-slate-200 bg-white/95 px-8 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900">
          <Compass className="h-5 w-5 text-blue-600" />
          <span>Verve Systems</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/" className={active === '/' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'}>
            Overview
          </Link>
          <Link href="/projects" className={active === '/projects' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'}>
            Case Studies
          </Link>
          <Link href="/pricing" className={active === '/pricing' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'}>
            Plans
          </Link>
        </nav>
        <Link
          href="/pricing"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Start Trial
        </Link>
      </div>
    </header>
  );
}
`,
  'app/page.tsx': `'use client';
import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ArrowRight, Layers, ShieldCheck, Gauge } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar active="/" />

      <section
        className="mx-auto mt-8 max-w-6xl rounded-2xl px-10 py-16 text-white shadow-sm"
        style={{
          backgroundImage: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 52%, #0284C7 100%)',
        }}
      >
        <div className="max-w-2xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">
            Structural Engineering Platform
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Precision Load Analysis &amp; Site Telemetry for Modern Civil Teams
          </h1>
          <p className="text-base leading-relaxed text-slate-200">
            Tap any section, card, heading, or button on this page to restyle gradients, adjust spacing, resize dimensions, or drag cards to reorder them directly in code.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm"
            >
              <span>Explore Case Studies</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white"
            >
              View Plans
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Core Engineering Modules
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Drag any card below to reorder its position in the source layout.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">3 Active Suites</span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">01. Foundation Mesh</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Finite-element soil settlement modeling with automated Eurocode and IS-456 load combinations.
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Gauge className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">02. Strain Telemetry</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Real-time bridge pier deflection streams and automated threshold alerts across remote spans.
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">03. Seismic Audit</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Modal response spectrum verification with exportable stamped structural compliance packets.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-8 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-slate-500">
          <span>Verve Systems Engineering</span>
          <span>Built for visual design &amp; live code sync</span>
        </div>
      </footer>
    </div>
  );
}
`,
  'app/projects/page.tsx': `'use client';
import React from 'react';
import Navbar from '@/components/Navbar';

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar active="/projects" />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Delivered Infrastructure Case Studies
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Switch between pages freely using the Pages panel or header links, and restyle any element independently.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div
            className="rounded-2xl p-8 text-white"
            style={{
              backgroundImage: 'linear-gradient(125deg, #0F172A 0%, #1D4ED8 38%, #0EA5E9 72%, #7DD3FC 100%)',
            }}
          >
            <p className="text-xs font-medium text-sky-200">Cable-Stayed Span · 420m</p>
            <h2 className="mt-2 text-2xl font-bold">North Harbor Viaduct</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-100">
              Continuous fiber-optic strain monitoring reduced quarterly inspection downtime by 44% across six main pylons.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <p className="text-xs font-medium text-slate-500">Precast Tunnel Lining · 6.4km</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Metro Corridor Line 4</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Automated grout pressure balancing and segment ring convergence tracking across 1,800 precast concrete rings.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
`,
  'app/pricing/page.tsx': `'use client';
import React from 'react';
import Navbar from '@/components/Navbar';
import { Check } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar active="/pricing" />
      <main className="mx-auto max-w-5xl px-6 py-14">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Transparent Studio &amp; Field Licensing
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Select any pricing card or button to customize its multi-stop gradient, radius, and copy.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <h2 className="text-lg font-semibold text-slate-900">Practice Team</h2>
            <p className="mt-1 text-xs text-slate-500">For regional structural consultancies</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900">$149</span>
              <span className="text-sm text-slate-500">/ month</span>
            </div>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" /> Up to 12 active project models</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" /> Eurocode &amp; ACI report exports</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" /> Live sensor CSV ingestion</li>
            </ul>
            <button className="mt-8 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">
              Choose Practice
            </button>
          </div>

          <div
            className="rounded-2xl p-8 text-white shadow-sm"
            style={{
              backgroundImage: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #2563EB 100%)',
            }}
          >
            <h2 className="text-lg font-semibold">Enterprise Infrastructure</h2>
            <p className="mt-1 text-xs text-sky-200">For multi-site civil contractors</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$490</span>
              <span className="text-sm text-sky-200">/ month</span>
            </div>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-100">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-sky-300" /> Unlimited concurrent sites</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-sky-300" /> Dedicated SCADA telemetry bridge</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-sky-300" /> Custom compliance templates</li>
            </ul>
            <button className="mt-8 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">
              Start Enterprise
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
`,
};

export const STARTER_HTML_FILES: Record<string, string> = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Monolith Studio — Landing</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <a class="brand" href="index.html">Monolith</a>
    <nav class="nav">
      <a href="index.html">Home</a>
      <a href="about.html">Studio</a>
    </nav>
    <a class="cta" href="about.html">Book Consult</a>
  </header>
  <main class="container">
    <section class="hero" style="background-image: linear-gradient(135deg, #0F172A 0%, #1D4ED8 50%, #0EA5E9 100%)">
      <h1>Architectural Interfaces Crafted Visually</h1>
      <p>Click any block, edit text, resize handles, or configure 3-stop and 4-stop gradients with instant HTML &amp; CSS output.</p>
      <a class="hero-btn" href="about.html">Explore Work</a>
    </section>
    <section class="cards">
      <div class="card">
        <h3>01. Spatial Grids</h3>
        <p>Drag cards left or right to reorder sections inside the source markup.</p>
      </div>
      <div class="card">
        <h3>02. Multi-Stop Gradients</h3>
        <p>Fine-tune 2, 3, or 4 exact hex color stops with live angle control.</p>
      </div>
      <div class="card">
        <h3>03. Instant Export</h3>
        <p>Download a clean ZIP package containing every modified file.</p>
      </div>
    </section>
  </main>
</body>
</html>`,
  'about.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Monolith Studio — About</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <a class="brand" href="index.html">Monolith</a>
    <nav class="nav">
      <a href="index.html">Home</a>
      <a href="about.html">Studio</a>
    </nav>
    <a class="cta" href="index.html">Back Home</a>
  </header>
  <main class="container">
    <section class="hero" style="background-image: linear-gradient(135deg, #1E293B 0%, #334155 50%, #0F172A 100%)">
      <h1>About Monolith Practice</h1>
      <p>Every HTML page in your uploaded ZIP runs live and responds to direct manipulation.</p>
    </section>
  </main>
</body>
</html>`,
  'styles.css': `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 18px 36px; background: #ffffff; border-bottom: 1px solid #e2e8f0; }
.brand { font-weight: 700; font-size: 18px; color: #0f172a; text-decoration: none; }
.nav { display: flex; gap: 24px; }
.nav a { color: #475569; text-decoration: none; font-size: 14px; font-weight: 500; }
.cta { background: #0f172a; color: #ffffff; padding: 9px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; }
.container { max-width: 1100px; margin: 32px auto; padding: 0 24px; }
.hero { padding: 56px 44px; border-radius: 16px; color: #ffffff; }
.hero h1 { font-size: 36px; line-height: 1.15; max-width: 640px; }
.hero p { margin-top: 14px; max-width: 560px; line-height: 1.6; color: #e2e8f0; }
.hero-btn { display: inline-block; margin-top: 22px; background: #ffffff; color: #0f172a; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
.card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
.card h3 { font-size: 17px; margin-bottom: 8px; }
.card p { font-size: 14px; color: #475569; line-height: 1.55; }
`,
};

export function createProjectFromFiles(
  files: Record<string, string>,
  sourceLabel: string,
  overrideName?: string
): VirtualProject {
  const scanned = scanProjectStructure(files);
  return {
    id: `proj_${Date.now()}`,
    name: overrideName || scanned.projectName,
    framework: scanned.framework,
    files: { ...files },
    originalFiles: { ...files },
    pages: scanned.pages,
    globalCssPaths: scanned.globalCssPaths,
    sourceLabel,
  };
}
