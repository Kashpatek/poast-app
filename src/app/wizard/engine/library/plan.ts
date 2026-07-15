// ═══════════════════════════════════════════════════════════════════════════
// Library platform · plan — thin typed client for POST /api/library
// (docs/LIBRARY-INTEGRATION.md §C + v2 §Q).
//
// Same fetch + error-envelope conventions as engine/api.ts's postCarousel:
// the server's { error } payload is surfaced as a thrown Error, which is
// exactly what the store's generate() branches catch and render as the
// overlay's inline error + retry (URL fetch/extract failures arrive as a
// 422 with a human message and flow through the same path). Provider rides
// along from the same localStorage-backed chip selection every /api/carousel
// call uses.
// ═══════════════════════════════════════════════════════════════════════════

import { carouselProvider } from "../api";
import type { CaptionOption } from "../types";
import type { LibTopicKey } from "./data";

// One planned slide: an approved template (by its stable idx), the text
// fills keyed by field name (already validated + maxLen-clamped server-side,
// logo-role never present), and at most one image URL destined for the
// template's image slot (null/absent when none applies).
export interface LibraryPlanSlide {
  templateIdx: number;
  fills: Record<string, string>;
  slotImage?: string | null;
}

// The three directions ONE generate call plans in parallel (v2 §Q). Keys and
// labels are the contract across the server, the store's libraryDecks record,
// and ChooseStation's bench columns; canonical order data → narrative → visual.
export type LibraryPlanKey = "data" | "narrative" | "visual";

export interface LibraryPlan {
  key: LibraryPlanKey;
  label: string; // "DATA-LED" | "NARRATIVE" | "VISUAL" — bench column heading + selectedVariantLabel
  slides: LibraryPlanSlide[];
}

export interface LibraryPlanResult {
  // 1-3 surviving plans in canonical order. A plan that failed server
  // validation after the single retry is dropped rather than sinking the
  // call; each drop is noted in `warnings`.
  plans: LibraryPlan[];
  // Same shape /api/carousel's "caption" action returns, so PUBLISH works
  // unchanged. ONE set for the whole run (captions describe the article,
  // not a direction). May be [] when the plans succeeded but captions
  // failed — PUBLISH regenerates on demand in that case.
  captionOptions: CaptionOption[];
  // The resolved topic: the confirmed key echoed back, or the server's
  // suggestTopic default when the request topic was null. The store adopts
  // it (then re-chains backdrops) when its own topic was null.
  topic: LibTopicKey;
  // First ~2000 chars of the server-extracted article — present ONLY on
  // url-only runs, so the client can persist source context it never had.
  articleText?: string;
  // Dropped-plan notes (human sentences), absent when all three survived.
  warnings?: string[];
}

// ─── generate (docs/LIBRARY-INTEGRATION.md v2 §Q) ───
// One request → up to three validated slide plans + one set of caption
// options. text OR url required: pasted text wins and url rides as
// reference; url alone is fetched + extracted server-side. topic null →
// the server resolves a default and echoes it back. pageCount 0 = auto
// (the model picks 4-8 per plan); any positive count is enforced exactly
// server-side on every plan.
export async function generateLibraryPlan(opts: {
  text?: string;
  url?: string;
  topic: LibTopicKey | null; // null → server-side suggestTopic default
  pageCount: number; // 0 = auto
  imageUrls?: string[];
}): Promise<LibraryPlanResult> {
  // v3: user-imported images are base64 data: URLs — megabytes that can't
  // ride the request or be echoed back as slotImage. Each one travels as a
  // short "local:N" REFERENCE instead; the planner picks refs like any URL
  // and we swap the original data: URL back into the returned plans below.
  var pool = opts.imageUrls || [];
  var localByRef: Record<string, string> = {};
  var wireUrls: string[] = [];
  for (var i = 0; i < pool.length; i++) {
    var u = pool[i];
    if (!u) continue;
    if (u.startsWith("data:")) {
      var ref = "local:" + i + " (user-imported image " + (i + 1) + ")";
      localByRef[ref] = u;
      wireUrls.push(ref);
    } else {
      wireUrls.push(u);
    }
  }
  var r = await fetch("/api/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: opts.text,
      url: opts.url,
      topic: opts.topic,
      pageCount: opts.pageCount || 0,
      imageUrls: wireUrls,
      provider: carouselProvider(),
    }),
  });
  var d = await r.json();
  if (!r.ok || (d && d.error)) throw new Error((d && d.error) || "Library generation failed");
  if (!d || !Array.isArray(d.plans) || d.plans.length === 0) throw new Error("No library plans returned.");
  // Defensive floor on each plan's shape (the server already validated the
  // slides themselves): a plan without a slides array can't be benched.
  var plans = (d.plans as LibraryPlan[]).filter(function (p) {
    return p && Array.isArray(p.slides) && p.slides.length > 0;
  });
  if (!plans.length) throw new Error("No library plans returned.");
  // Resolve local refs back to the original data: URLs for rendering.
  plans.forEach(function (p) {
    p.slides.forEach(function (s) {
      if (s.slotImage && localByRef[s.slotImage]) s.slotImage = localByRef[s.slotImage];
    });
  });
  return {
    plans: plans,
    captionOptions: Array.isArray(d.captionOptions) ? (d.captionOptions as CaptionOption[]) : [],
    topic: d.topic as LibTopicKey,
    articleText: typeof d.articleText === "string" && d.articleText ? d.articleText : undefined,
    warnings: Array.isArray(d.warnings) && d.warnings.length ? (d.warnings as string[]) : undefined,
  };
}
