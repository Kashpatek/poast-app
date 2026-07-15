"use client";
// ═══════════════════════════════════════════════════════════════════════════
// GeneratingOverlay — full-bleed overlay for the CREATE → CHOOSE transit.
//
// THE FOUNDRY reskin (docs/THEME-FOUNDRY.md §8 GENERATING). The overlay rides
// the intensified foundry (theme.css :has(.overlay) melt/ember boost), centers
// a vertical pour-stage checklist (Register-1 labels, mono numerals; mint done
// ticks, molten current shimmer + heat hairline), and keeps every store
// contract: staged readout drives off store.genStage,
// slide skeletons flip to real SlidePreview minis when variants land, ESC and
// "Cancel run" abort via store.abortGenerate (inputs kept), inline error
// (store.genError) offers Retry / Back, never a toast. Unique mode swaps the
// stage labels for designing copy, library mode for platform copy — same 4
// stages either way.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useWizard } from "../store";
import { THEMES, apiSlidesToEditorSlides, type Slide } from "../engine/types";
import { SlidePreview } from "../engine/SlidePreview";
import { Kbd } from "../components/Chrome";

// ═══ helpers ═══
function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

function wordCount(text: string): number {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Context line lead (Register 1): title if captured, else first words / url host. */
function sourceLabel(articleTitle: string, text: string, url: string): string {
  const at = (articleTitle || "").trim();
  if (at) return at.slice(0, 40).toUpperCase();
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
      /* fall through */
    }
  }
  return "SOURCE";
}

// Indeterminate sweep for the active stage + molten shimmer on its label
// (reuses theme.css wz-shimmer keyframes; reduced motion pins solid amber).
const GEN_CSS =
  "@keyframes wz-gen-indet{0%{transform:translateX(-100%)}100%{transform:translateX(290%)}}" +
  ".wz-gen-now{background:linear-gradient(100deg,var(--melt-3),var(--melt-1) 55%,var(--melt-3));" +
  "background-size:200% 100%;-webkit-background-clip:text;background-clip:text;" +
  "color:transparent;-webkit-text-fill-color:transparent;" +
  "animation:wz-shimmer 3.5s linear infinite}" +
  "@media (prefers-reduced-motion:reduce){.wz-gen-now{animation:none;" +
  "color:var(--amber);-webkit-text-fill-color:var(--amber)}}";

// ═══ small style objects ═══
const wrapStyle: CSSProperties = {
  position: "relative", zIndex: 1, width: "min(1170px, 92vw)",
  display: "flex", flexDirection: "column", gap: 32, alignItems: "center",
  maxHeight: "100%", overflowY: "auto",
};
const ctxLineStyle: CSSProperties = {
  marginTop: 12, fontFamily: "var(--body)", fontWeight: 600, fontSize: 11,
  letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)",
};
const checklistStyle: CSSProperties = {
  width: "min(560px, 100%)", display: "flex", flexDirection: "column", gap: 4,
  fontFamily: "var(--body)", fontVariantNumeric: "tabular-nums",
};
const stageRowStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "20px 26px 1fr auto",
  alignItems: "baseline", gap: 12, padding: "9px 14px", borderRadius: 10,
  fontSize: 11.5, letterSpacing: ".14em", textTransform: "uppercase",
  transition: "color .2s var(--ease), border-color .2s var(--ease)",
};
const stageNoteStyle: CSSProperties = { fontSize: 9, letterSpacing: ".1em", opacity: 0.8 };
const indetBarStyle: CSSProperties = {
  position: "absolute", top: 0, bottom: 0, left: 0, width: "38%",
  background: "var(--heat)", borderRadius: 2,
  animation: "wz-gen-indet 1.3s ease-in-out infinite",
};
// empty mold awaiting the pour: iron plate, residual heat pooling at the base
const skelStyle: CSSProperties = {
  width: 148, border: "1px dashed rgba(232,217,184,.4)", boxShadow: "none",
  background:
    "linear-gradient(160deg,var(--bevel-hi),transparent 38%)," +
    "linear-gradient(180deg,transparent 62%,rgba(247,176,65,.07)),var(--surface)",
  display: "grid", placeItems: "center",
};
const skelLabelStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".16em", color: "var(--muted)",
};
const elapsedStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 11,
  letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)",
};
const tickerStyle: CSSProperties = {
  width: "100%", borderTop: "1px solid var(--line)", paddingTop: 14,
  display: "flex", gap: 28, justifyContent: "center", flexWrap: "wrap",
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 9.5,
  letterSpacing: ".12em", textTransform: "uppercase", color: "var(--dim)",
};
const errorCardStyle: CSSProperties = {
  width: "min(640px, 100%)", display: "flex", flexDirection: "column", gap: 16,
  padding: "22px 26px", borderRadius: "var(--r-panel)",
  background:
    "linear-gradient(160deg,var(--bevel-hi),transparent 38%)," +
    "linear-gradient(rgba(224,99,71,.07),rgba(224,99,71,.07)),var(--card)",
  border: "1px solid rgba(224,99,71,.45)",
  boxShadow:
    "inset 0 1px 0 var(--bevel-hi), inset 0 -1px 0 rgba(0,0,0,.35), var(--shadow-panel)",
};

// ═══ component ═══
export function GeneratingOverlay() {
  const generating = useWizard((s) => s.generating);
  const genStage = useWizard((s) => s.genStage);
  const genError = useWizard((s) => s.genError);
  const variants = useWizard((s) => s.variants);
  const mode = useWizard((s) => s.mode);
  const category = useWizard((s) => s.category);
  const countMode = useWizard((s) => s.countMode);
  const pageCount = useWizard((s) => s.pageCount);
  const text = useWizard((s) => s.text);
  const url = useWizard((s) => s.url);
  const articleTitle = useWizard((s) => s.articleTitle);
  const abortGenerate = useWizard((s) => s.abortGenerate);
  const dismissError = useWizard((s) => s.dismissError);
  const generate = useWizard((s) => s.generate);

  const [elapsed, setElapsed] = useState(0);

  // Tick the elapsed counter while the run is live (paused during error).
  useEffect(() => {
    if (!generating || genError) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [generating, genError]);

  // Reset the counter at the start of every run (fresh mount or Retry, which
  // clears genError and rewinds genStage to 0).
  useEffect(() => {
    if (generating && !genError && genStage === 0) setElapsed(0);
  }, [generating, genError, genStage]);

  // ESC aborts the run. The overlay marks <body data-modal-open> while open
  // so the shell's ESC-home shortcut stands down (belt and braces: the chrome
  // already skips station "generating").
  useEffect(() => {
    if (!generating) return;
    document.body.dataset.modalOpen = "1";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      useWizard.getState().abortGenerate();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      delete document.body.dataset.modalOpen;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [generating]);

  // Variants landed for THIS run: success sets genStage 3 with the payload.
  // (Stale variants from an earlier run can persist through a retry, so the
  // stage gate matters.) First non-empty variant, converted to editor slides.
  const landedSlides = useMemo<Slide[] | null>(() => {
    if (!variants || genStage < 3 || genError) return null;
    const keys = Object.keys(variants);
    for (let i = 0; i < keys.length; i++) {
      const v = variants[keys[i]];
      if (v && Array.isArray(v.slides) && v.slides.length > 0) {
        return apiSlidesToEditorSlides(v.slides, v.slides.length);
      }
    }
    return null;
  }, [variants, genStage, genError]);
  if (!generating) return null;

  const words = wordCount(text);
  const themeLabel = THEMES[category].label.toUpperCase();
  const countLabel = countMode === "manual" ? String(pageCount) : "AUTO";
  const placeholderCount = countMode === "manual" ? Math.max(1, Math.min(8, pageCount)) : 5;
  const isUnique = mode === "unique";
  const isLibrary = mode === "library";

  const srcNote = words > 0 ? fmtInt(words) + " WORDS" : "READING SOURCE URL";
  const stages: { name: string; note: string }[] = isUnique
    ? [
        { name: "Extract signals", note: srcNote },
        { name: "Draft directions", note: "ECLIPSE · CIRCUIT · SIGNAL" },
        { name: "Compose art", note: "BACKDROPS · STATS · CHARTS" },
        { name: "Render previews", note: "3 COMPLETE DECKS" },
      ]
    : isLibrary
      ? [
          { name: "Parse source", note: srcNote },
          { name: "Match templates", note: "90 APPROVED LAYOUTS" },
          { name: "Draft directions", note: "DATA-LED · NARRATIVE · VISUAL" },
          { name: "Compose previews", note: "TOPIC BACKDROPS · " + themeLabel + " TINT" },
        ]
      : [
          { name: "Parse source", note: srcNote },
          { name: "Structure narrative", note: "HOOK → CONSTRAINT → PROOF → CTA" },
          { name: "Draft variants", note: "3 VARIANTS IN FLIGHT" },
          { name: "Compose previews", note: "RENDER OVER " + themeLabel + " BACKDROPS" },
        ];
  const activeStage = Math.max(0, Math.min(3, genStage));

  return (
    <div className="overlay">
      <style>{GEN_CSS}</style>

      <div style={wrapStyle}>
        <div className="rise d1" style={{ textAlign: "center" }}>
          <div className="kicker" style={{ marginBottom: 14 }}>
            <b>THE FURNACE IS LIT</b> · IN TRANSIT · CREATE → CHOOSE
          </div>
          <h1 className="display">
            {isUnique ? (
              <>Designing three <span className="grad">directions</span> from your source.</>
            ) : isLibrary ? (
              <>Drafting three <span className="grad">directions</span> from the library.</>
            ) : (
              <>Drafting three <span className="grad">variants</span> from your source.</>
            )}
          </h1>
          <div style={ctxLineStyle}>
            {sourceLabel(articleTitle, text, url)} · {fmtInt(words)} WORDS · THEME {themeLabel} · COUNT {countLabel}
          </div>
        </div>

        {/* staged readout: vertical pour-stage checklist */}
        <div className="rise d2" style={checklistStyle}>
          {stages.map((st, i) => {
            const done = genStage > i;
            const active = genStage === i && !genError;
            const tone = done ? "var(--mint)" : active ? "var(--amber)" : "var(--dim)";
            return (
              <div key={st.name}>
                <div
                  style={{
                    ...stageRowStyle,
                    color: tone,
                    background: active ? "var(--amber-wash)" : "transparent",
                    border: "1px solid " + (active ? "var(--amber-line)" : "transparent"),
                  }}
                >
                  <span style={{ fontSize: 12 }}>{done ? "✓" : active ? "●" : "○"}</span>
                  <span style={{ fontFamily: "var(--mono)", opacity: 0.7, fontSize: 10 }}>{"0" + (i + 1)}</span>
                  <span
                    className={active ? "wz-gen-now" : undefined}
                    style={{ fontWeight: 600, letterSpacing: ".16em" }}
                  >
                    {st.name}
                  </span>
                  <span style={stageNoteStyle}>{done ? "COMPLETE" : st.note}</span>
                </div>
                {active && (
                  <div className="progress" style={{ margin: "4px 14px 6px", height: 2 }}>
                    <span style={indetBarStyle} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {genError ? (
          /* inline error state: coral forged plate, retry or back, never a toast */
          <div className="rise d3" style={errorCardStyle}>
            <div className="kicker" style={{ color: "var(--coral)" }}>
              RUN FAILED
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: "var(--tx)" }}>{genError}</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn btn--amber" onClick={() => void generate()}>
                Retry run
              </button>
              <button type="button" className="btn btn-ghost" onClick={dismissError}>
                Back to create
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* slide preview row: dashed placeholders flip to real minis of the
                first variant with a 120ms left-to-right stagger once it lands */}
            <div
              className="rise d3"
              style={{ display: "flex", gap: 18, width: "100%", justifyContent: "center", flexWrap: "wrap" }}
            >
              {landedSlides
                ? landedSlides.map((sl, i) => (
                    <div key={sl.id} className="fade-in" style={{ animationDelay: i * 120 + "ms" }}>
                      <SlidePreview slide={sl} theme={category} width={148} />
                    </div>
                  ))
                : Array.from({ length: placeholderCount }, (_, i) => (
                    <div key={i} className="sl" style={skelStyle}>
                      <span style={skelLabelStyle}>SLIDE {String(i + 1).padStart(2, "0")}</span>
                    </div>
                  ))}
            </div>

            <div className="rise d4" style={{ display: "flex", alignItems: "center", gap: 26 }}>
              <span style={elapsedStyle}>
                ELAPSED{" "}
                <b className="mono" style={{ color: "var(--amber)", fontWeight: 700, fontSize: 15 }}>{mmss(elapsed)}</b>
                {" "}/ EST <span className="mono">00:45</span>
              </span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <button type="button" className="btn btn-ghost" onClick={abortGenerate}>
                  Cancel run <Kbd>ESC</Kbd>
                </button>
                <span className="whisper" style={{ fontSize: 11 }}>KEEPS YOUR SOURCE</span>
              </div>
            </div>
          </>
        )}

        {/* footer ticker */}
        <div className="rise d5" style={tickerStyle}>
          <span style={{ color: "var(--blue-300)" }}>
            {genError
              ? "RUN HALTED · SOURCE KEPT"
              : "STAGE " + (activeStage + 1) + " / 4 · " + stages[activeStage].name.toUpperCase()}
          </span>
          <span>
            {isUnique
              ? "UNIQUE MODE · THE APP DESIGNS THE WHOLE DECK"
              : isLibrary
                ? "NEU MODE · 90 APPROVED LAYOUTS BEHIND EVERY CUT"
                : "VERBATIM MODE WOULD SKIP THIS STATION"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GeneratingOverlay;
