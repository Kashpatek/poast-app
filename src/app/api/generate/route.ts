import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { log } from "@/lib/logger";
import { callLLM, LLMError, type LLMProvider } from "@/lib/llm-provider";
import { applyBrandVoice } from "@/lib/brand-voice";

const GenerateSchema = z.object({
  system: z.string(),
  prompt: z.string(),
  // New optional fields. Older callers that only send {system,prompt}
  // keep working with provider="claude" and no brand-voice injection.
  provider: z.enum(["claude", "gemini", "grok"]).optional(),
  applyBrandVoice: z.boolean().optional(),
  maxTokens: z.number().optional(),
  model: z.string().optional(),
}).passthrough();

export async function POST(req: NextRequest) {
  try {
    const { allowed, remaining } = await checkRateLimit(req);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining ?? 0) } }
      );
    }

    const body = await req.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { system, prompt, provider, maxTokens, model } = parsed.data;
    const usedProvider: LLMProvider = provider || "claude";
    const finalSystem = parsed.data.applyBrandVoice
      ? await applyBrandVoice(system)
      : system;

    const data = await callLLM({
      provider: usedProvider,
      system: finalSystem,
      prompt,
      maxTokens: maxTokens || 4000,
      model,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof LLMError) {
      return NextResponse.json(
        { error: { message: error.message }, provider: error.provider },
        { status: error.status }
      );
    }
    if (error instanceof Error && error.message === "ANTHROPIC_API_KEY not configured") {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }
    log.error("generate API error", { error: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
