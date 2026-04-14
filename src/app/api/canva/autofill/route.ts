import { NextRequest, NextResponse } from "next/server";

// Canva Connect API - Autofill
// Creates a design from a brand template, filling in slide data automatically
// Docs: https://www.canva.dev/docs/connect/api-reference/autofill/

const CANVA_API = "https://api.canva.com/rest/v1";

export async function POST(req: NextRequest) {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const accessToken = process.env.CANVA_ACCESS_TOKEN;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Canva API credentials not configured" }, { status: 500 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Canva not authenticated. Complete OAuth flow first.", needsAuth: true }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { brandTemplateId, slides, category } = body;

    if (!brandTemplateId) {
      return NextResponse.json({ error: "brandTemplateId required" }, { status: 400 });
    }

    // Build autofill data from slides
    // Maps slide content to Canva template fields
    const data: Record<string, { type: string; text?: string }> = {};
    (slides || []).forEach((slide: { heading?: string; body?: string; stat?: string }, i: number) => {
      data[`slide_${i + 1}_heading`] = { type: "text", text: slide.heading || "" };
      data[`slide_${i + 1}_body`] = { type: "text", text: slide.body || "" };
      if (slide.stat) {
        data[`slide_${i + 1}_stat`] = { type: "text", text: slide.stat };
      }
    });

    // Create autofill job
    const r = await fetch(`${CANVA_API}/autofills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        brand_template_id: brandTemplateId,
        data,
        title: `SA Carousel - ${category || "general"} - ${new Date().toLocaleDateString()}`,
      }),
    });

    const result = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: result?.message || "Autofill failed", details: result }, { status: r.status });
    }

    return NextResponse.json({ job: result, ts: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET: Check autofill job status
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
    const r = await fetch(`${CANVA_API}/autofills/${jobId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const result = await r.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
