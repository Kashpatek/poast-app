import { NextRequest, NextResponse } from "next/server";
import {
  generateGrokImages,
  GrokImageError,
  SA_BRAND_CUES,
  STYLE_PRESETS,
} from "@/lib/grok-image";
import { generateImagenImages, ImagenError } from "@/lib/imagen";

export const maxDuration = 60;

type AspectRatio = "16:9" | "1:1" | "9:16" | "4:3" | "3:4";

export async function POST(req: NextRequest) {
  let body: {
    concept?: string;
    style?: string;
    textOverlay?: string;
    mood?: string;
    title?: string;
    referenceImageUrl?: string;
    count?: number;
    provider?: "imagen" | "grok";
    aspectRatio?: AspectRatio;
    negativePrompt?: string;
  };
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body", detail: String(err) }, { status: 400 });
  }

  const { concept, style, textOverlay, mood, title, referenceImageUrl, count, provider: requestedProvider, aspectRatio: requestedAspect, negativePrompt } = body;
  if (!concept || typeof concept !== "string") {
    return NextResponse.json({ error: "Missing concept" }, { status: 400 });
  }

  const stylePrompt = (style && STYLE_PRESETS[style]) || STYLE_PRESETS.cinematic;
  const moodLine = mood ? ` Mood: ${mood}.` : "";
  const titleLine = title ? ` For a podcast episode titled: "${title}".` : "";
  // The text-overlay description goes into the prompt as a layout hint
  // (don't render the text — leave room for it). The actual letterforms
  // are added later in a separate compositor step if needed.
  const overlayLine = textOverlay
    ? ` Reserve a clear region with strong negative space where headline text could be placed (do not render text in the image): "${textOverlay}".`
    : " No text overlays in the image.";

  // Aspect ratio default = 16:9 (YouTube thumbnail). Imagen accepts it
  // natively; Grok ignores the parameter but the composition hint gets
  // baked into the prompt so it leans the right direction.
  const validAspects: AspectRatio[] = ["16:9", "1:1", "9:16", "4:3", "3:4"];
  const aspectRatio: AspectRatio = requestedAspect && validAspects.includes(requestedAspect)
    ? requestedAspect
    : "16:9";
  const aspectHint = aspectRatio === "1:1"
    ? "Square 1:1 composition"
    : aspectRatio === "9:16"
    ? "Vertical 9:16 composition for Shorts / Reels / TikTok"
    : aspectRatio === "4:3"
    ? "4:3 composition"
    : aspectRatio === "3:4"
    ? "3:4 portrait composition"
    : "16:9 widescreen composition";

  const negativeLine = negativePrompt && negativePrompt.trim()
    ? ` Avoid: ${negativePrompt.trim()}.`
    : "";

  const fullPrompt = [
    stylePrompt,
    concept,
    titleLine,
    moodLine,
    overlayLine,
    SA_BRAND_CUES,
    `${aspectHint}, no watermarks, no captions baked into the image.`,
    negativeLine,
  ]
    .filter(Boolean)
    .join(" ");

  const sampleCount = typeof count === "number" && count > 0 && count <= 4 ? count : 3;
  const provider = requestedProvider === "grok" ? "grok" : "imagen";

  try {
    if (provider === "imagen") {
      try {
        const images = await generateImagenImages({ prompt: fullPrompt, count: sampleCount, aspectRatio, referenceImageUrl });
        if (images.length) return NextResponse.json({ images, provider: "imagen", aspectRatio, ts: Date.now() });
      } catch (e) {
        // Silent fall-back to Grok on Imagen policy refusals (4xx).
        if (e instanceof ImagenError && e.status >= 400 && e.status < 500) {
          const images = await generateGrokImages({ prompt: fullPrompt, count: sampleCount, referenceImageUrl });
          if (!images.length) return NextResponse.json({ error: "No images generated", provider: "grok" }, { status: 502 });
          return NextResponse.json({ images, provider: "grok", fellBackTo: "grok", imagenError: e.message, aspectRatio, ts: Date.now() });
        }
        throw e;
      }
      // Imagen returned empty without throwing — try Grok.
      const images = await generateGrokImages({ prompt: fullPrompt, count: sampleCount, referenceImageUrl });
      if (!images.length) return NextResponse.json({ error: "No images generated", provider: "grok" }, { status: 502 });
      return NextResponse.json({ images, provider: "grok", fellBackTo: "grok", aspectRatio, ts: Date.now() });
    }
    const images = await generateGrokImages({ prompt: fullPrompt, count: sampleCount, referenceImageUrl });
    if (!images.length) return NextResponse.json({ error: "No images generated", provider: "grok" }, { status: 502 });
    return NextResponse.json({ images, provider: "grok", aspectRatio, ts: Date.now() });
  } catch (err) {
    if (err instanceof GrokImageError) {
      return NextResponse.json({ error: err.message, provider }, { status: err.status });
    }
    if (err instanceof ImagenError) {
      return NextResponse.json({ error: err.message, provider }, { status: err.status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
