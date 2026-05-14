// Distribution Pack orchestrator — feed one article (URL or text), get
// back a full multi-platform pack: SA Weekly script, LinkedIn article,
// X thread, IG carousel outline, quote card, IG / TikTok caption.
//
// One Claude call returns the entire JSON. Each section follows the
// platform-specific SA voice rules.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

const SYSTEM = `You are SemiAnalysis's senior content strategist. From one article, produce a complete multi-platform distribution pack at once. Output ONLY valid JSON, no preamble.

Hard SA brand rules across EVERY section:
- No em dashes (use commas or periods)
- No emojis
- No hype words: revolutionary, unleashed, dive into, deep dive, game-changing, next-gen, unlock, seamless, transformative, ultimate
- No rhetorical openers: "Why X matters", "Here's why"
- Direct, data-forward. Always cite a real number or source when claimed.
- Active voice. No filler adjectives.

Platform-specific rules:
- X / Twitter: NEVER hashtags. Hooks ≤ 280 chars. Threads up to 7 tweets.
- LinkedIn: longer-form. End with "Link in comments."
- Instagram: Save this for later. CTA + 5-8 hashtags + San Francisco CA.
- TikTok: lowercase caption only, NEVER hashtags, NEVER overlay text.
- YouTube: title ≤ 60 chars, description ≤ 150 words.
- Newsletter: ≤ 400 words plus a TL;DR.

Return this exact JSON shape:
{
  "summary": {
    "hook": "1-sentence punchy hook usable anywhere, ≤ 12 words",
    "keyClaim": "the single most important data point or finding",
    "audienceTakeaway": "1-sentence so what / why care"
  },
  "saWeekly": {
    "title": "Ep. XX - Title (Category), under 100 chars",
    "description": "2 paragraph YouTube description",
    "talkingPoints": ["3-5 bullet points the host should cover"]
  },
  "linkedinArticle": {
    "headline": "headline",
    "subhead": "1-sentence dek",
    "body": "3-4 paragraphs, ends with Link in comments."
  },
  "xThread": [
    "tweet 1 hook",
    "tweet 2",
    "tweet 3",
    "tweet 4",
    "tweet 5 (CTA, link goes in reply)"
  ],
  "linkedinPost": "short LinkedIn feed post, ends with Link in comments.",
  "igCarousel": {
    "slides": [
      { "headline": "cover slide", "body": "" },
      { "headline": "slide 2", "body": "1-2 short lines" },
      { "headline": "slide 3", "body": "" },
      { "headline": "slide 4", "body": "" },
      { "headline": "slide 5", "body": "CTA — link in bio" }
    ],
    "caption": "IG feed caption with 5-8 hashtags + San Francisco CA"
  },
  "igStory": "Single story frame copy, ≤ 12 words",
  "tiktok": "lowercase caption only, no hashtags, no overlay text",
  "quoteCard": {
    "quote": "the single most pull-out-able quote from the article",
    "attribution": "Author or analyst",
    "source": "Article title or short ref"
  },
  "newsletter": {
    "tldr": "2-sentence TL;DR",
    "body": "3-4 paragraph body"
  }
}`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { url?: string; text?: string; title?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  let articleText = (body.text || "").trim();
  if (!articleText && body.url) {
    try {
      const r = await fetch(body.url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await r.text();
      articleText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 14000)
        .trim();
    } catch {
      return NextResponse.json({ error: "Couldn't fetch URL. Paste the article text instead." }, { status: 400 });
    }
  }

  if (!articleText || articleText.length < 200) {
    return NextResponse.json({ error: "Article too short or missing — paste the full text." }, { status: 400 });
  }

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
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            (body.title ? "Article title: " + body.title + "\n\n" : "") +
            "Article:\n" + articleText.slice(0, 12000) + "\n\n" +
            "Produce the full distribution pack now.",
        }],
      }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j.error?.message || "Claude call failed" }, { status: res.status });
    const txt: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = txt.replace(/```[a-z]*|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({ pack: parsed, articleText: articleText.slice(0, 500), ts: Date.now() });
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON", raw: cleaned.slice(0, 800) }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
