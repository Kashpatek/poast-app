// Brand voice — a library of named voice profiles. Each profile has tone
// dials, encouraged / banned phrase lists, and tagged good/bad examples.
// The active voice is auto-injected into caption-gen system prompts when
// the caller sets applyBrandVoice on /api/generate.
//
// Always-on anti-bot rules also get injected regardless of voice state,
// so even with no profile saved the model gets the basic "don't sound
// like a press release" guardrails.

import { createClient } from "@/app/lib/neon-db";

export interface VoiceTone {
  // 0=institutional, 1=direct, 2=casual, 3=playful
  formality: number;
  // 0=sober, 1=confident, 2=sharp, 3=spicy
  spice: number;
  // 0=terse, 1=standard, 2=verbose
  length: number;
  // 0=technical, 1=mixed, 2=accessible
  vocab: number;
}

export interface VoiceExample {
  id: string;
  text: string;
  kind: "good" | "bad";
  note?: string;
}

export interface Voice {
  id: string;
  name: string;
  description?: string;
  tone: VoiceTone;
  banned: string[];
  encouraged: string[];
  examples: VoiceExample[];
  notes?: string;
  updatedAt?: string;
}

export interface VoicesArchive {
  voices: Voice[];
  defaultId: string;
}

// ─── Legacy shape (single brand voice as flat fields) ────────────────
// Migration: the first time we load a row written under the old shape
// we wrap it in a single "SA Editorial" voice and resave on next save.
export interface LegacyBrandVoice {
  tone?: string;
  banned?: string;
  encouraged?: string;
  goodExamples?: string;
  badExamples?: string;
  notes?: string;
  updatedAt?: string;
}

export const BRAND_VOICE_ID = "brand-voice-master";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

let cache: { archive: VoicesArchive | null; fetchedAt: number } | null = null;
const CACHE_MS = 30_000;

export function defaultArchive(): VoicesArchive {
  const seed: Voice = {
    id: "v-sa-editorial",
    name: "SA Editorial",
    description: "House voice — direct, data-forward, sober.",
    tone: { formality: 1, spice: 1, length: 1, vocab: 0 },
    banned: ["game-changer", "unlock", "leverage", "harness", "revolutionize", "cutting-edge", "transform", "synergy", "deep dive", "in conclusion"],
    encouraged: ["specific numbers", "named vendors", "one concrete claim per sentence", "first-line hook"],
    examples: [
      {
        id: "ex-1",
        kind: "good",
        text: "NVIDIA Blackwell GB200 yields just crossed 90%, six months ahead of the schedule TSMC quietly internalized in Q1. Microsoft and Meta picked up the first slack.",
        note: "Specific number, named entity, concrete second sentence.",
      },
      {
        id: "ex-2",
        kind: "bad",
        text: "We're excited to dive into a game-changing breakthrough that unlocks new possibilities for the AI infrastructure ecosystem.",
        note: "Empty calories. No specific claim, banned phrases, marketing rhythm.",
      },
    ],
    notes: "If a sentence could appear on any company's blog, rewrite it.",
  };
  return { voices: [seed], defaultId: seed.id };
}

function migrate(raw: unknown): VoicesArchive {
  if (!raw || typeof raw !== "object") return defaultArchive();
  const r = raw as { voices?: Voice[]; defaultId?: string };
  if (Array.isArray(r.voices) && r.voices.length) {
    return { voices: r.voices, defaultId: r.defaultId || r.voices[0].id };
  }
  // Legacy single-voice flat shape → wrap into one "SA Editorial" voice.
  const legacy = raw as LegacyBrandVoice;
  if (legacy.tone || legacy.banned || legacy.encouraged || legacy.goodExamples || legacy.badExamples || legacy.notes) {
    const seeded = defaultArchive();
    const v = seeded.voices[0];
    return {
      voices: [
        {
          ...v,
          notes: legacy.notes || v.notes,
          banned: legacy.banned ? legacy.banned.split(",").map((s) => s.trim()).filter(Boolean) : v.banned,
          encouraged: legacy.encouraged ? legacy.encouraged.split(",").map((s) => s.trim()).filter(Boolean) : v.encouraged,
          examples: [
            ...(legacy.goodExamples ? [{ id: "ex-mig-good", kind: "good" as const, text: legacy.goodExamples }] : []),
            ...(legacy.badExamples ? [{ id: "ex-mig-bad", kind: "bad" as const, text: legacy.badExamples }] : []),
          ].length ? [
            ...(legacy.goodExamples ? [{ id: "ex-mig-good", kind: "good" as const, text: legacy.goodExamples }] : []),
            ...(legacy.badExamples ? [{ id: "ex-mig-bad", kind: "bad" as const, text: legacy.badExamples }] : []),
          ] : v.examples,
        },
      ],
      defaultId: v.id,
    };
  }
  return defaultArchive();
}

export async function loadVoicesArchive(): Promise<VoicesArchive> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS && cache.archive) return cache.archive;
  const supabase = getSupabase();
  if (!supabase) {
    const fallback = defaultArchive();
    cache = { archive: fallback, fetchedAt: Date.now() };
    return fallback;
  }
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("data")
      .eq("id", BRAND_VOICE_ID)
      .eq("type", "brand-voice")
      .maybeSingle();
    if (error || !data) {
      const fallback = defaultArchive();
      cache = { archive: fallback, fetchedAt: Date.now() };
      return fallback;
    }
    const archive = migrate((data as { data?: unknown }).data);
    cache = { archive, fetchedAt: Date.now() };
    return archive;
  } catch {
    const fallback = defaultArchive();
    cache = { archive: fallback, fetchedAt: Date.now() };
    return fallback;
  }
}

export function invalidateBrandVoiceCache() {
  cache = null;
}

// ─── Tone → prose ────────────────────────────────────────────────────
export const TONE_LABELS = {
  formality: ["Institutional", "Direct", "Casual", "Playful"],
  spice: ["Sober", "Confident", "Sharp", "Spicy"],
  length: ["Terse", "Standard", "Verbose"],
  vocab: ["Technical", "Mixed", "Accessible"],
};

const FORMALITY_PROSE = [
  "Institutional — full sentences, sober register, no contractions",
  "Direct — short sentences, no fluff, contractions OK",
  "Casual — conversational, contractions, occasional fragments",
  "Playful — willing to break rhythm, use a wink, never cringe",
];
const SPICE_PROSE = [
  "Sober — let the data speak, no editorializing",
  "Confident — say what you think, no hedging",
  "Sharp — name names, pick sides, make claims falsifiable",
  "Spicy — willing to provoke; never below the belt",
];
const LENGTH_PROSE = [
  "Terse — one or two short sentences",
  "Standard — 2-4 sentences, every one earning its place",
  "Verbose — fully developed paragraph but no padding",
];
const VOCAB_PROSE = [
  "Technical — assume reader knows the domain, name parts and processes",
  "Mixed — explain just enough that an informed outsider follows",
  "Accessible — translate jargon; metaphors OK if accurate",
];

function tonePromptBlock(t: VoiceTone): string {
  return [
    "- " + FORMALITY_PROSE[Math.min(3, Math.max(0, t.formality))],
    "- " + SPICE_PROSE[Math.min(3, Math.max(0, t.spice))],
    "- " + LENGTH_PROSE[Math.min(2, Math.max(0, t.length))],
    "- " + VOCAB_PROSE[Math.min(2, Math.max(0, t.vocab))],
  ].join("\n");
}

// Always-on baseline rules. Apply even when there's no saved voice so the
// model never produces obvious bot-isms regardless of training state.
export const ANTI_BOT_BASELINE =
  "Anti-bot rules (always apply):\n" +
  "- No em dashes. Use periods or commas instead.\n" +
  "- No emojis.\n" +
  "- No three-dot ellipses.\n" +
  "- Vary sentence length: mix short (5-9 words) with medium (12-20).\n" +
  "- Don't begin two adjacent sentences with the same word.\n" +
  "- One concrete claim per sentence. Specific numbers and named entities beat generic adjectives.\n" +
  "- Active voice. Direct verbs.\n" +
  "- Permit fragments when a writer would use them.\n" +
  "- Avoid these phrases entirely: game-changer, unlock, leverage, harness, revolutionize, cutting-edge, transform, synergy, deep dive, dive into, in conclusion, it's worth noting, in today's fast-paced.\n" +
  "- Never start with 'In the world of', 'In an era where', 'As we know'.\n" +
  "- If a sentence could appear on any company's blog without changes, rewrite it.";

export function buildVoiceBlock(voice: Voice | null): string {
  const head = "\n\n--- VOICE GUIDELINES ---\n" + ANTI_BOT_BASELINE;
  if (!voice) return head + "\n--- END VOICE ---";
  const parts: string[] = [];
  parts.push(`\nVoice profile: ${voice.name}` + (voice.description ? ` — ${voice.description}` : ""));
  parts.push("Tone & rhythm:\n" + tonePromptBlock(voice.tone));
  if (voice.encouraged.length) parts.push("Lean into: " + voice.encouraged.join(", "));
  if (voice.banned.length) parts.push("Never use these (in addition to the baseline): " + voice.banned.join(", "));
  const goods = voice.examples.filter((e) => e.kind === "good" && e.text.trim());
  const bads = voice.examples.filter((e) => e.kind === "bad" && e.text.trim());
  if (goods.length) {
    parts.push(
      "GOOD examples (match this rhythm and density):\n" +
        goods.map((e) => `• "${e.text.trim()}"` + (e.note?.trim() ? ` [why: ${e.note.trim()}]` : "")).join("\n")
    );
  }
  if (bads.length) {
    parts.push(
      "BAD examples (avoid this style):\n" +
        bads.map((e) => `• "${e.text.trim()}"` + (e.note?.trim() ? ` [why: ${e.note.trim()}]` : "")).join("\n")
    );
  }
  if (voice.notes?.trim()) parts.push("Notes: " + voice.notes.trim());
  return head + "\n" + parts.join("\n\n") + "\n--- END VOICE ---";
}

// Apply the *default* voice. Callers that want a specific profile can call
// loadVoicesArchive() and pick a voice themselves, then pass it through
// buildVoiceBlock + their own system prompt.
export async function applyBrandVoice(systemPrompt: string, voiceId?: string): Promise<string> {
  const archive = await loadVoicesArchive();
  const id = voiceId || archive.defaultId;
  const voice = archive.voices.find((v) => v.id === id) || archive.voices[0] || null;
  return systemPrompt + buildVoiceBlock(voice);
}
