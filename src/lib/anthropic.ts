export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// To run the whole app on Claude Fable 5, set ANTHROPIC_MODEL=claude-fable-5
// (Vercel env). No code change needed — the helpers below make Fable safe.

// Fable 5 / Mythos 5 run safety classifiers that can DECLINE a request:
// HTTP 200, stop_reason "refusal", empty content. Recovery is opt-in on the
// API, so without this the app would silently emit blank output (text) or
// crash on JSON.parse("") (generateJSON). For these models we (a) opt into
// the server-side fallback so a refusal is transparently re-served by Opus
// 4.8 in the same call, and (b) treat a whole-chain refusal as a real error
// instead of blank output. Sonnet/Opus requests are unaffected — no beta
// header, no fallbacks param, identical wire shape to before.
const FALLBACK_MODEL = process.env.ANTHROPIC_FALLBACK_MODEL || "claude-opus-4-8";
const FALLBACK_BETA = "server-side-fallback-2026-06-01";

export function usesRefusalFallback(model: string): boolean {
  return /(^|[^a-z])(fable|mythos)/i.test(model);
}

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

  const effModel = model || CLAUDE_MODEL;
  const fable = usesRefusalFallback(effModel);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (fable) headers["anthropic-beta"] = FALLBACK_BETA;

  const body: Record<string, unknown> = {
    model: effModel,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userContent }],
  };
  if (fable) body.fallbacks = [{ model: FALLBACK_MODEL }];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(
      data?.error?.message || "Generation failed"
    ) as AnthropicError;
    err.status = response.status;
    throw err;
  }

  // A refusal is HTTP 200 with empty content — surface it as an error rather
  // than letting callers return blank text or crash on JSON.parse. With the
  // fallback opted in above, reaching here means both Fable and Opus declined.
  if (data?.stop_reason === "refusal") {
    const cat = data?.stop_details?.category;
    const err = new Error(
      `Request declined by the model's safety classifier${cat ? ` (${cat})` : ""}.`
    ) as AnthropicError;
    err.status = 422;
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
