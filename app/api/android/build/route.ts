import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const workerUrl = () => (process.env.ANDROID_BUILD_SERVICE_URL || '').replace(/\/+$/, '');
const workerToken = () => process.env.ANDROID_BUILD_SERVICE_TOKEN || process.env.ANDROID_BUILD_TOKEN || '';

async function workerFetch(path: string, init?: RequestInit) {
  const token = workerToken();
  if (!token) throw new Error('Android build worker token is not configured on WebD.');
  const response = await fetch(workerUrl() + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, ...(init?.headers || {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(300000),
  });
  const raw = await response.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || 'Worker returned an invalid response.' }; }
  if (!response.ok) throw new Error(data.detail || data.error || 'Android worker returned HTTP ' + response.status);
  return data;
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  try {
    if (!jobId) {
      const health = await fetch(workerUrl() + '/health', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!health.ok) return NextResponse.json({ reachable: false, error: 'Android build worker health check failed.' }, { status: 502 });
      return NextResponse.json({ reachable: true, provider: 'Dedicated Android Build Worker', ...(await health.json()) });
    }
    if (!/^[a-f0-9]{32}$/.test(jobId)) return NextResponse.json({ status: 'failed', error: 'Invalid build ID.' }, { status: 400 });
    return NextResponse.json(await workerFetch('/build/' + encodeURIComponent(jobId)));
  } catch (error) {
    return NextResponse.json({ reachable: false, status: 'failed', success: false, error: error instanceof Error ? error.message : 'Android build worker request failed.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || !body.files || typeof body.files !== 'object' || Array.isArray(body.files)) return NextResponse.json({ error: 'Expected a project files object.' }, { status: 400 });
    const files = body.files as Record<string, unknown>;
    if (!Object.keys(files).length || Object.keys(files).length > 1200 || Object.values(files).some(v => typeof v !== 'string')) return NextResponse.json({ error: 'Invalid files payload or too many files.' }, { status: 400 });
    const data = await workerFetch('/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start Android build.';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
