"use client";
// ═══════════════════════════════════════════════════════════════════════════
// SA Carousel 2.0 · wizard store (zustand)
//
// Single source of truth for the station machine, create inputs, generation,
// the slide deck, captions, archive linkage, and the localStorage draft.
// Contract: docs/ARCHITECTURE.md "Store contract". Engine imports only —
// never from the legacy monolith (carousel.tsx / carousel-verbatim.tsx).
// ═══════════════════════════════════════════════════════════════════════════

import { create } from "zustand";
import {
  getSlidePositions,
  splitVerbatim,
  apiSlidesToEditorSlides,
  THEMES,
  type Slide,
  type ThemeKey,
  type Variant,
  type CaptionOption,
} from "./engine/types";
import { generateCarousel, generateUnique, type ArchiveRow } from "./engine/api";
import { buildUniqueDeck, UNIQUE_DIRECTIONS } from "./engine/unique/build";
import { saveVerbatimDraft, verbatimDraftFromArchive } from "./engine/verbatim";
import {
  loadTopics,
  topicsSync,
  loadTemplates,
  type LibTemplate,
  type LibTopicKey,
  type TopicsData,
} from "./engine/library/data";
import { postSeed, resolveBgChain, resolveBgInfinity } from "./engine/library/backdrop";
import { isNativeKey, nativeGenKeyOf } from "./engine/library/nativebg";
import { CATEGORY_PALETTE, type LibPalette } from "./engine/library/palette";
import { generateLibraryPlan, type LibraryPlanSlide } from "./engine/library/plan";
import { ensureLibraryAssets } from "./engine/library/compose";
import { suggestTopic } from "./engine/library/suggest";
import { showToast } from "../toast-context";

// ═══ STATIONS ═══
// "generating" is a full-bleed overlay of the create→choose transit and
// "home" is outside the rail; neither counts toward the high-water mark.
export type Station = "home" | "create" | "generating" | "choose" | "edit" | "publish";

const RAIL_ORDER: Station[] = ["create", "choose", "edit", "publish"];

/** 1-based rail ordinal (create=1 .. publish=4); home/generating = 0. */
function ordOf(st: Station): number {
  return RAIL_ORDER.indexOf(st) + 1;
}

export type PlatTab = "instagram" | "tiktok" | "shorts";

/** Generation modes: ai (3 LLM variants), verbatim (local split), unique
 *  (autonomous deck design, 3 art directions per DESIGN-SPEC section 9),
 *  library (three planned decks — data/narrative/visual — from the 90
 *  approved templates + topic backdrops, LIBRARY-INTEGRATION v2 §R;
 *  CHOOSE bench commits one via commitLibraryDeck). */
export type WizardMode = "ai" | "verbatim" | "unique" | "library";

// Data-only create-input fields settable via patch() from station UIs.
export interface WizardInputs {
  mode: WizardMode;
  category: ThemeKey;
  url: string;
  text: string;
  countMode: "auto" | "manual";
  pageCount: number;
  articleImages: string[];
  fetchingImages: boolean;
  articleTitle: string;
}

// Serializable subset persisted to localStorage (all optional on read —
// the draft comes from JSON.parse of whatever a past session wrote).
export interface WizardDraft {
  mode?: WizardMode;
  category?: ThemeKey;
  url?: string;
  text?: string;
  countMode?: "auto" | "manual";
  pageCount?: number;
  articleImages?: string[];
  articleTitle?: string;
  autoLoad?: boolean;
  preloadKey?: string;
  variants?: Record<string, Variant> | null;
  selectedVariantKey?: string | null;
  selectedVariantLabel?: string;
  uniqueDecks?: Record<string, Slide[]> | null;
  libraryDecks?: Record<string, Slide[]> | null;
  topic?: LibTopicKey | null;
  libSeed?: number;
  bgMode?: "rotate" | "infinity";
  bgSource?: "legacy" | "library";
  slides?: Slide[];
  activeIdx?: number;
  captionOptions?: CaptionOption[];
  selectedCaptionIdx?: number;
  platTab?: PlatTab;
  archiveId?: string | null;
  station?: Station;
  maxStation?: number;
  savedAt?: number;
}

export const WIZARD_DRAFT_KEY = "sa-wizard-draft-v2";

// v3.7 undo frame: slides + the deck-level backdrop state they were
// authored under (in-memory only — never persisted or hydrated).
interface UndoFrame {
  slides: Slide[];
  bgSource: "legacy" | "library";
  uniqueDecks: Record<string, Slide[]> | null;
}

// ═══ STORE CONTRACT ═══ (docs/ARCHITECTURE.md + generation/draft addenda)
export interface WizardStore {
  // navigation
  station: Station;
  maxStation: number; // rail-ordinal high-water mark (create=1 .. publish=4)
  go(st: Station): void;
  resetToHome(): void;
  startNew(mode: WizardMode): void;
  // one-shot deep link: EDIT's inspector opens this section id on arrival,
  // then clears it (set by publish preflight jump-to-fix; never persisted)
  inspectorFocus: string | null;
  setInspectorFocus(id: string | null): void;
  // create inputs (CarouselState superset)
  mode: WizardMode;
  category: ThemeKey;
  url: string;
  text: string;
  countMode: "auto" | "manual";
  pageCount: number; // manual counts 1..10 (10 = one full native-infinity canvas)
  articleImages: string[];
  fetchingImages: boolean;
  articleTitle: string; // captured from cover after gen
  patch(p: Partial<WizardInputs>): void;
  // generation
  generating: boolean;
  genStage: number;
  genError: string | null;
  variants: Record<string, Variant> | null;
  selectedVariantKey: string | null;
  selectedVariantLabel: string;
  // unique mode: three complete decks keyed E/C/S, built client-side from one
  // generateUnique() content payload; variants carries synthetic chips for them.
  uniqueDecks: Record<string, Slide[]> | null;
  // library mode v2 (LIBRARY-INTEGRATION v2 §R): three complete decks keyed
  // data/narrative/visual from one generateLibraryPlan() call; variants
  // carries synthetic chips for these too, exactly like uniqueDecks.
  libraryDecks: Record<string, Slide[]> | null;
  generate(): Promise<void>; // ai/unique: api + stages; verbatim: delegates to splitNow()
  abortGenerate(): void; // cancel run, keep inputs, back to create
  dismissError(): void; // clear inline gen error, back to create
  splitNow(): void; // verbatim: local split -> choose (cover bench)
  pickVariant(key: string): void; // converts via apiSlidesToEditorSlides
  commitLibraryDeck(key: string): void; // library CHOOSE commit: deck -> slides -> EDIT
  // v3.3 CREATE preload — the LOAD toggle runs the library pipeline in the
  // BACKGROUND while the user stays on CREATE; results land in the same
  // bench fields generate() writes (libraryDecks/variants/topic/libSeed).
  // preloading/preloadError are transient (never persisted); preloadKey is
  // the input-hash the bench was built from ("" = none) and persists so a
  // resumed draft keeps its OPEN-THE-BENCH state. WizardApp's overlay gates
  // on generating only — preloading must never trigger it.
  autoLoad: boolean; // the LOAD toggle (user preference, persists)
  setAutoLoad(v: boolean): void; // off mid-flight aborts the preload
  preloading: boolean;
  preloadError: string | null;
  preloadKey: string;
  // last inputs-hash ATTEMPTED (success or failure; transient). The CREATE
  // auto-fire effect skips a hash it already tried, so a persistent API
  // failure never loops the LLM call — editing the inputs re-arms.
  preloadAttemptKey: string;
  preloadLibrary(): Promise<void>;
  dirtySinceVariant: boolean; // deck edited since last pick (caller confirms re-pick)
  // deck
  slides: Slide[];
  activeIdx: number;
  setActiveIdx(i: number): void;
  setSlides(s: Slide[]): void;
  updateSlide(i: number, s: Slide): void;
  addSlide(afterIdx?: number): void;
  duplicateSlide(i: number): void; // deep-clone i, insert at i+1
  removeSlide(i: number): void;
  moveSlide(from: number, to: number): void; // reorder + recompute positions
  // library mode (docs/LIBRARY-INTEGRATION.md §E) — deck-level topic + seed.
  // Backdrop resolution is owned by the STORE (stamped into slide.libraryBg)
  // so renderers stay pure per-slide; the chain re-runs on any topic/override/
  // order change and is deterministic given (libSeed, topic, overrides).
  topic: LibTopicKey | null; // finalized topic; null = unconfirmed (CREATE shows suggestTopic result)
  libSeed: number; // backdrop rotation seed; 0 = unstamped (first library generate stamps it)
  // v3: ROTATE = per-slide chain (reference math) · INFINITY = one deck-wide
  // key, mirror-alternated so the carousel reads as a continuous strip.
  bgMode: "rotate" | "infinity";
  setBgMode(m: "rotate" | "infinity"): void; // switches mode + re-chains deck and bench
  setTopic(k: LibTopicKey | null): void; // sets topic + re-chains library decks
  setSlideBgOverride(idx: number, key: string | null): void; // finalize/AUTO one slide, re-chain deck (deck-wide in infinity)
  // v3.6 CHOOSE bench: finalize/AUTO one DIRECTION's backdrop before commit.
  // ∞ picks stamp every slide of that deck (deck-level intent, same as
  // setSlideBgOverride); rotate picks finalize the cover and let the chain
  // advance the rest past it; null clears every override (back to assigned).
  setBenchDeckBg(deckKey: string, key: string | null): void;
  // v3.7: classic/verbatim/unique decks wear the baked library backdrops.
  // "library" (fresh-run default) stamps slide.libraryBg on EVERY slide type
  // via the same rotate chain Neu uses (topic pool, no consecutive repeats;
  // ∞/native worlds stay library-mode-only). "legacy" is the mode-native
  // look — classic photo JPGs / unique procedural fields — and is what old
  // drafts and archives hydrate to so they keep rendering as authored.
  bgSource: "legacy" | "library";
  setBgSource(v: "legacy" | "library"): void;
  // undo
  undoStack: UndoFrame[];
  pushUndo(): void; // push before destructive ops
  undo(): void; // Cmd+Z
  // captions
  captionOptions: CaptionOption[];
  selectedCaptionIdx: number;
  platTab: PlatTab; // SHARED across stations
  setCaptionOptions(opts: CaptionOption[]): void;
  setSelectedCaptionIdx(i: number): void;
  setPlatTab(t: PlatTab): void;
  updateCaptionOption(idx: number, patch: Partial<CaptionOption>): void;
  // archive
  archiveId: string | null; // for upsert re-save
  loadFromArchive(row: ArchiveRow): void;
  // draft autosave
  draftSavedAt: number | null;
  hydrateFromDraft(d: WizardDraft): void;
}

// ═══ MODULE-LEVEL RUN STATE ═══
// The engine api client exposes no fetch signal, so the controller acts as a
// cancellation token: abort flips signal.aborted and the settled promise's
// result is discarded. Timers drive the staged readout on the overlay.
let genCtrl: AbortController | null = null;
let genTimer: ReturnType<typeof setInterval> | null = null;
// v3.3 CREATE preload (LOAD toggle): its own controller so a background
// bench build never races the full-bleed generate() pipeline.
let preCtrl: AbortController | null = null;

function clearGenTimer(): void {
  if (genTimer) {
    clearInterval(genTimer);
    genTimer = null;
  }
}

// ═══ DECK HELPERS ═══
// Types that survive a position recompute unchanged (V1 addSlide remap rule,
// carousel.tsx:1487-1494). Everything else off position 1 becomes "body";
// position 1 stays cover (cover_image keeps its image flavor).
const KEEP_TYPES = ["image_text", "large_image", "dual_image", "large_with_title", "body_dual"];

function recomputePositions(slides: Slide[]): Slide[] {
  const positions = getSlidePositions(slides.length);
  return slides.map(function (sl, i) {
    const pos = positions[i] || (i === slides.length - 1 ? 4 : 2);
    // Unique/library slides keep their kind through reorders (DESIGN-SPEC
    // 9.7 / LIBRARY-INTEGRATION §E): only the position updates; the type
    // never remaps to cover/body (library slides render by libraryTemplate).
    if (sl.type === "unique" || sl.type === "library") return { ...sl, position: pos };
    return {
      ...sl,
      position: pos,
      type:
        pos === 1
          ? sl.type === "cover_image"
            ? "cover_image"
            : "cover"
          : KEEP_TYPES.indexOf(sl.type) !== -1
            ? sl.type
            : "body",
    };
  });
}

let slideSeq = 0;

function defaultBodySlide(): Slide {
  slideSeq += 1;
  return {
    id: "slide-" + Date.now() + "-" + slideSeq,
    position: 2, // recomputePositions reassigns after insertion
    type: "body",
    title: "",
    titleSize: 74,
    subtitle: "",
    subtitleSize: 34,
    bodyText: "New slide content.",
    bodySize: 28,
    imageUrl: "",
    caption: "",
    captionSize: 18,
    titleAnchor: "top",
    titleMarginTop: 80,
    bodyAnchor: "top",
  };
}

// ═══ UNIQUE MODE HELPERS ═══ (DESIGN-SPEC section 9)
// The three art directions are pinned to keys E/C/S; names/topics fall back
// to these when the engine's UNIQUE_DIRECTIONS entry omits them.
const UNIQUE_KEYS = ["E", "C", "S"] as const;

const UNIQUE_META: Record<(typeof UNIQUE_KEYS)[number], { label: string; topic: string }> = {
  E: { label: "Eclipse", topic: "Amber eclipse: disc and rim glow, particle waves, contour dunes." },
  C: { label: "Circuit", topic: "Cobalt blueprint: PCB traces, vias, fine grid and arcs." },
  S: { label: "Signal", topic: "Mint terminal: query feed, topo contours, flow streams." },
};

/** Label/topic for a direction key, preferring engine UNIQUE_DIRECTIONS data
 *  (array of {key,...} or record keyed by direction) over the local fallback. */
function uniqueDirectionMeta(key: string): { label: string; topic: string } {
  const fb = UNIQUE_META[key as (typeof UNIQUE_KEYS)[number]] || { label: key, topic: "" };
  const raw = UNIQUE_DIRECTIONS as unknown;
  let entry: unknown;
  if (Array.isArray(raw)) {
    entry = raw.find(function (d) {
      return !!d && (d as { key?: string }).key === key;
    });
  } else if (raw && typeof raw === "object") {
    entry = (raw as Record<string, unknown>)[key];
  }
  if (entry && typeof entry === "object") {
    const e = entry as { name?: string; label?: string; topic?: string; tagline?: string };
    return { label: e.name || e.label || fb.label, topic: e.topic || e.tagline || fb.topic };
  }
  return fb;
}

/** Draft-hydration guard: a decks record (uniqueDecks / libraryDecks) must
 *  be a plain object of slide arrays. */
function validSlideDecks(v: unknown): Record<string, Slide[]> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, Slide[]> = {};
  let any = false;
  Object.keys(v as Record<string, unknown>).forEach(function (k) {
    const arr = (v as Record<string, unknown>)[k];
    if (Array.isArray(arr)) {
      out[k] = arr as Slide[];
      any = true;
    }
  });
  return any ? out : null;
}

/** Slide added inside a unique deck: uniqueKind "stat" with empty stats,
 *  inheriting the deck's direction (DESIGN-SPEC 9.7). */
function defaultUniqueSlide(deck: Slide[]): Slide {
  const base = defaultBodySlide();
  const first = (deck[0] || {}) as { uniqueDirection?: "E" | "C" | "S" };
  return {
    ...base,
    type: "unique",
    title: "New slide",
    bodyText: "",
    uniqueKind: "stat",
    uniqueDirection: first.uniqueDirection,
    uniqueStats: [],
  } as Slide;
}

function coverTitleOf(slides: Slide[]): string {
  const cover = slides.find(function (s) {
    return s && typeof s.type === "string" && s.type.indexOf("cover") === 0;
  });
  return (cover && cover.title) || "";
}

// V1 build parity (carousel-verbatim.tsx:660): a freshly committed deck
// carries the category accent on its cover. Fresh commits only — archive and
// draft loads never seed, so old decks keep rendering exactly as saved.
function seedCoverAccent(slides: Slide[], category: ThemeKey): Slide[] {
  const cover = slides[0];
  if (!cover || typeof cover.type !== "string" || cover.type.indexOf("cover") !== 0) return slides;
  if (cover.coverAccent !== undefined) return slides;
  const next = slides.slice();
  next[0] = { ...cover, coverAccent: THEMES[category].color };
  return next;
}

// ═══ LIBRARY MODE HELPERS ═══ (docs/LIBRARY-INTEGRATION.md §E)
// Backdrops are categorically decided (topic → pool) and FINALIZED by the
// user; the store owns whole-deck resolution and stamps slide.libraryBg so
// renderers stay pure per-slide. Deterministic given (libSeed, topic,
// overrides) — drafts and archive re-opens re-render identically.

function isLibraryDeck(slides: Slide[]): boolean {
  return slides.some(function (s) {
    return !!s && s.type === "library";
  });
}

/** Resolve the whole-deck backdrop chain and stamp slide.libraryBg (+ the
 *  v3 infinity mirror flag). ROTATE: each slide's RESOLVED key (override
 *  included) becomes prevKey for the next — reference semantics: overrides
 *  win AND feed the no-consecutive-repeat rule. INFINITY: one deck-wide key,
 *  odd positions mirrored (resolveBgInfinity). Non-library slides keep their
 *  objects untouched (they still occupy a chain index, so mixed decks stay
 *  deterministic). */
function stampBgChain(
  slides: Slide[],
  topics: TopicsData,
  topic: LibTopicKey | null,
  seed: number,
  bgMode: "rotate" | "infinity",
  palette?: LibPalette,
  // v3.7: classic/verbatim/unique decks (bgSource "library") stamp EVERY
  // slide type — callers pass "rotate" for them (∞/natives stay Neu-only).
  allTypes?: boolean
): Slide[] {
  const overrides = slides.map(function (sl) {
    // A non-library slide's override only counts when the chain stamps all
    // types (classic decks); in a library deck it must never steer the
    // resolve (belt-and-braces vs hand-edited drafts).
    if (sl.type !== "library" && !allTypes) return null;
    return sl.libraryBgOverride || null;
  });
  // Null/unknown topic degrades to the brand pool inside pickBackdrop.
  let keys: string[];
  let flips: boolean[];
  if (bgMode === "infinity") {
    // v3.2: the category palette picks which native STYLE pool fresh decks
    // rotate over (styles symbolize their category; hue is re-tint only).
    const res = resolveBgInfinity(overrides, topics, topic || "brand", seed, palette);
    keys = res.keys;
    flips = res.flips;
  } else {
    keys = resolveBgChain(overrides, topics, topic || "brand", seed);
    flips = keys.map(function () { return false; });
  }
  return slides.map(function (sl, i) {
    if (sl.type !== "library" && !allTypes) return sl;
    // Native infinity (v3.1): "n:<fam>" keys carry their render params on the
    // slide so compose stays pure per-slide (window idx + deck length + seed).
    const nat = isNativeKey(keys[i])
      ? { fam: nativeGenKeyOf(keys[i]), seed: seed, idx: i, n: slides.length }
      : undefined;
    const prevNat = sl.libraryBgNative;
    const natSame = !nat && !prevNat
      ? true
      : !!nat && !!prevNat && nat.fam === prevNat.fam && nat.seed === prevNat.seed &&
        nat.idx === prevNat.idx && nat.n === prevNat.n;
    if (sl.libraryBg === keys[i] && !!sl.libraryBgFlip === flips[i] && natSame) return sl;
    return { ...sl, libraryBg: keys[i], libraryBgFlip: flips[i] || undefined, libraryBgNative: nat };
  });
}

/** Chain re-run for deck mutations: synchronous when the topics JSON is warm
 *  (the usual case — generate() loads it before landing in EDIT), otherwise
 *  best-effort async — previously stamped keys keep rendering until the
 *  restamp lands. Non-library decks pass through untouched. */
function withLibraryChain(slides: Slide[]): Slide[] {
  const st = useWizard.getState();
  // v3.7: two chain kinds. A library deck chains per its bgMode (∞ or
  // rotate, natives allowed). A classic/verbatim/unique deck chains ONLY
  // when the deck opted into library backdrops (bgSource), always rotate
  // over the baked topic pool, stamping every slide type + its palette.
  const classic = !isLibraryDeck(slides) && st.bgSource === "library" && slides.length > 0;
  if (!isLibraryDeck(slides) && !classic) return slides;
  const topics = topicsSync();
  if (topics) {
    if (classic) {
      const pal = CATEGORY_PALETTE[st.category];
      return stampPalette(stampBgChain(slides, topics, st.topic, st.libSeed, "rotate", pal, true), pal, true);
    }
    return stampBgChain(slides, topics, st.topic, st.libSeed, st.bgMode, CATEGORY_PALETTE[st.category]);
  }
  loadTopics()
    .then(function (data) {
      const now = useWizard.getState();
      const nowClassic = !isLibraryDeck(now.slides) && now.bgSource === "library" && now.slides.length > 0;
      if (!isLibraryDeck(now.slides) && !nowClassic) return;
      const pal = CATEGORY_PALETTE[now.category];
      useWizard.setState({
        slides: nowClassic
          ? stampPalette(stampBgChain(now.slides, data, now.topic, now.libSeed, "rotate", pal, true), pal, true)
          : stampBgChain(now.slides, data, now.topic, now.libSeed, now.bgMode, pal),
      });
    })
    .catch(function () {
      /* offline: keep the keys already stamped on the slides */
    });
  return slides;
}

/** v3.7 PURE preview stamp for bench minis: chain a classic/verbatim/unique
 *  deck for DISPLAY only. No store writes, no async side effects — cold
 *  topics just return the deck unstamped (the caller re-renders when its
 *  own warm-up tick fires). The store converts + stamps again on pick. */
export function stampClassicPreview(slides: Slide[]): Slide[] {
  const st = useWizard.getState();
  if (st.bgSource !== "library" || !slides.length || isLibraryDeck(slides)) return slides;
  const topics = topicsSync();
  if (!topics) return slides;
  const pal = CATEGORY_PALETTE[st.category];
  return stampPalette(stampBgChain(slides, topics, st.topic, st.libSeed, "rotate", pal, true), pal, true);
}

/** v3.7: adopt the classic-deck backdrop state (topic suggestion + seed) and
 *  stamp the working deck AND the unique bench decks once the topics JSON is
 *  in. Fired after classic/verbatim/unique generation and on bgSource opt-in.
 *  A confirmed topic always wins; the suggestion only fills null. */
function classicChainKick() {
  const st = useWizard.getState();
  if (st.bgSource !== "library") return;
  loadTopics()
    .then(function (topics) {
      const now = useWizard.getState();
      if (now.bgSource !== "library") return;
      const topic = now.topic || suggestTopic(now.text || "", topics.topics);
      const libSeed = now.libSeed || postSeed(now.text || now.url || "draft");
      const pal = CATEGORY_PALETTE[now.category];
      const stamp = function (deck: Slide[]): Slide[] {
        if (isLibraryDeck(deck)) return deck; // library decks own their chain
        return stampPalette(stampBgChain(deck, topics, topic, libSeed, "rotate", pal, true), pal, true);
      };
      useWizard.setState({
        topic: topic,
        libSeed: libSeed,
        slides: now.slides.length ? stamp(now.slides) : now.slides,
        uniqueDecks: now.uniqueDecks ? mapDecks(now.uniqueDecks, stamp) : now.uniqueDecks,
      });
    })
    .catch(function () {
      /* offline: mode-native backgrounds keep rendering */
    });
}

// The three plan directions are pinned to keys data/narrative/visual
// (LIBRARY-INTEGRATION v2 §Q). Server plan labels win; these back-fill the
// synthetic chips and old drafts (mirror of UNIQUE_META).
/** Input identity for the CREATE preload (v3.3): exactly the fields the
 *  library pipeline bakes into the LLM request. A bench built from a
 *  different hash is stale — the CTA falls back to a full generate. */
export function preloadInputsKey(
  s: Pick<WizardStore, "url" | "text" | "countMode" | "pageCount" | "articleImages">
): string {
  return JSON.stringify([s.url, s.text, s.countMode, s.pageCount, s.articleImages]);
}

const LIBRARY_DECK_META: Record<string, { label: string; topic: string }> = {
  data: { label: "Data-led", topic: "Stat, scorecard, leaderboard and table-heavy pages." },
  narrative: { label: "Narrative", topic: "Cover → argument → quote → end arc." },
  visual: { label: "Visual", topic: "Image slots and spectacle; bold minimal without images." },
};

/** Label for a library deck key: draft/server chip first, pinned fallback. */
function libraryDeckLabel(key: string, chip: Variant | undefined): string {
  return (chip && chip.label) || (LIBRARY_DECK_META[key] && LIBRARY_DECK_META[key].label) || key;
}

/** Map one plan's slides to editor slides (the v1 mapping, unchanged).
 *  slide.title = first headline-role fill (archive naming + strip labels);
 *  library renderers draw from libraryFills, never title. The API ships ONE
 *  slotImage per slide; key it by the template's image-accepting slot name
 *  (route guarantees one exists when set). */
function planSlidesToDeck(planSlides: LibraryPlanSlide[], byIdx: Record<number, LibTemplate>): Slide[] {
  return planSlides.map(function (ps, i) {
    const tpl = byIdx[ps.templateIdx];
    let headline = "";
    if (tpl) {
      const hf = tpl.fields.find(function (f) {
        return f.role === "headline" && !!ps.fills[f.name];
      });
      if (hf) headline = ps.fills[hf.name];
    }
    let slotImages: Record<string, string> | undefined;
    if (ps.slotImage && tpl) {
      const imgSlot = tpl.slots.find(function (sl) {
        return sl.accepts === "image";
      });
      if (imgSlot) slotImages = { [imgSlot.name]: ps.slotImage };
    }
    const base = defaultBodySlide(); // uid helper + required size fields
    return {
      ...base,
      type: "library",
      position: (i % 4) + 1, // contract: position cycles 1..4
      title: headline,
      bodyText: "",
      libraryTemplate: ps.templateIdx,
      libraryFills: { ...ps.fills },
      librarySlotImages: slotImages,
      libraryBgOverride: null,
    } as Slide;
  });
}

/** Stamp the category TINT (v2 §P: general blend · internal amber · external
 *  cobalt · capital green) onto every library slide. Object identity is
 *  preserved when the stamp already matches (same rule as stampBgChain).
 *  Non-library slides pass through untouched. */
function stampPalette(slides: Slide[], palette: LibPalette, allTypes?: boolean): Slide[] {
  return slides.map(function (sl) {
    if ((sl.type !== "library" && !allTypes) || sl.libraryPalette === palette) return sl;
    return { ...sl, libraryPalette: palette };
  });
}

/** Apply a per-deck slide transform across a decks record (bench state). */
function mapDecks(
  decks: Record<string, Slide[]>,
  fn: (deck: Slide[]) => Slide[]
): Record<string, Slide[]> {
  const out: Record<string, Slide[]> = {};
  Object.keys(decks).forEach(function (k) {
    out[k] = fn(decks[k]);
  });
  return out;
}

/** Bench counterpart of withLibraryChain: re-chain + re-tint every
 *  libraryDecks deck. Each deck is its OWN chain from index 0 — same
 *  (libSeed, topic) inputs for all three, its own overrides. Synchronous
 *  when the topics JSON is warm, otherwise best-effort async — previously
 *  stamped keys keep rendering until the restamp lands. */
function withLibraryDeckChains(
  decks: Record<string, Slide[]> | null
): Record<string, Slide[]> | null {
  if (!decks) return decks;
  const rechain = function (
    d: Record<string, Slide[]>,
    topics: TopicsData,
    topic: LibTopicKey | null,
    seed: number,
    palette: LibPalette,
    bgMode: "rotate" | "infinity"
  ) {
    return mapDecks(d, function (deck) {
      return stampPalette(stampBgChain(deck, topics, topic, seed, bgMode, palette), palette);
    });
  };
  const st = useWizard.getState();
  const topics = topicsSync();
  if (topics) return rechain(decks, topics, st.topic, st.libSeed, CATEGORY_PALETTE[st.category], st.bgMode);
  loadTopics()
    .then(function (data) {
      const now = useWizard.getState();
      if (!now.libraryDecks) return;
      useWizard.setState({
        libraryDecks: rechain(
          now.libraryDecks,
          data,
          now.topic,
          now.libSeed,
          CATEGORY_PALETTE[now.category],
          now.bgMode
        ),
      });
    })
    .catch(function () {
      /* offline: keep the keys already stamped on the deck slides */
    });
  return decks;
}

// ═══ INITIAL STATE ═══
const initialData = {
  station: "home" as Station,
  maxStation: 0,
  inspectorFocus: null as string | null,
  mode: "ai" as const,
  category: "general" as ThemeKey,
  url: "",
  text: "",
  countMode: "auto" as const,
  pageCount: 4,
  articleImages: [] as string[],
  fetchingImages: false,
  articleTitle: "",
  autoLoad: false,
  preloading: false,
  preloadError: null as string | null,
  preloadKey: "",
  preloadAttemptKey: "",
  generating: false,
  genStage: 0,
  genError: null as string | null,
  variants: null as Record<string, Variant> | null,
  selectedVariantKey: null as string | null,
  selectedVariantLabel: "",
  uniqueDecks: null as Record<string, Slide[]> | null,
  libraryDecks: null as Record<string, Slide[]> | null,
  dirtySinceVariant: false,
  topic: null as LibTopicKey | null,
  libSeed: 0,
  // Infinity is the DEFAULT for fresh runs (the uniform-as-you-slide look);
  // old drafts hydrate to rotate so stamped chains re-render identically.
  bgMode: "infinity" as "rotate" | "infinity",
  // v3.7: fresh runs in every mode wear the library backdrops by default;
  // legacy drafts/archives hydrate to "legacy" (see hydrateFromDraft).
  bgSource: "library" as "legacy" | "library",
  slides: [] as Slide[],
  activeIdx: 0,
  undoStack: [] as UndoFrame[],
  captionOptions: [] as CaptionOption[],
  selectedCaptionIdx: 0,
  platTab: "instagram" as PlatTab,
  archiveId: null as string | null,
  draftSavedAt: null as number | null,
};

// ═══ STORE ═══
export const useWizard = create<WizardStore>()((set, get) => ({
  ...initialData,

  // ─── navigation ───
  go(st) {
    set(function (s) {
      return { station: st, maxStation: Math.max(s.maxStation, ordOf(st)) };
    });
  },

  resetToHome() {
    // Draft persists — home is an escape hatch, not a reset.
    set({ station: "home" });
  },

  setInspectorFocus(id) {
    set({ inspectorFocus: id });
  },

  startNew(mode) {
    // Fresh run: wipe deck/variant/caption state; create inputs survive so a
    // pasted source is not lost when the user backs out and restarts.
    // autoLoad survives too (a preference) — but any bench state resets.
    clearGenTimer();
    genCtrl = null;
    if (preCtrl) { preCtrl.abort(); preCtrl = null; }
    set({
      preloading: false,
      preloadError: null,
      preloadKey: "",
      preloadAttemptKey: "",
      mode: mode,
      station: "create",
      maxStation: 1,
      slides: [],
      activeIdx: 0,
      undoStack: [],
      variants: null,
      selectedVariantKey: null,
      selectedVariantLabel: "",
      uniqueDecks: null,
      libraryDecks: null,
      dirtySinceVariant: false,
      // Library deck state is per-deck, not a create input: a fresh run gets
      // back the SUGGESTED topic default and a fresh seed at generate time.
      // Infinity is the fresh-run backdrop default (v3).
      topic: null,
      libSeed: 0,
      bgMode: "infinity",
      bgSource: "library",
      captionOptions: [],
      selectedCaptionIdx: 0,
      generating: false,
      genStage: 0,
      genError: null,
      archiveId: null,
      articleTitle: "",
    });
  },

  // ═══ v3.3 CREATE PRELOAD ═══ (LOAD toggle — deliberate TWIN of generate()'s
  // library branch minus the station/overlay writes; keep the two in step.
  // Runs quietly while the user stays on CREATE: no genStage timer, no
  // station change, errors surface as a CREATE whisper instead of the
  // overlay. Success lands the identical bench state and unlocks CHOOSE.
  async preloadLibrary() {
    const st = get();
    if (st.mode !== "library" || st.generating) return;
    if (!st.url.trim() && !st.text.trim()) return;
    const inputsKey = preloadInputsKey(st);
    if (st.preloading || st.preloadKey === inputsKey) return; // in flight / bench already fresh
    if (preCtrl) preCtrl.abort();
    const ctrl = new AbortController();
    preCtrl = ctrl;
    set({ preloading: true, preloadError: null, preloadAttemptKey: inputsKey });
    try {
      const seed = st.libSeed || postSeed(st.text || st.url || "draft");
      const [topicsData, templates] = await Promise.all([loadTopics(), loadTemplates()]);
      if (ctrl.signal.aborted) return;
      const plan = await generateLibraryPlan({
        text: st.text,
        url: st.url,
        topic: st.topic,
        pageCount: st.countMode === "manual" ? st.pageCount || 4 : 0, // 0 = auto (4-8)
        imageUrls: st.articleImages,
      });
      // the run may have been aborted OR the user may have left library mode
      // (mode card switch, archive open, resume) — never land into that run
      if (ctrl.signal.aborted || get().mode !== "library") return;
      // topic/category/bgMode may have changed while the call was in flight —
      // the user stayed on CREATE, so adopt the CURRENT values, not st's
      // (a chip confirmed mid-preload must not be reverted at landing).
      const topic: LibTopicKey = get().topic || plan.topic;
      const byIdx: Record<number, LibTemplate> = {};
      templates.forEach(function (t) {
        byIdx[t.idx] = t;
      });
      const palette = CATEGORY_PALETTE[get().category];
      const bgModeNow = get().bgMode;
      const decks: Record<string, Slide[]> = {};
      const chips: Record<string, Variant> = {};
      plan.plans.forEach(function (p) {
        decks[p.key] = stampPalette(
          stampBgChain(planSlidesToDeck(p.slides, byIdx), topicsData, topic, seed, bgModeNow, palette),
          palette
        );
        const meta = LIBRARY_DECK_META[p.key] || { label: p.key, topic: "" };
        chips[p.key] = { label: p.label || meta.label, topic: meta.topic, slides: [] };
      });
      const deckKeys = Object.keys(decks);
      const allBuilt =
        deckKeys.length > 0 &&
        deckKeys.every(function (k) {
          return decks[k].length > 0;
        });
      if (!allBuilt) throw new Error("No valid library plans returned.");
      const allSlides: Slide[] = [];
      deckKeys.forEach(function (k) {
        allSlides.push.apply(allSlides, decks[k]);
      });
      ensureLibraryAssets(allSlides).catch(function () {});
      preCtrl = null;
      set(function (s) {
        const firstDeck = plan.plans[0] ? decks[plan.plans[0].key] : undefined;
        return {
          topic: topic,
          libSeed: seed,
          libraryDecks: decks,
          variants: chips,
          uniqueDecks: null,
          selectedVariantKey: null,
          selectedVariantLabel: "",
          articleTitle: (firstDeck && firstDeck[0] && firstDeck[0].title) || s.articleTitle,
          captionOptions: plan.captionOptions,
          selectedCaptionIdx: 0,
          dirtySinceVariant: false,
          preloading: false,
          preloadKey: inputsKey,
          maxStation: Math.max(s.maxStation, ordOf("choose")), // bench reachable
        };
      });
    } catch (e) {
      if (ctrl.signal.aborted || get().mode !== "library") return;
      set({ preloading: false, preloadError: e instanceof Error ? e.message : String(e) });
    }
  },

  setAutoLoad(v) {
    if (!v) {
      if (preCtrl) {
        preCtrl.abort();
        preCtrl = null;
      }
      set({ preloading: false, preloadError: null });
    }
    set({ autoLoad: v });
  },

  patch(p) {
    // Leaving library mode mid-preload: abort it — the landing must never
    // write library bench state into a different run's fields.
    if (p.mode && p.mode !== get().mode && preCtrl) {
      preCtrl.abort();
      preCtrl = null;
      set({ preloading: false, preloadError: null });
    }
    // Category is the library TINT (LIBRARY-INTEGRATION v2 §R): a category
    // change restamps libraryPalette on the working deck AND every bench
    // deck. Every category write lands through patch(), so this is the one
    // interception site; non-library runs fall through untouched.
    if (p.category && p.category !== get().category) {
      const st = get();
      // v3.7: classic/verbatim/unique decks wearing library backdrops
      // re-tint too (allTypes palette stamp; uniqueDecks bench included).
      const classicWear = st.bgSource === "library" && !isLibraryDeck(st.slides);
      if (isLibraryDeck(st.slides) || st.libraryDecks || (classicWear && (st.slides.length || st.uniqueDecks))) {
        const palette = CATEGORY_PALETTE[p.category];
        set({
          ...p,
          slides: stampPalette(st.slides, palette, classicWear),
          libraryDecks: st.libraryDecks
            ? mapDecks(st.libraryDecks, function (deck) {
                return stampPalette(deck, palette);
              })
            : null,
          uniqueDecks:
            st.uniqueDecks && st.bgSource === "library"
              ? mapDecks(st.uniqueDecks, function (deck) {
                  return stampPalette(deck, palette, true);
                })
              : st.uniqueDecks,
        });
        return;
      }
    }
    set(p);
  },

  // ─── generation (AI) ───
  async generate() {
    const st = get();
    if (st.mode === "verbatim") {
      get().splitNow();
      return;
    }
    if (!(st.url || "").trim() && !(st.text || "").trim()) {
      showToast("Add a source URL or paste text first.", "error");
      return;
    }
    // ─── unique: one content payload, three client-built directions ───
    // Same overlay staging + abort/error semantics as the ai path below.
    if (st.mode === "unique") {
      clearGenTimer();
      if (genCtrl) genCtrl.abort();
      const uctrl = new AbortController();
      genCtrl = uctrl;
      set({ generating: true, genStage: 0, genError: null, station: "generating" });
      genTimer = setInterval(function () {
        const s = useWizard.getState();
        if (!s.generating || s.genError !== null) return;
        if (s.genStage < 2) useWizard.setState({ genStage: s.genStage + 1 });
      }, 6000);
      try {
        const content = await generateUnique({
          text: st.text,
          url: st.url,
          category: st.category,
          pageCount: st.pageCount || 6,
        });
        if (uctrl.signal.aborted) return; // cancelled mid-flight: discard
        const pages = st.pageCount || 6;
        const decks: Record<string, Slide[]> = {};
        const chips: Record<string, Variant> = {};
        UNIQUE_KEYS.forEach(function (k) {
          decks[k] = buildUniqueDeck(content, k, pages);
          const meta = uniqueDirectionMeta(k);
          // Synthetic variant per direction so chips, captions, and drafts
          // keep working; the real slides live in uniqueDecks.
          chips[k] = { label: meta.label, topic: meta.topic, slides: [] };
        });
        const allBuilt = UNIQUE_KEYS.every(function (k) {
          return Array.isArray(decks[k]) && decks[k].length > 0;
        });
        if (!allBuilt) throw new Error("No valid directions returned.");
        clearGenTimer();
        genCtrl = null;
        set(function (s) {
          return {
            uniqueDecks: decks,
            variants: chips,
            genStage: 3,
            generating: false,
            station: "choose" as Station,
            maxStation: Math.max(s.maxStation, ordOf("choose")),
          };
        });
        // v3.7: stamp the three direction decks with the topic's library
        // backdrops (async once topics land — bench minis repaint stamped).
        classicChainKick();
      } catch (e) {
        if (uctrl.signal.aborted) return; // cancelled: state already reset
        clearGenTimer();
        // generating stays true so the overlay shows the inline error + retry.
        set({ genError: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // ─── library v2: three planned decks from the approved 90 → CHOOSE ───
    // Same overlay staging + abort/error semantics as ai/unique. One LLM call
    // plans three directions (data/narrative/visual, LIBRARY-INTEGRATION v2
    // §Q/§R); the CHOOSE bench commits one via commitLibraryDeck. Works
    // url-only: the server fetches + extracts the article when text is empty.
    if (st.mode === "library") {
      clearGenTimer();
      if (genCtrl) genCtrl.abort();
      // the full run owns the pipeline: a background preload in flight yields
      if (preCtrl) { preCtrl.abort(); preCtrl = null; }
      const lctrl = new AbortController();
      genCtrl = lctrl;
      const inputsKey = preloadInputsKey(st);
      set({ generating: true, genStage: 0, genError: null, station: "generating", preloading: false, preloadError: null });
      genTimer = setInterval(function () {
        const s = useWizard.getState();
        if (!s.generating || s.genError !== null) return;
        if (s.genStage < 2) useWizard.setState({ genStage: s.genStage + 1 });
      }, 6000);
      try {
        // Seed stamps ONCE per deck (0 = unstamped), so the backdrop rotation
        // stays deterministic across retries, drafts, and archive re-opens.
        // v3.3: the fallback derives from the CONTEXT (same formula as the
        // CREATE previews), so what CREATE shows for ∞/rotate is what the
        // deck gets — not a surprise re-roll.
        const seed = st.libSeed || postSeed(st.text || st.url || "draft");
        const [topicsData, templates] = await Promise.all([loadTopics(), loadTemplates()]);
        if (lctrl.signal.aborted) return; // cancelled during asset load: skip the LLM call
        // Topic is a DEFAULT the user confirms in CREATE (finalize pattern,
        // never a lock); unconfirmed rides as null and the SERVER resolves it
        // (url-only runs have no local text to score) — adopted below BEFORE
        // the chains are stamped, since every deck's pool hangs off it.
        const plan = await generateLibraryPlan({
          text: st.text,
          url: st.url,
          topic: st.topic,
          pageCount: st.countMode === "manual" ? st.pageCount || 4 : 0, // 0 = auto (4-8)
          imageUrls: st.articleImages,
        });
        if (lctrl.signal.aborted) return; // cancelled mid-flight: discard
        const topic: LibTopicKey = st.topic || plan.topic;
        // plan.articleText (url-extracted source excerpt) is deliberately NOT
        // adopted into state.text — the draft keeps the url as the source of
        // record; articleTitle stays the first headline fill.
        const byIdx: Record<number, LibTemplate> = {};
        templates.forEach(function (t) {
          byIdx[t.idx] = t;
        });
        const palette = CATEGORY_PALETTE[st.category]; // category is the TINT
        const decks: Record<string, Slide[]> = {};
        const chips: Record<string, Variant> = {};
        plan.plans.forEach(function (p) {
          // Same per-deck stamps the committed deck needs in EDIT: backdrop
          // chain (each deck is its OWN chain from index 0 — same (libSeed,
          // topic) inputs for all three) + the category tint.
          decks[p.key] = stampPalette(
            stampBgChain(planSlidesToDeck(p.slides, byIdx), topicsData, topic, seed, st.bgMode, palette),
            palette
          );
          // Synthetic variant per direction so chips, captions, and drafts
          // keep working; the real slides live in libraryDecks (the exact
          // uniqueDecks pattern).
          const meta = LIBRARY_DECK_META[p.key] || { label: p.key, topic: "" };
          chips[p.key] = { label: p.label || meta.label, topic: meta.topic, slides: [] };
        });
        const deckKeys = Object.keys(decks);
        const allBuilt =
          deckKeys.length > 0 &&
          deckKeys.every(function (k) {
            return decks[k].length > 0;
          });
        if (!allBuilt) throw new Error("No valid library plans returned.");
        // Warm the SVG caches for every bench deck in the background
        // (renderers re-kick ensure on their own if this rejects).
        const allSlides: Slide[] = [];
        deckKeys.forEach(function (k) {
          allSlides.push.apply(allSlides, decks[k]);
        });
        ensureLibraryAssets(allSlides).catch(function () {});
        clearGenTimer();
        genCtrl = null;
        set(function (s) {
          const firstDeck = plan.plans[0] ? decks[plan.plans[0].key] : undefined;
          return {
            topic: topic,
            libSeed: seed,
            libraryDecks: decks,
            variants: chips,
            uniqueDecks: null,
            selectedVariantKey: null,
            selectedVariantLabel: "",
            // Provisional name for mid-choose drafts; commitLibraryDeck
            // overwrites it with the chosen deck's cover headline.
            articleTitle: (firstDeck && firstDeck[0] && firstDeck[0].title) || s.articleTitle,
            captionOptions: plan.captionOptions, // may be [] — PUBLISH regenerates
            selectedCaptionIdx: 0,
            dirtySinceVariant: false,
            genStage: 3,
            generating: false,
            station: "choose" as Station,
            maxStation: Math.max(s.maxStation, ordOf("choose")),
            preloadKey: inputsKey, // bench matches these inputs (CREATE CTA reads it)
          };
        });
      } catch (e) {
        if (lctrl.signal.aborted) return; // cancelled: state already reset
        clearGenTimer();
        // generating stays true so the overlay shows the inline error + retry.
        set({ genError: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    clearGenTimer();
    if (genCtrl) genCtrl.abort(); // invalidate any still-pending run (retry safety)
    const ctrl = new AbortController();
    genCtrl = ctrl;
    set({ generating: true, genStage: 0, genError: null, station: "generating" });
    // Stage readout: 0 immediately, advance every ~6s, hold at 2 (DRAFT
    // VARIANTS) until the API settles; 3 (COMPOSE PREVIEWS) is success-only.
    genTimer = setInterval(function () {
      const s = useWizard.getState();
      if (!s.generating || s.genError !== null) return;
      if (s.genStage < 2) useWizard.setState({ genStage: s.genStage + 1 });
    }, 6000);
    try {
      const variants = await generateCarousel({
        text: st.text,
        url: st.url,
        category: st.category,
        mode: st.countMode,
        pageCount: st.pageCount || 4,
        imageUrls: st.articleImages,
      });
      if (ctrl.signal.aborted) return; // cancelled mid-flight: discard
      const keys = Object.keys(variants).filter(function (k) {
        return variants[k] && Array.isArray(variants[k].slides) && variants[k].slides.length > 0;
      });
      if (keys.length === 0) throw new Error("No valid variants returned.");
      clearGenTimer();
      genCtrl = null;
      set(function (s) {
        return {
          variants: variants,
          genStage: 3,
          generating: false,
          station: "choose" as Station,
          maxStation: Math.max(s.maxStation, ordOf("choose")),
        };
      });
      // v3.7: adopt topic + seed for the library backdrops the picked deck
      // will wear (variants are raw API slides; stamps land at pickVariant).
      classicChainKick();
    } catch (e) {
      if (ctrl.signal.aborted) return; // cancelled: state already reset
      clearGenTimer();
      // generating stays true so the overlay shows the inline error + retry.
      set({ genError: e instanceof Error ? e.message : String(e) });
    }
  },

  abortGenerate() {
    if (genCtrl) {
      genCtrl.abort();
      genCtrl = null;
    }
    clearGenTimer();
    // Inputs are untouched — "Cancel run / KEEPS YOUR SOURCE".
    set({ generating: false, genStage: 0, genError: null, station: "create" });
  },

  dismissError() {
    clearGenTimer();
    genCtrl = null;
    set({ generating: false, genStage: 0, genError: null, station: "create" });
  },

  // ─── verbatim: instant local split -> choose (cover bench) ───
  splitNow() {
    const st = get();
    const raw = (st.text || "").trim();
    if (!raw) {
      showToast("Paste the analyst's text first.", "error");
      return;
    }
    const target = st.countMode === "manual" ? st.pageCount || 5 : 0;
    const apiSlides = splitVerbatim(raw, target);
    if (apiSlides.length === 0) {
      showToast("Could not split that text into slides.", "error");
      return;
    }
    const editorSlides = seedCoverAccent(
      apiSlidesToEditorSlides(apiSlides, apiSlides.length),
      st.category
    );
    // One synthetic variant so the variant chip + caption gen work downstream
    // (mirrors V1 generate()'s verbatim branch).
    const verbVariant: Variant = {
      label: "Verbatim",
      topic: "Analyst text, formatted as-is.",
      slides: apiSlides,
    };
    set(function (s) {
      return {
        variants: { V: verbVariant },
        selectedVariantKey: "V",
        selectedVariantLabel: "Verbatim",
        slides: editorSlides,
        activeIdx: 0,
        undoStack: [],
        dirtySinceVariant: false,
        captionOptions: [],
        selectedCaptionIdx: 0,
        articleTitle: coverTitleOf(editorSlides) || s.articleTitle,
        station: "choose" as Station,
        maxStation: Math.max(s.maxStation, ordOf("choose")),
      };
    });
    // v3.7: verbatim always has text — the topic suggestion + backdrop
    // stamps land as soon as the topics JSON is in (usually warm already).
    classicChainKick();
  },

  // ─── variant pick ───
  // Executes unconditionally; when slides exist AND dirtySinceVariant is set,
  // the CALLER shows confirmDialog before invoking (docs/ARCHITECTURE.md).
  pickVariant(key) {
    const st = get();
    // Unique directions carry ready editor slides: clone the chosen deck
    // directly, skipping apiSlidesToEditorSlides/seedCoverAccent.
    if (st.mode === "unique") {
      const deck = st.uniqueDecks ? st.uniqueDecks[key] : undefined;
      if (!deck || !Array.isArray(deck) || deck.length === 0) return;
      // v3.7: stamps ride the clone; the wrap covers a pick that outruns the
      // async deck stamping (topics still loading).
      const uSlides = withLibraryChain(structuredClone(deck));
      const meta = uniqueDirectionMeta(key);
      set(function (s) {
        return {
          slides: uSlides,
          activeIdx: 0,
          undoStack: [],
          selectedVariantKey: key,
          selectedVariantLabel: meta.label,
          articleTitle: coverTitleOf(uSlides),
          captionOptions: [],
          selectedCaptionIdx: 0,
          dirtySinceVariant: false,
          station: "edit" as Station,
          maxStation: Math.max(s.maxStation, ordOf("edit")),
        };
      });
      return;
    }
    const picked = st.variants ? st.variants[key] : undefined;
    if (!picked || !Array.isArray(picked.slides) || picked.slides.length === 0) return;
    // v3.7: the chain wrap stamps the classic deck's library backdrops
    // (topic + seed were adopted by generate()'s classicChainKick).
    const editorSlides = withLibraryChain(
      seedCoverAccent(
        apiSlidesToEditorSlides(picked.slides, picked.slides.length),
        st.category
      )
    );
    set(function (s) {
      return {
        slides: editorSlides,
        activeIdx: 0,
        undoStack: [],
        selectedVariantKey: key,
        selectedVariantLabel: picked.label || "Variant " + key,
        articleTitle: coverTitleOf(editorSlides),
        captionOptions: [],
        selectedCaptionIdx: 0,
        dirtySinceVariant: false,
        station: "edit" as Station,
        maxStation: Math.max(s.maxStation, ordOf("edit")),
      };
    });
  },

  // ─── library commit (CHOOSE bench → EDIT) ───
  // Mirror of pickVariant's unique branch: library decks carry ready editor
  // slides, so the chosen deck is cloned directly. libraryDecks stays for
  // back-navigation, exactly like uniqueDecks survives a unique pick.
  commitLibraryDeck(key) {
    const st = get();
    const deck = st.libraryDecks ? st.libraryDecks[key] : undefined;
    if (!deck || !Array.isArray(deck) || deck.length === 0) return;
    const lSlides = structuredClone(deck);
    const label = libraryDeckLabel(key, st.variants ? st.variants[key] : undefined);
    set(function (s) {
      return {
        slides: lSlides,
        activeIdx: 0,
        undoStack: [],
        selectedVariantKey: key,
        selectedVariantLabel: label,
        // Library covers are type "library", not "cover" — the headline fill
        // rides slide.title (coverTitleOf would miss it).
        articleTitle: (lSlides[0] && lSlides[0].title) || s.articleTitle,
        // captionOptions stay: the plan call returned ONE shared set for all
        // three directions (unique wipes per pick because its captions are
        // variant-specific; library's are not).
        dirtySinceVariant: false,
        station: "edit" as Station,
        maxStation: Math.max(s.maxStation, ordOf("edit")),
      };
    });
  },

  // ─── deck ───
  setActiveIdx(i) {
    const n = get().slides.length;
    set({ activeIdx: Math.max(0, Math.min(n > 0 ? n - 1 : 0, i)) });
  },

  setSlides(s) {
    const chained = withLibraryChain(s); // bulk replace can reorder → re-chain
    set(function (prev) {
      return {
        slides: chained,
        activeIdx: Math.max(0, Math.min(chained.length > 0 ? chained.length - 1 : 0, prev.activeIdx)),
        dirtySinceVariant: true,
      };
    });
  },

  updateSlide(i, s) {
    const st = get();
    if (i < 0 || i >= st.slides.length) return;
    // No pushUndo here — this fires per keystroke while typing on canvas.
    const next = st.slides.slice();
    next[i] = s;
    set({ slides: next, dirtySinceVariant: true });
  },

  addSlide(afterIdx) {
    const st = get();
    get().pushUndo();
    let at = (typeof afterIdx === "number" ? afterIdx : st.activeIdx) + 1;
    at = Math.max(0, Math.min(st.slides.length, at));
    if (at === 0 && st.slides.length > 0) at = 1; // never before the cover
    const next = st.slides.slice();
    const isUniqueDeck = st.slides.length > 0 && st.slides[0].type === "unique";
    next.splice(at, 0, isUniqueDeck ? defaultUniqueSlide(st.slides) : defaultBodySlide());
    // Library decks: an insert shifts every later chain index → re-resolve.
    set({ slides: withLibraryChain(recomputePositions(next)), activeIdx: at, dirtySinceVariant: true });
  },

  duplicateSlide(i) {
    const st = get();
    if (i < 0 || i >= st.slides.length) return;
    get().pushUndo();
    slideSeq += 1;
    const copy = structuredClone(st.slides[i]);
    copy.id = "slide-" + Date.now() + "-" + slideSeq;
    const next = st.slides.slice();
    next.splice(i + 1, 0, copy);
    // Library decks: the copy carries libraryBgOverride too — re-chain so the
    // no-consecutive-repeat rule resolves around the duplicate.
    set({ slides: withLibraryChain(recomputePositions(next)), activeIdx: i + 1, dirtySinceVariant: true });
  },

  removeSlide(i) {
    const st = get();
    if (st.slides.length <= 1) return; // never empty the deck
    if (i < 0 || i >= st.slides.length) return;
    get().pushUndo();
    const next = st.slides.filter(function (_, idx) {
      return idx !== i;
    });
    const re = withLibraryChain(recomputePositions(next)); // library: indices shifted → re-chain
    const shifted = st.activeIdx > i ? st.activeIdx - 1 : st.activeIdx;
    set({
      slides: re,
      activeIdx: Math.max(0, Math.min(re.length - 1, shifted)),
      dirtySinceVariant: true,
    });
  },

  moveSlide(from, to) {
    const st = get();
    const n = st.slides.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return;
    // Slide 1 stays the cover: when the deck leads with a cover, neither the
    // cover itself nor another slide may take index 0.
    const first = st.slides[0];
    const coverLocked = !!first && typeof first.type === "string" && first.type.indexOf("cover") === 0;
    if (coverLocked && (from === 0 || to === 0)) return;
    get().pushUndo();
    const next = st.slides.slice();
    const moved = next.splice(from, 1)[0];
    next.splice(to, 0, moved);
    // Follow the active slide through the reorder.
    let active = st.activeIdx;
    if (active === from) active = to;
    else if (from < active && to >= active) active -= 1;
    else if (from > active && to <= active) active += 1;
    // Library decks: order feeds the chain (prevKey no-repeat) → re-resolve.
    set({ slides: withLibraryChain(recomputePositions(next)), activeIdx: active, dirtySinceVariant: true });
  },

  // ─── library mode (docs/LIBRARY-INTEGRATION.md §E) ───
  setBgMode(m) {
    const st = get();
    if (st.bgMode === m) return;
    set({ bgMode: m });
    // Mode drives whole-deck resolution: re-chain the working deck and every
    // bench deck (overrides respected in both modes).
    if (isLibraryDeck(st.slides)) {
      set({ slides: withLibraryChain(get().slides), dirtySinceVariant: true });
    }
    if (st.libraryDecks) {
      set({ libraryDecks: withLibraryDeckChains(get().libraryDecks) });
    }
  },

  setTopic(k) {
    const st = get();
    if (st.topic === k) return;
    set({ topic: k });
    // Topic drives the backdrop pool: re-resolve the whole chain (overrides
    // respected — a finalized key still wins and still feeds prevKey).
    // v3.7: classic/verbatim/unique decks re-chain too (withLibraryChain
    // gates on bgSource for them).
    if (st.slides.length) {
      set({ slides: withLibraryChain(get().slides) });
    }
    // v2: the bench decks re-chain (and re-tint) too, so CHOOSE previews and
    // a later back-navigation commit stay in step with the working deck.
    if (st.libraryDecks) {
      set({ libraryDecks: withLibraryDeckChains(get().libraryDecks) });
    }
    if (st.uniqueDecks && st.bgSource === "library") {
      classicChainKick();
    }
  },

  setSlideBgOverride(idx, key) {
    const st = get();
    if (idx < 0 || idx >= st.slides.length) return;
    const target = st.slides[idx];
    if (!target) return;
    // v3.7: classic/verbatim/unique slides are pickable too once the deck
    // wears library backdrops (their chain is always rotate → per-slide).
    // ONLY in a pure classic deck: a non-library slide inside a Neu deck
    // must stay a no-op, or its override would steer resolveBgInfinity /
    // the rotate prevKey chain and re-skin the library slides (review
    // finding, v3.7).
    const isLib = target.type === "library";
    if (!isLib && (st.bgSource !== "library" || isLibraryDeck(st.slides))) return;
    // Discrete inspector click (not per-keystroke) → same undo coverage as
    // the other one-shot deck mutations; Cmd+Z restores the previous pick.
    get().pushUndo();
    const next = st.slides.slice();
    if (isLib && st.bgMode === "infinity") {
      // Infinity: the backdrop is DECK-LEVEL — a pick (or AUTO) applies to
      // every library slide so intent survives reorders and deletions.
      for (let i = 0; i < next.length; i++) {
        const sl = next[i];
        if (sl.type === "library") next[i] = { ...sl, libraryBgOverride: key };
      }
    } else {
      // null clears back to AUTO (assignment); a key is the user's finalize —
      // it wins for this slide AND feeds prevKey for the slide after it.
      next[idx] = { ...target, libraryBgOverride: key };
    }
    set({ slides: withLibraryChain(next), dirtySinceVariant: true });
  },

  setBenchDeckBg(deckKey, key) {
    const st = get();
    const deck = st.libraryDecks ? st.libraryDecks[deckKey] : undefined;
    if (!deck || deck.length === 0) return;
    // Same mode split as setSlideBgOverride: ∞ picks are DECK-LEVEL (every
    // library slide carries the override so intent survives the commit and
    // later reorders); rotate finalizes the COVER and the chain advances the
    // rest past it (per-slide finalize stays an EDIT affordance). AUTO
    // (null) clears every override in both modes — a full reset back to the
    // assigned pick. No undo push: the bench pre-dates the working deck's
    // undo stack, and a re-pick fully restores either state.
    const deckWide = st.bgMode === "infinity" || key === null;
    const next = deck.map(function (sl, i) {
      if (sl.type !== "library") return sl;
      return deckWide || i === 0 ? { ...sl, libraryBgOverride: key } : sl;
    });
    set({
      libraryDecks: withLibraryDeckChains({
        ...(st.libraryDecks as Record<string, Slide[]>),
        [deckKey]: next,
      }),
    });
  },

  setBgSource(v) {
    const st = get();
    if (st.bgSource === v) return;
    if (st.slides.length) get().pushUndo();
    if (v === "legacy") {
      // Back to the mode-native look: strip every library stamp off
      // non-library slides (renderers key off slide.libraryBg alone) in the
      // working deck and the unique bench decks. Library decks are immune —
      // their backdrops ARE the mode.
      const strip = function (arr: Slide[]): Slide[] {
        return arr.map(function (sl) {
          if (sl.type === "library") return sl;
          if (!sl.libraryBg && !sl.libraryBgOverride && !sl.libraryPalette) return sl;
          return {
            ...sl,
            libraryBg: undefined,
            libraryBgFlip: undefined,
            libraryBgNative: undefined,
            libraryBgOverride: undefined,
            libraryPalette: undefined,
          };
        });
      };
      set({
        bgSource: v,
        slides: strip(st.slides),
        uniqueDecks: st.uniqueDecks ? mapDecks(st.uniqueDecks, strip) : st.uniqueDecks,
        dirtySinceVariant: st.slides.length ? true : st.dirtySinceVariant,
      });
      return;
    }
    set({ bgSource: v, dirtySinceVariant: st.slides.length ? true : st.dirtySinceVariant });
    classicChainKick();
  },

  // ─── undo ───
  // v3.7: frames carry bgSource + uniqueDecks alongside the slides — a
  // Cmd+Z across the BACKDROP source toggle must restore all three together
  // or the seg contradicts the stamps (review finding). The stack is
  // in-memory only (never persisted; every hydrate resets it), so the
  // frame shape is free to change.
  pushUndo() {
    const st = get();
    const stack = st.undoStack.slice(-29); // cap at 30 after push
    stack.push({
      slides: structuredClone(st.slides),
      bgSource: st.bgSource,
      uniqueDecks: st.uniqueDecks ? structuredClone(st.uniqueDecks) : null,
    });
    set({ undoStack: stack });
  },

  undo() {
    const st = get();
    if (st.undoStack.length === 0) return;
    const stack = st.undoStack.slice();
    const prev = stack.pop() as UndoFrame;
    set({
      slides: prev.slides,
      bgSource: prev.bgSource,
      uniqueDecks: prev.uniqueDecks,
      undoStack: stack,
      activeIdx: Math.max(0, Math.min(prev.slides.length > 0 ? prev.slides.length - 1 : 0, st.activeIdx)),
      dirtySinceVariant: true,
    });
  },

  // ─── captions ───
  setCaptionOptions(opts) {
    set({ captionOptions: opts });
  },

  setSelectedCaptionIdx(i) {
    set({ selectedCaptionIdx: i });
  },

  setPlatTab(t) {
    set({ platTab: t });
  },

  updateCaptionOption(idx, patch) {
    const st = get();
    if (idx < 0 || idx >= st.captionOptions.length) return;
    const next = st.captionOptions.slice();
    next[idx] = { ...next[idx], ...patch };
    set({ captionOptions: next });
  },

  // ─── archive ───
  // Accepts a V1 archive row verbatim (data payload shape per ARCHITECTURE
  // PUBLISH: slides, caption, captionOptions, selectedCaptionIdx, theme,
  // sourceUrl, articleTitle, timestamp, slideCount, createdBy, createdByRole,
  // wizardInputs). Mirrors legacy loadFromArchive (carousel.tsx:3286-3318).
  loadFromArchive(row) {
    // an in-flight CREATE preload must never land into the opened archive
    if (preCtrl) {
      preCtrl.abort();
      preCtrl = null;
    }
    const data = (row && row.data ? row.data : {}) as Record<string, unknown>;
    const slides = (Array.isArray(data.slides) ? data.slides : []) as Slide[];
    const wi = (
      data.wizardInputs && typeof data.wizardInputs === "object" ? data.wizardInputs : {}
    ) as Record<string, unknown>;
    // Unique/library decks are self-describing: any slide of those types
    // marks the whole deck (checked BEFORE the verbatim heuristic). Verbatim
    // decks flag themselves in wizardInputs or are detectable by a template
    // cover slide (legacy heuristic, kept verbatim).
    const isLibrary =
      slides.some(function (s) {
        return !!s && s.type === "library";
      }) || wi.generationMode === "library";
    const isUnique = slides.some(function (s) {
      return !!s && s.type === "unique";
    });
    const mode: WizardMode = isLibrary
      ? "library"
      : isUnique
        ? "unique"
        : wi.generationMode === "verbatim" ||
            slides.some(function (s) {
              return !!(s && s.coverTemplate);
            })
          ? "verbatim"
          : "ai";
    // Re-seed the verbatim wizard draft so legacy resume flows still work.
    if (mode === "verbatim") {
      const vd = verbatimDraftFromArchive(data);
      if (vd) saveVerbatimDraft(vd);
    }
    set(function (s) {
      return {
        archiveId: row.id,
        mode: mode,
        category: (data.theme as ThemeKey) || s.category,
        url: String(data.sourceUrl || ""),
        text: typeof wi.text === "string" ? (wi.text as string) : s.text,
        countMode: (wi.mode === "manual" ? "manual" : "auto") as "auto" | "manual",
        pageCount: typeof wi.pageCount === "number" ? (wi.pageCount as number) : s.pageCount,
        // Library deck state rides wizardInputs additively; the resolved
        // libraryBg keys ride the slides themselves, so an old row missing
        // these (topic null / seed 0) still renders identically — a later
        // re-generate just stamps a fresh seed. Unknown topic strings are
        // harmless: pickBackdrop degrades them to the brand pool.
        topic: typeof wi.topic === "string" && wi.topic ? (wi.topic as LibTopicKey) : null,
        libSeed:
          typeof wi.libSeed === "number" && (wi.libSeed as number) > 0
            ? Math.floor(wi.libSeed as number)
            : 0,
        bgMode: (wi.bgMode === "infinity" ? "infinity" : "rotate") as "rotate" | "infinity",
        // v3.7: rows that never opted in hydrate LEGACY (photo/procedural
        // decks keep their authored look); stamped rows re-render from the
        // libraryBg keys riding their slides.
        bgSource: (wi.bgSource === "library" ? "library" : "legacy") as "legacy" | "library",
        slides: slides,
        activeIdx: 0,
        undoStack: [],
        articleTitle: String(data.articleTitle || "") || coverTitleOf(slides),
        captionOptions: Array.isArray(data.captionOptions)
          ? (data.captionOptions as CaptionOption[])
          : [],
        selectedCaptionIdx:
          typeof data.selectedCaptionIdx === "number" ? (data.selectedCaptionIdx as number) : 0,
        variants: null,
        selectedVariantKey: null,
        selectedVariantLabel: mode === "verbatim" ? "Verbatim" : "",
        uniqueDecks: null,
        // Bench decks are not archived (the committed deck IS data.slides) —
        // same handling as uniqueDecks; adopting lands straight in EDIT.
        libraryDecks: null,
        dirtySinceVariant: false,
        generating: false,
        genStage: 0,
        genError: null,
        station: "edit" as Station,
        maxStation: ordOf("publish"),
      };
    });
    // v3.7: same recovery as hydrateFromDraft — a library-source archive row
    // whose slides missed their stamp re-chains deterministically from the
    // persisted (topic, libSeed).
    const adopted = get();
    if (
      adopted.bgSource === "library" &&
      adopted.slides.length > 0 &&
      !adopted.slides.some(function (sl) { return sl.type === "library"; }) &&
      adopted.slides.some(function (sl) { return !sl.libraryBg; })
    ) {
      classicChainKick();
    }
  },

  // ─── draft hydrate ───
  hydrateFromDraft(d) {
    // an in-flight CREATE preload must never land into the resumed draft
    if (preCtrl) {
      preCtrl.abort();
      preCtrl = null;
    }
    if (!d || typeof d !== "object") return;
    // Never resume INTO the generating overlay — the run is long gone.
    const station: Station =
      d.station && d.station !== "generating" && RAIL_ORDER.concat(["home"]).indexOf(d.station) !== -1
        ? d.station
        : "create";
    set({
      mode:
        d.mode === "unique"
          ? "unique"
          : d.mode === "verbatim"
            ? "verbatim"
            : d.mode === "library"
              ? "library"
              : "ai",
      category: d.category || "general",
      url: typeof d.url === "string" ? d.url : "",
      text: typeof d.text === "string" ? d.text : "",
      countMode: d.countMode === "manual" ? "manual" : "auto",
      pageCount: typeof d.pageCount === "number" ? d.pageCount : 4,
      articleImages: Array.isArray(d.articleImages) ? d.articleImages : [],
      fetchingImages: false,
      articleTitle: typeof d.articleTitle === "string" ? d.articleTitle : "",
      // v3.3 preload: preference + bench hash persist; in-flight state never
      // does (mirror fetchingImages — a preload cannot resume mid-call).
      autoLoad: d.autoLoad === true,
      preloadKey: typeof d.preloadKey === "string" ? d.preloadKey : "",
      preloading: false,
      preloadError: null,
      preloadAttemptKey: "",
      variants: d.variants || null,
      selectedVariantKey: typeof d.selectedVariantKey === "string" ? d.selectedVariantKey : null,
      selectedVariantLabel: typeof d.selectedVariantLabel === "string" ? d.selectedVariantLabel : "",
      uniqueDecks: validSlideDecks(d.uniqueDecks),
      // Mid-choose library resumes land back on the bench: station "choose"
      // + libraryDecks restore together (labels ride the variants chips).
      libraryDecks: validSlideDecks(d.libraryDecks),
      // Library keys are additive with safe defaults (old drafts carry
      // neither); resolved libraryBg/libraryPalette stamps ride the slides,
      // so resume re-renders identically without a chain re-run.
      topic: typeof d.topic === "string" && d.topic ? (d.topic as LibTopicKey) : null,
      libSeed: typeof d.libSeed === "number" && d.libSeed > 0 ? Math.floor(d.libSeed) : 0,
      // Old drafts (no bgMode) hydrate to ROTATE: their stamped chains
      // re-render identically without a re-run.
      bgMode: d.bgMode === "infinity" ? "infinity" : "rotate",
      // v3.7: old drafts (no bgSource) hydrate to LEGACY so classic decks
      // authored on photo JPGs / unique procedural fields keep their look.
      bgSource: d.bgSource === "library" ? "library" : "legacy",
      slides: Array.isArray(d.slides) ? d.slides : [],
      activeIdx: typeof d.activeIdx === "number" ? Math.max(0, d.activeIdx) : 0,
      undoStack: [],
      dirtySinceVariant: false,
      captionOptions: Array.isArray(d.captionOptions) ? d.captionOptions : [],
      selectedCaptionIdx: typeof d.selectedCaptionIdx === "number" ? d.selectedCaptionIdx : 0,
      platTab: d.platTab === "tiktok" || d.platTab === "shorts" ? d.platTab : "instagram",
      archiveId: typeof d.archiveId === "string" ? d.archiveId : null,
      generating: false,
      genStage: 0,
      genError: null,
      station: station,
      maxStation: Math.max(typeof d.maxStation === "number" ? d.maxStation : 0, ordOf(station)),
      draftSavedAt: typeof d.savedAt === "number" ? d.savedAt : null,
    });
    // v3.7: a library-source classic deck persisted before its stamp landed
    // (offline / killed tab) recovers here — the kick is idempotent and
    // deterministic given the persisted (topic, libSeed).
    const resumed = get();
    if (
      resumed.bgSource === "library" &&
      resumed.slides.length > 0 &&
      !resumed.slides.some(function (sl) { return sl.type === "library"; }) &&
      resumed.slides.some(function (sl) { return !sl.libraryBg; })
    ) {
      classicChainKick();
    }
  },
}));

// ═══ DRAFT AUTOSAVE ═══ (docs/ARCHITECTURE.md: 600ms debounce, lean retry)
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastWrittenJson = ""; // change gate; also breaks the draftSavedAt echo

function draftSubset(s: WizardStore): WizardDraft {
  return {
    mode: s.mode,
    category: s.category,
    url: s.url,
    text: s.text,
    countMode: s.countMode,
    pageCount: s.pageCount,
    articleImages: s.articleImages,
    articleTitle: s.articleTitle,
    autoLoad: s.autoLoad,
    preloadKey: s.preloadKey,
    variants: s.variants,
    selectedVariantKey: s.selectedVariantKey,
    selectedVariantLabel: s.selectedVariantLabel,
    uniqueDecks: s.uniqueDecks,
    libraryDecks: s.libraryDecks,
    topic: s.topic,
    libSeed: s.libSeed,
    bgMode: s.bgMode,
    bgSource: s.bgSource,
    slides: s.slides,
    activeIdx: s.activeIdx,
    captionOptions: s.captionOptions,
    selectedCaptionIdx: s.selectedCaptionIdx,
    platTab: s.platTab,
    archiveId: s.archiveId,
    station: s.station,
    maxStation: s.maxStation,
  };
}

// Quota lean retry: strip base64 data: URLs from slides + articleImages
// (mirrors engine/verbatim.ts saveVerbatimDraft's lean-retry pattern).
function leanDraft(d: WizardDraft): WizardDraft {
  const noData = function (u: string | undefined) {
    return u && u.indexOf("data:") === 0 ? "" : u;
  };
  const leanSlides = function (arr: Slide[] | undefined) {
    return (arr || []).map(function (sl) {
      return { ...sl, imageUrl: noData(sl.imageUrl), imageUrl2: noData(sl.imageUrl2) };
    });
  };
  return {
    ...d,
    articleImages: (d.articleImages || []).filter(function (u) {
      return !!u && u.indexOf("data:") !== 0;
    }),
    slides: leanSlides(d.slides),
    // Library bench decks carry full slide arrays too — same strip per deck.
    libraryDecks: d.libraryDecks ? mapDecks(d.libraryDecks, leanSlides) : d.libraryDecks,
  };
}

function writeDraft(): void {
  if (typeof window === "undefined") return;
  const subset = draftSubset(useWizard.getState());
  let json: string;
  try {
    json = JSON.stringify(subset);
  } catch {
    return; // unserializable state; skip this tick
  }
  if (json === lastWrittenJson) return;
  const savedAt = Date.now();
  try {
    window.localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify({ ...subset, savedAt: savedAt }));
    lastWrittenJson = json;
    useWizard.setState({ draftSavedAt: savedAt });
  } catch {
    try {
      window.localStorage.setItem(
        WIZARD_DRAFT_KEY,
        JSON.stringify({ ...leanDraft(subset), savedAt: savedAt })
      );
      lastWrittenJson = json; // gate on intent, not payload: avoids rewrite loops
      useWizard.setState({ draftSavedAt: savedAt });
    } catch {
      /* still over quota — give up silently */
    }
  }
}

if (typeof window !== "undefined") {
  useWizard.subscribe(function () {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(writeDraft, 600);
  });
}

// ═══ DRAFT IO HELPERS ═══
/** Parsed draft, or null when none exists or it holds nothing meaningful
 *  (no slides AND no text AND no url). */
export function loadDraft(): WizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as WizardDraft;
    if (!d || typeof d !== "object") return null;
    const meaningful =
      (Array.isArray(d.slides) && d.slides.length > 0) ||
      !!(d.text && d.text.trim()) ||
      !!(d.url && d.url.trim());
    return meaningful ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WIZARD_DRAFT_KEY);
  } catch {
    /* ignore */
  }
  lastWrittenJson = "";
}




