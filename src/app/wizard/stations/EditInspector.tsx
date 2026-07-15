"use client";
// ═══════════════════════════════════════════════════════════════════════════
// EDIT station · right inspector rail (docs/THEME-FOUNDRY.md §8 + v2 §9.7).
// Stacked forged plates with Register-1 heads. Regular decks keep the fixed order:
// SLIDE TYPE / LAYOUT / TYPOGRAPHY / IMAGES · B-ROLL / COVER (slide 01) /
// CTA · CLOSER (closer only) / OVERFLOW / REVISIONS. Unique decks swap in
// CONTENT / STATS (stat kind) / CHART (chart kind) / BACKDROP + direction
// note, hide the image and cover sections, and offer title size only.
// Every unique edit flows through updateSlide so undo/autosave keep working.
// Collapsed state is local; everything opens by default except REVISIONS.
// Size edits keep V1's sync-across-type behavior surfaced via a toast.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useWizard } from "../store";
import type { Slide } from "../engine/types";
import { UNIQUE_DIRECTIONS } from "../engine/unique/build";
import { renderBackdrop, hashSeed } from "../engine/unique/backdrops";
import CoverDesigner from "../components/CoverDesigner";
import ImagePicker from "../components/ImagePicker";
import { showToast } from "../../toast-context";
import { confirmDialog } from "../../dialog-context";
import { useBodyOverflow, pushOverflowToNext, shiftLastBlockToNext, splitLastBlockToNew, canShiftBlock, canOverflow, pad2 } from "./edit-overflow";
import { rewriteText } from "../engine/api";

// ═══ CONFIG ═══
type SizeField = "titleSize" | "subtitleSize" | "bodySize" | "captionSize";
type UniqueStatRow = { label: string; value: string; delta?: string; dir?: "up" | "down" | "flat" };

const TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: "cover", label: "COVER" },
  { id: "cover_image", label: "COVER IMG" },
  { id: "body", label: "BODY" },
  { id: "image_text", label: "IMG TEXT" },
  { id: "large_image", label: "LG IMAGE" },
  { id: "large_with_title", label: "LG TITLE" },
  { id: "dual_image", label: "DUAL" },
  { id: "body_dual", label: "BODY DUAL" },
];

const TYPE_LABEL: Record<string, string> = {};
TYPE_OPTIONS.forEach(function (o) { TYPE_LABEL[o.id] = o.label; });

// Unique-slide kind labels + backdrop strength per kind (engine render.ts map;
// shown as a note only, the renderer owns the actual tiering).
const KIND_LABEL: Record<string, string> = {
  cover: "COVER", stat: "STAT", chart: "CHART", quote: "QUOTE", closer: "CLOSER",
};
const KIND_STRENGTH: Record<string, string> = {
  cover: "MOTIF", stat: "AMBIENT", chart: "GRAIN", quote: "FOCAL", closer: "MOTIF",
};

// Fields each type actually renders (SlideCanvas branches).
const VISIBLE_FIELDS: Record<string, (keyof Slide)[]> = {
  cover: ["title", "subtitle", "imageUrl"],
  cover_image: ["imageUrl"],
  body: ["bodyText", "imageUrl"],
  image_text: ["bodyText", "imageUrl"],
  large_image: ["caption", "imageUrl"],
  large_with_title: ["title", "subtitle", "imageUrl"],
  dual_image: ["caption", "caption2", "imageUrl", "imageUrl2"],
  body_dual: ["bodyText", "imageUrl", "imageUrl2"],
};

const FIELD_LABEL: Record<string, string> = {
  title: "TITLE", subtitle: "SUBTITLE", bodyText: "BODY", caption: "CAPTION",
  caption2: "CAPTION 2", imageUrl: "IMAGE", imageUrl2: "IMAGE 2",
};

// Per-type imageHeight defaults (engine types.ts / V1 changeSlideType).
const DEFAULT_IMG_H: Record<string, number> = {
  cover: 46, body: 45, image_text: 50, large_image: 72, large_with_title: 60, dual_image: 40,
};

// V1 sync map (carousel.tsx:1416-1419), surfaced with a toast.
const SYNC_GROUPS: Record<SizeField, string[]> = {
  bodySize: ["body", "image_text"],
  captionSize: ["large_image", "dual_image"],
  titleSize: ["cover"],
  subtitleSize: ["cover"],
};
const SYNC_LABEL: Record<SizeField, string> = {
  bodySize: "BODY", captionSize: "CAPTION", titleSize: "COVER", subtitleSize: "COVER",
};
const DEFAULT_SIZE: Record<SizeField, number> = {
  titleSize: 74, subtitleSize: 34, bodySize: 28, captionSize: 18,
};

interface TypoRow { field: SizeField; label: string; weight: number; lh: number }

// Weight/line-height per field mirror SlideCanvas's inline styles.
// Unique slides offer title size only (spec 9.7).
const TYPO_ROWS: Record<string, TypoRow[]> = {
  cover: [
    { field: "titleSize", label: "TITLE", weight: 800, lh: 1.15 },
    { field: "subtitleSize", label: "SUBTITLE", weight: 400, lh: 1.4 },
  ],
  cover_image: [],
  body: [{ field: "bodySize", label: "BODY", weight: 400, lh: 1.55 }],
  image_text: [{ field: "bodySize", label: "BODY", weight: 400, lh: 1.5 }],
  large_image: [{ field: "captionSize", label: "CAPTION", weight: 400, lh: 1.4 }],
  large_with_title: [
    { field: "titleSize", label: "TITLE", weight: 800, lh: 1.15 },
    { field: "subtitleSize", label: "SUBTITLE", weight: 400, lh: 1.4 },
  ],
  dual_image: [{ field: "captionSize", label: "CAPTION", weight: 400, lh: 1.3 }],
  body_dual: [{ field: "bodySize", label: "BODY", weight: 400, lh: 1.5 }],
  unique: [{ field: "titleSize", label: "TITLE", weight: 800, lh: 1.0 }],
};

const CTA_PRESETS = ["Read the full model", "Full audit inside", "semianalysis.com"];

// ═══ TYPE CONVERSION (V1 changeSlideType carry-over, carousel.tsx:1437) ═══
function convertType(old: Slide, newType: string): Slide {
  const next: Slide = { ...old, type: newType };
  const allText = old.bodyText || old.title || old.caption || "";
  if (newType === "cover" || newType === "large_with_title") {
    if (!next.title) next.title = old.title || allText.split("\n")[0] || "Title";
    if (!next.subtitle) next.subtitle = old.subtitle || old.caption || old.bodyText || "";
  }
  if (newType === "body" || newType === "image_text" || newType === "body_dual") {
    if (!next.bodyText) next.bodyText = old.bodyText || old.caption || old.subtitle || allText || "Body text";
  }
  if (newType === "large_image" || newType === "dual_image") {
    if (!next.caption) next.caption = old.caption || old.subtitle || (old.bodyText || "").split("\n\n")[0] || "Caption";
  }
  if (newType === "dual_image" && !next.caption2) {
    next.caption2 = (old.bodyText || "").split("\n\n")[1] || "";
  }
  // position-derived layout defaults recomputed for the new frame
  if (DEFAULT_IMG_H[newType]) next.imageHeight = DEFAULT_IMG_H[newType];
  return next;
}

/** Old-type fields that are set, not shown by the new type, and whose value
 *  was not carried into one of the new type's visible fields. */
function computeLost(old: Slide, next: Slide, newType: string): (keyof Slide)[] {
  const oldVis = VISIBLE_FIELDS[old.type] || [];
  const newVis = VISIBLE_FIELDS[newType] || [];
  const lost: (keyof Slide)[] = [];
  oldVis.forEach(function (f) {
    const v = old[f];
    if (!v) return;
    if (newVis.indexOf(f) !== -1) return;
    const carried = newVis.some(function (g) { return next[g] === v; });
    if (!carried) lost.push(f);
  });
  return lost;
}

// ═══ STYLE OBJECTS (forged plate classes live in theme.css) ═══
const railStyle: CSSProperties = {
  width: 332, flex: "0 0 332px", minHeight: 0, overflowY: "auto",
  padding: "12px 12px 14px", alignSelf: "stretch",
};
const railInnerStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 10,
};
// stacked plate card per section (quieter than .glass: bevel catch-light only)
const secCardStyle: CSSProperties = {
  background: "linear-gradient(160deg,var(--bevel-hi),transparent 45%), rgba(25,21,20,.6)",
  border: "1px solid var(--line)", borderRadius: 14, padding: "0 13px 3px",
  margin: 0, flexShrink: 0,
};
// Register-1 control label (spec §5: mono survives only as tabular numerals)
const fieldLabelStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 9, letterSpacing: ".12em",
  color: "var(--muted)", width: 60, flex: "0 0 60px", textTransform: "uppercase",
};
// Register-1 face word ("GRIFT"); the numerals ride a nested .mono span —
// spec §5: mono survives only as tabular numerals.
const specStyle: CSSProperties = {
  flex: 1, fontFamily: "var(--body)", fontWeight: 600, fontSize: 9,
  letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const stepBtnStyle: CSSProperties = {
  width: 21, height: 21, display: "grid", placeItems: "center",
  background: "rgba(12,12,16,.6)", border: "1px solid var(--line-2)", borderRadius: 6,
  color: "var(--tx)", fontSize: 11, cursor: "pointer", padding: 0, flexShrink: 0,
};
const numInputStyle: CSSProperties = {
  width: 46, background: "rgba(12,12,16,.6)", border: "1px solid var(--line-2)",
  borderRadius: 6, color: "var(--tx)", fontSize: 11, padding: "3px 4px",
  textAlign: "center", flexShrink: 0,
};
// compact .btn: Register 1 rides in from the class, only the scale shrinks
const smallBtnStyle: CSSProperties = {
  padding: "6px 12px", fontSize: 9.5, borderRadius: 8,
};
const histRowStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "1px", color: "var(--muted)",
};
const segFullStyle: CSSProperties = { display: "flex", width: "100%" };
const typeBtnStyle: CSSProperties = {
  flex: 1, textAlign: "center", padding: "8px 2px", fontSize: 9, letterSpacing: ".6px",
};
const thumbStyle: CSSProperties = {
  width: 56, height: 70, objectFit: "cover", borderRadius: 8,
  border: "1px solid var(--line-2)", flexShrink: 0,
};
const noThumbStyle: CSSProperties = {
  width: 56, height: 70, borderRadius: 8, border: "1px dashed var(--line-2)",
  color: "var(--dim)", display: "grid", placeItems: "center", flexShrink: 0,
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 8, letterSpacing: ".12em",
};
const uniqueInputStyle: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 12, padding: "8px 10px", borderRadius: 8,
};
const statCellStyle: CSSProperties = {
  ...uniqueInputStyle, flex: 1, minWidth: 0,
};
const statRemoveStyle: CSSProperties = {
  width: 21, height: 21, alignSelf: "center", flexShrink: 0, borderRadius: "50%",
  border: "1px solid var(--line-2)", background: "rgba(12,12,16,.6)",
  color: "var(--coral)", fontSize: 11, lineHeight: 1, cursor: "pointer", padding: 0,
  display: "grid", placeItems: "center",
};
const statRowCardStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, padding: "9px 9px 8px",
  border: "1px solid var(--line)", borderRadius: 10, background: "rgba(12,12,16,.45)",
};
const swatchLabelStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 8, letterSpacing: ".12em",
  color: "var(--muted)", textAlign: "center", textTransform: "uppercase",
};

// ═══ SMALL PIECES ═══
function Sec({ id, label, extra, open, onToggle, children }: {
  id: string; label: string; extra?: string; open: boolean;
  onToggle: (id: string) => void; children: ReactNode;
}) {
  return (
    <div className="insp-sec" style={secCardStyle}>
      <button type="button" className="insp-head" onClick={function () { onToggle(id); }}>
        <span>{label}</span>
        <span style={{ color: "var(--dim)", letterSpacing: 0 }}>{open ? "▾" : "▸"}</span>
        {extra ? <b style={{ color: "var(--amber)", fontWeight: 500 }}>{extra}</b> : null}
      </button>
      {open ? <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 10 }}>{children}</div> : null}
    </div>
  );
}

function MiniSeg({ options, value, onPick, compact }: { options: string[]; value: string; onPick: (v: string) => void; compact?: boolean }) {
  return (
    <div className="seg">
      {options.map(function (o) {
        return (
          <button
            key={o}
            type="button"
            className={o === value ? "on" : ""}
            style={compact ? { fontSize: 8.5, padding: "6px 7px" } : { fontSize: 9, padding: "6px 10px" }}
            onClick={function () { onPick(o); }}
          >{o}</button>
        );
      })}
    </div>
  );
}

function LabeledRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

/** One typography spec row: "GRIFT" in Register 1 with mono numerals
 *  ("800 · 74 · 1.15"), steppers (click ±1, shift-click ±4) and a direct
 *  numeric input. 1080-space. */
function SpecRow({ label, weight, lh, value, onCommit }: {
  label: string; weight: number; lh: number; value: number; onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(function () { setDraft(String(value)); }, [value]);
  function commitDraft() {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setDraft(String(value));
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={fieldLabelStyle}>{label}</span>
      <span style={specStyle}>
        GRIFT <span className="mono">{weight} · {value} · {lh.toFixed(2)}</span>
      </span>
      <button
        type="button" style={stepBtnStyle} title="MINUS 1 · SHIFT MINUS 4"
        onClick={function (e) { onCommit(value - (e.shiftKey ? 4 : 1)); }}
      >{"−"}</button>
      <input
        className="mono"
        type="number"
        value={draft}
        onChange={function (e) { setDraft(e.target.value); }}
        onBlur={commitDraft}
        onKeyDown={function (e) { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        style={numInputStyle}
      />
      <button
        type="button" style={stepBtnStyle} title="PLUS 1 · SHIFT PLUS 4"
        onClick={function (e) { onCommit(value + (e.shiftKey ? 4 : 1)); }}
      >+</button>
    </div>
  );
}

/** Generative backdrop swatch: the real engine fragment in a mini 4:5 SVG.
 *  Seed differs per swatch id so inline defs ids never collide with the
 *  canvas SVG (the canvas derives its seed from the slide id alone). */
function BackdropSwatch({ id, accent, seedKey, selected, onPick }: {
  id: string; accent: string; seedKey: string; selected: boolean; onPick: () => void;
}) {
  const svg = useMemo(function () {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display:block">' +
      '<rect width="1080" height="1350" fill="#06070C"/>' +
      renderBackdrop(id, hashSeed(seedKey + ":" + id + ":swatch"), "motif", accent) +
      "</svg>"
    );
  }, [id, accent, seedKey]);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      title={id.toUpperCase()}
      className={"swatch" + (selected ? " selected" : "")}
      style={{ aspectRatio: "4 / 5", width: "100%" }}
      onClick={onPick}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ═══ INSPECTOR ═══
export function EditInspector() {
  const slides = useWizard(function (s) { return s.slides; });
  const activeIdx = useWizard(function (s) { return s.activeIdx; });
  const updateSlide = useWizard(function (s) { return s.updateSlide; });
  const setSlides = useWizard(function (s) { return s.setSlides; });
  const pushUndo = useWizard(function (s) { return s.pushUndo; });
  const undo = useWizard(function (s) { return s.undo; });
  const undoDepth = useWizard(function (s) { return s.undoStack.length; });
  const category = useWizard(function (s) { return s.category; });
  const sourceText = useWizard(function (s) { return s.text; });
  const draftSavedAt = useWizard(function (s) { return s.draftSavedAt; });

  const active: Slide | undefined = slides[activeIdx];
  const overflow = useBodyOverflow(active);
  const [pickerField, setPickerField] = useState<"imageUrl" | "imageUrl2" | null>(null);
  const [tightenBusy, setTightenBusy] = useState(false);
  const [openSecs, setOpenSecs] = useState<Record<string, boolean>>({
    type: true, layout: true, typo: true, images: true, cover: true, cta: true,
    overflow: true, revisions: false,
    ucontent: true, ustats: true, uchart: true, ubackdrop: true,
  });
  function toggleSec(id: string) {
    setOpenSecs(function (s) { return { ...s, [id]: !s[id] }; });
  }

  // one-shot deep link from publish preflight: open the named section, clear
  const inspectorFocus = useWizard(function (s) { return s.inspectorFocus; });
  const setInspectorFocus = useWizard(function (s) { return s.setInspectorFocus; });
  useEffect(
    function () {
      if (!inspectorFocus) return;
      setOpenSecs(function (s) { return { ...s, [inspectorFocus]: true }; });
      setInspectorFocus(null);
    },
    [inspectorFocus, setInspectorFocus]
  );

  if (!active) {
    return (
      <aside className="glass" style={railStyle}>
        <div className="whisper" style={{ padding: "18px 4px" }}>No slide selected.</div>
      </aside>
    );
  }

  function patchActive(p: Partial<Slide>) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (sl) st.updateSlide(st.activeIdx, { ...sl, ...p });
  }

  // AI quick action: shorten the body ~20% without losing facts or voice.
  // Undo snapshot BEFORE the patch, same as every destructive op.
  async function tightenBody() {
    const curr = ((active && active.bodyText) || "").trim();
    if (!curr) { showToast("Nothing to tighten yet.", "error"); return; }
    setTightenBusy(true);
    try {
      const text = await rewriteText({
        text: curr,
        direction: "shorten",
        targetLength: "about 20 percent shorter; keep every fact, number, and the author's voice",
      });
      useWizard.getState().pushUndo();
      patchActive({ bodyText: text });
      showToast("BODY TIGHTENED · " + "⌘" + "Z TO UNDO");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Rewrite failed.", "error");
    }
    setTightenBusy(false);
  }

  function setImage(field: "imageUrl" | "imageUrl2", url: string) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    const prev = field === "imageUrl2" ? sl?.imageUrl2 : sl?.imageUrl;
    // Discrete commit: snapshot only when the url actually changes or clears.
    if (url !== (prev || "")) pushUndo();
    const p: Partial<Slide> = field === "imageUrl2" ? { imageUrl2: url } : { imageUrl: url };
    // V1 commitImage parity (carousel.tsx:1310): a newly placed image starts
    // from cover/center. Clearing or re-picking the same url keeps fit/pos.
    if (url && url !== prev) {
      p.imageFit = "cover";
      if (field === "imageUrl2") p.imagePosition2 = "center";
      else p.imagePosition = "center";
    }
    patchActive(p);
  }

  // Same reuse guard as EditStation.pickImage: confirm only when the url
  // lives on a DIFFERENT slide; this slide's other slot never prompts.
  async function pickFromPicker(field: "imageUrl" | "imageUrl2", url: string) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl || !url) return;
    if (url === (field === "imageUrl2" ? sl.imageUrl2 : sl.imageUrl)) return;
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
    setImage(field, url);
  }

  function setImagePos(field: "imageUrl" | "imageUrl2", pos: string) {
    patchActive(field === "imageUrl2" ? { imagePosition2: pos } : { imagePosition: pos });
  }

  // V1 Auto reset (carousel.tsx:1674). Height map matches apiSlidesToEditorSlides,
  // NOT DEFAULT_IMG_H — large_with_title/dual_image reset to 45 on purpose.
  function autoResetImage() {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    pushUndo();
    const p: Partial<Slide> = {
      imageFit: "cover",
      imagePosition: "center",
      imageHeight: sl.type === "cover" ? 46 : sl.type === "image_text" ? 50 : sl.type === "large_image" ? 72 : 45,
    };
    if (sl.type === "dual_image" || sl.type === "body_dual") p.imagePosition2 = "center";
    patchActive(p);
  }

  // ── SLIDE TYPE: confirm when set fields stop rendering; then drop them ──
  async function changeType(newType: string) {
    const sl = active as Slide;
    if (newType === sl.type) return;
    const converted = convertType(sl, newType);
    const lost = computeLost(sl, converted, newType);
    if (lost.length > 0) {
      const names = lost.map(function (f) { return FIELD_LABEL[f] || String(f); }).join(", ");
      const ok = await confirmDialog({
        title: "Change slide type?",
        body: TYPE_LABEL[newType] + " does not show " + names + ". Those fields are dropped. Cmd+Z restores them.",
        cta: "Change type",
        variant: "danger",
      });
      if (!ok) return;
    }
    pushUndo();
    const cleaned: Slide = { ...converted };
    lost.forEach(function (f) {
      (cleaned as unknown as Record<string, unknown>)[f] = "";
    });
    updateSlide(activeIdx, cleaned);
  }

  // ── TYPOGRAPHY: apply + V1 sync map, surfaced via toast ──
  function commitSize(field: SizeField, raw: number) {
    const n = Math.max(8, Math.min(200, Math.round(raw)));
    const st = useWizard.getState();
    const group = SYNC_GROUPS[field];
    let synced = 0;
    let changed = 0;
    const next = st.slides.map(function (s, i) {
      const isActiveSlide = i === st.activeIdx;
      const inGroup = group.indexOf(s.type) !== -1;
      if (!isActiveSlide && !inGroup) return s;
      if ((s[field] || DEFAULT_SIZE[field]) === n) return s;
      if (!isActiveSlide) synced++;
      changed++;
      const copy = { ...s };
      copy[field] = n;
      return copy;
    });
    if (changed === 0) return;
    pushUndo();
    setSlides(next);
    if (synced > 0) {
      showToast("SIZE SYNCED ACROSS " + (synced + 1) + " " + SYNC_LABEL[field] + " SLIDES");
    }
  }

  // ── UNIQUE editors: every change rides updateSlide (undo/autosave safe) ──
  function patchStats(mutate: (list: UniqueStatRow[]) => UniqueStatRow[]) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    st.updateSlide(st.activeIdx, { ...sl, uniqueStats: mutate((sl.uniqueStats || []).slice()) });
  }
  function setStat(idx: number, p: Partial<UniqueStatRow>) {
    patchStats(function (list) {
      if (list[idx]) list[idx] = { ...list[idx], ...p };
      return list;
    });
  }
  function addStat() {
    pushUndo();
    patchStats(function (list) {
      if (list.length < 3) list.push({ label: "", value: "" });
      return list;
    });
  }
  function removeStat(idx: number) {
    pushUndo();
    patchStats(function (list) {
      return list.filter(function (_, i) { return i !== idx; });
    });
  }
  function patchChart(p: Partial<{ label: string; unit?: string; points: number[]; xLabels: string[] }>) {
    const st = useWizard.getState();
    const sl = st.slides[st.activeIdx];
    if (!sl) return;
    const base = sl.uniqueChart || { label: "", points: [], xLabels: [] };
    st.updateSlide(st.activeIdx, { ...sl, uniqueChart: { ...base, ...p } });
  }
  function commitPoints(raw: string) {
    const points = raw.split(",")
      .map(function (s) { return parseFloat(s.trim()); })
      .filter(function (n) { return Number.isFinite(n); });
    patchChart({ points: points });
  }
  function commitXLabels(raw: string) {
    const xLabels = raw.split(",")
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
    patchChart({ xLabels: xLabels });
  }

  // ── derived view state ──
  const isUnique = active.type === "unique";
  const uKind = active.uniqueKind || "stat";
  const uDir = UNIQUE_DIRECTIONS.filter(function (d) { return d.key === (active.uniqueDirection || "E"); })[0] || UNIQUE_DIRECTIONS[0];
  const uStats = active.uniqueStats || [];
  const uChart = active.uniqueChart;
  const isDual = active.type === "dual_image" || active.type === "body_dual";
  const isTplCover = active.type === "cover" && !!active.coverTemplate;
  // Anchor + top margin only steer the legacy cover branch (SlideCanvas:128).
  const isLegacyCover = active.type === "cover" && !active.coverTemplate;
  // V1 gate (carousel.tsx:1584): invert needs an image-led frame off slide 01.
  const canInvert = active.position !== 1 &&
    ["body", "image_text", "large_image", "large_with_title", "body_dual"].indexOf(active.type) !== -1 &&
    (active.type !== "body" || !!active.imageUrl);
  const anchorVal = (active.titleAnchor || "top").toUpperCase();
  const marginVal = active.titleMarginTop ?? 80;
  const usesHeight = !isDual && active.type !== "cover_image" && !isTplCover;
  const heightVal = active.imageHeight || DEFAULT_IMG_H[active.type] || 45;
  const typoRows = TYPO_ROWS[active.type] || [];
  const isCoverSlot = active.position === 1;
  const isCloser = !isUnique && active.position === 4;
  const rev = String.fromCharCode(65 + Math.min(undoDepth, 25));
  const savedLabel = draftSavedAt == null
    ? "PENDING"
    : new Date(draftSavedAt).toLocaleTimeString("en-GB", { hour12: false });

  function typeBtn(opt: { id: string; label: string }) {
    const allowed = (opt.id.indexOf("cover") === 0) === isCoverSlot;
    const on = active && active.type === opt.id;
    return (
      <button
        key={opt.id}
        type="button"
        className={on ? "on" : ""}
        disabled={!allowed}
        title={allowed ? opt.label : "LOCKED BY POSITION"}
        style={{ ...typeBtnStyle, opacity: allowed ? 1 : 0.35, cursor: allowed ? "pointer" : "not-allowed" }}
        onClick={function () { changeType(opt.id); }}
      >{opt.label}</button>
    );
  }

  function imageBlock(field: "imageUrl" | "imageUrl2", label: string) {
    const url = field === "imageUrl2" ? active!.imageUrl2 : active!.imageUrl;
    const pos = (field === "imageUrl2" ? active!.imagePosition2 : active!.imagePosition) || "center";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} style={thumbStyle} />
          ) : (
            <div style={noThumbStyle}>NONE</div>
          )}
          <button type="button" className="btn btn-ghost" style={smallBtnStyle} onClick={function () { setPickerField(field); }}>
            CHANGE
          </button>
          {url ? (
            <button type="button" className="btn btn-ghost" style={smallBtnStyle} onClick={function () { setImage(field, ""); }}>
              REMOVE
            </button>
          ) : null}
        </div>
        {!isTplCover && (
          <LabeledRow label={label + " POS"}>
            <MiniSeg
              options={["TOP", "CENTER", "BOTTOM"]}
              value={pos.toUpperCase()}
              onPick={function (v) { setImagePos(field, v.toLowerCase()); }}
            />
          </LabeledRow>
        )}
      </div>
    );
  }

  // ── shared TYPOGRAPHY card (unique offers title size only, spec 9.7) ──
  const typoSec = (
    <Sec id="typo" label="TYPOGRAPHY" extra={typoRows.length ? typoRows.length + (typoRows.length === 1 ? " FIELD" : " FIELDS") : undefined} open={!!openSecs.typo} onToggle={toggleSec}>
      {isTplCover ? (
        <span className="whisper">Template cover type scales in the Cover section.</span>
      ) : typoRows.length === 0 ? (
        <span className="whisper">No text fields on this type.</span>
      ) : (
        <>
          {typoRows.map(function (r) {
            return (
              <SpecRow
                key={r.field}
                label={r.label}
                weight={r.weight}
                lh={r.lh}
                value={(active![r.field] as number) || DEFAULT_SIZE[r.field]}
                onCommit={function (n) { commitSize(r.field, n); }}
              />
            );
          })}
          <span className="whisper">Sizes in 1080 space. Shift-click steps 4.</span>
        </>
      )}
    </Sec>
  );

  return (
    <>
      <aside className="glass" style={railStyle}>
        <div className="rise d4" style={railInnerStyle}>
          {isUnique ? (
            <>
              {/* ═══ U1 · CONTENT (kicker · headline · accent word · body · cta) ═══ */}
              <Sec id="ucontent" label="CONTENT" extra={KIND_LABEL[uKind]} open={!!openSecs.ucontent} onToggle={toggleSec}>
                <div className="field">
                  <label>KICKER</label>
                  <input
                    className="input mono"
                    style={uniqueInputStyle}
                    value={active.uniqueKicker || ""}
                    placeholder="Mono kicker line"
                    onChange={function (e) { patchActive({ uniqueKicker: e.target.value }); }}
                  />
                </div>
                <div className="field">
                  <label>HEADLINE</label>
                  <textarea
                    className="input"
                    rows={2}
                    style={{ minHeight: 56 }}
                    value={active.title || ""}
                    placeholder="Display headline"
                    onChange={function (e) { patchActive({ title: e.target.value }); }}
                  />
                </div>
                <div className="field">
                  <label>ACCENT WORD</label>
                  <input
                    className="input mono"
                    style={uniqueInputStyle}
                    value={active.uniqueAccentWord || ""}
                    placeholder="One word from the headline"
                    onChange={function (e) { patchActive({ uniqueAccentWord: e.target.value }); }}
                  />
                </div>
                <span className="whisper">First match in the headline takes the accent.</span>
                <div className="field">
                  <label>BODY</label>
                  <textarea
                    className="input"
                    rows={3}
                    style={{ minHeight: 72 }}
                    value={active.bodyText || ""}
                    placeholder="Two lines max on canvas"
                    onChange={function (e) { patchActive({ bodyText: e.target.value }); }}
                  />
                </div>
                <div className="field">
                  <label>CTA</label>
                  <input
                    className="input"
                    style={uniqueInputStyle}
                    value={active.ctaText || ""}
                    placeholder="Closer call to action"
                    onChange={function (e) { patchActive({ ctaText: e.target.value }); }}
                  />
                </div>
                {uKind !== "closer" ? <span className="whisper">CTA renders on the closer slide.</span> : null}
              </Sec>

              {/* ═══ U2 · STATS (stat kind · label/value/delta/dir · max 3) ═══ */}
              {uKind === "stat" ? (
                <Sec id="ustats" label="STATS" extra={uStats.length + " / 3"} open={!!openSecs.ustats} onToggle={toggleSec}>
                  {uStats.length === 0 ? (
                    <span className="whisper">No stats · renders as a statement slide.</span>
                  ) : null}
                  {uStats.map(function (stt, si) {
                    return (
                      <div key={si} style={statRowCardStyle}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            className="input"
                            style={statCellStyle}
                            value={stt.label}
                            placeholder="LABEL"
                            onChange={function (e) { setStat(si, { label: e.target.value }); }}
                          />
                          <input
                            className="input"
                            style={{ ...statCellStyle, flex: "0 0 92px" }}
                            value={stt.value}
                            placeholder="VALUE"
                            onChange={function (e) { setStat(si, { value: e.target.value }); }}
                          />
                          <button type="button" title="Remove stat" style={statRemoveStyle} onClick={function () { removeStat(si); }}>{"×"}</button>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                          <input
                            className="input"
                            style={{ ...statCellStyle, flex: "0 0 92px" }}
                            value={stt.delta || ""}
                            placeholder="DELTA"
                            onChange={function (e) { setStat(si, { delta: e.target.value }); }}
                          />
                          <MiniSeg
                            options={["UP", "DOWN", "FLAT"]}
                            value={(stt.dir || "flat").toUpperCase()}
                            onPick={function (v) { setStat(si, { dir: v.toLowerCase() as "up" | "down" | "flat" }); }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={uStats.length >= 3}
                    style={{ ...smallBtnStyle, alignSelf: "flex-start", opacity: uStats.length >= 3 ? 0.4 : 1 }}
                    onClick={addStat}
                  >ADD STAT</button>
                  <span className="whisper">Values come from your source · deltas color mint up, coral down.</span>
                </Sec>
              ) : null}

              {/* ═══ U3 · CHART (chart kind · label/unit/points/x labels) ═══ */}
              {uKind === "chart" ? (
                <Sec id="uchart" label="CHART" extra={uChart && uChart.points.length ? uChart.points.length + " PTS" : undefined} open={!!openSecs.uchart} onToggle={toggleSec}>
                  <div className="field">
                    <label>LABEL</label>
                    <input
                      className="input"
                      style={uniqueInputStyle}
                      value={(uChart && uChart.label) || ""}
                      placeholder="What the line measures"
                      onChange={function (e) { patchChart({ label: e.target.value }); }}
                    />
                  </div>
                  <div className="field">
                    <label>UNIT</label>
                    <input
                      className="input mono"
                      style={uniqueInputStyle}
                      value={(uChart && uChart.unit) || ""}
                      placeholder="GW, $B, tokens/s"
                      onChange={function (e) { patchChart({ unit: e.target.value }); }}
                    />
                  </div>
                  <div className="field">
                    <label>POINTS</label>
                    <input
                      key={String(active.id) + ":pts"}
                      className="input mono"
                      style={uniqueInputStyle}
                      defaultValue={(uChart ? uChart.points : []).join(", ")}
                      placeholder="12, 18, 27, 41"
                      onBlur={function (e) { commitPoints(e.target.value); }}
                      onKeyDown={function (e) { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  </div>
                  <div className="field">
                    <label>X LABELS</label>
                    <input
                      key={String(active.id) + ":xl"}
                      className="input mono"
                      style={uniqueInputStyle}
                      defaultValue={(uChart ? uChart.xLabels : []).join(", ")}
                      placeholder="Q1, Q2, Q3, Q4"
                      onBlur={function (e) { commitXLabels(e.target.value); }}
                      onKeyDown={function (e) { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  </div>
                  <span className="whisper">Comma separated · commits on blur or Enter.</span>
                </Sec>
              ) : null}

              {/* ═══ U4 · BACKDROP (direction's 3 generative variants) ═══ */}
              <Sec id="ubackdrop" label="BACKDROP" extra={(active.uniqueBackdrop || uDir.backdrops[0]).toUpperCase()} open={!!openSecs.ubackdrop} onToggle={toggleSec}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {uDir.backdrops.map(function (bid) {
                    return (
                      <div key={bid} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                        <BackdropSwatch
                          id={bid}
                          accent={uDir.accent}
                          seedKey={String(active.id)}
                          selected={(active.uniqueBackdrop || uDir.backdrops[0]) === bid}
                          onPick={function () {
                            if (active.uniqueBackdrop === bid) return;
                            pushUndo();
                            patchActive({ uniqueBackdrop: bid });
                          }}
                        />
                        <span style={swatchLabelStyle}>{bid}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="whisper">Strength · {KIND_STRENGTH[uKind] || "AMBIENT"} · set by the slide kind.</span>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--body)", fontWeight: 600, fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: uDir.accent, boxShadow: "0 0 8px " + uDir.accent, flexShrink: 0 }} />
                  DIRECTION · {uDir.name} · ACCENT LOCKED
                </div>
              </Sec>

              {typoSec}
            </>
          ) : (
            <>
              {/* ═══ 1 · SLIDE TYPE ═══ */}
              <Sec id="type" label="SLIDE TYPE" extra={TYPE_LABEL[active.type]} open={!!openSecs.type} onToggle={toggleSec}>
                <div className="seg" style={segFullStyle}>{TYPE_OPTIONS.slice(0, 4).map(typeBtn)}</div>
                <div className="seg" style={segFullStyle}>{TYPE_OPTIONS.slice(4).map(typeBtn)}</div>
                <span className="whisper">Cover frames lock to slide 01 · this is position {pad2(active.position)}.</span>
              </Sec>

              {/* ═══ 1b · LAYOUT (anchor · top margin · invert) ═══ */}
              {isLegacyCover || canInvert ? (
                <Sec id="layout" label="LAYOUT" extra={active.inverted ? "INVERTED" : undefined} open={!!openSecs.layout} onToggle={toggleSec}>
                  {isLegacyCover ? (
                    <LabeledRow label="ANCHOR">
                      <MiniSeg
                        options={["TOP", "CENTER"]}
                        value={anchorVal}
                        onPick={function (v) { patchActive({ titleAnchor: v.toLowerCase() as "top" | "center" }); }}
                      />
                    </LabeledRow>
                  ) : null}
                  {isLegacyCover ? (
                    <div style={{ opacity: anchorVal === "TOP" ? 1 : 0.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={fieldLabelStyle}>TOP MARGIN</span>
                        <span className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>{marginVal}PX</span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={200}
                        value={marginVal}
                        onPointerDown={pushUndo}
                        onChange={function (e) { patchActive({ titleMarginTop: parseInt(e.target.value, 10), titleAnchor: "top" }); }}
                        style={{ width: "100%", accentColor: "var(--cobalt)" }}
                      />
                      {anchorVal !== "TOP" ? <span className="whisper">Drag re-anchors the title to top.</span> : null}
                    </div>
                  ) : null}
                  {canInvert ? (
                    <LabeledRow label="INVERT">
                      <MiniSeg
                        options={["OFF", "ON"]}
                        value={active.inverted ? "ON" : "OFF"}
                        onPick={function (v) {
                          const inv = v === "ON";
                          if (inv === !!active!.inverted) return;
                          pushUndo();
                          patchActive({ inverted: inv });
                        }}
                      />
                    </LabeledRow>
                  ) : null}
                </Sec>
              ) : null}

              {/* ═══ 2 · TYPOGRAPHY ═══ */}
              {typoSec}

              {/* ═══ 3 · IMAGES · B-ROLL ═══ */}
              <Sec id="images" label="IMAGES · B-ROLL" extra={isDual ? "2 FRAMES" : undefined} open={!!openSecs.images} onToggle={toggleSec}>
                {imageBlock("imageUrl", isDual ? "IMAGE 1" : "IMAGE")}
                {isDual ? imageBlock("imageUrl2", "IMAGE 2") : null}
                {!isTplCover && active.type !== "cover_image" ? (
                  <LabeledRow label="FIT">
                    {/* compact + nowrap: at 332px rail minus the 60px label this
                        group is ~215px wide; regular sizing wrapped AUTO onto
                        its own orphan row. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap", justifyContent: "flex-end" }}>
                      <MiniSeg
                        compact
                        options={["COVER", "CONTAIN", "FILL"]}
                        value={(active.imageFit || "cover").toUpperCase()}
                        onPick={function (v) {
                          const fit = v.toLowerCase();
                          if (fit === (active!.imageFit || "cover")) return;
                          pushUndo();
                          patchActive({ imageFit: fit });
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="RESET FIT · POSITION · HEIGHT"
                        style={{ ...smallBtnStyle, padding: "6px 7px", fontSize: 8.5 }}
                        onClick={autoResetImage}
                      >AUTO</button>
                    </div>
                  </LabeledRow>
                ) : null}
                {usesHeight ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={fieldLabelStyle}>IMG HEIGHT</span>
                      <span className="mono" style={{ fontSize: 9, color: "var(--muted)" }}>{heightVal}%</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={85}
                      value={heightVal}
                      onPointerDown={pushUndo}
                      onChange={function (e) { patchActive({ imageHeight: parseInt(e.target.value, 10) }); }}
                      style={{ width: "100%", accentColor: "var(--cobalt)" }}
                    />
                  </div>
                ) : null}
                {isTplCover ? <span className="whisper">Template covers place the image inside the SVG plate.</span> : null}
              </Sec>

              {/* ═══ 4 · COVER (slide 01, cover type only; AI mode included) ═══ */}
              {activeIdx === 0 && active.type === "cover" ? (
                <Sec id="cover" label="COVER" extra="6 SVG PLATES" open={!!openSecs.cover} onToggle={toggleSec}>
                  <CoverDesigner
                    compact
                    slide={active}
                    onChange={function (p) { patchActive(p); }}
                    theme={category}
                    sourceText={sourceText}
                  />
                </Sec>
              ) : null}

              {/* ═══ 5 · CTA · CLOSER (closer slide only) ═══ */}
              {isCloser ? (
                <Sec id="cta" label="CTA · CLOSER" extra={active.ctaText ? "ON" : undefined} open={!!openSecs.cta} onToggle={toggleSec}>
                  <input
                    className="input"
                    value={active.ctaText || ""}
                    placeholder="Call to action line"
                    onChange={function (e) { patchActive({ ctaText: e.target.value }); }}
                  />
                  <LabeledRow label="POSITION">
                    <MiniSeg
                      options={["RIGHT", "CENTER"]}
                      value={active.ctaPosition === "bottom-center" ? "CENTER" : "RIGHT"}
                      onPick={function (v) { patchActive({ ctaPosition: v === "CENTER" ? "bottom-center" : "bottom-right" }); }}
                    />
                  </LabeledRow>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CTA_PRESETS.map(function (p) {
                      const on = active!.ctaText === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          className="chip"
                          style={{
                            cursor: "pointer",
                            background: on ? "var(--cobalt-wash)" : "transparent",
                            borderColor: on ? "var(--cobalt-line)" : undefined,
                            color: on ? "var(--blue-300)" : undefined,
                          }}
                          onClick={function () {
                            if (on) return;
                            pushUndo();
                            patchActive({ ctaText: p });
                          }}
                        >{p.toUpperCase()}</button>
                      );
                    })}
                  </div>
                </Sec>
              ) : null}
            </>
          )}
          {/* ═══ 6 · OVERFLOW ═══ */}
          <Sec id="overflow" label="TEXT FLOW" extra={overflow.overflowing ? "CLIPPING" : undefined} open={!!openSecs.overflow} onToggle={toggleSec}>
            {canOverflow(active) ? (
              <>
                <div className="mono" style={{ fontSize: 10, letterSpacing: "1.4px", color: overflow.overflowing ? "var(--coral)" : "var(--mint)" }}>
                  {overflow.overflowing
                    ? "OVER BY ~" + overflow.words + " WORDS · " + overflow.lines + (overflow.lines === 1 ? " LINE" : " LINES")
                    : "FITS · NO CLIP DETECTED"}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!overflow.overflowing}
                  style={{ ...smallBtnStyle, opacity: overflow.overflowing ? 1 : 0.4, alignSelf: "flex-start" }}
                  onClick={function () { pushOverflowToNext(overflow.words); }}
                >
                  PUSH OVERFLOW {"→"} SLIDE {pad2(activeIdx + 2)}
                </button>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!canShiftBlock(active)}
                    style={{ ...smallBtnStyle, opacity: canShiftBlock(active) ? 1 : 0.4 }}
                    title="Move the last paragraph (or sentence) onto the next page"
                    onClick={function () { shiftLastBlockToNext(); }}
                  >
                    SHIFT LAST {"¶"} {"→"} NEXT
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!canShiftBlock(active)}
                    style={{ ...smallBtnStyle, opacity: canShiftBlock(active) ? 1 : 0.4 }}
                    title="Break the last paragraph (or sentence) out into a new page"
                    onClick={function () { splitLastBlockToNew(); }}
                  >
                    SPLIT {"→"} NEW PAGE
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={tightenBusy || !(active.bodyText || "").trim()}
                    style={{ ...smallBtnStyle, opacity: tightenBusy || !(active.bodyText || "").trim() ? 0.4 : 1 }}
                    title="AI rewrite: ~20% shorter, facts and voice intact"
                    onClick={function () { void tightenBody(); }}
                  >
                    {tightenBusy ? "TIGHTENING..." : "TIGHTEN BODY · AI"}
                  </button>
                </div>
                <span className="whisper">
                  {"⌘"}/Ctrl+Enter in the canvas body splits the page at the cursor.
                </span>
              </>
            ) : (
              <span className="whisper">Text flow works on BODY and IMG TEXT slides.</span>
            )}
          </Sec>

          {/* ═══ 7 · REVISIONS (collapsed by default) ═══ */}
          <Sec id="revisions" label="REVISIONS" extra="AUTOSAVE" open={!!openSecs.revisions} onToggle={toggleSec}>
            <div style={histRowStyle}>
              AUTOSAVE · <b style={{ color: "var(--tx)", fontWeight: 500 }}>{savedLabel}</b>
            </div>
            <div style={{ ...histRowStyle, color: "var(--amber)" }}>
              REV {rev} · {undoDepth} {undoDepth === 1 ? "STEP" : "STEPS"} HELD
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={undoDepth === 0}
              style={{ ...smallBtnStyle, opacity: undoDepth === 0 ? 0.4 : 1, alignSelf: "flex-start" }}
              onClick={function () { undo(); }}
            >
              UNDO
              <span className="kbd">{"⌘"}Z</span>
            </button>
          </Sec>
        </div>
      </aside>

      {/* ═══ INSPECTOR IMAGE PICKER (sibling of the plate rail: fixed-position
           modal must not sit under a filtered/transformed containing block) ═══ */}
      {pickerField !== null ? (
        <ImagePicker
          open
          onClose={function () { setPickerField(null); }}
          onPick={function (url) { if (pickerField) void pickFromPicker(pickerField, url); }}
          theme={category}
          context={(active.bodyText || active.subtitle || active.title || "").slice(0, 300)}
        />
      ) : null}
    </>
  );
}
