import { NextRequest, NextResponse } from "next/server";
import { callClaudeRaw, AnthropicError } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const { system, prompt } = await req.json();

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
