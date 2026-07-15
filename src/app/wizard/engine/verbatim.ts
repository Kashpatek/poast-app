// ═══════════════════════════════════════════════════════════════════════════
// Wizard engine · verbatim-wizard draft persistence + alt splitter
//
// VERBATIM extraction from src/app/carousel-verbatim.tsx (line refs cited
// per block). Only the imports/types changed: the original leaned on its
// own file-local Slide/ThemeKey mirrors; here they come from ./types.
// ═══════════════════════════════════════════════════════════════════════════

import type { CoverTemplateId } from "../../carousel-covers";
import type { ThemeKey, Slide, GeneratedSlide } from "./types";

// (carousel-verbatim.tsx:179) — the wizard's five sub-steps.
export type VerbatimSubStep = "paste" | "cover" | "title" | "image" | "confirm";

// ─── Wizard draft persistence (Phase 3) ─── (carousel-verbatim.tsx:189-283)
// The verbatim wizard autosaves every input to localStorage so work survives a
// reload or navigating away — and so reopening an archived carousel can seed the
// wizard back to a fully reconstructed state. Large base64 images are dropped on
// quota failure rather than losing the whole draft.
export interface VerbatimDraft {
  v?: number;
  sub?: VerbatimSubStep;
  text?: string;
  category?: ThemeKey;
  mode?: string;
  pageCount?: number;
  selectedTemplateId?: CoverTemplateId | null;
  dual?: boolean;
  chosenTitle?: string;
  chosenSubtitle?: string;
  includeSubtitle?: boolean;
  upper?: boolean;
  tight?: boolean;
  logoPos?: "left" | "right";
  topic?: string;
  titleScale?: number;
  imageTab?: "ai" | "upload" | "skip";
  chosenImageUrl?: string;
  imagePrompt?: string;
  titleIdeas?: { title: string; subtitle: string }[];
  subtitleIdeas?: string[];
  savedAt?: number;
}

export const VERBATIM_DRAFT_KEY = "poast-verbatim-draft-v1";

// (carousel-verbatim.tsx:221-229)
export function loadVerbatimDraft(): VerbatimDraft | null {
  if (typeof window === "undefined") return null;
  try {
    var raw = window.localStorage.getItem(VERBATIM_DRAFT_KEY);
    if (!raw) return null;
    var d = JSON.parse(raw) as VerbatimDraft;
    return d && typeof d === "object" ? d : null;
  } catch { return null; }
}

// (carousel-verbatim.tsx:231-243) — with the quota lean-retry that strips
// the (potentially multi-MB base64) chosenImageUrl.
export function saveVerbatimDraft(d: VerbatimDraft): void {
  if (typeof window === "undefined") return;
  var payload: VerbatimDraft = Object.assign({ v: 1, savedAt: Date.now() }, d);
  try {
    window.localStorage.setItem(VERBATIM_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Almost always a quota error from a large base64 cover image — retry lean.
    try {
      var lean: VerbatimDraft = Object.assign({}, payload, { chosenImageUrl: "" });
      window.localStorage.setItem(VERBATIM_DRAFT_KEY, JSON.stringify(lean));
    } catch { /* give up silently */ }
  }
}

// (carousel-verbatim.tsx:245-248)
export function clearVerbatimDraft(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(VERBATIM_DRAFT_KEY); } catch { /* ignore */ }
}

// (carousel-verbatim.tsx:250-253)
export function draftHasContent(d: VerbatimDraft | null): boolean {
  if (!d) return false;
  return !!((d.text && d.text.trim()) || (d.chosenTitle && d.chosenTitle.trim()) || d.selectedTemplateId);
}

// (carousel-verbatim.tsx:255-283)
// Reconstruct a wizard draft from an archived carousel so reopening it lands
// the user back in a fully-populated wizard. Cover knobs live on the cover
// slide; the raw paste text + slide-count settings live in data.wizardInputs.
export function verbatimDraftFromArchive(data: Record<string, unknown> | undefined): VerbatimDraft | null {
  if (!data) return null;
  var slides = (Array.isArray(data.slides) ? data.slides : []) as Slide[];
  var cover = slides.find(function(s) { return s && s.type === "cover"; });
  var wi = (data.wizardInputs && typeof data.wizardInputs === "object" ? data.wizardInputs : {}) as Record<string, unknown>;
  var draft: VerbatimDraft = {
    text: typeof wi.text === "string" ? wi.text as string : "",
    category: (wi.category as ThemeKey) || (data.theme as ThemeKey) || "general",
    mode: (wi.mode as string) || "auto",
    pageCount: typeof wi.pageCount === "number" ? wi.pageCount as number : 0,
    sub: "confirm",
  };
  if (cover) {
    draft.selectedTemplateId = cover.coverTemplate || null;
    draft.dual = !!cover.coverDual;
    draft.chosenTitle = cover.title || "";
    draft.chosenSubtitle = cover.subtitle || "";
    draft.includeSubtitle = cover.coverShowSub !== false && !!(cover.subtitle || "");
    draft.logoPos = cover.coverLogoPos === "left" ? "left" : "right";
    draft.topic = cover.coverTopic || "";
    draft.titleScale = typeof cover.coverTitleScale === "number" ? cover.coverTitleScale : 1;
    draft.chosenImageUrl = cover.imageUrl || "";
    draft.imageTab = cover.imageUrl ? "upload" : "skip";
  }
  return draft;
}

// ─── splitVerbatimAlt (carousel-verbatim.tsx:73-130) ───
// carousel-verbatim.tsx carries its OWN copy of splitVerbatim, separate from
// carousel.tsx:633-690 (extracted to ./types as splitVerbatim). Project lore
// held that this copy alternates BODY_A/BODY_B with different parity — a
// line-by-line diff at extraction time (2026-07-06) showed the two copies
// are byte-identical (both use `k % 2 === 1 ? "BODY_A" : "BODY_B"`). Both
// are preserved as-is so the new wizard can choose one deliberately and any
// future upstream divergence stays visible. Default to splitVerbatim from
// ./types (the carousel.tsx copy).
export function splitVerbatimAlt(text: string, pageCount: number): GeneratedSlide[] {
  var raw = String(text || "").trim();
  if (!raw) return [];
  var rawChunks = raw.split(/\n\s*\n|\n-{3,}\n/).map(function(s) { return s.trim(); }).filter(Boolean);
  if (rawChunks.length === 1) {
    rawChunks = raw.split(/\n+/).map(function(s) { return s.trim(); }).filter(Boolean);
  }
  if (!rawChunks.length) rawChunks = [raw];

  var target = pageCount && pageCount > 0
    ? Math.max(1, pageCount)
    : Math.min(7, Math.max(3, rawChunks.length));

  var chunks: string[] = rawChunks.slice();
  if (chunks.length > target) {
    var grouped: string[] = [];
    var groupSize = Math.ceil(chunks.length / target);
    for (var i = 0; i < chunks.length; i += groupSize) {
      grouped.push(chunks.slice(i, i + groupSize).join("\n\n"));
    }
    chunks = grouped.slice(0, target);
  } else if (chunks.length < target) {
    var safety = 0;
    while (chunks.length < target && safety++ < 64) {
      var longestIdx = 0;
      for (var j = 0; j < chunks.length; j++) {
        if (chunks[j].length > chunks[longestIdx].length) longestIdx = j;
      }
      var longest = chunks[longestIdx];
      var sentences = longest.match(/[^.!?]+[.!?]+(\s|$)|\S[^.!?]*$/g);
      if (!sentences || sentences.length < 2) break;
      var mid = Math.ceil(sentences.length / 2);
      var first = sentences.slice(0, mid).join("").trim();
      var second = sentences.slice(mid).join("").trim();
      if (!first || !second) break;
      chunks.splice(longestIdx, 1, first, second);
    }
  }

  var slides: GeneratedSlide[] = [];
  for (var k = 0; k < chunks.length; k++) {
    var c = chunks[k];
    if (k === 0 && chunks.length > 1) {
      var firstLine = (c.split(/\n/)[0] || c).trim();
      var rest = c.slice(firstLine.length).trim();
      slides.push({ type: "COVER", title: firstLine.slice(0, 140), subtitle: rest });
    } else if (k === chunks.length - 1 && chunks.length > 1) {
      slides.push({ type: "BODY_FINAL", body_text: c });
    } else if (chunks.length === 1) {
      var firstLine2 = (c.split(/\n/)[0] || c).trim();
      var rest2 = c.slice(firstLine2.length).trim();
      slides.push({ type: "COVER", title: firstLine2.slice(0, 140), subtitle: rest2 });
    } else {
      slides.push({ type: k % 2 === 1 ? "BODY_A" : "BODY_B", body_text: c });
    }
  }
  return slides;
}
