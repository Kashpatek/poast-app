"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ImagePicker — THE unified image picker modal (ARCHITECTURE.md "Shared
// components"). Three tabs:
//   LIBRARY  — shared B-roll assets (broll-master row via engine/api),
//              search + category filter chips, click a thumb to pick.
//   UPLOAD   — drag-drop zone + file input; FileReader → data URL → onPick;
//              also appended into the shared library (fire-and-forget).
//   GENERATE — editable prompt (seeded from suggestedPrompt/context), style
//              preset chips appended to the prompt, Imagen|Grok provider seg
//              persisted at localStorage "poast-image-provider", 3 parallel
//              variants via engine generateImage (Promise.allSettled) with
//              per-slot spinner/error and an italic fellBackTo note.
// Replaces V1's two inconsistent pickers. Escape closes THIS modal only
// (capture listener + stopPropagation) and document.body.dataset.modalOpen
// is set while open so the shell's ESC-home shortcut stands down.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BRollImageAsset, ThemeKey } from "../engine/types";
import { generateImage, loadBrollAssets, saveBrollAssets } from "../engine/api";
import { useWizard } from "../store";
import { showToast } from "../../toast-context";

export interface ImagePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  theme: ThemeKey;
  context?: string;         // slide/body text used to seed the generate prompt
  suggestedPrompt?: string; // takes priority over context for the seed
}

type Tab = "library" | "upload" | "generate";

type GenSlot =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "done"; url: string }
  | { status: "error"; message: string };

const TABS: Tab[] = ["library", "upload", "generate"];

const STYLE_PRESETS: { label: string; suffix: string }[] = [
  { label: "PHOTOREAL", suffix: "photorealistic, natural light, shallow depth of field" },
  { label: "ISOMETRIC TECH", suffix: "isometric technical illustration, precise linework, dark industrial palette" },
  { label: "ABSTRACT DATA", suffix: "abstract data visualization, glowing nodes and traces on a dark field" },
  { label: "EDITORIAL", suffix: "bold editorial illustration, graphic composition, high contrast" },
];

const EMPTY_SLOTS: GenSlot[] = [{ status: "empty" }, { status: "empty" }, { status: "empty" }];

function freshId(): string {
  return "broll-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// Fire-and-forget append into the shared broll-master row. Always loads the
// FULL asset list first (never the image-filtered view) so non-image assets
// in the shared row survive the round trip (see api.ts note).
function persistToLibrary(url: string, meta: { filename?: string; description?: string; category?: string }): void {
  loadBrollAssets()
    .then(function (all) {
      const asset: BRollImageAsset = {
        id: freshId(),
        type: "image",
        url: url,
        filename: meta.filename,
        description: meta.description,
        category: meta.category,
      };
      return saveBrollAssets(all.concat([asset]));
    })
    .then(function () {
      showToast("Saved to B-roll library.", "success");
    })
    .catch(function (e) {
      showToast("B-roll save failed: " + (e instanceof Error ? e.message : String(e)), "error");
    });
}

// ── Small dynamic-style objects layered over theme.css (.input, .chip,
//    .glass--tile, .tab-row); only per-usage overrides live here. Labels
//    speak Register 1 (Outfit 600 caps) or Register 2 (italic whisper);
//    mono survives only in the .kbd chip (theme.css). ──
const thumbBtnStyle: CSSProperties = {
  background: "rgba(12,12,16,.6)", border: "1px solid var(--line-2)", borderRadius: 12,
  padding: 0, overflow: "hidden", cursor: "pointer", textAlign: "left",
  display: "block", width: "100%",
};
const thumbLabelStyle: CSSProperties = {
  display: "block", padding: "6px 9px", fontFamily: "var(--body)", fontWeight: 600,
  fontSize: 9, letterSpacing: ".12em", color: "var(--muted)", whiteSpace: "nowrap",
  overflow: "hidden", textOverflow: "ellipsis",
};
const whisperNoteStyle: CSSProperties = {
  fontFamily: "var(--body)", fontStyle: "italic", fontWeight: 400, fontSize: 12.5,
  color: "var(--muted)", textAlign: "center",
};
const slotFrameStyle: CSSProperties = {
  aspectRatio: "4 / 5", border: "1px dashed var(--cobalt-line)", borderRadius: 12,
  background: "rgba(12,12,16,.6)",
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", gap: 10, overflow: "hidden", position: "relative",
};
const slotNoteStyle: CSSProperties = {
  fontFamily: "var(--body)", fontWeight: 600, fontSize: 9, letterSpacing: ".14em",
  color: "var(--muted)", textAlign: "center",
};
const spinnerStyle: CSSProperties = {
  width: 22, height: 22, border: "2px solid var(--line-2)", borderTopColor: "var(--amber)",
  borderRadius: "50%", animation: "ipspin .8s linear infinite",
};
const chipBtnStyle: CSSProperties = { cursor: "pointer" };
const chipOnStyle: CSSProperties = {
  cursor: "pointer", borderColor: "rgba(247,176,65,.6)", color: "var(--amber)",
  background: "var(--amber-wash)",
};
const usedBadgeStyle: CSSProperties = {
  position: "absolute", top: 5, right: 5, zIndex: 2, pointerEvents: "none",
  fontFamily: "var(--body)", fontSize: 8, fontWeight: 700, letterSpacing: ".1em",
  color: "var(--amber)", background: "rgba(10,10,12,.82)",
  border: "1px solid rgba(247,176,65,.4)", borderRadius: 6, padding: "2px 7px",
};

export function ImagePicker({ open, onClose, onPick, theme, context, suggestedPrompt }: ImagePickerProps) {
  const [tab, setTab] = useState<Tab>("library");

  // Wizard state feeds the FROM ARTICLE group and the ON SLIDE badges.
  // Both are empty (and render nothing) at mounts without a deck or scraped
  // pool, e.g. CREATE before a fetch or the CHOOSE cover bench.
  const articleImages = useWizard((s) => s.articleImages);
  const slides = useWizard((s) => s.slides);

  // LIBRARY
  const [assets, setAssets] = useState<BRollImageAsset[]>([]);
  const [libState, setLibState] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  // UPLOAD
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // GENERATE
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const [provider, setProvider] = useState<"imagen" | "grok">("imagen");
  const [slots, setSlots] = useState<GenSlot[]>(EMPTY_SLOTS);
  const [genBusy, setGenBusy] = useState(false);
  const [fellBack, setFellBack] = useState<string | null>(null);

  // Escape closes THIS modal only. Capture phase + stopPropagation beats the
  // shell listener; dataset.modalOpen is the shell's belt-and-braces check.
  useEffect(function () {
    if (!open) return;
    document.body.dataset.modalOpen = "1";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey, true);
    return function () {
      delete document.body.dataset.modalOpen;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);

  // Fresh view of the shared library on every open.
  useEffect(function () {
    if (!open) return;
    let alive = true;
    setLibState("loading");
    loadBrollAssets()
      .then(function (all) { if (alive) { setAssets(all); setLibState("ready"); } })
      .catch(function () { if (alive) { setAssets([]); setLibState("error"); } });
    return function () { alive = false; };
  }, [open]);

  // Persisted image provider (client only; default imagen). Re-read on every
  // open: another ImagePicker instance or chip may have changed it meanwhile.
  useEffect(function () {
    if (!open) return;
    const v = window.localStorage.getItem("poast-image-provider");
    setProvider(v === "grok" ? "grok" : "imagen");
  }, [open]);

  // Seed the generate prompt on open. Never clobber typed text.
  useEffect(function () {
    if (!open) return;
    setPrompt(function (p) {
      if (p.trim()) return p;
      if (suggestedPrompt && suggestedPrompt.trim()) return suggestedPrompt.trim();
      if (context && context.trim()) return context.trim().slice(0, 180);
      return p;
    });
  }, [open, suggestedPrompt, context]);

  if (!open) return null;

  function pickProvider(p: "imagen" | "grok") {
    setProvider(p);
    window.localStorage.setItem("poast-image-provider", p);
  }

  function pickAndClose(url: string) {
    onPick(url);
    onClose();
  }

  // Backdrop click is destructive for the GENERATE tab: variants live only in
  // component state. Ignore the mousedown while drafting or while unpicked
  // results still sit in the slots — ESC (and the ESC chip) close as before.
  function handleBackdropDown() {
    if (genBusy) return;
    if (slots.some(function (s) { return s.status === "done"; })) return;
    onClose();
  }

  function handleFiles(files: FileList | null) {
    const file = files && files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Not an image file.", "error"); return; }
    const reader = new FileReader();
    reader.onload = function () {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) { showToast("Could not read that file.", "error"); return; }
      persistToLibrary(dataUrl, { filename: file.name, category: "uploads" });
      pickAndClose(dataUrl);
    };
    reader.onerror = function () { showToast("Could not read that file.", "error"); };
    reader.readAsDataURL(file);
  }

  async function runGenerate() {
    const base = prompt.trim();
    if (!base || genBusy) return;
    const chosen = STYLE_PRESETS.find(function (s) { return s.label === preset; });
    const full = chosen ? base + ", " + chosen.suffix : base;
    setGenBusy(true);
    setFellBack(null);
    setSlots([{ status: "loading" }, { status: "loading" }, { status: "loading" }]);
    const results = await Promise.allSettled(
      [0, 1, 2].map(function () {
        // engine api omits `provider` unless it is exactly "grok" (BUG FIX #1)
        return generateImage({ prompt: full, category: theme, provider: provider });
      })
    );
    let fb: string | null = null;
    const next: GenSlot[] = results.map(function (res): GenSlot {
      if (res.status === "fulfilled") {
        if (res.value.fellBackTo) fb = String(res.value.fellBackTo);
        const url = res.value.images[0];
        return url ? { status: "done", url: url } : { status: "error", message: "NO IMAGE RETURNED" };
      }
      const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
      return { status: "error", message: msg };
    });
    setSlots(next);
    setFellBack(fb);
    setGenBusy(false);
    if (next.every(function (s) { return s.status === "error"; })) {
      showToast("Image generation failed. Try a different prompt or provider.", "error");
    }
  }

  function pickGenerated(url: string) {
    persistToLibrary(url, { description: prompt.trim().slice(0, 200), category: "generated" });
    pickAndClose(url);
  }

  // ── Library derivations ──
  // Deck usage per url -> ON SLIDE badges on article AND library tiles.
  const usedOnSlides = new Map<string, number[]>();
  slides.forEach(function (sl, i) {
    [sl.imageUrl, sl.imageUrl2].forEach(function (u) {
      if (!u) return;
      const nums = usedOnSlides.get(u) || [];
      nums.push(i + 1);
      usedOnSlides.set(u, nums);
    });
  });
  const articleUrls = articleImages.filter(function (u, i) {
    return !!u && articleImages.indexOf(u) === i;
  });
  const articleSet = new Set(articleUrls);
  const imageAssets = assets.filter(function (a) { return a.type === "image"; });
  const categories: string[] = [];
  imageAssets.forEach(function (a) {
    if (a.category && categories.indexOf(a.category) === -1) categories.push(a.category);
  });
  const q = search.trim().toLowerCase();
  const visible = imageAssets.filter(function (a) {
    if (articleSet.has(a.url)) return false; // dedupe: the article group wins
    if (catFilter !== "all" && a.category !== catFilter) return false;
    if (!q) return true;
    const hay = ((a.filename || "") + " " + (a.description || "") + " " + (a.category || "")).toLowerCase();
    return hay.indexOf(q) !== -1;
  });

  function usedBadge(url: string) {
    const nums = usedOnSlides.get(url);
    if (!nums || nums.length === 0) return null;
    return (
      <span style={usedBadgeStyle}>
        {(nums.length === 1 ? "ON SLIDE " : "ON SLIDES ") + nums.map(pad).join(", ")}
      </span>
    );
  }

  const canGenerate = !genBusy && prompt.trim().length > 0;

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropDown}>
      <div
        className="modal"
        onMouseDown={function (e) { e.stopPropagation(); }}
        style={{ width: 760, maxWidth: "92vw", maxHeight: "84vh", display: "flex", flexDirection: "column" }}
      >
        <style>{"@keyframes ipspin{to{transform:rotate(360deg)}}"}</style>

        {/* ── Header: Register-1 kicker + esc, then amber-underline tab row ── */}
        <div className="rise d1" style={{ padding: "16px 18px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="ph" style={{ flex: 1, margin: 0 }}>IMAGE BENCH · <b>B-ROLL</b></div>
            <span className="kbd" onClick={onClose} style={{ cursor: "pointer" }} title="Close">ESC</span>
          </div>
          <div className="tab-row" style={{ marginTop: 12 }}>
            {TABS.map(function (t) {
              return (
                <button key={t} type="button" className={tab === t ? "tab on" : "tab"} onClick={function () { setTab(t); }}>
                  {t.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rise d2" style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {/* ═══ LIBRARY ═══ */}
          {tab === "library" && (
            <>
              <input
                className="input"
                style={{ fontSize: 13, marginBottom: 12 }}
                placeholder="Search filename, note or category"
                value={search}
                onChange={function (e) { setSearch(e.target.value); }}
              />
              {categories.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  <span
                    className="chip"
                    style={catFilter === "all" ? chipOnStyle : chipBtnStyle}
                    onClick={function () { setCatFilter("all"); }}
                  >ALL</span>
                  {categories.map(function (c) {
                    return (
                      <span
                        key={c}
                        className="chip"
                        style={catFilter === c ? chipOnStyle : chipBtnStyle}
                        onClick={function () { setCatFilter(c); }}
                      >{c.toUpperCase()}</span>
                    );
                  })}
                </div>
              )}
              {articleUrls.length > 0 && (
                <>
                  <div className="ph" style={{ margin: "0 0 10px" }}>FROM ARTICLE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                    {articleUrls.map(function (u, i) {
                      return (
                        <button
                          key={u}
                          className="glass--tile"
                          style={{ ...thumbBtnStyle, position: "relative" }}
                          title={"Article image " + (i + 1)}
                          onClick={function () { pickAndClose(u); }}
                        >
                          {usedBadge(u)}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u}
                            alt={"Article image " + (i + 1)}
                            style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                          />
                          <span style={thumbLabelStyle}>{"ARTICLE " + pad(i + 1)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="ph" style={{ margin: "0 0 10px" }}>SHARED LIBRARY</div>
                </>
              )}
              {libState === "loading" && (
                <div style={{ ...whisperNoteStyle, padding: "46px 0" }}>Loading the shared library…</div>
              )}
              {libState === "error" && (
                <div style={{ ...whisperNoteStyle, padding: "46px 0", color: "var(--coral)" }}>
                  The library failed to load. Close and retry.
                </div>
              )}
              {/* No articleUrls guard: with article images present + empty
                  library, the SHARED LIBRARY header rendered with nothing
                  under it — looked like a failed load. */}
              {libState === "ready" && visible.length === 0 && (
                <div style={{ ...whisperNoteStyle, padding: "46px 0" }}>
                  {imageAssets.length === 0
                    ? "The library is empty. Upload or generate to seed it."
                    : "No matches. Clear search or filter."}
                </div>
              )}
              {libState === "ready" && visible.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {visible.map(function (a) {
                    return (
                      <button
                        key={a.id}
                        className="glass--tile"
                        style={{ ...thumbBtnStyle, position: "relative" }}
                        title={a.filename || a.description || ""}
                        onClick={function () { pickAndClose(a.url); }}
                      >
                        {usedBadge(a.url)}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.thumbnail || a.url}
                          alt={a.filename || "B-roll asset"}
                          style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                        />
                        <span style={thumbLabelStyle}>{(a.filename || a.category || "IMAGE").toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {/* ═══ UPLOAD ═══ */}
          {tab === "upload" && (
            <>
              <div
                onDragOver={function (e) { e.preventDefault(); setDragOver(true); }}
                onDragLeave={function () { setDragOver(false); }}
                onDrop={function (e) { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={function () { if (fileRef.current) fileRef.current.click(); }}
                style={{
                  border: "1px dashed " + (dragOver ? "var(--amber)" : "var(--cobalt-line)"),
                  borderRadius: 14, padding: "64px 24px", textAlign: "center", cursor: "pointer",
                  background: dragOver ? "var(--amber-wash)" : "rgba(12,12,16,.6)",
                  transition: "background .16s var(--ease), border-color .16s var(--ease)",
                }}
              >
                <div style={{ fontFamily: "var(--grift)", fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", color: "var(--tx)", marginBottom: 10 }}>
                  Drop an image here
                </div>
                <div style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 10, letterSpacing: ".14em", color: "var(--muted)" }}>
                  OR CLICK TO BROWSE. PNG / JPG / WEBP.
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onClick={function (e) { e.stopPropagation(); }}
                  onChange={function (e) { handleFiles(e.target.files); e.target.value = ""; }}
                />
              </div>
              <div className="callout" style={{ marginTop: 12 }}>
                Uploads also land in the shared library under Uploads.
              </div>
            </>
          )}

          {/* ═══ GENERATE ═══ */}
          {tab === "generate" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div className="ph" style={{ flex: 1, margin: 0 }}>PROMPT</div>
                <div className="seg">
                  <span className={provider === "imagen" ? "on" : ""} onClick={function () { pickProvider("imagen"); }}>IMAGEN</span>
                  <span className={provider === "grok" ? "on" : ""} onClick={function () { pickProvider("grok"); }}>GROK</span>
                </div>
              </div>
              <textarea
                className="input"
                value={prompt}
                rows={3}
                placeholder="Describe the image"
                onChange={function (e) { setPrompt(e.target.value); }}
                style={{ resize: "vertical", minHeight: 76, fontSize: 13, lineHeight: 1.5 }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "12px 0 16px" }}>
                {STYLE_PRESETS.map(function (s) {
                  return (
                    <span
                      key={s.label}
                      className="chip"
                      style={preset === s.label ? chipOnStyle : chipBtnStyle}
                      onClick={function () { setPreset(preset === s.label ? null : s.label); }}
                    >{s.label}</span>
                  );
                })}
                <span className="callout">Preset is appended to your prompt.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <button
                  type="button"
                  className="btn btn-amber"
                  disabled={!canGenerate}
                  onClick={runGenerate}
                >
                  {genBusy ? "Drafting variants" : "Generate 3 variants"}
                </button>
                {fellBack && (
                  <span className="callout">Provider fell back to {fellBack.toUpperCase()}.</span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {slots.map(function (s, i) {
                  return (
                    <div key={i} style={slotFrameStyle}>
                      {s.status === "empty" && <span style={slotNoteStyle}>VARIANT 0{i + 1}</span>}
                      {s.status === "loading" && (
                        <>
                          <span style={spinnerStyle} />
                          <span style={slotNoteStyle}>DRAFTING</span>
                        </>
                      )}
                      {s.status === "error" && (
                        <span style={{ ...slotNoteStyle, color: "var(--coral)", padding: "0 10px" }}>
                          {s.message.toUpperCase().slice(0, 90)}
                        </span>
                      )}
                      {s.status === "done" && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.url}
                            alt={"Variant " + (i + 1)}
                            onClick={function () { pickGenerated(s.url); }}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                          />
                          <span className="chip ok" style={{ position: "absolute", bottom: 6, left: 6, pointerEvents: "none" }}>
                            CLICK TO USE
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="callout" style={{ marginTop: 12 }}>
                Picked variants are saved into the shared library.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Both import styles work: `import ImagePicker from` and `import { ImagePicker } from`
// (CoverDesigner.tsx uses the named form).
export default ImagePicker;


