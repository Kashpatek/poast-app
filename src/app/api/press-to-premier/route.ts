import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateJSON, AnthropicError } from "@/lib/anthropic";
import { stripHTML } from "@/lib/html";
import { safeFetch } from "@/lib/safe-fetch";
import { checkRateLimit } from "@/lib/ratelimit";
import { log } from "@/lib/logger";

const PressToPermierSchema = z.object({
  mode: z.enum(["url", "text"]).optional(),
  url: z.string().optional(),
  text: z.string().optional(),
  format: z.string().optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  tone: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
}).passthrough();

// Aspect-aware production guidance baked into the Claude prompt so script
// pacing, b-roll composition, and caption length match the target platform.
const ASPECT_GUIDANCE: Record<string, string> = {
  "16:9": `LANDSCAPE 16:9 — cinematic editorial pace. 4-6 b-roll shots with longer hold times (8-12s each). Hook can run up to 12 words. Captions can be one full sentence per cue. Compose b-roll with wide framing, subject can be off-center, leave room in lower third for graphics/lower-thirds. Think YouTube long-form, LinkedIn video.`,
  "9:16": `VERTICAL 9:16 — short-form social pace. 6-9 quick b-roll cuts (4-7s each). Hook MUST be ≤7 punchy words. Each caption cue ≤6 words. Compose b-roll with subject in UPPER-CENTER, leave the lower third clear for captions (they live there). NEVER use horizontal data tables — stack data vertically. Think TikTok, Reels, Shorts.`,
  "1:1": `SQUARE 1:1 — feed-native pace. 4-7 b-roll shots medium hold (6-9s). Hook ≤10 words. Captions ≤8 words per cue. Compose b-roll with balanced central subjects, no extreme letterboxing required. Think IG feed posts, LinkedIn square video.`,
};

function aspectGuidance(aspectRatio?: string): string {
  return ASPECT_GUIDANCE[aspectRatio || "16:9"] || ASPECT_GUIDANCE["16:9"];
}

function aspectBrollSuffix(aspectRatio?: string): string {
  if (aspectRatio === "9:16") {
    return " VERTICAL 9:16 composition, portrait framing, subject in upper-center, leave the lower third deliberately uncluttered so captions can sit there. No wide horizontal sweeps. Tight on the subject.";
  }
  if (aspectRatio === "1:1") {
    return " SQUARE 1:1 composition, balanced central subject, no extreme letterboxing, equal weight top and bottom.";
  }
  return " Cinematic 16:9 composition, wider framing, subject can be off-center, leave space in the lower third for graphic overlays.";
}

const CLAUDE_SYS = `You are a video production strategist for SemiAnalysis, a semiconductor and AI infrastructure research firm. You convert research articles into structured video production briefs.

Brand rules you must follow absolutely:
- Never use em dashes. Use commas or periods instead.
- No emojis anywhere.
- HARD RULE: X/Twitter NEVER hashtags. Not one. Ever.
- HARD RULE: TikTok NEVER overlay text or on-screen text. Caption only.
- Be direct and data-forward. No hype, no vague teaser language.
- Lead with hard facts or provocative questions, not marketing language.
- Always cite the specific SA data point or research finding.
- LinkedIn and Facebook: end post with "Link in comments."
- Instagram: include 5-6 relevant hashtags.
- TikTok: lowercase caption only, NO hashtags, NO overlay text.

You must respond ONLY with valid JSON. No markdown fences. No preamble. No explanation. Just the JSON object.`;

export async function POST(req: NextRequest) {
  try {
    const { allowed, remaining } = await checkRateLimit(req);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining ?? 0) } }
      );
    }

    const body = await req.json();
    const parsed = PressToPermierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { mode, url, text, format, duration, tone, aspectRatio } = body;
    const aspect = (aspectRatio || "16:9") as "16:9" | "9:16" | "1:1";

    let articleText = text || "";

    // Step 1: If URL mode, fetch the page and extract text
    if (mode === "url" && url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const pageRes = await safeFetch(url, {
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
Aspect ratio: ${aspect}

ASPECT-SPECIFIC PRODUCTION RULES (you MUST follow these):
${aspectGuidance(aspect)}

When you write each b-roll "prompt", APPEND this composition directive verbatim to the end:
"${aspectBrollSuffix(aspect).trim()}"

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
    "tiktok": "all lowercase caption only, NO hashtags, NO overlay text, NO on-screen text",
    "youtube": {
      "title": "under 60 chars",
      "description": "under 150 words"
    }
  },
  "duration": ${duration || 60},
  "format": "${format || "Standard"}",
  "aspectRatio": "${aspect}"
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
    log.error("press-to-premier error", { error: String(error) });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
