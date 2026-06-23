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
- Resolve all relative dates against TODAY. Times are 24h. Keep titles concise and action-oriented.`;

export async function POST(req: NextRequest) {
  let body: { text?: string; today?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Empty input" }, { status: 400 });
  const today = body.today || new Date().toISOString().slice(0, 10);

  try {
    const res = await callLLM({
      provider: "claude",
      system: SYSTEM,
      prompt: `TODAY is ${today}.\n\nUser input:\n"""\n${text}\n"""\n\nReturn the JSON now.`,
      maxTokens: 1200,
    });
    const out = parseLLMJson<ParseResult>(llmTextOf(res));
    if (!out || !out.kind) return NextResponse.json({ error: "Could not classify input" }, { status: 422 });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status || 500 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
