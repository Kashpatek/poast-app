import { CLAUDE_MODEL, AnthropicError } from "./anthropic";

interface MessageContentBlock {
  type: "text" | "image";
  text?: string;
  source?: { type: "base64"; media_type: string; data: string };
}

export interface StreamMessage {
  role: "user" | "assistant";
  content: string | MessageContentBlock[];
}

interface StreamOptions {
  system: string;
  messages: StreamMessage[];
  maxTokens?: number;
  model?: string;
}

export async function streamClaude(opts: StreamOptions): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model || CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      messages: opts.messages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let msg = "Stream request failed";
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message || msg;
    } catch {}
    const err = new Error(msg) as AnthropicError;
    err.status = res.status;
    throw err;
  }

  return res;
}

/**
 * Parse Anthropic SSE stream and emit only text deltas as UTF-8 chunks.
 * The output stream contains the concatenated assistant text exactly as it would
 * appear in the final message — no event framing.
 */
export function transformAnthropicSSE(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n\n")) !== -1) {
            const event = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 2);

            for (const line of event.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) {
                  controller.enqueue(encoder.encode(j.delta.text));
                } else if (j.type === "message_stop") {
                  controller.close();
                  return;
                } else if (j.type === "error") {
                  controller.error(new Error(j.error?.message || "Stream error"));
                  return;
                }
              } catch {
                // Ignore malformed payload lines
              }
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}
