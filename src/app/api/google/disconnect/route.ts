// /api/google/disconnect · forget this user's Google tokens.
import { NextRequest, NextResponse } from "next/server";
import { isConfigured, disconnect } from "@/lib/google-cal";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  let body: { owner?: string };
  try { body = await req.json(); } catch { body = {}; }
  await disconnect(body.owner || "shared");
  return NextResponse.json({ ok: true });
}
