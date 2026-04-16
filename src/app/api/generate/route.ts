import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaudeRaw, AnthropicError } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/ratelimit";

const GenerateSchema = z.object({
  system: z.string(),
  prompt: z.string(),
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

    const { system, prompt } = parsed.data;

    const data = await callClaudeRaw({ system, prompt, maxTokens: 4000 });
    return NextResponse.json(data);
  } catch (error) {
    if ((error as AnthropicError).status) {
      const ae = error as AnthropicError;
      return NextResponse.json(
        { error: { message: ae.message } },
        { status: ae.status }
      );
    }
    if (error instanceof Error && error.message === "ANTHROPIC_API_KEY not configured") {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }
    console.error("API route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
