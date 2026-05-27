"use client";

// Rebuild from Image — upload a screenshot of an old chart or table,
// Claude's vision extracts the structure as JSON, then we route to:
//   chart  → /charts with the data pre-loaded into Chart Maker 2
//   table  → a new DocuDesign doc with the table baked in

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../../shared-constants";
import { useToast } from "../../toast-context";
import { WizardShell, wizardLabel, wizardInput } from "./wizard-shell";

interface ChartColumn { key: string; label: string; type: "text" | "number" | "date" | "percent" }
interface Chart {
  chartType: string;
  title: string;
  subtitle: string;
  columns: ChartColumn[];
  rows: Array<Record<string, string | number | null>>;
  notes?: string;
}
interface Table {
  title: string;
  headers: string[];
  rows: string[][];
  notes?: string;
}
interface Extracted {
  kind: "chart" | "table" | "unknown";
  chart?: Chart;
  table?: Table;
  reason?: string;
}

interface RebuildWizardProps { open: boolean; onClose: () => void }

export function RebuildWizard({ open, onClose }: RebuildWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep(0);
    setImageFile(null);
    setImageUrl("");
    setExtracting(false);
    setExtracted(null);
    setErr(null);
    setSubmitting(false);
  }
  function close() {
    if (extracting || submitting) return;
    reset();
    onClose();
  }

  function loadFile(file: File) {
    if (!/^image\//.test(file.type)) { showToast("File must be an image"); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function extract() {
    if (!imageUrl || extracting) return;
    setExtracting(true);
    setErr(null);
    setExtracted(null);
    try {
      const res = await fetch("/api/design-studio/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Extraction failed"); return; }
      setExtracted(j as Extracted);
      setStep(1);
    } catch (e) {
      setErr(String(e));
    } finally {
      setExtracting(false);
    }
  }

  async function openInChartMaker() {
    if (!extracted?.chart) return;
    try {
      // Hand the extraction off to Chart Maker via localStorage. Chart
      // Maker reads `cm2-import-pending` on mount and applies it.
      window.localStorage.setItem("cm2-import-pending", JSON.stringify({
        ts: Date.now(),
        chartType: extracted.chart.chartType,
        title: extracted.chart.title,
        subtitle: extracted.chart.subtitle,
        sheet: {
          schema: extracted.chart.columns,
          rows: extracted.chart.rows,
        },
      }));
    } catch (e) { showToast("Couldn't stash import: " + String(e)); return; }
    reset();
    onClose();
    router.push("/charts");
  }

  async function openAsDoc() {
    if (!extracted?.table || submitting) return;
    setSubmitting(true);
    try {
      const t = extracted.table;
      // Build a brief that the DocuDesign canvas understands. We seed
      // the project with a recreated table as the initial artboard
      // content via the `keyPoints` field (canvas reads keyPoints and
      // formats them — for a table we pre-format as a markdown table).
      const md = renderTableMarkdown(t);
      const payload = {
        name: t.title || "Rebuilt table",
        type: "document" as const,
        fidelity: "high" as const,
        size_preset: "us-letter-screen",
        purpose: "one-pager",
        category: "one-pager",
        brief: {
          title: t.title || "Rebuilt table",
          keyPoints: [md],
          context: "Recreated from an uploaded image. The original markdown table is in keyPoints. Notes from extraction: " + (t.notes || "—"),
        },
        format: "svg" as const,
      };
      const res = await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { showToast(j.error || "Couldn't open as doc"); setSubmitting(false); return; }
      const id = j.data?.id;
      reset();
      onClose();
      if (id) router.push(`/design-studio/p/${id}`);
    } catch (e) {
      showToast(String(e));
      setSubmitting(false);
    }
  }

  return (
    <WizardShell
      open={open}
      title={step === 0 ? "Rebuild a chart or table" : "Review what we extracted"}
      badge="REBUILD"
      step={step}
      totalSteps={2}
      canGoNext={step === 0 ? !!imageUrl && !extracting : !!extracted}
      isFinalStep={step === 1}
      finalLabel={extracted?.kind === "chart" ? (submitting ? "Opening…" : "Open in Chart Maker") : extracted?.kind === "table" ? (submitting ? "Creating doc…" : "Open as DocuDesign doc") : "—"}
      onBack={() => setStep(0)}
      onNext={() => {
        if (step === 0) { extract(); return; }
        if (extracted?.kind === "chart") openInChartMaker();
        else if (extracted?.kind === "table") openAsDoc();
      }}
      onClose={close}
    >
      {step === 0 ? (
        <UploadStep
          imageFile={imageFile}
          imageUrl={imageUrl}
          extracting={extracting}
          err={err}
          onLoadFile={loadFile}
          onClear={() => { setImageFile(null); setImageUrl(""); setErr(null); }}
        />
      ) : (
        <ReviewStep extracted={extracted} err={err} imageUrl={imageUrl} />
      )}
    </WizardShell>
  );
}

// ── Step 0 ──────────────────────────────────────────────────────────
function UploadStep({ imageFile, imageUrl, extracting, err, onLoadFile, onClear }: { imageFile: File | null; imageUrl: string; extracting: boolean; err: string | null; onLoadFile: (f: File) => void; onClear: () => void }) {
  return (
    <div>
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginBottom: 14, lineHeight: 1.5 }}>
        Drop a screenshot of any chart or table — even old, ugly, or low-res. We'll vision-extract the structure and rebuild it cleanly. Charts route to <strong style={{ color: D.tx }}>Chart Maker</strong>, tables open as a <strong style={{ color: D.tx }}>DocuDesign doc</strong>.
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.amber; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = D.border; }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.border; const f = e.dataTransfer.files?.[0]; if (f) onLoadFile(f); }}
        style={{ display: "block", border: `1px dashed ${D.border}`, borderRadius: 10, padding: imageUrl ? 0 : 40, background: D.surface, textAlign: "center", cursor: "pointer", marginBottom: 12, overflow: "hidden" }}
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt="upload preview" style={{ width: "100%", maxHeight: 380, objectFit: "contain", display: "block" }} />
        ) : (
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.6 }}>
            Drop a chart / table screenshot here<br />
            <span style={{ color: D.txd, fontSize: 11 }}>or click to choose · PNG / JPG / WEBP</span>
          </div>
        )}
        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLoadFile(f); }} style={{ display: "none" }} />
      </label>
      {imageFile ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.3 }}>{imageFile.name}</span>
          <button type="button" onClick={onClear} style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>Remove</button>
        </div>
      ) : null}
      {extracting ? (
        <div style={{ fontFamily: mn, fontSize: 12, color: D.amber, padding: "8px 12px", background: D.amber + "10", border: `1px solid ${D.amber}55`, borderRadius: 8, letterSpacing: 0.3 }}>
          Vision-reading the image — this takes 10-20 seconds for a complex chart.
        </div>
      ) : null}
      {err ? (
        <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, padding: "8px 12px", background: "rgba(224,99,71,0.08)", border: `1px solid ${D.coral}55`, borderRadius: 8 }}>{err}</div>
      ) : null}
    </div>
  );
}

// ── Step 1 ──────────────────────────────────────────────────────────
function ReviewStep({ extracted, err, imageUrl }: { extracted: Extracted | null; err: string | null; imageUrl: string }) {
  if (err) return <div style={{ fontFamily: mn, fontSize: 12, color: D.coral }}>{err}</div>;
  if (!extracted) return <div style={{ fontFamily: mn, fontSize: 12, color: D.txm }}>No extraction yet.</div>;

  if (extracted.kind === "unknown") {
    return (
      <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, padding: 20, lineHeight: 1.6 }}>
        We couldn't identify a chart or table in this image. {extracted.reason ? `Reason: ${extracted.reason}` : ""} Try a clearer crop, or a different screenshot.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      <div>
        <div style={wizardLabel}>Original</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="original" style={{ width: "100%", maxHeight: 380, objectFit: "contain", display: "block", border: `1px solid ${D.border}`, borderRadius: 8 }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={wizardLabel}>What we got</div>
        {extracted.kind === "chart" && extracted.chart ? <ChartPreview chart={extracted.chart} /> : null}
        {extracted.kind === "table" && extracted.table ? <TablePreview table={extracted.table} /> : null}
      </div>
    </div>
  );
}

function ChartPreview({ chart }: { chart: Chart }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={pill(D.amber)}>{chart.chartType}</span>
        <span style={pill(D.txm)}>{chart.columns.length - 1} series · {chart.rows.length} categories</span>
      </div>
      {chart.title ? <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: D.tx, marginBottom: 2 }}>{chart.title}</div> : null}
      {chart.subtitle ? <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, marginBottom: 10 }}>{chart.subtitle}</div> : null}
      <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${D.border}`, borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mn, fontSize: 11 }}>
          <thead>
            <tr style={{ background: D.bg }}>
              {chart.columns.map((c) => (
                <th key={c.key} style={{ padding: "6px 8px", textAlign: "left", color: D.txd, fontWeight: 700, letterSpacing: 0.4, borderBottom: `1px solid ${D.border}` }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${D.border}` }}>
                {chart.columns.map((c) => (
                  <td key={c.key} style={{ padding: "5px 8px", color: D.tx }}>{r[c.key] === null || r[c.key] === undefined ? <span style={{ color: D.coral }}>—</span> : String(r[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chart.notes ? <div style={noteBox}>{chart.notes}</div> : null}
    </div>
  );
}

function TablePreview({ table }: { table: Table }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <span style={pill(D.blue)}>table</span>
        <span style={pill(D.txm)}>{table.rows.length} rows · {table.headers.length} cols</span>
      </div>
      {table.title ? <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: D.tx, marginBottom: 10 }}>{table.title}</div> : null}
      <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${D.border}`, borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mn, fontSize: 11 }}>
          <thead>
            <tr style={{ background: D.bg }}>
              {table.headers.map((h, i) => (
                <th key={i} style={{ padding: "6px 8px", textAlign: "left", color: D.txd, fontWeight: 700, letterSpacing: 0.4, borderBottom: `1px solid ${D.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: `1px solid ${D.border}` }}>
                {row.map((cell, ci) => <td key={ci} style={{ padding: "5px 8px", color: D.tx, whiteSpace: "pre-wrap" }}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.notes ? <div style={noteBox}>{table.notes}</div> : null}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────
function renderTableMarkdown(t: Table): string {
  const head = "| " + t.headers.join(" | ") + " |";
  const sep = "| " + t.headers.map(() => "---").join(" | ") + " |";
  const body = t.rows.map((r) => "| " + r.map((c) => (c ?? "").replace(/\|/g, "\\|")).join(" | ") + " |").join("\n");
  return [t.title ? "## " + t.title : "", head, sep, body].filter(Boolean).join("\n");
}

function pill(color: string): React.CSSProperties {
  return { fontFamily: mn, fontSize: 9, padding: "2px 8px", borderRadius: 3, background: color + "22", color: color, border: `1px solid ${color}55`, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 };
}
const noteBox: React.CSSProperties = { marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txm, lineHeight: 1.5, padding: "8px 10px", background: D.bg, border: `1px dashed ${D.border}`, borderRadius: 6, letterSpacing: 0.2 };
// Suppress unused import warning when wizardInput isn't referenced — kept
// for future "edit before opening" iterations.
void wizardInput;
