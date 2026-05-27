// Vision-extracts a chart or table from an uploaded image and returns
// structured JSON the Chart Maker / DocuDesign canvas can consume.
//
// Input:  { imageUrl: string }  — data: URL or public URL
// Output: { kind: "chart" | "table" | "unknown", chart?, table?, reason? }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logger";

export const maxDuration = 60;

const Body = z.object({
  imageUrl: z.string(),
});

const SYSTEM = `You are a data-extraction specialist. The user uploads a screenshot of a chart or table — possibly an old, ugly, or low-resolution one. Your job: read it carefully and output structured JSON that can be used to rebuild the chart cleanly in a modern chart maker.

HARD RULES:
- Output ONLY valid JSON. No markdown fences, no preamble.
- If the image is a chart, output {"kind":"chart", "chart": {...}}.
- If the image is a table, output {"kind":"table", "table": {...}}.
- If neither, output {"kind":"unknown", "reason":"short reason"}.
- Read every number, axis label, category, and series legend you can see. If a value is illegible, output null for it and include a "notes" string explaining what was unclear.
- Pick the best chartType from this exact list: stacked, pct, clustered, wfup, wfdn, mekkoPct, combo, line, stackedArea, pctArea, mekkoUnit, pie, doughnut, scatter, bubble, variance, gantt. Choose the closest match — never invent a new type.

CHART OUTPUT SHAPE:
{
  "kind": "chart",
  "chart": {
    "chartType": "<one of the types above>",
    "title": "<chart title, empty string if none>",
    "subtitle": "<subtitle / source line / unit, empty string if none>",
    "columns": [
      { "key": "label", "label": "Category", "type": "text" },
      { "key": "v1",    "label": "Series 1 name", "type": "number" },
      { "key": "v2",    "label": "Series 2 name", "type": "number" }
    ],
    "rows": [
      { "label": "2023", "v1": 12.3, "v2": 8.1 },
      { "label": "2024", "v1": 14.7, "v2": 9.4 }
    ],
    "notes": "Optional: anything you weren't sure about (e.g. 'value for 2025 was partially obscured by a watermark')."
  }
}

Rules for chart columns/rows:
- The first column is ALWAYS the category axis (x-axis labels for bars/lines, slice labels for pies). Key it "label", type "text".
- Each subsequent column is one series. Keys are short snake_case ("v1", "v2", "asml", "tsmc" etc).
- Numbers are PLAIN NUMBERS — no commas, no % signs, no $. Convert "$1.2B" → 1.2 and note the unit in subtitle if relevant.
- If the chart uses percentages, set type to "percent" and store as the percentage value (12.5 not 0.125).
- Scatter / bubble: columns are { x, y, [size] } and rows are individual points.
- Pie / doughnut: columns are { label, value }.

TABLE OUTPUT SHAPE:
{
  "kind": "table",
  "table": {
    "title": "<table title, empty string if none>",
    "headers": ["Column 1", "Column 2", ...],
    "rows": [
      ["row 1 col 1", "row 1 col 2", ...],
      ...
    ],
    "notes": "Optional: anything unclear."
  }
}

DECIDING:
- A chart has visual encoding (bars, lines, slices, points).
- A table is rows × columns of text / numbers with no visual encoding.
- If both are present (e.g., chart with a data table below it), prefer the chart.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { imageUrl: string };
  try {
    const raw = await req.json();
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    body = parsed.data;
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON: " + String(e) }, { status: 400 });
  }

  // Convert to the source the Anthropic API wants. data: URLs split into
  // media_type + base64; http(s) URLs go through as type: "url".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let imageBlock: any;
  const url = body.imageUrl.trim();
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: "Malformed data URL" }, { status: 400 });
    imageBlock = { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
  } else if (url.startsWith("http://") || url.startsWith("https://")) {
    imageBlock = { type: "image", source: { type: "url", url } };
  } else {
    return NextResponse.json({ error: "imageUrl must be http(s) or data URL" }, { status: 400 });
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            imageBlock,
            { type: "text", text: "Extract this chart or table into the JSON shape from your system instructions. Be precise with numbers." },
          ],
        }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      log.error("Rebuild vision call failed", { status: resp.status, error: data?.error });
      return NextResponse.json({ error: data?.error?.message || "Vision call failed", details: data }, { status: resp.status });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (data.content || []).map((c: any) => c.text || "").join("");
    // Tolerate stray markdown fences just in case.
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: "Vision response wasn't JSON", raw: text.slice(0, 600) }, { status: 502 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch (e) {
      return NextResponse.json({ error: "Couldn't parse extracted JSON: " + String(e), raw: text.slice(0, 600) }, { status: 502 });
    }

    return NextResponse.json({ ok: true, ...(parsed as Record<string, unknown>), ts: Date.now() });
  } catch (e) {
    log.error("Rebuild route error", { error: String(e) });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
