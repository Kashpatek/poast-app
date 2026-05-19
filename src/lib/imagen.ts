// Google Imagen image generation. Mirrors the shape of grok-image.ts so
// callers can branch on provider and get the same string[] of usable
// image URLs / data URIs back.
//
// Endpoint: Generative Language API (predict).
// Model defaults to imagen-3.0-generate-002 — change via env GEMINI_IMAGE_MODEL.

export interface ImagenOptions {
  prompt: string;
  count?: number;
  // Imagen accepts a small set; we pass through 1:1 by default.
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  // Reserved: not yet wired into the Imagen call. Kept so callers can
  // pass the same shape they use for Grok without us breaking later.
  referenceImageUrl?: string;
}

export class ImagenError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const IMAGEN_MODEL = process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002";

export async function generateImagenImages(opts: ImagenOptions): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ImagenError("GEMINI_API_KEY not configured", 500);

  const { prompt, count = 3, aspectRatio = "1:1" } = opts;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(IMAGEN_MODEL)}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: Math.max(1, Math.min(count, 4)),
          aspectRatio,
        },
      }),
    }
  );

  const data = (await res.json()) as {
    error?: { message?: string };
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
  if (!res.ok) {
    throw new ImagenError(data?.error?.message || `Imagen error (${res.status})`, res.status);
  }
  return (data.predictions || [])
    .filter((p) => !!p.bytesBase64Encoded)
    .map((p) => `data:${p.mimeType || "image/png"};base64,${p.bytesBase64Encoded}`);
}

// Brand cues shared with grok-image.ts so both providers produce
// SA-styled outputs. Re-exporting here is intentional — we don't want
// the caller importing two libs to assemble one prompt.
export const SA_BRAND_CUES_IMAGEN =
  "SA brand cues: editorial restraint, deep blacks and warm amber (#F7B041) accents with cool teal (#26C9D8) supports, sharp focus, professional tech-media polish.";
