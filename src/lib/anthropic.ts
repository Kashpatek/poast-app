export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

interface GenerateOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

export interface AnthropicError extends Error {
  status: number;
}

/**
 * Call the Anthropic Messages API and return the full response body.
 * Throws on missing key or non-2xx status (with a `status` property on the error).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callClaudeRaw({
  system,
  prompt,
  maxTokens = 4000,
  model,
}: GenerateOptions): Promise<Record<string, any>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(
      data?.error?.message || "Generation failed"
    ) as AnthropicError;
    err.status = response.status;
    throw err;
  }

  return data;
}

/**
 * Call the Anthropic Messages API and return the raw text response.
 * Throws on missing key or non-2xx status.
 */
export async function generateWithClaude(opts: GenerateOptions): Promise<string> {
  const data = await callClaudeRaw(opts);
  return (data.content || [])
    .map((c: { text?: string }) => c.text || "")
    .join("");
}

/**
 * Call Claude and parse the response as JSON.
 * Strips ```json fences before parsing.
 */
export async function generateJSON<T = unknown>(
  opts: GenerateOptions
): Promise<T> {
  const raw = await generateWithClaude(opts);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as T;
}
