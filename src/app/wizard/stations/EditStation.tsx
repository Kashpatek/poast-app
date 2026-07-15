"use client";
// ═══════════════════════════════════════════════════════════════════════════
// EDIT station — 03 · EDIT · REFINE THE DECK (docs/THEME-FOUNDRY.md §8).
// Forged-iron workspace in three panes — restraint: the backdrop carries the
// vibe. Left film strip as a plate rail (drag-reorder + nudge + add/delete,
// active slide amber ring), center SlideCanvas in an iron well (zoom cluster,
// overflow push chip), right EditInspector rail — library slides swap in the
// LIBRARY rail below (docs/LIBRARY-INTEGRATION.md §G). Keyboard: arrows (all four)
// switch slides, Cmd+Z undoes, Cmd+D duplicates
// ONLY when focus is not in a text target (V1 focus-guard fix); Enter
// continues to publish.
// (v1 Plate/TitleBlock chrome retired per spec §7.)
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useWizard } from "../store";
import { DISPLAY_W, DISPLAY_H, type Slide } from "../engine/types";
import { SlideCanvas } from "../engine/SlideCanvas";
import { SlidePreview } from "../engine/SlidePreview";
import ImagePicker from "../components/ImagePicker";
import { EditInspector } from "./EditInspector";
import {
  templatesSync, loadTemplates, topicsSync, loadTopics, tplSvgUrl, bgSvgUrl,
  type LibField, type LibTemplate, type TopicsData,
} from "../engine/library/data";
import { candidates, INFINITY_BAKED_KEEP } from "../engine/library/backdrop";
import {
  INFINITY_STYLE_CUT, NATIVE_FAMILIES, NATIVE_PREFIX, STYLE_DEFS,
  isNativeKey, nativeGenKeyOf, nativeMetaOf, renderNativeBgInner,
} from "../engine/library/nativebg";
import { CATEGORY_PALETTE } from "../engine/library/palette";
import { generateChartSpec, renderChartSvg, chartSvgToDataUrl } from "../engine/library/chart";
import { showToast } from "../../toast-context";
import { confirmDialog } from "../../dialog-context";
import { useBodyOverflow, pushOverflowToNext, splitBodyAtOffset, canOverflow, pad2 } from "./edit-overflow";
import { estimateOverflowPx } from "./publish-export";

const ZOOM_STOPS = [0.75, 1, 1.5];

/** True when the focused element edits text — arrow-nav and Cmd+Z stand
 *  down so the caret and the field's native undo keep working (V1 fix). */
function isTextTarget(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return !!(el.closest && el.closest("[contenteditable]"));
}

// ── static style objects (forged plate classes live in theme.css) ──
// Register-1 rail label (spec §5: mono survives only as tabular numerals)
const stripLabel: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 8.5,
  letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)",
};
// cobalt = selection: the quench line marks the drop slot, crisp, no glow
const droplineStyle: CSSProperties = {
  height: 2, background: "var(--cobalt)", borderRadius: 2, margin: "0 0 8px 0",
};
const nudgeBtnStyle: CSSProperties = {
  width: 18, height: 16, display: "grid", placeItems: "center",
  background: "rgba(12,12,16,.6)", border: "1px solid var(--line-2)", borderRadius: 4,
  color: "var(--muted)", fontSize: 7, cursor: "pointer", padding: 0,
};
const delBtnStyle: CSSProperties = {
  position: "absolute", top: 4, right: 4, zIndex: 3, width: 18, height: 18,
  borderRadius: "50%", border: "none", background: "rgba(10,10,12,.78)",
  color: "var(--coral)", fontSize: 12, lineHeight: 1, cursor: "pointer",
  display: "grid", placeItems: "center", padding: 0,
};
const plusTileStyle: CSSProperties = {
  width: 92, height: 44, border: "1px dashed var(--line-2)", borderRadius: 8,
  display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 18,
  cursor: "pointer", flexShrink: 0, background: "rgba(228,235,248,.03)",
};
const zoomReadout: CSSProperties = {
  cursor: "default", color: "var(--tx)", minWidth: 54, textAlign: "center",
};
const pushChipStyle: CSSProperties = {
  cursor: "pointer", background: "var(--amber-wash)",
  borderColor: "var(--amber-line)", color: "var(--amber)",
};
// the iron well: recessed bg-2 ground, crisp inset bevel, NO glow (spec §8)
const wellStyle: CSSProperties = {
  flex: 1, minHeight: 0, overflow: "auto", display: "flex",
  background: "var(--bg-2)", border: "1px solid var(--line)",
  borderRadius: "var(--r-panel)",
  boxShadow: "inset 0 2px 6px var(--bevel-lo), inset 0 -1px 0 var(--bevel-hi)",
};

// ═══════════════════════════════════════════════════════════════════════════
// LIBRARY INSPECTOR (docs/LIBRARY-INTEGRATION.md §G) — the right rail when the
// active slide is type "library". Replaces EditInspector wholesale for these
// slides: the standard SLIDE TYPE / TYPOGRAPHY / IMAGES controls steer fields
// library slides do not render (composeLibrarySvg owns the canvas), so the
// rail shows FIELDS (template text fills), TEMPLATE (same-family swap) and
// BACKDROP (finalize one of 3 candidates, or any of the 36) instead.
// Plate/label styles mirror EditInspector's — duplicated here because Sec &
// friends are module-private there and that file is owned by another lane.
// ═══════════════════════════════════════════════════════════════════════════

const libRailStyle: CSSProperties = {
  width: 332, flex: "0 0 332px", minHeight: 0, overflowY: "auto",
  padding: "12px 12px 14px", alignSelf: "stretch",
};
// stacked plate card per section (EditInspector secCardStyle twin)
const libSecCardStyle: CSSProperties = {
  background: "linear-gradient(160deg,var(--bevel-hi),transparent 45%), rgba(25,21,20,.6)",
  border: "1px solid var(--line)", borderRadius: 14, padding: "0 13px 3px",
  margin: 0, flexShrink: 0,
};
const libSmallBtnStyle: CSSProperties = {
  padding: "6px 12px", fontSize: 9.5, borderRadius: 8,
};
const libHistRowStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "1px", color: "var(--muted)",
};
const libSwatchLabelStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 8, letterSpacing: ".12em",
  color: "var(--muted)", textAlign: "center", textTransform: "uppercase",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
// ASSIGNED/FINAL corner tag — .swatch.selected::after's visual, custom text
const libCornerTagStyle: CSSProperties = {
  position: "absolute", top: 6, right: 6, background: "var(--amber)", color: "#0A0A0C",
  fontFamily: "var(--body)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em",
  padding: "2px 7px", borderRadius: 3, pointerEvents: "none",
};
// template rail thumb: templates are light foreground SVGs — give them the
// slide-placeholder ground (#0A0B10) so the glyphs read on the plate rail
const libTplThumbStyle: CSSProperties = {
  width: 64, height: 80, objectFit: "cover", display: "block",
  background: "#0A0B10", borderRadius: 8,
};

/** Collapsible plate section (EditInspector Sec twin — classes from theme.css). */
function LibSec({ id, label, extra, open, onToggle, children }: {
  id: string; label: string; extra?: string; open: boolean;
  onToggle: (id: string) => void; children: ReactNode;
}) {
  return (
    <div className="insp-sec" style={libSecCardStyle}>
      <button type="button" className="insp-head" onClick={function () { onToggle(id); }}>
        <span>{label}</span>
        <span style={{ color: "var(--dim)", letterSpacing: 0 }}>{open ? "▾" : "▸"}</span>
        {extra ? <b style={{ color: "var(--amber)", fontWeight: 500 }}>{extra}</b> : null}
      </button>
      {open ? <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>{children}</div> : null}
    </div>
  );
}

/** Text-fit panel stepper row (SIZE / WIDTH / LINES): mono label, − value +.
 *  null display = AUTO (no override). */
function LibFitRow({ label, display, onDec, onInc, onClear }: {
  label: string; display: string; onDec: () => void; onInc: () => void; onClear?: () => void;
}) {
  const stepBtn: CSSProperties = {
    width: 24, height: 22, borderRadius: 6, border: "1px solid var(--line-2)",
    background: "transparent", color: "var(--tx)", cursor: "pointer",
    fontFamily: "var(--mono)", fontSize: 11, lineHeight: "20px", padding: 0,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="mono" style={{ fontSize: 8.5, letterSpacing: ".1em", color: "var(--muted)", width: 44 }}>{label}</span>
      <button type="button" style={stepBtn} onClick={onDec}>{"−"}</button>
      <span
        className="mono"
        style={{ fontSize: 10, letterSpacing: ".04em", color: display === "AUTO" ? "var(--dim)" : "var(--amber)", minWidth: 44, textAlign: "center", cursor: onClear ? "pointer" : undefined }}
        title={onClear ? "Click to reset to AUTO" : undefined}
        onClick={onClear}
      >{display}</span>
      <button type="button" style={stepBtn} onClick={onInc}>+</button>
    </div>
  );
}

/** One template field editor: mono uppercase name, live LEN/MAXLEN counter
 *  (coral when over — typing stays allowed, the composer truncates), local
 *  draft committed on blur/Enter like the chart POINTS inputs. Long fields
 *  (body-role maxLens run 120-552) get a textarea; Enter still commits —
 *  composed SVG re-wraps text itself so literal newlines buy nothing.
 *  FIT chip (v3 §T) opens the text-fit panel: pin the font size, widen the
 *  wrap box, raise the line budget, or nudge the text X/Y in template-space
 *  px — per field, per slide, undoable. */
function LibFieldInput({ slideId, field, value, layout, focusKey, onCommit, onLayout }: {
  slideId: string; field: LibField; value: string;
  layout: { size?: number; wMul?: number; lines?: number; dx?: number; dy?: number } | undefined;
  focusKey: number; // bumps when the canvas selects this field — focus + open panel
  onCommit: (v: string) => void;
  onLayout: (l: { size?: number; wMul?: number; lines?: number; dx?: number; dy?: number } | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [fitOpen, setFitOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Re-seed when the committed value changes underneath (undo, slide switch,
  // template swap) — same reset idiom as EditInspector's SpecRow.
  useEffect(function () { setDraft(value); }, [slideId, value]);
  useEffect(function () {
    if (focusKey > 0 && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      setFitOpen(true);
    }
  }, [focusKey]);
  const over = field.maxLen != null && draft.length > field.maxLen;
  const long = (field.maxLen || 0) > 90;
  const hasLayout = !!(layout && (layout.size || layout.wMul || layout.lines || layout.dx || layout.dy));
  function commit() { onCommit(draft); }
  function blurOnEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
  }
  // Stepper merges: dropping every key back to undefined clears the override.
  // dx/dy at 0 mean "no nudge" — delete the axis key so 0 never persists.
  function mergeLayout(p: { size?: number; wMul?: number; lines?: number; dx?: number; dy?: number }) {
    const next = { ...(layout || {}), ...p };
    if (!next.dx) delete next.dx;
    if (!next.dy) delete next.dy;
    if (!next.size && !next.wMul && !next.lines && !next.dx && !next.dy) onLayout(null);
    else onLayout(next);
  }
  const sizeNow = layout && layout.size ? layout.size : 0;
  const wNow = layout && layout.wMul ? layout.wMul : 0;
  const linesNow = layout && layout.lines ? layout.lines : 0;
  const dxNow = layout && layout.dx ? layout.dx : 0;
  const dyNow = layout && layout.dy ? layout.dy : 0;
  // Signed px readout ("−12" / "+6") — U+2212 minus, matching the − button.
  function nudgeDisp(v: number) { return v > 0 ? "+" + v : "−" + Math.abs(v); }
  return (
    <div className="field">
      <label style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span className="mono" style={{ letterSpacing: ".1em" }}>{field.name.toUpperCase()}</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <button
            type="button"
            className="chip"
            style={{
              cursor: "pointer", fontSize: 7.5, padding: "1px 7px",
              background: hasLayout ? "var(--amber-wash, rgba(247,176,65,.12))" : "transparent",
              borderColor: hasLayout ? "var(--amber)" : undefined,
              color: hasLayout ? "var(--amber)" : "var(--dim)",
            }}
            title="Text fit: pin size, widen the box, raise the line budget, nudge X/Y"
            onClick={function () { setFitOpen(!fitOpen); }}
          >FIT{hasLayout ? " ·ON" : ""}</button>
          <span className="mono" style={{ fontSize: 8.5, letterSpacing: ".06em", color: over ? "var(--coral)" : "var(--dim)" }}>
            {draft.length}{field.maxLen != null ? " / " + field.maxLen : ""}
          </span>
        </span>
      </label>
      {long ? (
        <textarea
          ref={function (el) { inputRef.current = el; }}
          className="input"
          rows={3}
          data-libfield={field.name}
          style={{ minHeight: 64, fontSize: 12, lineHeight: 1.5 }}
          value={draft}
          placeholder={field.role.toUpperCase()}
          onChange={function (e) { setDraft(e.target.value); }}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
      ) : (
        <input
          ref={function (el) { inputRef.current = el; }}
          className="input mono"
          data-libfield={field.name}
          style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "8px 10px", borderRadius: 8 }}
          value={draft}
          placeholder={field.role.toUpperCase()}
          onChange={function (e) { setDraft(e.target.value); }}
          onBlur={commit}
          onKeyDown={blurOnEnter}
        />
      )}
      {fitOpen ? (
        <div style={{
          display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px",
          border: "1px solid var(--line-2)", borderRadius: 8, background: "rgba(10,11,16,.5)",
        }}>
          <LibFitRow
            label="SIZE"
            display={sizeNow ? sizeNow + "PX" : "AUTO"}
            onDec={function () { mergeLayout({ size: Math.max(12, (sizeNow || 36) - 2) }); }}
            onInc={function () { mergeLayout({ size: Math.min(220, (sizeNow || 34) + 2) }); }}
            onClear={function () { mergeLayout({ size: undefined }); }}
          />
          <LibFitRow
            label="WIDTH"
            display={wNow ? Math.round(wNow * 100) + "%" : "AUTO"}
            onDec={function () { mergeLayout({ wMul: Math.max(0.6, Math.round(((wNow || 1) - 0.1) * 10) / 10) }); }}
            onInc={function () { mergeLayout({ wMul: Math.min(1.8, Math.round(((wNow || 1) + 0.1) * 10) / 10) }); }}
            onClear={function () { mergeLayout({ wMul: undefined }); }}
          />
          <LibFitRow
            label="LINES"
            display={linesNow ? String(linesNow) : "AUTO"}
            onDec={function () { mergeLayout({ lines: Math.max(1, (linesNow || 2) - 1) }); }}
            onInc={function () { mergeLayout({ lines: Math.min(8, (linesNow || 1) + 1) }); }}
            onClear={function () { mergeLayout({ lines: undefined }); }}
          />
          <LibFitRow
            label="X"
            display={dxNow ? nudgeDisp(dxNow) : "AUTO"}
            onDec={function () { mergeLayout({ dx: Math.max(-300, dxNow - 6) }); }}
            onInc={function () { mergeLayout({ dx: Math.min(300, dxNow + 6) }); }}
            onClear={function () { mergeLayout({ dx: undefined }); }}
          />
          <LibFitRow
            label="Y"
            display={dyNow ? nudgeDisp(dyNow) : "AUTO"}
            onDec={function () { mergeLayout({ dy: Math.max(-300, dyNow - 6) }); }}
            onInc={function () { mergeLayout({ dy: Math.min(300, dyNow + 6) }); }}
            onClear={function () { mergeLayout({ dy: undefined }); }}
          />
          <button
            type="button"
            className="chip"
            style={{ cursor: "pointer", alignSelf: "flex-start", fontSize: 8 }}
            onClick={function () { onLayout(null); }}
          >RESET · AUTO FIT</button>
        </div>
      ) : null}
    </div>
  );
}

/** Inline preview of a native infinity family: slide-0 window of a short
 *  strip, rendered from the same generator compose uses (deterministic, no
 *  fetch). The shared nb-* def ids across previews are identical definitions
 *  — same contract compose documents. Exported for the CHOOSE bench's
 *  backdrop readout (v3.6). */
export function LibNativeBgPreview({ fam, seed, palette }: { fam: string; seed: number; palette: string }) {
  const markup = renderNativeBgInner(
    nativeGenKeyOf(fam), seed, 0, 3,
    (palette === "amber" || palette === "cobalt" || palette === "green" ? palette : "blend")
  );
  return (
    <svg
      viewBox="0 0 1080 1350"
      preserveAspectRatio="xMidYMid slice"
      /* compositions are night-dark by design — preview-only exposure lift
         so thumbs don't read as dead black tiles next to the baked SVGs
         (matches the CREATE ∞ strip; never applied to composed slides) */
      style={{ width: "100%", height: "100%", display: "block", filter: "brightness(2.1) saturate(1.3)" }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** The native picker's three shelves (v3.2): the deck category's own style
 *  compositions first, every other category's styles next (they re-tint),
 *  then the v3.1 classics — the "before" generation. Empty groups hide. */
function nativeBackdropGroups(palette: string): { label: string; note: string; keys: string[] }[] {
  const hue = palette === "amber" || palette === "cobalt" || palette === "green" ? palette : "blend";
  // ∞ approval sitting 2026-07-15: cut styles leave the shelves
  const styleKeys = Object.keys(STYLE_DEFS).filter(function (k) { return !INFINITY_STYLE_CUT[k]; });
  return [
    {
      label: "COLLECTION ∞",
      note: "ten-page compositions made for this category",
      keys: styleKeys.filter(function (k) { return STYLE_DEFS[k].cat === hue; }),
    },
    {
      label: "MORE STYLES ∞",
      note: "other categories' compositions — tinted to yours",
      keys: styleKeys.filter(function (k) { return STYLE_DEFS[k].cat !== hue; }),
    },
    {
      label: "CLASSICS ∞",
      note: "first-generation fields — scale to any deck length",
      keys: [...NATIVE_FAMILIES],
    },
  ];
}

/** Backdrop thumb: static <img> of the baked SVG (no inline parsing here —
 *  bg gradients carry unique gNNNN ids but <img> isolation is free). Native
 *  "n:*" keys render their generator inline instead (there is no file).
 *  Ring + corner tag mark the slide's currently RESOLVED key. */
function LibBgThumb({ bgKey, name, ringed, ringLabel, onPick, seed, palette }: {
  bgKey: string; name: string; ringed: boolean; ringLabel?: string; onPick: () => void;
  seed?: number; palette?: string;
}) {
  const native = isNativeKey(bgKey);
  const disp = native ? "∞" : bgKey;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <div
        role="button"
        tabIndex={0}
        title={disp + " · " + name.toUpperCase()}
        style={{
          position: "relative", aspectRatio: "4 / 5", borderRadius: 10, overflow: "hidden",
          cursor: "pointer", background: "#0A0B10",
          border: ringed ? "1px solid var(--amber)" : "1px solid var(--line-2)",
          boxShadow: ringed ? "0 0 0 1px var(--amber)" : undefined,
        }}
        onClick={onPick}
        onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }}
      >
        {native ? (
          <LibNativeBgPreview fam={nativeGenKeyOf(bgKey)} seed={seed || 1} palette={palette || "blend"} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bgSvgUrl(bgKey)} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
        {ringed && ringLabel ? <span style={libCornerTagStyle}>{ringLabel}</span> : null}
      </div>
      <span style={libSwatchLabelStyle}>{disp} · {name}</span>
    </div>
  );
}

/** Full-range picker: all 36 grouped by topic fitness (WIZARD-FLOW §3 —
 *  this topic's pools first, then brand, then the rest). Groups dedupe in
 *  order, so a brand key already in the topic pool shows only once. */
function libBackdropGroups(topics: TopicsData, topicKey: string): { label: string; keys: string[] }[] {
  const t =
    topics.topics.filter(function (x) { return x.key === topicKey; })[0] ||
    topics.topics.filter(function (x) { return x.key === "brand"; })[0];
  const brand = topics.topics.filter(function (x) { return x.key === "brand"; })[0];
  const seen = new Set<string>();
  function take(keys: string[]): string[] {
    return keys.filter(function (k) {
      if (seen.has(k) || !topics.backdrops[k]) return false;
      seen.add(k);
      return true;
    });
  }
  return [
    { label: "TOPIC POOL", keys: take(t ? [...t.primary, ...t.secondary] : []) },
    { label: "BRAND", keys: take(brand ? brand.primary : []) },
    { label: "FULL RANGE", keys: take(Object.keys(topics.backdrops).sort()) },
  ].filter(function (g) { return g.keys.length > 0; });
}

/** ALL-36 backdrop popover — ImagePicker's modal shell idiom: warm scrim,
 *  ESC closes THIS modal only (capture + stopPropagation), body dataset
 *  modalOpen stands the station shortcuts down while open. Exported for the
 *  CHOOSE bench's per-direction backdrop switch (v3.6) — same shelves, same
 *  ∞/rotate filtering, one picker for both stations. */
export function LibBackdropAllModal({ topics, topicKey, current, onPick, onClose, showNative, infinityPick, seed, palette }: {
  topics: TopicsData; topicKey: string; current: string;
  onPick: (key: string) => void; onClose: () => void;
  // showNative: offer the ∞ style/classic shelves (v3.3: BOTH modes — in
  // rotate a native pick is a per-slide frame of the composition).
  // infinityPick: the pick applies deck-wide with mirroring, so baked keys
  // filter to the approval-sitting keepers; rotate offers all 36.
  showNative?: boolean; infinityPick?: boolean; seed?: number; palette?: string;
}) {
  useEffect(function () {
    document.body.dataset.modalOpen = "1";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey, true);
    return function () {
      delete document.body.dataset.modalOpen;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  // ∞ mode offers only the approval-sitting keepers (2026-07-15): on the
  // other 27 the mirror fold reads as a crease. Rotate mode keeps all 36.
  const groups = libBackdropGroups(topics, topicKey)
    .map(function (g) {
      return infinityPick ? { ...g, keys: g.keys.filter(function (k) { return INFINITY_BAKED_KEEP[k]; }) } : g;
    })
    .filter(function (g) { return g.keys.length > 0; });

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={function (e) { e.stopPropagation(); }}
        style={{ width: 680, maxWidth: "92vw", maxHeight: "84vh", display: "flex", flexDirection: "column" }}
      >
        <div className="rise d1" style={{ padding: "16px 18px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="ph" style={{ flex: 1, margin: 0 }}>BACKDROPS · <b>{infinityPick ? "∞ + APPROVED" : "∞ + ALL 36"}</b></div>
            <span className="kbd" onClick={onClose} style={{ cursor: "pointer" }} title="Close">ESC</span>
          </div>
        </div>
        <div className="rise d2" style={{ padding: 18, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {showNative ? nativeBackdropGroups(palette || "blend").map(function (ng) {
            if (!ng.keys.length) return null;
            return (
              <div key={ng.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="ph" style={{ margin: 0 }}>
                  {ng.label} <b className="mono" style={{ letterSpacing: 0 }}>{ng.keys.length}</b>
                  <span className="whisper" style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
                    {ng.note}
                  </span>
                </div>
                <div className="thumb-grid">
                  {ng.keys.map(function (fam) {
                    const k = NATIVE_PREFIX + fam;
                    const ringed = k === current;
                    const meta = nativeMetaOf(k);
                    return (
                      <div
                        key={k}
                        role="button"
                        tabIndex={0}
                        title={"∞ " + meta.name.toUpperCase() + " · " + meta.desc.toUpperCase()}
                        style={{ display: "flex", flexDirection: "column", gap: 5, cursor: "pointer", minWidth: 0 }}
                        onClick={function () { onPick(k); }}
                        onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(k); } }}
                      >
                        <div style={{
                          position: "relative", aspectRatio: "4 / 5", borderRadius: 10, overflow: "hidden",
                          background: "#0A0B10",
                          border: ringed ? "1px solid var(--amber)" : "1px solid var(--line-2)",
                          boxShadow: ringed ? "0 0 0 1px var(--amber)" : undefined,
                        }}>
                          <LibNativeBgPreview fam={fam} seed={seed || 1} palette={palette || "blend"} />
                          {ringed ? <span style={libCornerTagStyle}>CURRENT</span> : null}
                        </div>
                        <span style={libSwatchLabelStyle}>∞ · {meta.name}</span>
                        <span style={{ ...libSwatchLabelStyle, color: "var(--dim)" }}>{meta.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }) : null}
          {groups.map(function (g) {
            return (
              <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="ph" style={{ margin: 0 }}>
                  {g.label} <b className="mono" style={{ letterSpacing: 0 }}>{g.keys.length}</b>
                </div>
                <div className="thumb-grid">
                  {g.keys.map(function (k) {
                    const bd = topics.backdrops[k];
                    const ringed = k === current;
                    return (
                      <div
                        key={k}
                        role="button"
                        tabIndex={0}
                        title={k + " · " + bd.name.toUpperCase() + " · " + bd.tier.toUpperCase()}
                        style={{ display: "flex", flexDirection: "column", gap: 5, cursor: "pointer", minWidth: 0 }}
                        onClick={function () { onPick(k); }}
                        onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(k); } }}
                      >
                        <div style={{
                          position: "relative", aspectRatio: "4 / 5", borderRadius: 10, overflow: "hidden",
                          background: "#0A0B10",
                          border: ringed ? "1px solid var(--amber)" : "1px solid var(--line-2)",
                          boxShadow: ringed ? "0 0 0 1px var(--amber)" : undefined,
                        }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={bgSvgUrl(k)} alt={bd.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          {ringed ? <span style={libCornerTagStyle}>CURRENT</span> : null}
                        </div>
                        <span style={libSwatchLabelStyle}>{k} · {bd.name}</span>
                        <span style={{ ...libSwatchLabelStyle, color: "var(--dim)" }}>{bd.tier}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The LIBRARY rail. Assumes the active slide is type "library" (EditStation
 *  gates the swap); every commit rides updateSlide with a pushUndo snapshot
 *  on discrete changes — the same undo-coverage rule the inspector follows.
 *  Backdrop finalize goes through the store's setSlideBgOverride, which owns
 *  the whole-deck chain re-resolve (override feeds the next slide's prevKey). */
function LibraryInspector() {
  const slides = useWizard((s) => s.slides);
  const activeIdx = useWizard((s) => s.activeIdx);
  const topic = useWizard((s) => s.topic);
  const libSeed = useWizard((s) => s.libSeed);
  const bgMode = useWizard((s) => s.bgMode);
  const setBgMode = useWizard((s) => s.setBgMode);
  const category = useWizard((s) => s.category);
  const inspectorFocus = useWizard((s) => s.inspectorFocus);
  const setInspectorFocus = useWizard((s) => s.setInspectorFocus);
  const undoDepth = useWizard((s) => s.undoStack.length);
  const draftSavedAt = useWizard((s) => s.draftSavedAt);
  const undo = useWizard((s) => s.undo);

  const active: Slide | undefined = slides[activeIdx];
  // library JSON indexes: cache peek per render; when cold, kick the loaders
  // once and re-render on resolve (loadTemplates/loadTopics dedupe in-flight)
  const [, bump] = useReducer(function (c: number) { return c + 1; }, 0);
  useEffect(function () {
    let alive = true;
    function tick() { if (alive) bump(); }
    if (!templatesSync()) loadTemplates().then(tick).catch(function () {});
    if (!topicsSync()) loadTopics().then(tick).catch(function () {});
    return function () { alive = false; };
  }, []);
  const tpls = templatesSync();
  const topics = topicsSync();

  const [allOpen, setAllOpen] = useState(false);
  const [slotPicker, setSlotPicker] = useState<string | null>(null); // slot name awaiting an image pick
  const [chartBusy, setChartBusy] = useState<string | null>(null); // slot name mid chart-gen
  const [fieldFocusKeys, setFieldFocusKeys] = useState<Record<string, number>>({});
  const [openSecs, setOpenSecs] = useState<Record<string, boolean>>({
    lfields: true, ltemplate: true, limages: true, lbackdrop: true, lrevisions: false,
  });
  function toggleSec(id: string) {
    setOpenSecs(function (s) { return { ...s, [id]: !s[id] }; });
  }

  // On-canvas select (v3 §T): the bench forwards clicks on composed
  // [data-field]/[data-slotimg] elements through inspectorFocus. Consume the
  // signal: open the right section + focus the matching editor.
  useEffect(function () {
    if (!inspectorFocus) return;
    if (inspectorFocus.indexOf("libfield:") === 0) {
      const name = inspectorFocus.slice("libfield:".length);
      setOpenSecs(function (s) { return { ...s, lfields: true }; });
      setFieldFocusKeys(function (k) { return { ...k, [name]: (k[name] || 0) + 1 }; });
      setInspectorFocus(null);
    } else if (inspectorFocus.indexOf("libslot:") === 0) {
      setOpenSecs(function (s) { return { ...s, limages: true }; });
      setInspectorFocus(null);
    }
  }, [inspectorFocus, setInspectorFocus]);

  if (!active) {
    return (
      <aside className="glass" style={libRailStyle}>
        <div className="whisper" style={{ padding: "18px 4px" }}>No slide selected.</div>
      </aside>
    );
  }

  // ── derived view state ──
  const tpl: LibTemplate | undefined = tpls
    ? tpls.filter(function (t) { return t.idx === active.libraryTemplate; })[0]
    : undefined;
  const fills = active.libraryFills || {};
  // §G: one input per field that has a fill or a maxLen; logo marks never list
  const fieldRows: LibField[] = tpl
    ? tpl.fields.filter(function (f) {
        if (f.role === "logo") return false;
        return fills[f.name] !== undefined || f.maxLen != null;
      })
    : [];
  // same-family swap rail; only approved rows ship but the disposition guard
  // costs nothing (templates.json carries "keep" + "keep-fixed-flag")
  const familyTpls: LibTemplate[] = tpls && tpl
    ? tpls.filter(function (t) { return t.family === tpl.family && t.disposition.indexOf("keep") === 0; })
    : [];
  const topicKey = topic || "brand";
  const cands = topics ? candidates(topics, topicKey, libSeed, activeIdx) : [];
  const resolvedKey = active.libraryBg || "02"; // compose's fallback key
  const resolvedNative = isNativeKey(resolvedKey);
  const resolvedDisp = resolvedNative ? "∞ " + nativeGenKeyOf(resolvedKey).toUpperCase() : resolvedKey;
  const activePalette = active.libraryPalette || CATEGORY_PALETTE[category];
  const overridden = !!active.libraryBgOverride;
  const topicName = topics
    ? ((topics.topics.filter(function (t) { return t.key === topicKey; })[0] || { name: topicKey }).name)
    : topicKey;
  const rev = String.fromCharCode(65 + Math.min(undoDepth, 25));
  const savedLabel = draftSavedAt == null
    ? "PENDING"
    : new Date(draftSavedAt).toLocaleTimeString("en-GB", { hour12: false });

  // Discrete commit on blur/Enter: snapshot only when the text actually
  // changed (EditInspector setImage's rule), then ride updateSlide.
  function commitFill(name: string, value: string) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    const curr = (sl.libraryFills || {})[name] || "";
    if (value === curr) return;
    st.pushUndo();
    st.updateSlide(st.activeIdx, { ...sl, libraryFills: { ...(sl.libraryFills || {}), [name]: value } });
  }

  // Text-fit override commit (v3 §T): null clears the field back to auto.
  function commitLayout(name: string, l: { size?: number; wMul?: number; lines?: number; dx?: number; dy?: number } | null) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    const next = { ...(sl.libraryLayout || {}) };
    if (l) next[name] = l;
    else delete next[name];
    st.pushUndo();
    st.updateSlide(st.activeIdx, { ...sl, libraryLayout: next });
  }

  // Slot image commits (v3 §V): set / clear / toggle FILL-FIT, all undoable.
  function commitSlotImage(slot: string, url: string | null) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    const imgs = { ...(sl.librarySlotImages || {}) };
    const fits = { ...(sl.librarySlotFit || {}) };
    if (url) imgs[slot] = url;
    else { delete imgs[slot]; delete fits[slot]; }
    st.pushUndo();
    st.updateSlide(st.activeIdx, { ...sl, librarySlotImages: imgs, librarySlotFit: fits });
  }
  function toggleSlotFit(slot: string) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    const fits = { ...(sl.librarySlotFit || {}) };
    fits[slot] = fits[slot] === "contain" ? "cover" : "contain";
    st.pushUndo();
    st.updateSlide(st.activeIdx, { ...sl, librarySlotFit: fits });
  }

  // Claude chart-gen (v3 §V): article (text wins, url refetches server-side)
  // + this slide's story → validated spec → brand SVG → data: URL into the
  // slot. Palette-aware so tinted decks get tinted charts.
  async function genChart(slot: string) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl || chartBusy) return;
    const f = sl.libraryFills || {};
    const context = ["headline: " + (f.headline || sl.title || ""), f.subhead ? "subhead: " + f.subhead : "", f.eyebrow ? "eyebrow: " + f.eyebrow : ""]
      .concat(Object.keys(f).filter(function (k) { return k.indexOf("stat") === 0 || k.indexOf("body") === 0; }).map(function (k) { return k + ": " + f[k]; }))
      .filter(Boolean).join("\n");
    setChartBusy(slot);
    try {
      const spec = await generateChartSpec({ text: st.text, url: st.url, slideContext: context });
      const palette = sl.libraryPalette || CATEGORY_PALETTE[st.category];
      const svg = renderChartSvg(spec, palette);
      commitSlotImage(slot, chartSvgToDataUrl(svg));
      showToast("CHART PLACED · " + (spec.title || "UNTITLED").toUpperCase().slice(0, 40));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Chart generation failed", "error");
    } finally {
      setChartBusy(null);
    }
  }

  // Backdrop finalize/AUTO: no-op re-picks stand down (the store snapshots
  // undo on every call — the guard keeps the stack free of empty steps).
  function finalizeBg(key: string | null) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl || (sl.libraryBgOverride || null) === key) return;
    st.setSlideBgOverride(st.activeIdx, key);
  }

  // Swap keeps fills whose names exist on the target, drops the rest (toast
  // the count — ⌘Z restores); slot images prune to the target's slot names.
  // No chain re-resolve needed: the backdrop key is template-independent.
  function swapTemplate(target: LibTemplate) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl || sl.libraryTemplate === target.idx) return;
    const fieldNames = new Set(target.fields.map(function (f) { return f.name; }));
    const kept: Record<string, string> = {};
    let dropped = 0;
    Object.keys(sl.libraryFills || {}).forEach(function (k) {
      if (fieldNames.has(k)) kept[k] = (sl.libraryFills as Record<string, string>)[k];
      else dropped++;
    });
    const slotNames = new Set(target.slots.map(function (s2) { return s2.name; }));
    const keptSlots: Record<string, string> = {};
    Object.keys(sl.librarySlotImages || {}).forEach(function (k) {
      if (slotNames.has(k)) keptSlots[k] = (sl.librarySlotImages as Record<string, string>)[k];
    });
    st.pushUndo();
    st.updateSlide(st.activeIdx, { ...sl, libraryTemplate: target.idx, libraryFills: kept, librarySlotImages: keptSlots });
    if (dropped > 0) {
      showToast(dropped + (dropped === 1 ? " FILL" : " FILLS") + " DROPPED · ⌘Z RESTORES");
    }
  }

  return (
    <>
      <aside className="glass" style={libRailStyle}>
        <div className="rise d4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* ═══ L1 · FIELDS (template text fills, live counters) ═══ */}
          <LibSec
            id="lfields"
            label="FIELDS"
            extra={fieldRows.length ? fieldRows.length + (fieldRows.length === 1 ? " FIELD" : " FIELDS") : undefined}
            open={!!openSecs.lfields}
            onToggle={toggleSec}
          >
            {!tpls ? (
              <span className="whisper">Loading the template index…</span>
            ) : !tpl ? (
              <span className="whisper">Template {String(active.libraryTemplate ?? "?")} is not in the library index.</span>
            ) : fieldRows.length === 0 ? (
              <span className="whisper">No editable fields on this layout.</span>
            ) : (
              <>
                {fieldRows.map(function (f) {
                  return (
                    <LibFieldInput
                      key={String(active.id) + ":" + f.name}
                      slideId={String(active.id)}
                      field={f}
                      value={fills[f.name] || ""}
                      layout={(active.libraryLayout || {})[f.name]}
                      focusKey={fieldFocusKeys[f.name] || 0}
                      onCommit={function (v) { commitFill(f.name, v); }}
                      onLayout={function (l) { commitLayout(f.name, l); }}
                    />
                  );
                })}
                <span className="whisper">Commits on blur or Enter · click text on the canvas to jump here · FIT pins size, box width, line budget.</span>
              </>
            )}
          </LibSec>

          {/* ═══ L2 · TEMPLATE (same-family swap rail) ═══ */}
          <LibSec
            id="ltemplate"
            label="TEMPLATE"
            extra={tpl ? tpl.family.toUpperCase() + " · IDX " + tpl.idx : undefined}
            open={!!openSecs.ltemplate}
            onToggle={toggleSec}
          >
            {!tpls ? (
              <span className="whisper">Loading the template index…</span>
            ) : !tpl ? (
              <span className="whisper">No template assigned to this slide.</span>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {familyTpls.map(function (t) {
                    const on = t.idx === tpl.idx;
                    return (
                      <div
                        key={t.idx}
                        role="button"
                        tabIndex={0}
                        title={t.layout + (t.useWhen ? " — " + t.useWhen : "")}
                        style={{ display: "flex", flexDirection: "column", gap: 4, width: 64, flexShrink: 0, cursor: on ? "default" : "pointer" }}
                        onClick={function () { swapTemplate(t); }}
                        onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); swapTemplate(t); } }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tplSvgUrl(t)}
                          alt={t.layout}
                          loading="lazy"
                          style={{
                            ...libTplThumbStyle,
                            border: on ? "1px solid var(--amber)" : "1px solid var(--line-2)",
                            boxShadow: on ? "0 0 0 1px var(--amber)" : undefined,
                          }}
                        />
                        <span style={{ ...libSwatchLabelStyle, color: on ? "var(--amber)" : "var(--muted)" }}>{t.layout}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="whisper">Same-family layouts · matching fills carry over, the rest drop.</span>
              </>
            )}
          </LibSec>

          {/* ═══ L3 · IMAGES (v3 §V: slot fill — pool pick · Claude chart ·
               FILL/FIT sizing to the fixed frame · ✕ remove) ═══ */}
          {tpl && tpl.slots.length > 0 ? (
            <LibSec
              id="limages"
              label="IMAGES"
              extra={(function () {
                const n = Object.keys(active.librarySlotImages || {}).length;
                return n ? n + " SET" : tpl.slots.length + (tpl.slots.length === 1 ? " SLOT" : " SLOTS");
              })()}
              open={!!openSecs.limages}
              onToggle={toggleSec}
            >
              {tpl.slots.map(function (sl2) {
                const url = (active.librarySlotImages || {})[sl2.name];
                const fitMode = ((active.librarySlotFit || {})[sl2.name]) || "cover";
                const busy = chartBusy === sl2.name;
                return (
                  <div key={sl2.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 8.5, letterSpacing: ".1em", color: "var(--muted)" }}>
                        {sl2.name.toUpperCase()} · {String(sl2.accepts || "image").toUpperCase()}
                      </span>
                      {url ? (
                        <>
                          <button
                            type="button"
                            className="chip"
                            style={{ cursor: "pointer", fontSize: 7.5, padding: "1px 7px", marginLeft: "auto" }}
                            title={fitMode === "contain" ? "FIT: whole image inside the frame — switch to FILL (crop)" : "FILL: crops to the frame — switch to FIT (letterbox)"}
                            onClick={function () { toggleSlotFit(sl2.name); }}
                          >{fitMode === "contain" ? "FIT" : "FILL"}</button>
                          <button
                            type="button"
                            className="chip"
                            style={{ cursor: "pointer", fontSize: 7.5, padding: "1px 7px", color: "var(--coral)" }}
                            title="Remove this image"
                            onClick={function () { commitSlotImage(sl2.name, null); }}
                          >✕</button>
                        </>
                      ) : null}
                    </div>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={sl2.name} style={{ width: "100%", height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line-2)", background: "#0A0B10", display: "block" }} />
                    ) : null}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ ...libSmallBtnStyle, flex: 1 }}
                        onClick={function () { setSlotPicker(sl2.name); }}
                      >{url ? "REPLACE" : "ADD IMAGE"}</button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy}
                        style={{ ...libSmallBtnStyle, flex: 1, opacity: busy ? 0.5 : 1 }}
                        title="Claude reads the article and draws the chart this slide is arguing"
                        onClick={function () { void genChart(sl2.name); }}
                      >{busy ? "DRAWING…" : "GEN CHART"}</button>
                    </div>
                  </div>
                );
              })}
              <span className="whisper">Images ride the slot frame · FILL crops, FIT letterboxes · GEN CHART pulls exact figures from the source.</span>
            </LibSec>
          ) : null}

          {/* ═══ L4 · BACKDROP (finalize: 3 candidates · AUTO · ALL 36 ·
               ROTATE/INFINITY deck mode) ═══ */}
          <LibSec
            id="lbackdrop"
            label="BACKDROP"
            extra={resolvedDisp + (bgMode === "infinity" ? " · ∞" : overridden ? " · FINAL" : " · AUTO")}
            open={!!openSecs.lbackdrop}
            onToggle={toggleSec}
          >
            {!topics ? (
              <span className="whisper">Loading the backdrop index…</span>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["infinity", "rotate"] as const).map(function (m) {
                    const on = bgMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        className="chip"
                        style={{
                          cursor: "pointer", flex: 1, justifyContent: "center",
                          background: on ? "var(--cobalt-wash)" : "transparent",
                          borderColor: on ? "var(--cobalt-line)" : undefined,
                          color: on ? "var(--blue-300)" : undefined,
                        }}
                        title={m === "infinity" ? "One continuous backdrop across the whole deck — seamless as you swipe" : "Per-slide rotation from the topic pool"}
                        onClick={function () { setBgMode(m); }}
                      >{m === "infinity" ? "∞ INFINITY" : "ROTATE"}</button>
                    );
                  })}
                </div>
                {bgMode === "infinity" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    <LibBgThumb
                      bgKey={resolvedKey}
                      name={resolvedNative
                        ? nativeMetaOf(resolvedKey).name
                        : (topics.backdrops[resolvedKey] && topics.backdrops[resolvedKey].name) || resolvedKey}
                      ringed
                      ringLabel="DECK"
                      seed={libSeed}
                      palette={activePalette}
                      onPick={function () { setAllOpen(true); }}
                    />
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {cands.map(function (k) {
                      const bd = topics.backdrops[k];
                      return (
                        <LibBgThumb
                          key={k}
                          bgKey={k}
                          name={(bd && bd.name) || k}
                          ringed={k === resolvedKey}
                          ringLabel={overridden ? "FINAL" : "ASSIGNED"}
                          onPick={function () { finalizeBg(k); }}
                        />
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="chip"
                    title="Clear the override · back to the topic rotation"
                    style={{
                      cursor: "pointer",
                      background: !overridden ? "var(--cobalt-wash)" : "transparent",
                      borderColor: !overridden ? "var(--cobalt-line)" : undefined,
                      color: !overridden ? "var(--blue-300)" : undefined,
                    }}
                    onClick={function () { finalizeBg(null); }}
                  >AUTO</button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ ...libSmallBtnStyle, marginLeft: "auto" }}
                    onClick={function () { setAllOpen(true); }}
                  >ALL 36</button>
                </div>
                <span className="whisper">
                  {bgMode === "infinity"
                    ? "One world, deck-wide. NATIVE ∞ families render a single continuous strip that never repeats; baked picks mirror alternate slides so seams line up. Picks apply to the whole deck."
                    : "Topic pool · " + topicName + " — assigned per slide, no repeats back-to-back. Pick a thumb to finalize; ALL 36 includes the ∞ styles as per-slide frames."}
                </span>
              </>
            )}
          </LibSec>

          {/* ═══ L4 · REVISIONS (collapsed by default — EditInspector twin) ═══ */}
          <LibSec id="lrevisions" label="REVISIONS" extra="AUTOSAVE" open={!!openSecs.lrevisions} onToggle={toggleSec}>
            <div style={libHistRowStyle}>
              AUTOSAVE · <b style={{ color: "var(--tx)", fontWeight: 500 }}>{savedLabel}</b>
            </div>
            <div style={{ ...libHistRowStyle, color: "var(--amber)" }}>
              REV {rev} · {undoDepth} {undoDepth === 1 ? "STEP" : "STEPS"} HELD
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={undoDepth === 0}
              style={{ ...libSmallBtnStyle, opacity: undoDepth === 0 ? 0.4 : 1, alignSelf: "flex-start" }}
              onClick={function () { undo(); }}
            >
              UNDO
              <span className="kbd">{"⌘"}Z</span>
            </button>
          </LibSec>
        </div>
      </aside>

      {/* ═══ ALL-36 POPOVER (sibling of the rail: fixed-position modal must
           not sit under a filtered/transformed containing block) ═══ */}
      {allOpen && topics ? (
        <LibBackdropAllModal
          topics={topics}
          topicKey={topicKey}
          current={resolvedKey}
          showNative
          infinityPick={bgMode === "infinity"}
          seed={libSeed}
          palette={activePalette}
          onPick={function (k) { finalizeBg(k); setAllOpen(false); }}
          onClose={function () { setAllOpen(false); }}
        />
      ) : null}

      {/* ═══ SLOT IMAGE PICKER (v3 §V — same pool/upload modal classic mode
           uses; data: URLs are fine here, compose renders them client-side) ═══ */}
      {slotPicker !== null ? (
        <ImagePicker
          open
          onClose={function () { setSlotPicker(null); }}
          onPick={function (url) {
            if (url) commitSlotImage(slotPicker, url);
            setSlotPicker(null);
          }}
          theme={category}
          context={(fills.headline || active.title || "").slice(0, 300)}
        />
      ) : null}
    </>
  );
}

export function EditStation() {
  const slides = useWizard((s) => s.slides);
  const activeIdx = useWizard((s) => s.activeIdx);
  const setActiveIdx = useWizard((s) => s.setActiveIdx);
  const updateSlide = useWizard((s) => s.updateSlide);
  const addSlide = useWizard((s) => s.addSlide);
  const removeSlide = useWizard((s) => s.removeSlide);
  const duplicateSlide = useWizard((s) => s.duplicateSlide);
  const moveSlide = useWizard((s) => s.moveSlide);
  const undoDepth = useWizard((s) => s.undoStack.length);
  const category = useWizard((s) => s.category);
  const articleTitle = useWizard((s) => s.articleTitle);
  const go = useWizard((s) => s.go);

  const active: Slide | undefined = slides[activeIdx];
  const overflow = useBodyOverflow(active);

  const [zoom, setZoom] = useState(1);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [pickerField, setPickerField] = useState<"imageUrl" | "imageUrl2" | null>(null);
  const benchRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  // Per-slide clip estimate for the film-strip badges (#24): FULL-res px of
  // body text past the fold, 0 = fits. Cheap canvas measure, deck-change only.
  const clipPxByIdx = useMemo(
    function () {
      return slides.map(function (sl) {
        return estimateOverflowPx(sl);
      });
    },
    [slides]
  );

  const coverLocked = !!slides[0] && (slides[0].type || "").indexOf("cover") === 0;

  // ── keyboard: arrows + Cmd+Z with the focus guard, Enter continues ──
  useEffect(function () {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (document.body.hasAttribute("data-modal-open")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
        if (isTextTarget()) return; // text fields keep their native undo
        e.preventDefault();
        useWizard.getState().undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault(); // always — the browser bookmark dialog never opens here
        if (isTextTarget()) return; // typing stands down, same guard as Cmd+Z
        const st = useWizard.getState();
        st.duplicateSlide(st.activeIdx);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (isTextTarget()) return; // the V1 focus-guard bug fix
        e.preventDefault(); // Up/Down: also stops the page scrolling under the strip
        const st = useWizard.getState();
        const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
        st.setActiveIdx(st.activeIdx + (fwd ? 1 : -1));
        return;
      }
      if (e.key === "Enter" && document.activeElement === document.body) {
        useWizard.getState().go("publish");
      }
    }
    window.addEventListener("keydown", onKey);
    return function () {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Keep the active thumb visible: arrow-nav past the fold scrolls the strip.
  useEffect(
    function () {
      const rail = stripRef.current;
      if (!rail) return;
      const thumb = rail.querySelector('[data-fs-idx="' + activeIdx + '"]');
      if (thumb && typeof thumb.scrollIntoView === "function") {
        thumb.scrollIntoView({ block: "nearest" });
      }
    },
    [activeIdx]
  );

  // ── zoom cluster: − / % / + / FIT ──
  // zoomFit lands off-ladder values (0.3–2.0): past the last stop the steppers
  // CLAMP rather than snap across to the far side of the ladder (#9).
  function zoomOut() {
    const below = ZOOM_STOPS.filter(function (z) { return z < zoom - 0.001; });
    setZoom(below.length ? below[below.length - 1] : Math.min(zoom, ZOOM_STOPS[0]));
  }
  function zoomIn() {
    const above = ZOOM_STOPS.filter(function (z) { return z > zoom + 0.001; });
    setZoom(above.length ? above[0] : Math.max(zoom, ZOOM_STOPS[ZOOM_STOPS.length - 1]));
  }
  function zoomFit() {
    const el = benchRef.current;
    if (!el) return;
    const z = Math.min((el.clientWidth - 36) / DISPLAY_W, (el.clientHeight - 36) / DISPLAY_H);
    setZoom(Math.max(0.3, Math.min(2, Math.round(z * 100) / 100)));
  }

  // ── film strip drag-reorder (store.moveSlide snapshots undo itself) ──
  function handleDrop() {
    if (dragIdx !== null && overIdx !== null) {
      let to = overIdx > dragIdx ? overIdx - 1 : overIdx;
      to = Math.max(0, Math.min(slides.length - 1, to));
      if (coverLocked && (dragIdx === 0 || to === 0)) {
        showToast("Cover stays at slide 01.", "error");
      } else if (to !== dragIdx) {
        moveSlide(dragIdx, to);
      }
    }
    setDragIdx(null);
    setOverIdx(null);
  }

  // No confirm here — removeSlide snapshots undo internally, so the toast IS
  // the safety net (#16): one keystroke restores the slide.
  function deleteActive() {
    if (slides.length <= 1) {
      showToast("The deck needs at least one slide.", "error");
      return;
    }
    const n = pad2(activeIdx + 1);
    removeSlide(activeIdx); // snapshots undo internally
    showToast("SLIDE " + n + " DELETED · ⌘Z RESTORES");
  }

  // V1 commitImage parity: a new url gets a fresh fit/position for its slot.
  function commitImage(url: string, f: "imageUrl" | "imageUrl2") {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    st.updateSlide(
      st.activeIdx,
      f === "imageUrl2"
        ? { ...sl, imageUrl2: url, imageFit: "cover", imagePosition2: "center" }
        : { ...sl, imageUrl: url, imageFit: "cover", imagePosition: "center" }
    );
  }

  async function pickImage(url: string) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    const f = pickerField;
    if (!sl || !f || !url) return;
    if (url === (f === "imageUrl2" ? sl.imageUrl2 : sl.imageUrl)) return; // no-op re-pick
    // Reuse guard (V1 tryCommitImage): confirm only when the url lives on a
    // DIFFERENT slide; this slide's other slot never prompts.
    if (url !== sl.imageUrl && url !== sl.imageUrl2) {
      const nums: number[] = [];
      st.slides.forEach(function (s, i) {
        if (i !== st.activeIdx && (s.imageUrl === url || s.imageUrl2 === url)) nums.push(i + 1);
      });
      if (nums.length > 0) {
        const label = nums.length === 1 ? "slide " + pad2(nums[0]) : "slides " + nums.map(pad2).join(", ");
        const ok = await confirmDialog({
          title: "Image already in use",
          body: "This image is on " + label + ". Use it here too?",
          cta: "Use anyway",
        });
        if (!ok) return;
      }
    }
    commitImage(url, f);
  }

  const rev = String.fromCharCode(65 + Math.min(undoDepth, 25));

  // ── empty deck guard ──
  if (!active) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "6px 28px 18px" }}>
        <header className="rise d1" style={{ padding: "0 2px 14px" }}>
          <span className="kicker"><b>03</b> · EDIT · REFINE THE DECK</span>
        </header>
        <div className="glass rise d2" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <div style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted)" }}>
            NO SLIDES ON THE BENCH
          </div>
          <button type="button" className="btn btn-ghost" onClick={function () { go("create"); }}>
            Back to Create
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, padding: "6px 28px 18px" }}>
      {/* ═══ STATION HEADER: kicker + display hero + mono meta ═══ */}
      <header className="rise d1" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, padding: "0 2px 14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span className="kicker"><b>03</b> · EDIT · REFINE THE DECK</span>
          <h1 className="display" style={{ fontSize: 34 }}>
            Refine the <span className="grad">deck</span>.
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 4 }}>
          <span className="chip" style={{ maxWidth: 240 }} title={articleTitle || undefined}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(articleTitle || "UNTITLED RUN").toUpperCase()}
            </span>
          </span>
          <span className="chip">REV {rev}</span>
          <span className="chip">SLIDE {pad2(activeIdx + 1)} / {pad2(slides.length)}</span>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", gap: 16, minWidth: 0, minHeight: 0 }}>
        {/* ═══ FILM STRIP: plate rail, active slide amber ring ═══ */}
        <aside className="glass rise d2" style={{ width: 158, flex: "0 0 158px", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 14px 0", ...stripLabel }}>
            <span>FILM STRIP</span>
            <span style={{ color: "var(--dim)" }}>DRAG TO REORDER</span>
          </div>
          <div className="filmstrip" ref={stripRef} style={{ flex: 1 }}>
            {slides.map(function (sl, i) {
              return (
                <div key={sl.id}>
                  {dragIdx !== null && overIdx === i && <div style={droplineStyle} />}
                  <div
                    draggable={!(coverLocked && i === 0)}
                    onDragStart={function (e) { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={function (e) { e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
                    onDrop={function (e) { e.preventDefault(); handleDrop(); }}
                    onDragEnd={function () { setDragIdx(null); setOverIdx(null); }}
                    onClick={function () { setActiveIdx(i); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, opacity: dragIdx === i ? 0.5 : 1 }}
                  >
                    <div className={"fs-thumb" + (i === activeIdx ? " active" : "")} data-fs-idx={i} style={{ width: 92, flexShrink: 0 }}>
                      <SlidePreview slide={sl} theme={category} width={92} />
                      <span className="fs-num">{pad2(i + 1)}</span>
                      {clipPxByIdx[i] > 0 && (
                        <span
                          title={"CLIPS ~" + clipPxByIdx[i] + " PX · CLICK TO FIX"}
                          style={{ position: "absolute", top: 4, left: 4, zIndex: 2, width: 7, height: 7, borderRadius: "50%", background: "var(--coral)" }}
                        />
                      )}
                      {i === activeIdx && slides.length > 1 && (
                        <button
                          type="button"
                          title="Delete slide"
                          style={delBtnStyle}
                          onClick={function (e) { e.stopPropagation(); deleteActive(); }}
                        >{"×"}</button>
                      )}
                    </div>
                    <div className="hover-actions" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button
                        type="button"
                        style={nudgeBtnStyle}
                        title="Move up"
                        disabled={i === 0 || (coverLocked && i === 1)}
                        onClick={function (e) { e.stopPropagation(); moveSlide(i, i - 1); }}
                      >{"▲"}</button>
                      <button
                        type="button"
                        style={nudgeBtnStyle}
                        title="Move down"
                        disabled={i === slides.length - 1 || (coverLocked && i === 0)}
                        onClick={function (e) { e.stopPropagation(); moveSlide(i, i + 1); }}
                      >{"▼"}</button>
                      <button
                        type="button"
                        style={{ ...nudgeBtnStyle, fontSize: 9 }}
                        title={"Duplicate slide " + pad2(i + 1) + " (⌘D)"}
                        onClick={function (e) { e.stopPropagation(); duplicateSlide(i); }}
                      >{"⧉"}</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {dragIdx !== null && overIdx === slides.length && <div style={droplineStyle} />}
            <button
              type="button"
              style={plusTileStyle}
              title={"Insert after slide " + pad2(activeIdx + 1)}
              onClick={function () { addSlide(activeIdx); }}
              onDragOver={function (e) { e.preventDefault(); if (overIdx !== slides.length) setOverIdx(slides.length); }}
              onDrop={function (e) { e.preventDefault(); handleDrop(); }}
            >+</button>
          </div>
        </aside>

        {/* ═══ BENCH: canvas in the iron well ═══ */}
        <section className="rise d3" style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span className="chip ok">
              {active.type === "unique" || active.type === "library" ? "EDITING · SVG COMPOSITION · USE THE INSPECTOR" : "EDITING · TEXT LIVE ON CANVAS"}
            </span>
            <div className="seg">
              <button type="button" onClick={zoomOut} title="Zoom out">{"−"}</button>
              <span className="mono" style={zoomReadout}>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={zoomIn} title="Zoom in">+</button>
              <button type="button" className={zoom !== 0.75 && zoom !== 1 && zoom !== 1.5 ? "on" : ""} onClick={zoomFit} title="Fit to bench">FIT</button>
            </div>
          </div>

          <div ref={benchRef} style={wellStyle}>
            <div style={{ margin: "auto", flexShrink: 0, width: DISPLAY_W * zoom, height: DISPLAY_H * zoom, padding: 0 }}>
              <div
                style={{ width: DISPLAY_W, height: DISPLAY_H, transform: "scale(" + zoom + ")", transformOrigin: "top left", boxShadow: "0 18px 44px rgba(3,3,5,.55)", borderRadius: 4 }}
                onClick={function (e) {
                  // v3 §T on-canvas select: composed library SVG is live DOM —
                  // a click on a populated field (or placed slot image) jumps
                  // the inspector to that editor via inspectorFocus.
                  if (active.type !== "library") return;
                  const el = e.target as Element;
                  const fieldEl = el.closest ? el.closest("[data-field]") : null;
                  if (fieldEl) {
                    const name = fieldEl.getAttribute("data-field");
                    if (name && name !== "logo") {
                      useWizard.getState().setInspectorFocus("libfield:" + name);
                      return;
                    }
                  }
                  const slotEl = el.closest ? el.closest("[data-slotimg]") : null;
                  if (slotEl) {
                    const s2 = slotEl.getAttribute("data-slotimg");
                    if (s2) useWizard.getState().setInspectorFocus("libslot:" + s2);
                  }
                }}
              >
                <SlideCanvas
                  key={active.id}
                  slide={active}
                  theme={category}
                  page={activeIdx + 1}
                  total={slides.length}
                  onUpdate={function (s) {
                    // Canvas drop/file replace commits a new url without the
                    // reuse confirm (explicit intent) but still resets that
                    // slot's fit/position like commitImage.
                    let next = s;
                    if (s.imageUrl && s.imageUrl !== active.imageUrl) {
                      next = { ...next, imageFit: "cover", imagePosition: "center" };
                    }
                    if (s.imageUrl2 && s.imageUrl2 !== active.imageUrl2) {
                      next = { ...next, imageFit: "cover", imagePosition2: "center" };
                    }
                    updateSlide(activeIdx, next);
                  }}
                  onRequestPicker={function (f) { setPickerField(f); }}
                  onSplitBody={splitBodyAtOffset}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {canOverflow(active) && overflow.overflowing && (
              <>
                <span className="chip warn">BODY OVERFLOWS BY ~{overflow.words} WORDS</span>
                <button
                  type="button"
                  className="chip"
                  style={pushChipStyle}
                  title={"Move ~" + overflow.words + " tail words forward"}
                  onClick={function () { pushOverflowToNext(overflow.words); }}
                >
                  PUSH OVERFLOW {"→"} SLIDE {pad2(activeIdx + 2)}
                </button>
              </>
            )}
            <span className="chip" style={{ marginLeft: "auto" }}>SAFE AREA 1080{"×"}1350</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "9px 16px" }}
              onClick={function () { go("choose"); }}
            >
              Back to Choose
            </button>
            <button
              type="button"
              className="btn btn--amber"
              style={{ padding: "11px 20px" }}
              onClick={function () { go("publish"); }}
            >
              Continue to Publish
              <span className="kbd">{"⏎"}</span>
            </button>
          </div>
        </section>

        {/* ═══ INSPECTOR RAIL (library slides wear the LIBRARY rail — the
             standard type/typography/image controls do not apply to them) ═══ */}
        {active.type === "library" ? <LibraryInspector /> : <EditInspector />}
      </div>

      {/* ═══ CANVAS IMAGE PICKER (SlideCanvas onRequestPicker) ═══ */}
      {pickerField !== null && (
        <ImagePicker
          open
          onClose={function () { setPickerField(null); }}
          onPick={pickImage}
          theme={category}
          context={(active.bodyText || active.title || articleTitle || "").slice(0, 300)}
        />
      )}
    </div>
  );
}
