// OpenCut · Chapters generator
//
// Identifies 5-10 topic shifts in a transcript and returns chapter
// markers OpenCut (or any timeline editor) can drop directly on the
// timeline. Output shape matches the OpenCut hand-off contract:
//   { chapters: Array<{ timestamp: 'm:ss', title, secondsIntoEpisode }> }
//
// `secondsIntoEpisode` lets the editor drop the marker at the exact
// frame without re-parsing the m:ss string.

import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, LLMError, type LLMProvider } from "@/lib/llm-provider";

export const maxDuration = 60;

const SYSTEM = `You are picking chapter markers for a multi-track video editor.

Goal: identify 5-10 topic shifts in a transcript and return chapter markers the user can drop on the editor timeline.

Rules:
- First chapter MUST start at 0:00 (secondsIntoEpisode = 0).
- Timestamps strictly ascending.
- Titles ≤ 50 chars, terse and descriptive. No emojis, no hashtags, no em dashes, no marketing language.
- "timestamp" is the m:ss (or h:mm:ss) display string.
- "secondsIntoEpisode" is the integer number of seconds the chapter begins at.

Return ONLY valid JSON. No markdown fences.

Schema:
{
  "chapters": [
    { "secondsIntoEpisode": 0, "timestamp": "0:00", "title": "Intro and context" }
  ]
}`;

interface ChaptersReq {
  transcript?: string;
  durationSec?: number;
  provider?: LLMProvider;
}

interface ChapterOut {
  timestamp: string;
  title: string;
  secondsIntoEpisode: number;
}

function resolveProvider(raw: unknown): LLMProvider {
  if (raw === "gemini" || raw === "grok" || raw === "claude") return raw;
  return "claude";
}

function clampTitle(s: string): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > 50 ? t.slice(0, 50).trimEnd() : t;
}

function secToTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function parseTimestampToSeconds(raw: string): number {
  const s = (raw || "").trim();
  const m3 = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (m3) {
    return (
      parseInt(m3[1], 10) * 3600 +
      parseInt(m3[2], 10) * 60 +
      parseInt(m3[3], 10)
    );
  }
  const m2 = s.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m2) return parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  return 0;
}

export async function POST(req: NextRequest) {
  let body: ChaptersReq;
  try { body = (await req.json()) as ChaptersReq; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const transcript = (body.transcript || "").trim();
  if (!transcript) return NextResponse.json({ error: "Missing transcript" }, { status: 400 });

  const durationSec = typeof body.durationSec === "number" && body.durationSec > 0 ? body.durationSec : undefined;
  const provider = resolveProvider(body.provider);

  const durationHint = durationSec
    ? `Total episode duration: ${secToTimestamp(durationSec)}. Anchor chapter starts inside this window.`
    : "Total duration unknown — estimate from transcript pacing (~150 words per minute spoken).";

  const userPrompt =
    durationHint + "\n\n" +
    "Transcript:\n" +
    transcript.slice(0, 60000) +
    "\n\nReturn ONLY the JSON object.";

  try {
    const r = await callLLM({
      provider,
      system: SYSTEM,
      prompt: userPrompt,
      maxTokens: 1800,
    });
    const raw = llmTextOf(r).replace(/```[a-z]*|```/g, "").trim();
    let parsed: { chapters?: Array<{ timestamp?: string; title?: string; secondsIntoEpisode?: number; startSec?: number }> };
    try { parsed = JSON.parse(raw); }
    catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw: raw.slice(0, 500) },
        { status: 502 },
      );
    }

    const list = Array.isArray(parsed.chapters) ? parsed.chapters : [];
    const chapters: ChapterOut[] = list
      .filter((c) => c && typeof c.title === "string")
      .map((c) => {
        // Trust secondsIntoEpisode if present; otherwise fall back to
        // startSec (legacy field) or parse from timestamp string.
        let sec = 0;
        if (typeof c.secondsIntoEpisode === "number") {
          sec = Math.max(0, Math.floor(c.secondsIntoEpisode));
        } else if (typeof c.startSec === "number") {
          sec = Math.max(0, Math.floor(c.startSec));
        } else if (typeof c.timestamp === "string") {
          sec = parseTimestampToSeconds(c.timestamp);
        }
        return {
          timestamp: secToTimestamp(sec),
          title: clampTitle(c.title || ""),
          secondsIntoEpisode: sec,
        };
      })
      .filter((c) => c.title.length > 0);

    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "Model returned no chapters", raw: raw.slice(0, 500) },
        { status: 502 },
      );
    }

    // Force first chapter to 0:00 regardless of model drift.
    chapters[0] = { ...chapters[0], secondsIntoEpisode: 0, timestamp: "0:00" };

    return NextResponse.json({ chapters, provider: r.provider });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
