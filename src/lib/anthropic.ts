export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

interface GenerateOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
  // Optional vision input. Each entry is a base64 payload (no data-URL prefix)
  // plus its media type; sent alongside the prompt as image content blocks.
  images?: Array<{ media_type: string; data: string }>;
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
  images,
}: GenerateOptions): Promise<Record<string, any>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Text-only stays a plain string (back-compat); with images we send a content
  // array of image blocks followed by the text block.
  const userContent = images && images.length
    ? [
        ...images.map((img) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: img.media_type, data: img.data },
        })),
        { type: "text" as const, text: prompt },
      ]
    : prompt;

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
      messages: [{ role: "user", content: userContent }],
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
