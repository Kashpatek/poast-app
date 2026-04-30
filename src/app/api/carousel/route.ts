import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateWithClaude, generateJSON, AnthropicError } from "@/lib/anthropic";
import { stripHTML, extractImages } from "@/lib/html";
import { checkRateLimit } from "@/lib/ratelimit";

// SA Carousel Schema v1.0
const TEMPLATE_IDS: Record<string, string> = {
  COVER: "sa_research_cover_v1",
  BODY_A: "sa_research_body_dark_v1",
  BODY_B: "sa_research_body_light_v1",
  BODY_IMAGE: "sa_research_body_image_v1",
  BODY_LARGE_IMAGE: "sa_research_body_large_image_v1",
};

const CAROUSEL_SYS = `You are a content strategist for SemiAnalysis, creating Instagram carousel content from research articles. You produce structured carousel slide objects following the SA Carousel Schema v1.0.

Slide types:
- COVER: title (5-8 words, bold claim, no end punctuation), subtitle (3-4 sentences, 50-70 words, fills the space below the title and image on a 1080x1350 slide. Should give meaningful context about why this matters), image_url (if provided)
- BODY_A: body_text (2-3 short paragraphs separated by double newlines, 80-120 words total, dark background. Each paragraph is 2-3 sentences. Never use bullets.)
- BODY_B: body_text (2-3 short paragraphs separated by double newlines, 80-120 words total, light background. Each paragraph is 2-3 sentences. Never use bullets.)
- BODY_FINAL: body_text (2-3 short paragraphs separated by double newlines, 80-120 words total, ends with forward-looking statement, no arrow. Never use bullets.)
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

const THEMES_MAP: Record<string, string> = {
  general: "General (industry news, trends, analysis)",
  internal: "Internal (SA original research)",
  external: "External (third-party content with SA commentary)",
  capital: "Capital (financial and investment analysis)",
};

const CarouselSchema = z.object({
  action: z.enum(["generate", "fetchImages", "caption", "rewrite"]),
  text: z.string().optional(),
  url: z.string().optional(),
  category: z.string().optional(),
  mode: z.string().optional(),
  pageCount: z.number().optional(),
  imageUrls: z.array(z.string()).optional(),
}).passthrough();

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
    const parsed = CarouselSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { action, text, url, category, mode, pageCount, imageUrls } = body;

    if (action === "fetchImages") {
      // Scrape images from article URL, then use Claude to pick relevant ones
      const { url: fetchUrl } = body;
      if (!fetchUrl) return NextResponse.json({ images: [] });
      try {
        const pageRes = await fetch(fetchUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SemiAnalysis/1.0)" } });
        const html = await pageRes.text();

        // Extract article text for context
        const textOnly = stripHTML(html).slice(0, 3000);

        // Extract candidate images
        const candidates = extractImages(html, fetchUrl, 20);

        if (candidates.length === 0) return NextResponse.json({ images: [], ts: Date.now() });

        // Also need alt text for Claude to pick images — re-extract with alt info
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?[^>]*>/gi;
        const candidatesWithAlt: { src: string; alt: string }[] = [];
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const src = match[1];
          const alt = match[2] || "";
          if (candidates.includes(src) || candidates.some(c => c.endsWith(src.split("/").pop() || ""))) {
            candidatesWithAlt.push({ src, alt });
          }
        }
        // Fall back to candidates without alt if regex didn't match well
        const finalCandidates = candidatesWithAlt.length > 0
          ? candidatesWithAlt
          : candidates.map(src => ({ src, alt: "" }));

        // Use Claude to pick which images are relevant content images
        try {
          const indices = await generateJSON<number[]>({
            system: "You select relevant article images for a carousel. Return ONLY a JSON array of indices (0-based) of images that are actual content images (charts, graphs, photos, diagrams, product shots) relevant to the article. Exclude: navigation images, ads, author photos, social sharing buttons, thumbnails under 200px, decorative borders, header/footer images. Pick at most 5 of the best, most visually interesting content images. Return format: [0, 3, 7]",
            maxTokens: 500,
            prompt: `Article summary: ${textOnly.slice(0, 1000)}\n\nCandidate images:\n${finalCandidates.map((c, i) => `${i}: ${c.src.slice(-80)} (alt: "${c.alt}")`).join("\n")}\n\nWhich indices are relevant content images? Return JSON array only.`,
          });
          const picked = indices.filter(i => i >= 0 && i < finalCandidates.length).map(i => finalCandidates[i].src);
          return NextResponse.json({ images: picked, ts: Date.now() });
        } catch {
          // Fallback: return first 4 candidates
          return NextResponse.json({ images: candidates.slice(0, 4), ts: Date.now() });
        }
      } catch {
        return NextResponse.json({ images: [] });
      }
    }

    if (action === "generate") {
      const hasImages = imageUrls && imageUrls.length > 0;
      const manualCount = mode === "manual" ? (pageCount || 4) : null;
      const imageNote = imageUrls && imageUrls.length > 0
        ? `Available images (${imageUrls.length} total):\n${imageUrls.map((u: string, i: number) => `${i}: ${u.slice(-80)}`).join("\n")}\n\nIMPORTANT IMAGE RULES:\n- Use the BEST image for the COVER slide (image_url field). Pick the most visually compelling one.\n- Only use BODY_IMAGE or BODY_LARGE_IMAGE slides if an image is a chart, graph, or diagram that directly supports the text on THAT specific slide.\n- Do NOT put images on every slide. Most body slides should be text-only (BODY_A / BODY_B).\n- A typical 5-slide carousel with images: COVER (with image), BODY_A (text), BODY_B (text), BODY_IMAGE (with relevant chart/data if available), BODY_FINAL (text).\n- Never use more than 2-3 images total across all slides.`
        : "No images provided. Omit image_url fields. Do not include BODY_IMAGE or BODY_LARGE_IMAGE slides. All body slides should be BODY_A or BODY_B (text only).";

      const slideCountGuidance = manualCount === 1
        ? `The user has requested exactly 1 slide. Output a SINGLE COVER slide that lands the entire thesis on its own — strong title, supporting subtitle, no body slides, no closer. The cover MUST stand alone and make the user want to swipe. Use type "COVER".`
        : manualCount === 2
        ? `The user has requested exactly 2 slides. Output COVER + BODY_FINAL only (no body slides). The cover sets up the hook; the closer drives home the takeaway with a clear CTA. Make every word land. Skip exposition.`
        : manualCount
        ? `The user has requested exactly ${manualCount} slides per variant. Respect this count. Build a cover, ${Math.max(0, manualCount - 2)} body slide(s), and a closer.`
        : `Analyze the content and determine the best slide count for EACH variant independently. Consider:
- How much substantive content is there? A single insight = 1-2 slides. A standard story = 3-5. Deep research = 5-7.
- How many key data points, statistics, or claims deserve their own slide?
- How many available images exist? (${hasImages ? imageUrls.length + " images" : "none"}) More images can justify more slides.
- What slide count best serves THIS specific content?
Don't pad with filler. Every slide must earn its place. Bias TOWARD 5 (a complete narrative) UNLESS the content genuinely demands fewer or more. Range: 1-7 slides. Do not default to 3 — 3 often feels thin.`;

      try {
        const variants = await generateJSON<Record<string, { slides: { type: string }[] }>>({
          system: CAROUSEL_SYS,
          maxTokens: 6000,
          prompt: `Analyze this article and produce 3 STRUCTURALLY DIFFERENT carousel variants (A, B, C).

Category: ${category || "general"}
${imageNote}

Article:
${(text || "").slice(0, 10000)}
${url ? "\nSource URL: " + url : ""}

SLIDE COUNT GUIDANCE:
${slideCountGuidance}

CRITICAL: Each variant must have a DIFFERENT structure, not just different words on the same template.

Variant A: "Concise" approach
- Tight, punchy. Cover + minimal body slides + closer.
- Every word earns its place. Ideal for quick-scroll audiences.
${hasImages ? "- Use 1 image on cover only." : ""}

Variant B: "Deep Dive" approach
- More detailed narrative with multiple sections.
- Break the story into distinct chapters/angles across slides.
${hasImages ? "- Use cover image + 1-2 BODY_IMAGE slides where charts/data directly support the point being made on that slide. Pick the most relevant images." : ""}

Variant C: "${hasImages ? "Visual Story" : "Key Takeaways"}" approach
- ${hasImages ? "Image-heavy. Use BODY_IMAGE and BODY_LARGE_IMAGE slides to let data/charts do the talking. Less text per slide, more visual impact. Every image slide must have image_url set." : "Each body slide covers ONE specific point or takeaway, not a narrative. Shorter text per slide (50-70 words), more slides. Like a listicle format but without numbers or bullets. Each slide is a standalone insight."}

Return JSON:
{
  "A": {
    "label": "concise label for this approach",
    "topic": "1-sentence summary",
    "slides": [
      { "type": "COVER", "title": "5-8 word title", "subtitle": "3-4 sentences, 50-70 words" },
      { "type": "BODY_A", "body_text": "2-3 paragraphs separated by \\n\\n, 80-120 words" },
      { "type": "BODY_FINAL", "body_text": "2-3 paragraphs, 80-120 words, forward-looking" }
    ]
  },
  "B": {
    "label": "...", "topic": "...",
    "slides": [COVER, then mix of BODY_A, BODY_B${hasImages ? ", BODY_IMAGE, BODY_LARGE_IMAGE" : ""}, ending with BODY_FINAL]
  },
  "C": { ... }
}

Rules:
- COVER always first, BODY_FINAL always last
- Body text slides alternate BODY_A (dark bg) then BODY_B (light bg)
- BODY_IMAGE: include "image_url" field with the exact URL from available images + "body_text" (30-50 words)
- BODY_LARGE_IMAGE: include "image_url" + "subtext" (10-20 words caption)
- BODY_FINAL uses whichever background (A or B) comes next in alternation
- No em dashes. No bullets. No emojis. Paragraphs separated by \\n\\n.
- Each variant MUST have a DIFFERENT number of slides`,
        });

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
      } catch (e) {
        if ((e as AnthropicError).status) {
          return NextResponse.json({ error: (e as Error).message || "Generation failed" }, { status: (e as AnthropicError).status });
        }
        if (e instanceof SyntaxError) {
          return NextResponse.json({ error: "Failed to parse response", raw: String(e).slice(0, 300) }, { status: 500 });
        }
        throw e;
      }
    }

    if (action === "caption") {
      const { slides: captionSlides, sourceUrl, variantLabel, theme: captionTheme, extraContext } = body;
      const slideContent = (captionSlides || []).map((sl: { type?: string; title?: string; subtitle?: string; body_text?: string; subtext?: string; image_url?: string }, i: number) => {
        const typeLabel = sl.type === "COVER" ? "COVER" : sl.type === "BODY_IMAGE" ? "IMAGE+TEXT" : sl.type === "BODY_LARGE_IMAGE" ? "LARGE IMAGE" : sl.type === "BODY_FINAL" ? "CLOSER" : "BODY";
        let content = (i + 1) + ". [" + typeLabel + "]";
        if (sl.title) content += " Title: " + sl.title;
        if (sl.subtitle) content += " | Subtitle: " + sl.subtitle;
        if (sl.body_text) content += " " + sl.body_text;
        if (sl.subtext) content += " | Caption: " + sl.subtext;
        if (sl.image_url) content += " | Image: " + sl.image_url.slice(-60);
        return content;
      }).join("\n");

      const themeInfo = captionTheme ? (THEMES_MAP[captionTheme] || captionTheme) : "general";

      try {
        const parsed = await generateJSON({
          system: CAROUSEL_SYS,
          maxTokens: 2000,
          prompt: `Generate 3 caption OPTIONS for this carousel. Each option should take a different angle on presenting this content.

Source: ${sourceUrl || "N/A"}
Category: ${themeInfo}
Variant approach: ${variantLabel || "N/A"}
${extraContext ? "Extra context from user: " + extraContext + "\n" : ""}
Slide content:
${slideContent}

Return a JSON array of 3 options. Each option has captions for Instagram, TikTok, and YT Shorts:
[
  {
    "label": "Hook-driven",
    "instagram": { "caption": "full caption with Save CTA + 5-8 hashtags + Location: San Francisco, CA. Under 2200 chars.", "hashtags": ["tag1", "tag2"] },
    "tiktok": { "caption": "all lowercase, casual, hook first line. NO hashtags. NO overlay text." },
    "shorts": { "title": "under 40 chars" }
  },
  { "label": "Data-forward", ... },
  { "label": "Narrative", ... }
]

HARD RULES (absolute):
- X/Twitter (if requested anywhere): NEVER hashtags
- TikTok: NEVER overlay text / on-screen text. NEVER hashtags. Caption only.

Style rules:
- No em dashes, no emojis
- Confident, technical, institutional tone
- Each option should feel genuinely different, not just rewording
- IG: save CTA, hashtags at end, San Francisco CA location
- TikTok: all lowercase, casual, NO hashtags, NO overlay text
- YT Shorts: title only, under 40 chars`,
        });
        return NextResponse.json({ captionOptions: parsed, ts: Date.now() });
      } catch (e) {
        if (e instanceof SyntaxError) {
          return NextResponse.json({ error: "Failed to parse caption" }, { status: 500 });
        }
        throw e;
      }
    }

    if (action === "rewrite") {
      const { text: rewriteText, direction, targetLength } = body;
      if (!rewriteText) return NextResponse.json({ error: "No text provided" }, { status: 400 });

      // Wave C2 · regenerate-title path: returns a fresh punchy cover title
      // (max 8 words) for the same idea. Uses a tighter system prompt so
      // it doesn't bleed into subtitle territory.
      if (direction === "regenerate-title") {
        const titleText = await generateWithClaude({
          system: "You write SemiAnalysis carousel cover titles. Output ONLY the new title — no quotes, no preamble, no trailing punctuation. SA institutional, confident, technical tone. No em dashes, no emojis. Max 8 words. Punchy and concrete.",
          maxTokens: 60,
          prompt: `Rewrite this carousel cover title with a fresh angle, keeping the same core thesis. The new title should land harder than the original.\n\nOriginal: ${rewriteText}`,
        });
        return NextResponse.json({ text: titleText.trim().replace(/^["']|["']$/g, ""), ts: Date.now() });
      }

      const dirPrompt = targetLength
        ? `Rewrite this subtitle to be exactly ${targetLength}. This must fit below a title on a 1080x1350 carousel slide. SA institutional, confident, technical tone. No em dashes, no emojis.`
        : direction === "shorten"
        ? "Make this subtitle shorter. Maximum 1 sentence, under 15 words. Keep the SA institutional tone. No em dashes."
        : "Expand this subtitle to 3-4 sentences, 50-70 words total. SA institutional, confident, technical tone. No em dashes, no emojis.";

      const rawText = await generateWithClaude({
        system: "You rewrite text for SemiAnalysis carousel subtitles. Respond with ONLY the rewritten text, no quotes, no preamble.",
        maxTokens: 300,
        prompt: `${dirPrompt}\n\nOriginal: ${rewriteText}`,
      });
      return NextResponse.json({ text: rawText.trim(), ts: Date.now() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "ANTHROPIC_API_KEY not configured") {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
