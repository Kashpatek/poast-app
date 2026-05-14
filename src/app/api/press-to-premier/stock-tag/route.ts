// Auto-tagger for Stock Library uploads. Sends an image URL to Claude
// with vision and gets back a topic / mood / aspect classification.
// Used by /p2p-tiles/stock-library.tsx during batch upload.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const SYSTEM = `You categorize stock footage frames for SemiAnalysis. Look at the image and return a JSON object with:
- category: one of [AI, Semiconductors, Data Centers, Networking, Memory, Cloud, Energy, Packaging, Software, Other]
- tags: 3-6 short topical tags
- description: one sentence describing what's in the frame
- mood: one of [technical, industrial, cinematic, abstract, editorial, dataviz]
- suggestedAspect: one of [16:9, 9:16, 1:1] based on composition

Output ONLY the JSON object. No preamble.`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const body = await req.json();
    const imageUrl: string | undefined = body.imageUrl;
    const filename: string | undefined = body.filename;
    if (!imageUrl) return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "url", url: imageUrl },
              },
              {
                type: "text",
                text: `Filename: ${filename || "unknown"}. Classify and return JSON.`,
              },
            ],
          },
        ],
      }),
    });

    const j = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: j.error?.message || "Vision call failed" }, { status: res.status });
    }
    const text: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = text.replace(/```[a-z]*|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ category: "Other", tags: [], description: filename || "", mood: "editorial", suggestedAspect: "16:9", raw: cleaned.slice(0, 400) });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
