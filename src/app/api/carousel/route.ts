import { NextRequest, NextResponse } from "next/server";

const CAROUSEL_SYS = `You are a content strategist for SemiAnalysis, creating Instagram carousel content. You turn articles into engaging, data-forward carousel slides.

Brand rules:
- Never use em dashes. Use commas, periods, or colons.
- No emojis in slide content.
- Lead with hard facts and specific claims.
- Be direct and technical, not marketing language.
- SemiAnalysis brand colors: Amber #F7B041, Blue #0B86D1, Teal #2EAD8E, Coral #E06347

You MUST respond ONLY with valid JSON. No markdown fences. No preamble.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action, text, url, category, mode, pageCount, platforms } = body;

    if (action === "generate") {
      // Generate 3 carousel variants
      const catDescriptions: Record<string, string> = {
        general: "General industry news. Use SA Amber accent. Clean, data-forward layout.",
        internal: "SA original research. Use SA Blue accent. Authority/source framing.",
        external: "Resharing third-party content with SA commentary. Use SA Teal accent. Commentary overlay style.",
        capital: "Financial/investment analysis. Use SA Coral accent. Chart/data heavy layout.",
      };

      const catDesc = catDescriptions[category] || catDescriptions.general;
      const modeDesc = mode === "manual" ? `User wants exactly ${pageCount || 5} slides.` : "Decide the optimal number of slides (4-8).";
      const platformDesc = (platforms || ["instagram"]).join(", ");

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: CAROUSEL_SYS,
          messages: [{ role: "user", content: `Create 3 Instagram carousel variants from this article content.

Category: ${category} -- ${catDesc}
Mode: ${modeDesc}
Platforms: ${platformDesc}
Dimensions: 1080x1350px (4:5 portrait)

Article content:
${(text || "").slice(0, 10000)}

Return JSON with 3 variants (A, B, C). Each variant has a different editorial approach:
{
  "A": {
    "label": "approach name (e.g. stat-heavy, narrative arc, quote-driven)",
    "slides": [
      { "heading": "slide heading", "body": "slide body text", "stat": "key stat or null", "emphasis": "what to visually emphasize" }
    ]
  },
  "B": { ... },
  "C": { ... }
}` }],
        }),
      });

      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Generation failed" }, { status: r.status });

      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const variants = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ variants, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse response", raw: rawText.slice(0, 300) }, { status: 500 });
      }
    }

    if (action === "caption") {
      // Generate captions for selected variant
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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
