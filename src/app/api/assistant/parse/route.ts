// /api/assistant/parse · the MarketingSUITE Assistant brain.
//
// Takes whatever the user typed or pasted and classifies it into one of the
// create kinds (task | schedule | campaign | ad) with extracted fields, or
// "help" with a conversational answer. The client then opens the matching
// pre-filled modal (or shows the answer). Mirrors /api/morning-brief's callLLM
// + parseLLMJson pattern; non-streaming JSON.
import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, parseLLMJson, LLMError } from "@/lib/llm-provider";

export const dynamic = "force-dynamic";

interface ParseResult {
  kind: "task" | "schedule" | "campaign" | "ad" | "help";
  summary?: string;
  answer?: string;
  fields?: Record<string, unknown>;
}

const SYSTEM = `You are the Assistant inside MarketingSUITE — an all-in-one marketing cockpit for SemiAnalysis' Brand & Marketing team (podcast + ads + social + campaigns).

Classify the user's input into exactly one "kind" and extract structured fields. Respond with ONLY a JSON object, no prose, no code fences:

{
  "kind": "task" | "schedule" | "campaign" | "ad" | "help",
  "summary": "<one short line describing what you're creating>",
  "fields": { ... },        // omit for "help"
  "answer": "<helpful answer>"  // ONLY when kind is "help"
}

Field shapes by kind:
- task: { "title": string, "description"?: string, "category"?: "GRAPHIC DESIGN"|"MARKETING OPS"|"VIDEO PRODUCTION"|"BRAND / IDENTITY"|"DEV / ACCESS"|"CONTENT OPS"|"PODCAST"|"EVENTS"|"RESEARCH"|"ADMIN"|"OTHER", "priority"?: "HIGH"|"MEDIUM"|"THIS WEEK"|"ONGOING", "assignee"?: string, "dueDate"?: "YYYY-MM-DD", "time"?: "HH:MM" }
- schedule: { "title": string, "scheduleKind": "meeting"|"filming"|"review"|"deadline"|"block"|"booking", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime"?: "HH:MM", "notes"?: string, "campaignHint"?: string }
- campaign: { "name": string, "type"?: string, "goal"?: string, "start"?: "YYYY-MM-DD", "end"?: "YYYY-MM-DD", "tasks"?: string[] }
- ad: { "title": string, "platform"?: "openai"|"x"|"meta"|"linkedin"|"adsense", "objective"?: string, "budget"?: number, "audience"?: string, "headline"?: string, "body"?: string }

Decision rules:
- A dated/timed commitment (meeting, filming, recording, review, booking, a block of time) → "schedule".
- A to-do / action item → "task". A due date alone does NOT make it a schedule; only an actual appointment/booking does.
- Building or launching a single ad/creative → "ad".
- A coordinated multi-step marketing push (a launch, a series) → "campaign"; populate "tasks" with the obvious prep steps.
- A question, brainstorm, or "help me figure out…" → "help"; put a concise, useful answer in "answer" (you may suggest what to create).
- Resolve all relative dates against TODAY. Times are 24h. Keep titles concise and action-oriented.

When one or more IMAGES are attached, read them and let them drive the result:
- A screenshot of an ad / creative → "ad"; infer platform from the UI chrome (OpenAI, X/Twitter, Meta/Instagram, LinkedIn, AdSense), and pull a headline/body from the visible copy. If a date or "X days ago"/timestamp is visible, use it to set timing context in the summary.
- A photo/screenshot of a to-do list, whiteboard, or notes → usually "task" (or "campaign" if it's clearly a multi-step plan). Pull the title from the most prominent line; if a deadline or a subtext/headline is visible, set "dueDate"/"description" accordingly — and if it reads as a dated commitment, prefer "schedule" with the date/time.
- Use any visible dates, times, or numbers in the image to fill date/time/budget fields. If the image is ambiguous, fall back to the typed text and your best inference.
The typed text and any "Additional context" the user provides take priority over the image when they conflict.`;

// Supported Anthropic vision media types; anything else is dropped.
const IMG_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGES = 4;
// ~4.5MB of base64 ≈ ~3.3MB raw, comfortably under Anthropic's 5MB/image cap.
const MAX_B64 = 4_500_000;

// Accepts either a full data URL ("data:image/png;base64,AAAA") or a bare
// base64 string with a separate media_type. Returns null if unusable.
function normalizeImage(raw: unknown): { media_type: string; data: string } | null {
  if (typeof raw === "string") {
    const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(raw);
    if (!m) return null;
    const media_type = m[1].toLowerCase();
    if (!IMG_TYPES.has(media_type) || m[2].length > MAX_B64) return null;
    return { media_type, data: m[2] };
  }
  if (raw && typeof raw === "object") {
    const o = raw as { media_type?: string; data?: string };
    if (!o.media_type || !o.data) return null;
    const media_type = o.media_type.toLowerCase();
    if (!IMG_TYPES.has(media_type) || o.data.length > MAX_B64) return null;
    return { media_type, data: o.data };
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: { text?: string; today?: string; extra?: string; images?: unknown[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = (body.text || "").trim();
  const extra = (body.extra || "").trim();
  const images = Array.isArray(body.images)
    ? body.images.map(normalizeImage).filter((x): x is { media_type: string; data: string } => !!x).slice(0, MAX_IMAGES)
    : [];
  // Need at least one signal — typed text or an image.
  if (!text && !images.length) return NextResponse.json({ error: "Empty input" }, { status: 400 });
  const today = body.today || new Date().toISOString().slice(0, 10);

  const promptParts = [`TODAY is ${today}.`];
  if (text) promptParts.push(`User input:\n"""\n${text}\n"""`);
  else promptParts.push(`The user typed nothing — base your result on the attached image(s).`);
  if (extra) promptParts.push(`Additional context from the user:\n"""\n${extra}\n"""`);
  if (images.length) promptParts.push(`${images.length} image(s) are attached above. Read them as described in your instructions.`);
  promptParts.push(`Return the JSON now.`);

  try {
    const res = await callLLM({
      provider: "claude",
      system: SYSTEM,
      prompt: promptParts.join("\n\n"),
      maxTokens: 1200,
      images,
    });
    const out = parseLLMJson<ParseResult>(llmTextOf(res));
    if (!out || !out.kind) return NextResponse.json({ error: "Could not classify input" }, { status: 422 });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status || 500 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
