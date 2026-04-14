// @ts-nocheck
"use client";
import { useState } from "react";

var C = {
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A",
  bg: "#06060C", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

// SA Carousel Schema v1.0 -- slide backgrounds
var BG_DARK = "radial-gradient(ellipse at bottom left, #3D2800, #1A1200)";
var BG_LIGHT = "radial-gradient(ellipse at center, #2A1800, #1A1200)";

var SLIDE_META = {
  COVER: { label: "Cover", color: C.amber, bg: BG_DARK, hasArrow: true },
  BODY_A: { label: "Body A", color: "#fff", bg: BG_DARK, hasArrow: true },
  BODY_B: { label: "Body B", color: "#fff", bg: BG_LIGHT, hasArrow: true },
  BODY_FINAL: { label: "Body Final", color: "#fff", bg: BG_DARK, hasArrow: false },
  BODY_IMAGE: { label: "Body + Image", color: "#fff", bg: BG_DARK, hasArrow: true },
  BODY_LARGE_IMAGE: { label: "Large Image", color: "#fff", bg: BG_DARK, hasArrow: false },
};

var CATEGORIES = [
  { id: "general", label: "General", desc: "Industry news, trends, analysis", color: "#D4A853" },
  { id: "internal", label: "Internal", desc: "SA original research and findings", color: "#F7B041" },
  { id: "external", label: "External", desc: "Third-party content with SA commentary", color: "#0B86D1" },
  { id: "capital", label: "Capital", desc: "Financial and investment analysis", color: "#2EAD8E" },
];

var STEPS = ["Input", "Generate", "Select", "Caption", "Export"];

function StepBar({ step, setStep, maxStep }) {
  return <div style={{ display: "flex", gap: 0, marginBottom: 28 }}>
    {STEPS.map(function(s, i) {
      var done = i < step;
      var active = i === step;
      var locked = i > maxStep;
      return <div key={s} onClick={function() { if (!locked) setStep(i); }} style={{ flex: 1, position: "relative", cursor: locked ? "default" : "pointer", opacity: locked ? 0.3 : 1 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? C.amber : active ? C.amber + "25" : C.card, border: "2px solid " + (done || active ? C.amber : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 11, fontWeight: 700, color: done ? C.bg : active ? C.amber : C.txd, transition: "all 0.3s", boxShadow: active ? "0 0 16px " + C.amber + "30" : "none" }}>
            {done ? "\u2713" : i + 1}
          </div>
          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: done ? C.amber + "50" : C.border, margin: "0 -1px" }} />}
        </div>
        <div style={{ fontFamily: ft, fontSize: 10, fontWeight: active ? 700 : 500, color: active ? C.amber : done ? C.tx : C.txd, marginTop: 6 }}>{s}</div>
      </div>;
    })}
  </div>;
}

// ═══ SLIDE PREVIEW (mimics 1080x1350 at small scale) ═══
function SlidePreview({ slide, index, small }) {
  var meta = SLIDE_META[slide.type] || SLIDE_META.BODY_A;
  var scale = small ? 0.55 : 1;
  var w = 180 * scale;
  var h = 225 * scale;

  return <div style={{ width: w, height: h, borderRadius: 8 * scale, overflow: "hidden", position: "relative", background: meta.bg, border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
    {/* Grid overlay */}
    <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: (20 * scale) + "px " + (20 * scale) + "px", pointerEvents: "none" }} />
    {/* SA logo bug top-right */}
    <div style={{ position: "absolute", top: 4 * scale, right: 4 * scale, fontFamily: mn, fontSize: 6 * scale, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>SA</div>

    {slide.type === "COVER" && <div style={{ padding: 8 * scale, display: "flex", flexDirection: "column", height: "100%" }}>
      {slide.image_url && <div style={{ width: "100%", height: "40%", borderRadius: 6 * scale, background: "rgba(255,255,255,0.08)", marginBottom: 6 * scale, overflow: "hidden" }}>
        <img src={slide.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={function(e) { e.target.style.display = "none"; }} />
      </div>}
      {!slide.image_url && <div style={{ width: "100%", height: "40%", borderRadius: 6 * scale, background: "rgba(255,255,255,0.05)", marginBottom: 6 * scale, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: mn, fontSize: 7 * scale, color: "rgba(255,255,255,0.15)" }}>IMAGE</span>
      </div>}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ fontFamily: ft, fontSize: 11 * scale, fontWeight: 800, color: C.amber, lineHeight: 1.2, marginBottom: 3 * scale }}>{slide.title || "Title"}</div>
        <div style={{ fontFamily: ft, fontSize: 7 * scale, color: "rgba(255,255,255,0.7)", lineHeight: 1.3 }}>{(slide.subtitle || "").slice(0, 60)}{(slide.subtitle || "").length > 60 ? "..." : ""}</div>
      </div>
    </div>}

    {(slide.type === "BODY_A" || slide.type === "BODY_B" || slide.type === "BODY_FINAL") && <div style={{ padding: 8 * scale, display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
      <div style={{ fontFamily: ft, fontSize: 7 * scale, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>{(slide.body_text || "").slice(0, 120)}{(slide.body_text || "").length > 120 ? "..." : ""}</div>
    </div>}

    {slide.type === "BODY_IMAGE" && <div style={{ padding: 8 * scale, height: "100%" }}>
      <div style={{ width: "100%", height: "40%", borderRadius: 6 * scale, background: "rgba(255,255,255,0.05)", marginBottom: 4 * scale, overflow: "hidden" }}>
        {slide.image_url && <img src={slide.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={function(e) { e.target.style.display = "none"; }} />}
      </div>
      <div style={{ fontFamily: ft, fontSize: 6 * scale, color: "rgba(255,255,255,0.8)", lineHeight: 1.3 }}>{(slide.body_text || "").slice(0, 80)}</div>
    </div>}

    {slide.type === "BODY_LARGE_IMAGE" && <div style={{ padding: 8 * scale, height: "100%" }}>
      <div style={{ width: "100%", height: "80%", borderRadius: 6 * scale, background: "rgba(255,255,255,0.05)", marginBottom: 4 * scale, overflow: "hidden" }}>
        {slide.image_url && <img src={slide.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={function(e) { e.target.style.display = "none"; }} />}
      </div>
      <div style={{ fontFamily: ft, fontSize: 6 * scale, color: "rgba(255,255,255,0.6)", lineHeight: 1.2 }}>{slide.subtext || ""}</div>
    </div>}

    {/* Arrow CTA bottom-right */}
    {meta.hasArrow && <div style={{ position: "absolute", bottom: 6 * scale, right: 6 * scale, width: 16 * scale, height: 10 * scale, borderRadius: 5 * scale, background: C.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 7 * scale, color: "#1A1200" }}>\u2192</span>
    </div>}

    {/* Type badge */}
    <div style={{ position: "absolute", top: 4 * scale, left: 4 * scale, fontFamily: mn, fontSize: 5 * scale, color: slide.type === "COVER" ? C.amber : "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.5 }}>{index + 1}</div>
  </div>;
}

// ═══ STEP 0: INPUT ═══
function InputStep({ state, setState, onNext }) {
  var _dragging = useState(false), dragging = _dragging[0], setDragging = _dragging[1];

  function handleFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) { setState(function(s) { return Object.assign({}, s, { text: e.target.result, fileName: file.name }); }); };
    reader.readAsText(file);
  }

  return <div>
    <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Content Input</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Paste Content / Context to generate carousel slides following SA Schema v1.0.</div>

    {/* Category */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Category</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
      {CATEGORIES.map(function(cat) {
        var sel = state.category === cat.id;
        return <div key={cat.id} onClick={function() { setState(function(s) { return Object.assign({}, s, { category: cat.id }); }); }} style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", background: sel ? cat.color + "10" : C.card, border: "1px solid " + (sel ? cat.color : C.border), transition: "all 0.2s" }} onMouseEnter={function(e) { if (!sel) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"; } }} onMouseLeave={function(e) { if (!sel) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; } }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: sel ? cat.color : C.border, boxShadow: sel ? "0 0 8px " + cat.color + "60" : "none" }} />
            <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: sel ? cat.color : C.tx }}>{cat.label}</div>
          </div>
          <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, paddingLeft: 18, marginTop: 2 }}>{cat.desc}</div>
        </div>;
      })}
    </div>

    {/* Slide count */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Slide Count</div>
    <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
      <div onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "auto" }); }); }} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, cursor: "pointer", background: state.mode === "auto" ? C.amber + "10" : C.card, border: "1px solid " + (state.mode === "auto" ? C.amber : C.border), transition: "all 0.2s" }} onMouseEnter={function(e) { if (state.mode !== "auto") { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; } }} onMouseLeave={function(e) { if (state.mode !== "auto") { e.currentTarget.style.borderColor = C.border; } }}>
        <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: state.mode === "auto" ? C.amber : C.tx }}>Auto</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>AI decides (3-6 slides)</div>
      </div>
      <div onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "manual" }); }); }} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, cursor: "pointer", background: state.mode === "manual" ? C.amber + "10" : C.card, border: "1px solid " + (state.mode === "manual" ? C.amber : C.border), transition: "all 0.2s" }} onMouseEnter={function(e) { if (state.mode !== "manual") { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; } }} onMouseLeave={function(e) { if (state.mode !== "manual") { e.currentTarget.style.borderColor = C.border; } }}>
        <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: state.mode === "manual" ? C.amber : C.tx }}>Manual</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Set exact total count</div>
      </div>
    </div>
    {state.mode === "manual" && <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <input type="range" min={1} max={8} value={state.pageCount || 4} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { pageCount: parseInt(e.target.value) }); }); }} style={{ flex: 1, accentColor: C.amber }} />
      <div style={{ fontFamily: mn, fontSize: 18, fontWeight: 700, color: C.amber, width: 30, textAlign: "center" }}>{state.pageCount || 4}</div>
    </div>}

    {/* Image URLs + Upload */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Images: URL or Upload</div>
    <textarea value={state.imageUrls || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { imageUrls: e.target.value }); }); }} placeholder="https://cdn.semianalysis.com/images/example.png" rows={3} style={{ width: "100%", padding: "10px 14px", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: mn, fontSize: 12, lineHeight: 1.6, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 10 }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
    <div onDragOver={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.background = C.amber + "08"; }} onDragLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; }} onDrop={function(e) { e.preventDefault(); e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; var files = Array.prototype.slice.call(e.dataTransfer.files); files.forEach(function(file) { if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) return; var reader = new FileReader(); reader.onload = function(ev) { setState(function(s) { var existing = s.imageUrls || ""; var sep = existing && !existing.endsWith("\n") ? "\n" : ""; return Object.assign({}, s, { imageUrls: existing + sep + ev.target.result }); }); }; reader.readAsDataURL(file); }); }} style={{ padding: "16px", background: C.card, border: "2px dashed " + C.border, borderRadius: 8, textAlign: "center", cursor: "pointer", marginBottom: 10, transition: "all 0.2s" }} onClick={function() { document.getElementById("sa-img-upload").click(); }}>
      <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginBottom: 4 }}>Drag & drop PNG/JPG here or click to browse</div>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>Images will be converted to data URLs</div>
      <input id="sa-img-upload" type="file" accept="image/png,image/jpeg" multiple onChange={function(e) { var files = Array.prototype.slice.call(e.target.files); files.forEach(function(file) { var reader = new FileReader(); reader.onload = function(ev) { setState(function(s) { var existing = s.imageUrls || ""; var sep = existing && !existing.endsWith("\n") ? "\n" : ""; return Object.assign({}, s, { imageUrls: existing + sep + ev.target.result }); }); }; reader.readAsDataURL(file); }); e.target.value = ""; }} style={{ display: "none" }} />
    </div>
    {(function() { var urls = (state.imageUrls || "").split("\n").filter(function(u) { return u.trim().match(/^data:image\//); }); if (urls.length === 0) return null; return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>{urls.map(function(url, i) { return <div key={i} style={{ position: "relative", width: 56, height: 56, borderRadius: 6, overflow: "hidden", border: "1px solid " + C.border }}><img src={url.trim()} style={{ width: "100%", height: "100%", objectFit: "cover" }} /><div onClick={function(e) { e.stopPropagation(); setState(function(s) { var lines = (s.imageUrls || "").split("\n").filter(function(l) { return l.trim() !== url.trim(); }); return Object.assign({}, s, { imageUrls: lines.join("\n") }); }); }} style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", lineHeight: 1, transition: "background 0.15s" }} onMouseEnter={function(ev) { ev.currentTarget.style.background = "rgba(224,99,71,0.9)"; }} onMouseLeave={function(ev) { ev.currentTarget.style.background = "rgba(0,0,0,0.7)"; }}>{"\u00D7"}</div></div>; })}</div>; })()}
    <div style={{ marginBottom: 20 }} />

    {/* Content / Context */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Content / Context</div>
    <div onDragOver={function(e) { e.preventDefault(); setDragging(true); }} onDragLeave={function() { setDragging(false); }} onDrop={function(e) { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}>
      <textarea value={state.text || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { text: e.target.value }); }); }} placeholder="Paste article text here..." rows={10} style={{ width: "100%", padding: "14px 16px", background: dragging ? C.amber + "08" : C.card, border: "1px solid " + (dragging ? C.amber : C.border), borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 20 }}>
        <label style={{ fontFamily: mn, fontSize: 10, color: C.txd, cursor: "pointer", padding: "4px 10px", border: "1px solid " + C.border, borderRadius: 5 }}>
          Upload .txt <input type="file" accept=".txt,.md" onChange={function(e) { handleFile(e.target.files[0]); }} style={{ display: "none" }} />
        </label>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{(state.text || "").length.toLocaleString()} chars</div>
      </div>
    </div>

    {/* Source URL */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Source URL (optional)</div>
    <input value={state.url || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { url: e.target.value }); }); }} placeholder="https://semianalysis.com/..." style={{ width: "100%", padding: "10px 14px", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 24 }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />

    <button onClick={onNext} disabled={!(state.text || "").trim()} style={{ width: "100%", padding: "14px 0", background: (state.text || "").trim() ? C.amber : C.surface, color: (state.text || "").trim() ? C.bg : C.txd, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: (state.text || "").trim() ? "pointer" : "not-allowed" }}>Generate Carousel Variants</button>
  </div>;
}

// ═══ STEP 1: GENERATING ═══
function GenerateStep() {
  return <div style={{ textAlign: "center", padding: "80px 0" }}>
    <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid " + C.border, borderTopColor: C.amber, margin: "0 auto 24px", animation: "cspin 1s linear infinite" }} />
    <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Generating Carousel Variants</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm }}>Creating 3 approaches following SA Schema v1.0...</div>
    <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, marginTop: 16 }}>COVER \u2192 BODY_A \u2192 BODY_B \u2192 ... \u2192 BODY_FINAL</div>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes cspin{to{transform:rotate(360deg)}}" }} />
  </div>;
}

// ═══ STEP 2: SELECT VARIANT ═══
function SelectStep({ variants, selected, setSelected, onNext, onRegenerate, regenerating }) {
  if (!variants) return null;
  var keys = Object.keys(variants).filter(function(k) { return variants[k] && variants[k].slides; });
  var varColors = { A: C.amber, B: C.blue, C: C.teal };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Select Variant</div>
      <button onClick={onRegenerate} disabled={regenerating} style={{ padding: "8px 16px", background: "transparent", color: C.amber, border: "1px solid " + C.amber + "40", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: regenerating ? "wait" : "pointer", opacity: regenerating ? 0.5 : 1 }}>
        {regenerating ? "Regenerating..." : "\u21BB Regenerate"}
      </button>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Each variant follows SA Schema v1.0: COVER \u2192 alternating BODY slides \u2192 BODY_FINAL.</div>

    {keys.map(function(k) {
      var v = variants[k];
      var isSel = selected === k;
      var color = varColors[k] || C.amber;

      return <div key={k} onClick={function() { setSelected(k); }} style={{ marginBottom: 16, background: isSel ? color + "08" : C.card, border: "1px solid " + (isSel ? color : C.border), borderRadius: 12, padding: "20px", cursor: "pointer", transition: "all 0.25s", boxShadow: isSel ? "0 0 24px " + color + "12" : "none" }} onMouseEnter={function(e) { if (!isSel) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)"; } }} onMouseLeave={function(e) { if (!isSel) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; } }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: isSel ? color : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 15, fontWeight: 800, color: isSel ? "#1A1200" : C.txd }}>{k}</div>
            <div>
              <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: isSel ? color : C.tx }}>{v.label || "Variant " + k}</div>
              <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{v.slides.length} slides // {v.slides.map(function(s) { return s.type; }).join(" \u2192 ")}</div>
            </div>
          </div>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + (isSel ? color : C.border), display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isSel && <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />}
          </div>
        </div>

        {/* Slide previews */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {v.slides.map(function(slide, si) {
            return <SlidePreview key={si} slide={slide} index={si} small={true} />;
          })}
        </div>
      </div>;
    })}

    <button onClick={onNext} disabled={!selected} style={{ width: "100%", padding: "14px 0", marginTop: 8, background: selected ? C.amber : C.surface, color: selected ? "#1A1200" : C.txd, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: selected ? "pointer" : "not-allowed" }}>Continue with Variant {selected || "..."}</button>
  </div>;
}

// ═══ STEP 3: CAPTION ═══
function CaptionStep({ slides, caption, setCaption, loading, onGenerate, onNext }) {
  return <div>
    <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Caption + Hashtags</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Generate or write the Instagram caption.</div>

    {/* Slide summary strip */}
    <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 24, paddingBottom: 4 }}>
      {slides.map(function(sl, i) { return <SlidePreview key={i} slide={sl} index={i} small={true} />; })}
    </div>

    <div style={{ marginBottom: 16 }}>
      <button onClick={onGenerate} disabled={loading} style={{ padding: "10px 20px", background: C.amber + "15", color: C.amber, border: "1px solid " + C.amber + "30", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1 }}>
        {loading ? "Generating..." : caption ? "\u21BB Regenerate Caption" : "Generate Caption"}
      </button>
    </div>

    <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Caption</div>
    <textarea value={(caption && caption.caption) || ""} onChange={function(e) { setCaption(function(c) { return Object.assign({}, c, { caption: e.target.value }); }); }} placeholder="Caption will appear here..." rows={8} style={{ width: "100%", padding: "14px 16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 20 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{((caption && caption.caption) || "").length} / 2200</div>
      {caption && caption.caption && <span onClick={function() { navigator.clipboard.writeText(caption.caption); }} style={{ fontFamily: mn, fontSize: 10, color: C.txd, cursor: "pointer", padding: "2px 8px", border: "1px solid " + C.border, borderRadius: 4 }}>Copy</span>}
    </div>

    {caption && caption.hashtags && caption.hashtags.length > 0 && <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Hashtags</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {caption.hashtags.map(function(tag, i) {
          return <span key={i} style={{ fontFamily: ft, fontSize: 12, color: C.blue, padding: "4px 10px", background: C.blue + "10", border: "1px solid " + C.blue + "20", borderRadius: 20 }}>#{tag.replace(/^#/, "")}</span>;
        })}
      </div>
    </div>}

    <button onClick={onNext} disabled={!caption || !caption.caption} style={{ width: "100%", padding: "14px 0", background: caption && caption.caption ? C.amber : C.surface, color: caption && caption.caption ? "#1A1200" : C.txd, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: caption && caption.caption ? "pointer" : "not-allowed" }}>Continue to Export</button>
  </div>;
}

// ═══ STEP 4: EXPORT ═══
function ExportStep({ state, caption, selectedVariant, variants }) {
  var _rendering = useState(false), rendering = _rendering[0], setRendering = _rendering[1];
  var _canvaStatus = useState(null), canvaStatus = _canvaStatus[0], setCanvaStatus = _canvaStatus[1];
  var slides = variants && selectedVariant && variants[selectedVariant] ? variants[selectedVariant].slides : [];
  var variantData = variants && selectedVariant ? variants[selectedVariant] : {};

  function copyAll() {
    var text = "SA CAROUSEL: " + (variantData.label || "Variant " + selectedVariant) + "\n";
    text += "Schema: SA Carousel Schema v1.0\n\n";
    slides.forEach(function(sl, i) {
      text += "[" + sl.type + "] Slide " + (i + 1) + "\n";
      if (sl.title) text += "Title: " + sl.title + "\n";
      if (sl.subtitle) text += "Subtitle: " + sl.subtitle + "\n";
      if (sl.body_text) text += sl.body_text + "\n";
      if (sl.subtext) text += "Caption: " + sl.subtext + "\n";
      if (sl.image_url) text += "Image: " + sl.image_url + "\n";
      text += "\n";
    });
    if (caption && caption.caption) text += "CAPTION:\n" + caption.caption + "\n";
    if (caption && caption.hashtags) text += "\nHASHTAGS: " + caption.hashtags.map(function(t) { return "#" + t.replace(/^#/, ""); }).join(" ") + "\n";
    navigator.clipboard.writeText(text);
  }

  function exportJSON() {
    var payload = {
      carousel_id: "carousel_" + Date.now(),
      topic: variantData.topic || variantData.label || "",
      source_article: state.url || "",
      generated_by: "Claude (claude-sonnet-4-20250514)",
      slides: slides,
      caption: caption,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "sa-carousel-schema.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async function sendToCanva() {
    setRendering(true);
    setCanvaStatus("Building Canva autofill payload...");
    try {
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "render",
          slides: slides,
          carouselId: "carousel_" + Date.now(),
          topic: variantData.topic || variantData.label || "",
          sourceUrl: state.url || "",
        }),
      });
      var d = await r.json();
      if (d.canvaPayload) {
        setCanvaStatus("Payload ready. Sending to Canva autofill...");
        // Try autofill
        var ar = await fetch("/api/canva/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slides: slides,
            category: state.category,
          }),
        });
        var ad = await ar.json();
        if (ad.needsAuth) {
          setCanvaStatus("Canva not connected. Complete OAuth first at /api/canva/auth");
        } else if (ad.error) {
          setCanvaStatus("Canva: " + ad.error + ". Use JSON export + manual upload for now.");
        } else {
          setCanvaStatus("Canva autofill job created. Check Canva for your design.");
        }
      }
    } catch (e) {
      setCanvaStatus("Error: " + e.message);
    }
    setRendering(false);
  }

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Export</div>
      <button onClick={copyAll} style={{ padding: "8px 16px", background: "transparent", color: C.amber, border: "1px solid " + C.amber + "40", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy All</button>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 28 }}>Review slides and export to Canva or download.</div>

    {/* Variant info */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>
      Variant {selectedVariant} // {variantData.label} // {slides.length} slides // SA Schema v1.0
    </div>

    {/* Full slide preview grid */}
    <div style={{ display: "flex", gap: 12, overflowX: "auto", marginBottom: 28, paddingBottom: 8 }}>
      {slides.map(function(sl, i) { return <SlidePreview key={i} slide={sl} index={i} />; })}
    </div>

    {/* Slide detail cards */}
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
      {slides.map(function(sl, i) {
        var meta = SLIDE_META[sl.type] || SLIDE_META.BODY_A;
        return <div key={i} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: mn, fontSize: 9, color: C.bg, background: sl.type === "COVER" ? C.amber : sl.type === "BODY_FINAL" ? C.teal : C.txm, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{sl.type}</span>
            <span style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>Slide {i + 1}</span>
            <span style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{sl.template_id || ""}</span>
            <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: meta.hasArrow ? C.amber : C.txd }}>{meta.hasArrow ? "\u2192 arrow" : "no arrow"}</span>
          </div>
          {sl.title && <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 800, color: C.amber, marginBottom: 4 }}>{sl.title}</div>}
          {sl.subtitle && <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginBottom: 4 }}>{sl.subtitle}</div>}
          {sl.body_text && <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6 }}>{sl.body_text}</div>}
          {sl.subtext && <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, fontStyle: "italic" }}>{sl.subtext}</div>}
          {sl.image_url && <div style={{ fontFamily: mn, fontSize: 10, color: C.blue, marginTop: 4 }}>Image: {sl.image_url}</div>}
        </div>;
      })}
    </div>

    {/* Caption preview */}
    {caption && caption.caption && <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Caption</div>
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "16px" }}>
        <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{caption.caption}</div>
      </div>
    </div>}

    {/* Export actions */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Export Options</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
      <button onClick={sendToCanva} disabled={rendering} style={{ padding: "16px", background: C.violet + "10", border: "1px solid " + C.violet + "30", borderRadius: 10, cursor: rendering ? "wait" : "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.violet + "60"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(144,92,203,0.1)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.violet + "30"; e.currentTarget.style.boxShadow = "none"; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.violet, marginBottom: 4 }}>Send to Canva</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Autofill TEMPLATES folder via API</div>
      </button>
      <button onClick={exportJSON} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Download JSON</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>SA Schema v1.0 export</div>
      </button>
      <button onClick={copyAll} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Copy to Clipboard</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>All slide text + caption</div>
      </button>
      <button onClick={function() { window.open("https://publish.buffer.com", "_blank"); }} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Open Buffer</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Schedule in Buffer</div>
      </button>
    </div>

    {/* Canva status */}
    {canvaStatus && <div style={{ padding: "12px 16px", background: C.violet + "08", border: "1px solid " + C.violet + "20", borderRadius: 8, marginTop: 8 }}>
      <div style={{ fontFamily: mn, fontSize: 11, color: C.violet }}>{canvaStatus}</div>
    </div>}
  </div>;
}

// ═══ MAIN CAROUSEL COMPONENT ═══
export default function Carousel() {
  var _step = useState(0), step = _step[0], setStep = _step[1];
  var _maxStep = useState(0), maxStep = _maxStep[0], setMaxStep = _maxStep[1];
  var _state = useState({ category: "general", mode: "auto", pageCount: 4, text: "", url: "", imageUrls: "" }), state = _state[0], setState = _state[1];
  var _variants = useState(null), variants = _variants[0], setVariants = _variants[1];
  var _selected = useState(null), selected = _selected[0], setSelected = _selected[1];
  var _caption = useState(null), caption = _caption[0], setCaption = _caption[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _captionLoading = useState(false), captionLoading = _captionLoading[0], setCaptionLoading = _captionLoading[1];

  function goStep(n) { setStep(n); if (n > maxStep) setMaxStep(n); }

  async function generate() {
    setLoading(true);
    goStep(1);
    try {
      var imgUrls = (state.imageUrls || "").split("\n").map(function(u) { return u.trim(); }).filter(Boolean);
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          text: state.text,
          url: state.url,
          category: state.category,
          mode: state.mode,
          pageCount: state.pageCount,
          imageUrls: imgUrls.length > 0 ? imgUrls : undefined,
        }),
      });
      var d = await r.json();
      if (d.error) { alert("Generation failed: " + d.error); goStep(0); }
      else { setVariants(d.variants); setSelected(null); goStep(2); }
    } catch (e) { alert("Network error: " + e.message); goStep(0); }
    setLoading(false);
  }

  async function generateCaption() {
    if (!variants || !selected) return;
    setCaptionLoading(true);
    try {
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "caption", slides: variants[selected].slides }),
      });
      var d = await r.json();
      if (d.caption) setCaption(d.caption);
    } catch (e) { alert("Caption error: " + e.message); }
    setCaptionLoading(false);
  }

  var slides = variants && selected && variants[selected] ? variants[selected].slides : [];

  return <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Carousel</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 2 }}>SA Schema v1.0 // 1080x1350 // Canva TEMPLATES</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORIES.find(function(c) { return c.id === state.category; })?.color || C.amber, boxShadow: "0 0 8px " + (CATEGORIES.find(function(c) { return c.id === state.category; })?.color || C.amber) + "60" }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: C.txm }}>{state.category}</span>
      </div>
    </div>

    <StepBar step={step} setStep={setStep} maxStep={maxStep} />

    {step === 0 && <InputStep state={state} setState={setState} onNext={generate} />}
    {step === 1 && loading && <GenerateStep />}
    {step === 2 && <SelectStep variants={variants} selected={selected} setSelected={setSelected} onNext={function() { goStep(3); }} onRegenerate={generate} regenerating={loading} />}
    {step === 3 && <CaptionStep slides={slides} caption={caption} setCaption={setCaption} loading={captionLoading} onGenerate={generateCaption} onNext={function() { goStep(4); }} />}
    {step === 4 && <ExportStep state={state} caption={caption} selectedVariant={selected} variants={variants} />}
  </div>;
}
