"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Wizard · CoverDesigner — the cover bench.
//
// Used by CHOOSE (verbatim, full mode: fields left, live cover preview and
// 6-template plate grid right) and by the EDIT inspector Cover section
// (compact mode: single tight column, no big preview — the canvas sits
// beside it). All mutations flow up through onChange(patch); the bench
// holds no slide state of its own, only transient AI-suggestion state.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type CSSProperties, type ReactNode } from "react";
import { showToast } from "../../toast-context";
import { COVER_TEMPLATES, COVER_TOPICS, type CoverTemplateId } from "../../carousel-covers";
import { SlidePreview } from "../engine/SlidePreview";
import type { Slide, ThemeKey } from "../engine/types";
import {
  verbatimTitles,
  verbatimSubtitle,
  verbatimTopic,
  verbatimImagePrompt,
  rewriteText,
} from "../engine/api";
import ImagePicker from "./ImagePicker";

export interface CoverDesignerProps {
  slide: Slide;
  onChange: (patch: Partial<Slide>) => void;
  theme: ThemeKey;
  compact?: boolean;
  sourceText?: string;
}

// coverUpper / coverTight persist on Slide (engine/types.ts) and thread
// through SlidePreview / SlideCanvas / export-renderer. V1 defaults:
// upper true, tight false (carousel-covers resolve()).
type CoverSlide = Slide;

// Bench labels per DESIGN-SPEC, mapped in order onto the real template ids.
// carousel-covers' own names are Reference / Type Bomb / Diptych /
// Accent Rail / Magazine Bar / Edge Stripe.
const TEMPLATE_LABELS: Record<CoverTemplateId, string> = {
  "01": "ANCHOR",
  "02": "CENTER",
  "03": "STAT RING",
  "04": "PHOTO TOP",
  "05": "OCTAGON",
  "06": "RULE LEFT",
};

const ACCENTS = [
  { name: "AMBER", color: "#F7B041" },
  { name: "COBALT", color: "#0B86D1" },
  { name: "MINT", color: "#2EAD8E" },
  { name: "CORAL", color: "#E06347" },
];

// V1's bench exposed a 60..130% slider (default 100%); the seg keeps the
// same 1 = template default semantics with three drafting stops.
const TITLE_SCALES = [
  { label: "S", value: 0.8 },
  { label: "M", value: 1 },
  { label: "L", value: 1.2 },
];

// Inline layers over the theme.css contract (.input, .btn, .opt-card):
// only per-usage overrides live here, chrome comes from the classes.
const smallBtn: CSSProperties = {
  padding: "7px 14px",
  fontSize: 10,
  letterSpacing: ".14em",
};

// Register 1 (Outfit 600 caps) — the mono label voice is dead outside numerals.
const capsLabel: CSSProperties = {
  fontFamily: "var(--body)",
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: ".12em",
  color: "var(--muted)",
  textTransform: "uppercase",
};

const optionRowStyle: CSSProperties = {
  textAlign: "left",
  display: "block",
  width: "100%",
  padding: "10px 13px",
  borderRadius: 12,
  cursor: "pointer",
};

const controlRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

function Seg({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <span key={o} className={o === value ? "on" : ""} onClick={() => onPick(o)}>{o}</span>
      ))}
    </div>
  );
}

function ToggleChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="chip"
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: on ? "var(--cobalt-wash)" : "transparent",
        borderColor: on ? "var(--cobalt-line)" : undefined,
        color: on ? "var(--blue-300)" : undefined,
      }}
    >
      {label}{on ? " · ON" : ""}
    </button>
  );
}

function Section({ label, extra, children }: { label: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="ph" style={{ marginBottom: 8 }}>{label}{extra ? <b>{extra}</b> : null}</div>
      {children}
    </div>
  );
}

export function CoverDesigner({ slide, onChange, theme, compact, sourceText }: CoverDesignerProps) {
  const sl = slide as CoverSlide;
  const [titleIdeas, setTitleIdeas] = useState<{ title: string; subtitle: string }[]>([]);
  const [titlesBusy, setTitlesBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [subIdeas, setSubIdeas] = useState<string[]>([]);
  const [subsBusy, setSubsBusy] = useState(false);
  const [resizeBusy, setResizeBusy] = useState<"" | "shorten" | "lengthen">("");
  const [topicBusy, setTopicBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState("");
  const [promptFetched, setPromptFetched] = useState(false);

  const tplId: CoverTemplateId = slide.coverTemplate || "01";
  const activeTpl = COVER_TEMPLATES.find((t) => t.id === tplId);
  const scaleVal = slide.coverTitleScale && slide.coverTitleScale > 0 ? slide.coverTitleScale : 1;
  const scaleLabel = scaleVal < 0.95 ? "S" : scaleVal > 1.05 ? "L" : "M";
  const upper = sl.coverUpper !== false;
  const tight = sl.coverTight === true;
  const showSub = slide.coverShowSub !== false;
  const previewSlide: Slide = { ...slide, type: "cover", coverTemplate: tplId };

  function patch(p: Partial<CoverSlide>) {
    onChange(p as Partial<Slide>);
  }

  async function genTitles() {
    const src = (sourceText || "").trim();
    if (!src) { showToast("Add source text first. Title ideas read the paste.", "error"); return; }
    setTitlesBusy(true);
    try {
      const pairs = await verbatimTitles(src, theme);
      setTitleIdeas(pairs.slice(0, 5));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to generate titles.", "error");
    }
    setTitlesBusy(false);
  }

  // V1's fallback panel (carousel.tsx:1732) rerolls just the title through
  // the rewrite action; unlike GENERATE TITLE IDEAS it needs no source text
  // and never touches the subtitle.
  async function regenTitle() {
    const curr = (slide.title || "").trim();
    if (!curr) { showToast("Set a title first.", "error"); return; }
    setRegenBusy(true);
    try {
      const text = await rewriteText({ text: curr, direction: "regenerate-title", targetLength: "punchy" });
      onChange({ title: text });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Regenerate failed.", "error");
    }
    setRegenBusy(false);
  }

  async function genSubs() {
    if (!(slide.title || "").trim()) { showToast("Set a title first.", "error"); return; }
    setSubsBusy(true);
    try {
      const subs = await verbatimSubtitle(slide.title || "", sourceText || "", theme);
      setSubIdeas(subs.slice(0, 4));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to suggest subtitles.", "error");
    }
    setSubsBusy(false);
  }

  async function resizeSub(direction: "shorten" | "lengthen") {
    const curr = (slide.subtitle || "").trim();
    if (!curr) { showToast("Nothing to rewrite yet.", "error"); return; }
    setResizeBusy(direction);
    try {
      const text = await rewriteText({
        text: curr,
        direction,
        targetLength: direction === "shorten" ? "1-2 sentences, under 25 words" : "3 sentences, 40-50 words",
      });
      onChange({ subtitle: text });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Rewrite failed.", "error");
    }
    setResizeBusy("");
  }

  async function autoTopic() {
    setTopicBusy(true);
    try {
      const topic = await verbatimTopic(slide.title || "", sourceText || "");
      onChange({ coverTopic: topic });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to categorize.", "error");
    }
    setTopicBusy(false);
  }

  // The suggested Generate-tab prompt is fetched lazily on first open (and
  // retried on a later open if that first call failed). ImagePicker's seed
  // effect watches suggestedPrompt, so a late arrival still lands as long
  // as the user has not typed a prompt of their own.
  async function openPicker() {
    setPickerOpen(true);
    if (promptFetched) return;
    try {
      const p = await verbatimImagePrompt(slide.title || "", slide.subtitle || "", theme, sourceText || "");
      setSuggestedPrompt(p);
      setPromptFetched(true);
    } catch {
      // Picker still opens with a blank prompt; no toast needed.
    }
  }

  const templateGrid = (
    <Section label="TEMPLATE">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, min-content)", gap: 10, justifyContent: "start" }}>
        {COVER_TEMPLATES.map((t) => {
          const sel = t.id === tplId;
          return (
            <div key={t.id} onClick={() => onChange({ coverTemplate: t.id })} style={{ cursor: "pointer" }}>
              <div style={{
                borderRadius: 12,
                border: sel ? "1.5px solid var(--cobalt-line)" : "1.5px solid var(--line)",
                padding: 3,
                background: sel ? "var(--cobalt-wash)" : "rgba(12,12,16,.6)",
                boxShadow: sel ? "0 0 0 1px var(--quench)" : "none",
                transition: "border-color .16s var(--ease), box-shadow .16s var(--ease)",
              }}>
                <SlidePreview slide={{ ...previewSlide, coverTemplate: t.id }} theme={theme} width={compact ? 88 : 120} />
              </div>
              <div style={{ ...capsLabel, marginTop: 5, display: "flex", justifyContent: "space-between", color: sel ? "var(--blue-300)" : "var(--muted)" }}>
                <span>{TEMPLATE_LABELS[t.id]}</span><span className="mono">{t.id}</span>
              </div>
            </div>
          );
        })}
      </div>
      {activeTpl && activeTpl.supportsDual ? (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <ToggleChip label="DUAL" on={slide.coverDual === true} onClick={() => onChange({ coverDual: !slide.coverDual })} />
          <span className="callout">Splits the cover image into two panes</span>
        </div>
      ) : null}
    </Section>
  );

  const controls = (
    <Section label="COVER CONTROLS">
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 9 : 12 }}>
        <div style={controlRow}>
          <span style={capsLabel}>ACCENT</span>
          <div style={{ display: "flex", gap: 8 }}>
            {ACCENTS.map((a) => {
              const on = (slide.coverAccent || "#F7B041").toUpperCase() === a.color;
              return (
                <button
                  key={a.name}
                  type="button"
                  title={a.name}
                  onClick={() => onChange({ coverAccent: a.color })}
                  style={{
                    width: 18, height: 18, borderRadius: "50%", background: a.color, padding: 0,
                    cursor: "pointer",
                    border: on ? "2px solid var(--tx)" : "2px solid transparent",
                    boxShadow: on ? "0 0 0 1px " + a.color : "none",
                    transition: "border-color .16s var(--ease), box-shadow .16s var(--ease)",
                  }}
                />
              );
            })}
          </div>
        </div>
        <div style={controlRow}>
          <span style={capsLabel}>LOGO CORNER</span>
          <Seg
            options={["LEFT", "RIGHT"]}
            value={(slide.coverLogoPos || "right").toUpperCase()}
            onPick={(v) => onChange({ coverLogoPos: v === "LEFT" ? "left" : "right" })}
          />
        </div>
        <div style={controlRow}>
          <span style={capsLabel}>TITLE SCALE</span>
          <Seg
            options={TITLE_SCALES.map((s) => s.label)}
            value={scaleLabel}
            onPick={(v) => {
              const s = TITLE_SCALES.find((x) => x.label === v);
              onChange({ coverTitleScale: s ? s.value : 1 });
            }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ToggleChip label="UPPERCASE" on={upper} onClick={() => patch({ coverUpper: !upper })} />
          <ToggleChip label="TIGHT" on={tight} onClick={() => patch({ coverTight: !tight })} />
          <ToggleChip label="SHOW SUBTITLE" on={showSub} onClick={() => onChange({ coverShowSub: !showSub })} />
        </div>
      </div>
    </Section>
  );

  const fields = (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 14 : 20, minWidth: 0 }}>
      <Section label="TITLE">
        <input
          className="input"
          value={slide.title || ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Cover title"
          style={{ fontWeight: 700, textTransform: upper ? "uppercase" : "none" }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={genTitles}
            disabled={titlesBusy}
            style={{ ...smallBtn, opacity: titlesBusy ? 0.6 : 1 }}
          >
            {titlesBusy ? "DRAFTING PAIRS..." : "GENERATE TITLE IDEAS"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={regenTitle}
            disabled={regenBusy}
            style={{ ...smallBtn, opacity: regenBusy ? 0.6 : 1 }}
          >
            {regenBusy ? "REWRITING..." : "REGENERATE"}
          </button>
        </div>
        {titleIdeas.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <span className="callout">Click a pair to use title + subtitle</span>
            {titleIdeas.map((p, i) => (
              <button key={i} type="button" className="opt-card" style={optionRowStyle} onClick={() => onChange({ title: p.title, subtitle: p.subtitle })}>
                <span style={{ fontFamily: "var(--grift)", fontWeight: 700, fontSize: 13, color: "var(--tx)", display: "block" }}>{p.title}</span>
                {p.subtitle ? <span style={{ fontFamily: "var(--body)", fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>{p.subtitle}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </Section>

      <Section label="SUBTITLE" extra={slide.subtitle ? (slide.subtitle.length + " CHARS") : undefined}>
        <textarea
          className="input"
          value={slide.subtitle || ""}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Supporting line under the title"
          rows={compact ? 2 : 3}
          style={{ fontSize: 13, lineHeight: 1.45, resize: "vertical", minHeight: compact ? 58 : 76 }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={genSubs} disabled={subsBusy} style={{ ...smallBtn, opacity: subsBusy ? 0.6 : 1 }}>
            {subsBusy ? "SUGGESTING..." : "SUGGEST ALTERNATIVES"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => resizeSub("shorten")} disabled={resizeBusy !== ""} style={{ ...smallBtn, opacity: resizeBusy === "shorten" ? 0.6 : 1 }}>
            {resizeBusy === "shorten" ? "REWRITING..." : "SHORTEN"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => resizeSub("lengthen")} disabled={resizeBusy !== ""} style={{ ...smallBtn, opacity: resizeBusy === "lengthen" ? 0.6 : 1 }}>
            {resizeBusy === "lengthen" ? "REWRITING..." : "EXPAND"}
          </button>
        </div>
        {subIdeas.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <span className="callout">Click to swap the subtitle</span>
            {subIdeas.map((s, i) => (
              <button key={i} type="button" className="opt-card" style={optionRowStyle} onClick={() => onChange({ subtitle: s })}>
                <span style={{ fontFamily: "var(--body)", fontSize: 12, color: "var(--tx)", display: "block", lineHeight: 1.4 }}>{s}</span>
              </button>
            ))}
          </div>
        ) : null}
      </Section>

      <Section label="TOPIC">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            value={slide.coverTopic || ""}
            onChange={(e) => onChange({ coverTopic: e.target.value })}
            placeholder="Accent category label"
            list="sa-cover-topics"
            style={{ flex: 1, width: "auto", fontSize: 13 }}
          />
          <button
            type="button"
            className="chip"
            onClick={autoTopic}
            style={{ cursor: "pointer", background: "transparent", flexShrink: 0, opacity: topicBusy ? 0.6 : 1 }}
            disabled={topicBusy}
          >
            {topicBusy ? "READING..." : "AUTO"}
          </button>
        </div>
        <datalist id="sa-cover-topics">
          {COVER_TOPICS.map((t) => <option key={t} value={t} />)}
        </datalist>
      </Section>

      <Section label="COVER IMAGE">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {slide.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.imageUrl} alt="Cover" style={{ width: 56, height: 70, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line-2)", flexShrink: 0 }} />
          ) : (
            <div style={{ ...capsLabel, width: 56, height: 70, borderRadius: 10, border: "1px dashed var(--dim)", color: "var(--dim)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              NONE
            </div>
          )}
          <button type="button" className="btn btn-ghost" onClick={openPicker} style={smallBtn}>CHOOSE</button>
          {slide.imageUrl ? (
            <button type="button" className="btn btn-ghost" onClick={() => onChange({ imageUrl: "" })} style={smallBtn}>REMOVE</button>
          ) : null}
        </div>
      </Section>
    </div>
  );

  // Rise stagger only in the full CHOOSE bench; the compact inspector column
  // remounts on every slide switch and should not replay an entrance.
  return (
    <div style={compact ? undefined : { display: "flex", gap: 26, alignItems: "flex-start" }}>
      <div className={compact ? undefined : "rise d1"} style={compact ? { display: "flex", flexDirection: "column", gap: 14 } : { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
        {fields}
        {compact ? templateGrid : null}
        {controls}
      </div>
      {!compact ? (
        // Sticky within ChooseStation's overflowY:auto bench wrapper (no top
        // padding there, so top:0) — keeps the LIVE COVER preview in view
        // while the field stack scrolls. Row already aligns flex-start.
        <div className="rise d2" style={{ flex: "0 0 384px", display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 0 }}>
          <Section label="LIVE COVER">
            <div style={{ display: "flex", justifyContent: "center", padding: 16, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "inset 0 1px 0 var(--bevel-lo), inset 0 -1px 0 var(--bevel-hi)" }}>
              <SlidePreview slide={previewSlide} theme={theme} width={300} />
            </div>
          </Section>
          {templateGrid}
        </div>
      ) : null}
      {pickerOpen ? (
        <ImagePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(url: string) => { onChange({ imageUrl: url }); setPickerOpen(false); }}
          suggestedPrompt={suggestedPrompt}
          theme={theme}
        />
      ) : null}
    </div>
  );
}

export default CoverDesigner;


