import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateJSON, AnthropicError } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/ratelimit";
import { buildAnalyzeBrandPrompt } from "@/app/docu-design/design-context";

export const maxDuration = 60;

const InputSchema = z.object({
  assets: z
    .array(
      z.object({
        url: z.string().url(),
        kind: z.string(),
        name: z.string().optional(),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { allowed } = await checkRateLimit(req);
  if (!allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  try {
    const body = await req.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const { system, prompt } = buildAnalyzeBrandPrompt(parsed.data);
    const analyzed = await generateJSON({ system, prompt, maxTokens: 1500 });
    return NextResponse.json({ analyzed, ts: Date.now() });
  } catch (err) {
    const status = (err as AnthropicError)?.status;
    if (status) return NextResponse.json({ error: (err as Error).message }, { status });
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Failed to parse model output" }, { status: 500 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
