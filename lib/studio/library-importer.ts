export interface ReactLibraryCatalogEntry {
  packageName: string;
  version: string;
  description: string;
  defaultImportMode: 'named' | 'default' | 'namespace';
  suggestedIdentifiers: string[];
  sampleJsx?: string;
}

export const COMMON_REACT_LIBRARIES: ReactLibraryCatalogEntry[] = [
  {
    packageName: 'lucide-react',
    version: '^0.511.0',
    description: 'Crisp SVG icon components for React interfaces',
    defaultImportMode: 'named',
    suggestedIdentifiers: ['Sparkles', 'ArrowRight', 'CheckCircle2'],
    sampleJsx: '<Sparkles className="h-5 w-5 text-indigo-600" />',
  },
  {
    packageName: 'framer-motion',
    version: '^12.0.0',
    description: 'Declarative animations and gesture transitions',
    defaultImportMode: 'named',
    suggestedIdentifiers: ['motion', 'AnimatePresence'],
    sampleJsx:
      '<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">Animated Block</motion.div>',
  },
  {
    packageName: 'sonner',
    version: '^2.0.0',
    description: 'Toast notifications for React applications',
    defaultImportMode: 'named',
    suggestedIdentifiers: ['toast', 'Toaster'],
    sampleJsx:
      '<button type="button" onClick={() => toast.success("Action completed")} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Trigger Toast</button>',
  },
  {
    packageName: 'canvas-confetti',
    version: '^1.9.3',
    description: 'Celebratory particle confetti effects in the browser',
    defaultImportMode: 'default',
    suggestedIdentifiers: ['confetti'],
    sampleJsx:
      '<button type="button" onClick={() => confetti()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Celebrate</button>',
  },
  {
    packageName: 'clsx',
    version: '^2.1.1',
    description: 'Tiny utility for constructing conditional className strings',
    defaultImportMode: 'default',
    suggestedIdentifiers: ['clsx'],
  },
  {
    packageName: 'tailwind-merge',
    version: '^3.0.0',
    description: 'Merge Tailwind CSS utility classes without style conflicts',
    defaultImportMode: 'named',
    suggestedIdentifiers: ['twMerge'],
  },
  {
    packageName: 'class-variance-authority',
    version: '^0.7.1',
    description: 'Type-safe component variants helper for Tailwind UI',
    defaultImportMode: 'named',
    suggestedIdentifiers: ['cva'],
  },
  {
    packageName: 'date-fns',
    version: '^4.1.0',
    description: 'Modular JavaScript date formatting and manipulation library',
    defaultImportMode: 'named',
    suggestedIdentifiers: ['format'],
  },
  {
    packageName: 'recharts',
    version: '^2.15.0',
    description: 'Composable charting library built on React components',
    defaultImportMode: 'named',
    suggestedIdentifiers: ['ResponsiveContainer', 'BarChart', 'Bar', 'XAxis', 'Tooltip'],
  },
];

export interface ExternalImportEntry {
  packageName: string;
  specifiersText: string;
}

export function isValidPackageName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 140) return false;
  return /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(?:\/[a-z0-9-._~]+)*$/i.test(
    trimmed
  );
}

export function buildEsmShUrl(packageName: string): string {
  const clean = packageName.trim();
  return `https://esm.sh/${clean}?external=react,react-dom`;
}

export function parsePackageDependencies(
  files: Record<string, string>
): Record<string, string> {
  const pkgPath = files['package.json']
    ? 'package.json'
    : Object.keys(files).find((p) => p.endsWith('/package.json'));
  if (!pkgPath) return {};
  try {
    const parsed = JSON.parse(files[pkgPath]);
    if (parsed && typeof parsed.dependencies === 'object' && parsed.dependencies !== null) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.dependencies)) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    }
  } catch {
    // Ignore malformed package.json
  }
  return {};
}

export function addPackageDependencyToFiles(
  files: Record<string, string>,
  packageName: string,
  version = 'latest'
): Record<string, string> {
  const pkgName = packageName.trim();
  if (!isValidPackageName(pkgName)) return files;

  const pkgPath = files['package.json']
    ? 'package.json'
    : Object.keys(files).find((p) => p.endsWith('/package.json')) || 'package.json';

  let parsed: Record<string, unknown> = {
    name: 'studio-app',
    version: '0.1.0',
    private: true,
    dependencies: {},
  };

  if (files[pkgPath]) {
    try {
      const existing = JSON.parse(files[pkgPath]);
      if (existing && typeof existing === 'object') {
        parsed = existing as Record<string, unknown>;
      }
    } catch {
      // Fall back to clean package.json template if existing was invalid
    }
  }

  const prevDeps =
    parsed.dependencies && typeof parsed.dependencies === 'object'
      ? (parsed.dependencies as Record<string, string>)
      : {};
  const nextDeps = { ...prevDeps, [pkgName]: prevDeps[pkgName] || version };
  const sortedDeps = Object.fromEntries(
    Object.entries(nextDeps).sort(([a], [b]) => a.localeCompare(b))
  );

  const nextJson = JSON.stringify({ ...parsed, dependencies: sortedDeps }, null, 2) + '\n';
  return { ...files, [pkgPath]: nextJson };
}

export function removePackageDependencyFromFiles(
  files: Record<string, string>,
  packageName: string
): Record<string, string> {
  const pkgPath = files['package.json']
    ? 'package.json'
    : Object.keys(files).find((p) => p.endsWith('/package.json'));
  if (!pkgPath || !files[pkgPath]) return files;

  try {
    const parsed = JSON.parse(files[pkgPath]) as Record<string, unknown>;
    if (!parsed.dependencies || typeof parsed.dependencies !== 'object') return files;
    const deps = { ...(parsed.dependencies as Record<string, string>) };
    if (!(packageName in deps)) return files;
    delete deps[packageName];
    const nextJson = JSON.stringify({ ...parsed, dependencies: deps }, null, 2) + '\n';
    return { ...files, [pkgPath]: nextJson };
  } catch {
    return files;
  }
}

export function scanExternalImportsInSource(code: string): ExternalImportEntry[] {
  if (!code) return [];
  const results: ExternalImportEntry[] = [];
  const regex = /^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(code)) !== null) {
    const spec = m[2].trim();
    if (spec.startsWith('.') || spec.startsWith('@/') || /\.(css|scss|sass)$/i.test(spec)) {
      continue;
    }
    results.push({
      packageName: spec,
      specifiersText: m[1].trim(),
    });
  }
  return results;
}

export function injectLibraryImportIntoSource(
  code: string,
  opts: {
    packageName: string;
    importMode: 'named' | 'default' | 'namespace';
    identifiers: string[];
  }
): string {
  const pkg = opts.packageName.trim();
  const cleanIds = opts.identifiers
    .map((id) => id.trim().replace(/[^A-Za-z0-9_$]/g, ''))
    .filter(Boolean);
  if (!pkg || cleanIds.length === 0) return code;

  const escapedPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingRegex = new RegExp(
    `^import\\s+([^;\\n]+?)\\s+from\\s+['"]${escapedPkg}['"];?\\s*$`,
    'm'
  );
  const existingMatch = existingRegex.exec(code);

  if (existingMatch && opts.importMode === 'named') {
    const clause = existingMatch[1].trim();
    const braceStart = clause.indexOf('{');
    const braceEnd = clause.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      const existingNamed = clause
        .slice(braceStart + 1, braceEnd)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...existingNamed, ...cleanIds]));
      const prefix = clause.slice(0, braceStart).trim();
      const rebuilt = prefix
        ? `import ${prefix} { ${merged.join(', ')} } from '${pkg}';`
        : `import { ${merged.join(', ')} } from '${pkg}';`;
      return (
        code.slice(0, existingMatch.index) +
        rebuilt +
        code.slice(existingMatch.index + existingMatch[0].length)
      );
    }
  }

  let importStatement = '';
  if (opts.importMode === 'named') {
    importStatement = `import { ${cleanIds.join(', ')} } from '${pkg}';`;
  } else if (opts.importMode === 'namespace') {
    importStatement = `import * as ${cleanIds[0]} from '${pkg}';`;
  } else {
    importStatement = `import ${cleanIds[0]} from '${pkg}';`;
  }

  if (code.includes(importStatement)) return code;

  // Insert right after last top-level import or after 'use client'; directive
  const importLines = [...code.matchAll(/^import\s+[^\n]+\n?/gm)];
  if (importLines.length > 0) {
    const last = importLines[importLines.length - 1];
    const insertPos = (last.index ?? 0) + last[0].length;
    const sep = last[0].endsWith('\n') ? '' : '\n';
    return code.slice(0, insertPos) + sep + importStatement + '\n' + code.slice(insertPos);
  }

  const useClientMatch = code.match(/^['"]use client['"];?\s*\n?/);
  if (useClientMatch) {
    const insertPos = useClientMatch[0].length;
    return code.slice(0, insertPos) + importStatement + '\n' + code.slice(insertPos);
  }

  return `${importStatement}\n${code}`;
}

export interface ParsedNpmInstallCommand {
  packageName: string;
  version: string;
}

/** Accept one-package npm install commands, including scoped packages and explicit versions. */
export function parseNpmInstallCommand(command: string): ParsedNpmInstallCommand | null {
  const trimmed = command.trim();
  const match = trimmed.match(/^(?:npm\s+(?:install|i))\s+(.+)$/i);
  if (!match) return null;
  const args = match[1].trim().split(/\s+/);
  const packageArgs = args.filter((arg) => !arg.startsWith('-'));
  if (args.some((arg) => arg.startsWith('-')) || packageArgs.length !== 1) return null;
  const spec = packageArgs[0];
  const slash = spec.lastIndexOf('/');
  const at = spec.lastIndexOf('@');
  const hasVersion = at > slash;
  const packageName = hasVersion ? spec.slice(0, at) : spec;
  const version = hasVersion ? spec.slice(at + 1) : 'latest';
  if (!isValidPackageName(packageName) || !version || !/^[a-z0-9*^~><=.|+-]+$/i.test(version)) {
    return null;
  }
  return { packageName, version };
}
