"use client";

// ─── SemiAnalysis Asset Library ──────────────────────────────────────
// Native React rewrite that replaces the old /asset-library-content.html
// iframe shell. Five sections (logo set, brand palette, font specimens,
// brand guide link, drag-drop upload). Card UX mirrors the dashboard
// (D tokens, JetBrains-Mono uppercase section headers, amber accent).
//
// Note: react-colorful and react-dropzone are NOT installed in this repo
// (despite the plan note). We use a native <input type="color"> for the
// custom-shade picker and the HTML5 drag-and-drop API for the upload
// zone. Same UX, zero extra deps, identical to the pattern used in
// broll-library.tsx.

import { useRef, useState } from "react";
import { D, ft, mn, copyText, uid } from "../shared-constants";
import { useToast } from "../toast-context";

// ─── Static data ──────────────────────────────────────────────────────
interface LogoEntry { src: string; filename: string; note?: string; }
interface SwatchEntry { name: string; hex: string; note: string; }

const LOGOS: LogoEntry[] = [
  { src: "/sa-lettermark-text.svg", filename: "sa-lettermark-text.svg", note: "Current wordmark" },
  { src: "/sa-box-lettermark.svg",  filename: "sa-box-lettermark.svg",  note: "Box lettermark" },
  { src: "/sa-logo-full.svg",       filename: "sa-logo-full.svg",       note: "Full color logo" },
  { src: "/sa-logo.svg",            filename: "sa-logo.svg",            note: "Mono logo" },
  { src: "/poast-logo.png",         filename: "poast-logo.png",         note: "POAST app mark" },
  { src: "/box-logo.png",           filename: "box-logo.png",           note: "Box raster mark" },
];

const SWATCHES: SwatchEntry[] = [
  { name: "Amber",  hex: "#F7B041", note: "Primary accent" },
  { name: "Cobalt", hex: "#0B86D1", note: "Secondary" },
  { name: "Mint",   hex: "#2EAD8E", note: "Positive / data" },
  { name: "Coral",  hex: "#E06347", note: "Alert / coral" },
  { name: "Slate",  hex: "#3D3D3D", note: "Neutral dark" },
  { name: "Metal",  hex: "#969696", note: "Neutral mid" },
];

interface FontSpec { label: string; family: string; sample: string; installed: boolean; }
const FONT_SPECS: FontSpec[] = [
  { label: "Grift",         family: "'Grift','Outfit',sans-serif",        sample: "SemiAnalysis decodes silicon.", installed: false },
  { label: "Outfit",        family: "'Outfit',sans-serif",                sample: "SemiAnalysis decodes silicon.", installed: true  },
  { label: "JetBrains Mono", family: "'JetBrains Mono',monospace",         sample: "0123 NVDA / TSM / ASML",          installed: true  },
];

const FONT_SIZES = [12, 16, 24, 48];

// Served from /public so browsers can actually navigate to it (a
// file:// URL from an http(s) origin is blocked by Chrome/Safari/FF).
// Original lives at /Users/akashpatel/Desktop/SEMIANALYSIS/Brand/
// Brand 2026 Launch/Brand and Guidelines/SemiAnalysis Brand Guide.pdf.
const BRAND_GUIDE_PDF = "/sa-brand-guide.pdf";

// ─── Auto-tag from extension ─────────────────────────────────────────
function categorise(filename: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp" || ext === "gif") return "image";
  if (ext === "svg") return "logo";
  if (ext === "pdf") return "document";
  if (ext === "ttf" || ext === "otf" || ext === "woff" || ext === "woff2") return "font";
  return "other";
}

// ─── Reusable section header ─────────────────────────────────────────
function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{kicker}</div>
      <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 800, color: D.tx, letterSpacing: -0.4 }}>{title}</div>
      {sub ? <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 4, maxWidth: 640, lineHeight: 1.5 }}>{sub}</div> : null}
    </div>
  );
}

// ─── Logo card ───────────────────────────────────────────────────────
function LogoCard({ entry, onCopy }: { entry: LogoEntry; onCopy: (url: string) => void }) {
  const [light, setLight] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: D.cardGrad,
        border: "1px solid " + (hover ? D.amber + "33" : D.border),
        borderRadius: 12, overflow: "hidden", transition: "border-color 0.2s",
      }}
    >
      <div style={{
        position: "relative", width: "100%", paddingTop: "62%",
        background: light ? "#EFEAE2" : "#06060A", borderBottom: "1px solid " + D.border,
      }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.src} alt={entry.filename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
        <button
          type="button"
          onClick={() => setLight((v) => !v)}
          style={{
            position: "absolute", top: 8, right: 8,
            padding: "4px 9px", borderRadius: 6,
            background: "rgba(0,0,0,0.55)", border: "1px solid " + D.border,
            color: D.tx, fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
            textTransform: "uppercase", cursor: "pointer",
          }}
        >{light ? "Dark" : "Light"} bg</button>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.tx, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.filename}</div>
        {entry.note ? <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, marginBottom: 8 }}>{entry.note}</div> : null}
        <button
          type="button"
          onClick={() => onCopy(entry.src)}
          style={{
            width: "100%", padding: "7px 0", borderRadius: 8,
            border: "1px solid " + D.amber + "40", background: "transparent", color: D.amber,
            fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3,
          }}
        >Copy URL</button>
      </div>
    </div>
  );
}

// ─── Swatch card ─────────────────────────────────────────────────────
function SwatchCard({ entry, onCopy }: { entry: SwatchEntry; onCopy: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(entry.hex);
  return (
    <div style={{ background: D.cardGrad, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ height: 96, background: entry.hex }} />
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: D.tx }}>{entry.name}</div>
          <div style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{entry.hex}</div>
        </div>
        <div style={{ fontFamily: ft, fontSize: 11, color: D.txd, marginBottom: 10 }}>{entry.note}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => onCopy(entry.hex)}
            style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid " + D.amber + "40", background: "transparent", color: D.amber, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >Copy hex</button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid " + D.border, background: "transparent", color: D.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >{open ? "Close" : "Pick"}</button>
        </div>
        {open ? (
          <div style={{ marginTop: 10, padding: 10, background: D.surface, border: "1px solid " + D.border, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input
                type="color"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                style={{ width: 40, height: 40, border: "none", background: "transparent", cursor: "pointer" }}
              />
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid " + D.border, background: D.card, color: D.tx, fontFamily: mn, fontSize: 11, outline: "none" }}
              />
            </div>
            <button
              type="button"
              onClick={() => onCopy(custom)}
              style={{ width: "100%", padding: "6px 0", borderRadius: 6, border: "1px solid " + D.amber + "40", background: "transparent", color: D.amber, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >Copy {custom}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Font specimen block ─────────────────────────────────────────────
function FontBlock({ spec }: { spec: FontSpec }) {
  return (
    <div style={{ background: D.cardGrad, border: "1px solid " + D.border, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.2 }}>{spec.label}</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: spec.installed ? D.teal : D.amber, letterSpacing: 1.2, textTransform: "uppercase" }}>
          {spec.installed ? "Loaded" : "Fallback"}
        </div>
      </div>
      {!spec.installed ? (
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginBottom: 12, padding: "6px 10px", background: D.surface, border: "1px dashed " + D.border, borderRadius: 6 }}>
          Grift not installed in app — system fallback shown.
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {FONT_SIZES.map((sz) => (
          <div key={sz} style={{ borderTop: "1px solid " + D.border, paddingTop: 12 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1, marginBottom: 4 }}>{sz}px</div>
            <div style={{ fontFamily: spec.family, fontSize: sz, color: D.tx, lineHeight: 1.2 }}>{spec.sample}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Brand guide card ────────────────────────────────────────────────
function BrandGuideCard() {
  const [copied, setCopied] = useState(false);
  function copyPath() {
    if (copyText(BRAND_GUIDE_PDF)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }
  return (
    <div style={{ background: D.cardGrad, border: "1px solid " + D.border, borderRadius: 12, padding: "20px 22px", display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: D.amber + "18", border: "1px solid " + D.amber + "55",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: mn, fontSize: 11, fontWeight: 800, color: D.amber, letterSpacing: 1,
      }}>PDF</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: D.tx, marginBottom: 2 }}>SemiAnalysis Brand Guide</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{BRAND_GUIDE_PDF}</div>
      </div>
      <button
        type="button"
        onClick={copyPath}
        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid " + D.border, background: "transparent", color: D.txm, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 }}
      >{copied ? "Copied" : "Copy path"}</button>
      <a
        href={BRAND_GUIDE_PDF}
        target="_blank"
        rel="noreferrer"
        style={{
          padding: "8px 16px", borderRadius: 8, textDecoration: "none",
          border: "1px solid " + D.amber + "55", background: D.amber + "18", color: D.amber,
          fontFamily: ft, fontSize: 12, fontWeight: 800, letterSpacing: 0.3, cursor: "pointer",
        }}
      >Open PDF ↗</a>
    </div>
  );
}

// ─── Upload zone ─────────────────────────────────────────────────────
interface UploadedAsset { id: string; url: string; filename: string; category: string; size: number; ts: number; }

function UploadZone({ onUploaded, onToast }: { onUploaded: (a: UploadedAsset) => void; onToast: (m: string) => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setBusy(true);
    let done = 0;
    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result;
        const ext = (f.name.split(".").pop() || "bin").toLowerCase();
        const cat = categorise(f.name);
        fetch("/api/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64, filename: "asset-library/" + cat + "/" + uid("a") + "." + ext, contentType: f.type || "application/octet-stream" }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.url) {
              onUploaded({ id: uid("up"), url: res.url, filename: f.name, category: cat, size: res.size || f.size, ts: Date.now() });
              onToast("Uploaded " + f.name + " (" + cat + ")");
            } else {
              onToast("Upload failed: " + f.name);
            }
          })
          .catch(() => onToast("Upload failed: " + f.name))
          .finally(() => {
            done += 1;
            if (done === arr.length) setBusy(false);
          });
      };
      reader.onerror = () => {
        done += 1;
        if (done === arr.length) setBusy(false);
      };
      reader.readAsDataURL(f);
    });
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => fileRef.current && fileRef.current.click()}
      style={{
        border: "2px dashed " + (drag ? D.amber : D.border),
        borderRadius: 14, padding: "42px 24px", textAlign: "center", cursor: "pointer",
        background: drag ? D.amber + "0A" : D.surface, transition: "all 0.2s",
      }}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.svg,.ttf,.otf,.woff,.woff2"
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: "none" }}
      />
      <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
        {busy ? "Uploading…" : drag ? "Drop to upload" : "Brand asset upload"}
      </div>
      <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 700, color: D.tx, marginBottom: 4 }}>
        Drop new brand assets here
      </div>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.txm }}>
        Auto-tags by extension · svg/png/jpg → logo / image · pdf → document · ttf/woff → font
      </div>
    </div>
  );
}

// ─── Uploaded list ───────────────────────────────────────────────────
function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function UploadedRow({ asset, onCopy }: { asset: UploadedAsset; onCopy: (url: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: D.surface, border: "1px solid " + D.border, borderRadius: 10 }}>
      <span style={{ padding: "3px 8px", borderRadius: 6, background: D.amber + "22", color: D.amber, fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{asset.category}</span>
      <div style={{ flex: 1, minWidth: 0, fontFamily: ft, fontSize: 12, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.filename}</div>
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{fmtSize(asset.size)}</span>
      <button
        type="button"
        onClick={() => onCopy(asset.url)}
        style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid " + D.amber + "40", background: "transparent", color: D.amber, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
      >Copy URL</button>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────
export function AssetLibraryView() {
  const { showToast } = useToast();
  const [uploaded, setUploaded] = useState<UploadedAsset[]>([]);

  function copy(text: string) {
    if (copyText(text)) showToast("Copied " + text);
    else showToast("Copy failed");
  }

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "44px 32px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: D.amber + "1A", border: "1px solid " + D.amber + "55", marginBottom: 14 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: "0 0 8px " + D.amber }} />
            <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>Asset Library</span>
          </div>
          <h1 style={{ fontFamily: ft, fontSize: 44, fontWeight: 900, letterSpacing: -1.4, margin: 0, marginBottom: 6, color: D.tx }}>SemiAnalysis Brand</h1>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, maxWidth: 720, lineHeight: 1.5 }}>
            Logos, palette, type, and the brand guide. Drop new assets in the upload zone — they’re auto-tagged and uploaded to blob storage.
          </div>
        </div>

        {/* Logo set */}
        <section style={{ marginBottom: 44 }}>
          <SectionHeader kicker="01 / Logos" title="Logo set" sub="Lettermarks, box marks, and full-color variants. Toggle dark/light background per card." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {LOGOS.map((l) => <LogoCard key={l.filename} entry={l} onCopy={copy} />)}
          </div>
        </section>

        {/* Brand palette */}
        <section style={{ marginBottom: 44 }}>
          <SectionHeader kicker="02 / Palette" title="Brand palette" sub="Core SA hex tokens. Click Pick to dial a custom shade and copy it." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 16 }}>
            {SWATCHES.map((s) => <SwatchCard key={s.name} entry={s} onCopy={copy} />)}
          </div>
        </section>

        {/* Font specimens */}
        <section style={{ marginBottom: 44 }}>
          <SectionHeader kicker="03 / Type" title="Font specimens" sub="Display, body, and mono. Sizes 12 / 16 / 24 / 48." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {FONT_SPECS.map((f) => <FontBlock key={f.label} spec={f} />)}
          </div>
        </section>

        {/* Brand guide */}
        <section style={{ marginBottom: 44 }}>
          <SectionHeader kicker="04 / Reference" title="Brand guide" sub="Source-of-truth PDF on the design lead’s desktop." />
          <BrandGuideCard />
        </section>

        {/* Upload zone */}
        <section>
          <SectionHeader kicker="05 / Intake" title="Upload" sub="Drop new logo, image, document, or font files. They’re tagged by extension and pushed to blob storage." />
          <UploadZone onUploaded={(a) => setUploaded((p) => [a, ...p])} onToast={showToast} />
          {uploaded.length > 0 ? (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>This session</div>
              {uploaded.map((a) => <UploadedRow key={a.id} asset={a} onCopy={copy} />)}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
