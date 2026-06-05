// Episode Kit Builder — given a podcast episode title, guest name, and
// transcript, returns a complete post-production kit in one call:
// show notes, guest bio card, timestamped chapters, clip captions,
// and a guest thank-you email.

import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, LLMError, type LLMProvider } from "@/lib/llm-provider";

export const maxDuration = 120;

const SYSTEM = `You are SemiAnalysis's podcast post-production assistant. From an episode title, guest name, and transcript, produce a complete post-show kit. Output ONLY valid JSON, no preamble, no markdown fences.

Hard SA brand rules across every section:
- No em dashes (use commas or periods)
- No emojis
- No hype words: revolutionary, unleashed, dive into, deep dive, game-changing, next-gen, unlock, seamless, transformative, ultimate
- No rhetorical openers: "Why X matters", "Here's why", "Let's talk"
- Direct, data-forward. Pull real numbers and specifics from the transcript.
- Active voice. No filler adjectives.

Section rules:
- showNotes: markdown. 3-5 short paragraphs covering what was discussed, why it matters, and any data points named. Include a "Resources mentioned" list if the guest cited reports, papers, or companies.
- guestBio: 3-4 lines max. Tight, factual. Mention role, employer, area of expertise.
- chapters: 5-12 timestamped sections covering the actual flow of the episode. Format timestamp as MM:SS or HH:MM:SS. Titles under 60 chars, no clickbait.
- clipCaptions: 3-5 short captions ready to ship on social. Each ≤ 280 chars, NEVER hashtags, NEVER emojis, NEVER overlay-text language. Each clip caption should reference a specific moment or quote.
- thankYouEmail: warm but professional. Subject ≤ 60 chars. Body 2-3 short paragraphs. Mentions a specific moment from the conversation so it doesn't read as a template. Signs off as "The SemiAnalysis team".

Return this exact JSON shape:
{
  "showNotes": "markdown string",
  "guestBio": "3-4 line bio string",
  "chapters": [
    { "timestamp": "00:00", "title": "Intro" }
  ],
  "clipCaptions": [
    "caption 1",
    "caption 2"
  ],
  "thankYouEmail": {
    "subject": "Subject line",
    "body": "Email body"
  }
}`;

export async function POST(req: NextRequest) {
  let body: { title?: string; guest?: string; transcript?: string; provider?: LLMProvider };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const title = (body.title || "").trim();
  const guest = (body.guest || "").trim();
  const transcript = (body.transcript || "").trim();

  if (!title) return NextResponse.json({ error: "Missing episode title" }, { status: 400 });
  if (!guest) return NextResponse.json({ error: "Missing guest name" }, { status: 400 });
  if (!transcript || transcript.length < 200) {
    return NextResponse.json({ error: "Transcript too short — paste the full transcript." }, { status: 400 });
  }

  const truncated = transcript.length > 30000 ? transcript.slice(0, 30000) : transcript;

  try {
    const r = await callLLM({
      provider: body.provider,
      system: SYSTEM,
      maxTokens: 4000,
      prompt:
        "Episode title: " + title + "\n" +
        "Guest: " + guest + "\n\n" +
        "Transcript:\n" + truncated + "\n\n" +
        "Produce the full episode kit now.",
    });
    const raw = llmTextOf(r).replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({ kit: parsed, provider: r.provider, ts: Date.now() });
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON", raw: raw.slice(0, 800) }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof LLMError) {
      return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
