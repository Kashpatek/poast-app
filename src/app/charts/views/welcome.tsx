"use client";

// Welcome view · the first thing a user sees when they land on Studio
// with an empty library (or click "+ New" from elsewhere). Three big tiles
// pick a doc type; an "Upload from image" tile lets you paste/drop a
// screenshot and lands directly in the matching editor; recent docs sit
// below.

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, ImagePlus, Sparkles, Table2, Upload, Workflow, X } from "lucide-react";
import { D, ft, gf, mn } from "../studio-theme";
import { DocType, StudioDoc } from "../studio-types";

interface ParsedDoc {
  docType: "chart" | "table" | "diagram";
  name?: string;
  payload: Record<string, unknown>;
}

export default function WelcomeView({
  onPickType, onOpenDoc, onOpenLibrary, recent, userName, onParsedDoc,
}: {
  onPickType: (t: DocType) => void;
  onOpenDoc: (id: string) => void;
  onOpenLibrary: () => void;
  recent: StudioDoc[];
  userName: string;
  onParsedDoc?: (parsed: ParsedDoc) => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 28px 80px" }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: mn, fontSize: 10.5, letterSpacing: 2, fontWeight: 700, color: D.amber, textTransform: "uppercase", marginBottom: 8 }}>
          POAST Studio
        </div>
        <h1 style={{ fontFamily: gf, fontSize: 36, fontWeight: 900, letterSpacing: -1.2, color: D.tx, margin: 0, lineHeight: 1.1 }}>
          Make something, {userName}.
        </h1>
        <p style={{ fontFamily: ft, fontSize: 14.5, color: D.txm, marginTop: 10, maxWidth: 620, lineHeight: 1.5 }}>
          Charts, tables, diagrams — one workspace. Saved to your library, ready to come back to.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}>
        <TypeTile
          title="Chart"
          subtitle="18 types · stacked, lines, scatter, gantt, mekko"
          accent={D.amber}
          Icon={BarChart3}
          onClick={() => onPickType("chart")}
        />
        <TypeTile
          title="Table"
          subtitle="Edit data, export CSV, build chart from selection"
          accent={D.teal}
          Icon={Table2}
          onClick={() => onPickType("table")}
        />
        <TypeTile
          title="Diagram"
          subtitle="Flowcharts and wireframes, brand-styled"
          accent={D.blue}
          Icon={Workflow}
          onClick={() => onPickType("diagram")}
        />
      </div>

      {/* Wide hero tile for the image-upload entry point. Sits across
          the full row so it reads as a distinct second path: not "pick
          a type" but "drop a screenshot and we'll figure it out". */}
      {onParsedDoc && (
        <button
          onClick={() => setUploadOpen(true)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "18px 22px",
            background: "linear-gradient(120deg, " + D.violet + "12, " + D.amber + "0F)",
            border: "1px dashed " + D.violet + "66",
            borderRadius: 14,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 16,
            marginBottom: 44,
            transition: "border-color 0.18s, transform 0.18s, box-shadow 0.18s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = D.violet;
            e.currentTarget.style.boxShadow = "0 10px 28px rgba(0,0,0,0.4), 0 0 0 1px " + D.violet + "55";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = D.violet + "66";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 10,
            background: D.violet + "22", border: "1px solid " + D.violet + "55",
            flexShrink: 0,
          }}>
            <ImagePlus size={22} strokeWidth={2} color={D.violet} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.3, marginBottom: 3 }}>
              Upload from image
            </div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.45 }}>
              Drop a screenshot — we&apos;ll detect chart / table / diagram, pick the matching template, and fill in the data.
            </div>
          </div>
          <div style={{
            fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.violet,
            letterSpacing: 0.6, textTransform: "uppercase", flexShrink: 0,
          }}>
            <Sparkles size={11} strokeWidth={2.2} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Auto-parse
          </div>
        </button>
      )}

      {recent.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
              Recent
            </span>
            <button
              onClick={onOpenLibrary}
              style={{
                marginLeft: "auto",
                background: "transparent", border: "none", color: D.txm,
                fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
                textTransform: "uppercase", cursor: "pointer",
              }}
            >View library →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {recent.slice(0, 5).map((d) => <RecentCard key={d.id} doc={d} onOpen={() => onOpenDoc(d.id)} />)}
          </div>
        </div>
      )}

      {uploadOpen && onParsedDoc && (
        <UploadFromImageModal
          onClose={() => setUploadOpen(false)}
          onParsed={(p) => { setUploadOpen(false); onParsedDoc(p); }}
        />
      )}
    </div>
  );
}

// Modal owns: file picker, drag-and-drop zone, paste-from-clipboard,
// upload progress, and result preview before commit. The route does
// the parsing work; this just collects bytes and renders state.
function UploadFromImageModal({ onClose, onParsed }: {
  onClose: () => void;
  onParsed: (p: ParsedDoc) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("image/png");
  const [phase, setPhase] = useState<"idle" | "parsing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Escape closes; Cmd-V pastes image from clipboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    async function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) { void readFile(file); break; }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [onClose]);

  const readFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("That's not an image file.");
      setPhase("error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image is too large (max 5 MB). Try cropping or downscaling.");
      setPhase("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDataUrl(String(reader.result));
      setMediaType(file.type);
      setError(null);
      setPhase("idle");
    };
    reader.onerror = () => {
      setError("Couldn't read that file.");
      setPhase("error");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!dataUrl) return;
    setPhase("parsing");
    setError(null);
    try {
      const res = await fetch("/api/studio-image/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl, mediaType }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Parse failed");
        setPhase("error");
        return;
      }
      if (!j.parsed) {
        setError("Empty response from parser");
        setPhase("error");
        return;
      }
      onParsed(j.parsed as ParsedDoc);
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }, [dataUrl, mediaType, onParsed]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 580,
          background: "#0A0C10",
          border: "1px solid " + D.border, borderRadius: 14,
          boxShadow: "0 24px 56px rgba(0,0,0,0.7)",
          padding: "22px 24px",
          fontFamily: ft,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
          <div>
            <div style={{
              fontFamily: mn, fontSize: 9.5, color: D.violet,
              fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase",
              marginBottom: 4,
            }}>Upload from image</div>
            <h2 style={{
              margin: 0, fontFamily: gf, fontSize: 22, color: D.tx,
              fontWeight: 900, letterSpacing: -0.5,
            }}>Drop a screenshot.</h2>
            <p style={{
              margin: "6px 0 0", fontFamily: ft, fontSize: 12.5, color: D.txm, lineHeight: 1.5,
            }}>
              Tables, charts, or block diagrams. Cmd-V also works.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "transparent", border: "none", color: D.txm,
              cursor: "pointer", padding: 4,
            }}
            title="Close"
          ><X size={16} strokeWidth={2.2} /></button>
        </div>

        {/* Dropzone / preview */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void readFile(f);
          }}
          onClick={() => { if (!dataUrl) fileRef.current?.click(); }}
          style={{
            position: "relative",
            border: "2px dashed " + (dragOver ? D.amber : D.border),
            borderRadius: 12,
            padding: dataUrl ? 0 : "44px 20px",
            background: dragOver ? D.amber + "11" : "rgba(255,255,255,0.02)",
            cursor: dataUrl ? "default" : "pointer",
            transition: "border-color 0.12s, background 0.12s",
            minHeight: dataUrl ? "auto" : 180,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {dataUrl ? (
            <>
              <img src={dataUrl} alt="" style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "contain", background: "#000" }} />
              <button
                onClick={(e) => { e.stopPropagation(); setDataUrl(null); setPhase("idle"); setError(null); }}
                style={{
                  position: "absolute", top: 8, right: 8,
                  width: 26, height: 26, padding: 0,
                  background: "rgba(0,0,0,0.75)", color: "#FFF",
                  border: "1px solid " + D.border, borderRadius: "50%",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title="Pick a different image"
              ><X size={13} strokeWidth={2.4} /></button>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <Upload size={28} strokeWidth={1.6} color={D.txm} />
              <div style={{
                marginTop: 12,
                fontFamily: ft, fontSize: 13.5, color: D.txm, fontWeight: 600,
              }}>
                Drop a PNG, JPG, or WEBP — or click to browse.
              </div>
              <div style={{
                marginTop: 6,
                fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.6, textTransform: "uppercase",
              }}>Max 5 MB · Cmd-V to paste</div>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.currentTarget.value = "";
          }}
        />

        {error && (
          <div style={{
            marginTop: 12, padding: "9px 12px",
            background: D.coral + "1A", border: "1px solid " + D.coral + "55",
            borderRadius: 8,
            fontFamily: mn, fontSize: 11, color: D.coral, letterSpacing: 0.4,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={modalBtnStyle(false)}>Cancel</button>
          <button
            onClick={handleUpload}
            disabled={!dataUrl || phase === "parsing"}
            style={{
              ...modalBtnStyle(true),
              opacity: (!dataUrl || phase === "parsing") ? 0.55 : 1,
              cursor: (!dataUrl || phase === "parsing") ? "not-allowed" : "pointer",
            }}
          >
            {phase === "parsing" ? "Parsing…" : "Parse & open"}
          </button>
        </div>
      </div>
    </div>
  );
}

function modalBtnStyle(primary: boolean): React.CSSProperties {
  return {
    padding: "9px 14px",
    background: primary ? D.violet : "transparent",
    color: primary ? "#FFFFFF" : D.tx,
    border: "1px solid " + (primary ? D.violet : D.border),
    borderRadius: 8,
    fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
    textTransform: "uppercase", cursor: "pointer",
  };
}

function TypeTile({ title, subtitle, accent, Icon, onClick }: {
  title: string; subtitle: string; accent: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "22px 22px 24px",
        background: "linear-gradient(160deg, " + D.card + ", " + D.surface + ")",
        border: "1px solid " + D.border,
        borderRadius: 14,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.18s, transform 0.18s, box-shadow 0.18s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent + "66";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 36px rgba(0,0,0,0.5), 0 0 0 1px " + accent + "33";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = D.border;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        position: "absolute", top: -28, right: -28, width: 140, height: 140,
        borderRadius: "50%",
        background: "radial-gradient(circle, " + accent + "26 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 40, height: 40, borderRadius: 10,
        background: accent + "1A", border: "1px solid " + accent + "44",
        marginBottom: 14,
      }}>
        <Icon size={20} strokeWidth={2} color={accent} />
      </div>
      <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.4, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontFamily: ft, fontSize: 12.5, color: D.txm, lineHeight: 1.45 }}>
        {subtitle}
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        marginTop: 16,
        fontFamily: mn, fontSize: 10, fontWeight: 700, color: accent,
        letterSpacing: 0.6, textTransform: "uppercase",
      }}>
        <Sparkles size={11} strokeWidth={2.2} /> New {title.toLowerCase()}
      </div>
    </button>
  );
}

function RecentCard({ doc, onOpen }: { doc: StudioDoc; onOpen: () => void }) {
  const typeColor = doc.type === "chart" ? D.amber : doc.type === "table" ? D.teal : D.blue;
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: "left",
        padding: 0,
        background: D.card, border: "1px solid " + D.border,
        borderRadius: 10, overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.14s, transform 0.14s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = typeColor + "66"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{
        height: 96, background: D.bg,
        backgroundImage: doc.thumbnail ? `url(${doc.thumbnail})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid " + D.border,
      }}>
        {!doc.thumbnail && (
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>no preview</span>
        )}
      </div>
      <div style={{ padding: "9px 11px" }}>
        <div style={{
          fontFamily: ft, fontSize: 12.5, fontWeight: 600, color: D.tx,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{doc.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{
            fontFamily: mn, fontSize: 8.5, fontWeight: 700, color: typeColor,
            letterSpacing: 0.6, textTransform: "uppercase",
          }}>{doc.type}</span>
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>· {fmtRelative(doc.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

function fmtRelative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const delta = Date.now() - then;
  const m = Math.round(delta / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.round(h / 24);
  return d + "d ago";
}
