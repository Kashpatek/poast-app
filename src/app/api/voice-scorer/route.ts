// Voice Scorer — paste any draft, get a 0-10 SA-brand-on-voice score
// and 3-5 specific rewrite suggestions. Pairs with the brand-linter UI
// at /poast → Voice Scorer tile.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const SYSTEM = `You are the SemiAnalysis brand voice grader. Score drafts on the SA voice rubric and return ONLY valid JSON.

SA voice rules (hard):
- No em dashes (use commas, periods, or colons instead)
- No emojis anywhere
- No hype/marketing words: revolutionary, unleashed, dive into, deep dive, game-changing, next-gen, unlock, seamless, transformative
- No rhetorical openers ("Why X matters", "Let's talk about", "Here's the thing")
- Direct, data-forward, specific
- Lead with facts or provocative questions, not throat-clearing
- Always cite a number, source, or technical detail if claimed
- Active voice
- Avoid filler adjectives (very, really, just, simply, actually)

SA voice rules (platform-specific):
- X / Twitter: NEVER hashtags
- TikTok: lowercase caption only, NEVER overlay text
- LinkedIn / Facebook: end with "Link in comments."
- Instagram: 5-8 relevant hashtags, "Save this for later" CTA

Score on this rubric (0-10 total):
- 3 pts — voice (no em dashes/emojis/hype words/rhetorical filler)
- 3 pts — specificity (real numbers, sources, technical details vs vague claims)
- 2 pts — directness (active voice, no throat-clearing, gets to the point)
- 2 pts — platform fit (follows platform-specific rules if specified)

Output JSON:
{
  "score": 0-10 integer,
  "breakdown": {
    "voice": 0-3,
    "specificity": 0-3,
    "directness": 0-2,
    "platformFit": 0-2
  },
  "violations": [
    "specific quoted phrase or pattern + why it breaks SA voice"
  ],
  "suggestions": [
    "concrete rewrite of the worst line, before -> after"
  ],
  "topLine": "1-sentence verdict, no fluff"
}`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { text?: string; platform?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  if (text.length > 8000) return NextResponse.json({ error: "Text too long — max 8000 chars" }, { status: 400 });

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
        max_tokens: 1200,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Score this draft. Platform context: ${platform}.\n\nDraft:\n${text}`,
          },
        ],
      }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j.error?.message || "Claude call failed" }, { status: res.status });
    const out: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = out.replace(/```[a-z]*|```/g, "").trim();
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
