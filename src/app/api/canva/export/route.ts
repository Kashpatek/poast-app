import { NextRequest, NextResponse } from "next/server";

// Canva Connect API - Export
// Exports a Canva design as PNG/PDF for download
// Docs: https://www.canva.dev/docs/connect/api-reference/export/

const CANVA_API = "https://api.canva.com/rest/v1";

export async function POST(req: NextRequest) {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Canva not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { designId, format } = body;

    if (!designId) {
      return NextResponse.json({ error: "designId required" }, { status: 400 });
    }

    // Start export job
    const r = await fetch(`${CANVA_API}/exports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
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

// GET: Check export job status + get download URL
export async function GET(req: NextRequest) {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const r = await fetch(`${CANVA_API}/exports/${jobId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const result = await r.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
