import { NextResponse } from "next/server";

// Preflight for the Vercel Blob persistence path. The thumbnail panel
// pings this on mount so it can warn the user up front when Blob isn't
// configured ("Thumbnails will only render in this session — set
// BLOB_READ_WRITE_TOKEN to persist them").
//
// Cheap: just checks env presence. Doesn't try a round-trip — that's
// the next layer's job.

export async function GET() {
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  return NextResponse.json({ blobConfigured, ts: Date.now() });
}
