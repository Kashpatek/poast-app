// OpenCut · Filler-segments detector
//
// Surfaces filler tokens (um / uh / like / you know / kind of / sort
// of / actually / basically) as ripple-delete candidates the editor
// can strip from the timeline.
//
// Naïve but deterministic: regex over the transcript, estimate timing
// from word index at 150 WPM (0.4s/word). When the transcript carries
// [m:ss] / [h:mm:ss] anchors we re-anchor the local word index to the
// most recent anchor so offsets stay accurate across long transcripts.
//
// Pure logic — no LLM call — so this stays fast and free for the
// ripple-delete hand-off into OpenCut.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

interface FillerReq {
  transcript?: string;
}

interface FillerSegment {
  start: number;
  end: number;
  word: string;
  reason: string;
}

const SECONDS_PER_WORD = 0.4; // 150 WPM

// Phrase definitions. Multi-word phrases must be checked before
// single-word ones so "you know" wins over a bare "you" / "know".
const FILLER_PHRASES: Array<{ phrase: string; reason: string }> = [
  { phrase: "you know", reason: "Verbal tic — usually safe to cut." },
  { phrase: "kind of", reason: "Hedging filler — tighten the line." },
  { phrase: "sort of", reason: "Hedging filler — tighten the line." },
  { phrase: "um", reason: "Disfluency — clean cut candidate." },
  { phrase: "uh", reason: "Disfluency — clean cut candidate." },
  { phrase: "like", reason: "Filler 'like' — flag standalone uses." },
  { phrase: "actually", reason: "Often a verbal crutch — cut when it adds no meaning." },
  { phrase: "basically", reason: "Often a verbal crutch — cut when it adds no meaning." },
];

interface Token {
  word: string;
  // Word index within the global stream (used for fallback timing).
  globalIndex: number;
  // Word index measured from the most recent [timestamp] anchor.
  anchorOffset: number;
  anchorSec: number;
}

function parseTimestamp(raw: string): number | null {
  const m3 = raw.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (m3) {
    return (
      parseInt(m3[1], 10) * 3600 +
      parseInt(m3[2], 10) * 60 +
      parseInt(m3[3], 10)
    );
  }
  const m2 = raw.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m2) return parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  return null;
}

// Tokenize the transcript, attaching each word to the most recent
// [m:ss] / [h:mm:ss] anchor so we can compute "anchor + offset * 0.4"
// instead of a single drift-prone global estimate.
function tokenize(transcript: string): Token[] {
  const tokens: Token[] = [];
  const parts = transcript.split(/(\[\d{1,2}(?::\d{1,2}){1,2}\])/g);
  let anchorSec = 0;
  let anchorOffset = 0;
  let globalIndex = 0;
  for (const part of parts) {
    if (!part) continue;
    const tsMatch = part.match(/^\[(\d{1,2}(?::\d{1,2}){1,2})\]$/);
    if (tsMatch) {
      const sec = parseTimestamp(tsMatch[1]);
      if (sec !== null) {
        anchorSec = sec;
        anchorOffset = 0;
      }
      continue;
    }
    const wordMatches = part.match(/[^\s]+/g) || [];
    for (const w of wordMatches) {
      tokens.push({
        word: w,
        globalIndex,
        anchorOffset,
        anchorSec,
      });
      globalIndex++;
      anchorOffset++;
    }
  }
  return tokens;
}

function stripPunct(w: string): string {
  return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
}

function tokenStartSec(t: Token, hasAnchors: boolean): number {
  if (hasAnchors) return t.anchorSec + t.anchorOffset * SECONDS_PER_WORD;
  return t.globalIndex * SECONDS_PER_WORD;
}

export async function POST(req: NextRequest) {
  let body: FillerReq;
  try {
    body = (await req.json()) as FillerReq;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const transcript = (body.transcript || "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  const tokens = tokenize(transcript);
  if (tokens.length === 0) {
    return NextResponse.json({ filler: [] });
  }
  const hasAnchors = /\[\d{1,2}(?::\d{1,2}){1,2}\]/.test(transcript);

  // Build a lowercase tokens-only view for phrase matching.
  const lower = tokens.map((t) => stripPunct(t.word));
  // Track which token indices have been consumed by an earlier match
  // so we don't double-count "you know" as both phrase and "know".
  const consumed = new Set<number>();
  const filler: FillerSegment[] = [];

  for (let i = 0; i < tokens.length; i++) {
    if (consumed.has(i)) continue;
    for (const { phrase, reason } of FILLER_PHRASES) {
      const phraseWords = phrase.split(" ");
      if (i + phraseWords.length > tokens.length) continue;
      let match = true;
      for (let k = 0; k < phraseWords.length; k++) {
        if (consumed.has(i + k) || lower[i + k] !== phraseWords[k]) {
          match = false;
          break;
        }
      }
      if (!match) continue;

      const startTok = tokens[i];
      const endTok = tokens[i + phraseWords.length - 1];
      const start = tokenStartSec(startTok, hasAnchors);
      const end = tokenStartSec(endTok, hasAnchors) + SECONDS_PER_WORD;
      filler.push({
        start: Math.round(start * 1000) / 1000,
        end: Math.round(end * 1000) / 1000,
        word: phrase,
        reason,
      });
      for (let k = 0; k < phraseWords.length; k++) consumed.add(i + k);
      break;
    }
  }

  filler.sort((a, b) => a.start - b.start);
  return NextResponse.json({ filler });
}
