import { NextRequest, NextResponse } from "next/server";

const CLAUDE_SYS = `You are a video production strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. You convert research articles into structured video production briefs.

Brand rules you must follow absolutely:
- Never use em dashes. Use commas or periods instead.
- No emojis anywhere.
- No hashtags on X/Twitter. Ever.
- Be direct and data-forward. No hype, no vague teaser language.
- Lead with hard facts or provocative questions, not marketing language.
- Always cite the specific SA data point or research finding.
- LinkedIn and Facebook: end post with "Link in comments."
- Instagram and TikTok: include 5-6 relevant hashtags.

You must respond ONLY with valid JSON. No markdown fences. No preamble. No explanation. Just the JSON object.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, url, text, format, duration, tone } = body;

    let articleText = text || "";

    // Step 1: If URL mode, fetch the page and extract text
    if (mode === "url" && url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const html = await pageRes.text();
        // Strip HTML tags, scripts, styles to get raw text
        articleText = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/&[^;]+;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000);

        if (articleText.length < 100) {
          return NextResponse.json({ error: "Could not extract meaningful text from URL. Try pasting the article text directly." }, { status: 400 });
        }
      } catch (e) {
        return NextResponse.json({ error: "Failed to fetch URL: " + String(e).slice(0, 100) }, { status: 400 });
      }
    }

    if (!articleText.trim()) {
      return NextResponse.json({ error: "No article text provided" }, { status: 400 });
    }

    // Step 2: Claude generates the full brief
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const userPrompt = `Convert this article into a video production brief.
Format: ${format || "Standard"} (${duration || "45-60"} seconds)
Tone: ${tone || "Data-driven"}
Aspect ratio: 16:9

Article:
${articleText.slice(0, 12000)}

Return this exact JSON structure:
{
  "hook": "string (under 12 words, hard fact or provocative question)",
  "logline": "string (one sentence, what the video proves)",
  "script": {
    "intro": "string (first 8 seconds of narration)",
    "body": ["array of 2-4 narration paragraphs"],
    "outro": "string (call to action, max 2 sentences, direct to semianalysis.com)"
  },
  "broll": [
    {
      "shot": 1,
      "timing": "0-5s",
      "description": "one sentence, what we see",
      "prompt": "detailed Kling/Veo generation prompt, cinematic style, 30-50 words, includes lighting + camera + subject",
      "camera": "camera movement"
    }
  ],
  "dataPoints": [
    {
      "value": "the stat",
      "label": "what it measures",
      "source": "SA report or data source"
    }
  ],
  "thumbnail": {
    "headline": "under 6 words",
    "subtext": "under 10 words",
    "concept": "visual description"
  },
  "social": {
    "x": {
      "hook": "hook tweet, no link, no hashtags, under 280 chars",
      "reply": "reply with link, no hashtags"
    },
    "linkedin": "professional, data-forward, ends with Link in comments.",
    "instagram": "caption + Save this for later. CTA + 5-8 hashtags + San Francisco CA",
    "tiktok": "all lowercase, 4-6 hashtags",
    "youtube": {
      "title": "under 60 chars",
      "description": "under 150 words"
    }
  },
  "duration": ${duration || 60},
  "format": "${format || "Standard"}",
  "aspectRatio": "16:9"
}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: CLAUDE_SYS,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) {
      return NextResponse.json({ error: "Claude error: " + (claudeData?.error?.message || "Generation failed") }, { status: claudeRes.status });
    }

    const rawText = (claudeData.content || []).map((c: { text?: string }) => c.text || "").join("");

    try {
      const brief = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      return NextResponse.json({ brief, articleText: articleText.slice(0, 500), ts: Date.now() });
    } catch {
      return NextResponse.json({ error: "Failed to parse Claude response as JSON", raw: rawText.slice(0, 500) }, { status: 500 });
    }
  } catch (error) {
    console.error("Press to Premier error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
