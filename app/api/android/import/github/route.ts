import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 30;

function parseRepo(input: string) {
  const value = input.trim().replace(/\\.git$/, '');
  const match = value.match(/^(?:https?:\\/\\/github\\.com\\/)?([\\w.-]+)\\/([\\w.-]+)(?:\\/tree\\/([^/]+))?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], branch: match[3] || 'HEAD' };
}

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = parseRepo(body.url || '');
  if (!parsed) return NextResponse.json({ error: 'Enter a GitHub repository URL, e.g. https://github.com/owner/repo' }, { status: 400 });
  const archiveUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/${parsed.branch}`;
  try {
    const response = await fetch(archiveUrl, { headers: { 'User-Agent': 'WebD-Android-IDE' }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? 'Repository or branch not found. Private repositories are not supported by this import.' : `GitHub archive fetch failed (${response.status})` }, { status: response.status });
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) return NextResponse.json({ error: 'Repository archive exceeds 8 MB limit.' }, { status: 413 });
    const zip = await JSZip.loadAsync(buffer);
    const files: Record<string, string> = {};
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    for (const entry of entries) {
      const path = entry.name.split('/').slice(1).join('/');
      if (!path || path.startsWith('/') || path.split('/').some((part) => part === '..') || path.startsWith('.git/')) continue;
      if (files[path] !== undefined) continue;
      if (Object.keys(files).length >= 1200) break;
      const file = await entry.async('string');
      if (file.length > 1_000_000) continue;
      files[path] = file;
    }
    return NextResponse.json({ success: true, files, fileCount: Object.keys(files).length, repo: `${parsed.owner}/${parsed.repo}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 502 });
  }
}
