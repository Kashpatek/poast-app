// /api/assistant/campaign · Claude suggests a campaign's structure.
// Given the name/type/goal/dates the user has entered so far, returns the
// required prep tasks (and a few success factors) so the setup modal can
// populate them with one click. Mirrors /api/assistant/parse.
import { NextRequest, NextResponse } from "next/server";
import { callLLM, llmTextOf, parseLLMJson, LLMError } from "@/lib/llm-provider";

export const dynamic = "force-dynamic";

interface CampaignPlan {
  tasks: string[];
  successItems?: string[];
  summary?: string;
}

const SYSTEM = `You are a senior marketing producer at SemiAnalysis (a semiconductor/AI research brand with a podcast, newsletter, and paid product). Given a marketing campaign's details, output the concrete PREP TASKS that must happen before and during launch, plus a few success factors.

Respond with ONLY JSON, no prose/fences:
{
  "tasks": string[],          // 4-9 specific, ordered, action-oriented prep tasks (verb-first, e.g. "Cut 3 teaser clips for X")
  "successItems": string[],   // 2-4 things that make this campaign succeed (metrics, assets, dependencies)
  "summary": string           // one line describing the campaign shape
}

Be concrete and specific to the campaign type and goal. Avoid generic filler. Keep each task under ~70 chars.`;

export async function POST(req: NextRequest) {
  let body: { name?: string; type?: string; goal?: string; start?: string; end?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.name?.trim()) return NextResponse.json({ error: "Campaign name required" }, { status: 400 });

  const prompt = `Campaign:
- Name: ${body.name}
- Type: ${body.type || "(unspecified)"}
- Goal: ${body.goal || "(unspecified)"}
- Dates: ${body.start || "?"} → ${body.end || "?"}

Return the JSON now.`;

  try {
    const res = await callLLM({ provider: "claude", system: SYSTEM, prompt, maxTokens: 900 });
    const out = parseLLMJson<CampaignPlan>(llmTextOf(res));
    if (!out || !Array.isArray(out.tasks)) return NextResponse.json({ error: "Could not plan campaign" }, { status: 422 });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message, provider: e.provider }, { status: e.status || 500 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
