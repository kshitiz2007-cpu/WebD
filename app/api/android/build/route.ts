import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 30;

const API = 'https://api.github.com';
const OWNER = 'kshitiz2007-cpu';
const REPO = 'WebD';
const WORKFLOW = 'android-build.yml';

function config() { return { token: process.env.ANDROID_BUILD_TOKEN || process.env.GITHUB_ACTIONS_TOKEN }; }
function ghHeaders(token: string) { return { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }
async function gh(token: string, path: string, init?: RequestInit) {
  const response = await fetch(API + path, { ...init, headers: { ...ghHeaders(token), ...(init?.headers || {}) }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const raw = await response.text(); let data: any;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) throw new Error(data.message || 'GitHub API error ' + response.status);
  return data;
}
function cleanId(id: string) { return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48); }

export async function GET(request: NextRequest) {
  const { token } = config();
  if (!token) return NextResponse.json({ reachable: false, error: 'GitHub Actions token is not configured on the server (set GITHUB_ACTIONS_TOKEN or ANDROID_BUILD_TOKEN).' }, { status: 503 });
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ reachable: true, provider: 'GitHub Actions' });
  if (cleanId(jobId) !== jobId) return NextResponse.json({ status: 'failed', error: 'Invalid build ID.' }, { status: 400 });
  const branch = 'android-build-' + jobId;
  try {
    const runs = await gh(token, `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=1`);
    const run = runs.workflow_runs?.[0];
    if (!run) return NextResponse.json({ status: 'queued', success: false, log: 'Waiting for GitHub Actions runner…' });
    if (run.status !== 'completed') return NextResponse.json({ status: run.status === 'queued' ? 'queued' : 'running', success: false, log: 'GitHub Actions: ' + run.status + ' · ' + (run.html_url || '') });
    if (run.conclusion !== 'success') {
      let log = 'GitHub Actions build failed. Run: ' + run.html_url;
      try { const jobs = await gh(token, `/repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs?per_page=20`); log += '\\n' + (jobs.jobs || []).map((j: any) => j.name + ': ' + j.conclusion + '\\n' + (j.steps || []).map((s: any) => s.name + ' — ' + s.conclusion).join('\\n')).join('\\n'); } catch {}
      return NextResponse.json({ status: 'failed', success: false, error: 'GitHub Actions build failed.', log, runUrl: run.html_url });
    }
    const artifacts = await gh(token, `/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts?per_page=50`);
    const artifact = (artifacts.artifacts || []).find((a: any) => !a.expired && a.name.startsWith('app-debug-'));
    if (!artifact) return NextResponse.json({ status: 'failed', success: false, error: 'APK artifact not found.', log: run.html_url });
    const zipResponse = await fetch(artifact.archive_download_url, { headers: ghHeaders(token), cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!zipResponse.ok) throw new Error('Artifact download failed: HTTP ' + zipResponse.status);
    const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer());
    const apkEntry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.apk'));
    if (!apkEntry) return NextResponse.json({ status: 'failed', success: false, error: 'Artifact ZIP contains no APK.' });
    const apk = await apkEntry.async('base64');
    return NextResponse.json({ status: 'completed', success: true, apkBase64: apk, fileName: 'app-debug.apk', sizeBytes: Math.floor(apk.length * 3 / 4), log: 'Build succeeded on GitHub Actions runner. Run: ' + run.html_url });
  } catch (error) { return NextResponse.json({ status: 'failed', success: false, error: error instanceof Error ? error.message : 'GitHub Actions status lookup failed.' }, { status: 502 }); }
}

export async function POST(request: NextRequest) {
  const { token } = config();
  if (!token) return NextResponse.json({ error: 'ANDROID_BUILD_TOKEN is not configured on the server.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !body.files || typeof body.files !== 'object' || Array.isArray(body.files)) return NextResponse.json({ error: 'Expected a project files object.' }, { status: 400 });
  const files = body.files as Record<string, unknown>;
  if (!Object.keys(files).length || Object.keys(files).length > 1200 || Object.values(files).some(v => typeof v !== 'string')) return NextResponse.json({ error: 'Invalid files payload or too many files.' }, { status: 400 });
  if (new TextEncoder().encode(JSON.stringify(body)).length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Project exceeds 8 MB request limit.' }, { status: 413 });
  const buildId = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const branch = 'android-build-' + buildId;
  try {
    const repoInfo = await gh(token, `/repos/${OWNER}/${REPO}`);
    const defaultBranch = repoInfo.default_branch || 'main';
    const baseRef = await gh(token, `/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
    await gh(token, `/repos/${OWNER}/${REPO}/git/refs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: baseRef.object.sha }) });
    for (const [path, value] of Object.entries(files)) {
      const safe = path.replace(/^\/+/, '');
      // GitHub rejects workflow-file writes with PATs lacking the workflow scope.
      // Imported app projects do not need their source repo workflows to build here.
      if (safe.startsWith('.github/workflows/') || safe.startsWith('.github/')) continue;
      if (!safe || safe.split('/').includes('..') || safe.startsWith('.git/') || safe.length > 240) throw new Error('Unsafe project path: ' + path);
      await gh(token, `/repos/${OWNER}/${REPO}/contents/${safe.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Android build input ' + buildId, content: Buffer.from(value as string, 'utf8').toString('base64'), branch }) });
    }
    await gh(token, `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: branch, inputs: { build_branch: branch, build_id: buildId } }) });
    return NextResponse.json({ jobId: buildId, status: 'queued', provider: 'GitHub Actions' });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to start GitHub Actions build.' }, { status: 502 }); }
}
