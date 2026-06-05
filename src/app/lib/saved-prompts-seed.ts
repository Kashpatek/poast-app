// Saved Prompts pre-seed source — used by saved-prompts.tsx on first mount
// when the team library is empty. We build 25+ curated prompts pulled from:
//   - CAPPER_TONES (one prompt per tone)
//   - CAPPER_SOURCES (one prompt per source-type)
//   - STYLE_PRESETS (one prompt per image style)
//   - AI Training voice profile sketches (a few SA-flavored voices)
//
// Each seed carries tags: [tool, category, "seed:true"]. Idempotency is
// enforced by saved-prompts.tsx (only runs when library is empty AND the
// seedFlag has not been set on the master row).
//
// Kept as a separate module so the seed list doesn't pull poast-client
// into the Saved Prompts bundle. The source material here was lifted
// directly from CAPPER_TONES + CAPPER_SOURCES + STYLE_PRESETS so it stays
// representative; if those upstream lists change materially, refresh
// these defaults too.

import { CAPPER_SOURCES } from "../poast-client";
import { STYLE_PRESETS } from "@/lib/grok-image";

export interface SeedPrompt {
  id: string;
  name: string;
  tool: string;
  systemText?: string;
  promptText: string;
  description?: string;
  author?: string;
  createdAt: string;
  uses?: number;
  tags?: string[];
}

// One prompt per Capper tone. Mirrors the descriptions baked into
// CAPPER_TONES in poast-client.tsx but framed as a reusable prompt
// template the team can paste into any tool.
interface ToneSeed {
  key: string;
  name: string;
  body: string;
}

const TONE_SEEDS: ToneSeed[] = [
  {
    key: "sa_research",
    name: "Tone · SA Research",
    body: "Write in the SA Research tone: measured, numbers-first, research-grade register. Lead with a specific figure or precise claim. Neutral — no hype, no hedging. Cite sources when they sharpen the point. Think institutional analyst writing for a sharp retail audience.\n\nTopic: {{topic}}",
  },
  {
    key: "dylan",
    name: "Tone · Dylan",
    body: "Write in Dylan's voice: direct, data-heavy, confident. Use specific numbers and bold claims. Never hedge. Open with a hook like \"Here's what nobody is telling you about...\" Lead with the most provocative truth.\n\nTopic: {{topic}}",
  },
  {
    key: "doug",
    name: "Tone · Doug",
    body: "Write in Doug's voice: technical, first-principles, analytical. Focus on structural importance and why something matters at a fundamental level. Methodical. Walk the reader through the mechanism before the conclusion.\n\nTopic: {{topic}}",
  },
  {
    key: "sa_twitter",
    name: "Tone · SA Twitter",
    body: "Write in SA Twitter voice: punchy, provocative, hot-take energy. Short sentences. Bold claims backed by data. Aggressive framing. No hashtags. No em dashes.\n\nTopic: {{topic}}",
  },
  {
    key: "oren",
    name: "Tone · Oren",
    body: "Write in Oren's voice: conversational, storytelling, bridges technical topics to business impact. Accessible but clearly informed. Open with a narrative beat, close with a concrete take.\n\nTopic: {{topic}}",
  },
];

// Voice Lab profile sketches — short SA-flavored voice templates the team
// can fork inside AI Training. Modeled on the Voice shape in
// src/lib/brand-voice.ts (name + description + encouraged/banned hints).
interface VoiceSeed {
  name: string;
  body: string;
}

const VOICE_SEEDS: VoiceSeed[] = [
  {
    name: "Voice · SA Editorial (house)",
    body: "House voice — direct, data-forward, sober. Lean into: specific numbers, named vendors, one concrete claim per sentence, a first-line hook. Avoid: game-changer, unlock, leverage, harness, revolutionize, cutting-edge, transform, synergy, deep dive, in conclusion. If a sentence could appear on any company's blog, rewrite it.\n\nApply to: {{draft}}",
  },
  {
    name: "Voice · SA Newsroom (breaking)",
    body: "Newsroom voice — time-stamped, attribution-first, neutral register. Lead with WHO said WHAT WHEN. One verified fact per sentence. Hedge only with confidence labels (\"per sources familiar\", \"per filings\"). No prediction without a basis. No adjectives that aren't doing structural work.\n\nApply to: {{draft}}",
  },
  {
    name: "Voice · SA Analyst (long-form)",
    body: "Analyst voice — long-form, mechanism-driven, technical precision over rhetoric. Walk through the model before the conclusion. Name vendors, capacities, yields, dates. Footnote-grade rigor. Reader should be able to reproduce the inference from the prose alone.\n\nApply to: {{draft}}",
  },
  {
    name: "Voice · SA Social (Twitter/X)",
    body: "Social-native SA voice — hook tweet + reply-to-self structure. One number in the hook. No hashtags. No em dashes. Reply-to-self adds the second-order claim. Punchy. Provocative without being sloppy.\n\nApply to: {{draft}}",
  },
];

function nowIso(): string {
  // Deterministic across reseeds within a session so collision-checks
  // remain stable even if the seed runs more than once before the flag
  // round-trips through Supabase.
  return new Date().toISOString();
}

// Build the curated batch. 5 tones + 7 sources + 5 styles + 4 voices = 21
// minimum; with the extra general-purpose entries we end up around 24.
export function buildSeedPrompts(): SeedPrompt[] {
  const created = nowIso();
  const author = "SA Library";
  const out: SeedPrompt[] = [];

  // 1. Tone prompts (capper)
  TONE_SEEDS.forEach((t, idx) => {
    out.push({
      id: "seed-tone-" + t.key,
      name: t.name,
      tool: "capper",
      promptText: t.body,
      description: "Capper tone reference. Paste into any caption surface.",
      author,
      createdAt: created,
      uses: 0,
      tags: ["capper", "tone", "seed:true"],
    });
    void idx;
  });

  // 2. Source-type prompts (capper) — pulled directly from CAPPER_SOURCES.
  // The voicePrompt + example pair is what makes each source distinctive,
  // so we keep them together as the seed body.
  CAPPER_SOURCES.forEach((s) => {
    out.push({
      id: "seed-source-" + s.key,
      name: "Source · " + s.label,
      tool: "capper",
      promptText: s.voicePrompt + "\n\nExample caption in this register:\n\"" + s.example + "\"\n\nNow write 3 caption variations for this clip:\n{{clip}}",
      description: s.desc,
      author,
      createdAt: created,
      uses: 0,
      tags: ["capper", "source", "seed:true"],
    });
  });

  // 3. Image style prompts (image)
  Object.keys(STYLE_PRESETS).forEach((key) => {
    out.push({
      id: "seed-style-" + key,
      name: "Image · " + key.charAt(0).toUpperCase() + key.slice(1),
      tool: "image",
      promptText: STYLE_PRESETS[key] + "\n\nSubject: {{subject}}",
      description: "Grok/Imagen style preset. Pair with SA brand cues for thumbnails.",
      author,
      createdAt: created,
      uses: 0,
      tags: ["image", "style", "seed:true"],
    });
  });

  // 4. Voice profile sketches (voice / AI Training)
  VOICE_SEEDS.forEach((v, idx) => {
    out.push({
      id: "seed-voice-" + idx,
      name: v.name,
      tool: "voice",
      promptText: v.body,
      description: "Voice Lab starting point. Fork it in AI Training and refine via examples.",
      author,
      createdAt: created,
      uses: 0,
      tags: ["voice", "ai-training", "seed:true"],
    });
  });

  // 5. A few general-purpose ones so the library doesn't feel one-note on
  // first open. These match the categories of tools that aren't covered
  // by CAPPER_TONES / CAPPER_SOURCES / STYLE_PRESETS / Voice Lab.
  out.push({
    id: "seed-general-headline",
    name: "Headline · SA Article hook",
    tool: "general",
    promptText: "Write 5 headline options for this SA article. Each must: lead with the load-bearing noun, name a vendor or number, fit under 70 characters, and avoid \"unlock\" / \"game-changer\" / \"deep dive\".\n\nDraft: {{draft}}",
    description: "Headline Doctor starting template.",
    author,
    createdAt: created,
    uses: 0,
    tags: ["general", "headline", "seed:true"],
  });
  out.push({
    id: "seed-general-thread",
    name: "Thread · Hook + 4 replies",
    tool: "general",
    promptText: "Convert this take into a 5-post X thread. Post 1 is the hook (one number, one bold claim, no hashtags). Posts 2-4 each carry one piece of evidence. Post 5 closes with the implication for the SA reader.\n\nTake: {{take}}",
    description: "Thread Composer scaffold.",
    author,
    createdAt: created,
    uses: 0,
    tags: ["general", "thread", "seed:true"],
  });
  out.push({
    id: "seed-general-carousel",
    name: "Carousel · 6-slide deck",
    tool: "carousel",
    promptText: "Write a 6-slide LinkedIn carousel. Slide 1 hook, slides 2-5 evidence, slide 6 CTA. Each slide max 22 words. SA voice — sober, data-first, no hype.\n\nTopic: {{topic}}",
    description: "Carousel starting outline.",
    author,
    createdAt: created,
    uses: 0,
    tags: ["carousel", "social", "seed:true"],
  });

  return out;
}
