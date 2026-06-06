// OpenCut · B-Roll suggestions
//
// Scans a transcript and proposes ~8 timestamps where overlay B-Roll
// footage would land cleanly. Each suggestion carries a topic label
// and 3-6 stock-footage search keywords the user can paste into
// Pexels / Storyblocks / Artgrid.
//
// Output shape matches the OpenCut hand-off contract:
//   { suggestions: Array<{ timestamp, secondsIntoEpisode, topic, keywords[] }> }

import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, LLMError, type LLMProvider } from "@/lib/llm-provider";

export const maxDuration = 60;

const SYSTEM = `You are suggesting B-Roll cues for a podcast / interview video editor (OpenCut).

Goal: scan the transcript and propose roughly 8 timestamped B-Roll suggestions. Each suggestion is a moment where overlay footage would land cleanly — a named entity (chip, company, place), a number/chart-worthy stat, or a vivid concrete noun. Avoid abstract or meta moments.

Rules:
- Aim for ~8 suggestions. Strictly ascending by time. No overlaps.
- "timestamp" is the m:ss (or h:mm:ss) display string.
- "secondsIntoEpisode" is an integer (seconds).
- "topic" is a 2-4 word label describing the moment (e.g. "TSMC fab", "HBM4 supply").
- "keywords" is a 3-6 element array of stock-footage search terms (e.g. ["TSMC", "fab cleanroom", "wafer", "semiconductor"]).
- If timing is unknowable (plain transcript with no anchors), estimate from word position at ~150 words per minute spoken.

Return ONLY valid JSON. No markdown fences.

Schema:
{
  "suggestions": [
    {
      "timestamp": "0:38",
      "secondsIntoEpisode": 38,
      "topic": "TSMC fab",
      "keywords": ["TSMC", "fab cleanroom", "wafer", "semiconductor"]
    }
  ]
}`;

interface BRollReq {
  transcript?: string;
  provider?: LLMProvider;
}

interface BRollSuggestion {
  timestamp: string;
  secondsIntoEpisode: number;
  topic: string;
  keywords: string[];
}

function resolveProvider(raw: unknown): LLMProvider {
  if (raw === "gemini" || raw === "grok" || raw === "claude") return raw;
  return "claude";
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
  let body: BRollReq;
  try {
    body = (await req.json()) as BRollReq;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcript = (body.transcript || "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }
  if (transcript.length > 60000) {
    return NextResponse.json(
      { error: "Transcript too long — max 60000 chars" },
      { status: 400 }
    );
  }

  const provider = resolveProvider(body.provider);

  try {
    const r = await callLLM({
      provider,
      system: SYSTEM,
      prompt: `Suggest ~8 B-Roll cues for this transcript. Return ONLY the JSON object specified.\n\nTranscript:\n${transcript}`,
      maxTokens: 3000,
    });
    const raw = llmTextOf(r).replace(/```[a-z]*|```/g, "").trim();
    let parsed: {
      suggestions?: Array<{
        timestamp?: string;
        secondsIntoEpisode?: number;
        topic?: string;
        keywords?: unknown;
      }>;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw: raw.slice(0, 500) },
        { status: 502 }
      );
    }

    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const suggestions: BRollSuggestion[] = list
      .filter((s) => s && typeof s.topic === "string")
      .map((s) => {
        let sec = 0;
        if (typeof s.secondsIntoEpisode === "number") {
          sec = Math.max(0, Math.floor(s.secondsIntoEpisode));
        } else if (typeof s.timestamp === "string") {
          sec = parseTimestampToSeconds(s.timestamp);
        }
        const keywords = Array.isArray(s.keywords)
          ? (s.keywords as unknown[])
              .filter((k): k is string => typeof k === "string")
              .map((k) => k.trim())
              .filter((k) => k.length > 0)
          : [];
        return {
          timestamp: secToTimestamp(sec),
          secondsIntoEpisode: sec,
          topic: (s.topic || "").trim(),
          keywords,
        };
      })
      .filter((s) => s.topic.length > 0 && s.keywords.length > 0);

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: "Model returned no B-Roll suggestions", raw: raw.slice(0, 500) },
        { status: 502 }
      );
    }

    // Sort ascending by time so the timeline import is clean.
    suggestions.sort((a, b) => a.secondsIntoEpisode - b.secondsIntoEpisode);

    return NextResponse.json({ suggestions, provider: r.provider });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json(
        { error: e.message, provider: e.provider },
        { status: e.status }
      );
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
