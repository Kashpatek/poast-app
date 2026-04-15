// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   SA CAROUSEL v2.0 -- Visual Slide Editor with Real Branded Backgrounds
   ═══════════════════════════════════════════════════════════════════════════ */

var C = {
  amber: "#F7B041", blue: "#0B86D1", teal: "#2EAD8E", coral: "#E06347",
  violet: "#905CCB", cyan: "#26C9D8", crimson: "#D1334A",
  bg: "#06060C", card: "#09090D", border: "rgba(255,255,255,0.06)", hover: "#0D0D12",
  surface: "#0D0D12", tx: "#E8E4DD", txm: "#8A8690", txd: "#4E4B56",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var gf = "'Grift','Outfit',sans-serif";

// ═══ THEME / BACKDROP MAPPING ═══
var THEMES = {
  general:  { prefix: "YB", label: "General",  color: "#D4A853", desc: "Industry news, trends, analysis" },
  internal: { prefix: "Y",  label: "Internal", color: "#F7B041", desc: "SA original research and findings" },
  external: { prefix: "B",  label: "External", color: "#0B86D1", desc: "Third-party content with SA commentary" },
  capital:  { prefix: "G",  label: "Capital",  color: "#2EAD8E", desc: "Financial and investment analysis" },
};

function getBackdropUrl(theme, position) {
  return "/backdrops/" + THEMES[theme].prefix + position + ".jpg";
}

function getSlidePositions(count) {
  if (count === 1) return [4];
  if (count === 2) return [1, 4];
  if (count === 3) return [1, 2, 4];
  var positions = [1];
  for (var i = 1; i < count - 1; i++) {
    positions.push(i % 2 === 1 ? 2 : 3);
  }
  positions.push(4);
  return positions;
}

function getSlideType(position) {
  if (position === 1) return "cover";
  if (position === 4) return "body"; // closer is body layout, no arrow is baked in bg
  return "body";
}

// Canvas dimensions at full resolution
var FULL_W = 1080;
var FULL_H = 1350;
// Display scale: ~450px wide
var DISPLAY_W = 450;
var DISPLAY_H = 562; // 450 * (1350/1080)
var SCALE = DISPLAY_W / FULL_W; // ~0.4167

// Margins at full res: 7% = ~76px
var MARGIN_X = 76;
var MARGIN_Y = 95;

var STEPS = ["Input", "Generate", "Select", "Edit", "Review", "Export"];

// ═══ STEP BAR ═══
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

// ═══ B-ROLL PICKER ═══
function BRollPicker({ onSelect }) {
  var _open = useState(false), open = _open[0], setOpen = _open[1];
  var _assets = useState([]), assets = _assets[0], setAssets = _assets[1];
  var _loadState = useState("idle"), loadState = _loadState[0], setLoadState = _loadState[1];
  var _search = useState(""), search = _search[0], setSearch = _search[1];
  var _catFilter = useState("all"), catFilter = _catFilter[0], setCatFilter = _catFilter[1];

  function loadAssets() {
    if (loadState === "loaded" || loadState === "loading") return;
    setLoadState("loading");
    fetch("/api/db?table=projects").then(function(r) { return r.json(); }).then(function(res) {
      if (res.data && res.data.length > 0) {
        var row = res.data.find(function(r) { return r.type === "broll-asset" && r.id === "broll-master"; });
        if (row && row.data && row.data.assets) {
          setAssets(row.data.assets.filter(function(a) { return a.type === "image"; }));
        }
      }
      setLoadState("loaded");
    }).catch(function() { setLoadState("loaded"); });
  }

  function handleOpen() { setOpen(!open); if (!open) loadAssets(); }
  function handlePick(asset) { onSelect(asset.url); setOpen(false); }

  var categories = [];
  assets.forEach(function(a) { if (a.category && categories.indexOf(a.category) === -1) categories.push(a.category); });

  var filtered = assets.filter(function(a) {
    if (catFilter !== "all" && a.category !== catFilter) return false;
    if (search) {
      var q = search.toLowerCase();
      return (a.filename || "").toLowerCase().indexOf(q) !== -1 ||
        (a.description || "").toLowerCase().indexOf(q) !== -1 ||
        (a.category || "").toLowerCase().indexOf(q) !== -1;
    }
    return true;
  });

  return <div style={{ position: "relative", display: "inline-block" }}>
    <button onClick={handleOpen} style={{ padding: "6px 12px", background: C.blue + "12", color: C.blue, border: "1px solid " + C.blue + "30", borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>Browse B-Roll</button>
    {open && <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, width: 320, maxHeight: 360, background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.6)", zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid " + C.border }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.blue, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6 }}>B-Roll Library</div>
        <input value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search..." style={{ width: "100%", padding: "6px 10px", background: C.surface, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
        {categories.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          <span onClick={function() { setCatFilter("all"); }} style={{ fontFamily: mn, fontSize: 9, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: catFilter === "all" ? C.blue + "20" : "transparent", color: catFilter === "all" ? C.blue : C.txd, border: "1px solid " + (catFilter === "all" ? C.blue + "40" : "transparent") }}>All</span>
          {categories.map(function(cat) {
            return <span key={cat} onClick={function() { setCatFilter(cat); }} style={{ fontFamily: mn, fontSize: 9, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: catFilter === cat ? C.blue + "20" : "transparent", color: catFilter === cat ? C.blue : C.txd, border: "1px solid " + (catFilter === cat ? C.blue + "40" : "transparent") }}>{cat}</span>;
          })}
        </div>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {loadState === "loading" && <div style={{ textAlign: "center", padding: 20, fontFamily: ft, fontSize: 11, color: C.txm }}>Loading...</div>}
        {loadState === "loaded" && filtered.length === 0 && <div style={{ textAlign: "center", padding: 20, fontFamily: ft, fontSize: 11, color: C.txd }}>No images found</div>}
        {filtered.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {filtered.map(function(asset) {
            return <div key={asset.id} onClick={function() { handlePick(asset); }} title={asset.filename || asset.description || ""} style={{ width: "100%", aspectRatio: "1", borderRadius: 6, overflow: "hidden", cursor: "pointer", border: "1px solid " + C.border, background: C.surface, transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.transform = "scale(1.05)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "scale(1)"; }}>
              <img src={asset.thumbnail || asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
            </div>;
          })}
        </div>}
      </div>
    </div>}
  </div>;
}

// ═══ FONT SIZE CONTROL ═══
function FontSizeControl({ value, onChange, label }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, minWidth: 40 }}>{label}</span>
    <button onClick={function() { onChange(Math.max(12, value - 1)); }} style={{ width: 22, height: 22, borderRadius: 4, background: C.surface, border: "1px solid " + C.border, color: C.txm, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>-</button>
    <span style={{ fontFamily: mn, fontSize: 10, color: C.tx, minWidth: 24, textAlign: "center" }}>{value}</span>
    <button onClick={function() { onChange(Math.min(120, value + 1)); }} style={{ width: 22, height: 22, borderRadius: 4, background: C.surface, border: "1px solid " + C.border, color: C.txm, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>+</button>
  </div>;
}

// ═══ IMAGE FRAME (clickable area for image insertion with position control) ═══
function ImageFrame({ imageUrl, onImageChange, onPositionChange, imagePosition, imageFit, style: frameStyle, slideId }) {
  var fileRef = useRef(null);
  var _hover = useState(false), hover = _hover[0], setHover = _hover[1];
  var pos = imagePosition || "center";
  var fit = imageFit || "cover";

  function handleClick(e) {
    if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
    if (fileRef.current) fileRef.current.click();
  }

  function handleFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) { onImageChange(ev.target.result); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return <div onClick={handleClick} onMouseEnter={function() { setHover(true); }} onMouseLeave={function() { setHover(false); }} style={Object.assign({}, { borderRadius: 20 * SCALE, overflow: "hidden", cursor: "pointer", position: "relative", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)" }, frameStyle)}>
    {imageUrl ? <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: pos, display: "block", background: "#000" }} onError={function(e) { e.target.style.opacity = "0.3"; }} />
      {/* Position + fit controls (show on hover) */}
      {hover && onPositionChange && <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 3, background: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "4px 6px", backdropFilter: "blur(8px)" }} onClick={function(e) { e.stopPropagation(); }}>
        <button onClick={function() { onPositionChange("top"); }} title="Align top" style={{ padding: "3px 8px", borderRadius: 4, background: pos === "top" ? C.amber : "rgba(255,255,255,0.1)", border: "none", color: pos === "top" ? C.bg : "rgba(255,255,255,0.6)", fontSize: 9, cursor: "pointer", fontFamily: mn }}>Top</button>
        <button onClick={function() { onPositionChange("center"); }} title="Center" style={{ padding: "3px 8px", borderRadius: 4, background: pos === "center" ? C.amber : "rgba(255,255,255,0.1)", border: "none", color: pos === "center" ? C.bg : "rgba(255,255,255,0.6)", fontSize: 9, cursor: "pointer", fontFamily: mn }}>Center</button>
        <button onClick={function() { onPositionChange("bottom"); }} title="Align bottom" style={{ padding: "3px 8px", borderRadius: 4, background: pos === "bottom" ? C.amber : "rgba(255,255,255,0.1)", border: "none", color: pos === "bottom" ? C.bg : "rgba(255,255,255,0.6)", fontSize: 9, cursor: "pointer", fontFamily: mn }}>Bottom</button>
      </div>}
      {/* Remove button (show on hover) */}
      {hover && <div style={{ position: "absolute", top: 6, right: 6 }} onClick={function(e) { e.stopPropagation(); }}>
        <button onClick={function() { onImageChange(""); }} style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>{"\u00D7"}</button>
      </div>}
    </div> : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <div style={{ fontSize: 24, color: "rgba(255,255,255,0.15)" }}>+</div>
      <div style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Click to add image</div>
    </div>}
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} style={{ display: "none" }} />
  </div>;
}

// ═══ SLIDE CANVAS (the large visual editor canvas) ═══
function SlideCanvas({ slide, theme, onUpdate }) {
  var bgUrl = getBackdropUrl(theme, slide.position);
  var mx = MARGIN_X * SCALE; // ~32px
  var my = MARGIN_Y * SCALE; // ~40px

  function updateField(field, value) {
    onUpdate(Object.assign({}, slide, { [field]: value }));
  }

  // Shared text shadow for readability
  var textShadow = "0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)";

  return <div style={{ width: DISPLAY_W, height: DISPLAY_H, position: "relative", borderRadius: 8, overflow: "hidden", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

    {/* ─── COVER SLIDE ─── */}
    {slide.type === "cover" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + (60 * SCALE) + "px" }}>
      {/* Image frame: top area, safely below SA logo (10% from top) */}
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        style={{ width: "100%", height: (slide.imageHeight || 46) + "%", marginBottom: 12, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />
      {/* Title */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("title", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.titleSize * SCALE, fontWeight: 800, color: "#ffffff", lineHeight: 1.15, textShadow: textShadow, outline: "none", cursor: "text", marginBottom: 6, wordBreak: "break-word" }}
      >{slide.title || "Title"}</div>
      {/* Subtitle */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("subtitle", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.subtitleSize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.78)", lineHeight: 1.4, textShadow: textShadow, outline: "none", cursor: "text", wordBreak: "break-word" }}
      >{slide.subtitle || "Subtitle"}</div>
    </div>}

    {/* ─── BODY TEXT SLIDE (positions 2, 3, 4) ─── */}
    {slide.type === "body" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: "column", justifyContent: slide.imageUrl ? "flex-start" : "center" }}>
      {/* Optional image on body slides */}
      {slide.imageUrl && <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        style={{ width: "100%", height: (slide.imageHeight || 45) + "%", marginBottom: 12, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("bodyText", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.bodySize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.55, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden" }}
      >{slide.bodyText || "Body text"}</div>
    </div>}

    {/* ─── IMAGE + TEXT SLIDE ─── */}
    {slide.type === "image_text" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: "column" }}>
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        style={{ width: "100%", height: (slide.imageHeight || 50) + "%", marginBottom: 12, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("bodyText", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.bodySize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1, overflow: "hidden" }}
      >{slide.bodyText || "Body text"}</div>
    </div>}

    {/* ─── LARGE IMAGE SLIDE ─── */}
    {slide.type === "large_image" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: "column" }}>
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        style={{ width: "100%", height: (slide.imageHeight || 72) + "%", marginBottom: 10, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("caption", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: (slide.captionSize || 18) * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.4, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      >{slide.caption || "Caption"}</div>
    </div>}

    {/* ─── DUAL IMAGE SLIDE (2 images + 2 captions) ─── */}
    {slide.type === "dual_image" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Image 1 + caption */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ImageFrame
          imageUrl={slide.imageUrl}
          onImageChange={function(url) { updateField("imageUrl", url); }}
          onPositionChange={function(pos) { updateField("imagePosition", pos); }}
          imagePosition={slide.imagePosition}
          imageFit={slide.imageFit}
          slideId={slide.id + "-1"}
          style={{ width: "100%", flex: 1, borderRadius: 16 * SCALE, marginBottom: 4 }}
        />
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={function(e) { updateField("caption", e.currentTarget.innerText); }}
          style={{ fontFamily: gf, fontSize: (slide.captionSize || 16) * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.3, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", flexShrink: 0, minHeight: 16 }}
        >{slide.caption || "Caption 1"}</div>
      </div>
      {/* Image 2 + caption */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ImageFrame
          imageUrl={slide.imageUrl2}
          onImageChange={function(url) { updateField("imageUrl2", url); }}
          onPositionChange={function(pos) { updateField("imagePosition2", pos); }}
          imagePosition={slide.imagePosition2}
          imageFit={slide.imageFit}
          slideId={slide.id + "-2"}
          style={{ width: "100%", flex: 1, borderRadius: 16 * SCALE, marginBottom: 4 }}
        />
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={function(e) { updateField("caption2", e.currentTarget.innerText); }}
          style={{ fontFamily: gf, fontSize: (slide.captionSize || 16) * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.3, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", flexShrink: 0, minHeight: 16 }}
        >{slide.caption2 || "Caption 2"}</div>
      </div>
    </div>}

    {/* Slide position badge */}
    <div style={{ position: "absolute", top: 8, left: 8, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>
      {slide.position === 1 ? "COVER" : slide.position === 4 ? "CLOSER" : "BODY " + (slide.position === 2 ? "A" : "B")} // pos {slide.position}
    </div>
  </div>;
}

// ═══ SLIDE THUMBNAIL (small preview for strip) ═══
function SlideThumbnail({ slide, theme, isActive, onClick, index }) {
  var bgUrl = getBackdropUrl(theme, slide.position);
  var tw = 120;
  var th = 150; // 4:5 ratio
  var tScale = tw / FULL_W;

  return <div onClick={onClick} style={{ width: tw, height: th, borderRadius: 6, overflow: "hidden", cursor: "pointer", position: "relative", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, border: "2px solid " + (isActive ? C.amber : "transparent"), boxShadow: isActive ? "0 0 12px " + C.amber + "40" : "0 2px 8px rgba(0,0,0,0.3)", transition: "all 0.2s", opacity: isActive ? 1 : 0.7 }} onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.opacity = "0.9"; }} onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.opacity = "0.7"; }}>
    {/* Mini content overlay */}
    <div style={{ position: "absolute", inset: 0, padding: 6 }}>
      {slide.type === "cover" && <div>
        {slide.imageUrl && <div style={{ width: "100%", height: "40%", borderRadius: 3, overflow: "hidden", marginBottom: 3, background: "rgba(255,255,255,0.05)" }}>
          <img src={slide.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: 7, fontWeight: 800, color: "#fff", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{slide.title || ""}</div>
      </div>}
      {(slide.type === "body") && <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
        <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" }}>{slide.bodyText || ""}</div>
      </div>}
      {slide.type === "image_text" && <div>
        {slide.imageUrl && <div style={{ width: "100%", height: "50%", borderRadius: 3, overflow: "hidden", marginBottom: 2, background: "rgba(255,255,255,0.05)" }}>
          <img src={slide.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.7)", lineHeight: 1.2, overflow: "hidden" }}>{(slide.bodyText || "").slice(0, 40)}</div>
      </div>}
      {slide.type === "large_image" && <div>
        {slide.imageUrl && <div style={{ width: "100%", height: "70%", borderRadius: 3, overflow: "hidden", marginBottom: 2, background: "rgba(255,255,255,0.05)" }}>
          <img src={slide.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.5)", lineHeight: 1.2 }}>{(slide.caption || "").slice(0, 30)}</div>
      </div>}
    </div>
    {/* Index badge */}
    <div style={{ position: "absolute", bottom: 4, right: 4, fontFamily: mn, fontSize: 8, color: isActive ? C.amber : "rgba(255,255,255,0.4)", fontWeight: 700 }}>{index + 1}</div>
  </div>;
}


// ═══ STEP 0: INPUT ═══
function InputStep({ state, setState, onNext }) {
  var _dragging = useState(false), dragging = _dragging[0], setDragging = _dragging[1];
  var _inputMode = useState(state.url ? "link" : state.text ? "context" : null), inputMode = _inputMode[0], setInputMode = _inputMode[1];
  var themeKeys = Object.keys(THEMES);

  function handleFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) { setState(function(s) { return Object.assign({}, s, { text: e.target.result, fileName: file.name }); }); };
    reader.readAsText(file);
  }

  var canProceed = (state.url || "").trim() || (state.text || "").trim();

  return <div>
    <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx, marginBottom: 4 }}>Content Input</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Provide a link, context, or both to generate carousel slides with real SA branded backgrounds.</div>

    {/* Category / Theme */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Category</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
      {themeKeys.map(function(key) {
        var t = THEMES[key];
        var sel = state.category === key;
        return <div key={key} onClick={function() { setState(function(s) { return Object.assign({}, s, { category: key }); }); }} style={{ padding: "14px 16px", borderRadius: 10, cursor: "pointer", background: sel ? t.color + "10" : C.card, border: "1px solid " + (sel ? t.color : C.border), transition: "all 0.2s" }} onMouseEnter={function(e) { if (!sel) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; } }} onMouseLeave={function(e) { if (!sel) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "translateY(0)"; } }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: sel ? t.color : C.border, boxShadow: sel ? "0 0 8px " + t.color + "60" : "none" }} />
            <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: sel ? t.color : C.tx }}>{t.label}</div>
            <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: C.txd }}>{t.prefix}</div>
          </div>
          <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, paddingLeft: 18, marginTop: 2 }}>{t.desc}</div>
          {/* Mini backdrop previews */}
          {sel && <div style={{ display: "flex", gap: 4, marginTop: 8, paddingLeft: 18 }}>
            {[1, 2, 3, 4].map(function(pos) {
              return <div key={pos} style={{ width: 32, height: 40, borderRadius: 3, overflow: "hidden", backgroundImage: "url(" + getBackdropUrl(key, pos) + ")", backgroundSize: "cover", backgroundPosition: "center", border: "1px solid rgba(255,255,255,0.1)" }} />;
            })}
          </div>}
        </div>;
      })}
    </div>

    {/* Slide count */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Slide Count</div>
    <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
      <div onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "auto", pageCount: 0 }); }); }} style={{ padding: "10px 16px", borderRadius: 8, cursor: "pointer", background: state.mode === "auto" ? C.amber + "10" : C.card, border: "1px solid " + (state.mode === "auto" ? C.amber : C.border), transition: "all 0.2s" }}>
        <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: state.mode === "auto" ? C.amber : C.tx }}>Auto</div>
        <div style={{ fontFamily: ft, fontSize: 10, color: C.txm }}>AI decides</div>
      </div>
      {[3, 4, 5, 6, 7, 8].map(function(n) {
        var sel = state.mode === "manual" && state.pageCount === n;
        return <div key={n} onClick={function() { setState(function(s) { return Object.assign({}, s, { mode: "manual", pageCount: n }); }); }} style={{ padding: "10px 16px", borderRadius: 8, cursor: "pointer", background: sel ? C.amber + "10" : C.card, border: "1px solid " + (sel ? C.amber : C.border), transition: "all 0.2s", minWidth: 48, textAlign: "center" }}>
          <div style={{ fontFamily: mn, fontSize: 16, fontWeight: 700, color: sel ? C.amber : C.tx }}>{n}</div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>slides</div>
        </div>;
      })}
    </div>

    {/* Input Mode Toggle: + Link / + Context */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Source</div>
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button onClick={function() { setInputMode(inputMode === "link" && !((state.text || "").trim()) ? null : "link"); }} style={{ padding: "10px 20px", borderRadius: 8, cursor: "pointer", background: inputMode === "link" || (state.url || "").trim() ? C.blue + "15" : C.card, border: "1px solid " + (inputMode === "link" || (state.url || "").trim() ? C.blue + "50" : C.border), fontFamily: ft, fontSize: 13, fontWeight: 700, color: inputMode === "link" || (state.url || "").trim() ? C.blue : C.tx, transition: "all 0.2s" }}>+ Link</button>
      <button onClick={function() { setInputMode(inputMode === "context" && !((state.url || "").trim()) ? null : "context"); }} style={{ padding: "10px 20px", borderRadius: 8, cursor: "pointer", background: inputMode === "context" || (state.text || "").trim() ? C.teal + "15" : C.card, border: "1px solid " + (inputMode === "context" || (state.text || "").trim() ? C.teal + "50" : C.border), fontFamily: ft, fontSize: 13, fontWeight: 700, color: inputMode === "context" || (state.text || "").trim() ? C.teal : C.tx, transition: "all 0.2s" }}>+ Context</button>
      <div style={{ flex: 1 }} />
      <div style={{ fontFamily: ft, fontSize: 11, color: C.txd, alignSelf: "center" }}>At least one required</div>
    </div>

    {/* Link Input */}
    {(inputMode === "link" || (state.url || "").trim()) && <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.blue, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Article URL</div>
      <input value={state.url || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { url: e.target.value }); }); }} placeholder="https://semianalysis.com/p/..." style={{ width: "100%", padding: "14px 18px", background: C.card, border: "1px solid " + C.blue + "30", borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 15, outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.blue; }} onBlur={function(e) { e.target.style.borderColor = C.blue + "30"; }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button onClick={function() {
          var u = (state.url || "").trim();
          if (!u) return;
          setState(function(s) { return Object.assign({}, s, { articleImages: null, fetchingImages: true }); });
          fetch("/api/carousel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fetchImages", url: u }) })
            .then(function(r) { return r.json(); })
            .then(function(d) { setState(function(s) { return Object.assign({}, s, { articleImages: d.images || [], fetchingImages: false }); }); })
            .catch(function() { setState(function(s) { return Object.assign({}, s, { articleImages: [], fetchingImages: false }); }); });
        }} disabled={!(state.url || "").trim() || state.fetchingImages} style={{ padding: "6px 14px", borderRadius: 6, background: C.amber + "15", border: "1px solid " + C.amber + "30", color: C.amber, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: state.fetchingImages ? "wait" : "pointer", opacity: state.fetchingImages ? 0.5 : 1 }}>{state.fetchingImages ? "Fetching..." : "Fetch Article Images"}</button>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txd }}>Context below is optional when a link is provided.</div>
      </div>
    </div>}

    {/* Context Input */}
    {(inputMode === "context" || (state.text || "").trim()) && <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.teal, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Content / Context</div>
      <div onDragOver={function(e) { e.preventDefault(); setDragging(true); }} onDragLeave={function() { setDragging(false); }} onDrop={function(e) { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}>
        <textarea value={state.text || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { text: e.target.value }); }); }} placeholder="Paste article text here..." rows={10} style={{ width: "100%", padding: "14px 16px", background: dragging ? C.amber + "08" : C.card, border: "1px solid " + (dragging ? C.teal : C.border), borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.teal; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <label style={{ fontFamily: mn, fontSize: 10, color: C.txd, cursor: "pointer", padding: "4px 10px", border: "1px solid " + C.border, borderRadius: 5 }}>
            Upload .txt <input type="file" accept=".txt,.md" onChange={function(e) { handleFile(e.target.files[0]); }} style={{ display: "none" }} />
          </label>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{(state.text || "").length.toLocaleString()} chars</div>
        </div>
      </div>
    </div>}

    {/* Images section — always visible */}
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px" }}>Images</div>
        <label style={{ padding: "5px 12px", borderRadius: 6, background: C.violet + "12", border: "1px solid " + C.violet + "30", color: C.violet, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Upload Images
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={function(e) {
            var files = Array.prototype.slice.call(e.target.files);
            files.forEach(function(file) {
              var reader = new FileReader();
              reader.onload = function(ev) {
                setState(function(s) {
                  var existing = s.articleImages || [];
                  return Object.assign({}, s, { articleImages: existing.concat([ev.target.result]) });
                });
              };
              reader.readAsDataURL(file);
            });
            e.target.value = "";
          }} style={{ display: "none" }} />
        </label>
      </div>
      {state.articleImages && state.articleImages.length > 0 ? <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
        {state.articleImages.map(function(imgUrl, i) {
          var isSel = state.selectedArticleImage === imgUrl;
          return <div key={i} style={{ position: "relative", flexShrink: 0 }}>
            <div onClick={function() { setState(function(s) { return Object.assign({}, s, { selectedArticleImage: isSel ? null : imgUrl }); }); }} style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "2px solid " + (isSel ? C.amber : "transparent"), opacity: isSel ? 1 : 0.7, transition: "all 0.2s" }}>
              <img src={imgUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.parentElement.style.display = "none"; }} />
            </div>
            <div onClick={function() { setState(function(s) { var imgs = (s.articleImages || []).filter(function(u) { return u !== imgUrl; }); var sel = s.selectedArticleImage === imgUrl ? null : s.selectedArticleImage; return Object.assign({}, s, { articleImages: imgs, selectedArticleImage: sel }); }); }} style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: C.coral, color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontWeight: 700, lineHeight: 1 }}>{"\u00D7"}</div>
          </div>;
        })}
      </div> : <div style={{ padding: "20px", background: C.card, border: "1px dashed " + C.border, borderRadius: 8, textAlign: "center" }}>
        <div style={{ fontFamily: ft, fontSize: 12, color: C.txd, marginBottom: 4 }}>No images yet</div>
        <div style={{ fontFamily: ft, fontSize: 10, color: C.txd }}>Upload images above{(state.url || "").trim() ? " or fetch from article URL" : ""}</div>
      </div>}
      {state.selectedArticleImage && <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, marginTop: 6 }}>Selected image will be used as cover</div>}
    </div>

    <button onClick={onNext} disabled={!canProceed} style={{ width: "100%", padding: "14px 0", background: canProceed ? C.amber : C.surface, color: canProceed ? C.bg : C.txd, border: "none", borderRadius: 8, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: canProceed ? "pointer" : "not-allowed", transition: "all 0.2s" }}>Generate Carousel</button>
  </div>;
}

// ═══ STEP 1: GENERATING ═══
function GenerateStep() {
  return <div style={{ textAlign: "center", padding: "80px 0" }}>
    <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid " + C.border, borderTopColor: C.amber, margin: "0 auto 24px", animation: "cspin 1s linear infinite" }} />
    <div style={{ fontFamily: ft, fontSize: 18, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Generating Carousel</div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm }}>Creating slide content with SA voice and structure...</div>
    <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, marginTop: 16 }}>COVER -- BODY A -- BODY B -- ... -- CLOSER</div>
    <style dangerouslySetInnerHTML={{ __html: "@keyframes cspin{to{transform:rotate(360deg)}}" }} />
  </div>;
}


// ═══ STEP 2: VARIANT SELECTION ═══
function VariantSelectStep({ variants, theme, onSelect, onBack }) {
  var variantKeys = Object.keys(variants || {}).filter(function(k) { return variants[k] && variants[k].slides; });
  var varColors = { A: C.amber, B: C.blue, C: C.teal };
  var varLabels = { A: "Concise", B: "Deep Dive", C: "Visual Story" };
  var _hover = useState(null), hoverKey = _hover[0], setHoverKey = _hover[1];

  return <div>
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: ft, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5, marginBottom: 4 }}>Choose Your Approach</div>
      <div style={{ fontFamily: ft, fontSize: 14, color: C.txm }}>Each variant is a different structure. Preview the slides, then pick one to edit.</div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {variantKeys.map(function(k) {
        var v = variants[k];
        var color = varColors[k] || C.amber;
        var slides = v.slides || [];
        var positions = getSlidePositions(slides.length);
        var isHovered = hoverKey === k;
        var hasImages = slides.some(function(sl) { return sl.image_url; });
        var typeBreakdown = {};
        slides.forEach(function(sl) {
          var label = sl.type === "COVER" ? "Cover" : sl.type === "BODY_FINAL" ? "Closer" : sl.type === "BODY_IMAGE" ? "Image+Text" : sl.type === "BODY_LARGE_IMAGE" ? "Large Image" : "Text";
          typeBreakdown[label] = (typeBreakdown[label] || 0) + 1;
        });

        return <div key={k} onMouseEnter={function() { setHoverKey(k); }} onMouseLeave={function() { setHoverKey(null); }} style={{ background: isHovered ? color + "08" : C.card, border: "1px solid " + (isHovered ? color + "50" : C.border), borderRadius: 16, padding: "24px 28px", transition: "all 0.25s", boxShadow: isHovered ? "0 8px 40px " + color + "12" : "none", transform: isHovered ? "translateY(-2px)" : "none" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "15", border: "2px solid " + color + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 18, fontWeight: 900, color: color }}>{k}</div>
              <div>
                <div style={{ fontFamily: ft, fontSize: 20, fontWeight: 800, color: C.tx }}>{v.label || varLabels[k] || "Variant " + k}</div>
                {v.topic && <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginTop: 2, maxWidth: 500 }}>{v.topic}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {Object.keys(typeBreakdown).map(function(label) {
                return <div key={label} style={{ fontFamily: mn, fontSize: 9, color: C.txd, padding: "3px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 6, border: "1px solid " + C.border }}>{typeBreakdown[label]}x {label}</div>;
              })}
              <div style={{ fontFamily: mn, fontSize: 11, color: color, padding: "3px 10px", background: color + "10", borderRadius: 6, border: "1px solid " + color + "25", fontWeight: 700 }}>{slides.length} slides</div>
            </div>
          </div>

          {/* Slide previews — large enough to actually read */}
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
            {slides.map(function(sl, i) {
              var pos = positions[i] || 2;
              var bgUrl = getBackdropUrl(theme, pos);
              var tw = 140;
              var th = 175;
              var tScale = tw / FULL_W;
              return <div key={i} style={{ width: tw, height: th, borderRadius: 8, overflow: "hidden", position: "relative", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
                <div style={{ position: "absolute", inset: 0, padding: "12px 8px 8px" }}>
                  {sl.type === "COVER" && <div>
                    {sl.image_url && <div style={{ width: "100%", height: "38%", borderRadius: 4, overflow: "hidden", marginBottom: 4, background: "rgba(255,255,255,0.05)" }}>
                      <img src={sl.image_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                    </div>}
                    <div style={{ fontFamily: gf, fontSize: 9, fontWeight: 800, color: "#fff", lineHeight: 1.15, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{sl.title || ""}</div>
                    <div style={{ fontFamily: gf, fontSize: 6, color: "rgba(255,255,255,0.6)", lineHeight: 1.3, marginTop: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{sl.subtitle || ""}</div>
                  </div>}
                  {(sl.type === "BODY_A" || sl.type === "BODY_B" || sl.type === "BODY_FINAL") && <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                    <div style={{ fontFamily: gf, fontSize: 6, color: "rgba(255,255,255,0.75)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 10, WebkitBoxOrient: "vertical", whiteSpace: "pre-wrap" }}>{sl.body_text || ""}</div>
                  </div>}
                  {sl.type === "BODY_IMAGE" && <div>
                    <div style={{ width: "100%", height: "45%", borderRadius: 4, overflow: "hidden", marginBottom: 3, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sl.image_url ? <img src={sl.image_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} /> : <div style={{ fontFamily: mn, fontSize: 7, color: "rgba(255,255,255,0.15)" }}>IMAGE</div>}
                    </div>
                    <div style={{ fontFamily: gf, fontSize: 5.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}>{sl.body_text || ""}</div>
                  </div>}
                  {sl.type === "BODY_LARGE_IMAGE" && <div>
                    <div style={{ width: "100%", height: "65%", borderRadius: 4, overflow: "hidden", marginBottom: 3, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sl.image_url ? <img src={sl.image_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} /> : <div style={{ fontFamily: mn, fontSize: 7, color: "rgba(255,255,255,0.15)" }}>IMAGE</div>}
                    </div>
                    <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.5)", lineHeight: 1.2 }}>{sl.subtext || ""}</div>
                  </div>}
                </div>
                {/* Slide number */}
                <div style={{ position: "absolute", bottom: 4, left: 6, fontFamily: mn, fontSize: 8, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>{i + 1}</div>
                {/* Type badge */}
                <div style={{ position: "absolute", bottom: 4, right: 6, fontFamily: mn, fontSize: 6, color: sl.type === "COVER" ? color : sl.type === "BODY_FINAL" ? C.teal : "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>{sl.type === "COVER" ? "COVER" : sl.type === "BODY_FINAL" ? "END" : sl.type === "BODY_IMAGE" ? "IMG" : sl.type === "BODY_LARGE_IMAGE" ? "IMG" : ""}</div>
              </div>;
            })}
          </div>

          {/* Select button */}
          <button onClick={function() { onSelect(k); }} style={{ width: "100%", padding: "14px 0", background: isHovered ? "linear-gradient(135deg, " + color + ", " + color + "CC)" : color + "12", color: isHovered ? "#060608" : color, border: isHovered ? "none" : "1px solid " + color + "30", borderRadius: 10, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: "pointer", transition: "all 0.2s", letterSpacing: -0.3 }}>Continue with {v.label || "Variant " + k}</button>
        </div>;
      })}
    </div>
  </div>;
}


// ═══ STEP 3: EDIT (Visual Slide Editor) ═══
function EditStep({ slides, setSlides, theme, onNext, onBack, articleImages }) {
  var _currentIdx = useState(0), currentIdx = _currentIdx[0], setCurrentIdx = _currentIdx[1];
  var currentSlide = slides[currentIdx] || slides[0];

  function updateSlide(updated) {
    var newSlides = slides.slice();
    var old = newSlides[currentIdx];
    newSlides[currentIdx] = updated;

    // Sync font sizes across same-type slides
    if (old) {
      var syncFields = [];
      if (updated.bodySize !== old.bodySize) syncFields.push({ field: "bodySize", value: updated.bodySize, types: ["body", "image_text"] });
      if (updated.captionSize !== old.captionSize) syncFields.push({ field: "captionSize", value: updated.captionSize, types: ["large_image", "dual_image"] });
      if (updated.subtitleSize !== old.subtitleSize) syncFields.push({ field: "subtitleSize", value: updated.subtitleSize, types: ["cover"] });
      if (updated.titleSize !== old.titleSize) syncFields.push({ field: "titleSize", value: updated.titleSize, types: ["cover"] });

      if (syncFields.length > 0) {
        for (var si = 0; si < newSlides.length; si++) {
          if (si === currentIdx) continue;
          for (var sf = 0; sf < syncFields.length; sf++) {
            var sync = syncFields[sf];
            if (sync.types.indexOf(newSlides[si].type) > -1) {
              newSlides[si] = Object.assign({}, newSlides[si], { [sync.field]: sync.value });
            }
          }
        }
      }
    }

    setSlides(newSlides);
  }

  function changeSlideType(newType) {
    var old = currentSlide;
    // Gather all existing text so nothing is lost
    var allText = old.bodyText || old.title || old.caption || "";
    var allCaption = old.caption || old.subtitle || old.bodyText || "";
    var updated = Object.assign({}, old, { type: newType });

    // Carry text forward into the new type's fields
    if (newType === "cover") {
      if (!updated.title) updated.title = old.title || allText.split("\n")[0] || "Title";
      if (!updated.subtitle) updated.subtitle = old.subtitle || old.caption || old.bodyText || "Subtitle";
    }
    if (newType === "body" || newType === "image_text") {
      if (!updated.bodyText) updated.bodyText = old.bodyText || old.caption || old.subtitle || allText || "Body text";
    }
    if (newType === "large_image") {
      if (!updated.caption) updated.caption = old.caption || old.subtitle || (old.bodyText || "").split("\n\n")[0] || "Caption";
    }
    if (newType === "dual_image") {
      if (!updated.imageUrl) updated.imageUrl = old.imageUrl || "";
      if (!updated.imageUrl2) updated.imageUrl2 = "";
      if (!updated.caption) updated.caption = old.caption || old.subtitle || (old.bodyText || "").split("\n\n")[0] || "Caption";
      if (!updated.caption2) updated.caption2 = (old.bodyText || "").split("\n\n")[1] || "Caption 2";
      updated.imageHeight = old.imageHeight || 40;
    }
    // Ensure image fields exist for image types
    if ((newType === "image_text" || newType === "large_image" || newType === "dual_image") && !updated.imageUrl) updated.imageUrl = old.imageUrl || "";

    updateSlide(updated);
  }

  function addSlide() {
    var positions = getSlidePositions(slides.length + 1);
    // Re-map positions across all slides
    var newSlides = slides.slice();
    // Insert a new body slide before the closer
    var closerIdx = newSlides.length - 1;
    var newPos = positions[newSlides.length - 1]; // position for new slide before closer
    var newSlide = {
      id: "slide-" + Date.now(),
      position: newPos,
      type: "body",
      title: "", subtitle: "", titleSize: 74, subtitleSize: 34,
      bodyText: "New slide content.", bodySize: 28,
      imageUrl: "", caption: "", captionSize: 18,
    };
    newSlides.splice(closerIdx, 0, newSlide);
    // Reassign all positions
    var newPositions = getSlidePositions(newSlides.length);
    newSlides = newSlides.map(function(sl, i) {
      var pos = newPositions[i];
      return Object.assign({}, sl, {
        position: pos,
        type: pos === 1 ? "cover" : (sl.type === "image_text" || sl.type === "large_image") ? sl.type : "body",
      });
    });
    setSlides(newSlides);
  }

  function removeSlide() {
    if (slides.length <= 2) return;
    var newSlides = slides.filter(function(_, i) { return i !== currentIdx; });
    var newPositions = getSlidePositions(newSlides.length);
    newSlides = newSlides.map(function(sl, i) {
      var pos = newPositions[i];
      return Object.assign({}, sl, {
        position: pos,
        type: pos === 1 ? "cover" : (sl.type === "image_text" || sl.type === "large_image") ? sl.type : "body",
      });
    });
    setSlides(newSlides);
    if (currentIdx >= newSlides.length) setCurrentIdx(newSlides.length - 1);
  }

  // Keyboard nav
  useEffect(function() {
    function handleKey(e) {
      if (e.key === "ArrowLeft" && currentIdx > 0) setCurrentIdx(currentIdx - 1);
      if (e.key === "ArrowRight" && currentIdx < slides.length - 1) setCurrentIdx(currentIdx + 1);
    }
    window.addEventListener("keydown", handleKey);
    return function() { window.removeEventListener("keydown", handleKey); };
  }, [currentIdx, slides.length]);

  // Available slide types depending on position
  var typeOptions = currentSlide.position === 1
    ? [{ value: "cover", label: "Cover" }]
    : [
        { value: "body", label: "Body Text" },
        { value: "image_text", label: "Image + Text" },
        { value: "large_image", label: "Large Image" },
        { value: "dual_image", label: "2 Images" },
      ];

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Visual Editor</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginTop: 2 }}>Click text to edit directly on the slide. Arrow keys to navigate.</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ padding: "8px 16px", background: "transparent", color: C.txm, border: "1px solid " + C.border, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
        <button onClick={onNext} style={{ padding: "8px 20px", background: C.amber, color: C.bg, border: "none", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Review</button>
      </div>
    </div>

    {/* Main editor area */}
    <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
      {/* Slide canvas with nav arrows */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {/* Left arrow */}
        <button onClick={function() { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); }} disabled={currentIdx === 0} style={{ position: "absolute", left: -20, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: currentIdx === 0 ? C.surface : C.card, border: "1px solid " + (currentIdx === 0 ? C.border : C.amber + "40"), color: currentIdx === 0 ? C.txd : C.amber, fontSize: 16, cursor: currentIdx === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, transition: "all 0.2s" }}>{"\u2190"}</button>

        <SlideCanvas slide={currentSlide} theme={theme} onUpdate={updateSlide} />

        {/* Right arrow */}
        <button onClick={function() { if (currentIdx < slides.length - 1) setCurrentIdx(currentIdx + 1); }} disabled={currentIdx === slides.length - 1} style={{ position: "absolute", right: -20, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: currentIdx === slides.length - 1 ? C.surface : C.card, border: "1px solid " + (currentIdx === slides.length - 1 ? C.border : C.amber + "40"), color: currentIdx === slides.length - 1 ? C.txd : C.amber, fontSize: 16, cursor: currentIdx === slides.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, transition: "all 0.2s" }}>{"\u2192"}</button>

        {/* Slide counter */}
        <div style={{ textAlign: "center", marginTop: 10, fontFamily: mn, fontSize: 11, color: C.txm }}>
          Slide {currentIdx + 1} of {slides.length}
        </div>
      </div>

      {/* Controls panel */}
      <div style={{ flex: 1, minWidth: 240 }}>
        {/* Slide type selector */}
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Slide Type</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {typeOptions.map(function(opt) {
            var sel = currentSlide.type === opt.value;
            return <button key={opt.value} onClick={function() { changeSlideType(opt.value); }} style={{ padding: "6px 12px", borderRadius: 6, background: sel ? C.amber + "15" : C.surface, border: "1px solid " + (sel ? C.amber + "40" : C.border), color: sel ? C.amber : C.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{opt.label}</button>;
          })}
        </div>

        {/* Font size controls */}
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Font Sizes (at 1080px)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {currentSlide.type === "cover" && <div>
            <FontSizeControl label="Title" value={currentSlide.titleSize} onChange={function(v) { updateSlide(Object.assign({}, currentSlide, { titleSize: v })); }} />
            <div style={{ height: 6 }} />
            <FontSizeControl label="Subtitle" value={currentSlide.subtitleSize} onChange={function(v) { updateSlide(Object.assign({}, currentSlide, { subtitleSize: v })); }} />
          </div>}
          {(currentSlide.type === "body" || currentSlide.type === "image_text") && <FontSizeControl label="Body" value={currentSlide.bodySize} onChange={function(v) { updateSlide(Object.assign({}, currentSlide, { bodySize: v })); }} />}
          {(currentSlide.type === "large_image" || currentSlide.type === "dual_image") && <FontSizeControl label="Caption" value={currentSlide.captionSize || 18} onChange={function(v) { updateSlide(Object.assign({}, currentSlide, { captionSize: v })); }} />}
        </div>

        {/* Image controls */}
        {<div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>{currentSlide.type === "dual_image" ? "Image 1" : "Image"}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <BRollPicker onSelect={function(url) { updateSlide(Object.assign({}, currentSlide, { imageUrl: url, imageFit: "cover", imagePosition: "center" })); }} />
            {currentSlide.imageUrl && <button onClick={function() { updateSlide(Object.assign({}, currentSlide, { imageUrl: "" })); }} style={{ padding: "5px 10px", background: C.coral + "12", color: C.coral, border: "1px solid " + C.coral + "30", borderRadius: 6, fontFamily: ft, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Remove</button>}
          </div>
          {currentSlide.imageUrl && <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>Size</div>
              <input type="range" min={20} max={80} value={currentSlide.imageHeight || 46} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { imageHeight: parseInt(e.target.value) })); }} style={{ flex: 1, accentColor: C.amber }} />
              <span style={{ fontFamily: mn, fontSize: 10, color: C.amber, minWidth: 28 }}>{currentSlide.imageHeight || 46}%</span>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontFamily: mn, fontSize: 8, color: C.txd }}>Fit:</span>
              <button onClick={function() { updateSlide(Object.assign({}, currentSlide, { imageFit: "contain", imagePosition: "center", imageHeight: currentSlide.type === "cover" ? 46 : currentSlide.type === "large_image" ? 72 : currentSlide.type === "image_text" ? 50 : 45 })); }} style={{ padding: "2px 8px", borderRadius: 4, background: C.teal + "20", border: "1px solid " + C.teal + "40", color: C.teal, fontFamily: mn, fontSize: 8, cursor: "pointer", fontWeight: 700 }}>Auto</button>
              {["cover", "contain", "fill"].map(function(fit) {
                var active = (currentSlide.imageFit || "cover") === fit;
                return <button key={fit} onClick={function() { updateSlide(Object.assign({}, currentSlide, { imageFit: fit })); }} style={{ padding: "2px 8px", borderRadius: 4, background: active ? C.amber + "20" : "transparent", border: "1px solid " + (active ? C.amber + "40" : C.border), color: active ? C.amber : C.txd, fontFamily: mn, fontSize: 8, cursor: "pointer", textTransform: "capitalize" }}>{fit}</button>;
              })}
            </div>
          </div>}
        </div>}

        {/* Image 2 controls (dual_image only) */}
        {currentSlide.type === "dual_image" && <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.blue, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Image 2</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <BRollPicker onSelect={function(url) { updateSlide(Object.assign({}, currentSlide, { imageUrl2: url, imageFit: "cover", imagePosition2: "center" })); }} />
            {currentSlide.imageUrl2 && <button onClick={function() { updateSlide(Object.assign({}, currentSlide, { imageUrl2: "" })); }} style={{ padding: "5px 10px", background: C.coral + "12", color: C.coral, border: "1px solid " + C.coral + "30", borderRadius: 6, fontFamily: ft, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Remove</button>}
          </div>
        </div>}

        {/* Article images suggestions */}
        {articleImages && articleImages.length > 0 && <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.violet, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Article Images</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {(function() {
              var firstUnused = null;
              articleImages.forEach(function(u) { if (!firstUnused && !slides.some(function(sl) { return sl.imageUrl === u || sl.imageUrl2 === u; })) firstUnused = u; });
              return articleImages.map(function(imgUrl, i) {
                var isUsed = slides.some(function(sl) { return sl.imageUrl === imgUrl || sl.imageUrl2 === imgUrl; });
                var isSuggested = imgUrl === firstUnused && !currentSlide.imageUrl;
                var targetField = currentSlide.type === "dual_image" && currentSlide.imageUrl && !currentSlide.imageUrl2 ? "imageUrl2" : "imageUrl";
                return <div key={i} style={{ position: "relative" }}>
                  <div onClick={function() {
                    if (isUsed) return;
                    var update = { imageFit: "cover", imagePosition: "center" };
                    update[targetField] = imgUrl;
                    updateSlide(Object.assign({}, currentSlide, update));
                  }} style={{ width: "100%", aspectRatio: "4/5", borderRadius: 6, overflow: "hidden", cursor: isUsed ? "default" : "pointer", border: "2px solid " + (isSuggested ? C.amber : isUsed ? C.teal + "50" : C.border), opacity: isUsed ? 0.45 : 1, transition: "all 0.15s", boxShadow: isSuggested ? "0 0 12px " + C.amber + "30" : "none" }} onMouseEnter={function(e) { if (!isUsed) { e.currentTarget.style.borderColor = C.violet; e.currentTarget.style.transform = "scale(1.04)"; } }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = isSuggested ? C.amber : isUsed ? C.teal + "50" : C.border; e.currentTarget.style.transform = "scale(1)"; }}>
                    <img src={imgUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.parentElement.style.display = "none"; }} />
                  </div>
                  {isSuggested && <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", fontFamily: mn, fontSize: 7, color: C.bg, background: C.amber, padding: "1px 6px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>Best match</div>}
                  {isUsed && <div style={{ position: "absolute", top: 2, right: 2, fontFamily: mn, fontSize: 7, color: C.teal, background: "rgba(0,0,0,0.7)", padding: "1px 4px", borderRadius: 3 }}>In use</div>}
                </div>;
              });
            })()}
          </div>
          <div style={{ fontFamily: ft, fontSize: 9, color: C.txd, marginTop: 6 }}>Click to add to this slide{currentSlide.type === "dual_image" ? " (fills empty slot)" : ""}</div>
        </div>}

        {/* Slide management */}
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Manage Slides</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={addSlide} style={{ padding: "8px 14px", background: C.teal + "12", color: C.teal, border: "1px solid " + C.teal + "30", borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ Add Slide</button>
          <button onClick={removeSlide} disabled={slides.length <= 2} style={{ padding: "8px 14px", background: slides.length <= 2 ? C.surface : C.coral + "12", color: slides.length <= 2 ? C.txd : C.coral, border: "1px solid " + (slides.length <= 2 ? C.border : C.coral + "30"), borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: slides.length <= 2 ? "not-allowed" : "pointer" }}>Remove Slide</button>
        </div>

        {/* Text editing panel */}
        <div style={{ marginTop: 20, fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 8 }}>Edit Text (fallback)</div>
        {currentSlide.type === "cover" && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4 }}>Title</div>
          <textarea value={currentSlide.title || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { title: e.target.value })); }} rows={2} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 13, lineHeight: 1.4, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 8 }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>Subtitle</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={function() {
                var curr = currentSlide.subtitle || "";
                if (!curr.trim()) return;
                var _btn = this;
                fetch("/api/carousel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rewrite", text: curr, direction: "shorten" }) }).then(function(r) { return r.json(); }).then(function(d) { if (d.text) updateSlide(Object.assign({}, currentSlide, { subtitle: d.text })); }).catch(function() {});
              }} style={{ padding: "2px 8px", background: C.coral + "10", color: C.coral, border: "1px solid " + C.coral + "25", borderRadius: 4, fontFamily: mn, fontSize: 8, cursor: "pointer" }}>Shorten</button>
              <button onClick={function() {
                var curr = currentSlide.subtitle || "";
                if (!curr.trim()) return;
                fetch("/api/carousel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rewrite", text: curr, direction: "lengthen" }) }).then(function(r) { return r.json(); }).then(function(d) { if (d.text) updateSlide(Object.assign({}, currentSlide, { subtitle: d.text })); }).catch(function() {});
              }} style={{ padding: "2px 8px", background: C.teal + "10", color: C.teal, border: "1px solid " + C.teal + "25", borderRadius: 4, fontFamily: mn, fontSize: 8, cursor: "pointer" }}>Lengthen</button>
            </div>
          </div>
          <textarea value={currentSlide.subtitle || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { subtitle: e.target.value })); }} rows={4} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 12, lineHeight: 1.4, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
        </div>}
        {(currentSlide.type === "body" || currentSlide.type === "image_text") && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4 }}>Body Text</div>
          <textarea value={currentSlide.bodyText || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { bodyText: e.target.value })); }} rows={6} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 12, lineHeight: 1.5, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
        </div>}
        {currentSlide.type === "large_image" && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4 }}>Caption</div>
          <textarea value={currentSlide.caption || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { caption: e.target.value })); }} rows={2} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 12, lineHeight: 1.4, resize: "none", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
        </div>}
      </div>
    </div>

    {/* Thumbnail strip */}
    <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>All Slides</div>
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
      {slides.map(function(sl, i) {
        return <SlideThumbnail key={sl.id} slide={sl} theme={theme} isActive={i === currentIdx} onClick={function() { setCurrentIdx(i); }} index={i} />;
      })}
    </div>
  </div>;
}


// ═══ STEP 4: REVIEW ═══
function ReviewStep({ slides, theme, caption, setCaption, captionLoading, onGenerateCaption, onNext, onBack }) {
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Review</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} style={{ padding: "8px 16px", background: "transparent", color: C.txm, border: "1px solid " + C.border, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back to Editor</button>
        <button onClick={onNext} style={{ padding: "8px 20px", background: C.amber, color: C.bg, border: "none", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Export</button>
      </div>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>Review all slides side by side. Scroll horizontally to see all.</div>

    {/* All slides side by side */}
    <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, marginBottom: 28 }}>
      {slides.map(function(sl, i) {
        var bgUrl = getBackdropUrl(theme, sl.position);
        var rw = 280;
        var rh = 350;
        var rScale = rw / FULL_W;
        var topPad = FULL_H * 0.10 * rScale;
        var botPad = FULL_H * 0.08 * rScale;
        var sidePad = 60 * rScale;
        var imgFit = sl.imageFit || "cover";
        var imgPos = sl.imagePosition || "center";

        return <div key={sl.id} style={{ flexShrink: 0 }}>
          <div style={{ width: rw, height: rh, borderRadius: 6, overflow: "hidden", position: "relative", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: topPad, bottom: botPad, padding: "0 " + sidePad + "px" }}>
              {sl.type === "cover" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 46) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.titleSize * rScale, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 4, overflow: "hidden" }}>{sl.title || ""}</div>
                <div style={{ fontFamily: gf, fontSize: sl.subtitleSize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.35, overflow: "hidden" }}>{sl.subtitle || ""}</div>
              </div>}
              {sl.type === "body" && <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: sl.imageUrl ? "flex-start" : "center" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 45) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, overflow: "hidden", whiteSpace: "pre-wrap" }}>{sl.bodyText || ""}</div>
              </div>}
              {sl.type === "image_text" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 50) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, overflow: "hidden" }}>{sl.bodyText || ""}</div>
              </div>}
              {sl.type === "large_image" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 72) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 18) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>{sl.caption || ""}</div>
              </div>}
              {sl.type === "dual_image" && <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  {sl.imageUrl && <div style={{ width: "100%", flex: 1, borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 2, background: "#000" }}>
                    <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                  </div>}
                  <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 16) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.2, flexShrink: 0 }}>{sl.caption || ""}</div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  {sl.imageUrl2 && <div style={{ width: "100%", flex: 1, borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 2, background: "#000" }}>
                    <img src={sl.imageUrl2} style={{ width: "100%", height: "100%", objectFit: imgFit, display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                  </div>}
                  <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 16) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.2, flexShrink: 0 }}>{sl.caption2 || ""}</div>
                </div>
              </div>}
            </div>
          </div>
          <div style={{ textAlign: "center", fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6 }}>Slide {i + 1} -- {sl.type === "cover" ? "Cover" : sl.position === 4 ? "Closer" : sl.type === "dual_image" ? "2 Images" : sl.type === "image_text" ? "Img+Text" : sl.type === "large_image" ? "Large Img" : "Body"}</div>
        </div>;
      })}
    </div>

    {/* Caption */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Caption</div>
    <div style={{ marginBottom: 16 }}>
      <button onClick={onGenerateCaption} disabled={captionLoading} style={{ padding: "10px 20px", background: C.amber + "15", color: C.amber, border: "1px solid " + C.amber + "30", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: captionLoading ? "wait" : "pointer", opacity: captionLoading ? 0.5 : 1 }}>
        {captionLoading ? "Generating..." : caption ? "Regenerate Caption" : "Generate Caption"}
      </button>
    </div>
    <textarea value={(caption && caption.caption) || ""} onChange={function(e) { setCaption(function(c) { return Object.assign({}, c || {}, { caption: e.target.value }); }); }} placeholder="Caption will appear here..." rows={6} style={{ width: "100%", padding: "14px 16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e) { e.target.style.borderColor = C.amber; }} onBlur={function(e) { e.target.style.borderColor = C.border; }} />
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
  </div>;
}


// ═══ CANVAS RENDERER (for export) ═══
function renderSlideToCanvas(slide, bgUrl) {
  return new Promise(function(resolve, reject) {
    var canvas = document.createElement("canvas");
    canvas.width = FULL_W;
    canvas.height = FULL_H;
    var ctx = canvas.getContext("2d");

    // Load background image
    var bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    bgImg.onload = function() {
      // Draw background scaled to fill
      var bgAspect = bgImg.width / bgImg.height;
      var canvasAspect = FULL_W / FULL_H;
      var sx, sy, sw, sh;
      if (bgAspect > canvasAspect) {
        sh = bgImg.height;
        sw = sh * canvasAspect;
        sx = (bgImg.width - sw) / 2;
        sy = 0;
      } else {
        sw = bgImg.width;
        sh = sw / canvasAspect;
        sx = 0;
        sy = (bgImg.height - sh) / 2;
      }
      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, FULL_W, FULL_H);

      // Draw content
      function drawText(text, x, y, maxWidth, fontSize, fontWeight, color, lineHeight) {
        ctx.font = fontWeight + " " + fontSize + "px Grift, Outfit, sans-serif";
        ctx.fillStyle = color;
        ctx.textBaseline = "top";

        // Shadow
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        var words = (text || "").split(" ");
        var line = "";
        var currentY = y;
        var lh = fontSize * (lineHeight || 1.4);

        for (var i = 0; i < words.length; i++) {
          var testLine = line + words[i] + " ";
          var metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line.trim(), x, currentY);
            line = words[i] + " ";
            currentY += lh;
          } else {
            line = testLine;
          }
        }
        if (line.trim()) ctx.fillText(line.trim(), x, currentY);

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        return currentY + lh;
      }

      function drawImage(imageUrl, x, y, w, h, radius) {
        return new Promise(function(resolveImg) {
          if (!imageUrl) { resolveImg(); return; }
          var img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = function() {
            ctx.save();
            // Rounded rect clip
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.arcTo(x + w, y, x + w, y + radius, radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
            ctx.lineTo(x + radius, y + h);
            ctx.arcTo(x, y + h, x, y + h - radius, radius);
            ctx.lineTo(x, y + radius);
            ctx.arcTo(x, y, x + radius, y, radius);
            ctx.closePath();
            ctx.clip();

            // Cover fill
            var imgAspect = img.width / img.height;
            var frameAspect = w / h;
            var dw, dh, dx, dy;
            if (imgAspect > frameAspect) {
              dh = h;
              dw = dh * imgAspect;
              dx = x + (w - dw) / 2;
              dy = y;
            } else {
              dw = w;
              dh = dw / imgAspect;
              dx = x;
              dy = y + (h - dh) / 2;
            }
            ctx.drawImage(img, dx, dy, dw, dh);
            ctx.restore();
            resolveImg();
          };
          img.onerror = function() { resolveImg(); };
          img.src = imageUrl;
        });
      }

      var COVER_MX = 60; // 5.5% margins for cover
      var TOP_Y = Math.round(FULL_H * 0.06); // 6% from top, below logo
      var BOTTOM_Y = Math.round(FULL_H * 0.08); // 8% from bottom, above arrow
      var contentWidth = FULL_W - MARGIN_X * 2;
      var coverContentWidth = FULL_W - COVER_MX * 2;

      async function drawContent() {
        if (slide.type === "cover") {
          var imgH = Math.round(FULL_H * 0.48);
          await drawImage(slide.imageUrl, COVER_MX, TOP_Y, coverContentWidth, imgH, 20);
          var titleY = TOP_Y + imgH + 20;
          var afterTitle = drawText(slide.title || "", COVER_MX, titleY, coverContentWidth, slide.titleSize, "800", "#ffffff", 1.15);
          drawText(slide.subtitle || "", COVER_MX, afterTitle + 8, coverContentWidth, slide.subtitleSize, "400", "rgba(255,255,255,0.78)", 1.4);
        } else if (slide.type === "body") {
          // Full content area between logo and arrow
          var availH = FULL_H - TOP_Y - BOTTOM_Y;
          var textHeight = 600; // estimated
          var bodyY = TOP_Y + Math.max(0, (availH - textHeight) / 2);
          drawText(slide.bodyText || "", MARGIN_X, bodyY, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.55);
        } else if (slide.type === "image_text") {
          var availH2 = FULL_H - TOP_Y - BOTTOM_Y;
          var imgH2 = Math.round(availH2 * 0.50);
          await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, imgH2, 20);
          var textY = TOP_Y + imgH2 + 16;
          drawText(slide.bodyText || "", MARGIN_X, textY, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.5);
        } else if (slide.type === "large_image") {
          var availH3 = FULL_H - TOP_Y - BOTTOM_Y;
          var imgH3 = Math.round(availH3 * 0.72);
          await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, imgH3, 20);
          var capY = TOP_Y + imgH3 + 12;
          drawText(slide.caption || "", MARGIN_X, capY, contentWidth, slide.captionSize || 18, "400", "rgba(255,255,255,0.65)", 1.4);
        }

        canvas.toBlob(function(blob) {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        }, "image/png");
      }

      drawContent().catch(reject);
    };
    bgImg.onerror = function() { reject(new Error("Failed to load background: " + bgUrl)); };
    bgImg.src = bgUrl;
  });
}


// ═══ STEP 5: EXPORT ═══
function ExportStep({ slides, theme, caption, onBack }) {
  var _downloading = useState(null), downloading = _downloading[0], setDownloading = _downloading[1];
  var _downloadAll = useState(false), downloadingAll = _downloadAll[0], setDownloadingAll = _downloadAll[1];
  var _copied = useState(false), copied = _copied[0], setCopied = _copied[1];

  function downloadSlide(index) {
    var sl = slides[index];
    var bgUrl = getBackdropUrl(theme, sl.position);
    setDownloading(index);
    renderSlideToCanvas(sl, bgUrl).then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "sa-carousel-slide-" + (index + 1) + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloading(null);
    }).catch(function(err) {
      alert("Export failed: " + err.message);
      setDownloading(null);
    });
  }

  function downloadAll() {
    setDownloadingAll(true);
    var idx = 0;
    function nextSlide() {
      if (idx >= slides.length) { setDownloadingAll(false); return; }
      var sl = slides[idx];
      var bgUrl = getBackdropUrl(theme, sl.position);
      var currentIdx = idx;
      renderSlideToCanvas(sl, bgUrl).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "sa-carousel-slide-" + (currentIdx + 1) + ".png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        idx++;
        setTimeout(nextSlide, 400);
      }).catch(function() {
        idx++;
        setTimeout(nextSlide, 400);
      });
    }
    nextSlide();
  }

  function copyCaption() {
    if (caption && caption.caption) {
      var text = caption.caption;
      if (caption.hashtags && caption.hashtags.length > 0) {
        text += "\n\n" + caption.hashtags.map(function(t) { return "#" + t.replace(/^#/, ""); }).join(" ");
      }
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    }
  }

  function exportJSON() {
    var payload = {
      carousel_id: "carousel_" + Date.now(),
      theme: theme,
      slides: slides,
      caption: caption,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "sa-carousel.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Export</div>
      <button onClick={onBack} style={{ padding: "8px 16px", background: "transparent", color: C.txm, border: "1px solid " + C.border, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back to Review</button>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 28 }}>Download slides as PNGs at 1080x1350 resolution. Click individual slides or download all.</div>

    {/* Slide grid with download buttons */}
    <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, marginBottom: 28 }}>
      {slides.map(function(sl, i) {
        var bgUrl = getBackdropUrl(theme, sl.position);
        var rw = 220;
        var rh = 275;
        var rScale = rw / FULL_W;
        var isDownloading = downloading === i;

        return <div key={sl.id} style={{ flexShrink: 0 }}>
          <div style={{ width: rw, height: rh, borderRadius: 6, overflow: "hidden", position: "relative", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", cursor: "pointer" }} onClick={function() { downloadSlide(i); }}>
            {/* Mini content overlay */}
            <div style={{ position: "absolute", inset: 0, padding: MARGIN_X * rScale + "px " + MARGIN_Y * rScale + "px" }}>
              {sl.type === "cover" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: "48%", borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 4, flexShrink: 0 }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.titleSize * rScale, fontWeight: 800, color: "#fff", lineHeight: 1.15, overflow: "hidden" }}>{sl.title || ""}</div>
                <div style={{ fontFamily: gf, fontSize: sl.subtitleSize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.3, overflow: "hidden" }}>{sl.subtitle || ""}</div>
              </div>}
              {sl.type === "body" && <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
                <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, overflow: "hidden", whiteSpace: "pre-wrap" }}>{sl.bodyText || ""}</div>
              </div>}
              {sl.type === "image_text" && <div>
                {sl.imageUrl && <div style={{ width: "100%", height: "50%", borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 4 }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, overflow: "hidden" }}>{sl.bodyText || ""}</div>
              </div>}
              {sl.type === "large_image" && <div>
                {sl.imageUrl && <div style={{ width: "100%", height: "72%", borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 4 }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 18) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>{sl.caption || ""}</div>
              </div>}
            </div>

            {/* Download overlay */}
            <div style={{ position: "absolute", inset: 0, background: isDownloading ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseEnter={function(e) { if (!isDownloading) e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }} onMouseLeave={function(e) { if (!isDownloading) e.currentTarget.style.background = "rgba(0,0,0,0)"; }}>
              {isDownloading ? <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid " + C.border, borderTopColor: C.amber, animation: "cspin 1s linear infinite" }} /> : <div style={{ fontFamily: ft, fontSize: 12, color: "#fff", fontWeight: 700, opacity: 0, transition: "opacity 0.2s", padding: "6px 14px", background: "rgba(0,0,0,0.6)", borderRadius: 6 }} className="dl-label">PNG</div>}
            </div>
          </div>
          <div style={{ textAlign: "center", fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6 }}>Slide {i + 1}</div>
        </div>;
      })}
    </div>

    {/* Export actions */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Export Options</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
      <button onClick={downloadAll} disabled={downloadingAll} style={{ padding: "16px", background: C.amber + "10", border: "1px solid " + C.amber + "30", borderRadius: 10, cursor: downloadingAll ? "wait" : "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.amber + "60"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.amber + "30"; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.amber, marginBottom: 4 }}>{downloadingAll ? "Downloading..." : "Download All PNGs"}</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>{slides.length} slides at 1080x1350</div>
      </button>
      <button onClick={copyCaption} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>{copied ? "Copied!" : "Copy Caption"}</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Caption + hashtags to clipboard</div>
      </button>
      <button onClick={exportJSON} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Download JSON</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Structured slide data</div>
      </button>
      <button onClick={function() { window.open("https://publish.buffer.com", "_blank"); }} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Send to Buffer</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Open Buffer to schedule post</div>
      </button>
    </div>

    {/* Caption preview */}
    {caption && caption.caption && <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Caption Preview</div>
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "16px" }}>
        <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{caption.caption}</div>
        {caption.hashtags && caption.hashtags.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {caption.hashtags.map(function(tag, i) {
            return <span key={i} style={{ fontFamily: ft, fontSize: 12, color: C.blue, padding: "4px 10px", background: C.blue + "10", border: "1px solid " + C.blue + "20", borderRadius: 20 }}>#{tag.replace(/^#/, "")}</span>;
          })}
        </div>}
      </div>
    </div>}

    <style dangerouslySetInnerHTML={{ __html: "@keyframes cspin{to{transform:rotate(360deg)}} .dl-label { opacity: 0; } div:hover > .dl-label { opacity: 1 !important; }" }} />
  </div>;
}


// ═══ CONVERT API RESPONSE TO EDITOR SLIDES ═══
function apiSlidesToEditorSlides(apiSlides, slideCount) {
  var positions = getSlidePositions(slideCount);
  return apiSlides.map(function(apiSl, i) {
    var pos = positions[i] || (i === apiSlides.length - 1 ? 4 : 2);
    var type = "body";
    if (pos === 1) type = "cover";
    else if (apiSl.type === "BODY_IMAGE") type = "image_text";
    else if (apiSl.type === "BODY_LARGE_IMAGE") type = "large_image";
    // else body (for BODY_A, BODY_B, BODY_FINAL, CLOSER)

    // Convert bullet points to paragraph breaks in body text
    var bodyText = apiSl.body_text || "";
    bodyText = bodyText.replace(/^\s*[-*]\s+/gm, "\n").replace(/^\s*\d+[.)]\s+/gm, "\n").replace(/\n{3,}/g, "\n\n").trim();

    return {
      id: "slide-" + i,
      position: pos,
      type: type,
      title: apiSl.title || "",
      titleSize: 74,
      subtitle: apiSl.subtitle || "",
      subtitleSize: 34,
      bodyText: bodyText,
      bodySize: 28,
      imageUrl: apiSl.image_url || "",
      imageHeight: type === "cover" ? 46 : type === "image_text" ? 50 : type === "large_image" ? 72 : 45,
      imagePosition: "center",
      imageFit: "cover",
      caption: apiSl.subtext || "",
      captionSize: 18,
    };
  });
}


// ═══ MAIN CAROUSEL COMPONENT ═══
export default function Carousel() {
  var _step = useState(0), step = _step[0], setStep = _step[1];
  var _maxStep = useState(0), maxStep = _maxStep[0], setMaxStep = _maxStep[1];
  var _state = useState({ category: "general", mode: "auto", pageCount: 4, text: "", url: "" }), state = _state[0], setState = _state[1];
  var _slides = useState([]), slides = _slides[0], setSlides = _slides[1];
  var _variants = useState(null), variants = _variants[0], setVariants = _variants[1];
  var _caption = useState(null), caption = _caption[0], setCaption = _caption[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _captionLoading = useState(false), captionLoading = _captionLoading[0], setCaptionLoading = _captionLoading[1];

  function goStep(n) { setStep(n); if (n > maxStep) setMaxStep(n); }

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
          pageCount: state.pageCount || 4,
          imageUrls: (state.articleImages || []).filter(function(u) { return u && !u.startsWith("data:"); }),
        }),
      });
      var d = await r.json();
      if (d.error) {
        alert("Generation failed: " + d.error);
        goStep(0);
      } else if (d.variants) {
        setVariants(d.variants);
        // Go to variant selection step (step 2)
        var keys = Object.keys(d.variants).filter(function(k) { return d.variants[k] && d.variants[k].slides; });
        if (keys.length > 0) {
          goStep(2);
        } else {
          alert("No valid variants returned.");
          goStep(0);
        }
      }
    } catch (e) {
      alert("Network error: " + e.message);
      goStep(0);
    }
    setLoading(false);
  }

  async function generateCaption() {
    setCaptionLoading(true);
    try {
      // Convert back to API format for caption generation
      var apiSlides = slides.map(function(sl) {
        var apiType = "BODY_A";
        if (sl.type === "cover") apiType = "COVER";
        else if (sl.position === 4) apiType = "BODY_FINAL";
        else if (sl.type === "image_text") apiType = "BODY_IMAGE";
        else if (sl.type === "large_image") apiType = "BODY_LARGE_IMAGE";
        else if (sl.position === 3) apiType = "BODY_B";

        return {
          type: apiType,
          title: sl.title,
          subtitle: sl.subtitle,
          body_text: sl.bodyText,
          subtext: sl.caption,
          image_url: sl.imageUrl,
        };
      });
      var r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "caption", slides: apiSlides }),
      });
      var d = await r.json();
      if (d.caption) setCaption(d.caption);
    } catch (e) {
      alert("Caption error: " + e.message);
    }
    setCaptionLoading(false);
  }

  // Variant picker overlay for step 1 result
  var _showVariantPicker = useState(false), showVariantPicker = _showVariantPicker[0], setShowVariantPicker = _showVariantPicker[1];

  function pickVariant(key) {
    var picked = variants[key];
    if (!picked || !picked.slides) return;
    var editorSlides = apiSlidesToEditorSlides(picked.slides, picked.slides.length);
    setSlides(editorSlides);
    setShowVariantPicker(false);
  }

  return <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <div>
        <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Carousel</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 2 }}>SA Branded // 1080x1350 // Real Backgrounds</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: THEMES[state.category].color, boxShadow: "0 0 8px " + THEMES[state.category].color + "60" }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: C.txm }}>{state.category} // {THEMES[state.category].prefix}</span>
        {/* Variant picker button (when we have variants and are in edit mode) */}
        {variants && step >= 3 && <button onClick={function() { setShowVariantPicker(!showVariantPicker); }} style={{ padding: "4px 10px", background: C.surface, border: "1px solid " + C.border, borderRadius: 4, fontFamily: mn, fontSize: 9, color: C.txm, cursor: "pointer" }}>Variants</button>}
      </div>
    </div>

    <StepBar step={step} setStep={function(n) { if (n <= maxStep) goStep(n); }} maxStep={maxStep} />

    {/* Variant picker dropdown */}
    {showVariantPicker && variants && <div style={{ marginBottom: 20, background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 10 }}>Switch Variant</div>
      <div style={{ display: "flex", gap: 10 }}>
        {Object.keys(variants).filter(function(k) { return variants[k] && variants[k].slides; }).map(function(k) {
          var v = variants[k];
          var varColors = { A: C.amber, B: C.blue, C: C.teal };
          var color = varColors[k] || C.amber;
          return <div key={k} onClick={function() { pickVariant(k); }} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, cursor: "pointer", background: color + "08", border: "1px solid " + color + "30", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = color; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = color + "30"; }}>
            <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: color, marginBottom: 2 }}>Variant {k}</div>
            <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>{v.label || ""}</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 2 }}>{v.slides.length} slides</div>
          </div>;
        })}
      </div>
    </div>}

    {step === 0 && <InputStep state={state} setState={setState} onNext={generate} />}
    {step === 1 && loading && <GenerateStep />}
    {step === 2 && variants && <VariantSelectStep
      variants={variants}
      theme={state.category}
      onSelect={function(key) {
        var picked = variants[key];
        if (!picked || !picked.slides) return;
        var editorSlides = apiSlidesToEditorSlides(picked.slides, picked.slides.length);
        setSlides(editorSlides);
        goStep(3);
      }}
      onBack={function() { goStep(0); }}
    />}
    {step === 3 && <EditStep
      slides={slides}
      setSlides={setSlides}
      theme={state.category}
      articleImages={state.articleImages || []}
      onNext={function() { goStep(4); }}
      onBack={function() { goStep(2); }}
    />}
    {step === 4 && <ReviewStep
      slides={slides}
      theme={state.category}
      caption={caption}
      setCaption={setCaption}
      captionLoading={captionLoading}
      onGenerateCaption={generateCaption}
      onNext={function() { goStep(5); }}
      onBack={function() { goStep(3); }}
    />}
    {step === 5 && <ExportStep
      slides={slides}
      theme={state.category}
      caption={caption}
      onBack={function() { goStep(4); }}
    />}
  </div>;
}
