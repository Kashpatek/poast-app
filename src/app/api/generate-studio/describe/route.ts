import { NextRequest, NextResponse } from "next/server";

// Claude vision call that powers the Generate Studio asset library.
// Caller posts an image (data URL or remote URL) + the kind of asset
// they want it to become (character or scene). We come back with a
// suggested name, description, tags, and prompt-style recommendations
// the user can drop straight into a generation.

interface DescribeBody {
  imageDataUrl: string;
  kind: "character" | "scene";
  note?: string;
}

interface SourceFromDataUrl {
  type: "base64";
  media_type: string;
  data: string;
}

interface SourceFromUrl {
  type: "url";
  url: string;
}

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

function parseSource(input: string): SourceFromDataUrl | SourceFromUrl | null {
  const dataMatch = input.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    return { type: "base64", media_type: dataMatch[1], data: dataMatch[2] };
  }
  if (/^https?:\/\//.test(input)) {
    return { type: "url", url: input };
  }
  return null;
}

function characterPrompt(note?: string): string {
  return `You are helping a brand team catalog a CHARACTER asset for an AI image / video generation library at SemiAnalysis. Read the attached image and return a JSON object with:

- name: a memorable short label (2-4 words, title case, no quotes)
- description: 2-3 sentences capturing what makes this character visually distinct — physique, attire, facial structure, vibe, posture, age range, lighting style. Plain declarative voice. No em dashes.
- tags: 6-10 single-word or hyphenated descriptors useful for filtering ("studious", "executive", "warm-light", "outdoor", etc.). lowercase.
- recommendations: 4-5 short prompt fragments the user could paste into Runway / Veo / Imagen to recall this character in a new context. Each 1 sentence. They should reference the visual traits you listed, not be generic.

${note ? `User note about this asset: ${note}\n` : ""}
Return JSON only. No markdown fences.`;
}

function scenePrompt(note?: string): string {
  return `You are helping a brand team catalog a SCENE asset for an AI image / video generation library at SemiAnalysis. Read the attached image and return a JSON object with:

- name: a memorable short label (2-4 words, title case, no quotes)
- description: 2-3 sentences capturing the location, era, weather, lighting, color palette, mood. Plain declarative voice. No em dashes.
- tags: 6-10 single-word or hyphenated descriptors useful for filtering ("industrial", "cold-light", "datacenter", "rainy", etc.). lowercase.
- recommendations: 4-5 short prompt fragments the user could paste into Runway / Veo / Imagen to drop characters into this scene. Each 1 sentence. They should reference the specific environment traits, not generic phrasing.

${note ? `User note about this asset: ${note}\n` : ""}
Return JSON only. No markdown fences.`;
}

export async function POST(req: NextRequest) {
  let body: DescribeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const { imageDataUrl, kind, note } = body;
  if (!imageDataUrl) return NextResponse.json({ error: "imageDataUrl required" }, { status: 400 });
  if (kind !== "character" && kind !== "scene") {
    return NextResponse.json({ error: "kind must be 'character' or 'scene'" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const source = parseSource(imageDataUrl);
  if (!source) return NextResponse.json({ error: "Image must be a data URL or http(s) URL" }, { status: 400 });

  const prompt = kind === "character" ? characterPrompt(note) : scenePrompt(note);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: data?.error?.message || `Claude vision: ${r.statusText}` }, { status: r.status });
    }
    const text: string = (data.content || [])
      .map((c: { text?: string }) => c.text || "")
      .join("")
      .trim();
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "");
    let parsed: { name?: string; description?: string; tags?: string[]; recommendations?: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Claude returned non-JSON", raw: text.slice(0, 400) }, { status: 502 });
    }
    return NextResponse.json({
      name: parsed.name || "",
      description: parsed.description || "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      ts: Date.now(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
