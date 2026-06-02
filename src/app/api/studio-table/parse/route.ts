// /api/studio-table/parse · Takes raw text / pasted spreadsheet / paragraph
// and returns a structured TableSheet (schema + rows). Wraps Claude with
// a tight system prompt so the output is deterministic + safe to drop
// straight into the editor.
//
// Used by the Brain Parse modal in editor-table — same pattern as the
// Task Board brain-dump that hits /api/akash-todo/parse.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const SYSTEM = `You convert messy data into a structured table for the POAST Studio table editor. Output ONLY valid JSON. No prose, no code fences.

You receive either:
  - Pasted spreadsheet text (TSV or CSV) — likely from Excel / Sheets
  - A prose paragraph that describes a table or comparison
  - A list of items with attributes
  - A free-form brain dump of related data

You return:

{
  "title": string,              // short, headline-ish (≤ 80 chars). What the table is *about*. No em-dashes.
  "subtitle": string,           // 1-line context (≤ 140 chars). What the user should know to read it. No em-dashes.
  "mode": "data" | "heatmap",   // "heatmap" only if the user clearly wants a sensitivity/score/matrix grid
  "columns": [
    { "label": string, "type": "text" | "number" | "percent", "numFmt"?: "default" | "int" | "dec1" | "dec2" | "pct" | "usd" | "usdK" | "usdM" | "usdB" | "k" | "m" | "b", "prefix"?: string, "suffix"?: string }
  ],
  "rows": [
    // Each row is an object keyed by the column LABELS (you assign keys in the order you listed columns).
    // Use strings for text columns; numbers for number/percent columns.
    { "<col label 1>": value, "<col label 2>": value, ... }
  ],
  "highlightRowIdx": number | null,   // optional · 0-based · the punchline row (total, latest period, recommended option). null if none.
  "highlightFlagCol": number | null,  // optional · 0-based · the cell in the highlight row that should flag coral. null if none.
  "keyInsight": string                // 1-2 sentence takeaway. May reference numbers from the data.
}

RULES:
- The FIRST column is always the row label (text). Subsequent columns carry numeric/percent values.
- Pick a numFmt that matches the data — prices → "usd" or "usdK" / "usdM"; small whole-number counts → "int"; ratios → "pct"; tokens-per-dollar style → "k" / "m" / "b".
- For "heatmap" mode: rows + columns form a matrix; ALL non-first columns should share the same numFmt, and the row labels (first col) should be the row dimension (e.g. utilization %).
- NEVER invent rows. If the input has 4 rows of data, output 4 rows. Don't pad.
- If a value is missing or unclear, use null (NOT "TBD" / "" / 0).
- Titles must be SemiAnalysis voice: factual, no em-dashes, no hype, no emojis. Use middle dots (·) or hyphens for separation if needed.
- keyInsight should call out the number(s) that matter — e.g. "$11.92 of every $20 sub becomes COGS, leaving $8.08 of margin."
- For pasted spreadsheets, USE THE EXISTING COLUMN HEADERS as your column labels. Do not rename them.
- If the user gives you a paragraph, INFER the columns from what's being compared (e.g. "GPU A is 1.2x faster but 30% more expensive than GPU B" → columns: Model, Speed (x baseline), Price delta).`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Provide text" }, { status: 400 });

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
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: text }],
      }),
    });
    const j = await res.json();
    if (!res.ok) return NextResponse.json({ error: j.error?.message || "Claude call failed" }, { status: res.status });
    const out: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const cleaned = out.replace(/```[a-z]*|```/g, "").trim();
    const parsed = tryParseJson(cleaned);
    if (!parsed) {
      return NextResponse.json({ error: "Model returned non-JSON", raw: cleaned.slice(0, 1000) }, { status: 502 });
    }
    return NextResponse.json({ parsed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw); } catch { /* fallthrough */ }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(raw.slice(first, last + 1)); } catch { /* fallthrough */ }
  }
  return null;
}
