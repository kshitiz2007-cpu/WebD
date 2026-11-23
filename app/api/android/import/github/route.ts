import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 30;

function parseRepo(input: string) {
  const value = input.trim().replace(/\.git$/, '');
  const match = value.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/tree\/([^/]+))?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], branch: match[3] || 'HEAD' };
}

const ignored = /\.(png|jpe?g|gif|webp|ico|apk|aab|jar|class|so|zip|pdf|mp4|mp3|woff2?|ttf|otf)$/i;

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = parseRepo(body.url || '');
  if (!parsed) return NextResponse.json({ error: 'Enter a public GitHub repository URL like https://github.com/owner/repo or /tree/branch' }, { status: 400 });
  const archiveUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/zip/${encodeURIComponent(parsed.branch)}`;
  try {
    const response = await fetch(archiveUrl, { headers: { 'User-Agent': 'WebD-Android-IDE' }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? 'Repository or branch not found. Private repositories are not supported.' : `GitHub archive fetch failed (${response.status})` }, { status: response.status });
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) return NextResponse.json({ error: 'Repository archive exceeds 8 MB limit.' }, { status: 413 });
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const root = entries.length ? entries[0].name.split('/')[0] : '';
    const files: Record<string, string> = {};
    for (const entry of entries) {
      let path = entry.name.startsWith(root + '/') ? entry.name.slice(root.length + 1) : entry.name;
      if (!path || path.startsWith('/') || path.split('/').some((part) => part === '..') || path.startsWith('.git/') || ignored.test(path)) continue;
      if (files[path] !== undefined) continue;
      if (Object.keys(files).length >= 1200) break;
      try {
        const file = await entry.async('string');
        if (file.length <= 1_000_000) files[path] = file;
      } catch { /* skip unreadable binary files */ }
    }
    return NextResponse.json({ success: true, files, fileCount: Object.keys(files).length, repo: `${parsed.owner}/${parsed.repo}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 502 });
  }
}
