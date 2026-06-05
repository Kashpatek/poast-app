// Transcript Cleaner — paste a transcript (.txt / .srt content), get back
// a cleaned version with filler words removed and proper noun
// capitalization fixed against the SA whitelist. Also returns a small
// list of detected punchy clip moments the user can route to the Brief
// Builder. Pairs with the UI at /production-studio/transcript-cleaner.

import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, LLMError, type LLMProvider } from "@/lib/llm-provider";

export const maxDuration = 60;

// SA-specific proper nouns the model should always fix to canonical case.
// Kept inline in the system prompt so the model never has to guess on the
// names the SA editorial team writes the most often.
const SA_WHITELIST = [
  "TSMC", "ASML", "NVMe", "CUDA", "CoWoS", "NVLink",
  "HBM", "HBM1", "HBM2", "HBM3", "HBM3E", "HBM4",
  "N3", "N2", "A14",
  "Blackwell", "Hopper", "Grace", "Rubin", "Vera",
  "GB300", "B100", "B200", "H100", "H200",
  "MI300", "MI325",
  "Sierra Forest", "Granite Rapids", "Emerald Rapids", "Sapphire Rapids",
  "Intel 18A",
];

const SYSTEM = `You are a transcript cleaner for the SemiAnalysis editorial team. You receive raw transcript text (plain text or .srt content) and return a CLEAN, READ-OUT-LOUD version with:

1. FILLER WORDS REMOVED — strip standalone "um", "uh", "ah", "er", "like", "you know", "sort of", "kind of", "I mean", "basically" when they're verbal filler (not when they carry meaning, e.g. "kind of GPU" stays). Trim double spaces and stray fragments left behind.

2. PROPER NOUN CAPITALIZATION FIXED — always force the following SA whitelist into canonical case anywhere they appear (case-insensitive match → canonical):
${SA_WHITELIST.map((w) => "- " + w).join("\n")}
Also fix obvious technical proper nouns even when not whitelisted (companies, product names, people) when context makes them unambiguous.

3. SRT FORMATTING — if the input is .srt (numbered cues with HH:MM:SS,mmm --> HH:MM:SS,mmm timing lines), keep the cue numbers and timing lines EXACTLY as they were. Only edit the spoken-text lines underneath each cue.

4. NEVER paraphrase, summarize, translate, or invent content. Only delete fillers and correct capitalization/spelling of known terms. Punctuation and sentence boundaries may be lightly normalized (commas / periods) where filler removal leaves a fragment.

5. CLIP MOMENTS — also scan the cleaned transcript and pick up to 5 punchy, quotable lines that would make great short-form clips. A punchy line is concrete, has a strong claim, a number, a named entity, or a sharp opinion. Avoid bland setup sentences. Each moment is one sentence from the cleaned transcript (verbatim).

Respond with ONLY valid JSON. No markdown fences. No preamble. Schema:
{
  "cleaned": "the full cleaned transcript as a single string, preserving line breaks",
  "clipMoments": [
    { "line": "exact sentence from cleaned transcript", "reason": "1-line why it's clippable" }
  ]
}`;

function resolveProvider(raw: unknown): LLMProvider {
  if (raw === "gemini" || raw === "grok" || raw === "claude") return raw;
  return "claude";
}

interface CleanedResponse {
  cleaned?: string;
  clipMoments?: Array<{ line?: string; reason?: string }>;
}

export async function POST(req: NextRequest) {
  let body: { text?: string; provider?: string };
  try {
    body = (await req.json()) as { text?: string; provider?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  if (text.length > 60000) {
    return NextResponse.json({ error: "Transcript too long — max 60000 chars" }, { status: 400 });
  }

  const provider = resolveProvider(body.provider);

  try {
    const r = await callLLM({
      provider,
      system: SYSTEM,
      prompt: `Clean this transcript. Return ONLY the JSON object specified.\n\nTranscript:\n${text}`,
      maxTokens: 8000,
    });
    const raw = llmTextOf(r).replace(/```json|```/g, "").trim();
    let parsed: CleanedResponse;
    try {
      parsed = JSON.parse(raw) as CleanedResponse;
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", raw: raw.slice(0, 500) },
        { status: 502 },
      );
    }

    const cleaned = typeof parsed.cleaned === "string" ? parsed.cleaned : "";
    const clipMoments = Array.isArray(parsed.clipMoments)
      ? parsed.clipMoments
          .filter((m) => m && typeof m.line === "string" && m.line.trim())
          .map((m) => ({
            line: (m.line || "").trim(),
            reason: typeof m.reason === "string" ? m.reason.trim() : "",
          }))
      : [];

    return NextResponse.json({ cleaned, clipMoments, provider: r.provider });
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
