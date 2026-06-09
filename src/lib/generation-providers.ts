// Registry of every image + video generation provider POAST can dispatch
// to from the Generate Studio. The shape lives in TS so the UI can render
// its knob panel + cost preview deterministically without round-tripping
// to the server.
//
// Pricing as of 2026-06 from each vendor's public list price. These are
// best-effort estimates — vendors change them, and preview-tier models
// often get billed at a discount. Each entry sets `pricing.isEstimate`
// when the figure isn't a hard published rate.

export type Kind = "image" | "video";

export interface ResolutionOption {
  id: string;
  label: string;
  multiplier?: number;
}

export interface QualityOption {
  id: string;
  label: string;
  multiplier?: number;
}

export interface AspectOption {
  id: string;
  label: string;
}

export interface KnobSpec {
  aspectRatios?: AspectOption[];
  resolutions?: ResolutionOption[];
  qualityLevels?: QualityOption[];
  durations?: number[];                 // seconds, video only
  countMax?: number;
  defaultCount?: number;
  supportsNegativePrompt?: boolean;
  supportsSeed?: boolean;
  // Reference-image semantics for image-to-video providers:
  //   supportsReferenceImage  — generic "ref" image (e.g. Grok image)
  //   supportsFirstFrame      — provider treats the image as t=0 (Runway, Veo i2v)
  //   firstFrameRequired      — provider can't run without it
  //   supportsLastFrame       — provider can also condition on a final frame
  //                              (Runway gen-3a "first + last" interpolation)
  supportsReferenceImage?: boolean;
  supportsFirstFrame?: boolean;
  firstFrameRequired?: boolean;
  supportsLastFrame?: boolean;
  stylePresets?: { id: string; label: string }[];
  personGenerationOptions?: { id: string; label: string }[];
}

export interface PricingSpec {
  basePerUnit: number;                  // USD
  unit: "image" | "video-second" | "video-clip";
  notes?: string;
  isEstimate?: boolean;
  publishedUrl?: string;                // link to vendor pricing page
}

// A specific model the user can switch to within a provider (e.g. Runway
// gen-4-turbo vs gen-3a-turbo). When set, the UI shows a model picker and
// the selected variant's pricing replaces the provider default.
export interface ModelVariant {
  id: string;
  label: string;
  modelId: string;
  pricing: PricingSpec;
  description?: string;
}

export interface Provider {
  id: string;
  name: string;
  vendor: string;
  kind: Kind;
  modelId: string;                      // default model
  envKeys: string[];
  description: string;
  knobs: KnobSpec;
  pricing: PricingSpec;                 // default pricing
  models?: ModelVariant[];              // when set, user can pick a cheaper / better variant
  // Async generation (long-running operations need polling).
  async?: boolean;
}

export interface KnobValues {
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  duration?: number;
  count?: number;
  seed?: number;
  negativePrompt?: string;
  stylePreset?: string;
  personGeneration?: string;
  referenceImageDataUrl?: string;
  firstFrameDataUrl?: string;
  lastFrameDataUrl?: string;
  modelId?: string;                     // when provider has variants
}

export function getActiveModel(p: Provider, knobs: KnobValues): { modelId: string; pricing: PricingSpec; label: string } {
  if (p.models && knobs.modelId) {
    const variant = p.models.find((m) => m.modelId === knobs.modelId);
    if (variant) return { modelId: variant.modelId, pricing: variant.pricing, label: variant.label };
  }
  if (p.models && p.models.length > 0) {
    const def = p.models[0];
    return { modelId: def.modelId, pricing: def.pricing, label: def.label };
  }
  return { modelId: p.modelId, pricing: p.pricing, label: p.name };
}

// ─── IMAGE PROVIDERS ───────────────────────────────────────────────

const IMAGEN_3: Provider = {
  id: "imagen-3",
  name: "Imagen 3",
  vendor: "Google",
  kind: "image",
  modelId: "imagen-3.0-generate-002",
  envKeys: ["GEMINI_API_KEY"],
  description: "Google's editorial-grade still image model. Sharp typography handling, strong realism, no native seed control.",
  knobs: {
    aspectRatios: [
      { id: "1:1", label: "Square 1:1" },
      { id: "3:4", label: "Portrait 3:4" },
      { id: "4:3", label: "Landscape 4:3" },
      { id: "9:16", label: "Tall 9:16" },
      { id: "16:9", label: "Wide 16:9" },
    ],
    countMax: 4,
    defaultCount: 3,
    supportsNegativePrompt: false,
    supportsSeed: false,
    supportsReferenceImage: false,
  },
  pricing: {
    basePerUnit: 0.04,
    unit: "image",
    notes: "Published rate, Imagen 3 standard.",
    publishedUrl: "https://ai.google.dev/pricing",
  },
};

const RUNWAY_IMAGE: Provider = {
  id: "runway-image",
  name: "Runway Gen-4 Image",
  vendor: "Runway",
  kind: "image",
  modelId: "gen4_image",
  envKeys: ["RUNWAYML_API_SECRET"],
  description: "Runway's text-to-image model. Designed to share a visual language with their video models — useful when the image will seed a Runway video.",
  async: true,
  knobs: {
    aspectRatios: [
      { id: "1024:1024", label: "Square 1:1" },
      { id: "1920:1080", label: "Wide 16:9" },
      { id: "1080:1920", label: "Tall 9:16" },
      { id: "1440:1080", label: "Landscape 4:3" },
      { id: "1080:1440", label: "Portrait 3:4" },
    ],
    countMax: 1,
    defaultCount: 1,
    supportsSeed: true,
  },
  pricing: {
    basePerUnit: 0.05,
    unit: "image",
    notes: "5 credits per image at $0.01/credit (Runway's published rate).",
    publishedUrl: "https://docs.dev.runwayml.com/guides/pricing/",
  },
};

const GROK_IMAGE: Provider = {
  id: "grok-image",
  name: "Grok Image",
  vendor: "xAI",
  kind: "image",
  modelId: "grok-imagine-image",
  envKeys: ["XAI_API_KEY"],
  description: "xAI's image model. Free during the Imagine preview, looser content rails than Imagen, no aspect-ratio control today.",
  knobs: {
    aspectRatios: [{ id: "1:1", label: "Square 1:1" }],
    countMax: 4,
    defaultCount: 2,
    supportsNegativePrompt: false,
    supportsSeed: false,
    supportsReferenceImage: true,
  },
  pricing: {
    basePerUnit: 0.07,
    unit: "image",
    notes: "See model picker for the cheaper preview tier.",
    isEstimate: true,
    publishedUrl: "https://docs.x.ai/docs/models",
  },
  models: [
    {
      id: "grok-imagine-image",
      label: "Grok Imagine (preview)",
      modelId: "grok-imagine-image",
      pricing: {
        basePerUnit: 0,
        unit: "image",
        notes: "Free during the Imagine preview tier — billed minutes only via the Imagine subscription.",
        isEstimate: true,
      },
      description: "Free during preview. Quality is similar to grok-2-image.",
    },
    {
      id: "grok-2-image",
      label: "Grok 2 Image",
      modelId: "grok-2-image",
      pricing: {
        basePerUnit: 0.07,
        unit: "image",
        notes: "Paid endpoint, listed at $0.07 per image.",
        publishedUrl: "https://docs.x.ai/docs/models",
      },
      description: "Published paid endpoint. More predictable for production work.",
    },
  ],
};

// ─── VIDEO PROVIDERS ───────────────────────────────────────────────

const VEO_3: Provider = {
  id: "veo-3",
  name: "Veo (Google)",
  vendor: "Google",
  kind: "video",
  modelId: "veo-3.0-generate-001",
  envKeys: ["GEMINI_API_KEY"],
  description: "Google's video model. 4-8s clips, person generation togglable. Switch between Veo 3 (with audio, $0.75/s) and Veo 2 (silent, $0.50/s) via the model picker.",
  async: true,
  knobs: {
    aspectRatios: [
      { id: "16:9", label: "Wide 16:9" },
      { id: "9:16", label: "Tall 9:16" },
    ],
    durations: [4, 6, 8],
    countMax: 1,
    defaultCount: 1,
    supportsNegativePrompt: false,
    supportsSeed: false,
    supportsFirstFrame: true,
    personGenerationOptions: [
      { id: "allow_adult", label: "Allow adults" },
      { id: "dont_allow", label: "No people" },
    ],
  },
  pricing: {
    basePerUnit: 0.75,
    unit: "video-second",
    notes: "Default Veo 3 pricing — switch to Veo 3 Fast or Veo 2 for cheaper options.",
    publishedUrl: "https://ai.google.dev/pricing",
  },
  models: [
    {
      id: "veo-3",
      label: "Veo 3 (with audio)",
      modelId: "veo-3.0-generate-001",
      pricing: { basePerUnit: 0.75, unit: "video-second", notes: "$0.75/sec — flagship Veo 3, includes native audio." },
      description: "Highest quality. Generates synced audio.",
    },
    {
      id: "veo-3-fast",
      label: "Veo 3 Fast (with audio)",
      modelId: "veo-3.0-fast-generate-001",
      pricing: { basePerUnit: 0.4, unit: "video-second", notes: "$0.40/sec — Veo 3 Fast, audio, ~2x quicker than Veo 3." },
      description: "Same audio support as Veo 3 at roughly half the price; lower visual fidelity.",
    },
    {
      id: "veo-2",
      label: "Veo 2 (silent)",
      modelId: "veo-2.0-generate-001",
      pricing: { basePerUnit: 0.5, unit: "video-second", notes: "$0.50/sec — Veo 2, silent output." },
      description: "Cheaper but no audio. Use when video will overlay your own track.",
    },
  ],
};

const GROK_VIDEO: Provider = {
  id: "grok-video",
  name: "Grok Imagine Video",
  vendor: "xAI",
  kind: "video",
  modelId: "grok-imagine-video",
  envKeys: ["XAI_API_KEY"],
  description: "xAI's video model. ~6 second clips, prompt-only today. Async.",
  async: true,
  knobs: {
    aspectRatios: [{ id: "16:9", label: "Wide 16:9" }],
    durations: [6],
    countMax: 1,
    defaultCount: 1,
    supportsNegativePrompt: false,
  },
  pricing: {
    basePerUnit: 0.5,
    unit: "video-clip",
    notes: "Estimate — Grok Imagine video pricing is still preview. Treat as a rough placeholder.",
    isEstimate: true,
    publishedUrl: "https://docs.x.ai/docs/models",
  },
};

const RUNWAY_VIDEO: Provider = {
  id: "runway-video",
  name: "Runway Video",
  vendor: "Runway",
  kind: "video",
  modelId: "gen4_turbo",
  envKeys: ["RUNWAYML_API_SECRET"],
  description: "Runway's image-to-video. Needs a reference image. Switch between Gen-4 Turbo, Gen-3 Alpha Turbo (both $0.05/s) and Gen-3 Alpha ($0.10/s) via the model picker.",
  async: true,
  knobs: {
    aspectRatios: [
      { id: "1280:720", label: "Wide 16:9" },
      { id: "720:1280", label: "Tall 9:16" },
      { id: "960:960", label: "Square 1:1" },
      { id: "1104:832", label: "Landscape 4:3" },
      { id: "832:1104", label: "Portrait 3:4" },
    ],
    durations: [5, 10],
    countMax: 1,
    defaultCount: 1,
    supportsFirstFrame: true,
    firstFrameRequired: true,
    supportsLastFrame: true,
    supportsSeed: true,
  },
  pricing: {
    basePerUnit: 0.05,
    unit: "video-second",
    notes: "Default Gen-4 Turbo. Switch to Gen-3 Alpha for top-quality motion at 2x the cost.",
    publishedUrl: "https://docs.dev.runwayml.com/guides/pricing/",
  },
  models: [
    {
      id: "gen4_turbo",
      label: "Gen-4 Turbo",
      modelId: "gen4_turbo",
      pricing: { basePerUnit: 0.05, unit: "video-second", notes: "5 credits/sec — current Gen-4 fast tier." },
      description: "Default. Best balance of motion + price + speed.",
    },
    {
      id: "gen3a_turbo",
      label: "Gen-3 Alpha Turbo",
      modelId: "gen3a_turbo",
      pricing: { basePerUnit: 0.05, unit: "video-second", notes: "5 credits/sec — Gen-3 Alpha fast." },
      description: "Same price as Gen-4 Turbo, slightly different aesthetic. Older model.",
    },
    {
      id: "gen3a",
      label: "Gen-3 Alpha (full)",
      modelId: "gen3a",
      pricing: { basePerUnit: 0.1, unit: "video-second", notes: "10 credits/sec — full Gen-3 Alpha, highest fidelity." },
      description: "Slowest, most expensive, often the best motion quality.",
    },
  ],
};

export const PROVIDERS: Provider[] = [
  IMAGEN_3,
  RUNWAY_IMAGE,
  GROK_IMAGE,
  VEO_3,
  RUNWAY_VIDEO,
  GROK_VIDEO,
];

export function providersByKind(kind: Kind): Provider[] {
  return PROVIDERS.filter((p) => p.kind === kind);
}

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export interface CostBreakdown {
  dollars: number;
  perUnit: number;
  unit: string;
  units: number;
  formula: string;
  isEstimate: boolean;
}

export function estimateCost(provider: Provider, knobs: KnobValues): CostBreakdown {
  const count = Math.max(1, knobs.count || 1);
  const duration = knobs.duration || (provider.knobs.durations ? provider.knobs.durations[0] : 5);
  const active = getActiveModel(provider, knobs);
  const pricing = active.pricing;

  if (pricing.unit === "image") {
    return {
      dollars: pricing.basePerUnit * count,
      perUnit: pricing.basePerUnit,
      unit: "image",
      units: count,
      formula: `${count} image${count === 1 ? "" : "s"} × $${pricing.basePerUnit.toFixed(3)} (${active.label})`,
      isEstimate: !!pricing.isEstimate,
    };
  }

  if (pricing.unit === "video-second") {
    const dollars = pricing.basePerUnit * duration * count;
    return {
      dollars,
      perUnit: pricing.basePerUnit,
      unit: "second",
      units: duration * count,
      formula: `${count} clip${count === 1 ? "" : "s"} × ${duration}s × $${pricing.basePerUnit.toFixed(2)}/s (${active.label})`,
      isEstimate: !!pricing.isEstimate,
    };
  }

  return {
    dollars: pricing.basePerUnit * count,
    perUnit: pricing.basePerUnit,
    unit: "clip",
    units: count,
    formula: `${count} clip${count === 1 ? "" : "s"} × $${pricing.basePerUnit.toFixed(2)} (${active.label})`,
    isEstimate: !!pricing.isEstimate,
  };
}

export function formatCost(dollars: number): string {
  if (dollars < 0.01) return "<$0.01";
  if (dollars < 1) return `$${dollars.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${dollars.toFixed(2)}`;
}
