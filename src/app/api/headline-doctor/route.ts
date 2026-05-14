// Headline Doctor — paste a working headline, get 10 alternates ranked
// by hook strength. SA voice rules baked in.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const SYSTEM = `You are a headline doctor for SemiAnalysis. Take a draft headline and produce 10 alternates ranked by hook strength.

Hard rules (apply to every alternate):
- No em dashes
- No emojis
- No hashtags
- No hype words: revolutionary, unleashed, dive into, deep dive, game-changing, next-gen, unlock, seamless, transformative, ultimate
- No rhetorical openers: "Why X matters", "Here's why", "Let's talk"
- Direct, data-forward, technical-but-accessible
- Use real numbers / specifics when the source headline implies them

For each alternate provide:
- text: the headline (max 90 chars unless source is long-form)
- score: 1-10 estimated hook strength
- pattern: one of [Number-led, Provocative claim, Question, Comparison, Specific finding, Reframe, Contrarian]
- whyItWorks: one short sentence

Return ONLY valid JSON. Order by score descending.

{
  "alternates": [
    { "text": "…", "score": 9, "pattern": "Number-led", "whyItWorks": "…" }
  ],
  "diagnosis": "1-sentence read on what was weak about the original"
}`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { headline?: string; context?: string; platform?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const headline = (body.headline || "").trim();
  if (!headline) return NextResponse.json({ error: "Missing headline" }, { status: 400 });

  const context = (body.context || "").trim();
  const platform = body.platform || "any";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1600,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content:
              "Original headline: " + headline + "\n" +
              "Platform: " + platform + "\n" +
              (context ? "Article context (use for specificity):\n" + context.slice(0, 5000) + "\n" : "") +
              "\nProduce 10 ranked alternates.",
          },
        ],
      }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j.error?.message || "Claude call failed" }, { status: res.status });
    const txt: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = txt.replace(/```[a-z]*|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON", raw: cleaned.slice(0, 500) }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
