import { NextRequest, NextResponse } from "next/server";

// SA Carousel Schema v1.0 -- Template IDs map to Canva TEMPLATES folder
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { action, text, url, category, mode, pageCount, imageUrls } = body;

    if (action === "fetchImages") {
      // Scrape images from article URL, then use Claude to pick relevant ones
      const { url: fetchUrl } = body;
      if (!fetchUrl) return NextResponse.json({ images: [] });
      try {
        const pageRes = await fetch(fetchUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SemiAnalysis/1.0)" } });
        const html = await pageRes.text();

        // Extract article text for context
        const textOnly = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);

        // Extract img tags with src AND alt/context
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?[^>]*>/gi;
        const candidates: { src: string; alt: string }[] = [];
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          let src = match[1];
          const alt = match[2] || "";
          // Skip junk: data URIs, SVGs, tiny markers, UI elements
          if (src.startsWith("data:") || src.endsWith(".svg") || src.endsWith(".gif")) continue;
          if (/favicon|logo|icon|avatar|emoji|badge|button|arrow|spinner|loading|pixel|tracking|1x1|spacer/i.test(src)) continue;
          // Skip tiny dimension hints
          const widthMatch = src.match(/[?&]w=(\d+)/) || html.slice(Math.max(0, match.index - 200), match.index + match[0].length + 200).match(/width[=:]["'\s]*(\d+)/i);
          if (widthMatch && parseInt(widthMatch[1]) < 100) continue;
          // Make absolute
          if (src.startsWith("//")) src = "https:" + src;
          else if (src.startsWith("/")) { try { const u = new URL(fetchUrl); src = u.origin + src; } catch {} }
          if (src.startsWith("http") && !candidates.some(c => c.src === src)) {
            candidates.push({ src, alt });
          }
          if (candidates.length >= 20) break;
        }

        if (candidates.length === 0) return NextResponse.json({ images: [], ts: Date.now() });

        // Use Claude to pick which images are relevant content images
        const pickRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            system: "You select relevant article images for a carousel. Return ONLY a JSON array of indices (0-based) of images that are actual content images (charts, graphs, photos, diagrams, product shots) relevant to the article. Exclude: navigation images, ads, author photos, social sharing buttons, thumbnails under 200px, decorative borders, header/footer images. Pick at most 5 of the best, most visually interesting content images. Return format: [0, 3, 7]",
            messages: [{ role: "user", content: `Article summary: ${textOnly.slice(0, 1000)}\n\nCandidate images:\n${candidates.map((c, i) => `${i}: ${c.src.slice(-80)} (alt: "${c.alt}")`).join("\n")}\n\nWhich indices are relevant content images? Return JSON array only.` }],
          }),
        });
        const pickData = await pickRes.json();
        const pickText = (pickData.content || []).map((c: { text?: string }) => c.text || "").join("").trim();
        try {
          const indices: number[] = JSON.parse(pickText.replace(/```json|```/g, "").trim());
          const picked = indices.filter(i => i >= 0 && i < candidates.length).map(i => candidates[i].src);
          return NextResponse.json({ images: picked, ts: Date.now() });
        } catch {
          // Fallback: return first 4 candidates
          return NextResponse.json({ images: candidates.slice(0, 4).map(c => c.src), ts: Date.now() });
        }
      } catch {
        return NextResponse.json({ images: [] });
      }
    }

    if (action === "generate") {
      const hasImages = imageUrls && imageUrls.length > 0;
      const slideCount = mode === "manual" ? (pageCount || 4) : (hasImages ? "4-6 (include image slides only where charts/data support the narrative)" : "4-5 (text-only, tight and focused)");
      const imageNote = imageUrls && imageUrls.length > 0
        ? `Available images (${imageUrls.length} total):\n${imageUrls.map((u: string, i: number) => `${i}: ${u.slice(-80)}`).join("\n")}\n\nIMPORTANT IMAGE RULES:\n- Use the BEST image for the COVER slide (image_url field). Pick the most visually compelling one.\n- Only use BODY_IMAGE or BODY_LARGE_IMAGE slides if an image is a chart, graph, or diagram that directly supports the text on THAT specific slide.\n- Do NOT put images on every slide. Most body slides should be text-only (BODY_A / BODY_B).\n- A typical 5-slide carousel with images: COVER (with image), BODY_A (text), BODY_B (text), BODY_IMAGE (with relevant chart/data if available), BODY_FINAL (text).\n- Never use more than 2-3 images total across all slides.`
        : "No images provided. Omit image_url fields. Do not include BODY_IMAGE or BODY_LARGE_IMAGE slides. All body slides should be BODY_A or BODY_B (text only).";

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6000,
          system: CAROUSEL_SYS,
          messages: [{ role: "user", content: `Analyze this article and produce 3 STRUCTURALLY DIFFERENT carousel variants (A, B, C).

Category: ${category || "general"}
${imageNote}

Article:
${(text || "").slice(0, 10000)}
${url ? "\nSource URL: " + url : ""}

CRITICAL: Each variant must have a DIFFERENT structure, not just different words on the same template.

Variant A: "Concise" approach
- 3-4 slides total. Tight, punchy. Cover + 1-2 body slides + closer.
- Every word earns its place. Ideal for quick-scroll audiences.
${hasImages ? "- Use 1 image on cover only." : ""}

Variant B: "Deep Dive" approach
- 5-7 slides. More detailed narrative with multiple sections.
- Break the story into distinct chapters/angles across slides.
${hasImages ? "- Use cover image + 1-2 BODY_IMAGE slides where charts/data directly support the point being made on that slide. Pick the most relevant images." : ""}

Variant C: "Visual Story" approach
- 4-6 slides. ${hasImages ? "Image-heavy. Use BODY_IMAGE and BODY_LARGE_IMAGE slides to let data/charts do the talking. Less text per slide, more visual impact." : "Mix of text-heavy and text-light slides. Some slides with shorter, punchier text. Vary the density."}

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
- Each variant MUST have a DIFFERENT number of slides` }],
        }),
      });

      const data = await r.json();
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Generation failed" }, { status: r.status });

      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
      try {
        const variants = JSON.parse(rawText.replace(/```json|```/g, "").trim());

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
      } catch {
        return NextResponse.json({ error: "Failed to parse response", raw: rawText.slice(0, 300) }, { status: 500 });
      }
    }

    if (action === "caption") {
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
- Confident, technical, institutional tone

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

    if (action === "rewrite") {
      const { text: rewriteText, direction } = body;
      if (!rewriteText) return NextResponse.json({ error: "No text provided" }, { status: 400 });
      const dirPrompt = direction === "shorten"
        ? "Make this subtitle shorter. Maximum 1 sentence, under 15 words. Keep the SA institutional tone. No em dashes."
        : "Expand this subtitle to 3-4 sentences, 50-70 words total. Fill the space below the title on a carousel slide. Add meaningful context about why this matters, key numbers, or stakes. SA institutional, confident, technical tone. No em dashes, no emojis.";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: "You rewrite text for SemiAnalysis carousel subtitles. Respond with ONLY the rewritten text, no quotes, no preamble.",
          messages: [{ role: "user", content: `${dirPrompt}\n\nOriginal: ${rewriteText}` }],
        }),
      });
      const data = await r.json();
      const rawText = (data.content || []).map((c: { text?: string }) => c.text || "").join("").trim();
      return NextResponse.json({ text: rawText, ts: Date.now() });
    }

    if (action === "render") {
      // Build Canva autofill payload from slides array
      const { slides, carouselId, topic, sourceUrl } = body;
      const canvaPayload = {
        carousel_id: carouselId || "carousel_" + Date.now(),
        topic: topic || "",
        source_article: sourceUrl || "",
        generated_by: "Claude (claude-sonnet-4-20250514)",
        slides: (slides || []).map((s: Record<string, string>) => {
          const obj: Record<string, string> = { type: s.type, template_id: s.template_id || TEMPLATE_IDS[s.type] || "" };
          if (s.title) obj.title = s.title;
          if (s.subtitle) obj.subtitle = s.subtitle;
          if (s.body_text) obj.body_text = s.body_text;
          if (s.subtext) obj.subtext = s.subtext;
          if (s.image_url) obj.image_url = s.image_url;
          return obj;
        }),
      };
      return NextResponse.json({ canvaPayload, ts: Date.now() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
