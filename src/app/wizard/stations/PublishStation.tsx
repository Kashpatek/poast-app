"use client";
// ═══════════════════════════════════════════════════════════════════════════
// SA Carousel 2.0 · STATION 04 — PUBLISH (captions & export)
//
// THE FOUNDRY reskin (docs/THEME-FOUNDRY.md v3 §8). Flow, store wiring,
// handlers and export plumbing are frozen from v1 of this station:
// deck grid of SlidePreviews (click -> EDIT) · captions (explicit generate,
// platform tabs w/ amber underline, option plate cards w/ amber hot edge,
// editable in place, preflight) · export rail (forged plates, mono numerals,
// ZIP w/ per-slide progress + failure rows, DOCX, SAVE upsert = the amber
// action, Buffer) · archive status whisper line (Register 2).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zipSync } from "fflate";
import { useWizard } from "../store";
import { SectionHeader, Kbd } from "../components/Chrome";
import { SlidePreview } from "../engine/SlidePreview";
import type { CaptionOption, Slide } from "../engine/types";
import { generateCaptions, buildApiSlides, saveArchive } from "../engine/api";
import { ensureFontsReady } from "../engine/export-renderer";
import { buildCaptionsDocx } from "../engine/docx-export";
import { copyText } from "../../shared-constants";
import { showToast } from "../../toast-context";
import { confirmDialog } from "../../dialog-context";
import { useUser } from "../../user-context";
import {
  PLATFORMS,
  coverTitleOf,
  filePrefix,
  archiveDisplayName,
  platformText,
  platformPatch,
  platformHashtags,
  hashtagsPatch,
  captionForArchive,
  renderSlidePng,
  bytesToBlob,
  downloadBlob,
  estimateOverflowPx,
} from "./publish-export";

/* ─── tiny formatters ─── */
function two(n: number): string {
  return String(n).padStart(2, "0");
}
function clock(t?: number): string {
  return new Date(t ?? Date.now()).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" });
}
function letterOf(i: number): string {
  return String.fromCharCode(65 + Math.min(25, Math.max(0, i)));
}
const fmt = (n: number) => n.toLocaleString("en-US");

/* Cheap fingerprint of everything the archive payload captures (BUG FIX #4):
   caption edits hash by full text (small strings), the deck by shape/length
   only — slides can carry data-URL images and cannot change while this
   station is mounted, so stringify length is enough on that side. */
function publishFingerprint(slides: Slide[], captionOptions: CaptionOption[], selectedCaptionIdx: number): string {
  return slides.length + "·" + JSON.stringify(slides).length + "·" + selectedCaptionIdx + "·" + JSON.stringify(captionOptions);
}

/* ─── preflight checklist row ───
   Amber is reserved for THE action (SAVE): warnings keep the amber icon but
   speak in muted text; only true failures (bad) get coral copy. */
function PreRow({ tone, onJump, children }: { tone: "ok" | "warn" | "bad"; onJump?: () => void; children: React.ReactNode }) {
  const col = tone === "ok" ? "var(--mint)" : tone === "warn" ? "var(--amber)" : "var(--coral)";
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--body)",
        fontWeight: 600, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase",
        color: tone === "bad" ? "var(--coral)" : "var(--muted)",
      }}
    >
      <span
        style={{
          width: 16, height: 16, borderRadius: 6, display: "grid", placeItems: "center",
          fontSize: 9, border: "1px solid " + col, color: col, flexShrink: 0, fontStyle: "normal",
          background: tone === "ok" ? "rgba(46,173,142,.08)" : "transparent",
        }}
      >
        {tone === "ok" ? "✓" : "!"}
      </span>
      <span style={{ minWidth: 0 }}>{children}</span>
      {onJump && tone !== "ok" ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{
            marginLeft: "auto", flexShrink: 0, padding: "3px 9px", fontSize: 8.5,
            letterSpacing: ".12em", borderRadius: 7,
          }}
          title="Jump to the fix in EDIT"
          onClick={onJump}
        >
          FIX {"→"}
        </button>
      ) : null}
    </div>
  );
}

/* ─── export rail row (forged plate list row; `primary` = THE amber action) ─── */
function ExpRow(props: {
  code: string;
  name: string;
  sub: React.ReactNode;
  action: string;
  onAction?: () => void;
  disabled?: boolean;
  tone?: "busy" | "done";
  progress?: number | null;
  first?: boolean;
  primary?: boolean;
}) {
  const { code, name, sub, action, onAction, disabled, tone, progress, first, primary } = props;
  const iconCol = tone === "done" ? "var(--mint)" : tone === "busy" ? "var(--amber)" : "var(--muted)";
  const actionStyle: React.CSSProperties =
    tone === "done"
      ? { background: "rgba(46,173,142,.08)", border: "1px solid rgba(46,173,142,.45)", color: "var(--mint)", fontWeight: 500 }
      : primary
        ? { background: "var(--amber)", border: "1px solid var(--amber)", color: "#0A0A0C", fontWeight: 700 }
        : { background: "rgba(228,235,248,.05)", border: "1px solid var(--line-2)", color: "var(--tx)", fontWeight: 500 };
  return (
    <div
      style={{
        padding: "14px 16px", borderTop: first ? "none" : "1px solid var(--line)",
        display: "flex", alignItems: "center", gap: 13,
        background: tone === "busy" ? "var(--amber-wash)" : "transparent",
      }}
    >
      <span
        style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          border: "1px solid " + (tone ? iconCol : "var(--line-2)"),
          background: "rgba(10,10,12,.5)",
          display: "grid", placeItems: "center", fontFamily: "var(--body)",
          fontWeight: 600, fontSize: 8, letterSpacing: ".04em", color: iconCol,
        }}
      >
        {code}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: "var(--tx)" }}>{name}</span>
        <span
          style={{
            display: "block", fontFamily: "var(--body)", fontStyle: "italic", fontWeight: 400,
            fontSize: 10.5, color: "var(--muted)", marginTop: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {sub}
        </span>
        {typeof progress === "number" && (
          <span className="progress" style={{ display: "block", marginTop: 7, "--p": progress + "%" } as React.CSSProperties} />
        )}
      </span>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled || !onAction}
        style={{
          fontFamily: "var(--body)", fontSize: 9.5, letterSpacing: ".12em", flexShrink: 0,
          borderRadius: 10, padding: "7px 13px", textTransform: "uppercase",
          cursor: disabled || !onAction ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
          transition: "background .16s var(--ease), box-shadow .16s var(--ease)",
          ...actionStyle,
        }}
      >
        {action}
      </button>
    </div>
  );
}

/* ═══ station ═══ */
export function PublishStation() {
  // store
  const slides = useWizard((s) => s.slides);
  const category = useWizard((s) => s.category);
  const url = useWizard((s) => s.url);
  const text = useWizard((s) => s.text);
  const mode = useWizard((s) => s.mode);
  const countMode = useWizard((s) => s.countMode);
  const pageCount = useWizard((s) => s.pageCount);
  const topic = useWizard((s) => s.topic);
  const libSeed = useWizard((s) => s.libSeed);
  const bgMode = useWizard((s) => s.bgMode);
  const articleTitle = useWizard((s) => s.articleTitle);
  const selectedVariantLabel = useWizard((s) => s.selectedVariantLabel);
  const captionOptions = useWizard((s) => s.captionOptions);
  const selectedCaptionIdx = useWizard((s) => s.selectedCaptionIdx);
  const platTab = useWizard((s) => s.platTab);
  const archiveId = useWizard((s) => s.archiveId);
  const undoStack = useWizard((s) => s.undoStack);
  const go = useWizard((s) => s.go);
  const setActiveIdx = useWizard((s) => s.setActiveIdx);
  const setInspectorFocus = useWizard((s) => s.setInspectorFocus);
  const setPlatTab = useWizard((s) => s.setPlatTab);
  const setCaptionOptions = useWizard((s) => s.setCaptionOptions);
  const setSelectedCaptionIdx = useWizard((s) => s.setSelectedCaptionIdx);
  const updateCaptionOption = useWizard((s) => s.updateCaptionOption);
  const { user } = useUser();

  // local
  const [capBusy, setCapBusy] = useState(false);
  const [capEdited, setCapEdited] = useState(false);
  const [capGenSeq, setCapGenSeq] = useState(0); // remounts uncontrolled hashtag inputs on regeneration
  const [reprompt, setReprompt] = useState("");
  const [zip, setZip] = useState<{ busy: boolean; done: number; total: number }>({ busy: false, done: 0, total: 0 });
  const [zipFailures, setZipFailures] = useState<number[]>([]);
  const [singlesOpen, setSinglesOpen] = useState(false);
  const [singleBusy, setSingleBusy] = useState<number | null>(null);
  const [docxBusy, setDocxBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedFingerprint = useRef<string | null>(null); // snapshot taken when savedAt is set (BUG FIX #4)
  const [publishBusy, setPublishBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const logAction = useCallback((action: string) => {
    setLog((prev) => [clock() + " " + action, ...prev].slice(0, 6));
  }, []);

  // derived
  const coverTitle = useMemo(() => coverTitleOf(slides), [slides]);
  const project = articleTitle || (coverTitle !== "carousel" ? coverTitle : "");
  const prefix = filePrefix(coverTitle);
  const plat = PLATFORMS.find((p) => p.key === platTab) || PLATFORMS[0];
  const selectedOption: CaptionOption | null =
    captionOptions.length > 0 ? captionOptions[selectedCaptionIdx] || captionOptions[0] : null;
  const overflows = useMemo(() => slides.map((sl) => estimateOverflowPx(sl)), [slides]);
  const overCount = overflows.filter((v) => v > 0).length;
  const worst = useMemo(() => {
    let idx = -1;
    let max = 0;
    overflows.forEach((v, i) => {
      if (v > max) { max = v; idx = i; }
    });
    return idx;
  }, [overflows]);
  const closer = slides.length > 0 ? slides[slides.length - 1] : null;
  const ctaOk = !!(closer && closer.position === 4 && (closer.ctaText || "").trim());
  // FRICTION FIX #25: preflight sweeps caption length on ALL platforms (the
  // visible tab already shows its own count); worst offender by overage.
  const capOver = useMemo(() => {
    let worst: { key: (typeof PLATFORMS)[number]["key"]; label: string; count: number; limit: number } | null = null;
    if (!selectedOption) return worst;
    for (const p of PLATFORMS) {
      const count = platformText(selectedOption, p.key).length;
      if (count > p.limit && (!worst || count - p.limit > worst.count - worst.limit)) {
        worst = { key: p.key, label: p.label, count, limit: p.limit };
      }
    }
    return worst;
  }, [selectedOption]);
  const revLetter = letterOf(undoStack.length);
  const busy = zip.busy || saving || docxBusy || publishBusy || capBusy || singleBusy !== null;

  // ─── captions ───
  async function runCaptions(extra: string) {
    if (capBusy) return;
    if (slides.length === 0) {
      showToast("No slides to caption yet.", "error");
      return;
    }
    setCapBusy(true);
    try {
      const opts = await generateCaptions({
        slides: buildApiSlides(slides),
        sourceUrl: url,
        variantLabel: selectedVariantLabel,
        theme: category,
        extraContext: extra,
      });
      if (opts.length === 0) throw new Error("No caption options returned. Try again.");
      setCaptionOptions(opts);
      setSelectedCaptionIdx(0);
      setCapEdited(false);
      setCapGenSeq((n) => n + 1);
      setReprompt("");
      logAction("CAPTIONS DRAFTED · " + opts.length + " OPTIONS");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Caption generation failed", "error");
    }
    setCapBusy(false);
  }

  async function onReprompt() {
    if (capBusy) return;
    if (capEdited) {
      const ok = await confirmDialog({
        title: "Regenerate captions?",
        body: "You edited these options in place. Reprompting replaces all three with fresh drafts.",
        cta: "Regenerate",
        cancel: "Keep edits",
        variant: "danger",
      });
      if (!ok) return;
    }
    void runCaptions(reprompt.trim());
  }

  // ─── ZIP export (fflate; per-slide progress; failures reported, not skipped) ───
  async function exportZip(): Promise<boolean> {
    if (zip.busy || slides.length === 0) return false;
    setZip({ busy: true, done: 0, total: slides.length });
    setZipFailures([]);
    logAction("RENDER STARTED · " + slides.length + " SLIDES QUEUED");
    await ensureFontsReady();
    const files: Record<string, Uint8Array> = {};
    const failures: number[] = [];
    for (let i = 0; i < slides.length; i++) {
      try {
        files[prefix + "_slide" + (i + 1) + ".png"] = await renderSlidePng(slides[i], category, i + 1, slides.length);
      } catch {
        failures.push(i);
      }
      setZip({ busy: true, done: i + 1, total: slides.length });
    }
    setZipFailures(failures);
    if (failures.length > 0) {
      showToast(failures.length + " of " + slides.length + " slides failed to render. See the export rail.", "error");
      failures.forEach((i) => logAction("SLIDE " + two(i + 1) + " RENDER FAILED"));
    }
    const rendered = Object.keys(files).length;
    if (rendered === 0) {
      setZip({ busy: false, done: 0, total: 0 });
      return false;
    }
    const bytes = zipSync(files, { level: 0 }); // PNGs are already deflated
    downloadBlob(bytesToBlob(bytes, "application/zip"), prefix + ".zip");
    logAction("ZIP DOWNLOADED · " + rendered + " SLIDES");
    setZip({ busy: false, done: slides.length, total: slides.length });
    return failures.length === 0;
  }

  async function downloadOne(i: number) {
    if (singleBusy !== null || !slides[i]) return;
    setSingleBusy(i);
    try {
      await ensureFontsReady();
      const bytes = await renderSlidePng(slides[i], category, i + 1, slides.length);
      downloadBlob(bytesToBlob(bytes, "image/png"), prefix + "_slide" + (i + 1) + ".png");
      logAction("SLIDE " + two(i + 1) + " PNG DOWNLOADED");
    } catch {
      showToast("Slide " + (i + 1) + " failed to render.", "error");
      logAction("SLIDE " + two(i + 1) + " RENDER FAILED");
    }
    setSingleBusy(null);
  }

  // ─── DOCX ───
  async function exportDocx() {
    if (docxBusy) return;
    if (!selectedOption) {
      showToast("Generate captions first.", "error");
      return;
    }
    setDocxBusy(true);
    try {
      await buildCaptionsDocx({
        captionOption: selectedOption,
        sourceUrl: url,
        articleTitle: project || coverTitle,
        theme: category,
        filePrefix: prefix,
      });
      logAction("CAPTIONS DOCX EXPORTED");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Docx export failed", "error");
    }
    setDocxBusy(false);
  }

  // ─── Save to Archive (V1 payload shape, upsert via archiveId; BUG FIX #2) ───
  async function saveToArchive(asCopy: boolean): Promise<boolean> {
    if (saving) return false;
    if (slides.length === 0) {
      showToast("Nothing to save yet.", "error");
      return false;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        slides: slides,
        caption: captionForArchive(selectedOption, platTab),
        captionOptions: captionOptions,
        selectedCaptionIdx: selectedCaptionIdx,
        theme: category,
        sourceUrl: url || "",
        articleTitle: project || coverTitle,
        timestamp: new Date().toISOString(),
        slideCount: slides.length,
        createdBy: user ? user.name : "Unknown",
        createdByRole: user ? user.role : "",
        wizardInputs: {
          url: url,
          text: text,
          category: category,
          mode: countMode,
          pageCount: pageCount,
          generationMode: mode,
          // Library mode (LIBRARY-INTEGRATION.md): topic + seed + bg mode
          // ride the archive so adopting restores the deterministic chain.
          topic: topic,
          libSeed: libSeed,
          bgMode: bgMode,
        },
      };
      const res = await saveArchive({
        id: asCopy ? undefined : archiveId || undefined,
        name: archiveDisplayName(coverTitle, url),
        data: payload,
      });
      useWizard.setState({ archiveId: res.id });
      savedFingerprint.current = publishFingerprint(slides, captionOptions, selectedCaptionIdx);
      setSavedAt(Date.now());
      logAction(asCopy ? "SAVED AS COPY · NEW ROW" : archiveId ? "RE-SAVED TO ARCHIVE · SAME ROW" : "SAVED TO ARCHIVE");
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save archive.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // BUG FIX #4: SAVED must not survive post-save edits. When the deck or
  // captions diverge from the snapshot captured at save time, drop back to
  // the idle copy. First run after a save compares equal (the fingerprint
  // was taken from the exact state the payload shipped), so nothing clears.
  useEffect(() => {
    if (savedAt === null || savedFingerprint.current === null) return;
    if (publishFingerprint(slides, captionOptions, selectedCaptionIdx) !== savedFingerprint.current) {
      savedFingerprint.current = null;
      setSavedAt(null);
    }
  }, [savedAt, slides, captionOptions, selectedCaptionIdx]);

  function openBuffer() {
    window.open("https://publish.buffer.com", "_blank");
    logAction("BUFFER OPENED · QUEUE MANUALLY");
  }

  // ─── Publish run: the one-button bundle (ZIP + save, in sequence) ───
  async function publishRun() {
    if (busy || slides.length === 0) return;
    setPublishBusy(true);
    const zipOk = await exportZip();
    const saveOk = await saveToArchive(false);
    setPublishBusy(false);
    logAction("PUBLISH RUN " + (zipOk && saveOk ? "COMPLETE" : "FINISHED WITH ISSUES"));
    if (zipOk && saveOk) showToast("Publish run complete: ZIP downloaded, archive saved.", "success");
    else showToast("Publish run finished with issues. Check the activity log.", "error");
  }

  // Cmd/Ctrl+Enter = Publish run (the design-spec kbd chip, made live).
  // BUG FIX #12: the listener mounts once ([] deps); the ref hands it the
  // current render's publishRun so it reads live state at call time instead
  // of tearing down / re-adding on every render.
  const publishRunRef = useRef(publishRun);
  publishRunRef.current = publishRun;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      e.preventDefault();
      void publishRunRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const zipPct = zip.total > 0 ? Math.round((zip.done / zip.total) * 100) : 0;
  // mono is numerals-only in THE FOUNDRY: monoDim keeps timestamped/indexed
  // lines; labelDim is the Register-1 voice for everything that speaks.
  const monoDim: React.CSSProperties = { fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".1em", color: "var(--dim)" };
  const labelDim: React.CSSProperties = { fontFamily: "var(--body)", fontWeight: 600, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--dim)" };
  // Neutral forged action (spec §4 plate recipe): cobalt stays selection-only
  // and SAVE keeps the view's one amber, so these buttons read as iron.
  const forgedBtn: React.CSSProperties = {
    background: "var(--card)",
    borderColor: "var(--line-2)",
    boxShadow: "inset 0 1px 0 var(--bevel-hi), inset 0 -1px 0 rgba(0,0,0,.35)",
  };
  const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 14, minWidth: 0 };

  /* ═══ render ═══ */
  return (
    <div className="station-scroll">
      <div
        style={{
          width: "min(1380px, 100%)", margin: "0 auto", padding: "26px 28px 56px",
          display: "flex", flexDirection: "column", gap: 22,
        }}
      >
        {/* ── station header: kicker + display hero + Register-1 meta ── */}
        <header
          className="rise d1"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="kicker">
              <b>04</b> · PUBLISH — CAPTIONS &amp; EXPORT
            </div>
            <h1 className="display">
              Ship the <span className="grad">post</span>.
            </h1>
          </div>
          <div
            style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 10, letterSpacing: ".14em", color: "var(--dim)", textTransform: "uppercase", paddingBottom: 6 }}
          >
            {(project || "untitled").toUpperCase().slice(0, 26) + " · REV " + revLetter + " · " + (archiveId ? "SAVED" : "UNSAVED")}
          </div>
        </header>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* ── column 1 · FINAL DECK ── */}
          <section className="glass rise d2" style={{ ...col, flex: "0 0 512px", padding: 18 }}>
            <SectionHeader
              label="Final deck"
              accent={slides.length + " SLIDES · " + (selectedVariantLabel || "custom").toUpperCase()}
            />
            {slides.length === 0 ? (
              <div style={{ padding: "16px 2px 6px", display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                <span style={{ ...labelDim, fontSize: 10, letterSpacing: ".14em", color: "var(--muted)" }}>
                  NOTHING TO PUBLISH YET: THE DECK IS EMPTY.
                </span>
                <button type="button" className="btn btn-ghost" onClick={() => go("create")}>
                  Back to Create
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 150px)", gap: 12 }}>
                {slides.map((sl, i) => (
                  <button
                    key={sl.id}
                    type="button"
                    title={"Open slide " + (i + 1) + " in Edit"}
                    onClick={() => {
                      setActiveIdx(i);
                      go("edit");
                    }}
                    style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 10, textAlign: "left" }}
                  >
                    <span
                      style={{
                        position: "absolute", bottom: 6, left: 6, zIndex: 2, fontFamily: "var(--mono)",
                        fontSize: 8, letterSpacing: ".1em", color: "var(--tx)", background: "rgba(10,10,12,.72)",
                        border: "1px solid var(--line-2)", borderRadius: 6, padding: "2px 6px",
                      }}
                    >
                      {two(i + 1)}
                    </span>
                    <SlidePreview slide={sl} theme={category} width={150} />
                  </button>
                ))}
              </div>
            )}
            {slides.length > 0 && <div className="whisper">Click a slide to reopen it in Edit.</div>}
          </section>

          {/* ── column 2 · CAPTIONS + PREFLIGHT ── */}
          <section className="rise d3" style={{ ...col, flex: 1 }}>
            <div className="glass" style={{ ...col, padding: 18 }}>
              <SectionHeader
                label="Captions"
                accent={captionOptions.length > 0 ? captionOptions.length + " OPTIONS · PER PLATFORM" : "NOT DRAFTED YET"}
              />
              <div className="tab-row">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={"tab" + (platTab === p.key ? " on" : "")}
                    onClick={() => setPlatTab(p.key)}
                  >
                    {p.label + " · " + fmt(p.limit)}
                  </button>
                ))}
              </div>

              {captionOptions.length === 0 ? (
                <div style={{ padding: "14px 2px 6px", display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                  <span className="whisper">
                    No captions drafted. Generation is explicit: nothing fires on arrival.
                  </span>
                  <button
                    type="button"
                    className="btn"
                    style={forgedBtn}
                    disabled={capBusy || slides.length === 0}
                    onClick={() => void runCaptions("")}
                  >
                    {capBusy ? "Drafting options..." : "Generate captions"}
                  </button>
                  {capBusy && <span style={labelDim}>3 OPTIONS × 3 PLATFORMS · ONE CALL</span>}
                </div>
              ) : (
                <>
                  {captionOptions.map((opt, oi) => {
                    const capText = platformText(opt, platTab);
                    const count = capText.length;
                    const over = count > plat.limit;
                    const selected = oi === selectedCaptionIdx;
                    const tags = platTab !== "shorts" ? platformHashtags(opt, platTab) : null;
                    const letter = letterOf(oi);
                    return (
                      <div
                        key={oi}
                        className={"opt-card" + (selected ? " selected" : "")}
                        onClick={() => {
                          if (selected) return;
                          setSelectedCaptionIdx(oi);
                          logAction("CAPTION " + letter + " SELECTED · " + plat.label);
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <span
                            style={{
                              fontFamily: "var(--body)", fontWeight: 600, fontSize: 9, letterSpacing: ".14em",
                              color: selected ? "var(--amber)" : "var(--muted)", textTransform: "uppercase",
                            }}
                          >
                            {"OPTION " + letter + " · " + (opt.label || "DRAFT " + (oi + 1))}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span className="mono" style={{ fontSize: 9, color: over ? "var(--coral)" : "var(--dim)" }}>
                              <b style={{ fontWeight: 500, color: over ? "var(--coral)" : "var(--mint)" }}>{fmt(count)}</b>
                              {" / " + fmt(plat.limit)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // FRICTION FIX #17: COPY carries the hashtags too
                                // (counts above stay caption-only — limits are per field).
                                const tagLine = tags && tags.length > 0 ? tags.map((t) => "#" + t.replace(/^#+/, "")).join(" ") : "";
                                const clip = tagLine ? capText + "\n\n" + tagLine : capText;
                                if (copyText(clip)) showToast(plat.label + " caption " + letter + (tagLine ? " + tags copied." : " copied."));
                                else showToast("Copy failed.", "error");
                              }}
                              style={{
                                fontFamily: "var(--body)", fontWeight: 600, fontSize: 8.5, letterSpacing: ".12em", color: "var(--muted)",
                                background: "rgba(228,235,248,.04)", border: "1px solid var(--line-2)", borderRadius: 8,
                                padding: "3px 9px", cursor: "pointer",
                              }}
                            >
                              COPY
                            </button>
                          </span>
                        </div>
                        <textarea
                          className="input"
                          rows={platTab === "shorts" ? 2 : 4}
                          value={capText}
                          aria-label={"Option " + letter + " " + plat.label + (platTab === "shorts" ? " title" : " caption")}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => {
                            // BUG FIX #3: editing an unselected card selects it.
                            if (!selected) {
                              setSelectedCaptionIdx(oi);
                              logAction("CAPTION " + letter + " SELECTED · " + plat.label);
                            }
                          }}
                          onChange={(e) => {
                            updateCaptionOption(oi, platformPatch(opt, platTab, e.target.value));
                            setCapEdited(true);
                          }}
                          style={{ minHeight: platTab === "shorts" ? 52 : 96, fontSize: 12.5 }}
                        />
                        {tags !== null && (
                          <input
                            key={capGenSeq + "-" + oi + "-" + platTab}
                            className="input"
                            defaultValue={tags.map((t) => "#" + t.replace(/^#+/, "")).join(" ")}
                            aria-label={"Hashtags for option " + letter}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={() => {
                              // BUG FIX #3: editing an unselected card selects it.
                              if (!selected) {
                                setSelectedCaptionIdx(oi);
                                logAction("CAPTION " + letter + " SELECTED · " + plat.label);
                              }
                            }}
                            onChange={() => setCapEdited(true)}
                            onBlur={(e) => updateCaptionOption(oi, hashtagsPatch(opt, platTab, e.target.value))}
                            style={{ marginTop: 8, fontSize: 11, color: "var(--blue-300)", padding: "7px 10px" }}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      className="input"
                      value={reprompt}
                      disabled={capBusy}
                      placeholder="Extra guidance: tone, angle, numbers to lead with"
                      onChange={(e) => setReprompt(e.target.value)}
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={capBusy}
                      onClick={() => void onReprompt()}
                      style={{ flexShrink: 0 }}
                    >
                      {capBusy ? "Drafting..." : "Reprompt"}
                    </button>
                  </div>
                </>
              )}
              <div className="whisper">Captions are editable in place. Limits enforced per platform.</div>
            </div>

            {/* preflight */}
            <div className="glass rise d4" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
              <SectionHeader label="Preflight" />
              {slides.length === 0 ? (
                <PreRow tone="warn">NO SLIDES IN THE DECK</PreRow>
              ) : (
                <>
                  <PreRow
                    tone={overCount === 0 ? "ok" : "bad"}
                    onJump={function () {
                      setActiveIdx(worst);
                      setInspectorFocus("overflow");
                      go("edit");
                    }}
                  >
                    {overCount === 0
                      ? slides.length + " / " + slides.length + " SLIDES WITHIN 1080×1350 SAFE AREA"
                      : slides.length - overCount + " / " + slides.length + " SLIDES WITHIN SAFE AREA · WORST SLIDE " + two(worst + 1) + " OVER BY ~" + overflows[worst] + " PX"}
                  </PreRow>
                  <PreRow
                    tone={ctaOk ? "ok" : "warn"}
                    onJump={function () {
                      setActiveIdx(slides.length - 1);
                      setInspectorFocus("cta");
                      go("edit");
                    }}
                  >
                    {ctaOk
                      ? "CTA CLOSER PRESENT · SLIDE " + two(slides.length)
                      : "CTA CLOSER EMPTY · SET IT IN EDIT · CTA SECTION"}
                  </PreRow>
                  <PreRow tone="ok">WORDMARK CLEARANCE VERIFIED ON ALL SLIDES</PreRow>
                  <PreRow tone={captionOptions.length > 0 ? "ok" : "warn"}>
                    {captionOptions.length > 0
                      ? "CAPTION SELECTED · " + plat.label
                      : "NO CAPTION DRAFTED · " + plat.label + " QUEUE EMPTY"}
                  </PreRow>
                  {selectedOption && (
                    <PreRow
                      tone={capOver ? "bad" : "ok"}
                      onJump={
                        capOver
                          ? function () {
                              setPlatTab(capOver.key);
                            }
                          : undefined
                      }
                    >
                      {capOver
                        ? "CAPTION OVER LIMIT · " + capOver.label + " " + fmt(capOver.count) + " / " + fmt(capOver.limit)
                        : "CAPTION LENGTH WITHIN LIMITS · ALL PLATFORMS"}
                    </PreRow>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ── column 3 · EXPORT RAIL ── */}
          <section className="rise d5" style={{ ...col, flex: "0 0 336px", gap: 12 }}>
            <SectionHeader label="Export rail" />
            {/* the export rail is this station's money surface — it carries the
                hot edge (§4, "cards that matter"); bottom:0 because the plate
                clips its children with overflow:hidden */}
            <div className="glass" style={{ overflow: "hidden", position: "relative" }}>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute", left: "10%", right: "10%", bottom: 0, height: 2,
                  borderRadius: 2, pointerEvents: "none", opacity: 0.5,
                  background: "var(--heat)", backgroundSize: "220% 100%",
                }}
              />
              <ExpRow
                first
                code="ZIP"
                name="Download PNGs"
                tone={zip.busy ? "busy" : undefined}
                sub={zip.busy ? "Rendering " + zip.done + " / " + zip.total + " · 1080×1350" : slides.length + " slides · 1080×1350 · 1 ZIP"}
                action={zip.busy ? zipPct + "%" : "EXPORT"}
                progress={zip.busy ? zipPct : null}
                disabled={busy || slides.length === 0}
                onAction={() => void exportZip()}
              />
              {zipFailures.map((i) => (
                <div
                  key={i}
                  style={{ ...labelDim, fontSize: 9, color: "var(--coral)", padding: "8px 16px", borderTop: "1px solid var(--line)" }}
                >
                  {"SLIDE " + two(i + 1) + " FAILED · RETRY OR EXPORT IT SINGLY"}
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--line)" }}>
                <button
                  type="button"
                  onClick={() => setSinglesOpen((o) => !o)}
                  style={{
                    ...labelDim, width: "100%", textAlign: "left", padding: "9px 16px",
                    fontSize: 8.5, color: "var(--muted)", background: "none", border: "none", cursor: "pointer",
                  }}
                >
                  {(singlesOpen ? "HIDE" : "SHOW") + " PNGS INDIVIDUALLY · " + slides.length}
                </button>
                {singlesOpen &&
                  slides.map((sl, i) => (
                    <div key={sl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 16px 7px" }}>
                      <span className="mono" style={{ fontSize: 9, letterSpacing: ".14em", color: "var(--muted)" }}>
                        {"SLIDE " + two(i + 1)}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void downloadOne(i)}
                        style={{
                          fontFamily: "var(--body)", fontWeight: 600, fontSize: 8.5, letterSpacing: ".12em", color: "var(--tx)",
                          border: "1px solid var(--line-2)", borderRadius: 8, padding: "3px 10px",
                          background: "rgba(228,235,248,.05)", cursor: busy ? "default" : "pointer", opacity: busy ? 0.55 : 1,
                        }}
                      >
                        {singleBusy === i ? "..." : "PNG"}
                      </button>
                    </div>
                  ))}
              </div>
              <ExpRow
                code="DOCX"
                name="Captions document"
                tone={docxBusy ? "busy" : undefined}
                sub={selectedOption ? "Option " + letterOf(selectedCaptionIdx) + " · 3 platforms" : "Generate captions first"}
                action={docxBusy ? "..." : "EXPORT"}
                disabled={busy || !selectedOption}
                onAction={() => void exportDocx()}
              />
              <ExpRow
                primary
                code="SA"
                name="Save to archive"
                tone={saving ? "busy" : savedAt ? "done" : undefined}
                sub={
                  saving
                    ? "Saving..."
                    : savedAt
                      ? "Saved " + clock(savedAt) + " · re-save upserts the row"
                      : archiveId
                        ? "Re-save upserts the open row"
                        : "Creates a new archive row"
                }
                action={saving ? "..." : savedAt ? "SAVED" : "SAVE"}
                disabled={busy || slides.length === 0}
                onAction={() => void saveToArchive(false)}
              />
              <div style={{ padding: "0 16px 13px 63px" }}>
                <button
                  type="button"
                  disabled={busy || slides.length === 0}
                  onClick={() => void saveToArchive(true)}
                  style={{
                    fontFamily: "var(--body)", fontWeight: 600, fontSize: 8.5, letterSpacing: ".12em",
                    textTransform: "uppercase", color: "var(--blue-300)",
                    background: "none", border: "none", padding: 0,
                    cursor: busy || slides.length === 0 ? "default" : "pointer",
                    opacity: busy || slides.length === 0 ? 0.55 : 1,
                  }}
                >
                  SAVE AS COPY · FORCES A NEW ROW
                </button>
              </div>
              <ExpRow
                code="BUF"
                name="Send to Buffer"
                sub="Opens Buffer · queue manually"
                action="OPEN"
                onAction={openBuffer}
              />
            </div>

            {/* archive status line — save-state text speaks Register 2 (§5) */}
            <div
              className="whisper"
              style={{
                fontSize: 11.5,
                color: saving ? "var(--amber)" : savedAt ? "var(--mint)" : "var(--dim)",
              }}
            >
              {saving
                ? "Archive · saving..."
                : savedAt
                  ? "Archive · saved " + clock(savedAt)
                  : archiveId
                    ? "Archive · row open · re-save upserts"
                    : "Archive · not saved yet"}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => go("edit")}>
                Back to Edit
              </button>
              <button
                type="button"
                className="btn"
                style={{ ...forgedBtn, flex: 1, justifyContent: "center" }}
                disabled={busy || slides.length === 0}
                onClick={() => void publishRun()}
              >
                {publishBusy ? "Running..." : "Publish run"} <Kbd>⌘↵</Kbd>
              </button>
            </div>
            <div className="whisper">{"One bundle. No more " + Math.max(slides.length, 2) + " separate downloads."}</div>

            {/* activity log */}
            <div className="rise d6" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {log.length === 0 ? (
                <span className="whisper" style={{ fontSize: 11.5, color: "var(--dim)" }}>
                  The forge is quiet. No actions this session yet.
                </span>
              ) : (
                log.map((line, i) => (
                  <span key={i} style={monoDim}>
                    <b style={{ color: "var(--muted)", fontWeight: 500 }}>{line.slice(0, 5)}</b>
                    {line.slice(5)}
                  </span>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
