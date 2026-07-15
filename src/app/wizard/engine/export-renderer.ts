// ═══════════════════════════════════════════════════════════════════════════
// Wizard engine · PNG export renderer (hand-rolled Canvas2D, no html2canvas)
//
// VERBATIM extraction of carousel.tsx:2206-2621 (SA CAROUSEL v3.1). Every
// drawing branch, constant, and default is copied exactly — the PNG output
// must stay pixel-identical to the monolith's Export step. Only the
// imports/exports differ from the original file-local functions.
// ═══════════════════════════════════════════════════════════════════════════

import { renderCoverSvg } from "../../carousel-covers";
import { renderUniqueSvg } from "./unique/render";
import { composeLibrarySvg, ensureLibraryAssets, libraryBgSvgDoc, ensureClassicBgs } from "./library/compose";
import { FULL_W, FULL_H, MARGIN_X, type Slide } from "./types";

// ═══ CANVAS RENDERER (for export) ═══
// Ensure Grift (all weights used) is loaded before drawing to canvas.
// Without this, canvas can fall back to Outfit/sans-serif on first export.
export async function ensureFontsReady(): Promise<void> {
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

// Fetch an image URL and return it as a self-contained data URL, falling back to
// the same proxy the canvas path uses for CORS-blocked sources. Empty string when
// there's nothing to load or every attempt fails. Needed because an SVG drawn via
// <img> can't load EXTERNAL <image href> resources (and would taint the canvas),
// so the cover photo must be embedded inline.
export async function imageToDataUrl(url: string | undefined): Promise<string> {
  if (!url) return "";
  if (url.indexOf("data:") === 0) return url;
  async function fetchAsDataUrl(u: string): Promise<string> {
    var res = await fetch(u);
    if (!res.ok) throw new Error("fetch " + res.status);
    var blob = await res.blob();
    return await new Promise<string>(function(resolve, reject) {
      var fr = new FileReader();
      fr.onload = function() { resolve(String(fr.result)); };
      fr.onerror = function() { reject(new Error("read failed")); };
      fr.readAsDataURL(blob);
    });
  }
  try { return await fetchAsDataUrl(url); }
  catch {
    try { return await fetchAsDataUrl("/api/image-proxy?url=" + encodeURIComponent(url)); }
    catch { return ""; }
  }
}

// Rasterize the SELECTED branded cover template — the exact SVG the editor shows
// via renderCoverSvg — onto the export canvas, over whatever background was drawn.
// Mirrors the on-screen SlideCanvas cover branch so the export is WYSIWYG instead
// of falling back to the legacy image+title layout. 'Outfit'/'JetBrains Mono'
// aren't bundled web fonts, so the SVG rasterizer resolves them the same way the
// preview does.
export function drawCoverTemplate(ctx: CanvasRenderingContext2D, slide: Slide): Promise<void> {
  return new Promise<void>(function(resolve) {
    imageToDataUrl(slide.imageUrl).then(function(imgData) {
      var inner = renderCoverSvg(slide.coverTemplate!, {
        title: slide.title || "",
        subtitle: slide.subtitle || "",
        accent: slide.coverAccent || "#F7B041",
        imageUrl: imgData,
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
      });
      var svg = '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + FULL_W + '" height="' + FULL_H + '">' + inner + '</svg>';
      var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      var img = new Image();
      img.onload = function() {
        try { ctx.drawImage(img, 0, 0, FULL_W, FULL_H); } catch { /* ignore draw failure */ }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = function() { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  });
}

// ═══ UNIQUE SLIDE EXPORT (C3 additive branch) ═══
// Normalize renderUniqueSvg output into a rasterizable SVG document with
// explicit pixel dimensions: an SVG loaded through <img> needs an intrinsic
// size, or the browser rasterizes it at the SVG default and drawImage
// upscales a blurry bitmap. Handles both a complete <svg> document and an
// inner fragment (cover-template style) from engine/unique/render.
function uniqueSvgMarkup(slide: Slide, page: number, total: number): string {
  var raw = renderUniqueSvg(slide, page, total);
  var open = raw.match(/^\s*<svg[^>]*>/i);
  if (open) {
    var tag = open[0].replace(/\s(?:width|height|style)="[^"]*"/gi, "").replace(/<svg/i, '<svg width="' + FULL_W + '" height="' + FULL_H + '"');
    return tag + raw.slice(open[0].length);
  }
  return '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + FULL_W + '" height="' + FULL_H + '">' + raw + '</svg>';
}

// Rasterize a UNIQUE slide: the complete self-contained SVG from
// engine/unique/render (backdrop + all content, seeded PRNG so this matches
// the on-canvas render exactly) via the same blob URL, <img>, ctx.drawImage
// full-bleed path drawCoverTemplate uses. Unique slides paint their own
// background, so the backdrop-image load is skipped entirely.
function renderUniqueSlideToCanvas(slide: Slide, page: number, total: number): Promise<Blob> {
  return new Promise<Blob>(function(resolve, reject) {
    var canvas = document.createElement("canvas");
    canvas.width = FULL_W;
    canvas.height = FULL_H;
    var ctx = canvas.getContext("2d")!;
    function finish() {
      canvas.toBlob(function(blob) {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/png");
    }
    // v3.7: warm the library-bg text cache first — renderUniqueSvg swaps a
    // stamped slide.libraryBg into the backdrop layer, and the export must
    // rasterize the same string the DOM preview shows.
    Promise.all([ensureFontsReady(), ensureClassicBgs([slide]).catch(function() {})]).then(function() {
      var svg = uniqueSvgMarkup(slide, page, total);
      var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      var img = new Image();
      img.onload = function() {
        try { ctx.drawImage(img, 0, 0, FULL_W, FULL_H); } catch { /* ignore draw failure */ }
        URL.revokeObjectURL(url);
        finish();
      };
      img.onerror = function() { URL.revokeObjectURL(url); finish(); };
      img.src = url;
    });
  });
}

// ═══ LIBRARY SLIDE EXPORT (design-system handoff branch) ═══
// Normalize the composed library SVG into a rasterizable document with
// explicit pixel dimensions — same reason as uniqueSvgMarkup: an SVG loaded
// through <img> needs an intrinsic size, or the browser rasterizes it at the
// SVG default and drawImage upscales a blurry bitmap. compose always returns
// a complete <svg> document; the fragment fallback mirrors uniqueSvgMarkup.
function librarySvgMarkup(composed: string): string {
  var open = composed.match(/^\s*<svg[^>]*>/i);
  if (open) {
    var tag = open[0].replace(/\s(?:width|height|style)="[^"]*"/gi, "").replace(/<svg/i, '<svg width="' + FULL_W + '" height="' + FULL_H + '"');
    return tag + composed.slice(open[0].length);
  }
  return '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + FULL_W + '" height="' + FULL_H + '">' + composed + '</svg>';
}

// Decode the XML attribute escaping XMLSerializer applied when compose wrote
// slot <image href> values (URLs legitimately contain "&" → "&amp;"). Only
// the five predefined entities can appear in a serialized attribute; &amp;
// is decoded LAST so "&amp;lt;" round-trips to "&lt;" correctly.
function decodeXmlEntities(v: string): string {
  return v
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Inline every external <image href> in a composed library SVG as a data
// URL. An SVG rasterized through <img> can NOT load external resources —
// slot images would silently drop from the bitmap — so each href is fetched
// through imageToDataUrl (the same direct-then-proxy fallback the canvas
// image path uses) and substituted before rasterizing. Runs AFTER the
// composed string is shared verbatim with the DOM preview; inlining applies
// only at export. A failed fetch leaves the href untouched (that image drops
// silently, matching the canvas path's give-up behavior).
async function inlineSvgImageHrefs(svg: string): Promise<string> {
  var raws: string[] = [];
  var re = /<image\b[^>]*?\s(?:xlink:)?href="([^"]+)"/gi;
  var m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    if (m[1].indexOf("data:") !== 0 && raws.indexOf(m[1]) < 0) raws.push(m[1]);
  }
  if (!raws.length) return svg;
  var datas = await Promise.all(raws.map(function(raw) { return imageToDataUrl(decodeXmlEntities(raw)); }));
  for (var i = 0; i < raws.length; i++) {
    if (!datas[i]) continue; // every fetch attempt failed — keep the href
    svg = svg.split('href="' + raws[i] + '"').join('href="' + datas[i] + '"');
  }
  return svg;
}

// Rasterize a LIBRARY slide: the IDENTICAL composed SVG string the DOM
// preview shows (engine/library/compose, cached per slide) via the same blob
// URL, <img>, ctx.drawImage full-bleed path the unique branch uses. Only
// difference from the preview: slot <image href> URLs are inlined as data
// URLs first (see inlineSvgImageHrefs). If compose is cold (export before
// any preview render), ensureLibraryAssets warms the caches and the same
// composition runs — never a different string.
function renderLibrarySlideToCanvas(slide: Slide): Promise<Blob> {
  return new Promise<Blob>(function(resolve, reject) {
    var canvas = document.createElement("canvas");
    canvas.width = FULL_W;
    canvas.height = FULL_H;
    var ctx = canvas.getContext("2d")!;
    // Placeholder-parity base fill (#0A0B10, the renderers' uncached color)
    // so a failed compose still exports an opaque frame, not transparency.
    // The composed backgrounds are full-bleed opaque, so this never shows
    // through a successful draw.
    ctx.fillStyle = "#0A0B10";
    ctx.fillRect(0, 0, FULL_W, FULL_H);
    function finish() {
      canvas.toBlob(function(blob) {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/png");
    }
    function draw(composed: string) {
      inlineSvgImageHrefs(composed).then(function(inlined) {
        var svg = librarySvgMarkup(inlined);
        var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
        var img = new Image();
        img.onload = function() {
          try { ctx.drawImage(img, 0, 0, FULL_W, FULL_H); } catch { /* ignore draw failure */ }
          URL.revokeObjectURL(url);
          finish();
        };
        img.onerror = function() { URL.revokeObjectURL(url); finish(); };
        img.src = url;
      });
    }
    ensureFontsReady().then(function() {
      var composed = composeLibrarySvg(slide);
      if (composed) { draw(composed); return; }
      ensureLibraryAssets([slide])
        .then(function() {
          var warmed = composeLibrarySvg(slide);
          if (warmed) draw(warmed);
          else finish(); // unknown template idx — compose logged; export the base frame
        })
        .catch(function() { finish(); }); // asset fetch failed — base frame beats a hung export
    });
  });
}

export function renderSlideToCanvas(slide: Slide, bgUrl: string, page?: number, total?: number): Promise<Blob> {
  // Unique slides render their own full-bleed SVG; no backdrop image exists
  // for them, so branch before the bgUrl load. page/total are optional so
  // existing call sites compile unchanged (Stations pass them when known).
  if (slide.type === "unique") return renderUniqueSlideToCanvas(slide, page ?? 1, total ?? 1);
  // Library slides likewise self-render (composed bg + template SVG).
  if (slide.type === "library") return renderLibrarySlideToCanvas(slide);
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
      if (bgBlobUrl) { URL.revokeObjectURL(bgBlobUrl); bgBlobUrl = null; }
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

      function drawImage(imageUrl: string | undefined, x: number, y: number, w: number, h: number, radius: number, opts?: { position?: string; fit?: string }) {
        return new Promise<void>(function(resolveImg) {
          if (!imageUrl) { resolveImg(); return; }

          // Resolve CSS-like object-position to fractional offsets so the
          // canvas pipeline matches what the editor and review panel show
          // when the user picks Top / Left / Center / etc.
          function resolveOffset(pos: string | undefined) {
            var hx = 0.5, vy = 0.5;
            if (pos) {
              var p = pos.toLowerCase().trim();
              if (p.indexOf("left") >= 0) hx = 0;
              else if (p.indexOf("right") >= 0) hx = 1;
              if (p.indexOf("top") >= 0) vy = 0;
              else if (p.indexOf("bottom") >= 0) vy = 1;
            }
            return { hx: hx, vy: vy };
          }

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

            var fit = (opts && opts.fit) || "cover";
            var off = resolveOffset(opts && opts.position);
            var imgAspect = img.width / img.height;
            var frameAspect = w / h;
            var dw, dh, dx, dy;

            if (fit === "fill") {
              // Stretch to frame — distortion expected.
              dw = w; dh = h; dx = x; dy = y;
            } else if (fit === "contain") {
              // Letterbox — fit entire image inside frame, use position to
              // place the letterboxed image.
              if (imgAspect > frameAspect) { dw = w; dh = w / imgAspect; }
              else { dh = h; dw = h * imgAspect; }
              dx = x + (w - dw) * off.hx;
              dy = y + (h - dh) * off.vy;
            } else {
              // cover (default) — fill frame, crop excess based on position.
              // When dw > w, (w - dw) is negative; multiplying by hx slides
              // the image so hx=0 anchors the LEFT edge of the image to the
              // frame's left, hx=1 anchors the RIGHT edge.
              if (imgAspect > frameAspect) { dh = h; dw = dh * imgAspect; }
              else { dw = w; dh = dw / imgAspect; }
              dx = x + (w - dw) * off.hx;
              dy = y + (h - dh) * off.vy;
            }

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
      var COVER_TOP_Y = slide.titleAnchor === "center" ? TOP_Y : (slide.titleMarginTop ?? 80);
      var BOTTOM_Y = Math.round(FULL_H * 0.08);
      var contentWidth = FULL_W - MARGIN_X * 2;
      var coverContentWidth = FULL_W - COVER_MX * 2;
      var availH = FULL_H - TOP_Y - BOTTOM_Y;
      var coverAvailH = FULL_H - COVER_TOP_Y - BOTTOM_Y;

      async function drawContent() {
        // Date + title stamp at very top left (small, subtle)
        var dateStr = new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) + "." + String(new Date().getFullYear()).slice(2);
        var stampTitle = (slide._carouselTitle || "").slice(0, 20);
        var stamp = stampTitle ? dateStr + " - " + stampTitle : dateStr;
        // Drawn small in top-left, below logo line
        // (skip — logo area is sacred, stamp goes nowhere visible on the slide itself)
        void stamp;

        // Per-slide image rendering options (CSS object-position / fit
        // semantics) so the canvas export matches the editor exactly.
        var imgOpts = { position: slide.imagePosition, fit: slide.imageFit };
        var imgOpts2 = { position: slide.imagePosition2, fit: slide.imageFit };

        if (slide.type === "cover" && slide.coverTemplate) {
          // A branded cover template is selected — render that exact SVG (what the
          // editor shows) instead of the legacy image+title fallback, which was
          // ignoring the selection and exporting the original cover.
          await drawCoverTemplate(ctx, slide);

        } else if (slide.type === "cover") {
          ctx.textAlign = "left";
          var imgHPct = (slide.imageHeight || 46) / 100;
          var imgH = Math.round(coverAvailH * imgHPct);
          await drawImage(slide.imageUrl, COVER_MX, COVER_TOP_Y, coverContentWidth, imgH, 20, imgOpts);
          var titleY = COVER_TOP_Y + imgH + 20;
          var afterTitle = drawText(slide.title || "", COVER_MX, titleY, coverContentWidth, slide.titleSize, "800", "#ffffff", 1.15);
          drawText(slide.subtitle || "", COVER_MX, afterTitle + 8, coverContentWidth, slide.subtitleSize, "400", "rgba(255,255,255,0.78)", 1.4);

        } else if (slide.type === "body") {
          ctx.textAlign = "left";
          if (slide.imageUrl && !slide.inverted) {
            // Image on top, text below
            var bImgH = Math.round(availH * ((slide.imageHeight || 45) / 100));
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, bImgH, 20, imgOpts);
            drawText(slide.bodyText || "", MARGIN_X, TOP_Y + bImgH + 16, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.55);
          } else if (slide.imageUrl && slide.inverted) {
            // Text on top, image below
            var bImgH2 = Math.round(availH * ((slide.imageHeight || 45) / 100));
            var textEndY = drawText(slide.bodyText || "", MARGIN_X, TOP_Y, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.55);
            await drawImage(slide.imageUrl, MARGIN_X, textEndY + 16, contentWidth, bImgH2, 20, imgOpts);
          } else if (slide.bodyAnchor === "top") {
            // Text only, top-anchored
            drawText(slide.bodyText || "", MARGIN_X, TOP_Y, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.55);
          } else {
            // Text only — vertically center (legacy)
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
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, itImgH, 20, imgOpts);
            drawText(slide.bodyText || "", MARGIN_X, TOP_Y + itImgH + 16, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.5);
          } else {
            var itTextEnd = drawText(slide.bodyText || "", MARGIN_X, TOP_Y, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.5);
            await drawImage(slide.imageUrl, MARGIN_X, itTextEnd + 16, contentWidth, itImgH, 20, imgOpts);
          }

        } else if (slide.type === "large_image") {
          var liImgH = Math.round(availH * ((slide.imageHeight || 72) / 100));
          if (!slide.inverted) {
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, liImgH, 20, imgOpts);
            drawText(slide.caption || "", MARGIN_X, TOP_Y + liImgH + 12, contentWidth, slide.captionSize || 18, "400", "rgba(255,255,255,0.65)", 1.4);
          } else {
            var liCapEnd = drawText(slide.caption || "", MARGIN_X, TOP_Y, contentWidth, slide.captionSize || 18, "400", "rgba(255,255,255,0.65)", 1.4);
            await drawImage(slide.imageUrl, MARGIN_X, liCapEnd + 12, contentWidth, liImgH, 20, imgOpts);
          }

        } else if (slide.type === "dual_image") {
          var halfH = Math.round((availH - 16) / 2);
          await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, halfH - 20, 16, imgOpts);
          drawText(slide.caption || "", MARGIN_X, TOP_Y + halfH - 16, contentWidth, slide.captionSize || 16, "400", "rgba(255,255,255,0.65)", 1.3);
          await drawImage(slide.imageUrl2, MARGIN_X, TOP_Y + halfH + 8, contentWidth, halfH - 20, 16, imgOpts2);
          drawText(slide.caption2 || "", MARGIN_X, TOP_Y + halfH * 2 - 8, contentWidth, slide.captionSize || 16, "400", "rgba(255,255,255,0.65)", 1.3);

        } else if (slide.type === "cover_image") {
          // Full-bleed image, no text. Fills the inner area between
          // the 10% top and 10% bottom safe zones.
          var ciTop = Math.round(FULL_H * 0.10);
          var ciH = FULL_H - ciTop * 2;
          await drawImage(slide.imageUrl, COVER_MX, ciTop, coverContentWidth, ciH, 20, imgOpts);

        } else if (slide.type === "large_with_title") {
          // Large image + title + subtitle (hero-with-copy). Mirrors
          // SlideCanvas behavior including inverted (text-on-top).
          ctx.textAlign = "left";
          var lwtImgH = Math.round(availH * ((slide.imageHeight || 60) / 100));
          if (!slide.inverted) {
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, contentWidth, lwtImgH, 20, imgOpts);
            var lwtTitleY = TOP_Y + lwtImgH + 16;
            var lwtAfterTitle = drawText(slide.title || "", MARGIN_X, lwtTitleY, contentWidth, slide.titleSize, "800", "#ffffff", 1.15);
            drawText(slide.subtitle || "", MARGIN_X, lwtAfterTitle + 8, contentWidth, slide.subtitleSize, "400", "rgba(255,255,255,0.78)", 1.4);
          } else {
            var lwtAfterTitleI = drawText(slide.title || "", MARGIN_X, TOP_Y, contentWidth, slide.titleSize, "800", "#ffffff", 1.15);
            var lwtAfterSubI = drawText(slide.subtitle || "", MARGIN_X, lwtAfterTitleI + 8, contentWidth, slide.subtitleSize, "400", "rgba(255,255,255,0.78)", 1.4);
            await drawImage(slide.imageUrl, MARGIN_X, lwtAfterSubI + 16, contentWidth, lwtImgH, 20, imgOpts);
          }

        } else if (slide.type === "body_dual") {
          // Body text + two side-by-side images below. Inverted swaps so
          // images go on top, text below.
          ctx.textAlign = "left";
          var bdGap = 10;
          var bdImgGap = 8;
          var bdImageRowH = Math.max(120, Math.round(availH * 0.55));
          var bdHalfW = Math.round((contentWidth - bdImgGap) / 2);
          if (!slide.inverted) {
            var bdTextEnd = drawText(slide.bodyText || "", MARGIN_X, TOP_Y, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.5);
            var bdImgY = bdTextEnd + bdGap;
            await drawImage(slide.imageUrl, MARGIN_X, bdImgY, bdHalfW, bdImageRowH, 16, imgOpts);
            await drawImage(slide.imageUrl2, MARGIN_X + bdHalfW + bdImgGap, bdImgY, bdHalfW, bdImageRowH, 16, imgOpts2);
          } else {
            await drawImage(slide.imageUrl, MARGIN_X, TOP_Y, bdHalfW, bdImageRowH, 16, imgOpts);
            await drawImage(slide.imageUrl2, MARGIN_X + bdHalfW + bdImgGap, TOP_Y, bdHalfW, bdImageRowH, 16, imgOpts2);
            drawText(slide.bodyText || "", MARGIN_X, TOP_Y + bdImageRowH + bdGap, contentWidth, slide.bodySize, "400", "rgba(255,255,255,0.92)", 1.5);
          }
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
          var ctaY = FULL_H - ctaFontSize - 60;
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
    bgImg.onerror = function() {
      if (bgBlobUrl) { URL.revokeObjectURL(bgBlobUrl); bgBlobUrl = null; }
      reject(new Error("Failed to load background: " + bgUrl));
    };
    // v3.7: a stamped library backdrop (deck bgSource "library") replaces
    // the theme JPG — the same recolored SVG doc the DOM layer inlines,
    // rasterized via blob URL with a forced intrinsic size (librarySvgMarkup)
    // so the aspect math above degenerates to a clean full-bleed draw. The
    // text-cache warm-up is awaited for parity; a cold/offline miss falls
    // back to the theme JPG rather than failing the slide.
    var bgBlobUrl: string | null = null;
    if (slide.libraryBg) {
      ensureClassicBgs([slide])
        .then(function() {
          var doc = libraryBgSvgDoc(slide.libraryBg!, slide.libraryPalette || "blend", !!slide.libraryBgFlip);
          if (!doc) { bgImg.src = bgUrl; return; }
          bgBlobUrl = URL.createObjectURL(new Blob([librarySvgMarkup(doc)], { type: "image/svg+xml;charset=utf-8" }));
          bgImg.src = bgBlobUrl;
        })
        .catch(function() { bgImg.src = bgUrl; });
    } else {
      bgImg.src = bgUrl;
    }
  });
}
