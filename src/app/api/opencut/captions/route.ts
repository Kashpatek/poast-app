// OpenCut hand-off: caption track generator.
// Splits a transcript into ~3-4 word phrases with VTT-style timing so
// OpenCut (or any editor that consumes word-level / phrase-level JSON
// captions) can import a burned-in subtitle track.
//
// Pure logic — no LLM call. Timing strategy:
//   1. If the transcript already has [m:ss] or [h:mm:ss] anchors, those
//      seed the timeline and the words between anchors are spread
//      linearly across that window.
//   2. Otherwise we estimate from a 150-WPM speaking rate (0.4 s per
//      word) which lines up with the rate used elsewhere in PRODUCE
//      (chapter-generator prompt, filler-segments timing).

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

interface CaptionStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: "bottom" | "top" | "middle";
}

interface CaptionReq {
  transcript?: string;
  style?: CaptionStyle;
}

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface Caption {
  start: number;
  end: number;
  text: string;
  words?: CaptionWord[];
}

const WORDS_PER_PHRASE_MIN = 3;
const WORDS_PER_PHRASE_MAX = 4;
const SECONDS_PER_WORD = 0.4; // 150 WPM fallback

// Parse [m:ss] / [mm:ss] / [h:mm:ss] anchors into seconds.
function parseTimestamp(raw: string): number | null {
  const m3 = raw.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (m3) {
    const h = parseInt(m3[1], 10);
    const mm = parseInt(m3[2], 10);
    const ss = parseInt(m3[3], 10);
    return h * 3600 + mm * 60 + ss;
  }
  const m2 = raw.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m2) {
    const mm = parseInt(m2[1], 10);
    const ss = parseInt(m2[2], 10);
    return mm * 60 + ss;
  }
  return null;
}

// Split transcript into tokens. Each token has either a wall-clock
// anchor (seconds) or null, plus optional sentence-end signal.
interface Token {
  word: string;
  anchorSec: number | null;
  endsSentence: boolean;
}

function tokenize(transcript: string): Token[] {
  const tokens: Token[] = [];
  // Pull [timestamp] anchors out and treat them as zero-width markers
  // attached to the next word.
  const parts = transcript.split(/(\[\d{1,2}(?::\d{1,2}){1,2}\])/g);
  let pendingAnchor: number | null = null;
  for (const part of parts) {
    if (!part) continue;
    const tsMatch = part.match(/^\[(\d{1,2}(?::\d{1,2}){1,2})\]$/);
    if (tsMatch) {
      const sec = parseTimestamp(tsMatch[1]);
      if (sec !== null) pendingAnchor = sec;
      continue;
    }
    // Split into words, preserving sentence-end punctuation as a flag
    // on the previous token.
    const wordMatches = part.match(/[^\s]+/g) || [];
    for (const w of wordMatches) {
      const cleaned = w.replace(/^[\s]+|[\s]+$/g, "");
      if (!cleaned) continue;
      const endsSentence = /[.!?]$/.test(cleaned);
      tokens.push({
        word: cleaned,
        anchorSec: pendingAnchor,
        endsSentence,
      });
      pendingAnchor = null;
    }
  }
  return tokens;
}

// Assign each token an absolute (start, end) in seconds. Anchored
// tokens lock to their stamped offset; runs between anchors are spread
// linearly. Trailing un-anchored runs extend at SECONDS_PER_WORD.
function assignWordTimings(tokens: Token[]): CaptionWord[] {
  if (tokens.length === 0) return [];
  const words: CaptionWord[] = tokens.map((t) => ({
    word: t.word,
    start: 0,
    end: 0,
  }));
  // Collect anchor positions; ensure a virtual anchor at index 0 = 0s
  // if none, so we have a baseline.
  const anchors: Array<{ idx: number; sec: number }> = [];
  tokens.forEach((t, i) => {
    if (t.anchorSec !== null) anchors.push({ idx: i, sec: t.anchorSec });
  });
  if (anchors.length === 0 || anchors[0].idx !== 0) {
    anchors.unshift({ idx: 0, sec: 0 });
  }

  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a];
    const next = anchors[a + 1];
    if (next) {
      const span = next.idx - start.idx;
      const dur = next.sec - start.sec;
      const per = span > 0 ? dur / span : SECONDS_PER_WORD;
      for (let i = 0; i < span; i++) {
        const t0 = start.sec + per * i;
        const t1 = start.sec + per * (i + 1);
        words[start.idx + i] = {
          word: tokens[start.idx + i].word,
          start: t0,
          end: t1,
        };
      }
    } else {
      // Trailing run after the last anchor: fixed pace.
      const tailLen = tokens.length - start.idx;
      for (let i = 0; i < tailLen; i++) {
        const t0 = start.sec + SECONDS_PER_WORD * i;
        const t1 = start.sec + SECONDS_PER_WORD * (i + 1);
        words[start.idx + i] = {
          word: tokens[start.idx + i].word,
          start: t0,
          end: t1,
        };
      }
    }
  }
  return words;
}

// Group word objects into ~3-4 word phrases, breaking at sentence ends
// when we're inside the 3-4 window.
function groupPhrases(
  words: CaptionWord[],
  tokens: Token[]
): Caption[] {
  const out: Caption[] = [];
  let i = 0;
  while (i < words.length) {
    let take = WORDS_PER_PHRASE_MAX;
    // Prefer sentence-aware break: if a sentence ends within the
    // [min, max] window, cut there.
    for (let j = WORDS_PER_PHRASE_MIN - 1; j < WORDS_PER_PHRASE_MAX; j++) {
      const idx = i + j;
      if (idx >= tokens.length) break;
      if (tokens[idx].endsSentence) {
        take = j + 1;
        break;
      }
    }
    const slice = words.slice(i, i + take);
    if (slice.length === 0) break;
    const phrase: Caption = {
      start: slice[0].start,
      end: slice[slice.length - 1].end,
      text: slice.map((w) => w.word).join(" "),
      words: slice,
    };
    out.push(phrase);
    i += slice.length;
  }
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function POST(req: NextRequest) {
  let body: CaptionReq;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const transcript = (body.transcript || "").trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "Missing transcript" },
      { status: 400 }
    );
  }

  const tokens = tokenize(transcript);
  if (tokens.length === 0) {
    return NextResponse.json(
      { error: "Transcript has no parseable words" },
      { status: 400 }
    );
  }
  const words = assignWordTimings(tokens);
  const phrases = groupPhrases(words, tokens);

  // Round timings to ms precision so the JSON is human-readable.
  const captions: Caption[] = phrases.map((p) => ({
    start: round3(p.start),
    end: round3(p.end),
    text: p.text,
    words: p.words?.map((w) => ({
      word: w.word,
      start: round3(w.start),
      end: round3(w.end),
    })),
  }));

  return NextResponse.json({
    captions,
    style: body.style || null,
  });
}
