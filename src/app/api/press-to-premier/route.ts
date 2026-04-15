import { NextRequest, NextResponse } from "next/server";
import { generateJSON, AnthropicError } from "@/lib/anthropic";
import { stripHTML } from "@/lib/html";

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
        // Additional stripping for nav/footer/header specific to this route
        const preprocessed = html
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "");
        articleText = stripHTML(preprocessed).slice(0, 15000);

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

    try {
      const brief = await generateJSON({
        system: CLAUDE_SYS,
        maxTokens: 4000,
        prompt: userPrompt,
      });
      return NextResponse.json({ brief, articleText: articleText.slice(0, 500), ts: Date.now() });
    } catch (e) {
      if ((e as AnthropicError).status) {
        return NextResponse.json({ error: "Claude error: " + ((e as Error).message || "Generation failed") }, { status: (e as AnthropicError).status });
      }
      if (e instanceof SyntaxError) {
        return NextResponse.json({ error: "Failed to parse Claude response as JSON", raw: String(e).slice(0, 500) }, { status: 500 });
      }
      throw e;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "ANTHROPIC_API_KEY not configured") {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }
    console.error("Press to Premier error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
