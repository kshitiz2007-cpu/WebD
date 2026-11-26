import { NextRequest, NextResponse } from 'next/server';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';

let cachedTailwindCss: string | null = null;

function getTailwindDir(): string {
  return path.join(process.cwd(), 'node_modules', 'tailwindcss');
}

function getTailwindFile(sub = 'index.css'): string {
  const fullPath = path.join(getTailwindDir(), sub);
  if (sub === 'index.css' && cachedTailwindCss) return cachedTailwindCss;
  const content = fs.readFileSync(fullPath, 'utf8');
  if (sub === 'index.css') cachedTailwindCss = content;
  return content;
}

function extractCandidateTokens(sources: string[]): string[] {
  const tokens = new Set<string>();
  const tokenRegex = /[A-Za-z0-9_:\-[\]/.#%(),]+/g;
  for (const src of sources) {
    const matches = src.match(tokenRegex);
    if (!matches) continue;
    for (const m of matches) {
      if (m.length >= 2 && m.length <= 80) {
        tokens.add(m);
      }
    }
  }
  return Array.from(tokens);
}

export async function POST(req: NextRequest) {
  let projectCss = '';
  let sources: string[] = [];

  try {
    const body = await req.json();
    projectCss = typeof body?.css === 'string' ? body.css : '';
    sources = Array.isArray(body?.sources) ? body.sources : [];
  } catch {
    return NextResponse.json({ css: '', error: 'Invalid request body' }, { status: 400 });
  }

  const candidates = extractCandidateTokens(sources);

  try {
    let entryCss = projectCss
      .replace(/@tailwind\s+base\s*;/g, '')
      .replace(/@tailwind\s+components\s*;/g, '')
      .replace(/@tailwind\s+utilities\s*;/g, '')
      .replace(/@import\s+["']tw-animate-css["']\s*;/g, '')
      .replace(/@plugin\s+[^;]+;/g, '');

    if (!/@import\s+["']tailwindcss["']/.test(entryCss)) {
      entryCss = `@import "tailwindcss";\n${entryCss}`;
    }

    const compiler = await compile(entryCss, {
      base: getTailwindDir(),
      loadStylesheet: async (id: string, base: string) => {
        if (id === 'tailwindcss' || id.startsWith('tailwindcss/')) {
          const sub = id === 'tailwindcss' ? 'index.css' : id.replace(/^tailwindcss\//, '');
          return {
            path: id,
            base: getTailwindDir(),
            content: getTailwindFile(sub),
          };
        }
        return { path: id, base, content: '' };
      },
    });

    const builtCss = compiler.build(candidates);
    return NextResponse.json({ css: builtCss });
  } catch (err) {
    try {
      const compiler = await compile('@import "tailwindcss";', {
        base: getTailwindDir(),
        loadStylesheet: async (id: string) => ({
          path: id,
          base: getTailwindDir(),
          content: getTailwindFile('index.css'),
        }),
      });
      return NextResponse.json({
        css: compiler.build(candidates),
        warning: err instanceof Error ? err.message : 'CSS fallback compiled',
      });
    } catch (fallbackErr) {
      return NextResponse.json(
        {
          css: '',
          error: fallbackErr instanceof Error ? fallbackErr.message : 'CSS compilation failed',
        },
        { status: 500 }
      );
    }
  }
}
