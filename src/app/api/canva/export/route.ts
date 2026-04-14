import { NextRequest, NextResponse } from "next/server";
import { getCanvaAccessToken, forceRefreshCanvaToken } from "../token";

// Canva Connect API - Export with auto-refresh
const CANVA_API = "https://api.canva.com/rest/v1";

async function canvaFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = await getCanvaAccessToken();
  if (!token) throw new Error("No Canva token available");

  const headers = { ...options.headers as Record<string, string>, "Authorization": `Bearer ${token}` };
  let r = await fetch(url, { ...options, headers });

  if (r.status === 401 || r.status === 403) {
    const newToken = await forceRefreshCanvaToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      r = await fetch(url, { ...options, headers });
    }
  } else {
    const cloned = r.clone();
    try {
      const body = await cloned.json();
      if (body?.code === "invalid_access_token" || body?.code === "token_expired") {
        const newToken = await forceRefreshCanvaToken();
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
          r = await fetch(url, { ...options, headers });
        }
      }
    } catch { /* not JSON */ }
  }
  return r;
}

export async function POST(req: NextRequest) {
  const token = await getCanvaAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Canva not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { designId, format } = body;

    if (!designId) {
      return NextResponse.json({ error: "designId required" }, { status: 400 });
    }

    const r = await canvaFetch(`${CANVA_API}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        design_id: designId,
        format: {
          type: format || "png",
          ...(format === "pdf" ? { quality: "regular" } : { quality: "regular", width: 1080, height: 1350 }),
        },
      }),
    });

    const result = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: result?.message || "Export failed", details: result }, { status: r.status });
    }

    return NextResponse.json({ job: result, ts: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = await getCanvaAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const r = await canvaFetch(`${CANVA_API}/exports/${jobId}`);
    const result = await r.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
