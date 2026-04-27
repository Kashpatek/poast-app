import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const KEY = "poast:bugs";
const MAX_BUGS = 1000;

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

interface BugItem {
  id: string;
  title: string;
  body: string;
  user: string;
  role: string;
  sec: string | null;
  ts: number;
  status: "open" | "fixed";
}

function genId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  try {
    const raw = await redis.lrange(KEY, 0, -1);
    const bugs: BugItem[] = (raw || []).map((item) => {
      if (typeof item === "string") {
        try { return JSON.parse(item); } catch { return null; }
      }
      return item as BugItem;
    }).filter(Boolean) as BugItem[];
    return NextResponse.json({ bugs });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  try {
    const body = await req.json();
    const bug: BugItem = {
      id: genId(),
      title: String(body.title || "").slice(0, 200),
      body: String(body.body || "").slice(0, 4000),
      user: String(body.user || "anon").slice(0, 40),
      role: String(body.role || "anon").slice(0, 40),
      sec: body.sec ? String(body.sec).slice(0, 40) : null,
      ts: Date.now(),
      status: "open",
    };
    if (!bug.body) return NextResponse.json({ error: "body required" }, { status: 400 });
    await redis.lpush(KEY, JSON.stringify(bug));
    await redis.ltrim(KEY, 0, MAX_BUGS - 1);
    return NextResponse.json({ ok: true, bug });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Toggle status open <-> fixed. Read-modify-write the whole list.
// Acceptable for our scale (low write rate).
export async function PATCH(req: NextRequest) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  try {
    const body = await req.json();
    const id = String(body.id || "");
    const status: "open" | "fixed" = body.status === "fixed" ? "fixed" : "open";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const raw = await redis.lrange(KEY, 0, -1);
    const updated: string[] = [];
    let found = false;
    for (const item of raw || []) {
      const obj = typeof item === "string"
        ? (function() { try { return JSON.parse(item); } catch { return null; } })()
        : item;
      if (obj && obj.id === id) { obj.status = status; found = true; }
      updated.push(JSON.stringify(obj));
    }
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });

    await redis.del(KEY);
    if (updated.length > 0) await redis.rpush(KEY, ...updated);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
