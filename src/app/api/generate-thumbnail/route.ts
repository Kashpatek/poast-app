import { NextRequest, NextResponse } from "next/server";
import {
  generateGrokImages,
  GrokImageError,
  SA_BRAND_CUES,
  STYLE_PRESETS,
} from "@/lib/grok-image";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    concept?: string;
    style?: string;
    textOverlay?: string;
    mood?: string;
    title?: string;
    referenceImageUrl?: string;
    count?: number;
  };
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body", detail: String(err) }, { status: 400 });
  }

  const { concept, style, textOverlay, mood, title, referenceImageUrl, count } = body;
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

  const fullPrompt = [
    stylePrompt,
    concept,
    titleLine,
    moodLine,
    overlayLine,
    SA_BRAND_CUES,
    "16:9 composition, no watermarks, no captions baked into the image.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const images = await generateGrokImages({
      prompt: fullPrompt,
      count: typeof count === "number" && count > 0 && count <= 4 ? count : 3,
      referenceImageUrl,
    });
    if (!images.length) {
      return NextResponse.json({ error: "No images generated" }, { status: 502 });
    }
    return NextResponse.json({ images, ts: Date.now() });
  } catch (err) {
    if (err instanceof GrokImageError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
