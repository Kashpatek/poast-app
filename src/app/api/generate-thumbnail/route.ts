import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const { concept, style } = body;

    const styleMap: Record<string, string> = {
      cinematic: "Cinematic still frame, dramatic film lighting, deep blacks, sharp focus, photorealistic",
      photorealistic: "Ultra-realistic photograph, studio lighting, professional tech media",
      abstract: "Abstract data visualization, flowing particle systems, neon accents on dark background",
      dataviz: "Clean data visualization infographic, dark background, amber and teal accents, sharp typography",
    };

    const stylePrompt = styleMap[style] || styleMap.cinematic;
    const fullPrompt = `${stylePrompt}. ${concept}. Professional tech media aesthetic, 16:9 composition, no text overlays, no watermarks.`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: fullPrompt }],
          parameters: {
            sampleCount: 3,
            aspectRatio: "16:9",
            safetyFilterLevel: "block_few",
          },
        }),
      }
    );

    const data = await r.json();

    if (data.error) {
      return NextResponse.json({ error: "Imagen error: " + (data.error.message || "Generation failed") }, { status: 500 });
    }

    // Extract base64 images
    const images = (data.predictions || []).map((p: { bytesBase64Encoded: string }) => {
      return "data:image/png;base64," + p.bytesBase64Encoded;
    });

    return NextResponse.json({ images, ts: Date.now() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
