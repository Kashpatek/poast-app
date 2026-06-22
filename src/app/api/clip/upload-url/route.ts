// POST /api/clip/upload-url
//
// Returns a presigned Cloudflare R2 (S3-compatible) PUT URL so the browser can
// upload a multi-GB video DIRECTLY to storage — bypassing Vercel's 4.5 MB
// request-body cap. The function payload here is tiny. The browser must PUT the
// file with the SAME Content-Type it requested here (it's part of the signature).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { checkRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

const Body = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

function r2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function safeKey(filename: string): string {
  const base = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `clips/${rand}-${base}`;
}

export async function POST(req: NextRequest) {
  const { allowed, remaining } = await checkRateLimit(req);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining ?? 0) } }
    );
  }

  const bucket = process.env.R2_BUCKET;
  const client = r2Client();
  if (!client || !bucket) {
    return NextResponse.json({ error: "R2 storage not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { filename, contentType } = parsed.data;
  if (!/^(video|audio)\//.test(contentType)) {
    return NextResponse.json(
      { error: "Only video/* or audio/* uploads are allowed" },
      { status: 400 }
    );
  }

  const key = safeKey(filename);
  try {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 3600 }
    );
    const base = process.env.R2_PUBLIC_BASE?.replace(/\/$/, "");
    const publicUrl = base ? `${base}/${key}` : null;
    return NextResponse.json({ uploadUrl, key, publicUrl, ts: Date.now() });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Failed to presign upload" },
      { status: 500 }
    );
  }
}
