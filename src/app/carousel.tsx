// @ts-nocheck
"use client";
import { useState, useRef } from "react";

var C = {
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A",
  bg: "#06060C", card: "#14141E", border: "#252535", hover: "#181824",
  surface: "#101018", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";

var CATEGORIES = [
  { id: "general", label: "General", desc: "Industry news, trends, analysis", color: C.amber, icon: "\u25C8" },
  { id: "internal", label: "Internal", desc: "SA original research and findings", color: C.blue, icon: "\u25C9" },
  { id: "external", label: "External", desc: "Third-party content with SA commentary", color: C.teal, icon: "\u25CA" },
  { id: "capital", label: "Capital", desc: "Financial and investment analysis", color: C.coral, icon: "\u25CB" },
];

var STEPS = ["Input", "Generate", "Select", "Caption", "Schedule"];

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
          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: done ? C.amber + "50" : C.border, margin: "0 -1px", transition: "all 0.3s" }} />}
        </div>
        <div style={{ fontFamily: ft, fontSize: 10, fontWeight: active ? 700 : 500, color: active ? C.amber : done ? C.tx : C.txd, marginTop: 6, letterSpacing: 0.5 }}>{s}</div>
      </div>;
    })}
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
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Paste an article, upload a text file, or enter a URL to generate carousel slides.</div>

    {/* Category selector */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Template Category</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
      {CATEGORIES.map(function(cat) {
        var sel = state.category === cat.id;
        return <div key={cat.id} onClick={function() { setState(function(s) { return Object.assign({}, s, { category: cat.id }); }); }} style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", background: sel ? cat.color + "10" : C.card, border: "1px solid " + (sel ? cat.color : C.border), transition: "all 0.2s", boxShadow: sel ? "0 0 20px " + cat.color + "15" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: sel ? cat.color : C.border, transition: "all 0.2s", boxShadow: sel ? "0 0 8px " + cat.color + "60" : "none" }} />
            <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: sel ? cat.color : C.tx }}>{cat.label}</div>
          </div>
          <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, paddingLeft: 18 }}>{cat.desc}</div>
        </div>;
      })}
    </div>

    {/* Mode toggle */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Slide Count</div>
    <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
      <div onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "auto" }); }); }} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, cursor: "pointer", background: state.mode === "auto" ? C.amber + "10" : C.card, border: "1px solid " + (state.mode === "auto" ? C.amber : C.border), transition: "all 0.2s" }}>
        <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: state.mode === "auto" ? C.amber : C.tx }}>Auto</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>AI decides optimal count (4-8)</div>
      </div>
      <div onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "manual" }); }); }} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, cursor: "pointer", background: state.mode === "manual" ? C.amber + "10" : C.card, border: "1px solid " + (state.mode === "manual" ? C.amber : C.border), transition: "all 0.2s" }}>
        <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: state.mode === "manual" ? C.amber : C.tx }}>Manual</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Set exact slide count</div>
      </div>
    </div>
    {state.mode === "manual" && <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="range" min={3} max={10} value={state.pageCount || 5} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { pageCount: parseInt(e.target.value) }); }); }} style={{ flex: 1, accentColor: C.amber }} />
        <div style={{ fontFamily: mn, fontSize: 18, fontWeight: 700, color: C.amber, width: 30, textAlign: "center" }}>{state.pageCount || 5}</div>
      </div>
    </div>}

    {/* Text input */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Article Content</div>
    <div onDragOver={function(e) { e.preventDefault(); setDragging(true); }} onDragLeave={function() { setDragging(false); }} onDrop={function(e) { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }} style={{ marginBottom: 20 }}>
      <textarea value={state.text || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { text: e.target.value }); }); }} placeholder="Paste article text here, or drag and drop a .txt file..." rows={12} style={{ width: "100%", padding: "14px 16px", background: dragging ? C.amber + "08" : C.card, border: "1px solid " + (dragging ? C.amber : C.border), borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
      {state.fileName && <div style={{ fontFamily: mn, fontSize: 10, color: C.teal, marginTop: 6 }}>Loaded: {state.fileName}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <label style={{ fontFamily: mn, fontSize: 10, color: C.txd, cursor: "pointer", padding: "4px 10px", border: "1px solid " + C.border, borderRadius: 5 }}>
          Upload .txt
          <input type="file" accept=".txt,.md" onChange={function(e) { handleFile(e.target.files[0]); }} style={{ display: "none" }} />
        </label>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{(state.text || "").length.toLocaleString()} chars</div>
      </div>
    </div>

    {/* URL input */}
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Source URL (optional)</div>
      <input value={state.url || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { url: e.target.value }); }); }} placeholder="https://semianalysis.com/..." style={{ width: "100%", padding: "10px 14px", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
    </div>

    <button onClick={onNext} disabled={!(state.text || "").trim()} style={{ width: "100%", padding: "14px 0", background: (state.text || "").trim() ? C.amber : C.surface, color: (state.text || "").trim() ? C.bg : C.txd, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: (state.text || "").trim() ? "pointer" : "not-allowed", letterSpacing: 0.5, transition: "all 0.2s" }}>Generate Carousel Variants</button>
  </div>;
}

// ═══ STEP 1: GENERATE (loading) ═══
function GenerateStep() {
  return <div style={{ textAlign: "center", padding: "80px 0" }}>
    <div className="carousel-spin" style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid " + C.border, borderTopColor: C.amber, margin: "0 auto 24px", animation: "carousel-spin 1s linear infinite" }} />
    <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Generating Carousel Variants</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm }}>Creating 3 different editorial approaches...</div>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes carousel-spin{to{transform:rotate(360deg)}}" }} />
  </div>;
}

// ═══ STEP 2: SELECT VARIANT ═══
function SelectStep({ variants, selected, setSelected, onNext, onRegenerate, regenerating }) {
  if (!variants) return null;
  var keys = Object.keys(variants);
  var catColors = { A: C.amber, B: C.blue, C: C.teal };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Select a Variant</div>
      <button onClick={onRegenerate} disabled={regenerating} style={{ padding: "8px 16px", background: "transparent", color: C.amber, border: "1px solid " + C.amber + "40", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: regenerating ? "wait" : "pointer", opacity: regenerating ? 0.5 : 1 }}>
        {regenerating ? "Regenerating..." : "\u21BB Regenerate All"}
      </button>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Choose the editorial approach that best fits your content.</div>

    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {keys.map(function(k) {
        var v = variants[k];
        if (!v || !v.slides) return null;
        var isSel = selected === k;
        var color = catColors[k] || C.amber;

        return <div key={k} onClick={function() { setSelected(k); }} style={{ background: isSel ? color + "08" : C.card, border: "1px solid " + (isSel ? color : C.border), borderRadius: 12, padding: "20px", cursor: "pointer", transition: "all 0.25s", boxShadow: isSel ? "0 0 24px " + color + "15, 0 4px 16px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.2)" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: isSel ? color : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 15, fontWeight: 800, color: isSel ? C.bg : C.txd, transition: "all 0.2s", boxShadow: isSel ? "0 0 12px " + color + "50" : "none" }}>{k}</div>
              <div>
                <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: isSel ? color : C.tx }}>{v.label || "Variant " + k}</div>
                <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{v.slides.length} slides</div>
              </div>
            </div>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + (isSel ? color : C.border), display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
              {isSel && <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />}
            </div>
          </div>

          {/* Slide previews */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {v.slides.map(function(slide, si) {
              return <div key={si} style={{ minWidth: 160, maxWidth: 200, flex: "0 0 auto", padding: "12px", background: isSel ? color + "08" : "rgba(255,255,255,0.02)", border: "1px solid " + (isSel ? color + "20" : "rgba(255,255,255,0.04)"), borderRadius: 8, transition: "all 0.2s" }}>
                <div style={{ fontFamily: mn, fontSize: 8, color: color, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Slide {si + 1}</div>
                <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: C.tx, marginBottom: 4, lineHeight: 1.3 }}>{slide.heading}</div>
                <div style={{ fontFamily: ft, fontSize: 10, color: C.txm, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{slide.body}</div>
                {slide.stat && <div style={{ fontFamily: mn, fontSize: 9, color: color, marginTop: 6, padding: "3px 6px", background: color + "10", borderRadius: 4, display: "inline-block" }}>{slide.stat}</div>}
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>

    <button onClick={onNext} disabled={!selected} style={{ width: "100%", padding: "14px 0", marginTop: 24, background: selected ? C.amber : C.surface, color: selected ? C.bg : C.txd, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: selected ? "pointer" : "not-allowed", letterSpacing: 0.5, transition: "all 0.2s" }}>Continue with Variant {selected || "..."}</button>
  </div>;
}

// ═══ STEP 3: CAPTION ═══
function CaptionStep({ slides, caption, setCaption, loading, onGenerate, onNext }) {
  return <div>
    <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Caption + Hashtags</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Generate or write your Instagram caption for this carousel.</div>

    {/* Slide summary */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Selected Slides ({slides.length})</div>
    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 24, paddingBottom: 4 }}>
      {slides.map(function(sl, i) {
        return <div key={i} style={{ minWidth: 140, flex: "0 0 auto", padding: "10px 12px", background: C.card, border: "1px solid " + C.border, borderRadius: 8 }}>
          <div style={{ fontFamily: mn, fontSize: 8, color: C.amber, marginBottom: 3 }}>Slide {i + 1}</div>
          <div style={{ fontFamily: ft, fontSize: 11, fontWeight: 600, color: C.tx, lineHeight: 1.3 }}>{sl.heading}</div>
        </div>;
      })}
    </div>

    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      <button onClick={onGenerate} disabled={loading} style={{ padding: "10px 20px", background: C.amber + "15", color: C.amber, border: "1px solid " + C.amber + "30", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1 }}>
        {loading ? "Generating..." : caption ? "\u21BB Regenerate Caption" : "Generate Caption"}
      </button>
    </div>

    {/* Caption editor */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Caption</div>
    <textarea value={(caption && caption.caption) || ""} onChange={function(e) { setCaption(function(c) { return Object.assign({}, c, { caption: e.target.value }); }); }} placeholder="Caption will appear here after generation, or type your own..." rows={8} style={{ width: "100%", padding: "14px 16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 20 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{((caption && caption.caption) || "").length} / 2200 chars</div>
      {caption && caption.caption && <span onClick={function() { navigator.clipboard.writeText(caption.caption); }} style={{ fontFamily: mn, fontSize: 10, color: C.txd, cursor: "pointer", padding: "2px 8px", border: "1px solid " + C.border, borderRadius: 4 }}>Copy</span>}
    </div>

    {/* Hashtags */}
    {caption && caption.hashtags && caption.hashtags.length > 0 && <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Hashtags</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {caption.hashtags.map(function(tag, i) {
          return <span key={i} style={{ fontFamily: ft, fontSize: 12, color: C.blue, padding: "4px 10px", background: C.blue + "10", border: "1px solid " + C.blue + "20", borderRadius: 20 }}>#{tag.replace(/^#/, "")}</span>;
        })}
      </div>
    </div>}

    <button onClick={onNext} disabled={!caption || !caption.caption} style={{ width: "100%", padding: "14px 0", background: caption && caption.caption ? C.amber : C.surface, color: caption && caption.caption ? C.bg : C.txd, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: caption && caption.caption ? "pointer" : "not-allowed", letterSpacing: 0.5, transition: "all 0.2s" }}>Continue to Schedule</button>
  </div>;
}

// ═══ STEP 4: SCHEDULE ═══
function ScheduleStep({ state, caption, selectedVariant, variants }) {
  var slides = variants && selectedVariant && variants[selectedVariant] ? variants[selectedVariant].slides : [];
  var catColor = { general: C.amber, internal: C.blue, external: C.teal, capital: C.coral };
  var color = catColor[state.category] || C.amber;

  function copyAll() {
    var text = "CAROUSEL: " + (variants[selectedVariant].label || "Variant " + selectedVariant) + "\n\n";
    slides.forEach(function(sl, i) {
      text += "SLIDE " + (i + 1) + ": " + sl.heading + "\n" + sl.body + "\n";
      if (sl.stat) text += "Stat: " + sl.stat + "\n";
      text += "\n";
    });
    if (caption && caption.caption) text += "CAPTION:\n" + caption.caption + "\n";
    if (caption && caption.hashtags) text += "\nHASHTAGS: " + caption.hashtags.map(function(t) { return "#" + t.replace(/^#/, ""); }).join(" ") + "\n";
    navigator.clipboard.writeText(text);
  }

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Review + Schedule</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={copyAll} style={{ padding: "8px 16px", background: "transparent", color: C.amber, border: "1px solid " + C.amber + "40", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy All</button>
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 28 }}>Review your carousel content and export or schedule it.</div>

    {/* Final slide preview */}
    <div style={{ fontFamily: mn, fontSize: 10, color: color, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>
      Variant {selectedVariant} // {variants[selectedVariant].label} // {slides.length} Slides
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 28 }}>
      {slides.map(function(sl, i) {
        return <div key={i} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "16px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: color }} />
          <div style={{ fontFamily: mn, fontSize: 9, color: color, marginBottom: 6 }}>Slide {i + 1}</div>
          <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 6, lineHeight: 1.3 }}>{sl.heading}</div>
          <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.5 }}>{sl.body}</div>
          {sl.stat && <div style={{ fontFamily: mn, fontSize: 10, fontWeight: 600, color: color, marginTop: 8, padding: "4px 8px", background: color + "10", borderRadius: 4, display: "inline-block" }}>{sl.stat}</div>}
          {sl.emphasis && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6 }}>Emphasis: {sl.emphasis}</div>}
        </div>;
      })}
    </div>

    {/* Caption preview */}
    {caption && caption.caption && <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Caption</div>
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "16px" }}>
        <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{caption.caption}</div>
        {caption.hashtags && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid " + C.border }}>
          {caption.hashtags.map(function(tag, i) {
            return <span key={i} style={{ fontFamily: ft, fontSize: 11, color: C.blue }}>#{tag.replace(/^#/, "")}</span>;
          })}
        </div>}
      </div>
    </div>}

    {/* Export options */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Export</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <button onClick={copyAll} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Copy to Clipboard</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Copy all slide text and caption</div>
      </button>
      <button onClick={function() { window.open("https://publish.buffer.com", "_blank"); }} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Open Buffer</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Schedule in Buffer dashboard</div>
      </button>
      <button onClick={function() { window.open("https://www.canva.com", "_blank"); }} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Open Canva</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Design slides in Canva</div>
      </button>
      <button onClick={function() {
        var json = JSON.stringify({ variant: selectedVariant, label: variants[selectedVariant].label, slides: slides, caption: caption }, null, 2);
        var blob = new Blob([json], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a"); a.href = url; a.download = "carousel-export.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Download JSON</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Export structured data for Canva API</div>
      </button>
    </div>

    {/* Canva autofill coming soon */}
    <div style={{ marginTop: 24, padding: "16px 20px", background: C.violet + "08", border: "1px solid " + C.violet + "20", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.violet, boxShadow: "0 0 8px " + C.violet + "60" }} />
        <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: C.violet }}>Canva Autofill</div>
        <span style={{ fontFamily: mn, fontSize: 9, color: C.violet, padding: "2px 8px", background: C.violet + "15", borderRadius: 10 }}>Coming Soon</span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 12, color: C.txm }}>Automatically populate Canva templates with your carousel content using the Canva Connect API.</div>
    </div>
  </div>;
}

// ═══ MAIN CAROUSEL COMPONENT ═══
export default function Carousel() {
  var _step = useState(0), step = _step[0], setStep = _step[1];
  var _maxStep = useState(0), maxStep = _maxStep[0], setMaxStep = _maxStep[1];
  var _state = useState({ category: "general", mode: "auto", pageCount: 5, text: "", url: "" }), state = _state[0], setState = _state[1];
  var _variants = useState(null), variants = _variants[0], setVariants = _variants[1];
  var _selected = useState(null), selected = _selected[0], setSelected = _selected[1];
  var _caption = useState(null), caption = _caption[0], setCaption = _caption[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _captionLoading = useState(false), captionLoading = _captionLoading[0], setCaptionLoading = _captionLoading[1];

  function goStep(n) {
    setStep(n);
    if (n > maxStep) setMaxStep(n);
  }

  async function generate() {
    setLoading(true);
    goStep(1);
    try {
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
          platforms: ["instagram"],
        }),
      });
      var d = await r.json();
      if (d.error) {
        alert("Generation failed: " + d.error);
        goStep(0);
      } else {
        setVariants(d.variants);
        setSelected(null);
        goStep(2);
      }
    } catch (e) {
      alert("Network error: " + e.message);
      goStep(0);
    }
    setLoading(false);
  }

  async function generateCaption() {
    if (!variants || !selected) return;
    setCaptionLoading(true);
    try {
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "caption",
          slides: variants[selected].slides,
        }),
      });
      var d = await r.json();
      if (d.caption) setCaption(d.caption);
    } catch (e) {
      alert("Caption error: " + e.message);
    }
    setCaptionLoading(false);
  }

  var slides = variants && selected && variants[selected] ? variants[selected].slides : [];

  return <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 0" }}>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Carousel</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 2 }}>Instagram carousel generator // 1080x1350px // 4:5 portrait</div>
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
    {step === 4 && <ScheduleStep state={state} caption={caption} selectedVariant={selected} variants={variants} />}
  </div>;
}
