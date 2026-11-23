import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  const serviceUrl = process.env.ANDROID_BUILD_SERVICE_URL?.replace(/\/$/, '');
  const token = process.env.ANDROID_BUILD_SERVICE_TOKEN;
  if (!serviceUrl || !token) return NextResponse.json({ reachable: false, error: 'Build worker configuration is missing.' }, { status: 503 });
  try {
    const response = await fetch(serviceUrl + '/health', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); } catch { data = { detail: raw.slice(0, 1000) }; }
    return NextResponse.json({ reachable: response.ok, workerStatus: response.status, worker: data }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ reachable: false, error: error instanceof Error ? error.message : 'Worker health check failed' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const serviceUrl = process.env.ANDROID_BUILD_SERVICE_URL?.replace(/\/$/, '');
  const token = process.env.ANDROID_BUILD_SERVICE_TOKEN;
  if (!serviceUrl || !token) {
    return NextResponse.json({ error: 'Android build service is not configured. Deploy the build-worker and set ANDROID_BUILD_SERVICE_URL and ANDROID_BUILD_SERVICE_TOKEN.' }, { status: 503 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('files' in body) || !body.files || typeof body.files !== 'object' || Array.isArray(body.files)) {
    return NextResponse.json({ error: 'Expected a project files object' }, { status: 400 });
  }
  const files = (body as { files: Record<string, unknown> }).files;
  if (Object.keys(files).length > 1200 || Object.values(files).some((v) => typeof v !== 'string')) {
    return NextResponse.json({ error: 'Invalid files payload or too many files' }, { status: 400 });
  }
  const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
  if (bytes > 8 * 1024 * 1024) return NextResponse.json({ error: 'Project exceeds 8 MB request limit' }, { status: 413 });
  try {
    const response = await fetch(serviceUrl + '/build', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: AbortSignal.timeout(295000) });
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); }
    catch { data = { success: false, error: raw || `Build worker returned HTTP ${response.status} without JSON.`, log: raw }; }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Could not connect to Android build worker.',
      detail: error instanceof Error ? error.message : 'Unknown connection error',
      hint: 'Check Railway worker deployment, health endpoint, and service URL/token configuration.',
    }, { status: 502 });
  }
}
