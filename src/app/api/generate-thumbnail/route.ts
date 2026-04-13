import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { concept, style, engine } = body;

  const styleMap: Record<string, string> = {
    cinematic: "Cinematic still frame, dramatic film lighting, deep blacks, sharp focus, photorealistic",
    photorealistic: "Ultra-realistic photograph, studio lighting, professional tech media",
    abstract: "Abstract data visualization, flowing particle systems, neon accents on dark background",
    dataviz: "Clean data visualization infographic, dark background, amber and teal accents, sharp typography",
  };

  const stylePrompt = styleMap[style] || styleMap.cinematic;
  const fullPrompt = `${stylePrompt}. ${concept}. Professional tech media aesthetic, 16:9 composition, no text overlays, no watermarks.`;

  // Try Grok first (more reliable), fall back to Gemini Imagen
  const useGrok = engine === "grok" || !process.env.GEMINI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (useGrok && xaiKey) {
    try {
      const images: string[] = [];
      // Generate 3 images with Grok
      for (let i = 0; i < 3; i++) {
        const r = await fetch("https://api.x.ai/v1/images/generations", {
          method: "POST",
          headers: { "Authorization": "Bearer " + xaiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "grok-imagine-image", prompt: fullPrompt + (i > 0 ? " variation " + (i + 1) : ""), n: 1 }),
        });
        const data = await r.json();
        if (data.data && data.data[0]) {
          images.push(data.data[0].url || ("data:image/png;base64," + data.data[0].b64_json));
        }
      }
      if (images.length > 0) return NextResponse.json({ images, engine: "grok", ts: Date.now() });
    } catch { /* fall through to Gemini */ }
  }

  // Gemini Imagen 3
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: fullPrompt }],
            parameters: { sampleCount: 3, aspectRatio: "16:9", safetyFilterLevel: "block_few" },
          }),
        }
      );
      const data = await r.json();
      if (data.error) return NextResponse.json({ error: "Imagen: " + data.error.message }, { status: 500 });
      const images = (data.predictions || []).map((p: { bytesBase64Encoded: string }) => "data:image/png;base64," + p.bytesBase64Encoded);
      return NextResponse.json({ images, engine: "gemini", ts: Date.now() });
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "No image generation API configured (need XAI_API_KEY or GEMINI_API_KEY)" }, { status: 500 });
}
