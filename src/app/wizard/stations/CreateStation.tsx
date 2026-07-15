"use client";
// ═══════════════════════════════════════════════════════════════════════════
// CreateStation — 01 · CREATE — SOURCE & SPECIFICATION
//
// THE FOUNDRY reskin per docs/THEME-FOUNDRY.md §8 CREATE (flow + frozen copy
// per DESIGN-SPEC.md v2 §8). Store wiring is UNCHANGED from v1: url blur/Enter
// image fetch, .txt/.md drag-drop + BROWSE, Cmd+G primary, image pool
// merge/remove/add, patch().
// Left: mode cards (ai / verbatim / unique / library), source, category chips,
// count — forged plate sections with Register-1 heads. Library mode adds a
// TOPIC section (14 chips + 3-candidate backdrop strip, LIBRARY-INTEGRATION §F)
// and hides the category JPG mini-previews (library slides don't wear them).
// Right: live run summary plate carrying the hot edge + the one amber CTA.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent as ReactDragEvent } from "react";
import { useWizard, preloadInputsKey, type WizardMode } from "../store";
import { THEMES, getBackdropUrl, type ThemeKey } from "../engine/types";
import { fetchArticleImages } from "../engine/api";
import { loadTopics, topicsSync, bgSvgUrl, type TopicsData, type LibTopicKey } from "../engine/library/data";
import { candidates, postSeed } from "../engine/library/backdrop";
import { NATIVE_PREFIX, nativeMetaOf, nativePoolForTopic, renderNativeBgInner } from "../engine/library/nativebg";
import { CATEGORY_PALETTE } from "../engine/library/palette";
import { suggestTopic } from "../engine/library/suggest";
import { SectionHeader, Kbd, Chip } from "../components/Chrome";
import { ImagePicker } from "../components/ImagePicker";
import { showToast } from "../../toast-context";

// ═══ constants ═══
const THEME_KEYS: ThemeKey[] = ["general", "internal", "external", "capital"];
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Four generation modes; tint per spec §8 HOME (cobalt / amber / mint) —
// Neu wears coral, the one unspent foundry accent. Naming (2026-07-14):
// the OG backdrop mode is "Classic Carousel"; the design-system platform
// mode (internal key "library" — keys never change) is "Neu".
const MODES: { key: WizardMode; name: string; tag: string; tint: string }[] = [
  { key: "ai", name: "Classic Carousel", tag: "3 VARIANTS · 20-60 S", tint: "var(--cobalt)" },
  { key: "verbatim", name: "Verbatim", tag: "EXACT SPLIT · INSTANT", tint: "var(--amber)" },
  { key: "unique", name: "Unique", tag: "AUTONOMOUS · 3 DIRECTIONS", tint: "var(--mint)" },
  { key: "library", name: "Neu", tag: "90 LAYOUTS · TOPIC BACKDROPS", tint: "var(--coral)" },
];

const MODE_LABEL: Record<WizardMode, string> = {
  ai: "CLASSIC CAROUSEL", verbatim: "VERBATIM", unique: "UNIQUE", library: "NEU",
};

// ═══ helpers ═══
function wordCount(text: string): number {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

function isFetchableUrl(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

/** Summary PROJECT cell: first words of the pasted text, else url host. */
export function projectLabel(text: string, url: string): string {
  const t = (text || "").trim();
  if (t) {
    const firstLine = (t.split(/\n/)[0] || "").trim();
    const words = firstLine.split(/\s+/).slice(0, 4).join(" ");
    const cut = words.length > 26 ? words.slice(0, 26).replace(/\s+\S*$/, "") : words;
    if (cut) return cut.toUpperCase();
  }
  if ((url || "").trim()) {
    try {
      return new URL(url.trim()).hostname.replace(/^www\./, "").toUpperCase();
    } catch {
      /* not a parseable url; fall through */
    }
  }
  return "·";
}

// ═══ style objects (chrome lives in theme.css; these are layout only) ═══
const pageStyle: CSSProperties = {
  width: "min(1240px, calc(100% - 48px))", margin: "0 auto",
  padding: "14px 0 44px", display: "flex", flexDirection: "column", gap: 20,
};
const columnsStyle: CSSProperties = {
  display: "flex", gap: 22, alignItems: "flex-start", minWidth: 0,
};
const leftColStyle: CSSProperties = {
  flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16,
};
const rightColStyle: CSSProperties = {
  flex: "0 0 324px", width: 324, position: "sticky", top: 6,
  display: "flex", flexDirection: "column", gap: 14,
};
const panelStyle: CSSProperties = {
  padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14,
};
const modeRowStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14,
};
const modeCardBase: CSSProperties = {
  textAlign: "left", cursor: "pointer", padding: "15px 17px 14px",
  display: "flex", flexDirection: "column", gap: 7, minWidth: 0,
};
const modeNameStyle: CSSProperties = {
  fontFamily: "var(--grift)", fontWeight: 800, fontSize: 17,
  letterSpacing: "-0.01em", lineHeight: 1, color: "var(--tx)",
};
const modeTagStyle: CSSProperties = {
  fontFamily: "var(--body)", fontSize: 9, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: ".14em", color: "var(--muted)", whiteSpace: "nowrap",
};
const urlTagStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 10,
  letterSpacing: ".14em", color: "var(--dim)",
};
const dropHintRowStyle: CSSProperties = {
  position: "absolute", left: 16, bottom: 9, display: "flex", alignItems: "center", gap: 10,
};
const dropHintStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 9, letterSpacing: ".12em",
  textTransform: "uppercase", color: "var(--dim)", pointerEvents: "none",
};
const browseBtnStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 9, letterSpacing: ".12em",
  textTransform: "uppercase", color: "var(--muted)",
  background: "rgba(228,235,248,.05)", border: "1px solid var(--line-2)",
  borderRadius: 8, padding: "3px 10px", cursor: "pointer",
};
const wcStyle: CSSProperties = {
  position: "absolute", right: 16, bottom: 12, fontFamily: "var(--body)",
  fontWeight: 600, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase",
  color: "var(--dim)", fontVariantNumeric: "tabular-nums", pointerEvents: "none",
};
const removeBtnStyle: CSSProperties = {
  position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%",
  border: "1px solid rgba(224,99,71,.6)", background: "rgba(10,10,12,.88)",
  color: "var(--coral)", fontSize: 12, lineHeight: 1, cursor: "pointer",
  display: "grid", placeItems: "center", padding: 0,
};
const addTileStyle: CSSProperties = {
  width: 78, height: 58, border: "1px dashed var(--line-2)", borderRadius: 10,
  display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 20,
  fontWeight: 300, background: "rgba(12,12,16,.4)", cursor: "pointer", flex: "0 0 auto",
};
const sumRowStyle: CSSProperties = {
  display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14,
};
const sumKeyStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 9.5, letterSpacing: ".14em",
  textTransform: "uppercase", color: "var(--dim)",
};
// Register-1 word values (spec §5: mono kickers are dead); the numerals in a
// row keep mono via sumNumStyle — the single quiet mono usage.
const sumValStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 10, letterSpacing: ".1em",
  textTransform: "uppercase", color: "var(--tx)", fontVariantNumeric: "tabular-nums",
  textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const sumNumStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: ".04em",
};
// The hot edge (spec §4) for the summary plate — static molten hairline.
const hotEdgeStyle: CSSProperties = {
  position: "absolute", left: "10%", right: "10%", bottom: -1, height: 2,
  borderRadius: 2, pointerEvents: "none",
  background: "var(--heat)", backgroundSize: "220% 100%", opacity: 0.6,
};

// Category chips carry their category's accent (spec v3.4): the same color
// the chipboard backdrop and the deck backdrops re-tint to. General wears the
// amber x cobalt split; amber stays the action color (GENERATE owns it).
const CAT_ACCENT: Record<string, string> = {
  general: "var(--amber)", internal: "var(--amber)",
  external: "var(--cobalt)", capital: "var(--mint)",
};
function catChipStyle(on: boolean, k: string): CSSProperties {
  const a = CAT_ACCENT[k] || "var(--amber)";
  return {
    padding: "7px 14px", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 8,
    transition: "color .16s var(--ease), border-color .16s var(--ease), background .16s var(--ease)",
    ...(on
      ? {
          borderColor: "color-mix(in srgb, " + a + " 42%, transparent)",
          background: "color-mix(in srgb, " + a + " 10%, transparent)",
          color: "color-mix(in srgb, " + a + " 72%, var(--tx))",
        }
      : null),
  };
}
function catDotStyle(k: string, on: boolean): CSSProperties {
  return {
    width: 7, height: 7, borderRadius: 999, flex: "0 0 auto",
    opacity: on ? 1 : 0.55,
    background: k === "general"
      ? "linear-gradient(90deg, var(--amber) 0 50%, var(--cobalt) 50% 100%)"
      : CAT_ACCENT[k] || "var(--amber)",
  };
}

// Topic chips (library mode) reuse the category-chip recipe with ONE fixed
// accent: amber is spent on actions (GENERATE owns it), so the finalized
// topic wears the cobalt quench — same law the provider rack follows.
function libTopicChipStyle(on: boolean): CSSProperties {
  return {
    padding: "7px 14px", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 8,
    transition: "color .16s var(--ease), border-color .16s var(--ease), background .16s var(--ease)",
    ...(on
      ? {
          borderColor: "color-mix(in srgb, var(--cobalt) 42%, transparent)",
          background: "color-mix(in srgb, var(--cobalt) 10%, transparent)",
          color: "color-mix(in srgb, var(--cobalt) 72%, var(--tx))",
        }
      : null),
  };
}
// The auto-suggested topic carries a tiny mint tag (finalize pattern: it is
// a DEFAULT the user confirms by clicking any chip, never a lock).
const suggestedTagStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 700, fontSize: 7.5, letterSpacing: ".12em",
  color: "var(--mint)", border: "1px solid rgba(46,173,142,.5)",
  borderRadius: 4, padding: "1px 4px", flex: "0 0 auto",
};
// Backdrop candidate thumbs mirror the category JPG mini-previews (34×42,
// radius 3) — real /library SVGs, name in quiet mono beside each.
const libBgThumbStyle: CSSProperties = {
  width: 34, height: 42, borderRadius: 3, objectFit: "cover", display: "block",
  border: "1px solid rgba(255,255,255,.1)", flex: "0 0 auto",
};
const libBgNameStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 8, letterSpacing: ".08em",
  textTransform: "uppercase", color: "var(--dim)", whiteSpace: "nowrap",
};
// ∞ parsed-world windows: the native compositions are night-dark hairline
// art — at the 34px baked-chip size they read as dead black tiles, so the
// ∞ strip gets larger frames + a stronger PREVIEW-ONLY exposure lift
// (never applied to the composed slides themselves).
const libInfThumbStyle: CSSProperties = {
  width: 84, height: 105, borderRadius: 5, display: "block",
  border: "1px solid rgba(255,255,255,.14)", flex: "0 0 auto",
  filter: "brightness(2.1) saturate(1.3)",
};

function poolThumbStyle(img: string): CSSProperties {
  return {
    position: "relative", width: 78, height: 58, borderRadius: 10, flex: "0 0 auto",
    backgroundImage: "url(" + img + ")", backgroundSize: "cover",
    backgroundPosition: "center", border: "1px solid var(--line-2)",
    display: "inline-block", overflow: "hidden",
  };
}

type FetchChip = { tone: "ok" | "warn"; label: string; retry?: boolean } | null;

// ═══ component ═══
export function CreateStation() {
  const mode = useWizard((s) => s.mode);
  const category = useWizard((s) => s.category);
  const url = useWizard((s) => s.url);
  const text = useWizard((s) => s.text);
  const countMode = useWizard((s) => s.countMode);
  const pageCount = useWizard((s) => s.pageCount);
  const articleImages = useWizard((s) => s.articleImages);
  const fetchingImages = useWizard((s) => s.fetchingImages);
  const topic = useWizard((s) => s.topic);
  const libSeed = useWizard((s) => s.libSeed);
  const patch = useWizard((s) => s.patch);
  const generate = useWizard((s) => s.generate);
  const splitNow = useWizard((s) => s.splitNow);
  const setTopic = useWizard((s) => s.setTopic);
  const bgMode = useWizard((s) => s.bgMode);
  const bgSource = useWizard((s) => s.bgSource);
  const setBgMode = useWizard((s) => s.setBgMode);
  const resetToHome = useWizard((s) => s.resetToHome);
  const generating = useWizard((s) => s.generating);
  const libraryDecks = useWizard((s) => s.libraryDecks);
  const autoLoad = useWizard((s) => s.autoLoad);
  const setAutoLoad = useWizard((s) => s.setAutoLoad);
  const preloading = useWizard((s) => s.preloading);
  const preloadError = useWizard((s) => s.preloadError);
  const preloadKey = useWizard((s) => s.preloadKey);
  const preloadAttemptKey = useWizard((s) => s.preloadAttemptKey);
  const preloadLibrary = useWizard((s) => s.preloadLibrary);
  const go = useWizard((s) => s.go);

  const [fetchChip, setFetchChip] = useState<FetchChip>(null);
  const [dragging, setDragging] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastFetchedUrl = useRef("");

  // Library mode: topic taxonomy (backdrop-topics.json) loads lazily on first
  // entry through data.ts's module cache; the TOPIC section renders nothing
  // until it lands. A failed fetch clears the in-flight promise upstream, so
  // toggling modes retries cleanly.
  const [topicsData, setTopicsData] = useState<TopicsData | null>(topicsSync);
  useEffect(() => {
    // v3.7: every mode needs the taxonomy — classic/verbatim/unique decks
    // wear the topic-pooled library backdrops too (bgSource "library").
    if (topicsData) return;
    let alive = true;
    loadTopics()
      .then(function (d) {
        if (alive) setTopicsData(d);
      })
      .catch(function () {
        /* section stays hidden; re-entering library mode retries */
      });
    return () => {
      alive = false;
    };
  }, [topicsData]);

  // Deterministic local suggestion (finalize pattern): a DEFAULT the user can
  // change — state.topic wins once the user clicks a chip.
  const suggested = useMemo<LibTopicKey | null>(
    () => (topicsData ? suggestTopic(text, topicsData.topics) : null),
    [text, topicsData]
  );
  // v3.7: the parse drives backdrops in EVERY mode now; only a resumed
  // legacy deck (bgSource "legacy") ignores it.
  const activeTopic = topic ?? suggested;

  // Preview seed = the SAME formula generate() stamps when libSeed is 0
  // (v3.3: context-derived, url counts too), so what CREATE previews for
  // rotate candidates AND the ∞ world is what the deck actually gets.
  // Deferred text: the ∞ preview re-renders a full 10-page style strip per
  // seed, so typing must not block on it frame-by-frame.
  const deferredText = useDeferredValue(text);
  const previewSeed = useMemo<number>(
    () => libSeed || postSeed(deferredText || url || "draft"),
    [libSeed, deferredText, url]
  );

  // The wizard's "3 selections" for slide 0 — the same math the store resolves
  // per slide at generate time.
  const bgCandidates = useMemo<string[]>(
    () => (topicsData && activeTopic ? candidates(topicsData, activeTopic, previewSeed, 0) : []),
    [topicsData, activeTopic, previewSeed]
  );

  // ∞ mode parses per CATEGORY + TOPIC at setup (v3.3, topic-aware v3.6):
  // the topic's affinity styles within the category's approved pool,
  // seed-rotated — the exact nativePoolForTopic math the store resolves at
  // generate time. Parity caveat: on a URL-only run the topic is parsed
  // SERVER-side from the fetched article; the local suggestTopic("") fallback
  // cannot know it, so the strip is captioned PROVISIONAL there (the adopted
  // plan.topic re-syncs this preview the moment the run lands).
  const infinityPick = useMemo<{ fam: string; name: string; desc: string } | null>(() => {
    if (mode !== "library" || bgMode !== "infinity") return null;
    const pool = nativePoolForTopic(CATEGORY_PALETTE[category], activeTopic);
    if (!pool.length) return null;
    const fam = pool[previewSeed % pool.length];
    const meta = nativeMetaOf(NATIVE_PREFIX + fam);
    return { fam, name: meta.name, desc: meta.desc };
  }, [mode, bgMode, category, activeTopic, previewSeed]);
  const infinityProvisional = mode === "library" && bgMode === "infinity" && !topic && !text.trim() && !!url.trim();

  // URL blur/Enter -> fetch article images once per distinct valid url.
  // MERGE into the pool (never wipe uploads/fetched), dedupe by exact url.
  const maybeFetchImages = useCallback(
    (raw: string) => {
      const target = (raw || "").trim();
      if (!isFetchableUrl(target) || target === lastFetchedUrl.current) return;
      if (useWizard.getState().fetchingImages) return;
      lastFetchedUrl.current = target;
      setFetchChip(null);
      patch({ fetchingImages: true });
      fetchArticleImages(target)
        .then(function (fetched) {
          const existing = useWizard.getState().articleImages;
          const fresh = fetched.filter(function (u) {
            return !!u && existing.indexOf(u) === -1;
          });
          patch({ articleImages: existing.concat(fresh), fetchingImages: false });
          setFetchChip(
            fetched.length > 0
              ? { tone: "ok", label: "ARTICLE IMAGES FETCHED · " + fetched.length }
              : { tone: "warn", label: "NO ARTICLE IMAGES FOUND" }
          );
        })
        .catch(function () {
          // Clear the once-per-url latch so blur/Enter (or the chip's RETRY)
          // can re-attempt the same address after a transient failure.
          lastFetchedUrl.current = "";
          patch({ fetchingImages: false });
          setFetchChip({ tone: "warn", label: "IMAGE FETCH FAILED", retry: true });
        });
    },
    [patch]
  );

  // Primary action. Guards (need text/url, toast if missing) live in the
  // store: generate() and splitNow() both toast and bail on empty input.
  // Unique rides the same generate(): the store branches on mode.
  // Paste-URL-then-generate race: an in-flight image fetch would ship the
  // run with an empty pool, so wait for fetchingImages to settle (~150ms
  // poll, ~4s cap) then proceed regardless.
  const awaitingFetch = useRef(false);
  const primary = useCallback(() => {
    // v3.3: a fresh background-preloaded bench means the work is DONE —
    // the primary (button or ⌘G) just opens it instead of re-running.
    const pre = useWizard.getState();
    if (
      pre.mode === "library" && pre.libraryDecks && !pre.preloading &&
      pre.preloadKey === preloadInputsKey(pre)
    ) {
      go("choose");
      return;
    }
    if (useWizard.getState().mode === "verbatim") {
      splitNow();
      return;
    }
    if (useWizard.getState().fetchingImages) {
      if (awaitingFetch.current) return; // one queued run at a time
      awaitingFetch.current = true;
      const started = Date.now();
      const tick = () => {
        if (useWizard.getState().fetchingImages && Date.now() - started < 4000) {
          window.setTimeout(tick, 150);
          return;
        }
        awaitingFetch.current = false;
        void generate();
      };
      window.setTimeout(tick, 150);
      return;
    }
    void generate();
  }, [generate, splitNow, go]);

  // v3.3 LOAD: with the toggle on, fire the background preload once context
  // lands (debounced; an in-flight image fetch defers it — the effect
  // re-runs when fetchingImages settles so the pool ships complete).
  useEffect(() => {
    if (!autoLoad || mode !== "library" || generating || preloading || fetchingImages) return;
    const hasCtx = text.trim().length >= 180 || /^https?:\/\/\S+\.\S+/.test(url.trim());
    if (!hasCtx) return;
    const key = preloadInputsKey({ url, text, countMode, pageCount, articleImages });
    if (key === preloadKey) return; // bench already fresh
    // never auto-refire a hash we already attempted (covers persistent API
    // failures — no retry loop); editing any input re-arms with a new hash
    if (key === preloadAttemptKey) return;
    const t = window.setTimeout(() => { void preloadLibrary(); }, 1500);
    return () => window.clearTimeout(t);
  }, [autoLoad, mode, generating, preloading, fetchingImages, url, text, countMode, pageCount, articleImages, preloadKey, preloadAttemptKey, preloadLibrary]);

  // Cmd+G fires the primary even while typing in the textarea (preventDefault
  // beats the browser find-again binding). Stands down while a modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "g" && e.key !== "G") return;
      e.preventDefault();
      if (document.body.hasAttribute("data-modal-open")) return;
      primary();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primary]);

  // .txt/.md into the paste box (drag-drop or BROWSE): read text, APPEND to source.
  const ingestTextFiles = useCallback(
    (list: ArrayLike<File>) => {
      const files = Array.from(list).filter(function (f) {
        return /\.(txt|md|markdown)$/i.test(f.name) || f.type.indexOf("text/") === 0;
      });
      if (files.length === 0) {
        showToast("Drop a .txt or .md file.", "error");
        return;
      }
      files.forEach(function (f) {
        const reader = new FileReader();
        reader.onload = function () {
          const content = String(reader.result || "").trim();
          if (!content) return;
          const cur = useWizard.getState().text;
          patch({ text: cur && cur.trim() ? cur.replace(/\s+$/, "") + "\n\n" + content : content });
        };
        reader.readAsText(f);
      });
    },
    [patch]
  );

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    ingestTextFiles(e.dataTransfer ? e.dataTransfer.files : []);
  };

  const browseRef = useRef<HTMLInputElement>(null);
  const onBrowse = (e: ChangeEvent<HTMLInputElement>) => {
    ingestTextFiles(e.currentTarget.files || []);
    // Clear so re-picking the same file fires change again.
    e.currentTarget.value = "";
  };

  const removeImage = (idx: number) => {
    const existing = useWizard.getState().articleImages;
    patch({
      articleImages: existing.filter(function (_, i) {
        return i !== idx;
      }),
    });
  };

  const addImage = (u: string) => {
    const existing = useWizard.getState().articleImages;
    if (!u) return;
    if (existing.indexOf(u) !== -1) {
      showToast("Image already in the pool.");
      return;
    }
    patch({ articleImages: existing.concat([u]) });
  };

  const words = wordCount(text);
  // v3.3: a background-preloaded bench that still matches the inputs flips
  // the CTA to a straight bench-open (no second LLM run); edited inputs
  // fall back to a full generate.
  const benchFresh =
    mode === "library" && !!libraryDecks && !preloading &&
    preloadKey === preloadInputsKey({ url, text, countMode, pageCount, articleImages });
  const ctaLabel =
    mode === "verbatim" ? "Split into slides"
      : mode === "unique" ? "Design three directions"
        : mode === "library" && preloading ? "Loading the bench…"
          : mode === "library" && benchFresh ? "Open the bench"
            : "Generate carousel";

  return (
    <section className="station-scroll">
      <div style={pageStyle}>
        {/* ── station header ── */}
        <header className="rise d1" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="kicker"><b>01</b> · CREATE — SOURCE &amp; SPECIFICATION</div>
          <h1 className="display">
            Specify the <span className="grad">run</span>.
          </h1>
          <p className="sub" style={{ maxWidth: 520 }}>
            One pass: mode, source, category, count. Nothing asked twice.
          </p>
        </header>

        <div style={columnsStyle}>
          {/* ── left: specification ── */}
          <div style={leftColStyle}>
            {/* mode cards */}
            <div className="rise d2" style={modeRowStyle}>
              {MODES.map((m) => {
                const on = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ mode: m.key })}
                    className="glass glass--tile glass--tint"
                    style={{
                      ...modeCardBase,
                      "--tc": m.tint,
                      ...(on
                        ? { borderColor: m.tint, boxShadow: "inset 0 0 0 1px " + m.tint + ", var(--shadow-panel)" }
                        : null),
                    } as CSSProperties}
                  >
                    <span style={on ? { ...modeNameStyle, color: m.tint } : modeNameStyle}>
                      {m.name}
                    </span>
                    <span style={modeTagStyle}>{m.tag}</span>
                  </button>
                );
              })}
            </div>

            {/* source panel */}
            <div className="glass rise d3" style={panelStyle}>
              <SectionHeader label="Source" accent="URL or paste" />
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={urlTagStyle}>URL</span>
                <input
                  className="input"
                  type="text"
                  value={url}
                  placeholder="https://semianalysis.com/..."
                  onChange={(e) => patch({ url: e.target.value })}
                  onBlur={(e) => maybeFetchImages(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      maybeFetchImages(e.currentTarget.value);
                    }
                  }}
                  style={{ flex: 1, minWidth: 220, width: "auto", fontFamily: "var(--body)", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}
                />
                {fetchingImages ? (
                  <Chip>FETCHING ARTICLE IMAGES</Chip>
                ) : fetchChip?.retry ? (
                  <button
                    type="button"
                    className={"chip " + fetchChip.tone}
                    title="Retry the image fetch"
                    onClick={() => maybeFetchImages(useWizard.getState().url)}
                    style={{ cursor: "pointer" }}
                  >
                    {fetchChip.label} · RETRY
                  </button>
                ) : fetchChip ? (
                  <Chip tone={fetchChip.tone}>{fetchChip.label}</Chip>
                ) : null}
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{
                  position: "relative", display: "flex", minHeight: 260,
                  border: "1px dashed " + (dragging ? "var(--amber)" : "var(--line-2)"),
                  borderRadius: 12, background: "rgba(12,12,16,.5)",
                  padding: "14px 16px 34px",
                  transition: "border-color .16s var(--ease)",
                }}
              >
                <textarea
                  className="input"
                  value={text}
                  placeholder="Paste the article or analyst text here."
                  onChange={(e) => patch({ text: e.target.value })}
                  style={{
                    flex: 1, minHeight: 220, background: "transparent", border: "none",
                    boxShadow: "none", resize: "none", padding: 0,
                    fontFamily: "var(--body)", fontSize: 12.5, lineHeight: 1.8,
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
                <div style={dropHintRowStyle}>
                  <span style={dropHintStyle}>DROP .TXT / .MD OR PASTE</span>
                  <button
                    type="button"
                    title="Browse for a .txt or .md file"
                    onClick={() => browseRef.current?.click()}
                    style={browseBtnStyle}
                  >
                    BROWSE
                  </button>
                  <input
                    ref={browseRef}
                    type="file"
                    accept=".txt,.md,.markdown,text/plain"
                    multiple
                    onChange={onBrowse}
                    style={{ display: "none" }}
                  />
                </div>
                <span style={wcStyle}>{words > 0 ? fmtInt(words) + " WORDS · PARSED" : "AWAITING SOURCE"}</span>
              </div>
              {/* v3.3 LOAD toggle: with it on, the bench builds in the
                  BACKGROUND the moment context lands — stay here, keep
                  tweaking category/topic, then open the bench when ready. */}
              {mode === "library" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={autoLoad}
                    title="Build the three directions in the background as soon as your context lands"
                    onClick={() => setAutoLoad(!autoLoad)}
                    style={libTopicChipStyle(autoLoad)}
                  >
                    LOAD{autoLoad ? " · ON" : ""}
                  </button>
                  <span className="whisper">
                    {preloading
                      ? "loading the bench in the background — keep setting up…"
                      : preloadError
                        ? "load failed: " + preloadError
                        : benchFresh
                          ? "bench ready — open it below"
                          : autoLoad
                            ? "will start loading once your context lands"
                            : "loads the bench in the background after you input context"}
                  </span>
                </div>
              )}
            </div>

            {/* category + count panel */}
            <div className="glass rise d4" style={panelStyle}>
              <SectionHeader label="Category" />
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {THEME_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={THEMES[k].desc}
                    aria-pressed={category === k}
                    onClick={() => patch({ category: k })}
                    className="chip"
                    style={catChipStyle(category === k, k)}
                  >
                    <span style={catDotStyle(k, category === k)} />
                    {THEMES[k].label}
                  </button>
                ))}
              </div>
              {/* Mini backdrop previews (carried over from the V1 picker): the
                  four ACTUAL slide backdrops this category ships, so the pick
                  shows the real look of the posts — general mixes amber+cobalt
                  plates, internal is amber, external cobalt, capital mint.
                  Hidden in library mode: library slides wear the topic-pooled
                  SVG backdrops below, not these JPGs (chips stay — they still
                  drive chrome tint + captions). */}
              {mode !== "library" && bgSource === "legacy" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                  {[1, 2, 3, 4].map((pos) => (
                    <div
                      key={category + pos}
                      style={{
                        width: 34,
                        height: 42,
                        borderRadius: 3,
                        overflow: "hidden",
                        backgroundImage: "url(" + getBackdropUrl(category, pos) + ")",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        border: "1px solid rgba(255,255,255,.1)",
                        flex: "0 0 auto",
                      }}
                    />
                  ))}
                  <span className="whisper" style={{ marginLeft: 8 }}>
                    the backdrops your slides will wear
                  </span>
                </div>
              )}
              {/* Library TOPIC: 14 chips (backdrop-topics.json) — the local
                  suggestion is the active default until the user finalizes by
                  clicking; below, the 3 backdrop candidates for slide 0. */}
              {topicsData && (mode === "library" || bgSource === "library") && (
                <>
                  <SectionHeader label="Topic" accent="drives the backdrop pool" />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {topicsData.topics.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        title={t.covers}
                        aria-pressed={activeTopic === t.key}
                        onClick={() => setTopic(t.key)}
                        className="chip"
                        style={libTopicChipStyle(activeTopic === t.key)}
                      >
                        {t.name}
                        {suggested === t.key && <span style={suggestedTagStyle}>SUGGESTED</span>}
                      </button>
                    ))}
                  </div>
                  {infinityPick ? (
                    /* ∞ parses per CATEGORY at setup (v3.3): first three
                       frames of the parsed style world, tinted to the
                       category — the exact deck-wide default. */
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flex: "0 0 auto" }}>
                        {[0, 1, 2].map((idx) => (
                          <svg
                            key={idx}
                            viewBox="0 0 1080 1350"
                            preserveAspectRatio="xMidYMid slice"
                            style={libInfThumbStyle}
                            dangerouslySetInnerHTML={{
                              __html: renderNativeBgInner(
                                infinityPick.fam, previewSeed, idx,
                                countMode === "manual" ? pageCount || 4 : 6,
                                CATEGORY_PALETTE[category]
                              ),
                            }}
                          />
                        ))}
                        <span style={libBgNameStyle}>∞ {infinityPick.name}</span>
                      </span>
                      <span className="whisper" style={{ marginLeft: 2 }}>
                        {infinityProvisional
                          ? "provisional — the article's parsed topic re-picks the world at generate · re-pick in edit anytime"
                          : infinityPick.desc + " — parsed for " + category + " · re-pick in edit anytime"}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      {bgCandidates.map((key) => (
                        <span
                          key={key}
                          style={{ display: "inline-flex", alignItems: "center", gap: 7, flex: "0 0 auto" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={bgSvgUrl(key)}
                            alt={topicsData.backdrops[key]?.name || "backdrop " + key}
                            style={libBgThumbStyle}
                          />
                          <span style={libBgNameStyle}>{topicsData.backdrops[key]?.name || key}</span>
                        </span>
                      ))}
                      <span className="whisper" style={{ marginLeft: 2 }}>
                        {mode === "library"
                          ? "finalized per slide in edit — you can always pick another"
                          : "auto-picked from this topic's pool — switch per slide in edit"}
                      </span>
                    </div>
                  )}
                  {/* v3: backdrop mode — INFINITY (default) runs one seamless
                      backdrop across the deck; ROTATE keeps per-slide pool
                      rotation. Switchable again in EDIT. Library-mode only:
                      classic/verbatim/unique decks always chain rotate (v3.7). */}
                  {mode === "library" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div className="seg">
                      <button
                        type="button"
                        className={bgMode === "infinity" ? "on" : ""}
                        title="One continuous backdrop across every slide — seams line up as you swipe"
                        onClick={() => setBgMode("infinity")}
                      >∞ INFINITY</button>
                      <button
                        type="button"
                        className={bgMode === "rotate" ? "on" : ""}
                        title="A different pool backdrop per slide, no repeats back-to-back"
                        onClick={() => setBgMode("rotate")}
                      >ROTATE</button>
                    </div>
                    <span className="whisper">
                      {bgMode === "infinity"
                        ? "The deck reads as one continuous strip when swiping."
                        : "Each slide draws its own backdrop from the topic pool."}
                    </span>
                  </div>
                  )}
                </>
              )}
              <SectionHeader label="Slide count" />
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div className="seg">
                  {/* Unique always builds a fixed-length deck (the store's
                      unique branch ignores countMode), so AUTO stands down
                      and the concrete count carries the selection. */}
                  {mode !== "unique" && (
                    <button
                      type="button"
                      className={countMode === "auto" ? "on" : ""}
                      onClick={() => patch({ countMode: "auto" })}
                    >
                      AUTO
                    </button>
                  )}
                  {COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={
                        (mode === "unique" ? pageCount === n : countMode === "manual" && pageCount === n)
                          ? "on"
                          : ""
                      }
                      onClick={() => patch({ countMode: "manual", pageCount: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="whisper">
                  {mode === "unique"
                    ? "Unique builds a fixed-length deck per direction."
                    : "Auto lets the model cut the deck to the argument."}
                </span>
              </div>
            </div>

            {/* image pool: generative backdrops make it moot in unique mode */}
            {mode !== "unique" && (
              <div className="glass rise d5" style={panelStyle}>
                <SectionHeader label="Image pool" accent="optional" />
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {articleImages.map((img, i) => (
                    <span key={i + ":" + img.slice(0, 48)} style={poolThumbStyle(img)}>
                      <button
                        type="button"
                        className="hover-actions"
                        title="Remove image"
                        onClick={() => removeImage(i)}
                        style={removeBtnStyle}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button type="button" title="Add image" onClick={() => setPickerOpen(true)} style={addTileStyle}>
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── right: live run summary + THE amber action ── */}
          <aside className="rise d6" style={rightColStyle}>
            <div className="glass" style={{ ...panelStyle, gap: 12, position: "relative" }}>
              <span aria-hidden="true" style={hotEdgeStyle} />
              <SectionHeader label="Run summary" accent="live" />
              <div style={sumRowStyle}>
                <span style={sumKeyStyle}>SOURCE</span>
                <span style={words > 0 ? { ...sumValStyle, color: "var(--mint)" } : sumValStyle}>
                  {words > 0 ? (
                    <><span style={sumNumStyle}>{fmtInt(words)}</span> WORDS</>
                  ) : url.trim() ? "URL ONLY" : "AWAITING"}
                </span>
              </div>
              <div style={sumRowStyle}>
                <span style={sumKeyStyle}>PROJECT</span>
                <span style={sumValStyle}>{projectLabel(text, url)}</span>
              </div>
              <div style={sumRowStyle}>
                <span style={sumKeyStyle}>CATEGORY</span>
                <span style={sumValStyle}>{THEMES[category].label.toUpperCase()}</span>
              </div>
              {mode === "library" && (
                <div style={sumRowStyle}>
                  <span style={sumKeyStyle}>TOPIC</span>
                  <span style={sumValStyle}>
                    {topicsData && activeTopic
                      ? (topicsData.topics.find((t) => t.key === activeTopic)?.name || activeTopic).toUpperCase()
                      : "·"}
                  </span>
                </div>
              )}
              <div style={sumRowStyle}>
                <span style={sumKeyStyle}>COUNT</span>
                <span style={sumValStyle}>
                  {/* Unique ignores countMode in the store — report the
                      concrete deck length, never AUTO. */}
                  {countMode === "auto" && mode !== "unique"
                    ? "AUTO"
                    : <><span style={sumNumStyle}>{pageCount}</span> SLIDES</>}
                </span>
              </div>
              <div style={sumRowStyle}>
                <span style={sumKeyStyle}>MODE</span>
                <span style={sumValStyle}>{MODE_LABEL[mode]}</span>
              </div>
              {mode !== "unique" && (
                <div style={sumRowStyle}>
                  <span style={sumKeyStyle}>IMAGES</span>
                  <span style={sumValStyle}>
                    <span style={sumNumStyle}>{articleImages.length}</span> IN POOL
                  </span>
                </div>
              )}
              <div style={sumRowStyle}>
                <span style={sumKeyStyle}>OUTPUT</span>
                <span style={sumValStyle}>
                  <span style={sumNumStyle}>1080 × 1350</span> · PNG
                </span>
              </div>
              <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
              <button
                type="button"
                className="btn btn--amber"
                onClick={primary}
                style={{ width: "100%", padding: "14px 18px", fontSize: 12 }}
              >
                {ctaLabel} <Kbd>⌘G</Kbd>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetToHome}
                style={{ width: "100%" }}
              >
                Back
              </button>
              {/* the station's one foundry flavor line (spec §8: fiction is
                  seasoning) — Register 2, no leading em dash (brand voice) */}
              <span className="whisper" style={{ textAlign: "center" }}>
                One pour · stations 02-04 follow.
              </span>
            </div>
          </aside>
        </div>
      </div>

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addImage}
        theme={category}
        context={text ? text.slice(0, 400) : undefined}
      />
    </section>
  );
}

export default CreateStation;
