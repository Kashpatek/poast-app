import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(30, "60 s"),
  });
  return ratelimit;
}

export async function checkRateLimit(
  req: NextRequest
): Promise<{ allowed: boolean; remaining?: number }> {
  const rl = getRatelimit();
  if (!rl) return { allowed: true };

  const ip = req.headers.get("x-forwarded-for") || "anonymous";
  const { success, remaining } = await rl.limit(ip);
  return { allowed: success, remaining };
}
