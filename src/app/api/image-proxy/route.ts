import { NextRequest, NextResponse } from "next/server";
import { safeFetch, SsrfBlockedError } from "@/lib/safe-fetch";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    // safeFetch validates the URL and pins the connection to a public IP, so a
    // client can't proxy internal targets (metadata endpoint, localhost, RFC-1918).
    const res = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    return NextResponse.json({ error: "Proxy error" }, { status: 502 });
  }
}
