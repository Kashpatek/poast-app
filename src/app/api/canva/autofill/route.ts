import { NextRequest, NextResponse } from "next/server";

// Canva Connect API - Autofill with SA Carousel Schema v1.0
// Maps slide types to Canva brand templates in the TEMPLATES folder
// Each slide type has a specific Canva template with named text/image elements

const CANVA_API = "https://api.canva.com/rest/v1";

// SA Carousel Schema v1.0 template mapping
// These IDs reference templates in the Canva TEMPLATES folder
// Update these with actual Canva template IDs from the brand templates list
const TEMPLATE_MAP: Record<string, string> = {
  COVER: "sa_research_cover_v1",
  BODY_A: "sa_research_body_dark_v1",
  BODY_B: "sa_research_body_light_v1",
  BODY_IMAGE: "sa_research_body_image_v1",
  BODY_LARGE_IMAGE: "sa_research_body_large_image_v1",
};

// Map slide content fields to Canva template element names
function buildAutofillData(slide: Record<string, string>) {
  const data: Record<string, { type: string; text?: string; asset_id?: string; url?: string }> = {};

  switch (slide.type) {
    case "COVER":
      if (slide.title) data["TITLE"] = { type: "text", text: slide.title };
      if (slide.subtitle) data["SUBTITLE"] = { type: "text", text: slide.subtitle };
      if (slide.image_url) data["IMAGE"] = { type: "image", url: slide.image_url };
      break;
    case "BODY_A":
    case "BODY_B":
    case "BODY_FINAL":
      if (slide.body_text) data["BODY_TEXT"] = { type: "text", text: slide.body_text };
      break;
    case "BODY_IMAGE":
      if (slide.body_text) data["BODY_TEXT"] = { type: "text", text: slide.body_text };
      if (slide.image_url) data["IMAGE"] = { type: "image", url: slide.image_url };
      break;
    case "BODY_LARGE_IMAGE":
      if (slide.subtext) data["SUBTEXT"] = { type: "text", text: slide.subtext };
      if (slide.image_url) data["IMAGE"] = { type: "image", url: slide.image_url };
      break;
  }

  return data;
}

// POST: Create autofill jobs for all slides in a carousel
export async function POST(req: NextRequest) {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({
      error: "Canva not authenticated. Complete OAuth at /api/canva/auth first.",
      needsAuth: true,
    }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { slides, category } = body;

    if (!slides || !slides.length) {
      return NextResponse.json({ error: "No slides provided" }, { status: 400 });
    }

    // Create an autofill job for each slide
    const jobs = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const templateId = slide.template_id || TEMPLATE_MAP[slide.type];

      if (!templateId) {
        jobs.push({ index: i, type: slide.type, error: "No template ID for type: " + slide.type });
        continue;
      }

      const autofillData = buildAutofillData(slide);

      try {
        const r = await fetch(`${CANVA_API}/autofills`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            brand_template_id: templateId,
            data: autofillData,
            title: `SA Carousel - Slide ${i + 1} (${slide.type}) - ${category || "general"}`,
          }),
        });

        const result = await r.json();
        if (!r.ok) {
          jobs.push({ index: i, type: slide.type, error: result?.message || "Autofill failed", status: r.status });
        } else {
          jobs.push({ index: i, type: slide.type, job: result });
        }
      } catch (err) {
        jobs.push({ index: i, type: slide.type, error: String(err) });
      }
    }

    return NextResponse.json({ jobs, slideCount: slides.length, ts: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET: Check autofill job status or list brand templates
export async function GET(req: NextRequest) {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");

  // List brand templates from the TEMPLATES folder
  if (action === "templates") {
    try {
      const r = await fetch(`${CANVA_API}/brand-templates?query=sa_research&ownership=owned`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const result = await r.json();
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  // Check specific job status
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId or action=templates required" }, { status: 400 });
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
