import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    ok: true,
    hasUrl: !!url,
    hasKey: !!key,
    urlPreview: url ? url.slice(0, 30) + "..." : "NOT SET",
  });
}
