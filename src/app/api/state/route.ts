import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { log as logger } from "@/lib/logger";

function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const KEY = "poast:current";
const LOG_KEY = "poast:log";

export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
    }
    const [state, log] = await Promise.all([
      redis.get(KEY),
      redis.get(LOG_KEY),
    ]);
    return NextResponse.json({
      state: state || null,
      log: log || [],
    });
  } catch (error) {
    logger.error("State load error", { error: String(error) });
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
    const { state, log } = body;

    const ops: Promise<unknown>[] = [];
    if (state !== undefined) ops.push(redis.set(KEY, state));
    if (log !== undefined) ops.push(redis.set(LOG_KEY, log));
    await Promise.all(ops);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("State save error", { error: String(error) });
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
