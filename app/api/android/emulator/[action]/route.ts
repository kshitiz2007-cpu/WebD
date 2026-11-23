import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const worker = () => process.env.ANDROID_EMULATOR_SERVICE_URL?.replace(/\/$/, "");
const token = () => process.env.ANDROID_EMULATOR_SERVICE_TOKEN || "";

async function forward(action: string, req: NextRequest, method: "GET" | "POST") {
  const base = worker();
  if (!base || !token()) return NextResponse.json({ error: "Android emulator worker is not configured." }, { status: 503 });
  if (!["start", "logcat", "input", "stop"].includes(action)) return NextResponse.json({ error: "Unknown emulator action." }, { status: 404 });
  const session = req.nextUrl.searchParams.get("session");
  const url = new URL(`${base}/${action}`);
  if (session && action !== "start") url.searchParams.set("session", session);
  let body: string | undefined;
  if (method === "POST") body = await req.text();
  try {
    const upstream = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(action === "start" ? 260_000 : 30_000),
    });
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Emulator worker request failed" }, { status: 502 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return forward(action, req, "POST");
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return forward(action, req, "GET");
}
