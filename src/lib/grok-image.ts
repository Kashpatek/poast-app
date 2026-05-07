// Single source of truth for Grok image generation. Both the SA Weekly
// thumbnail route and the Carousel `generateImage` action call this so we
// have one place to swap providers later.
//
// Notes:
// - Grok's API doesn't currently honor n > 1, so we issue serial calls and
//   tag each prompt with " variation N" to nudge diversity.
// - Serial (not parallel) on purpose — Grok free tier is ~1 req/sec.
// - Returns a mix of public URLs and `data:image/png;base64,...` URIs
//   depending on what Grok hands back. Callers should treat both as
//   opaque strings usable in <img src>.

interface GrokImageOptions {
  prompt: string;
  count?: number;
  size?: string;
  // Reserved for future img2img / iterate-on-this flows. Not wired into
  // the Grok call yet because their image endpoint doesn't expose an
  // image parameter today; passing it through means callers can request
  // it without us breaking the contract later.
  referenceImageUrl?: string;
}

export class GrokImageError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function generateGrokImages(opts: GrokImageOptions): Promise<string[]> {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) throw new GrokImageError("XAI_API_KEY not configured", 500);

  const { prompt, count = 3 } = opts;
  const images: string[] = [];

  for (let i = 0; i < count; i++) {
    const variantPrompt = i === 0 ? prompt : `${prompt} variation ${i + 1}`;
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt: variantPrompt,
        n: 1,
      }),
    });

    if (!res.ok) {
      // Don't blow up the whole batch on a single failure — keep what we
      // have so the user gets at least some variants. Caller decides
      // whether [] vs partial is acceptable via array length.
      try {
        const errBody = await res.json();
        if (i === 0) {
          throw new GrokImageError(
            errBody?.error?.message || `Grok image error (${res.status})`,
            res.status
          );
        }
      } catch (e) {
        if (e instanceof GrokImageError) throw e;
      }
      continue;
    }

    const data = await res.json();
    if (data?.data?.[0]) {
      const url = data.data[0].url;
      const b64 = data.data[0].b64_json;
      if (url) images.push(url);
      else if (b64) images.push(`data:image/png;base64,${b64}`);
    }
  }

  return images;
}

// SA brand cues injected into image prompts so output is on-brand
// without needing a full DocuDesign Design System. Kept here so both
// SA Weekly thumbnails and Carousel covers stay visually coherent.
export const SA_BRAND_CUES =
  "SemiAnalysis aesthetic: dark near-black background, single warm amber accent (#F7B041) optionally paired with cobalt blue (#0B86D1), confident geometric grotesque type vibes (no actual text in the image), institutional and technical mood, no emojis, no busy clutter, premium tech-media polish, sharp focus, deep contrast";

// Style presets that callers can select by short name. Kept verbose
// because the model leans on adjectives more than category labels.
export const STYLE_PRESETS: Record<string, string> = {
  cinematic:
    "Cinematic still frame, dramatic film lighting, deep blacks, sharp focus, photorealistic",
  photorealistic:
    "Ultra-realistic photograph, studio lighting, professional tech media composition",
  abstract:
    "Abstract data visualization, flowing particle systems, neon accents on a dark background",
  dataviz:
    "Clean data visualization infographic, dark background with amber and teal accents, sharp negative space",
  editorial:
    "Editorial illustration, restrained color palette, magazine-cover composition with strong focal subject",
};
