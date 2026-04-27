import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const KEY = "poast:events";
const MAX_EVENTS = 10000;

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

interface PoastEvent {
  event: string;
  user: string;
  role: string;
  sec: string | null;
  payload: Record<string, unknown>;
  ts: number;
}

export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  try {
    const raw = await redis.lrange(KEY, 0, -1);
    const events: PoastEvent[] = (raw || []).map((item) => {
      if (typeof item === "string") {
        try { return JSON.parse(item); } catch { return null; }
      }
      return item as PoastEvent;
    }).filter(Boolean) as PoastEvent[];
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ ok: true });
  try {
    const body = await req.json();
    const evt: PoastEvent = {
      event: String(body.event || "unknown").slice(0, 40),
      user: String(body.user || "anon").slice(0, 40),
      role: String(body.role || "anon").slice(0, 40),
      sec: body.sec ? String(body.sec).slice(0, 40) : null,
      payload: (body.payload && typeof body.payload === "object") ? body.payload : {},
      ts: Number(body.ts) || Date.now(),
    };
    await redis.lpush(KEY, JSON.stringify(evt));
    await redis.ltrim(KEY, 0, MAX_EVENTS - 1);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
