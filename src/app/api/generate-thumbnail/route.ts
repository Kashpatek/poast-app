import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 });

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

  try {
    const images: string[] = [];
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
    if (images.length > 0) return NextResponse.json({ images, ts: Date.now() });
    return NextResponse.json({ error: "No images generated" }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
