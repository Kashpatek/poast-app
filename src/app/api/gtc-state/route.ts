import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const KEY = "poast:gtc";

export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
    }
    const data = await redis.get(KEY);
    return NextResponse.json(data || {});
  } catch (error) {
    console.error("GTC state load error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
    }
    const body = await req.json();
    await redis.set(KEY, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("GTC state save error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
