// Unified text-generation provider abstraction.
// Routes Claude / Gemini / Grok through one call so caption-gen surfaces
// across the app can let users pick the model without each call site
// learning three different APIs.
//
// Returns a `data` object shaped like the Anthropic Messages response
// (`{ content: [{ text }] }`) so existing call sites that destructure
// `data.content` keep working. Caller code that's already happy with
// Claude stays unchanged when no provider is passed.

import { callClaudeRaw, AnthropicError } from "./anthropic";

export type LLMProvider = "claude" | "gemini" | "grok";

export interface LLMOptions {
  provider?: LLMProvider;
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

export interface LLMResponse {
  // Mirrors Anthropic shape so /api/generate consumers don't break.
  content: Array<{ type: "text"; text: string }>;
  provider: LLMProvider;
  model?: string;
}

export class LLMError extends Error {
  status: number;
  provider: LLMProvider;
  constructor(message: string, status: number, provider: LLMProvider) {
    super(message);
    this.status = status;
    this.provider = provider;
  }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";
const GROK_TEXT_MODEL = process.env.GROK_TEXT_MODEL || "grok-2-1212";

export async function callLLM(opts: LLMOptions): Promise<LLMResponse> {
  const provider: LLMProvider = opts.provider || "claude";
  if (provider === "claude") return callClaudeAsLLM(opts);
  if (provider === "gemini") return callGemini(opts);
  if (provider === "grok") return callGrok(opts);
  throw new LLMError(`Unknown provider: ${provider}`, 400, provider);
}

// ── Claude ───────────────────────────────────────────────────────────
async function callClaudeAsLLM(opts: LLMOptions): Promise<LLMResponse> {
  try {
    const data = await callClaudeRaw({
      system: opts.system,
      prompt: opts.prompt,
      maxTokens: opts.maxTokens,
      model: opts.model,
    });
    const content = (data.content || []) as Array<{ type: string; text?: string }>;
    return {
      content: content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => ({ type: "text" as const, text: c.text || "" })),
      provider: "claude",
      model: opts.model,
    };
  } catch (e) {
    if ((e as AnthropicError).status) {
      const ae = e as AnthropicError;
      throw new LLMError(ae.message, ae.status, "claude");
    }
    throw new LLMError(String(e), 500, "claude");
  }
}

// ── Gemini ───────────────────────────────────────────────────────────
async function callGemini(opts: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LLMError("GEMINI_API_KEY not configured", 500, "gemini");

  const model = opts.model || GEMINI_MODEL;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens || 4000,
          temperature: 0.7,
        },
      }),
    }
  );
  const data = (await res.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!res.ok) {
    throw new LLMError(data?.error?.message || `Gemini error (${res.status})`, res.status, "gemini");
  }
  const text = (data.candidates || [])
    .flatMap((c) => c.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
  return {
    content: [{ type: "text", text }],
    provider: "gemini",
    model,
  };
}

// ── Grok (xAI) ───────────────────────────────────────────────────────
async function callGrok(opts: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new LLMError("XAI_API_KEY not configured", 500, "grok");
  const model = opts.model || GROK_TEXT_MODEL;
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens || 4000,
      temperature: 0.7,
    }),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new LLMError(data?.error?.message || `Grok error (${res.status})`, res.status, "grok");
  }
  const text = (data.choices || []).map((c) => c.message?.content || "").join("");
  return {
    content: [{ type: "text", text }],
    provider: "grok",
    model,
  };
}

export function llmTextOf(r: LLMResponse): string {
  return r.content.map((c) => c.text).join("");
}
