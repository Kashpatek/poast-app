// Chapter Generator — paste a podcast transcript, get YouTube chapter
// markers back (timestamp + title). The model identifies 6-10 topic
// shifts and writes terse, factual headers.

import { NextRequest, NextResponse } from "next/server";
import { callLLM, LLMError, type LLMProvider } from "@/lib/llm-provider";

export const maxDuration = 60;

const SYSTEM = `You are formatting a podcast transcript into YouTube chapter markers. Identify 6-10 topic shifts. Return JSON: { chapters: Array<{ timestamp: 'm:ss', title: string }> }. Titles ≤ 50 chars, no marketing fluff, factual descriptive headers.

Rules:
- First chapter MUST start at 0:00.
- If the transcript already contains timestamps (for example speaker turns like "Name (12:34)" or leading "12:34"), ANCHOR every chapter to the real timestamps in the text. Do not estimate from word count when real timestamps are present.
- Spread the chapters across the ENTIRE episode, from 0:00 through to the final timestamp. Never bunch all chapters into the opening minutes; the last chapters should be near the end of the transcript.
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

function tsToSec(t: string): number {
  const p = t.split(":").map((n) => parseInt(n, 10));
  if (p.some((n) => isNaN(n))) return -1;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return -1;
}
// The largest timestamp already embedded in the transcript (speaker turns like
// "Name (12:34)" or bare "1:02:03"). This is the real episode span; we use it to
// tell the model to distribute chapters across the whole thing.
function lastTimestamp(text: string): { label: string; sec: number } | null {
  const found = text.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) || [];
  let best: { label: string; sec: number } | null = null;
  for (const f of found) { const s = tsToSec(f); if (s >= 0 && (!best || s > best.sec)) best = { label: f, sec: s }; }
  return best;
}
function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
// Every real timestamp in the transcript, ascending + de-duped. Used to snap the
// model's (rounded) chapter marks onto actual speaker-turn times.
function allTimestampSecs(text: string): number[] {
  const found = text.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) || [];
  const set = new Set<number>();
  for (const f of found) { const s = tsToSec(f); if (s >= 0) set.add(s); }
  return [...set].sort((a, b) => a - b);
}
function nearest(secs: number[], target: number): number {
  let best = secs[0], bd = Infinity;
  for (const s of secs) { const d = Math.abs(s - target); if (d < bd) { bd = d; best = s; } }
  return best;
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

  // Prefer a user-supplied duration; otherwise fall back to the last real
  // timestamp in the transcript so chapters span the full episode. Only when
  // neither exists do we let the model estimate from pacing.
  const embedded = lastTimestamp(text);
  let durationHint: string;
  if (durationSec) {
    durationHint = `Total episode duration: ${fmtSec(durationSec)}. Distribute the chapters across this full window from 0:00 to the end, not just the opening.`;
  } else if (embedded && embedded.sec >= 120) {
    durationHint = `The transcript is annotated with REAL timestamps (e.g. speaker turns like "Name (${embedded.label})"). Use those actual timestamps to place chapters. The final timestamp is ${embedded.label}, so the episode runs to roughly there: spread the 6-10 chapters across the ENTIRE run from 0:00 to about ${embedded.label}, with the last chapter near the end.`;
  } else {
    durationHint = "Total duration unknown and no timestamps found in the transcript: estimate chapter offsets from pacing (roughly 150 words per minute spoken).";
  }

  // 200k chars comfortably covers a 2-hour episode and fits the model context;
  // the old 60k cap silently dropped the back half of longer transcripts.
  const MAX = 200000;
  const clipped = text.length > MAX ? text.slice(0, MAX) : text;

  const userPrompt =
    durationHint + "\n\n" +
    "Transcript:\n" +
    clipped +
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
    // The transcript's own timestamps. With >=2 present we snap each chapter to
    // the nearest one so markers land on a real speaker turn, not the model's
    // rounding. First marker is always forced to 0:00 (YouTube requires it).
    const realSecs = allTimestampSecs(text);
    const snapping = realSecs.length >= 2;
    const built = list
      .filter((c) => c && typeof c.timestamp === "string" && typeof c.title === "string")
      .map((c, i) => {
        const title = clampTitle(c.title);
        let sec = tsToSec(normalizeTimestamp(c.timestamp));
        if (sec < 0) sec = 0;
        if (i === 0) sec = 0;
        else if (snapping) sec = nearest(realSecs, sec);
        return { sec, title };
      })
      .filter((c) => c.title.length > 0);
    // Strictly ascending + unique; a snap that collides with the previous mark
    // is bumped to the next real timestamp after it (dropped if none remains).
    const chapters: ChapterOut[] = [];
    let prev = -1;
    for (const c of built) {
      let sec = c.sec;
      if (sec <= prev) {
        if (snapping) { const nxt = realSecs.find((s) => s > prev); if (nxt === undefined) continue; sec = nxt; }
        else sec = prev + 1;
      }
      chapters.push({ timestamp: fmtSec(sec), title: c.title });
      prev = sec;
    }
    if (chapters.length === 0) {
      return NextResponse.json({ error: "Model returned no chapters", raw: cleaned.slice(0, 500) }, { status: 502 });
    }
    chapters[0] = { ...chapters[0], timestamp: "0:00" };
    return NextResponse.json({ chapters, provider: r.provider });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
