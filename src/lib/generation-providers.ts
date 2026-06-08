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
  supportsReferenceImage?: boolean;
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

export interface Provider {
  id: string;
  name: string;
  vendor: string;
  kind: Kind;
  modelId: string;
  envKeys: string[];
  description: string;
  knobs: KnobSpec;
  pricing: PricingSpec;
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
    notes: "Estimate — xAI's image endpoint is currently free during Imagine preview but paid grok-2-image is listed at ~$0.07/image.",
    isEstimate: true,
    publishedUrl: "https://docs.x.ai/docs/models",
  },
};

// ─── VIDEO PROVIDERS ───────────────────────────────────────────────

const VEO_3: Provider = {
  id: "veo-3",
  name: "Veo 3",
  vendor: "Google",
  kind: "video",
  modelId: "veo-3.0-generate-001",
  envKeys: ["GEMINI_API_KEY"],
  description: "Google's flagship video model. 8s clips, native sound, 16:9 or 9:16, person generation togglable.",
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
    personGenerationOptions: [
      { id: "allow_adult", label: "Allow adults" },
      { id: "dont_allow", label: "No people" },
    ],
  },
  pricing: {
    basePerUnit: 0.75,
    unit: "video-second",
    notes: "Published list price: $0.75 per second of Veo 3 output.",
    publishedUrl: "https://ai.google.dev/pricing",
  },
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
  name: "Runway Gen-4 Turbo",
  vendor: "Runway",
  kind: "video",
  modelId: "gen4_turbo",
  envKeys: ["RUNWAYML_API_SECRET"],
  description: "Runway's image-to-video. Needs a reference image (Runway Gen-4 Image or an uploaded still). Best motion quality in this list.",
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
    supportsReferenceImage: true,
    supportsSeed: true,
  },
  pricing: {
    basePerUnit: 0.05,
    unit: "video-second",
    notes: "5 credits per second at $0.01/credit. Turbo tier; Alpha is 10c/sec ($0.10/s).",
    publishedUrl: "https://docs.dev.runwayml.com/guides/pricing/",
  },
};

const KLING_V1: Provider = {
  id: "kling-v1",
  name: "Kling v1",
  vendor: "Kuaishou",
  kind: "video",
  modelId: "kling-v1",
  envKeys: ["KLING_ACCESS_KEY", "KLING_SECRET_KEY"],
  description: "Kuaishou's text-to-video. 5 or 10 second clips, 16:9 / 9:16 / 1:1, supports negative prompt + seed. Async.",
  async: true,
  knobs: {
    aspectRatios: [
      { id: "16:9", label: "Wide 16:9" },
      { id: "9:16", label: "Tall 9:16" },
      { id: "1:1", label: "Square 1:1" },
    ],
    durations: [5, 10],
    countMax: 1,
    defaultCount: 1,
    supportsNegativePrompt: true,
    supportsSeed: false,
  },
  pricing: {
    basePerUnit: 0.07,
    unit: "video-second",
    notes: "Approx — Kling charges in credits ($0.35 per 5s standard, scales with quality tier).",
    isEstimate: true,
    publishedUrl: "https://klingai.com/pricing",
  },
};

export const PROVIDERS: Provider[] = [
  IMAGEN_3,
  RUNWAY_IMAGE,
  GROK_IMAGE,
  VEO_3,
  RUNWAY_VIDEO,
  GROK_VIDEO,
  KLING_V1,
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

  if (provider.pricing.unit === "image") {
    return {
      dollars: provider.pricing.basePerUnit * count,
      perUnit: provider.pricing.basePerUnit,
      unit: "image",
      units: count,
      formula: `${count} image${count === 1 ? "" : "s"} × $${provider.pricing.basePerUnit.toFixed(3)}`,
      isEstimate: !!provider.pricing.isEstimate,
    };
  }

  if (provider.pricing.unit === "video-second") {
    const dollars = provider.pricing.basePerUnit * duration * count;
    return {
      dollars,
      perUnit: provider.pricing.basePerUnit,
      unit: "second",
      units: duration * count,
      formula: `${count} clip${count === 1 ? "" : "s"} × ${duration}s × $${provider.pricing.basePerUnit.toFixed(2)}/s`,
      isEstimate: !!provider.pricing.isEstimate,
    };
  }

  return {
    dollars: provider.pricing.basePerUnit * count,
    perUnit: provider.pricing.basePerUnit,
    unit: "clip",
    units: count,
    formula: `${count} clip${count === 1 ? "" : "s"} × $${provider.pricing.basePerUnit.toFixed(2)}`,
    isEstimate: !!provider.pricing.isEstimate,
  };
}

export function formatCost(dollars: number): string {
  if (dollars < 0.01) return "<$0.01";
  if (dollars < 1) return `$${dollars.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${dollars.toFixed(2)}`;
}
