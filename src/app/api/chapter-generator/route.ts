// Chapter Generator — paste a podcast transcript, get YouTube chapter
// markers back (timestamp + title). The model identifies 6-10 topic
// shifts and writes terse, factual headers.

import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError, type LLMProvider } from "@/lib/llm-provider";

export const maxDuration = 60;

const SYSTEM = `You are formatting a podcast transcript into YouTube chapter markers. Identify 6-10 topic shifts. Return JSON: { chapters: Array<{ timestamp: 'm:ss', title: string }> }. Titles ≤ 50 chars, no marketing fluff, factual descriptive headers.

Rules:
- First chapter MUST start at 0:00.
- Timestamps strictly ascending, format m:ss (or mm:ss / h:mm:ss when needed).
- No emojis, no hashtags, no em dashes.
- Title style: terse, descriptive, no clickbait. Examples: "Intro and context", "TSMC N2 yields", "HBM4 supply outlook".
- Return ONLY valid JSON, no markdown fences, no commentary.`;

interface ChapterReq {
  text?: string;
  durationSec?: number;
  provider?: LLMProvider;
}

interface ChapterOut {
  timestamp: string;
  title: string;
}

function clampTitle(s: string): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > 50 ? t.slice(0, 50).trimEnd() : t;
}

function normalizeTimestamp(s: string): string {
  const raw = (s || "").trim();
  // Accept m:ss, mm:ss, or h:mm:ss. Pad seconds to 2 digits.
  const m = raw.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  const m2 = raw.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m2) {
    const mm = parseInt(m2[1], 10);
    const ss = parseInt(m2[2], 10);
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }
  return "0:00";
}

export async function POST(req: NextRequest) {
  let body: ChapterReq;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Missing transcript text" }, { status: 400 });

  const durationSec = typeof body.durationSec === "number" && body.durationSec > 0 ? body.durationSec : undefined;
  const provider: LLMProvider = body.provider || "claude";

  const durationHint = durationSec
    ? `Total episode duration: ${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}. Anchor chapter timestamps inside this window.`
    : "Total duration unknown — estimate chapter offsets from the transcript pacing (roughly 150 words per minute spoken).";

  const userPrompt =
    durationHint + "\n\n" +
    "Transcript:\n" +
    text.slice(0, 60000) +
    "\n\nReturn ONLY the JSON object.";

  try {
    const r = await callLLM({
      provider,
      system: SYSTEM,
      prompt: userPrompt,
      maxTokens: 1600,
    });
    const raw = (r.content || []).map((c) => c.text || "").join("");
    const cleaned = raw.replace(/```[a-z]*|```/g, "").trim();
    let parsed: { chapters?: ChapterOut[] };
    try { parsed = JSON.parse(cleaned); }
    catch { return NextResponse.json({ error: "Model returned non-JSON", raw: cleaned.slice(0, 500) }, { status: 502 }); }
    const list = Array.isArray(parsed.chapters) ? parsed.chapters : [];
    const chapters: ChapterOut[] = list
      .filter((c) => c && typeof c.timestamp === "string" && typeof c.title === "string")
      .map((c) => ({ timestamp: normalizeTimestamp(c.timestamp), title: clampTitle(c.title) }))
      .filter((c) => c.title.length > 0);
    if (chapters.length === 0) {
      return NextResponse.json({ error: "Model returned no chapters", raw: cleaned.slice(0, 500) }, { status: 502 });
    }
    // YouTube requires the first marker at 0:00; force it if the model
    // shifted by a second.
    chapters[0] = { ...chapters[0], timestamp: "0:00" };
    return NextResponse.json({ chapters, provider: r.provider });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
