// Token / dollar cost estimator for Premier Suite jobs. Surfaces a clear
// preview in the Format step before the user commits to multi-size export
// (which 3× the b-roll generation cost).
//
// Numbers are approximations as of 2026 — easy to update in one place when
// pricing shifts. Override via env vars if you have a custom rate card.

export interface CostEstimateInput {
  scriptDurationSec: number;     // expected final video length
  brollShotCount: number;        // distinct b-roll shots
  aspects: Array<"16:9" | "9:16" | "1:1">;   // 1 entry for single, 3 for multi
  useEnvatoOnly?: boolean;       // skip Grok b-roll if user pre-picked from stock
  voCharacterCount?: number;     // approx VO script length in chars
}

export interface CostLineItem {
  label: string;
  detail: string;
  unitCost: number;
  units: number;
  total: number;
}

export interface CostEstimate {
  lines: CostLineItem[];
  totalUSD: number;
  totalSingleAspectUSD: number;
  totalMultiAspectUSD: number;
}

// Pricing approximations. Source comments inline.
function rate(key: string, fallback: number): number {
  if (typeof process !== "undefined" && process.env?.[key]) {
    const n = Number(process.env[key]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

const PRICING = {
  // Claude script generation — roughly 12k input + 2k output tokens for a
  // standard brief. Sonnet at ~$3/MTok input + $15/MTok output.
  claudeBriefUSD:           () => rate("PRICE_CLAUDE_BRIEF",     0.05),
  // ElevenLabs TTS — ~$0.15 per 1k chars on Creator tier.
  elevenLabsPerKChars:      () => rate("PRICE_ELEVENLABS_TTS_K", 0.15),
  // ElevenLabs sound generation — flat per call.
  elevenLabsMusicUSD:       () => rate("PRICE_ELEVENLABS_MUSIC", 0.03),
  // Grok / Kling video generation per shot.
  brollPerShotUSD:          () => rate("PRICE_BROLL_PER_SHOT",   0.05),
  // GitHub Actions render — effectively free on hosted runners (within free
  // tier of 2000 min/mo).
  renderJobUSD:             () => rate("PRICE_RENDER_JOB",       0.00),
};

export function estimateCost(input: CostEstimateInput): CostEstimate {
  const { scriptDurationSec, brollShotCount, aspects, useEnvatoOnly, voCharacterCount } = input;
  const aspectCount = Math.max(1, aspects.length);
  const lines: CostLineItem[] = [];

  // Claude brief — fired once regardless of aspect count.
  const claudeUSD = PRICING.claudeBriefUSD();
  lines.push({
    label: "Claude script + brief",
    detail: "~12k tokens (one generation)",
    unitCost: claudeUSD,
    units: 1,
    total: claudeUSD,
  });

  // VO — single pass shared across aspects.
  const voChars = voCharacterCount ?? Math.max(500, scriptDurationSec * 25); // ~25 chars/sec
  const voK = voChars / 1000;
  const voUSD = voK * PRICING.elevenLabsPerKChars();
  lines.push({
    label: "ElevenLabs voiceover",
    detail: `~${voChars.toLocaleString()} characters`,
    unitCost: PRICING.elevenLabsPerKChars(),
    units: voK,
    total: voUSD,
  });

  // Music — single pass.
  const musicUSD = PRICING.elevenLabsMusicUSD();
  lines.push({
    label: "ElevenLabs music",
    detail: "1 generation, looped in render",
    unitCost: musicUSD,
    units: 1,
    total: musicUSD,
  });

  // B-roll — single aspect cost is shots × per-shot. Multi-aspect either
  // regenerates per aspect (3×) or re-crops (1×). Default plan re-crops, so
  // we charge for ONE generation pass but flag multi as a higher upper bound.
  const brollShots = useEnvatoOnly ? 0 : brollShotCount;
  const brollSingleUSD = brollShots * PRICING.brollPerShotUSD();
  lines.push({
    label: useEnvatoOnly ? "B-roll (Envato only)" : "B-roll (Grok/Kling video)",
    detail: useEnvatoOnly
      ? "No generation — using your stock"
      : `${brollShotCount} shots, single aspect`,
    unitCost: PRICING.brollPerShotUSD(),
    units: brollShots,
    total: brollSingleUSD,
  });

  // Render — per aspect.
  const renderUSD = PRICING.renderJobUSD();
  lines.push({
    label: "Render compute",
    detail: `${aspectCount} job${aspectCount === 1 ? "" : "s"} on GitHub Actions`,
    unitCost: renderUSD,
    units: aspectCount,
    total: renderUSD * aspectCount,
  });

  // Single total: assumes re-crop strategy (one b-roll gen, N renders).
  const totalSingleAspectUSD = claudeUSD + voUSD + musicUSD + brollSingleUSD + renderUSD;
  const totalMultiAspectUSD =
    claudeUSD + voUSD + musicUSD + brollSingleUSD + renderUSD * 3;
  const totalUSD = aspectCount === 1 ? totalSingleAspectUSD : totalMultiAspectUSD;

  return { lines, totalUSD, totalSingleAspectUSD, totalMultiAspectUSD };
}

// Pretty-format a CostEstimate for inline UI.
export function formatCost(c: CostEstimate): string {
  return c.lines
    .map((l) => `${l.label}: $${l.total.toFixed(2)} (${l.detail})`)
    .join("\n");
}
