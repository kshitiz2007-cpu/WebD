import type { ProjectFramework, ProjectPage } from './types';

export interface SiteKitResult {
  files: Record<string, string>;
  componentPaths: string[];
  updatedPages: string[];
  updatedStyles: string[];
}

function relativeImport(fromFile: string, targetFileWithoutExtension: string): string {
  const fromParts = fromFile.split('/').slice(0, -1).filter(Boolean);
  const targetParts = targetFileWithoutExtension.split('/').filter(Boolean);
  while (fromParts.length && targetParts.length && fromParts[0] === targetParts[0]) {
    fromParts.shift();
    targetParts.shift();
  }
  let path = [...fromParts.map(() => '..'), ...targetParts].join('/');
  if (!path.startsWith('.')) path = './' + path;
  return path;
}

function sharedLayoutSource(): string {
  return `'use client';
// WEBD_SHARED_SITE_LAYOUT
import React from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

export default function SiteLayout({
  children,
  showHeader = true,
  showFooter = true,
}: {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900" style={{ "--site-primary": "#4f46e5", "--site-primary-hover": "#4338ca", "--site-radius": "16px" } as React.CSSProperties}>
      {showHeader && <SiteHeader />}
      <div className="min-h-0 flex-1">{children}</div>
      {showFooter && <SiteFooter />}
    </div>
  );
}
`;
}

function sharedHeaderSource(pages: ProjectPage[]): string {
  return `'use client';
import React from 'react';

const links = ${JSON.stringify(pages.map((page) => ({ label: page.title, href: page.route })))};


export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
        <a href="/" className="text-lg font-bold tracking-tight text-slate-950">Your Brand</a>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
          {links.map((link) => <a key={link.href} href={link.href} className="transition-colors hover:text-indigo-600">{link.label}</a>)}
        </nav>
      </div>
    </header>
  );
}
`;
}

function sharedFooterSource(): string {
  return `'use client';
import React from 'react';

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-950 px-6 py-9 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <a href="/" className="text-sm font-bold tracking-tight">Your Brand</a>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Your Brand. All rights reserved.</p>
        <div className="flex gap-4 text-xs text-slate-400"><a href="/privacy" className="hover:text-white">Privacy</a><a href="/contact" className="hover:text-white">Contact</a></div>
      </div>
    </footer>
  );
}
`;
}

export function addLayoutToReactPage(
  code: string,
  pagePath: string,
  layoutPath: string
): string | null {
  if (/import\s+SiteLayout\s+from\s+['"]/.test(code) || code.includes('<SiteLayout')) return code;

  let next = code;
  let useSharedHeader = false;
  let useSharedFooter = false;

  if (/import\s+Navbar\s+from\s+['"][^'"]+['"];?/.test(next) && /<Navbar\b/.test(next)) {
    next = next.replace(/import\s+Navbar\s+from\s+['"][^'"]+['"];?\s*\n?/, '');
    next = next.replace(/<Navbar\b[^>]*\/>/g, '<SiteHeader />');
    useSharedHeader = true;
  }

  if (/<footer\b[\s\S]*?<\/footer>/.test(next)) {
    next = next.replace(/<footer\b[\s\S]*?<\/footer>/, '<SiteFooter />');
    useSharedFooter = true;
  }

  const returnPattern = /return\s*\(\s*([\s\S]*?)\n\s*\);/g;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;
  while ((match = returnPattern.exec(next)) !== null) lastMatch = match;
  if (!lastMatch) return null;

  const layoutImport = relativeImport(pagePath, layoutPath.replace(/\.tsx$/, ''));
  const componentRoot = layoutPath.replace(/\/SiteLayout\.tsx$/, '');
  const headerImport = relativeImport(pagePath, `${componentRoot}/SiteHeader`);
  const footerImport = relativeImport(pagePath, `${componentRoot}/SiteFooter`);
  const hasExistingHeader = useSharedHeader || /<header\b/.test(next);
  const hasExistingFooter = useSharedFooter || /<footer\b/.test(next);
  const imports = [
    `import SiteLayout from '${layoutImport}';`,
    ...(useSharedHeader ? [`import SiteHeader from '${headerImport}';`] : []),
    ...(useSharedFooter ? [`import SiteFooter from '${footerImport}';`] : []),
  ].join('\n');
  const wrappedReturn = `return (
    <SiteLayout showHeader={${!hasExistingHeader}} showFooter={${!hasExistingFooter}}>
${lastMatch[1]}
    </SiteLayout>
  );`;
  next = next.slice(0, lastMatch.index) + wrappedReturn + next.slice(lastMatch.index + lastMatch[0].length);

  const reactImport = /import\s+React[^;]*;?/;
  const reactMatch = reactImport.exec(next);
  if (reactMatch) {
    const insertAt = reactMatch.index + reactMatch[0].length;
    next = next.slice(0, insertAt) + '\n' + imports + next.slice(insertAt);
  } else {
    next = imports + '\n' + next;
  }
  return next;
}

export function addLayoutToHtmlPage(code: string): string {
  if (code.includes('data-webd-site-header')) return code;
  const header = '<header data-webd-site-header style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px max(5vw,24px);background:#fff;border-bottom:1px solid #e2e8f0"><a href="/" style="font-weight:800;color:#0f172a;text-decoration:none">Your Brand</a><nav style="display:flex;gap:18px;flex-wrap:wrap"><a href="/" style="color:#475569">Home</a><a href="/about" style="color:#475569">About</a><a href="/services" style="color:#475569">Services</a><a href="/contact" style="color:#475569">Contact</a></nav></header>';
  const footer = '<footer data-webd-site-footer style="margin-top:48px;padding:28px 24px;text-align:center;background:#0f172a;color:#cbd5e1;font-size:12px">© ' + new Date().getFullYear() + ' Your Brand. All rights reserved.</footer>';
  let next = code;
  const lower = next.toLowerCase();
  const headerStart = lower.indexOf('<header');
  if (headerStart >= 0) {
    const headerEnd = lower.indexOf('</header>', headerStart);
    if (headerEnd >= 0) next = next.slice(0, headerStart) + header + next.slice(headerEnd + 9);
  } else {
    const bodyStart = lower.indexOf('<body');
    const bodyEnd = bodyStart >= 0 ? next.indexOf('>', bodyStart) : -1;
    if (bodyEnd >= 0) next = next.slice(0, bodyEnd + 1) + '\n' + header + next.slice(bodyEnd + 1);
  }
  const footerStart = next.toLowerCase().indexOf('<footer');
  if (footerStart >= 0) {
    const footerEnd = next.toLowerCase().indexOf('</footer>', footerStart);
    if (footerEnd >= 0) next = next.slice(0, footerStart) + footer + next.slice(footerEnd + 9);
  } else {
    const bodyClose = next.toLowerCase().lastIndexOf('</body>');
    if (bodyClose >= 0) next = next.slice(0, bodyClose) + footer + '\n' + next.slice(bodyClose);
  }
  return next;
}

export function createSharedSiteKit(params: {
  framework: ProjectFramework;
  files: Record<string, string>;
  pages: ProjectPage[];
}): SiteKitResult {
  const files = { ...params.files };
  const componentRoot = params.framework === 'react-vite' ? 'src/components' : 'components';
  const layoutPath = `${componentRoot}/SiteLayout.tsx`;
  const headerPath = `${componentRoot}/SiteHeader.tsx`;
  const footerPath = `${componentRoot}/SiteFooter.tsx`;

  if (files[layoutPath] && !files[layoutPath].includes('WEBD_SHARED_SITE_LAYOUT')) {
    throw new Error('A custom SiteLayout already exists. Rename it before generating the shared site kit.');
  }
  if (files[headerPath] && !files[headerPath].includes('WEBD_SHARED_SITE_HEADER')) {
    throw new Error('A custom SiteHeader already exists. Rename it before generating the shared site kit.');
  }
  if (files[footerPath] && !files[footerPath].includes('WEBD_SHARED_SITE_FOOTER')) {
    throw new Error('A custom SiteFooter already exists. Rename it before generating the shared site kit.');
  }

  files[layoutPath] = sharedLayoutSource();
  files[headerPath] = sharedHeaderSource(params.pages).replace("'use client';", "'use client';\n// WEBD_SHARED_SITE_HEADER");
  files[footerPath] = sharedFooterSource().replace("'use client';", "'use client';\n// WEBD_SHARED_SITE_FOOTER");

  const updatedPages: string[] = [];
  for (const pagePath of params.pages.map((page) => page.filePath)) {
    const code = files[pagePath];
    if (!code) continue;
    if (/\.(tsx|jsx)$/i.test(pagePath)) {
      const updated = addLayoutToReactPage(code, pagePath, layoutPath);
      if (updated && updated !== code) {
        files[pagePath] = updated;
        updatedPages.push(pagePath);
      }
    } else if (/\.html?$/i.test(pagePath)) {
      const updated = addLayoutToHtmlPage(code);
      if (updated !== code) {
        files[pagePath] = updated;
        updatedPages.push(pagePath);
      }
    }
  }

  const cssPaths = Object.keys(files).filter((path) => /\.css$/i.test(path)).sort();
  const themeCss = `\n\n/* WebD shared site design tokens */\n:root {\n  --site-primary: #4f46e5;\n  --site-primary-hover: #4338ca;\n  --site-text: #0f172a;\n  --site-muted: #64748b;\n  --site-surface: #ffffff;\n  --site-radius: 16px;\n}\n`;
  const updatedStyles: string[] = [];
  if (cssPaths.length > 0) {
    const target = cssPaths[0];
    if (!files[target].includes('--site-primary')) {
      files[target] += themeCss;
      updatedStyles.push(target);
    }
  }

  return {
    files,
    componentPaths: [layoutPath, headerPath, footerPath],
    updatedPages,
    updatedStyles,
  };
}
