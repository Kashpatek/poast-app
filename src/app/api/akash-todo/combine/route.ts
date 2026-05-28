// Smart merge — takes 2+ tasks from Akash's board and asks Claude to
// produce one unified task whose title captures all the work, whose
// subtasks consolidate everything that needs doing across the inputs,
// and whose category/priority/assignee/dueDate reflect the most
// urgent / highest-signal source.
//
// The client still gets to edit the result before committing. This
// route only generates the proposal.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const CATEGORIES = [
  "GRAPHIC DESIGN",
  "MARKETING OPS",
  "VIDEO PRODUCTION",
  "BRAND / IDENTITY",
  "DEV / ACCESS",
  "CONTENT OPS",
  "PODCAST",
  "EVENTS",
  "RESEARCH",
  "ADMIN",
  "OTHER",
];
const PRIORITIES = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"];
const ASSIGNEES = ["Akash", "Daksh", "Vansh", "Max", "Michelle", "Unassigned"];

interface IncomingSubtask { title: string; done?: boolean }
interface IncomingTask {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
  notes?: string;
  tags?: string[];
  subtasks?: IncomingSubtask[];
}

const SYSTEM = `You merge multiple Task entries into ONE consolidated Task for Akash Patel, Brand and Creative Director at SemiAnalysis. The input tasks are duplicates or near-duplicates — overlapping work that should live in a single record.

Your job:
1. Read all input tasks (titles, descriptions, subtasks, notes).
2. Produce ONE merged Task with:
   - title: short imperative phrase covering the WHOLE scope (≤ 90 chars). Don't just pick the longest input title; synthesize. Example: inputs "Redo ClusterMax ribbons" + "Make basic ribbon version" + "Send ribbons to print" → "Redo ClusterMax ribbons (participant + basic) and ship to print".
   - description: 1-2 sentences of context that explains why this work exists, pulling from input descriptions / notes.
   - category: one of ${CATEGORIES.map((c) => '"' + c + '"').join(", ")}.
   - priority: one of ${PRIORITIES.map((p) => '"' + p + '"').join(", ")}. Pick the HIGHEST priority across inputs.
   - assignee: one of ${ASSIGNEES.map((a) => '"' + a + '"').join(", ")}. Pick the most-used name across inputs; default "Akash" if tied or unclear.
   - dueDate: ISO yyyy-mm-dd. Pick the EARLIEST due date if any input has one. Empty string if none.
   - notes: concatenate distinct contact / blocker / link info; one short paragraph.
   - subtasks: this is the key value-add. Build a CONSOLIDATED, ORDERED checklist that captures everything that needs to happen. If the inputs themselves were standalone items (no subtasks listed), each input title likely becomes a subtask in the merged task. If inputs had subtasks already, dedupe near-identical ones and order them logically. 4-10 items typically. Each ≤ 70 chars, imperative voice.

Use SemiAnalysis voice in titles / description: no em dashes (use commas or periods), no emojis, no hype words. Be specific and operational.

Return ONLY this JSON:
{
  "title": "...",
  "description": "...",
  "category": "GRAPHIC DESIGN",
  "priority": "HIGH",
  "assignee": "Akash",
  "dueDate": "2026-05-21",
  "notes": "...",
  "subtasks": [
    { "title": "Pull current ribbon assets" },
    { "title": "Draft participant + basic versions" },
    { "title": "Get Akash sign-off" },
    { "title": "Send to print" }
  ]
}`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { tasks?: IncomingTask[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const tasks = body.tasks || [];
  if (tasks.length < 2) return NextResponse.json({ error: "Need at least 2 tasks to merge" }, { status: 400 });
  if (tasks.length > 8) return NextResponse.json({ error: "Too many tasks (max 8)" }, { status: 400 });

  const userMsg = [
    "Today's date: " + new Date().toISOString().slice(0, 10),
    "Input tasks to merge:",
    JSON.stringify(tasks, null, 2),
    "Return the merged JSON.",
  ].join("\n\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j.error?.message || "Claude call failed" }, { status: res.status });
    const out: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = out.replace(/```[a-z]*|```/g, "").trim();
    // Slice to braces in case the model wrapped the JSON with prose.
    let payload: Record<string, unknown> | null = null;
    try { payload = JSON.parse(cleaned); } catch {
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first >= 0 && last > first) {
        try { payload = JSON.parse(cleaned.slice(first, last + 1)); } catch { /* fall through */ }
      }
    }
    if (!payload) return NextResponse.json({ error: "Model returned non-JSON", raw: cleaned.slice(0, 1200) }, { status: 502 });

    const t = payload as Record<string, unknown>;
    // Normalize / validate the same shape parse route uses elsewhere.
    const rawAssignee = t.assignee ? String(t.assignee) : "Akash";
    const assignee = ASSIGNEES.includes(rawAssignee) ? rawAssignee : "Akash";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSubs: any[] = Array.isArray(t.subtasks) ? (t.subtasks as any[]) : [];
    const subtasks = rawSubs
      .map((s, i) => {
        const title = typeof s === "string" ? s : String((s && s.title) || "");
        return title.trim() ? {
          id: "s-" + Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 6),
          title: title.slice(0, 200),
          done: false,
        } : null;
      })
      .filter(Boolean)
      .slice(0, 12);

    const merged = {
      title: String(t.title || "").slice(0, 200),
      description: t.description ? String(t.description).slice(0, 500) : undefined,
      category: CATEGORIES.includes(String(t.category)) ? String(t.category) : "OTHER",
      priority: PRIORITIES.includes(String(t.priority)) ? String(t.priority) : "MEDIUM",
      assignee: assignee === "Unassigned" ? undefined : assignee,
      dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : undefined,
      notes: t.notes ? String(t.notes).slice(0, 500) : undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    };
    return NextResponse.json({ merged, ts: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
