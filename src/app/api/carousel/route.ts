import { NextRequest, NextResponse } from "next/server";

// SA Carousel Schema v1.0 -- Template IDs map to Canva TEMPLATES folder
const TEMPLATE_IDS: Record<string, string> = {
  COVER: "sa_research_cover_v1",
  BODY_A: "sa_research_body_dark_v1",
  BODY_B: "sa_research_body_light_v1",
  BODY_IMAGE: "sa_research_body_image_v1",
  BODY_LARGE_IMAGE: "sa_research_body_large_image_v1",
};

const CAROUSEL_SYS = `You are a content strategist for SemiAnalysis, creating Instagram carousel content from research articles. You produce structured carousel slide objects following the SA Carousel Schema v1.0.

Slide types:
- COVER: title (5-8 words, bold claim, no end punctuation), subtitle (20-30 words, one sentence), image_url (if provided)
- BODY_A: body_text (60-80 words, dark background)
- BODY_B: body_text (60-80 words, light background)
- BODY_FINAL: body_text (60-80 words, ends with forward-looking statement, no arrow)
- BODY_IMAGE: image_url + body_text (30-50 words, optional)
- BODY_LARGE_IMAGE: image_url + subtext (10-20 words caption, optional)

Rules:
- Never use em dashes. Use commas, periods, or colons.
- No emojis.
- Tone: confident, technical, institutional. SA voice.
- No hype words like "revolutionary" or "game-changing".
- Body slides MUST alternate: BODY_A, BODY_B, BODY_A, BODY_B pattern.
- BODY_FINAL uses the background matching its alternation position.
- Plain declarative sentences. No bullets, no headers.
- Image URLs: use exact URLs if provided. Never fabricate URLs. Omit image slots if no image.

You MUST respond ONLY with valid JSON. No markdown fences. No preamble.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action, text, url, category, mode, pageCount, imageUrls } = body;

    if (action === "generate") {
      const slideCount = mode === "manual" ? (pageCount || 4) : "4-6 (your choice based on content density)";
      const imageNote = imageUrls && imageUrls.length > 0
        ? `Available image URLs (use these in COVER and optional image slides):\n${imageUrls.join("\n")}`
        : "No images provided. Omit image_url fields and do not include BODY_IMAGE or BODY_LARGE_IMAGE slides.";

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: CAROUSEL_SYS,
          messages: [{ role: "user", content: `Generate a carousel from this article content. Produce 3 variant approaches (A, B, C) with different editorial angles.

Category: ${category || "general"}
Target slide count: ${slideCount}
${imageNote}

Article content:
${(text || "").slice(0, 10000)}
${url ? "\nSource URL: " + url : ""}

Return JSON with 3 variants. Each variant has a slides array following the SA Carousel Schema v1.0:
{
  "A": {
    "label": "approach name (e.g. stat-forward, narrative arc, quote-driven)",
    "topic": "short topic summary",
    "slides": [
      { "type": "COVER", "title": "5-8 word title", "subtitle": "20-30 word subtitle" },
      { "type": "BODY_A", "body_text": "60-80 words on dark background" },
      { "type": "BODY_B", "body_text": "60-80 words on light background" },
      { "type": "BODY_FINAL", "body_text": "60-80 words, forward-looking, no arrow" }
    ]
  },
  "B": { ... },
  "C": { ... }
}

Rules:
- Every variant MUST start with COVER and end with BODY_FINAL
- Body slides alternate BODY_A then BODY_B then BODY_A etc.
- BODY_FINAL uses whichever background comes next in the alternation
- Only include BODY_IMAGE or BODY_LARGE_IMAGE if image URLs are provided
- No em dashes anywhere` }],
        }),
      });

      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Generation failed" }, { status: r.status });

      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const variants = JSON.parse(rawText.replace(/```json|```/g, "").trim());

        // Inject template_ids into each slide
        for (const key of Object.keys(variants)) {
          const v = variants[key];
          if (v && v.slides) {
            v.slides = v.slides.map((slide: { type: string }, i: number) => {
              let tid = TEMPLATE_IDS[slide.type] || TEMPLATE_IDS.BODY_A;
              // BODY_FINAL uses the template matching its alternation position
              if (slide.type === "BODY_FINAL") {
                // Count body slides before this one to determine alternation
                let bodyCount = 0;
                for (let j = 0; j < i; j++) {
                  if (v.slides[j].type.startsWith("BODY")) bodyCount++;
                }
                tid = bodyCount % 2 === 0 ? TEMPLATE_IDS.BODY_A : TEMPLATE_IDS.BODY_B;
              }
              return Object.assign({}, slide, { template_id: tid });
            });
          }
        }

        return NextResponse.json({ variants, templateIds: TEMPLATE_IDS, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse response", raw: rawText.slice(0, 300) }, { status: 500 });
      }
    }

    if (action === "caption") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: CAROUSEL_SYS,
          messages: [{ role: "user", content: `Generate an Instagram caption for this carousel.

Slides: ${JSON.stringify(body.slides)}

Rules:
- Include a "Save this for later." CTA
- Add 5-8 relevant hashtags at the bottom
- Add location: San Francisco, CA
- Under 2200 characters
- No em dashes, no emojis
- Confident, technical, institutional tone

Return JSON: { "caption": "full caption text", "hashtags": ["tag1", "tag2", ...] }` }],
        }),
      });

      const data = await r.json();
      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const caption = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ caption, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse caption" }, { status: 500 });
      }
    }

    if (action === "render") {
      // Build Canva autofill payload from slides array
      const { slides, carouselId, topic, sourceUrl } = body;
      const canvaPayload = {
        carousel_id: carouselId || "carousel_" + Date.now(),
        topic: topic || "",
        source_article: sourceUrl || "",
        generated_by: "Claude (claude-sonnet-4-20250514)",
        slides: (slides || []).map((s: Record<string, string>) => {
          const obj: Record<string, string> = { type: s.type, template_id: s.template_id || TEMPLATE_IDS[s.type] || "" };
          if (s.title) obj.title = s.title;
          if (s.subtitle) obj.subtitle = s.subtitle;
          if (s.body_text) obj.body_text = s.body_text;
          if (s.subtext) obj.subtext = s.subtext;
          if (s.image_url) obj.image_url = s.image_url;
          return obj;
        }),
      };
      return NextResponse.json({ canvaPayload, ts: Date.now() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
