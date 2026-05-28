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
- subtasks: 2-5 concrete steps to actually finish this task. ALWAYS include subtasks unless the task is genuinely a one-liner (e.g. "send Slack reminder"). Each subtask is a short imperative ("Draft v1 sketch", "Get Jacob sign-off", "Export to Buffer"). Keep titles ≤ 70 chars. Order them in the sequence you'd actually do them.

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
      "notes": "...",
      "subtasks": [
        { "title": "Pull current ribbon assets from Asset Library" },
        { "title": "Draft participant + basic versions in Figma" },
        { "title": "Get Akash signoff before sending to print" }
      ]
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
        // Bumped from 3000 → 8000. With subtasks the model can need 200-400
        // tokens PER task, so a 10-item brain-dump hits the ceiling and
        // gets truncated mid-array. 8000 covers ~20 tasks comfortably.
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: "user", content }],
      }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j.error?.message || "Claude call failed" }, { status: res.status });
    const out: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = out.replace(/```[a-z]*|```/g, "").trim();
    // Models sometimes prepend / append prose despite "JSON only"
    // instructions. Try a sequence of strategies before giving up:
    //   1. Parse as-is
    //   2. Slice from first `{` to last `}` (strips preamble/postamble)
    //   3. If still failing, the response was likely truncated mid-array.
    //      Peel off the trailing incomplete task object(s) and try again.
    const parsedTasks = tryParseTasksJson(cleaned);
    if (parsedTasks === null) {
      return NextResponse.json({ error: "Model returned non-JSON", raw: cleaned.slice(0, 1200) }, { status: 502 });
    }
    {
      const tasks = parsedTasks;
      // Validate / normalize.
      const normalized = tasks.map((t: Record<string, unknown>) => {
        // Subtasks come back as array of { title } (sometimes plain strings) —
        // normalize either shape into { id, title, done: false }.
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
          .slice(0, 12); // sanity cap

        return {
          title: String(t.title || "").slice(0, 200),
          description: t.description ? String(t.description).slice(0, 500) : undefined,
          category: CATEGORIES.includes(String(t.category)) ? String(t.category) : "OTHER",
          priority: PRIORITIES.includes(String(t.priority)) ? String(t.priority) : "MEDIUM",
          dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : undefined,
          notes: t.notes ? String(t.notes).slice(0, 500) : undefined,
          subtasks: subtasks.length > 0 ? subtasks : undefined,
        };
      });
      return NextResponse.json({ tasks: normalized, ts: Date.now() });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Best-effort JSON extraction. Returns the tasks array or null if no
// recoverable structure can be found.
function tryParseTasksJson(raw: string): Record<string, unknown>[] | null {
  if (!raw) return null;

  // Strategy 1 + 2: parse directly, then sliced first-{ to last-}.
  const tryParse = (s: string): Record<string, unknown>[] | null => {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j?.tasks)) return j.tasks as Record<string, unknown>[];
      if (Array.isArray(j)) return j as Record<string, unknown>[];
    } catch { /* ignore */ }
    return null;
  };

  let attempt = tryParse(raw);
  if (attempt) return attempt;

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempt = tryParse(raw.slice(firstBrace, lastBrace + 1));
    if (attempt) return attempt;
  }

  // Strategy 3: response was likely truncated mid-array. Find the tasks
  // array opening, then walk through and extract every complete object.
  const tasksOpen = raw.search(/"tasks"\s*:\s*\[/);
  if (tasksOpen < 0) return null;
  const arrStart = raw.indexOf("[", tasksOpen);
  if (arrStart < 0) return null;

  const objects: Record<string, unknown>[] = [];
  let i = arrStart + 1;
  while (i < raw.length) {
    // Skip whitespace + commas.
    while (i < raw.length && (raw[i] === " " || raw[i] === "\n" || raw[i] === "\r" || raw[i] === "\t" || raw[i] === ",")) i++;
    if (i >= raw.length || raw[i] === "]") break;
    if (raw[i] !== "{") break;
    // Walk the object respecting string escapes and nested braces.
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = i;
    for (; i < raw.length; i++) {
      const ch = raw[i];
      if (esc) { esc = false; continue; }
      if (inStr) {
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const slice = raw.slice(start, i + 1);
          const obj = tryParse("[" + slice + "]");
          if (obj && obj.length) objects.push(obj[0]);
          i++;
          break;
        }
      }
    }
    if (i === start) break; // safety — no progress
  }
  return objects.length ? objects : null;
}
