// Task Board parser — accepts either prose text or an image URL and
// returns a clean Task[] for Akash's personal board.
//
// Designed to ingest the kind of stuff Akash actually has lying around:
//   - a Slack thread pasted in
//   - a paragraph from a meeting
//   - a screenshot of a task board PDF
//   - a photo of a whiteboard
//   - an itemized list
//
// Categories and priorities match the SA marketing task board template
// the team already uses (see sa_taskboard_may2026.pdf).

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

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

const SYSTEM = `You extract structured tasks from informal input for Akash, the Brand and Creative Director at SemiAnalysis. Output ONLY valid JSON.

Each task you extract has:
- title: short imperative phrase, the task itself (≤ 90 chars)
- description: 1-sentence context if available (optional)
- category: one of ${CATEGORIES.map((c) => '"' + c + '"').join(", ")}
- priority: one of ${PRIORITIES.map((p) => '"' + p + '"').join(", ")}
- dueDate: ISO yyyy-mm-dd if a specific date or relative date ("next Wednesday", "May 18") can be inferred from the input. Today's date is provided in the user message. Leave empty if no due date.
- notes: anything that doesn't fit elsewhere (contacts, links, blockers)

Be aggressive about splitting compound items into separate tasks. If a paragraph mentions four things to do, return four tasks.

Use SA voice in titles and descriptions:
- No em dashes (use commas or periods)
- No emojis
- No hype words

Return JSON:
{
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "category": "GRAPHIC DESIGN",
      "priority": "HIGH",
      "dueDate": "2026-05-21",
      "notes": "..."
    }
  ]
}`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { text?: string; imageUrl?: string; today?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const text = (body.text || "").trim();
  const imageUrl = (body.imageUrl || "").trim();
  if (!text && !imageUrl) {
    return NextResponse.json({ error: "Provide text or imageUrl" }, { status: 400 });
  }

  const today = body.today || new Date().toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];
  if (imageUrl) {
    content.push({ type: "image", source: { type: "url", url: imageUrl } });
  }
  content.push({
    type: "text",
    text: [
      "Today's date: " + today,
      text ? "Input text:\n" + text : "Extract tasks from the attached image (it may be a task board, screenshot of a thread, whiteboard, or PDF page).",
      "\nReturn the JSON.",
    ].filter(Boolean).join("\n\n"),
  });

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
        max_tokens: 3000,
        system: SYSTEM,
        messages: [{ role: "user", content }],
      }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j.error?.message || "Claude call failed" }, { status: res.status });
    const out: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = out.replace(/```[a-z]*|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      // Validate / normalize.
      const normalized = tasks.map((t: Record<string, unknown>) => ({
        title: String(t.title || "").slice(0, 200),
        description: t.description ? String(t.description).slice(0, 500) : undefined,
        category: CATEGORIES.includes(String(t.category)) ? String(t.category) : "OTHER",
        priority: PRIORITIES.includes(String(t.priority)) ? String(t.priority) : "MEDIUM",
        dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : undefined,
        notes: t.notes ? String(t.notes).slice(0, 500) : undefined,
      }));
      return NextResponse.json({ tasks: normalized, ts: Date.now() });
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON", raw: cleaned.slice(0, 600) }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
