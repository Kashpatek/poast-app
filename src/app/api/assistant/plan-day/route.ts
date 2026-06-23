// /api/assistant/plan-day · the Agenda Wizard's brain. Given a free window, the
// candidate tasks (with estimates/priority/subtasks), and the slots already
// busy, Claude returns an ordered set of focus blocks that fit the window.
import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, parseLLMJson, LLMError } from "@/lib/llm-provider";

export const dynamic = "force-dynamic";

interface PlanBlock { title: string; startTime: string; endTime: string; note?: string; taskId?: string }
interface DayPlan { plan: PlanBlock[]; summary?: string }

const SYSTEM = `You are a sharp focus coach building a REALISTIC day plan for a busy brand/marketing director. You are given a free window (start–end) on a date, a list of candidate tasks (with optional minute estimates, priority, and subtask counts), and slots that are already busy.

Return ONLY JSON, no prose/fences:
{ "plan": [ { "title": string, "startTime": "HH:MM", "endTime": "HH:MM", "taskId"?: string, "note"?: string } ], "summary": string }

Rules:
- Fill from the window start, in priority order (HIGH first, then by due/impact), packing tasks back-to-back but NEVER overlapping a busy slot — schedule around them.
- Respect each task's estimate; if missing, infer 30–60 min from its title/subtasks. Round to 15 min.
- Insert a short break (~10–15 min) after ~90 min of continuous work, and don't schedule past the window end.
- Carry the task's id through as taskId when given.
- Keep titles as the task title (optionally prefixed with a verb). Put any rationale in "note".
- IMPORTANT: "plan" must contain ONLY the NEW blocks you are adding (focus blocks + short breaks). Do NOT echo the already-busy slots back — schedule around them.`;

export async function POST(req: NextRequest) {
  let body: { tasks?: unknown[]; startTime?: string; endTime?: string; date?: string; busy?: unknown[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  if (!tasks.length) return NextResponse.json({ error: "No tasks to plan" }, { status: 400 });

  const prompt = `Date: ${body.date || "today"}
Free window: ${body.startTime || "now"} → ${body.endTime || "18:00"}
Already busy (avoid): ${JSON.stringify(body.busy || [])}
Candidate tasks (highest priority first is ideal): ${JSON.stringify(tasks)}

Build the plan JSON now.`;

  try {
    const res = await callLLM({ provider: "claude", system: SYSTEM, prompt, maxTokens: 1500 });
    const out = parseLLMJson<DayPlan>(llmTextOf(res));
    if (!out || !Array.isArray(out.plan)) return NextResponse.json({ error: "Could not build a plan" }, { status: 422 });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status || 500 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
