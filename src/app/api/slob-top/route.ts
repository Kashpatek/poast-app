import { NextRequest, NextResponse } from "next/server";

function stripHtml(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();

    // ═══ LINK-TO-SLOP ACTION ═══
    if (body.action === "link-to-slop") {
      const { url } = body;
      if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

      // 1. Fetch the URL content
      let pageText = "";
      try {
        const pageRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SlopBot/1.0)",
            "Accept": "text/html,application/xhtml+xml,text/plain,*/*",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!pageRes.ok) {
          return NextResponse.json({ error: "Failed to fetch URL: HTTP " + pageRes.status }, { status: 400 });
        }
        const rawHtml = await pageRes.text();
        // 2. Extract text (strip HTML)
        pageText = stripHtml(rawHtml);
      } catch (fetchErr) {
        return NextResponse.json({ error: "Failed to fetch URL: " + String(fetchErr) }, { status: 400 });
      }

      // Truncate to ~8000 chars to avoid token limits
      if (pageText.length > 8000) {
        pageText = pageText.slice(0, 8000) + "... [truncated]";
      }

      // 3. Send to Claude with slop generation prompt
      const slopRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: "You are a viral content creator for SemiAnalysis. Given this article/page content, generate slop content ideas. Be funny, punchy, technically accurate but accessible. Think TikTok/Twitter energy. Never use em dashes. RESPOND ONLY IN VALID JSON. No markdown fences.",
          messages: [{ role: "user", content: `Here is the content from a URL the user pasted:

---
${pageText}
---

Generate viral slop content ideas based on this. Return JSON in this exact format:
{
  "meme_captions": [
    "Short punchy meme caption 1 (semi-industry humor)",
    "Short punchy meme caption 2",
    "Short punchy meme caption 3"
  ],
  "video_hooks": [
    "First 3 seconds script for a video hook 1",
    "First 3 seconds script for a video hook 2"
  ],
  "thread_idea": [
    "Post 1 of thread (the hook tweet)",
    "Post 2 of thread",
    "Post 3 of thread",
    "Post 4 of thread (the conclusion/CTA)"
  ],
  "image_prompt": "A detailed image generation prompt for Grok that captures the essence of this content in a meme-worthy or visually striking way"
}` }],
        }),
      });

      const slopData = await slopRes.json();
      if (!slopRes.ok) return NextResponse.json({ error: slopData?.error?.message || "Slop generation failed" }, { status: slopRes.status });

      const slopRawText = (slopData.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const results = JSON.parse(slopRawText.replace(/```json|```/g, "").trim());
        return NextResponse.json({ results, ts: Date.now() });
      } catch {
        return NextResponse.json({ error: "Failed to parse slop response", raw: slopRawText.slice(0, 300) }, { status: 500 });
      }
    }

    // ═══ ORIGINAL BRIEF GENERATION ═══
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
