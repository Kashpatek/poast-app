"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Wizard · CHOOSE station — THE FOUNDRY (docs/THEME-FOUNDRY.md §8; flow per
// docs/DESIGN-SPEC.md v2 §8, §9.6).
//
// Four branches, flow and store wiring unchanged from ARCHITECTURE.md:
//   AI       — "Pick the cut." Three drafted variant forged plates with real
//              SlidePreview mini-decks, WORDS / READ / SLIDES stat rows,
//              arrow-key cycling and Enter to commit (selection = cobalt
//              quench). Re-picking over an edited deck asks first
//              (store.dirtySinceVariant).
//   Verbatim — the COVER BENCH: CoverDesigner (full mode) bound to the
//              cover slide; body slides ship untouched to EDIT.
//   Unique   — the TRIPTYCH: three complete art directions (E/C/S) built by
//              engine/unique/build; pickVariant(key) clones the chosen deck.
//   Library  — the PLATFORM BENCH (LIBRARY-INTEGRATION.md v2 §S): three
//              builds from the approved 90 (DATA-LED / NARRATIVE / VISUAL)
//              keyed by store.libraryDecks; commitLibraryDeck(key) commits.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useWizard } from "../store";
import { Plate, Kbd } from "../components/Chrome";
import { CoverDesigner } from "../components/CoverDesigner";
import { SlidePreview } from "../engine/SlidePreview";
import { apiSlidesToEditorSlides, type Slide, type ThemeKey, type Variant } from "../engine/types";
import { UNIQUE_DIRECTIONS } from "../engine/unique/build";
import { loadTemplates, templatesSync, loadTopics, topicsSync, bgSvgUrl, type LibTemplate, type TopicsData } from "../engine/library/data";
import { isNativeKey, nativeGenKeyOf, nativeMetaOf } from "../engine/library/nativebg";
import { CATEGORY_PALETTE } from "../engine/library/palette";
import { LibBackdropAllModal, LibNativeBgPreview } from "./EditStation";
import { COVER_TEMPLATES } from "../../carousel-covers";
import { confirmDialog } from "../../dialog-context";

// Per-column accents, cycled by index (a=amber, b=cobalt, g=mint; a 4th+
// variant would take coral). Spec tokens only.
const VARIANT_ACCENTS = [
  { color: "#F7B041", border: "rgba(247,176,65,.4)" },
  { color: "#0B86D1", border: "rgba(11,134,209,.5)" },
  { color: "#2EAD8E", border: "rgba(46,173,142,.45)" },
  { color: "#E06347", border: "rgba(224,99,71,.45)" },
];

const MINIS_SHOWN = 5; // mini-deck tiles after the lead slide; overflow -> "+N"
const READ_WPM = 220;

// The three platform build directions, pinned to /api/library v2 plan keys
// (LIBRARY-INTEGRATION.md v2 §Q/§S). Accents follow the bench cycle a/b/g.
const LIBRARY_DIRECTIONS: { key: string; name: string; accent: string }[] = [
  { key: "data", name: "DATA-LED", accent: "#F7B041" },
  { key: "narrative", name: "NARRATIVE", accent: "#0B86D1" },
  { key: "visual", name: "VISUAL", accent: "#2EAD8E" },
];

/* ================= helpers ================= */

function words(s: string | undefined): number {
  if (!s) return 0;
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Word total across every text field the deck renders. */
function deckWords(deck: Slide[]): number {
  return deck.reduce(function (sum, sl) {
    return (
      sum +
      words(sl.title) +
      words(sl.subtitle) +
      words(sl.bodyText) +
      words(sl.caption) +
      words(sl.caption2) +
      words(sl.ctaText)
    );
  }, 0);
}

/** m:ss read time at READ_WPM. */
function readLabel(w: number): string {
  const secs = Math.round((w / READ_WPM) * 60);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function plural(n: number, one: string): string {
  return n + " " + (n === 1 ? one : one + "S");
}

/** Run-length template-family readout for a library deck, in deck order
 *  ("COVER · 2 DETAIL · STAT · END"). "·" until templates.json is warm. */
function familyReadout(deck: Slide[], tpls: LibTemplate[] | null): string {
  if (!tpls) return "·";
  const famByIdx: Record<number, string> = {};
  tpls.forEach(function (t) {
    famByIdx[t.idx] = t.family;
  });
  const parts: string[] = [];
  let prev = "";
  let run = 0;
  const flush = function () {
    if (run > 0) parts.push((run > 1 ? run + " " : "") + prev.toUpperCase());
  };
  deck.forEach(function (sl) {
    const fam = (sl.libraryTemplate !== undefined && famByIdx[sl.libraryTemplate]) || "?";
    if (fam === prev) {
      run++;
      return;
    }
    flush();
    prev = fam;
    run = 1;
  });
  flush();
  return parts.join(" · ");
}

/* ================= layout styles ================= */

const wrapStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: "30px 38px 58px",
};

const headStyle: CSSProperties = { display: "flex", alignItems: "baseline", gap: 22 };

const statRowStyle: CSSProperties = {
  display: "flex",
  border: "1px solid var(--line-2)",
  borderRadius: 10,
  overflow: "hidden",
  marginTop: "auto",
  background: "rgba(12,12,16,.6)",
};

const moreTileStyle: CSSProperties = {
  width: 80, // matches the mini-deck tiles: two per row beside the 170px lead
  aspectRatio: "4 / 5",
  border: "1px dashed var(--dim)",
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "1px",
  color: "var(--dim)",
};

const emptyPanelStyle: CSSProperties = {
  margin: "auto",
  padding: "34px 44px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
};

// The bench floats inset from the viewport so the foundry backdrop breathes
// at the margins — the other stations run centered content columns and this
// plate was spanning nearly the full viewport, hiding the world.
const plateFrameStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  width: "min(1320px, calc(100% - 112px))",
  margin: "0 auto",
};

// Bottom-right meta block: Register-1 words, mono reserved for numerals
// (spec §5). Rides the .titleblock positioning chrome from theme.css.
const metaValStyle: CSSProperties = {
  fontFamily: "var(--body)",
  fontWeight: 600,
  fontSize: 9,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--muted)",
};
const metaKeyStyle: CSSProperties = {
  ...metaValStyle,
  fontSize: 8,
  color: "var(--dim)",
};
const metaNumStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  letterSpacing: ".08em",
};

// One-line template-family readout under the slide count (library bench);
// long decks ellipsize rather than wrap the column.
const familyLineStyle: CSSProperties = {
  maxWidth: "100%",
  marginTop: -6,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: "var(--mono)",
  fontSize: 9,
  letterSpacing: "1px",
  color: "var(--dim)",
};

// v3.6 backdrop readout plate (library bench): which world/pool THIS
// direction resolved to, and the switch affordance. One bordered row per
// column — swatches left, labels middle, actions right.
const bgPlateStyle: CSSProperties = {
  alignSelf: "stretch",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  border: "1px solid var(--line-2)",
  borderRadius: 10,
  background: "rgba(12,12,16,.6)",
  minWidth: 0,
};
const bgSwatchStyle: CSSProperties = {
  width: 30,
  aspectRatio: "4 / 5",
  borderRadius: 6,
  overflow: "hidden",
  background: "#0A0B10",
  border: "1px solid var(--line-2)",
  flexShrink: 0,
};
const bgLabelStyle: CSSProperties = {
  fontFamily: "var(--body)",
  fontWeight: 600,
  fontSize: 9,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const bgSubStyle: CSSProperties = {
  ...bgLabelStyle,
  fontSize: 8,
  color: "var(--dim)",
};

/* ================= stat cell ================= */

function StatCell({ v, k, first }: { v: string; k: string; first?: boolean }) {
  return (
    <span
      style={{
        flex: 1,
        padding: "9px 4px",
        textAlign: "center",
        fontFamily: "var(--body)",
        fontWeight: 600,
        fontSize: 9,
        letterSpacing: "0.14em",
        color: "var(--muted)",
        borderLeft: first ? "none" : "1px solid var(--line)",
      }}
    >
      <b
        style={{
          display: "block",
          fontFamily: "var(--mono)",
          fontVariantNumeric: "tabular-nums",
          fontSize: 13,
          color: "var(--tx)",
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        {v}
      </b>
      {k}
    </span>
  );
}

/* ================= variant column (ai) ================= */

function VariantColumn({
  variant,
  deck,
  accentIdx,
  selected,
  theme,
  onSelect,
  onCommit,
}: {
  variant: Variant;
  deck: Slide[];
  accentIdx: number;
  selected: boolean;
  theme: ThemeKey;
  onSelect: () => void;
  onCommit: () => void;
}) {
  const accent = VARIANT_ACCENTS[accentIdx % VARIANT_ACCENTS.length];
  const label = variant.label || "Variant";
  const rest = deck.slice(1);
  const shown = rest.slice(0, MINIS_SHOWN);
  const extra = rest.length - shown.length;
  const w = deckWords(deck);
  return (
    <div
      className={"variant-col" + (selected ? " selected" : "")}
      onClick={onSelect}
      style={{ cursor: "pointer", minWidth: 0, flex: 1 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: "var(--grift)", fontWeight: 800, fontSize: 20, color: accent.color }}>
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--body)",
            fontWeight: 600,
            fontSize: 9,
            letterSpacing: "0.14em",
            padding: "3px 9px",
            borderRadius: 8,
            color: accent.color,
            border: "1px solid " + accent.border,
          }}
        >
          {deck.length} SLIDES
        </span>
      </div>
      <div className="sub" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        {variant.topic || ""}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
        {deck[0] ? (
          <div style={{ flex: "0 0 auto" }}>
            <SlidePreview slide={deck[0]} theme={theme} width={170} />
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
          {shown.map(function (sl) {
            return <SlidePreview key={sl.id} slide={sl} theme={theme} width={80} />;
          })}
          {extra > 0 ? <div style={moreTileStyle}>+{extra}</div> : null}
        </div>
      </div>
      <div style={statRowStyle}>
        <StatCell v={w.toLocaleString("en-US")} k="WORDS" first />
        <StatCell v={readLabel(w)} k="READ" />
        <StatCell v={String(deck.length)} k="SLIDES" />
      </div>
      <button
        type="button"
        className="btn btn--amber"
        style={{ justifyContent: "center" }}
        onClick={function (e) {
          e.stopPropagation();
          onCommit();
        }}
      >
        USE THIS CUT{selected ? <Kbd>⏎</Kbd> : null}
      </button>
    </div>
  );
}

/* ================= direction column (unique triptych, spec §9.6) ================= */

function DirectionColumn({
  dir,
  index,
  deck,
  theme,
  onCommit,
}: {
  dir: { key: "E" | "C" | "S"; name: string; accent: string };
  index: number;
  deck: Slide[];
  theme: ThemeKey;
  onCommit: () => void;
}) {
  const cover = deck[0];
  const strip = deck.slice(1, 4);
  const statCount = deck.reduce(function (n, sl) {
    return n + (sl.uniqueStats ? sl.uniqueStats.length : 0);
  }, 0);
  const chartCount = deck.reduce(function (n, sl) {
    return n + (sl.uniqueChart ? 1 : 0);
  }, 0);
  const meta =
    plural(deck.length, "SLIDE") + " · " + plural(statCount, "STAT") + " · " + plural(chartCount, "CHART");
  return (
    <div
      className="glass glass--tint"
      style={
        {
          "--tc": dir.accent,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "20px 20px 22px",
          minWidth: 0,
          flex: 1,
        } as CSSProperties
      }
    >
      <div
        style={{
          alignSelf: "flex-start",
          fontFamily: "var(--body)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          color: dir.accent,
        }}
      >
        0{index + 1} {"//"} {dir.name}
      </div>
      {cover ? <SlidePreview slide={cover} theme={theme} width={252} page={1} total={deck.length} /> : null}
      <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
        {strip.map(function (sl, i) {
          return <SlidePreview key={sl.id} slide={sl} theme={theme} width={78} page={i + 2} total={deck.length} />;
        })}
      </div>
      <div
        style={{
          fontFamily: "var(--body)",
          fontWeight: 600,
          fontSize: 9.5,
          letterSpacing: "0.14em",
          color: "var(--muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {meta}
      </div>
      <button
        type="button"
        className="btn btn--amber"
        style={{ justifyContent: "center", alignSelf: "stretch", marginTop: "auto" }}
        onClick={onCommit}
      >
        USE THIS DIRECTION
      </button>
    </div>
  );
}

/* ================= library column (platform bench, v2 §S) ================= */

function LibraryColumn({
  dir,
  index,
  deck,
  theme,
  topics,
  topicName,
  bgMode,
  seed,
  palette,
  onCommit,
  onSwitchBg,
  onAutoBg,
}: {
  dir: { key: string; name: string; accent: string };
  index: number;
  deck: Slide[];
  theme: ThemeKey;
  topics: TopicsData | null;
  topicName: string;
  bgMode: "rotate" | "infinity";
  seed: number;
  palette: string;
  onCommit: () => void;
  onSwitchBg: () => void;
  onAutoBg: () => void;
}) {
  const cover = deck[0];
  const strip = deck.slice(1, 4);
  const families = familyReadout(deck, templatesSync());
  // v3.6 backdrop readout: the store stamps slide.libraryBg on every bench
  // deck (withLibraryDeckChains), so THIS direction's resolved world is read
  // straight off its slides — no re-derivation, no drift from what commits.
  const libSlides = deck.filter(function (s) { return s.type === "library"; });
  const bgKeys: string[] = [];
  libSlides.forEach(function (s) {
    const k = s.libraryBg || "";
    if (k && bgKeys.indexOf(k) < 0) bgKeys.push(k);
  });
  const overridden = libSlides.some(function (s) { return !!s.libraryBgOverride; });
  const deckKey = bgKeys[0] || "";
  const isInf = bgMode === "infinity";
  // The "∞ ·" deck-wide label is EXCLUSIVE to ∞ mode: a rotate deck whose
  // COVER carries a native pick still rotates baked keys on slides 2+, so it
  // stays a POOL listing (natives render by name inside it).
  const nameOf = function (k: string) {
    return isNativeKey(k) ? "∞ " + nativeMetaOf(k).name : k;
  };
  const bgLabel = !deckKey
    ? "·"
    : isInf
      ? isNativeKey(deckKey)
        ? "∞ · " + nativeMetaOf(deckKey).name
        : "∞ · " + deckKey + " " + ((topics && topics.backdrops[deckKey] && topics.backdrops[deckKey].name) || "")
      : "POOL · " + bgKeys.slice(0, 4).map(nameOf).join(" · ") + (bgKeys.length > 4 ? " +" + (bgKeys.length - 4) : "");
  const bgStatus = (overridden ? "PICKED" : "AUTO") + " · TOPIC " + topicName.toUpperCase();
  const swatchKeys = isInf ? bgKeys.slice(0, 1) : bgKeys.slice(0, 3);
  return (
    <div
      className="glass glass--tint"
      style={
        {
          "--tc": dir.accent,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "20px 20px 22px",
          minWidth: 0,
          flex: 1,
        } as CSSProperties
      }
    >
      <div
        style={{
          alignSelf: "flex-start",
          fontFamily: "var(--body)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          color: dir.accent,
        }}
      >
        0{index + 1} {"//"} {dir.name}
      </div>
      {cover ? <SlidePreview slide={cover} theme={theme} width={252} page={1} total={deck.length} /> : null}
      <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
        {strip.map(function (sl, i) {
          return <SlidePreview key={sl.id} slide={sl} theme={theme} width={78} page={i + 2} total={deck.length} />;
        })}
      </div>
      <div
        style={{
          fontFamily: "var(--body)",
          fontWeight: 600,
          fontSize: 9.5,
          letterSpacing: "0.14em",
          color: "var(--muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {plural(deck.length, "SLIDE")}
      </div>
      <div style={familyLineStyle} title={families}>
        {families}
      </div>
      {/* v3.6 · which backdrops THIS direction resolved to (topic-driven),
          with the same finalize affordance EDIT offers — a pick here rides
          the deck through commit. */}
      <div style={bgPlateStyle} title={bgLabel + " — " + bgStatus}>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {swatchKeys.length === 0 ? (
            <div style={bgSwatchStyle} />
          ) : (
            swatchKeys.map(function (k) {
              return (
                <div key={k} style={bgSwatchStyle}>
                  {isNativeKey(k) ? (
                    <LibNativeBgPreview fam={nativeGenKeyOf(k)} seed={seed} palette={palette} />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={bgSvgUrl(k)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
          <span style={bgLabelStyle}>{bgLabel}</span>
          <span style={bgSubStyle}>{bgStatus}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            className="chip"
            style={{ cursor: "pointer", justifyContent: "center" }}
            title="Pick a different backdrop for this direction"
            onClick={onSwitchBg}
          >SWITCH</button>
          {overridden ? (
            <button
              type="button"
              className="chip"
              style={{ cursor: "pointer", justifyContent: "center" }}
              title="Clear the pick · back to the topic-assigned backdrop"
              onClick={onAutoBg}
            >AUTO</button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className="btn btn--amber"
        style={{ justifyContent: "center", alignSelf: "stretch", marginTop: "auto" }}
        onClick={onCommit}
      >
        USE THIS DIRECTION
      </button>
    </div>
  );
}

/* ================= station ================= */

export function ChooseStation() {
  const mode = useWizard((s) => s.mode);
  const variants = useWizard((s) => s.variants);
  const uniqueDecks = useWizard((s) => s.uniqueDecks);
  const libraryDecks = useWizard((s) => s.libraryDecks);
  const selectedVariantKey = useWizard((s) => s.selectedVariantKey);
  const slides = useWizard((s) => s.slides);
  const category = useWizard((s) => s.category);
  const text = useWizard((s) => s.text);
  const articleTitle = useWizard((s) => s.articleTitle);
  const go = useWizard((s) => s.go);
  // v3.6 library bench backdrop readout/switch
  const topic = useWizard((s) => s.topic);
  const bgMode = useWizard((s) => s.bgMode);
  const libSeed = useWizard((s) => s.libSeed);
  const setBenchDeckBg = useWizard((s) => s.setBenchDeckBg);
  const [bgPickFor, setBgPickFor] = useState<string | null>(null);

  const isAI = mode === "ai";
  const isUnique = mode === "unique";
  // Library bench needs decks on file; a null libraryDecks (v1 drafts landed
  // EDIT-direct and never held one) keeps CHOOSE's pre-v2 behavior untouched.
  const isLibrary = mode === "library" && !!libraryDecks;

  // Variant keys with at least one slide, in API order (AI branch; unique
  // chips carry empty slide arrays and never appear here).
  const keys = useMemo(
    function () {
      if (!variants) return [] as string[];
      return Object.keys(variants).filter(function (k) {
        const v = variants[k];
        return !!v && Array.isArray(v.slides) && v.slides.length > 0;
      });
    },
    [variants]
  );

  // Editor-shaped decks per variant, for previews + stats (conversion is
  // pure; the store converts again on pickVariant).
  const decks = useMemo(
    function () {
      const map: Record<string, Slide[]> = {};
      if (variants) {
        keys.forEach(function (k) {
          map[k] = apiSlidesToEditorSlides(variants[k].slides, variants[k].slides.length);
        });
      }
      return map;
    },
    [variants, keys]
  );

  // Local selection: previously picked variant when it still exists,
  // otherwise the middle column.
  const [selKey, setSelKey] = useState<string>("");
  const defaultKey =
    selectedVariantKey && keys.indexOf(selectedVariantKey) !== -1
      ? selectedVariantKey
      : keys[Math.floor(keys.length / 2)] || "";
  const sel = keys.indexOf(selKey) !== -1 ? selKey : defaultKey;

  // Commit reads live store state so the dirty check never goes stale.
  // Unique directions resolve against uniqueDecks, library builds against
  // libraryDecks; every path shares the same dirty-confirm before committing.
  const commit = useCallback(async function (key: string) {
    if (!key) return;
    const st = useWizard.getState();
    const ready =
      st.mode === "unique"
        ? !!(st.uniqueDecks && Array.isArray(st.uniqueDecks[key]) && st.uniqueDecks[key].length > 0)
        : st.mode === "library"
          ? !!(st.libraryDecks && Array.isArray(st.libraryDecks[key]) && st.libraryDecks[key].length > 0)
          : !!(st.variants && st.variants[key]);
    if (!ready) return;
    if (st.slides.length > 0 && st.dirtySinceVariant) {
      const ok = await confirmDialog({
        title: "Replace your edited deck?",
        body: "Picking a cut rebuilds the deck from the drafted variant. Edits made on the bench since your last pick are discarded.",
        cta: "Replace deck",
        cancel: "Keep my edits",
        variant: "danger",
      });
      if (!ok) return;
    }
    if (st.mode === "library") {
      st.commitLibraryDeck(key); // navigates to EDIT itself (mirrors pickVariant)
      return;
    }
    st.pickVariant(key); // navigates to EDIT itself
  }, []);

  // ARROW KEYS CYCLE · ENTER SELECTS (AI branch only). Guards: dialogs and
  // modals own their keys; editable targets keep theirs; a focused button
  // handles Enter via its own click.
  useEffect(
    function () {
      if (!isAI || keys.length === 0) return;
      const onKey = function (e: KeyboardEvent) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        if (document.body.hasAttribute("data-modal-open")) return;
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
          const idx = keys.indexOf(sel);
          setSelKey(keys[((idx === -1 ? 0 : idx) + dir + keys.length) % keys.length]);
        } else if (e.key === "Enter") {
          if (t && t.tagName === "BUTTON") return;
          e.preventDefault();
          void commit(sel);
        }
      };
      window.addEventListener("keydown", onKey);
      return function () {
        window.removeEventListener("keydown", onKey);
      };
    },
    [isAI, keys, sel, commit]
  );

  // Family readouts peek templatesSync(); a cold cache renders "·", so kick
  // loadTemplates once and tick a re-render when the JSON lands (same
  // local-tick pattern the library renderers use). The v3.6 backdrop readout
  // peeks topicsSync() the same way (topic names + baked backdrop names).
  const [, setTplTick] = useState(0);
  useEffect(
    function () {
      if (!isLibrary) return;
      let live = true;
      if (!templatesSync()) {
        loadTemplates()
          .then(function () {
            if (live) setTplTick(function (n) { return n + 1; });
          })
          .catch(function () {}); // readouts stay "·"; nothing else depends on it
      }
      if (!topicsSync()) {
        loadTopics()
          .then(function () {
            if (live) setTplTick(function (n) { return n + 1; });
          })
          .catch(function () {});
      }
      return function () {
        live = false;
      };
    },
    [isLibrary]
  );

  // Cover bench patch: merge onto the LIVE cover slide (state read at call
  // time so rapid field edits never clobber each other).
  const patchCover = useCallback(function (p: Partial<Slide>) {
    const st = useWizard.getState();
    const cover = st.slides[0];
    if (!cover) return;
    st.updateSlide(0, { ...cover, ...p });
  }, []);

  // V1 canContinue parity (carousel-verbatim.tsx:605): a verbatim cover never
  // ships untemplated. When the bench holds a cover with no template picked,
  // seed the grid's first entry so the LIVE COVER preview and the shipped
  // deck match; covers that already carry one (archives, drafts) keep it.
  // Unique decks no-op here: their slides are type "unique", never "cover*".
  useEffect(
    function () {
      if (isAI) return;
      const cover = useWizard.getState().slides[0];
      if (!cover || typeof cover.type !== "string" || cover.type.indexOf("cover") !== 0) return;
      if (cover.coverTemplate !== undefined) return;
      patchCover({ coverTemplate: COVER_TEMPLATES[0].id });
    },
    [isAI, slides, patchCover]
  );

  const projectCell = trunc((articleTitle || "").toUpperCase(), 26) || "·";
  const totalSlides = keys.reduce(function (n, k) {
    return n + (decks[k] ? decks[k].length : 0);
  }, 0);

  const kicker = (tail: string) => (
    <span className="kicker">
      02 · <b>CHOOSE</b> · {tail}
    </span>
  );

  const titleblock = (drafted: ReactNode) => (
    <div className="titleblock">
      <div>
        <span style={metaKeyStyle}>PROJECT</span>
        <b style={metaValStyle}>{projectCell}</b>
      </div>
      <div>
        <span style={metaKeyStyle}>SHEET</span>
        <b style={metaValStyle}>
          <span style={metaNumStyle}>02 / 04</span> · CHOOSE
        </b>
      </div>
      <div>
        <span style={metaKeyStyle}>DRAFTED</span>
        <b style={metaValStyle}>{drafted}</b>
      </div>
    </div>
  );

  /* ───── library branch: the platform bench (v2 §S) ───── */
  if (isLibrary) {
    // The API may drop an invalid plan — render the survivors, no empty
    // columns (grid columns track dirs.length, same as the triptych).
    const dirs = LIBRARY_DIRECTIONS.filter(function (d) {
      return !!(libraryDecks && Array.isArray(libraryDecks[d.key]) && libraryDecks[d.key].length > 0);
    });
    // v3.6: the run's parsed topic drives every direction's backdrop pool —
    // name it in the header so the parse is visible, and give the switch
    // modal the same (topics, topicKey, palette) EDIT resolves with.
    const topicsData = topicsSync();
    const topicKey = topic || "brand";
    const topicName = topicsData
      ? ((topicsData.topics.filter(function (t) { return t.key === topicKey; })[0] || { name: topicKey }).name)
      : topicKey;
    const benchPalette = CATEGORY_PALETTE[category];
    const pickDeck = bgPickFor && libraryDecks ? libraryDecks[bgPickFor] : null;
    const pickCurrent = (pickDeck && pickDeck[0] && pickDeck[0].libraryBg) || "02";
    return (
      <div style={plateFrameStyle}>
        <Plate
          label={kicker("PICK THE CUT")}
          titleblock={titleblock(<><span style={metaNumStyle}>{dirs.length}</span> DIRECTIONS</>)}
        >
        <div style={wrapStyle}>
          <div className="rise d1" style={headStyle}>
            <h1 className="display" style={{ fontSize: 34 }}>
              Pick the <span className="grad">cut</span>.
            </h1>
            <span className="sub">One source, three builds from the approved library. Pick one, then refine every slide in Edit.</span>
            <span className="whisper" style={{ marginLeft: "auto" }}>
              Topic {topicName} drives the backdrops · {bgMode === "infinity" ? "∞ one world per deck" : "rotating pool"}
            </span>
          </div>
          {dirs.length === 0 ? (
            <div className="glass rise d2" style={emptyPanelStyle}>
              <span className="whisper" style={{ fontWeight: 600, fontSize: 13 }}>
                No directions on file
              </span>
              <span className="whisper">Run a library generation from Create to draft three directions.</span>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(" + dirs.length + ", minmax(0, 1fr))",
                gap: 26,
                alignItems: "stretch",
                paddingTop: 12,
                paddingBottom: 6,
              }}
            >
              {dirs.map(function (d, i) {
                return (
                  <div key={d.key} className={"rise d" + Math.min(i + 2, 6)} style={{ display: "flex", minWidth: 0 }}>
                    <LibraryColumn
                      dir={d}
                      index={i}
                      deck={libraryDecks![d.key]}
                      theme={category}
                      topics={topicsData}
                      topicName={topicName}
                      bgMode={bgMode}
                      seed={libSeed}
                      palette={benchPalette}
                      onCommit={function () {
                        void commit(d.key);
                      }}
                      onSwitchBg={function () { setBgPickFor(d.key); }}
                      onAutoBg={function () { setBenchDeckBg(d.key, null); }}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="rise d5" style={{ display: "flex" }}>
            <button type="button" className="btn btn-ghost" onClick={() => go("create")}>
              Back to Create
            </button>
            {slides.length > 0 ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => go("edit")}
              >
                CONTINUE TO EDIT · KEEPS CURRENT DECK
              </button>
            ) : null}
          </div>
        </div>
        </Plate>
        {/* v3.6 · per-direction backdrop switch — EDIT's exact picker (same
            shelves, same ∞ approval filtering), stamping THAT deck via
            setBenchDeckBg. Sibling of the Plate: the fixed-position modal
            must not sit under a transformed/animated containing block. */}
        {bgPickFor && topicsData ? (
          <LibBackdropAllModal
            topics={topicsData}
            topicKey={topicKey}
            current={pickCurrent}
            showNative
            infinityPick={bgMode === "infinity"}
            seed={libSeed}
            palette={benchPalette}
            onPick={function (k) { setBenchDeckBg(bgPickFor, k); setBgPickFor(null); }}
            onClose={function () { setBgPickFor(null); }}
          />
        ) : null}
      </div>
    );
  }

  /* ───── verbatim branch: the cover bench ───── */
  if (!isAI && !isUnique) {
    const cover = slides[0];
    return (
      <div style={plateFrameStyle}>
        <Plate label={kicker("COVER BENCH")} titleblock={titleblock("COVER BENCH")}>
        <div style={wrapStyle}>
          <div className="rise d1" style={headStyle}>
            <h1 className="display" style={{ fontSize: 34 }}>
              Dress the <span className="grad">cover</span>.
            </h1>
            <span className="sub">Your text ships verbatim. Style the cover, then refine every slide in Edit.</span>
            <span className="whisper" style={{ marginLeft: "auto" }}>
              Title, topic, template, image · body text is untouched
            </span>
          </div>
          {cover ? (
            <div className="rise d2" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
              <CoverDesigner slide={cover} onChange={patchCover} theme={category} sourceText={text} />
            </div>
          ) : (
            <div className="glass rise d2" style={emptyPanelStyle}>
              <span className="whisper" style={{ fontWeight: 600, fontSize: 13 }}>
                No slides on the bench
              </span>
              <span className="whisper">Split your text into slides from Create first.</span>
            </div>
          )}
          <div className="rise d3" style={{ display: "flex", alignItems: "center" }}>
            <button type="button" className="btn btn-ghost" onClick={() => go("create")}>
              Back to Create
            </button>
            <button
              type="button"
              className="btn btn--amber"
              style={{ marginLeft: "auto" }}
              disabled={!cover}
              onClick={() => go("edit")}
            >
              Continue to Edit
            </button>
          </div>
        </div>
        </Plate>
      </div>
    );
  }

  /* ───── unique branch: the triptych (spec §9.6) ───── */
  if (isUnique) {
    const dirs = UNIQUE_DIRECTIONS.filter(function (d) {
      return !!(uniqueDecks && Array.isArray(uniqueDecks[d.key]) && uniqueDecks[d.key].length > 0);
    });
    return (
      <div style={plateFrameStyle}>
        <Plate
          label={kicker("PICK THE CUT")}
          titleblock={titleblock(<><span style={metaNumStyle}>{dirs.length}</span> DIRECTIONS</>)}
        >
        <div style={wrapStyle}>
          <div className="rise d1" style={headStyle}>
            <h1 className="display" style={{ fontSize: 34 }}>
              Pick the <span className="grad">cut</span>.
            </h1>
            <span className="sub">One source, three complete art directions. Pick one, then make simple edits.</span>
            <span className="whisper" style={{ marginLeft: "auto" }}>
              Same content · three compositions
            </span>
          </div>
          {dirs.length === 0 ? (
            <div className="glass rise d2" style={emptyPanelStyle}>
              <span className="whisper" style={{ fontWeight: 600, fontSize: 13 }}>
                No directions on file
              </span>
              <span className="whisper">Run a unique generation from Create to draft three directions.</span>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(" + dirs.length + ", minmax(0, 1fr))",
                gap: 26,
                alignItems: "stretch",
                paddingTop: 12,
                paddingBottom: 6,
              }}
            >
              {dirs.map(function (d, i) {
                return (
                  <div key={d.key} className={"rise d" + Math.min(i + 2, 6)} style={{ display: "flex", minWidth: 0 }}>
                    <DirectionColumn
                      dir={d}
                      index={i}
                      deck={uniqueDecks![d.key]}
                      theme={category}
                      onCommit={function () {
                        void commit(d.key);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="rise d5" style={{ display: "flex" }}>
            <button type="button" className="btn btn-ghost" onClick={() => go("create")}>
              Back to Create
            </button>
            {slides.length > 0 ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginLeft: "auto" }}
                onClick={() => go("edit")}
              >
                CONTINUE TO EDIT · KEEPS CURRENT DECK
              </button>
            ) : null}
          </div>
        </div>
        </Plate>
      </div>
    );
  }

  /* ───── AI branch: three drafted variant columns ───── */
  return (
    <div style={plateFrameStyle}>
      <Plate
        label={kicker("PICK THE CUT")}
        titleblock={titleblock(
          <>
            <span style={metaNumStyle}>{keys.length}</span> VARIANTS ·{" "}
            <span style={metaNumStyle}>{totalSlides}</span> SLIDES
          </>
        )}
      >
      <div style={wrapStyle}>
        <div className="rise d1" style={headStyle}>
          <h1 className="display" style={{ fontSize: 34 }}>
            Pick the <span className="grad">cut</span>.
          </h1>
          <span className="sub">Real slides over real backdrops, three cuts of the same source.</span>
          <span className="whisper" style={{ marginLeft: "auto" }}>
            Arrow keys cycle · Enter selects
          </span>
        </div>
        {keys.length === 0 ? (
          <div className="glass rise d2" style={emptyPanelStyle}>
            <span className="whisper" style={{ fontWeight: 600, fontSize: 13 }}>
              No drafted variants on file
            </span>
            <span className="whisper">The crucible is cold. Run a generation from Create to draft three cuts.</span>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: "repeat(" + keys.length + ", minmax(0, 1fr))",
              gap: 26,
              alignItems: "stretch",
              paddingTop: 12,
              paddingBottom: 6,
            }}
          >
            {keys.map(function (k, i) {
              return (
                <div key={k} className={"rise d" + Math.min(i + 2, 6)} style={{ display: "flex", minWidth: 0 }}>
                  <VariantColumn
                    variant={variants![k]}
                    deck={decks[k] || []}
                    accentIdx={i}
                    selected={k === sel}
                    theme={category}
                    onSelect={function () {
                      setSelKey(k);
                    }}
                    onCommit={function () {
                      setSelKey(k);
                      void commit(k);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="rise d5" style={{ display: "flex" }}>
          <button type="button" className="btn btn-ghost" onClick={() => go("create")}>
            Back to Create
          </button>
          {slides.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginLeft: "auto" }}
              onClick={() => go("edit")}
            >
              CONTINUE TO EDIT · KEEPS CURRENT DECK
            </button>
          ) : null}
        </div>
      </div>
      </Plate>
    </div>
  );
}

export default ChooseStation;
