"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Wizard engine · static (non-editable) mini slide renderer
//
// NEW component, but its rendering branches are lifted VERBATIM from
// ReviewStep's side-by-side preview (carousel.tsx:1976-2077), which is the
// one V1 surface that already renders all 8 slide types read-only. The only
// generalization: the hardcoded 280px width becomes a `width` prop
// (default 140; scale = width / 1080; height = width * 1.25).
//
// This is the single thumbnail renderer for archive cards, variant previews,
// the film strip, and the publish grid — fixing V1's blank thumbnails for
// cover_image / dual_image / large_with_title / body_dual (SlideThumbnail
// only knew 4 types).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { gf } from "../../shared-constants";
import { renderCoverSvg } from "../../carousel-covers";
import { renderUniqueSvg } from "./unique/render";
import { composeLibrarySvg, ensureLibraryAssets, libraryBgSvgDoc, ensureClassicBgs } from "./library/compose";
import { FULL_W, FULL_H, getBackdropUrl, type Slide, type ThemeKey } from "./types";

function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) { e.currentTarget.style.display = "none"; }

// ═══ UNIQUE SLIDE SVG (C3 additive branch) ═══
// Unique slides are fully self-rendered SVGs (backdrop + content) from
// engine/unique/render. Normalize the returned markup so it scales to the
// thumbnail whether render.ts returns a complete <svg> document or an inner
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
// the thumbnail; compose always returns a complete <svg> document, the
// fragment fallback mirrors uniqueSvgHtml for safety.
function librarySvgHtml(composed: string): string {
  var open = composed.match(/^\s*<svg[^>]*>/i);
  if (open) {
    var tag = open[0].replace(/\s(?:width|height|style)="[^"]*"/gi, "").replace(/<svg/i, '<svg style="width:100%;height:100%;display:block"');
    return tag + composed.slice(open[0].length);
  }
  return '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">' + composed + '</svg>';
}

export function SlidePreview({ slide, theme, width, page, total }: { slide: Slide; theme: ThemeKey; width?: number; page?: number; total?: number }) {
  var sl = slide;
  var isUnique = sl.type === "unique";
  var isLibrary = sl.type === "library";
  // Library compose is synchronous from module caches; null until
  // ensureLibraryAssets has warmed them (effect below kicks it once and
  // re-renders on resolve — never throws during the uncached window).
  var librarySvg = isLibrary ? composeLibrarySvg(sl) : null;
  var _libTick = useState(0), setLibTick = _libTick[1];
  var libEnsureRef = useRef(false); // in-flight guard: one ensure at a time
  useEffect(function() {
    if (!isLibrary || librarySvg || libEnsureRef.current) return;
    libEnsureRef.current = true;
    ensureLibraryAssets([sl])
      .then(function() { libEnsureRef.current = false; setLibTick(function(t) { return t + 1; }); })
      .catch(function() { libEnsureRef.current = false; }); // keep placeholder; a slide change retries
  }, [isLibrary, librarySvg, sl]);
  // v3.7: classic/verbatim slides wearing a library backdrop (stamped
  // slide.libraryBg) paint the recolored bg layer instead of the theme JPG;
  // unique slides pull it inside their own SVG and only need the warm-up.
  var classicBgDoc = !isUnique && !isLibrary && sl.libraryBg
    ? libraryBgSvgDoc(sl.libraryBg, sl.libraryPalette || "blend", !!sl.libraryBgFlip)
    : null;
  useEffect(function() {
    if (isLibrary || !sl.libraryBg) return;
    var live = true;
    ensureClassicBgs([sl])
      .then(function() { if (live) setLibTick(function(t) { return t + 1; }); })
      .catch(function() { /* placeholder frame stays; a slide change retries */ });
    return function() { live = false; };
  }, [isLibrary, sl.libraryBg, sl.libraryPalette]); // eslint-disable-line react-hooks/exhaustive-deps
  var bgUrl = getBackdropUrl(theme, sl.position);
  var rw = width || 140;
  var rh = rw * 1.25;
  var rScale = rw / FULL_W;
  var coverTopPad = (sl.titleAnchor === "center" ? FULL_H * 0.10 : (sl.titleMarginTop ?? 80)) * rScale;
  var topPad = FULL_H * 0.10 * rScale;
  var botPad = FULL_H * 0.08 * rScale;
  var sidePad = 60 * rScale;
  var imgFit = (sl.imageFit || "cover") as "cover" | "contain" | "fill";
  var imgPos = sl.imagePosition || "center";

  return <div style={{ width: rw, height: rh, borderRadius: 6, overflow: "hidden", position: "relative", backgroundImage: isUnique || isLibrary || sl.libraryBg ? undefined : "url(" + bgUrl + ")", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
    {!isUnique && !isLibrary && sl.libraryBg ? (
      classicBgDoc ? (
        <div
          style={{ position: "absolute", inset: 0 }}
          dangerouslySetInnerHTML={{ __html: classicBgDoc }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "#0A0B10" }} />
      )
    ) : null}
    {isUnique ? (
      <div
        style={{ position: "absolute", inset: 0 }}
        dangerouslySetInnerHTML={{ __html: uniqueSvgHtml(sl, page ?? 1, total ?? 1) }}
      />
    ) : null}
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
    {sl.type === "cover" && sl.coverTemplate ? (
      <div
        style={{ position: "absolute", inset: 0 }}
        dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">' + renderCoverSvg(sl.coverTemplate, {
          title: sl.title || "",
          subtitle: sl.subtitle || "",
          accent: sl.coverAccent || "#F7B041",
          imageUrl: sl.imageUrl || "",
          dual: sl.coverDual || false,
          logoStyle: "auto",
          logoPosition: sl.coverLogoPos || "right",
          topic: sl.coverTopic || "",
          titleScale: sl.coverTitleScale || 1,
          showSub: sl.coverShowSub !== false,
          showLogo: true,
          showMeta: true,
          upper: sl.coverUpper,
          tight: sl.coverTight,
        }) + '</svg>' }}
      />
    ) : null}
    <div style={{ position: "absolute", left: 0, right: 0, top: sl.type === "cover" ? coverTopPad : topPad, bottom: botPad, padding: "0 " + sidePad + "px" }}>
      {sl.type === "cover" && !sl.coverTemplate && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 46) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: 6, flexShrink: 0, background: "#000" }}>
          <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: sl.titleSize * rScale, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 4, overflow: "hidden", textAlign: "left" }}>{sl.title || ""}</div>
        <div style={{ fontFamily: gf, fontSize: sl.subtitleSize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.35, overflow: "hidden", textAlign: "left" }}>{sl.subtitle || ""}</div>
      </div>}
      {sl.type === "body" && <div style={{ height: "100%", display: "flex", flexDirection: sl.inverted ? "column-reverse" : "column", justifyContent: sl.inverted && sl.imageUrl ? "flex-end" : (sl.bodyAnchor === "top" ? "flex-start" : (sl.imageUrl ? "flex-start" : "center")), position: "relative" }}>
        {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 45) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: sl.inverted ? 0 : 6, marginTop: sl.inverted ? 6 : 0, flexShrink: 0, background: "#000" }}>
          <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.9)", lineHeight: 1.5, overflow: "hidden", whiteSpace: "pre-wrap" }}>{sl.bodyText || ""}</div>
        {sl.position === 4 && sl.ctaText && <div style={{ position: "absolute", bottom: 60 * rScale, left: sl.ctaPosition === "bottom-center" ? 0 : "auto", right: sl.ctaPosition === "bottom-center" ? 0 : sidePad, width: sl.ctaPosition === "bottom-center" ? "100%" : "auto", textAlign: sl.ctaPosition === "bottom-center" ? "center" : "right", fontFamily: gf, fontSize: 30 * rScale, fontWeight: 700, color: "#ffffff", textShadow: "0 2px 8px rgba(0,0,0,0.5)", letterSpacing: "1px" }}>{sl.ctaText}</div>}
      </div>}
      {sl.type === "image_text" && <div style={{ height: "100%", display: "flex", flexDirection: sl.inverted ? "column-reverse" : "column", justifyContent: sl.inverted ? "flex-end" : "flex-start" }}>
        {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 50) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: sl.inverted ? 0 : 6, marginTop: sl.inverted ? 6 : 0, flexShrink: 0, background: "#000" }}>
          <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, overflow: "hidden" }}>{sl.bodyText || ""}</div>
      </div>}
      {sl.type === "large_image" && <div style={{ height: "100%", display: "flex", flexDirection: sl.inverted ? "column-reverse" : "column", justifyContent: sl.inverted ? "flex-end" : "flex-start" }}>
        {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 72) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: sl.inverted ? 0 : 6, marginTop: sl.inverted ? 6 : 0, flexShrink: 0, background: "#000" }}>
          <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 18) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>{sl.caption || ""}</div>
      </div>}
      {sl.type === "dual_image" && <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {sl.imageUrl && <div style={{ width: "100%", flex: 1, borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 2, background: "#000" }}>
            <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
          </div>}
          <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 16) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.2, flexShrink: 0 }}>{sl.caption || ""}</div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {sl.imageUrl2 && <div style={{ width: "100%", flex: 1, borderRadius: 6 * rScale, overflow: "hidden", marginBottom: 2, background: "#000" }}>
            <img src={sl.imageUrl2} style={{ width: "100%", height: "100%", objectFit: imgFit, display: "block" }} onError={hideOnError} />
          </div>}
          <div style={{ fontFamily: gf, fontSize: (sl.captionSize || 16) * rScale, color: "rgba(255,255,255,0.6)", lineHeight: 1.2, flexShrink: 0 }}>{sl.caption2 || ""}</div>
        </div>
      </div>}
      {sl.type === "cover_image" && <div style={{ height: "100%", display: "flex" }}>
        {sl.imageUrl && <div style={{ width: "100%", height: "100%", borderRadius: 8 * rScale, overflow: "hidden", background: "#000" }}>
          <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
        </div>}
      </div>}
      {sl.type === "large_with_title" && <div style={{ height: "100%", display: "flex", flexDirection: sl.inverted ? "column-reverse" : "column", justifyContent: sl.inverted ? "flex-end" : "flex-start" }}>
        {sl.imageUrl && <div style={{ width: "100%", height: (sl.imageHeight || 60) + "%", borderRadius: 8 * rScale, overflow: "hidden", marginBottom: sl.inverted ? 0 : 6, marginTop: sl.inverted ? 6 : 0, flexShrink: 0, background: "#000" }}>
          <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
        </div>}
        <div style={{ fontFamily: gf, fontSize: sl.titleSize * rScale, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 3, overflow: "hidden" }}>{sl.title || ""}</div>
        <div style={{ fontFamily: gf, fontSize: sl.subtitleSize * rScale, fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.35, overflow: "hidden" }}>{sl.subtitle || ""}</div>
      </div>}
      {sl.type === "body_dual" && <div style={{ height: "100%", display: "flex", flexDirection: sl.inverted ? "column-reverse" : "column", justifyContent: sl.inverted ? "flex-end" : "flex-start", gap: 4 }}>
        <div style={{ fontFamily: gf, fontSize: sl.bodySize * rScale, color: "rgba(255,255,255,0.9)", lineHeight: 1.4, overflow: "hidden", whiteSpace: "pre-wrap", flexShrink: 0 }}>{sl.bodyText || ""}</div>
        <div style={{ display: "flex", flex: 1, gap: 4, minHeight: 0 }}>
          {sl.imageUrl && <div style={{ flex: 1, height: "100%", borderRadius: 6 * rScale, overflow: "hidden", background: "#000" }}>
            <img src={sl.imageUrl} style={{ width: "100%", height: "100%", objectFit: imgFit, objectPosition: imgPos, display: "block" }} onError={hideOnError} />
          </div>}
          {sl.imageUrl2 && <div style={{ flex: 1, height: "100%", borderRadius: 6 * rScale, overflow: "hidden", background: "#000" }}>
            <img src={sl.imageUrl2} style={{ width: "100%", height: "100%", objectFit: imgFit, display: "block" }} onError={hideOnError} />
          </div>}
        </div>
      </div>}
    </div>
  </div>;
}
