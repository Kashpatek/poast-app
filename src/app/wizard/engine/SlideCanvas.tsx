"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Wizard engine · WYSIWYG slide editor canvas
//
// VERBATIM extraction of ImageFrame (carousel.tsx:249-321) and SlideCanvas
// (carousel.tsx:322-568) — all 8 slide type branches (cover, cover_image,
// body, image_text, large_image, large_with_title, dual_image, body_dual),
// exact contentEditable/blur-commit behavior and inline styles. Only the
// imports/exports differ from the monolith's file-local components.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from "react";
import { D as C, mn, gf } from "../../shared-constants";
import { renderCoverSvg } from "../../carousel-covers";
import { renderUniqueSvg } from "./unique/render";
import { composeLibrarySvg, ensureLibraryAssets, libraryBgSvgDoc, ensureClassicBgs } from "./library/compose";
import { FULL_H, DISPLAY_W, DISPLAY_H, SCALE, MARGIN_X, MARGIN_Y, getBackdropUrl, type Slide, type ThemeKey } from "./types";

// ═══ UNIQUE SLIDE SVG (C3 additive branch) ═══
// Unique slides are fully self-rendered SVGs (backdrop + content) from
// engine/unique/render. Normalize the returned markup so it scales to the
// container whether render.ts returns a complete <svg> document or an inner
// fragment (cover-template style).
function uniqueSvgHtml(slide: Slide, page: number, total: number): string {
  var raw = renderUniqueSvg(slide, page, total);
  var open = raw.match(/^\s*<svg[^>]*>/i);
  if (open) {
    var tag = open[0].replace(/\s(?:width|height|style)="[^"]*"/gi, "").replace(/<svg/i, '<svg style="width:100%;height:100%;display:block"');
    return tag + raw.slice(open[0].length);
  }
  return '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">' + raw + '</svg>';
}

// ═══ LIBRARY SLIDE SVG (design-system handoff branch) ═══
// Library slides are ONE composed SVG document (backdrop + populated
// template) from engine/library/compose — the IDENTICAL string the PNG
// export rasterizes. Same normalization as uniqueSvgHtml so it scales to
// the container; compose always returns a complete <svg> document, the
// fragment fallback mirrors uniqueSvgHtml for safety.
function librarySvgHtml(composed: string): string {
  var open = composed.match(/^\s*<svg[^>]*>/i);
  if (open) {
    var tag = open[0].replace(/\s(?:width|height|style)="[^"]*"/gi, "").replace(/<svg/i, '<svg style="width:100%;height:100%;display:block"');
    return tag + composed.slice(open[0].length);
  }
  return '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">' + composed + '</svg>';
}

// ═══ IMAGE FRAME (clickable area for image insertion with position control) ═══
export function ImageFrame({ imageUrl, onImageChange, onPositionChange, imagePosition, imageFit, style: frameStyle, slideId, onRequestPicker }: { imageUrl?: string; onImageChange: (url: string) => void; onPositionChange?: (pos: string) => void; imagePosition?: string; imageFit?: string; style?: React.CSSProperties; slideId: string; onRequestPicker?: () => void }) {
  var fileRef = useRef<HTMLInputElement>(null);
  var _hover = useState(false), hover = _hover[0], setHover = _hover[1];
  var _dragOver = useState(false), dragOver = _dragOver[0], setDragOver = _dragOver[1];
  var pos = imagePosition || "center";
  var fit: "cover" | "contain" | "fill" = (imageFit as "cover" | "contain" | "fill") || "cover";
  void slideId;

  function handleEmptyClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).closest("button")) return;
    // Empty state: prefer picker if available, else file dialog
    if (onRequestPicker) onRequestPicker();
    else if (fileRef.current) fileRef.current.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { e.target.value = ""; return; }
    var reader = new FileReader();
    reader.onload = function(ev) { onImageChange(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) return;
    var reader = new FileReader();
    reader.onload = function(ev) { onImageChange(ev.target?.result as string); };
    reader.readAsDataURL(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  return <div onClick={imageUrl ? undefined : handleEmptyClick} onMouseEnter={function() { setHover(true); }} onMouseLeave={function() { setHover(false); }} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={Object.assign({}, { borderRadius: 20 * SCALE, overflow: "hidden", cursor: imageUrl ? "default" : "pointer", position: "relative", background: dragOver ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.04)", border: dragOver ? "1px dashed " + C.amber : "1px dashed rgba(255,255,255,0.12)" }, frameStyle)}>
    {imageUrl ? <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: pos, display: "block", background: "#000" }} onError={function(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.opacity = "0.3"; }} />
      {/* Position + fit controls (show on hover) */}
      {hover && onPositionChange && <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 3, background: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "4px 6px", backdropFilter: "blur(8px)" }} onClick={function(e) { e.stopPropagation(); }}>
        <button onClick={function() { onPositionChange("top"); }} title="Align top" style={{ padding: "3px 8px", borderRadius: 4, background: pos === "top" ? C.amber : "rgba(255,255,255,0.1)", border: "none", color: pos === "top" ? C.bg : "rgba(255,255,255,0.6)", fontSize: 9, cursor: "pointer", fontFamily: mn }}>Top</button>
        <button onClick={function() { onPositionChange("center"); }} title="Center" style={{ padding: "3px 8px", borderRadius: 4, background: pos === "center" ? C.amber : "rgba(255,255,255,0.1)", border: "none", color: pos === "center" ? C.bg : "rgba(255,255,255,0.6)", fontSize: 9, cursor: "pointer", fontFamily: mn }}>Center</button>
        <button onClick={function() { onPositionChange("bottom"); }} title="Align bottom" style={{ padding: "3px 8px", borderRadius: 4, background: pos === "bottom" ? C.amber : "rgba(255,255,255,0.1)", border: "none", color: pos === "bottom" ? C.bg : "rgba(255,255,255,0.6)", fontSize: 9, cursor: "pointer", fontFamily: mn }}>Bottom</button>
      </div>}
      {/* Replace button (top-left, show on hover) */}
      {hover && <div style={{ position: "absolute", top: 6, left: 6 }} onClick={function(e) { e.stopPropagation(); }}>
        <button onClick={function() { if (onRequestPicker) onRequestPicker(); else if (fileRef.current) fileRef.current.click(); }} title="Replace image" style={{ padding: "4px 9px", borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "1px solid " + C.amber + "60", color: C.amber, fontFamily: mn, fontSize: 8, fontWeight: 700, cursor: "pointer", letterSpacing: "0.5px", backdropFilter: "blur(4px)" }}>REPLACE</button>
      </div>}
      {/* Remove button (show on hover) */}
      {hover && <div style={{ position: "absolute", top: 6, right: 6 }} onClick={function(e) { e.stopPropagation(); }}>
        <button onClick={function() { onImageChange(""); }} style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>{"\u00D7"}</button>
      </div>}
    </div> : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <div style={{ fontSize: 24, color: dragOver ? C.amber : "rgba(255,255,255,0.15)" }}>+</div>
      <div style={{ fontFamily: mn, fontSize: 9, color: dragOver ? C.amber : "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{dragOver ? "Drop file here" : "Click to add image"}</div>
    </div>}
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} style={{ display: "none" }} />
  </div>;
}

// ═══ SLIDE CANVAS (the large visual editor canvas) ═══
export function SlideCanvas({ slide, theme, onUpdate, onRequestPicker, onSplitBody, page, total }: { slide: Slide; theme: ThemeKey; onUpdate: (s: Slide) => void; onRequestPicker?: (field: "imageUrl" | "imageUrl2") => void; onSplitBody?: (offset: number, fullText: string) => void; page?: number; total?: number }) {
  var isUnique = slide.type === "unique";
  var isLibrary = slide.type === "library";
  // Library compose is synchronous from module caches; null until
  // ensureLibraryAssets has warmed them (effect below kicks it once and
  // re-renders on resolve — never throws during the uncached window).
  // Fields/backdrop are edited through the EDIT inspector (LIBRARY group),
  // not contentEditable, so this branch is display-only like unique.
  var librarySvg = isLibrary ? composeLibrarySvg(slide) : null;
  var _libTick = useState(0), setLibTick = _libTick[1];
  var libEnsureRef = useRef(false); // in-flight guard: one ensure at a time
  useEffect(function() {
    if (!isLibrary || librarySvg || libEnsureRef.current) return;
    libEnsureRef.current = true;
    ensureLibraryAssets([slide])
      .then(function() { libEnsureRef.current = false; setLibTick(function(t) { return t + 1; }); })
      .catch(function() { libEnsureRef.current = false; }); // keep placeholder; a slide change retries
  }, [isLibrary, librarySvg, slide]);
  // v3.7: classic/verbatim slides wearing a library backdrop (the store
  // stamped slide.libraryBg — deck bgSource "library") paint the same
  // recolored bg layer the library compose path uses, in place of the theme
  // JPG. Unique slides pull it INSIDE their own SVG (render.ts); here they
  // only need the cache warm-up + a repaint when it lands.
  var classicBgDoc = !isUnique && !isLibrary && slide.libraryBg
    ? libraryBgSvgDoc(slide.libraryBg, slide.libraryPalette || "blend", !!slide.libraryBgFlip)
    : null;
  useEffect(function() {
    if (isLibrary || !slide.libraryBg) return;
    var live = true;
    ensureClassicBgs([slide])
      .then(function() { if (live) setLibTick(function(t) { return t + 1; }); })
      .catch(function() { /* keep the placeholder frame; a slide change retries */ });
    return function() { live = false; };
  }, [isLibrary, slide.libraryBg, slide.libraryPalette]); // eslint-disable-line react-hooks/exhaustive-deps
  var bgUrl = getBackdropUrl(theme, slide.position);
  var mx = MARGIN_X * SCALE; // ~32px
  var my = MARGIN_Y * SCALE; // ~40px
  void my;

  function updateField(field: string, value: string | number) {
    onUpdate(Object.assign({}, slide, { [field]: value }));
  }

  // Cmd/Ctrl+Enter in a body div: split the slide at the caret. Offset is
  // measured against the LIVE contentEditable text (blur has not committed).
  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onSplitBody || e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var pre = range.cloneRange();
    pre.selectNodeContents(e.currentTarget);
    pre.setEnd(range.startContainer, range.startOffset);
    onSplitBody(pre.toString().length, e.currentTarget.innerText);
  }

  // Shared text shadow for readability
  var textShadow = "0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)";

  return <div style={{ width: DISPLAY_W, height: DISPLAY_H, position: "relative", borderRadius: 8, overflow: "hidden", backgroundImage: isUnique || isLibrary || slide.libraryBg ? undefined : "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

    {/* ─── LIBRARY BACKDROP ON A CLASSIC/VERBATIM SLIDE (v3.7) ─── */}
    {!isUnique && !isLibrary && slide.libraryBg ? (
      classicBgDoc ? (
        <div
          style={{ position: "absolute", inset: 0 }}
          dangerouslySetInnerHTML={{ __html: classicBgDoc }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "#0A0B10" }} />
      )
    ) : null}

    {/* ─── UNIQUE SLIDE (self-rendered SVG, no backdrop image) ─── */}
    {isUnique ? (
      <div
        style={{ position: "absolute", inset: 0 }}
        dangerouslySetInnerHTML={{ __html: uniqueSvgHtml(slide, page ?? 1, total ?? 1) }}
      />
    ) : null}

    {/* ─── LIBRARY SLIDE (composed bg + template SVG, no backdrop image) ─── */}
    {isLibrary ? (
      librarySvg ? (
        <div
          style={{ position: "absolute", inset: 0 }}
          dangerouslySetInnerHTML={{ __html: librarySvgHtml(librarySvg) }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "#0A0B10" }} />
      )
    ) : null}

    {/* ─── COVER SLIDE ─── */}
    {slide.type === "cover" && slide.coverTemplate ? (
      <div
        style={{ position: "absolute", inset: 0 }}
        dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">' + renderCoverSvg(slide.coverTemplate, {
          title: slide.title || "",
          subtitle: slide.subtitle || "",
          accent: slide.coverAccent || "#F7B041",
          imageUrl: slide.imageUrl || "",
          dual: slide.coverDual || false,
          logoStyle: "auto",
          logoPosition: slide.coverLogoPos || "right",
          topic: slide.coverTopic || "",
          titleScale: slide.coverTitleScale || 1,
          showSub: slide.coverShowSub !== false,
          showLogo: true,
          showMeta: true,
          upper: slide.coverUpper,
          tight: slide.coverTight,
        }) + '</svg>' }}
      />
    ) : null}
    {slide.type === "cover" && !slide.coverTemplate && <div style={{ position: "absolute", left: 0, right: 0, top: (slide.titleAnchor === "center" ? FULL_H * 0.10 : (slide.titleMarginTop ?? 80)) * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + (60 * SCALE) + "px" }}>
      {/* Image frame: top area, safely below SA logo */}
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
        style={{ width: "100%", height: (slide.imageHeight || 46) + "%", marginBottom: 12, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />
      {/* Title */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("title", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.titleSize * SCALE, fontWeight: 800, color: "#ffffff", lineHeight: 1.15, textShadow: textShadow, outline: "none", cursor: "text", marginBottom: 6, wordBreak: "break-word", textAlign: "left" }}
      >{slide.title || "Title"}</div>
      {/* Subtitle */}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("subtitle", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.subtitleSize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.78)", lineHeight: 1.4, textShadow: textShadow, outline: "none", cursor: "text", wordBreak: "break-word", textAlign: "left" }}
      >{slide.subtitle || "Subtitle"}</div>
    </div>}

    {/* ─── BODY TEXT SLIDE (positions 2, 3, 4) ─── */}
    {slide.type === "body" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column", justifyContent: slide.inverted && slide.imageUrl ? "flex-end" : (slide.bodyAnchor === "top" ? "flex-start" : (slide.imageUrl ? "flex-start" : "center")) }}>
      {/* Optional image on body slides */}
      {slide.imageUrl && <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
        style={{ width: "100%", height: (slide.imageHeight || 45) + "%", marginBottom: slide.inverted ? 0 : 12, marginTop: slide.inverted ? 12 : 0, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />}
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("bodyText", e.currentTarget.innerText); }}
        onKeyDown={handleBodyKeyDown}
        style={{ fontFamily: gf, fontSize: slide.bodySize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.55, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden", textAlign: "left" }}
      >{slide.bodyText || "Body text"}</div>
      {/* CTA text on closer (position 4) */}
      {slide.position === 4 && slide.ctaText && <div style={{ position: "absolute", bottom: 60 * SCALE, left: slide.ctaPosition === "bottom-center" ? 0 : "auto", right: slide.ctaPosition === "bottom-center" ? 0 : (60 * SCALE), width: slide.ctaPosition === "bottom-center" ? "100%" : "auto", textAlign: slide.ctaPosition === "bottom-center" ? "center" : "right", fontFamily: gf, fontSize: 30 * SCALE, fontWeight: 700, color: "#ffffff", textShadow: "0 2px 10px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)", letterSpacing: "1px" }}>{slide.ctaText}</div>}
    </div>}

    {/* ─── IMAGE + TEXT SLIDE ─── */}
    {slide.type === "image_text" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column", justifyContent: slide.inverted ? "flex-end" : "flex-start" }}>
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
        style={{ width: "100%", height: (slide.imageHeight || 50) + "%", marginBottom: 12, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("bodyText", e.currentTarget.innerText); }}
        onKeyDown={handleBodyKeyDown}
        style={{ fontFamily: gf, fontSize: slide.bodySize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1, overflow: "hidden" }}
      >{slide.bodyText || "Body text"}</div>
    </div>}

    {/* ─── LARGE IMAGE SLIDE ─── */}
    {slide.type === "large_image" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column", justifyContent: slide.inverted ? "flex-end" : "flex-start" }}>
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
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
          onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
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
          onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl2"); } : undefined}
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

    {/* ── New: cover_image (full-bleed image, no text) ── */}
    {slide.type === "cover_image" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.10 * SCALE, padding: "0 " + (60 * SCALE) + "px" }}>
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
        style={{ width: "100%", height: "100%", borderRadius: 20 * SCALE }}
      />
    </div>}

    {/* ── New: large_with_title (large image + title + subtitle) ── */}
    {slide.type === "large_with_title" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column", justifyContent: slide.inverted ? "flex-end" : "flex-start" }}>
      <ImageFrame
        imageUrl={slide.imageUrl}
        onImageChange={function(url) { updateField("imageUrl", url); }}
        onPositionChange={function(pos) { updateField("imagePosition", pos); }}
        imagePosition={slide.imagePosition}
        imageFit={slide.imageFit}
        slideId={slide.id}
        onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
        style={{ width: "100%", height: (slide.imageHeight || 60) + "%", marginBottom: slide.inverted ? 0 : 12, marginTop: slide.inverted ? 12 : 0, borderRadius: 20 * SCALE, flexShrink: 0 }}
      />
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("title", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.titleSize * SCALE, fontWeight: 800, color: "#ffffff", lineHeight: 1.15, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 8, textAlign: "left" }}
      >{slide.title || "Title"}</div>
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("subtitle", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.subtitleSize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.78)", lineHeight: 1.4, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" }}
      >{slide.subtitle || "Subtitle"}</div>
    </div>}

    {/* ── New: body_dual (body text + two stacked images) ── */}
    {slide.type === "body_dual" && <div style={{ position: "absolute", left: 0, right: 0, top: FULL_H * 0.10 * SCALE, bottom: FULL_H * 0.08 * SCALE, padding: "0 " + mx + "px", display: "flex", flexDirection: slide.inverted ? "column-reverse" : "column", justifyContent: slide.inverted ? "flex-end" : "flex-start", gap: 10 }}>
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={function(e) { updateField("bodyText", e.currentTarget.innerText); }}
        style={{ fontFamily: gf, fontSize: slide.bodySize * SCALE, fontWeight: 400, color: "rgba(255,255,255,0.92)", lineHeight: 1.5, textShadow: textShadow, outline: "none", cursor: "text", whiteSpace: "pre-wrap", wordBreak: "break-word", flexShrink: 0, textAlign: "left" }}
      >{slide.bodyText || "Body text"}</div>
      <div style={{ display: "flex", flex: 1, gap: 8, minHeight: 0 }}>
        <ImageFrame
          imageUrl={slide.imageUrl}
          onImageChange={function(url) { updateField("imageUrl", url); }}
          onPositionChange={function(pos) { updateField("imagePosition", pos); }}
          imagePosition={slide.imagePosition}
          imageFit={slide.imageFit}
          slideId={slide.id + "-1"}
          onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl"); } : undefined}
          style={{ flex: 1, height: "100%", borderRadius: 16 * SCALE }}
        />
        <ImageFrame
          imageUrl={slide.imageUrl2}
          onImageChange={function(url) { updateField("imageUrl2", url); }}
          onPositionChange={function(pos) { updateField("imagePosition2", pos); }}
          imagePosition={slide.imagePosition2}
          imageFit={slide.imageFit}
          slideId={slide.id + "-2"}
          onRequestPicker={onRequestPicker ? function() { onRequestPicker("imageUrl2"); } : undefined}
          style={{ flex: 1, height: "100%", borderRadius: 16 * SCALE }}
        />
      </div>
    </div>}

    {/* Slide position badge */}
    <div style={{ position: "absolute", top: 8, left: 8, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>
      {slide.position === 1 ? "COVER" : slide.position === 4 ? "CLOSER" : "BODY " + (slide.position === 2 ? "A" : "B")} // pos {slide.position}
    </div>
  </div>;
}
