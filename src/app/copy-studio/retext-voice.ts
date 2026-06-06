"use client";

// Deterministic, client-side voice scoring built on top of the retext
// ecosystem. Runs instantly (no network round-trip) so the Brand Voice Gate
// can show *something* while the LLM-backed /api/voice-scorer call is in
// flight. The rubric mirrors the four dimensions used by the LLM scorer
// (Voice / Specificity / Directness / Platform fit) so the two panels can
// sit side by side without the user re-learning a new vocabulary.
//
// retext + its plugins are ESM-only and async, so this module performs all
// imports lazily inside `retextAnalyze` and the consumer must call it from
// the client.

export interface RetextRubric {
  voice: number;        // 0-3
  specificity: number;  // 0-3
  directness: number;   // 0-2
  platformFit: number;  // 0-2
}

export type RetextFlagKind = "passive" | "hype" | "weak" | "equality";

export interface RetextFlag {
  start: number;
  end: number;
  kind: RetextFlagKind;
  message: string;
}

export interface RetextAnalysis {
  passiveCount: number;
  weakHypeCount: number;
  readability: { fleschKincaid: number; grade: number };
  equalityWarnings: number;
  rubric: RetextRubric;
  inlineFlags: RetextFlag[];
}

// Cached unified processor — the dynamic imports only need to happen once
// per page load. We key off the platform string but currently treat all
// platforms the same; the field is plumbed so a future caller can swap in a
// platform-specific plugin chain without touching consumers.
let processorPromise: Promise<{ process: (text: string) => Promise<unknown> }> | null = null;

async function getProcessor() {
  if (processorPromise) return processorPromise;
  processorPromise = (async () => {
    const [{ retext }, retextPassive, retextIntensify, retextReadability, retextEquality] = await Promise.all([
      import("retext"),
      import("retext-passive"),
      import("retext-intensify"),
      import("retext-readability"),
      import("retext-equality"),
    ]);
    // Each plugin module ships a default export.
    const proc = retext()
      .use(retextPassive.default)
      .use(retextIntensify.default)
      .use(retextReadability.default, { age: 18 })
      .use(retextEquality.default);
    return {
      process: (text: string) => proc.process(text) as Promise<unknown>,
    };
  })();
  return processorPromise;
}

// Lightweight shape mirroring the bits of VFile + VFileMessage we touch. We
// intentionally keep this loose — retext's TS surface is in flux and we'd
// rather not couple to it for a strictly read-only consumer.
interface RetextMessageLike {
  source?: string | null;
  ruleId?: string | null;
  reason?: string;
  message?: string;
  place?: {
    start?: { offset?: number };
    end?: { offset?: number };
  } | null;
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  } | null;
}

interface RetextFileLike {
  messages?: RetextMessageLike[];
}

function offsetsOf(msg: RetextMessageLike, fallback: number): { start: number; end: number } {
  const place = msg.place || msg.position;
  const start = place?.start?.offset;
  const end = place?.end?.offset;
  return {
    start: typeof start === "number" ? start : fallback,
    end: typeof end === "number" ? end : fallback,
  };
}

// ─── Flesch-Kincaid (deterministic, no plugin dependency) ──────────
// retext-readability emits *warnings* rather than raw scores. We compute
// the actual numbers ourselves so the UI can show a single readability
// grade chip without parsing message strings.
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

function fleschKincaidGrade(text: string): { fleschKincaid: number; grade: number } {
  const trimmed = text.trim();
  if (!trimmed) return { fleschKincaid: 0, grade: 0 };
  const sentenceMatches = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentences = Math.max(1, sentenceMatches.length);
  const wordMatches = trimmed.match(/[A-Za-z0-9']+/g) || [];
  const words = Math.max(1, wordMatches.length);
  let syllables = 0;
  for (const w of wordMatches) syllables += countSyllables(w);
  syllables = Math.max(1, syllables);
  // Flesch Reading Ease: 206.835 − 1.015(W/S) − 84.6(Sy/W)
  const ease = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  // Flesch-Kincaid Grade Level: 0.39(W/S) + 11.8(Sy/W) − 15.59
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return {
    fleschKincaid: Math.round(ease * 10) / 10,
    grade: Math.round(grade * 10) / 10,
  };
}

// ─── Specificity heuristic ─────────────────────────────────────────
// Real numbers, percentages, and named entities are the SemiAnalysis
// fingerprint. We approximate this by counting digit-bearing tokens and
// proper-noun-shaped tokens per 100 words.
function specificityDensity(text: string): number {
  const tokens = text.match(/\S+/g) || [];
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (/\d/.test(t)) { hits++; continue; }
    // Acronyms (TSMC, GPU) and proper nouns (CoreWeave) — uppercase letter
    // not at sentence start. Cheap heuristic; the LLM scorer remains the
    // source of truth.
    if (/^[A-Z][A-Za-z0-9]*[A-Z]/.test(t) || /^[A-Z][a-z]+[A-Z]/.test(t)) hits++;
  }
  const words = tokens.length;
  return (hits / words) * 100; // hits per 100 words
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export async function retextAnalyze(text: string): Promise<RetextAnalysis> {
  const empty: RetextAnalysis = {
    passiveCount: 0,
    weakHypeCount: 0,
    readability: { fleschKincaid: 0, grade: 0 },
    equalityWarnings: 0,
    rubric: { voice: 0, specificity: 0, directness: 0, platformFit: 0 },
    inlineFlags: [],
  };
  const trimmed = text.trim();
  if (!trimmed) return empty;

  let messages: RetextMessageLike[] = [];
  try {
    const proc = await getProcessor();
    const file = (await proc.process(text)) as RetextFileLike;
    messages = file.messages || [];
  } catch {
    // If retext fails (network blocked, plugin throws), fall through with
    // counts of zero — the LLM scorer is still the real gate.
    messages = [];
  }

  let passiveCount = 0;
  let weakHypeCount = 0;
  let equalityWarnings = 0;
  const inlineFlags: RetextFlag[] = [];

  for (const m of messages) {
    const source = m.source || "";
    const ruleId = m.ruleId || "";
    const reason = m.reason || m.message || "";
    const { start, end } = offsetsOf(m, 0);
    if (source === "retext-passive") {
      passiveCount++;
      inlineFlags.push({ start, end, kind: "passive", message: reason });
    } else if (source === "retext-intensify") {
      weakHypeCount++;
      // retext-intensify tags weasels / hedges / fillers as "weak" wording
      // and intensifiers ("very", "really") elsewhere — treat anything
      // emphatic as "hype" and the rest as "weak".
      const kind: RetextFlagKind = /intensif|emphat|hype/i.test(ruleId) ? "hype" : "weak";
      inlineFlags.push({ start, end, kind, message: reason });
    } else if (source === "retext-equality") {
      equalityWarnings++;
      inlineFlags.push({ start, end, kind: "equality", message: reason });
    }
    // retext-readability messages aren't surfaced as inline flags — the
    // computed grade below is the single source of truth for that axis.
  }

  const readability = fleschKincaidGrade(text);
  const tokenCount = (text.match(/\S+/g) || []).length;
  const density = specificityDensity(text);

  // ─── Rubric mapping ──────────────────────────────────────────────
  // Each axis caps at the same value the LLM scorer uses so the two panels
  // line up visually (3 / 3 / 2 / 2).

  // Voice: fewer weasels / hedges / fillers per 100 words = higher.
  const weakPer100 = tokenCount > 0 ? (weakHypeCount / tokenCount) * 100 : 0;
  let voice = 3;
  if (weakPer100 > 1.5) voice = 2;
  if (weakPer100 > 3) voice = 1;
  if (weakPer100 > 6) voice = 0;

  // Specificity: digit/proper-noun density per 100 words.
  let specificity = 0;
  if (density >= 1) specificity = 1;
  if (density >= 3) specificity = 2;
  if (density >= 6) specificity = 3;

  // Directness: fewer passive constructions per 100 words = higher.
  const passivePer100 = tokenCount > 0 ? (passiveCount / tokenCount) * 100 : 0;
  let directness = 2;
  if (passivePer100 > 1) directness = 1;
  if (passivePer100 > 3) directness = 0;

  // Platform fit: deterministic layer can't know the target platform, so we
  // surface a neutral baseline and let the LLM scorer adjudicate. We still
  // dock a point for obvious red flags (emoji-stuffing, hashtag chains).
  let platformFit = 2;
  const emoji = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  const hashtags = (text.match(/(^|\s)#[A-Za-z0-9_]+/g) || []).length;
  if (emoji > 2 || hashtags > 3) platformFit = 1;
  if (emoji > 5 || hashtags > 6) platformFit = 0;

  return {
    passiveCount,
    weakHypeCount,
    readability,
    equalityWarnings,
    rubric: {
      voice: clamp(voice, 0, 3),
      specificity: clamp(specificity, 0, 3),
      directness: clamp(directness, 0, 2),
      platformFit: clamp(platformFit, 0, 2),
    },
    inlineFlags,
  };
}
