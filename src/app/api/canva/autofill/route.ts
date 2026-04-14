import { NextRequest, NextResponse } from "next/server";
import { getCanvaAccessToken, forceRefreshCanvaToken } from "../token";

// Canva Connect API - Autofill with SA Carousel Schema v1.0
const CANVA_API = "https://api.canva.com/rest/v1";

const TEMPLATE_MAP: Record<string, string> = {
  COVER: "sa_research_cover_v1",
  BODY_A: "sa_research_body_dark_v1",
  BODY_B: "sa_research_body_light_v1",
  BODY_IMAGE: "sa_research_body_image_v1",
  BODY_LARGE_IMAGE: "sa_research_body_large_image_v1",
};

function buildAutofillData(slide: Record<string, string>) {
  const data: Record<string, { type: string; text?: string; url?: string }> = {};
  switch (slide.type) {
    case "COVER":
      if (slide.title) data["TITLE"] = { type: "text", text: slide.title };
      if (slide.subtitle) data["SUBTITLE"] = { type: "text", text: slide.subtitle };
      if (slide.image_url) data["IMAGE"] = { type: "image", url: slide.image_url };
      break;
    case "BODY_A": case "BODY_B": case "BODY_FINAL":
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

// Helper: make a Canva API request with auto-refresh on 401
async function canvaFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = await getCanvaAccessToken();
  if (!token) throw new Error("No Canva token available. Authorize at /api/canva/auth");

  const headers = { ...options.headers as Record<string, string>, "Authorization": `Bearer ${token}` };
  let r = await fetch(url, { ...options, headers });

  // If 401, try refreshing the token once
  if (r.status === 401) {
    const newToken = await forceRefreshCanvaToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      r = await fetch(url, { ...options, headers });
    }
  }

  return r;
}

export async function POST(req: NextRequest) {
  const token = await getCanvaAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Canva not authenticated. Visit /api/canva/auth first.", needsAuth: true }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { slides, category } = body;

    if (!slides || !slides.length) {
      return NextResponse.json({ error: "No slides provided" }, { status: 400 });
    }

    const jobs = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const templateId = slide.template_id || TEMPLATE_MAP[slide.type];

      if (!templateId) {
        jobs.push({ index: i, type: slide.type, error: "No template ID for type: " + slide.type });
        continue;
      }

      try {
        const r = await canvaFetch(`${CANVA_API}/autofills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_template_id: templateId,
            data: buildAutofillData(slide),
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

export async function GET(req: NextRequest) {
  const token = await getCanvaAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");

  if (action === "templates") {
    try {
      const r = await canvaFetch(`${CANVA_API}/brand-templates?query=sa_research&ownership=owned`);
      const result = await r.json();
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId or action=templates required" }, { status: 400 });
  }

  try {
    const r = await canvaFetch(`${CANVA_API}/autofills/${jobId}`);
    const result = await r.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
