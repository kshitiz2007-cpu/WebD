import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import {
  isSupportedGitHubImportPath,
  looksLikeHtmlPayload,
  parseGitHubRepoUrl,
  safeReadJsonResponse,
} from '@/lib/studio/github-import';

async function fetchBranchArchive(owner: string, repo: string, branch: string): Promise<ArrayBuffer | null> {
  const encodedBranch = branch
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const urls = [
    `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/refs/heads/${encodedBranch}`,
    `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${encodedBranch}.zip`,
  ];

  for (const archiveUrl of urls) {
    try {
      const res = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Atelier-Studio-Importer' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (/text\/html/i.test(contentType)) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 0) return buf;
    } catch {
      // Try fallback URL
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    let body: { url?: unknown } | null = null;
    try {
      body = (await req.json()) as { url?: unknown };
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON with a repository URL.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const rawUrl = typeof body?.url === 'string' ? body.url : '';
    const parsed = parseGitHubRepoUrl(rawUrl);

    if (!parsed) {
      return NextResponse.json(
        { error: 'Please enter a valid GitHub repository URL (for example https://github.com/owner/repo).' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { owner, repo, branch } = parsed;
    const candidates: string[] = [];

    if (branch) {
      candidates.push(branch);
      // If branch had a subpath (e.g. tree/main/packages/web), also try just first segment
      if (branch.includes('/')) {
        candidates.push(branch.split('/')[0]);
      }
    } else {
      try {
        const metaRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
          {
            headers: {
              'User-Agent': 'Atelier-Studio-Importer',
              Accept: 'application/vnd.github+json',
            },
            signal: AbortSignal.timeout(8_000),
          }
        );
        const metaParsed = await safeReadJsonResponse<{ default_branch?: string }>(metaRes);
        if (metaParsed.ok && typeof metaParsed.data.default_branch === 'string') {
          candidates.push(metaParsed.data.default_branch);
        }
      } catch {
        // Ignore metadata lookup timeout and try main/master
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
        {
          error: `Could not download repository archive for ${owner}/${repo}. Verify the repository is public and the branch exists.`,
        },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Verify buffer is not an HTML error document
    const headerSlice = new TextDecoder().decode(new Uint8Array(zipBuffer.slice(0, 64)));
    if (looksLikeHtmlPayload(headerSlice)) {
      return NextResponse.json(
        { error: `GitHub returned an HTML page instead of a ZIP archive for ${owner}/${repo}.` },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const zip = await JSZip.loadAsync(zipBuffer);
    const files: Record<string, string> = {};
    const entries = Object.values(zip.files);

    for (const entry of entries) {
      if (entry.dir) continue;
      if (!isSupportedGitHubImportPath(entry.name)) continue;
      const content = await entry.async('string');
      if (content.length <= 400_000) {
        files[entry.name] = content;
      }
    }

    return NextResponse.json(
      {
        name: `${owner}/${repo}`,
        branch: resolvedBranch,
        files,
        fileCount: Object.keys(files).length,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to import GitHub repository.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

