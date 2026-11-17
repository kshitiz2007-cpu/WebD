import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

const ALLOWED_TEXT_EXT = /\.(tsx|ts|jsx|js|mjs|cjs|css|scss|html|htm|json|svg|md|txt)$/i;
const IGNORED_DIRS = /(^|\/)(node_modules|\.next|\.git|dist|build|coverage)\//;

function parseGitHubUrl(rawUrl: string): { owner: string; repo: string; branch?: string } | null {
  try {
    const u = new URL(rawUrl.trim());
    if (!/github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');
    if (parts[2] === 'tree' && parts.length >= 4) {
      // Branch names can contain slashes, e.g., recovery/original-full-app
      const branch = parts.slice(3).join('/');
      return { owner, repo, branch };
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

async function fetchBranchArchive(owner: string, repo: string, branch: string): Promise<ArrayBuffer | null> {
  const archiveUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${branch
    .split('/')
    .map(encodeURIComponent)
    .join('/')}.zip`;
  const res = await fetch(archiveUrl, {
    headers: { 'User-Agent': 'Atelier-Studio-Importer' },
    redirect: 'follow',
  });
  if (!res.ok) return null;
  return res.arrayBuffer();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = typeof body?.url === 'string' ? body.url : '';
    const parsed = parseGitHubUrl(rawUrl);

    if (!parsed) {
      return NextResponse.json(
        { error: 'Please enter a valid GitHub repository URL (for example https://github.com/owner/repo).' },
        { status: 400 }
      );
    }

    const { owner, repo, branch } = parsed;
    const candidates: string[] = [];

    if (branch) {
      candidates.push(branch);
      // If branch had a subpath (e.g. tree/main/packages/web), also try just first segment and default branches
      if (branch.includes('/')) {
        candidates.push(branch.split('/')[0]);
      }
    } else {
      // Fetch default branch from GitHub API
      const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'User-Agent': 'Atelier-Studio-Importer' },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (typeof meta.default_branch === 'string') {
          candidates.push(meta.default_branch);
        }
      }
      candidates.push('main', 'master');
    }

    let zipBuffer: ArrayBuffer | null = null;
    let resolvedBranch = candidates[0] || 'main';
    for (const cand of [...new Set(candidates)]) {
      const buf = await fetchBranchArchive(owner, repo, cand);
      if (buf) {
        zipBuffer = buf;
        resolvedBranch = cand;
        break;
      }
    }

    if (!zipBuffer) {
      return NextResponse.json(
        { error: `Could not download repository archive for ${owner}/${repo}. Verify the repository is public and the branch exists.` },
        { status: 404 }
      );
    }

    const zip = await JSZip.loadAsync(zipBuffer);
    const files: Record<string, string> = {};
    const entries = Object.values(zip.files);

    for (const entry of entries) {
      if (entry.dir) continue;
      if (IGNORED_DIRS.test(entry.name)) continue;
      if (!ALLOWED_TEXT_EXT.test(entry.name)) continue;
      // Skip large lockfiles
      if (/package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/i.test(entry.name)) continue;
      const content = await entry.async('string');
      if (content.length <= 400_000) {
        files[entry.name] = content;
      }
    }

    return NextResponse.json({
      name: `${owner}/${repo}`,
      branch: resolvedBranch,
      files,
      fileCount: Object.keys(files).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to import GitHub repository.' },
      { status: 500 }
    );
  }
}
