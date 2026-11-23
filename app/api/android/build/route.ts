import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
    const response = await fetch(serviceUrl + '/build', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal: AbortSignal.timeout(290000) });
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); }
    catch { data = { success: false, error: raw || `Build worker returned HTTP ${response.status} without JSON.`, log: raw }; }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Build service unavailable' }, { status: 502 });
  }
}
