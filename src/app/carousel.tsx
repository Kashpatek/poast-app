"use client";
import { useState, useEffect, useRef } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { D as C, ft, mn, gf } from "./shared-constants";
import { useUser } from "./user-context";
import { showToast } from "./toast-context";
import { confirmDialog, promptDialog } from "./dialog-context";

/* ═══════════════════════════════════════════════════════════════════════════
   SA CAROUSEL v3.1 -- Visual Slide Editor with Real Branded Backgrounds
   ═══════════════════════════════════════════════════════════════════════════ */

// ═══ TYPES ═══
type ThemeKey = "general" | "internal" | "external" | "capital";

interface Slide {
  type: string;
  title?: string;
  subtitle?: string;
  bodyText?: string;
  imageUrl?: string;
  imageUrl2?: string;
  imageHeight?: number;
  imagePosition?: string;
  imagePosition2?: string;
  imageFit?: string;
  bodySize: number;
  titleSize: number;
  subtitleSize: number;
  captionSize: number;
  caption?: string;
  caption2?: string;
  ctaText?: string;
  ctaPosition?: string;
  position: number;
  id: string;
  inverted?: boolean;
  subtitleLength?: number;
  _carouselTitle?: string;
}

interface GeneratedSlide {
  type: string;
  title?: string;
  subtitle?: string;
  body_text?: string;
  image_url?: string;
  subtext?: string;
}

interface Variant {
  label?: string;
  topic?: string;
  slides: GeneratedSlide[];
}

interface BRollImageAsset {
  id: string;
  type: string;
  url: string;
  thumbnail?: string;
  filename?: string;
  description?: string;
  category?: string;
}

interface CarouselState {
  category: ThemeKey;
  url?: string;
  text?: string;
  mode: string;
  pageCount: number;
  fileName?: string;
  articleImages?: string[];
  selectedArticleImage?: string | null;
  fetchingImages?: boolean;
}

// ═══ THEME / BACKDROP MAPPING ═══
var THEMES: Record<ThemeKey, { prefix: string; label: string; color: string; desc: string }> = {
  general:  { prefix: "YB", label: "General",  color: "#D4A853", desc: "Industry news, trends, analysis" },
  internal: { prefix: "Y",  label: "Internal", color: "#F7B041", desc: "SA original research and findings" },
  external: { prefix: "B",  label: "External", color: "#0B86D1", desc: "Third-party content with SA commentary" },
  capital:  { prefix: "G",  label: "Capital",  color: "#2EAD8E", desc: "Financial and investment analysis" },
};

function getBackdropUrl(theme: ThemeKey, position: number) {
  return "/backdrops/" + THEMES[theme].prefix + position + ".jpg";
}

function getSlidePositions(count: number) {
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

function getSlideType(position: number) {
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
function StepBar({ step, setStep, maxStep }: { step: number; setStep: (n: number) => void; maxStep: number }) {
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
function BRollPicker({ onSelect }: { onSelect: (url: string) => void }) {
  var _open = useState(false), open = _open[0], setOpen = _open[1];
  var _assets = useState<BRollImageAsset[]>([]), assets = _assets[0], setAssets = _assets[1];
  var _loadState = useState<string>("idle"), loadState = _loadState[0], setLoadState = _loadState[1];
  var _search = useState(""), search = _search[0], setSearch = _search[1];
  var _catFilter = useState("all"), catFilter = _catFilter[0], setCatFilter = _catFilter[1];

  function loadAssets() {
    if (loadState === "loaded" || loadState === "loading") return;
    setLoadState("loading");
    fetch("/api/db?table=projects").then(function(r) { return r.json(); }).then(function(res: { data?: Array<{ type: string; id: string; data?: { assets?: BRollImageAsset[] } }> }) {
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
  function handlePick(asset: BRollImageAsset) { onSelect(asset.url); setOpen(false); }

  var categories: string[] = [];
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
              <img src={asset.thumbnail || asset.url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
            </div>;
          })}
        </div>}
      </div>
    </div>}
  </div>;
}

// ═══ FONT SIZE CONTROL ═══
function FontSizeControl({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, minWidth: 40 }}>{label}</span>
    <button onClick={function() { onChange(Math.max(12, value - 1)); }} style={{ width: 22, height: 22, borderRadius: 4, background: C.surface, border: "1px solid " + C.border, color: C.txm, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>-</button>
    <span style={{ fontFamily: mn, fontSize: 10, color: C.tx, minWidth: 24, textAlign: "center" }}>{value}</span>
    <button onClick={function() { onChange(Math.min(120, value + 1)); }} style={{ width: 22, height: 22, borderRadius: 4, background: C.surface, border: "1px solid " + C.border, color: C.txm, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>+</button>
  </div>;
}

// ═══ IMAGE FRAME (clickable area for image insertion with position control) ═══
function ImageFrame({ imageUrl, onImageChange, onPositionChange, imagePosition, imageFit, style: frameStyle, slideId }: { imageUrl?: string; onImageChange: (url: string) => void; onPositionChange?: (pos: string) => void; imagePosition?: string; imageFit?: string; style?: React.CSSProperties; slideId: string }) {
  var fileRef = useRef<HTMLInputElement>(null);
  var _hover = useState(false), hover = _hover[0], setHover = _hover[1];
  var pos = imagePosition || "center";
  var fit: "cover" | "contain" | "fill" = (imageFit as "cover" | "contain" | "fill") || "cover";

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).closest("button")) return;
    if (fileRef.current) fileRef.current.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) { onImageChange(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return <div onClick={handleClick} onMouseEnter={function() { setHover(true); }} onMouseLeave={function() { setHover(false); }} style={Object.assign({}, { borderRadius: 20 * SCALE, overflow: "hidden", cursor: "pointer", position: "relative", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)" }, frameStyle)}>
    {imageUrl ? <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: pos, display: "block", background: "#000" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.opacity = "0.3"; }} />
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
function SlideCanvas({ slide, theme, onUpdate }: { slide: Slide; theme: ThemeKey; onUpdate: (s: Slide) => void }) {
  var bgUrl = getBackdropUrl(theme, slide.position);
  var mx = MARGIN_X * SCALE; // ~32px
  var my = MARGIN_Y * SCALE; // ~40px

  function updateField(field: string, value: string | number) {
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
    {slide.type === "body" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column", justifyContent: slide.imageUrl ? "flex-start" : "center" }}>
      {/* Optional image on body slides */}
      {slide.imageUrl && <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        style={{ width: "100%", height: (slide.imageHeight || 45) + "%", marginBottom: slide.inverted ? 0 : 12, marginTop: slide.inverted ? 12 : 0, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("bodyText", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.bodySize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.55, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden" }}
      >{slide.bodyText || "Body text"}</div>
      {/* CTA text on closer (position 4) */}
      {slide.position === 4 && slide.ctaText && <div style={{ position: "absolute", bottom: (16 - FULL_H * 0.08) * SCALE, left: slide.ctaPosition === "bottom-center" ? 0 : "auto", right: slide.ctaPosition === "bottom-center" ? 0 : (60 * SCALE), width: slide.ctaPosition === "bottom-center" ? "100%" : "auto", textAlign: slide.ctaPosition === "bottom-center" ? "center" : "right", fontFamily: gf, fontSize: 30 * SCALE, fontWeight: 700, color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)", letterSpacing: "1px" }}>{slide.ctaText}</div>}
    </div>}

    {/* ─── IMAGE + TEXT SLIDE ─── */}
    {slide.type === "image_text" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column" }}>
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
    {slide.type === "large_image" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column" }}>
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
function SlideThumbnail({ slide, theme, isActive, onClick, index }: { slide: Slide; theme: ThemeKey; isActive: boolean; onClick: () => void; index: number }) {
  var bgUrl = getBackdropUrl(theme, slide.position);
  var tw = 120;
  var th = 150; // 4:5 ratio
  var tScale = tw / FULL_W;

  return <div onClick={onClick} style={{ width: tw, height: th, borderRadius: 6, overflow: "hidden", cursor: "pointer", position: "relative", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, border: "2px solid " + (isActive ? C.amber : "transparent"), boxShadow: isActive ? "0 0 12px " + C.amber + "40" : "0 2px 8px rgba(0,0,0,0.3)", transition: "all 0.2s", opacity: isActive ? 1 : 0.7 }} onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.opacity = "0.9"; }} onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.opacity = "0.7"; }}>
    {/* Mini content overlay */}
    <div style={{ position: "absolute", inset: 0, padding: 6 }}>
      {slide.type === "cover" && <div>
        {slide.imageUrl && <div style={{ width: "100%", height: "40%", borderRadius: 3, overflow: "hidden", marginBottom: 3, background: "rgba(255,255,255,0.05)" }}>
          <img src={slide.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: 7, fontWeight: 800, color: "#fff", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{slide.title || ""}</div>
      </div>}
      {(slide.type === "body") && <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
        <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" }}>{slide.bodyText || ""}</div>
      </div>}
      {slide.type === "image_text" && <div>
        {slide.imageUrl && <div style={{ width: "100%", height: "50%", borderRadius: 3, overflow: "hidden", marginBottom: 2, background: "rgba(255,255,255,0.05)" }}>
          <img src={slide.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.7)", lineHeight: 1.2, overflow: "hidden" }}>{(slide.bodyText || "").slice(0, 40)}</div>
      </div>}
      {slide.type === "large_image" && <div>
        {slide.imageUrl && <div style={{ width: "100%", height: "70%", borderRadius: 3, overflow: "hidden", marginBottom: 2, background: "rgba(255,255,255,0.05)" }}>
          <img src={slide.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.5)", lineHeight: 1.2 }}>{(slide.caption || "").slice(0, 30)}</div>
      </div>}
    </div>
    {/* Index badge */}
    <div style={{ position: "absolute", bottom: 4, right: 4, fontFamily: mn, fontSize: 8, color: isActive ? C.amber : "rgba(255,255,255,0.4)", fontWeight: 700 }}>{index + 1}</div>
  </div>;
}


// ═══ STEP 0: INPUT ═══
function InputStep({ state, setState, onNext }: { state: CarouselState; setState: React.Dispatch<React.SetStateAction<CarouselState>>; onNext: () => void }) {
  var _dragging = useState(false), dragging = _dragging[0], setDragging = _dragging[1];
  var _inputMode = useState<string | null>(state.url ? "link" : state.text ? "context" : null), inputMode = _inputMode[0], setInputMode = _inputMode[1];
  var themeKeys = Object.keys(THEMES) as ThemeKey[];

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) { setState(function(s) { return Object.assign({}, s, { text: e.target?.result as string, fileName: file.name }); }); };
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
      <input value={state.url || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { url: e.target.value }); }); }} placeholder="https://semianalysis.com/p/..." style={{ width: "100%", padding: "14px 18px", background: C.card, border: "1px solid " + C.blue + "30", borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 15, outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.blue; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.blue + "30"; }} />
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
        <textarea value={state.text || ""} onChange={function(e) { setState(function(s) { return Object.assign({}, s, { text: e.target.value }); }); }} placeholder="Paste article text here..." rows={10} style={{ width: "100%", padding: "14px 16px", background: dragging ? C.amber + "08" : C.card, border: "1px solid " + (dragging ? C.teal : C.border), borderRadius: 10, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.teal; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.border; }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <label style={{ fontFamily: mn, fontSize: 10, color: C.txd, cursor: "pointer", padding: "4px 10px", border: "1px solid " + C.border, borderRadius: 5 }}>
            Upload .txt <input type="file" accept=".txt,.md" onChange={function(e) { handleFile(e.target.files && e.target.files[0]); }} style={{ display: "none" }} />
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
            var files = Array.prototype.slice.call(e.target.files || []) as File[];
            files.forEach(function(file) {
              var reader = new FileReader();
              reader.onload = function(ev) {
                setState(function(s) {
                  var existing = s.articleImages || [];
                  return Object.assign({}, s, { articleImages: existing.concat([ev.target?.result as string]) });
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
              <img src={imgUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = "none"; }} />
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
function VariantSelectStep({ variants, theme, onSelect, onBack }: { variants: Record<string, Variant>; theme: ThemeKey; onSelect: (key: string) => void; onBack: () => void }) {
  var variantKeys = Object.keys(variants || {}).filter(function(k) { return variants[k] && variants[k].slides; });
  var varColors: Record<string, string> = { A: C.amber, B: C.blue, C: C.teal };
  var varLabels: Record<string, string> = { A: "Concise", B: "Deep Dive", C: "Visual Story" };
  var _hover = useState<string | null>(null), hoverKey = _hover[0], setHoverKey = _hover[1];

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
        var typeBreakdown: Record<string, number> = {};
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
                      <img src={sl.image_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                    </div>}
                    <div style={{ fontFamily: gf, fontSize: 9, fontWeight: 800, color: "#fff", lineHeight: 1.15, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{sl.title || ""}</div>
                    <div style={{ fontFamily: gf, fontSize: 6, color: "rgba(255,255,255,0.6)", lineHeight: 1.3, marginTop: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{sl.subtitle || ""}</div>
                  </div>}
                  {(sl.type === "BODY_A" || sl.type === "BODY_B" || sl.type === "BODY_FINAL") && <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                    <div style={{ fontFamily: gf, fontSize: 6, color: "rgba(255,255,255,0.75)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 10, WebkitBoxOrient: "vertical", whiteSpace: "pre-wrap" }}>{sl.body_text || ""}</div>
                  </div>}
                  {sl.type === "BODY_IMAGE" && <div>
                    <div style={{ width: "100%", height: "45%", borderRadius: 4, overflow: "hidden", marginBottom: 3, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sl.image_url ? <img src={sl.image_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} /> : <div style={{ fontFamily: mn, fontSize: 7, color: "rgba(255,255,255,0.15)" }}>IMAGE</div>}
                    </div>
                    <div style={{ fontFamily: gf, fontSize: 5.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}>{sl.body_text || ""}</div>
                  </div>}
                  {sl.type === "BODY_LARGE_IMAGE" && <div>
                    <div style={{ width: "100%", height: "65%", borderRadius: 4, overflow: "hidden", marginBottom: 3, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sl.image_url ? <img src={sl.image_url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} /> : <div style={{ fontFamily: mn, fontSize: 7, color: "rgba(255,255,255,0.15)" }}>IMAGE</div>}
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
function EditStep({ slides, setSlides, theme, onNext, onBack, articleImages }: { slides: Slide[]; setSlides: (s: Slide[]) => void; theme: ThemeKey; onNext: () => void; onBack: () => void; articleImages?: string[] }) {
  var _currentIdx = useState(0), currentIdx = _currentIdx[0], setCurrentIdx = _currentIdx[1];
  var currentSlide = slides[currentIdx] || slides[0];

  function updateSlide(updated: Slide) {
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

  function changeSlideType(newType: string) {
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
    function handleKey(e: KeyboardEvent) {
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

        {/* Invert layout (image top/bottom) — not on cover or text-only body without image */}
        {currentSlide.position !== 1 && (currentSlide.imageUrl || currentSlide.type === "image_text" || currentSlide.type === "large_image") && <div style={{ marginBottom: 16 }}>
          <button onClick={function() { updateSlide(Object.assign({}, currentSlide, { inverted: !currentSlide.inverted })); }} style={{ padding: "7px 14px", borderRadius: 6, background: currentSlide.inverted ? C.violet + "15" : C.surface, border: "1px solid " + (currentSlide.inverted ? C.violet + "40" : C.border), color: currentSlide.inverted ? C.violet : C.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>{"\u21C5"}</span> {currentSlide.inverted ? "Inverted (text on top)" : "Invert Layout"}
          </button>
        </div>}

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
              <button onClick={function() { updateSlide(Object.assign({}, currentSlide, { imageFit: "cover", imagePosition: "center", imageHeight: currentSlide.type === "cover" ? 46 : currentSlide.type === "large_image" ? 72 : currentSlide.type === "image_text" ? 50 : 45 })); }} style={{ padding: "2px 8px", borderRadius: 4, background: C.teal + "20", border: "1px solid " + C.teal + "40", color: C.teal, fontFamily: mn, fontSize: 8, cursor: "pointer", fontWeight: 700 }}>Auto</button>
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
              var firstUnused: string | null = null;
              articleImages.forEach(function(u) { if (!firstUnused && !slides.some(function(sl) { return sl.imageUrl === u || sl.imageUrl2 === u; })) firstUnused = u; });
              return articleImages.map(function(imgUrl, i) {
                var isUsed = slides.some(function(sl) { return sl.imageUrl === imgUrl || sl.imageUrl2 === imgUrl; });
                var isSuggested = imgUrl === firstUnused && !currentSlide.imageUrl;
                var targetField = currentSlide.type === "dual_image" && currentSlide.imageUrl && !currentSlide.imageUrl2 ? "imageUrl2" : "imageUrl";
                return <div key={i} style={{ position: "relative" }}>
                  <div onClick={function() {
                    if (isUsed) return;
                    var update: Record<string, string> = { imageFit: "cover", imagePosition: "center" };
                    update[targetField] = imgUrl;
                    updateSlide(Object.assign({}, currentSlide, update));
                  }} style={{ width: "100%", aspectRatio: "4/5", borderRadius: 6, overflow: "hidden", cursor: isUsed ? "default" : "pointer", border: "2px solid " + (isSuggested ? C.amber : isUsed ? C.teal + "50" : C.border), opacity: isUsed ? 0.45 : 1, transition: "all 0.15s", boxShadow: isSuggested ? "0 0 12px " + C.amber + "30" : "none" }} onMouseEnter={function(e) { if (!isUsed) { e.currentTarget.style.borderColor = C.violet; e.currentTarget.style.transform = "scale(1.04)"; } }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = isSuggested ? C.amber : isUsed ? C.teal + "50" : C.border; e.currentTarget.style.transform = "scale(1)"; }}>
                    <img src={imgUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = "none"; }} />
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
          <textarea value={currentSlide.title || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { title: e.target.value })); }} rows={2} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 13, lineHeight: 1.4, resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 8 }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.amber; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.border; }} />
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>Subtitle Length</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber }}>{(currentSlide.subtitleLength || 3)} sentences</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: mn, fontSize: 8, color: C.coral }}>Short</span>
              <input type="range" min={1} max={5} value={currentSlide.subtitleLength || 3} onChange={function(e) {
                var target = parseInt(e.target.value);
                updateSlide(Object.assign({}, currentSlide, { subtitleLength: target }));
                var curr = currentSlide.subtitle || "";
                if (!curr.trim()) return;
                var labels: Record<number, string> = { 1: "1 short sentence, under 15 words", 2: "2 sentences, under 30 words", 3: "3 sentences, 40-50 words", 4: "3-4 sentences, 50-65 words", 5: "4-5 sentences, 65-80 words, fill the space" };
                fetch("/api/carousel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rewrite", text: curr, direction: target < 3 ? "shorten" : "lengthen", targetLength: labels[target] }) }).then(function(r) { return r.json(); }).then(function(d) { if (d.text) updateSlide(Object.assign({}, currentSlide, { subtitle: d.text, subtitleLength: target })); }).catch(function() {});
              }} style={{ flex: 1, accentColor: C.amber }} />
              <span style={{ fontFamily: mn, fontSize: 8, color: C.teal }}>Long</span>
            </div>
          </div>
          <textarea value={currentSlide.subtitle || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { subtitle: e.target.value })); }} rows={4} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 12, lineHeight: 1.4, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.amber; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.border; }} />
        </div>}
        {(currentSlide.type === "body" || currentSlide.type === "image_text") && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4 }}>Body Text</div>
          <textarea value={currentSlide.bodyText || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { bodyText: e.target.value })); }} rows={6} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 12, lineHeight: 1.5, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.amber; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.border; }} />
        </div>}
        {currentSlide.type === "large_image" && <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4 }}>Caption</div>
          <textarea value={currentSlide.caption || ""} onChange={function(e) { updateSlide(Object.assign({}, currentSlide, { caption: e.target.value })); }} rows={2} style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 12, lineHeight: 1.4, resize: "none", outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.amber; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.border; }} />
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
interface CaptionOption {
  label?: string;
  instagram?: { caption?: string; hashtags?: string[] };
  tiktok?: { caption?: string; hashtags?: string[] };
  shorts?: { title?: string; hashtags?: string[] };
  [key: string]: unknown;
}

function ReviewStep({ slides, setSlides, theme, onNext, onBack, sourceUrl, variantLabel, captionOptions, setCaptionOptions, selectedCaptionIdx, setSelectedCaptionIdx, setCaption }: { slides: Slide[]; setSlides: (s: Slide[]) => void; theme: ThemeKey; onNext: () => void; onBack: () => void; sourceUrl: string; variantLabel: string; captionOptions: CaptionOption[]; setCaptionOptions: React.Dispatch<React.SetStateAction<CaptionOption[]>>; selectedCaptionIdx: number; setSelectedCaptionIdx: (i: number) => void; setCaption: (c: unknown) => void }) {
  var _showReprompt = useState(false), showReprompt = _showReprompt[0], setShowReprompt = _showReprompt[1];
  var _repromptText = useState(""), repromptText = _repromptText[0], setRepromptText = _repromptText[1];
  var _captionLoading = useState(false), captionLoading = _captionLoading[0], setCaptionLoading = _captionLoading[1];
  var _platTab = useState("instagram"), platTab = _platTab[0], setPlatTab = _platTab[1];

  var PLATFORMS = [
    { key: "instagram", label: "Instagram", color: "#E4405F", charLimit: 2200 },
    { key: "tiktok", label: "TikTok", color: "#00F2EA", charLimit: 2200 },
    { key: "shorts", label: "YT Shorts", color: "#FF0000", charLimit: 100 },
  ];

  // CTA defaults
  var lastSlide = slides[slides.length - 1];
  var ctaText = lastSlide ? (lastSlide.ctaText || "") : "";
  var ctaPosition = lastSlide ? (lastSlide.ctaPosition || "bottom-center") : "bottom-center";

  function updateLastSlideCta(field: string, value: string) {
    var newSlides = slides.slice();
    var idx = newSlides.length - 1;
    newSlides[idx] = Object.assign({}, newSlides[idx], { [field]: value });
    setSlides(newSlides);
  }

  function buildApiSlides() {
    return slides.map(function(sl: Slide) {
      var apiType = "BODY_A";
      if (sl.type === "cover") apiType = "COVER";
      else if (sl.position === 4) apiType = "BODY_FINAL";
      else if (sl.type === "image_text") apiType = "BODY_IMAGE";
      else if (sl.type === "large_image") apiType = "BODY_LARGE_IMAGE";
      else if (sl.position === 3) apiType = "BODY_B";
      return {
        type: apiType,
        title: sl.title || "",
        subtitle: sl.subtitle || "",
        body_text: sl.bodyText || "",
        subtext: sl.caption || "",
        image_url: sl.imageUrl || "",
      };
    });
  }

  function generateCaptions(extraContext: string) {
    setCaptionLoading(true);
    var apiSlides = buildApiSlides();
    fetch("/api/carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "caption",
        slides: apiSlides,
        sourceUrl: sourceUrl || "",
        variantLabel: variantLabel || "",
        theme: theme,
        extraContext: extraContext || "",
      }),
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.captionOptions && Array.isArray(d.captionOptions) && d.captionOptions.length > 0) {
        setCaptionOptions(d.captionOptions);
        setSelectedCaptionIdx(0);
        if (d.captionOptions[0] && d.captionOptions[0].instagram) {
          setCaption(d.captionOptions[0].instagram);
        }
      }
      setCaptionLoading(false);
    }).catch(function() { setCaptionLoading(false); });
  }

  // Auto-generate captions on mount if none exist
  useEffect(function() {
    if (captionOptions.length > 0 || captionLoading) return;
    generateCaptions("");
  }, []);

  function handleSelectOption(idx: number) {
    setSelectedCaptionIdx(idx);
    var opt = captionOptions[idx];
    if (opt && opt.instagram) setCaption(opt.instagram);
  }

  function handleReprompt() {
    generateCaptions(repromptText);
    setShowReprompt(false);
    setRepromptText("");
  }

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
      {slides.map(function(sl: Slide, i: number) {
        var bgUrl = getBackdropUrl(theme, sl.position);
        var rw = 280;
        var rh = 350;
        var rScale = rw / FULL_W;
        var topPad = FULL_H * 0.10 * rScale;
        var botPad = FULL_H * 0.08 * rScale;
        var sidePad = 60 * rScale;
        var imgFit = (sl.imageFit || "cover") as "cover" | "contain" | "fill";
        var imgPos = sl.imagePosition || "center";

        return <div key={sl.id} style={{ flexShrink: 0 }}>
          <div style={{ width: rw, height: rh, borderRadius: 6, overflow: "hidden", position: "relative", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: topPad, bottom: botPad, padding: "0 " + sidePad + "px" }}>
              {sl.type === "cover" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 46) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.titleSize * rScale, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 4, overflow: "hidden" }}>{sl.title || ""}</div>
                <div style={{ fontFamily: gf, fontSize: sl.subtitleSize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.35, overflow: "hidden" }}>{sl.subtitle || ""}</div>
              </div>}
              {sl.type === "body" && <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: sl.imageUrl ? "flex-start" : "center", position: "relative" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 45) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, overflow: "hidden", whiteSpace: "pre-wrap" }}>{sl.bodyText || ""}</div>
                {sl.position === 4 && sl.ctaText && <div style={{ position: "absolute", bottom: (16 - FULL_H * 0.08) * rScale, left: sl.ctaPosition === "bottom-center" ? 0 : "auto", right: sl.ctaPosition === "bottom-center" ? 0 : sidePad, width: sl.ctaPosition === "bottom-center" ? "100%" : "auto", textAlign: sl.ctaPosition === "bottom-center" ? "center" : "right", fontFamily: gf, fontSize: 30 * rScale, fontWeight: 700, color: "#ffffff", textShadow: "0 2px 8px rgba(0,0,0,0.5)", letterSpacing: "1px" }}>{sl.ctaText}</div>}
              </div>}
              {sl.type === "image_text" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 50) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, overflow: "hidden" }}>{sl.bodyText || ""}</div>
              </div>}
              {sl.type === "large_image" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 72) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 18) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>{sl.caption || ""}</div>
              </div>}
              {sl.type === "dual_image" && <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  {sl.imageUrl && <div style={{ width: "100%", flex: 1, borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 2, background: "#000" }}>
                    <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                  </div>}
                  <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 16) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.2, flexShrink: 0 }}>{sl.caption || ""}</div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  {sl.imageUrl2 && <div style={{ width: "100%", flex: 1, borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 2, background: "#000" }}>
                    <img src={sl.imageUrl2} style={{ width: "100%", height: "100%", objectFit: imgFit, display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
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

    {/* Last Slide CTA */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Last Slide CTA</div>
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "16px 18px", marginBottom: 28 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4 }}>CTA Text</div>
          <input value={ctaText} onChange={function(e) { updateLastSlideCta("ctaText", e.target.value); }} placeholder="LINK IN BIO" style={{ width: "100%", padding: "8px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 6, color: C.tx, fontFamily: gf, fontSize: 14, fontWeight: 700, outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.amber; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.border; }} />
        </div>
        <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginBottom: 4 }}>Position</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={function() { updateLastSlideCta("ctaPosition", "bottom-right"); }} style={{ padding: "6px 12px", borderRadius: 6, background: ctaPosition === "bottom-right" || !ctaPosition ? C.amber + "15" : C.surface, border: "1px solid " + (ctaPosition === "bottom-right" || !ctaPosition ? C.amber + "40" : C.border), color: ctaPosition === "bottom-right" || !ctaPosition ? C.amber : C.txd, fontFamily: ft, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Bottom Right</button>
            <button onClick={function() { updateLastSlideCta("ctaPosition", "bottom-center"); }} style={{ padding: "6px 12px", borderRadius: 6, background: ctaPosition === "bottom-center" ? C.amber + "15" : C.surface, border: "1px solid " + (ctaPosition === "bottom-center" ? C.amber + "40" : C.border), color: ctaPosition === "bottom-center" ? C.amber : C.txd, fontFamily: ft, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Bottom Center</button>
          </div>
        </div>
      </div>
      {!ctaText && <button onClick={function() { updateLastSlideCta("ctaText", "LINK IN BIO"); updateLastSlideCta("ctaPosition", "bottom-right"); }} style={{ padding: "6px 14px", background: C.teal + "12", color: C.teal, border: "1px solid " + C.teal + "30", borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Add Default CTA</button>}
      {ctaText && <button onClick={function() { updateLastSlideCta("ctaText", ""); }} style={{ padding: "6px 14px", background: C.coral + "12", color: C.coral, border: "1px solid " + C.coral + "30", borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Remove CTA</button>}
    </div>

    {/* Caption Generation */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Captions</div>

    {captionLoading && <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid " + C.border, borderTopColor: C.amber, margin: "0 auto 12px", animation: "cspin 1s linear infinite" }} />
      <div style={{ fontFamily: ft, fontSize: 13, color: C.txm }}>Generating 3 caption options...</div>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes cspin{to{transform:rotate(360deg)}}" }} />
    </div>}

    {/* Caption option selector cards */}
    {!captionLoading && captionOptions.length > 0 && <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      {captionOptions.map(function(opt: CaptionOption, oi: number) {
        var isSel = selectedCaptionIdx === oi;
        var optColors = [C.amber, C.blue, C.teal];
        var oc = optColors[oi] || C.amber;
        var igPreview = opt.instagram ? (opt.instagram.caption || "").slice(0, 80) : "";
        return <div key={oi} onClick={function() { handleSelectOption(oi); }} style={{ flex: 1, padding: "14px 16px", borderRadius: 10, cursor: "pointer", background: isSel ? oc + "10" : C.card, border: "1px solid " + (isSel ? oc + "50" : C.border), transition: "all 0.2s", boxShadow: isSel ? "0 0 16px " + oc + "15" : "none" }} onMouseEnter={function(e) { if (!isSel) e.currentTarget.style.borderColor = oc + "30"; }} onMouseLeave={function(e) { if (!isSel) e.currentTarget.style.borderColor = isSel ? oc + "50" : C.border; }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: isSel ? oc : oc + "20", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 11, fontWeight: 800, color: isSel ? C.bg : oc }}>{oi + 1}</div>
            <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: isSel ? oc : C.tx }}>{opt.label || "Option " + (oi + 1)}</div>
          </div>
          <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{igPreview}...</div>
        </div>;
      })}
    </div>}

    {/* Reprompt button + input */}
    {!captionLoading && captionOptions.length > 0 && <div style={{ marginBottom: 16 }}>
      {!showReprompt && <button onClick={function() { setShowReprompt(true); }} style={{ padding: "8px 14px", background: C.card, border: "1px solid " + C.border, borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, color: C.txm, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.blue + "40"; e.currentTarget.style.color = C.blue; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.txm; }}>Reprompt</button>}
      {showReprompt && <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <textarea value={repromptText} onChange={function(e) { setRepromptText(e.target.value); }} placeholder="Add extra context for regeneration (tone, angle, key points to emphasize...)" rows={2} style={{ flex: 1, padding: "10px 14px", background: C.card, border: "1px solid " + C.blue + "30", borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 12, lineHeight: 1.5, resize: "none", outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.blue; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.blue + "30"; }} />
        <button onClick={handleReprompt} style={{ padding: "10px 18px", background: C.blue, color: "#fff", border: "none", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Generate</button>
        <button onClick={function() { setShowReprompt(false); setRepromptText(""); }} style={{ padding: "10px 12px", background: "transparent", color: C.txd, border: "1px solid " + C.border, borderRadius: 6, fontFamily: ft, fontSize: 12, cursor: "pointer" }}>{"\u00D7"}</button>
      </div>}
    </div>}

    {/* Selected option — platform tabs + editable captions */}
    {!captionLoading && captionOptions.length > 0 && (function() {
      var opt = captionOptions[selectedCaptionIdx] || captionOptions[0];
      if (!opt) return null;

      return <div>
        {/* Platform tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 12, background: C.card, borderRadius: 10, border: "1px solid " + C.border, padding: 3 }}>
          {PLATFORMS.map(function(plat) {
            var on = platTab === plat.key;
            return <div key={plat.key} onClick={function() { setPlatTab(plat.key); }} style={{ flex: 1, padding: "9px 0", textAlign: "center", cursor: "pointer", borderRadius: 8, background: on ? plat.color + "15" : "transparent", border: on ? "1px solid " + plat.color + "30" : "1px solid transparent", transition: "all 0.15s" }}>
              <div style={{ fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? plat.color : C.txd }}>{plat.label}</div>
            </div>;
          })}
        </div>

        {/* Active platform caption */}
        {(function() {
          var plat = PLATFORMS.find(function(p) { return p.key === platTab; });
          if (!plat) return null;
          var data = (opt[plat.key] || {}) as Record<string, unknown>;
          var text = plat.key === "shorts" ? (String(data.title || "")) : (String(data.caption || ""));
          var charCount = text.length;
          var overLimit = charCount > plat.charLimit;

          return <div style={{ background: C.card, border: "1px solid " + plat.color + "20", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: plat.color, textTransform: "uppercase", letterSpacing: "1px" }}>{plat.label} {plat.key === "shorts" ? "Title" : "Caption"}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontFamily: mn, fontSize: 9, color: overLimit ? C.coral : C.txd }}>{charCount} / {plat.charLimit}</span>
                {text && <span onClick={function() { navigator.clipboard.writeText(text); }} style={{ fontFamily: mn, fontSize: 9, color: plat.color, cursor: "pointer", padding: "1px 6px", border: "1px solid " + plat.color + "30", borderRadius: 4 }}>Copy</span>}
              </div>
            </div>
            <textarea value={text} onChange={function(e) {
              var val = e.target.value;
              setCaptionOptions(function(prev: CaptionOption[]) {
                var updated = prev.slice();
                updated[selectedCaptionIdx] = Object.assign({}, updated[selectedCaptionIdx]);
                if (!updated[selectedCaptionIdx][plat!.key]) updated[selectedCaptionIdx][plat!.key] = {};
                var platData = updated[selectedCaptionIdx][plat!.key] as Record<string, unknown>;
                if (plat!.key === "shorts") platData.title = val;
                else platData.caption = val;
                return updated;
              });
              if (plat!.key === "instagram") setCaption({ caption: val });
            }} rows={plat!.key === "shorts" ? 2 : 5} style={{ width: "100%", padding: "10px 12px", background: C.bg, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }} onFocus={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = plat!.color; }} onBlur={function(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = C.border; }} />
            {plat!.key !== "shorts" && !!data.hashtags && (data.hashtags as string[]).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {(data.hashtags as string[]).map(function(tag: string, i: number) {
                return <span key={i} style={{ fontFamily: ft, fontSize: 11, color: plat!.color, padding: "3px 8px", background: plat!.color + "10", border: "1px solid " + plat!.color + "18", borderRadius: 16 }}>#{tag.replace(/^#/, "")}</span>;
              })}
            </div>}
          </div>;
        })()}
      </div>;
    })()}

    {sourceUrl && <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 8 }}>Source: {sourceUrl}</div>}
  </div>;
}


// ═══ CANVAS RENDERER (for export) ═══
// Ensure Grift (all weights used) is loaded before drawing to canvas.
// Without this, canvas can fall back to Outfit/sans-serif on first export.
async function ensureFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    // Pre-request each weight the canvas actually uses.
    await Promise.all([
      document.fonts.load("400 16px Grift"),
      document.fonts.load("700 16px Grift"),
      document.fonts.load("800 16px Grift"),
    ]);
    await document.fonts.ready;
  } catch {
    // Font API failed — fall through; canvas will use fallback.
  }
}

function renderSlideToCanvas(slide: Slide, bgUrl: string): Promise<Blob> {
  return new Promise<Blob>(function(resolve, reject) {
    var canvas = document.createElement("canvas");
    canvas.width = FULL_W;
    canvas.height = FULL_H;
    var ctx = canvas.getContext("2d")!;

    // Load background image + ensure fonts loaded in parallel
    var bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    var fontsReadyPromise = ensureFontsReady();
    bgImg.onload = function() {
      // Wait for fonts before any drawText runs
      fontsReadyPromise.then(function() {
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

      // Draw content — handles \n paragraph breaks
      function drawText(text: string, x: number, y: number, maxWidth: number, fontSize: number, fontWeight: string, color: string, lineHeight?: number) {
        ctx.font = fontWeight + " " + fontSize + "px Grift, Outfit, sans-serif";
        ctx.fillStyle = color;
        ctx.textBaseline = "top";

        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        var currentY = y;
        var lh = fontSize * (lineHeight || 1.4);
        var paragraphs = (text || "").split(/\n/);

        for (var p = 0; p < paragraphs.length; p++) {
          var para = paragraphs[p].trim();
          if (!para) { currentY += lh * 0.6; continue; } // blank line = paragraph gap
          var words = para.split(" ");
          var line = "";
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
          if (line.trim()) { ctx.fillText(line.trim(), x, currentY); currentY += lh; }
        }

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        return currentY;
      }

      function drawImage(imageUrl: string | undefined, x: number, y: number, w: number, h: number, radius: number) {
        return new Promise<void>(function(resolveImg) {
          if (!imageUrl) { resolveImg(); return; }

          function renderImg(img: HTMLImageElement) {
            ctx.save();
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
            var imgAspect = img.width / img.height;
            var frameAspect = w / h;
            var dw, dh, dx, dy;
            if (imgAspect > frameAspect) { dh = h; dw = dh * imgAspect; dx = x + (w - dw) / 2; dy = y; }
            else { dw = w; dh = dw / imgAspect; dx = x; dy = y + (h - dh) / 2; }
            ctx.drawImage(img, dx, dy, dw, dh);
            ctx.restore();
            resolveImg();
          }

          // Try direct load first, fall back to proxy for CORS-blocked images
          var img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = function() { renderImg(img); };
          img.onerror = function() {
            // External image likely blocked by CORS — proxy it
            var proxyUrl = "/api/image-proxy?url=" + encodeURIComponent(imageUrl);
            var img2 = new Image();
            img2.crossOrigin = "anonymous";
            img2.onload = function() { renderImg(img2); };
            img2.onerror = function() { resolveImg(); }; // give up silently
            img2.src = proxyUrl;
          };
          img.src = imageUrl;
        });
      }

      var COVER_MX = 60;
      var TOP_Y = Math.round(FULL_H * 0.10); // 10% — matches editor exactly
      var BOTTOM_Y = Math.round(FULL_H * 0.08);
      var contentWidth = FULL_W - MARGIN_X * 2;
      var coverContentWidth = FULL_W - COVER_MX * 2;
      var availH = FULL_H - TOP_Y - BOTTOM_Y;

      async function drawContent() {
        // Date + title stamp at very top left (small, subtle)
        var dateStr = new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) + "." + String(new Date().getFullYear()).slice(2);
        var stampTitle = (slide._carouselTitle || "").slice(0, 20);
        var stamp = stampTitle ? dateStr + " - " + stampTitle : dateStr;
        // Drawn small in top-left, below logo line
        // (skip — logo area is sacred, stamp goes nowhere visible on the slide itself)

        if (slide.type === "cover") {
          var imgHPct = (slide.imageHeight || 46) / 100;
          var imgH = Math.round(availH * imgHPct);
          await drawImage(slide.imageUrl, COVER_MX, TOP_Y, coverContentWidth, imgH, 20);
          var titleY = TOP_Y + imgH + 20;
          var afterTitle = drawText(slide.title || "", COVER_MX, titleY, coverContentWidth, slide.titleSize, "800", "#ffffff", 1.15);
          drawText(slide.subtitle || "", COVER_MX, afterTitle + 8, coverContentWidth, slide.subtitleSize, "400", "rgba(255,255,255,0.78)", 1.4);

        } else if (slide.type === "body") {
          if (slide.imageUrl && !slide.inverted) {
            // Image on top, text below
            var bImgH = Math.round(availH * ((slide.imageHeight || 45) / 100));
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, bImgH, 20);
            drawText(slide.bodyText || "", MARGIN_X, TOP_Y + bImgH + 16, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.55);
          } else if (slide.imageUrl && slide.inverted) {
            // Text on top, image below
            var bImgH2 = Math.round(availH * ((slide.imageHeight || 45) / 100));
            var textEndY = drawText(slide.bodyText || "", MARGIN_X, TOP_Y, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.55);
            await drawImage(slide.imageUrl, MARGIN_X, textEndY + 16, contentWidth, bImgH2, 20);
          } else {
            // Text only — vertically center
            // Measure text height accounting for paragraph breaks
            ctx.font = "400 " + slide.bodySize + "px Grift, Outfit, sans-serif";
            var lh = slide.bodySize * 1.55;
            var totalLines = 0;
            var paragraphs = (slide.bodyText || "").split(/\n/);
            for (var pi = 0; pi < paragraphs.length; pi++) {
              var para = paragraphs[pi].trim();
              if (!para) { totalLines += 0.6; continue; } // paragraph gap
              var words = para.split(" ");
              var line = "";
              for (var wi = 0; wi < words.length; wi++) {
                var test = line + words[wi] + " ";
                if (ctx.measureText(test).width > contentWidth && wi > 0) { totalLines++; line = words[wi] + " "; }
                else { line = test; }
              }
              if (line.trim()) totalLines++;
            }
            var totalTextH = totalLines * lh;
            var bodyY = TOP_Y + Math.max(0, (availH - totalTextH) / 2);
            drawText(slide.bodyText || "", MARGIN_X, bodyY, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.55);
          }

        } else if (slide.type === "image_text") {
          var itImgH = Math.round(availH * ((slide.imageHeight || 50) / 100));
          if (!slide.inverted) {
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, itImgH, 20);
            drawText(slide.bodyText || "", MARGIN_X, TOP_Y + itImgH + 16, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.5);
          } else {
            var itTextEnd = drawText(slide.bodyText || "", MARGIN_X, TOP_Y, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.5);
            await drawImage(slide.imageUrl, MARGIN_X, itTextEnd + 16, contentWidth, itImgH, 20);
          }

        } else if (slide.type === "large_image") {
          var liImgH = Math.round(availH * ((slide.imageHeight || 72) / 100));
          if (!slide.inverted) {
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, liImgH, 20);
            drawText(slide.caption || "", MARGIN_X, TOP_Y + liImgH + 12, contentWidth, slide.captionSize || 18, "400", "rgba(255,255,255,0.65)", 1.4);
          } else {
            var liCapEnd = drawText(slide.caption || "", MARGIN_X, TOP_Y, contentWidth, slide.captionSize || 18, "400", "rgba(255,255,255,0.65)", 1.4);
            await drawImage(slide.imageUrl, MARGIN_X, liCapEnd + 12, contentWidth, liImgH, 20);
          }

        } else if (slide.type === "dual_image") {
          var halfH = Math.round((availH - 16) / 2);
          await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, halfH - 20, 16);
          drawText(slide.caption || "", MARGIN_X, TOP_Y + halfH - 16, contentWidth, slide.captionSize || 16, "400", "rgba(255,255,255,0.65)", 1.3);
          await drawImage(slide.imageUrl2, MARGIN_X, TOP_Y + halfH + 8, contentWidth, halfH - 20, 16);
          drawText(slide.caption2 || "", MARGIN_X, TOP_Y + halfH * 2 - 8, contentWidth, slide.captionSize || 16, "400", "rgba(255,255,255,0.65)", 1.3);
        }

        // CTA text on closer (position 4)
        if (slide.position === 4 && slide.ctaText) {
          var ctaFontSize = 30;
          ctx.font = "700 " + ctaFontSize + "px Grift, Outfit, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.textBaseline = "top";
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;
          var ctaY = FULL_H - ctaFontSize - 16;
          if (slide.ctaPosition === "bottom-center") {
            ctx.textAlign = "center";
            ctx.fillText(slide.ctaText, FULL_W / 2, ctaY);
          } else {
            ctx.textAlign = "right";
            ctx.fillText(slide.ctaText, FULL_W - MARGIN_X, ctaY);
          }
          ctx.textAlign = "left";
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        canvas.toBlob(function(blob) {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        }, "image/png");
      }

      drawContent().catch(reject);
      });
    };
    bgImg.onerror = function() { reject(new Error("Failed to load background: " + bgUrl)); };
    bgImg.src = bgUrl;
  });
}


// ═══ STEP 5: EXPORT ═══
function ExportStep({ slides, theme, caption, captionOptions, selectedCaptionIdx, onBack, sourceUrl, articleTitle }: { slides: Slide[]; theme: ThemeKey; caption: unknown; captionOptions: CaptionOption[]; selectedCaptionIdx: number; onBack: () => void; sourceUrl: string; articleTitle: string }) {
  var _downloading = useState<number | null>(null), downloading = _downloading[0], setDownloading = _downloading[1];
  var _downloadAll = useState(false), downloadingAll = _downloadAll[0], setDownloadingAll = _downloadAll[1];
  var _copied = useState<Record<string, boolean>>({}), copied = _copied[0], setCopied = _copied[1];
  var _platTab = useState("instagram"), platTab = _platTab[0], setPlatTab = _platTab[1];
  var _archiveSaving = useState(false), archiveSaving = _archiveSaving[0], setArchiveSaving = _archiveSaving[1];
  var _archiveSaved = useState(false), archiveSaved = _archiveSaved[0], setArchiveSaved = _archiveSaved[1];
  var userCtx = useUser();

  var PLATFORMS = [
    { key: "instagram", label: "Instagram", color: "#E4405F" },
    { key: "tiktok", label: "TikTok", color: "#00F2EA" },
    { key: "shorts", label: "YT Shorts", color: "#FF0000" },
  ];

  var selectedCaption = (captionOptions && captionOptions.length > 0) ? (captionOptions[selectedCaptionIdx] || captionOptions[0]) : null;

  var coverTitle = (slides.find(function(s) { return s.type === "cover"; }) || {} as Partial<Slide>).title || "carousel";
  var dateStamp = (new Date().getMonth() + 1) + "." + new Date().getDate() + "." + String(new Date().getFullYear()).slice(2);
  var filePrefix = dateStamp + " - " + coverTitle.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 20).trim().replace(/\s+/g, "_");

  function downloadSlide(index: number) {
    var sl = slides[index];
    var bgUrl = getBackdropUrl(theme, sl.position);
    setDownloading(index);
    renderSlideToCanvas(sl, bgUrl).then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filePrefix + "_slide" + (index + 1) + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloading(null);
    }).catch(function(err) {
      showToast("Export failed: " + err.message);
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
        a.download = filePrefix + "_slide" + (currentIdx + 1) + ".png";
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

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    var c: Record<string, boolean> = {};
    c[key] = true;
    setCopied(c);
    setTimeout(function() { setCopied({}); }, 2000);
  }

  function downloadCaptionsDocx() {
    var selectedCap = (captionOptions && captionOptions.length > 0) ? (captionOptions[selectedCaptionIdx] || captionOptions[0]) : null;
    if (!selectedCap) return;
    var AMBER = "F7B041";
    var BLUE = "0B86D1";
    var BODY = "1A1A1A";
    var FONT = "Outfit";
    var children = [];

    // Title
    children.push(new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { color: AMBER, size: 6, space: 8, style: "single" } },
      children: [new TextRun({ text: coverTitle || "Carousel Captions", bold: true, size: 44, color: AMBER, font: { name: FONT } })],
    }));

    // Metadata
    if (sourceUrl) {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: "Source: ", bold: true, size: 22, color: "666666", font: { name: FONT } }),
        new TextRun({ text: sourceUrl, size: 22, color: BLUE, font: { name: FONT } }),
      ]}));
    }
    children.push(new Paragraph({ spacing: { after: 80 }, children: [
      new TextRun({ text: "Date: ", bold: true, size: 22, color: "666666", font: { name: FONT } }),
      new TextRun({ text: dateStamp, size: 22, color: BODY, font: { name: FONT } }),
    ]}));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [
      new TextRun({ text: "Theme: ", bold: true, size: 22, color: "666666", font: { name: FONT } }),
      new TextRun({ text: theme || "general", size: 22, color: BODY, font: { name: FONT } }),
    ]}));

    // Each platform
    var platNames: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", shorts: "YouTube Shorts" };
    ["instagram", "tiktok", "shorts"].forEach(function(key) {
      var data = (selectedCap![key] || {}) as Record<string, unknown>;
      var text = key === "shorts" ? String(data.title || "") : String(data.caption || "");
      if (!text) return;

      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 120 },
        children: [new TextRun({ text: platNames[key], bold: true, size: 32, color: BLUE, font: { name: FONT } })],
      }));

      var lines = text.split("\n");
      var runs: TextRun[] = [];
      lines.forEach(function(line: string, idx: number) {
        if (idx > 0) runs.push(new TextRun({ break: 1, text: "", font: { name: "Arial" } }));
        runs.push(new TextRun({ text: line, size: 22, color: BODY, font: { name: FONT } }));
      });
      children.push(new Paragraph({ spacing: { after: 120 }, children: runs }));

      if (key !== "shorts" && data.hashtags && (data.hashtags as string[]).length > 0) {
        children.push(new Paragraph({ spacing: { after: 160 }, children: [
          new TextRun({ text: (data.hashtags as string[]).map(function(t: string) { return "#" + t.replace(/^#/, ""); }).join("  "), size: 20, color: BLUE, font: { name: FONT } }),
        ]}));
      }
    });

    var doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 22, color: BODY } } } },
      sections: [{ properties: {}, children: children }],
    });
    Packer.toBlob(doc).then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filePrefix + "_captions.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
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

  function handleSaveArchive() {
    setArchiveSaving(true);
    var authorName = userCtx.user ? userCtx.user.name : "Unknown";
    var authorRole = userCtx.user ? userCtx.user.role : "";
    var archiveName = dateStamp + " - " + coverTitle;
    if (sourceUrl) {
      try { var hostname = new URL(sourceUrl).hostname.replace("www.", ""); archiveName += " (" + hostname + ")"; } catch(e) {}
    }
    var archiveData = {
      slides: slides,
      caption: caption,
      captionOptions: captionOptions,
      selectedCaptionIdx: selectedCaptionIdx,
      theme: theme,
      sourceUrl: sourceUrl || "",
      articleTitle: articleTitle || coverTitle,
      timestamp: new Date().toISOString(),
      slideCount: slides.length,
      createdBy: authorName,
      createdByRole: authorRole,
    };
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "projects",
        data: {
          id: "carousel-" + Date.now(),
          type: "carousel-archive",
          name: archiveName,
          data: archiveData,
        },
      }),
    }).then(function(r) { return r.json(); }).then(function() {
      setArchiveSaving(false);
      setArchiveSaved(true);
      setTimeout(function() { setArchiveSaved(false); }, 3000);
    }).catch(function() {
      setArchiveSaving(false);
      showToast("Failed to save archive.");
    });
  }

  return <div>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <div>
        <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 800, color: C.tx }}>Carousel Ready</div>
      </div>
      <button onClick={onBack} style={{ padding: "8px 16px", background: "transparent", color: C.txm, border: "1px solid " + C.border, borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back to Review</button>
    </div>
    <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 24 }}>{slides.length} slides ready to export at 1080x1350. Download and archive.</div>

    {/* Slide preview strip (compact horizontal scroll) */}
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12, marginBottom: 28 }}>
      {slides.map(function(sl, i) {
        var bgUrl = getBackdropUrl(theme, sl.position);
        var rw = 140;
        var rh = 175;
        var isDownloading = downloading === i;

        return <div key={sl.id} style={{ flexShrink: 0 }}>
          <div style={{ width: rw, height: rh, borderRadius: 6, overflow: "hidden", position: "relative", backgroundImage: "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", cursor: "pointer" }} onClick={function() { downloadSlide(i); }}>
            <div style={{ position: "absolute", inset: 0, padding: 8 }}>
              {sl.type === "cover" && <div>
                {sl.imageUrl && <div style={{ width: "100%", height: "40%", borderRadius: 4, overflow: "hidden", marginBottom: 3, background: "rgba(255,255,255,0.05)" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: 7, fontWeight: 800, color: "#fff", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{sl.title || ""}</div>
              </div>}
              {sl.type === "body" && <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" }}>{sl.bodyText || ""}</div>
              </div>}
              {sl.type === "image_text" && <div>
                {sl.imageUrl && <div style={{ width: "100%", height: "50%", borderRadius: 3, overflow: "hidden", marginBottom: 2, background: "rgba(255,255,255,0.05)" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.7)", lineHeight: 1.2, overflow: "hidden" }}>{(sl.bodyText || "").slice(0, 40)}</div>
              </div>}
              {sl.type === "large_image" && <div>
                {sl.imageUrl && <div style={{ width: "100%", height: "70%", borderRadius: 3, overflow: "hidden", marginBottom: 2, background: "rgba(255,255,255,0.05)" }}>
                  <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }} />
                </div>}
                <div style={{ fontFamily: gf, fontSize: 5, color: "rgba(255,255,255,0.5)", lineHeight: 1.2 }}>{(sl.caption || "").slice(0, 30)}</div>
              </div>}
            </div>
            {/* Download hover overlay */}
            <div style={{ position: "absolute", inset: 0, background: isDownloading ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseEnter={function(e) { if (!isDownloading) e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }} onMouseLeave={function(e) { if (!isDownloading) e.currentTarget.style.background = "rgba(0,0,0,0)"; }}>
              {isDownloading ? <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid " + C.border, borderTopColor: C.amber, animation: "cspin 1s linear infinite" }} /> : <div style={{ fontFamily: ft, fontSize: 10, color: "#fff", fontWeight: 700, opacity: 0, transition: "opacity 0.2s", padding: "4px 10px", background: "rgba(0,0,0,0.6)", borderRadius: 4 }} className="dl-label">PNG</div>}
            </div>
          </div>
          <div style={{ textAlign: "center", fontFamily: mn, fontSize: 8, color: C.txd, marginTop: 4 }}>{i + 1}</div>
        </div>;
      })}
    </div>

    {/* Selected caption — read-only display with Copy per platform */}
    {selectedCaption && <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px" }}>Caption</div>
        {selectedCaption.label && <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, padding: "2px 8px", background: C.card, border: "1px solid " + C.border, borderRadius: 4 }}>{selectedCaption.label}</div>}
      </div>

      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 12, background: C.card, borderRadius: 10, border: "1px solid " + C.border, padding: 3 }}>
        {PLATFORMS.map(function(plat) {
          var on = platTab === plat.key;
          return <div key={plat.key} onClick={function() { setPlatTab(plat.key); }} style={{ flex: 1, padding: "9px 0", textAlign: "center", cursor: "pointer", borderRadius: 8, background: on ? plat.color + "15" : "transparent", border: on ? "1px solid " + plat.color + "30" : "1px solid transparent", transition: "all 0.15s" }}>
            <div style={{ fontFamily: ft, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? plat.color : C.txd }}>{plat.label}</div>
          </div>;
        })}
      </div>

      {/* Active platform caption — read only */}
      {(function() {
        var plat = PLATFORMS.find(function(p) { return p.key === platTab; });
        if (!plat) return null;
        var data = ((selectedCaption as Record<string, unknown>)[plat.key] || {}) as Record<string, unknown>;
        var text = plat.key === "shorts" ? String(data.title || "") : String(data.caption || "");
        var isCopied = copied[plat.key];

        return <div style={{ background: C.card, border: "1px solid " + plat.color + "20", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: plat.color, textTransform: "uppercase", letterSpacing: "1px" }}>{plat.label} {plat.key === "shorts" ? "Title" : "Caption"}</div>
            {text && <button onClick={function() { copyText(text, plat!.key); }} style={{ padding: "4px 12px", background: isCopied ? plat.color + "20" : "transparent", border: "1px solid " + plat.color + "30", borderRadius: 6, fontFamily: mn, fontSize: 10, fontWeight: 600, color: plat.color, cursor: "pointer", transition: "all 0.15s" }}>{isCopied ? "Copied" : "Copy"}</button>}
          </div>
          <div style={{ fontFamily: ft, fontSize: 13, color: C.tx, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", padding: "10px 12px", background: C.bg, borderRadius: 8, border: "1px solid " + C.border, maxHeight: 200, overflowY: "auto" }}>{text || "No caption generated. Go back to Review to generate captions."}</div>
          {plat.key !== "shorts" && !!data.hashtags && (data.hashtags as string[]).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {(data.hashtags as string[]).map(function(tag: string, i: number) {
              return <span key={i} style={{ fontFamily: ft, fontSize: 11, color: plat!.color, padding: "3px 8px", background: plat!.color + "10", border: "1px solid " + plat!.color + "18", borderRadius: 16 }}>#{tag.replace(/^#/, "")}</span>;
            })}
          </div>}
        </div>;
      })()}
    </div>}

    {!selectedCaption && <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "24px", textAlign: "center", marginBottom: 28 }}>
      <div style={{ fontFamily: ft, fontSize: 13, color: C.txd }}>No captions generated yet. Go back to Review to generate captions.</div>
    </div>}

    {/* Export actions */}
    <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>Export Actions</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
      <button onClick={downloadAll} disabled={downloadingAll} style={{ padding: "16px", background: C.amber + "10", border: "1px solid " + C.amber + "30", borderRadius: 10, cursor: downloadingAll ? "wait" : "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.amber + "60"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.amber + "30"; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.amber, marginBottom: 4 }}>{downloadingAll ? "Downloading..." : "Download All PNGs"}</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>{slides.length} slides at 1080x1350</div>
      </button>
      <button onClick={downloadCaptionsDocx} disabled={!selectedCaption} style={{ padding: "16px", background: selectedCaption ? C.cyan + "10" : C.surface, border: "1px solid " + (selectedCaption ? C.cyan + "30" : C.border), borderRadius: 10, cursor: selectedCaption ? "pointer" : "default", textAlign: "left", transition: "all 0.2s", opacity: selectedCaption ? 1 : 0.5 }} onMouseEnter={function(e) { if (selectedCaption) e.currentTarget.style.borderColor = C.cyan + "60"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = selectedCaption ? C.cyan + "30" : C.border; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.cyan, marginBottom: 4 }}>Download Captions</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>.docx with all platforms</div>
      </button>
      <button onClick={function() { window.open("https://publish.buffer.com", "_blank"); }} style={{ padding: "16px", background: C.card, border: "1px solid " + C.border, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; }}>
        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Send to Buffer</div>
        <div style={{ fontFamily: ft, fontSize: 11, color: C.txm }}>Open Buffer to schedule post</div>
      </button>
    </div>

    {/* Save to Archive */}
    <button onClick={handleSaveArchive} disabled={archiveSaving || archiveSaved} style={{ width: "100%", padding: "16px 0", background: archiveSaved ? C.teal + "15" : C.violet + "10", border: "1px solid " + (archiveSaved ? C.teal + "40" : C.violet + "30"), borderRadius: 10, cursor: archiveSaving ? "wait" : archiveSaved ? "default" : "pointer", transition: "all 0.2s", marginBottom: 8 }} onMouseEnter={function(e) { if (!archiveSaving && !archiveSaved) e.currentTarget.style.borderColor = C.violet + "60"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = archiveSaved ? C.teal + "40" : C.violet + "30"; }}>
      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 700, color: archiveSaved ? C.teal : C.violet }}>{archiveSaving ? "Saving..." : archiveSaved ? "Saved to Archive" : "Save to Archive"}</div>
      <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, marginTop: 2 }}>Store carousel data for future reference</div>
    </button>

    <style dangerouslySetInnerHTML={{ __html: "@keyframes cspin{to{transform:rotate(360deg)}} .dl-label { opacity: 0; } div:hover > .dl-label { opacity: 1 !important; }" }} />
  </div>;
}


// ═══ CONVERT API RESPONSE TO EDITOR SLIDES ═══
function apiSlidesToEditorSlides(apiSlides: GeneratedSlide[], slideCount: number): Slide[] {
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
  var _state = useState<CarouselState>({ category: "general", mode: "auto", pageCount: 4, text: "", url: "" }), state = _state[0], setState = _state[1];
  var _slides = useState<Slide[]>([]), slides = _slides[0], setSlides = _slides[1];
  var _variants = useState<Record<string, Variant> | null>(null), variants = _variants[0], setVariants = _variants[1];
  var _caption = useState<unknown>(null), caption = _caption[0], setCaption = _caption[1];
  var _captionOptions = useState<CaptionOption[]>([]), captionOptions = _captionOptions[0], setCaptionOptions = _captionOptions[1];
  var _selectedCaptionIdx = useState(0), selectedCaptionIdx = _selectedCaptionIdx[0], setSelectedCaptionIdx = _selectedCaptionIdx[1];
  var _selectedVariantLabel = useState(""), selectedVariantLabel = _selectedVariantLabel[0], setSelectedVariantLabel = _selectedVariantLabel[1];
  var _loading = useState(false), loading = _loading[0], setLoading = _loading[1];
  var _showArchive = useState(false), showArchive = _showArchive[0], setShowArchive = _showArchive[1];
  var _archiveItems = useState<Array<{ id: string; name?: string; data?: Record<string, unknown> }>>([]); var archiveItems = _archiveItems[0], setArchiveItems = _archiveItems[1];
  var _archiveLoading = useState(false), archiveLoading = _archiveLoading[0], setArchiveLoading = _archiveLoading[1];
  var _archiveFilter = useState<"all" | "mine">("all"), archiveFilter = _archiveFilter[0], setArchiveFilter = _archiveFilter[1];
  var userCtx = useUser();

  function goStep(n: number) { setStep(n); if (n > maxStep) setMaxStep(n); }

  function deleteArchive(item: { id: string }, e: React.MouseEvent) {
    e.stopPropagation();
    confirmDialog({ title: "Delete carousel?", body: "This removes the archived carousel permanently.", cta: "Delete", variant: "danger" }).then(function(ok) {
      if (!ok) return;
      fetch("/api/db", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "projects", id: item.id }),
      }).then(function(r) { return r.json(); }).then(function() {
        loadArchive();
      }).catch(function() { showToast("Failed to delete."); });
    });
  }

  function renameArchive(item: { id: string; name?: string; data?: Record<string, unknown> }, e: React.MouseEvent) {
    e.stopPropagation();
    var current = item.name || "";
    promptDialog({ title: "Rename carousel", placeholder: "New name", initial: current, cta: "Rename" }).then(function(next) {
      if (next === null) return;
      var trimmed = next.trim();
      if (!trimmed || trimmed === current) return;
      fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "projects",
          id: item.id,
          type: "carousel-archive",
          name: trimmed,
          data: item.data || {},
        }),
      }).then(function(r) { return r.json(); }).then(function() {
        loadArchive();
      }).catch(function() { showToast("Failed to rename."); });
    });
  }

  function loadArchive() {
    setArchiveLoading(true);
    fetch("/api/db?table=projects&type=carousel-archive").then(function(r) { return r.json(); }).then(function(res) {
      var items = (res.data || []);
      items.sort(function(a: { data?: Record<string, unknown> }, b: { data?: Record<string, unknown> }) {
        var ta = a.data && a.data.timestamp ? new Date(a.data.timestamp as string).getTime() : 0;
        var tb = b.data && b.data.timestamp ? new Date(b.data.timestamp as string).getTime() : 0;
        return tb - ta;
      });
      setArchiveItems(items);
      setArchiveLoading(false);
    }).catch(function() { setArchiveLoading(false); });
  }

  function loadFromArchive(item: { id: string; data?: Record<string, unknown> }) {
    if (!item.data) return;
    var d = item.data;
    if (d.slides) setSlides(d.slides as Slide[]);
    if (d.caption) setCaption(d.caption);
    if (d.theme) setState(function(s) { return Object.assign({}, s, { category: d.theme as ThemeKey, url: String(d.sourceUrl || "") }); });
    setShowArchive(false);
    goStep(3);
    setMaxStep(5);
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
          pageCount: state.pageCount || 4,
          imageUrls: (state.articleImages || []).filter(function(u) { return u && !u.startsWith("data:"); }),
        }),
      });
      var d = await r.json();
      if (d.error) {
        showToast("Generation failed: " + d.error);
        goStep(0);
      } else if (d.variants) {
        setVariants(d.variants);
        var keys = Object.keys(d.variants).filter(function(k) { return d.variants[k] && d.variants[k].slides; });
        if (keys.length > 0) {
          goStep(2);
        } else {
          showToast("No valid variants returned.");
          goStep(0);
        }
      }
    } catch (e) {
      showToast("Network error: " + (e instanceof Error ? e.message : String(e)));
      goStep(0);
    }
    setLoading(false);
  }

  var _showVariantPicker = useState(false), showVariantPicker = _showVariantPicker[0], setShowVariantPicker = _showVariantPicker[1];

  function pickVariant(key: string) {
    var picked = variants![key];
    if (!picked || !picked.slides) return;
    var editorSlides = apiSlidesToEditorSlides(picked.slides, picked.slides.length);
    setSlides(editorSlides);
    setSelectedVariantLabel(picked.label || "Variant " + key);
    setCaptionOptions([]);
    setSelectedCaptionIdx(0);
    setShowVariantPicker(false);
  }

  return <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <div>
        <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Carousel</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 2 }}>SA Branded // 1080x1350 // Real Backgrounds</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {step === 0 && <button onClick={function() { setShowArchive(!showArchive); if (!showArchive) loadArchive(); }} style={{ padding: "6px 14px", background: showArchive ? C.violet + "15" : C.surface, border: "1px solid " + (showArchive ? C.violet + "40" : C.border), borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 600, color: showArchive ? C.violet : C.txm, cursor: "pointer", transition: "all 0.2s" }}>Archive</button>}
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: THEMES[state.category].color, boxShadow: "0 0 8px " + THEMES[state.category].color + "60" }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: C.txm }}>{state.category} // {THEMES[state.category].prefix}</span>
        {variants && step >= 3 && <button onClick={function() { setShowVariantPicker(!showVariantPicker); }} style={{ padding: "4px 10px", background: C.surface, border: "1px solid " + C.border, borderRadius: 4, fontFamily: mn, fontSize: 9, color: C.txm, cursor: "pointer" }}>Variants</button>}
      </div>
    </div>

    {/* Archive panel */}
    {showArchive && step === 0 && (function() {
      var visibleItems = archiveFilter === "mine"
        ? archiveItems.filter(function(item) { return item.data && (item.data as Record<string, unknown>).createdBy === (userCtx.user && userCtx.user.name); })
        : archiveItems;
      return <div style={{ marginBottom: 24, background: C.card, border: "1px solid " + C.violet + "25", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: C.violet, textTransform: "uppercase", letterSpacing: "1.5px" }}>Saved Carousels</div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "mine"] as Array<"all" | "mine">).map(function(opt) {
            var active = archiveFilter === opt;
            return <button key={opt} onClick={function() { setArchiveFilter(opt); }} style={{ padding: "4px 12px", background: active ? C.violet + "20" : "transparent", border: "1px solid " + (active ? C.violet + "55" : C.border), borderRadius: 999, fontFamily: mn, fontSize: 9, fontWeight: 700, color: active ? C.violet : C.txm, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5, transition: "all 0.15s" }}>{opt === "all" ? "All" : "Mine"}</button>;
          })}
        </div>
      </div>
      {archiveLoading && <div style={{ textAlign: "center", padding: 20, fontFamily: ft, fontSize: 12, color: C.txm }}>Loading archive...</div>}
      {!archiveLoading && archiveItems.length === 0 && <div style={{ textAlign: "center", padding: 20, fontFamily: ft, fontSize: 12, color: C.txd }}>No archived carousels yet. Save one from the Export step.</div>}
      {!archiveLoading && archiveItems.length > 0 && visibleItems.length === 0 && archiveFilter === "mine" && <div style={{ textAlign: "center", padding: 20, fontFamily: ft, fontSize: 12, color: C.txd }}>You haven&apos;t saved any carousels yet. Create one and click Save to Archive.</div>}
      {!archiveLoading && visibleItems.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleItems.map(function(item) {
          var d = item.data || {} as Record<string, unknown>;
          var dateStr = d.timestamp ? new Date(d.timestamp as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown date";
          var timeStr = d.timestamp ? new Date(d.timestamp as string).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
          var author = d.createdBy ? String(d.createdBy) : "Unknown";
          var isAnalystSave = d.createdByRole === "Analyst";
          var authorColor = isAnalystSave ? C.violet : C.amber;
          return <div key={item.id} onClick={function() { loadFromArchive(item); }} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.violet + "50"; e.currentTarget.style.background = C.violet + "06"; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: C.violet + "12", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 14, fontWeight: 700, color: C.violet, flexShrink: 0 }}>{String(d.slideCount || "?")}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || "Untitled"}</div>
                <div style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: authorColor + "15", color: authorColor, border: "1px solid " + authorColor + "30", flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{author}{isAnalystSave ? " · ANALYST" : ""}</div>
              </div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>{dateStr} {timeStr} // {String(d.theme || "general")} // {String(d.slideCount || 0)} slides</div>
            </div>
            {!!d.sourceUrl && <div style={{ fontFamily: mn, fontSize: 8, color: C.txd, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{String(d.sourceUrl)}</div>}
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button title="Rename" onClick={function(e) { renameArchive(item, e); }} style={{ padding: "4px 8px", background: "transparent", border: "1px solid " + C.border, borderRadius: 6, fontFamily: mn, fontSize: 9, fontWeight: 700, color: C.txm, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }} onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.violet + "55"; e.currentTarget.style.color = C.violet; }} onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.txm; }}>Rename</button>
              <button title="Delete" onClick={function(e) { deleteArchive(item, e); }} style={{ padding: "4px 8px", background: "transparent", border: "1px solid " + C.coral + "40", borderRadius: 6, fontFamily: mn, fontSize: 11, fontWeight: 700, color: C.coral + "BB", cursor: "pointer", lineHeight: 1 }} onMouseEnter={function(e) { e.currentTarget.style.background = C.coral + "10"; e.currentTarget.style.color = C.coral; }} onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.coral + "BB"; }}>{"\u2715"}</button>
            </div>
          </div>;
        })}
      </div>}
    </div>;
    })()}

    <StepBar step={step} setStep={function(n) { if (n <= maxStep) goStep(n); }} maxStep={maxStep} />

    {/* Variant picker dropdown */}
    {showVariantPicker && variants && <div style={{ marginBottom: 20, background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: 16 }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 10 }}>Switch Variant</div>
      <div style={{ display: "flex", gap: 10 }}>
        {Object.keys(variants!).filter(function(k) { return variants![k] && variants![k].slides; }).map(function(k) {
          var v = variants![k];
          var varColors: Record<string, string> = { A: C.amber, B: C.blue, C: C.teal };
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
        var picked = variants![key];
        if (!picked || !picked.slides) return;
        var editorSlides = apiSlidesToEditorSlides(picked.slides, picked.slides.length);
        setSlides(editorSlides);
        setSelectedVariantLabel(picked.label || "Variant " + key);
        setCaptionOptions([]);
        setSelectedCaptionIdx(0);
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
      setSlides={setSlides}
      theme={state.category}
      onNext={function() { goStep(5); }}
      onBack={function() { goStep(3); }}
      sourceUrl={state.url || ""}
      variantLabel={selectedVariantLabel}
      captionOptions={captionOptions}
      setCaptionOptions={setCaptionOptions}
      selectedCaptionIdx={selectedCaptionIdx}
      setSelectedCaptionIdx={setSelectedCaptionIdx}
      setCaption={setCaption}
    />}
    {step === 5 && <ExportStep
      slides={slides}
      theme={state.category}
      caption={caption}
      captionOptions={captionOptions}
      selectedCaptionIdx={selectedCaptionIdx}
      onBack={function() { goStep(4); }}
      sourceUrl={state.url || ""}
      articleTitle={(slides.find(function(s) { return s.type === "cover"; }) || {}).title || ""}
    />}
  </div>;
}
