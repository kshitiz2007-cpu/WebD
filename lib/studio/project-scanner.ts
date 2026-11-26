import { ProjectFramework, ProjectPage } from './types';

const IGNORED_PATH_PATTERNS = [
  /^node_modules\//,
  /^\.next\//,
  /^\.git\//,
  /^dist\//,
  /^build\//,
  /^coverage\//,
];

export function shouldIncludeProjectPath(path: string): boolean {
  const normalized = path.replace(/^\/+/, '');
  return !IGNORED_PATH_PATTERNS.some((rx) => rx.test(normalized));
}

export function normalizeProjectFiles(rawFiles: Record<string, string>): Record<string, string> {
  const paths = Object.keys(rawFiles).filter(shouldIncludeProjectPath);
  if (paths.length === 0) return {};

  // Strip common single top-level directory (common in GitHub / macOS zip archives)
  const firstSegments = new Set(paths.map((p) => p.split('/')[0]));
  let stripPrefix = '';
  if (firstSegments.size === 1) {
    const candidate = Array.from(firstSegments)[0];
    const hasNested = paths.every((p) => p.includes('/'));
    const commonRootFiles = ['app', 'src', 'pages', 'components', 'lib', 'public', 'styles'];
    if (hasNested && !commonRootFiles.includes(candidate)) {
      stripPrefix = `${candidate}/`;
    }
  }

  const normalized: Record<string, string> = {};
  for (const p of paths) {
    const cleanPath = stripPrefix && p.startsWith(stripPrefix) ? p.slice(stripPrefix.length) : p;
    if (cleanPath && shouldIncludeProjectPath(cleanPath)) {
      normalized[cleanPath.replace(/^\/+/, '')] = rawFiles[p];
    }
  }
  return normalized;
}

export function scanProjectStructure(files: Record<string, string>): {
  framework: ProjectFramework;
  pages: ProjectPage[];
  globalCssPaths: string[];
  projectName: string;
} {
  const filePaths = Object.keys(files).sort();

  // Detect project name from package.json or HTML title
  let projectName = 'Uploaded Project';
  const pkgContent = files['package.json'];
  if (pkgContent) {
    try {
      const parsed = JSON.parse(pkgContent);
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        projectName = parsed.name.trim();
      }
    } catch {
      // Ignore malformed package.json
    }
  }

  // Find global CSS files
  const globalCssPaths = filePaths.filter((p) => /\.(css)$/i.test(p));

  // 1. Check Next.js App Router (`app/**/page.{tsx,jsx,ts,js}` or `src/app/**/page.{tsx,jsx,ts,js}`)
  const nextAppPages = filePaths.filter((p) =>
    /^(src\/)?app\/(.*\/)?page\.(tsx|jsx|ts|js)$/.test(p)
  );
  if (nextAppPages.length > 0) {
    const pages: ProjectPage[] = nextAppPages.map((filePath) => {
      const stripped = filePath
        .replace(/^(src\/)?app/, '')
        .replace(/\/page\.(tsx|jsx|ts|js)$/, '');
      const route = stripped === '' ? '/' : stripped;
      const title = formatRouteTitle(route);
      return { route, title, filePath };
    });
    pages.sort((a, b) => (a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route)));
    return { framework: 'nextjs-app', pages, globalCssPaths, projectName };
  }

  // 2. Check Next.js Pages Router (`pages/**/*.{tsx,jsx}` or `src/pages/**/*.{tsx,jsx}`)
  const nextPages = filePaths.filter(
    (p) =>
      /^(src\/)?pages\/.+\.(tsx|jsx)$/.test(p) &&
      !/_app\.|_document\.|\/api\//.test(p)
  );
  if (nextPages.length > 0) {
    const pages: ProjectPage[] = nextPages.map((filePath) => {
      let route = filePath
        .replace(/^(src\/)?pages/, '')
        .replace(/\.(tsx|jsx)$/, '')
        .replace(/\/index$/, '');
      if (route === '') route = '/';
      return { route, title: formatRouteTitle(route), filePath };
    });
    pages.sort((a, b) => (a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route)));
    return { framework: 'nextjs-pages', pages, globalCssPaths, projectName };
  }

  // 3. Check Vite / React SPA (`src/App.tsx` or `src/pages/*.tsx`)
  const reactPageFiles = filePaths.filter(
    (p) =>
      /^src\/(pages|views|routes)\/.+\.(tsx|jsx)$/.test(p) ||
      /^src\/App\.(tsx|jsx)$/.test(p)
  );
  if (reactPageFiles.length > 0) {
    const pages: ProjectPage[] = reactPageFiles.map((filePath) => {
      if (/^src\/App\.(tsx|jsx)$/.test(filePath)) {
        return { route: '/', title: 'Home (App)', filePath };
      }
      const base = filePath
        .replace(/^src\/(pages|views|routes)/, '')
        .replace(/\.(tsx|jsx)$/, '')
        .toLowerCase();
      const route = base === '/index' || base === '/home' ? '/' : base;
      return { route, title: formatRouteTitle(route), filePath };
    });
    pages.sort((a, b) => (a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route)));
    return { framework: 'react-vite', pages, globalCssPaths, projectName };
  }

  // 4. Static HTML pages
  const htmlFiles = filePaths.filter((p) => /\.html?$/i.test(p));
  if (htmlFiles.length > 0) {
    const pages: ProjectPage[] = htmlFiles.map((filePath) => {
      const route =
        filePath === 'index.html' || filePath === 'public/index.html'
          ? '/'
          : '/' + filePath.replace(/\.html?$/i, '');
      return {
        route,
        title: filePath === 'index.html' ? 'Home' : formatRouteTitle(route),
        filePath,
      };
    });
    pages.sort((a, b) => (a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route)));
    return { framework: 'html', pages, globalCssPaths, projectName };
  }

  // Fallback: any tsx/jsx component file
  const anyTsx = filePaths.filter((p) => /\.(tsx|jsx)$/.test(p));
  const pages = anyTsx.slice(0, 12).map((filePath, idx) => ({
    route: idx === 0 ? '/' : `/${filePath.replace(/\.(tsx|jsx)$/, '')}`,
    title: filePath.split('/').pop() || filePath,
    filePath,
  }));

  return {
    framework: 'react-vite',
    pages,
    globalCssPaths,
    projectName,
  };
}

function formatRouteTitle(route: string): string {
  if (route === '/') return 'Home';
  const clean = route.replace(/^\/+/, '');
  return clean
    .split('/')
    .map((seg) =>
      seg
        .replace(/^\[(.*)\]$/, '$1')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(' / ');
}
