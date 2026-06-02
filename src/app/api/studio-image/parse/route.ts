// /api/studio-image/parse · Takes a screenshot of a table, chart, or
// diagram and returns a Studio doc payload ready to drop into the
// matching editor. Wraps Claude's vision API with a tight system
// prompt so the output is deterministic + safe to land in state.
//
// Used by the "Upload from image" tile on the Welcome view — same
// shape as /api/studio-table/parse but accepts a base64 image instead
// of raw text. Daksh hands us a screenshot, gets back a parsed doc.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const SYSTEM = `You convert a screenshot of a chart/table/diagram into a POAST Studio doc payload. Output ONLY valid JSON. No prose, no code fences, no markdown.

You will receive an image. Identify what kind of artifact it is and return one of three shapes.

UNIVERSAL FIELDS:
  - docType:  "table" | "chart" | "diagram"
  - name:     short doc title (≤ 80 chars). No em-dashes. SemiAnalysis voice — factual, no hype.

────────────── If docType === "table" ──────────────
Return:
{
  "docType": "table",
  "name": string,
  "payload": {
    "kind": "table",
    "version": 1,
    "engine": "standard",
    "mode": "data" | "heatmap",
    "chromeStyle": "framed" | "dense" | "leaderboard" | "sectioned",
    "category": string,           // eyebrow, e.g. "SEMIANALYSIS — HARDWARE"
    "titleWhite": string,         // primary title (white). Use the original chart/table title.
    "titleAmber": string,         // accent — usually the period / scope, e.g. "FY '26"
    "subtitle": string,           // 1-line context (≤ 140 chars)
    "titleBar": string,           // 1-line table-bar caption, ALL CAPS
    "sheet": {
      "schema": [
        { "key": "c1", "label": string, "type": "text" | "number" | "percent", "numFmt"?: "default"|"int"|"dec1"|"dec2"|"pct"|"usd"|"usdK"|"usdM"|"usdB"|"k"|"m"|"b", "prefix"?: string, "suffix"?: string }
      ],
      "rows": [ { "c1": value, "c2": value, ... } ]
    },
    "highlightRowIdx": number | null,
    "highlightFlagCol": number | null,
    "keyInsight": string          // 1-2 sentence takeaway. Reference numbers from the data.
  }
}

CHROME STYLE RULES (pick one):
- "dense"       — wide spec / comparison tables (chip generations, accelerator specs, feature matrices)
- "leaderboard" — clearly ranked rows (#1, #2, #3 …) with a score / share column
- "sectioned"   — rows are grouped under named bands (BoM, cost breakdown by section)
- "framed"      — everything else; default

TABLE RULES:
- First column is ALWAYS row label (text). Subsequent columns carry the data.
- Use existing column headers from the image — do not rename.
- numFmt: prices → "usd"/"usdK"/"usdM", whole counts → "int", ratios → "pct".
- NEVER invent rows. If the image shows 6 rows, output 6.
- If a value is unreadable or missing, use null (not "N/A" or "").

────────────── If docType === "chart" ──────────────
Most charts are easier to land as a table the user can convert. Return the same shape as above with docType: "chart" — the editor will treat it as table-with-chart-intent. ALWAYS prefer table over chart unless the image clearly shows a chart with NO tabular numbers visible. Set chromeStyle to "framed".

────────────── If docType === "diagram" ──────────────
Return:
{
  "docType": "diagram",
  "name": string,
  "payload": {
    "kind": "diagram",
    "version": 1,
    "canvasW": 1200,
    "canvasH": 720,
    "backdrop": "sa-dark",
    "nodes": [
      { "id": string, "kind": "rect"|"rounded"|"ellipse"|"text"|"arrow"|"diamond", "x": number, "y": number, "w": number, "h": number, "text"?: string, "fill"?: string, "stroke"?: string }
    ],
    "edges": [
      { "id": string, "from": { "kind": "node", "nodeId": string, "side": "right" }, "to": { "kind": "node", "nodeId": string, "side": "left" }, "arrowEnd": true }
    ]
  }
}

DIAGRAM RULES:
- Position nodes inside the 1200×720 canvas (origin top-left).
- Use brand colors for fills (with translucency for backgrounds):
  amber "#F7B04122", blue "#0B86D122", teal "#2EAD8E22", coral "#E0634722", violet "#905CCB22".
  Borders use the un-translucent version of the same hue.
- Connect related nodes with edges. Always include an arrowEnd.

GENERAL:
- NEVER include text outside the JSON object. No \`\`\`json fences. No prose.
- If the image is unreadable or doesn't depict a chart/table/diagram, return:
  { "docType": "error", "name": "", "payload": null, "message": "<short reason>" }`;

interface ImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}
interface TextBlock {
  type: "text";
  text: string;
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  let body: { image?: string; mediaType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const raw = (body.image || "").trim();
  if (!raw) return NextResponse.json({ error: "Provide an image (base64)" }, { status: 400 });

  // Accept either bare base64 or a data: URL. Strip the data:image/...;base64,
  // prefix if present and extract the media type.
  let data = raw;
  let mediaType = body.mediaType || "image/png";
  const dataUrlMatch = raw.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (dataUrlMatch) {
    mediaType = dataUrlMatch[1];
    data = dataUrlMatch[2];
  }
  // Anthropic vision accepts png, jpeg, gif, webp.
  const allowed = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  if (!allowed.has(mediaType)) {
    return NextResponse.json({ error: "Unsupported media type: " + mediaType }, { status: 415 });
  }

  // Soft cap — Anthropic's API limit is 5 MB per image; estimate from
  // base64 length (~ data.length * 3/4 bytes).
  const sizeBytes = Math.floor(data.length * 0.75);
  if (sizeBytes > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (> 5 MB)" }, { status: 413 });
  }

  const userBlocks: (ImageBlock | TextBlock)[] = [
    { type: "image", source: { type: "base64", media_type: mediaType, data } },
    { type: "text",  text: "Parse this artifact into the Studio JSON payload." },
  ];

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
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: "user", content: userBlocks }],
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
    if (parsed.docType === "error") {
      return NextResponse.json({ error: parsed.message || "Unparseable image" }, { status: 422 });
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
