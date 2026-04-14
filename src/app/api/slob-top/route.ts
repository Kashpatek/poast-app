import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { topic, platform, vibe, trendRef, host, assetSwapUrl } = body;

    const platformRules: Record<string, string> = {
      tiktok: "TikTok: all lowercase, 4-6 hashtags, on-screen text at 0s/3s/6s",
      igreels: "IG Reels: Save this for later CTA, 5-8 hashtags, location San Francisco CA",
      ytshorts: "YT Shorts: title under 40 characters",
      x: "X: hook tweet with no link, reply-to-self with link, NO hashtags ever",
      multi: "Multi-platform: generate captions for all platforms following each platform's rules",
    };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: "You are a content strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. Generate actionable content briefs. Rules: Never use em dashes. No emojis in content. Be direct, technical, not clickbait. RESPOND ONLY IN VALID JSON. No markdown fences.",
        messages: [{ role: "user", content: `Generate 3 content brief variations for a short-form video.

Topic: ${topic}
Platform: ${platform} -- ${platformRules[platform] || platformRules.multi}
Vibe: ${vibe}
${trendRef ? "Trend reference: " + trendRef : ""}
Host/Face: ${host || "B-roll only"}

Return JSON with 3 variations (A, B, C):
{
  "A": {
    "hook": "first 3 seconds script text",
    "core_message": "one sentence summary",
    "visual_structure": [{ "time": "0s", "shot": "description" }, { "time": "3s", "shot": "description" }],
    "onscreen_text": [{ "time": "0s", "text": "..." }, { "time": "3s", "text": "..." }, { "time": "6s", "text": "..." }],
    "audio": "audio recommendation",
    "captions": { "primary": "caption for selected platform" },
    "est_time": "estimated production time"
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
      const briefs = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      return NextResponse.json({ briefs, ts: Date.now() });
    } catch {
      return NextResponse.json({ error: "Failed to parse response", raw: rawText.slice(0, 300) }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
