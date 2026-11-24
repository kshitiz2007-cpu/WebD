import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

function config() {
  const serviceUrl = process.env.ANDROID_BUILD_SERVICE_URL?.replace(/\\/$/, '');
  const token = process.env.ANDROID_BUILD_SERVICE_TOKEN;
  return { serviceUrl, token };
}

export async function GET(request: NextRequest) {
  const { serviceUrl, token } = config();
  if (!serviceUrl || !token) return NextResponse.json({ reachable: false, error: 'Build worker configuration is missing.' }, { status: 503 });
  const jobId = request.nextUrl.searchParams.get('jobId');
  try {
    const endpoint = jobId ? `${serviceUrl}/build/${encodeURIComponent(jobId)}` : `${serviceUrl}/health`;
    const response = await fetch(endpoint, { cache: 'no-store', headers: jobId ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(12000) });
    const raw = await response.text();
    let data: any;
    try { data = JSON.parse(raw); } catch { data = { detail: raw.slice(0, 1500) }; }
    if (jobId) return NextResponse.json(data, { status: response.status });
    return NextResponse.json({ reachable: response.ok, workerStatus: response.status, worker: data }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ reachable: false, error: error instanceof Error ? error.message : 'Worker request failed' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const { serviceUrl, token } = config();
  if (!serviceUrl || !token) return NextResponse.json({ error: 'Android build service is not configured.' }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !body.files || typeof body.files !== 'object' || Array.isArray(body.files)) return NextResponse.json({ error: 'Expected a project files object' }, { status: 400 });
  const files = body.files as Record<string, unknown>;
  if (Object.keys(files).length > 1200 || Object.values(files).some((v) => typeof v !== 'string')) return NextResponse.json({ error: 'Invalid files payload or too many files' }, { status: 400 });
  if (new TextEncoder().encode(JSON.stringify(body)).length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Project exceeds 8 MB request limit' }, { status: 413 });
  try {
    const response = await fetch(serviceUrl + '/build', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
    const raw = await response.text();
    let data: any;
    try { data = JSON.parse(raw); } catch { data = { success: false, error: raw || `Worker returned HTTP ${response.status}` }; }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unable to start build job on worker.', detail: error instanceof Error ? error.message : 'Unknown connection error' }, { status: 502 });
  }
}
